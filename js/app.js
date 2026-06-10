/**
 * SubTrack Main Application Controller
 */

import supabase from "./supabase.js";
import { defaultSubscriptions, defaultBudget } from "../data/defaultData.js";
import { showToast } from "../components/Toast.js";
import { 
  openDeleteConfirmModal, 
  openSubscriptionFormModal, 
  openBudgetModal, 
  openProfileModal,
  closeModal
} from "../components/Dialog.js";
import { createSubscriptionCard } from "../components/SubscriptionCard.js";
import { initCharts, updateCharts } from "./charts.js";

// Setup Base Date for relative calculations: Today
const BASE_DATE = new Date();
BASE_DATE.setHours(0,0,0,0);

// Global App State
const state = {
  subscriptions: [],
  budgetLimit: defaultBudget,
  profile: { name: "", email: "", avatar: "" },
  notifications: [],
  activeTab: "dashboard",
  theme: "dark",
  currentCalendarMonth: BASE_DATE.getMonth(), // 0-indexed
  currentCalendarYear: BASE_DATE.getFullYear()
};

let currentUser = null;

/* ==========================================
   INITIALIZATION & DB STORAGE
   ========================================== */
async function init() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      window.location.replace("auth.html");
      return;
    }

    currentUser = session.user;

    // Set initial loading skeleton effect for subscriptions
    showSkeletonLoader();

    try {
      await loadStateFromDB(currentUser.id);
    } catch (error) {
      showToast("Load Error", error.message, "error");
    }

    applyTheme();
    setupUIEventListeners();

    // Run initial calculations & UI renders
    setTimeout(async () => {
      hideSkeletonLoader();
      updateDashboardMetrics();
      renderSubscriptionsList();
      renderCalendar();
      renderNotificationsDrawer();
      await checkUpcomingRenewalsAndNotify();
      
      // Initialize charts
      initCharts(state.subscriptions, state.budgetLimit, state.theme);
    }, 600); // Small delay to show off beautiful skeleton loader
  } catch (error) {
    console.error("Initialization failed:", error);
    window.location.replace("auth.html");
  }
}

const mapDBToSubscription = (row) => ({
  id: row.id,
  name: row.name,
  price: parseFloat(row.price),
  billingCycle: row.billing_cycle,
  startDate: row.start_date,
  renewalDate: row.renewal_date,
  category: row.category,
  color: row.color,
  iconClass: row.icon_class,
  notes: row.notes || ""
});

const mapSubscriptionToDB = (sub, userId) => ({
  id: sub.id,
  user_id: userId,
  name: sub.name,
  price: sub.price,
  billing_cycle: sub.billingCycle,
  start_date: sub.startDate,
  renewal_date: sub.renewalDate,
  category: sub.category,
  color: sub.color,
  icon_class: sub.iconClass,
  notes: sub.notes
});

