/**
 * Utility Bill Tracker Component
 * Tracks SP Group (electricity, water, gas) bills per property per month.
 * Uses Chart.js for monthly trend charts and backend OCR to parse bill images.
 */
import i18next from "../i18n.js";
import { getGroupLinkMeta } from "../utils/social-links.js";
import {
  fetchInvestorsForAvatarStack,
  renderPropertyImageAvatarBadge,
} from "../utils/investor-avatar-stack.js";

class UtilityBillTrackerComponent {
  constructor() {
    this.properties = [];
    this.selectedProperty = null;
    this.bills = [];
    this.tenants = []; // Tenants for selected property (including leavePlans)
    this.editingBillId = null;
    this.chart = null;
    this.monthlyBillStatus = {}; // { propertyId: boolean }
    this._slugResolvedProperty = null; // set transiently by router for deep-link resolution
    this.allSelected = false;
    this._allCharts = [];
    this.propertySubsidy = 0;
    const now = new Date();
    this.summaryYear = now.getFullYear();
    this.summaryMonth = now.getMonth() + 1;
    this.calendarYear = now.getFullYear();
    this.calendarMonth = now.getMonth() + 1;
    this._avatarInvestors = []; // Investors list (with linked properties) for the card image avatar badge
    this._init();
  }

  _init() {
    this._bindEvents();
    this._loadProperties();
    fetchInvestorsForAvatarStack().then((investors) => {
      this._avatarInvestors = investors;
      this._renderPropertyCards();
    });
  }

