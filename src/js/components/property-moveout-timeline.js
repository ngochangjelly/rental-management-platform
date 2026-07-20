import i18next from "i18next";
import {
  fetchInvestorsForAvatarStack,
  renderPropertyImageAvatarBadge,
} from "../utils/investor-avatar-stack.js";

const NAME_COL_WIDTH = 200; // px — sticky left column
const DAY_PX = 3;           // px per day; 1 year ≈ 1095 px (fits most screens)

class PropertyMoveoutTimeline {
  constructor() {
    this.properties = [];
    this.selectedProperties = new Set();
    this.isLoaded = false;
    // Saved across renders for scroll helpers
    this._minDate = null;
    this._scrollEl = null;
    // Cleanup refs for drag listeners
    this._dragCleanup = null;
    this._avatarInvestors = []; // Investors list (with linked properties) for the card image avatar badge
    this._avatarInvestorsLoaded = false;
  }

  init() {
    this._setupCollapseListeners();
  }

  _setupCollapseListeners() {
    const body = document.getElementById("propertyMoveoutTimelineBody");
    if (!body) return;

    body.addEventListener("show.bs.collapse", () => {
      if (!this.isLoaded) this.loadProperties();
      const chevron = document.getElementById("moveoutTimelineChevron");
      if (chevron) chevron.style.transform = "rotate(180deg)";
    });
    body.addEventListener("hide.bs.collapse", () => {
      const chevron = document.getElementById("moveoutTimelineChevron");
      if (chevron) chevron.style.transform = "rotate(0deg)";
    });
  }

