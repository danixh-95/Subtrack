/**
 * SubscriptionCard Component - DOM builder for individual subscription cards
 */

export function createSubscriptionCard(sub, onEdit, onDelete) {
  const card = document.createElement("div");
  card.className = "sub-card";
  card.setAttribute("data-id", sub.id);

  // Format Price
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(sub.price);

  // Format Renewal Date
  const renewalObj = new Date(sub.renewalDate);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  const formattedRenewalDate = renewalObj.toLocaleDateString("en-US", options);

  // Calculate Days Remaining to Renewal
  const today = new Date();
  today.setHours(0,0,0,0);
  const renewalDateNoTime = new Date(sub.renewalDate);
  renewalDateNoTime.setHours(0,0,0,0);
  
  const diffTime = renewalDateNoTime.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Determine Badge Status
  let statusBadgeHtml = '';
  if (diffDays < 0) {
    statusBadgeHtml = `<span class="sub-status-badge danger">Overdue</span>`;
  } else if (diffDays === 0) {
    statusBadgeHtml = `<span class="sub-status-badge danger">Renews Today</span>`;
  } else if (diffDays === 1) {
    statusBadgeHtml = `<span class="sub-status-badge warning">Renews Tomorrow</span>`;
  } else if (diffDays <= 3) {
    statusBadgeHtml = `<span class="sub-status-badge warning">Renews in ${diffDays}d</span>`;
  } else {
    statusBadgeHtml = `<span class="sub-status-badge active">Active</span>`;
  }

  // Set card contents
  card.innerHTML = `
    <div class="sub-card-header">
      <div class="sub-brand-info">
        <div class="sub-logo" style="background-color: ${sub.color};">
          <i class="${sub.iconClass || 'fa-solid fa-credit-card'}"></i>
        </div>
        <div class="sub-details">
          <h4 class="sub-name">${sub.name}</h4>
          <span class="sub-category">${sub.category}</span>
        </div>
      </div>
      <button class="sub-actions-trigger" aria-label="Subscription Options">
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </button>
    </div>
    
    ${sub.notes ? `<p class="sub-card-notes">${sub.notes}</p>` : `<p class="sub-card-notes" style="font-style: italic; opacity: 0.5;">No notes added.</p>`}
    
    <div class="sub-card-body">
      <div class="sub-billing">
        <span class="sub-price">${formattedPrice}<span class="sub-cycle">/${sub.billingCycle === 'monthly' ? 'mo' : 'yr'}</span></span>
      </div>
      <div class="sub-renewal-info">
        <span class="sub-renewal-label">Next Renewal</span>
        <span class="sub-renewal-date">${formattedRenewalDate}</span>
        ${statusBadgeHtml}
      </div>
    </div>
  `;

  // Attach Menu Handler
  const triggerBtn = card.querySelector(".sub-actions-trigger");
  triggerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    
    // Close other open sub-menus first
    document.querySelectorAll(".sub-menu-dropdown").forEach(el => el.remove());

    const menu = document.createElement("div");
    menu.className = "sub-menu-dropdown";
    menu.innerHTML = `
      <button class="dropdown-item edit" id="sub-menu-edit"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
      <button class="dropdown-item delete" id="sub-menu-delete"><i class="fa-solid fa-trash-can"></i> Delete</button>
    `;

    card.appendChild(menu);

    // Event listener to close menu when clicking outside
    const closeMenu = () => {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    };

    setTimeout(() => {
      document.addEventListener("click", closeMenu);
    }, 50);

    // Edit and Delete Event hooks
    menu.querySelector("#sub-menu-edit").addEventListener("click", (e) => {
      e.stopPropagation();
      menu.remove();
      onEdit(sub);
    });

    menu.querySelector("#sub-menu-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      menu.remove();
      onDelete(sub);
    });
  });

  return card;
}
