import { getRoomTypeDisplayName } from "../utils/room-type-mapper.js";
import {
  getGroupLinkMeta,
  facebookToMessengerUrl,
  buildWhatsAppSignContractUrl,
} from "../utils/social-links.js";
import {
  fetchInvestorsForAvatarStack,
  renderPropertyImageAvatarBadge,
} from "../utils/investor-avatar-stack.js";
import i18next from "i18next";

const t = (key, opts) => i18next.t(`billManagement.${key}`, opts);
const monthName = (idx, short = false) => {
  if (i18next.language === "vi")
    return short ? `T${idx + 1}` : `Tháng ${idx + 1}`;
  const full = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const sh = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
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
    this._utilityBillsAll = []; // all tracked utility bills for the selected property (for cycle picker)
    this._selectedCycleIds = null; // Set of utility-bill _id's chosen for the dynamic preview; null = not yet defaulted
    this._avatarInvestors = []; // Investors list (with linked properties) for the card image avatar badge
    this.init();
  }

  init() {
    this.updateMonthDisplay();
    this.bindEvents();
    this.loadProperties();
    fetchInvestorsForAvatarStack().then((investors) => {
      this._avatarInvestors = investors;
      this.renderPropertyCards(this.properties);
    });
  }

  bindEvents() {
    // Month navigation
    const prevMonthBtn = document.getElementById("billPrevMonth");
    const nextMonthBtn = document.getElementById("billNextMonth");

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => this.changeMonth(-1));
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => this.changeMonth(1));
    }

    // Generate bill button
    const generateBillBtn = document.getElementById("generateBillBtn");
    if (generateBillBtn) {
      generateBillBtn.addEventListener("click", () =>
        this.showGenerateBillModal(),
      );
    }

    // Update fees button
    const updateFeesBtn = document.getElementById("updateFeesBtn");
    if (updateFeesBtn) {
      updateFeesBtn.addEventListener("click", () => this.showUpdateFeesModal());
    }

    // Bulk delete button
    const bulkDeleteBtn = document.getElementById("bulkDeleteUploadsBtn");
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener("click", () => this.bulkDeleteUploads());
    }

    // Download / copy bill(s) for selected tenants
    const downloadBtn = document.getElementById("billDownloadSelectedBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => this.downloadSelectedBills());
    }
    const copyBtn = document.getElementById("billCopySelectedBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.copySelectedBillBreakdown());
    }

    // Select all checkbox
    const selectAllCheckbox = document.getElementById("selectAllTenants");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", (e) =>
        this.toggleSelectAll(e.target.checked),
      );
    }

    // Hotkeys: Cmd/Ctrl+K → download selected bill(s), Cmd/Ctrl+C (no text selection) → copy breakdown
    document.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const section = document.getElementById("bills-section");
      if (!section || section.style.display === "none") return;
      if (this.selectedTenants.size === 0) return;

      if (e.key === "k") {
        e.preventDefault();
        this.downloadSelectedBills();
      } else if (e.key === "c" && !window.getSelection()?.toString()) {
        e.preventDefault();
        this.copySelectedBillBreakdown();
      }
    });

    this._initToolbarTooltips();
  }

  // Bootstrap tooltips for the action toolbar buttons — patches the
  // Download/Copy hints with the OS-appropriate hotkey symbol, then
  // initializes bootstrap.Tooltip on every [data-bs-toggle="tooltip"] button.
  _initToolbarTooltips() {
    const isMac =
      /Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
      navigator.userAgentData?.platform === "macOS";
    const mod = isMac ? "⌘" : "Ctrl+";

    document
      .getElementById("billDownloadSelectedBtn")
      ?.setAttribute(
        "data-bs-title",
        `Download bill image(s) for the selected tenant(s) (${mod}K)`,
      );
    document
      .getElementById("billCopySelectedBtn")
      ?.setAttribute(
        "data-bs-title",
        `Copy the bill breakdown as text for the selected tenant(s) (${mod}C)`,
      );

    document
      .querySelectorAll('#billActionToolbar [data-bs-toggle="tooltip"]')
      .forEach((el) => {
        bootstrap.Tooltip.getInstance(el)?.dispose();
        new bootstrap.Tooltip(el, { placement: "top" });
      });
  }

  async loadProperties() {
    try {
      // Fetch all properties with pagination
      let allProperties = [];
      let currentPage = 1;
      const itemsPerPage = 50;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await API.get(
          `${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${currentPage}&limit=${itemsPerPage}`,
        );
        const result = await response.json();

        if (result.success) {
          allProperties = allProperties.concat(result.properties || []);
          hasMorePages =
            result.pagination && currentPage < result.pagination.totalPages;
          currentPage++;
        } else {
          console.error("Failed to load properties:", result.error);
          hasMorePages = false;
        }
      }

      this.properties = allProperties;
      this.renderPropertyCards(allProperties);
    } catch (error) {
      console.error("Error loading properties:", error);
      this.renderPropertyCards([]);
    }
  }

  renderPropertyCards(properties) {
    const container = document.getElementById("billPropertyCards");
    if (!container) return;

    container.innerHTML = "";

    if (!properties || properties.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-building-slash me-2"></i>
          ${t("noPropertiesAvailable")}
        </div>
      `;
      return;
    }

    // CSS Grid — compact cards, ~10 per row on wide screens
    container.style.display = "grid";
    container.style.gridTemplateColumns =
      "repeat(auto-fill, minmax(120px, 1fr))";
    container.style.gap = "0.5rem";

    const sortedProperties = [...properties].sort(
      (a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0),
    );
    sortedProperties.forEach((property) => {
      const isSelected = this.selectedProperty === property.propertyId;
      const cardHtml = `
        <div class="card property-card ${isSelected ? "selected-card" : ""} overflow-hidden"
             style="cursor: pointer; transition: all 0.2s ease;"
             data-property-id="${property.propertyId}"
             onclick="billManager.selectProperty('${property.propertyId}')">
          ${
            property.propertyImage
              ? `<div data-role="property-image" style="height: 55px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; position: relative;">
                ${renderPropertyImageAvatarBadge(this._avatarInvestors, property.propertyId, { size: 22, overlap: 9, max: 3 })}
                <div data-role="selected-overlay" style="position: absolute; inset: 0; background: rgba(13,110,253,0.5); display: ${isSelected ? "flex" : "none"}; align-items: center; justify-content: center;"><i class="bi bi-check-circle-fill text-white" style="font-size: 1.4rem;"></i></div>
              </div>`
              : ""
          }
          <div data-role="card-body" class="d-flex flex-column align-items-center p-2" style="gap: 3px; background: ${isSelected ? "rgba(13,110,253,0.07)" : "#fff"};">
            <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
                 style="width: 28px; height: 28px; font-size: 11px; flex-shrink: 0;">
              ${escapeHtml(property.propertyId.toString().substring(0, 3))}
            </div>
            <div class="text-center" style="line-height: 1.2; width: 100%;">
              <div class="fw-semibold text-truncate" style="font-size: 10px;" title="${escapeHtml(property.address || "")}">${escapeHtml(property.address || property.propertyId)}</div>
              <div class="text-muted text-truncate" style="font-size: 10px;">${escapeHtml(property.unit || "")}</div>
            </div>
            ${!property.propertyImage ? `<i data-role="no-image-check" class="bi bi-check-circle-fill text-primary" style="font-size: 0.9rem; display: ${isSelected ? "inline" : "none"};"></i>` : ""}
          </div>
        </div>
      `;
      container.innerHTML += cardHtml;
    });

    this.addPropertyCardStyles();
  }

  addPropertyCardStyles() {
    if (!document.getElementById("bill-property-card-styles")) {
      const style = document.createElement("style");
      style.id = "bill-property-card-styles";
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
    this._utilityBillsAll = [];
    this._selectedCycleIds = null;
    this._dynamicPreviewCache = null;
    this.selectedTenants.clear();
    this.updateSelectionButtons();
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
    const allCards = document.querySelectorAll(".property-card");
    allCards.forEach((card) => {
      const isSelected =
        card.dataset.propertyId === String(this.selectedProperty);
      card.classList.toggle("selected-card", isSelected);

      const overlay = card.querySelector('[data-role="selected-overlay"]');
      if (overlay) overlay.style.display = isSelected ? "flex" : "none";

      const body = card.querySelector('[data-role="card-body"]');
      if (body)
        body.style.background = isSelected ? "rgba(13,110,253,0.07)" : "#fff";

      const check = card.querySelector('[data-role="no-image-check"]');
      if (check) check.style.display = isSelected ? "inline" : "none";
    });
  }

  changeMonth(delta) {
    this.currentDate.setMonth(this.currentDate.getMonth() + delta);
    this.updateMonthDisplay();
    this._selectedCycleIds = null;
    this._dynamicPreviewCache = null;
    this.selectedTenants.clear();
    this.updateSelectionButtons();
    if (this.selectedProperty) {
      this.loadBillForCurrentMonth();
      this._syncUrl();
    }
  }

  updateMonthDisplay() {
    const monthYearElement = document.getElementById("currentMonthYear");
    if (monthYearElement) {
      monthYearElement.textContent = `${monthName(this.currentDate.getMonth())} ${this.currentDate.getFullYear()}`;
    }
  }

  async loadUtilityBillForMonth() {
    if (!this.selectedProperty) {
      this.currentUtilityBill = null;
      return;
    }
    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;
      const res = await API.get(
        API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(this.selectedProperty),
      );
      const data = await res.json();
      if (data.success) {
        this._utilityBillsAll = data.bills || [];
        this.currentUtilityBill =
          this._utilityBillsAll.find(
            (b) => b.year === year && b.month === month,
          ) || null;
      } else {
        this._utilityBillsAll = [];
        this.currentUtilityBill = null;
      }
    } catch {
      this._utilityBillsAll = [];
      this.currentUtilityBill = null;
    }
  }

  async loadBillForCurrentMonth() {
    if (!this.selectedProperty) {
      this.showEmptyState("Please select a property");
      return;
    }

    // Load utility bill tracker data and monthly bill in parallel
    const [, billResponse] = await Promise.all([
      this.loadUtilityBillForMonth(),
      API.get(
        API_CONFIG.ENDPOINTS.BILL_BY_PROPERTY_MONTH(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1,
        ),
      ).catch(() => ({ status: 503 })),
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
        console.error("Failed to load bill:", result.error);
        this.showEmptyState(t("failedToLoadBill"));
      }
    } catch (error) {
      console.error("Error loading bill:", error);
      this.currentBill = null;
      this.showGenerateBillPrompt();
    }
  }

  showGenerateBillPrompt() {
    const container = document.getElementById("billTableContainer");
    if (!container) return;

    const mn = monthName(this.currentDate.getMonth());
    const year = this.currentDate.getFullYear();

    const ub = this.currentUtilityBill;
    let utilityHtml = "";
    if (ub) {
      const exceeded =
        this.propertySubsidy > 0 &&
        (ub.totalAmount || 0) > this.propertySubsidy;
      const excess = exceeded
        ? (ub.totalAmount || 0) - this.propertySubsidy
        : 0;
      const fmtDate = (v) =>
        v
          ? new Date(v).toLocaleDateString("en-SG", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : null;
      const period =
        ub.billingPeriodStart || ub.billingPeriodEnd
          ? `${fmtDate(ub.billingPeriodStart) || "?"} – ${fmtDate(ub.billingPeriodEnd) || "?"}`
          : null;
      const gasOther =
        (ub.gasAmount || 0) + (ub.refuseAmount || 0) + (ub.otherAmount || 0);
      const cardStyle = exceeded
        ? "border:2px solid #dc3545!important;background:#fff5f5;"
        : "background:#f8f9fa;";
      const isPdf =
        ub.billImageUrl &&
        (ub.billImageUrl.includes("raw-proxy") ||
          ub.billImageUrl.toLowerCase().includes(".pdf"));
      utilityHtml = `
        <div class="col-md-4 mx-auto mb-3">
          <h6 class="d-flex align-items-center gap-2">
            ${t("spGroupUtilityBill")}
            ${this.propertySubsidy > 0 ? `<span class="badge bg-secondary" style="font-size:0.7rem;font-weight:500;">Max: $${this.propertySubsidy.toFixed(2)}</span>` : ""}
          </h6>
          <div class="border rounded p-2" style="font-size:0.82rem;${cardStyle}">
            <div class="d-flex align-items-center justify-content-between mb-1">
              <span class="fw-semibold text-primary">${monthName((ub.month || 1) - 1, true)} ${ub.year}</span>
              ${exceeded ? `<span class="badge bg-danger" style="font-size:0.7rem;">⚠ +$${excess.toFixed(2)} over limit</span>` : ""}
            </div>
            ${period ? `<div class="text-muted mb-1" style="font-size:0.75rem;">${period}</div>` : ""}
            <div class="d-flex justify-content-between"><span><i class="bi bi-lightning-charge-fill text-warning me-1"></i>${t("electricity")}</span><span>$${(ub.electricityAmount || 0).toFixed(2)}</span></div>
            <div class="d-flex justify-content-between"><span><i class="bi bi-droplet-fill text-info me-1"></i>${t("water")}</span><span>$${(ub.waterAmount || 0).toFixed(2)}</span></div>
            ${gasOther > 0 ? `<div class="d-flex justify-content-between"><span><i class="bi bi-fire text-secondary me-1"></i>${t("gasAndOthers")}</span><span>$${gasOther.toFixed(2)}</span></div>` : ""}
            <div class="d-flex justify-content-between fw-bold border-top mt-1 pt-1">
              <span>${t("total")}</span>
              <span style="color:${exceeded ? "#dc3545" : "#0d6efd"};">$${(ub.totalAmount || 0).toFixed(2)}</span>
            </div>
            ${this.propertySubsidy > 0 ? `<div class="d-flex justify-content-between border-top mt-1 pt-1" style="font-size:0.75rem;color:#6c757d;"><span>Max covered</span><span>$${this.propertySubsidy.toFixed(2)}</span></div>` : ""}
            ${ub.billImageUrl ? `<a href="${ub.billImageUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mt-2 w-100 py-0" style="font-size:0.75rem;"><i class="bi bi-${isPdf ? "file-earmark-pdf" : "image"} me-1"></i>${t("viewBill")}</a>` : ""}
          </div>
          <div id="utilityBillDropZoneInline"
               class="border rounded p-2 text-center mt-2"
               style="border-style:dashed!important;cursor:pointer;transition:background 0.15s;"
               onclick="document.getElementById('utilityBillFileInputInline').click()">
            <input type="file" id="utilityBillFileInputInline" accept="application/pdf,.pdf,image/jpeg,image/png,image/heic" style="display:none">
            <i class="bi bi-file-earmark-arrow-up text-secondary" style="font-size:1.4rem;"></i>
            <div class="small text-muted mt-1">${t("dropPdfHere")}</div>
            <div id="utilityDropStatus" class="small mt-1"></div>
          </div>
        </div>`;
    } else {
      utilityHtml = `
        <div class="col-md-4 mx-auto mb-3">
          <h6>${t("spGroupUtilityBill")}</h6>
          <div id="utilityBillDropZoneInline"
               class="border rounded p-2 text-center"
               style="border-style:dashed!important;cursor:pointer;transition:background 0.15s;"
               onclick="document.getElementById('utilityBillFileInputInline').click()">
            <input type="file" id="utilityBillFileInputInline" accept="application/pdf,.pdf,image/jpeg,image/png,image/heic" style="display:none">
            <i class="bi bi-file-earmark-arrow-up text-secondary" style="font-size:1.4rem;"></i>
            <div class="small text-muted mt-1">${t("dropPdfHere")}</div>
            <div id="utilityDropStatus" class="small mt-1"></div>
          </div>
        </div>`;
    }

    container.innerHTML = `
      <div class="row justify-content-center">
        ${utilityHtml}
      </div>
      <div class="card mb-3">
        <div class="card-header py-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h6 class="mb-0"><i class="bi bi-calculator me-2 text-primary"></i>${t("dynamicPreviewTitle")}</h6>
          <div id="billActionToolbarSlot"></div>
        </div>
        <div class="card-body p-2">
          <div id="dynamicBillCyclesBody" class="mb-3">
            <div class="text-center text-muted py-2">
              <span class="spinner-border spinner-border-sm me-2"></span>${t("loadingTenantData")}
            </div>
          </div>
          <div id="dynamicBillPreviewBody">
            <div class="text-center text-muted py-3">
              <span class="spinner-border spinner-border-sm me-2"></span>${t("loadingTenantData")}
            </div>
          </div>
        </div>
      </div>
      <div class="text-center text-muted py-3">
        <i class="bi bi-file-earmark-plus fs-1 d-block mb-3"></i>
        <h5>${t("noBillGenerated", { month: mn, year })}</h5>
        <p>${t("clickToGenerate")}</p>
        <button class="btn btn-primary mt-3" onclick="billManager.showGenerateBillModal()">
          <i class="bi bi-plus-circle me-2"></i>${t("generateBill")}
        </button>
      </div>
    `;

    this.bindUtilityDropZone();
    this._loadDynamicPreview();
    this._relocateActionToolbar();
  }

  // ── Dynamic payable preview (rent + cleaning + utility, prorated by days) ──
  // Purely a read-only estimate for admin reference; does not touch the
  // persisted Bill / payment-upload flow (generateBill / renderBillTable).
  //
  // SP Group bill cycles rarely line up with calendar months, so one month's
  // rent run can legitimately span two tracked utility bills. We surface both
  // the current and previous month's tracked bills as selectable "cycles" and
  // sum each tenant's prorated share across whichever ones are selected.

  // Resolves a utility bill's own billing period; falls back to that bill's
  // recorded (year, month) calendar bounds if no explicit dates were entered.
  _billPeriodBounds(bill) {
    if (bill.billingPeriodStart && bill.billingPeriodEnd) {
      const s = new Date(bill.billingPeriodStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(bill.billingPeriodEnd);
      e.setHours(0, 0, 0, 0);
      const days = Math.round((e - s) / 864e5) + 1;
      return { start: s, end: e, days };
    }
    const dim = new Date(bill.year, bill.month, 0).getDate();
    const s = new Date(bill.year, bill.month - 1, 1);
    s.setHours(0, 0, 0, 0);
    const e = new Date(bill.year, bill.month - 1, dim);
    e.setHours(0, 0, 0, 0);
    return { start: s, end: e, days: dim };
  }

  // Current month + 2 previous months' tracked utility bills (3 total) — a
  // wide enough window to cover cycles that lag behind the calendar month.
  _getBillCycleWindow() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;
    const wanted = new Set([`${year}-${month}`]);
    for (let back = 1; back <= 2; back++) {
      const d = new Date(year, month - 1 - back, 1);
      wanted.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }
    return (this._utilityBillsAll || [])
      .filter((b) => wanted.has(`${b.year}-${b.month}`))
      .sort((a, b) => a.year - b.year || a.month - b.month);
  }

  // Whichever cycles actually overlap this calendar month, regardless of
  // which ones the admin currently has ticked in the picker.
  _cyclesOverlappingCurrentMonth(bills) {
    const year = this.currentDate.getFullYear();
    const monthIdx = this.currentDate.getMonth();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const monthStart = new Date(year, monthIdx, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, monthIdx, daysInMonth);
    monthEnd.setHours(0, 0, 0, 0);
    return bills.filter((b) => {
      const { start, end } = this._billPeriodBounds(b);
      return +start <= +monthEnd && +end >= +monthStart;
    });
  }

  // Auto-select whichever cycles actually overlap this calendar month.
  _defaultSelectedCycleIds(bills) {
    return this._cyclesOverlappingCurrentMonth(bills).map((b) => b._id);
  }

  async _loadDynamicPreview() {
    const propertyAtStart = this.selectedProperty;
    try {
      const bills = this._getBillCycleWindow();
      if (this._selectedCycleIds === null) {
        this._selectedCycleIds = new Set(this._defaultSelectedCycleIds(bills));
      }

      const cyclesContainer = document.getElementById("dynamicBillCyclesBody");
      if (cyclesContainer) this._renderBillCyclesPicker(cyclesContainer, bills);

      const selectedBills = bills.filter((b) =>
        this._selectedCycleIds.has(b._id),
      );
      const preview = await this._computeDynamicPreview(selectedBills);
      if (this.selectedProperty !== propertyAtStart) return; // property/month changed mid-fetch

      this._dynamicPreviewCache = preview; // used by downloadSelectedBills/copySelectedBillBreakdown

      const previewContainer = document.getElementById(
        "dynamicBillPreviewBody",
      );
      if (previewContainer) {
        this._renderDynamicPreview(previewContainer, preview);
        this.bindCheckboxEvents();
        this.updateSelectionButtons();
      }
    } catch (err) {
      console.error("[BillManagement] dynamic preview error:", err);
      const previewContainer = document.getElementById(
        "dynamicBillPreviewBody",
      );
      if (previewContainer)
        previewContainer.innerHTML = `<div class="text-danger small">${t("failedToLoadBill")}</div>`;
    }
  }

  _renderBillCyclesPicker(container, bills) {
    if (!bills || bills.length === 0) {
      container.innerHTML = `<div class="text-muted small">${t("noCyclesFound")}</div>`;
      return;
    }

    const fmtDate = (d) =>
      d.toLocaleDateString("en-SG", { day: "2-digit", month: "short" });
    const cardsHtml = bills
      .map((b) => {
        const isSel = this._selectedCycleIds.has(b._id);
        const { start, end, days } = this._billPeriodBounds(b);
        return `
        <label class="cycle-card ${isSel ? "cycle-selected" : ""}">
          <input type="checkbox" class="form-check-input cycle-checkbox" data-bill-id="${b._id}" ${isSel ? "checked" : ""}>
          <div>
            <div class="cycle-card-month">${monthName(b.month - 1, true)} ${b.year}</div>
            <div class="cycle-card-period">${fmtDate(start)}–${fmtDate(end)} · ${days}d</div>
            <div class="cycle-card-amount">$${(b.totalAmount || 0).toFixed(2)}</div>
          </div>
        </label>`;
      })
      .join("");

    container.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-1">
        <i class="bi bi-collection text-primary"></i>
        <strong style="font-size:0.88rem;">${t("billCyclesTitle")}</strong>
      </div>
      <div class="small text-muted mb-2">${t("billCyclesHint")}</div>
      <div class="d-flex flex-wrap gap-2">${cardsHtml}</div>
    `;

    container.querySelectorAll(".cycle-checkbox").forEach((cb) => {
      cb.addEventListener("change", (e) => {
        const id = e.target.getAttribute("data-bill-id");
        if (e.target.checked) this._selectedCycleIds.add(id);
        else this._selectedCycleIds.delete(id);
        this._loadDynamicPreview();
      });
    });

    this._addCycleCardStyles();
  }

  _addCycleCardStyles() {
    if (document.getElementById("bill-cycle-card-styles")) return;
    const style = document.createElement("style");
    style.id = "bill-cycle-card-styles";
    style.textContent = `
      .cycle-card {
        display:flex; align-items:flex-start; gap:8px;
        border:2px solid #dee2e6; border-radius:8px; padding:8px 12px;
        min-width:150px; background:#fff; cursor:pointer;
        transition:border-color .15s ease, background .15s ease;
      }
      .cycle-card:hover { border-color:#adb5bd; }
      .cycle-card.cycle-selected { border-color:#0d6efd; background:rgba(13,110,253,0.06); }
      .cycle-card-month { font-weight:600; font-size:0.85rem; }
      .cycle-card-period { font-size:0.72rem; color:#6c757d; margin-top:1px; }
      .cycle-card-amount { font-size:0.9rem; font-weight:700; color:#0d6efd; margin-top:2px; }
    `;
    document.head.appendChild(style);
  }

  // Fixed-size circular avatar (falls back to an initials badge, and swaps to
  // it automatically if the image URL 404s). Shared by the dynamic preview
  // table and the exported bill card so both render tenants identically.
  // `avatarUrl` may already be a resolved data: URI (see _avatarDataUri) —
  // in that case it's used as-is, skipping the Cloudinary transform helper.
  _avatarHtml(name, avatarUrl, size = 34, fontSize = 13) {
    const resolvedUrl =
      avatarUrl &&
      !avatarUrl.startsWith("data:") &&
      typeof ImageUtils !== "undefined"
        ? ImageUtils.getOptimizedImageUrl(avatarUrl, "small")
        : avatarUrl;
    const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
    const fallback = `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width:${size}px;height:${size}px;font-size:${fontSize}px;">${escapeHtml(initial)}</div>`;
    if (!resolvedUrl) return fallback;
    return `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <img src="${resolvedUrl}" alt="" class="rounded-circle" crossorigin="anonymous"
             style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <div class="rounded-circle bg-secondary text-white fw-bold" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;font-size:${fontSize}px;">${escapeHtml(initial)}</div>
      </div>`;
  }

  // Fetches an avatar and inlines it as a base64 data: URI. Used only for
  // the exported bill image — a data: URI can never taint a canvas, whereas
  // a remote <img> (even with crossorigin="anonymous") still throws
  // SecurityError on export whenever the actual source lacks proper CORS
  // headers (e.g. an avatar URL pasted from somewhere other than Cloudinary).
  // Returns null on any failure so the caller falls back to initials.
  async _avatarDataUri(url) {
    if (!url) return null;
    try {
      const res = await fetch(url, { mode: "cors", credentials: "omit" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // Prorates a tenant's rent for the given calendar month using their
  // roomAssignments (falls back to legacy movein/moveout + tenant.rent).
  _computeProratedRent(
    propAssoc,
    tenantFallbackRent,
    monthStart,
    monthEnd,
    daysInMonth,
  ) {
    const msDay = 864e5;
    let assignments = propAssoc.roomAssignments || [];
    if (assignments.length === 0) {
      assignments = [
        {
          moveinDate: propAssoc.moveinDate,
          moveoutDate: propAssoc.moveoutDate,
          rent: tenantFallbackRent,
        },
      ];
    }

    let amount = 0;
    let daysStayed = 0;
    for (const ra of assignments) {
      const raStart = ra.moveinDate ? new Date(ra.moveinDate) : monthStart;
      const raEnd = ra.moveoutDate ? new Date(ra.moveoutDate) : monthEnd;
      raStart.setHours(0, 0, 0, 0);
      raEnd.setHours(0, 0, 0, 0);
      const os = Math.max(+raStart, +monthStart);
      const oe = Math.min(+raEnd, +monthEnd);
      if (oe < os) continue;
      const days = Math.round((oe - os) / msDay) + 1;
      const rent = ra.rent != null ? ra.rent : tenantFallbackRent || 0;
      amount += rent * (days / daysInMonth);
      daysStayed += days;
    }
    return { amount, daysStayed: Math.min(daysStayed, daysInMonth) };
  }

  async _computeDynamicPreview(selectedBills) {
    const year = this.currentDate.getFullYear();
    const monthIdx = this.currentDate.getMonth();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const monthStart = new Date(year, monthIdx, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, monthIdx, daysInMonth);
    monthEnd.setHours(0, 0, 0, 0);

    const res = await API.get(
      API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(this.selectedProperty),
    );
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load tenants");
    const fullTenants = data.tenants || [];

    // Rent + cleaning fee: prorated by actual days stayed within the calendar month.
    const entries = [];
    for (const tenant of fullTenants) {
      const propAssoc = (tenant.properties || []).find(
        (p) =>
          p.propertyId?.toUpperCase() === this.selectedProperty?.toUpperCase(),
      );
      if (!propAssoc) continue;
      const room = propAssoc.roomType || propAssoc.room;
      if (!room) continue;

      const rentInfo = this._computeProratedRent(
        propAssoc,
        tenant.rent,
        monthStart,
        monthEnd,
        daysInMonth,
      );
      if (rentInfo.daysStayed <= 0) continue; // not present this month at all

      entries.push({
        tenantId: tenant._id?.toString().toUpperCase(),
        tenantName:
          tenant.name || tenant.fullName || tenant.email || tenant._id,
        room,
        daysStayed: rentInfo.daysStayed,
        rentAmount: rentInfo.amount,
        cleaningFee: tenant.cleaningFee || 0,
        notes: (tenant.notes || "").trim(),
        pendingTodos: (tenant.todos || []).filter((td) => !td.completed),
        avatar: tenant.avatar || null,
        facebookUrl: tenant.facebookUrl || null,
        phoneNumber: tenant.phoneNumber || null,
        cycles: {},
      });
    }
    const entryByTenant = {};
    entries.forEach((e) => {
      entryByTenant[e.tenantId] = e;
    });

    // Utility fee: reuse the same person-day proration used by the breakdown modal
    // (handles move-in/out clamping, leave/away days, and subsidized tenants),
    // once per selected bill cycle, each clipped to its own billing period.
    //
    // The property's fixed landlord subsidy is a per-SP-Group-bill allowance —
    // each cycle gets its own independent "up to $X" cap (min(subsidy, cycle
    // total)), with no splitting/interaction across cycles. A cycle whose
    // total is under the cap is fully covered ($0 owed) regardless of what
    // else is selected; one that exceeds it still needs the excess topped up.
    const tenantBillsForBreakdown = entries.map((e) => ({
      tenantId: e.tenantId,
      tenantName: e.tenantName,
      room: e.room,
    }));

    const fmtCycleDate = (d) =>
      d.toLocaleDateString("en-SG", { day: "2-digit", month: "2-digit" });

    selectedBills.forEach((bill) => {
      const { start, end, days } = this._billPeriodBounds(bill);
      const allocatedSubsidy = Math.min(
        this.propertySubsidy,
        bill.totalAmount || 0,
      );
      const breakdown = this._calcUtilityBreakdown(
        fullTenants,
        tenantBillsForBreakdown,
        bill.totalAmount || 0,
        allocatedSubsidy,
        start,
        end,
        days,
      );
      breakdown.rows.forEach((r) => {
        const e = entryByTenant[r.tenantId];
        if (!e) return;
        e.cycles[bill._id] = {
          label: `${monthName(bill.month - 1, true)} ${bill.year}`,
          month: bill.month,
          year: bill.year,
          period: `${fmtCycleDate(start)}–${fmtCycleDate(end)}, ${days} ngày`,
          share: r.utilityShare,
          charged: r.chargedAmount,
          isSubsidized: r.isSubsidized,
        };
      });
    });

    const rows = entries
      .map((e) => {
        const cycleList = Object.values(e.cycles);
        const pubAmount = cycleList.reduce((s, c) => s + c.charged, 0);
        const pubShareRaw = cycleList.reduce((s, c) => s + c.share, 0);
        const isSubsidized = cycleList.length > 0 && cycleList[0].isSubsidized;
        return {
          ...e,
          cycles: cycleList,
          pubAmount,
          pubShareRaw,
          isSubsidized,
          total: e.rentAmount + e.cleaningFee + pubAmount,
        };
      })
      .sort((a, b) => (a.room || "").localeCompare(b.room || ""));

    return { rows, daysInMonth, hasSelectedBills: selectedBills.length > 0 };
  }

  _renderDynamicPreview(container, preview) {
    if (!preview || preview.rows.length === 0) {
      container.innerHTML = `<div class="text-muted text-center py-2 small">${t("noTenantsForPreview")}</div>`;
      return;
    }

    const fmt = (v) => `$${v.toFixed(2)}`;

    const cycleLines = (r) =>
      r.cycles
        .map((c) => {
          const amtHtml = r.isSubsidized
            ? `<span class="text-decoration-line-through">${fmt(c.share)}</span>`
            : fmt(c.share);
          return `<div style="font-size:0.72rem;color:#6c757d;">${escapeHtml(c.label)}: ${amtHtml}</div>`;
        })
        .join("");

    // Truncated with an ellipsis (not wrapped) — the full text is still on
    // the native title tooltip. Wrapping long free-text inside a table cell
    // is what broke the column layout before; a single truncated line has a
    // fixed, predictable height/width no matter how long the note is.
    const tenantNotesCell = (r) => {
      const parts = [];
      if (r.notes) {
        parts.push(
          `<div class="text-muted text-truncate" style="font-size:0.72rem;margin-top:3px;max-width:150px;" title="${escapeHtml(r.notes)}"><i class="bi bi-sticky-fill me-1"></i>${escapeHtml(r.notes)}</div>`,
        );
      }
      if (r.pendingTodos && r.pendingTodos.length > 0) {
        const items = r.pendingTodos
          .map((td) => escapeHtml(td.text))
          .join("; ");
        parts.push(
          `<div class="text-truncate" style="font-size:0.72rem;margin-top:3px;max-width:150px;color:#b8860b;" title="${escapeHtml(items)}"><i class="bi bi-list-task me-1"></i>${items}</div>`,
        );
      }
      return parts.join("");
    };

    // Fixed-size circular avatar — always the same size regardless of whether
    // socials are present, so it never shifts the name column.
    const AVATAR_SIZE = 34;
    const tenantAvatarHtml = (r) =>
      this._avatarHtml(r.tenantName, r.avatar, AVATAR_SIZE);

    // Compact Facebook/Messenger/WhatsApp icon chips — only the ones that
    // actually exist for this tenant. Sits inline next to the name, not under
    // the avatar, so a varying icon count never shifts the avatar/name layout.
    const tenantSocialIcons = (r) => {
      const chip = (color, icon, title, href) => `
        <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" title="${title}"
           style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;
                  border-radius:50%;background:${color}1f;color:${color};font-size:11px;text-decoration:none;">
          <i class="bi ${icon}"></i>
        </a>`;

      const icons = [];
      if (r.facebookUrl) {
        icons.push(chip("#1877F2", "bi-facebook", "Facebook", r.facebookUrl));
        const msgUrl = facebookToMessengerUrl(r.facebookUrl);
        if (msgUrl)
          icons.push(chip("#0084ff", "bi-messenger", "Messenger", msgUrl));
      }
      if (r.phoneNumber) {
        const waUrl = buildWhatsAppSignContractUrl(r.phoneNumber, r.tenantName);
        if (waUrl)
          icons.push(chip("#25D366", "bi-whatsapp", "WhatsApp", waUrl));
      }
      return icons.length
        ? `<div style="display:flex;gap:4px;margin-top:3px;">${icons.join("")}</div>`
        : "";
    };

    // Built as a CSS Grid "table" rather than a native <table>: the header
    // and every row are independent grid containers, but all share the exact
    // same GRID_COLUMNS template, so column alignment is guaranteed by the
    // grid definition itself — there's no browser column-width algorithm
    // left to misbehave, unlike native <table> auto/fixed layout.
    const GRID_COLUMNS =
      "32px minmax(170px,2fr) minmax(100px,1fr) 64px 84px 84px minmax(130px,1.3fr) 96px";

    const gridCell = (content, opts = {}) => `
      <div style="${opts.align ? `text-align:${opts.align};` : ""}${opts.style || ""}">${content}</div>`;

    const rowsHtml = preview.rows
      .map(
        (r) => `
      <div class="bill-tenant-row" data-tenant-id="${r.tenantId}" style="display:grid;grid-template-columns:${GRID_COLUMNS};gap:8px;align-items:start;padding:10px 8px;border-bottom:1px solid #f1f3f5;">
        ${gridCell(`<input type="checkbox" class="form-check-input tenant-checkbox" data-tenant-id="${r.tenantId}" ${this.selectedTenants.has(r.tenantId) ? "checked" : ""}>`, { style: "padding-top:2px;" })}
        ${gridCell(`
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <div style="flex:0 0 ${AVATAR_SIZE}px;">${tenantAvatarHtml(r)}</div>
            <div style="min-width:0;">
              <div class="fw-semibold">${escapeHtml(r.tenantName)}</div>
              ${tenantSocialIcons(r)}
              ${tenantNotesCell(r)}
            </div>
          </div>`)}
        ${gridCell(escapeHtml(getRoomTypeDisplayName(r.room)))}
        ${gridCell(`${r.daysStayed}/${preview.daysInMonth}`, { align: "center" })}
        ${gridCell(fmt(r.rentAmount), { align: "right" })}
        ${gridCell(fmt(r.cleaningFee), { align: "right" })}
        ${gridCell(
          `<div class="fw-semibold${r.isSubsidized ? " text-success" : ""}">${fmt(r.pubAmount)}</div>
          ${cycleLines(r)}
          ${
            r.isSubsidized && r.pubShareRaw > 0.005
              ? `<span class="badge bg-warning text-dark mt-1" style="font-size:0.68rem;">${t("subsidisedSaved", { amount: fmt(r.pubShareRaw) })}</span>`
              : ""
          }`,
          { align: "right" },
        )}
        ${gridCell(`<span class="fw-bold">${fmt(r.total)}</span>`, { align: "right" })}
      </div>
    `,
      )
      .join("");

    const totalPayable = preview.rows.reduce((s, r) => s + r.total, 0);
    const totalSaved = preview.rows
      .filter((r) => r.isSubsidized)
      .reduce((s, r) => s + r.pubShareRaw, 0);
    const allSelected = preview.rows.every((r) =>
      this.selectedTenants.has(r.tenantId),
    );

    container.innerHTML = `
      <div style="overflow-x:auto;">
        <div style="min-width:820px;">
          <div style="display:grid;grid-template-columns:${GRID_COLUMNS};gap:8px;align-items:center;padding:8px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-weight:600;font-size:0.85rem;">
            ${gridCell(`<input type="checkbox" id="selectAllTenants" class="form-check-input" ${allSelected ? "checked" : ""}>`)}
            ${gridCell(t("tenant"))}
            ${gridCell(t("room"))}
            ${gridCell(t("daysStayed"), { align: "center" })}
            ${gridCell(t("baseRental"), { align: "right" })}
            ${gridCell(t("cleaningFee"), { align: "right" })}
            ${gridCell(t("utilityFee"), { align: "right" })}
            ${gridCell(t("total"), { align: "right" })}
          </div>
          ${rowsHtml}
        </div>
      </div>
      <div class="d-flex justify-content-between align-items-center px-1 flex-wrap gap-2 mt-1">
        <small class="text-muted">
          ${!preview.hasSelectedBills ? t("pubNotAddedYetNote") : ""}
          ${totalSaved > 0.005 ? `<span class="ms-1">${t("landlordAbsorbsShort", { amount: fmt(totalSaved) })}</span>` : ""}
        </small>
        <div><strong>${t("estimatedTotal")}: ${fmt(totalPayable)}</strong></div>
      </div>
    `;
  }

  showEmptyState(message) {
    const container = document.getElementById("billTableContainer");
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

    const container = document.getElementById("billTableContainer");
    if (!container) return;

    this.selectedTenants.clear();
    this.updateSelectionButtons();

    const tenantBills = this.currentBill.tenantBills || [];

    // Same CSS Grid "table" as _renderDynamicPreview: header and every row
    // are independent grid containers sharing one GRID_COLUMNS template, so
    // column alignment comes from the grid definition itself rather than
    // native <table> auto layout. ".bill-tenant-row"/".tenant-checkbox" are
    // plain classes either way, so bindCheckboxEvents() etc. don't care.
    const GRID_COLUMNS =
      "32px minmax(160px,2fr) minmax(90px,1fr) 90px 90px 90px 100px minmax(130px,1.2fr) 150px minmax(150px,1fr)";
    const gridCell = (content, opts = {}) => `
      <div style="${opts.align ? `text-align:${opts.align};` : ""}${opts.style || ""}">${content}</div>`;

    let html = `
      <div class="card mb-3">
        <div class="card-header py-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h6 class="mb-0"><i class="bi bi-receipt me-2 text-primary"></i>${t("generatedBillTitle")}</h6>
          <div id="billActionToolbarSlot"></div>
        </div>
      </div>
      <div style="overflow-x:auto;">
        <div style="min-width:950px;">
          <div style="display:grid;grid-template-columns:${GRID_COLUMNS};gap:8px;align-items:center;padding:8px;background:#f8f9fa;border-bottom:2px solid #dee2e6;font-weight:600;font-size:0.85rem;">
            ${gridCell(`<input type="checkbox" id="selectAllTenants" class="form-check-input">`)}
            ${gridCell(t("tenant"))}
            ${gridCell(t("room"))}
            ${gridCell(t("baseRental"), { align: "right" })}
            ${gridCell(t("utilityFee"), { align: "right" })}
            ${gridCell(t("cleaningFee"), { align: "right" })}
            ${gridCell(t("total"), { align: "right" })}
            ${gridCell(t("status"))}
            ${gridCell(t("uploadLink"))}
            ${gridCell(t("actions"))}
          </div>
    `;

    tenantBills.forEach((tenantBill) => {
      const statusBadge = this.getStatusBadge(tenantBill.paymentStatus);
      const uploadInfo = tenantBill.latestUpload
        ? `<small class="text-muted">${t("uploadedOn", { date: new Date(tenantBill.latestUpload.uploadDate).toLocaleString() })}</small>`
        : "";

      html += `
        <div class="bill-tenant-row" data-tenant-id="${tenantBill.tenantId}" style="display:grid;grid-template-columns:${GRID_COLUMNS};gap:8px;align-items:center;padding:10px 8px;border-bottom:1px solid #f1f3f5;">
          ${gridCell(`<input type="checkbox" class="form-check-input tenant-checkbox" data-tenant-id="${tenantBill.tenantId}">`)}
          ${gridCell(`<strong>${escapeHtml(tenantBill.tenantName)}</strong><br><small class="text-muted">${escapeHtml(tenantBill.tenantId)}</small>`)}
          ${gridCell(escapeHtml(tenantBill.room ? getRoomTypeDisplayName(tenantBill.room) : "-"))}
          ${gridCell(`$${tenantBill.baseRental.toFixed(2)}`, { align: "right" })}
          ${gridCell(`$${tenantBill.utilityFee.toFixed(2)}`, { align: "right" })}
          ${gridCell(`$${tenantBill.cleaningFee.toFixed(2)}`, { align: "right" })}
          ${gridCell(`<strong>$${tenantBill.totalAmount.toFixed(2)}</strong>`, { align: "right" })}
          ${gridCell(`${statusBadge}${uploadInfo}`)}
          ${gridCell(`
            <button class="btn btn-sm btn-outline-secondary" onclick="billManager.copyUploadLink('${tenantBill.uploadLink}')">
              <i class="bi bi-clipboard"></i> ${t("copyLink")}
            </button>`)}
          ${gridCell(`
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="billManager.editTenantBill('${tenantBill.tenantId}')">
                <i class="bi bi-pencil"></i>
              </button>
              ${
                tenantBill.latestUpload
                  ? `
                <button class="btn btn-outline-info" onclick="billManager.viewUpload('${tenantBill.latestUpload.screenshotUrl}')" title="View uploaded screenshot">
                  <i class="bi bi-image"></i>
                </button>
                <button class="btn btn-outline-warning" onclick="billManager.resetTenantPayment('${tenantBill.tenantId}')" title="${t("reset")}">
                  <i class="bi bi-arrow-counterclockwise"></i> ${t("reset")}
                </button>
              `
                  : ""
              }
            </div>`)}
        </div>
      `;
    });

    html += `
        </div>
      </div>

      <div class="card mt-3">
        <div class="card-body">
          <div class="row">
            <div class="col-md-4">
              <h6>${t("billSummary")}</h6>
              <p><strong>${t("totalTenants")}:</strong> ${tenantBills.length}</p>
              <p><strong>${t("paid")}:</strong> ${tenantBills.filter((tb) => tb.paymentStatus === "uploaded" || tb.paymentStatus === "verified").length}</p>
              <p><strong>${t("pendingCount")}:</strong> ${tenantBills.filter((tb) => tb.paymentStatus === "pending").length}</p>
            </div>
            <div class="col-md-4">
              <h6>${t("feeSummary")}</h6>
              <p id="billingPeriodDisplay"><strong>${t("billingPeriod")}:</strong> ${this.currentBill.billingPeriod ? escapeHtml(this.currentBill.billingPeriod) : '<span class="text-muted">-</span>'}</p>
              <p id="utilityFeeDisplay"><strong>${t("totalUtilityFeeShared")}:</strong> $${this.currentBill.utilityFee.toFixed(2)}</p>
              <p><strong>${t("tenantsPayingUtility")}:</strong> ${tenantBills.filter((tb) => tb.utilityFee > 0).length}</p>
              <p><strong>${t("utilitySubsidized")}:</strong> ${tenantBills.filter((tb) => tb.utilityFee === 0).length}</p>
              <button class="btn btn-sm btn-outline-primary mt-1" onclick="billManager.showUtilityBreakdownModal()">
                <i class="bi bi-calculator me-1"></i>${t("viewUtilityBreakdown")}
              </button>
              <div id="ocrReadStatus"></div>
            </div>
            <div class="col-md-4">
              <h6 class="d-flex align-items-center gap-2">
                ${t("spGroupUtilityBill")}
                ${this.propertySubsidy > 0 ? `<span class="badge bg-secondary" style="font-size:0.7rem;font-weight:500;">Max: $${this.propertySubsidy.toFixed(2)}</span>` : ""}
              </h6>
              ${
                this.currentUtilityBill
                  ? (() => {
                      const ub = this.currentUtilityBill;
                      const exceeded =
                        this.propertySubsidy > 0 &&
                        (ub.totalAmount || 0) > this.propertySubsidy;
                      const excess = exceeded
                        ? (ub.totalAmount || 0) - this.propertySubsidy
                        : 0;
                      const fmtDate = (v) =>
                        v
                          ? new Date(v).toLocaleDateString("en-SG", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : null;
                      const period =
                        ub.billingPeriodStart || ub.billingPeriodEnd
                          ? `${fmtDate(ub.billingPeriodStart) || "?"} – ${fmtDate(ub.billingPeriodEnd) || "?"}`
                          : null;
                      const gasOther =
                        (ub.gasAmount || 0) +
                        (ub.refuseAmount || 0) +
                        (ub.otherAmount || 0);
                      const cardStyle = exceeded
                        ? "border:2px solid #dc3545!important;background:#fff5f5;"
                        : "background:#f8f9fa;";
                      return `
                  <div class="border rounded p-2" style="font-size:0.82rem;${cardStyle}">
                    <div class="d-flex align-items-center justify-content-between mb-1">
                      <span class="fw-semibold text-primary">${monthName((ub.month || 1) - 1, true)} ${ub.year}</span>
                      ${exceeded ? `<span class="badge bg-danger" style="font-size:0.7rem;">⚠ +$${excess.toFixed(2)} over limit</span>` : ""}
                    </div>
                    ${period ? `<div class="text-muted mb-1" style="font-size:0.75rem;">${period}</div>` : ""}
                    <div class="d-flex justify-content-between"><span><i class="bi bi-lightning-charge-fill text-warning me-1"></i>${t("electricity")}</span><span>$${(ub.electricityAmount || 0).toFixed(2)}</span></div>
                    <div class="d-flex justify-content-between"><span><i class="bi bi-droplet-fill text-info me-1"></i>${t("water")}</span><span>$${(ub.waterAmount || 0).toFixed(2)}</span></div>
                    ${gasOther > 0 ? `<div class="d-flex justify-content-between"><span><i class="bi bi-fire text-secondary me-1"></i>${t("gasAndOthers")}</span><span>$${gasOther.toFixed(2)}</span></div>` : ""}
                    <div class="d-flex justify-content-between fw-bold border-top mt-1 pt-1">
                      <span>${t("total")}</span>
                      <span style="color:${exceeded ? "#dc3545" : "#0d6efd"};">$${(ub.totalAmount || 0).toFixed(2)}</span>
                    </div>
                    ${
                      this.propertySubsidy > 0
                        ? `
                    <div class="d-flex justify-content-between border-top mt-1 pt-1" style="font-size:0.75rem;color:#6c757d;">
                      <span>Max covered</span>
                      <span>$${this.propertySubsidy.toFixed(2)}</span>
                    </div>`
                        : ""
                    }
                    ${
                      ub.billImageUrl
                        ? (() => {
                            const isPdf =
                              ub.billImageUrl.includes("raw-proxy") ||
                              ub.billImageUrl.toLowerCase().includes(".pdf");
                            return `<a href="${ub.billImageUrl}" target="_blank" class="btn btn-sm btn-outline-secondary mt-2 w-100 py-0" style="font-size:0.75rem;"><i class="bi bi-${isPdf ? "file-earmark-pdf" : "image"} me-1"></i>${t("viewBill")}</a>`;
                          })()
                        : ""
                    }
                  </div>`;
                    })()
                  : ""
              }
              <div id="utilityBillDropZoneInline"
                   class="border rounded p-2 text-center mt-2"
                   style="border-style:dashed!important;cursor:pointer;transition:background 0.15s;"
                   onclick="document.getElementById('utilityBillFileInputInline').click()">
                <input type="file" id="utilityBillFileInputInline" accept="application/pdf,.pdf,image/jpeg,image/png,image/heic" style="display:none">
                <i class="bi bi-file-earmark-arrow-up text-secondary" style="font-size:1.4rem;"></i>
                <div class="small text-muted mt-1">${t("dropPdfHere")}</div>
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
    this._relocateActionToolbar();
  }

  // Physically moves the (single, static) #billActionToolbar node into
  // whichever header slot is currently in the DOM — the dynamic preview
  // card's header or the generated bill table's header — so its buttons,
  // listeners and tooltips stay intact rather than being re-created.
  _relocateActionToolbar() {
    const toolbar = document.getElementById("billActionToolbar");
    const slot = document.getElementById("billActionToolbarSlot");
    if (toolbar && slot && toolbar.parentElement !== slot) {
      slot.appendChild(toolbar);
    }
  }

  bindUtilityDropZone() {
    const dropZone = document.getElementById("utilityBillDropZoneInline");
    const fileInput = document.getElementById("utilityBillFileInputInline");
    if (!dropZone || !fileInput) return;

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) this.uploadUtilityBillFromDrop(file);
      fileInput.value = "";
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.background = "rgba(13,110,253,0.07)";
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.style.background = "";
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.background = "";
      const file = e.dataTransfer?.files?.[0];
      if (file) this.uploadUtilityBillFromDrop(file);
    });
  }

  async uploadUtilityBillFromDrop(file) {
    if (!this.selectedProperty) return;

    const statusEl = document.getElementById("utilityDropStatus");
    const dropZone = document.getElementById("utilityBillDropZoneInline");

    const setStatus = (html) => {
      if (statusEl) statusEl.innerHTML = html;
    };

    setStatus(
      `<span class="spinner-border spinner-border-sm me-1"></span>Reading bill…`,
    );
    if (dropZone) dropZone.style.pointerEvents = "none";

    try {
      // Step 1: OCR / parse
      const ocrForm = new FormData();
      ocrForm.append("billImage", file);
      const ocrRes = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UTILITY_BILL_PARSE_OCR}`,
        {
          method: "POST",
          credentials: "include",
          body: ocrForm,
        },
      );
      const ocrData = await ocrRes.json();
      if (!ocrData.success) throw new Error(ocrData.error || "OCR failed");

      const parsed = ocrData.data;
      const year = parsed.billYear || this.currentDate.getFullYear();
      const month = parsed.billMonth || this.currentDate.getMonth() + 1;

      setStatus(
        `<span class="spinner-border spinner-border-sm me-1"></span>Saving…`,
      );

      // Step 2: Save
      const saveForm = new FormData();
      saveForm.append("year", year);
      saveForm.append("month", month);
      saveForm.append("billImage", file);
      if (parsed.accountNumber)
        saveForm.append("accountNumber", parsed.accountNumber);
      if (parsed.billDate) saveForm.append("billDate", parsed.billDate);
      if (parsed.billingPeriodStart)
        saveForm.append("billingPeriodStart", parsed.billingPeriodStart);
      if (parsed.billingPeriodEnd)
        saveForm.append("billingPeriodEnd", parsed.billingPeriodEnd);
      if (parsed.electricityAmount != null)
        saveForm.append("electricityAmount", parsed.electricityAmount);
      if (parsed.waterAmount != null)
        saveForm.append("waterAmount", parsed.waterAmount);
      if (parsed.gasAmount != null)
        saveForm.append("gasAmount", parsed.gasAmount);
      if (parsed.refuseAmount != null)
        saveForm.append("refuseAmount", parsed.refuseAmount);
      if (parsed.gstAmount != null)
        saveForm.append("gstAmount", parsed.gstAmount);
      if (parsed.otherAmount != null)
        saveForm.append("otherAmount", parsed.otherAmount);
      if (parsed.totalAmount != null)
        saveForm.append("totalAmount", parsed.totalAmount);

      const saveRes = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UTILITY_BILL_CREATE(this.selectedProperty)}`,
        {
          method: "POST",
          credentials: "include",
          body: saveForm,
        },
      );
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error || "Save failed");

      setStatus(
        `<i class="bi bi-check-circle-fill text-success me-1"></i>Saved`,
      );
      // Refresh utility bill and re-render
      await this.loadUtilityBillForMonth();
      this._selectedCycleIds = null; // re-default cycle selection to include the newly saved bill
      if (dropZone) dropZone.style.pointerEvents = "";
      if (this.currentBill) {
        this.renderBillTable();
      } else {
        this.showGenerateBillPrompt();
      }
    } catch (err) {
      console.error("[BillManagement] utility drop upload error:", err);
      setStatus(
        `<i class="bi bi-exclamation-triangle text-danger me-1"></i>${err.message}`,
      );
      if (dropZone) dropZone.style.pointerEvents = "";
    }
  }

  async _loadPropertyDetails() {
    if (!this.selectedProperty) return;
    try {
      const res = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(this.selectedProperty),
      );
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
    const container = document.getElementById("billFbGroups");
    if (!container) return;
    const tenantGroup = property?.tenantFacebookGroup;
    const adminGroup = property?.adminFacebookGroup;
    if (!tenantGroup && !adminGroup) {
      container.style.display = "none";
      return;
    }
    container.style.display = "";
    const tenantMeta = getGroupLinkMeta(tenantGroup);
    container.innerHTML = [
      tenantGroup
        ? `<a href="${escapeHtml(tenantGroup)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="border-color:${tenantMeta.color};color:${tenantMeta.color};"><i class="bi ${tenantMeta.icon} me-1"></i>Tenant Group</a>`
        : "",
      adminGroup
        ? `<a href="${escapeHtml(adminGroup)}"  target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-success"><i class="bi bi-facebook me-1"></i>Admin Group</a>`
        : "",
    ].join("");
  }

  async _loadAllUtilityBillsForChart() {
    if (!this.selectedProperty) return;
    if (this._allUtilityBills.length > 0) {
      this._renderBillTrendChart();
      return;
    }
    try {
      const res = await API.get(
        API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(this.selectedProperty),
      );
      const data = await res.json();
      if (data.success) this._allUtilityBills = data.bills || [];
    } catch {
      this._allUtilityBills = [];
    }
    this._renderBillTrendChart();
  }

  _ensureChartContainer() {
    let card = document.getElementById("billTrendChartContainer");
    if (!card) {
      // Insert directly above the bill table/dropzone area; the action
      // toolbar itself lives after billTableContainer, further down.
      const anchor = document.getElementById("billTableContainer");
      if (!anchor) return null;
      card = document.createElement("div");
      card.id = "billTrendChartContainer";
      card.className = "card mb-3 shadow-sm";
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
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );
    const recent = sorted.slice(-12);

    if (recent.length === 0) {
      container.style.display = "none";
      return;
    }
    container.style.display = "";

    const curYear = this.currentDate.getFullYear();
    const curMonth = this.currentDate.getMonth() + 1;
    const subsidy = this.propertySubsidy;

    const labels = recent.map(
      (b) => `${monthName(b.month - 1, true)} ${b.year}`,
    );
    const amounts = recent.map((b) => b.totalAmount || 0);

    const bgColors = amounts.map((amt, i) => {
      const b = recent[i];
      const isCurrent = b.year === curYear && b.month === curMonth;
      const over = subsidy > 0 && amt > subsidy;
      if (over)
        return isCurrent ? "rgba(220,53,69,0.9)" : "rgba(220,53,69,0.55)";
      return isCurrent ? "rgba(13,110,253,0.9)" : "rgba(13,110,253,0.45)";
    });

    const borderColors = amounts.map((amt, i) => {
      const b = recent[i];
      const isCurrent = b.year === curYear && b.month === curMonth;
      const over = subsidy > 0 && amt > subsidy;
      if (over) return "rgba(220,53,69,1)";
      return isCurrent ? "rgba(13,110,253,1)" : "rgba(13,110,253,0.65)";
    });

    const borderWidths = recent.map((b) =>
      b.year === curYear && b.month === curMonth ? 2.5 : 1,
    );

    const datasets = [
      {
        label: "SP Group Bill",
        data: amounts,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderRadius: 4,
      },
    ];

    if (subsidy > 0) {
      datasets.push({
        label: `Max covered ($${subsidy.toFixed(2)})`,
        data: recent.map(() => subsidy),
        type: "line",
        borderColor: "rgba(220,53,69,0.85)",
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 0,
      });
    }

    const canvas = document.getElementById("billTrendChart");
    if (!canvas) return;

    if (this._billChart) {
      this._billChart.destroy();
      this._billChart = null;
    }

    this._billChart = new Chart(canvas, {
      type: "bar",
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
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `$${v}`, font: { size: 11 } },
          },
          x: { ticks: { font: { size: 10 } } },
        },
      },
    });

    const badge = document.getElementById("billTrendSubsidyBadge");
    if (badge) {
      if (subsidy > 0) {
        badge.textContent = `Max: $${subsidy.toFixed(2)}`;
        badge.className = "badge bg-danger";
        badge.style.display = "";
      } else {
        badge.style.display = "none";
      }
    }
  }

  bindCheckboxEvents() {
    const selectAllCheckbox = document.getElementById("selectAllTenants");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", (e) =>
        this.toggleSelectAll(e.target.checked),
      );
    }

    const tenantCheckboxes = document.querySelectorAll(".tenant-checkbox");
    tenantCheckboxes.forEach((checkbox) => {
      this._syncTenantRowHighlight(checkbox);
      checkbox.addEventListener("change", (e) => {
        const tenantId = e.target.getAttribute("data-tenant-id");
        if (e.target.checked) {
          this.selectedTenants.add(tenantId);
        } else {
          this.selectedTenants.delete(tenantId);
        }
        this._syncTenantRowHighlight(e.target);
        this.updateSelectionButtons();
      });
    });

    // Tap/click anywhere on the row to toggle selection — the checkbox alone
    // is a small target that's fiddly on mobile. Clicks on actual controls
    // inside the row (links, buttons, the checkbox itself) still work normally.
    // Styling is applied inline via JS (not a CSS rule) so it can't interact
    // with either grid's layout in any way. ".bill-tenant-row" matches both
    // the generated-bill and dynamic-preview grid rows (both plain <div>s).
    document.querySelectorAll(".bill-tenant-row").forEach((row) => {
      row.style.cursor = "pointer";
      row.addEventListener("mouseenter", () => {
        if (!row.querySelector(".tenant-checkbox")?.checked) row.style.background = "rgba(0,0,0,0.03)";
      });
      row.addEventListener("mouseleave", () => {
        if (!row.querySelector(".tenant-checkbox")?.checked) row.style.background = "";
      });
      row.addEventListener("click", (e) => {
        if (e.target.closest("input, button, a")) return;
        const checkbox = row.querySelector(".tenant-checkbox");
        if (checkbox && !checkbox.disabled) checkbox.click();
      });
    });
  }

  // Highlights a tenant row based on its checkbox's checked state, applied
  // as an inline style directly on the row rather than a CSS rule.
  _syncTenantRowHighlight(checkbox) {
    const row = checkbox.closest(".bill-tenant-row");
    if (row) row.style.background = checkbox.checked ? "rgba(13,110,253,0.08)" : "";
  }

  toggleSelectAll(checked) {
    const tenantCheckboxes = document.querySelectorAll(".tenant-checkbox");
    tenantCheckboxes.forEach((checkbox) => {
      checkbox.checked = checked;
      const tenantId = checkbox.getAttribute("data-tenant-id");
      if (checked) {
        this.selectedTenants.add(tenantId);
      } else {
        this.selectedTenants.delete(tenantId);
      }
      this._syncTenantRowHighlight(checkbox);
    });
    this.updateSelectionButtons();
  }

  updateSelectionButtons() {
    const isEmpty = this.selectedTenants.size === 0;
    const bulkDeleteBtn = document.getElementById("bulkDeleteUploadsBtn");
    if (bulkDeleteBtn) bulkDeleteBtn.disabled = isEmpty;
    const downloadBtn = document.getElementById("billDownloadSelectedBtn");
    if (downloadBtn) downloadBtn.disabled = isEmpty;
    const copyBtn = document.getElementById("billCopySelectedBtn");
    if (copyBtn) copyBtn.disabled = isEmpty;
  }

  getStatusBadge(status) {
    const badges = {
      pending: `<span class="badge bg-warning text-dark">${t("statusPending")}</span>`,
      uploaded: `<span class="badge bg-success">${t("statusUploaded")}</span>`,
      verified: `<span class="badge bg-primary">${t("statusVerified")}</span>`,
    };
    return badges[status] || badges["pending"];
  }

  showGenerateBillModal() {
    // Validation: Check if property is selected
    if (!this.selectedProperty) {
      if (typeof showToast !== "undefined") {
        showToast(t("pleaseSelectProperty"), "error");
      } else {
        alert(t("pleaseSelectProperty"));
      }
      return;
    }

    const ub = this.currentUtilityBill;
    const fmtDate = (v) =>
      v
        ? new Date(v).toLocaleDateString("en-SG", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : null;

    // Pre-fill billing period from tracker data if available
    const prefillPeriod =
      ub && (ub.billingPeriodStart || ub.billingPeriodEnd)
        ? `${fmtDate(ub.billingPeriodStart) || "?"} - ${fmtDate(ub.billingPeriodEnd) || "?"}`
        : "";
    const prefillFee = ub ? (ub.totalAmount || 0).toFixed(2) : "0";

    const trackerBanner = ub
      ? `
      <div class="alert alert-success py-2 mb-3">
        <i class="bi bi-lightning-charge-fill text-warning me-1"></i>
        <strong>${t("spBillFound")}</strong> — ${monthName((ub.month || 1) - 1, true)} ${ub.year}
        <div class="mt-1 small">
          ${t("elec")}: <strong>$${(ub.electricityAmount || 0).toFixed(2)}</strong> &nbsp;
          ${t("water")}: <strong>$${(ub.waterAmount || 0).toFixed(2)}</strong> &nbsp;
          ${t("gasAndOthers")}: <strong>$${((ub.gasAmount || 0) + (ub.refuseAmount || 0) + (ub.otherAmount || 0)).toFixed(2)}</strong> &nbsp;
          ${t("total")}: <strong class="text-primary">$${(ub.totalAmount || 0).toFixed(2)}</strong>
        </div>
      </div>`
      : `
      <div class="alert alert-warning py-2 mb-3">
        <i class="bi bi-exclamation-triangle me-1"></i>
        ${t("noSpBillFoundMsg")}
        <a href="#" class="alert-link ms-1" onclick="event.preventDefault();bootstrap.Modal.getInstance(document.getElementById('generateBillModal'))?.hide();dashboardController.showSection('utility-bills')">${t("addBill")}</a>
      </div>`;

    const modalHtml = `
      <div class="modal fade" id="generateBillModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${t("generateBillTitle")}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="generateBillForm">
                <div class="mb-3">
                  <label class="form-label">${t("property")}</label>
                  <input type="text" class="form-control" value="${this.selectedProperty || t("noPropertySelected")}" readonly>
                </div>
                <div class="mb-3">
                  <label class="form-label">${t("monthYear")}</label>
                  <input type="text" class="form-control" value="${monthName(this.currentDate.getMonth())} ${this.currentDate.getFullYear()}" readonly>
                </div>
                ${trackerBanner}
                <div class="mb-3">
                  <label for="billingPeriod" class="form-label">${t("billingPeriodLabel")}</label>
                  <input type="text" class="form-control" id="billingPeriod" placeholder="${t("billingPeriodPlaceholder")}" value="${escapeHtml(prefillPeriod)}">
                </div>
                <div class="mb-3">
                  <label for="totalUtilityFee" class="form-label">${t("totalUtilityFeeToShare")}</label>
                  <div class="input-group">
                    <span class="input-group-text">$</span>
                    <input type="number" class="form-control" id="totalUtilityFee" name="totalUtilityFee" min="0" step="0.01" value="${prefillFee}">
                  </div>
                  <div class="form-text">${t("utilityFeeDesc")}</div>
                </div>
                <div class="alert alert-info mb-0">
                  <i class="bi bi-info-circle me-2"></i>
                  <small>${t("generateNoteText")}</small>
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t("cancel")}</button>
              ${this.currentBill ? `<button type="button" class="btn btn-warning" onclick="billManager.generateBill(true)">${t("regenerateBill")}</button>` : ""}
              <button type="button" class="btn btn-primary" onclick="billManager.generateBill()">${t("generate")}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById("generateBillModal");
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modalEl = document.getElementById("generateBillModal");
    modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove(), {
      once: true,
    });
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  async generateBill(regenerate = false) {
    try {
      const totalUtilityFee =
        parseFloat(document.getElementById("totalUtilityFee").value) || 0;
      const billingPeriod =
        document.getElementById("billingPeriod").value || "";
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      if (regenerate) {
        if (!confirm(t("regenerateBillConfirm"))) return;
        const delRes = await API.delete(
          API_CONFIG.ENDPOINTS.BILL_BY_PROPERTY_MONTH(
            this.selectedProperty,
            year,
            month,
          ),
        );
        const delResult = await delRes.json();
        if (!delResult.success) {
          showToast(t("billDeleteFailed") + ": " + delResult.error, "error");
          return;
        }
      }

      const formData = new FormData();
      formData.append("propertyId", this.selectedProperty);
      formData.append("year", year);
      formData.append("month", month);
      formData.append("totalUtilityFee", totalUtilityFee);
      formData.append("billingPeriod", billingPeriod);

      const response = await API.postFormData(
        API_CONFIG.ENDPOINTS.BILL_GENERATE,
        formData,
      );
      const result = await response.json();

      if (result.success) {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("generateBillModal"),
        );
        if (modal) modal.hide();
        await this.loadBillForCurrentMonth();
        showToast(result.message || t("billGeneratedSuccess"), "success");
      } else {
        showToast(t("billGenerateFailed") + ": " + result.error, "error");
      }
    } catch (error) {
      console.error("Error generating bill:", error);
      showToast(t("billGenerateFailed"), "error");
    }
  }

  showUpdateFeesModal() {
    if (!this.currentBill) return;

    const modalHtml = `
      <div class="modal fade" id="updateFeesModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${t("updateFeesTitle")}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="updateFeesForm">
                <div class="mb-3">
                  <label for="updateUtilityFee" class="form-label">${t("utilityFee")}</label>
                  <input type="number" class="form-control" id="updateUtilityFee" name="utilityFee" min="0" step="0.01" value="${this.currentBill.utilityFee}">
                </div>
                <div class="mb-3">
                  <label for="updateCleaningFee" class="form-label">${t("cleaningFee")}</label>
                  <input type="number" class="form-control" id="updateCleaningFee" name="cleaningFee" min="0" step="0.01" value="${this.currentBill.cleaningFee}">
                </div>
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-triangle me-2"></i>
                  ${t("updateFeesWarning")}
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t("cancel")}</button>
              <button type="button" class="btn btn-primary" onclick="billManager.updateFees()">${t("update")}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById("updateFeesModal");
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modalEl = document.getElementById("updateFeesModal");
    modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove(), {
      once: true,
    });
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  async updateFees() {
    try {
      const utilityFee =
        parseFloat(document.getElementById("updateUtilityFee").value) || 0;
      const cleaningFee =
        parseFloat(document.getElementById("updateCleaningFee").value) || 0;

      const response = await API.put(
        API_CONFIG.ENDPOINTS.BILL_UPDATE_FEES(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1,
        ),
        { utilityFee, cleaningFee },
      );

      const result = await response.json();

      if (result.success) {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("updateFeesModal"),
        );
        if (modal) modal.hide();

        await this.loadBillForCurrentMonth();

        showToast(t("feesUpdatedSuccess"), "success");
      } else {
        showToast(t("feesUpdateFailed") + ": " + result.error, "error");
      }
    } catch (error) {
      console.error("Error updating fees:", error);
      showToast(t("feesUpdateFailed"), "error");
    }
  }

  editTenantBill(tenantId) {
    if (!this.currentBill) return;

    const tenantBill = this.currentBill.tenantBills.find(
      (tb) => tb.tenantId === tenantId,
    );
    if (!tenantBill) return;

    const modalHtml = `
      <div class="modal fade" id="editTenantBillModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${t("editBillFor", { name: escapeHtml(tenantBill.tenantName) })}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <form id="editTenantBillForm">
                <div class="mb-3">
                  <label for="editBaseRental" class="form-label">${t("baseRental")}</label>
                  <input type="number" class="form-control" id="editBaseRental" name="baseRental" min="0" step="0.01" value="${tenantBill.baseRental}">
                </div>
                <div class="mb-3">
                  <label for="editUtilityFee" class="form-label">${t("utilityFee")}</label>
                  <input type="number" class="form-control" id="editUtilityFee" name="utilityFee" min="0" step="0.01" value="${tenantBill.utilityFee}">
                </div>
                <div class="mb-3">
                  <label for="editCleaningFee" class="form-label">${t("cleaningFee")}</label>
                  <input type="number" class="form-control" id="editCleaningFee" name="cleaningFee" min="0" step="0.01" value="${tenantBill.cleaningFee}">
                </div>
              </form>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${t("cancel")}</button>
              <button type="button" class="btn btn-primary" onclick="billManager.saveTenantBill('${tenantId}')">${t("save")}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const existingModal = document.getElementById("editTenantBillModal");
    if (existingModal) existingModal.remove();

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modalEl = document.getElementById("editTenantBillModal");
    modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove(), {
      once: true,
    });
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  async saveTenantBill(tenantId) {
    try {
      const baseRental =
        parseFloat(document.getElementById("editBaseRental").value) || 0;
      const utilityFee =
        parseFloat(document.getElementById("editUtilityFee").value) || 0;
      const cleaningFee =
        parseFloat(document.getElementById("editCleaningFee").value) || 0;

      const response = await API.put(
        API_CONFIG.ENDPOINTS.BILL_UPDATE_TENANT(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1,
          tenantId,
        ),
        { baseRental, utilityFee, cleaningFee },
      );

      const result = await response.json();

      if (result.success) {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("editTenantBillModal"),
        );
        if (modal) modal.hide();

        await this.loadBillForCurrentMonth();

        showToast(t("tenantBillUpdatedSuccess"), "success");
      } else {
        showToast(t("tenantBillUpdateFailed") + ": " + result.error, "error");
      }
    } catch (error) {
      console.error("Error updating tenant bill:", error);
      showToast(t("tenantBillUpdateFailed"), "error");
    }
  }

  copyUploadLink(link) {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        showToast(t("linkCopied"), "success");
      })
      .catch((err) => {
        console.error("Failed to copy link:", err);
        showToast(t("linkCopyFailed"), "error");
      });
  }

  viewUpload(screenshotUrl) {
    window.open(screenshotUrl, "_blank");
  }

  async resetTenantPayment(tenantId) {
    if (!confirm(t("resetConfirm"))) return;

    try {
      const response = await API.delete(
        API_CONFIG.ENDPOINTS.BILL_DELETE_TENANT_UPLOADS(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1,
          tenantId,
        ),
      );

      const result = await response.json();

      if (result.success) {
        await this.loadBillForCurrentMonth();
        showToast(t("paymentResetSuccess"), "success");
      } else {
        showToast(t("paymentResetFailed") + ": " + result.error, "error");
      }
    } catch (error) {
      console.error("Error resetting payment:", error);
      showToast(t("paymentResetFailed"), "error");
    }
  }

  // Keep old method name for backward compatibility
  async deleteTenantUploads(tenantId) {
    return this.resetTenantPayment(tenantId);
  }

  async bulkDeleteUploads() {
    const count = this.selectedTenants.size;
    if (count === 0) return;

    if (!confirm(t("bulkResetConfirm", { count }))) return;

    try {
      const tenantIds = Array.from(this.selectedTenants);

      const response = await API.delete(
        API_CONFIG.ENDPOINTS.BILL_DELETE_BULK_UPLOADS(
          this.selectedProperty,
          this.currentDate.getFullYear(),
          this.currentDate.getMonth() + 1,
        ),
        {
          body: JSON.stringify({ tenantIds }),
        },
      );

      const result = await response.json();

      if (result.success) {
        this.selectedTenants.clear();
        await this.loadBillForCurrentMonth();
        showToast(
          t("bulkResetSuccess", { count: result.clearedCount }),
          "success",
        );
      } else {
        showToast(t("bulkResetFailed") + ": " + result.error, "error");
      }
    } catch (error) {
      console.error("Error bulk deleting uploads:", error);
      showToast(t("errorDeletingUploads"), "error");
    }
  }

  // ── Per-tenant bill export (download image / copy text) ────────────────
  // Exported content is always Vietnamese regardless of the admin UI language,
  // since these are meant to be sent directly to tenants.

  // Full property record (address, unit, and settlementSgd/settlementVnd bank
  // details) — the cached property list doesn't carry settlement info, so this
  // is fetched dedicated, same as the utility breakdown modal does.
  async _fetchFullProperty() {
    try {
      const res = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(this.selectedProperty),
      );
      const data = await res.json();
      return data.success ? data.property : null;
    } catch {
      return null;
    }
  }

  // Bill export works whether or not an official bill has been generated:
  // if one exists, use its persisted (actually-charged) tenantBills; otherwise
  // fall back to the live dynamic preview (already computed while the property/
  // month is selected) so tenants can be selected and exported straight away.
  async _getExportSource() {
    if (this.currentBill) {
      const ctx = await this._computeExportContext();
      return { tenantBills: this.currentBill.tenantBills || [], ctx };
    }

    const preview = this._dynamicPreviewCache;
    const property = await this._fetchFullProperty();
    const monthLabel = `${this.currentDate.getMonth() + 1}/${this.currentDate.getFullYear()}`;
    const perTenant = {};
    const tenantBills = (preview?.rows || []).map((r) => {
      perTenant[r.tenantId] = {
        tenancyNote:
          r.daysStayed >= preview.daysInMonth
            ? `Ở trọn tháng (${preview.daysInMonth} ngày)`
            : `Ở ${r.daysStayed}/${preview.daysInMonth} ngày trong tháng`,
        cycles: r.cycles,
        isSubsidized: r.isSubsidized,
        avatar: r.avatar,
      };
      return {
        tenantId: r.tenantId,
        tenantName: r.tenantName,
        room: r.room,
        baseRental: r.rentAmount,
        utilityFee: r.pubAmount,
        cleaningFee: r.cleaningFee,
        totalAmount: r.total,
      };
    });

    return { tenantBills, ctx: { property, monthLabel, perTenant } };
  }

  // Gathers everything needed to render bill cards/text for the currently
  // selected tenants: property info, a Vietnamese tenancy note (prorated days
  // this month), and a single-cycle utility breakdown matching the official
  // bill's billing period (so subsidised tenants can still be shown what
  // their fair share would have been).
  async _computeExportContext() {
    const property = await this._fetchFullProperty();
    const year = this.currentDate.getFullYear();
    const monthIdx = this.currentDate.getMonth();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const monthStart = new Date(year, monthIdx, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, monthIdx, daysInMonth);
    monthEnd.setHours(0, 0, 0, 0);

    const res = await API.get(
      API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(this.selectedProperty),
    );
    const data = await res.json();
    const fullTenants = data.success ? data.tenants || [] : [];
    const tenantMap = {};
    fullTenants.forEach((ft) => {
      tenantMap[ft._id?.toString().toUpperCase()] = ft;
    });

    const { periodStart, periodEnd, periodDays } = this._resolveBillingPeriod();
    const grossUtility =
      this.currentUtilityBill?.totalAmount ?? this.currentBill.utilityFee;
    const breakdown = this._calcUtilityBreakdown(
      fullTenants,
      this.currentBill.tenantBills || [],
      grossUtility,
      this.propertySubsidy,
      periodStart || monthStart,
      periodEnd || monthEnd,
      periodDays || daysInMonth,
    );
    const rowByTenant = {};
    breakdown.rows.forEach((r) => {
      rowByTenant[r.tenantId] = r;
    });

    const cycleLabel = `${monthName(monthIdx, true)} ${year}`;
    const cyclePeriod = this.currentBill.billingPeriod || `${daysInMonth} ngày`;

    const perTenant = {};
    (this.currentBill.tenantBills || []).forEach((tb) => {
      const full = tenantMap[tb.tenantId];
      const propAssoc = full?.properties?.find(
        (p) =>
          p.propertyId?.toUpperCase() === this.selectedProperty?.toUpperCase(),
      );
      let tenancyNote = `Ở trọn tháng (${daysInMonth} ngày)`;
      if (propAssoc) {
        const info = this._computeProratedRent(
          propAssoc,
          full?.rent,
          monthStart,
          monthEnd,
          daysInMonth,
        );
        tenancyNote =
          info.daysStayed >= daysInMonth
            ? `Ở trọn tháng (${daysInMonth} ngày)`
            : `Ở ${info.daysStayed}/${daysInMonth} ngày trong tháng`;
      }
      const row = rowByTenant[tb.tenantId];
      const isSubsidized = row ? row.isSubsidized : tb.utilityFee === 0;
      perTenant[tb.tenantId] = {
        tenancyNote,
        isSubsidized,
        cycles: [
          {
            label: cycleLabel,
            period: cyclePeriod,
            share: row ? row.utilityShare : tb.utilityFee,
            charged: tb.utilityFee,
            isSubsidized,
          },
        ],
        avatar: full?.avatar || null,
      };
    });

    return { property, monthLabel: `${monthIdx + 1}/${year}`, perTenant };
  }

  // Renders the payment/settlement block shared by the card and clipboard text.
  // Returns null when the property has no bank details on file.
  _billSettlementBlocks(property) {
    const sgd = property?.settlementSgd;
    const vnd = property?.settlementVnd;
    if (!sgd?.bankName && !vnd?.bankName) return null;
    return { sgd, vnd };
  }

  static get BILL_FOOTER_NOTE_VI() {
    return "Sau khi chuyển khoản xong, vui lòng chụp màn hình ảnh xác nhận chuyển khoản và gửi lại để chủ nhà xác nhận. Cảm ơn bạn!";
  }

  // Clean, mobile-first bill card (white background, modeled on a standard
  // invoice layout), fully in Vietnamese. Rendered off-screen and rasterized
  // via html2canvas.
  _buildBillCardHtml(tenantBill, ctx) {
    const info = ctx.perTenant[tenantBill.tenantId] || {};
    const cycles = info.cycles || [];
    const fmt = (v) => `$${(v || 0).toFixed(2)}`;
    const propLine = ctx.property
      ? [ctx.property.unit, ctx.property.address].filter(Boolean).join(", ")
      : "";
    const roomLabel = tenantBill.room
      ? getRoomTypeDisplayName(tenantBill.room)
      : "—";
    const totalRawShare = cycles.reduce((s, c) => s + (c.share || 0), 0);

    // Icon + label as a single inline-flex unit so the emoji and text sit on
    // the same baseline regardless of row content — avoids the icon nudging
    // the label (and therefore the value column) out of alignment.
    const labelIcon = (icon, text) => `
      <span style="display:inline-flex;align-items:center;gap:6px;">
        <span style="font-size:15px;line-height:1;">${icon}</span>${text}
      </span>`;

    const row = (label, value, opts = {}) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;${opts.noBorder ? "" : "border-bottom:1px solid #f1f3f5;"}">
        <span style="color:#495057;font-size:14px;">${label}</span>
        <span style="font-weight:600;font-size:14px;color:${opts.color || "#1a1a1a"};">${value}</span>
      </div>`;

    const cycleLines =
      cycles.length > 1
        ? cycles
            .map(
              (c) => `
        <div style="display:flex;justify-content:space-between;margin-top:5px;padding-left:10px;font-size:12px;color:#868e96;">
          <span>Kỳ ${escapeHtml(c.label)} (${escapeHtml(c.period)})</span>
          <span style="${c.isSubsidized ? "text-decoration:line-through;" : ""}">${fmt(c.share)}</span>
        </div>`,
            )
            .join("")
        : cycles[0]?.period
          ? `
        <div style="margin-top:5px;padding-left:10px;font-size:12px;color:#868e96;">Kỳ ${escapeHtml(cycles[0].period)}</div>`
          : "";

    const utilitySection = `
      <div style="padding:11px 0;border-bottom:1px solid #f1f3f5;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="color:#495057;font-size:14px;">${labelIcon("⚡", "Tiền điện nước")}</span>
          <span style="font-weight:600;font-size:14px;color:${info.isSubsidized ? "#2b8a3e" : "#1a1a1a"};">${fmt(tenantBill.utilityFee)}</span>
        </div>
        ${cycleLines}
        ${info.isSubsidized ? `<div style="margin-top:5px;padding-left:10px;font-size:12px;color:#2b8a3e;font-style:italic;">Được hỗ trợ 100% — tiết kiệm ${fmt(totalRawShare)}</div>` : ""}
      </div>`;

    const cleaningSection = tenantBill.cleaningFee
      ? row(labelIcon("🧹", "Tiền vệ sinh"), fmt(tenantBill.cleaningFee))
      : "";

    // Deliberately understated — bank details are reference info, not the
    // headline of the bill, so this sits small and muted below the total.
    const settlement = this._billSettlementBlocks(ctx.property);
    const settlementLine = (label, s) => `
      <div style="margin-top:3px;">
        <span style="color:#adb5bd;">${label}</span> ·
        ${[s.bankName, s.accountNumber, s.accountHolderName].filter(Boolean).map(escapeHtml).join(" · ")}
      </div>`;
    const paymentSection = settlement
      ? `
      <div style="background:#f8f9fa;padding:12px 24px;border-top:1px solid #f1f3f5;">
        <div style="font-size:10px;letter-spacing:0.5px;color:#adb5bd;text-transform:uppercase;font-weight:600;margin-bottom:4px;">Thông tin thanh toán</div>
        <div style="font-size:12px;color:#868e96;line-height:1.5;">
          ${settlement.sgd?.bankName ? settlementLine("SGD", settlement.sgd) : ""}
          ${settlement.vnd?.bankName ? settlementLine("VND", settlement.vnd) : ""}
        </div>
      </div>`
      : "";

    // App's own house logo mark (matches the sidebar brand icon), inlined as
    // SVG in black rather than the bi-house-door-fill webfont glyph, since
    // icon fonts don't rasterize reliably through html2canvas.
    const logoSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 16 16" fill="#1a1a1a">
        <path d="M6.5 14.5v-3.505c0-.245.25-.495.5-.495h2c.25 0 .5.25.5.5v3.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5"/>
      </svg>`;

    return `
      <div style="width:380px;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.10);border:1px solid #e9ecef;">
        <div style="padding:20px 24px 16px;border-bottom:1px solid #f1f3f5;">
          <div style="display:flex;align-items:center;gap:9px;">
            ${logoSvg}
            <div style="min-width:0;">
              <div style="font-size:11px;letter-spacing:0.6px;color:#868e96;text-transform:uppercase;font-weight:700;">Hóa đơn tháng ${ctx.monthLabel}</div>
              ${propLine ? `<div style="font-size:13px;color:#495057;font-weight:600;margin-top:1px;">${escapeHtml(propLine)}</div>` : ""}
            </div>
          </div>
        </div>

        <div style="padding:18px 24px 0;display:flex;align-items:flex-start;gap:12px;">
          ${this._avatarHtml(tenantBill.tenantName, info.avatar, 44, 17)}
          <div style="min-width:0;">
            <div style="font-size:21px;font-weight:700;color:#1a1a1a;line-height:1.3;">${escapeHtml(tenantBill.tenantName)}</div>
            <div style="font-size:13px;color:#495057;margin-top:4px;">Phòng: ${escapeHtml(roomLabel)}</div>
            <div style="font-size:13px;color:#868e96;margin-top:2px;">${escapeHtml(info.tenancyNote || "")}</div>
          </div>
        </div>

        <div style="padding:16px 24px 0;">
          ${row("Tiền thuê phòng", fmt(tenantBill.baseRental))}
          ${utilitySection}
          ${cleaningSection}
          <div style="margin-top:14px;padding-top:16px;padding-bottom:4px;border-top:3px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;font-weight:700;color:#868e96;text-transform:uppercase;letter-spacing:0.6px;">Tổng cộng</span>
            <span style="font-size:28px;font-weight:800;color:#1a1a1a;">${fmt(tenantBill.totalAmount)}</span>
          </div>
        </div>

        ${paymentSection}

        <div style="padding:16px 24px 20px;">
          <div style="font-size:12px;color:#868e96;line-height:1.5;">📸 ${BillManagementComponent.BILL_FOOTER_NOTE_VI}</div>
        </div>
      </div>`;
  }

  // Plain-text equivalent of the bill card, for clipboard copy.
  _buildBillBreakdownTextVi(tenantBill, ctx) {
    const info = ctx.perTenant[tenantBill.tenantId] || {};
    const cycles = info.cycles || [];
    const fmt = (v) => `$${(v || 0).toFixed(2)}`;
    const propLine = ctx.property
      ? [ctx.property.unit, ctx.property.address].filter(Boolean).join(", ")
      : "";
    const roomLabel = tenantBill.room
      ? getRoomTypeDisplayName(tenantBill.room)
      : "—";
    const totalRawShare = cycles.reduce((s, c) => s + (c.share || 0), 0);

    const lines = [
      `HÓA ĐƠN THÁNG ${ctx.monthLabel}`,
      propLine,
      "",
      `Người thuê: ${tenantBill.tenantName}`,
      `Phòng: ${roomLabel}`,
      `Thời gian ở: ${info.tenancyNote || ""}`,
      "",
      `Tiền thuê phòng: ${fmt(tenantBill.baseRental)}`,
      `Tiền điện nước: ${fmt(tenantBill.utilityFee)}`,
    ];
    if (cycles.length > 1) {
      cycles.forEach((c) =>
        lines.push(`  Kỳ ${c.label} (${c.period}): ${fmt(c.share)}`),
      );
    } else if (cycles[0]?.period) {
      lines.push(`  Kỳ ${cycles[0].period}`);
    }
    if (info.isSubsidized)
      lines.push(`  (Được hỗ trợ 100% — tiết kiệm ${fmt(totalRawShare)})`);
    if (tenantBill.cleaningFee)
      lines.push(`Tiền vệ sinh: ${fmt(tenantBill.cleaningFee)}`);
    lines.push("", `TỔNG CỘNG: ${fmt(tenantBill.totalAmount)}`);

    const settlement = this._billSettlementBlocks(ctx.property);
    if (settlement) {
      lines.push("", "THÔNG TIN THANH TOÁN");
      const fmtSettlement = (label, s) =>
        `${label}: ${[s.bankName, s.accountNumber, s.accountHolderName].filter(Boolean).join(" - ")}`;
      if (settlement.sgd?.bankName)
        lines.push(fmtSettlement("SGD", settlement.sgd));
      if (settlement.vnd?.bankName)
        lines.push(fmtSettlement("VND", settlement.vnd));
    }

    lines.push("", `📸 ${BillManagementComponent.BILL_FOOTER_NOTE_VI}`);

    return lines.filter((l) => l !== undefined).join("\n");
  }

  // Rasterizes a card's HTML off-screen into a PNG blob via html2canvas.
  async _renderCardToBlob(cardHtml) {
    if (typeof html2canvas === "undefined")
      throw new Error(t("html2canvasNotLoaded"));
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.top = "-10000px";
    holder.style.left = "0";
    holder.style.zIndex = "-1";
    // Padding gives the card's drop shadow room to render — html2canvas
    // captures exactly the target element's own box, so shadow bleed beyond
    // it would otherwise get clipped off.
    holder.style.padding = "40px";
    holder.style.background = "#ffffff";
    holder.style.display = "inline-block";
    holder.innerHTML = cardHtml;
    document.body.appendChild(holder);
    try {
      const canvas = await html2canvas(holder, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        );
      });
    } finally {
      holder.remove();
    }
  }

  async downloadSelectedBills() {
    if (this.selectedTenants.size === 0) return;

    const btn = document.getElementById("billDownloadSelectedBtn");
    const originalHtml = btn ? btn.innerHTML : null;
    if (btn) {
      // Lock in the current rendered width before swapping to a bare spinner,
      // otherwise the shorter content shrinks the button and shifts the rest
      // of the toolbar.
      btn.style.width = `${btn.getBoundingClientRect().width}px`;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    }

    try {
      const { tenantBills, ctx } = await this._getExportSource();
      const targets = tenantBills.filter((tb) =>
        this.selectedTenants.has(tb.tenantId),
      );

      // Rendering each tenant's card (avatar fetch + html2canvas) is fully
      // independent of the others, so do it all in parallel rather than one
      // at a time. Only the actual browser download trigger (a.click()) is
      // kept sequential-with-a-small-stagger afterwards, since firing many
      // downloads in the same tick can get blocked by the browser as a
      // "site is trying to download multiple files" popup.
      const renderResults = await Promise.allSettled(
        targets.map(async (tb) => {
          // Inline the avatar as a data: URI before rendering — a remote
          // <img> (even crossorigin="anonymous") still taints the canvas on
          // export whenever its actual source lacks CORS headers.
          const info = ctx.perTenant[tb.tenantId];
          let avatar = info?.avatar || null;
          if (avatar && !avatar.startsWith("data:")) {
            const optimized =
              typeof ImageUtils !== "undefined"
                ? ImageUtils.getOptimizedImageUrl(avatar, "small")
                : avatar;
            avatar = await this._avatarDataUri(optimized);
          }
          // Build the card from a per-tenant ctx copy so concurrent renders
          // never share/clobber each other's resolved avatar.
          const tenantCtx = {
            ...ctx,
            perTenant: { ...ctx.perTenant, [tb.tenantId]: { ...info, avatar } },
          };

          const cardHtml = this._buildBillCardHtml(tb, tenantCtx);
          const blob = await this._renderCardToBlob(cardHtml);
          const safeName = (tb.tenantName || tb.tenantId)
            .normalize("NFC")
            .replace(/[^\p{L}\p{N} _-]/gu, "")
            .trim()
            .replace(/\s+/g, "_");
          const fileName = `Bill_${safeName}_${ctx.monthLabel.replace("/", "-")}.png`;
          return { tb, blob, fileName };
        }),
      );

      let succeeded = 0;
      for (let i = 0; i < renderResults.length; i++) {
        const result = renderResults[i];
        if (result.status === "rejected") {
          console.error(
            `[BillManagement] failed to render bill for ${targets[i].tenantName}:`,
            result.reason,
          );
          continue;
        }

        const { blob, fileName } = result.value;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        succeeded++;

        if (i < renderResults.length - 1)
          await new Promise((r) => setTimeout(r, 250));
      }

      if (succeeded === targets.length) {
        showToast(t("billDownloadSuccess", { count: succeeded }), "success");
      } else if (succeeded > 0) {
        showToast(
          t("billDownloadPartial", { succeeded, total: targets.length }),
          "warning",
        );
      } else {
        showToast(t("billDownloadFailed"), "error");
      }
    } catch (err) {
      console.error("[BillManagement] download bills error:", err);
      showToast(t("billDownloadFailed"), "error");
    } finally {
      if (btn) {
        btn.disabled = this.selectedTenants.size === 0;
        btn.innerHTML = originalHtml;
        btn.style.width = "";
      }
    }
  }

  async copySelectedBillBreakdown() {
    if (this.selectedTenants.size === 0) return;

    try {
      const { tenantBills, ctx } = await this._getExportSource();
      const targets = tenantBills.filter((tb) =>
        this.selectedTenants.has(tb.tenantId),
      );
      const text = targets
        .map((tb) => this._buildBillBreakdownTextVi(tb, ctx))
        .join("\n\n" + "─".repeat(28) + "\n\n");

      await navigator.clipboard.writeText(text);
      showToast(t("billCopySuccess", { count: targets.length }), "success");
    } catch (err) {
      console.error("[BillManagement] copy breakdown error:", err);
      showToast(t("billCopyFailed"), "error");
    }
  }

  // ── Utility Breakdown ────────────────────────────────────────────────────

  async showUtilityBreakdownModal() {
    if (!this.currentBill) return;

    // Show modal immediately with loading state
    this._renderBreakdownModal(`
      <div class="text-center py-5">
        <span class="spinner-border text-primary mb-3"></span>
        <p class="text-muted">${t("loadingTenantData")}</p>
      </div>`);

    try {
      // Resolve billing period dates
      const { periodStart, periodEnd, periodDays } =
        this._resolveBillingPeriod();

      // Fetch tenant data, property info, and exchange rate in parallel
      const dateStr = this.currentDate.toISOString().split("T")[0];
      const [tenantRes, propRes, rateRes] = await Promise.all([
        API.get(API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(this.selectedProperty)),
        API.get(API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(this.selectedProperty)),
        API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_AT(dateStr)),
      ]);
      const data = await tenantRes.json();
      const propData = await propRes.json();
      const rateData = await rateRes.json().catch(() => null);
      const exchangeRate =
        rateData?.success && rateData?.rate?.rate ? rateData.rate.rate : null;
      if (!data.success)
        throw new Error(data.error || "Failed to load tenants");

      const landlordSubsidy = propData.property?.subsidizedPub || 0;
      const grossUtility =
        this.currentUtilityBill?.totalAmount ?? this.currentBill.utilityFee;

      const breakdown = this._calcUtilityBreakdown(
        data.tenants || [],
        this.currentBill.tenantBills || [],
        grossUtility,
        landlordSubsidy,
        periodStart,
        periodEnd,
        periodDays,
      );

      this._renderBreakdownModal(
        this._buildBreakdownHtml(
          breakdown,
          periodStart,
          periodEnd,
          periodDays,
          propData.property,
          exchangeRate,
        ),
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
      const s = new Date(ub.billingPeriodStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(ub.billingPeriodEnd);
      e.setHours(0, 0, 0, 0);
      const d = Math.round((e - s) / 864e5) + 1;
      return { periodStart: s, periodEnd: e, periodDays: d };
    }
    // Priority 2: parse billingPeriod string e.g. "03 Mar 2026 - 02 Apr 2026"
    const bp = this.currentBill?.billingPeriod;
    if (bp) {
      const parts = bp.split(/\s*[-–—]\s*/);
      if (parts.length === 2) {
        const s = new Date(parts[0]);
        s.setHours(0, 0, 0, 0);
        const e = new Date(parts[1]);
        e.setHours(0, 0, 0, 0);
        if (!isNaN(s) && !isNaN(e)) {
          const d = Math.round((e - s) / 864e5) + 1;
          return { periodStart: s, periodEnd: e, periodDays: d };
        }
      }
    }
    return { periodStart: null, periodEnd: null, periodDays: null };
  }

  _calcUtilityBreakdown(
    fullTenants,
    tenantBills,
    grossUtility,
    landlordSubsidy,
    periodStart,
    periodEnd,
    periodDays,
  ) {
    const netUtility = Math.max(0, grossUtility - landlordSubsidy);
    // Build lookup: _id (uppercased) → full tenant object
    // tenantBills[].tenantId is stored uppercase (Bill schema uppercase:true),
    // but t._id.toString() returns lowercase hex — so we must normalise to the same case.
    const tenantMap = {};
    fullTenants.forEach((t) => {
      tenantMap[t._id?.toString().toUpperCase()] = t;
    });

    // Split gross utility into per-type amounts if the SP Group bill has breakdowns.
    // Falls back to treating everything as a single pool when no split is available.
    const ub = this.currentUtilityBill;
    const hasTypeBreakdown =
      ub &&
      (ub.electricityAmount ||
        ub.waterAmount ||
        ub.gasAmount ||
        ub.refuseAmount ||
        ub.otherAmount);
    // Net-scale each component proportionally so they still sum to netUtility
    const grossElec = hasTypeBreakdown ? ub.electricityAmount || 0 : 0;
    const grossWater = hasTypeBreakdown ? ub.waterAmount || 0 : 0;
    const grossGas = hasTypeBreakdown
      ? (ub.gasAmount || 0) + (ub.refuseAmount || 0) + (ub.otherAmount || 0)
      : 0;
    const grossTyped = grossElec + grossWater + grossGas;
    const scaleFactor =
      grossTyped > 0 && hasTypeBreakdown ? netUtility / grossTyped : 1;
    const netElec = hasTypeBreakdown ? grossElec * scaleFactor : 0;
    const netWater = hasTypeBreakdown ? grossWater * scaleFactor : 0;
    const netGas = hasTypeBreakdown ? grossGas * scaleFactor : 0;
    // Any residual (rounding) stays in the untyped pool
    const netUntyped = hasTypeBreakdown
      ? Math.max(0, netUtility - netElec - netWater - netGas)
      : netUtility;

    const msDay = 864e5;

    const daysOverlap = (s1, e1, s2, e2) => {
      const os = Math.max(+s1, +s2);
      const oe = Math.min(+e1, +e2);
      if (oe < os) return 0;
      return Math.round((oe - os) / msDay) + 1;
    };

    const rows = tenantBills
      .filter((tb) => tb.room)
      .map((tb) => {
        const full = tenantMap[tb.tenantId];

        // Determine subsidized: prefer full tenant flag, fall back to $0 fee
        const isSubsidized = full?.isUtilitySubsidized ?? tb.utilityFee === 0;

        let tenantPeriodDays = periodDays; // days within billing period
        let awayDays = 0;
        let clampStart = periodStart;
        let clampEnd = periodEnd;
        let note = "";

        if (full && periodStart && periodEnd) {
          const propAssoc = full.properties?.find(
            (p) =>
              p.propertyId?.toUpperCase() ===
              this.selectedProperty?.toUpperCase(),
          );

          if (!propAssoc) {
            // Tenant is in the bill but has no property association record in their profile
            // (data may be stale or property ID format differs) — include with full period days
            tenantPeriodDays = periodDays;
          } else {
            // Clamp tenant's stay (movein–moveout) to billing period
            const movein = propAssoc.moveinDate
              ? new Date(propAssoc.moveinDate)
              : periodStart;
            const moveout = propAssoc.moveoutDate
              ? new Date(propAssoc.moveoutDate)
              : periodEnd;
            movein.setHours(0, 0, 0, 0);
            moveout.setHours(0, 0, 0, 0);

            clampStart = new Date(Math.max(+movein, +periodStart));
            clampEnd = new Date(Math.min(+moveout, +periodEnd));

            if (+clampEnd < +clampStart) {
              tenantPeriodDays = 0;
              note = t("notInPropertyPeriod");
            } else {
              tenantPeriodDays =
                Math.round((+clampEnd - +clampStart) / msDay) + 1;

              // Mid-period move-in note
              if (+movein > +periodStart) {
                const d = Math.round((+movein - +periodStart) / msDay);
                const moveinLabel = movein.toLocaleDateString("en-SG", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                note = t("movedInLate", { days: d, date: moveinLabel });
              }
              // Mid-period move-out note
              if (+moveout < +periodEnd) {
                const d = Math.round((+periodEnd - +moveout) / msDay);
                note += (note ? "; " : "") + t("movedOutEarly", { days: d });
              }
            }

            // Sum away-day leave plans overlapping [clampStart, clampEnd]
            if (tenantPeriodDays > 0) {
              for (const lp of propAssoc.leavePlans || []) {
                const lpS = new Date(lp.startDate);
                lpS.setHours(0, 0, 0, 0);
                const lpE = new Date(lp.endDate);
                lpE.setHours(0, 0, 0, 0);
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
          note = t("equalDivision");
        }

        const presentDays = Math.max(0, tenantPeriodDays - awayDays);

        return {
          tenantId: tb.tenantId,
          tenantName: tb.tenantName,
          room: tb.room,
          isSubsidized,
          usesElectricity: full?.usesElectricity ?? true,
          usesWater: full?.usesWater ?? true,
          usesGas: full?.usesGas ?? true,
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
      const billedIds = new Set(rows.map((r) => r.tenantId));
      for (const ft of fullTenants) {
        const ftId = ft._id?.toString().toUpperCase();
        if (!ftId || billedIds.has(ftId)) continue;
        const propAssoc = ft.properties?.find(
          (p) =>
            p.propertyId?.toUpperCase() ===
            this.selectedProperty?.toUpperCase(),
        );
        if (!propAssoc) continue;
        const room = propAssoc.roomType || propAssoc.room || null;
        if (!room) continue;
        const movein = propAssoc.moveinDate
          ? new Date(propAssoc.moveinDate)
          : periodStart;
        const moveout = propAssoc.moveoutDate
          ? new Date(propAssoc.moveoutDate)
          : periodEnd;
        movein.setHours(0, 0, 0, 0);
        moveout.setHours(0, 0, 0, 0);
        const cs = new Date(Math.max(+movein, +periodStart));
        const ce = new Date(Math.min(+moveout, +periodEnd));
        if (+ce < +cs) continue; // no overlap with billing period
        const tpd = Math.round((+ce - +cs) / msDay) + 1;
        let extraAwayDays = 0;
        for (const lp of propAssoc.leavePlans || []) {
          const lpS = new Date(lp.startDate);
          lpS.setHours(0, 0, 0, 0);
          const lpE = new Date(lp.endDate);
          lpE.setHours(0, 0, 0, 0);
          extraAwayDays += daysOverlap(cs, ce, lpS, lpE);
        }
        const presentDays = Math.max(0, tpd - extraAwayDays);
        let note = t("movedOutNoBill");
        if (+movein > +periodStart) {
          const d = Math.round((+movein - +periodStart) / msDay);
          const moveinLabel = movein.toLocaleDateString("en-SG", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          note = t("movedInLate", { days: d, date: moveinLabel }) + "; " + note;
        }
        rows.push({
          tenantId: ftId,
          tenantName: ft.name || ft.fullName || ft.email || ftId,
          room,
          isSubsidized: ft.isUtilitySubsidized ?? false,
          usesElectricity: ft.usesElectricity ?? true,
          usesWater: ft.usesWater ?? true,
          usesGas: ft.usesGas ?? true,
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
    const totalPD = rows.reduce((s, r) => s + r.presentDays, 0);
    const totalPD_elec = hasTypeBreakdown
      ? rows
          .filter((r) => r.usesElectricity)
          .reduce((s, r) => s + r.presentDays, 0)
      : 0;
    const totalPD_water = hasTypeBreakdown
      ? rows.filter((r) => r.usesWater).reduce((s, r) => s + r.presentDays, 0)
      : 0;
    const totalPD_gas = hasTypeBreakdown
      ? rows.filter((r) => r.usesGas).reduce((s, r) => s + r.presentDays, 0)
      : 0;

    // Overall rate used for the "per day" label in the UI (untyped total / total days)
    const ratePerDay = totalPD > 0 ? netUtility / totalPD : 0;

    rows.forEach((row) => {
      const pd = row.presentDays;
      const shareElec =
        hasTypeBreakdown && row.usesElectricity && totalPD_elec > 0
          ? netElec * (pd / totalPD_elec)
          : 0;
      const shareWater =
        hasTypeBreakdown && row.usesWater && totalPD_water > 0
          ? netWater * (pd / totalPD_water)
          : 0;
      const shareGas =
        hasTypeBreakdown && row.usesGas && totalPD_gas > 0
          ? netGas * (pd / totalPD_gas)
          : 0;
      // Untyped pool (either no breakdown, or residual rounding): divide equally among all tenants
      const shareUntyped = totalPD > 0 ? netUntyped * (pd / totalPD) : 0;
      row.utilityShare = shareElec + shareWater + shareGas + shareUntyped;
      // Store per-type breakdown for display
      row._shareElec = shareElec;
      row._shareWater = shareWater;
      row._shareGas = shareGas;
      // notBilled tenants: show their calculated share but don't count as charged (bill not issued)
      row.chargedAmount =
        row.isSubsidized || row.notBilled ? 0 : row.utilityShare;
    });

    const totalPersonDays = totalPD;
    const totalCharged = rows.reduce((s, r) => s + r.chargedAmount, 0);
    const businessAbsorbs = rows
      .filter((r) => r.isSubsidized)
      .reduce((s, r) => s + r.utilityShare, 0);
    const notBilledAbsorbs = rows
      .filter((r) => r.notBilled && !r.isSubsidized)
      .reduce((s, r) => s + r.utilityShare, 0);

    return {
      rows,
      totalPersonDays,
      ratePerDay,
      totalCharged,
      businessAbsorbs,
      notBilledAbsorbs,
      grossUtility,
      landlordSubsidy,
      netUtility,
      hasTypeBreakdown,
      netElec,
      netWater,
      netGas,
      netUntyped,
    };
  }

  _buildBreakdownHtml(
    bd,
    periodStart,
    periodEnd,
    periodDays,
    propInfo,
    exchangeRate,
  ) {
    const {
      rows,
      totalPersonDays,
      ratePerDay,
      totalCharged,
      businessAbsorbs,
      notBilledAbsorbs,
      grossUtility,
      landlordSubsidy,
      netUtility,
      hasTypeBreakdown,
      netElec,
      netWater,
      netGas,
    } = bd;
    const fmtDate = (v) =>
      v
        ? new Date(v).toLocaleDateString("en-SG", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "—";
    const fmtAmt = (v) => `$${v.toFixed(2)}`;
    const getRoomLabel = (room) => {
      if (!room) return "—";
      if (typeof getRoomTypeDisplayName === "function")
        return getRoomTypeDisplayName(room);
      return room;
    };

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const periodLabel =
      periodStart && periodEnd
        ? `${fmtDate(periodStart)} – ${fmtDate(periodEnd)} (${periodDays} ${t("days")})`
        : t("billingPeriodNotSet");

    const noPeriod = !periodStart;

    // Sort rows so tenants sharing the same room appear together
    const sortedRows = [...rows].sort((a, b) =>
      (a.room || "").localeCompare(b.room || ""),
    );

    // CSS Grid "table": header, every row, and the totals row all share one
    // GRID_COLUMNS template (7 tracks normally, 4 when there's no billing
    // period and the Period/Away/Present Days columns are dropped), so
    // column alignment comes from the grid definition itself rather than
    // native <table> layout.
    const GRID_COLUMNS = noPeriod
      ? "minmax(160px,2fr) minmax(100px,1fr) minmax(120px,1fr) minmax(110px,1fr)"
      : "minmax(160px,2fr) minmax(100px,1fr) 70px 70px 70px minmax(120px,1fr) minmax(110px,1fr)";
    const gridCell = (content, opts = {}) => `
      <div style="padding:7px 10px;${opts.align ? `text-align:${opts.align};` : ""}${opts.style || ""}">${content}</div>`;

    const tableRows = sortedRows
      .map((r, i) => {
        const shareTypeLines = hasTypeBreakdown
          ? [
              r.usesElectricity && r._shareElec > 0.005
                ? `⚡ ${fmtAmt(r._shareElec)}`
                : null,
              r.usesWater && r._shareWater > 0.005
                ? `💧 ${fmtAmt(r._shareWater)}`
                : null,
              r.usesGas && r._shareGas > 0.005
                ? `🔥 ${fmtAmt(r._shareGas)}`
                : null,
            ].filter(Boolean)
          : [];
        const shareCell = noPeriod
          ? fmtAmt(r.utilityShare)
          : `${fmtAmt(r.utilityShare)}<br><span style="font-size:0.72rem;color:#6c757d;">${r.presentDays}d × ${fmtAmt(ratePerDay)}/d</span>${
              shareTypeLines.length
                ? `<br><span style="font-size:0.68rem;color:#868e96;">${shareTypeLines.join(" · ")}</span>`
                : ""
            }`;
        const daysCellsHtml = noPeriod
          ? ""
          : gridCell(r.tenantPeriodDays, { align: "center" }) +
            gridCell(
              r.awayDays > 0
                ? `<span style="color:#dc3545;">−${r.awayDays}</span>`
                : "0",
              { align: "center" },
            ) +
            gridCell(r.presentDays, { align: "center", style: "font-weight:600;" });
        const subsidyBadge = r.isSubsidized
          ? `<span style="background:#fff3cd;color:#856404;border-radius:4px;padding:1px 6px;font-size:0.72rem;">${t("subsidisedBadge")}</span>`
          : "";
        const notBilledBadge = r.notBilled
          ? `<span style="background:#f8d7da;color:#842029;border-radius:4px;padding:1px 6px;font-size:0.72rem;">${t("notBilledBadge")}</span>`
          : "";
        const chargedStyle = r.isSubsidized
          ? "color:#6c757d;text-decoration:line-through;"
          : r.notBilled
            ? "color:#6c757d;font-style:italic;"
            : "font-weight:700;color:#0d6efd;";
        const noteCell = r.note
          ? `<br><span style="font-size:0.7rem;color:#6c757d;">${escapeHtml(r.note)}</span>`
          : "";

        return `<div style="display:grid;grid-template-columns:${GRID_COLUMNS};align-items:center;border-bottom:1px solid #dee2e6;${r.notBilled ? "opacity:0.8;" : ""}">
        ${gridCell(`${i + 1}. ${escapeHtml(r.tenantName)}${noteCell}`, { style: "font-weight:600;" })}
        ${gridCell(escapeHtml(getRoomLabel(r.room)))}
        ${daysCellsHtml}
        ${gridCell(shareCell, { align: "right" })}
        ${gridCell(
          `<span style="${chargedStyle}">${r.notBilled ? fmtAmt(r.utilityShare) : fmtAmt(r.chargedAmount)}</span>
          ${r.isSubsidized ? "<br>" + subsidyBadge : ""}
          ${r.notBilled ? "<br>" + notBilledBadge : ""}`,
          { align: "right" },
        )}
      </div>`;
      })
      .join("");

    const subsidizedCount = rows.filter((r) => r.isSubsidized).length;
    const awayCount = rows.filter((r) => r.awayDays > 0).length;

    const typeBreakNote = hasTypeBreakdown
      ? `<p style="margin:4px 0;font-size:0.88rem;">⚡ ${fmtAmt(netElec)} ÷ eligible tenants &nbsp;·&nbsp; 💧 ${fmtAmt(netWater)} ÷ eligible tenants &nbsp;·&nbsp; 🔥 ${fmtAmt(netGas)} ÷ eligible tenants</p>`
      : "";
    const methodNote = noPeriod
      ? `<p style="margin:4px 0;color:#856404;">${t("noBillingPeriodNote")}</p>`
      : `<p style="margin:4px 0;">${t("formula")} <strong>${fmtAmt(netUtility)} ÷ ${totalPersonDays} ${t("personDays")} = ${fmtAmt(ratePerDay)}${t("perPersonDay")}</strong></p>
         ${typeBreakNote}
         ${landlordSubsidy > 0 ? `<p style="margin:4px 0;">${t("landlordSubsidyNote", { amount: fmtAmt(landlordSubsidy) })}</p>` : ""}
         ${subsidizedCount > 0 ? `<p style="margin:4px 0;">${t("subsidisedTenantsNote", { count: subsidizedCount, amount: fmtAmt(businessAbsorbs) })}</p>` : ""}
         ${awayCount > 0 ? `<p style="margin:4px 0;">${t("awayNote")}</p>` : ""}`;

    // Settlement info section (included in print area / export)
    const sgd = propInfo?.settlementSgd;
    const vnd = propInfo?.settlementVnd;
    const settlementHtml =
      sgd?.bankName || vnd?.bankName
        ? `
      <div style="padding:14px 20px;border-top:1px solid #dee2e6;background:#f8f9fa;">
        <div style="font-size:0.95rem;font-weight:700;margin-bottom:10px;color:#495057;">
          <i class="bi bi-bank me-1"></i>${t("settlementInfo")}
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          ${
            sgd?.bankName
              ? `
          <div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:10px 16px;min-width:220px;flex:1;">
            <div style="font-size:0.82rem;color:#6c757d;margin-bottom:4px;">SGD</div>
            <div style="font-size:0.95rem;font-weight:600;">${escapeHtml(sgd.bankName)}</div>
            ${sgd.accountNumber ? `<div style="font-size:0.95rem;">${escapeHtml(sgd.accountNumber)}</div>` : ""}
            ${sgd.accountHolderName ? `<div style="font-size:0.88rem;color:#495057;">${escapeHtml(sgd.accountHolderName)}</div>` : ""}
          </div>`
              : ""
          }
          ${
            vnd?.bankName
              ? `
          <div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:10px 16px;min-width:220px;flex:1;">
            <div style="font-size:0.82rem;color:#6c757d;margin-bottom:4px;">VND
              ${exchangeRate ? `<span style="margin-left:8px;background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:1px 7px;font-size:0.8rem;font-weight:600;">1 SGD = ${Number(exchangeRate).toLocaleString("vi-VN")} VND</span>` : ""}
            </div>
            <div style="font-size:0.95rem;font-weight:600;">${escapeHtml(vnd.bankName)}</div>
            ${vnd.accountNumber ? `<div style="font-size:0.95rem;">${escapeHtml(vnd.accountNumber)}</div>` : ""}
            ${vnd.accountHolderName ? `<div style="font-size:0.88rem;color:#495057;">${escapeHtml(vnd.accountHolderName)}</div>` : ""}
          </div>`
              : ""
          }
        </div>
      </div>`
        : "";

    return `
      <div id="utilityBreakdownPrintArea" style="font-family:'Noto Serif',serif;padding:20px;background:#fff;">

        <!-- Header -->
        <div style="border-bottom:3px solid #0d6efd;padding-bottom:10px;margin-bottom:12px;">
          <h5 style="margin:0;color:#0d6efd;font-size:1.15rem;">
            ⚡ ${t("breakdownHeading", { month: monthName(month), year })}
          </h5>
          <div style="color:#495057;font-size:0.95rem;margin-top:4px;">
            ${t("property")}: <strong>${escapeHtml(
              propInfo
                ? [
                    propInfo.unit,
                    propInfo.address,
                    propInfo.postcode ? `S(${propInfo.postcode})` : "",
                  ]
                    .filter(Boolean)
                    .join(", ")
                : this.selectedProperty,
            )}</strong> &nbsp;|&nbsp;
            ${t("billingPeriod")}: <strong>${periodLabel}</strong>
          </div>
          <div style="color:#495057;font-size:0.95rem;margin-top:2px;">
            ${t("spGroupBill")}: <strong>${fmtAmt(grossUtility)}</strong>
            ${landlordSubsidy > 0 ? `&nbsp;−&nbsp;${t("landlordSubsidy")}: <strong>${fmtAmt(landlordSubsidy)}</strong>&nbsp;=&nbsp;<strong style="color:#198754;">${fmtAmt(netUtility)} ${t("toDistribute")}</strong>` : ""}
          </div>
        </div>

        <!-- Method note -->
        <div style="background:#f8f9fa;border-left:4px solid #0d6efd;padding:8px 14px;margin-bottom:12px;font-size:0.92rem;border-radius:0 4px 4px 0;">
          <strong>${t("howItsCalculated")}</strong><br>
          ${methodNote}
        </div>

        <!-- Table -->
        <div style="font-size:0.95rem;">
          <div style="display:grid;grid-template-columns:${GRID_COLUMNS};background:#f8f9fa;border-bottom:2px solid #dee2e6;font-size:0.9rem;">
            ${gridCell(t("tenant"))}
            ${gridCell(t("room"))}
            ${
              noPeriod
                ? ""
                : gridCell(t("periodDaysHeader").replace("\n", "<br>"), { align: "center" }) +
                  gridCell(t("awayDaysHeader").replace("\n", "<br>"), { align: "center" }) +
                  gridCell(t("presentDaysHeader").replace("\n", "<br>"), { align: "center" })
            }
            ${gridCell(t("calcShare"), { align: "right" })}
            ${gridCell(t("charged"), { align: "right" })}
          </div>
          ${tableRows}
          <!-- Totals row -->
          <div style="display:grid;grid-template-columns:${GRID_COLUMNS};align-items:center;background:#f8f9fa;border-top:2px solid #dee2e6;">
            ${gridCell(t("totalRow"), { style: "font-weight:700;grid-column:span 2;" })}
            ${
              noPeriod
                ? ""
                : gridCell("—", { align: "center", style: "font-weight:700;" }) +
                  gridCell("—", { align: "center", style: "font-weight:700;" }) +
                  gridCell(`${totalPersonDays}d`, { align: "center", style: "font-weight:700;" })
            }
            ${gridCell(fmtAmt(netUtility), { align: "right", style: "font-weight:700;" })}
            ${gridCell(fmtAmt(totalCharged), { align: "right", style: "font-weight:700;color:#0d6efd;" })}
          </div>
        </div>

        <!-- Footer summary -->
        <div style="margin-top:12px;display:flex;gap:14px;flex-wrap:wrap;font-size:0.92rem;">
          <div style="background:#d1ecf1;border-radius:6px;padding:7px 14px;">
            <strong>${t("totalBilledToTenants")}</strong> ${fmtAmt(totalCharged)}
          </div>
          ${
            landlordSubsidy > 0 || businessAbsorbs > 0.005
              ? `
          <div style="background:#fff3cd;border-radius:6px;padding:7px 14px;">
            <strong>${t("landlordAbsorbs")}</strong> ${fmtAmt(landlordSubsidy + businessAbsorbs)}
            ${
              landlordSubsidy > 0 && businessAbsorbs > 0.005
                ? `<br><span style="font-size:0.82rem;color:#856404;">${t("fixedSubsidy")} ${fmtAmt(landlordSubsidy)} + ${t("subsidisedTenantsShare")} ${fmtAmt(businessAbsorbs)}</span>`
                : landlordSubsidy > 0
                  ? `<br><span style="font-size:0.82rem;color:#856404;">${t("fixedSubsidy")} ${fmtAmt(landlordSubsidy)}</span>`
                  : `<br><span style="font-size:0.82rem;color:#856404;">${t("subsidisedTenantsShare")} ${fmtAmt(businessAbsorbs)}</span>`
            }
          </div>`
              : ""
          }
          ${
            notBilledAbsorbs > 0.005
              ? `
          <div style="background:#f8d7da;border-radius:6px;padding:7px 14px;">
            <strong>${t("notBilledBadge")}</strong> ${fmtAmt(notBilledAbsorbs)}
            <br><span style="font-size:0.82rem;color:#842029;">${t("movedOutNoBill")}</span>
          </div>`
              : ""
          }
          ${
            Math.abs(
              grossUtility -
                totalCharged -
                landlordSubsidy -
                businessAbsorbs -
                notBilledAbsorbs,
            ) > 0.02
              ? `
          <div style="background:#f8d7da;border-radius:6px;padding:7px 14px;">
            <strong>${t("roundingDiff")}</strong> ${fmtAmt(Math.abs(grossUtility - totalCharged - landlordSubsidy - businessAbsorbs - notBilledAbsorbs))}
          </div>`
              : ""
          }
        </div>

        ${settlementHtml}

      </div>`;
  }

  _renderBreakdownModal(bodyHtml) {
    // If modal already exists, just update the body content in-place
    // (avoids removing a live modal element which orphans the Bootstrap backdrop)
    const existingBody = document.getElementById("utilityBreakdownModalBody");
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
                <i class="bi bi-calculator me-2 text-primary"></i>${t("utilityBreakdownTitle")}
              </h6>
              <div class="d-flex align-items-center gap-2 ms-auto me-2">
                <button class="btn btn-sm btn-outline-primary" onclick="billManager.showUtilityBreakdownModal()" title="${t("refresh")}">
                  <i class="bi bi-arrow-clockwise me-1"></i>${t("refresh")}
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="billManager._copyBreakdownToClipboard()" title="${t("copyToClipboard")}">
                  <i class="bi bi-clipboard me-1"></i>${t("copyToClipboard")}
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="billManager._downloadBreakdownImage()" title="${t("saveImage")}">
                  <i class="bi bi-download me-1"></i>${t("saveImage")}
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

    document.body.insertAdjacentHTML("beforeend", html);
    const modalEl = document.getElementById("utilityBreakdownModal");
    // Remove from DOM only after Bootstrap fully hides it (cleans up backdrop)
    modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove(), {
      once: true,
    });
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }

  async _renderBreakdownCanvas() {
    const area = document.getElementById("utilityBreakdownPrintArea");
    if (!area) return null;
    if (typeof html2canvas === "undefined") {
      showToast(t("html2canvasNotLoaded"), "warning");
      return null;
    }
    return html2canvas(area, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
  }

  async _copyBreakdownToClipboard() {
    try {
      showToast(t("generatingImage"), "info");
      const canvas = await this._renderBreakdownCanvas();
      if (!canvas) return;
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      showToast(t("imageCopied"), "success");
    } catch (err) {
      console.error("Clipboard error:", err);
      showToast(t("imageCopyFailed"), "error");
    }
  }

  async _downloadBreakdownImage() {
    try {
      showToast(t("generatingImage"), "info");
      const canvas = await this._renderBreakdownCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;
      link.download = `utility-breakdown-${this.selectedProperty}-${year}-${String(month).padStart(2, "0")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast(t("imageSaved"), "success");
    } catch (err) {
      console.error("Download error:", err);
      showToast(t("imageFailed"), "error");
    }
  }
}

// Export for use in other modules
window.BillManagementComponent = BillManagementComponent;
