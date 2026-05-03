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

      // Fetch all properties with pagination
      let allProperties = [];
      let currentPage = 1;
      const itemsPerPage = 50;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${currentPage}&limit=${itemsPerPage}&includeArchived=true`);

        if (!response.ok) {
          console.warn(`Properties API returned ${response.status}: ${response.statusText}`);
          if (response.status === 401 || response.status === 403) {
            console.warn("Authentication required for properties API");
          }
          hasMorePages = false;
          continue;
        }

        const result = await response.json();

        if (result.success && Array.isArray(result.properties)) {
          allProperties = allProperties.concat(result.properties);
          hasMorePages = result.pagination && currentPage < result.pagination.totalPages;
          currentPage++;
        } else {
          console.warn("Properties API response format issue:", result);
          hasMorePages = false;
        }
      }

      this.properties = allProperties;
      console.log(`Loaded ${this.properties.length} properties:`, this.properties);
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

    let html = `
      <div class="d-flex justify-content-end mb-3">
        <button class="btn btn-outline-secondary btn-sm" id="exportInvestorReportBtn" onclick="window.investorManager.exportInvestorReport()">
          <i class="bi bi-download me-1"></i>Export Portfolio Report
        </button>
      </div>
      <div class="row">
    `;
    
    this.investors.forEach((investor) => {
      const activeInvestorProperties = (investor.properties || []).filter(prop => {
        const full = this.properties.find(p =>
          p.propertyId === prop.propertyId || String(p.propertyId) === String(prop.propertyId)
        );
        return !full || !full.isArchived;
      });
      const totalProperties = activeInvestorProperties.length;
      const totalPercentage = activeInvestorProperties.reduce((sum, prop) => sum + prop.percentage, 0);

      html += `
        <div class="col-12 col-md-6 col-lg-4 col-xl-3 mb-3">
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
                <button class="btn btn-sm btn-outline-secondary" onclick="window.investorManager.exportInvestorReport('${investor.investorId}')" title="Export Report">
                  <i class="bi bi-download"></i>
                </button>
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
                  ${activeInvestorProperties.map(property => {
                    // Look up full property details
                    const fullProperty = this.properties.find(p =>
                      p.propertyId === property.propertyId ||
                      String(p.propertyId) === String(property.propertyId)
                    );

                    const displayText = fullProperty ?
                      `${fullProperty.address || 'Address N/A'}${fullProperty.unit ? `, ${fullProperty.unit}` : ''}` :
                      property.propertyId;

                    const hasHistory = property.history && property.history.length > 0;

                    return `
                      <div class="mb-2 p-2 border rounded bg-light">
                        <div class="d-flex justify-content-between align-items-start">
                          <div class="flex-grow-1 me-2">
                            <div class="small text-dark fw-medium">${displayText}</div>
                            <div class="text-muted" style="font-size: 0.75rem;">ID: ${property.propertyId}</div>
                          </div>
                          <div class="d-flex align-items-center gap-1">
                            <span class="badge bg-primary">${property.percentage}%</span>
                            <button class="btn btn-sm btn-outline-secondary p-1"
                                    onclick="window.investorManager.showChangePercentageModal('${investor.investorId}', '${property.propertyId}')"
                                    title="Change Percentage">
                              <i class="bi bi-pencil-square" style="font-size: 0.7rem;"></i>
                            </button>
                          </div>
                        </div>
                        ${hasHistory ? `
                          <div class="mt-1">
                            <button class="btn btn-link btn-sm p-0 text-muted"
                                    onclick="window.investorManager.togglePercentageHistory(this, '${investor.investorId}', '${property.propertyId}')"
                                    style="font-size: 0.7rem;">
                              <i class="bi bi-clock-history me-1"></i>View history
                            </button>
                            <div class="percentage-history-container" style="display: none;"></div>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
                <div class="mt-2 pt-2 border-top">
                  <div class="d-flex justify-content-between align-items-center p-2 rounded" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <span class="text-white fw-semibold">Total Investment:</span>
                    <span class="badge bg-white text-primary fw-bold fs-6">${totalPercentage}%</span>
                  </div>
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
                ${this.properties.filter(p => !p.isArchived).map(prop => `
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

  showChangePercentageModal(investorId, propertyId) {
    const investor = this.investors.find(inv => inv.investorId === investorId);
    if (!investor) return;

    const property = investor.properties.find(p => p.propertyId === propertyId);
    if (!property) return;

    const fullProperty = this.properties.find(p =>
      p.propertyId === propertyId || String(p.propertyId) === String(propertyId)
    );

    const displayText = fullProperty ?
      `${fullProperty.address || 'Address N/A'}${fullProperty.unit ? `, ${fullProperty.unit}` : ''}` :
      propertyId;

    // Get the first of current month as default effective date
    const now = new Date();
    const defaultDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    const modalHtml = `
      <div class="modal fade" id="changePercentageModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-percent me-2"></i>Change Investment Percentage
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form id="changePercentageForm">
              <div class="modal-body">
                <div class="mb-3">
                  <label class="form-label text-muted">Investor</label>
                  <div class="fw-bold">${escapeHtml(investor.name)}</div>
                </div>
                <div class="mb-3">
                  <label class="form-label text-muted">Property</label>
                  <div class="fw-bold">${displayText}</div>
                  <small class="text-muted">ID: ${propertyId}</small>
                </div>
                <hr>
                <div class="mb-3">
                  <label class="form-label">Current Percentage</label>
                  <div class="input-group">
                    <input type="text" class="form-control" value="${property.percentage}" disabled>
                    <span class="input-group-text">%</span>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">New Percentage <span class="text-danger">*</span></label>
                  <div class="input-group">
                    <input type="number" class="form-control" name="newPercentage"
                           min="0" max="100" step="0.1" required
                           placeholder="Enter new percentage">
                    <span class="input-group-text">%</span>
                  </div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Effective From <span class="text-danger">*</span></label>
                  <input type="date" class="form-control" name="effectiveFrom"
                         value="${defaultDate}" required>
                  <small class="text-muted">Select the 1st of the month when this percentage should take effect</small>
                </div>
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-triangle me-2"></i>
                  <strong>Note:</strong> This change will affect financial reports from the effective date onwards.
                  Past closed reports will not be affected.
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary">
                  <i class="bi bi-check-circle me-1"></i>Update Percentage
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('changePercentageModal'));

    // Form submission
    document.getElementById('changePercentageForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.updatePropertyPercentage(investorId, propertyId, e.target);
      modal.hide();
    });

    // Clean up on close
    document.getElementById('changePercentageModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('changePercentageModal').remove();
    });

    modal.show();
  }

  async updatePropertyPercentage(investorId, propertyId, form) {
    const formData = new FormData(form);
    const newPercentage = parseFloat(formData.get('newPercentage'));
    const effectiveFrom = formData.get('effectiveFrom');

    if (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100) {
      this.showError('Please enter a valid percentage between 0 and 100');
      return;
    }

    if (!effectiveFrom) {
      this.showError('Please select an effective date');
      return;
    }

    try {
      const response = await API.put(
        `${API_CONFIG.ENDPOINTS.INVESTORS}/${investorId}/properties/${propertyId}/percentage`,
        {
          percentage: newPercentage,
          effectiveFrom: effectiveFrom
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update percentage');
      }

      this.showSuccess(`Percentage updated to ${newPercentage}% effective from ${effectiveFrom}`);
      await this.loadData();

    } catch (error) {
      console.error('Error updating percentage:', error);
      this.showError(error.message || 'Failed to update percentage');
    }
  }

  async togglePercentageHistory(button, investorId, propertyId) {
    const container = button.nextElementSibling;
    if (!container) return;

    if (container.style.display === 'none') {
      // Load and show history
      container.innerHTML = '<div class="text-muted small py-2">Loading history...</div>';
      container.style.display = 'block';
      button.innerHTML = '<i class="bi bi-clock-history me-1"></i>Hide history';

      try {
        const response = await API.get(
          `${API_CONFIG.ENDPOINTS.INVESTORS}/${investorId}/properties/${propertyId}/history`
        );
        const result = await response.json();

        if (result.success && result.data && result.data.history) {
          const history = result.data.history;
          if (history.length === 0) {
            container.innerHTML = '<div class="text-muted small py-2">No history available</div>';
          } else {
            // Sort by effectiveFrom descending (newest first)
            const sortedHistory = [...history].sort((a, b) =>
              new Date(b.effectiveFrom) - new Date(a.effectiveFrom)
            );

            container.innerHTML = `
              <div class="mt-2 ps-2 border-start border-primary" style="font-size: 0.75rem;">
                ${sortedHistory.map((entry, index) => {
                  const fromDate = new Date(entry.effectiveFrom).toLocaleDateString();
                  const toDate = entry.effectiveTo
                    ? new Date(entry.effectiveTo).toLocaleDateString()
                    : null;
                  const isCurrent = !entry.effectiveTo;

                  return `
                    <div class="mb-1 ${isCurrent ? 'fw-bold text-primary' : 'text-muted'}">
                      <i class="bi bi-${isCurrent ? 'circle-fill' : 'circle'} me-1" style="font-size: 0.5rem;"></i>
                      ${entry.percentage}% from ${fromDate}${toDate ? ` to ${toDate}` : ' (current)'}
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }
        } else {
          container.innerHTML = '<div class="text-muted small py-2">Unable to load history</div>';
        }
      } catch (error) {
        console.error('Error loading percentage history:', error);
        container.innerHTML = '<div class="text-danger small py-2">Error loading history</div>';
      }
    } else {
      // Hide history
      container.style.display = 'none';
      button.innerHTML = '<i class="bi bi-clock-history me-1"></i>View history';
    }
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

  // ─── Investor Portfolio Export ───────────────────────────────────────────

  async exportInvestorReport(investorId = null) {
    // When called from a single card, the btn is the card's download icon — we can't
    // easily grab it, so just show a toast spinner via the "all" button if no id given.
    const allBtn = document.getElementById('exportInvestorReportBtn');
    const isSingle = !!investorId;

    if (!isSingle && allBtn) {
      allBtn.disabled = true;
      allBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generating…';
    }

    try {
      const targetInvestors = isSingle
        ? this.investors.filter(i => i.investorId === investorId)
        : this.investors;

      const allAvatarUrls = targetInvestors.filter(i => i.avatar).map(i => i.avatar);
      const avatarMap = await this._fetchImagesAsBase64(allAvatarUrls);

      const svg = this._generateInvestorReportSVG(avatarMap, {}, targetInvestors);
      const blob = await this._invSvgToPngBlob(svg);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toLocaleDateString('en-SG').replace(/\//g, '-');
      const namePart = isSingle
        ? (targetInvestors[0]?.name || investorId).replace(/\s+/g, '_')
        : 'All';
      a.download = `Investor_Portfolio_${namePart}_${dateStr}.png`;
      a.click();
      URL.revokeObjectURL(url);

      if (typeof showToast === 'function') showToast('Portfolio report downloaded!', 'success');
    } catch (err) {
      console.error('Export investor report error:', err);
      if (typeof showToast === 'function') showToast('Failed to export report', 'error');
    } finally {
      if (!isSingle && allBtn) {
        allBtn.disabled = false;
        allBtn.innerHTML = '<i class="bi bi-download me-1"></i>Export Portfolio Report';
      }
    }
  }

  _generateInvestorReportSVG(avatarMap = {}, _propertyImageMap = {}, targetInvestors = null) {
    const investorList = targetInvestors || this.investors;
    const W = 820;
    const PAD = 28;
    const REPORT_HDR_H = 44;
    const INV_HDR_H = 58;
    const TBL_HDR_H = 24;
    const BASE_ROW_H = 32;
    const TALL_ROW_H = 46; // address needs 2 lines
    const TOTAL_ROW_H = 32;
    const SEC_GAP = 16;

    // Column layout
    const C_ID_X  = PAD,        C_ID_W  = 44;
    const C_ADDR_X = C_ID_X + C_ID_W + 10, C_ADDR_W = 380;
    const C_UNIT_X = C_ADDR_X + C_ADDR_W + 10, C_UNIT_W = 120;
    const C_PCT_X  = C_UNIT_X + C_UNIT_W + 10, C_PCT_W  = W - PAD - (C_UNIT_X + C_UNIT_W + 10);

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Address wrapping — split at ~54 chars on a space boundary
    const splitAddr = (addr) => {
      if (!addr || addr.length <= 54) return [addr || '', ''];
      const cut = addr.lastIndexOf(' ', 54);
      const breakAt = cut > 20 ? cut : 54;
      return [addr.substring(0, breakAt), addr.substring(breakAt).trim()];
    };

    // ── Pre-compute layout ──────────────────────────────────────────────────
    let y = REPORT_HDR_H;
    const sections = [];

    for (const investor of investorList) {
      const activeProps = (investor.properties || []).filter(prop => {
        const full = this.properties.find(p =>
          p.propertyId === prop.propertyId || String(p.propertyId) === String(prop.propertyId)
        );
        return !full || !full.isArchived;
      });

      const startY = y;
      y += INV_HDR_H + TBL_HDR_H;

      const propRows = activeProps.map(prop => {
        const fullProp = this.properties.find(p =>
          p.propertyId === prop.propertyId || String(p.propertyId) === String(prop.propertyId)
        );
        const address = fullProp?.address || String(prop.propertyId);
        const [a1, a2] = splitAddr(address);
        const rowH = a2 ? TALL_ROW_H : BASE_ROW_H;
        const rowY = y;
        y += rowH;
        return { prop, fullProp, a1, a2, rowH, rowY };
      });

      const totalRowY = y;
      y += TOTAL_ROW_H + SEC_GAP;
      sections.push({ investor, activeProps, startY, propRows, totalRowY });
    }

    const totalH = y + 28;
    const now = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });

    // ── Defs (avatar clip paths only) ───────────────────────────────────────
    const AV = 38;
    let defs = '<defs>';
    sections.forEach((sec, si) => {
      const cx = PAD + AV / 2;
      const cy = sec.startY + INV_HDR_H / 2;
      defs += `<clipPath id="inv-av-${si}"><circle cx="${cx}" cy="${cy}" r="${AV / 2}"/></clipPath>`;
    });
    defs += '</defs>';

    // ── Body ────────────────────────────────────────────────────────────────
    let body = '';
    body += `<rect width="${W}" height="${totalH}" fill="#ffffff"/>`;

    // Compact header strip
    body += `<rect width="${W}" height="${REPORT_HDR_H}" fill="#263238"/>`;
    body += `<text x="${PAD}" y="28" font-size="15" font-weight="bold" fill="white">Investor Portfolio Report</text>`;
    body += `<text x="${W - PAD}" y="28" font-size="10" fill="#90a4ae" text-anchor="end">Generated ${esc(now)}</text>`;

    const ACCENT = ['#1565c0','#00695c','#4527a0','#558b2f','#e65100','#b71c1c','#37474f'];
    const accentFor = (name) => ACCENT[(name || '').split('').reduce((h, c) => h + c.charCodeAt(0), 0) % ACCENT.length];

    sections.forEach((sec, si) => {
      const { investor, activeProps, startY, propRows, totalRowY } = sec;
      const totalPct = activeProps.reduce((s, p) => s + p.percentage, 0);
      const icolor = accentFor(investor.name);
      const avatarB64 = investor.avatar ? (avatarMap[investor.avatar] || null) : null;
      const initial = (investor.name || '?').charAt(0).toUpperCase();
      const cx = PAD + AV / 2, cy = startY + INV_HDR_H / 2;

      // Investor header
      body += `<rect x="0" y="${startY}" width="${W}" height="${INV_HDR_H}" fill="#f5f5f5"/>`;
      body += `<rect x="0" y="${startY}" width="5" height="${INV_HDR_H + TBL_HDR_H + propRows.reduce((s,r)=>s+r.rowH,0) + TOTAL_ROW_H}" fill="${icolor}"/>`;
      body += `<line x1="0" y1="${startY}" x2="${W}" y2="${startY}" stroke="#e0e0e0" stroke-width="1"/>`;

      // Avatar
      if (avatarB64) {
        body += `<image href="${avatarB64}" x="${PAD}" y="${cy - AV/2}" width="${AV}" height="${AV}" clip-path="url(#inv-av-${si})" preserveAspectRatio="xMidYMid slice"/>`;
      } else {
        body += `<circle cx="${cx}" cy="${cy}" r="${AV/2}" fill="${icolor}"/>`;
        body += `<text x="${cx}" y="${cy + 6}" font-size="16" font-weight="bold" fill="white" text-anchor="middle">${esc(initial)}</text>`;
      }

      // Name + meta
      const tx = PAD + AV + 12;
      body += `<text x="${tx}" y="${startY + 22}" font-size="15" font-weight="bold" fill="#212121">${esc(investor.name)}</text>`;
      const metaParts = [`ID: ${investor.investorId}`, `${activeProps.length} propert${activeProps.length !== 1 ? 'ies' : 'y'}`];
      if (investor.email) metaParts.push(investor.email);
      body += `<text x="${tx}" y="${startY + 40}" font-size="11" fill="#757575">${esc(metaParts.join('  ·  '))}</text>`;

      // Total ownership badge (right, prominent)
      const badgeW = 96, badgeH = 40, badgeX = W - PAD - badgeW, badgeY = startY + (INV_HDR_H - badgeH) / 2;
      body += `<rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="6" fill="${icolor}"/>`;
      body += `<text x="${badgeX + badgeW/2}" y="${badgeY + 13}" font-size="9" fill="rgba(255,255,255,0.75)" text-anchor="middle">TOTAL OWNED</text>`;
      body += `<text x="${badgeX + badgeW/2}" y="${badgeY + 31}" font-size="20" font-weight="bold" fill="white" text-anchor="middle">${totalPct}%</text>`;

      // Table header
      const tHdrY = startY + INV_HDR_H;
      body += `<rect x="0" y="${tHdrY}" width="${W}" height="${TBL_HDR_H}" fill="#eceff1"/>`;
      body += `<text x="${C_ID_X + C_ID_W/2}" y="${tHdrY + 16}" font-size="9" font-weight="bold" fill="#546e7a" text-anchor="middle">ID</text>`;
      body += `<text x="${C_ADDR_X}" y="${tHdrY + 16}" font-size="9" font-weight="bold" fill="#546e7a">ADDRESS</text>`;
      body += `<text x="${C_UNIT_X}" y="${tHdrY + 16}" font-size="9" font-weight="bold" fill="#546e7a">UNIT</text>`;
      body += `<text x="${C_PCT_X + C_PCT_W/2}" y="${tHdrY + 16}" font-size="9" font-weight="bold" fill="#546e7a" text-anchor="middle">SHARE %</text>`;

      if (activeProps.length === 0) {
        body += `<text x="${C_ADDR_X}" y="${tHdrY + TBL_HDR_H + 22}" font-size="12" fill="#bdbdbd" font-style="italic">No active properties</text>`;
      }

      // Property rows
      propRows.forEach(({ prop, fullProp, a1, a2, rowH, rowY }, pi) => {
        const bg = pi % 2 === 0 ? '#ffffff' : '#fafafa';
        body += `<rect x="5" y="${rowY}" width="${W - 5}" height="${rowH}" fill="${bg}"/>`;
        body += `<line x1="${PAD}" y1="${rowY + rowH}" x2="${W - PAD}" y2="${rowY + rowH}" stroke="#eeeeee" stroke-width="1"/>`;

        const midY = rowY + rowH / 2;

        // Property ID
        body += `<text x="${C_ID_X + C_ID_W/2}" y="${midY + 4}" font-size="11" fill="#9e9e9e" text-anchor="middle">${esc(String(prop.propertyId))}</text>`;

        // Address (1 or 2 lines)
        if (a2) {
          body += `<text x="${C_ADDR_X}" y="${rowY + 16}" font-size="11" font-weight="bold" fill="#212121">${esc(a1)}</text>`;
          body += `<text x="${C_ADDR_X}" y="${rowY + 30}" font-size="11" fill="#424242">${esc(a2)}</text>`;
        } else {
          body += `<text x="${C_ADDR_X}" y="${midY + 4}" font-size="11" font-weight="bold" fill="#212121">${esc(a1)}</text>`;
        }

        // Unit
        const unit = fullProp?.unit || '—';
        body += `<text x="${C_UNIT_X}" y="${midY + 4}" font-size="11" fill="#616161">${esc(unit)}</text>`;

        // Percentage pill
        const pctStr = `${prop.percentage}%`;
        const pW = Math.max(44, pctStr.length * 9 + 14);
        const pX = C_PCT_X + (C_PCT_W - pW) / 2;
        body += `<rect x="${pX}" y="${midY - 12}" width="${pW}" height="24" rx="12" fill="${icolor}"/>`;
        body += `<text x="${pX + pW/2}" y="${midY + 4}" font-size="13" font-weight="bold" fill="white" text-anchor="middle">${esc(pctStr)}</text>`;
      });

      // Total row
      body += `<rect x="5" y="${totalRowY}" width="${W - 5}" height="${TOTAL_ROW_H}" fill="#eceff1"/>`;
      body += `<text x="${C_ADDR_X}" y="${totalRowY + 20}" font-size="12" font-weight="bold" fill="#263238">Total</text>`;
      body += `<text x="${C_UNIT_X}" y="${totalRowY + 20}" font-size="11" fill="#78909c">${activeProps.length} propert${activeProps.length !== 1 ? 'ies' : 'y'}</text>`;
      const tStr = `${totalPct}%`;
      const tW = Math.max(52, tStr.length * 9 + 14);
      const tX = C_PCT_X + (C_PCT_W - tW) / 2;
      body += `<rect x="${tX}" y="${totalRowY + 4}" width="${tW}" height="24" rx="12" fill="${icolor}"/>`;
      body += `<text x="${tX + tW/2}" y="${totalRowY + 20}" font-size="13" font-weight="bold" fill="white" text-anchor="middle">${esc(tStr)}</text>`;
    });

    // Footer
    body += `<line x1="0" y1="${totalH - 20}" x2="${W}" y2="${totalH - 20}" stroke="#eeeeee" stroke-width="1"/>`;
    body += `<text x="${W/2}" y="${totalH - 8}" font-size="9" fill="#bdbdbd" text-anchor="middle">Rental Management Platform · Auto-generated investor portfolio report</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${totalH}" font-family="Arial, Helvetica, sans-serif">${defs}${body}</svg>`;
  }

  async _fetchImagesAsBase64(urls) {
    const map = {};
    await Promise.allSettled(
      [...new Set(urls)].map(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const blob = await res.blob();
          await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => { map[url] = reader.result; resolve(); };
            reader.readAsDataURL(blob);
          });
        } catch { /* skip — use placeholder */ }
      })
    );
    return map;
  }

  _invSvgToPngBlob(svgString) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(resolve, 'image/png');
      };
      img.onerror = reject;
      img.src = url;
    });
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