async function loadStateFromDB(userId) {
  // Fetch subscriptions
  const { data: subsData, error: subsError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (subsError) throw subsError;
  state.subscriptions = (subsData || []).map(mapDBToSubscription);

  // Fetch settings
  const { data: settingsData, error: settingsError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) throw settingsError;

  if (!settingsData) {
    const defaultSettings = {
      user_id: userId,
      budget_limit: defaultBudget,
      theme: 'dark',
      notifications: []
    };
    const { error: insertError } = await supabase
      .from('user_settings')
      .insert(defaultSettings);
    if (insertError) throw insertError;
    
    state.budgetLimit = defaultBudget;
    state.theme = 'dark';
    state.notifications = [];
  } else {
    state.budgetLimit = parseFloat(settingsData.budget_limit);
    state.theme = settingsData.theme || 'dark';
    state.notifications = settingsData.notifications || [];
  }

  // Fetch profile
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profileData) {
    const metadataName = currentUser.user_metadata?.name || currentUser.email.split('@')[0];
    const newProfile = {
      user_id: userId,
      name: metadataName,
      email: currentUser.email,
      avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(metadataName)}`
    };
    const { error: insertError } = await supabase
      .from('profiles')
      .insert(newProfile);
    if (insertError) throw insertError;

    state.profile = {
      name: newProfile.name,
      email: newProfile.email,
      avatar: newProfile.avatar
    };
  } else {
    state.profile = {
      name: profileData.name,
      email: profileData.email,
      avatar: profileData.avatar
    };
  }
}

async function saveSubscriptions() {
  try {
    const dbSubs = state.subscriptions.map(sub => mapSubscriptionToDB(sub, currentUser.id));
    const currentIds = state.subscriptions.map(s => s.id);

    if (currentIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', currentUser.id)
        .not('id', 'in', `(${currentIds.join(',')})`);
      if (deleteError) throw deleteError;
    } else {
      const { error: deleteError } = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', currentUser.id);
      if (deleteError) throw deleteError;
    }

    if (dbSubs.length > 0) {
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert(dbSubs);
      if (upsertError) throw upsertError;
    }
  } catch (error) {
    showToast("Error", error.message, "error");
  }
}

async function saveSettings() {
  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: currentUser.id,
        budget_limit: state.budgetLimit,
        theme: state.theme,
        notifications: state.notifications
      });
    if (error) throw error;
  } catch (error) {
    showToast("Error", error.message, "error");
  }
}

async function saveProfile() {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: currentUser.id,
        name: state.profile.name,
        email: state.profile.email,
        avatar: state.profile.avatar
      });
    if (error) throw error;
  } catch (error) {
    showToast("Error", error.message, "error");
  }
}

/* ==========================================
   THEME TOGGLER
   ========================================== */
function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  const themeIcon = document.getElementById("theme-toggle-icon");
  const themeCheckbox = document.getElementById("settings-theme-toggle");

  if (state.theme === "light") {
    themeIcon.className = "fa-solid fa-sun";
    if (themeCheckbox) themeCheckbox.checked = false;
  } else {
    themeIcon.className = "fa-solid fa-moon";
    if (themeCheckbox) themeCheckbox.checked = true;
  }
}

async function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  await saveSettings();
  applyTheme();
  
  // Re-draw charts with new theme colors
  updateCharts(state.subscriptions, state.budgetLimit, state.theme);
  showToast("Theme Updated", `Switched to ${state.theme} mode.`, "info", 1500);
}

/* ==========================================
   ROUTING & TAB SWITCHER
   ========================================== */
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Update sidebar menu active state
  document.querySelectorAll(".sidebar-menu .menu-item").forEach(item => {
    if (item.getAttribute("data-tab") === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update section visibility
  document.querySelectorAll(".dashboard-section").forEach(sec => {
    sec.classList.remove("active");
  });
  
  const targetSection = document.getElementById(`section-${tabId}`);
  if (targetSection) {
    targetSection.classList.add("active");
  }

  // Update Page Title
  const titleEl = document.getElementById("page-current-title");
  if (titleEl) {
    titleEl.textContent = tabId.charAt(0).toUpperCase() + tabId.slice(1);
  }

  // Mobile drawer close if open
  document.getElementById("sidebar").classList.remove("open");

  // Custom renders on tab change if needed
  if (tabId === "calendar") {
    renderCalendar();
  } else if (tabId === "analytics") {
    // Re-draw charts to ensure proper canvas layout size fitting
    updateCharts(state.subscriptions, state.budgetLimit, state.theme);
    renderAnalyticsSummaries();
  } else if (tabId === "dashboard") {
    updateDashboardMetrics();
    // Redraw the line chart on dashboard
    initCharts(state.subscriptions, state.budgetLimit, state.theme);
  }
}

/* ==========================================
   CRUD CONTROLLER OPERATIONS
   ========================================== */
async function addOrUpdateSubscription(subData) {
  const existingIdx = state.subscriptions.findIndex(s => s.id === subData.id);
  
  if (existingIdx > -1) {
    // Update
    state.subscriptions[existingIdx] = subData;
    showToast("Subscription Updated", `${subData.name} details successfully saved.`, "success");
  } else {
    // Add New
    state.subscriptions.push(subData);
    showToast("Subscription Added", `${subData.name} was successfully registered!`, "success");
  }

  await saveSubscriptions();
  
  // Re-run calculations & views
  updateDashboardMetrics();
  renderSubscriptionsList();
  renderCalendar();
  
  // Check budget limits
  await checkBudgetThreshold();
  
  // Update charts
  updateCharts(state.subscriptions, state.budgetLimit, state.theme);
}

function deleteSubscription(subId) {
  const sub = state.subscriptions.find(s => s.id === subId);
  if (!sub) return;

  openDeleteConfirmModal(sub.name, async () => {
    state.subscriptions = state.subscriptions.filter(s => s.id !== subId);
    await saveSubscriptions();
    
    showToast("Subscription Deleted", `${sub.name} has been removed.`, "error");
    
    updateDashboardMetrics();
    renderSubscriptionsList();
    renderCalendar();
    updateCharts(state.subscriptions, state.budgetLimit, state.theme);
  });
}

/* ==========================================
   METRICS & CALCULATIONS
   ========================================== */
function getNormalizedMonthlySpend() {
  return state.subscriptions.reduce((sum, sub) => {
    const monthlyEquivalent = sub.billingCycle === "monthly" ? sub.price : sub.price / 12;
    return sum + monthlyEquivalent;
  }, 0);
}

function updateDashboardMetrics() {
  // 1. Calculate Spend metrics
  const totalMonthlySpend = getNormalizedMonthlySpend();
  
  const spendValEl = document.getElementById("stat-monthly-spend");
  if (spendValEl) {
    spendValEl.textContent = new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR"
    }).format(totalMonthlySpend);
  }

  // Calculate percentage of budget used
  const budgetPercent = state.budgetLimit > 0 ? Math.round((totalMonthlySpend / state.budgetLimit) * 100) : 0;
  const percentageEl = document.getElementById("stat-spending-percentage");
  if (percentageEl) {
    percentageEl.innerHTML = `<i class="fa-solid fa-arrow-right"></i> ${budgetPercent}% of monthly budget (₨ ${state.budgetLimit.toLocaleString("en-PK")})`;
    if (budgetPercent > 100) {
      percentageEl.style.color = "var(--danger)";
    } else if (budgetPercent > 80) {
      percentageEl.style.color = "var(--warning)";
    } else {
      percentageEl.style.color = "var(--text-muted)";
    }
  }

  // 2. Active Count & Billing Split info
  const activeCountEl = document.getElementById("stat-active-count");
  if (activeCountEl) {
    activeCountEl.textContent = state.subscriptions.length;
  }
  const billingInfoEl = document.getElementById("stat-active-billing-info");
  if (billingInfoEl) {
    const monthlyCount = state.subscriptions.filter(s => s.billingCycle === "monthly").length;
    const yearlyCount = state.subscriptions.filter(s => s.billingCycle === "yearly").length;
    billingInfoEl.textContent = `${monthlyCount} monthly, ${yearlyCount} yearly`;
  }

  // 3. Calculate Upcoming Renewals (next 7 days relative to BASE_DATE)
  let upcomingCount = 0;
  state.subscriptions.forEach(sub => {
    const days = getDaysUntilRenewal(sub.renewalDate);
    if (days >= 0 && days <= 7) {
      upcomingCount++;
    }
  });
  
  const upcomingCountEl = document.getElementById("stat-upcoming-count");
  if (upcomingCountEl) {
    upcomingCountEl.textContent = upcomingCount;
  }

  // 4. Highest Premium Card
  let highestSub = null;
  let highestMonthlyCost = 0;
  
  state.subscriptions.forEach(sub => {
    const monthlyCost = sub.billingCycle === "monthly" ? sub.price : sub.price / 12;
    if (monthlyCost > highestMonthlyCost) {
      highestMonthlyCost = monthlyCost;
      highestSub = sub;
    }
  });

  const highestNameEl = document.getElementById("stat-highest-name");
  const highestCostEl = document.getElementById("stat-highest-cost");
  if (highestSub) {
    if (highestNameEl) highestNameEl.textContent = highestSub.name;
    if (highestCostEl) {
      highestCostEl.textContent = `${new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR"
      }).format(highestSub.price)}/${highestSub.billingCycle === 'monthly' ? 'mo' : 'yr'}`;
    }
  } else {
    if (highestNameEl) highestNameEl.textContent = "N/A";
    if (highestCostEl) highestCostEl.textContent = "₨0.00/mo";
  }

  // 5. Update Profile Cards in DOM
  const avatarElements = [document.getElementById("sidebar-avatar")];
  const nameElements = [document.getElementById("sidebar-name"), document.getElementById("dropdown-name")];
  const emailElements = [document.getElementById("sidebar-email"), document.getElementById("dropdown-email")];

  avatarElements.forEach(el => {
    if (el) el.src = state.profile.avatar;
  });
  nameElements.forEach(el => {
    if (el) el.textContent = state.profile.name;
  });
  emailElements.forEach(el => {
    if (el) el.textContent = state.profile.email;
  });

  // 6. Update Budget Progress Bar on Dashboard
  updateBudgetProgressBar(totalMonthlySpend);

  // 7. Generate Insights list
  generateSpendingInsights(totalMonthlySpend);
}

function getDaysUntilRenewal(renewalDateStr) {
  const renewDate = new Date(renewalDateStr);
  renewDate.setHours(0,0,0,0);
  const diffTime = renewDate.getTime() - BASE_DATE.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/* ==========================================
   BUDGET PROGRESS & INSIGHTS
   ========================================== */
function updateBudgetProgressBar(spent) {
  const bar = document.getElementById("budget-progress-bar");
  const spentLabel = document.getElementById("budget-spent-label");
  const limitLabel = document.getElementById("budget-limit-label");
  const statusMsg = document.getElementById("budget-status-message");

  if (!bar || !spentLabel || !limitLabel || !statusMsg) return;

  const formattedSpent = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(spent);
  const formattedLimit = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(state.budgetLimit);

  spentLabel.textContent = `Spent: ${formattedSpent}`;
  limitLabel.textContent = `Budget: ${formattedLimit}`;

  const ratio = state.budgetLimit > 0 ? (spent / state.budgetLimit) * 100 : 0;
  const cappedRatio = Math.min(ratio, 100);
  
  // Set width
  bar.style.width = `${cappedRatio}%`;
  
  // Remove classes first
  bar.classList.remove("warning", "danger");
  statusMsg.style.color = "var(--text-secondary)";

  if (ratio > 100) {
    bar.classList.add("danger");
    statusMsg.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i> Overbudget by <strong>₨ ${(spent - state.budgetLimit).toLocaleString("en-PK")}</strong>! Try reviewing unused subscriptions.`;
    statusMsg.style.color = "var(--danger)";
  } else if (ratio > 80) {
    bar.classList.add("warning");
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-info" style="color: var(--warning);"></i> Running close! You have used <strong>${Math.round(ratio)}%</strong> of your monthly limit.`;
    statusMsg.style.color = "var(--warning)";
  } else {
    statusMsg.innerHTML = `<i class="fa-solid fa-circle-check" style="color: var(--accent);"></i> Solid standing. You have used <strong>${Math.round(ratio)}%</strong> of your budget.`;
  }
}

