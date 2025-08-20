function showToast(message, type = "success") {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.className = "position-fixed top-0 end-0 p-3";
    toastContainer.style.zIndex = "9999";
    document.body.appendChild(toastContainer);
  }

  // Create toast element
  const toastId = `toast-${Date.now()}`;
  const iconMap = {
    success: "check-circle-fill",
    error: "exclamation-triangle-fill",
    info: "info-circle-fill",
  };
  const bgMap = {
    success: "bg-success",
    error: "bg-danger",
    info: "bg-info",
  };

  const toastHtml = `
            <div id="${toastId}" class="toast align-items-center text-white ${
    bgMap[type]
  } border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center">
                        <i class="bi bi-${iconMap[type]} me-2"></i>
                        ${escapeHtml(message)}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

  // Add toast to container
  toastContainer.insertAdjacentHTML("beforeend", toastHtml);

  // Initialize and show toast
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, {
    delay: 3000,
  });

  // Clean up toast after it's hidden
  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove();
  });

  toast.show();
}

// Utility methods
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Make functions available globally
window.showToast = showToast;
window.escapeHtml = escapeHtml;
