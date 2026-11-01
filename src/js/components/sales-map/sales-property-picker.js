import i18next from '../../i18n.js';
import './sales-property-picker.css';

/**
 * Property picker for the Sales Map — same card look as the Tenants picker.
 * One swipeable row by default ("See all" opens a wrapping grid), with an
 * "All properties" card first. It only renders and reports picks; focusing
 * the map is the Sales Map's job.
 *
 *   const picker = new SalesPropertyPicker({ mount, onSelect: (propertyId|null) => … });
 *   picker.render(properties, selectedId);   // after data or filter changes
 *   picker.setSelected(selectedId);          // cheap highlight update
 */

const ALL = '__all__';
const t = (key, opts) => i18next.t(`salesMap.${key}`, opts);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Same order as the Tenants picker: highest property ID first
const byPropertyIdDesc = (a, b) => (parseInt(b.propertyId, 10) || 0) - (parseInt(a.propertyId, 10) || 0);

export class SalesPropertyPicker {
  constructor({ mount, onSelect }) {
    this.mount = mount;
    this.onSelect = onSelect;
    this.selectedId = null;
    this.expanded = false;

    mount.innerHTML = `
      <div class="smp">
        <div class="smp-head">
          <span class="smp-title"><i class="bi bi-building me-2"></i>${t('pickerTitle')}</span>
          <span class="smp-count"></span>
          <div class="smp-tools">
            <button type="button" class="smp-arrow" data-dir="-1" aria-label="${esc(t('scrollLeft'))}"><i class="bi bi-chevron-left"></i></button>
            <button type="button" class="smp-arrow" data-dir="1" aria-label="${esc(t('scrollRight'))}"><i class="bi bi-chevron-right"></i></button>
            <button type="button" class="btn btn-sm btn-link smp-toggle" aria-expanded="false"></button>
          </div>
        </div>
        <div class="smp-list" role="listbox" aria-label="${esc(t('pickerTitle'))}"></div>
      </div>`;

    this.root = mount.querySelector('.smp');
    this.list = mount.querySelector('.smp-list');
    this.toggleBtn = mount.querySelector('.smp-toggle');
    this._renderToggle();

    this.list.addEventListener('click', (e) => this._pick(e.target.closest('[data-pick]')));
    this.list.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._pick(e.target.closest('[data-pick]'));
      }
    });
    // Broken thumbnails fall back to the ID badge (error events don't bubble)
    this.list.addEventListener('error', (e) => {
      if (e.target.tagName === 'IMG') e.target.remove();
    }, true);
    this.toggleBtn.addEventListener('click', () => this.setExpanded(!this.expanded));
    mount.querySelectorAll('.smp-arrow').forEach((btn) =>
      btn.addEventListener('click', () =>
        this.list.scrollBy({ left: Number(btn.dataset.dir) * this.list.clientWidth * 0.8, behavior: 'smooth' })));
  }

  render(properties, selectedId = this.selectedId) {
    this.selectedId = selectedId;
    const sorted = [...properties].sort(byPropertyIdDesc);
    this.mount.querySelector('.smp-count').textContent = sorted.length;

    this.list.innerHTML = sorted.length
      ? this._allCard(sorted.length) + sorted.map((p) => this._card(p)).join('')
      : `<div class="smp-empty">${esc(t('noProperties'))}</div>`;

    this.setSelected(selectedId, { smooth: false });
  }

  setSelected(selectedId, { smooth = true } = {}) {
    this.selectedId = selectedId;
    const key = selectedId || ALL;
    this.list.querySelectorAll('[data-pick]').forEach((card) => {
      const on = card.dataset.pick === key;
      card.classList.toggle('selected-card', on);
      card.setAttribute('aria-selected', String(on));
    });
    this._scrollSelectedIntoView(smooth);
  }

  setExpanded(expanded) {
    this.expanded = expanded;
    this.root.classList.toggle('smp-expanded', expanded);
    this._renderToggle();
    if (!expanded) this._scrollSelectedIntoView(false);
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  _pick(card) {
    if (!card) return;
    const id = card.dataset.pick === ALL ? null : card.dataset.pick;
    // Picking from the full grid folds it back so the map is in view again
    if (this.expanded) this.setExpanded(false);
    this.onSelect?.(id);
  }

  _renderToggle() {
    this.toggleBtn.setAttribute('aria-expanded', String(this.expanded));
    this.toggleBtn.innerHTML = this.expanded
      ? `<i class="bi bi-chevron-up me-1"></i>${esc(t('showLess'))}`
      : `<i class="bi bi-grid-3x3-gap me-1"></i>${esc(t('seeAll'))}`;
  }

  // Centers the selected card in the one-row strip (horizontal only)
  _scrollSelectedIntoView(smooth) {
    if (this.expanded) return;
    const card = this.list.querySelector('.selected-card');
    if (!card || this.list.scrollWidth <= this.list.clientWidth) return;
    const left = card.offsetLeft - this.list.offsetLeft - (this.list.clientWidth - card.offsetWidth) / 2;
    this.list.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  }

  _allCard(count) {
    return `
      <div class="card property-grid-card smp-card smp-all" data-pick="${ALL}" role="option" tabindex="0">
        <div class="smp-img"><i class="bi bi-map"></i><div class="smp-check"><i class="bi bi-check-circle-fill"></i></div></div>
        <div class="smp-body">
          <div class="smp-addr">${esc(t('allProperties'))}</div>
          <div class="smp-unit">${esc(t('propertyCount', { count }))}</div>
        </div>
      </div>`;
  }

  _card(p) {
    const id = esc(String(p.propertyId).substring(0, 3));
    const onMap = Boolean(p.latitude && p.longitude);
    const availability = p.totalRooms > 0
      ? (p.availableCount > 0
        ? `<span class="smp-badge smp-free">${esc(t('roomsFree', { count: p.availableCount }))}</span>`
        : `<span class="smp-badge smp-full">${esc(t('full'))}</span>`)
      : '';
    const image = p.propertyImageThumbUrl
      ? `<div class="smp-img">
           <img src="${esc(p.propertyImageThumbUrl)}" alt="" loading="lazy" decoding="async" width="280" height="120">
           <span class="smp-id">${id}</span>
           <div class="smp-check"><i class="bi bi-check-circle-fill"></i></div>
         </div>`
      : `<div class="smp-img smp-noimg">
           <span class="smp-id">${id}</span>
           <div class="smp-check"><i class="bi bi-check-circle-fill"></i></div>
         </div>`;

    return `
      <div class="card property-grid-card smp-card" data-pick="${esc(p.propertyId)}" role="option" tabindex="0"
           title="${esc(`${p.address} ${p.unit || ''}`.trim())}">
        ${image}
        <div class="smp-body">
          <div class="smp-addr">${esc(p.address)}</div>
          <div class="smp-unit">${esc(p.unit)}</div>
          <div class="smp-badges">
            ${availability}
            ${onMap ? '' : `<span class="smp-badge smp-nomap" title="${esc(t('notOnMap'))}"><i class="bi bi-geo-alt"></i></span>`}
          </div>
        </div>
      </div>`;
  }
}
