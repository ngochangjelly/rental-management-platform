import { ROOM_TYPE_MAP } from '../utils/room-type-mapper.js';
import i18next from '../i18n.js';

/**
 * SalesMapComponent — Singapore property map for the Sales department.
 * Shows accessible properties as Leaflet markers (HDB vs Condo) with
 * a side panel that lists rooms and sales availability on hover/click.
 *
 * Initialization is lazy: the Leaflet map is not created until the section
 * is first shown (Leaflet needs a visible, sized element).
 */
class SalesMapComponent {
  constructor() {
    this.map = null;
    this.markers = [];
    this.properties = [];
    this.selectedProperty = null;
    this._initDone = false;
    this._leafletReady = false;
    this._dataLoaded = false;
    this._activeFilter = 'all';
  }

  // ─── Called by DashboardController when section becomes visible ──────────────

  async activate() {
    if (!this._initDone) {
      await this._loadLeaflet();
      this._renderShell();
      await this.loadData();
      this._initDone = true;
    } else if (this.map) {
      // Re-show: invalidate size in case the container was resized while hidden
      setTimeout(() => this.map.invalidateSize(), 50);
    }
  }

  // ─── Leaflet CDN loader ──────────────────────────────────────────────────────

  _loadLeaflet() {
    if (window.L) { this._leafletReady = true; return Promise.resolve(); }
    return Promise.all([
      this._loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'),
      this._loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'),
    ]).then(() => { this._leafletReady = true; });
  }

  _loadCSS(href) {
    return new Promise((resolve) => {
      if (document.querySelector(`link[href="${href}"]`)) return resolve();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.appendChild(link);
    });
  }