function generateSpendingInsights(totalSpend) {
  const container = document.getElementById("insights-container");
  if (!container) return;

  container.innerHTML = "";

  const insights = [];

  // Insight 1: Budget Health
  if (totalSpend > state.budgetLimit) {
    insights.push({
      type: "danger",
      icon: "fa-solid fa-circle-exclamation",
      title: "Budget Cap Breached",
      desc: `Your active subscriptions (₨ ${totalSpend.toLocaleString("en-PK")}) exceed your monthly limit (₨ ${state.budgetLimit.toLocaleString("en-PK")}) by ₨ ${(totalSpend - state.budgetLimit).toLocaleString("en-PK")}.`
    });
  } else if (totalSpend > state.budgetLimit * 0.8) {
    insights.push({
      type: "warning",
      icon: "fa-solid fa-triangle-exclamation",
      title: "Approaching Expense Limit",
      desc: "You are within 20% of your maximum subscription budget. Avoid adding new services for now."
    });
  } else {
    insights.push({
      type: "success",
      icon: "fa-solid fa-thumbs-up",
      title: "Healthy Budget Allocation",
      desc: `You are currently saving ₨ ${(state.budgetLimit - totalSpend).toLocaleString("en-PK")} of your set monthly limit. Good job!`
    });
  }

  // Insight 2: Category distribution cost concentration
  const categoryData = {};
  state.subscriptions.forEach(sub => {
    const cost = sub.billingCycle === "monthly" ? sub.price : sub.price / 12;
    categoryData[sub.category] = (categoryData[sub.category] || 0) + cost;
  });

  let topCategory = "N/A";
  let topCost = 0;
  Object.keys(categoryData).forEach(cat => {
    if (categoryData[cat] > topCost) {
      topCost = categoryData[cat];
      topCategory = cat;
    }
  });

  if (topCost > 0 && totalSpend > 0) {
    const percent = Math.round((topCost / totalSpend) * 100);
    insights.push({
      type: "primary",
      icon: "fa-solid fa-chart-pie",
      title: `Highest Spending on ${topCategory}`,
      desc: `${topCategory} accounts for ${percent}% of your monthly expenses (₨ ${topCost.toLocaleString("en-PK")} equivalent).`
    });
  }

  // Insight 3: Renewal warning
  let soonestSub = null;
  let minDays = Infinity;
  state.subscriptions.forEach(sub => {
    const days = getDaysUntilRenewal(sub.renewalDate);
    if (days >= 0 && days < minDays) {
      minDays = days;
      soonestSub = sub;
    }
  });

  if (soonestSub) {
    let type = "primary";
    let alertMsg = `Your next bill is ${soonestSub.name} (₨ ${soonestSub.price.toLocaleString("en-PK")}) due in ${minDays} days.`;
    
    if (minDays === 0) {
      type = "danger";
      alertMsg = `Important: ${soonestSub.name} (₨ ${soonestSub.price.toLocaleString("en-PK")}) bills today!`;
    } else if (minDays === 1) {
      type = "warning";
      alertMsg = `Important: ${soonestSub.name} (₨ ${soonestSub.price.toLocaleString("en-PK")}) bills tomorrow.`;
    }

    insights.push({
      type: type,
      icon: "fa-solid fa-clock",
      title: "Impending Payment Renewal",
      desc: alertMsg
    });
  }

  // Append items to DOM
  insights.forEach(ins => {
    const div = document.createElement("div");
    div.className = `insight-item ${ins.type}`;
    div.innerHTML = `
      <span class="insight-icon"><i class="${ins.icon}"></i></span>
      <div class="insight-content">
        <h4 class="insight-title">${ins.title}</h4>
        <p class="insight-desc">${ins.desc}</p>
      </div>
    `;
    container.appendChild(div);
  });
}

