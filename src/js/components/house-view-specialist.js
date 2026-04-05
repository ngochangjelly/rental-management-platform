/**
 * House View Specialist — chuyên gia xem nhà
 * Mobile-first, Vietnamese UI for recording property viewings.
 */
class HouseViewSpecialistComponent {
  constructor() {
    this.view = 'list'; // 'list' | 'wizard' | 'report'
    this.step = 1;
    this.totalSteps = 7;
    this.editingId = null;
    this.records = [];
    this.viewingData = this._blankData();
    this.searchAbortController = null;
    this.locationError = null; // null | { code, message }
    this.init();
  }

  _blankData() {
    return {
      propertyGuruUrl: '',
      propertyName: '',
      propertyType: '',   // 'hdb' | 'condo' | ''
      address: '',
      postalCode: '',
      unitNumber: '',
      bedrooms: 0,
      bathrooms: 0,
      floorAreaSqft: 0,
      location: null,
      nearbyMrts: [],
      nearbyHawkerCenters: [],
      nearbySupermarkets: [],
      survey: {
        agentPreventsSublet: null,
        storeRoomCount: 1,
        livingRoomCompartments: 1,
        neighborOpenDoor: null,
        airconBrand: '',
        condition: '',
        notes: '',
        agentName: '',
        agentPhone: '',
      },
      finalReport: '',
      status: 'draft',
    };
  }

  init() {
    this.loadRecords();
  }

  // ─── Data loading ──────────────────────────────────────────────────────────

  async loadRecords() {
    try {
      const res = await API.get(API_CONFIG.ENDPOINTS.HOUSE_VIEW_SPECIALIST);
      const data = await res.json();
      if (data.success) {
        this.records = data.data || [];
        if (this.view === 'list') this.renderList();
      }
    } catch (e) {
      console.error('HouseViewSpecialist loadRecords error', e);
    }
  }

  // ─── Top-level render ──────────────────────────────────────────────────────

  render() {
    switch (this.view) {
      case 'wizard': return this.renderWizard();
      case 'report': return this.renderReportView();
      default: return this.renderList();
    }
  }

  // ─── List view ─────────────────────────────────────────────────────────────

