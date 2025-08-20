/**
 * Investor Management Component
 * Handles comprehensive investor management with properties and percentages
 */
class InvestorManagementComponent {
  constructor() {
    this.investors = [];
    this.properties = [];
    this.isModalOpen = false;
    this.editingInvestorId = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadData();
  }

  bindEvents() {
    // Add investor button
    const addInvestorBtn = document.getElementById("addInvestorBtn");
    if (addInvestorBtn) {
      addInvestorBtn.addEventListener("click", () => {
        this.showInvestorModal();
      });
    }
  }

  async loadData() {
    await Promise.all([
      this.loadInvestors(),
      this.loadProperties()
    ]);
    this.renderInvestors();
  }

  async loadInvestors() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();

      if (result.success) {
        this.investors = result.data || [];
        this.updateInvestorCount();
      } else {
        this.investors = [];
        this.showError(result.message || "Failed to load investors");
      }
    } catch (error) {
      console.error("Error loading investors:", error);
      this.investors = [];
      this.showError("Failed to load investors");
    }
  }

  async loadProperties() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
      const result = await response.json();

      if (result.success) {
        this.properties = result.data || [];
      } else {
        this.properties = [];
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      this.properties = [];
    }
  }

  updateInvestorCount() {
    const countElement = document.getElementById("investorCount");
    if (countElement) {
      countElement.textContent = this.investors.length;
    }
  }

  renderInvestors() {
    const investorsList = document.getElementById("investorsList");
    if (!investorsList) return;

    if (this.investors.length === 0) {
      investorsList.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-person-badge fs-1 text-muted"></i>
          <p class="mt-3 text-muted">No investors found</p>
          <button class="btn btn-primary" onclick="window.investorManagement.showInvestorModal()">
            <i class="bi bi-plus-circle me-1"></i>Add First Investor
          </button>
        </div>
      `;
      return;
    }

    let html = '<div class="row">';
    
    this.investors.forEach((investor) => {
      const totalProperties = investor.properties ? investor.properties.length : 0;
      const totalPercentage = investor.properties ? 
        investor.properties.reduce((sum, prop) => sum + prop.percentage, 0) : 0;

      html += `
        <div class="col-md-6 col-lg-4 mb-4">
          <div class="card investor-card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <div>
                <h6 class="mb-0">${escapeHtml(investor.name)}</h6>
                <small class="text-muted">ID: ${investor.investorId}</small>
              </div>
              <div class="dropdown">
                <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                  <i class="bi bi-three-dots"></i>
                </button>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item" href="#" onclick="window.investorManagement.editInvestor('${investor.investorId}')">
                    <i class="bi bi-pencil me-2"></i>Edit
                  </a></li>
                  <li><a class="dropdown-item text-danger" href="#" onclick="window.investorManagement.deleteInvestor('${investor.investorId}')">
                    <i class="bi bi-trash me-2"></i>Delete
                  </a></li>
                </ul>
              </div>
            </div>
            <div class="card-body">
              ${investor.username ? `<p class="mb-2"><strong>Username:</strong> ${escapeHtml(investor.username)}</p>` : ''}
              ${investor.email ? `<p class="mb-2"><strong>Email:</strong> ${escapeHtml(investor.email)}</p>` : ''}
              ${investor.phone ? `<p class="mb-2"><strong>Phone:</strong> ${escapeHtml(investor.phone)}</p>` : ''}
              
              <hr>
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span><strong>Properties:</strong></span>
                <span class="badge bg-primary">${totalProperties}</span>
              </div>
              
              ${totalProperties > 0 ? `
                <div class="properties-list">
                  ${investor.properties.map(property => `
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="property-badge badge bg-light text-dark">${property.propertyId}</span>
                      <span class="percentage-display">${property.percentage}%</span>
                    </div>
                  `).join('')}
                </div>
                <div class="mt-2 pt-2 border-top">
                  <small class="text-muted">Total Investment: <strong class="percentage-display">${totalPercentage}%</strong></small>
                </div>
              ` : `
                <div class="text-center text-muted">
                  <small>No property investments</small>
                </div>
              `}
            </div>
            <div class="card-footer bg-transparent">
              <div class="btn-group w-100" role="group">
                <button class="btn btn-sm btn-outline-primary" onclick="window.investorManagement.addPropertyToInvestor('${investor.investorId}')">
                  <i class="bi bi-plus me-1"></i>Add Property
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="window.investorManagement.viewInvestorDetails('${investor.investorId}')">
                  <i class="bi bi-eye me-1"></i>Details
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    investorsList.innerHTML = html;
  }

  showInvestorModal(investorId = null) {
    if (this.isModalOpen) return;
    this.isModalOpen = true;
    this.editingInvestorId = investorId;

    const isEdit = !!investorId;
    const title = isEdit ? "Edit Investor" : "Add Investor";

    const modalHtml = `
      <div class="modal fade" id="investorModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-person-${isEdit ? 'gear' : 'plus'} me-2"></i>${title}
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="investorForm">
              <div class="modal-body">
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Username <span class="text-danger">*</span></label>
                      <input type="text" class="form-control" name="username" required>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Full Name <span class="text-danger">*</span></label>
                      <input type="text" class="form-control" name="name" required>
                    </div>
                  </div>
                </div>
                
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Email</label>
                      <input type="email" class="form-control" name="email">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Phone</label>
                      <input type="tel" class="form-control" name="phone">
                    </div>
                  </div>
                </div>
                
                <hr>
                <h6><i class="bi bi-building me-2"></i>Property Investments</h6>
                <div id="propertiesList">
                  <div class="text-muted">Loading properties...</div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary mt-2" id="addPropertyBtn">
                  <i class="bi bi-plus me-1"></i>Add Property
                </button>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <i class="bi bi-check-circle me-1"></i>${isEdit ? 'Update' : 'Create'} Investor
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('investorModal'));
    
    // Populate form if editing
    if (isEdit) {
      this.populateInvestorForm(investorId);
    } else {
      this.renderPropertiesInModal([]);
    }

    // Bind form events
    this.bindModalEvents();

    // Clean up on close
    document.getElementById('investorModal').addEventListener('hidden.bs.modal', () => {
      this.isModalOpen = false;
      this.editingInvestorId = null;
      document.getElementById('investorModal').remove();
    });

    modal.show();
  }

  populateInvestorForm(investorId) {
    const investor = this.investors.find(inv => inv.investorId === investorId);
    if (!investor) return;

    const form = document.getElementById('investorForm');
    form.querySelector('[name="username"]').value = investor.username || '';
    form.querySelector('[name="name"]').value = investor.name || '';
    form.querySelector('[name="email"]').value = investor.email || '';
    form.querySelector('[name="phone"]').value = investor.phone || '';

    this.renderPropertiesInModal(investor.properties || []);
  }

  renderPropertiesInModal(investorProperties = []) {
    const propertiesList = document.getElementById('propertiesList');
    if (!propertiesList) return;

    if (this.properties.length === 0) {
      propertiesList.innerHTML = '<div class="alert alert-warning">No properties available. Add properties first.</div>';
      return;
    }

    let html = '<div class="property-investments">';
    
    // Show existing investments
    investorProperties.forEach((investment, index) => {
      const property = this.properties.find(p => p.propertyId === investment.propertyId);
      const propertyName = property ? `${property.address}, ${property.unit}` : investment.propertyId;
      
      html += `
        <div class="row align-items-center mb-2 property-row" data-index="${index}">
          <div class="col-md-6">
            <select class="form-select" name="properties[${index}][propertyId]" required>
              <option value="">Select Property</option>
              ${this.properties.map(prop => `
                <option value="${prop.propertyId}" ${prop.propertyId === investment.propertyId ? 'selected' : ''}>
                  ${prop.propertyId} - ${prop.address}, ${prop.unit}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="col-md-4">
            <div class="input-group">
              <input type="number" class="form-control" name="properties[${index}][percentage]" 
                     placeholder="Percentage" min="0" max="100" step="0.1" 
                     value="${investment.percentage}" required>
              <span class="input-group-text">%</span>
            </div>
          </div>
          <div class="col-md-2">
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.property-row').remove()">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
    });

    html += '</div>';
    propertiesList.innerHTML = html;
  }

  bindModalEvents() {
    // Add property button
    const addPropertyBtn = document.getElementById('addPropertyBtn');
    if (addPropertyBtn) {
      addPropertyBtn.addEventListener('click', () => {
        this.addPropertyRowToModal();
      });
    }

    // Form submission
    const form = document.getElementById('investorForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveInvestor();
      });
    }
  }

  addPropertyRowToModal() {
    const propertiesList = document.getElementById('propertiesList');
    if (!propertiesList) return;

    const propertyInvestments = propertiesList.querySelector('.property-investments');
    if (!propertyInvestments) {
      this.renderPropertiesInModal([]);
      return;
    }

    const currentRows = propertyInvestments.querySelectorAll('.property-row');
    const nextIndex = currentRows.length;

    const newRowHtml = `
      <div class="row align-items-center mb-2 property-row" data-index="${nextIndex}">
        <div class="col-md-6">
          <select class="form-select" name="properties[${nextIndex}][propertyId]" required>
            <option value="">Select Property</option>
            ${this.properties.map(prop => `
              <option value="${prop.propertyId}">
                ${prop.propertyId} - ${prop.address}, ${prop.unit}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="col-md-4">
          <div class="input-group">
            <input type="number" class="form-control" name="properties[${nextIndex}][percentage]" 
                   placeholder="Percentage" min="0" max="100" step="0.1" required>
            <span class="input-group-text">%</span>
          </div>
        </div>
        <div class="col-md-2">
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.property-row').remove()">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;

    propertyInvestments.insertAdjacentHTML('beforeend', newRowHtml);
  }

  async saveInvestor() {
    const form = document.getElementById('investorForm');
    const formData = new FormData(form);

    try {
      const investorData = {
        username: formData.get('username'),
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        properties: []
      };

      // Collect property investments
      const propertyRows = form.querySelectorAll('.property-row');
      propertyRows.forEach(row => {
        const propertyId = row.querySelector('select').value;
        const percentage = parseFloat(row.querySelector('input[type="number"]').value);
        
        if (propertyId && !isNaN(percentage)) {
          investorData.properties.push({
            propertyId,
            percentage
          });
        }
      });

      if (this.editingInvestorId) {
        // Update existing investor
        const response = await API.put(
          API_CONFIG.ENDPOINTS.INVESTOR_BY_ID(this.editingInvestorId),
          investorData
        );
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Failed to update investor');
        }

        this.showSuccess('Investor updated successfully');
      } else {
        // Create new investor
        const investorId = await this.generateInvestorId();
        const newInvestor = {
          investorId,
          ...investorData
        };

        const response = await API.post(API_CONFIG.ENDPOINTS.INVESTORS, newInvestor);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.message || 'Failed to create investor');
        }

        this.showSuccess('Investor created successfully');
      }

      // Close modal and refresh
      bootstrap.Modal.getInstance(document.getElementById('investorModal')).hide();
      await this.loadData();

    } catch (error) {
      console.error('Error saving investor:', error);
      this.showError(error.message || 'Failed to save investor');
    }
  }

  async generateInvestorId() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();

      if (result.success && result.data) {
        let maxId = 0;
        result.data.forEach((investor) => {
          const numericId = parseInt(investor.investorId);
          if (!isNaN(numericId) && numericId > maxId) {
            maxId = numericId;
          }
        });
        return (maxId + 1).toString();
      } else {
        return "1";
      }
    } catch (error) {
      console.error("Error generating investor ID:", error);
      return Date.now().toString();
    }
  }

  editInvestor(investorId) {
    this.showInvestorModal(investorId);
  }

  async deleteInvestor(investorId) {
    const investor = this.investors.find(inv => inv.investorId === investorId);
    if (!investor) return;

    const confirmMessage = `Are you sure you want to delete investor "${investor.name}"?\n\nThis will remove them from all properties and cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;

    try {
      const response = await API.delete(API_CONFIG.ENDPOINTS.INVESTOR_BY_ID(investorId));
      const result = await response.json();

      if (result.success) {
        this.showSuccess('Investor deleted successfully');
        await this.loadData();
      } else {
        throw new Error(result.message || 'Failed to delete investor');
      }
    } catch (error) {
      console.error('Error deleting investor:', error);
      this.showError(error.message || 'Failed to delete investor');
    }
  }

  addPropertyToInvestor(investorId) {
    this.showInvestorModal(investorId);
  }

  viewInvestorDetails(investorId) {
    const investor = this.investors.find(inv => inv.investorId === investorId);
    if (!investor) return;

    // For now, just edit the investor - could be expanded to a detailed view
    this.editInvestor(investorId);
  }

  showToast(message, type = "info") {
    if (typeof showToast === 'function') {
      showToast(message, type);
    } else {
      alert(message);
    }
  }

  showSuccess(message) {
    this.showToast(message, "success");
  }

  showError(message) {
    this.showToast(message, "error");
  }

  showInfo(message) {
    this.showToast(message, "info");
  }
}

// Make component globally accessible
window.InvestorManagementComponent = InvestorManagementComponent;