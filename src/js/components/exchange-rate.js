/**
 * Exchange Rate Component
 * Manages SGD/VND exchange rate periods and displays history chart
 */
class ExchangeRateComponent {
  constructor() {
    this.rates = [];
    this.currentRate = null;
    this.chart = null;
    this.editingId = null;
  }

  async init() {
    await this.loadRates();
    this.renderHistory();
    this.renderChart();
    this.bindEvents();
  }

  async loadRates() {
    try {
      const res = await API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATES);
      const data = await res.json();
      if (data.success) {
        this.rates = data.rates || [];
        this.currentRate = this.rates[0] || null;
        this.updateGlobalBadge();
      }
    } catch (e) {
      console.error('[ExchangeRate] load error:', e);
    }
  }

  async loadCurrentRate() {
    try {
      const res = await API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_CURRENT);
      const data = await res.json();
      if (data.success && data.rate) {
        this.currentRate = data.rate;
        this.updateGlobalBadge();
        return data.rate;
      }
    } catch (e) {
      console.error('[ExchangeRate] loadCurrent error:', e);
    }
    return null;
  }

  // Fetch rate effective at a given date (YYYY-MM-DD or Date obj)
  async getRateAt(date) {
    try {
      const dateStr = date instanceof Date
        ? date.toISOString().split('T')[0]
        : String(date);
      const res = await API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_AT(dateStr));
      const data = await res.json();
      if (data.success && data.rate) return data.rate.rate;
    } catch (e) {
      console.error('[ExchangeRate] getRateAt error:', e);
    }
    return null;
  }

  updateGlobalBadge() {
    const badge = document.getElementById('globalExchangeRateBadge');
    const mobileBadge = document.getElementById('globalExchangeRateBadgeMobile');
    if (this.currentRate) {
      const formatted = Number(this.currentRate.rate).toLocaleString('vi-VN');
      const html = `<i class="bi bi-currency-exchange me-1"></i>1 SGD = ${formatted} VND`;
      if (badge) badge.innerHTML = html;
      if (mobileBadge) mobileBadge.innerHTML = html;
    }
    // Update section card if visible
    const display = document.getElementById('currentRateDisplay');
    const dateEl = document.getElementById('currentRateDate');
    if (display && this.currentRate) {
      display.textContent = Number(this.currentRate.rate).toLocaleString('vi-VN');
      if (dateEl) {
        const d = new Date(this.currentRate.effectiveFrom).toLocaleDateString('vi-VN', {
          year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        dateEl.textContent = `Hiệu lực từ: ${d}`;
      }
    } else if (display && !this.currentRate) {
      display.textContent = '—';
    }
  }

  bindEvents() {
    const form = document.getElementById('addExchangeRateForm');
    if (form && !form.hasAttribute('data-bound')) {
      form.setAttribute('data-bound', 'true');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addRate();
      });
    }
  }

  async addRate() {
    const rateInput = document.getElementById('newExchangeRateInput');
    const noteInput = document.getElementById('newExchangeRateNote');
    const submitBtn = document.getElementById('addExchangeRateBtn');

    const rate = parseFloat(rateInput?.value);
    if (isNaN(rate) || rate <= 0) {
      alert('Vui lòng nhập tỷ giá hợp lệ.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Đang lưu...';

    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.EXCHANGE_RATES, {
        rate,
        note: noteInput?.value?.trim() || undefined,
      });
      const data = await res.json();
      if (data.success) {
        rateInput.value = '';
        if (noteInput) noteInput.value = '';
        await this.loadRates();
        this.renderHistory();
        this.renderChart();
        this.showSuccess('Đã lưu tỷ giá mới!');
        // Notify other components
        window.dispatchEvent(new CustomEvent('exchangeRateUpdated', { detail: data.rate }));
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể lưu tỷ giá.'));
      }
    } catch (e) {
      alert('Lỗi kết nối server.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-plus-lg me-1"></i>Lưu tỷ giá';
    }
  }

  async deleteRate(id) {
    if (!confirm('Xoá tỷ giá này?')) return;
    try {
      const res = await API.delete(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_BY_ID(id));
      const data = await res.json();
      if (data.success) {
        await this.loadRates();
        this.renderHistory();
        this.renderChart();
      }
    } catch (e) {
      alert('Lỗi khi xoá.');
    }
  }

  editRate(id) {
    // Toggle: if already editing this row, cancel
    if (this.editingId === id) {
      this.editingId = null;
      this.renderHistory();
      return;
    }
    this.editingId = id;
    this.renderHistory();
    // Focus the rate input
    setTimeout(() => {
      document.getElementById(`editRateInput_${id}`)?.focus();
    }, 50);
  }

  async saveEditRate(id) {
    const rateInput = document.getElementById(`editRateInput_${id}`);
    const noteInput = document.getElementById(`editNoteInput_${id}`);
    const dateInput = document.getElementById(`editDateInput_${id}`);
    const saveBtn = document.getElementById(`saveEditBtn_${id}`);

    const rate = parseFloat(rateInput?.value);
    if (isNaN(rate) || rate <= 0) {
      alert('Vui lòng nhập tỷ giá hợp lệ.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
      const body = { rate, note: noteInput?.value?.trim() || '' };
      if (dateInput?.value) body.effectiveFrom = dateInput.value;

      const res = await API.put(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_BY_ID(id), body);
      const data = await res.json();
      if (data.success) {
        this.editingId = null;
        await this.loadRates();
        this.renderHistory();
        this.renderChart();
        this.showSuccess('Đã cập nhật tỷ giá!');
        window.dispatchEvent(new CustomEvent('exchangeRateUpdated', { detail: data.rate }));
      } else {
        alert('Lỗi: ' + (data.error || 'Không thể cập nhật.'));
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
      }
    } catch (e) {
      alert('Lỗi kết nối server.');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="bi bi-check-lg"></i>';
    }
  }

  renderHistory() {
    const container = document.getElementById('exchangeRateHistoryContainer');
    if (!container) return;

    if (this.rates.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-graph-up" style="font-size:2rem;"></i>
          <p class="mt-2">Chưa có dữ liệu tỷ giá. Thêm tỷ giá đầu tiên bên trên.</p>
        </div>`;
      return;
    }

    let html = `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>#</th>
              <th>Tỷ giá (1 SGD = ? VND)</th>
              <th>Hiệu lực từ</th>
              <th>Ghi chú</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>`;

    this.rates.forEach((r, i) => {
      const isCurrent = i === 0;
      const isEditing = this.editingId === r._id;
      const date = new Date(r.effectiveFrom).toLocaleDateString('vi-VN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      const isoDate = new Date(r.effectiveFrom).toISOString().slice(0, 16);
      const formatted = Number(r.rate).toLocaleString('vi-VN');

      if (isEditing) {
        html += `
          <tr class="${isCurrent ? 'table-success' : 'table-warning'}" id="editRow_${r._id}">
            <td>${this.rates.length - i}</td>
            <td>
              <div class="input-group input-group-sm" style="min-width:160px;">
                <span class="input-group-text">1 SGD =</span>
                <input type="number" id="editRateInput_${r._id}" class="form-control" value="${r.rate}" min="1" step="1" style="width:100px;">
                <span class="input-group-text">VND</span>
              </div>
            </td>
            <td>
              <input type="datetime-local" id="editDateInput_${r._id}" class="form-control form-control-sm" value="${isoDate}" style="min-width:180px;">
            </td>
            <td>
              <input type="text" id="editNoteInput_${r._id}" class="form-control form-control-sm" value="${r.note ? this.escapeHtml(r.note) : ''}" placeholder="Ghi chú...">
            </td>
            <td>${isCurrent
              ? '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Hiện tại</span>'
              : '<span class="badge bg-secondary">Cũ</span>'}</td>
            <td>
              <div class="d-flex gap-1">
                <button id="saveEditBtn_${r._id}" class="btn btn-sm btn-success" onclick="exchangeRateComponent.saveEditRate('${r._id}')" title="Lưu">
                  <i class="bi bi-check-lg"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="exchangeRateComponent.editRate('${r._id}')" title="Huỷ">
                  <i class="bi bi-x-lg"></i>
                </button>
              </div>
            </td>
          </tr>`;
      } else {
        html += `
          <tr ${isCurrent ? 'class="table-success fw-semibold"' : ''}>
            <td>${this.rates.length - i}</td>
            <td><span style="font-size:16px;">${formatted}</span></td>
            <td>${date}</td>
            <td class="text-muted">${r.note ? this.escapeHtml(r.note) : '—'}</td>
            <td>${isCurrent
              ? '<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>Hiện tại</span>'
              : '<span class="badge bg-secondary">Cũ</span>'}</td>
            <td>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" onclick="exchangeRateComponent.editRate('${r._id}')" title="Chỉnh sửa">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="exchangeRateComponent.deleteRate('${r._id}')" title="Xoá">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>`;
      }
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  renderChart() {
    const canvas = document.getElementById('exchangeRateChart');
    if (!canvas) return;

    if (this.rates.length === 0) {
      canvas.style.display = 'none';
      return;
    }
    canvas.style.display = 'block';

    // Sort oldest to newest for chart
    const sorted = [...this.rates].reverse();

    const labels = sorted.map(r =>
      new Date(r.effectiveFrom).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', year: '2-digit' })
    );
    const values = sorted.map(r => r.rate);

    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: '1 SGD = VND',
          data: values,
          borderColor: '#1877F2',
          backgroundColor: 'rgba(24,119,242,0.08)',
          borderWidth: 2.5,
          pointBackgroundColor: '#1877F2',
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` 1 SGD = ${Number(ctx.parsed.y).toLocaleString('vi-VN')} VND`,
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: val => Number(val).toLocaleString('vi-VN'),
            },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  }

  quickConvert(sgdValue) {
    const vndEl = document.getElementById('quickConvertVND');
    if (!vndEl) return;
    const sgd = parseFloat(sgdValue);
    if (!sgd || !this.currentRate) { vndEl.value = ''; return; }
    const vnd = Math.round(sgd * this.currentRate.rate);
    vndEl.value = Number(vnd).toLocaleString('vi-VN');
  }

  showSuccess(msg) {
    const el = document.getElementById('exchangeRateSuccess');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  refresh() {
    this.loadRates().then(() => {
      this.renderHistory();
      this.renderChart();
      this.bindEvents();
    });
  }
}

window.exchangeRateComponent = new ExchangeRateComponent();

// Load current rate on startup for global badge
(async () => {
  try {
    const res = await API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_CURRENT);
    const data = await res.json();
    if (data.success && data.rate) {
      window.exchangeRateComponent.currentRate = data.rate;
      window.exchangeRateComponent.updateGlobalBadge();
    }
  } catch (e) {
    // silently ignore on startup
  }
})();
