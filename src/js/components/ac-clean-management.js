/**
 * AC Clean Management Component
 * Handles AC service scheduling and tracking with monthly calendar view
 */
class AcCleanManagementComponent {
  constructor() {
    this.properties = [];
    this.currentDate = new Date();
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth() + 1; // 1-12
    this.acServices = [];
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadProperties();
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
      const response = await API.get(API_CONFIG.ENDPOINTS.AC_SERVICE_PROPERTIES);
      const result = await response.json();

      if (result.success) {
        this.properties = result.properties;
        console.log(`📋 Loaded ${this.properties.length} properties for AC service`);
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
        console.log(`📅 Loaded ${this.acServices.length} AC services for ${this.currentYear}-${this.currentMonth}`);
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
                <td><strong>${this.escapeHtml(property.propertyId)}</strong></td>
                <td>${this.escapeHtml(property.address)}</td>
                <td>${this.escapeHtml(property.unit)}</td>
                <td>${property.moveInDate ? new Date(property.moveInDate).toLocaleDateString() : 'N/A'}</td>
                <td>${this.escapeHtml(property.acServiceName || 'N/A')}</td>
                <td>
                  ${property.acServiceContactNumbers && property.acServiceContactNumbers.length > 0
                    ? property.acServiceContactNumbers.map(num => `
                        <a href="tel:${this.escapeHtml(num)}" class="badge bg-primary me-1">
                          <i class="bi bi-telephone me-1"></i>${this.escapeHtml(num)}
                        </a>
                      `).join('')
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

    if (!calendarContainer || !monthYearDisplay) return;

    // Update month/year display
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthYearDisplay.textContent = `${monthNames[this.currentMonth - 1]} ${this.currentYear}`;

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
    const statusClass = service.isCompleted ? 'completed' : 'pending';
    const statusIcon = service.isCompleted ? 'check-circle-fill' : 'clock';
    const statusText = service.isCompleted ? 'Completed' : 'Pending';
    const statusBadge = service.isCompleted ? 'bg-success' : 'bg-warning';

    return `
      <div class="ac-service-card ${statusClass}">
        <div class="card h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h6 class="card-title mb-1">
                  <i class="bi bi-building me-2"></i>${this.escapeHtml(service.propertyId)}
                </h6>
                <small class="text-muted">
                  ${this.escapeHtml(service.address)}, ${this.escapeHtml(service.unit)}
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
                <div class="ms-4">${this.escapeHtml(service.acServiceName)}</div>
              </div>

              ${service.acServiceContactNumbers && service.acServiceContactNumbers.length > 0 ? `
                <div class="mb-2">
                  <i class="bi bi-telephone me-2 text-primary"></i>
                  <strong>Contact:</strong>
                  <div class="ms-4">
                    ${service.acServiceContactNumbers.map(num => `
                      <a href="tel:${this.escapeHtml(num)}" class="badge bg-primary me-1 text-decoration-none">
                        <i class="bi bi-telephone-fill me-1"></i>${this.escapeHtml(num)}
                      </a>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <div class="mb-2">
                <i class="bi bi-calendar-event me-2 text-primary"></i>
                <strong>Move-in Date:</strong>
                <div class="ms-4">${new Date(service.moveInDate).toLocaleDateString()}</div>
              </div>
            </div>

            ${service.isCompleted && service.completedAt ? `
              <div class="alert alert-success py-2 mb-3">
                <small>
                  <i class="bi bi-check-circle me-1"></i>
                  Completed on ${new Date(service.completedAt).toLocaleDateString()}
                  ${service.completedBy ? ` by ${this.escapeHtml(service.completedBy)}` : ''}
                </small>
              </div>
            ` : ''}

            <div class="form-check form-switch">
              <input
                class="form-check-input ac-service-checkbox"
                type="checkbox"
                id="ac-${this.escapeHtml(service.propertyId)}"
                data-property-id="${this.escapeHtml(service.propertyId)}"
                ${service.isCompleted ? 'checked' : ''}
              >
              <label class="form-check-label" for="ac-${this.escapeHtml(service.propertyId)}">
                ${service.isCompleted ? 'Mark as Pending' : 'Mark as Completed'}
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindCheckboxEvents() {
    const checkboxes = document.querySelectorAll('.ac-service-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
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
    const today = new Date().toISOString().split('T')[0];

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
              <p>Select the date when the AC service was completed for <strong>${this.escapeHtml(propertyId)}</strong>:</p>
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
    const modal = new bootstrap.Modal(document.getElementById("acCompletionDateModal"));
    modal.show();

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

        // Close modal
        modal.hide();

        // Update service status with selected date
        await this.updateServiceStatus(propertyId, true, completionDate);
      });
    }
  }

  async updateServiceStatus(propertyId, isCompleted, completedDate = null) {
    try {
      const requestData = {
        propertyId,
        year: this.currentYear,
        month: this.currentMonth,
        isCompleted
      };

      // Add completion date if provided
      if (completedDate) {
        requestData.completedDate = completedDate;
      }

      const response = await API.post(API_CONFIG.ENDPOINTS.AC_SERVICE_STATUS, requestData);

      const result = await response.json();

      if (result.success) {
        showToast(
          `AC service ${isCompleted ? 'completed' : 'marked as pending'} for ${propertyId}`,
          'success'
        );
        // Reload calendar to update the view
        await this.loadCalendarData();
      } else {
        showToast('Failed to update service status', 'error');
        // Reload to revert checkbox state
        await this.loadCalendarData();
      }
    } catch (error) {
      console.error('Error updating service status:', error);
      showToast('Error updating service status', 'error');
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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize component when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.acCleanManagementComponent = new AcCleanManagementComponent();
  });
} else {
  window.acCleanManagementComponent = new AcCleanManagementComponent();
}