/* ==========================================
   SUBSCRIPTIONS RENDERING & SEARCH / FILTERS
   ========================================== */
function renderSubscriptionsList() {
  const container = document.getElementById("subscriptions-container");
  const emptyState = document.getElementById("subscriptions-empty-state");
  
  if (!container) return;

  container.innerHTML = "";

  // Get filter inputs
  const searchVal = document.getElementById("search-input")?.value.trim().toLowerCase() || "";
  const catVal = document.getElementById("filter-category")?.value || "all";
  const cycleVal = document.getElementById("filter-cycle")?.value || "all";
  const sortVal = document.getElementById("sort-order")?.value || "date-soon";

  // Filter
  let filtered = state.subscriptions.filter(sub => {
    const matchesSearch = sub.name.toLowerCase().includes(searchVal) || 
                          sub.notes.toLowerCase().includes(searchVal);
    const matchesCategory = catVal === "all" || sub.category === catVal;
    const matchesCycle = cycleVal === "all" || sub.billingCycle === cycleVal;
    
    return matchesSearch && matchesCategory && matchesCycle;
  });

  // Sort
  filtered.sort((a, b) => {
    if (sortVal === "name-az") return a.name.localeCompare(b.name);
    if (sortVal === "name-za") return b.name.localeCompare(a.name);
    
    if (sortVal === "price-high") {
      const aVal = a.billingCycle === "monthly" ? a.price : a.price / 12;
      const bVal = b.billingCycle === "monthly" ? b.price : b.price / 12;
      return bVal - aVal;
    }
    if (sortVal === "price-low") {
      const aVal = a.billingCycle === "monthly" ? a.price : a.price / 12;
      const bVal = b.billingCycle === "monthly" ? b.price : b.price / 12;
      return aVal - bVal;
    }
    
    if (sortVal === "date-soon") {
      return new Date(a.renewalDate) - new Date(b.renewalDate);
    }
    if (sortVal === "date-late") {
      return new Date(b.renewalDate) - new Date(a.renewalDate);
    }
    return 0;
  });

  // Show Empty State
  if (filtered.length === 0) {
    container.style.display = "none";
    if (emptyState) emptyState.style.display = "flex";
  } else {
    container.style.display = "grid";
    if (emptyState) emptyState.style.display = "none";

    // Draw cards
    filtered.forEach(sub => {
      const card = createSubscriptionCard(
        sub, 
        (editSub) => openSubscriptionFormModal(editSub, addOrUpdateSubscription),
        (delSub) => deleteSubscription(delSub.id)
      );
      container.appendChild(card);
    });
  }
}

function showSkeletonLoader() {
  const skel = document.getElementById("subscriptions-skeleton");
  const grid = document.getElementById("subscriptions-container");
  const empty = document.getElementById("subscriptions-empty-state");
  if (skel) skel.style.display = "grid";
  if (grid) grid.style.display = "none";
  if (empty) empty.style.display = "none";
}

function hideSkeletonLoader() {
  const skel = document.getElementById("subscriptions-skeleton");
  if (skel) skel.style.display = "none";
}

/* ==========================================
   ANALYTICS SUMMARY
   ========================================== */
