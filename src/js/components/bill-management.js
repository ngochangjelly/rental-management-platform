import { getRoomTypeDisplayName } from '../utils/room-type-mapper.js';
import i18next from 'i18next';

const t = (key, opts) => i18next.t(`billManagement.${key}`, opts);
const monthName = (idx, short = false) => {
  if (i18next.language === 'vi') return short ? `T${idx + 1}` : `Tháng ${idx + 1}`;
  const full = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const sh   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return short ? sh[idx] : full[idx];
};

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
    this.currentUtilityBill = null; // from Utility Bill Tracker
    this.selectedTenants = new Set();
    this._slugResolvedProperty = null; // set transiently by router for deep-link resolution
    this.propertySubsidy = 0;
    this._billChart = null;
    this._allUtilityBills = [];
    this.init();
  }

  init() {
    this.updateMonthDisplay();
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
      // Fetch all properties with pagination
      let allProperties = [];
      let currentPage = 1;
      const itemsPerPage = 50;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${currentPage}&limit=${itemsPerPage}`);
        const result = await response.json();

        if (result.success) {
          allProperties = allProperties.concat(result.properties || []);
          hasMorePages = result.pagination && currentPage < result.pagination.totalPages;
          currentPage++;
        } else {
          console.error('Failed to load properties:', result.error);
          hasMorePages = false;
        }
      }

      this.properties = allProperties;
      this.renderPropertyCards(allProperties);
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
          ${t('noPropertiesAvailable')}
        </div>
      `;
      return;
    }

    // CSS Grid — compact cards, ~10 per row on wide screens
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
    container.style.gap = "0.5rem";

    const sortedProperties = [...properties].sort((a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0));
    sortedProperties.forEach(property => {
      const isSelected = this.selectedProperty === property.propertyId;
      const cardHtml = `
        <div class="card property-card ${isSelected ? 'selected-card' : ''} overflow-hidden"
             style="cursor: pointer; transition: all 0.2s ease;"
             data-property-id="${property.propertyId}"
             onclick="billManager.selectProperty('${property.propertyId}')">
          ${property.propertyImage
            ? `<div data-role="property-image" style="height: 55px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; position: relative;">
                <div data-role="selected-overlay" style="position: absolute; inset: 0; background: rgba(13,110,253,0.5); display: ${isSelected ? 'flex' : 'none'}; align-items: center; justify-content: center;"><i class="bi bi-check-circle-fill text-white" style="font-size: 1.4rem;"></i></div>
              </div>`
            : ''
          }
          <div data-role="card-body" class="d-flex flex-column align-items-center p-2" style="gap: 3px; background: ${isSelected ? 'rgba(13,110,253,0.07)' : '#fff'};">
            <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
                 style="width: 28px; height: 28px; font-size: 11px; flex-shrink: 0;">
              ${escapeHtml(property.propertyId.toString().substring(0, 3))}
            </div>
            <div class="text-center" style="line-height: 1.2; width: 100%;">
              <div class="fw-semibold text-truncate" style="font-size: 10px;" title="${escapeHtml(property.address || '')}">${escapeHtml(property.address || property.propertyId)}</div>
              <div class="text-muted text-truncate" style="font-size: 10px;">${escapeHtml(property.unit || '')}</div>
            </div>
            ${!property.propertyImage ? `<i data-role="no-image-check" class="bi bi-check-circle-fill text-primary" style="font-size: 0.9rem; display: ${isSelected ? 'inline' : 'none'};"></i>` : ''}
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
          border-radius: 6px;
          border: 1px solid #dee2e6;
          overflow: hidden;
        }
        .property-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.15) !important;
        }
        .property-card.selected-card {
          border: 3px solid #0d6efd !important;
          box-shadow: 0 0 0 3px rgba(13,110,253,0.2), 0 4px 12px rgba(13,110,253,0.25) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  async selectProperty(propertyId) {
    if (this.selectedProperty === propertyId) return;
    this.selectedProperty = propertyId;
    this._allUtilityBills = [];
    this.propertySubsidy = 0;
    this.updatePropertyCardSelection(propertyId);
    await this._loadPropertyDetails();
    await this.loadBillForCurrentMonth();
    this._syncUrl();
  }

  _syncUrl() {
    if (!this.selectedProperty || !window.appRouter) return;
    const _propData =
      this.properties.find((p) => p.propertyId === this.selectedProperty) ||
      this._slugResolvedProperty;
    const _slug = _propData
      ? window.SlugUtils.propertySlug(_propData)
      : this.selectedProperty;
    const _y = this.currentDate.getFullYear();
    const _m = this.currentDate.getMonth() + 1;
    window.appRouter.replace(`/bills/${_slug}/${_y}/${_m}`);
  }

  updatePropertyCardSelection(propertyId) {
    const allCards = document.querySelectorAll('.property-card');
    allCards.forEach((card) => {
      const isSelected = card.dataset.propertyId === String(this.selectedProperty);
      card.classList.toggle('selected-card', isSelected);

      const overlay = card.querySelector('[data-role="selected-overlay"]');
      if (overlay) overlay.style.display = isSelected ? 'flex' : 'none';

      const body = card.querySelector('[data-role="card-body"]');
      if (body) body.style.background = isSelected ? 'rgba(13,110,253,0.07)' : '#fff';

      const check = card.querySelector('[data-role="no-image-check"]');
      if (check) check.style.display = isSelected ? 'inline' : 'none';
    });
  }

  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.updateMonthDisplay();
    if (this.selectedProperty) {
      this.loadBillForCurrentMonth();
      this._syncUrl();
    }
  }

  updateMonthDisplay() {
    const monthYearElement = document.getElementById('currentMonthYear');
    if (monthYearElement) {
      monthYearElement.textContent = `${monthName(this.currentDate.getMonth())} ${this.currentDate.getFullYear()}`;
    }
  }

  async loadUtilityBillForMonth() {
    if (!this.selectedProperty) { this.currentUtilityBill = null; return; }
    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;
      const res = await API.get(API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(this.selectedProperty));
      const data = await res.json();
      if (data.success) {
        this.currentUtilityBill = (data.bills || []).find(b => b.year === year && b.month === month) || null;
      } else {
        this.currentUtilityBill = null;
      }
    } catch {
      this.currentUtilityBill = null;
    }
  }

  async loadBillForCurrentMonth() {
    if (!this.selectedProperty) {
      this.showEmptyState('Please select a property');
      return;
    }

    // Load utility bill tracker data and monthly bill in parallel
    const [, billResponse] = await Promise.all([
      this.loadUtilityBillForMonth(),
      API.get(API_CONFIG.ENDPOINTS.BILL_BY_PROPERTY_MONTH(
        this.selectedProperty,
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() + 1,
      )).catch(() => ({ status: 503 })),
    ]);
    this._loadAllUtilityBillsForChart();

    try {
      if (billResponse.status === 404) {
        // Bill not generated yet
        this.currentBill = null;
        this.showGenerateBillPrompt();
        return;
      }

      const result = await billResponse.json();

      if (result.success) {
        this.currentBill = result.bill;
        this.renderBillTable();
      } else {
        console.error('Failed to load bill:', result.error);
        this.showEmptyState(t('failedToLoadBill'));
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

    const mn   = monthName(this.currentDate.getMonth());
    const year = this.currentDate.getFullYear();

    const ub = this.currentUtilityBill;
    let utilityHtml = '';
    if (ub) {
      const exceeded = this.propertySubsidy > 0 && (ub.totalAmount||0) > this.propertySubsidy;
      const excess   = exceeded ? (ub.totalAmount||0) - this.propertySubsidy : 0;
      const fmtDate  = (v) => v ? new Date(v).toLocaleDateString('en-SG', { day:'2-digit', month:'short', year:'numeric' }) : null;
      const period   = (ub.billingPeriodStart || ub.billingPeriodEnd)
        ? `${fmtDate(ub.billingPeriodStart) || '?'} – ${fmtDate(ub.billingPeriodEnd) || '?'}`
        : null;
      const gasOther = (ub.gasAmount||0) + (ub.refuseAmount||0) + (ub.otherAmount||0);
      const cardStyle = exceeded ? 'border:2px solid #dc3545!important;background:#fff5f5;' : 'background:#f8f9fa;';
      const isPdf = ub.billImageUrl && (ub.billImageUrl.includes('raw-proxy') || ub.billImageUrl.toLowerCase().includes('.pdf'));
      utilityHtml = `
        <div class="col-md-4 mx-auto mb-3">
          <h6 class="d-flex align-items-center gap-2">
            ${t('spGroupUtilityBill')}
            ${this.propertySubsidy > 0 ? `<span class="badge bg-secondary" style="font-size:0.7rem;font-weight:500;">Max: $${this.propertySubsidy.toFixed(2)}</span>` : ''}
          </h6>
          <div class="border rounded p-2" style="font-size:0.82rem;${cardStyle}">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="fw-semibold text-primary">${monthName((ub.month||1)-1, true)} ${ub.year}</span>
              ${exceeded ? `<span class="badge bg-danger" style="font-size:0.7rem;">⚠ +$${excess.toFixed(2)} over limit</span>` : ''}
            </div>
            ${period ? `<div class="text-muted mb-1" style="font-size:0.75rem;">${period}</div>` : ''}
            <div class="d-flex justify-content-between"><span><i class="bi bi-lightning-charge-fill text-warning me-1"></i>${t('electricity')}</span><span>$${(ub.electricityAmount||0).toFixed(2)}</span></div>
            <div class="d-flex justify-content-between"><span><i class="bi bi-droplet-fill text-info me-1"></i>${t('water')}</span><span>$${(ub.waterAmount||0).toFixed(2)}</span></div>
            ${gasOther > 0 ? `<div class="d-flex justify-content-between"><span><i class="bi bi-fire text-secondary me-1"></i>${t('gasAndOthers')}</span><span>$${gasOther.toFixed(2)}</span></div>` : ''}
            <div class="d-flex justify-content-between fw-bold border-top mt-1 pt-1">
              <span>${t('total')}</span>
              <span style="color:${exceeded ? '#dc3545' : '#0d6efd'};">$${(ub.totalAmount||0).toFixed(2)}</span>
            </div>
            ${this.propertySubsidy > 0 ? `<div class="d-flex justify-content-between border-top mt-1 pt-1" style="font-size:0.75rem;color:#6c757d;"><span>Max covered</span><span>$${this.propertySubsidy.toFixed(2)}</span></div>` : ''}
            ${ub.billImageUrl ? `<a href="${ub.billImageUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mt-2 w-100 py-0" style="font-size:0.75rem;"><i class="bi bi-${isPdf ? 'file-earmark-pdf' : 'image'} me-1"></i>${t('viewBill')}</a>` : ''}
          </div>
          <div id="utilityBillDropZoneInline"
               class="border rounded p-2 text-center mt-2"
               style="border-style:dashed!important;cursor:pointer;transition:background 0.15s;"
               onclick="document.getElementById('utilityBillFileInputInline').click()">
            <input type="file" id="utilityBillFileInputInline" accept="application/pdf,.pdf,image/jpeg,image/png,image/heic" style="display:none">
            <i class="bi bi-file-earmark-arrow-up text-secondary" style="font-size:1.4rem;"></i>
            <div class="small text-muted mt-1">${t('dropPdfHere')}</div>
            <div id="utilityDropStatus" class="small mt-1"></div>
          </div>
        </div>`;
    } else {
      utilityHtml = `
        <div class="col-md-4 mx-auto mb-3">
          <h6>${t('spGroupUtilityBill')}</h6>
          <div id="utilityBillDropZoneInline"
               class="border rounded p-2 text-center"
               style="border-style:dashed!important;cursor:pointer;transition:background 0.15s;"
               onclick="document.getElementById('utilityBillFileInputInline').click()">
            <input type="file" id="utilityBillFileInputInline" accept="application/pdf,.pdf,image/jpeg,image/png,image/heic" style="display:none">
            <i class="bi bi-file-earmark-arrow-up text-secondary" style="font-size:1.4rem;"></i>
            <div class="small text-muted mt-1">${t('dropPdfHere')}</div>
            <div id="utilityDropStatus" class="small mt-1"></div>
          </div>
        </div>`;
    }

    container.innerHTML = `
      <div class="row justify-content-center">
        ${utilityHtml}
      </div>
      <div class="text-center text-muted py-3">
        <i class="bi bi-file-earmark-plus fs-1 d-block mb-3"></i>
        <h5>${t('noBillGenerated', { month: mn, year })}</h5>
        <p>${t('clickToGenerate')}</p>
        <button class="btn btn-primary mt-3" onclick="billManager.showGenerateBillModal()">
          <i class="bi bi-plus-circle me-2"></i>${t('generateBill')}
        </button>
      </div>
    `;

    this.bindUtilityDropZone();
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
              <th>${t('tenant')}</th>
              <th>${t('room')}</th>
              <th>${t('baseRental')}</th>
              <th>${t('utilityFee')}</th>
              <th>${t('cleaningFee')}</th>
              <th>${t('total')}</th>
              <th>${t('status')}</th>
              <th>${t('uploadLink')}</th>
              <th>${t('actions')}</th>
            </tr>
          </thead>
          <tbody>
    `;

    tenantBills.forEach(tenantBill => {
      const statusBadge = this.getStatusBadge(tenantBill.paymentStatus);
      const uploadInfo = tenantBill.latestUpload
        ? `<small class="text-muted">${t('uploadedOn', { date: new Date(tenantBill.latestUpload.uploadDate).toLocaleString() })}</small>`
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
              <i class="bi bi-clipboard"></i> ${t('copyLink')}
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
                <button class="btn btn-outline-warning" onclick="billManager.resetTenantPayment('${tenantBill.tenantId}')" title="${t('reset')}">
                  <i class="bi bi-arrow-counterclockwise"></i> ${t('reset')}
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
            <div class="col-md-4">
              <h6>${t('billSummary')}</h6>
              <p><strong>${t('totalTenants')}:</strong> ${tenantBills.length}</p>
              <p><strong>${t('paid')}:</strong> ${tenantBills.filter(tb => tb.paymentStatus === 'uploaded' || tb.paymentStatus === 'verified').length}</p>
              <p><strong>${t('pendingCount')}:</strong> ${tenantBills.filter(tb => tb.paymentStatus === 'pending').length}</p>
            </div>
            <div class="col-md-4">
              <h6>${t('feeSummary')}</h6>
              <p id="billingPeriodDisplay"><strong>${t('billingPeriod')}:</strong> ${this.currentBill.billingPeriod ? escapeHtml(this.currentBill.billingPeriod) : '<span class="text-muted">-</span>'}</p>
              <p id="utilityFeeDisplay"><strong>${t('totalUtilityFeeShared')}:</strong> $${this.currentBill.utilityFee.toFixed(2)}</p>
              <p><strong>${t('tenantsPayingUtility')}:</strong> ${tenantBills.filter(tb => tb.utilityFee > 0).length}</p>
              <p><strong>${t('utilitySubsidized')}:</strong> ${tenantBills.filter(tb => tb.utilityFee === 0).length}</p>
              <button class="btn btn-sm btn-outline-primary mt-1" onclick="billManager.showUtilityBreakdownModal()">
                <i class="bi bi-calculator me-1"></i>${t('viewUtilityBreakdown')}
              </button>
              <div id="ocrReadStatus"></div>
            </div>
            <div class="col-md-4">
              <h6 class="d-flex align-items-center gap-2">
                ${t('spGroupUtilityBill')}
                ${this.propertySubsidy > 0 ? `<span class="badge bg-secondary" style="font-size:0.7rem;font-weight:500;">Max: $${this.propertySubsidy.toFixed(2)}</span>` : ''}
              </h6>
              ${this.currentUtilityBill ? (() => {
                const ub = this.currentUtilityBill;
                const exceeded = this.propertySubsidy > 0 && (ub.totalAmount||0) > this.propertySubsidy;
                const excess = exceeded ? (ub.totalAmount||0) - this.propertySubsidy : 0;
                const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-SG', { day:'2-digit', month:'short', year:'numeric' }) : null;
                const period = (ub.billingPeriodStart || ub.billingPeriodEnd)
                  ? `${fmtDate(ub.billingPeriodStart) || '?'} – ${fmtDate(ub.billingPeriodEnd) || '?'}`
                  : null;
                const gasOther = (ub.gasAmount||0) + (ub.refuseAmount||0) + (ub.otherAmount||0);
                const cardStyle = exceeded
                  ? 'border:2px solid #dc3545!important;background:#fff5f5;'
                  : 'background:#f8f9fa;';
                return `
                  <div class="border rounded p-2" style="font-size:0.82rem;${cardStyle}">
                    <div class="d-flex align-items-center justify-content-between mb-1">
                      <span class="fw-semibold text-primary">${monthName((ub.month||1)-1, true)} ${ub.year}</span>
                      ${exceeded ? `<span class="badge bg-danger" style="font-size:0.7rem;">⚠ +$${excess.toFixed(2)} over limit</span>` : ''}
                    </div>
                    ${period ? `<div class="text-muted mb-1" style="font-size:0.75rem;">${period}</div>` : ''}
                    <div class="d-flex justify-content-between"><span><i class="bi bi-lightning-charge-fill text-warning me-1"></i>${t('electricity')}</span><span>$${(ub.electricityAmount||0).toFixed(2)}</span></div>
                    <div class="d-flex justify-content-between"><span><i class="bi bi-droplet-fill text-info me-1"></i>${t('water')}</span><span>$${(ub.waterAmount||0).toFixed(2)}</span></div>
                    ${gasOther > 0 ? `<div class="d-flex justify-content-between"><span><i class="bi bi-fire text-secondary me-1"></i>${t('gasAndOthers')}</span><span>$${gasOther.toFixed(2)}</span></div>` : ''}
                    <div class="d-flex justify-content-between fw-bold border-top mt-1 pt-1">
                      <span>${t('total')}</span>
                      <span style="color:${exceeded ? '#dc3545' : '#0d6efd'};">$${(ub.totalAmount||0).toFixed(2)}</span>
                    </div>
                    ${this.propertySubsidy > 0 ? `
                    <div class="d-flex justify-content-between border-top mt-1 pt-1" style="font-size:0.75rem;color:#6c757d;">
                      <span>Max covered</span>
                      <span>$${this.propertySubsidy.toFixed(2)}</span>
                    </div>` : ''}
                    ${ub.billImageUrl ? (() => { const isPdf = ub.billImageUrl.includes('raw-proxy') || ub.billImageUrl.toLowerCase().includes('.pdf'); return `<a href="${ub.billImageUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mt-2 w-100 py-0" style="font-size:0.75rem;"><i class="bi bi-${isPdf ? 'file-earmark-pdf' : 'image'} me-1"></i>${t('viewBill')}</a>`; })() : ''}
                  </div>`;
              })() : ''}
              <div id="utilityBillDropZoneInline"
                   class="border rounded p-2 text-center mt-2"
                   style="border-style:dashed!important;cursor:pointer;transition:background 0.15s;"
                   onclick="document.getElementById('utilityBillFileInputInline').click()">
                <input type="file" id="utilityBillFileInputInline" accept="application/pdf,.pdf,image/jpeg,image/png,image/heic" style="display:none">
                <i class="bi bi-file-earmark-arrow-up text-secondary" style="font-size:1.4rem;"></i>
                <div class="small text-muted mt-1">${t('dropPdfHere')}</div>
                <div id="utilityDropStatus" class="small mt-1"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Re-bind checkbox events
    this.bindCheckboxEvents();
    this.bindUtilityDropZone();
  }

  bindUtilityDropZone() {
    const dropZone = document.getElementById('utilityBillDropZoneInline');
    const fileInput = document.getElementById('utilityBillFileInputInline');
    if (!dropZone || !fileInput) return;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.uploadUtilityBillFromDrop(file);
      fileInput.value = '';
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.background = 'rgba(13,110,253,0.07)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.background = '';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.background = '';
      const file = e.dataTransfer?.files?.[0];
      if (file) this.uploadUtilityBillFromDrop(file);
    });
  }

  async uploadUtilityBillFromDrop(file) {
    if (!this.selectedProperty) return;

    const statusEl = document.getElementById('utilityDropStatus');
    const dropZone = document.getElementById('utilityBillDropZoneInline');

    const setStatus = (html) => { if (statusEl) statusEl.innerHTML = html; };

    setStatus(`<span class="spinner-border spinner-border-sm me-1"></span>Reading bill…`);
    if (dropZone) dropZone.style.pointerEvents = 'none';

    try {
      // Step 1: OCR / parse
      const ocrForm = new FormData();
      ocrForm.append('billImage', file);
      const ocrRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UTILITY_BILL_PARSE_OCR}`, {
        method: 'POST', credentials: 'include', body: ocrForm,
      });
      const ocrData = await ocrRes.json();
      if (!ocrData.success) throw new Error(ocrData.error || 'OCR failed');

      const parsed = ocrData.data;
      const year = parsed.billYear || this.currentDate.getFullYear();
      const month = parsed.billMonth || (this.currentDate.getMonth() + 1);

      setStatus(`<span class="spinner-border spinner-border-sm me-1"></span>Saving…`);

      // Step 2: Save
      const saveForm = new FormData();
      saveForm.append('year', year);
      saveForm.append('month', month);
      saveForm.append('billImage', file);
      if (parsed.accountNumber) saveForm.append('accountNumber', parsed.accountNumber);
      if (parsed.billDate) saveForm.append('billDate', parsed.billDate);
      if (parsed.billingPeriodStart) saveForm.append('billingPeriodStart', parsed.billingPeriodStart);
      if (parsed.billingPeriodEnd) saveForm.append('billingPeriodEnd', parsed.billingPeriodEnd);
      if (parsed.electricityAmount != null) saveForm.append('electricityAmount', parsed.electricityAmount);
      if (parsed.waterAmount != null) saveForm.append('waterAmount', parsed.waterAmount);
      if (parsed.gasAmount != null) saveForm.append('gasAmount', parsed.gasAmount);
      if (parsed.refuseAmount != null) saveForm.append('refuseAmount', parsed.refuseAmount);
      if (parsed.gstAmount != null) saveForm.append('gstAmount', parsed.gstAmount);
      if (parsed.otherAmount != null) saveForm.append('otherAmount', parsed.otherAmount);
      if (parsed.totalAmount != null) saveForm.append('totalAmount', parsed.totalAmount);

      const saveRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UTILITY_BILL_CREATE(this.selectedProperty)}`, {
        method: 'POST', credentials: 'include', body: saveForm,
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error || 'Save failed');

      setStatus(`<i class="bi bi-check-circle-fill text-success me-1"></i>Saved`);
      // Refresh utility bill and re-render
      await this.loadUtilityBillForMonth();
      if (dropZone) dropZone.style.pointerEvents = '';
      if (this.currentBill) {
        this.renderBillTable();
      } else {
        this.showGenerateBillPrompt();
      }
    } catch (err) {
      console.error('[BillManagement] utility drop upload error:', err);
      setStatus(`<i class="bi bi-exclamation-triangle text-danger me-1"></i>${err.message}`);
      if (dropZone) dropZone.style.pointerEvents = '';
    }
  }

  async _loadPropertyDetails() {
    if (!this.selectedProperty) return;
    try {
      const res  = await API.get(API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(this.selectedProperty));
      const data = await res.json();
      if (data.success && data.property) {
        this.propertySubsidy = data.property.subsidizedPub || 0;
        this._renderFbGroups(data.property);
      }
    } catch {
      this.propertySubsidy = 0;
      this._renderFbGroups(null);
    }
  }

  _renderFbGroups(property) {
    const container = document.getElementById('billFbGroups');
    if (!container) return;
    const tenantGroup = property?.tenantFacebookGroup;
    const adminGroup  = property?.adminFacebookGroup;
    if (!tenantGroup && !adminGroup) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';
    container.innerHTML = [
      tenantGroup ? `<a href="${escapeHtml(tenantGroup)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary"><i class="bi bi-facebook me-1"></i>Tenant Group</a>` : '',
      adminGroup  ? `<a href="${escapeHtml(adminGroup)}"  target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-success"><i class="bi bi-facebook me-1"></i>Admin Group</a>`  : '',
    ].join('');
  }

  async _loadAllUtilityBillsForChart() {
    if (!this.selectedProperty) return;
    if (this._allUtilityBills.length > 0) {
      this._renderBillTrendChart();
      return;
    }
    try {
      const res  = await API.get(API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(this.selectedProperty));
      const data = await res.json();
      if (data.success) this._allUtilityBills = data.bills || [];
    } catch {
      this._allUtilityBills = [];
    }
    this._renderBillTrendChart();
  }

  _ensureChartContainer() {
    let card = document.getElementById('billTrendChartContainer');
    if (!card) {
      const anchor = document.getElementById('billTableContainer');
      if (!anchor) return null;
      card = document.createElement('div');
      card.id = 'billTrendChartContainer';
      card.className = 'card mb-3 shadow-sm';
      card.innerHTML = `
        <div class="card-header py-2 d-flex align-items-center justify-content-between">
          <h6 class="mb-0">
            <i class="bi bi-bar-chart-line me-2 text-primary"></i>SP Group Bill Trend
          </h6>
          <span id="billTrendSubsidyBadge" class="badge" style="display:none;font-size:0.75rem;"></span>
        </div>
        <div class="card-body py-2" style="position:relative;height:200px;">
          <canvas id="billTrendChart"></canvas>
        </div>
      `;
      anchor.parentNode.insertBefore(card, anchor);
    }
    return card;
  }

  _renderBillTrendChart() {
    if (!this.selectedProperty) return;

    const container = this._ensureChartContainer();
    if (!container) return;

    const sorted = [...this._allUtilityBills].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );
    const recent = sorted.slice(-12);

    if (recent.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';

    const curYear  = this.currentDate.getFullYear();
    const curMonth = this.currentDate.getMonth() + 1;
    const subsidy  = this.propertySubsidy;

    const labels  = recent.map(b => `${monthName(b.month - 1, true)} ${b.year}`);
    const amounts = recent.map(b => b.totalAmount || 0);

    const bgColors = amounts.map((amt, i) => {
      const b = recent[i];
      const isCurrent = b.year === curYear && b.month === curMonth;
      const over = subsidy > 0 && amt > subsidy;
      if (over) return isCurrent ? 'rgba(220,53,69,0.9)' : 'rgba(220,53,69,0.55)';
      return isCurrent ? 'rgba(13,110,253,0.9)' : 'rgba(13,110,253,0.45)';
    });

    const borderColors = amounts.map((amt, i) => {
      const b = recent[i];
      const isCurrent = b.year === curYear && b.month === curMonth;
      const over = subsidy > 0 && amt > subsidy;
      if (over) return 'rgba(220,53,69,1)';
      return isCurrent ? 'rgba(13,110,253,1)' : 'rgba(13,110,253,0.65)';
    });

    const borderWidths = recent.map(b =>
      b.year === curYear && b.month === curMonth ? 2.5 : 1
    );

    const datasets = [{
      label: 'SP Group Bill',
      data: amounts,
      backgroundColor: bgColors,
      borderColor: borderColors,
      borderWidth: borderWidths,
      borderRadius: 4,
    }];

    if (subsidy > 0) {
      datasets.push({
        label: `Max covered ($${subsidy.toFixed(2)})`,
        data: recent.map(() => subsidy),
        type: 'line',
        borderColor: 'rgba(220,53,69,0.85)',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 0,
      });
    }

    const canvas = document.getElementById('billTrendChart');
    if (!canvas) return;

    if (this._billChart) {
      this._billChart.destroy();
      this._billChart = null;
    }

    this._billChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: subsidy > 0, labels: { font: { size: 11 } } },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                if (subsidy > 0 && ctx.datasetIndex === 0) {
                  const amt = ctx.parsed.y;
                  return amt > subsidy
                    ? `⚠ Exceeds max by $${(amt - subsidy).toFixed(2)}`
                    : `✓ Within max ($${(subsidy - amt).toFixed(2)} under)`;
                }
              },
            },
          },
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: v => `$${v}`, font: { size: 11 } } },
          x: { ticks: { font: { size: 10 } } },
        },
      },
    });

    const badge = document.getElementById('billTrendSubsidyBadge');
    if (badge) {
      if (subsidy > 0) {
        badge.textContent = `Max: $${subsidy.toFixed(2)}`;
        badge.className = 'badge bg-danger';
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
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
      'pending':  `<span class="badge bg-warning text-dark">${t('statusPending')}</span>`,
      'uploaded': `<span class="badge bg-success">${t('statusUploaded')}</span>`,
      'verified': `<span class="badge bg-primary">${t('statusVerified')}</span>`,
    };
    return badges[status] || badges['pending'];
  }

  showGenerateBillModal() {
    // Validation: Check if property is selected
    if (!this.selectedProperty) {
      if (typeof showToast !== 'undefined') {
        showToast(t('pleaseSelectProperty'), 'error');
      } else {
        alert(t('pleaseSelectProperty'));
      }
      return;
    }

    const ub = this.currentUtilityBill;
    const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-SG', { day:'2-digit', month:'short', year:'numeric' }) : null;

    // Pre-fill billing period from tracker data if available
    const prefillPeriod = ub && (ub.billingPeriodStart || ub.billingPeriodEnd)
      ? `${fmtDate(ub.billingPeriodStart) || '?'} - ${fmtDate(ub.billingPeriodEnd) || '?'}`
      : '';
    const prefillFee = ub ? (ub.totalAmount || 0).toFixed(2) : '0';

    const trackerBanner = ub ? `
      <div class="alert alert-success py-2 mb-3">
        <i class="bi bi-lightning-charge-fill text-warning me-1"></i>
        <strong>${t('spBillFound')}</strong> — ${monthName((ub.month||1)-1, true)} ${ub.year}
        <div class="mt-1 small">
          ${t('elec')}: <strong>$${(ub.electricityAmount||0).toFixed(2)}</strong> &nbsp;
          ${t('water')}: <strong>$${(ub.waterAmount||0).toFixed(2)}</strong> &nbsp;
          ${t('gasAndOthers')}: <strong>$${((ub.gasAmount||0)+(ub.refuseAmount||0)+(ub.otherAmount||0)).toFixed(2)}</strong> &nbsp;
          ${t('total')}: <strong class="text-primary">$${(ub.totalAmount||0).toFixed(2)}</strong>
        </div>
      </div>` : `
      <div class="alert alert-warning py-2 mb-3">
        <i class="bi bi-exclamation-triangle me-1"></i>
        ${t('noSpBillFoundMsg')}
        <a href="#" class="alert-link ms-1" onclick="event.preventDefault();bootstrap.Modal.getInstance(document.getElementById('generateBillModal'))?.hide();dashboardController.showSection('utility-bills')">${t('addBill')}</a>
      </div>`;

    const modalHtml = `
      <div class="modal fade" id="generateBillModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${t('generateBillTitle')}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="generateBillForm">
                <div class="mb-3">
                  <label class="form-label">${t('property')}</label>
                  <input type="text" class="form-control" value="${this.selectedProperty || t('noPropertySelected')}" readonly>
                </div>
                <div class="mb-3">
                  <label class="form-label">${t('monthYear')}</label>
                  <input type="text" class="form-control" value="${monthName(this.currentDate.getMonth())} ${this.currentDate.getFullYear()}" readonly>
                </div>
                ${trackerBanner}
                <div class="mb-3">
                  <label for="billingPeriod" class="form-label">${t('billingPeriodLabel')}</label>
                  <input type="text" class="form-control" id="billingPeriod" placeholder="${t('billingPeriodPlaceholder')}" value="${escapeHtml(prefillPeriod)}">
                </div>
                <div class="mb-3">
                  <label for="totalUtilityFee" class="form-label">${t('totalUtilityFeeToShare')}</label>
                  <div class="input-group">
                    <span class="input-group-text">$</span>
                    <input type="number" class="form-control" id="totalUtilityFee" name="totalUtilityFee" min="0" step="0.01" value="${prefillFee}">
                  </div>
                  <div class="form-text">${t('utilityFeeDesc')}</div>
                </div>
                <div class="alert alert-info mb-0">
                  <i class="bi bi-info-circle me-2"></i>
                  <small>${t('generateNoteText')}</small>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
              ${this.currentBill ? `<button type="button" class="btn btn-warning" onclick="billManager.generateBill(true)">${t('regenerateBill')}</button>` : ''}
              <button type="button" class="btn btn-primary" onclick="billManager.generateBill()">${t('generate')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('generateBillModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalEl = document.getElementById('generateBillModal');
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }


  async generateBill(regenerate = false) {
    try {
      const totalUtilityFee = parseFloat(document.getElementById('totalUtilityFee').value) || 0;
      const billingPeriod = document.getElementById('billingPeriod').value || '';
      const year  = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      if (regenerate) {
        if (!confirm(t('regenerateBillConfirm'))) return;
        const delRes = await API.delete(API_CONFIG.ENDPOINTS.BILL_BY_PROPERTY_MONTH(this.selectedProperty, year, month));
        const delResult = await delRes.json();
        if (!delResult.success) {
          showToast(t('billDeleteFailed') + ': ' + delResult.error, 'error');
          return;
        }
      }

      const formData = new FormData();
      formData.append('propertyId', this.selectedProperty);
      formData.append('year', year);
      formData.append('month', month);
      formData.append('totalUtilityFee', totalUtilityFee);
      formData.append('billingPeriod', billingPeriod);

      const response = await API.postFormData(API_CONFIG.ENDPOINTS.BILL_GENERATE, formData);
      const result = await response.json();

      if (result.success) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('generateBillModal'));
        if (modal) modal.hide();
        await this.loadBillForCurrentMonth();
        showToast(result.message || t('billGeneratedSuccess'), 'success');
      } else {
        showToast(t('billGenerateFailed') + ': ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error generating bill:', error);
      showToast(t('billGenerateFailed'), 'error');
    }
  }

  showUpdateFeesModal() {
    if (!this.currentBill) return;

    const modalHtml = `
      <div class="modal fade" id="updateFeesModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${t('updateFeesTitle')}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="updateFeesForm">
                <div class="mb-3">
                  <label for="updateUtilityFee" class="form-label">${t('utilityFee')}</label>
                  <input type="number" class="form-control" id="updateUtilityFee" name="utilityFee" min="0" step="0.01" value="${this.currentBill.utilityFee}">
                </div>
                <div class="mb-3">
                  <label for="updateCleaningFee" class="form-label">${t('cleaningFee')}</label>
                  <input type="number" class="form-control" id="updateCleaningFee" name="cleaningFee" min="0" step="0.01" value="${this.currentBill.cleaningFee}">
                </div>
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-triangle me-2"></i>
                  ${t('updateFeesWarning')}
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
              <button type="button" class="btn btn-primary" onclick="billManager.updateFees()">${t('update')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('updateFeesModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalEl = document.getElementById('updateFeesModal');
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });
    const modal = new bootstrap.Modal(modalEl);
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

        showToast(t('feesUpdatedSuccess'), 'success');
      } else {
        showToast(t('feesUpdateFailed') + ': ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error updating fees:', error);
      showToast(t('feesUpdateFailed'), 'error');
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
              <h5 class="modal-title">${t('editBillFor', { name: escapeHtml(tenantBill.tenantName) })}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="editTenantBillForm">
                <div class="mb-3">
                  <label for="editBaseRental" class="form-label">${t('baseRental')}</label>
                  <input type="number" class="form-control" id="editBaseRental" name="baseRental" min="0" step="0.01" value="${tenantBill.baseRental}">
                </div>
                <div class="mb-3">
                  <label for="editUtilityFee" class="form-label">${t('utilityFee')}</label>
                  <input type="number" class="form-control" id="editUtilityFee" name="utilityFee" min="0" step="0.01" value="${tenantBill.utilityFee}">
                </div>
                <div class="mb-3">
                  <label for="editCleaningFee" class="form-label">${t('cleaningFee')}</label>
                  <input type="number" class="form-control" id="editCleaningFee" name="cleaningFee" min="0" step="0.01" value="${tenantBill.cleaningFee}">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t('cancel')}</button>
              <button type="button" class="btn btn-primary" onclick="billManager.saveTenantBill('${tenantId}')">${t('save')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById('editTenantBillModal');
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalEl = document.getElementById('editTenantBillModal');
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });
    const modal = new bootstrap.Modal(modalEl);
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

        showToast(t('tenantBillUpdatedSuccess'), 'success');
      } else {
        showToast(t('tenantBillUpdateFailed') + ': ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error updating tenant bill:', error);
      showToast(t('tenantBillUpdateFailed'), 'error');
    }
  }

  copyUploadLink(link) {
    navigator.clipboard.writeText(link).then(() => {
      showToast(t('linkCopied'), 'success');
    }).catch(err => {
      console.error('Failed to copy link:', err);
      showToast(t('linkCopyFailed'), 'error');
    });
  }

  viewUpload(screenshotUrl) {
    window.open(screenshotUrl, '_blank');
  }

  async resetTenantPayment(tenantId) {
    if (!confirm(t('resetConfirm'))) return;

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
        showToast(t('paymentResetSuccess'), 'success');
      } else {
        showToast(t('paymentResetFailed') + ': ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error resetting payment:', error);
      showToast(t('paymentResetFailed'), 'error');
    }
  }

  // Keep old method name for backward compatibility
  async deleteTenantUploads(tenantId) {
    return this.resetTenantPayment(tenantId);
  }

  async bulkDeleteUploads() {
    const count = this.selectedTenants.size;
    if (count === 0) return;

    if (!confirm(t('bulkResetConfirm', { count }))) return;

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
        showToast(t('bulkResetSuccess', { count: result.clearedCount }), 'success');
      } else {
        showToast(t('bulkResetFailed') + ': ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error bulk deleting uploads:', error);
      showToast(t('errorDeletingUploads'), 'error');
    }
  }

  // ── Utility Breakdown ────────────────────────────────────────────────────

  async showUtilityBreakdownModal() {
    if (!this.currentBill) return;

    // Show modal immediately with loading state
    this._renderBreakdownModal(`
      <div class="text-center py-5">
        <span class="spinner-border text-primary mb-3"></span>
        <p class="text-muted">${t('loadingTenantData')}</p>
      </div>`);

    try {
      // Resolve billing period dates
      const { periodStart, periodEnd, periodDays } = this._resolveBillingPeriod();

      // Fetch tenant data, property info, and exchange rate in parallel
      const dateStr = this.currentDate.toISOString().split('T')[0];
      const [tenantRes, propRes, rateRes] = await Promise.all([
        API.get(API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(this.selectedProperty)),
        API.get(API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(this.selectedProperty)),
        API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_AT(dateStr)),
      ]);
      const data     = await tenantRes.json();
      const propData = await propRes.json();
      const rateData = await rateRes.json().catch(() => null);
      const exchangeRate = rateData?.success && rateData?.rate?.rate ? rateData.rate.rate : null;
      if (!data.success) throw new Error(data.error || 'Failed to load tenants');

      const landlordSubsidy = propData.property?.subsidizedPub || 0;
      const grossUtility    = this.currentUtilityBill?.totalAmount ?? this.currentBill.utilityFee;

      const breakdown = this._calcUtilityBreakdown(
        data.tenants || [],
        this.currentBill.tenantBills || [],
        grossUtility,
        landlordSubsidy,
        periodStart, periodEnd, periodDays
      );

      this._renderBreakdownModal(
        this._buildBreakdownHtml(breakdown, periodStart, periodEnd, periodDays, propData.property, exchangeRate)
      );
    } catch (err) {
      this._renderBreakdownModal(`
        <div class="alert alert-danger m-3">
          <i class="bi bi-x-circle me-2"></i>${escapeHtml(err.message)}
        </div>`);
    }
  }

  _resolveBillingPeriod() {
    // Priority 1: utility bill tracker dates
    const ub = this.currentUtilityBill;
    if (ub?.billingPeriodStart && ub?.billingPeriodEnd) {
      const s = new Date(ub.billingPeriodStart); s.setHours(0,0,0,0);
      const e = new Date(ub.billingPeriodEnd);   e.setHours(0,0,0,0);
      const d = Math.round((e - s) / 864e5) + 1;
      return { periodStart: s, periodEnd: e, periodDays: d };
    }
    // Priority 2: parse billingPeriod string e.g. "03 Mar 2026 - 02 Apr 2026"
    const bp = this.currentBill?.billingPeriod;
    if (bp) {
      const parts = bp.split(/\s*[-–—]\s*/);
      if (parts.length === 2) {
        const s = new Date(parts[0]); s.setHours(0,0,0,0);
        const e = new Date(parts[1]); e.setHours(0,0,0,0);
        if (!isNaN(s) && !isNaN(e)) {
          const d = Math.round((e - s) / 864e5) + 1;
          return { periodStart: s, periodEnd: e, periodDays: d };
        }
      }
    }
    return { periodStart: null, periodEnd: null, periodDays: null };
  }

  _calcUtilityBreakdown(fullTenants, tenantBills, grossUtility, landlordSubsidy, periodStart, periodEnd, periodDays) {
    const netUtility  = Math.max(0, grossUtility - landlordSubsidy);
    // Build lookup: _id (uppercased) → full tenant object
    // tenantBills[].tenantId is stored uppercase (Bill schema uppercase:true),
    // but t._id.toString() returns lowercase hex — so we must normalise to the same case.
    const tenantMap = {};
    fullTenants.forEach(t => { tenantMap[t._id?.toString().toUpperCase()] = t; });

    // Split gross utility into per-type amounts if the SP Group bill has breakdowns.
    // Falls back to treating everything as a single pool when no split is available.
    const ub = this.currentUtilityBill;
    const hasTypeBreakdown = ub && (ub.electricityAmount || ub.waterAmount ||
      ub.gasAmount || ub.refuseAmount || ub.otherAmount);
    // Net-scale each component proportionally so they still sum to netUtility
    const grossElec  = hasTypeBreakdown ? (ub.electricityAmount || 0) : 0;
    const grossWater = hasTypeBreakdown ? (ub.waterAmount       || 0) : 0;
    const grossGas   = hasTypeBreakdown ? ((ub.gasAmount || 0) + (ub.refuseAmount || 0) + (ub.otherAmount || 0)) : 0;
    const grossTyped = grossElec + grossWater + grossGas;
    const scaleFactor = (grossTyped > 0 && hasTypeBreakdown) ? (netUtility / grossTyped) : 1;
    const netElec  = hasTypeBreakdown ? grossElec  * scaleFactor : 0;
    const netWater = hasTypeBreakdown ? grossWater * scaleFactor : 0;
    const netGas   = hasTypeBreakdown ? grossGas   * scaleFactor : 0;
    // Any residual (rounding) stays in the untyped pool
    const netUntyped = hasTypeBreakdown ? Math.max(0, netUtility - netElec - netWater - netGas) : netUtility;

    const msDay = 864e5;

    const daysOverlap = (s1, e1, s2, e2) => {
      const os = Math.max(+s1, +s2);
      const oe = Math.min(+e1, +e2);
      if (oe < os) return 0;
      return Math.round((oe - os) / msDay) + 1;
    };

    const rows = tenantBills.filter(tb => tb.room).map(tb => {
      const full = tenantMap[tb.tenantId];

      // Determine subsidized: prefer full tenant flag, fall back to $0 fee
      const isSubsidized = full?.isUtilitySubsidized ?? (tb.utilityFee === 0);

      let tenantPeriodDays = periodDays;   // days within billing period
      let awayDays = 0;
      let clampStart = periodStart;
      let clampEnd   = periodEnd;
      let note = '';

      if (full && periodStart && periodEnd) {
        const propAssoc = full.properties?.find(
          p => p.propertyId?.toUpperCase() === this.selectedProperty?.toUpperCase()
        );

        if (!propAssoc) {
          // Tenant is in the bill but has no property association record in their profile
          // (data may be stale or property ID format differs) — include with full period days
          tenantPeriodDays = periodDays;
        } else {
          // Clamp tenant's stay (movein–moveout) to billing period
          const movein   = propAssoc.moveinDate  ? new Date(propAssoc.moveinDate)  : periodStart;
          const moveout  = propAssoc.moveoutDate ? new Date(propAssoc.moveoutDate) : periodEnd;
          movein.setHours(0,0,0,0);
          moveout.setHours(0,0,0,0);

          clampStart = new Date(Math.max(+movein,   +periodStart));
          clampEnd   = new Date(Math.min(+moveout,  +periodEnd));

          if (+clampEnd < +clampStart) {
            tenantPeriodDays = 0;
            note = t('notInPropertyPeriod');
          } else {
            tenantPeriodDays = Math.round((+clampEnd - +clampStart) / msDay) + 1;

            // Mid-period move-in note
            if (+movein > +periodStart) {
              const d = Math.round((+movein - +periodStart) / msDay);
              const moveinLabel = movein.toLocaleDateString('en-SG', { day:'2-digit', month:'short', year:'numeric' });
              note = t('movedInLate', { days: d, date: moveinLabel });
            }
            // Mid-period move-out note
            if (+moveout < +periodEnd) {
              const d = Math.round((+periodEnd - +moveout) / msDay);
              note += (note ? '; ' : '') + t('movedOutEarly', { days: d });
            }
          }

          // Sum away-day leave plans overlapping [clampStart, clampEnd]
          if (tenantPeriodDays > 0) {
            for (const lp of (propAssoc.leavePlans || [])) {
              const lpS = new Date(lp.startDate); lpS.setHours(0,0,0,0);
              const lpE = new Date(lp.endDate);   lpE.setHours(0,0,0,0);
              const ov = daysOverlap(clampStart, clampEnd, lpS, lpE);
              if (ov > 0) {
                awayDays += ov;
              }
            }
          }
        }
      } else if (!periodStart) {
        // No billing period → equal division, use full period
        tenantPeriodDays = 1; // relative weight: all same
        note = t('equalDivision');
      }

      const presentDays = Math.max(0, tenantPeriodDays - awayDays);

      return {
        tenantId: tb.tenantId,
        tenantName: tb.tenantName,
        room: tb.room,
        isSubsidized,
        usesElectricity: full?.usesElectricity ?? true,
        usesWater:       full?.usesWater       ?? true,
        usesGas:         full?.usesGas         ?? true,
        tenantPeriodDays,
        awayDays,
        presentDays,
        note,
        utilityShare: 0,
        chargedAmount: 0,
      };
    });

    // Supplement with tenants who were in the property during the billing period
    // but moved out before the bill was generated (absent from tenantBills entirely).
    if (periodStart && periodEnd) {
      const billedIds = new Set(rows.map(r => r.tenantId));
      for (const ft of fullTenants) {
        const ftId = ft._id?.toString().toUpperCase();
        if (!ftId || billedIds.has(ftId)) continue;
        const propAssoc = ft.properties?.find(
          p => p.propertyId?.toUpperCase() === this.selectedProperty?.toUpperCase()
        );
        if (!propAssoc) continue;
        const room = propAssoc.roomType || propAssoc.room || null;
        if (!room) continue;
        const movein  = propAssoc.moveinDate  ? new Date(propAssoc.moveinDate)  : periodStart;
        const moveout = propAssoc.moveoutDate ? new Date(propAssoc.moveoutDate) : periodEnd;
        movein.setHours(0,0,0,0);
        moveout.setHours(0,0,0,0);
        const cs = new Date(Math.max(+movein, +periodStart));
        const ce = new Date(Math.min(+moveout, +periodEnd));
        if (+ce < +cs) continue; // no overlap with billing period
        const tpd = Math.round((+ce - +cs) / msDay) + 1;
        let extraAwayDays = 0;
        for (const lp of (propAssoc.leavePlans || [])) {
          const lpS = new Date(lp.startDate); lpS.setHours(0,0,0,0);
          const lpE = new Date(lp.endDate);   lpE.setHours(0,0,0,0);
          extraAwayDays += daysOverlap(cs, ce, lpS, lpE);
        }
        const presentDays = Math.max(0, tpd - extraAwayDays);
        let note = t('movedOutNoBill');
        if (+movein > +periodStart) {
          const d = Math.round((+movein - +periodStart) / msDay);
          const moveinLabel = movein.toLocaleDateString('en-SG', { day:'2-digit', month:'short', year:'numeric' });
          note = t('movedInLate', { days: d, date: moveinLabel }) + '; ' + note;
        }
        rows.push({
          tenantId: ftId,
          tenantName: ft.name || ft.fullName || ft.email || ftId,
          room,
          isSubsidized: ft.isUtilitySubsidized ?? false,
          usesElectricity: ft.usesElectricity ?? true,
          usesWater:       ft.usesWater       ?? true,
          usesGas:         ft.usesGas         ?? true,
          tenantPeriodDays: tpd,
          awayDays: extraAwayDays,
          presentDays,
          note,
          utilityShare: 0,
          chargedAmount: 0,
          notBilled: true,
        });
      }
    }

    // Per-type person-day totals (only among eligible tenants for each type).
    // When no type breakdown is available, everything goes into the untyped pool.
    const totalPD      = rows.reduce((s, r) => s + r.presentDays, 0);
    const totalPD_elec = hasTypeBreakdown ? rows.filter(r => r.usesElectricity).reduce((s, r) => s + r.presentDays, 0) : 0;
    const totalPD_water= hasTypeBreakdown ? rows.filter(r => r.usesWater      ).reduce((s, r) => s + r.presentDays, 0) : 0;
    const totalPD_gas  = hasTypeBreakdown ? rows.filter(r => r.usesGas        ).reduce((s, r) => s + r.presentDays, 0) : 0;

    // Overall rate used for the "per day" label in the UI (untyped total / total days)
    const ratePerDay = totalPD > 0 ? netUtility / totalPD : 0;

    rows.forEach(row => {
      const pd = row.presentDays;
      const shareElec  = (hasTypeBreakdown && row.usesElectricity && totalPD_elec  > 0) ? netElec  * (pd / totalPD_elec)  : 0;
      const shareWater = (hasTypeBreakdown && row.usesWater        && totalPD_water > 0) ? netWater * (pd / totalPD_water) : 0;
      const shareGas   = (hasTypeBreakdown && row.usesGas          && totalPD_gas   > 0) ? netGas   * (pd / totalPD_gas)   : 0;
      // Untyped pool (either no breakdown, or residual rounding): divide equally among all tenants
      const shareUntyped = (totalPD > 0) ? netUntyped * (pd / totalPD) : 0;
      row.utilityShare  = shareElec + shareWater + shareGas + shareUntyped;
      // Store per-type breakdown for display
      row._shareElec  = shareElec;
      row._shareWater = shareWater;
      row._shareGas   = shareGas;
      // notBilled tenants: show their calculated share but don't count as charged (bill not issued)
      row.chargedAmount = (row.isSubsidized || row.notBilled) ? 0 : row.utilityShare;
    });

    const totalPersonDays = totalPD;
    const totalCharged    = rows.reduce((s, r) => s + r.chargedAmount, 0);
    const businessAbsorbs = rows.filter(r => r.isSubsidized).reduce((s, r) => s + r.utilityShare, 0);
    const notBilledAbsorbs = rows.filter(r => r.notBilled && !r.isSubsidized).reduce((s, r) => s + r.utilityShare, 0);

    return { rows, totalPersonDays, ratePerDay, totalCharged, businessAbsorbs, notBilledAbsorbs,
             grossUtility, landlordSubsidy, netUtility,
             hasTypeBreakdown, netElec, netWater, netGas, netUntyped };
  }

  _buildBreakdownHtml(bd, periodStart, periodEnd, periodDays, propInfo, exchangeRate) {
    const { rows, totalPersonDays, ratePerDay, totalCharged, businessAbsorbs, notBilledAbsorbs,
            grossUtility, landlordSubsidy, netUtility,
            hasTypeBreakdown, netElec, netWater, netGas } = bd;
    const fmtDate = v => v ? new Date(v).toLocaleDateString('en-SG', { day:'2-digit', month:'short', year:'numeric' }) : '—';
    const fmtAmt  = v => `$${v.toFixed(2)}`;
    const getRoomLabel = room => {
      if (!room) return '—';
      if (typeof getRoomTypeDisplayName === 'function') return getRoomTypeDisplayName(room);
      return room;
    };

    const year  = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const periodLabel = periodStart && periodEnd
      ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)} (${periodDays} ${t('days')})`
      : t('billingPeriodNotSet');

    const noPeriod = !periodStart;

    // Sort rows so tenants sharing the same room appear together
    const sortedRows = [...rows].sort((a, b) => (a.room || '').localeCompare(b.room || ''));

    const tableRows = sortedRows.map((r, i) => {
      const shareTypeLines = hasTypeBreakdown ? [
        r.usesElectricity && r._shareElec  > 0.005 ? `⚡ ${fmtAmt(r._shareElec)}`  : null,
        r.usesWater       && r._shareWater > 0.005 ? `💧 ${fmtAmt(r._shareWater)}` : null,
        r.usesGas         && r._shareGas   > 0.005 ? `🔥 ${fmtAmt(r._shareGas)}`   : null,
      ].filter(Boolean) : [];
      const shareCell  = noPeriod
        ? fmtAmt(r.utilityShare)
        : `${fmtAmt(r.utilityShare)}<br><span style="font-size:0.72rem;color:#6c757d;">${r.presentDays}d × ${fmtAmt(ratePerDay)}/d</span>${
            shareTypeLines.length ? `<br><span style="font-size:0.68rem;color:#868e96;">${shareTypeLines.join(' · ')}</span>` : ''
          }`;
      const daysCells  = noPeriod ? '' : `
        <td style="padding:7px 10px;text-align:center;">${r.tenantPeriodDays}</td>
        <td style="padding:7px 10px;text-align:center;">${r.awayDays > 0 ? `<span style="color:#dc3545;">−${r.awayDays}</span>` : '0'}</td>
        <td style="padding:7px 10px;text-align:center;font-weight:600;">${r.presentDays}</td>`;
      const subsidyBadge = r.isSubsidized
        ? `<span style="background:#fff3cd;color:#856404;border-radius:4px;padding:1px 6px;font-size:0.72rem;">${t('subsidisedBadge')}</span>`
        : '';
      const notBilledBadge = r.notBilled
        ? `<span style="background:#f8d7da;color:#842029;border-radius:4px;padding:1px 6px;font-size:0.72rem;">${t('notBilledBadge')}</span>`
        : '';
      const chargedStyle = r.isSubsidized
        ? 'color:#6c757d;text-decoration:line-through;'
        : r.notBilled
          ? 'color:#6c757d;font-style:italic;'
          : 'font-weight:700;color:#0d6efd;';
      const noteCell = r.note
        ? `<br><span style="font-size:0.7rem;color:#6c757d;">${escapeHtml(r.note)}</span>`
        : '';

      return `<tr style="border-bottom:1px solid #dee2e6;${r.notBilled ? 'opacity:0.8;' : ''}">
        <td style="padding:7px 10px;font-weight:600;">${i+1}. ${escapeHtml(r.tenantName)}${noteCell}</td>
        <td style="padding:7px 10px;">${escapeHtml(getRoomLabel(r.room))}</td>
        ${daysCells}
        <td style="padding:7px 10px;text-align:right;">${shareCell}</td>
        <td style="padding:7px 10px;text-align:right;">
          <span style="${chargedStyle}">${r.notBilled ? fmtAmt(r.utilityShare) : fmtAmt(r.chargedAmount)}</span>
          ${r.isSubsidized ? '<br>' + subsidyBadge : ''}
          ${r.notBilled ? '<br>' + notBilledBadge : ''}
        </td>
      </tr>`;
    }).join('');

    const dayHeaders = noPeriod ? '' : `
      <th style="${thStyle}text-align:center;">Period<br>Days</th>
      <th style="${thStyle}text-align:center;">Away<br>Days</th>
      <th style="${thStyle}text-align:center;">Present<br>Days</th>`;

    const thStyle = 'padding:8px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.82rem;';

    const subsidizedCount = rows.filter(r => r.isSubsidized).length;
    const awayCount = rows.filter(r => r.awayDays > 0).length;

    const typeBreakNote = hasTypeBreakdown
      ? `<p style="margin:4px 0;font-size:0.88rem;">⚡ ${fmtAmt(netElec)} ÷ eligible tenants &nbsp;·&nbsp; 💧 ${fmtAmt(netWater)} ÷ eligible tenants &nbsp;·&nbsp; 🔥 ${fmtAmt(netGas)} ÷ eligible tenants</p>`
      : '';
    const methodNote = noPeriod
      ? `<p style="margin:4px 0;color:#856404;">${t('noBillingPeriodNote')}</p>`
      : `<p style="margin:4px 0;">${t('formula')} <strong>${fmtAmt(netUtility)} ÷ ${totalPersonDays} ${t('personDays')} = ${fmtAmt(ratePerDay)}${t('perPersonDay')}</strong></p>
         ${typeBreakNote}
         ${landlordSubsidy > 0 ? `<p style="margin:4px 0;">${t('landlordSubsidyNote', { amount: fmtAmt(landlordSubsidy) })}</p>` : ''}
         ${subsidizedCount > 0 ? `<p style="margin:4px 0;">${t('subsidisedTenantsNote', { count: subsidizedCount, amount: fmtAmt(businessAbsorbs) })}</p>` : ''}
         ${awayCount > 0 ? `<p style="margin:4px 0;">${t('awayNote')}</p>` : ''}`;

    // Re-declare thStyle for the actual table header
    const th = s => `<th style="padding:8px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.82rem;${s||''}">${s===undefined?'':''}</th>`;

    // Settlement info section (included in print area / export)
    const sgd = propInfo?.settlementSgd;
    const vnd = propInfo?.settlementVnd;
    const settlementHtml = (sgd?.bankName || vnd?.bankName) ? `
      <div style="padding:14px 20px;border-top:1px solid #dee2e6;background:#f8f9fa;">
        <div style="font-size:0.95rem;font-weight:700;margin-bottom:10px;color:#495057;">
          <i class="bi bi-bank me-1"></i>${t('settlementInfo')}
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${sgd?.bankName ? `
          <div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:10px 16px;min-width:220px;flex:1;">
            <div style="font-size:0.82rem;color:#6c757d;margin-bottom:4px;">SGD</div>
            <div style="font-size:0.95rem;font-weight:600;">${escapeHtml(sgd.bankName)}</div>
            ${sgd.accountNumber ? `<div style="font-size:0.95rem;">${escapeHtml(sgd.accountNumber)}</div>` : ''}
            ${sgd.accountHolderName ? `<div style="font-size:0.88rem;color:#495057;">${escapeHtml(sgd.accountHolderName)}</div>` : ''}
          </div>` : ''}
          ${vnd?.bankName ? `
          <div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:10px 16px;min-width:220px;flex:1;">
            <div style="font-size:0.82rem;color:#6c757d;margin-bottom:4px;">VND
              ${exchangeRate ? `<span style="margin-left:8px;background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 7px;font-size:0.8rem;font-weight:600;">1 SGD = ${Number(exchangeRate).toLocaleString('vi-VN')} VND</span>` : ''}
            </div>
            <div style="font-size:0.95rem;font-weight:600;">${escapeHtml(vnd.bankName)}</div>
            ${vnd.accountNumber ? `<div style="font-size:0.95rem;">${escapeHtml(vnd.accountNumber)}</div>` : ''}
            ${vnd.accountHolderName ? `<div style="font-size:0.88rem;color:#495057;">${escapeHtml(vnd.accountHolderName)}</div>` : ''}
          </div>` : ''}
        </div>
      </div>` : '';

    return `
      <div id="utilityBreakdownPrintArea" style="font-family:'Noto Serif',serif;padding:20px;background:#fff;">

        <!-- Header -->
        <div style="border-bottom:3px solid #0d6efd;padding-bottom:10px;margin-bottom:12px;">
          <h5 style="margin:0;color:#0d6efd;font-size:1.15rem;">
            ⚡ ${t('breakdownHeading', { month: monthName(month), year })}
          </h5>
          <div style="color:#495057;font-size:0.95rem;margin-top:4px;">
            ${t('property')}: <strong>${escapeHtml(
              propInfo
                ? [propInfo.unit, propInfo.address, propInfo.postcode ? `S(${propInfo.postcode})` : ''].filter(Boolean).join(', ')
                : this.selectedProperty
            )}</strong> &nbsp;|&nbsp;
            ${t('billingPeriod')}: <strong>${periodLabel}</strong>
          </div>
          <div style="color:#495057;font-size:0.95rem;margin-top:2px;">
            ${t('spGroupBill')}: <strong>${fmtAmt(grossUtility)}</strong>
            ${landlordSubsidy > 0 ? `&nbsp;−&nbsp;${t('landlordSubsidy')}: <strong>${fmtAmt(landlordSubsidy)}</strong>&nbsp;=&nbsp;<strong style="color:#198754;">${fmtAmt(netUtility)} ${t('toDistribute')}</strong>` : ''}
          </div>
        </div>

        <!-- Method note -->
        <div style="background:#f8f9fa;border-left:4px solid #0d6efd;padding:8px 14px;margin-bottom:12px;font-size:0.92rem;border-radius:0 4px 4px 0;">
          <strong>${t('howItsCalculated')}</strong><br>
          ${methodNote}
        </div>

        <!-- Table -->
        <table style="width:100%;border-collapse:collapse;font-size:0.95rem;">
          <thead>
            <tr>
              <th style="padding:7px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.9rem;">${t('tenant')}</th>
              <th style="padding:7px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.9rem;">${t('room')}</th>
              ${noPeriod ? '' : `
              <th style="padding:7px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.9rem;text-align:center;">${t('periodDaysHeader').replace('\n','<br>')}</th>
              <th style="padding:7px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.9rem;text-align:center;">${t('awayDaysHeader').replace('\n','<br>')}</th>
              <th style="padding:7px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.9rem;text-align:center;">${t('presentDaysHeader').replace('\n','<br>')}</th>`}
              <th style="padding:7px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.9rem;text-align:right;">${t('calcShare')}</th>
              <th style="padding:7px 10px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.9rem;text-align:right;">${t('charged')}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <!-- Totals row -->
            <tr style="background:#f8f9fa;border-top:2px solid #dee2e6;">
              <td style="padding:7px 10px;font-weight:700;" colspan="2">${t('totalRow')}</td>
              ${noPeriod ? '' : `
              <td style="padding:7px 10px;text-align:center;font-weight:700;">—</td>
              <td style="padding:7px 10px;text-align:center;font-weight:700;">—</td>
              <td style="padding:7px 10px;text-align:center;font-weight:700;">${totalPersonDays}d</td>`}
              <td style="padding:7px 10px;text-align:right;font-weight:700;">${fmtAmt(netUtility)}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700;color:#0d6efd;">${fmtAmt(totalCharged)}</td>
            </tr>
          </tbody>
        </table>

        <!-- Footer summary -->
        <div style="margin-top:12px;display:flex;gap:14px;flex-wrap:wrap;font-size:0.92rem;">
          <div style="background:#d1ecf1;border-radius:6px;padding:7px 14px;">
            <strong>${t('totalBilledToTenants')}</strong> ${fmtAmt(totalCharged)}
          </div>
          ${(landlordSubsidy > 0 || businessAbsorbs > 0.005) ? `
          <div style="background:#fff3cd;border-radius:6px;padding:7px 14px;">
            <strong>${t('landlordAbsorbs')}</strong> ${fmtAmt(landlordSubsidy + businessAbsorbs)}
            ${landlordSubsidy > 0 && businessAbsorbs > 0.005
              ? `<br><span style="font-size:0.82rem;color:#856404;">${t('fixedSubsidy')} ${fmtAmt(landlordSubsidy)} + ${t('subsidisedTenantsShare')} ${fmtAmt(businessAbsorbs)}</span>`
              : landlordSubsidy > 0
                ? `<br><span style="font-size:0.82rem;color:#856404;">${t('fixedSubsidy')} ${fmtAmt(landlordSubsidy)}</span>`
                : `<br><span style="font-size:0.82rem;color:#856404;">${t('subsidisedTenantsShare')} ${fmtAmt(businessAbsorbs)}</span>`
            }
          </div>` : ''}
          ${notBilledAbsorbs > 0.005 ? `
          <div style="background:#f8d7da;border-radius:6px;padding:7px 14px;">
            <strong>${t('notBilledBadge')}</strong> ${fmtAmt(notBilledAbsorbs)}
            <br><span style="font-size:0.82rem;color:#842029;">${t('movedOutNoBill')}</span>
          </div>` : ''}
          ${Math.abs(grossUtility - totalCharged - landlordSubsidy - businessAbsorbs - notBilledAbsorbs) > 0.02 ? `
          <div style="background:#f8d7da;border-radius:6px;padding:7px 14px;">
            <strong>${t('roundingDiff')}</strong> ${fmtAmt(Math.abs(grossUtility - totalCharged - landlordSubsidy - businessAbsorbs - notBilledAbsorbs))}
          </div>` : ''}
        </div>

        ${settlementHtml}

      </div>`;
  }

  _renderBreakdownModal(bodyHtml) {
    // If modal already exists, just update the body content in-place
    // (avoids removing a live modal element which orphans the Bootstrap backdrop)
    const existingBody = document.getElementById('utilityBreakdownModalBody');
    if (existingBody) {
      existingBody.innerHTML = bodyHtml;
      return;
    }

    const html = `
      <div class="modal fade" id="utilityBreakdownModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-scrollable" style="max-width:min(1100px,96vw);">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title mb-0">
                <i class="bi bi-calculator me-2 text-primary"></i>${t('utilityBreakdownTitle')}
              </h6>
              <div class="d-flex align-items-center gap-2 ms-auto me-2">
                <button class="btn btn-sm btn-outline-primary" onclick="billManager.showUtilityBreakdownModal()" title="${t('refresh')}">
                  <i class="bi bi-arrow-clockwise me-1"></i>${t('refresh')}
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="billManager._copyBreakdownToClipboard()" title="${t('copyToClipboard')}">
                  <i class="bi bi-clipboard me-1"></i>${t('copyToClipboard')}
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="billManager._downloadBreakdownImage()" title="${t('saveImage')}">
                  <i class="bi bi-download me-1"></i>${t('saveImage')}
                </button>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-0" id="utilityBreakdownModalBody">
              ${bodyHtml}
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const modalEl = document.getElementById('utilityBreakdownModal');
    // Remove from DOM only after Bootstrap fully hides it (cleans up backdrop)
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  async _renderBreakdownCanvas() {
    const area = document.getElementById('utilityBreakdownPrintArea');
    if (!area) return null;
    if (typeof html2canvas === 'undefined') {
      showToast(t('html2canvasNotLoaded'), 'warning');
      return null;
    }
    return html2canvas(area, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  }

  async _copyBreakdownToClipboard() {
    try {
      showToast(t('generatingImage'), 'info');
      const canvas = await this._renderBreakdownCanvas();
      if (!canvas) return;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast(t('imageCopied'), 'success');
    } catch (err) {
      console.error('Clipboard error:', err);
      showToast(t('imageCopyFailed'), 'error');
    }
  }

  async _downloadBreakdownImage() {
    try {
      showToast(t('generatingImage'), 'info');
      const canvas = await this._renderBreakdownCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      const year  = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;
      link.download = `utility-breakdown-${this.selectedProperty}-${year}-${String(month).padStart(2,'0')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast(t('imageSaved'), 'success');
    } catch (err) {
      console.error('Download error:', err);
      showToast(t('imageFailed'), 'error');
    }
  }
}

// Export for use in other modules
window.BillManagementComponent = BillManagementComponent;
