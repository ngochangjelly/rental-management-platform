/**
 * AC Service Company Management Component
 * Handles CRUD operations for AC service companies
 */
class AcServiceCompanyComponent {
  constructor() {
    this.companies = [];
    this.editingCompany = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadCompanies();
  }

  bindEvents() {
    // Add company button
    const addBtn = document.getElementById("addAcCompanyBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        this.showAddCompanyModal();
      });
    }

    // Company form submission
    const form = document.getElementById("acCompanyForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleCompanySubmit(e);
      });
    }
  }

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
        this.showEmptyState("Failed to load AC service companies");
      }
    } catch (error) {
      console.error("Error loading companies:", error);
      this.showEmptyState("Error loading companies. Please try again.");
    }
  }

  renderCompaniesTable() {
    const container = document.getElementById("acCompaniesContainer");
    if (!container) return;

    if (this.companies.length === 0) {
      this.showEmptyState();
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
                  <a href="tel:${this.escapeHtml(company.phone)}" class="text-decoration-none">
                    <i class="bi bi-telephone me-1"></i>${this.escapeHtml(company.phone)}
                  </a>
                </td>
                <td>
                  ${company.website
                    ? `<a href="${this.escapeHtml(company.website)}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
                        <i class="bi bi-globe me-1"></i>Website
                       </a>`
                    : '<span class="text-muted">-</span>'
                  }
                </td>
                <td>${this.escapeHtml(company.notes || '-')}</td>
                <td>
                  <span class="badge ${company.isActive ? 'bg-success' : 'bg-secondary'}">
                    ${company.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    class="btn btn-sm btn-primary me-1"
                    onclick="window.acServiceCompanyComponent.showEditCompanyModal('${this.escapeHtml(company.companyId)}')"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    onclick="window.acServiceCompanyComponent.deleteCompany('${this.escapeHtml(company.companyId)}')"
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
    const modal = new bootstrap.Modal(document.getElementById("acCompanyModal"));
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
    const company = this.companies.find(c => c.companyId === companyId);
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
                    value="${this.escapeHtml(company.website || '')}"
                    placeholder="e.g., https://www.example.com"
                  />
                </div>
                <div class="mb-3">
                  <label for="companyNotes" class="form-label">Notes</label>
                  <textarea
                    class="form-control"
                    id="companyNotes"
                    rows="3"
                  >${this.escapeHtml(company.notes || '')}</textarea>
                </div>
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    id="companyIsActive"
                    ${company.isActive ? 'checked' : ''}
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
    const modal = new bootstrap.Modal(document.getElementById("acCompanyModal"));
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
        isActive
      });
    } else {
      // Create new company
      await this.createCompany({
        companyId,
        name,
        phone,
        website,
        notes,
        isActive
      });
    }
  }

  async createCompany(data) {
    try {
      const response = await API.post(API_CONFIG.ENDPOINTS.AC_SERVICE_COMPANIES, data);
      const result = await response.json();

      if (result.success) {
        showToast("AC service company created successfully", "success");

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById("acCompanyModal"));
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
        const modal = bootstrap.Modal.getInstance(document.getElementById("acCompanyModal"));
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

  showEmptyState(message = "No AC service companies found") {
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
    window.acServiceCompanyComponent = new AcServiceCompanyComponent();
  });
} else {
  window.acServiceCompanyComponent = new AcServiceCompanyComponent();
}