function renderAnalyticsSummaries() {
  const annualTotalEl = document.getElementById("analytics-annual-cost");
  const monthlyNormalizedEl = document.getElementById("analytics-monthly-normalized");
  const avgCostEl = document.getElementById("analytics-average-cost");
  const billingSplitEl = document.getElementById("analytics-billing-split");

  if (!annualTotalEl || !monthlyNormalizedEl || !avgCostEl || !billingSplitEl) return;

  const totalMonthlySpend = getNormalizedMonthlySpend();
  const annualTotal = totalMonthlySpend * 12;

  annualTotalEl.textContent = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(annualTotal);
  monthlyNormalizedEl.textContent = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(totalMonthlySpend);

  // Avg Subscription price (normalized)
  const count = state.subscriptions.length;
  const averageCost = count > 0 ? (totalMonthlySpend / count) : 0;
  avgCostEl.textContent = new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR" }).format(averageCost);

  // Billing cycle split ratio
  if (count > 0) {
    const monthlyCount = state.subscriptions.filter(s => s.billingCycle === "monthly").length;
    const monthlyPercentage = Math.round((monthlyCount / count) * 100);
    billingSplitEl.textContent = `${monthlyPercentage}% Monthly, ${100 - monthlyPercentage}% Yearly`;
  } else {
    billingSplitEl.textContent = "0% Monthly";
  }
}

/* ==========================================
   CALENDAR GENERATION ENGINE
   ========================================== */
function renderCalendar() {
  const daysContainer = document.getElementById("calendar-days-container");
  const labelEl = document.getElementById("calendar-month-year-label");

  if (!daysContainer || !labelEl) return;

  daysContainer.innerHTML = "";

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];
  
  labelEl.textContent = `${monthNames[state.currentCalendarMonth]} ${state.currentCalendarYear}`;

  // Weekday Headers
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdays.forEach(day => {
    const div = document.createElement("div");
    div.className = "calendar-weekday";
    div.textContent = day;
    daysContainer.appendChild(div);
  });

  // Calculate Dates grid
  const year = state.currentCalendarYear;
  const month = state.currentCalendarMonth;

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0-6

  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate(); // 28-31

  const prevLastDay = new Date(year, month, 0).getDate();

  // 1. Previous Month Padding days
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = prevLastDay - i;
    const cell = document.createElement("div");
    cell.className = "calendar-day other-month";
    cell.innerHTML = `<span class="day-number">${dayNum}</span>`;
    daysContainer.appendChild(cell);
  }

  // 2. Current Month days
  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    
    // Check if it is today
    const checkDateObj = new Date(year, month, day);
    checkDateObj.setHours(0,0,0,0);
    if (checkDateObj.getTime() === BASE_DATE.getTime()) {
      cell.classList.add("today");
    }

    cell.innerHTML = `
      <span class="day-number">${day}</span>
      <div class="day-renewals" id="cal-renewals-${year}-${month}-${day}"></div>
    `;

    daysContainer.appendChild(cell);

    // Render renewal items for this cell
    const renewalsBox = cell.querySelector(`#cal-renewals-${year}-${month}-${day}`);
    
    state.subscriptions.forEach(sub => {
      const isDue = isSubscriptionRenewingOnDate(sub, checkDateObj);
      if (isDue) {
        const badge = document.createElement("div");
        badge.className = "day-renewal-badge";
        badge.style.backgroundColor = sub.color;
        badge.innerHTML = `
          <i class="${sub.iconClass}"></i>
          <span>${sub.name}</span>
        `;
        
        // Show tooltip details on hover
        badge.title = `${sub.name} renewal: ₨ ${sub.price.toLocaleString("en-PK")} (${sub.billingCycle})`;
        
        // Clicking badge shows the edit modal directly!
        badge.addEventListener("click", (e) => {
          e.stopPropagation();
          openSubscriptionFormModal(sub, addOrUpdateSubscription);
        });

        renewalsBox.appendChild(badge);
      }
    });
  }

  // 3. Next Month Padding days
  const totalCellsDrawn = startOffset + totalDays;
  const remainingCells = 42 - totalCellsDrawn; // Standard 6-week layout
  for (let day = 1; day <= remainingCells; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day other-month";
    cell.innerHTML = `<span class="day-number">${day}</span>`;
    daysContainer.appendChild(cell);
  }
}

/**
 * Checks if a subscription renews on a specific calendar date (handling recurrence)
 */
function isSubscriptionRenewingOnDate(sub, dateToCheck) {
  const subStart = new Date(sub.startDate);
  subStart.setHours(0,0,0,0);

  // If calendar cell date is before start date, it doesn't renew
  if (dateToCheck < subStart) return false;

  const subRenewal = new Date(sub.renewalDate);
  subRenewal.setHours(0,0,0,0);

  // Check if calendar date matches the exact renewal date
  if (dateToCheck.getTime() === subRenewal.getTime()) {
    return true;
  }

  // For monthly subscriptions, check if month indices check out and day of month matches
  if (sub.billingCycle === "monthly") {
    // If the day of month matches
    // Note: handle months with fewer days if the start day was 31st
    const targetDay = subRenewal.getDate();
    const currentDay = dateToCheck.getDate();

    if (currentDay === targetDay) {
      return true;
    }

    // Edge case: if renewal day is 29, 30, 31, and dateToCheck is the last day of a shorter month
    const lastDayOfToCheckMonth = new Date(dateToCheck.getFullYear(), dateToCheck.getMonth() + 1, 0).getDate();
    if (targetDay > lastDayOfToCheckMonth && currentDay === lastDayOfToCheckMonth) {
      return true;
    }
  }

  // For yearly subscriptions, check if month and day match
  if (sub.billingCycle === "yearly") {
    return dateToCheck.getMonth() === subRenewal.getMonth() && dateToCheck.getDate() === subRenewal.getDate();
  }

  return false;
}