  async loadProperties() {
    const chart = document.getElementById("moveoutTimelineChart");
    if (chart) {
      chart.innerHTML = `<div class="text-center py-3">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        ${i18next.t("propertyMoveoutTimeline.loading", "Loading...")}
      </div>`;
    }
    try {
      let all = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const res = await API.get(`${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${page}&limit=50&includeArchived=false`);
        const data = await res.json();
        if (data.success && data.properties?.length) {
          all = all.concat(data.properties);
          hasMore = data.pagination && page < data.pagination.totalPages;
          page++;
        } else {
          hasMore = false;
        }
      }
      try {
        const ids = await getInvestorPropertyIds();
        if (ids) all = all.filter((p) => ids.includes(p.propertyId));
      } catch (_) {}

      if (!this._avatarInvestorsLoaded) {
        this._avatarInvestorsLoaded = true;
        fetchInvestorsForAvatarStack().then((investors) => {
          this._avatarInvestors = investors;
          this._renderPropertyCards();
        });
      }

      this.properties = all.filter((p) => !p.isArchived);
      this.selectedProperties = new Set(this.properties.map((p) => p.propertyId));
      this.isLoaded = true;
      this._updateUrgentBadge();
      this.render();
    } catch (err) {
      console.error("[PropertyMoveoutTimeline] load error:", err);
      if (chart) {
        chart.innerHTML = `<div class="text-center text-danger py-4">
          <i class="bi bi-exclamation-triangle me-2"></i>
          ${i18next.t("propertyMoveoutTimeline.loadError", "Error loading data.")}
        </div>`;
      }
    }
  }

  refresh() {
    this.isLoaded = false;
    const body = document.getElementById("propertyMoveoutTimelineBody");
    if (body?.classList.contains("show")) this.loadProperties();
  }

  _updateUrgentBadge() {
    const badge = document.getElementById("moveoutUrgentCount");
    if (!badge) return;
    const today = _today();
    const n = this.properties.filter((p) => {
      if (!p.moveOutDate) return false;
      const d = _daysUntil(p.moveOutDate, today);
      return d >= 0 && d <= 90;
    }).length;
    badge.textContent = `${n} ${i18next.t("propertyMoveoutTimeline.urgent", "urgent")}`;
    badge.style.display = n > 0 ? "inline-block" : "none";
  }

  selectAll() {
    this.selectedProperties = new Set(this.properties.map((p) => p.propertyId));
    this.render();
  }

  deselectAll() {
    this.selectedProperties.clear();
    this.render();
  }

  // ── Scroll / pan helpers ─────────────────────────────────────────────────

  scrollToToday() {
    const el = this._scrollEl || document.getElementById("moveoutTimelineScrollContainer");
    if (!el || !this._minDate) return;
    const today = _today();
    const todayPx = Math.floor((today - this._minDate) / 86400000) * DAY_PX;
    // Show ~3 months of context before today
    el.scrollLeft = Math.max(0, todayPx - 3 * 30 * DAY_PX);
  }

  panMonths(n) {
    const el = this._scrollEl || document.getElementById("moveoutTimelineScrollContainer");
    if (!el) return;
    const delta = Math.round(n * 30.44 * DAY_PX);
    el.scrollBy({ left: delta, behavior: "smooth" });
  }

  _setupDragToPan(el) {
    // Clean up previous listeners if re-rendered
    if (this._dragCleanup) {
      this._dragCleanup();
      this._dragCleanup = null;
    }
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let startScroll = 0;

    const onDown = (e) => {
      isDown = true;
      el.style.cursor = "grabbing";
      startX = e.pageX;
      startScroll = el.scrollLeft;
      e.preventDefault();
    };
    const onUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = "grab";
    };
    const onMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      el.scrollLeft = startScroll - (e.pageX - startX);
    };

    // Touch
    let touchX = 0;
    let touchScroll = 0;
    const onTouchStart = (e) => {
      touchX = e.touches[0].clientX;
      touchScroll = el.scrollLeft;
    };
    const onTouchMove = (e) => {
      el.scrollLeft = touchScroll - (e.touches[0].clientX - touchX);
    };

    // Keyboard: left/right arrow keys while hovered
    const onKey = (e) => {
      if (e.key === "ArrowLeft") this.panMonths(-1);
      if (e.key === "ArrowRight") this.panMonths(1);
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("keydown", onKey);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousemove", onMove);

    this._dragCleanup = () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("keydown", onKey);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousemove", onMove);
    };
  }

  // ── Render ───────────────────────────────────────────────────────────────

  render() {
    const countEl = document.getElementById("moveoutTimelinePropertyCount");
    if (countEl) {
      const n = this.selectedProperties.size;
      countEl.textContent = `${n} ${i18next.t("propertyMoveoutTimeline.propertiesSelected", "properties selected")}`;
    }
    this._renderPropertyCards();
    this._renderTimeline();
  }

  _renderPropertyCards() {
    const container = document.getElementById("moveoutTimelinePropertyList");
    if (!container) return;

    if (!this.properties.length) {
      container.innerHTML = `<div class="text-muted small">${i18next.t("propertyMoveoutTimeline.noProperties", "No properties available")}</div>`;
      return;
    }

    Object.assign(container.style, {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
      gap: "0.4rem",
    });

    const today = _today();
    const sorted = [...this.properties].sort((a, b) => _sortKey(a, today) - _sortKey(b, today));

    container.innerHTML = sorted.map((p) => {
      const isSelected = this.selectedProperties.has(p.propertyId);
      const days = p.moveOutDate ? _daysUntil(p.moveOutDate, today) : null;
      const color = _barColor(p.moveOutDate, today);
      const expiryHtml = _expiryLabel(days, color, i18next);

      return `
        <div class="card overflow-hidden moveout-prop-card"
             data-property-id="${p.propertyId}"
             style="cursor:pointer;transition:all 0.15s;
                    border:${isSelected ? `2px solid ${color}` : "1px solid #dee2e6"};
                    box-shadow:${isSelected ? `0 0 0 2px ${color}33` : "none"};">
          ${p.propertyImage
            ? `<div style="height:42px;background-image:url('${p.propertyImage}');
                          background-size:cover;background-position:center;position:relative;">
                ${renderPropertyImageAvatarBadge(this._avatarInvestors, p.propertyId, { size: 18, overlap: 7, max: 2 })}
                ${isSelected
                  ? `<div style="position:absolute;inset:0;background:rgba(13,110,253,0.4);
                                display:flex;align-items:center;justify-content:center;">
                      <i class="bi bi-check-circle-fill text-white" style="font-size:1rem;"></i>
                     </div>`
                  : ""}
               </div>`
            : ""}
          <div class="p-1 text-center" style="background:${isSelected ? "rgba(13,110,253,0.06)" : "#fff"};">
            <div class="rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-bold mb-1"
                 style="width:22px;height:22px;font-size:9px;background:${color};">
              ${_esc(p.propertyId.toString().substring(0, 3))}
            </div>
            <div class="fw-semibold text-truncate" style="font-size:10px;"
                 title="${_esc(p.address || "")}">${_esc(p.address || p.propertyId)}</div>
            <div class="text-muted text-truncate" style="font-size:9px;">${_esc(p.unit || "")}</div>
            ${expiryHtml}
          </div>
        </div>`;
    }).join("");

    container.querySelectorAll(".moveout-prop-card").forEach((card) => {
      card.addEventListener("click", () => {
        const pid = card.dataset.propertyId;
        if (this.selectedProperties.has(pid)) this.selectedProperties.delete(pid);
        else this.selectedProperties.add(pid);
        this.render();
      });
    });
  }

  _renderTimeline() {
    const container = document.getElementById("moveoutTimelineChart");
    if (!container) return;

    const today = _today();
    const sorted = [...this.properties]
      .filter((p) => this.selectedProperties.has(p.propertyId))
      .sort((a, b) => _sortKey(a, today) - _sortKey(b, today));

    if (!sorted.length) {
      container.innerHTML = `<div class="text-center text-muted py-4 small">
        ${i18next.t("propertyMoveoutTimeline.selectProperty", "Select at least one property to view the timeline.")}
      </div>`;
      return;
    }

    const { minDate, maxDate } = _dateRange(sorted);
    this._minDate = minDate;

    const totalDays = Math.ceil((maxDate - minDate) / 86400000) + 1;
    const totalPx = totalDays * DAY_PX;

    // ── Stats summary ──────────────────────────────────────────────────────
    const urgent  = sorted.filter((p) => { const d = p.moveOutDate ? _daysUntil(p.moveOutDate, today) : null; return d !== null && d >= 0 && d <= 90; }).length;
    const warning = sorted.filter((p) => { const d = p.moveOutDate ? _daysUntil(p.moveOutDate, today) : null; return d !== null && d > 90 && d <= 180; }).length;
    const noExp   = sorted.filter((p) => !p.moveOutDate).length;

    const statsHtml = (urgent || warning || noExp) ? `
      <div class="d-flex flex-wrap gap-2 mb-3" style="font-size:12px;">
        ${urgent  ? `<span class="badge" style="background:#dc3545;"><i class="bi bi-exclamation-circle me-1"></i>${urgent} ${i18next.t("propertyMoveoutTimeline.statUrgent","< 3 months")}</span>` : ""}
        ${warning ? `<span class="badge" style="background:#fd7e14;"><i class="bi bi-clock me-1"></i>${warning} ${i18next.t("propertyMoveoutTimeline.statWarning","3–6 months")}</span>` : ""}
        ${noExp   ? `<span class="badge bg-secondary"><i class="bi bi-infinity me-1"></i>${noExp} ${i18next.t("propertyMoveoutTimeline.statNoExpiry","no expiry set")}</span>` : ""}
      </div>` : "";

    // ── Legend ─────────────────────────────────────────────────────────────
    const legendHtml = `
      <div class="d-flex flex-wrap gap-3 align-items-center mb-2" style="font-size:11px;">
        <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#dc3545;margin-right:4px;"></span>${i18next.t("propertyMoveoutTimeline.legendUrgent","< 3 months (urgent)")}</span>
        <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#fd7e14;margin-right:4px;"></span>${i18next.t("propertyMoveoutTimeline.legendWarning","3–6 months")}</span>
        <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#198754;margin-right:4px;"></span>${i18next.t("propertyMoveoutTimeline.legendSafe","> 6 months")}</span>
        <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#adb5bd;margin-right:4px;"></span>${i18next.t("propertyMoveoutTimeline.legendExpired","Expired")}</span>
        <span><span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:#667eea;margin-right:4px;"></span>${i18next.t("propertyMoveoutTimeline.legendNoExpiry","No expiry set")}</span>
        <span class="ms-2"><span style="display:inline-block;width:2px;height:12px;background:#0d6efd;margin-right:4px;vertical-align:middle;"></span>Today</span>
        <span><span style="display:inline-block;width:0;height:12px;border-left:2px dashed #fd7e14;margin-right:5px;vertical-align:middle;"></span>+2 ${i18next.t("propertyMoveoutTimeline.months","months")}</span>
      </div>`;

    // ── Nav controls ───────────────────────────────────────────────────────
    const navHtml = `
      <div class="d-flex align-items-center gap-1 mb-2 flex-wrap">
        <button class="btn btn-sm btn-outline-secondary px-2" onclick="propertyMoveoutTimeline.panMonths(-12)" title="Previous year">
          <i class="bi bi-chevron-double-left"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary px-2" onclick="propertyMoveoutTimeline.panMonths(-3)" title="Previous quarter">
          <i class="bi bi-chevron-left"></i>
        </button>
        <button class="btn btn-sm btn-primary px-3" onclick="propertyMoveoutTimeline.scrollToToday()" style="font-size:11px;">
          <i class="bi bi-bullseye me-1"></i>Today
        </button>
        <button class="btn btn-sm btn-outline-secondary px-2" onclick="propertyMoveoutTimeline.panMonths(3)" title="Next quarter">
          <i class="bi bi-chevron-right"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary px-2" onclick="propertyMoveoutTimeline.panMonths(12)" title="Next year">
          <i class="bi bi-chevron-double-right"></i>
        </button>
        <span class="text-muted ms-2" style="font-size:11px;">
          <i class="bi bi-arrows-move me-1"></i>Drag or use arrow keys to pan
        </span>
      </div>`;

    // ── Month headers (px-based) ───────────────────────────────────────────
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let monthHeaders = "";
    let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
      const wPx = daysInMonth * DAY_PX;
      const isCur = cur.getFullYear() === today.getFullYear() && cur.getMonth() === today.getMonth();
      monthHeaders += `<div style="width:${wPx}px;flex-shrink:0;text-align:center;
                                   border-right:1px solid #e9ecef;box-sizing:border-box;padding:2px 1px;
                                   background:${isCur ? "#e8f4fd" : "transparent"};">
        <span style="font-size:10px;white-space:nowrap;
                     font-weight:${isCur ? "700" : "400"};
                     color:${isCur ? "#0d6efd" : "#6c757d"};">
          ${MONTHS[cur.getMonth()]} ${cur.getFullYear()}
        </span>
      </div>`;
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }

    // ── Absolute markers (Today, +2M) ──────────────────────────────────────
    const todayDays = Math.floor((today - minDate) / 86400000);
    const todayPxOff = todayDays * DAY_PX;
    const todayMarker = (todayDays >= 0 && todayDays <= totalDays)
      ? `<div style="position:absolute;top:0;bottom:0;left:${NAME_COL_WIDTH + todayPxOff}px;
                     width:2px;background:#0d6efd;z-index:10;pointer-events:none;">
           <div style="position:absolute;top:2px;left:3px;background:#0d6efd;color:#fff;
                       font-size:9px;padding:1px 5px;border-radius:3px;white-space:nowrap;font-weight:600;">Today</div>
         </div>`
      : "";

    const twoM = new Date(today);
    twoM.setMonth(twoM.getMonth() + 2);
    const twoMDays = Math.floor((twoM - minDate) / 86400000);
    const twoMPxOff = twoMDays * DAY_PX;
    const twoMMarker = (twoMDays >= 0 && twoMDays <= totalDays)
      ? `<div style="position:absolute;top:0;bottom:0;left:${NAME_COL_WIDTH + twoMPxOff}px;
                     width:0;border-left:2px dashed #fd7e14;z-index:9;pointer-events:none;">
           <div style="position:absolute;top:2px;left:4px;background:#fd7e14;color:#fff;
                       font-size:9px;padding:1px 5px;border-radius:3px;white-space:nowrap;font-weight:600;">+2M</div>
         </div>`
      : "";

    // ── Property rows (px-based bars, sticky name col) ─────────────────────
    let rowsHtml = "";
    sorted.forEach((p) => {
      const moveIn  = p.moveInDate  ? new Date(p.moveInDate)  : null;
      const moveOut = p.moveOutDate ? new Date(p.moveOutDate) : null;

      const barStartDay = Math.max(moveIn  ? Math.floor((moveIn  - minDate) / 86400000) : 0, 0);
      const barEndDay   = moveOut
        ? Math.min(Math.ceil((moveOut - minDate) / 86400000), totalDays)
        : totalDays;

      const barLeftPx  = barStartDay * DAY_PX;
      const barWidthPx = Math.max((barEndDay - barStartDay) * DAY_PX, 6);

      const color = _barColor(p.moveOutDate, today);
      const days  = p.moveOutDate ? _daysUntil(p.moveOutDate, today) : null;
      const countdown = days !== null ? _monthsText(days) : "";

      const displayAddress = [p.address, p.unit].filter(Boolean).join(" · ");
      const barLabel  = `${_esc(p.address || p.propertyId)}${countdown ? " · " + countdown : ""}`;
      const moveInStr  = moveIn  ? moveIn.toLocaleDateString("en-SG",  { day:"numeric", month:"short", year:"numeric" }) : "N/A";
      const moveOutStr = moveOut ? moveOut.toLocaleDateString("en-SG", { day:"numeric", month:"short", year:"numeric" }) : i18next.t("propertyMoveoutTimeline.noExpiry","No expiry");
      const tooltip = `${_esc(displayAddress || p.propertyId)}\nMove-in: ${moveInStr}\nMove-out: ${moveOutStr}${countdown ? " (" + countdown + ")" : ""}`;

      const isUrgent = days !== null && days >= 0 && days <= 90;

      const moveOutDDMMYYYY = moveOut
        ? `${String(moveOut.getDate()).padStart(2,"0")}/${String(moveOut.getMonth()+1).padStart(2,"0")}/${moveOut.getFullYear()}`
        : null;

      rowsHtml += `
        <div style="display:flex;align-items:center;border-bottom:1px solid #f5f5f5;min-height:44px;padding:3px 0;">
          <div style="width:${NAME_COL_WIDTH}px;flex-shrink:0;position:sticky;left:0;
                      background:#fff;z-index:5;padding-right:10px;overflow:hidden;
                      border-right:1px solid #f0f0f0;">
            <div class="fw-semibold text-truncate" style="font-size:12px;"
                 title="${_esc(displayAddress || p.propertyId)}">${_esc(p.address || p.propertyId)}</div>
            <div class="text-truncate" style="font-size:10px;color:#6c757d;">${_esc(p.unit || "")}</div>
            ${_expiryLabel(days, color, i18next)}
          </div>
          <div style="width:${totalPx}px;flex-shrink:0;position:relative;height:36px;">
            <div ${isUrgent ? 'class="moveout-urgent-bar"' : ""}
                 style="position:absolute;left:${barLeftPx}px;width:${barWidthPx}px;
                        height:26px;top:5px;border-radius:5px;background:${color};overflow:hidden;"
                 title="${tooltip}">
              <div style="padding:0 7px;height:100%;display:flex;align-items:center;overflow:hidden;">
                <span style="font-size:10px;color:#fff;white-space:nowrap;font-weight:600;
                             text-shadow:0 1px 2px rgba(0,0,0,0.25);">${barLabel}</span>
              </div>
            </div>
            ${moveOutDDMMYYYY ? `
            <div style="position:absolute;left:${barLeftPx + barWidthPx + 6}px;top:5px;height:26px;
                        display:flex;align-items:center;pointer-events:none;">
              <span style="font-size:10px;color:${color};white-space:nowrap;font-weight:600;">${moveOutDDMMYYYY}</span>
            </div>` : ""}
          </div>
        </div>`;
    });

    // ── Assemble ───────────────────────────────────────────────────────────
    container.innerHTML = `
      ${statsHtml}
      ${legendHtml}
      ${navHtml}
      <div id="moveoutTimelineScrollContainer"
           tabindex="0"
           style="overflow-x:scroll;cursor:grab;-webkit-overflow-scrolling:touch;
                  border:1px solid #e9ecef;border-radius:6px;outline:none;
                  max-height:65vh;overflow-y:auto;">
        <div style="width:${NAME_COL_WIDTH + totalPx}px;position:relative;min-height:40px;">
          ${todayMarker}
          ${twoMMarker}
          <!-- Sticky month-header row -->
          <div style="display:flex;border-bottom:2px solid #dee2e6;
                      position:sticky;top:0;z-index:20;background:#fff;">
            <div style="width:${NAME_COL_WIDTH}px;flex-shrink:0;position:sticky;left:0;z-index:25;
                        background:#fff;border-right:1px solid #dee2e6;
                        padding:4px 10px 4px 0;font-size:11px;font-weight:600;color:#6c757d;">
              ${i18next.t("propertyMoveoutTimeline.property","Property")}
            </div>
            <div style="display:flex;width:${totalPx}px;flex-shrink:0;">
              ${monthHeaders}
            </div>
          </div>
          <!-- Rows -->
          ${rowsHtml}
        </div>
      </div>`;

    // Wire drag, store refs
    const scrollEl = document.getElementById("moveoutTimelineScrollContainer");
    this._scrollEl = scrollEl;
    this._setupDragToPan(scrollEl);

    // Scroll to today after paint
    requestAnimationFrame(() => this.scrollToToday());
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function _today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function _daysUntil(dateStr, today) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function _barColor(moveOutDate, today) {
  if (!moveOutDate) return "#667eea";
  const days = _daysUntil(moveOutDate, today);
  if (days < 0)   return "#adb5bd";
  if (days <= 90)  return "#dc3545";
  if (days <= 180) return "#fd7e14";
  return "#198754";
}