  renderList() {
    const container = document.getElementById('hvs-container');
    if (!container) return;

    const cards = this.records.map((r) => {
      const date = new Date(r.viewedAt).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
      const name = r.propertyName || r.address || 'Chưa có tên';
      const unit = r.unitNumber ? `Unit ${r.unitNumber}` : '';
      const mrtCount = (r.nearbyMrts || []).length;
      const closestMrt = mrtCount > 0 ? r.nearbyMrts[0] : null;
      const statusBadge = r.status === 'completed'
        ? '<span class="badge bg-success">Hoàn tất</span>'
        : '<span class="badge bg-warning text-dark">Nháp</span>';

      return `
        <div class="hvs-card" onclick="houseViewSpecialist.openRecord('${r._id}')">
          <div class="hvs-card-header">
            <div>
              <div class="hvs-card-name">${escapeHtml(name)}</div>
              ${unit ? `<div class="hvs-card-unit">${escapeHtml(unit)}</div>` : ''}
            </div>
            ${statusBadge}
          </div>
          <div class="hvs-card-meta">
            <span><i class="bi bi-calendar3"></i> ${date}</span>
            ${closestMrt ? `<span><i class="bi bi-train-front"></i> ${escapeHtml(closestMrt.name)} ${(closestMrt.distance / 1000).toFixed(1)}km</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="hvs-list-view">
        <div class="hvs-list-header">
          <h1 class="hvs-title"><i class="bi bi-house-door me-2"></i>Chuyên gia xem nhà</h1>
          <button class="hvs-btn-primary" onclick="houseViewSpecialist.startNewViewing()">
            <i class="bi bi-plus-lg me-1"></i>Xem nhà mới
          </button>
        </div>

        ${this.records.length === 0 ? `
          <div class="hvs-empty">
            <i class="bi bi-house-slash hvs-empty-icon"></i>
            <p>Chưa có lần xem nhà nào</p>
            <button class="hvs-btn-primary mt-3" onclick="houseViewSpecialist.startNewViewing()">
              <i class="bi bi-plus-lg me-1"></i>Bắt đầu xem nhà
            </button>
          </div>
        ` : `
          <div class="hvs-cards-grid">
            ${cards}
          </div>
        `}
      </div>
    `;
  }

  startNewViewing() {
    this.view = 'wizard';
    this.step = 1;
    this.editingId = null;
    this.viewingData = this._blankData();
    this.renderWizard();
  }

  async openRecord(id) {
    const record = this.records.find((r) => r._id === id);
    if (!record) return;
    this.viewingData = JSON.parse(JSON.stringify(record));
    this.editingId = id;
    if (record.status === 'completed' && record.finalReport) {
      this.view = 'report';
      this.renderReportView();
    } else {
      this.view = 'wizard';
      this.step = 4;
      this.renderWizard();
    }
  }

  // ─── Wizard ────────────────────────────────────────────────────────────────

  renderWizard() {
    const container = document.getElementById('hvs-container');
    if (!container) return;

    const stepLabels = ['Loại nhà', 'Thông tin', 'Chi tiết', 'Vị trí', 'Khảo sát', 'Ghi chú', 'Báo cáo'];
    const progress = Math.round((this.step / this.totalSteps) * 100);

    let stepContent = '';
    switch (this.step) {
      case 1: stepContent = this._renderStep1(); break;
      case 2: stepContent = this._renderStep2(); break;
      case 3: stepContent = this._renderStep3(); break;
      case 4: stepContent = this._renderStep4(); break;
      case 5: stepContent = this._renderStep5(); break;
      case 6: stepContent = this._renderStep6(); break;
      case 7: stepContent = this._renderStep7(); break;
    }

    container.innerHTML = `
      <div class="hvs-wizard">
        <!-- Header -->
        <div class="hvs-wizard-header">
          <button class="hvs-back-btn" onclick="houseViewSpecialist.goBack()">
            <i class="bi bi-arrow-left"></i>
          </button>
          <div class="hvs-step-info">
            <div class="hvs-step-label">${stepLabels[this.step - 1]}</div>
            <div class="hvs-step-count">Bước ${this.step}/${this.totalSteps}</div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="hvs-progress-bar">
          <div class="hvs-progress-fill" style="width:${progress}%"></div>
        </div>

        <!-- Step dots -->
        <div class="hvs-step-dots">
          ${[1,2,3,4,5,6,7].map(i => `
            <div class="hvs-dot ${i === this.step ? 'active' : i < this.step ? 'done' : ''}"></div>
          `).join('')}
        </div>

        <!-- Content -->
        <div class="hvs-wizard-body">
          ${stepContent}
        </div>
      </div>
    `;

    this._bindWizardEvents();
  }

  _renderStep1() {
    const t = this.viewingData.propertyType;

    return `
      <div class="hvs-step-content hvs-step-center">
        <div class="hvs-type-hero">
          <div class="hvs-type-hero-title">Loại bất động sản</div>
          <div class="hvs-type-hero-sub">Chọn loại nhà bạn đang xem</div>
        </div>

        <div class="hvs-type-cards">
          <button class="hvs-type-card ${t === 'hdb' ? 'active' : ''}" data-type="hdb"
            onclick="houseViewSpecialist.setPropertyType('hdb')">
            <span class="hvs-type-icon">🏢</span>
            <span class="hvs-type-name">HDB</span>
            <span class="hvs-type-desc">Nhà ở xã hội chính phủ</span>
          </button>
          <button class="hvs-type-card ${t === 'condo' ? 'active' : ''}" data-type="condo"
            onclick="houseViewSpecialist.setPropertyType('condo')">
            <span class="hvs-type-icon">🏙️</span>
            <span class="hvs-type-name">Condo</span>
            <span class="hvs-type-desc">Căn hộ tư nhân / Condominium</span>
          </button>
        </div>

        <div class="hvs-step-footer">
          <button class="hvs-btn-primary hvs-btn-full" onclick="houseViewSpecialist.nextStep()">
            Tiếp theo <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
      </div>
    `;
  }

  _renderStep2() {
    return `
      <div class="hvs-step-content">
        <div class="hvs-step-title">
          <i class="bi bi-link-45deg hvs-step-icon"></i>
          Thông tin căn nhà
        </div>

        <div class="hvs-survey-scroll">
          <div class="hvs-form-group">
            <label class="hvs-label">URL PropertyGuru (tuỳ chọn)</label>
            <div class="hvs-input-row">
              <input type="url" id="hvs-pg-url" class="hvs-input"
                placeholder="https://www.propertyguru.com.sg/..."
                value="${escapeHtml(this.viewingData.propertyGuruUrl)}" />
              <button class="hvs-btn-icon hvs-btn-clear" id="hvs-url-clear-btn" onclick="houseViewSpecialist.clearUrl()" title="Xoá URL">
                <i class="bi bi-x-lg"></i>
              </button>
              <button class="hvs-btn-icon" id="hvs-crawl-btn" onclick="houseViewSpecialist.crawlUrl()" title="Tự động lấy thông tin">
                <i class="bi bi-magic"></i>
              </button>
            </div>
            <div id="hvs-crawl-status" class="hvs-status-text"></div>
          </div>

          <div class="hvs-form-group">
            <label class="hvs-label">Tên dự án / Căn nhà</label>
            <input type="text" id="hvs-property-name" class="hvs-input"
              placeholder="Ví dụ: Parc Haven Condo"
              value="${escapeHtml(this.viewingData.propertyName)}" />
          </div>

          <div class="hvs-form-group">
            <label class="hvs-label">Địa chỉ đầy đủ</label>
            <input type="text" id="hvs-address" class="hvs-input"
              placeholder="Số nhà, tên đường, Singapore..."
              value="${escapeHtml(this.viewingData.address)}" />
          </div>

          <div class="hvs-inline-row">
            <div class="hvs-form-group hvs-flex1">
              <label class="hvs-label">Mã bưu chính</label>
              <div class="hvs-input-row">
                <input type="text" id="hvs-postal" class="hvs-input"
                  placeholder="xxxxxx" inputmode="numeric" maxlength="6"
                  value="${escapeHtml(this.viewingData.postalCode)}" />
                <button class="hvs-btn-icon" id="hvs-postal-btn" onclick="houseViewSpecialist.lookupPostal()" title="Tìm địa chỉ">
                  <i class="bi bi-search"></i>
                </button>
              </div>
              <div id="hvs-postal-status" class="hvs-status-text"></div>
            </div>
            <div class="hvs-form-group hvs-flex1">
              <label class="hvs-label">Số căn hộ (Unit)</label>
              <input type="text" id="hvs-unit" class="hvs-input"
                placeholder="09-08" inputmode="text" autocomplete="off"
                value="${escapeHtml(this.viewingData.unitNumber)}" />
            </div>
          </div>
        </div>

        <div class="hvs-step-footer">
          <button class="hvs-btn-secondary" onclick="houseViewSpecialist.prevStep()">
            <i class="bi bi-arrow-left me-1"></i>Quay lại
          </button>
          <button class="hvs-btn-primary" onclick="houseViewSpecialist.nextStep()">
            Tiếp theo <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
      </div>
    `;
  }

  _renderStep3() {
    const counterField = (id, label, icon, value) => `
      <div class="hvs-mini-counter-row">
        <span class="hvs-mini-label"><i class="${icon} me-1"></i>${label}</span>
        <div class="hvs-mini-counter">
          <button class="hvs-counter-btn" onclick="houseViewSpecialist.adjustField('${id}', -1)"><i class="bi bi-dash"></i></button>
          <span class="hvs-counter-val" id="hvs-field-${id}">${value || 0}</span>
          <button class="hvs-counter-btn" onclick="houseViewSpecialist.adjustField('${id}', 1)"><i class="bi bi-plus"></i></button>
        </div>
      </div>
    `;

    return `
      <div class="hvs-step-content">
        <div class="hvs-step-title">
          <i class="bi bi-layout-three-columns hvs-step-icon"></i>
          Chi tiết phòng & Agent
        </div>

        <div class="hvs-survey-scroll">
          <div class="hvs-counters-card">
            ${counterField('bedrooms',  'Phòng ngủ',      'bi bi-moon-stars', this.viewingData.bedrooms)}
            ${counterField('bathrooms', 'Phòng tắm',      'bi bi-droplet',    this.viewingData.bathrooms)}
            <div class="hvs-mini-counter-row">
              <span class="hvs-mini-label"><i class="bi bi-rulers me-1"></i>Diện tích (sqft)</span>
              <input type="number" id="hvs-field-floorAreaSqft" class="hvs-input hvs-area-input"
                placeholder="0" inputmode="numeric"
                value="${this.viewingData.floorAreaSqft || ''}" />
            </div>
          </div>

          <div class="hvs-form-group">
            <label class="hvs-label"><i class="bi bi-person-badge me-1"></i>Tên agent</label>
            <input type="text" id="hvs-agent-name" class="hvs-input"
              placeholder="Tên agent..."
              value="${escapeHtml(this.viewingData.survey.agentName)}" />
          </div>

          <div class="hvs-form-group">
            <label class="hvs-label"><i class="bi bi-telephone me-1"></i>Số điện thoại agent</label>
            <input type="tel" id="hvs-agent-phone" class="hvs-input"
              placeholder="+65 9xxx xxxx" inputmode="tel"
              value="${escapeHtml(this.viewingData.survey.agentPhone)}" />
          </div>
        </div>

        <div class="hvs-step-footer">
          <button class="hvs-btn-secondary" onclick="houseViewSpecialist.prevStep()">
            <i class="bi bi-arrow-left me-1"></i>Quay lại
          </button>
          <button class="hvs-btn-primary" onclick="houseViewSpecialist.nextStep()">
            Tiếp theo <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
      </div>
    `;
  }

  _renderStep4() {
    const hasResults = this.viewingData.nearbyMrts.length > 0 ||
      this.viewingData.nearbyHawkerCenters.length > 0 ||
      this.viewingData.nearbySupermarkets.length > 0;

    const mrtList = this.viewingData.nearbyMrts.slice(0, 5).map((m) => `
      <div class="hvs-nearby-item">
        <span class="hvs-nearby-icon mrt">🚇</span>
        <span class="hvs-nearby-name">${escapeHtml(m.name)}</span>
        <span class="hvs-nearby-dist">${m.distance >= 1000 ? (m.distance / 1000).toFixed(1) + 'km' : m.distance + 'm'}</span>
      </div>
    `).join('');

    const hawkerList = this.viewingData.nearbyHawkerCenters.slice(0, 3).map((h) => `
      <div class="hvs-nearby-item">
        <span class="hvs-nearby-icon hawker">🍜</span>
        <span class="hvs-nearby-name">${escapeHtml(h.name)}</span>
        <span class="hvs-nearby-dist">${h.distance >= 1000 ? (h.distance / 1000).toFixed(1) + 'km' : h.distance + 'm'}</span>
      </div>
    `).join('');

    const supermarketGroups = {};
    this.viewingData.nearbySupermarkets.forEach((s) => {
      if (!supermarketGroups[s.name]) supermarketGroups[s.name] = [];
      supermarketGroups[s.name].push(s);
    });
    const superList = Object.entries(supermarketGroups).map(([chain, stores]) => {
      const dists = stores.map((s) =>
        s.distance >= 1000 ? (s.distance / 1000).toFixed(1) + 'km' : s.distance + 'm'
      ).join(' · ');
      return `
        <div class="hvs-nearby-item">
          <span class="hvs-nearby-icon super">🛒</span>
          <span class="hvs-nearby-name">${escapeHtml(chain)} <span class="hvs-nearby-count">${stores.length} cái</span></span>
          <span class="hvs-nearby-dist">${dists}</span>
        </div>
      `;
    }).join('');

    const errorBlock = this.locationError ? `
      <div class="hvs-location-error">
        <div class="hvs-error-icon">📍</div>
        <div class="hvs-error-msg">${escapeHtml(this.locationError.message)}</div>
        <button class="hvs-btn-retry" onclick="houseViewSpecialist.retryLocate()">
          <i class="bi bi-arrow-clockwise me-1"></i>Thử lại
        </button>
        <div class="hvs-manual-divider">— hoặc nhập địa chỉ thủ công —</div>
        <div class="hvs-manual-input-row">
          <input type="text" id="hvs-manual-address" class="hvs-input"
            placeholder="Nhập địa chỉ Singapore..."
            value="${escapeHtml(this.viewingData.address || '')}" />
          <button class="hvs-btn-icon" onclick="houseViewSpecialist.geocodeAndSearch()" title="Tìm tiện ích">
            <i class="bi bi-search"></i>
          </button>
        </div>
        <div id="hvs-geocode-status" class="hvs-status-text"></div>
      </div>
    ` : '';

    return `
      <div class="hvs-step-content">
        <div class="hvs-step-title">
          <i class="bi bi-geo-alt hvs-step-icon"></i>
          Vị trí & Tiện ích
        </div>

        <div class="hvs-location-body">
          ${!hasResults && !this.locationError ? `
            <div class="hvs-locate-section">
              <button class="hvs-btn-locate" id="hvs-locate-btn" onclick="houseViewSpecialist.locateAndSearch()">
                <i class="bi bi-crosshair2 me-2"></i>Định vị & tìm tiện ích
              </button>
              <p class="hvs-locate-hint">Cho phép truy cập vị trí khi được hỏi</p>
            </div>
            <div id="hvs-shazam-container" class="hvs-shazam-container" style="display:none">
              <div class="hvs-shazam-rings">
                <div class="hvs-ring r1"></div><div class="hvs-ring r2"></div>
                <div class="hvs-ring r3"></div><div class="hvs-ring r4"></div>
                <div class="hvs-shazam-center"><i class="bi bi-geo-alt-fill"></i></div>
              </div>
              <p id="hvs-search-status" class="hvs-search-status-text">Đang định vị...</p>
            </div>
          ` : ''}

          ${errorBlock}

          ${hasResults ? `
            <div class="hvs-results-found">
              <div class="hvs-results-header">
                <i class="bi bi-check-circle-fill text-success me-2"></i>
                <span>Đã tìm thấy tiện ích</span>
                <button class="hvs-btn-sm ms-auto" onclick="houseViewSpecialist.resetAndLocate()">
                  <i class="bi bi-arrow-clockwise"></i> Lại
                </button>
              </div>
              ${this.viewingData.nearbyMrts.length > 0 ? `
                <div class="hvs-nearby-section">
                  <div class="hvs-nearby-title"><i class="bi bi-train-front me-1"></i>MRT (trong 2km)</div>
                  ${mrtList}
                </div>
              ` : `<div class="hvs-nearby-section hvs-nearby-empty"><i class="bi bi-exclamation-triangle me-1 text-warning"></i>Không có MRT trong 2km</div>`}
              ${this.viewingData.nearbyHawkerCenters.length > 0 ? `
                <div class="hvs-nearby-section">
                  <div class="hvs-nearby-title"><i class="bi bi-shop me-1"></i>Hawker Center</div>
                  ${hawkerList}
                </div>
              ` : `<div class="hvs-nearby-section hvs-nearby-empty"><i class="bi bi-exclamation-triangle me-1 text-warning"></i>Không có Hawker Center gần đây</div>`}
              ${this.viewingData.nearbySupermarkets.length > 0 ? `
                <div class="hvs-nearby-section">
                  <div class="hvs-nearby-title"><i class="bi bi-cart3 me-1"></i>Siêu thị</div>
                  ${superList}
                </div>
              ` : `<div class="hvs-nearby-section hvs-nearby-empty"><i class="bi bi-exclamation-triangle me-1 text-warning"></i>Không có siêu thị gần đây</div>`}
              <div id="hvs-shazam-container" style="display:none"></div>
            </div>
          ` : ''}
        </div>

        <div class="hvs-step-footer">
          <button class="hvs-btn-secondary" onclick="houseViewSpecialist.prevStep()">
            <i class="bi bi-arrow-left me-1"></i>Quay lại
          </button>
          <button class="hvs-btn-primary" onclick="houseViewSpecialist.nextStep()">
            Tiếp theo <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
      </div>
    `;
  }

  _renderStep5() {
    const s = this.viewingData.survey;
    const yesNo = (field, label, icon) => `
      <div class="hvs-survey-item">
        <div class="hvs-survey-question"><i class="${icon} me-2"></i>${label}</div>
        <div class="hvs-yn-group">
          <button class="hvs-yn-btn ${s[field] === true ? 'yes active' : 'yes'}"
            onclick="houseViewSpecialist.setSurveyBool('${field}', true)">
            <i class="bi bi-check-lg me-1"></i>Có
          </button>
          <button class="hvs-yn-btn ${s[field] === false ? 'no active' : 'no'}"
            onclick="houseViewSpecialist.setSurveyBool('${field}', false)">
            <i class="bi bi-x-lg me-1"></i>Không
          </button>
        </div>
      </div>
    `;
    const counter = (field, label, icon) => `
      <div class="hvs-survey-item">
        <div class="hvs-survey-question"><i class="${icon} me-2"></i>${label}</div>
        <div class="hvs-counter">
          <button class="hvs-counter-btn" onclick="houseViewSpecialist.adjustCounter('${field}', -1)"><i class="bi bi-dash"></i></button>
          <span class="hvs-counter-val" id="hvs-counter-${field}">${s[field] || 0}</span>
          <button class="hvs-counter-btn" onclick="houseViewSpecialist.adjustCounter('${field}', 1)"><i class="bi bi-plus"></i></button>
        </div>
      </div>
    `;

    return `
      <div class="hvs-step-content">
        <div class="hvs-step-title">
          <i class="bi bi-clipboard-check hvs-step-icon"></i>
          Khảo sát căn hộ
        </div>

        <div class="hvs-survey-scroll">
          ${yesNo('agentPreventsSublet', 'Agent có cấm sublet không?', 'bi bi-person-badge')}
          ${counter('storeRoomCount', 'Số phòng kho', 'bi bi-archive')}
          ${counter('livingRoomCompartments', 'Phòng khách ngăn được mấy phòng?', 'bi bi-layout-split')}
          ${yesNo('neighborOpenDoor', 'Hàng xóm đối diện có mở cửa?', 'bi bi-door-open')}
        </div>

        <div class="hvs-step-footer">
          <button class="hvs-btn-secondary" onclick="houseViewSpecialist.prevStep()">
            <i class="bi bi-arrow-left me-1"></i>Quay lại
          </button>
          <button class="hvs-btn-primary" onclick="houseViewSpecialist.nextStep()">
            Tiếp theo <i class="bi bi-arrow-right ms-1"></i>
          </button>
        </div>
      </div>
    `;
  }

  _renderStep6() {
    const s = this.viewingData.survey;
    return `
      <div class="hvs-step-content">
        <div class="hvs-step-title">
          <i class="bi bi-journal-text hvs-step-icon"></i>
          Ghi chú thêm
        </div>

        <div class="hvs-survey-scroll">
          <div class="hvs-survey-item">
            <div class="hvs-survey-question"><i class="bi bi-thermometer-half me-2"></i>Thương hiệu máy lạnh</div>
            <input type="text" id="hvs-aircon" class="hvs-input"
              placeholder="Ví dụ: Daikin, Mitsubishi..."
              value="${escapeHtml(s.airconBrand)}" />
          </div>

          <div class="hvs-survey-item">
            <div class="hvs-survey-question"><i class="bi bi-house-heart me-2"></i>Tình trạng căn hộ</div>
            <input type="text" id="hvs-condition" class="hvs-input"
              placeholder="Ví dụ: mới, đẹp, cũ..."
              value="${escapeHtml(s.condition)}" />
          </div>

          <div class="hvs-survey-item">
            <div class="hvs-survey-question"><i class="bi bi-journal-text me-2"></i>Ghi chú thêm</div>
            <textarea id="hvs-notes" class="hvs-input hvs-textarea"
              placeholder="Nhập ghi chú thêm về căn nhà..."
              rows="3">${escapeHtml(s.notes)}</textarea>
          </div>
        </div>

        <div class="hvs-step-footer">
          <button class="hvs-btn-secondary" onclick="houseViewSpecialist.prevStep()">
            <i class="bi bi-arrow-left me-1"></i>Quay lại
          </button>
          <button class="hvs-btn-primary" onclick="houseViewSpecialist.nextStep()">
            Xem báo cáo <i class="bi bi-file-text ms-1"></i>
          </button>
        </div>
      </div>
    `;
  }

  _renderStep7() {
    const report = this._generateReport();
    this.viewingData.finalReport = report;

    return `
      <div class="hvs-step-content">
        <div class="hvs-step-title">
          <i class="bi bi-file-earmark-text hvs-step-icon"></i>
          Báo cáo xem nhà
        </div>

        <div class="hvs-report-scroll">
          <div class="hvs-report-box">
            <pre id="hvs-report-text" class="hvs-report-pre">${escapeHtml(report)}</pre>
          </div>
          <div class="hvs-report-actions">
            <button class="hvs-btn-copy" onclick="houseViewSpecialist.copyReport()">
              <i class="bi bi-clipboard me-2"></i>Sao chép báo cáo
            </button>
          </div>
        </div>

        <div class="hvs-step-footer">
          <button class="hvs-btn-secondary" onclick="houseViewSpecialist.prevStep()">
            <i class="bi bi-arrow-left me-1"></i>Quay lại
          </button>
          <button class="hvs-btn-success" onclick="houseViewSpecialist.saveRecord()">
            <i class="bi bi-floppy me-1"></i>Lưu & Hoàn tất
          </button>
        </div>
      </div>
    `;
  }

  // ─── Report view (read-only) ───────────────────────────────────────────────

  renderReportView() {
    const container = document.getElementById('hvs-container');
    if (!container) return;
    const report = this.viewingData.finalReport || this._generateReport();

    container.innerHTML = `
      <div class="hvs-wizard">
        <div class="hvs-wizard-header">
          <button class="hvs-back-btn" onclick="houseViewSpecialist.goToList()">
            <i class="bi bi-arrow-left"></i>
          </button>
          <div class="hvs-step-info">
            <div class="hvs-step-label">${escapeHtml(this.viewingData.propertyName || this.viewingData.address || 'Báo cáo xem nhà')}</div>
            <div class="hvs-step-count">${this.viewingData.unitNumber ? 'Unit ' + escapeHtml(this.viewingData.unitNumber) : ''}</div>
          </div>
          <button class="hvs-btn-icon" onclick="houseViewSpecialist.editRecord()" title="Chỉnh sửa">
            <i class="bi bi-pencil"></i>
          </button>
        </div>

        <div class="hvs-wizard-body">
          <div class="hvs-report-scroll">
            <div class="hvs-report-box" style="margin-top:12px">
              <pre class="hvs-report-pre">${escapeHtml(report)}</pre>
            </div>
            <div class="hvs-report-actions">
              <button class="hvs-btn-copy" onclick="houseViewSpecialist.copyReport()">
                <i class="bi bi-clipboard me-2"></i>Sao chép
              </button>
              <button class="hvs-btn-danger-sm" onclick="houseViewSpecialist.confirmDelete()">
                <i class="bi bi-trash me-1"></i>Xóa
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  editRecord() {
    this.view = 'wizard';
    this.step = 1;
    this.renderWizard();
  }

  // ─── Report generation ─────────────────────────────────────────────────────

  _generateReport() {
    const d = this.viewingData;
    const s = d.survey;
    const lines = [];
    const fmt = (m) => m >= 1000 ? (m / 1000).toFixed(1) + 'km' : m + 'm';

    // ── Property header ──────────────────────────────────────────
    const name = d.propertyName || d.address || 'Căn hộ';
    lines.push(`🏠 ${name}`);
    if (d.unitNumber) lines.push(`Unit ${d.unitNumber}`);
    if (d.address) {
      const addrLine = d.postalCode && !d.address.includes(d.postalCode)
        ? `${d.address} (S${d.postalCode})`
        : d.address;
      lines.push(`📍 ${addrLine}`);
    }
    // Property specs
    if (d.propertyType) lines.push(`🏷️ ${d.propertyType === 'hdb' ? 'HDB' : 'Condo'}`);
    const specs = [];
    if (d.bedrooms)     specs.push(`${d.bedrooms} phòng ngủ`);
    if (d.bathrooms)    specs.push(`${d.bathrooms} phòng tắm`);
    if (d.floorAreaSqft) specs.push(`${d.floorAreaSqft} sqft`);
    if (specs.length)   lines.push(`📐 ${specs.join(' · ')}`);
    if (d.propertyGuruUrl) lines.push(`🔗 ${d.propertyGuruUrl}`);
    lines.push('');

    // ── MRT ──────────────────────────────────────────────────────
    lines.push('── MRT ──');
    if (d.nearbyMrts.length > 0) {
      d.nearbyMrts.slice(0, 4).forEach((m) => {
        lines.push(`- ${m.name} ${fmt(m.distance)}`);
      });
      if (d.nearbyMrts[0].distance > 1500) lines.push('- khá xa các mrt');
    } else {
      lines.push('- không có mrt trong 2km');
    }
    lines.push('');

    // ── Chỗ ăn uống ──────────────────────────────────────────────
    lines.push('── Chỗ ăn uống ──');
    if (d.nearbyHawkerCenters.length > 0) {
      d.nearbyHawkerCenters.slice(0, 3).forEach((h) => {
        lines.push(`- ${h.name} ${fmt(h.distance)}`);
      });
    } else {
      lines.push('- không có hawker center gần đây');
    }
    lines.push('');

    // ── Siêu thị ──────────────────────────────────────────────────
    lines.push('── Siêu thị ──');
    const groups = {};
    d.nearbySupermarkets.forEach((sup) => {
      if (!groups[sup.name]) groups[sup.name] = [];
      groups[sup.name].push(sup);
    });
    if (Object.keys(groups).length > 0) {
      Object.entries(groups).forEach(([chain, stores]) => {
        const dists = stores.map((sup) => fmt(sup.distance)).join(' · ');
        lines.push(`- ${chain}${stores.length > 1 ? ' ' + stores.length + ' cái' : ''} - ${dists}`);
      });
    } else {
      lines.push('- không có siêu thị gần đây');
    }
    lines.push('');

    // ── Thông tin nhà ─────────────────────────────────────────────
    lines.push('── Thông tin nhà ──');
    if (s.airconBrand)  lines.push(`- máy lạnh ${s.airconBrand}`);
    if (s.condition)    lines.push(`- ${s.condition}`);
    lines.push(`- phòng khách ngăn được ${s.livingRoomCompartments} phòng`);
    lines.push(`- ${s.storeRoomCount} phòng kho`);
    if (s.agentPreventsSublet === true)  lines.push('- agent có đề phòng sublet');
    if (s.agentPreventsSublet === false) lines.push('- agent ko có đề phòng sublet');
    if (s.neighborOpenDoor === true)     lines.push('- hàng xóm đối diện mở cửa');
    if (s.neighborOpenDoor === false)    lines.push('- hàng xóm đối diện đóng cửa');
    if (s.notes) {
      s.notes.split('\n').forEach((line) => {
        if (line.trim()) lines.push(`- ${line.trim()}`);
      });
    }

    // ── Agent ─────────────────────────────────────────────────────
    if (s.agentName || s.agentPhone) {
      lines.push('');
      lines.push('── Agent ──');
      if (s.agentName)  lines.push(`- Tên: ${s.agentName}`);
      if (s.agentPhone) lines.push(`- SĐT: ${s.agentPhone}`);
    }

    return lines.join('\n');
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  goBack() {
    if (this.step > 1) {
      this.prevStep();
    } else {
      this.goToList();
    }
  }

  goToList() {
    this.view = 'list';
    this.editingId = null;
    this.renderList();
    this.loadRecords();
  }

  prevStep() {
    this._collectCurrentStep();
    this.step = Math.max(1, this.step - 1);
    this.renderWizard();
  }

  nextStep() {
    this._collectCurrentStep();
    this.step = Math.min(this.totalSteps, this.step + 1);
    this.renderWizard();
  }

  _collectCurrentStep() {
    switch (this.step) {
      case 1:
        // propertyType set directly by setPropertyType()
        break;
      case 2:
        this.viewingData.propertyGuruUrl  = document.getElementById('hvs-pg-url')?.value.trim() || '';
        this.viewingData.propertyName     = document.getElementById('hvs-property-name')?.value.trim() || '';
        this.viewingData.address          = document.getElementById('hvs-address')?.value.trim() || '';
        this.viewingData.postalCode       = document.getElementById('hvs-postal')?.value.trim() || '';
        this.viewingData.unitNumber       = document.getElementById('hvs-unit')?.value.trim() || '';
        break;
      case 3:
        this.viewingData.floorAreaSqft        = parseFloat(document.getElementById('hvs-field-floorAreaSqft')?.value) || 0;
        this.viewingData.survey.agentName     = document.getElementById('hvs-agent-name')?.value.trim() || '';
        this.viewingData.survey.agentPhone    = document.getElementById('hvs-agent-phone')?.value.trim() || '';
        break;
      case 6:
        this.viewingData.survey.airconBrand = document.getElementById('hvs-aircon')?.value.trim() || '';
        this.viewingData.survey.condition   = document.getElementById('hvs-condition')?.value.trim() || '';
        this.viewingData.survey.notes       = document.getElementById('hvs-notes')?.value.trim() || '';
        break;
    }
  }

  // ─── Survey interactions ───────────────────────────────────────────────────

  setSurveyBool(field, value) {
    this.viewingData.survey[field] = value;
    // Re-render just the buttons for that field
    document.querySelectorAll(`.hvs-yn-btn`).forEach((btn) => {
      const parent = btn.closest('.hvs-survey-item');
      if (parent) {
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(`'${field}'`)) {
          btn.classList.remove('active');
          const isYes = onclick.includes('true');
          const isNo = onclick.includes('false');
          if ((isYes && value === true) || (isNo && value === false)) {
            btn.classList.add('active');
          }
        }
      }
    });
  }

  adjustCounter(field, delta) {
    const current = this.viewingData.survey[field] || 0;
    const newVal = Math.max(0, current + delta);
    this.viewingData.survey[field] = newVal;
    const el = document.getElementById(`hvs-counter-${field}`);
    if (el) el.textContent = newVal;
  }

  setPropertyType(type) {
    this.viewingData.propertyType = type;
    this.viewingData.bedrooms  = 3;
    this.viewingData.bathrooms = type === 'hdb' ? 3 : 2;
    document.querySelectorAll('.hvs-type-card').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
  }

  // For top-level numeric fields (bedrooms, bathrooms) on Step 1
  adjustField(field, delta) {
    const current = this.viewingData[field] || 0;
    const newVal = Math.max(0, current + delta);
    this.viewingData[field] = newVal;
    const el = document.getElementById(`hvs-field-${field}`);
    if (el) el.textContent = newVal;
  }

  // ─── Location & nearby search ──────────────────────────────────────────────

  // Start the Shazam animation in the UI
  _startSearchAnimation() {
    const shazamContainer = document.getElementById('hvs-shazam-container');
    const locateBtn = document.getElementById('hvs-locate-btn');
    if (shazamContainer) shazamContainer.style.display = 'flex';
    if (locateBtn) locateBtn.style.display = 'none';
  }

  _stopSearchAnimation() {
    const shazamContainer = document.getElementById('hvs-shazam-container');
    const locateBtn = document.getElementById('hvs-locate-btn');
    if (shazamContainer) shazamContainer.style.display = 'none';
    if (locateBtn) locateBtn.style.display = '';
  }

  _setSearchStatus(text) {
    const statusEl = document.getElementById('hvs-search-status');
    if (statusEl) statusEl.textContent = text;
  }

  async _fetchNearby(lat, lng) {
    this._setSearchStatus('Đang tìm MRT, hawker center và siêu thị...');
    const res = await API.post(API_CONFIG.ENDPOINTS.HOUSE_VIEW_SPECIALIST_NEARBY, {
      lat, lng, radiusMeters: 2000,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Lỗi khi tìm kiếm');
    this.viewingData.nearbyMrts = data.data.mrts || [];
    this.viewingData.nearbyHawkerCenters = data.data.hawkers || [];
    this.viewingData.nearbySupermarkets = data.data.supermarkets || [];
  }

  async locateAndSearch() {
    this.locationError = null;
    this._startSearchAnimation();
    this._setSearchStatus('Đang định vị...');

    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(Object.assign(new Error('Trình duyệt không hỗ trợ định vị'), { code: 0 }));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
        });
      });

      const { latitude: lat, longitude: lng } = position.coords;
      this.viewingData.location = { lat, lng };
      await this._fetchNearby(lat, lng);
      this._setSearchStatus('Tìm xong! ✅');
      setTimeout(() => this.renderWizard(), 500);
    } catch (err) {
      console.error('Location error:', err);
      this._stopSearchAnimation();

      // Map GeolocationPositionError codes to friendly Vietnamese messages
      const messages = {
        0: 'Trình duyệt không hỗ trợ định vị.',
        1: 'Bị từ chối quyền truy cập vị trí. Kiểm tra cài đặt trình duyệt.',
        2: 'Không thể xác định vị trí (thiết bị hoặc GPS không phản hồi).',
        3: 'Quá thời gian định vị. Vui lòng thử lại.',
      };
      const msg = messages[err.code] || (err.message || 'Lỗi không xác định.');
      this.locationError = { code: err.code || 0, message: msg };
      this.renderWizard(); // re-render step 2 showing fallback
    }
  }