  _bindEvents() {
    const form = document.getElementById('utilityBillForm');
    if (form) {
      form.addEventListener('submit', (e) => { e.preventDefault(); this._saveBill(); });
    }

    const imageInput = document.getElementById('utilityBillImageInput');
    if (imageInput) {
      imageInput.accept = 'image/jpeg,image/png,image/heic,image/heif,application/pdf,.pdf';
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
        if (file) this._processBillFile(file);
      });
    }

    const quickDrop = document.getElementById('utilityQuickDropZone');
    if (quickDrop) {
      quickDrop.addEventListener('click', () => {
        if (document.getElementById('utilityQdzIdle')?.hidden) return; // only clickable in idle
        document.getElementById('utilityQuickDropInput')?.click();
      });
      quickDrop.addEventListener('dragover', (e) => {
        e.preventDefault();
        quickDrop.classList.add('qdz-drag-active');
      });
      quickDrop.addEventListener('dragleave', (e) => {
        if (!quickDrop.contains(e.relatedTarget)) quickDrop.classList.remove('qdz-drag-active');
      });
      quickDrop.addEventListener('drop', (e) => {
        e.preventDefault();
        quickDrop.classList.remove('qdz-drag-active');
        const file = e.dataTransfer?.files?.[0];
        if (file) this._handleQuickDrop(file);
      });
    }

    const quickInput = document.getElementById('utilityQuickDropInput');
    if (quickInput) {
      quickInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) this._handleQuickDrop(file);
        quickInput.value = '';
      });
    }
  }

  async _handleQuickDrop(file) {
    if (!this.selectedProperty) return;

    this.editingBillId = null;
    this._resetForm();

    // Show uploading state
    this._qdzSetState('uploading');
    const name = file.name.length > 30 ? file.name.substring(0, 27) + '…' : file.name;
    const fileNameEl = document.getElementById('utilityQdzFileName');
    if (fileNameEl) fileNameEl.textContent = name;

    const stopSim = this._qdzSimulateProgress();

    try {
      const formData = new FormData();
      formData.append('billImage', file);
      const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UTILITY_BILL_PARSE_OCR}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      stopSim();

      if (!data.success) throw new Error(data.error || 'OCR failed');

      this._qdzSetProgress(100);
      await new Promise(r => setTimeout(r, 280));
      this._qdzSetState('success');
      await new Promise(r => setTimeout(r, 950));
      this._qdzSetState('idle');

      // Store file in the hidden input so _saveBill includes it when submitted
      const imageInputQdz = document.getElementById('utilityBillImageInput');
      if (imageInputQdz) {
        const dt = new DataTransfer();
        dt.items.add(file);
        imageInputQdz.files = dt.files;
      }

      // Open form with prefilled data
      this._showAddForm(true);
      document.getElementById('utilityOcrSection')?.removeAttribute('hidden');
      this._showOcrResult(data.data, data.rawText);
      this._fillFormFromOcr(data.data);

      // Mirror file in the form's drop zone
      const formDZ = document.getElementById('utilityBillDropZone');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (formDZ) {
        formDZ.classList.add('has-image');
        formDZ.querySelector('.pdf-placeholder')?.remove();
        const ph = document.createElement('div');
        ph.className = 'pdf-placeholder text-center py-2';
        ph.innerHTML = isPdf
          ? `<i class="bi bi-file-earmark-pdf text-danger" style="font-size:2rem;"></i><div class="small mt-1 text-truncate" style="max-width:200px;">${escapeHtml(file.name)}</div>`
          : `<i class="bi bi-image text-secondary" style="font-size:2rem;"></i><div class="small mt-1 text-truncate" style="max-width:200px;">${escapeHtml(file.name)}</div>`;
        formDZ.appendChild(ph);
      }

      document.getElementById('utilityBillFormPanel')?.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      console.error('[UtilityBillTracker] Quick drop OCR error:', err);
      stopSim();
      this._qdzSetState('error');
      await new Promise(r => setTimeout(r, 1800));
      this._qdzSetState('idle');
      this._showAddForm(true);
      document.getElementById('utilityBillFormPanel')?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  _qdzSetState(state) {
    const map = { idle: 'utilityQdzIdle', uploading: 'utilityQdzUploading', success: 'utilityQdzSuccess', error: 'utilityQdzError' };
    for (const [s, id] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.hidden = s !== state;
    }
    if (state === 'uploading') this._qdzSetProgress(0);
  }

  _qdzSetProgress(pct) {
    const circumference = 2 * Math.PI * 35; // 219.9
    const fg = document.getElementById('utilityQdzRingFg');
    const pctEl = document.getElementById('utilityQdzPct');
    if (fg) fg.style.strokeDashoffset = circumference * (1 - pct / 100);
    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
  }

  _qdzSimulateProgress() {
    let pct = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      pct += (85 - pct) * 0.035; // asymptote toward 85%
      this._qdzSetProgress(pct);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { stopped = true; };
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
      this._renderBillingCalendar();
      this._loadMonthlyBillStatus(this.summaryYear, this.summaryMonth);
    } catch (err) {
      console.error('[UtilityBillTracker] load properties error:', err);
      this._renderPropertyCards();
    }
  }

  async _loadMonthlyBillStatus(year, month) {
    this.summaryYear = year;
    this.summaryMonth = month;
    this.monthlyBillStatus = {};
    this._renderMonthlySummary(true);

    const results = await Promise.allSettled(
      this.properties.map(p =>
        API.get(API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(p.propertyId))
          .then(r => r.json())
          .then(data => {
            const bills = data.bills || [];
            const bill = bills.find(b => b.year === year && b.month === month);
            // Collect day-of-month from recent actual bill dates for per-property estimation
            const recentBillDays = bills
              .filter(b => b.billDate)
              .sort((a, b) => new Date(b.billDate) - new Date(a.billDate))
              .slice(0, 6)
              .map(b => new Date(b.billDate).getDate());
            return {
              propertyId: p.propertyId,
              hasBill: !!bill,
              billAmount: bill ? (bill.totalAmount || 0) : 0,
              recentBillDays,
            };
          })
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.monthlyBillStatus[result.value.propertyId] = {
          hasBill: result.value.hasBill,
          billAmount: result.value.billAmount,
          recentBillDays: result.value.recentBillDays || [],
        };
      }
    }

    this._renderPropertyCards();
    this._renderMonthlySummary(false);
    this._renderBillingCalendar();
  }

  _syncSelectAllToggle(checked) {
    const toggle = document.getElementById('utilitySelectAllToggle');
    if (toggle) toggle.checked = checked;
  }

  toggleAllProperties(checked) {
    this.allSelected = checked;
    this._renderPropertyCards();
    if (!checked) {
      this.selectedProperty = null;
      this._destroyAllCharts();
      document.getElementById('utilityAllChartsContainer')?.setAttribute('hidden', '');
      document.getElementById('utilityChartCard')?.removeAttribute('hidden');
      document.getElementById('utilityBillContent')?.setAttribute('hidden', '');
      window.appRouter?.replace('/utility-bills');
      return;
    }
    document.getElementById('utilityBillContent')?.removeAttribute('hidden');
    document.getElementById('utilityBillFormPanel')?.setAttribute('hidden', '');
    document.getElementById('utilityBillHistoryCard')?.setAttribute('hidden', '');
    document.getElementById('utilityChartCard')?.setAttribute('hidden', '');
    window.appRouter?.replace('/utility-bills');
    this._loadAllPropertyCharts();
  }

  _destroyAllCharts() {
    for (const c of (this._allCharts || [])) {
      try { c.destroy(); } catch (_) {}
    }
    this._allCharts = [];
  }

  async _loadAllPropertyCharts() {
    const container = document.getElementById('utilityAllChartsContainer');
    if (!container) return;

    // Show loading skeleton
    container.innerHTML = `
      <div class="d-flex align-items-center gap-2 text-muted small py-3">
        <span class="spinner-border spinner-border-sm"></span>
        Loading charts for ${this.properties.length} properties…
      </div>`;
    container.removeAttribute('hidden');

    // Fetch all properties' bills in parallel
    const results = await Promise.allSettled(
      this.properties.map(p =>
        API.get(API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(p.propertyId))
          .then(r => r.json())
          .then(d => ({ property: p, bills: d.bills || [] }))
      )
    );

    if (!this.allSelected) return; // deselected while loading

    this._destroyAllCharts();

    const now = new Date();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
    }

    // Build HTML grid — one card per property
    container.innerHTML = `<div class="row g-3">` +
      results.map((r, idx) => {
        const canvasId = `utilityPropChart_${idx}`;
        const prop = r.status === 'fulfilled' ? r.value.property : this.properties[idx];
        const label = prop.address || prop.propertyId;
        const hasBill = this.monthlyBillStatus[prop.propertyId]?.hasBill;
        const statusKnown = prop.propertyId in this.monthlyBillStatus;
        const badge = statusKnown
          ? (hasBill
            ? `<span class="badge bg-success ms-2" style="font-size:0.6rem;">${i18next.t('utilityBillTracker.filled')}</span>`
            : `<span class="badge bg-warning text-dark ms-2" style="font-size:0.6rem;">${i18next.t('utilityBillTracker.missing')}</span>`)
          : '';
        return `
          <div class="col-12 col-md-6 col-xl-4">
            <div class="card shadow-sm h-100">
              <div class="card-header py-2 d-flex align-items-center gap-2" style="font-size:0.82rem;">
                <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white flex-shrink-0"
                     style="width:22px;height:22px;font-size:9px;font-weight:bold;">
                  ${escapeHtml(prop.propertyId.substring(0, 2).toUpperCase())}
                </div>
                <span class="fw-semibold text-truncate flex-grow-1" title="${escapeHtml(label)}">${escapeHtml(label)}</span>
                ${badge}
              </div>
              <div class="card-body p-2">
                <div style="position:relative;height:160px;">
                  <canvas id="${canvasId}"></canvas>
                </div>
              </div>
            </div>
          </div>`;
      }).join('') +
    `</div>`;

    // Render each chart
    this._allCharts = [];
    results.forEach((r, idx) => {
      const canvas = document.getElementById(`utilityPropChart_${idx}`);
      if (!canvas) return;
      const bills = r.status === 'fulfilled' ? r.value.bills : [];

      const elecData = [], waterData = [], gasData = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yr = d.getFullYear(), mo = d.getMonth() + 1;
        const bill = bills.find(b => b.year === yr && b.month === mo);
        elecData.push(bill ? bill.electricityAmount : null);
        waterData.push(bill ? bill.waterAmount : null);
        gasData.push(bill ? (bill.gasAmount || 0) + (bill.refuseAmount || 0) + (bill.otherAmount || 0) : null);
      }

      const chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: i18next.t('utilityBillTracker.electricityLabel'), data: elecData, backgroundColor: 'rgba(255,193,7,0.85)', borderColor: 'rgba(255,193,7,1)', borderWidth: 1, borderRadius: 3 },
            { label: i18next.t('utilityBillTracker.waterLabel'),       data: waterData, backgroundColor: 'rgba(13,202,240,0.85)',  borderColor: 'rgba(13,202,240,1)',  borderWidth: 1, borderRadius: 3 },
            { label: i18next.t('utilityBillTracker.gasOthersLabel'),   data: gasData,   backgroundColor: 'rgba(108,117,125,0.75)', borderColor: 'rgba(108,117,125,1)', borderWidth: 1, borderRadius: 3 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed.y;
                  return v != null ? `${ctx.dataset.label}: $${v.toFixed(2)}` : null;
                },
                footer: (items) => {
                  const sum = items.reduce((s, i) => s + (i.parsed.y || 0), 0);
                  return sum > 0 ? i18next.t('utilityBillTracker.chartTotal', { amount: sum.toFixed(2) }) : null;
                },
              },
            },
          },
          scales: {
            x: { ticks: { font: { size: 9 } }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { callback: (v) => `$${v}`, font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
          },
        },
      });
      this._allCharts.push(chart);
    });
  }

  // ── Billing Calendar ──────────────────────────────────────────────────────

  _adjustForWeekend(year, month, day) {
    const daysInMonth = new Date(year, month, 0).getDate();
    day = Math.max(1, Math.min(day, daysInMonth));
    const dow = new Date(year, month - 1, day).getDay();
    if (dow === 0) return Math.min(day + 1, daysInMonth); // Sunday → Monday
    if (dow === 6) return day > 1 ? day - 1 : Math.min(day + 2, daysInMonth); // Saturday → Friday (or Mon if day=1)
    return day;
  }

  _estimatedBillingDayForProperty(propertyId, year, month) {
    const recentBillDays = this.monthlyBillStatus[propertyId]?.recentBillDays;
    if (recentBillDays && recentBillDays.length >= 1) {
      const avg = Math.round(recentBillDays.reduce((s, d) => s + d, 0) / recentBillDays.length);
      return this._adjustForWeekend(year, month, avg);
    }
    return this._adjustForWeekend(year, month, 8); // fallback: 8th
  }

  navigateBillingCalendar(delta) {
    if (delta === 0) {
      const now = new Date();
      this.calendarYear = now.getFullYear();
      this.calendarMonth = now.getMonth() + 1;
    } else {
      this.calendarMonth += delta;
      if (this.calendarMonth > 12) { this.calendarMonth = 1; this.calendarYear++; }
      if (this.calendarMonth < 1)  { this.calendarMonth = 12; this.calendarYear--; }
    }
    this._renderBillingCalendar();
  }

  _renderBillingCalendar() {
    const container = document.getElementById('utilityBillingCalendar');
    const monthLabel = document.getElementById('utilityCalendarMonthLabel');
    if (!container) return;

    const year  = this.calendarYear;
    const month = this.calendarMonth;
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNames   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    if (monthLabel) monthLabel.textContent = `${monthNames[month - 1]} ${year}`;

    const now     = new Date();
    const todayY  = now.getFullYear(), todayM = now.getMonth() + 1, todayD = now.getDate();
    const isToday = (d) => year === todayY && month === todayM && d === todayD;

    const firstDow     = new Date(year, month - 1, 1).getDay();
    const daysInMonth  = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    const isSummaryMonth = year === this.summaryYear && month === this.summaryMonth;

    // Map: day → array of event objects (each property on its own estimated day)
    const dayEvents = {};
    for (const prop of this.properties) {
      const propEstDay = this._estimatedBillingDayForProperty(prop.propertyId, year, month);
      if (!dayEvents[propEstDay]) dayEvents[propEstDay] = [];
      let status = 'estimated';
      if (isSummaryMonth && prop.propertyId in this.monthlyBillStatus) {
        status = this.monthlyBillStatus[prop.propertyId]?.hasBill ? 'filled' : 'missing';
      }
      dayEvents[propEstDay].push({ propertyId: prop.propertyId, label: prop.address || prop.propertyId, status });
    }

    // Build 42 cells (6 rows × 7 cols)
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const cellNum = i - firstDow + 1;
      if (cellNum < 1) {
        cells.push({ day: prevMonthDays + cellNum, type: 'prev', events: [] });
      } else if (cellNum > daysInMonth) {
        cells.push({ day: cellNum - daysInMonth, type: 'next', events: [] });
      } else {
        cells.push({ day: cellNum, type: 'current', events: dayEvents[cellNum] || [] });
      }
    }

    const MAX_VISIBLE = 3;

    const headerHtml = dayNames.map(d =>
      `<div style="text-align:center;font-size:0.7rem;font-weight:600;color:#70757a;padding:8px 2px 6px;text-transform:uppercase;letter-spacing:0.04em;border-bottom:1px solid #e0e0e0;">${d}</div>`
    ).join('');

    const cellsHtml = cells.map((cell, i) => {
      const dow = i % 7;
      const isWeekend = dow === 0 || dow === 6;
      const today = isToday(cell.day) && cell.type === 'current';

      const dateLabelStyle = today
        ? 'display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#1a73e8;color:#fff;font-weight:700;font-size:0.8rem;line-height:1;'
        : `font-size:0.8rem;font-weight:${cell.type === 'current' ? (isWeekend ? '600' : '500') : '400'};color:${cell.type === 'current' ? (isWeekend ? '#3c4043' : '#3c4043') : '#c0c4cb'};padding:3px 2px 0;display:inline-block;`;

      const visible  = cell.events.slice(0, MAX_VISIBLE);
      const overflow = cell.events.length - MAX_VISIBLE;

      const eventsHtml = visible.map(ev => {
        const bg   = ev.status === 'filled' ? '#137333' : ev.status === 'missing' ? '#d4a000' : '#1967d2';
        const icon = ev.status === 'filled' ? '✓ ' : ev.status === 'missing' ? '! ' : '';
        const lbl  = ev.label.length > 20 ? ev.label.substring(0, 18) + '…' : ev.label;
        return `<div onclick="utilityBillTracker.selectProperty('${ev.propertyId}')" title="${escapeHtml(ev.label)} — ${ev.status}" style="cursor:pointer;background:${bg};color:#fff;border-radius:3px;padding:1px 5px;font-size:0.67rem;line-height:1.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1px;user-select:none;">${icon}${escapeHtml(lbl)}</div>`;
      }).join('');

      const overflowHtml = overflow > 0
        ? `<div style="font-size:0.67rem;color:#1967d2;padding:1px 4px;cursor:default;">+${overflow} more</div>`
        : '';

      const bg = cell.type !== 'current'
        ? '#f8f9fa'
        : (isWeekend ? 'rgba(0,0,0,0.015)' : '#fff');

      return `
        <div style="min-height:88px;border-right:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;padding:4px 3px 3px;background:${bg};box-sizing:border-box;overflow:hidden;">
          <div style="margin-bottom:2px;"><span style="${dateLabelStyle}">${cell.day}</span></div>
          ${eventsHtml}${overflowHtml}
        </div>`;
    }).join('');

    container.innerHTML = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border-top:1px solid #e0e0e0;">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);border-left:1px solid #e0e0e0;">
          ${headerHtml}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);border-left:1px solid #e0e0e0;">
          ${cellsHtml}
        </div>
        ${!this.properties.length ? `<div class="text-center text-muted small py-3"><i class="bi bi-info-circle me-1"></i>Load properties to see estimated billing dates.</div>` : ''}
        <div style="font-size:0.7rem;color:#70757a;padding:6px 10px;border-top:1px solid #e0e0e0;background:#f8f9fa;">
          <i class="bi bi-info-circle me-1"></i>
          Dates estimated from each property's billing history (nearest weekday). Fallback: 8th of month.
          ${isSummaryMonth && this.properties.length ? ` Filing status reflects <em>${monthNames[month-1]} ${year}</em>.` : ' Navigate to the summary month to see filing status.'}
        </div>
      </div>`;
  }

  _renderMonthlySummary(loading = false) {
    const container = document.getElementById('utilityMonthSummary');
    if (!container) return;

    if (!this.properties.length) { container.innerHTML = ''; return; }

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const label = `${monthNames[this.summaryMonth - 1]} ${this.summaryYear}`;

    if (loading) {
      container.innerHTML = `
        <div class="d-flex align-items-center gap-2 text-muted small py-1">
          <span class="spinner-border spinner-border-sm"></span>
          ${i18next.t('utilityBillTracker.checkingBills', { label })}
        </div>`;
      const badge = document.getElementById('utilityNavBadge');
      if (badge) badge.innerHTML = '';
      return;
    }

    const total = this.properties.length;
    const filled = this.properties.filter(p => this.monthlyBillStatus[p.propertyId]?.hasBill).length;
    const missing = total - filled;
    const pct = total ? Math.round((filled / total) * 100) : 0;
    const allDone = missing === 0;
    const barColor = allDone ? 'bg-success' : (filled === 0 ? 'bg-danger' : 'bg-warning');

    container.innerHTML = `
      <div class="border rounded-3 px-3 py-2" style="background:rgba(0,0,0,0.02);">
        <div class="d-flex align-items-center justify-content-between mb-1">
          <span class="fw-semibold small">
            ${allDone
              ? `<i class="bi bi-check-circle-fill text-success me-1"></i>${i18next.t('utilityBillTracker.allFilled', { total, label })}`
              : `<i class="bi bi-exclamation-circle-fill text-warning me-1"></i>${i18next.t('utilityBillTracker.someFilled', { filled, total, label })}`}
          </span>
          <span class="small text-muted">${pct}%</span>
        </div>
        <div class="progress" style="height:6px;">
          <div class="progress-bar ${barColor}" role="progressbar" style="width:${pct}%"></div>
        </div>
        ${missing > 0 ? `<div class="small text-muted mt-1"><i class="bi bi-arrow-down-circle me-1"></i>${i18next.t('utilityBillTracker.missingCount_other', { count: missing })}</div>` : ''}
      </div>`;

    this._renderNavBadge(filled, total, allDone);
  }

  _renderNavBadge(filled, total, allDone) {
    const badge = document.getElementById('utilityNavBadge');
    if (!badge) return;
    if (allDone) {
      badge.innerHTML = `<span class="badge rounded-pill" style="background:rgba(255,255,255,0.25);font-size:0.65rem;font-weight:500;letter-spacing:0.02em;padding:3px 7px;"><i class="bi bi-check-lg me-1" style="font-size:0.6rem;"></i>${filled}/${total}</span>`;
    } else {
      const missing = total - filled;
      badge.innerHTML = `<span class="badge rounded-pill" style="background:rgba(255,193,7,0.85);color:#1a1a1a;font-size:0.65rem;font-weight:600;padding:3px 7px;">${missing}/${total} missing</span>`;
    }
  }

  _renderPropertyCards() {
    const container = document.getElementById('utilityBillPropertyCards');
    if (!container) return;

    if (!this.properties.length) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-building-slash me-2"></i>${i18next.t('utilityBillTracker.noProperties')}
        </div>`;
      return;
    }

    // CSS Grid — compact cards
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
    container.style.gap = "0.5rem";

    const now = new Date();
    const isCurrentPeriod = this.summaryYear === now.getFullYear() && this.summaryMonth === (now.getMonth() + 1);

    container.innerHTML = [...this.properties]
      .sort((a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0))
      .map(p => {
      const sel = this.allSelected || this.selectedProperty === p.propertyId;
      const status = this.monthlyBillStatus[p.propertyId];
      const hasBill = status?.hasBill;
      const statusKnown = p.propertyId in this.monthlyBillStatus;
      const subsidy = p.subsidizedPub || 0;
      const billAmt = status?.billAmount || 0;
      const overBudget = isCurrentPeriod && hasBill && subsidy > 0 && billAmt > subsidy;
      // t = 0 (just over) → 1 (50%+ over); drives red intensity
      const t = overBudget ? Math.min((billAmt - subsidy) / subsidy / 0.5, 1) : 0;
      const borderL = Math.round(75 - t * 35);   // lightness: 75% (light pink) → 40% (deep red)
      const borderSat = Math.round(70 + t * 20); // saturation: 70% → 90%
      const shadowA = (0.08 + t * 0.22).toFixed(2);
      const bgL = Math.round(99 - t * 7);        // background: near-white → pink
      let statusBadge = '';
      if (statusKnown) {
        statusBadge = hasBill
          ? `<span class="badge bg-success" style="font-size:0.6rem;"><i class="bi bi-check-lg me-1"></i>${i18next.t('utilityBillTracker.filled')}</span>`
          : `<span class="badge bg-warning text-dark" style="font-size:0.6rem;"><i class="bi bi-exclamation me-1"></i>${i18next.t('utilityBillTracker.missing')}</span>`;
      }
      const borderStyle = sel
        ? 'border: 3px solid #0d6efd; box-shadow: 0 0 0 3px rgba(13,110,253,0.2), 0 4px 12px rgba(13,110,253,0.25);'
        : overBudget
          ? `border: 2px solid hsl(0,${borderSat}%,${borderL}%); box-shadow: 0 0 0 2px hsla(0,80%,55%,${shadowA});`
          : (statusKnown && !hasBill ? 'border: 2px solid #ffc107;' : '');
      const bodyBg = sel ? 'rgba(13,110,253,0.07)' : overBudget ? `hsl(0,100%,${bgL}%)` : '#fff';
      return `
        <div class="card utility-prop-card overflow-hidden ${sel ? 'selected' : ''}"
             style="cursor:pointer;transition:all .2s ease;${borderStyle}"
             onclick="utilityBillTracker.selectProperty('${p.propertyId}')">
          ${p.propertyImage
            ? `<div data-role="property-image" style="height:55px;background-image:url('${p.propertyImage}');background-size:cover;background-position:center;position:relative;">
                ${renderPropertyImageAvatarBadge(this._avatarInvestors, p.propertyId, { size: 22, overlap: 9, max: 3 })}
                <div data-role="selected-overlay" style="position:absolute;inset:0;background:rgba(13,110,253,0.5);display:${sel ? 'flex' : 'none'};align-items:center;justify-content:center;"><i class="bi bi-check-circle-fill text-white" style="font-size:1.4rem;"></i></div>
               </div>`
            : ''}
          <div data-role="card-body" class="d-flex flex-column align-items-center p-2" style="gap:3px;background:${bodyBg};">
            <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                 style="width:28px;height:28px;font-size:11px;flex-shrink:0;background:${overBudget ? `hsl(0,${borderSat}%,${borderL}%)` : '#0d6efd'};">
              ${escapeHtml(p.propertyId.toString().substring(0, 3))}
            </div>
            <div class="text-center" style="line-height:1.2;width:100%;">
              <div class="fw-semibold text-truncate" style="font-size:10px;" title="${escapeHtml(p.address || '')}">${escapeHtml(p.address || p.propertyId)}</div>
              <div class="text-muted text-truncate" style="font-size:10px;">${escapeHtml(p.unit || '')}</div>
            </div>
            ${statusBadge ? `<div>${statusBadge}</div>` : ''}
            ${overBudget ? `<span class="badge" title="+$${(billAmt - subsidy).toFixed(2)} over limit" style="font-size:0.55rem;padding:2px 4px;background:hsl(0,${borderSat}%,${borderL}%);color:#fff;cursor:default;">⚠ over limit</span>` : ''}
            ${!p.propertyImage ? `<i data-role="no-image-check" class="bi bi-check-circle-fill text-primary" style="font-size:0.9rem;display:${sel ? 'inline' : 'none'};"></i>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  async selectProperty(propertyId) {
    if (!propertyId) {
      this.selectedProperty = null;
      this.allSelected = false;
      this._syncSelectAllToggle(false);
      document.getElementById('utilityBillContent')?.setAttribute('hidden', '');
      window.appRouter?.replace('/utility-bills');
      return;
    }

    // Clicking a specific card always deactivates "select all"
    this.allSelected = false;
    this._syncSelectAllToggle(false);

    const alreadySelected = this.selectedProperty === propertyId;
    this.selectedProperty = propertyId;
    // Restore per-property panels (may have been hidden by select-all)
    this._destroyAllCharts();
    document.getElementById('utilityAllChartsContainer')?.setAttribute('hidden', '');
    document.getElementById('utilityChartCard')?.removeAttribute('hidden');
    document.getElementById('utilityBillHistoryCard')?.removeAttribute('hidden');
    this._renderPropertyCards();
    if (alreadySelected) {
      // Already selected — just ensure content is visible without re-fetching
      document.getElementById('utilityBillContent')?.removeAttribute('hidden');
      return;
    }
    await this._loadBills();

    // Sync URL so this state is bookmarkable.
    const _propData =
      this.properties.find((p) => p.propertyId === this.selectedProperty) ||
      this._slugResolvedProperty;
    const _slug = _propData
      ? window.SlugUtils.propertySlug(_propData)
      : this.selectedProperty;
    window.appRouter?.replace(`/utility-bills/${_slug}`);
  }

  async _loadBills() {
    if (!this.selectedProperty) return;
    // Load bills, tenants, and property details in parallel
    const [billsResult, tenantsResult, propResult] = await Promise.allSettled([
      API.get(API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(this.selectedProperty)).then(r => r.json()),
      API.get(API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(this.selectedProperty)).then(r => r.json()),
      API.get(API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(this.selectedProperty)).then(r => r.json()),
    ]);
    this.bills = billsResult.status === 'fulfilled' && billsResult.value.success
      ? billsResult.value.bills || []
      : [];
    this.tenants = tenantsResult.status === 'fulfilled' && tenantsResult.value.success
      ? tenantsResult.value.tenants || []
      : [];
    const prop = propResult.status === 'fulfilled' && propResult.value.success
      ? propResult.value.property || {}
      : {};
    this.propertySubsidy = prop.subsidizedPub || 0;
    this._renderFbGroups(prop);
    this._renderSpAccount(prop);
    this._renderChart();
    this._renderBillsTable();
    this._showAddForm(false);
    document.getElementById('utilityBillContent')?.removeAttribute('hidden');
  }

  // ── FB Group links ─────────────────────────────────────────────────────────

  _renderFbGroups(property) {
    const container = document.getElementById('utilityFbGroups');
    if (!container) return;
    const tenantGroup = property?.tenantFacebookGroup;
    const adminGroup = property?.adminFacebookGroup;
    if (!tenantGroup && !adminGroup) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';
    const tenantMeta = getGroupLinkMeta(tenantGroup);
    container.innerHTML = [
      tenantGroup ? `<a href="${escapeHtml(tenantGroup)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="border-color:${tenantMeta.color};color:${tenantMeta.color};"><i class="bi ${tenantMeta.icon} me-1"></i>Tenant Group</a>` : '',
      adminGroup  ? `<a href="${escapeHtml(adminGroup)}"  target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-success"><i class="bi bi-facebook me-1"></i>Admin Group</a>`  : '',
    ].join('');
  }

  // ── SP Utility Account ───────────────────────────────────────────────────────

  _renderSpAccount(property) {
    const container = document.getElementById('utilitySpAccount');
    if (!container) return;
    const username = property?.spAccountUsername;
    const password = property?.spAccountPassword;
    if (!username && !password) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    const admin = !!(window.isAdmin && window.isAdmin());
    const copyEl = (value, label) => `<span class="sp-copy-val font-monospace fw-semibold" data-copy="${escapeHtml(value)}" title="Click to copy ${label}" onclick="event.stopPropagation();utilityBillTracker.copySpValue(this)">${escapeHtml(value)}<i class="bi bi-copy"></i></span>`;
    container.style.display = '';
    container.innerHTML = `
      <div class="d-flex align-items-center gap-2 small p-2 rounded" style="background:#f0f4ff;border:1px solid #d7e0fb;">
        <img src="https://www.spgroup.com.sg/dam/spgroup/slices/SP_Group_Logo-01.svg" alt="SP" style="height:16px;width:auto;flex-shrink:0;">
        <span class="text-muted">SP Account:</span>
        ${username ? copyEl(username, 'username') : ''}
        ${username && password ? `<span class="text-muted">/</span>` : ''}
        ${password
          ? (admin
              ? copyEl(password, 'password')
              : `<span class="text-muted" title="Admins only"><i class="bi bi-lock-fill me-1"></i>••••••••</span>`)
          : ''}
      </div>`;
  }

  // Copies the SP account value without disturbing the visible text —
  // feedback is a transient "Copied!" bubble + background flash instead
  // of swapping the content (so the credential stays visible/selectable).
  copySpValue(el) {
    const text = el.dataset.copy !== undefined ? el.dataset.copy : el.textContent;
    navigator.clipboard.writeText(text).then(() => {
      el.classList.add('sp-copy-flash');
      setTimeout(() => el.classList.remove('sp-copy-flash'), 500);

      if (el._spCopyBubble) {
        el._spCopyBubble.remove();
        clearTimeout(el._spCopyBubbleTimer);
      }
      const bubble = document.createElement('div');
      bubble.className = 'sp-copy-bubble';
      bubble.textContent = 'Copied!';
      document.body.appendChild(bubble);
      const rect = el.getBoundingClientRect();
      bubble.style.left = `${rect.left + rect.width / 2}px`;
      bubble.style.top = `${rect.top - 4}px`;
      el._spCopyBubble = bubble;
      requestAnimationFrame(() => bubble.classList.add('sp-copy-bubble-show'));

      el._spCopyBubbleTimer = setTimeout(() => {
        bubble.classList.remove('sp-copy-bubble-show');
        setTimeout(() => bubble.remove(), 200);
        el._spCopyBubble = null;
      }, 1000);
    });
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
    const totals = [];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const subsidy = this.propertySubsidy || 0;

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth() + 1;
      labels.push(`${monthNames[mo - 1]} ${yr}`);
      const bill = this.bills.find(b => b.year === yr && b.month === mo);
      const elec  = bill ? (bill.electricityAmount || 0) : null;
      const water = bill ? (bill.waterAmount || 0) : null;
      const gas   = bill ? ((bill.gasAmount || 0) + (bill.refuseAmount || 0) + (bill.otherAmount || 0)) : null;
      elecData.push(elec);
      waterData.push(water);
      gasData.push(gas);
      totals.push(bill ? (elec + water + gas) : null);
    }

    // Determine which months exceed the subsidy limit (compare stacked bar total to threshold)
    const exceededSet = new Set(
      totals.map((t, i) => (subsidy > 0 && t != null && t >= subsidy ? i : -1)).filter(i => i >= 0)
    );

    // For exceeded months, tint the bars red
    const elecBg   = totals.map((_, i) => exceededSet.has(i) ? 'rgba(220,53,69,0.80)' : 'rgba(255,193,7,0.85)');
    const waterBg  = totals.map((_, i) => exceededSet.has(i) ? 'rgba(220,53,69,0.55)' : 'rgba(13,202,240,0.85)');
    const gasBg    = totals.map((_, i) => exceededSet.has(i) ? 'rgba(220,53,69,0.35)' : 'rgba(108,117,125,0.75)');
    const elecBdr  = totals.map((_, i) => exceededSet.has(i) ? 'rgba(220,53,69,1)'    : 'rgba(255,193,7,1)');
    const waterBdr = totals.map((_, i) => exceededSet.has(i) ? 'rgba(220,53,69,1)'    : 'rgba(13,202,240,1)');
    const gasBdr   = totals.map((_, i) => exceededSet.has(i) ? 'rgba(220,53,69,1)'    : 'rgba(108,117,125,1)');

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const datasets = [
      {
        label: i18next.t('utilityBillTracker.electricityLabel'),
        data: elecData,
        backgroundColor: elecBg,
        borderColor: elecBdr,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: i18next.t('utilityBillTracker.waterLabel'),
        data: waterData,
        backgroundColor: waterBg,
        borderColor: waterBdr,
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: i18next.t('utilityBillTracker.gasOthersLabel'),
        data: gasData,
        backgroundColor: gasBg,
        borderColor: gasBdr,
        borderWidth: 1,
        borderRadius: 4,
      },
    ];

    if (subsidy > 0) {
      datasets.push({
        label: `Max covered ($${subsidy.toFixed(2)})`,
        data: labels.map(() => subsidy),
        type: 'line',
        borderColor: 'rgba(220,53,69,0.9)',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 0,
      });
    }

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.datasetIndex === 3 && subsidy > 0) {
                  return `Max covered: $${subsidy.toFixed(2)}`;
                }
                const v = ctx.parsed.y;
                return v != null ? `${ctx.dataset.label}: $${v.toFixed(2)}` : `${ctx.dataset.label}: —`;
              },
              footer: (items) => {
                const sum = items
                  .filter(i => i.datasetIndex < 3)
                  .reduce((s, i) => s + (i.parsed.y || 0), 0);
                const base = i18next.t('utilityBillTracker.chartTotal', { amount: sum.toFixed(2) });
                if (subsidy > 0 && sum > subsidy) {
                  return `${base}\n⚠ Exceeds max by $${(sum - subsidy).toFixed(2)}`;
                }
                return base;
              },
            },
          },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
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
          <p>${i18next.t('utilityBillTracker.noBillsRecorded')}</p>
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
              <th>${i18next.t('utilityBillTracker.colMonth')}</th>
              <th>${i18next.t('utilityBillTracker.colBillingPeriod')}</th>
              <th>${i18next.t('utilityBillTracker.colBillDate')}</th>
              <th class="text-end"><i class="bi bi-lightning-charge-fill text-warning me-1"></i>${i18next.t('utilityBillTracker.electricity')}</th>
              <th class="text-end"><i class="bi bi-droplet-fill text-info me-1"></i>${i18next.t('utilityBillTracker.water')}</th>
              <th class="text-end"><i class="bi bi-fire text-secondary me-1"></i>${i18next.t('utilityBillTracker.colGasOthers')}</th>
              <th class="text-end text-success"><i class="bi bi-percent me-1"></i>${i18next.t('utilityBillTracker.gst')}</th>
              <th class="text-end fw-bold">${i18next.t('utilityBillTracker.colTotal')}</th>
              <th class="text-center">${i18next.t('utilityBillTracker.colBill')}</th>
              <th class="text-center">${i18next.t('utilityBillTracker.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            ${this.bills.map(b => {
              const gasOther = (b.gasAmount || 0) + (b.refuseAmount || 0) + (b.otherAmount || 0);
              const hasBreakdown = b.billingPeriodStart && b.billingPeriodEnd;
              return `
                <tr>
                  <td class="fw-semibold text-nowrap">${monthNames[(b.month || 1) - 1]} ${b.year}</td>
                  <td class="text-nowrap text-muted small">${fmtPeriod(b)}</td>
                  <td class="text-nowrap text-muted small">${fmtDate(b.billDate)}</td>
                  <td class="text-end">$${(b.electricityAmount || 0).toFixed(2)}</td>
                  <td class="text-end">$${(b.waterAmount || 0).toFixed(2)}</td>
                  <td class="text-end">$${gasOther.toFixed(2)}</td>
                  <td class="text-end text-success small">$${(b.gstAmount || 0).toFixed(2)}</td>
                  <td class="text-end fw-bold text-primary">$${(b.totalAmount || 0).toFixed(2)}</td>
                  <td class="text-center">
                    ${b.billImageUrl
                      ? b.billImageUrl.toLowerCase().includes('.pdf') || b.billImageUrl.includes('raw-proxy')
                        ? `<a href="${b.billImageUrl}" target="_blank" class="btn btn-sm btn-outline-danger py-0 px-1" title="View PDF bill"><i class="bi bi-file-earmark-pdf"></i></a>`
                        : `<a href="${b.billImageUrl}" target="_blank" class="btn btn-sm btn-outline-secondary py-0 px-1" title="View bill image"><i class="bi bi-image"></i></a>`
                      : '<span class="text-muted small">—</span>'}
                  </td>
                  <td class="text-center text-nowrap">
                    ${hasBreakdown ? `<button class="btn btn-sm btn-outline-info py-0 px-1 me-1" onclick="utilityBillTracker.showBillBreakdown('${b._id}')" title="Per-tenant breakdown"><i class="bi bi-people-fill"></i></button>` : ''}
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
      alert(i18next.t('utilityBillTracker.selectPropertyFirst'));
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
    document.getElementById('utilityBillFormTitle').textContent = i18next.t('utilityBillTracker.addNewBill');
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
    document.getElementById('utilityBillFormTitle').textContent = i18next.t('utilityBillTracker.editBill');
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
    set('utilityGst', bill.gstAmount || '');
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
    if (file) this._processBillFile(file);
  }

  _processBillFile(file) {
    // Sync the file to the hidden input so _saveBill can read it via files[0]
    const imageInput = document.getElementById('utilityBillImageInput');
    if (imageInput) {
      const dt = new DataTransfer();
      dt.items.add(file);
      imageInput.files = dt.files;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const dropZone = document.getElementById('utilityBillDropZone');
    const preview = document.getElementById('utilityBillImagePreview');

    if (isPdf) {
      // Show PDF placeholder instead of image preview
      if (preview) preview.hidden = true;
      if (dropZone) {
        dropZone.classList.add('has-image');
        const placeholder = dropZone.querySelector('.pdf-placeholder') || (() => {
          const el = document.createElement('div');
          el.className = 'pdf-placeholder text-center py-2';
          el.innerHTML = `<i class="bi bi-file-earmark-pdf text-danger" style="font-size:2rem;"></i><div class="small mt-1 text-muted">${escapeHtml(file.name)}</div>`;
          dropZone.appendChild(el);
          return el;
        })();
        placeholder.querySelector('div').textContent = file.name;
        placeholder.hidden = false;
      }
    } else {
      // Show image preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (preview) {
          preview.src = ev.target.result;
          preview.hidden = false;
        }
        dropZone?.classList.add('has-image');
      };
      reader.readAsDataURL(file);
    }

    // Auto-run OCR / PDF parse
    this._runOcr(file);
  }

  /** @deprecated Use _processBillFile instead */
  _processImageFile(file) {
    this._processBillFile(file);
  }

  async _runOcr(file) {
    const ocrStatus = document.getElementById('utilityOcrStatus');
    const ocrResultBox = document.getElementById('utilityOcrResult');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (ocrStatus) {
      ocrStatus.hidden = false;
      ocrStatus.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${isPdf ? i18next.t('utilityBillTracker.readingPdf') : i18next.t('utilityBillTracker.parsingOcr')}`;
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
        ocrStatus.innerHTML = `<i class="bi bi-exclamation-triangle text-warning me-1"></i>${i18next.t('utilityBillTracker.ocrFailed')}`;
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
        <i class="bi bi-check-circle me-1"></i>${i18next.t('utilityBillTracker.ocrComplete')}
        ${parsed.validationNote ? `<br><small class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i>${escapeHtml(parsed.validationNote)}</small>` : ''}
      </div>
      <div class="border rounded p-2 bg-light mb-2" style="font-size:0.85rem;">
        ${row(i18next.t('utilityBillTracker.ocrAccountNo'), parsed.accountNumber)}
        ${row(i18next.t('utilityBillTracker.ocrBillingPeriod'), parsed.billingPeriodStart ? `${parsed.billingPeriodStart}${parsed.billingPeriodEnd ? ' – ' + parsed.billingPeriodEnd : ''}` : null)}
        ${row(i18next.t('utilityBillTracker.ocrBillDate'), parsed.billDate)}
        ${row(i18next.t('utilityBillTracker.ocrElectricity'), parsed.electricityAmount != null ? `$${parsed.electricityAmount.toFixed(2)}` : null)}
        ${row(i18next.t('utilityBillTracker.ocrWater'), parsed.waterAmount != null ? `$${parsed.waterAmount.toFixed(2)}` : null)}
        ${row(i18next.t('utilityBillTracker.ocrGas'), parsed.gasAmount != null ? `$${parsed.gasAmount.toFixed(2)}` : null)}
        ${row(i18next.t('utilityBillTracker.ocrRefuse'), parsed.refuseAmount != null ? `$${parsed.refuseAmount.toFixed(2)}` : null)}
        ${row(i18next.t('utilityBillTracker.ocrGst'), parsed.gstAmount != null ? `$${parsed.gstAmount.toFixed(2)}` : null)}
        ${row(i18next.t('utilityBillTracker.ocrTotal'), parsed.totalAmount != null ? `$${parsed.totalAmount.toFixed(2)}` : null)}
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
    const dropZone = document.getElementById('utilityBillDropZone');
    if (dropZone) {
      dropZone.classList.remove('has-image');
      const placeholder = dropZone.querySelector('.pdf-placeholder');
      if (placeholder) placeholder.remove();
    }
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
    if (parsed.gstAmount != null) setAlways('utilityGst', parsed.gstAmount.toFixed(2));
    if (parsed.totalAmount != null) setAlways('utilityTotal', parsed.totalAmount.toFixed(2));
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async _saveBill() {
    if (!this.selectedProperty) { alert(i18next.t('utilityBillTracker.noPropertySelected')); return; }

    const year = parseInt(document.getElementById('utilityBillYear')?.value || '0');
    const month = parseInt(document.getElementById('utilityBillMonth')?.value || '0');
    if (!year || !month || month < 1 || month > 12) {
      alert(i18next.t('utilityBillTracker.invalidYearMonth'));
      return;
    }

    const submitBtn = document.getElementById('utilityBillSubmitBtn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${i18next.t('utilityBillTracker.saving')}`; }

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
        ['utilityGst', 'gstAmount'],
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
      this._showToast(i18next.t('utilityBillTracker.billSaved'), 'success');
      // Refresh the monthly completion status for the saved property
      if (this.selectedProperty) {
        this.monthlyBillStatus[this.selectedProperty] = {
          hasBill: this.bills.some(b => b.year === this.summaryYear && b.month === this.summaryMonth),
          billAmount: (this.bills.find(b => b.year === this.summaryYear && b.month === this.summaryMonth)?.totalAmount || 0),
        };
        this._renderPropertyCards();
        this._renderMonthlySummary(false);
        this._renderBillingCalendar();
      }
    } catch (err) {
      console.error('[UtilityBillTracker] save error:', err);
      alert(i18next.t('utilityBillTracker.saveFailed', { error: err.message }));
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = `<i class="bi bi-floppy me-1"></i>${i18next.t('utilityBillTracker.saveBill')}`; }
    }
  }

  async deleteBill(billId) {
    if (!confirm(i18next.t('utilityBillTracker.deleteConfirm'))) return;
    try {
      const res = await API.delete(API_CONFIG.ENDPOINTS.UTILITY_BILL_DELETE(billId));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      await this._loadBills();
      this._showToast(i18next.t('utilityBillTracker.billDeleted'), 'info');
      if (this.selectedProperty) {
        this.monthlyBillStatus[this.selectedProperty] = {
          hasBill: this.bills.some(b => b.year === this.summaryYear && b.month === this.summaryMonth),
          billAmount: (this.bills.find(b => b.year === this.summaryYear && b.month === this.summaryMonth)?.totalAmount || 0),
        };
        this._renderPropertyCards();
        this._renderMonthlySummary(false);
        this._renderBillingCalendar();
      }
    } catch (err) {
      alert(i18next.t('utilityBillTracker.deleteFailed', { error: err.message }));
    }
  }

  // ── Per-tenant bill breakdown ──────────────────────────────────────────────

  /**
   * Calculate how many days of [lpStart, lpEnd] overlap with [periodStart, periodEnd].
   * Both ranges are inclusive. Returns integer days.
   */
  _overlapDays(lpStart, lpEnd, periodStart, periodEnd) {
    const start = Math.max(lpStart.getTime(), periodStart.getTime());
    const end   = Math.min(lpEnd.getTime(),   periodEnd.getTime());
    if (end < start) return 0;
    return Math.round((end - start) / 86400000) + 1; // +1 for inclusive end
  }

  /**
   * Given a bill and the current property's tenants, compute per-tenant share.
   * Away days that fall within the billing period are excluded from that tenant's
   * occupied days, reducing their share proportionally.
   *
   * Returns array of { name, room, totalDays, awayDays, presentDays, share (0-1), amount }
   * or null if the bill has no billing period dates.
   */
  _computeBillBreakdown(bill) {
    if (!bill.billingPeriodStart || !bill.billingPeriodEnd) return null;

    const periodStart = new Date(bill.billingPeriodStart);
    const periodEnd   = new Date(bill.billingPeriodEnd);
    // Normalise to midnight UTC to avoid DST skew
    periodStart.setUTCHours(0, 0, 0, 0);
    periodEnd.setUTCHours(0, 0, 0, 0);
    const totalBillingDays = Math.round((periodEnd - periodStart) / 86400000) + 1;

    const propertyId = this.selectedProperty;
    const rows = [];

    for (const tenant of this.tenants) {
      // Find this tenant's assignment to the current property
      const assignment = (tenant.properties || []).find(p => p.propertyId === propertyId);
      if (!assignment) continue;

      const movein  = assignment.moveinDate  ? new Date(assignment.moveinDate)  : null;
      const moveout = assignment.moveoutDate ? new Date(assignment.moveoutDate) : null;

      // Skip tenants who weren't at the property during the billing period
      if (movein  && movein  > periodEnd)  continue;
      if (moveout && moveout < periodStart) continue;

      // Calculate away days within the billing period
      let awayDays = 0;
      const leavePlans = assignment.leavePlans || [];
      for (const lp of leavePlans) {
        if (!lp.startDate || !lp.endDate) continue;
        const lpStart = new Date(lp.startDate);
        const lpEnd   = new Date(lp.endDate);
        lpStart.setUTCHours(0, 0, 0, 0);
        lpEnd.setUTCHours(0, 0, 0, 0);
        awayDays += this._overlapDays(lpStart, lpEnd, periodStart, periodEnd);
      }

      const presentDays = Math.max(0, totalBillingDays - awayDays);
      rows.push({
        name: tenant.nickname || tenant.name || '—',
        room: assignment.room || '—',
        totalDays: totalBillingDays,
        awayDays,
        presentDays,
      });
    }

    if (rows.length === 0) return { totalBillingDays, rows: [], noTenants: true };

    const sumPresent = rows.reduce((s, r) => s + r.presentDays, 0);
    const totalAmount = bill.totalAmount || 0;

    for (const row of rows) {
      row.share  = sumPresent > 0 ? row.presentDays / sumPresent : 1 / rows.length;
      row.amount = row.share * totalAmount;
    }

    return { totalBillingDays, rows };
  }

  showBillBreakdown(billId) {
    const bill = this.bills.find(b => b._id === billId);
    if (!bill) return;

    const result = this._computeBillBreakdown(bill);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const billLabel = `${monthNames[(bill.month || 1) - 1]} ${bill.year}`;
    const fmtDate = (val) => val ? new Date(val).toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const fmtPeriod = `${fmtDate(bill.billingPeriodStart)} – ${fmtDate(bill.billingPeriodEnd)}`;

    let bodyHtml;
    if (!result || result.noTenants) {
      bodyHtml = `<div class="alert alert-warning mb-0"><i class="bi bi-exclamation-triangle me-2"></i>${i18next.t('utilityBillTracker.breakdownNoTenants')}</div>`;
    } else {
      const hasAwayDays = result.rows.some(r => r.awayDays > 0);

      bodyHtml = `
        <div class="mb-3 small text-muted">
          <i class="bi bi-calendar-range me-1"></i>${i18next.t('utilityBillTracker.breakdownPeriod')} <strong>${fmtPeriod}</strong>
          &nbsp;(${i18next.t('utilityBillTracker.breakdownDays', { count: result.totalBillingDays })})
          &nbsp;·&nbsp;${i18next.t('utilityBillTracker.breakdownTotal')} <strong>$${(bill.totalAmount || 0).toFixed(2)}</strong>
        </div>
        ${hasAwayDays ? `<div class="alert alert-info py-2 small mb-3"><i class="bi bi-luggage-fill me-1"></i>${i18next.t('utilityBillTracker.breakdownAwayNote')}</div>` : ''}
        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-2" style="font-size:0.88rem;">
            <thead class="table-light">
              <tr>
                <th>${i18next.t('utilityBillTracker.colTenant')}</th>
                <th>${i18next.t('utilityBillTracker.colRoom')}</th>
                <th class="text-center">${i18next.t('utilityBillTracker.colBillingDays')}</th>
                ${hasAwayDays ? `<th class="text-center text-warning">${i18next.t('utilityBillTracker.colAwayDays')}</th>` : ''}
                <th class="text-center">${i18next.t('utilityBillTracker.colPresentDays')}</th>
                <th class="text-center">${i18next.t('utilityBillTracker.colShare')}</th>
                <th class="text-end fw-bold">${i18next.t('utilityBillTracker.colTotal')}</th>
              </tr>
            </thead>
            <tbody>
              ${result.rows.map(r => `
                <tr>
                  <td class="fw-semibold">${escapeHtml(r.name)}</td>
                  <td class="text-muted small">${escapeHtml(r.room)}</td>
                  <td class="text-center">${r.totalDays}</td>
                  ${hasAwayDays ? `<td class="text-center ${r.awayDays > 0 ? 'text-warning fw-semibold' : 'text-muted'}">${r.awayDays > 0 ? `−${r.awayDays}` : '—'}</td>` : ''}
                  <td class="text-center">${r.presentDays}</td>
                  <td class="text-center">${(r.share * 100).toFixed(1)}%</td>
                  <td class="text-end fw-bold text-primary">$${r.amount.toFixed(2)}</td>
                </tr>`).join('')}
            </tbody>
            <tfoot class="table-light fw-bold">
              <tr>
                <td colspan="${hasAwayDays ? 5 : 4}">${i18next.t('utilityBillTracker.breakdownFooterTotal')}</td>
                <td class="text-center">100%</td>
                <td class="text-end text-primary">$${(bill.totalAmount || 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="small text-muted"><i class="bi bi-info-circle me-1"></i>${i18next.t('utilityBillTracker.breakdownAmountsNote')}</div>`;
    }

    // Build and show modal
    const existingModal = document.getElementById('utilityBreakdownModal');
    if (existingModal) existingModal.remove();

    const modalHtml = `
      <div class="modal fade" id="utilityBreakdownModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header py-2">
              <h6 class="modal-title mb-0"><i class="bi bi-people-fill me-2 text-info"></i>${i18next.t('utilityBillTracker.breakdownTitle', { label: escapeHtml(billLabel) })}</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">${bodyHtml}</div>
            <div class="modal-footer py-2">
              <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">${i18next.t('utilityBillTracker.breakdownClose')}</button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = new bootstrap.Modal(document.getElementById('utilityBreakdownModal'));
    document.getElementById('utilityBreakdownModal').addEventListener('hidden.bs.modal', () => {
      document.getElementById('utilityBreakdownModal')?.remove();
    });
    modal.show();
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
