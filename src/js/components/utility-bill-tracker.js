/**
 * Utility Bill Tracker Component
 * Tracks SP Group (electricity, water, gas) bills per property per month.
 * Uses Chart.js for monthly trend charts and backend OCR to parse bill images.
 */
class UtilityBillTrackerComponent {
  constructor() {
    this.properties = [];
    this.selectedProperty = null;
    this.bills = [];
    this.editingBillId = null;
    this.chart = null;
    this._init();
  }

  _init() {
    this._bindEvents();
    this._loadProperties();
  }

  _bindEvents() {
    const form = document.getElementById('utilityBillForm');
    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); this._saveBill(); });
    }

    const imageInput = document.getElementById('utilityBillImageInput');
    if (imageInput) {
      imageInput.addEventListener('change', (e) => this._handleImageSelected(e));
    }

    const dropZone = document.getElementById('utilityBillDropZone');
    if (dropZone) {
      dropZone.addEventListener('click', () => document.getElementById('utilityBillImageInput')?.click());
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file) this._processImageFile(file);
      });
    }
  }

  async _loadProperties() {
    try {
      let allProperties = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await API.get(`${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${page}&limit=50`);
        const data = await res.json();
        if (data.success) {
          allProperties = allProperties.concat(data.properties || []);
          hasMore = data.pagination && page < data.pagination.totalPages;
          page++;
        } else {
          hasMore = false;
        }
      }
      this.properties = allProperties;
      this._renderPropertyCards();
    } catch (err) {
      console.error('[UtilityBillTracker] load properties error:', err);
      this._renderPropertyCards();
    }
  }

  _renderPropertyCards() {
    const container = document.getElementById('utilityBillPropertyCards');
    if (!container) return;

    if (!this.properties.length) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-building-slash me-2"></i>No properties available
        </div>`;
      return;
    }

    container.innerHTML = this.properties.map(p => {
      const sel = this.selectedProperty === p.propertyId;
      return `
        <div class="col-6 col-sm-4 col-md-3 col-lg-2 mb-3">
          <div class="card utility-prop-card h-100 ${sel ? 'border-primary selected' : ''}"
               style="cursor:pointer;transition:all .2s ease;"
               onclick="utilityBillTracker.selectProperty('${p.propertyId}')">
            ${p.propertyImage ? `
            <div class="card-img-top position-relative" style="height:100px;background-image:url('${p.propertyImage}');background-size:cover;background-position:center;">
              ${sel ? '<div class="position-absolute top-0 end-0 p-1"><i class="bi bi-check-circle-fill text-success bg-white rounded-circle" style="font-size:1.2rem;"></i></div>' : ''}
            </div>` : ''}
            <div class="card-body p-2">
              <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white flex-shrink-0"
                     style="width:32px;height:32px;font-size:11px;font-weight:bold;">
                  ${escapeHtml(p.propertyId.substring(0, 2).toUpperCase())}
                </div>
                <div class="overflow-hidden">
                  <div class="fw-bold small text-truncate">${escapeHtml(p.propertyId)}</div>
                  <div class="text-muted" style="font-size:0.7rem;" title="${escapeHtml(p.address)}">${escapeHtml(p.address || '')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  async selectProperty(propertyId) {
    if (this.selectedProperty === propertyId) return;
    this.selectedProperty = propertyId;
    this._renderPropertyCards();
    await this._loadBills();
  }

  async _loadBills() {
    if (!this.selectedProperty) return;
    try {
      const res = await API.get(API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(this.selectedProperty));
      const data = await res.json();
      if (data.success) {
        this.bills = data.bills || [];
      } else {
        this.bills = [];
      }
    } catch (err) {
      console.error('[UtilityBillTracker] load bills error:', err);
      this.bills = [];
    }
    this._renderChart();
    this._renderBillsTable();
    this._showAddForm(false);
    document.getElementById('utilityBillContent')?.removeAttribute('hidden');
  }

  // ── Chart ──────────────────────────────────────────────────────────────────

  _renderChart() {
    const canvas = document.getElementById('utilityBillChart');
    if (!canvas) return;

    // Build last-12-months dataset
    const now = new Date();
    const labels = [];
    const elecData = [];
    const waterData = [];
    const gasData = [];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      labels.push(`${monthNames[mo - 1]} ${yr}`);
      const bill = this.bills.find(b => b.year === yr && b.month === mo);
      elecData.push(bill ? bill.electricityAmount : null);
      waterData.push(bill ? bill.waterAmount : null);
      gasData.push(bill ? (bill.gasAmount + bill.refuseAmount + bill.otherAmount) : null);
    }

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Electricity ($)',
            data: elecData,
            backgroundColor: 'rgba(255, 193, 7, 0.85)',
            borderColor: 'rgba(255, 193, 7, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Water ($)',
            data: waterData,
            backgroundColor: 'rgba(13, 202, 240, 0.85)',
            borderColor: 'rgba(13, 202, 240, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
          {
            label: 'Gas & Others ($)',
            data: gasData,
            backgroundColor: 'rgba(108, 117, 125, 0.75)',
            borderColor: 'rgba(108, 117, 125, 1)',
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed.y;
                return v != null ? `${ctx.dataset.label}: $${v.toFixed(2)}` : `${ctx.dataset.label}: —`;
              },
              footer: (items) => {
                const sum = items.reduce((s, i) => s + (i.parsed.y || 0), 0);
                return `Total: $${sum.toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: { stacked: false, grid: { display: false } },
          y: {
            stacked: false,
            beginAtZero: true,
            ticks: { callback: (v) => `$${v}` },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    });
  }

  // ── Bills table ────────────────────────────────────────────────────────────

  _renderBillsTable() {
    const container = document.getElementById('utilityBillsTableContainer');
    if (!container) return;

    if (!this.bills.length) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-receipt fs-1 d-block mb-2"></i>
          <p>No bills recorded yet. Upload your first SP Group bill above.</p>
        </div>`;
      return;
    }

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const fmtDate = (val) => {
      if (!val) return '—';
      const d = new Date(val);
      return d.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
    };
    const fmtPeriod = (b) => {
      if (!b.billingPeriodStart && !b.billingPeriodEnd) return '—';
      const start = b.billingPeriodStart ? fmtDate(b.billingPeriodStart) : '?';
      const end = b.billingPeriodEnd ? fmtDate(b.billingPeriodEnd) : '?';
      return `${start} – ${end}`;
    };

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle" style="font-size:0.88rem;">
          <thead class="table-light">
            <tr>
              <th>Month</th>
              <th>Billing Period</th>
              <th>Bill Date</th>
              <th class="text-end"><i class="bi bi-lightning-charge-fill text-warning me-1"></i>Electricity</th>
              <th class="text-end"><i class="bi bi-droplet-fill text-info me-1"></i>Water</th>
              <th class="text-end"><i class="bi bi-fire text-secondary me-1"></i>Gas & Others</th>
              <th class="text-end fw-bold">Total</th>
              <th class="text-center">Bill</th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.bills.map(b => {
              const gasOther = (b.gasAmount || 0) + (b.refuseAmount || 0) + (b.otherAmount || 0);
              return `
                <tr>
                  <td class="fw-semibold text-nowrap">${monthNames[(b.month || 1) - 1]} ${b.year}</td>
                  <td class="text-nowrap text-muted small">${fmtPeriod(b)}</td>
                  <td class="text-nowrap text-muted small">${fmtDate(b.billDate)}</td>
                  <td class="text-end">$${(b.electricityAmount || 0).toFixed(2)}</td>
                  <td class="text-end">$${(b.waterAmount || 0).toFixed(2)}</td>
                  <td class="text-end">$${gasOther.toFixed(2)}</td>
                  <td class="text-end fw-bold text-primary">$${(b.totalAmount || 0).toFixed(2)}</td>
                  <td class="text-center">
                    ${b.billImageUrl
                      ? `<a href="${b.billImageUrl}" target="_blank" class="btn btn-sm btn-outline-secondary py-0 px-1" title="View bill image"><i class="bi bi-image"></i></a>`
                      : '<span class="text-muted small">—</span>'}
                  </td>
                  <td class="text-center text-nowrap">
                    <button class="btn btn-sm btn-outline-primary py-0 px-1 me-1" onclick="utilityBillTracker.editBill('${b._id}')" title="Edit"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="utilityBillTracker.deleteBill('${b._id}')" title="Delete"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ── Add / Edit form ────────────────────────────────────────────────────────

  _showAddForm(show = true) {
    const panel = document.getElementById('utilityBillFormPanel');
    if (panel) panel.hidden = !show;
    if (!show) {
      this.editingBillId = null;
      this._resetForm();
    }
  }

  showNewBillForm() {
    if (!this.selectedProperty) {
      alert('Please select a property first.');
      return;
    }
    this.editingBillId = null;
    this._resetForm();
    this._showAddForm(true);
    document.getElementById('utilityBillFormPanel')?.scrollIntoView({ behavior: 'smooth' });
  }

  editBill(billId) {
    const bill = this.bills.find(b => b._id === billId);
    if (!bill) return;
    this.editingBillId = billId;
    this._showAddForm(true);
    this._populateForm(bill);
    document.getElementById('utilityBillFormPanel')?.scrollIntoView({ behavior: 'smooth' });
  }

  _resetForm() {
    const form = document.getElementById('utilityBillForm');
    if (form) form.reset();
    document.getElementById('utilityBillFormTitle').textContent = 'Add New Bill';
    document.getElementById('utilityOcrSection')?.removeAttribute('hidden');
    this._clearImagePreview();
    this._hideOcrResult();
    // Default year/month to current
    const now = new Date();
    const yearEl = document.getElementById('utilityBillYear');
    const monthEl = document.getElementById('utilityBillMonth');
    if (yearEl) yearEl.value = now.getFullYear();
    if (monthEl) monthEl.value = now.getMonth() + 1;
  }

  _populateForm(bill) {
    document.getElementById('utilityBillFormTitle').textContent = 'Edit Bill';
    document.getElementById('utilityOcrSection')?.setAttribute('hidden', '');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('utilityBillYear', bill.year);
    set('utilityBillMonth', bill.month);
    set('utilityBillAccountNo', bill.accountNumber || '');
    set('utilityElectricity', bill.electricityAmount || '');
    set('utilityWater', bill.waterAmount || '');
    set('utilityGas', bill.gasAmount || '');
    set('utilityRefuse', bill.refuseAmount || '');
    set('utilityOther', bill.otherAmount || '');
    set('utilityTotal', bill.totalAmount || '');
    set('utilityBillNotes', bill.notes || '');
    const toInputDate = (dateVal) => {
      if (!dateVal) return '';
      const d = new Date(dateVal);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    set('utilityBillDate', toInputDate(bill.billDate));
    set('utilityBillingPeriodStart', toInputDate(bill.billingPeriodStart));
    set('utilityBillingPeriodEnd', toInputDate(bill.billingPeriodEnd));
  }

  // ── Image / OCR ────────────────────────────────────────────────────────────

  _handleImageSelected(e) {
    const file = e.target.files?.[0];
    if (file) this._processImageFile(file);
  }

  _processImageFile(file) {
    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById('utilityBillImagePreview');
      if (preview) {
        preview.src = ev.target.result;
        preview.hidden = false;
      }
      document.getElementById('utilityBillDropZone')?.classList.add('has-image');
    };
    reader.readAsDataURL(file);

    // Auto-run OCR
    this._runOcr(file);
  }

  async _runOcr(file) {
    const ocrStatus = document.getElementById('utilityOcrStatus');
    const ocrResultBox = document.getElementById('utilityOcrResult');

    if (ocrStatus) {
      ocrStatus.hidden = false;
      ocrStatus.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Parsing bill with OCR…`;
    }
    if (ocrResultBox) ocrResultBox.hidden = true;

    try {
      const formData = new FormData();
      formData.append('billImage', file);

      const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UTILITY_BILL_PARSE_OCR}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'OCR failed');

      const parsed = data.data;
      if (ocrStatus) ocrStatus.hidden = true;
      this._showOcrResult(parsed, data.rawText);
      this._fillFormFromOcr(parsed);
    } catch (err) {
      console.error('[UtilityBillTracker] OCR error:', err);
      if (ocrStatus) {
        ocrStatus.innerHTML = `<i class="bi bi-exclamation-triangle text-warning me-1"></i>OCR could not parse the bill automatically. Please fill in the fields manually.`;
      }
    }
  }

  _showOcrResult(parsed, rawText) {
    const box = document.getElementById('utilityOcrResult');
    if (!box) return;
    box.hidden = false;

    const row = (label, val) => {
      if (val == null) return '';
      return `<div class="d-flex justify-content-between py-1 border-bottom">
        <span class="text-muted small">${label}</span>
        <span class="fw-semibold small">${escapeHtml(String(val))}</span>
      </div>`;
    };

    box.innerHTML = `
      <div class="alert alert-success py-2 mb-2">
        <i class="bi bi-check-circle me-1"></i><strong>OCR Complete</strong> — values filled below. Please verify before saving.
        ${parsed.validationNote ? `<br><small class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(parsed.validationNote)}</small>` : ''}
      </div>
      <div class="border rounded p-2 bg-light mb-2" style="font-size:0.85rem;">
        ${row('Account No.', parsed.accountNumber)}
        ${row('Billing Period', parsed.billingPeriodStart ? `${parsed.billingPeriodStart}${parsed.billingPeriodEnd ? ' – ' + parsed.billingPeriodEnd : ''}` : null)}
        ${row('Bill Date', parsed.billDate)}
        ${row('Electricity', parsed.electricityAmount != null ? `$${parsed.electricityAmount.toFixed(2)}` : null)}
        ${row('Water', parsed.waterAmount != null ? `$${parsed.waterAmount.toFixed(2)}` : null)}
        ${row('Gas', parsed.gasAmount != null ? `$${parsed.gasAmount.toFixed(2)}` : null)}
        ${row('Refuse Removal', parsed.refuseAmount != null ? `$${parsed.refuseAmount.toFixed(2)}` : null)}
        ${row('Total Payable', parsed.totalAmount != null ? `$${parsed.totalAmount.toFixed(2)}` : null)}
      </div>`;
  }

  _hideOcrResult() {
    const box = document.getElementById('utilityOcrResult');
    if (box) box.hidden = true;
    const status = document.getElementById('utilityOcrStatus');
    if (status) { status.hidden = true; status.innerHTML = ''; }
  }

  _clearImagePreview() {
    const preview = document.getElementById('utilityBillImagePreview');
    if (preview) { preview.src = ''; preview.hidden = true; }
    document.getElementById('utilityBillDropZone')?.classList.remove('has-image');
    const input = document.getElementById('utilityBillImageInput');
    if (input) input.value = '';
  }

  _fillFormFromOcr(parsed) {
    const setIfNotEmpty = (id, val) => {
      if (val == null) return;
      const el = document.getElementById(id);
      if (el && !el.value) el.value = val;
    };
    const setAlways = (id, val) => {
      if (val == null) return;
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    // Convert "03 Mar 2026" → "2026-03-03" for <input type="date">
    const toInputDate = (str) => {
      if (!str) return null;
      const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
      const m = str.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
      if (!m) return null;
      const mo = months[m[2].toLowerCase()];
      if (!mo) return null;
      return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    };

    if (parsed.billYear) setAlways('utilityBillYear', parsed.billYear);
    if (parsed.billMonth) setAlways('utilityBillMonth', parsed.billMonth);
    setIfNotEmpty('utilityBillAccountNo', parsed.accountNumber);
    if (parsed.billDate) setAlways('utilityBillDate', toInputDate(parsed.billDate));
    if (parsed.billingPeriodStart) setAlways('utilityBillingPeriodStart', toInputDate(parsed.billingPeriodStart));
    if (parsed.billingPeriodEnd) setAlways('utilityBillingPeriodEnd', toInputDate(parsed.billingPeriodEnd));
    if (parsed.electricityAmount != null) setAlways('utilityElectricity', parsed.electricityAmount.toFixed(2));
    if (parsed.waterAmount != null) setAlways('utilityWater', parsed.waterAmount.toFixed(2));
    if (parsed.gasAmount != null) setAlways('utilityGas', parsed.gasAmount.toFixed(2));
    if (parsed.refuseAmount != null) setAlways('utilityRefuse', parsed.refuseAmount.toFixed(2));
    if (parsed.totalAmount != null) setAlways('utilityTotal', parsed.totalAmount.toFixed(2));
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async _saveBill() {
    if (!this.selectedProperty) { alert('No property selected.'); return; }

    const year = parseInt(document.getElementById('utilityBillYear')?.value || '0');
    const month = parseInt(document.getElementById('utilityBillMonth')?.value || '0');
    if (!year || !month || month < 1 || month > 12) {
      alert('Please enter a valid year and month.');
      return;
    }

    const submitBtn = document.getElementById('utilityBillSubmitBtn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving…'; }

    try {
      const formData = new FormData();
      formData.append('year', year);
      formData.append('month', month);

      const fields = [
        ['utilityBillAccountNo', 'accountNumber'],
        ['utilityBillDate', 'billDate'],
        ['utilityBillingPeriodStart', 'billingPeriodStart'],
        ['utilityBillingPeriodEnd', 'billingPeriodEnd'],
        ['utilityElectricity', 'electricityAmount'],
        ['utilityWater', 'waterAmount'],
        ['utilityGas', 'gasAmount'],
        ['utilityRefuse', 'refuseAmount'],
        ['utilityOther', 'otherAmount'],
        ['utilityTotal', 'totalAmount'],
        ['utilityBillNotes', 'notes'],
      ];
      for (const [elId, key] of fields) {
        const val = document.getElementById(elId)?.value?.trim();
        if (val) formData.append(key, val);
      }

      // Attach image file if new
      const imageInput = document.getElementById('utilityBillImageInput');
      if (imageInput?.files?.[0]) {
        formData.append('billImage', imageInput.files[0]);
      }

      let res;
      if (this.editingBillId) {
        // PUT updates don't support FormData (no new image in edit mode via PUT)
        // Re-create as upsert via POST instead
        res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UTILITY_BILL_CREATE(this.selectedProperty)}`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      } else {
        res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UTILITY_BILL_CREATE(this.selectedProperty)}`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save bill');

      this._showAddForm(false);
      await this._loadBills();
      this._showToast('Bill saved successfully!', 'success');
    } catch (err) {
      console.error('[UtilityBillTracker] save error:', err);
      alert('Failed to save bill: ' + err.message);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="bi bi-floppy me-1"></i>Save Bill'; }
    }
  }

  async deleteBill(billId) {
    if (!confirm('Delete this utility bill record? This cannot be undone.')) return;
    try {
      const res = await API.delete(API_CONFIG.ENDPOINTS.UTILITY_BILL_DELETE(billId));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      await this._loadBills();
      this._showToast('Bill deleted.', 'info');
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  }

  // ── Toast helper ───────────────────────────────────────────────────────────

  _showToast(message, type = 'success') {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      // Fallback inline toast
      const toastEl = document.getElementById('utilityBillToast');
      if (!toastEl) return;
      toastEl.className = `toast align-items-center text-bg-${type === 'success' ? 'success' : 'secondary'} border-0`;
      toastEl.querySelector('.toast-body').textContent = message;
      const bsToast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3000 });
      bsToast.show();
    }
  }
}

window.UtilityBillTrackerComponent = UtilityBillTrackerComponent;
