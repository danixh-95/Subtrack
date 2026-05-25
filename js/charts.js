/**
 * Charts Module - Configures and updates dashboard visualizations using Chart.js
 */

let trendChartInstance = null;
let categoryChartInstance = null;
let budgetChartInstance = null;

// Color helpers based on theme
function getThemeColors(theme) {
  const isDark = theme === "dark";
  return {
    text: isDark ? "#94A3B8" : "#475569",
    grid: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
    tooltipBg: isDark ? "#1E293B" : "#FFFFFF",
    tooltipBorder: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
    tooltipText: isDark ? "#F8FAFC" : "#0F172A",
    primary: "#6366F1",
    secondary: "#8B5CF6",
    accent: "#22C55E",
    danger: "#EF4444",
  };
}

/**
 * Normalizes subscription price to monthly equivalent
 */
function getMonthlyEquivalent(sub) {
  return sub.billingCycle === "monthly" ? sub.price : sub.price / 12;
}

/**
 * Calculates 12-month spending projection (current calendar year 2026)
 */
function calculateMonthlyCashflow(subscriptions) {
  const monthlyTotals = Array(12).fill(0);
  
  subscriptions.forEach(sub => {
    const startDate = new Date(sub.startDate);
    const price = sub.price;

    for (let month = 0; month < 12; month++) {
      // Create a date for the 15th of each month in 2026 to check active state
      const checkDate = new Date(2026, month, 15);
      
      // If subscription hasn't started yet relative to this month, skip
      if (checkDate < startDate) continue;

      if (sub.billingCycle === "monthly") {
        monthlyTotals[month] += price;
      } else if (sub.billingCycle === "yearly") {
        // Yearly bills trigger in their renewal month
        const renewalObj = new Date(sub.renewalDate);
        if (renewalObj.getMonth() === month) {
          monthlyTotals[month] += price;
        }
      }
    }
  });

  return monthlyTotals;
}

/**
 * Group subscription monthly equivalents by category
 */
function getCategoryDistribution(subscriptions) {
  const categorySums = {};
  
  subscriptions.forEach(sub => {
    const monthlyCost = getMonthlyEquivalent(sub);
    categorySums[sub.category] = (categorySums[sub.category] || 0) + monthlyCost;
  });

  return categorySums;
}

/**
 * Initialize all dashboard charts
 */
export function initCharts(subscriptions, budgetLimit, theme) {
  const colors = getThemeColors(theme);
  
  // 1. Spending Trend Chart (Bar Chart)
  const trendCtx = document.getElementById("trendChart")?.getContext("2d");
  if (trendCtx) {
    if (trendChartInstance) trendChartInstance.destroy();
    
    const cashflowData = calculateMonthlyCashflow(subscriptions);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    trendChartInstance = new Chart(trendCtx, {
      type: "bar",
      data: {
        labels: months,
        datasets: [{
          label: "Projected Cost",
          data: cashflowData,
          backgroundColor: colors.primary,
          hoverBackgroundColor: colors.secondary,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `Projected Outflow: $${context.raw.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: "Inter" } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { 
              color: colors.text, 
              font: { family: "Inter" },
              callback: (value) => `$${value}`
            }
          }
        }
      }
    });
  }

  // 2. Category Distribution Chart (Doughnut Chart)
  const categoryCtx = document.getElementById("categoryChart")?.getContext("2d");
  if (categoryCtx) {
    if (categoryChartInstance) categoryChartInstance.destroy();

    const categoryData = getCategoryDistribution(subscriptions);
    const labels = Object.keys(categoryData);
    const data = Object.values(categoryData);
    
    // Default categories coloring
    const categoryColors = {
      Entertainment: "#E50914",
      Music: "#1DB954",
      SaaS: "#10A37F",
      Utilities: "#F59E0B",
      Work: "#8B5CF6",
      News: "#3B82F6",
      Finance: "#06B6D4",
      Other: "#64748B"
    };
    
    const backgroundColors = labels.map(label => categoryColors[label] || "#6366F1");

    categoryChartInstance = new Chart(categoryCtx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderWidth: theme === "dark" ? 2 : 1,
          borderColor: theme === "dark" ? "#1E293B" : "#FFFFFF"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: colors.text,
              font: { family: "Inter", size: 12 },
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => ` Monthly Equivalent: $${context.raw.toFixed(2)}`
            }
          }
        },
        cutout: "70%"
      }
    });
  }

  // 3. Spending vs Budget Chart (Comparison Bar Chart)
  const budgetCtx = document.getElementById("budgetChart")?.getContext("2d");
  if (budgetCtx) {
    if (budgetChartInstance) budgetChartInstance.destroy();

    // Show upcoming 6 months starting from May 2026
    const upcomingMonths = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const monthIndices = [4, 5, 6, 7, 8, 9]; // May is index 4
    
    const cashflowData = calculateMonthlyCashflow(subscriptions);
    const projectedSpend = monthIndices.map(idx => cashflowData[idx]);
    const budgetLimits = Array(6).fill(budgetLimit);

    budgetChartInstance = new Chart(budgetCtx, {
      type: "line",
      data: {
        labels: upcomingMonths,
        datasets: [
          {
            label: "Projected Cost",
            data: projectedSpend,
            borderColor: colors.primary,
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: colors.primary
          },
          {
            label: "Budget Limit",
            data: budgetLimits,
            borderColor: colors.danger,
            borderDash: [6, 6],
            borderWidth: 2,
            pointStyle: false, // Don't draw points
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: colors.text,
              font: { family: "Inter" }
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: $${context.raw.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.text, font: { family: "Inter" } }
          },
          y: {
            grid: { color: colors.grid },
            ticks: { 
              color: colors.text, 
              font: { family: "Inter" },
              callback: (value) => `$${value}`
            }
          }
        }
      }
    });
  }
}

/**
 * Re-populate charts dynamically with updated data
 */
export function updateCharts(subscriptions, budgetLimit, theme) {
  initCharts(subscriptions, budgetLimit, theme);
}