function _sortKey(property, today) {
  if (!property.moveOutDate) return Infinity;
  return _daysUntil(property.moveOutDate, today);
}

function _monthsText(days) {
  const abs = Math.abs(days);
  if (abs < 30) {
    return days >= 0 ? `in ${abs}d` : `${abs}d ago`;
  }
  const m = (abs / 30.44).toFixed(1).replace(/\.0$/, "");
  return days >= 0 ? `in ${m}M` : `${m}M ago`;
}

function _expiryLabel(days, color, i18n) {
  if (days === null) {
    return `<span style="font-size:9px;color:#adb5bd;">${i18n.t("propertyMoveoutTimeline.noExpiry","No expiry")}</span>`;
  }
  return `<span style="font-size:9px;font-weight:700;color:${color};">${_monthsText(days)}</span>`;
}

function _dateRange(selectedProps) {
  const today = _today();
  // Default: 6 months before today to 3 years after
  let min = new Date(today.getFullYear(), today.getMonth() - 6, 1);
  let max = new Date(today.getFullYear() + 3, today.getMonth(), 0);

  selectedProps.forEach((p) => {
    if (p.moveInDate) {
      const d = new Date(p.moveInDate);
      if (d < min) min = d;
    }
    if (p.moveOutDate) {
      // Extend max 2 months past latest expiry
      const d = new Date(p.moveOutDate);
      const ext = new Date(d.getFullYear(), d.getMonth() + 2, 0);
      if (ext > max) max = ext;
    }
  });

  // Snap to month boundaries
  min = new Date(min.getFullYear(), min.getMonth(), 1);
  max = new Date(max.getFullYear(), max.getMonth() + 1, 0);
  return { minDate: min, maxDate: max };
}

