import { getRoomTypeDisplayName, compareRoomTypes } from '../utils/room-type-mapper.js';
import i18next from '../i18n.js';
import { roomListingService } from '../services/room-listing-service.js';
import { shareRoomLink, formatPriceRange } from './room-photos/room-share.js';
import './room-photos/room-photos.css';
import { SalesPropertyPicker } from './sales-map/sales-property-picker.js';

const FOCUS_ZOOM = 17; // street level when a property is picked

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
    this._roomsStale = false;
    this._picker = null;
    this.focusedPropertyId = null; // property picked in the picker / by clicking its pin
    this._pendingFocusSlug = null; // deep link that arrived before the data
    this._dataReady = false;
    // Photos/links edited elsewhere (e.g. Properties) → refresh cards on next visit
    window.addEventListener('room-listings:changed', () => { this._roomsStale = true; });
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
      // The sidebar resets the URL to #/sales-map; put the focused property back
      setTimeout(() => this._syncUrl(), 0);
      if (this._roomsStale) {
        this._roomsStale = false;
        this.loadData();
      }
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

      <!-- Property picker (focus the map on one property) -->
      <div id="sm-property-picker"></div>

      <div class="sales-map-layout d-flex gap-0" style="height:calc(100vh - 370px);min-height:460px;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">

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
          <div id="sm-panel-body" style="flex:1;overflow-y:auto;padding:14px 16px;">${this._panelHintHTML()}</div>
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
    this._attachRoomCardListeners();

    const pickerMount = document.getElementById('sm-property-picker');
    if (pickerMount) {
      this._picker = new SalesPropertyPicker({
        mount: pickerMount,
        onSelect: (propertyId) => this.focusProperty(propertyId),
      });
    }
  }

  _panelHintHTML() {
    return `<div style="text-align:center;color:#9ca3af;padding-top:48px;">
      <i class="bi bi-cursor" style="font-size:2.5rem;"></i>
      <div style="margin-top:10px;font-size:0.85rem;">${i18next.t('salesMap.hoverHint')}</div>
    </div>`;
  }

  _attachFilterListeners() {
    document.querySelectorAll('.sm-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => this._setTypeFilter(btn.dataset.filter));
    });
  }

  _setTypeFilter(filter) {
    this._activeFilter = filter;
    document.querySelectorAll('.sm-filter-btn').forEach(b => {
      const active = b.dataset.filter === filter;
      b.classList.toggle('sm-filter-active', active);
      b.style.background = active ? '#667eea' : 'white';
      b.style.color = active ? 'white' : '#374151';
      b.style.borderColor = active ? '#667eea' : '#dee2e6';
      b.style.fontWeight = active ? '700' : '400';
    });
    this._placeMarkers(filter);
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
      this._dataReady = true;
      this._initMap();
      this._placeMarkers(this._activeFilter);
      this._updateMeta();

      const focused = this._focusedProperty();
      if (focused) this._showPanel(focused); // fresh rooms/photos after a reload
      if (this._pendingFocusSlug) {
        const slug = this._pendingFocusSlug;
        this._pendingFocusSlug = null;
        this.focusBySlug(slug);
      }
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

  _makeIcon(type, focused = false) {
    const color = type === 'condo' ? '#d97706' : '#2563eb';
    const [w, h] = focused ? [34, 51] : [24, 36];
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="white" opacity="0.9"/></svg>`
    );
    return L.icon({
      iconUrl: `data:image/svg+xml,${svg}`,
      iconSize: [w, h],
      iconAnchor: [w / 2, h],
      popupAnchor: [0, -(h + 2)],
      className: focused ? 'sm-pin-focused' : '',
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

    // A focused property hidden by the type filter is no longer focused
    if (this.focusedPropertyId && !list.some(p => p.propertyId === this.focusedPropertyId)) {
      this.focusedPropertyId = null;
      this._resetPanel();
      this._syncUrl();
    }
    this._picker?.render(list, this.focusedPropertyId);
    const noCoords = [];
    const withCoords = [];

    for (const prop of list) {
      if (!prop.latitude || !prop.longitude) { noCoords.push(prop); continue; }
      withCoords.push(prop);
    }

    // Group by exact coordinates — properties sharing the same postcode (same building,
    // different units) receive identical lat/lng from OneMap and would stack on one pin.
    // Spread them in a small circle (~20 m radius) so every pin is individually clickable.
    const groups = new Map();
    for (const prop of withCoords) {
      const key = `${prop.latitude.toFixed(5)}_${prop.longitude.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(prop);
    }

    const SPREAD = 0.00018; // ~20 m at Singapore latitude
    const t = (k) => i18next.t(`salesMap.${k}`);

    for (const group of groups.values()) {
      group.forEach((prop, i) => {
        let lat = prop.latitude;
        let lng = prop.longitude;
        if (group.length > 1) {
          const angle = (2 * Math.PI * i) / group.length;
          lat += SPREAD * Math.sin(angle);
          lng += SPREAD * Math.cos(angle);
        }

        const focused = prop.propertyId === this.focusedPropertyId;
        const icon = this._makeIcon(prop.propertyType, focused);
        const marker = L.marker([lat, lng], { icon, zIndexOffset: focused ? 1000 : 0 }).addTo(this.map);

        marker.bindTooltip(
          `<strong>${prop.address}</strong><br>${prop.unit}<br><span style="color:#16a34a">${t('available')}: ${prop.availableCount}/${prop.totalRooms}</span>`,
          { permanent: false, direction: 'top', offset: [0, focused ? -52 : -38] }
        );

        marker.on('mouseover', () => this._showPanel(prop));
        // Clicking a pin focuses that property (keeps the current zoom)
        marker.on('click', () => this.focusProperty(prop.propertyId, { fly: false }));
        this.markers.push({ marker, property: prop });
      });
    }

    if (noCoords.length) this._showNoCoordsBanner(noCoords);

    const focusedMarker = this._markerFor(this.focusedPropertyId);
    if (focusedMarker) {
      this.map.setView(focusedMarker.getLatLng(), Math.max(this.map.getZoom(), FOCUS_ZOOM));
    } else {
      this._fitAllMarkers();
    }
  }

  _fitAllMarkers({ animate = false } = {}) {
    if (!this.markers.length) return;
    const group = L.featureGroup(this.markers.map(m => m.marker));
    this.map.fitBounds(group.getBounds().pad(0.15), { maxZoom: 14, animate });
  }

  // ─── Property focus (picker, pin click, #/sales-map/<slug>) ──────────────────

  /**
   * Focuses the map on one property, or on all of them when propertyId is null.
   * fly: move the map (pin clicks keep the current view).
   */
  focusProperty(propertyId, { fly = true, updateUrl = true } = {}) {
    const prop = propertyId ? this.properties.find(p => p.propertyId === propertyId) : null;
    if (propertyId && !prop) return;

    // A deep link can point at a type the filter currently hides
    if (prop && this._activeFilter !== 'all' && prop.propertyType !== this._activeFilter) {
      this.focusedPropertyId = prop.propertyId;
      this._setTypeFilter('all');
    }

    this.focusedPropertyId = prop ? prop.propertyId : null;
    this._highlightFocusedMarker();
    this._picker?.setSelected(this.focusedPropertyId);

    if (prop) {
      this._showPanel(prop);
      const marker = this._markerFor(prop.propertyId);
      if (marker) {
        if (fly) this.map.flyTo(marker.getLatLng(), Math.max(this.map.getZoom(), FOCUS_ZOOM), { duration: 0.6 });
        marker.openTooltip();
      }
    } else {
      this._resetPanel();
      if (fly) this._fitAllMarkers({ animate: true });
    }

    if (updateUrl) this._syncUrl();
  }

  /** Router entry point for #/sales-map/<property-slug>. */
  focusBySlug(slug) {
    if (!this._dataReady) {
      this._pendingFocusSlug = slug; // applied once loadData() finishes
      return;
    }
    const prop = this.properties.find(p => window.SlugUtils?.propertySlug(p) === slug);
    if (prop) this.focusProperty(prop.propertyId, { updateUrl: false });
    else console.warn(`[SalesMap] No property for slug "${slug}"`);
  }

  _focusedProperty() {
    return this.focusedPropertyId
      ? this.properties.find(p => p.propertyId === this.focusedPropertyId) || null
      : null;
  }

  _markerFor(propertyId) {
    if (!propertyId) return null;
    return this.markers.find(m => m.property.propertyId === propertyId)?.marker || null;
  }

  _highlightFocusedMarker() {
    for (const { marker, property } of this.markers) {
      const on = property.propertyId === this.focusedPropertyId;
      marker.setIcon(this._makeIcon(property.propertyType, on));
      marker.setZIndexOffset(on ? 1000 : 0);
      const tooltip = marker.getTooltip();
      if (tooltip) tooltip.options.offset = L.point(0, on ? -52 : -38);
      if (!on) marker.closeTooltip();
    }
  }

  _resetPanel() {
    const body = document.getElementById('sm-panel-body');
    if (body) body.innerHTML = this._panelHintHTML();
    const mTitle = document.getElementById('sm-mobile-title');
    if (mTitle) mTitle.textContent = '';
    const mBody = document.getElementById('sm-mobile-body');
    if (mBody) mBody.innerHTML = '';
    this.selectedProperty = null;
    const t = (k) => i18next.t(`salesMap.${k}`);
    const avail = this.properties.reduce((sum, p) => sum + p.availableCount, 0);
    const meta = document.getElementById('sm-panel-meta');
    if (meta) meta.textContent = `${this.properties.length} ${t('properties')} · ${avail} ${t('roomsAvailable')}`;
  }

  // Keeps #/sales-map/<slug> in step with the focus (bookmarkable, survives refresh)
  _syncUrl() {
    if (!window.location.hash.startsWith('#/sales-map')) return; // user is elsewhere
    const prop = this._focusedProperty();
    const path = prop && window.SlugUtils
      ? `/sales-map/${window.SlugUtils.propertySlug(prop)}`
      : '/sales-map';
    window.appRouter?.replace(path);
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
      btn.addEventListener('click', () => this._geocode(prop, btn))
    );

    this._prefetchRoomListings(prop);
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
    } else if (Array.isArray(prop.roomDetails)) {
      html += this._buildRoomCardsHTML(prop);
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
    return getRoomTypeDisplayName(roomType);
  }

  // ─── Room cards (photos, price range, share link) ─────────────────────────────

  _buildRoomCardsHTML(prop) {
    const rp = (k, opts) => i18next.t(`roomPhotos.${k}`, opts);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rooms = [...prop.roomDetails].sort((a, b) =>
      (b.isAvailable - a.isAvailable) || compareRoomTypes(a.room, b.room));

    return rooms.map((r) => {
      const label = this._roomLabel(r.room);
      const price = formatPriceRange(r.minPrice, r.maxPrice);
      const hasPhotos = r.photoCount > 0;
      return `
        <div class="rp-room-card${r.isAvailable ? '' : ' rp-occupied'}" data-pid="${esc(prop.propertyId)}" data-room="${esc(r.room)}">
          <button type="button" class="rp-room-cover" data-sm-action="photos" ${hasPhotos ? '' : 'disabled'} aria-label="${esc(rp('viewPhotos'))}">
            ${r.coverThumbUrl ? `<img src="${esc(r.coverThumbUrl)}" alt="" loading="lazy" decoding="async">` : '<i class="bi bi-image" style="font-size:1.3rem;"></i>'}
            ${hasPhotos ? `<span class="rp-room-count"><i class="bi bi-images"></i> ${r.photoCount}</span>` : ''}
          </button>
          <div class="rp-room-info">
            <div class="rp-room-name">${esc(label)}
              <span class="rp-room-status ${r.isAvailable ? 'rp-free' : 'rp-taken'}">${i18next.t(`salesMap.${r.isAvailable ? 'available' : 'occupied'}`)}</span>
            </div>
            <div class="rp-room-price${price ? '' : ' rp-muted'}">${price ? `${esc(price)} <span style="font-weight:400;color:#6b7280;">${rp('perMonth')}</span>` : rp('noPrice')}</div>
            <div class="rp-room-actions">
              <button type="button" class="btn btn-outline-secondary" data-sm-action="photos" ${hasPhotos ? '' : 'disabled'}><i class="bi bi-images me-1"></i>${rp('photos')}</button>
              <button type="button" class="btn btn-outline-primary" data-sm-action="share"><i class="bi bi-share me-1"></i>${rp('share')}</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // Warm the cache (photo URLs + existing share links) while the user reads
  // the panel, so Photos/Share respond instantly. Debounced for hover sweeps.
  _prefetchRoomListings(prop) {
    clearTimeout(this._prefetchTimer);
    if (!prop.roomDetails?.length) return;
    this._prefetchTimer = setTimeout(() => {
      roomListingService.getPropertyRooms(prop.propertyId).catch(() => {});
    }, 300);
  }

  _attachRoomCardListeners() {
    const onClick = (e) => {
      const btn = e.target.closest('[data-sm-action]');
      const card = btn?.closest('.rp-room-card');
      if (!btn || !card || btn.disabled) return;
      const prop = this.properties.find((p) => p.propertyId === card.dataset.pid);
      if (!prop) return;
      if (btn.dataset.smAction === 'photos') this._openRoomPhotos(prop, card.dataset.room);
      if (btn.dataset.smAction === 'share') this._shareRoom(prop, card.dataset.room, btn);
    };
    document.getElementById('sm-panel-body')?.addEventListener('click', onClick);
    document.getElementById('sm-mobile-body')?.addEventListener('click', onClick);
  }

  async _openRoomPhotos(prop, room) {
    try {
      const [listing, { openPhotoViewer }] = await Promise.all([
        roomListingService.getRoom(prop.propertyId, room),
        import(/* webpackChunkName: "room-photo-viewer" */ './room-photos/photo-viewer.js'),
      ]);
      if (!listing?.photos?.length) return;
      openPhotoViewer({
        photos: listing.photos,
        title: `${this._roomLabel(room)} · ${prop.address}`,
      });
    } catch (err) {
      if (window.showToast) showToast(err.message, 'danger');
    }
  }

  async _shareRoom(prop, room, btn) {
    btn.disabled = true;
    try {
      const listing = await roomListingService.getRoom(prop.propertyId, room).catch(() => null);
      const shareUrl = listing?.shareUrl
        || (await roomListingService.enableShare(prop.propertyId, room)).shareUrl;
      const details = prop.roomDetails.find((r) => r.room === room) || {};
      await shareRoomLink({
        url: shareUrl,
        roomLabel: this._roomLabel(room),
        address: prop.address,
        minPrice: details.minPrice,
        maxPrice: details.maxPrice,
      });
    } catch (err) {
      if (window.showToast) showToast(err.message, 'danger');
    } finally {
      btn.disabled = false;
    }
  }

  // ─── Geocoding ────────────────────────────────────────────────────────────────

  async _geocode(prop, btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${i18next.t('salesMap.geocoding')}`; }
    try {
      const res = await API.post(API_CONFIG.ENDPOINTS.SALES_GEOCODE(prop.propertyId));
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Geocode failed');

      prop.latitude = data.latitude;
      prop.longitude = data.longitude;
      if (data.postcode) prop.postcode = data.postcode;
      const idx = this.properties.findIndex(p => p.propertyId === prop.propertyId);
      if (idx !== -1) this.properties[idx] = prop;

      this._placeMarkers(this._activeFilter);
      this._showPanel(prop);
      if (window.showToast) showToast(i18next.t('salesMap.geocodeSuccess'), 'success');
    } catch (err) {
      console.error('[SalesMap] geocode error:', err);
      if (window.showToast) showToast(`${i18next.t('salesMap.geocodeFailed')}: ${err.message}`, 'danger');
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
    const addressList = props.map(p => `<span style="font-weight:600;">${p.address} ${p.unit}${p.postcode ? ' S(' + p.postcode + ')' : ''}</span>`).join(', ');
    banner.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>${i18next.t('salesMap.missingCoords', { count: props.length })}: ${addressList}`;
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
