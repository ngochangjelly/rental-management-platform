/**
 * AC Clean Management Component
 * Handles AC service scheduling and tracking with monthly calendar view
 * Includes AC Service Company management as a submodule
 */
class AcCleanManagementComponent {
  constructor() {
    this.properties = [];
    this.currentDate = new Date();
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth() + 1; // 1-12
    this.acServices = [];
    this.companies = [];
    this.editingCompany = null;
    this.init();
  }

  init() {
    console.log("🚀 AC Clean Management Component initializing...");

    // Debug: Check if tabs exist
    const tabs = document.getElementById("acManagementTabs");
    const scheduleTab = document.getElementById("ac-schedule-tab");
    const companiesTab = document.getElementById("ac-companies-tab");
    if (!tabs) {
      console.error(
        "❌ ERROR: Tabs container not found! The HTML might not be updated."
      );
    }

    this.bindEvents();
    this.loadProperties();
    this.loadCompanies();

    console.log("✅ AC Clean Management Component initialized");
  }

  bindEvents() {
    // Month navigation
    const prevMonthBtn = document.getElementById("acPrevMonth");
    const nextMonthBtn = document.getElementById("acNextMonth");

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => {
        this.changeMonth(-1);
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
        this.changeMonth(1);
      });
    }

    // Today button
    const todayBtn = document.getElementById("acTodayBtn");
    if (todayBtn) {
      todayBtn.addEventListener("click", () => {
        this.goToToday();
      });
    }
  }

  async loadProperties() {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.AC_SERVICE_PROPERTIES
      );
      const result = await response.json();

      if (result.success) {
        this.properties = result.properties;
        console.log(
          `📋 Loaded ${this.properties.length} properties for AC service`
        );
        this.renderPropertiesList();
        this.loadCalendarData();
      } else {
        console.error("Failed to load properties:", result.error);
        this.showEmptyState("Failed to load properties");
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showEmptyState("Error loading properties. Please try again.");
    }
  }

  async loadCalendarData() {
    try {
      const endpoint = `${API_CONFIG.ENDPOINTS.AC_SERVICE_CALENDAR}/${this.currentYear}/${this.currentMonth}`;
      const response = await API.get(endpoint);
      const result = await response.json();

      if (result.success) {
        this.acServices = result.services;
        console.log(
          `📅 Loaded ${this.acServices.length} AC services for ${this.currentYear}-${this.currentMonth}`
        );
        this.renderCalendar();
      } else {
        console.error("Failed to load calendar data:", result.error);
        this.showEmptyState("Failed to load calendar data");
      }
    } catch (error) {
      console.error("Error loading calendar data:", error);
      this.showEmptyState("Error loading calendar data. Please try again.");
    }
  }

  renderPropertiesList() {
    const container = document.getElementById("acPropertiesList");
    if (!container) return;

    if (this.properties.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No properties found. Add properties in the Property Management section.
        </div>
      `;
      return;
    }

    const html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Property ID</th>
              <th>Address</th>
              <th>Unit</th>
              <th>Move-in Date</th>
              <th>AC Service Provider</th>
              <th>Contact Numbers</th>
            </tr>
          </thead>
          <tbody>
            ${this.properties
              .map(
                (property) => `
              <tr>
                <td><strong>${this.escapeHtml(
                  property.propertyId
                )}</strong></td>
                <td>${this.escapeHtml(property.address)}</td>
                <td>${this.escapeHtml(property.unit)}</td>
                <td>${
                  property.moveInDate
                    ? new Date(property.moveInDate).toLocaleDateString()
                    : "N/A"
                }</td>
                <td>${this.escapeHtml(property.acServiceName || "N/A")}</td>
                <td>
                  ${
                    property.acServiceContactNumbers &&
                    property.acServiceContactNumbers.length > 0
                      ? property.acServiceContactNumbers
                          .map(
                            (num) => `
                        <a href="tel:${this.escapeHtml(
                          num
                        )}" class="badge bg-primary me-1">
                          <i class="bi bi-telephone me-1"></i>${this.escapeHtml(
                            num
                          )}
                        </a>
                      `
                          )
                          .join("")
                      : '<span class="text-muted">N/A</span>'
                  }
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  renderCalendar() {
    const calendarContainer = document.getElementById("acCalendarContainer");
    const monthYearDisplay = document.getElementById("acMonthYear");
    const currentMonthDisplay = document.getElementById(
      "acCurrentMonthDisplay"
    );

    if (!calendarContainer || !monthYearDisplay) return;

    // Update month/year display
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthYearText = `${monthNames[this.currentMonth - 1]} ${
      this.currentYear
    }`;
    monthYearDisplay.textContent = monthYearText;

    // Update navigation button display
    if (currentMonthDisplay) {
      currentMonthDisplay.textContent = monthYearText;
    }

    if (this.acServices.length === 0) {
      calendarContainer.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No AC services scheduled for this month. AC services are scheduled every 3 months after move-in date.
        </div>
      `;
      return;
    }

    // Render calendar grid
    const html = `
      <div class="ac-calendar-grid">
        ${this.acServices
          .map((service) => this.renderServiceCard(service))
          .join("")}
      </div>
    `;

    calendarContainer.innerHTML = html;

    // Bind checkbox events
    this.bindCheckboxEvents();
  }

  renderServiceCard(service) {
    const statusClass = service.isCompleted ? "completed" : "pending";
    const statusIcon = service.isCompleted ? "check-circle-fill" : "clock";
    const statusText = service.isCompleted ? "Completed" : "Pending";
    const statusBadge = service.isCompleted ? "bg-success" : "bg-warning";

    return `
      <div class="ac-service-card ${statusClass}">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h6 class="card-title mb-1">
                  <i class="bi bi-building me-2"></i>${this.escapeHtml(
                    service.propertyId
                  )}
                </h6>
                <small class="text-muted">
                  ${this.escapeHtml(service.address)}, ${this.escapeHtml(
      service.unit
    )}
                </small>
              </div>
              <span class="badge ${statusBadge}">
                <i class="bi bi-${statusIcon} me-1"></i>${statusText}
              </span>
            </div>

            <div class="mb-3">
              <div class="mb-2">
                <i class="bi bi-tools me-2 text-primary"></i>
                <strong>Service Provider:</strong>
                <div class="ms-4">${this.escapeHtml(
                  service.acServiceName
                )}</div>
              </div>

              ${
                service.acServiceContactNumbers &&
                service.acServiceContactNumbers.length > 0
                  ? `
                <div class="mb-2">
                  <i class="bi bi-telephone me-2 text-primary"></i>
                  <strong>Contact:</strong>
                  <div class="ms-4">
                    ${service.acServiceContactNumbers
                      .map(
                        (num) => `
                      <a href="tel:${this.escapeHtml(
                        num
                      )}" class="badge bg-primary me-1 text-decoration-none">
                        <i class="bi bi-telephone-fill me-1"></i>${this.escapeHtml(
                          num
                        )}
                      </a>
                    `
                      )
                      .join("")}
                  </div>
                </div>
              `
                  : ""
              }

              <div class="mb-2">
                <i class="bi bi-calendar-event me-2 text-primary"></i>
                <strong>Move-in Date:</strong>
                <div class="ms-4">${new Date(
                  service.moveInDate
                ).toLocaleDateString()}</div>
              </div>
            </div>

            ${
              service.isCompleted && service.completedAt
                ? `
              <div class="alert alert-success py-2 mb-3">
                <div class="d-flex justify-content-between align-items-start">
                  <small>
                    <i class="bi bi-check-circle me-1"></i>
                    Completed on ${new Date(
                      service.completedAt
                    ).toLocaleDateString()}
                    ${
                      service.completedBy
                        ? ` by ${this.escapeHtml(service.completedBy)}`
                        : ""
                    }
                  </small>
                  ${
                    service.completionImage
                      ? `
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-primary py-0 px-2"
                      onclick="window.acCleanManagementComponent.showCompletionImageModal('${this.escapeHtml(
                        service.completionImage
                      )}', '${this.escapeHtml(
                          service.propertyId
                        )}', '${this.escapeHtml(
                          service.address
                        )}', '${this.escapeHtml(service.unit)}')"
                      title="View evidence">
                      <i class="bi bi-eye"></i>
                    </button>
                  `
                      : ""
                  }
                </div>
                ${
                  service.completionImage
                    ? `
                  <div class="mt-2">
                    <img src="${this.escapeHtml(service.completionImage)}"
                         alt="Completion Receipt"
                         onclick="window.acCleanManagementComponent.showCompletionImageModal('${this.escapeHtml(
                           service.completionImage
                         )}', '${this.escapeHtml(
                        service.propertyId
                      )}', '${this.escapeHtml(
                        service.address
                      )}', '${this.escapeHtml(service.unit)}')"
                         style="max-width: 100%; max-height: 150px; border-radius: 4px; cursor: pointer; object-fit: cover; transition: transform 0.2s;"
                         onmouseover="this.style.transform='scale(1.05)'"
                         onmouseout="this.style.transform='scale(1)'" />
                    <div class="mt-1">
                      <small class="text-muted">
                        <i class="bi bi-zoom-in me-1"></i>Click to view full image
                      </small>
                    </div>
                  </div>
                `
                    : ""
                }
              </div>
            `
                : ""
            }

            <div class="form-check form-switch">
              <input
                class="form-check-input ac-service-checkbox"
                type="checkbox"
                id="ac-${this.escapeHtml(service.propertyId)}"
                data-property-id="${this.escapeHtml(service.propertyId)}"
                ${service.isCompleted ? "checked" : ""}
              >
              <label class="form-check-label" for="ac-${this.escapeHtml(
                service.propertyId
              )}">
                ${service.isCompleted ? "Mark as Pending" : "Mark as Completed"}
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindCheckboxEvents() {
    const checkboxes = document.querySelectorAll(".ac-service-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", async (e) => {
        const propertyId = e.target.dataset.propertyId;
        const isCompleted = e.target.checked;

        if (isCompleted) {
          // Show date picker modal when marking as complete
          e.target.checked = false; // Uncheck temporarily
          this.showCompletionDateModal(propertyId);
        } else {
          // Directly mark as pending (no date needed)
          await this.updateServiceStatus(propertyId, false, null);
        }
      });
    });
  }

  showCompletionDateModal(propertyId) {
    const today = new Date().toISOString().split("T")[0];
    this.completionImageUrl = ""; // Reset completion image

    const modalHtml = `
      <div class="modal fade" id="acCompletionDateModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-calendar-check me-2"></i>AC Service Completion
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p>Complete AC service for <strong>${this.escapeHtml(
                propertyId
              )}</strong>:</p>

              <div class="mb-3">
                <label for="completionDate" class="form-label">Completion Date *</label>
                <input
                  type="date"
                  class="form-control"
                  id="completionDate"
                  value="${today}"
                  max="${today}"
                  required
                />
                <div class="form-text">
                  Select the date when the service was completed
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">
                  Completion Evidence (Optional)
                  <i class="bi bi-info-circle text-muted"
                     data-bs-toggle="tooltip"
                     title="Upload or paste a photo showing the completed AC service"></i>
                </label>

                <!-- Image URL Input with Paste Support -->
                <div class="input-group mb-2">
                  <span class="input-group-text"><i class="bi bi-image"></i></span>
                  <input
                    type="text"
                    class="form-control"
                    id="completionImageUrl"
                    placeholder="Paste image URL or Ctrl+V to paste from clipboard"
                    style="border-left: 3px solid #0d6efd;"
                  />
                </div>

                <!-- Upload Button -->
                <div class="mb-2">
                  <button type="button" class="btn btn-sm btn-outline-primary" onclick="window.acCleanManagementComponent.openCompletionImageUpload()">
                    <i class="bi bi-upload me-1"></i>Upload from File
                  </button>
                  <input type="file" id="completionImageFileInput" accept="image/*" style="display: none;" />
                </div>

                <!-- Image Preview -->
                <div id="completionImagePreview" style="display: none;">
                  <div class="card mt-2">
                    <div class="card-body p-2">
                      <div class="d-flex align-items-center">
                        <img id="completionImagePreviewImg" src="" alt="Preview" style="max-height: 80px; max-width: 120px; object-fit: cover;" class="me-2" />
                        <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.acCleanManagementComponent.removeCompletionImage()">
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                Cancel
              </button>
              <button type="button" class="btn btn-success" id="confirmCompletionBtn">
                <i class="bi bi-check-circle me-1"></i>Mark as Completed
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("acCompletionDateModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("acCompletionDateModal")
    );
    modal.show();

    // Setup clipboard paste for image URL field
    const imageUrlField = document.getElementById("completionImageUrl");
    if (imageUrlField) {
      imageUrlField.addEventListener("paste", async (e) => {
        e.preventDefault();
        await this.handleCompletionImagePaste(e);
      });

      // Monitor URL input changes for preview
      imageUrlField.addEventListener("change", () => {
        this.updateCompletionImagePreview(imageUrlField.value);
      });
    }

    // Setup file input listener
    const fileInput = document.getElementById("completionImageFileInput");
    if (fileInput) {
      fileInput.addEventListener("change", async (e) => {
        if (e.target.files.length > 0) {
          await this.uploadCompletionImage(e.target.files[0]);
        }
      });
    }

    // Handle confirmation
    const confirmBtn = document.getElementById("confirmCompletionBtn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        const completionDateInput = document.getElementById("completionDate");
        const completionDate = completionDateInput.value;

        if (!completionDate) {
          showToast("Please select a completion date", "error");
          return;
        }

        // Get completion image if available
        const imageUrl = document
          .getElementById("completionImageUrl")
          .value.trim();

        // Close modal
        modal.hide();

        // Update service status with selected date and image
        await this.updateServiceStatus(
          propertyId,
          true,
          completionDate,
          imageUrl
        );
      });
    }
  }

  // Open file picker for completion image
  openCompletionImageUpload() {
    const fileInput = document.getElementById("completionImageFileInput");
    if (fileInput) {
      fileInput.click();
    }
  }

  // Handle clipboard paste for completion image
  async handleCompletionImagePaste(event) {
    try {
      const items = event.clipboardData?.items;
      if (!items) return;

      let imageFound = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.indexOf("image") !== -1) {
          imageFound = true;
          const file = item.getAsFile();

          if (file) {
            console.log(
              "📋 Image pasted from clipboard:",
              file.name,
              file.type
            );
            await this.uploadCompletionImage(file);
            break;
          }
        }
      }

      if (!imageFound) {
        // Check for image URL in text
        const text = event.clipboardData?.getData("text");
        if (text && this.isImageUrl(text)) {
          document.getElementById("completionImageUrl").value = text;
          this.updateCompletionImagePreview(text);
        } else {
          showToast("No image found in clipboard", "warning");
        }
      }
    } catch (error) {
      console.error("Error handling clipboard paste:", error);
      showToast("Error pasting from clipboard", "error");
    }
  }

  // Upload completion image
  async uploadCompletionImage(file) {
    const imageUrlField = document.getElementById("completionImageUrl");
    const originalPlaceholder = imageUrlField.placeholder;

    try {
      imageUrlField.placeholder = "Uploading image...";
      imageUrlField.disabled = true;

      const formData = new FormData();
      formData.append("image", file);

      const uploadUrl = buildApiUrl(
        API_CONFIG.ENDPOINTS.UPLOAD_TENANT_DOCUMENT
      );
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        let imageUrl = result.url;
        if (imageUrl && !imageUrl.startsWith("http")) {
          if (imageUrl.startsWith("/")) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            imageUrl = "https://" + imageUrl;
          }
        }

        imageUrlField.value = imageUrl;
        this.updateCompletionImagePreview(imageUrl);
        showToast("Image uploaded successfully!", "success");
      } else {
        showToast("Failed to upload image: " + result.error, "error");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      showToast("Error uploading image", "error");
    } finally {
      imageUrlField.placeholder = originalPlaceholder;
      imageUrlField.disabled = false;
    }
  }

  // Update image preview
  updateCompletionImagePreview(imageUrl) {
    const preview = document.getElementById("completionImagePreview");
    const previewImg = document.getElementById("completionImagePreviewImg");

    if (imageUrl && this.isImageUrl(imageUrl)) {
      previewImg.src = imageUrl;
      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  }

  // Remove completion image
  removeCompletionImage() {
    document.getElementById("completionImageUrl").value = "";
    document.getElementById("completionImagePreview").style.display = "none";
  }

  // Check if string is an image URL
  isImageUrl(url) {
    if (!url) return false;
    return (
      /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url) ||
      url.includes("cloudinary.com") ||
      url.includes("res.cloudinary.com")
    );
  }

  // Show completion image in modal
  showCompletionImageModal(imageUrl, propertyId, address = "", unit = "") {
    // Format the full address display
    const fullAddress =
      address && unit ? `${address}, ${unit}` : address || propertyId;

    const modalHtml = `
      <div class="modal fade" id="completionImageViewModal" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-image me-2"></i>Completion Receipt - ${this.escapeHtml(
                  fullAddress
                )}
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body text-center">
              <img src="${this.escapeHtml(imageUrl)}"
                   alt="Completion Receipt"
                   style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 4px;" />
            </div>
            <div class="modal-footer justify-content-between">
              <div class="btn-group" role="group">
                <button type="button"
                        class="btn btn-outline-primary"
                        onclick="window.acCleanManagementComponent.copyImageUrl('${this.escapeHtml(
                          imageUrl
                        )}')"
                        title="Copy image URL to clipboard">
                  <i class="bi bi-link-45deg me-1"></i>Copy URL
                </button>
                <button type="button"
                        class="btn btn-outline-primary"
                        onclick="window.acCleanManagementComponent.downloadImage('${this.escapeHtml(
                          imageUrl
                        )}', '${this.escapeHtml(propertyId)}')"
                        title="Download image">
                  <i class="bi bi-download me-1"></i>Download
                </button>
              </div>
              <div>
                <a href="${this.escapeHtml(imageUrl)}"
                   target="_blank"
                   rel="noopener noreferrer"
                   class="btn btn-primary">
                  <i class="bi bi-box-arrow-up-right me-1"></i>Open in New Tab
                </a>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("completionImageViewModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("completionImageViewModal")
    );
    modal.show();
  }

  // Copy image URL to clipboard
  async copyImageUrl(imageUrl) {
    try {
      await navigator.clipboard.writeText(imageUrl);
      showToast("Image URL copied to clipboard!", "success");
    } catch (error) {
      console.error("Error copying to clipboard:", error);

      // Fallback method
      const textArea = document.createElement("textarea");
      textArea.value = imageUrl;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();

      try {
        document.execCommand("copy");
        showToast("Image URL copied to clipboard!", "success");
      } catch (fallbackError) {
        showToast("Failed to copy URL", "error");
      }

      document.body.removeChild(textArea);
    }
  }

  // Download image
  async downloadImage(imageUrl, propertyId) {
    try {
      showToast("Downloading image...", "info");

      // Fetch the image
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Generate filename
      const fileExtension = imageUrl.split(".").pop().split("?")[0] || "jpg";
      const timestamp = new Date().toISOString().split("T")[0];
      link.download = `AC_Service_${propertyId}_${timestamp}.${fileExtension}`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);

      showToast("Image downloaded successfully!", "success");
    } catch (error) {
      console.error("Error downloading image:", error);

      // Fallback: open in new tab
      showToast("Opening image in new tab...", "info");
      window.open(imageUrl, "_blank");
    }
  }

  async updateServiceStatus(
    propertyId,
    isCompleted,
    completedDate = null,
    completionImage = null
  ) {
    try {
      const requestData = {
        propertyId,
        year: this.currentYear,
        month: this.currentMonth,
        isCompleted,
      };

      // Add completion date if provided
      if (completedDate) {
        requestData.completedDate = completedDate;
      }

      // Add completion image if provided
      if (completionImage) {
        requestData.completionImage = completionImage;
      }

      const response = await API.post(
        API_CONFIG.ENDPOINTS.AC_SERVICE_STATUS,
        requestData
      );

      const result = await response.json();

      if (result.success) {
        showToast(
          `AC service ${
            isCompleted ? "completed" : "marked as pending"
          } for ${propertyId}`,
          "success"
        );
        // Reload calendar to update the view
        await this.loadCalendarData();
      } else {
        showToast("Failed to update service status", "error");
        // Reload to revert checkbox state
        await this.loadCalendarData();
      }
    } catch (error) {
      console.error("Error updating service status:", error);
      showToast("Error updating service status", "error");
      // Reload to revert checkbox state
      await this.loadCalendarData();
    }
  }

  changeMonth(delta) {
    this.currentMonth += delta;

    if (this.currentMonth > 12) {
      this.currentMonth = 1;
      this.currentYear += 1;
    } else if (this.currentMonth < 1) {
      this.currentMonth = 12;
      this.currentYear -= 1;
    }

    this.loadCalendarData();
  }

  goToToday() {
    const today = new Date();
    this.currentYear = today.getFullYear();
    this.currentMonth = today.getMonth() + 1;
    this.loadCalendarData();
  }

  showEmptyState(message = "No data available") {
    const calendarContainer = document.getElementById("acCalendarContainer");
    if (calendarContainer) {
      calendarContainer.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          ${this.escapeHtml(message)}
        </div>
      `;
    }
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== AC SERVICE COMPANY MANAGEMENT ====================
  // Methods for managing AC service companies (submodule)

  async loadCompanies() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.AC_SERVICE_COMPANIES);
      const result = await response.json();

      if (result.success) {
        this.companies = result.companies;
        console.log(`📋 Loaded ${this.companies.length} AC service companies`);
        this.renderCompaniesTable();
      } else {
        console.error("Failed to load companies:", result.error);
        this.showCompaniesEmptyState("Failed to load AC service companies");
      }
    } catch (error) {
      console.error("Error loading companies:", error);
      this.showCompaniesEmptyState(
        "Error loading companies. Please try again."
      );
    }
  }

  renderCompaniesTable() {
    const container = document.getElementById("acCompaniesContainer");
    if (!container) return;

    if (this.companies.length === 0) {
      this.showCompaniesEmptyState();
      return;
    }

    const html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>Company ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Website</th>
              <th>Notes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.companies
              .map(
                (company) => `
              <tr>
                <td><strong>${this.escapeHtml(company.companyId)}</strong></td>
                <td>${this.escapeHtml(company.name)}</td>
                <td>
                  <a href="tel:${this.escapeHtml(
                    company.phone
                  )}" class="text-decoration-none">
                    <i class="bi bi-telephone me-1"></i>${this.escapeHtml(
                      company.phone
                    )}
                  </a>
                </td>
                <td>
                  ${
                    company.website
                      ? `<a href="${this.escapeHtml(
                          company.website
                        )}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
                        <i class="bi bi-globe me-1"></i>Website
                       </a>`
                      : '<span class="text-muted">-</span>'
                  }
                </td>
                <td>${this.escapeHtml(company.notes || "-")}</td>
                <td>
                  <span class="badge ${
                    company.isActive ? "bg-success" : "bg-secondary"
                  }">
                    ${company.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  <button
                    class="btn btn-sm btn-primary me-1"
                    onclick="window.acCleanManagementComponent.showEditCompanyModal('${this.escapeHtml(
                      company.companyId
                    )}')"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    onclick="window.acCleanManagementComponent.deleteCompany('${this.escapeHtml(
                      company.companyId
                    )}')"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;
  }

  showAddCompanyModal() {
    this.editingCompany = null;

    const modalHtml = `
      <div class="modal fade" id="acCompanyModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Add AC Service Company</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="acCompanyForm">
              <div class="modal-body">
                <div class="mb-3">
                  <label for="companyId" class="form-label">Company ID *</label>
                  <input
                    type="text"
                    class="form-control"
                    id="companyId"
                    required
                    placeholder="e.g., AC001"
                  />
                </div>
                <div class="mb-3">
                  <label for="companyName" class="form-label">Company Name *</label>
                  <input
                    type="text"
                    class="form-control"
                    id="companyName"
                    required
                    placeholder="e.g., Cool Air Service Pte Ltd"
                  />
                </div>
                <div class="mb-3">
                  <label for="companyPhone" class="form-label">Phone Number *</label>
                  <input
                    type="tel"
                    class="form-control"
                    id="companyPhone"
                    required
                    placeholder="e.g., +65 1234 5678"
                  />
                </div>
                <div class="mb-3">
                  <label for="companyWebsite" class="form-label">Website</label>
                  <input
                    type="url"
                    class="form-control"
                    id="companyWebsite"
                    placeholder="e.g., https://www.example.com"
                  />
                </div>
                <div class="mb-3">
                  <label for="companyNotes" class="form-label">Notes</label>
                  <textarea
                    class="form-control"
                    id="companyNotes"
                    rows="3"
                    placeholder="Additional notes (optional)"
                  ></textarea>
                </div>
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="companyIsActive"
                    checked
                  />
                  <label class="form-check-label" for="companyIsActive">
                    Active
                  </label>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  Add Company
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("acCompanyModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("acCompanyModal")
    );
    modal.show();

    // Rebind form event
    const form = document.getElementById("acCompanyForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleCompanySubmit(e);
      });
    }
  }

  async showEditCompanyModal(companyId) {
    // Find company
    const company = this.companies.find((c) => c.companyId === companyId);
    if (!company) {
      showToast("Company not found", "error");
      return;
    }

    this.editingCompany = company;

    const modalHtml = `
      <div class="modal fade" id="acCompanyModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit AC Service Company</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="acCompanyForm">
              <div class="modal-body">
                <div class="mb-3">
                  <label for="companyId" class="form-label">Company ID</label>
                  <input
                    type="text"
                    class="form-control"
                    id="companyId"
                    value="${this.escapeHtml(company.companyId)}"
                    disabled
                  />
                </div>
                <div class="mb-3">
                  <label for="companyName" class="form-label">Company Name *</label>
                  <input
                    type="text"
                    class="form-control"
                    id="companyName"
                    value="${this.escapeHtml(company.name)}"
                    required
                  />
                </div>
                <div class="mb-3">
                  <label for="companyPhone" class="form-label">Phone Number *</label>
                  <input
                    type="tel"
                    class="form-control"
                    id="companyPhone"
                    value="${this.escapeHtml(company.phone)}"
                    required
                  />
                </div>
                <div class="mb-3">
                  <label for="companyWebsite" class="form-label">Website</label>
                  <input
                    type="url"
                    class="form-control"
                    id="companyWebsite"
                    value="${this.escapeHtml(company.website || "")}"
                    placeholder="e.g., https://www.example.com"
                  />
                </div>
                <div class="mb-3">
                  <label for="companyNotes" class="form-label">Notes</label>
                  <textarea
                    class="form-control"
                    id="companyNotes"
                    rows="3"
                  >${this.escapeHtml(company.notes || "")}</textarea>
                </div>
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="companyIsActive"
                    ${company.isActive ? "checked" : ""}
                  />
                  <label class="form-check-label" for="companyIsActive">
                    Active
                  </label>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  Update Company
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("acCompanyModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("acCompanyModal")
    );
    modal.show();

    // Rebind form event
    const form = document.getElementById("acCompanyForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleCompanySubmit(e);
      });
    }
  }

  async handleCompanySubmit(e) {
    e.preventDefault();

    const companyIdInput = document.getElementById("companyId");
    const companyId = companyIdInput.value.trim().toUpperCase();
    const name = document.getElementById("companyName").value.trim();
    const phone = document.getElementById("companyPhone").value.trim();
    const website = document.getElementById("companyWebsite").value.trim();
    const notes = document.getElementById("companyNotes").value.trim();
    const isActive = document.getElementById("companyIsActive").checked;

    if (this.editingCompany) {
      // Update existing company
      await this.updateCompany(this.editingCompany.companyId, {
        name,
        phone,
        website,
        notes,
        isActive,
      });
    } else {
      // Create new company
      await this.createCompany({
        companyId,
        name,
        phone,
        website,
        notes,
        isActive,
      });
    }
  }

  async createCompany(data) {
    try {
      const response = await API.post(
        API_CONFIG.ENDPOINTS.AC_SERVICE_COMPANIES,
        data
      );
      const result = await response.json();

      if (result.success) {
        showToast("AC service company created successfully", "success");

        // Close modal
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("acCompanyModal")
        );
        if (modal) modal.hide();

        // Reload companies
        await this.loadCompanies();
      } else {
        showToast(result.error || "Failed to create company", "error");
      }
    } catch (error) {
      console.error("Error creating company:", error);
      showToast("Error creating company", "error");
    }
  }

  async updateCompany(companyId, data) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.AC_SERVICE_COMPANY_BY_ID(companyId);
      const response = await API.put(endpoint, data);
      const result = await response.json();

      if (result.success) {
        showToast("AC service company updated successfully", "success");

        // Close modal
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("acCompanyModal")
        );
        if (modal) modal.hide();

        // Reload companies
        await this.loadCompanies();
      } else {
        showToast(result.error || "Failed to update company", "error");
      }
    } catch (error) {
      console.error("Error updating company:", error);
      showToast("Error updating company", "error");
    }
  }

  async deleteCompany(companyId) {
    if (!confirm(`Are you sure you want to delete company ${companyId}?`)) {
      return;
    }

    try {
      const endpoint = API_CONFIG.ENDPOINTS.AC_SERVICE_COMPANY_BY_ID(companyId);
      const response = await API.delete(endpoint + "?soft=true");
      const result = await response.json();

      if (result.success) {
        showToast("AC service company deactivated successfully", "success");
        await this.loadCompanies();
      } else {
        showToast(result.error || "Failed to delete company", "error");
      }
    } catch (error) {
      console.error("Error deleting company:", error);
      showToast("Error deleting company", "error");
    }
  }

  showCompaniesEmptyState(message = "No AC service companies found") {
    const container = document.getElementById("acCompaniesContainer");
    if (container) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          ${this.escapeHtml(message)}
        </div>
        <p class="text-center text-muted">
          Click "Add AC Service Company" to get started.
        </p>
      `;
    }
  }
}

// Initialize component when DOM is ready
if (document.readyState === "loading") {
  console.log("⏳ Waiting for DOMContentLoaded...");
  document.addEventListener("DOMContentLoaded", () => {
    console.log("📄 DOM loaded, creating AC Clean Management Component");
    window.acCleanManagementComponent = new AcCleanManagementComponent();
  });
} else {
  console.log("📄 DOM already loaded, creating AC Clean Management Component");
  window.acCleanManagementComponent = new AcCleanManagementComponent();
}
