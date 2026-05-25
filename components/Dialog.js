/**
 * Dialog Component - Handles creation, rendering, and interaction of modals
 */

import supabase from "../js/supabase.js";

// Global reference for open modals
let activeModalOverlay = null;

export function closeModal() {
  if (activeModalOverlay) {
    activeModalOverlay.classList.remove("open");
    // Wait for fadeout animation
    setTimeout(() => {
      activeModalOverlay.remove();
      activeModalOverlay = null;
    }, 300);
  }
}

function createModalShell(title, bodyHtml, footerHtml) {
  // Clean up existing modals first
  closeModal();

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modal-overlay";

  const container = document.createElement("div");
  container.className = "modal-container";
  
  container.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close" id="modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="modal-body">${bodyHtml}</div>
    <div class="modal-footer">${footerHtml}</div>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);
  
  // Set active global reference
  activeModalOverlay = overlay;

  // Trigger browser paint before adding class for animation transition
  setTimeout(() => overlay.classList.add("open"), 10);

  // Close handlers
  const closeBtn = overlay.querySelector("#modal-close-btn");
  closeBtn.addEventListener("click", closeModal);
  
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  return overlay;
}

/**
 * Open confirmation modal for deletion
 */
export function openDeleteConfirmModal(subNameOrMessage, onConfirm) {
  const isFullMessage = subNameOrMessage.includes(" ") || subNameOrMessage.includes("?");
  const title = isFullMessage ? "Confirm Action" : "Delete Subscription";
  const bodyHtml = isFullMessage
    ? `
    <p style="color: var(--text-secondary); line-height: 1.5; font-size: 0.95rem;">
      ${subNameOrMessage}
    </p>
  `
    : `
    <p style="color: var(--text-secondary); line-height: 1.5; font-size: 0.95rem;">
      Are you sure you want to delete your <strong>${subNameOrMessage}</strong> subscription? This action is permanent and cannot be undone.
    </p>
  `;
  const footerHtml = `
    <button class="btn-secondary" id="confirm-cancel-btn">Cancel</button>
    <button class="btn-danger" id="confirm-delete-btn">${isFullMessage ? 'Confirm' : 'Delete'}</button>
  `;

  const overlay = createModalShell(title, bodyHtml, footerHtml);

  overlay.querySelector("#confirm-cancel-btn").addEventListener("click", closeModal);
  overlay.querySelector("#confirm-delete-btn").addEventListener("click", async () => {
    await onConfirm();
    closeModal();
  });
}

/**
 * Open Subscription Add/Edit Form
 */
