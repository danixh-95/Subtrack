/**
 * Toast Component - Displays non-blocking notification alerts
 */
export function showToast(title, message, type = "success", duration = 4000) {
  let container = document.getElementById("toast-container");
  
  // Create container if it doesn't exist
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  // Icon selector based on type
  let iconClass = "fa-solid fa-circle-check";
  if (type === "error") iconClass = "fa-solid fa-circle-xmark";
  if (type === "warning") iconClass = "fa-solid fa-circle-exclamation";
  if (type === "info") iconClass = "fa-solid fa-circle-info";

  toast.innerHTML = `
    <span class="toast-icon"><i class="${iconClass}"></i></span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close"><i class="fa-solid fa-xmark"></i></button>
  `;

  // Append to container
  container.appendChild(toast);

  // Close event listener
  const closeBtn = toast.querySelector(".toast-close");
  const dismissToast = () => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => {
      toast.remove();
      // Remove container if empty to clean up DOM
      if (container.children.length === 0) {
        container.remove();
      }
    });
  };

  closeBtn.addEventListener("click", dismissToast);

  // Auto dismiss
  const autoDismissTimeout = setTimeout(dismissToast, duration);

  // Pause auto dismiss on hover
  toast.addEventListener("mouseenter", () => clearTimeout(autoDismissTimeout));
  toast.addEventListener("mouseleave", () => {
    // Re-trigger timeout on mouse leave
    setTimeout(dismissToast, 2000);
  });
}