function _esc(text) {
  if (!text) return "";
  return String(text).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

(function injectStyles() {
  if (document.getElementById("moveout-timeline-styles")) return;
  const s = document.createElement("style");
  s.id = "moveout-timeline-styles";
  s.textContent = `
    .moveout-prop-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0,0,0,0.12) !important;
    }
    @keyframes moveout-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.72; }
    }
    .moveout-urgent-bar {
      animation: moveout-pulse 2s ease-in-out infinite;
    }
    #moveoutTimelineScrollContainer:active { cursor: grabbing !important; }
    #propertyMoveoutTimelineHeader { user-select: none; }
    #propertyMoveoutTimelineHeader:hover { background: #f8f9fa; }
    /* Hide native scrollbar but keep functionality */
    #moveoutTimelineScrollContainer::-webkit-scrollbar { height: 6px; }
    #moveoutTimelineScrollContainer::-webkit-scrollbar-thumb {
      background: #ced4da; border-radius: 3px;
    }
    #moveoutTimelineScrollContainer::-webkit-scrollbar-thumb:hover {
      background: #adb5bd;
    }
  `;
  document.head.appendChild(s);
})();

// ─── Init ─────────────────────────────────────────────────────────────────────

const propertyMoveoutTimeline = new PropertyMoveoutTimeline();
window.propertyMoveoutTimeline = propertyMoveoutTimeline;