  _loadScript(src) {
    return new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        const poll = setInterval(() => { if (window.L) { clearInterval(poll); resolve(); } }, 50);
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    });
  }

  // ─── Shell rendering ─────────────────────────────────────────────────────────

  _renderShell() {
    const container = document.getElementById('sales-map-container');
    if (!container) return;
    const t = (k) => i18next.t(`salesMap.${k}`);

    container.innerHTML = `
      <!-- Stats bar -->
      <div id="sm-stats-bar" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        <div class="sm-stat-card" style="background:white;border-radius:10px;padding:10px 18px;border:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,.06);min-width:130px;">
          <i class="bi bi-building" style="font-size:1.3rem;color:#667eea;"></i>
          <div>
            <div id="sm-stat-total" style="font-size:1.4rem;font-weight:800;color:#111827;line-height:1;">—</div>
            <div style="font-size:0.72rem;color:#6b7280;margin-top:1px;">${t('statTotal')}</div>
          </div>
        </div>
        <div class="sm-stat-card" style="background:white;border-radius:10px;padding:10px 18px;border:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,.06);min-width:110px;">
          <span style="width:14px;height:14px;border-radius:50%;background:#2563eb;display:inline-block;flex-shrink:0;"></span>
          <div>
            <div id="sm-stat-hdb" style="font-size:1.4rem;font-weight:800;color:#111827;line-height:1;">—</div>
            <div style="font-size:0.72rem;color:#6b7280;margin-top:1px;">HDB</div>
          </div>
        </div>
        <div class="sm-stat-card" style="background:white;border-radius:10px;padding:10px 18px;border:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,.06);min-width:110px;">
          <span style="width:14px;height:14px;border-radius:50%;background:#d97706;display:inline-block;flex-shrink:0;"></span>
          <div>
            <div id="sm-stat-condo" style="font-size:1.4rem;font-weight:800;color:#111827;line-height:1;">—</div>
            <div style="font-size:0.72rem;color:#6b7280;margin-top:1px;">Condo</div>
          </div>
        </div>
        <div class="sm-stat-card" style="background:white;border-radius:10px;padding:10px 18px;border:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,.06);min-width:140px;">
          <i class="bi bi-door-open" style="font-size:1.3rem;color:#16a34a;"></i>
          <div>
            <div id="sm-stat-available" style="font-size:1.4rem;font-weight:800;color:#16a34a;line-height:1;">—</div>
            <div style="font-size:0.72rem;color:#6b7280;margin-top:1px;">${t('statRoomsAvail')}</div>
          </div>
        </div>
        <div class="sm-stat-card" style="background:white;border-radius:10px;padding:10px 18px;border:1px solid #e5e7eb;display:flex;align-items:center;gap:10px;box-shadow:0 1px 4px rgba(0,0,0,.06);min-width:140px;">
          <i class="bi bi-door-closed" style="font-size:1.3rem;color:#6b7280;"></i>
          <div>
            <div id="sm-stat-occupied" style="font-size:1.4rem;font-weight:800;color:#374151;line-height:1;">—</div>
            <div style="font-size:0.72rem;color:#6b7280;margin-top:1px;">${t('statRoomsOccup')}</div>
          </div>
        </div>
      </div>

      <div class="sales-map-layout d-flex gap-0" style="height:calc(100vh - 220px);min-height:480px;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

        <!-- Map pane -->
        <div style="position:relative;flex:1 1 0;min-width:0;">
          <div id="sales-leaflet-map" style="width:100%;height:100%;"></div>

          <!-- Loading overlay -->
          <div id="sm-loading" style="position:absolute;inset:0;background:rgba(255,255,255,0.88);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2000;">
            <div class="spinner-border text-primary" style="width:2.5rem;height:2.5rem;" role="status"></div>
            <div style="margin-top:12px;color:#6c757d;">${t('loading')}</div>
          </div>

          <!-- Type filter pills -->
          <div style="position:absolute;top:12px;left:12px;z-index:1000;display:flex;gap:6px;">
            ${['all','hdb','condo'].map((f, i) => `
              <button class="sm-filter-btn${i===0?' sm-filter-active':''}" data-filter="${f}"
                style="background:${i===0?'#667eea':'white'};color:${i===0?'white':'#374151'};border:1px solid ${i===0?'#667eea':'#dee2e6'};border-radius:20px;padding:4px 14px;font-size:0.78rem;cursor:pointer;font-weight:${i===0?700:400};transition:all .2s;">
                ${f === 'all' ? t('all') : f.toUpperCase()}
              </button>`).join('')}
          </div>

          <!-- Legend -->
          <div style="position:absolute;bottom:28px;left:12px;background:white;border-radius:8px;padding:10px 14px;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-size:0.8rem;z-index:1000;">
            <div style="font-weight:700;margin-bottom:6px;">${t('legend')}</div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span style="width:13px;height:13px;border-radius:50%;background:#2563eb;display:inline-block;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);"></span>
              <span>${t('hdb')}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span style="width:13px;height:13px;border-radius:50%;background:#d97706;display:inline-block;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.3);"></span>
              <span>${t('condo')}</span>
            </div>
          </div>
        </div>

        <!-- Detail panel (desktop) -->
        <div id="sm-panel" style="width:300px;min-width:260px;background:#f8f9fa;border-left:1px solid #dee2e6;display:flex;flex-direction:column;overflow:hidden;">
          <div style="padding:14px 16px;border-bottom:1px solid #dee2e6;background:white;">
            <div style="font-weight:700;font-size:0.9rem;color:#374151;">${t('panelTitle')}</div>
            <div id="sm-panel-meta" style="font-size:0.75rem;color:#9ca3af;margin-top:2px;"></div>
          </div>
          <div id="sm-panel-body" style="flex:1;overflow-y:auto;padding:14px 16px;">
            <div style="text-align:center;color:#9ca3af;padding-top:48px;">
              <i class="bi bi-cursor" style="font-size:2.5rem;"></i>
              <div style="margin-top:10px;font-size:0.85rem;">${t('hoverHint')}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mobile panel (below map, shown on small screens) -->
      <div id="sm-mobile-panel" style="display:none;margin-top:12px;background:#f8f9fa;border-radius:12px;border:1px solid #dee2e6;overflow:hidden;">
        <div style="padding:12px 16px;border-bottom:1px solid #dee2e6;background:white;">
          <div id="sm-mobile-title" style="font-weight:700;font-size:0.9rem;"></div>
        </div>
        <div id="sm-mobile-body" style="padding:12px 16px;"></div>
      </div>
    `;

    this._attachFilterListeners();
    this._initResponsive();
  }

  _attachFilterListeners() {
    document.querySelectorAll('.sm-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._activeFilter = btn.dataset.filter;
        document.querySelectorAll('.sm-filter-btn').forEach(b => {
          const active = b === btn;
          b.classList.toggle('sm-filter-active', active);
          b.style.background = active ? '#667eea' : 'white';
          b.style.color = active ? 'white' : '#374151';
          b.style.borderColor = active ? '#667eea' : '#dee2e6';
          b.style.fontWeight = active ? '700' : '400';
        });
        this._placeMarkers(this._activeFilter);
      });
    });
  }

  _initResponsive() {
    const apply = () => {
      const panel = document.getElementById('sm-panel');
      const mPanel = document.getElementById('sm-mobile-panel');
      const layout = document.querySelector('.sales-map-layout');
      if (!layout) return;
      if (window.innerWidth < 768) {
        layout.style.flexDirection = 'column';
        if (panel) panel.style.display = 'none';
        if (mPanel) mPanel.style.display = 'block';
      } else {
        layout.style.flexDirection = 'row';
        if (panel) panel.style.display = 'flex';
        if (mPanel) mPanel.style.display = 'none';
      }
    };
    apply();
    window.addEventListener('resize', apply);
  }

  // ─── Data loading ─────────────────────────────────────────────────────────────

  async loadData() {
    try {
      const res = await API.get(API_CONFIG.ENDPOINTS.SALES_MAP_DATA);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load');
      this.properties = data.properties || [];
      this._initMap();
      this._placeMarkers(this._activeFilter);
      this._updateMeta();
    } catch (err) {
      console.error('[SalesMap] loadData failed:', err);
      this._showLoadError(err.message);
    } finally {
      const el = document.getElementById('sm-loading');
      if (el) el.style.display = 'none';
    }
  }

  // ─── Map ──────────────────────────────────────────────────────────────────────

  _initMap() {
    if (this.map || !window.L) return;
    const el = document.getElementById('sales-leaflet-map');
    if (!el) return;

    this.map = L.map('sales-leaflet-map', {
      center: [1.3521, 103.8198],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);
  }

  _makeIcon(type) {
    const color = type === 'condo' ? '#d97706' : '#2563eb';
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/></svg>`
    );
    return L.icon({
      iconUrl: `data:image/svg+xml,${svg}`,
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -38],
    });
  }

  _placeMarkers(filter = 'all') {
    if (!this.map || !window.L) return;
    this.markers.forEach(({ marker }) => marker.remove());
    this.markers = [];

    // Remove stale banner
    document.getElementById('sm-no-coords-banner')?.remove();

    const list = filter === 'all' ? this.properties : this.properties.filter(p => p.propertyType === filter);
    this._updateStats(list);
    const noCoords = [];

    for (const prop of list) {
      if (!prop.latitude || !prop.longitude) { noCoords.push(prop); continue; }

      const t = (k) => i18next.t(`salesMap.${k}`);
      const icon = this._makeIcon(prop.propertyType);
      const marker = L.marker([prop.latitude, prop.longitude], { icon }).addTo(this.map);

      marker.bindTooltip(
        `<strong>${prop.address}</strong><br>${prop.unit}<br><span style="color:#16a34a">${t('available')}: ${prop.availableCount}/${prop.totalRooms}</span>`,
        { permanent: false, direction: 'top', offset: [0, -38] }
      );

      marker.on('mouseover', () => this._showPanel(prop));
      marker.on('click', () => this._showPanel(prop));
      this.markers.push({ marker, property: prop });
    }

    if (noCoords.length) this._showNoCoordsBanner(noCoords);

    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers.map(m => m.marker));
      this.map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14 });
    }
  }

  // ─── Side panel ───────────────────────────────────────────────────────────────

  _showPanel(prop) {
    this.selectedProperty = prop;
    const html = this._buildPanelHTML(prop);
    const meta = `${prop.propertyId} · ${prop.propertyType.toUpperCase()}`;

    const body = document.getElementById('sm-panel-body');
    if (body) body.innerHTML = html;
    const panelMeta = document.getElementById('sm-panel-meta');
    if (panelMeta) panelMeta.textContent = meta;

    const mTitle = document.getElementById('sm-mobile-title');
    if (mTitle) mTitle.textContent = `${prop.address} ${prop.unit}`;
    const mBody = document.getElementById('sm-mobile-body');
    if (mBody) mBody.innerHTML = html;

    document.querySelectorAll('.sm-geocode-btn').forEach(btn =>
      btn.addEventListener('click', () => this._geocode(prop))
    );
  }

  _buildPanelHTML(prop) {
    const t = (k) => i18next.t(`salesMap.${k}`);
    const typeColor = prop.propertyType === 'condo' ? '#d97706' : '#2563eb';
    const typeLabel = prop.propertyType === 'condo' ? 'Condo' : 'HDB';

    const pct = prop.totalRooms > 0 ? Math.round(prop.occupiedCount / prop.totalRooms * 100) : 0;
    const barColor = pct >= 80 ? '#dc2626' : pct >= 50 ? '#d97706' : '#16a34a';

    let html = `
      <div style="margin-bottom:14px;">
        <div style="font-weight:700;font-size:0.97rem;color:#111827;">${prop.address}</div>
        <div style="color:#6b7280;font-size:0.82rem;margin-top:2px;">${prop.unit}${prop.postcode ? ' · S(' + prop.postcode + ')' : ''}</div>
        <span style="display:inline-block;margin-top:6px;padding:2px 10px;border-radius:20px;font-size:0.72rem;font-weight:700;background:${typeColor}22;color:${typeColor};">${typeLabel}</span>
      </div>
      <div style="margin-bottom:14px;background:white;border-radius:8px;padding:10px 12px;border:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-bottom:5px;">
          <span style="font-weight:600;color:#374151;">${t('occupancy')}</span>
          <span style="font-weight:700;color:${barColor};">${prop.occupiedCount}/${prop.totalRooms} (${pct}%)</span>
        </div>
        <div style="background:#e5e7eb;border-radius:4px;height:5px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${barColor};border-radius:4px;transition:width .4s;"></div>
        </div>
      </div>
    `;

    if (prop.totalRooms === 0) {
      html += `<div style="color:#9ca3af;font-size:0.82rem;text-align:center;padding:8px 0;">${t('noRooms')}</div>`;
    } else {
      if (prop.availableRooms.length > 0) {
        html += `<div style="margin-bottom:10px;">
          <div style="font-size:0.7rem;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">${t('available')} (${prop.availableRooms.length})</div>`;
        for (const r of prop.availableRooms) {
          html += `<div style="display:flex;align-items:center;gap:7px;padding:5px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;margin-bottom:3px;font-size:0.8rem;">
            <span style="color:#16a34a;">●</span>
            <span style="font-weight:600;color:#166534;">${this._roomLabel(r)}</span>
          </div>`;
        }
        html += `</div>`;
      }

      if (prop.occupiedRooms.length > 0) {
        html += `<div>
          <div style="font-size:0.7rem;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">${t('occupied')} (${prop.occupiedRooms.length})</div>`;
        for (const r of prop.occupiedRooms) {
          html += `<div style="display:flex;align-items:center;gap:7px;padding:5px 10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:3px;font-size:0.8rem;">
            <span style="color:#d1d5db;">●</span>
            <span style="color:#6b7280;">${this._roomLabel(r)}</span>
          </div>`;
        }
        html += `</div>`;
      }
    }

    if (!prop.latitude || !prop.longitude) {
      html += `
        <div style="margin-top:12px;padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:0.78rem;">
          <div style="color:#92400e;margin-bottom:6px;">${t('noCoords')}</div>
          <button class="sm-geocode-btn btn btn-sm btn-warning" style="font-size:0.75rem;" data-pid="${prop.propertyId}">
            <i class="bi bi-geo-alt me-1"></i>${t('geocode')}
          </button>
        </div>`;
    }

    return html;
  }

  _roomLabel(roomType) {
    return ROOM_TYPE_MAP[roomType] || roomType;
  }

  // ─── Geocoding ────────────────────────────────────────────────────────────────

  async _geocode(prop) {
    const btn = document.querySelector('.sm-geocode-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${i18next.t('salesMap.geocoding')}`; }
    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.SALES_GEOCODE(prop.propertyId));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Geocode failed');

      prop.latitude = data.latitude;
      prop.longitude = data.longitude;
      const idx = this.properties.findIndex(p => p.propertyId === prop.propertyId);
      if (idx !== -1) this.properties[idx] = prop;

      this._placeMarkers(this._activeFilter);
      this._showPanel(prop);
      if (window.showToast) showToast(i18next.t('salesMap.geocodeSuccess'), 'success');
    } catch (err) {
      console.error('[SalesMap] geocode error:', err);
      if (window.showToast) showToast(i18next.t('salesMap.geocodeFailed'), 'danger');
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="bi bi-geo-alt me-1"></i>${i18next.t('salesMap.geocode')}`; }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  _updateMeta() {
    const t = (k) => i18next.t(`salesMap.${k}`);
    const total = this.properties.length;
    const avail = this.properties.reduce((s, p) => s + p.availableCount, 0);
    const el = document.getElementById('sm-panel-meta');
    if (el) el.textContent = `${total} ${t('properties')} · ${avail} ${t('roomsAvailable')}`;
    this._updateStats(this.properties);
  }

  _updateStats(list) {
    const total   = list.length;
    const hdb     = list.filter(p => p.propertyType !== 'condo').length;
    const condo   = list.filter(p => p.propertyType === 'condo').length;
    const avail   = list.reduce((s, p) => s + p.availableCount, 0);
    const occup   = list.reduce((s, p) => s + p.occupiedCount, 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('sm-stat-total',     total);
    set('sm-stat-hdb',       hdb);
    set('sm-stat-condo',     condo);
    set('sm-stat-available', avail);
    set('sm-stat-occupied',  occup);
  }

  _showNoCoordsBanner(props) {
    const mapEl = document.getElementById('sales-leaflet-map');
    if (!mapEl) return;
    const banner = document.createElement('div');
    banner.id = 'sm-no-coords-banner';
    banner.style.cssText = 'position:absolute;top:52px;left:12px;right:12px;z-index:1000;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:7px 12px;font-size:0.78rem;color:#92400e;';
    banner.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${i18next.t('salesMap.missingCoords', { count: props.length })}`;
    mapEl.parentElement.appendChild(banner);
  }

  _showLoadError(msg) {
    const el = document.getElementById('sm-loading');
    if (el) {
      el.innerHTML = `<div style="text-align:center;color:#dc2626;padding:20px;">
        <i class="bi bi-exclamation-circle" style="font-size:2rem;"></i>
        <div style="margin-top:8px;">${msg}</div>
        <button class="btn btn-sm btn-outline-danger mt-2" onclick="window.salesMapComponent?.loadData()">
          ${i18next.t('salesMap.retry')}
        </button>
      </div>`;
    }
  }
}

window.salesMapComponent = new SalesMapComponent();