export function openSubscriptionFormModal(sub = null, onSubmit) {
  const isEdit = sub !== null;
  const title = isEdit ? "Edit Subscription" : "Add Subscription";
  
  // Available categories
  const categories = ["Entertainment", "Music", "SaaS", "Utilities", "Work", "News", "Finance", "Other"];
  
  // Available colors
  const colors = ["#6366F1", "#8B5CF6", "#E50914", "#1DB954", "#10A37F", "#FF9900", "#FF0000", "#0078D4", "#EC4899", "#14B8A6"];

  const defaultColor = isEdit ? sub.color : colors[0];

  // FontAwesome Icons mapping for categories
  const categoryIcons = {
    Entertainment: "fa-solid fa-play",
    Music: "fa-solid fa-music",
    SaaS: "fa-solid fa-robot",
    Utilities: "fa-solid fa-bolt",
    Work: "fa-solid fa-palette",
    News: "fa-solid fa-newspaper",
    Finance: "fa-solid fa-wallet",
    Other: "fa-solid fa-circle-question"
  };

  const bodyHtml = `
    <form id="subscription-form">
      <div class="form-group">
        <label class="form-label" for="sub-name">Subscription Name</label>
        <input type="text" id="sub-name" class="form-input" placeholder="e.g. Netflix, Spotify, ChatGPT" value="${isEdit ? sub.name : ''}" required>
        <span class="form-error" id="error-sub-name">Subscription name is required.</span>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="sub-price">Price ($)</label>
          <input type="number" id="sub-price" class="form-input" placeholder="0.00" step="0.01" min="0" value="${isEdit ? sub.price : ''}" required>
          <span class="form-error" id="error-sub-price">Please enter a valid price.</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="sub-cycle">Billing Cycle</label>
          <select id="sub-cycle" class="form-input filter-select" style="background-position: right 14px center;" required>
            <option value="monthly" ${isEdit && sub.billingCycle === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="yearly" ${isEdit && sub.billingCycle === 'yearly' ? 'selected' : ''}>Yearly</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="sub-start-date">Start Date</label>
          <input type="date" id="sub-start-date" class="form-input" value="${isEdit ? sub.startDate : new Date().toISOString().split('T')[0]}" required>
          <span class="form-error" id="error-sub-start-date">Please pick a valid start date.</span>
        </div>
        <div class="form-group">
          <label class="form-label" for="sub-renewal-date">Next Renewal Date</label>
          <input type="date" id="sub-renewal-date" class="form-input" value="${isEdit ? sub.renewalDate : ''}" required>
          <span class="form-error" id="error-sub-renewal-date">Please pick a valid renewal date.</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="sub-category">Category</label>
        <select id="sub-category" class="form-input filter-select" style="background-position: right 14px center;" required>
          ${categories.map(cat => `<option value="${cat}" ${isEdit && sub.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Accent Color</label>
        <div class="color-picker-row">
          ${colors.map(col => `
            <div class="color-option ${col === defaultColor ? 'selected' : ''}" 
                 data-color="${col}" 
                 style="background-color: ${col};">
            </div>
          `).join('')}
        </div>
        <input type="hidden" id="sub-color" value="${defaultColor}">
      </div>

      <div class="form-group">
        <label class="form-label" for="sub-notes">Notes (Optional)</label>
        <textarea id="sub-notes" class="form-textarea" placeholder="e.g. Shared billing, premium subscription features...">${isEdit && sub.notes ? sub.notes : ''}</textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <button class="btn-secondary" id="form-cancel-btn">Cancel</button>
    <button class="btn-primary" id="form-submit-btn">${isEdit ? 'Save Changes' : 'Add Subscription'}</button>
  `;

  const overlay = createModalShell(title, bodyHtml, footerHtml);

  // Setup color options selector
  const colorOptions = overlay.querySelectorAll(".color-option");
  const hiddenColorInput = overlay.querySelector("#sub-color");
  colorOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      colorOptions.forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      hiddenColorInput.value = opt.getAttribute("data-color");
    });
  });

  // Calculate next renewal date automatically when billing cycle or start date changes (if empty)
  const startDateInput = overlay.querySelector("#sub-start-date");
  const renewalDateInput = overlay.querySelector("#sub-renewal-date");
  const cycleSelect = overlay.querySelector("#sub-cycle");

  const autoSetRenewalDate = () => {
    if (!startDateInput.value) return;
    const start = new Date(startDateInput.value);
    if (isNaN(start.getTime())) return;

    // Only auto-fill if the renewal date hasn't been edited or is empty
    if (!renewalDateInput.value || !isEdit) {
      const nextRenewal = new Date(start);
      if (cycleSelect.value === "monthly") {
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);
      } else {
        nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
      }
      // If the calculated renewal is in the past, adjust it to the future based on today
      const today = new Date();
      today.setHours(0,0,0,0);
      while (nextRenewal < today) {
        if (cycleSelect.value === "monthly") {
          nextRenewal.setMonth(nextRenewal.getMonth() + 1);
        } else {
          nextRenewal.setFullYear(nextRenewal.getFullYear() + 1);
        }
      }
      renewalDateInput.value = nextRenewal.toISOString().split('T')[0];
    }
  };

  if (!isEdit) {
    startDateInput.addEventListener("change", autoSetRenewalDate);
    cycleSelect.addEventListener("change", autoSetRenewalDate);
    // Trigger initially
    autoSetRenewalDate();
  }

  // Handle Cancel
  overlay.querySelector("#form-cancel-btn").addEventListener("click", closeModal);

  // Form submit helper with validation
  const submitBtn = overlay.querySelector("#form-submit-btn");
  submitBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const nameVal = overlay.querySelector("#sub-name").value.trim();
    const priceVal = parseFloat(overlay.querySelector("#sub-price").value);
    const cycleVal = overlay.querySelector("#sub-cycle").value;
    const startVal = overlay.querySelector("#sub-start-date").value;
    const renewVal = overlay.querySelector("#sub-renewal-date").value;
    const categoryVal = overlay.querySelector("#sub-category").value;
    const colorVal = hiddenColorInput.value;
    const notesVal = overlay.querySelector("#sub-notes").value.trim();
    
    let isValid = true;

    // Reset error text display
    overlay.querySelectorAll(".form-error").forEach(err => err.style.display = "none");

    if (!nameVal) {
      overlay.querySelector("#error-sub-name").style.display = "block";
      isValid = false;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      overlay.querySelector("#error-sub-price").style.display = "block";
      isValid = false;
    }
    if (!startVal) {
      overlay.querySelector("#error-sub-start-date").style.display = "block";
      isValid = false;
    }
    if (!renewVal) {
      overlay.querySelector("#error-sub-renewal-date").style.display = "block";
      isValid = false;
    }

    if (isValid) {
      const icon = categoryIcons[categoryVal] || "fa-solid fa-circle-question";
      const subData = {
        id: isEdit ? sub.id : Math.random().toString(36).substring(2, 9),
        name: nameVal,
        price: priceVal,
        billingCycle: cycleVal,
        startDate: startVal,
        renewalDate: renewVal,
        category: categoryVal,
        color: colorVal,
        iconClass: icon,
        notes: notesVal
      };
      
      await onSubmit(subData);
      closeModal();
    }
  });
}

/**
 * Open Budget editing modal
 */
export function openBudgetModal(currentBudget, onSubmit) {
  const title = "Set Monthly Budget";
  const bodyHtml = `
    <form id="budget-form">
      <div class="form-group">
        <label class="form-label" for="budget-limit-input">Monthly Budget Limit ($)</label>
        <input type="number" id="budget-limit-input" class="form-input" min="0" step="10" value="${currentBudget}" required>
        <span class="form-error" id="error-budget-limit">Please enter a valid budget amount.</span>
      </div>
      <p style="color: var(--text-muted); font-size: 0.775rem; line-height: 1.4;">
        Setting a monthly budget will update the progress bar on your dashboard. You will receive warning alerts if your subscription expenses exceed this threshold.
      </p>
    </form>
  `;
  const footerHtml = `
    <button class="btn-secondary" id="budget-cancel-btn">Cancel</button>
    <button class="btn-primary" id="budget-submit-btn">Save Budget</button>
  `;

  const overlay = createModalShell(title, bodyHtml, footerHtml);

  overlay.querySelector("#budget-cancel-btn").addEventListener("click", closeModal);
  overlay.querySelector("#budget-submit-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const inputVal = parseFloat(overlay.querySelector("#budget-limit-input").value);
    
    if (isNaN(inputVal) || inputVal < 0) {
      overlay.querySelector("#error-budget-limit").style.display = "block";
    } else {
      await onSubmit(inputVal);
      closeModal();
    }
  });
}

/**
 * Open Profile settings editing modal
 */
export function openProfileModal(currentProfile, onSubmit) {
  const title = "Edit User Profile";
  const bodyHtml = `
    <form id="profile-form">
      <div class="form-group">
        <label class="form-label" for="profile-name-input">Full Name</label>
        <input type="text" id="profile-name-input" class="form-input" value="${currentProfile.name}" required>
        <span class="form-error" id="error-profile-name">Please enter your name.</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="profile-email-input">Email Address</label>
        <input type="email" id="profile-email-input" class="form-input" value="${currentProfile.email}" required>
        <span class="form-error" id="error-profile-email">Please enter a valid email address.</span>
      </div>
      <div class="form-group">
        <label class="form-label" for="profile-avatar-input">Avatar URL</label>
        <input type="text" id="profile-avatar-input" class="form-input" value="${currentProfile.avatar}" placeholder="Image URL (e.g. Dicebear seed)">
        <p style="color: var(--text-muted); font-size: 0.7rem; margin-top: 4px;">
          Tip: You can use free avatar services like Dicebear or any direct image URL.
        </p>
      </div>
    </form>
  `;
  const footerHtml = `
    <button class="btn-secondary" id="profile-cancel-btn">Cancel</button>
    <button class="btn-primary" id="profile-submit-btn">Save Profile</button>
  `;

  const overlay = createModalShell(title, bodyHtml, footerHtml);

  overlay.querySelector("#profile-cancel-btn").addEventListener("click", closeModal);
  overlay.querySelector("#profile-submit-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const nameVal = overlay.querySelector("#profile-name-input").value.trim();
    const emailVal = overlay.querySelector("#profile-email-input").value.trim();
    const avatarVal = overlay.querySelector("#profile-avatar-input").value.trim() || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${nameVal}`;

    let isValid = true;
    overlay.querySelectorAll(".form-error").forEach(err => err.style.display = "none");

    if (!nameVal) {
      overlay.querySelector("#error-profile-name").style.display = "block";
      isValid = false;
    }
    if (!emailVal || !emailVal.includes("@")) {
      overlay.querySelector("#error-profile-email").style.display = "block";
      isValid = false;
    }

    if (isValid) {
      await onSubmit({ name: nameVal, email: emailVal, avatar: avatarVal });
      // Call supabase.auth.updateUser to sync the name
      try {
        await supabase.auth.updateUser({ data: { name: nameVal } });
      } catch (err) {
        console.error("Failed to update user metadata in Supabase:", err);
      }
      closeModal();
    }
  });
}