/* ==========================================
   ALERTS & NOTIFICATION SYSTEM
   ========================================== */
async function checkUpcomingRenewalsAndNotify() {
  const alerts = [];
  
  state.subscriptions.forEach(sub => {
    const days = getDaysUntilRenewal(sub.renewalDate);
    
    if (days === 1) {
      alerts.push({
        id: `alert-${sub.id}-1d`,
        type: "warning",
        subName: sub.name,
        color: sub.color,
        icon: sub.iconClass,
        message: `Subscription for ${sub.name} is renewing tomorrow (₨ ${sub.price.toLocaleString("en-PK")}).`
      });
    } else if (days === 0) {
      alerts.push({
        id: `alert-${sub.id}-0d`,
        type: "danger",
        subName: sub.name,
        color: sub.color,
        icon: sub.iconClass,
        message: `Subscription for ${sub.name} is renewing today (₨ ${sub.price.toLocaleString("en-PK")})!`
      });
    } else if (days > 1 && days <= 3) {
      alerts.push({
        id: `alert-${sub.id}-${days}d`,
        type: "warning",
        subName: sub.name,
        color: sub.color,
        icon: sub.iconClass,
        message: `Subscription for ${sub.name} is renewing in ${days} days.`
      });
    }
  });

  // Check if monthly budget is exceeded
  const monthlySpend = getNormalizedMonthlySpend();
  if (monthlySpend > state.budgetLimit) {
    alerts.push({
      id: `alert-budget-exceeded`,
      type: "danger",
      subName: "Budget Control",
      color: "var(--danger)",
      icon: "fa-solid fa-triangle-exclamation",
      message: `Your monthly subscriptions spending (₨ ${monthlySpend.toLocaleString("en-PK")}) has exceeded your set budget limit (₨ ${state.budgetLimit.toLocaleString("en-PK")}).`
    });
  }

  // Deduplicate and insert into notifications array
  let newAlertsAddedCount = 0;
  alerts.forEach(newAlert => {
    const alreadyLogged = state.notifications.some(n => n.id === newAlert.id);
    if (!alreadyLogged) {
      // Add to front of notifications log
      state.notifications.unshift({
        ...newAlert,
        timestamp: new Date().toISOString(),
        unread: true
      });
      newAlertsAddedCount++;

      // Trigger standard toast alert for each unread
      showToast(newAlert.subName, newAlert.message, newAlert.type === "danger" ? "error" : "warning", 5000);
    }
  });

  if (newAlertsAddedCount > 0) {
    await saveSettings();
    renderNotificationsDrawer();
  }

  updateNotificationsBadge();
}

