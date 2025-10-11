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
    this.avatar = ''; // Avatar image URL
    this.init();
  }

  init() {
    // Check if required DOM elements exist before proceeding
    const requiredElements = ['investorsList', 'addInvestorMainBtn', 'investorCount'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
      console.warn('InvestorManagementComponent: Required DOM elements missing:', missingElements);
      // Try again after a short delay
      setTimeout(() => this.init(), 200);
      return;
    }

    this.bindEvents();
    this.loadData();
  }

  bindEvents() {
    // Add investor button
    const addInvestorBtn = document.getElementById("addInvestorMainBtn");
    if (addInvestorBtn) {
      addInvestorBtn.addEventListener("click", () => {
        this.showInvestorModal();
      });
    }
  }

  async loadData() {
    try {
      await Promise.all([
        this.loadInvestors(),
        this.loadProperties()
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      // Always render investors, even if API calls failed
      this.renderInvestors();
    }
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
      console.log("Loading properties from:", API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PROPERTIES);
      const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
      
      if (!response.ok) {
        console.warn(`Properties API returned ${response.status}: ${response.statusText}`);
        if (response.status === 401 || response.status === 403) {
          console.warn("Authentication required for properties API");
        }
        this.properties = [];
        return;
      }
      
      const result = await response.json();
      console.log("Properties API response:", result);

      if (result.success && Array.isArray(result.properties)) {
        this.properties = result.properties;
        console.log(`Loaded ${this.properties.length} properties:`, this.properties);
      } else {
        console.warn("Properties API response format issue:", result);
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
    if (!investorsList) {
      console.warn("investorsList element not found");
      return;
    }

    if (this.investors.length === 0) {
      investorsList.innerHTML = `
        <div class="text-center py-5">
          <i class="bi bi-person-badge fs-1 text-muted"></i>
          <p class="mt-3 text-muted">No investors found</p>
          <button class="btn btn-primary" onclick="window.investorManager.showInvestorModal()">
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
        <div class="col-6 col-md-3 col-lg-2 mb-3">
          <div class="card investor-card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <div class="d-flex align-items-center">
                <div class="me-3">
                  ${investor.avatar ? `
                    <img src="${this.getOptimizedAvatarUrl(investor.avatar, 'small')}" alt="Avatar" 
                         class="rounded-circle border" 
                         style="width: 40px; height: 40px; object-fit: cover;" 
                         onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 40 40\\'><rect width=\\'40\\' height=\\'40\\' fill=\\'%23667eea\\'/><text x=\\'20\\' y=\\'25\\' text-anchor=\\'middle\\' fill=\\'white\\' font-size=\\'16\\' font-family=\\'Arial\\'>${investor.name.charAt(0).toUpperCase()}</text></svg>';" />
                  ` : `
                    <div class="rounded-circle border d-flex align-items-center justify-content-center" 
                         style="width: 40px; height: 40px; background-color: #667eea; color: white; font-weight: bold; font-size: 16px;">
                      ${investor.name.charAt(0).toUpperCase()}
                    </div>
                  `}
                </div>
                <div>
                  <h6 class="mb-0">${escapeHtml(investor.name)}</h6>
                  <small class="text-muted">ID: ${investor.investorId}</small>
                </div>
              </div>
              <div class="btn-group" role="group">
                <button class="btn btn-sm btn-outline-primary" onclick="window.investorManager.editInvestor('${investor.investorId}')" title="Edit Investor">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.investorManager.deleteInvestor('${investor.investorId}')" title="Delete Investor">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
            <div class="card-body py-2">
              ${investor.username ? `<p class="mb-1 small"><strong>Username:</strong> ${escapeHtml(investor.username)}</p>` : ''}
              ${investor.email ? `<p class="mb-1 small"><strong>Email:</strong> ${escapeHtml(investor.email)}</p>` : ''}
              ${investor.phone ? `<p class="mb-1 small"><strong>Phone:</strong> ${escapeHtml(investor.phone)}</p>` : ''}
              ${investor.fin ? `<p class="mb-1 small"><strong>FIN:</strong> ${escapeHtml(investor.fin)}</p>` : ''}
              ${investor.passport ? `<p class="mb-1 small"><strong>Passport:</strong> ${escapeHtml(investor.passport)}</p>` : ''}
              
              <hr class="my-2">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small"><strong>Properties:</strong></span>
                <span class="badge bg-primary">${totalProperties}</span>
              </div>
              
              ${totalProperties > 0 ? `
                <div class="properties-list">
                  ${investor.properties.map(property => {
                    // Look up full property details
                    const fullProperty = this.properties.find(p => 
                      p.propertyId === property.propertyId || 
                      String(p.propertyId) === String(property.propertyId)
                    );
                    
                    const displayText = fullProperty ? 
                      `${fullProperty.address || 'Address N/A'}${fullProperty.unit ? `, ${fullProperty.unit}` : ''}` :
                      property.propertyId;
                    
                    return `
                      <div class="mb-1">
                        <div class="d-flex justify-content-between align-items-start">
                          <div class="flex-grow-1 me-2">
                            <div class="small text-dark fw-medium">${displayText}</div>
                            <div class="text-muted" style="font-size: 0.75rem;">ID: ${property.propertyId}</div>
                          </div>
                          <span class="badge bg-primary">${property.percentage}%</span>
                        </div>
                      </div>
                    `;
                  }).join('')}
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
                
                <div class="row">
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">FIN Number</label>
                      <input type="text" class="form-control" name="fin" placeholder="e.g. S1234567A">
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="mb-3">
                      <label class="form-label">Passport Number</label>
                      <input type="text" class="form-control" name="passport" placeholder="e.g. E1234567">
                    </div>
                  </div>
                </div>
                
                <hr>
                <h6><i class="bi bi-person-circle me-2"></i>Avatar</h6>
                <div class="row">
                  <div class="col-md-8">
                    <div class="mb-3">
                      <label class="form-label">Avatar Image</label>
                      <div class="input-group">
                        <input type="text" class="form-control" id="investorAvatarUrl" placeholder="Paste Cloudinary URL here (Ctrl+V to paste from clipboard)">
                        <button type="button" class="btn btn-outline-secondary" onclick="window.investorManager.addAvatarFromUrl()">
                          <i class="bi bi-plus"></i> Add
                        </button>
                      </div>
                      <div class="mt-2">
                        <button type="button" class="btn btn-sm btn-primary" onclick="window.investorManager.openAvatarUpload()">
                          <i class="bi bi-cloud-upload me-1"></i>Upload Image
                        </button>
                        <small class="text-muted ms-2">or paste URL above</small>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Preview</label>
                    <div id="avatarPreview" class="text-center">
                      <div class="text-muted small">No avatar selected</div>
                    </div>
                  </div>
                </div>
                
                <!-- Hidden file input for avatar upload -->
                <input type="file" id="avatarUploadInput" accept="image/*" style="display: none;">
                
                <!-- Hidden input to store avatar URL -->
                <input type="hidden" id="investorAvatar" name="avatar" value="">
                
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
      // Reset for new investor
      this.avatar = '';
      this.updateAvatarPreview();
      this.renderPropertiesInModal([]);
    }

    // Set up clipboard paste functionality after modal is shown
    document.getElementById('investorModal').addEventListener('shown.bs.modal', () => {
      this.setupClipboardPasteForAvatar();
      // Update avatar preview after modal is fully shown
      this.updateAvatarPreview();
      // Bind modal events after modal is fully shown
      this.bindModalEvents();
    }, { once: true });

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
    form.querySelector('[name="fin"]').value = investor.fin || '';
    form.querySelector('[name="passport"]').value = investor.passport || '';

    // Handle avatar
    this.avatar = investor.avatar || '';
    this.updateAvatarPreview();

    this.renderPropertiesInModal(investor.properties || []);
  }

  renderPropertiesInModal(investorProperties = []) {
    const propertiesList = document.getElementById('propertiesList');
    if (!propertiesList) return;

    console.log("Rendering properties modal with:", {
      investorProperties,
      systemProperties: this.properties
    });

    let html = '<div class="property-investments">';
    
    // Show existing investments
    investorProperties.forEach((investment, index) => {
      const property = this.properties.find(p => 
        p.propertyId === investment.propertyId || 
        p.propertyId === String(investment.propertyId) ||
        String(p.propertyId) === String(investment.propertyId)
      );
      
      console.log(`Investment ${index}:`, { investment, foundProperty: property });
      
      html += `
        <div class="property-row mb-3 p-3 border rounded" data-index="${index}">
          <div class="row align-items-start">
            <div class="col-md-8">
              <div class="mb-2">
                <strong class="text-primary">Property ID: ${investment.propertyId}</strong>
                ${property ? `
                  <div class="p-2 bg-light rounded">
                    <div><strong>Property ID:</strong> ${escapeHtml(property.propertyId)}</div>
                    <div><strong>Address:</strong> <i class="bi bi-geo-alt me-1"></i>${escapeHtml(property.address || 'Address not available')}</div>
                    <div><strong>Unit:</strong> ${escapeHtml(property.unit || 'No unit specified')}</div>
                    <div><strong>Rent:</strong> $${property.rent || 'N/A'}</div>
                    <div><strong>Max Pax:</strong> ${property.maxPax || 'N/A'}</div>
                    ${property.agentName ? `<div><strong>Agent:</strong> ${escapeHtml(property.agentName)}</div>` : ''}
                  </div>
                ` : `
                  <div class="p-2 bg-warning bg-opacity-10 rounded">
                    <div><i class="bi bi-exclamation-triangle me-2 text-warning"></i><strong>Property Details Unavailable</strong></div>
                    <small class="text-muted">Property data could not be loaded from the system. The investment record shows Property ID: ${investment.propertyId}</small>
                  </div>
                `}
              </div>
              <input type="hidden" name="properties[${index}][propertyId]" value="${investment.propertyId}">
            </div>
            <div class="col-md-3">
              <div class="mb-2">
                <label class="form-label fw-bold text-success">Investment %</label>
                <div class="input-group">
                  <input type="number" class="form-control" name="properties[${index}][percentage]" 
                         placeholder="Percentage" min="0" max="100" step="0.1" 
                         value="${investment.percentage}" required>
                  <span class="input-group-text">%</span>
                </div>
              </div>
            </div>
            <div class="col-md-1">
              <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.property-row').remove()" title="Remove Property">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    html += '</div>';
    
    // Add informational message based on properties loading status
    if (this.properties.length === 0 && investorProperties.length === 0) {
      html += '<div class="alert alert-info mt-2"><small><i class="bi bi-info-circle me-1"></i>No properties or investments to display. Add properties to the system first, then assign them to investors.</small></div>';
    } else if (this.properties.length === 0 && investorProperties.length > 0) {
      html += '<div class="alert alert-warning mt-2"><small><i class="bi bi-exclamation-triangle me-1"></i>Unable to load property details from the system (check authentication or API connection). Investment records are preserved and shown above.</small></div>';
    }
    
    propertiesList.innerHTML = html;
  }

  bindModalEvents() {
    // Add property button - direct binding
    const addPropertyBtn = document.getElementById('addPropertyBtn');
    console.log('bindModalEvents: addPropertyBtn found:', !!addPropertyBtn);
    if (addPropertyBtn) {
      console.log('Adding click event listener to addPropertyBtn');
      addPropertyBtn.addEventListener('click', (e) => {
        console.log('Add Property button clicked!');
        e.preventDefault();
        e.stopPropagation();
        this.addPropertyRowToModal();
      });
      
      // Test button properties
      console.log('Button disabled:', addPropertyBtn.disabled);
      console.log('Button style.display:', addPropertyBtn.style.display);
      console.log('Button classList:', Array.from(addPropertyBtn.classList));
    } else {
      console.error('addPropertyBtn not found in DOM');
    }

    // Add event delegation as fallback for Add Property button
    const modal = document.getElementById('investorModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target.id === 'addPropertyBtn' || e.target.closest('#addPropertyBtn')) {
          console.log('Add Property button clicked via delegation!');
          e.preventDefault();
          e.stopPropagation();
          this.addPropertyRowToModal();
        }
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
    console.log('addPropertyRowToModal called!');
    const propertiesList = document.getElementById('propertiesList');
    console.log('propertiesList found:', !!propertiesList);
    if (!propertiesList) return;

    // Check if there are any properties available to add
    console.log('Available properties count:', this.properties.length);
    if (this.properties.length === 0) {
      console.warn('No properties available to add');
      this.showError('No properties available to add. Please add properties to the system first.');
      return;
    }

    const propertyInvestments = propertiesList.querySelector('.property-investments');
    console.log('propertyInvestments found:', !!propertyInvestments);
    if (!propertyInvestments) {
      console.log('No propertyInvestments container found, rendering new structure');
      this.renderPropertiesInModal([]);
      return;
    }

    const currentRows = propertyInvestments.querySelectorAll('.property-row');
    const nextIndex = currentRows.length;

    const newRowHtml = `
      <div class="property-row mb-3 p-3 border rounded bg-light" data-index="${nextIndex}">
        <div class="row align-items-start">
          <div class="col-md-8">
            <div class="mb-2">
              <label class="form-label fw-bold text-primary">Select Property</label>
              <select class="form-select" name="properties[${nextIndex}][propertyId]" required onchange="this.closest('.property-row').querySelector('.property-preview').style.display = this.value ? 'block' : 'none'">
                <option value="">Choose a property...</option>
                ${this.properties.map(prop => `
                  <option value="${prop.propertyId}" 
                          data-address="${prop.address || ''}" 
                          data-unit="${prop.unit || ''}" 
                          data-rent="${prop.rent || ''}">
                    ID: ${prop.propertyId} - ${prop.address || 'No address'}${prop.unit ? ', ' + prop.unit : ''} ($${prop.rent || 'N/A'})
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="property-preview mt-2" style="display: none;">
              <div class="text-muted small">
                <div><strong>Address:</strong> <span class="preview-address">-</span></div>
                <div><strong>Unit:</strong> <span class="preview-unit">-</span></div>
              </div>
            </div>
          </div>
          <div class="col-md-3">
            <div class="mb-2">
              <label class="form-label fw-bold text-success">Investment %</label>
              <div class="input-group">
                <input type="number" class="form-control" name="properties[${nextIndex}][percentage]" 
                       placeholder="0.0" min="0" max="100" step="0.1" required>
                <span class="input-group-text">%</span>
              </div>
            </div>
          </div>
          <div class="col-md-1">
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.property-row').remove()" title="Remove Property">
              <i class="bi bi-trash"></i>
            </button>
          </div>
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
        fin: formData.get('fin'),
        passport: formData.get('passport'),
        avatar: this.avatar || null,
        properties: []
      };
      
      console.log("Saving investor data:", investorData);

      // Collect property investments
      const propertyRows = form.querySelectorAll('.property-row');
      console.log("Found property rows:", propertyRows.length);
      
      propertyRows.forEach((row, index) => {
        const selectElement = row.querySelector('select[name*="propertyId"]');
        const hiddenElement = row.querySelector('input[name*="propertyId"][type="hidden"]');
        const propertyId = selectElement ? selectElement.value : (hiddenElement ? hiddenElement.value : null);
        const percentage = parseFloat(row.querySelector('input[type="number"]').value);
        
        console.log(`Row ${index}:`, { propertyId, percentage, hasSelect: !!selectElement, hasHidden: !!hiddenElement });
        
        if (propertyId && !isNaN(percentage)) {
          investorData.properties.push({
            propertyId,
            percentage
          });
        }
      });

      console.log("Final investor data to save:", investorData);

      if (this.editingInvestorId) {
        // Update existing investor
        console.log("Updating investor with ID:", this.editingInvestorId);
        const response = await API.put(
          API_CONFIG.ENDPOINTS.INVESTOR_BY_ID(this.editingInvestorId),
          investorData
        );
        
        console.log("Update response status:", response.status);
        const result = await response.json();
        console.log("Update result:", result);

        if (!response.ok || !result.success) {
          throw new Error(result.message || `API returned ${response.status}: ${response.statusText}`);
        }

        this.showSuccess('Investor updated successfully');
      } else {
        // Create new investor
        const investorId = await this.generateInvestorId();
        const newInvestor = {
          investorId,
          ...investorData
        };

        console.log("Creating new investor:", newInvestor);
        const response = await API.post(API_CONFIG.ENDPOINTS.INVESTORS, newInvestor);
        
        console.log("Create response status:", response.status);
        const result = await response.json();
        console.log("Create result:", result);

        if (!response.ok || !result.success) {
          throw new Error(result.message || `API returned ${response.status}: ${response.statusText}`);
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

  // Avatar upload methods
  openAvatarUpload() {
    const fileInput = document.getElementById('avatarUploadInput');
    fileInput.click();
    
    // Add event listener for file selection
    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        this.uploadAvatar(e.target.files[0]);
      }
    };
  }

  async uploadAvatar(file) {
    const uploadButton = document.querySelector("button[onclick=\"window.investorManager.openAvatarUpload()\"]");
    const originalText = uploadButton.innerHTML;
    
    try {
      // Show loading state
      uploadButton.disabled = true;
      uploadButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading avatar...';
      
      const result = await this.uploadSingleImage(file);
      
      if (result.success) {
        console.log('🔗 Avatar uploaded successfully:', result.url);
        
        // Ensure URL is properly formatted
        let imageUrl = result.url;
        if (imageUrl && !imageUrl.startsWith('http')) {
          // If it's a relative URL starting with /, prepend the API base URL
          if (imageUrl.startsWith('/')) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            // Otherwise assume it needs https:// prefix
            imageUrl = 'https://' + imageUrl;
          }
        }
        
        this.avatar = imageUrl;
        this.updateAvatarPreview();
        
        console.log('✅ Avatar set to:', this.avatar);
      } else {
        alert('Failed to upload avatar: ' + result.error);
      }
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert('Error uploading avatar. Please try again.');
    } finally {
      // Restore button state
      uploadButton.disabled = false;
      uploadButton.innerHTML = originalText;
    }
  }

  async uploadSingleImage(file) {
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const uploadUrl = buildApiUrl(API_CONFIG.ENDPOINTS.UPLOAD_TENANT_DOCUMENT);
      console.log('🔧 Upload URL:', uploadUrl);
      console.log('🔧 Base URL:', API_CONFIG.BASE_URL);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: formData
      });
      
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  addAvatarFromUrl() {
    const urlInput = document.getElementById('investorAvatarUrl');
    const url = urlInput.value.trim();
    
    if (!url) {
      alert('Please enter a valid image URL');
      return;
    }
    
    this.avatar = url;
    this.updateAvatarPreview();
    urlInput.value = ''; // Clear input after adding
    
    console.log('✅ Avatar set from URL:', this.avatar);
  }

  removeAvatar() {
    this.avatar = '';
    this.updateAvatarPreview();
    console.log('🗑️ Avatar removed');
  }

  updateAvatarPreview() {
    const preview = document.getElementById('avatarPreview');
    const hiddenInput = document.getElementById('investorAvatar');
    
    if (!preview || !hiddenInput) {
      return;
    }
    
    // Update hidden input
    hiddenInput.value = this.avatar;
    
    if (!this.avatar) {
      preview.innerHTML = '<div class="text-muted small">No avatar selected</div>';
      return;
    }
    
    preview.innerHTML = `
      <div class="position-relative d-inline-block">
        <img src="${this.getOptimizedAvatarUrl(this.avatar, 'medium')}" alt="Avatar preview" 
             class="rounded-circle border" 
             style="width: 80px; height: 80px; object-fit: cover; cursor: pointer;" 
             onclick="window.open('${this.normalizeImageUrl(this.avatar)}', '_blank')" />
        <button type="button" 
                class="btn btn-danger position-absolute top-0 end-0"
                onclick="window.investorManager.removeAvatar()"
                style="padding: 2px; font-size: 0.7rem; border-radius: 50%; width: 24px; height: 24px; display: flex !important; align-items: center; justify-content: center; transform: translate(25%, -25%);"
                title="Remove avatar">
          ✕
        </button>
        <div class="text-center mt-2">
          <small class="text-muted">Avatar Preview</small>
        </div>
      </div>
    `;
  }

  // Use global image utilities
  normalizeImageUrl(url) {
    return ImageUtils.normalizeImageUrl(url);
  }

  getOptimizedAvatarUrl(url, size = 'small') {
    return ImageUtils.getOptimizedImageUrl(url, size);
  }

  // Clipboard paste functionality
  setupClipboardPasteForAvatar() {
    const avatarUrlField = document.getElementById('investorAvatarUrl');
    if (avatarUrlField && !avatarUrlField.hasAttribute('data-paste-listener-added')) {
      avatarUrlField.setAttribute('data-paste-listener-added', 'true');
      
      // Add paste event listener
      avatarUrlField.addEventListener('paste', async (e) => {
        e.preventDefault();
        await this.handleImagePaste(e);
      });

      // Add visual feedback for paste capability
      const currentPlaceholder = avatarUrlField.placeholder || 'Paste Cloudinary URL here';
      if (!currentPlaceholder.includes('Ctrl+V')) {
        avatarUrlField.placeholder = currentPlaceholder + ' (Ctrl+V to paste from clipboard)';
      }
      avatarUrlField.title = 'You can paste images from clipboard here (Ctrl+V)';
      
      // Add a visual indicator
      avatarUrlField.style.borderLeft = '3px solid #0d6efd';
      avatarUrlField.setAttribute('data-clipboard-enabled', 'true');
      
      console.log('✅ Clipboard paste listener added to investor avatar field');
    }
  }

  async handleImagePaste(event) {
    try {
      const items = (event.clipboardData || event.originalEvent?.clipboardData)?.items;
      if (!items) {
        console.log('No clipboard items found');
        return;
      }

      let imageFound = false;
      
      // Check all clipboard items for images
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.type.indexOf('image') !== -1) {
          imageFound = true;
          const file = item.getAsFile();
          
          if (file) {
            console.log('📋 Image pasted from clipboard to investorAvatarUrl:', file.name, file.type);
            await this.uploadClipboardImage(file, 'investorAvatarUrl');
            break; // Handle only the first image found
          }
        }
      }

      if (!imageFound) {
        // Check if there's text content that might be an image URL
        const text = event.clipboardData?.getData('text') || event.originalEvent?.clipboardData?.getData('text');
        if (text && this.isImageUrl(text)) {
          console.log('📋 Image URL pasted from clipboard:', text);
          document.getElementById('investorAvatarUrl').value = text;
        } else {
          console.log('No image found in clipboard');
          // Show a brief message to user
          this.showPasteMessage('investorAvatarUrl', 'No image found in clipboard', 'warning');
        }
      }
    } catch (error) {
      console.error('Error handling clipboard paste:', error);
      this.showPasteMessage('investorAvatarUrl', 'Error pasting from clipboard', 'error');
    }
  }

  async uploadClipboardImage(file, fieldId) {
    const field = document.getElementById(fieldId);
    const originalPlaceholder = field.placeholder;
    
    try {
      // Show uploading state
      field.placeholder = 'Uploading image from clipboard...';
      field.disabled = true;

      // Upload the image using existing upload method
      const result = await this.uploadSingleImage(file);
      
      if (result.success) {
        // Ensure URL is properly formatted (exact same logic as tenant management)
        let imageUrl = result.url;
        if (imageUrl && !imageUrl.startsWith('http')) {
          if (imageUrl.startsWith('/')) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            imageUrl = 'https://' + imageUrl;
          }
        }

        // Set the URL in the input field
        field.value = imageUrl;
        
        // Auto-add the avatar (exact same pattern as tenant management)
        if (fieldId === 'investorAvatarUrl') {
          this.addAvatarFromUrl();
        }

        this.showPasteMessage(fieldId, 'Image uploaded successfully!', 'success');
        console.log(`✅ Clipboard image uploaded successfully to ${fieldId}:`, imageUrl);
      } else {
        this.showPasteMessage(fieldId, 'Failed to upload image: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error uploading clipboard image:', error);
      this.showPasteMessage(fieldId, 'Error uploading image', 'error');
    } finally {
      // Restore field state
      field.placeholder = originalPlaceholder;
      field.disabled = false;
    }
  }

  isImageUrl(url) {
    // Simple check for image URL patterns
    return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url) || 
           url.includes('cloudinary.com') || 
           url.includes('imgur.com') ||
           url.includes('drive.google.com');
  }

  showPasteMessage(fieldId, message, type) {
    // Create a temporary message element
    const field = document.getElementById(fieldId);
    const messageId = `paste-message-${fieldId}`;
    
    // Remove any existing message
    const existingMessage = document.getElementById(messageId);
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'danger'} alert-dismissible fade show mt-2`;
    messageDiv.style.fontSize = '0.875rem';
    messageDiv.innerHTML = `
      <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'x-circle'} me-1"></i>
      ${message}
    `;

    // Insert after the field's parent div
    field.closest('.mb-3').insertAdjacentElement('afterend', messageDiv);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 3000);
  }

}

// Make component globally accessible
window.InvestorManagementComponent = InvestorManagementComponent;