  retryLocate() {
    this.locationError = null;
    this.renderWizard();
    // Small delay so the animation container renders before we trigger
    setTimeout(() => this.locateAndSearch(), 80);
  }

  resetAndLocate() {
    this.viewingData.nearbyMrts = [];
    this.viewingData.nearbyHawkerCenters = [];
    this.viewingData.nearbySupermarkets = [];
    this.viewingData.location = null;
    this.locationError = null;
    this.renderWizard();
    setTimeout(() => this.locateAndSearch(), 80);
  }

  async geocodeAndSearch() {
    const addressInput = document.getElementById('hvs-manual-address');
    const statusEl = document.getElementById('hvs-geocode-status');
    const address = addressInput?.value.trim();
    if (!address) { showToast('Nhập địa chỉ trước', 'error'); return; }

    if (statusEl) statusEl.textContent = 'Đang tìm toạ độ...';

    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.HOUSE_VIEW_SPECIALIST_GEOCODE, { address });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Không tìm thấy địa chỉ');

      const { lat, lng } = data.data;
      this.viewingData.location = { lat, lng };
      this.locationError = null;

      // Show shazam animation while fetching nearby
      this.renderWizard(); // clears error block, shows default (no results yet)
      setTimeout(async () => {
        this._startSearchAnimation();
        this._setSearchStatus('Đang tìm tiện ích gần đây...');
        try {
          await this._fetchNearby(lat, lng);
          this._setSearchStatus('Tìm xong! ✅');
          setTimeout(() => this.renderWizard(), 500);
        } catch (e) {
          this._stopSearchAnimation();
          showToast('Lỗi khi tìm tiện ích: ' + e.message, 'error');
        }
      }, 80);
    } catch (err) {
      if (statusEl) statusEl.textContent = '⚠️ ' + (err.message || 'Lỗi geocoding');
    }
  }

  // ─── PropertyGuru crawler ──────────────────────────────────────────────────

  clearUrl() {
    this.viewingData.propertyGuruUrl = '';
    const urlInput = document.getElementById('hvs-pg-url');
    const statusEl = document.getElementById('hvs-crawl-status');
    if (urlInput) { urlInput.value = ''; urlInput.focus(); }
    if (statusEl) statusEl.textContent = '';
  }

  async crawlUrl() {
    const urlInput = document.getElementById('hvs-pg-url');
    const statusEl = document.getElementById('hvs-crawl-status');
    const btn = document.getElementById('hvs-crawl-btn');

    const url = urlInput?.value.trim();
    if (!url) { showToast('Nhập URL trước', 'error'); return; }

    if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    if (statusEl) statusEl.textContent = 'Đang lấy thông tin...';

    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.HOUSE_VIEW_SPECIALIST_CRAWL, { url });
      const data = await res.json();

      if (data.success) {
        const d = data.data;
        const fill = (id, field, val) => {
          if (!val) return;
          this.viewingData[field] = val;
          const el = document.getElementById(id);
          if (el) el.value = val;
        };
        const fillCounter = (field, val) => {
          if (!val) return;
          this.viewingData[field] = val;
          const el = document.getElementById(`hvs-field-${field}`);
          if (el) el.textContent = val;
        };

        fill('hvs-property-name', 'propertyName', d.propertyName);
        fill('hvs-address',       'address',       d.address);
        fill('hvs-postal',        'postalCode',     d.postalCode);
        fillCounter('bedrooms',     d.bedrooms);
        fillCounter('bathrooms',    d.bathrooms);
        if (d.floorAreaSqft) {
          this.viewingData.floorAreaSqft = d.floorAreaSqft;
          const el = document.getElementById('hvs-field-floorAreaSqft');
          if (el) el.value = d.floorAreaSqft;
        }

        if (data.blockedByCloudflare) {
          const slugName = d.propertyName ? `Lấy được tên từ URL: ${d.propertyName}` : '';
          if (statusEl) statusEl.textContent = `⚠️ PropertyGuru chặn bot — vui lòng điền thủ công. ${slugName}`;
        } else if (data.crawled) {
          const filled = [d.propertyName, d.address, d.bedrooms].filter(Boolean).length;
          if (statusEl) statusEl.textContent = filled > 0 ? `✅ Đã lấy ${filled} thông tin tự động` : '⚠️ Không lấy được thông tin, nhập thủ công';
        } else {
          if (statusEl) statusEl.textContent = d.propertyName ? `✅ Tên từ URL: ${d.propertyName}` : '⚠️ Nhập thủ công';
        }
      } else {
        if (statusEl) statusEl.textContent = '⚠️ Không thể lấy thông tin, nhập thủ công';
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = '⚠️ Lỗi kết nối';
    } finally {
      if (btn) btn.innerHTML = '<i class="bi bi-search"></i>';
    }
  }

  // ─── Save / Delete ─────────────────────────────────────────────────────────

  async saveRecord() {
    this._collectCurrentStep();
    this.viewingData.finalReport = this._generateReport();
    this.viewingData.status = 'completed';

    try {
      let res;
      if (this.editingId) {
        res = await API.put(API_CONFIG.ENDPOINTS.HOUSE_VIEW_SPECIALIST_BY_ID(this.editingId), this.viewingData);
      } else {
        res = await API.post(API_CONFIG.ENDPOINTS.HOUSE_VIEW_SPECIALIST, this.viewingData);
      }
      const data = await res.json();
      if (data.success) {
        showToast('Đã lưu thông tin xem nhà ✅', 'success');
        this.editingId = data.data._id;
        this.view = 'report';
        this.viewingData = data.data;
        this.renderReportView();
        this.loadRecords();
      } else {
        showToast('Lỗi khi lưu: ' + (data.message || ''), 'error');
      }
    } catch (e) {
      showToast('Lỗi kết nối khi lưu', 'error');
    }
  }

  copyReport() {
    const report = this.viewingData.finalReport || this._generateReport();
    navigator.clipboard.writeText(report).then(() => {
      showToast('Đã sao chép báo cáo! 📋', 'success');
    }).catch(() => {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = report;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showToast('Đã sao chép! 📋', 'success');
    });
  }

  confirmDelete() {
    if (!this.editingId) return;
    if (!confirm('Xác nhận xóa lần xem nhà này?')) return;
    this.deleteRecord(this.editingId);
  }

  async deleteRecord(id) {
    try {
      const res = await API.delete(API_CONFIG.ENDPOINTS.HOUSE_VIEW_SPECIALIST_BY_ID(id));
      const data = await res.json();
      if (data.success) {
        showToast('Đã xóa', 'success');
        this.goToList();
      } else {
        showToast('Lỗi khi xóa', 'error');
      }
    } catch (e) {
      showToast('Lỗi kết nối', 'error');
    }
  }

  // ─── Event binding ─────────────────────────────────────────────────────────

  _bindWizardEvents() {
    const urlInput = document.getElementById('hvs-pg-url');
    if (urlInput) {
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.crawlUrl();
      });
    }

    const postalInput = document.getElementById('hvs-postal');
    if (postalInput) {
      // Auto-lookup when 6 digits are typed
      postalInput.addEventListener('input', () => {
        const val = postalInput.value.replace(/\D/g, '');
        if (val.length === 6) this.lookupPostal();
      });
      postalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.lookupPostal();
      });
    }
  }

  async lookupPostal() {
    const postalInput = document.getElementById('hvs-postal');
    const statusEl   = document.getElementById('hvs-postal-status');
    const btn        = document.getElementById('hvs-postal-btn');
    const postal     = (postalInput?.value || '').replace(/\D/g, '').trim();

    if (postal.length !== 6) {
      if (statusEl) statusEl.textContent = '⚠️ Nhập đúng 6 chữ số';
      return;
    }

    if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    if (statusEl) statusEl.textContent = 'Đang tra cứu...';

    try {
      const res  = await API.post(API_CONFIG.ENDPOINTS.HOUSE_VIEW_SPECIALIST_GEOCODE, { address: postal });
      const data = await res.json();

      if (data.success) {
        const { address, postalCode } = data.data;
        this.viewingData.address    = address;
        this.viewingData.postalCode = postalCode || postal;

        const addrEl = document.getElementById('hvs-address');
        if (addrEl) addrEl.value = address;

        if (statusEl) statusEl.textContent = `✅ ${address}`;
      } else {
        if (statusEl) statusEl.textContent = '⚠️ Không tìm thấy địa chỉ';
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = '⚠️ Lỗi tra cứu';
    } finally {
      if (btn) btn.innerHTML = '<i class="bi bi-search"></i>';
    }
  }
}

window.houseViewSpecialist = new HouseViewSpecialistComponent();