function updateNotificationsBadge() {
  const badge = document.getElementById("notifications-badge");
  if (!badge) return;

  const unreadCount = state.notifications.filter(n => n.unread).length;
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

function renderNotificationsDrawer() {
  const listContainer = document.getElementById("drawer-notifications-list");
  if (!listContainer) return;

  listContainer.innerHTML = "";

  if (state.notifications.length === 0) {
    listContainer.innerHTML = `
      <div class="drawer-empty-state">
        <i class="fa-solid fa-bell-slash"></i>
        <p>No notifications logged.<br>Everything looks quiet!</p>
      </div>
    `;
    return;
  }

  state.notifications.forEach(log => {
    const item = document.createElement("div");
    item.className = `drawer-alert-item ${log.unread ? 'unread' : ''} ${log.type}`;
    
    // Format timestamp
    const date = new Date(log.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " " + date.toLocaleDateString();

    item.innerHTML = `
      <div class="alert-avatar" style="background-color: ${log.color || 'var(--primary)'};">
        <i class="${log.icon || 'fa-solid fa-bell'}"></i>
      </div>
      <div class="alert-details">
        <span class="alert-msg">${log.message}</span>
        <span class="alert-time">${timeStr}</span>
      </div>
    `;

    // Click removes unread border/badge
    item.addEventListener("click", async () => {
      if (log.unread) {
        log.unread = false;
        await saveSettings();
        item.classList.remove("unread");
        updateNotificationsBadge();
      }
    });

    listContainer.appendChild(item);
  });
}

async function clearAllNotifications() {
  state.notifications = [];
  await saveSettings();
  renderNotificationsDrawer();
  updateNotificationsBadge();
  showToast("Logs Cleared", "Notification drawer history wiped clean.", "info");
}

async function checkBudgetThreshold() {
  const spend = getNormalizedMonthlySpend();
  if (spend > state.budgetLimit) {
    const alertId = "alert-budget-exceeded";
    const alreadyLogged = state.notifications.some(n => n.id === alertId);
    if (!alreadyLogged) {
      state.notifications.unshift({
        id: alertId,
        type: "danger",
        subName: "Budget Exceeded",
        color: "var(--danger)",
        icon: "fa-solid fa-triangle-exclamation",
        message: `Your monthly subscription spending (₨ ${spend.toLocaleString("en-PK")}) has exceeded your set budget limit (₨ ${state.budgetLimit.toLocaleString("en-PK")}).`,
        timestamp: new Date().toISOString(),
        unread: true
      });
      await saveSettings();
      renderNotificationsDrawer();
      updateNotificationsBadge();
      showToast("Budget Exceeded", `Monthly spending of ₨ ${spend.toLocaleString("en-PK")} is above your budget limit!`, "error", 6000);
    }
  }
}

/* ==========================================
   EXPORT UTILITIES
   ========================================== */
function exportCSV() {
  if (state.subscriptions.length === 0) {
    showToast("Export Failed", "There are no subscriptions to export.", "warning");
    return;
  }

  // Header row
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Name,Price,Billing Cycle,Start Date,Renewal Date,Category,Color,Notes\n";

  // Data rows
  state.subscriptions.forEach(sub => {
    // Escape notes to prevent splitting on comma/newlines
    const cleanNotes = sub.notes ? `"${sub.notes.replace(/"/g, '""')}"` : "";
    const cleanName = `"${sub.name.replace(/"/g, '""')}"`;
    const row = [
      cleanName,
      sub.price,
      sub.billingCycle,
      sub.startDate,
      sub.renewalDate,
      sub.category,
      sub.color,
      cleanNotes
    ].join(",");
    csvContent += row + "\n";
  });

  // Trigger download link
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `subtrack_backup_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast("CSV Exported", "Subscription records saved as spreadsheet CSV file.", "success");
}

function exportJSON() {
  if (state.subscriptions.length === 0) {
    showToast("Export Failed", "There are no subscriptions to export.", "warning");
    return;
  }

  const exportObj = {
    backupDate: new Date().toISOString(),
    budgetLimit: state.budgetLimit,
    profile: state.profile,
    subscriptions: state.subscriptions
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
  const link = document.createElement("a");
  link.setAttribute("href", dataStr);
  link.setAttribute("download", `subtrack_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("JSON Exported", "Subscription configurations exported as JSON.", "success");
}

/* ==========================================
   UI EVENT LISTENERS Setup
   ========================================== */
function setupUIEventListeners() {
  // 1. Sidebar & Menu switches
  document.querySelectorAll(".sidebar-menu .menu-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tabId = item.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  // Collapsible sidebar
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle");
  const toggleIcon = document.getElementById("toggle-icon");
  if (toggleBtn && sidebar && toggleIcon) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed");
      if (sidebar.classList.contains("collapsed")) {
        toggleIcon.className = "fa-solid fa-chevron-right";
      } else {
        toggleIcon.className = "fa-solid fa-chevron-left";
      }
      
      // Delay chart resizing slightly to allow transitions to end
      setTimeout(() => {
        if (trendChartInstance || categoryChartInstance || budgetChartInstance) {
          updateCharts(state.subscriptions, state.budgetLimit, state.theme);
        }
      }, 350);
    });
  }

  // Hamburger toggle on mobile
  const mobileToggle = document.getElementById("mobile-toggle");
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener("click", () => {
      sidebar.classList.add("open");
    });
  }

  // 2. Profile Dropdown popups
  const profileTrigger = document.getElementById("profile-dropdown-trigger");
  const profileInfoNode = document.getElementById("sidebar-profile-info");
  const profileAvatarNode = document.getElementById("sidebar-avatar");
  const profileDropdown = document.getElementById("profile-dropdown");

  const toggleProfileMenu = (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle("open");
  };

  if (profileTrigger) profileTrigger.addEventListener("click", toggleProfileMenu);
  if (profileInfoNode) profileInfoNode.addEventListener("click", toggleProfileMenu);
  if (profileAvatarNode) profileAvatarNode.addEventListener("click", toggleProfileMenu);

  document.addEventListener("click", () => {
    if (profileDropdown) profileDropdown.classList.remove("open");
  });

  // 3. Profile actions
  document.getElementById("btn-edit-profile-menu")?.addEventListener("click", () => {
    openProfileModal(state.profile, async (updatedProfile) => {
      state.profile = updatedProfile;
      await saveProfile();
      updateDashboardMetrics();
      showToast("Profile Updated", "Avatar settings successfully saved.", "success");
    });
  });

  document.getElementById("btn-edit-budget-menu")?.addEventListener("click", () => {
    openBudgetModal(state.budgetLimit, async (newBudget) => {
      state.budgetLimit = newBudget;
      await saveSettings();
      updateDashboardMetrics();
      updateCharts(state.subscriptions, state.budgetLimit, state.theme);
      showToast("Budget Restructured", `Monthly spending limit updated to ₨ ${newBudget.toLocaleString("en-PK")}.`, "success");
    });
  });

  document.getElementById("btn-reset-data")?.addEventListener("click", () => {
    openDeleteConfirmModal(
      "Are you sure you want to reset ALL data? This clears subscriptions history and profile configurations.",
      async () => {
        localStorage.clear();
        window.location.reload();
      }
    );
  });

  // 4. Quick Actions
  document.getElementById("btn-quick-add")?.addEventListener("click", () => {
    openSubscriptionFormModal(null, addOrUpdateSubscription);
  });
  
  document.getElementById("btn-quick-calendar")?.addEventListener("click", () => {
    switchTab("calendar");
  });

  document.getElementById("btn-quick-export")?.addEventListener("click", exportCSV);

  document.getElementById("btn-quick-insights")?.addEventListener("click", () => {
    switchTab("analytics");
  });

  document.getElementById("btn-adjust-budget")?.addEventListener("click", (e) => {
    e.preventDefault();
    openBudgetModal(state.budgetLimit, async (newBudget) => {
      state.budgetLimit = newBudget;
      await saveSettings();
      updateDashboardMetrics();
      updateCharts(state.subscriptions, state.budgetLimit, state.theme);
      showToast("Budget Updated", `Monthly budget updated to ₨ ${newBudget.toLocaleString("en-PK")}.`, "success");
    });
  });

  // 5. Header controls (Theme toggler & Notification Drawer toggler)
  document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);

  const drawer = document.getElementById("notifications-drawer");
  const drawerOverlay = document.getElementById("drawer-overlay");
  const drawerToggle = document.getElementById("notification-drawer-toggle");
  const drawerCloseBtn = document.getElementById("drawer-close-btn");

  const openDrawer = async () => {
    drawer.classList.add("open");
    drawerOverlay.classList.add("open");
    // Mark all notifications as read when opening drawer
    let updated = false;
    state.notifications.forEach(log => {
      if (log.unread) {
        log.unread = false;
        updated = true;
      }
    });
    if (updated) {
      await saveSettings();
      updateNotificationsBadge();
      setTimeout(renderNotificationsDrawer, 400); // Slight delay for animation transition
    }
  };

  const closeDrawer = () => {
    drawer.classList.remove("open");
    drawerOverlay.classList.remove("open");
  };

  if (drawerToggle) drawerToggle.addEventListener("click", openDrawer);
  if (drawerCloseBtn) drawerCloseBtn.addEventListener("click", closeDrawer);
  if (drawerOverlay) drawerOverlay.addEventListener("click", closeDrawer);

  document.getElementById("drawer-clear-all-btn")?.addEventListener("click", clearAllNotifications);

  // 6. Subscriptions lists: Filters & Sorts
  const searchInput = document.getElementById("search-input");
  const filterCat = document.getElementById("filter-category");
  const filterCycle = document.getElementById("filter-cycle");
  const sortOrder = document.getElementById("sort-order");

  const triggerFilteredListUpdate = () => {
    renderSubscriptionsList();
  };

  searchInput?.addEventListener("input", triggerFilteredListUpdate);
  filterCat?.addEventListener("change", triggerFilteredListUpdate);
  filterCycle?.addEventListener("change", triggerFilteredListUpdate);
  sortOrder?.addEventListener("change", triggerFilteredListUpdate);

  // Buttons for adding sub
  document.getElementById("btn-add-subscription")?.addEventListener("click", () => {
    openSubscriptionFormModal(null, addOrUpdateSubscription);
  });

  document.getElementById("btn-empty-state-add")?.addEventListener("click", () => {
    openSubscriptionFormModal(null, addOrUpdateSubscription);
  });

  document.getElementById("fab-add-btn")?.addEventListener("click", () => {
    openSubscriptionFormModal(null, addOrUpdateSubscription);
  });

  // 7. Calendar View Navigations
  document.getElementById("calendar-prev-month")?.addEventListener("click", () => {
    state.currentCalendarMonth--;
    if (state.currentCalendarMonth < 0) {
      state.currentCalendarMonth = 11;
      state.currentCalendarYear--;
    }
    renderCalendar();
  });

  document.getElementById("calendar-next-month")?.addEventListener("click", () => {
    state.currentCalendarMonth++;
    if (state.currentCalendarMonth > 11) {
      state.currentCalendarMonth = 0;
      state.currentCalendarYear++;
    }
    renderCalendar();
  });

  document.getElementById("calendar-today-btn")?.addEventListener("click", () => {
    state.currentCalendarMonth = BASE_DATE.getMonth();
    state.currentCalendarYear = BASE_DATE.getFullYear();
    renderCalendar();
  });

  // 8. Settings View Event Hooks
  const settingsThemeToggle = document.getElementById("settings-theme-toggle");
  if (settingsThemeToggle) {
    settingsThemeToggle.addEventListener("change", toggleTheme);
  }

  document.getElementById("settings-btn-budget")?.addEventListener("click", () => {
    openBudgetModal(state.budgetLimit, async (newBudget) => {
      state.budgetLimit = newBudget;
      await saveSettings();
      updateDashboardMetrics();
      updateCharts(state.subscriptions, state.budgetLimit, state.theme);
      showToast("Budget Saved", `Monthly spending limit updated to ₨ ${newBudget.toLocaleString("en-PK")}.`, "success");
    });
  });

  document.getElementById("settings-btn-seed")?.addEventListener("click", () => {
    openDeleteConfirmModal(
      "This will overwrite your current subscriptions with the default demo subscriptions. Continue?",
      async () => {
        state.subscriptions = [ ...defaultSubscriptions ];
        await saveSubscriptions();
        updateDashboardMetrics();
        renderSubscriptionsList();
        renderCalendar();
        updateCharts(state.subscriptions, state.budgetLimit, state.theme);
        showToast("Seed Succeeded", "Demo subscriptions successfully injected.", "success");
        switchTab("dashboard");
      }
    );
  });

  document.getElementById("settings-btn-profile")?.addEventListener("click", () => {
    openProfileModal(state.profile, async (updatedProfile) => {
      state.profile = updatedProfile;
      await saveProfile();
      updateDashboardMetrics();
      showToast("Profile Saved", "User account profile details updated.", "success");
    });
  });

  document.getElementById("settings-btn-export-csv")?.addEventListener("click", exportCSV);
  document.getElementById("settings-btn-export-json")?.addEventListener("click", exportJSON);

  document.getElementById("settings-btn-wipe")?.addEventListener("click", () => {
    openDeleteConfirmModal(
      "Caution! This deletes all subscription configurations. Click OK to wipe cache data.",
      async () => {
        localStorage.clear();
        window.location.reload();
      }
    );
  });

  // 9. Sign-out Handler
  document.getElementById("btn-sign-out")?.addEventListener("click", async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.replace("auth.html");
    } catch (error) {
      showToast("Error", error.message, "error");
    }
  });
}

// Start application
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
