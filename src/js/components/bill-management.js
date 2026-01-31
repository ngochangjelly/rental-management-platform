import { getRoomTypeDisplayName } from '../utils/room-type-mapper.js';

/**
 * Bill Management Component
 * Manages monthly bills for properties with tenant bill tracking and upload management
 */
class BillManagementComponent {
  constructor() {
    this.selectedProperty = null;
    this.currentDate = new Date();
    this.properties = [];
    this.currentBill = null;
    this.selectedTenants = new Set();
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadProperties();
  }

  bindEvents() {
    // Month navigation
    const prevMonthBtn = document.getElementById('billPrevMonth');
    const nextMonthBtn = document.getElementById('billNextMonth');

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => this.changeMonth(-1));
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => this.changeMonth(1));
    }

    // Generate bill button
    const generateBillBtn = document.getElementById('generateBillBtn');
    if (generateBillBtn) {
      generateBillBtn.addEventListener('click', () => this.showGenerateBillModal());
    }

    // Update fees button
    const updateFeesBtn = document.getElementById('updateFeesBtn');
    if (updateFeesBtn) {
      updateFeesBtn.addEventListener('click', () => this.showUpdateFeesModal());
    }

    // Bulk delete button
    const bulkDeleteBtn = document.getElementById('bulkDeleteUploadsBtn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', () => this.bulkDeleteUploads());
    }

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllTenants');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
    }
  }

  async loadProperties() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
      const result = await response.json();

      if (result.success) {
        this.properties = result.properties || [];
        this.renderPropertyCards(result.properties);
      } else {
        console.error('Failed to load properties:', result.error);
        this.renderPropertyCards([]);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      this.renderPropertyCards([]);
    }
  }

  renderPropertyCards(properties) {
    const container = document.getElementById('billPropertyCards');
    if (!container) return;

    container.innerHTML = '';

    if (!properties || properties.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-building-slash me-2"></i>
          No properties available
        </div>
      `;
      return;
    }

    properties.forEach(property => {
      const isSelected = this.selectedProperty === property.propertyId;
      const cardHtml = `
        <div class="col-12 col-sm-6 col-md-4 col-lg-3 col-xl-2 mb-3">
          <div class="card property-card h-100 ${isSelected ? 'border-primary' : ''} overflow-hidden"
               style="cursor: pointer; transition: all 0.2s ease;"
               onclick="billManager.selectProperty('${property.propertyId}')">
            ${property.propertyImage ? `
            <div class="card-img-top position-relative" style="height: 160px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;">
              ${isSelected ? '<div class="position-absolute top-0 end-0 p-2"><i class="bi bi-check-circle-fill text-success bg-white rounded-circle" style="font-size: 1.5rem;"></i></div>' : ''}
            </div>
            ` : ''}
            <div class="card-header d-flex justify-content-between align-items-center bg-white">
              <div class="d-flex align-items-center">
                <div class="me-3">
                  <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white"
                       style="width: 40px; height: 40px; font-size: 16px; font-weight: bold;">
                    ${escapeHtml(property.propertyId.substring(0, 2).toUpperCase())}
                  </div>
                </div>
                <div>
                  <h6 class="mb-0 fw-bold">${escapeHtml(property.propertyId)}</h6>
                  <small class="text-muted">Property ID</small>
                </div>
              </div>
              ${!property.propertyImage && isSelected ? '<i class="bi bi-check-circle-fill text-success" style="font-size: 1.2rem;"></i>' : ''}
            </div>
            <div class="card-body py-2 bg-white">
              <p class="mb-1 small"><strong>Address:</strong> ${escapeHtml(property.address)}</p>
              <p class="mb-1 small"><strong>Unit:</strong> ${escapeHtml(property.unit)}</p>
            </div>
          </div>
        </div>
      `;
      container.innerHTML += cardHtml;
    });

    this.addPropertyCardStyles();
  }

  addPropertyCardStyles() {
    if (!document.getElementById('bill-property-card-styles')) {
      const style = document.createElement('style');
      style.id = 'bill-property-card-styles';
      style.textContent = `
        .property-card {
          min-height: 200px;
          overflow: hidden;
        }
        .property-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.15) !important;
        }
        .property-card.border-primary {
          border-width: 3px !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  async selectProperty(propertyId) {
    console.log('🏢 Selecting property:', propertyId);
    if (this.selectedProperty === propertyId) {
      console.log('⏭️  Property already selected, skipping');
      return;
    }

    this.selectedProperty = propertyId;
    console.log('✅ Property selected:', this.selectedProperty);
    this.updatePropertyCardSelection(propertyId);
    await this.loadBillForCurrentMonth();
  }

  updatePropertyCardSelection(propertyId) {
    const allCards = document.querySelectorAll('.property-card');
    allCards.forEach(card => {
      card.classList.remove('border-primary');
      const checkmarks = card.querySelectorAll('.bi-check-circle-fill');
      checkmarks.forEach(check => check.remove());
    });

    const selectedCard = document.querySelector(`.property-card[onclick*="'${propertyId}'"]`);
    if (selectedCard) {
      selectedCard.classList.add('border-primary');

      const cardImgTop = selectedCard.querySelector('.card-img-top');
      const cardHeader = selectedCard.querySelector('.card-header');

      if (cardImgTop) {
        const checkmark = document.createElement('div');
        checkmark.className = 'position-absolute top-0 end-0 p-2';
        checkmark.innerHTML = '<i class="bi bi-check-circle-fill text-success bg-white rounded-circle" style="font-size: 1.5rem;"></i>';
        cardImgTop.appendChild(checkmark);
      } else if (cardHeader) {
        const checkmark = document.createElement('i');
        checkmark.className = 'bi bi-check-circle-fill text-success';
        checkmark.style.fontSize = '1.2rem';
        cardHeader.appendChild(checkmark);
      }
    }
  }

  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.updateMonthDisplay();
    if (this.selectedProperty) {
      this.loadBillForCurrentMonth();
    }
  }

  updateMonthDisplay() {
    const monthYearElement = document.getElementById('currentMonthYear');
    if (monthYearElement) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      monthYearElement.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    }
  }

  async loadBillForCurrentMonth() {
    if (!this.selectedProperty) {
      this.showEmptyState('Please select a property');
      return;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      const response = await API.get(
        API_CONFIG.ENDPOINTS.BILL_BY_PROPERTY_MONTH(this.selectedProperty, year, month)
      );

      if (response.status === 404) {
        // Bill not generated yet
        this.currentBill = null;
        this.showGenerateBillPrompt();
        return;
      }

      const result = await response.json();

      if (result.success) {
        this.currentBill = result.bill;
        this.renderBillTable();
      } else {
        console.error('Failed to load bill:', result.error);
        this.showEmptyState('Failed to load bill');
      }
    } catch (error) {
      console.error('Error loading bill:', error);
      this.currentBill = null;
      this.showGenerateBillPrompt();
    }
  }

  showGenerateBillPrompt() {
    const container = document.getElementById('billTableContainer');
    if (!container) return;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[this.currentDate.getMonth()];
    const year = this.currentDate.getFullYear();

    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-file-earmark-plus fs-1 d-block mb-3"></i>
        <h5>No Bill Generated for ${monthName} ${year}</h5>
        <p>Click "Generate Bill" to create bills for all tenants in this property</p>
        <button class="btn btn-primary mt-3" onclick="billManager.showGenerateBillModal()">
          <i class="bi bi-plus-circle me-2"></i>Generate Bill
        </button>
      </div>
    `;
  }

  showEmptyState(message) {
    const container = document.getElementById('billTableContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-info-circle fs-1 d-block mb-3"></i>
        <p>${message}</p>
      </div>
    `;
  }

  renderBillTable() {
    if (!this.currentBill) {
      this.showGenerateBillPrompt();
      return;
    }

    const container = document.getElementById('billTableContainer');
    if (!container) return;

    this.selectedTenants.clear();

    const tenantBills = this.currentBill.tenantBills || [];

    let html = `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead class="table-light">
            <tr>
              <th>
                <input type="checkbox" id="selectAllTenants" class="form-check-input">
              </th>
              <th>Tenant</th>
              <th>Room</th>
              <th>Base Rental</th>
              <th>Utility Fee</th>
              <th>Cleaning Fee</th>
              <th>Total</th>
              <th>Status</th>
              <th>Upload Link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    tenantBills.forEach(tenantBill => {
      const statusBadge = this.getStatusBadge(tenantBill.paymentStatus);
      const uploadInfo = tenantBill.latestUpload
        ? `<small class="text-muted">Uploaded: ${new Date(tenantBill.latestUpload.uploadDate).toLocaleString()}</small>`
        : '';

      html += `
        <tr>
          <td>
            <input type="checkbox" class="form-check-input tenant-checkbox"
                   data-tenant-id="${tenantBill.tenantId}"
                   ${tenantBill.paymentStatus !== 'pending' ? '' : 'disabled'}>
          </td>
          <td>
            <strong>${escapeHtml(tenantBill.tenantName)}</strong><br>
            <small class="text-muted">${escapeHtml(tenantBill.tenantId)}</small>
          </td>
          <td>${escapeHtml(tenantBill.room ? getRoomTypeDisplayName(tenantBill.room) : '-')}</td>
          <td>$${tenantBill.baseRental.toFixed(2)}</td>
          <td>$${tenantBill.utilityFee.toFixed(2)}</td>
          <td>$${tenantBill.cleaningFee.toFixed(2)}</td>
          <td><strong>$${tenantBill.totalAmount.toFixed(2)}</strong></td>
          <td>
            ${statusBadge}
            ${uploadInfo}
          </td>
          <td>
            <button class="btn btn-sm btn-outline-secondary" onclick="billManager.copyUploadLink('${tenantBill.uploadLink}')">
              <i class="bi bi-clipboard"></i> Copy Link
            </button>
          </td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="billManager.editTenantBill('${tenantBill.tenantId}')">
                <i class="bi bi-pencil"></i>
              </button>
              ${tenantBill.latestUpload ? `
                <button class="btn btn-outline-info" onclick="billManager.viewUpload('${tenantBill.latestUpload.screenshotUrl}')" title="View uploaded screenshot">
                  <i class="bi bi-image"></i>
                </button>
                <button class="btn btn-outline-warning" onclick="billManager.resetTenantPayment('${tenantBill.tenantId}')" title="Reset to Pending">
                  <i class="bi bi-arrow-counterclockwise"></i> Reset
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>

      <div class="card mt-3">
        <div class="card-body">
          <div class="row">
            <div class="col-md-6">
              <h6>Bill Summary</h6>
              <p><strong>Total Tenants:</strong> ${tenantBills.length}</p>
              <p><strong>Paid:</strong> ${tenantBills.filter(tb => tb.paymentStatus === 'uploaded' || tb.paymentStatus === 'verified').length}</p>
              <p><strong>Pending:</strong> ${tenantBills.filter(tb => tb.paymentStatus === 'pending').length}</p>
            </div>
            <div class="col-md-6">
              <h6>Fee Summary</h6>
              <p><strong>Total Utility Fee (Shared):</strong> $${this.currentBill.utilityFee.toFixed(2)}</p>
              <p><strong>Tenants Paying Utility:</strong> ${tenantBills.filter(tb => tb.utilityFee > 0).length}</p>
              <p><strong>Utility Subsidized:</strong> ${tenantBills.filter(tb => tb.utilityFee === 0).length}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Re-bind checkbox events
    this.bindCheckboxEvents();
  }

  bindCheckboxEvents() {
    const selectAllCheckbox = document.getElementById('selectAllTenants');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
    }

    const tenantCheckboxes = document.querySelectorAll('.tenant-checkbox');
    tenantCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const tenantId = e.target.getAttribute('data-tenant-id');
        if (e.target.checked) {
          this.selectedTenants.add(tenantId);
        } else {
          this.selectedTenants.delete(tenantId);
        }
        this.updateBulkDeleteButton();
      });
    });
  }

  toggleSelectAll(checked) {
    const tenantCheckboxes = document.querySelectorAll('.tenant-checkbox:not(:disabled)');
    tenantCheckboxes.forEach(checkbox => {
      checkbox.checked = checked;
      const tenantId = checkbox.getAttribute('data-tenant-id');
      if (checked) {
        this.selectedTenants.add(tenantId);
      } else {
        this.selectedTenants.delete(tenantId);
      }
    });
    this.updateBulkDeleteButton();
  }

  updateBulkDeleteButton() {
    const bulkDeleteBtn = document.getElementById('bulkDeleteUploadsBtn');
    if (bulkDeleteBtn) {
      bulkDeleteBtn.disabled = this.selectedTenants.size === 0;
    }
  }

  getStatusBadge(status) {
    const badges = {
      'pending': '<span class="badge bg-warning text-dark">Pending</span>',
      'uploaded': '<span class="badge bg-success">Uploaded</span>',
      'verified': '<span class="badge bg-primary">Verified</span>'
    };
    return badges[status] || badges['pending'];
  }

  showGenerateBillModal() {
    // Validation: Check if property is selected
    if (!this.selectedProperty) {
      if (typeof showToast !== 'undefined') {
        showToast('Please select a property first', 'error');
      } else {
        alert('Please select a property first');
      }
      return;
    }

    const modalHtml = `
      <div class="modal fade" id="generateBillModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Generate Bill</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="generateBillForm">
                <div class="mb-3">
                  <label class="form-label">Property</label>
                  <input type="text" class="form-control" value="${this.selectedProperty || 'No property selected'}" readonly>
                </div>
                <div class="mb-3">
                  <label class="form-label">Month/Year</label>
                  <input type="text" class="form-control" value="${this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}" readonly>
                </div>
                <div class="mb-3">
                  <label for="totalUtilityFee" class="form-label">Total Utility Fee to Share</label>
                  <input type="number" class="form-control" id="totalUtilityFee" name="totalUtilityFee" min="0" step="0.01" value="0">
                  <div class="form-text">This amount will be divided equally among all tenants with room type assigned.</div>
                </div>
                <div class="alert alert-info mb-0">
                  <i class="bi bi-info-circle me-2"></i>
                  <small>
                    <strong>Note:</strong> Only tenants with room type will be included.<br>
                    Cleaning fee uses each tenant's default from their contract.<br>
                    Subsidized tenants (utility fee = $0 in profile) will show $0.
                  </small>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="billManager.generateBill()">Generate</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('generateBillModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('generateBillModal'));
    modal.show();
  }

  async generateBill() {
    try {
      const totalUtilityFee = parseFloat(document.getElementById('totalUtilityFee').value) || 0;

      const response = await API.post(API_CONFIG.ENDPOINTS.BILL_GENERATE, {
        propertyId: this.selectedProperty,
        year: this.currentDate.getFullYear(),
        month: this.currentDate.getMonth() + 1,
        totalUtilityFee
      });

      const result = await response.json();

      if (result.success) {
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('generateBillModal'));
        if (modal) modal.hide();

        // Reload bill
        await this.loadBillForCurrentMonth();

        showToast(result.message || 'Bill generated successfully', 'success');
      } else {
        showToast('Failed to generate bill: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error generating bill:', error);
      showToast('Error generating bill', 'error');
    }
  }

  showUpdateFeesModal() {
    if (!this.currentBill) return;

    const modalHtml = `
      <div class="modal fade" id="updateFeesModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Update Fees for All Tenants</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="updateFeesForm">
                <div class="mb-3">
                  <label for="updateUtilityFee" class="form-label">Utility Fee</label>
                  <input type="number" class="form-control" id="updateUtilityFee" name="utilityFee" min="0" step="0.01" value="${this.currentBill.utilityFee}">
                </div>
                <div class="mb-3">
                  <label for="updateCleaningFee" class="form-label">Cleaning Fee</label>
                  <input type="number" class="form-control" id="updateCleaningFee" name="cleaningFee" min="0" step="0.01" value="${this.currentBill.cleaningFee}">
                </div>
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-triangle me-2"></i>
                  This will update fees for all tenants in this month's bill.
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="billManager.updateFees()">Update</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('updateFeesModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('updateFeesModal'));
    modal.show();
  }

  async updateFees() {
    try {
      const utilityFee = parseFloat(document.getElementById('updateUtilityFee').value) || 0;
      const cleaningFee = parseFloat(document.getElementById('updateCleaningFee').value) || 0;

      const response = await API.put(
        API_CONFIG.ENDPOINTS.BILL_UPDATE_FEES(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1
        ),
        { utilityFee, cleaningFee }
      );

      const result = await response.json();

      if (result.success) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('updateFeesModal'));
        if (modal) modal.hide();

        await this.loadBillForCurrentMonth();

        showToast('Fees updated successfully', 'success');
      } else {
        showToast('Failed to update fees: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error updating fees:', error);
      showToast('Error updating fees', 'error');
    }
  }

  editTenantBill(tenantId) {
    if (!this.currentBill) return;

    const tenantBill = this.currentBill.tenantBills.find(tb => tb.tenantId === tenantId);
    if (!tenantBill) return;

    const modalHtml = `
      <div class="modal fade" id="editTenantBillModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit Bill for ${escapeHtml(tenantBill.tenantName)}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="editTenantBillForm">
                <div class="mb-3">
                  <label for="editBaseRental" class="form-label">Base Rental</label>
                  <input type="number" class="form-control" id="editBaseRental" name="baseRental" min="0" step="0.01" value="${tenantBill.baseRental}">
                </div>
                <div class="mb-3">
                  <label for="editUtilityFee" class="form-label">Utility Fee</label>
                  <input type="number" class="form-control" id="editUtilityFee" name="utilityFee" min="0" step="0.01" value="${tenantBill.utilityFee}">
                </div>
                <div class="mb-3">
                  <label for="editCleaningFee" class="form-label">Cleaning Fee</label>
                  <input type="number" class="form-control" id="editCleaningFee" name="cleaningFee" min="0" step="0.01" value="${tenantBill.cleaningFee}">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-primary" onclick="billManager.saveTenantBill('${tenantId}')">Save</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('editTenantBillModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = new bootstrap.Modal(document.getElementById('editTenantBillModal'));
    modal.show();
  }

  async saveTenantBill(tenantId) {
    try {
      const baseRental = parseFloat(document.getElementById('editBaseRental').value) || 0;
      const utilityFee = parseFloat(document.getElementById('editUtilityFee').value) || 0;
      const cleaningFee = parseFloat(document.getElementById('editCleaningFee').value) || 0;

      const response = await API.put(
        API_CONFIG.ENDPOINTS.BILL_UPDATE_TENANT(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1,
          tenantId
        ),
        { baseRental, utilityFee, cleaningFee }
      );

      const result = await response.json();

      if (result.success) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('editTenantBillModal'));
        if (modal) modal.hide();

        await this.loadBillForCurrentMonth();

        showToast('Tenant bill updated successfully', 'success');
      } else {
        showToast('Failed to update tenant bill: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error updating tenant bill:', error);
      showToast('Error updating tenant bill', 'error');
    }
  }

  copyUploadLink(link) {
    navigator.clipboard.writeText(link).then(() => {
      showToast('Upload link copied to clipboard', 'success');
    }).catch(err => {
      console.error('Failed to copy link:', err);
      showToast('Failed to copy link', 'error');
    });
  }

  viewUpload(screenshotUrl) {
    window.open(screenshotUrl, '_blank');
  }

  async resetTenantPayment(tenantId) {
    if (!confirm('⚠️ Reset this tenant\'s payment?\n\nThis will:\n• Delete all uploaded screenshots\n• Reset status to "Pending"\n• Allow tenant to upload again\n\nContinue?')) return;

    try {
      const response = await API.delete(
        API_CONFIG.ENDPOINTS.BILL_DELETE_TENANT_UPLOADS(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1,
          tenantId
        )
      );

      const result = await response.json();

      if (result.success) {
        await this.loadBillForCurrentMonth();
        showToast('✅ Payment reset to Pending. Tenant can upload again.', 'success');
      } else {
        showToast('Failed to reset payment: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error resetting payment:', error);
      showToast('Error resetting payment', 'error');
    }
  }

  // Keep old method name for backward compatibility
  async deleteTenantUploads(tenantId) {
    return this.resetTenantPayment(tenantId);
  }

  async bulkDeleteUploads() {
    const count = this.selectedTenants.size;
    if (count === 0) return;

    if (!confirm(`⚠️ Reset payment for ${count} selected tenant(s)?\n\nThis will:\n• Delete all their uploaded screenshots\n• Reset their status to "Pending"\n• Allow them to upload again\n\nContinue?`)) return;

    try {
      const tenantIds = Array.from(this.selectedTenants);

      const response = await API.delete(
        API_CONFIG.ENDPOINTS.BILL_DELETE_BULK_UPLOADS(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1
        ),
        {
          body: JSON.stringify({ tenantIds })
        }
      );

      const result = await response.json();

      if (result.success) {
        this.selectedTenants.clear();
        await this.loadBillForCurrentMonth();
        showToast(`✅ ${result.clearedCount} tenant(s) reset to Pending`, 'success');
      } else {
        showToast('Failed to reset payments: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error bulk deleting uploads:', error);
      showToast('Error deleting uploads', 'error');
    }
  }
}

// Export for use in other modules
window.BillManagementComponent = BillManagementComponent;
