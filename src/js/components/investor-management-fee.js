/**
 * Investor Management Fee panel
 *
 * Renders the current month's management fee per investor (calculation lives
 * in utils/management-fee.js), lets the admin set the fee per 100% share, and
 * exports selected investors as an image (⌘/Ctrl+K) or text summary (⌘/Ctrl+C).
 */
import {
  toMonthKey,
  formatMonthLabel,
  rateMonthKey,
  resolveRateForMonth,
  buildManagementFeeRows,
  summarizeFeeRows,
  formatMoney,
  formatPercent,
  formatHoldingAddress,
} from "../utils/management-fee.js";
import {
  getModifierLabel,
  svgEscape as esc,
  svgToPngBlob,
  copyImageToClipboard,
  copyTextToClipboard,
  showImagePreviewModal,
} from "../utils/report-image-export.js";
import { buildFeeSummaryText, generateFeeReportSVG } from "./investor-management-fee-export.js";

export class ManagementFeePanel {
  /**
   * @param {object}   opts
   * @param {string}   opts.containerId
   * @param {Function} opts.getData   () => ({ investors, properties })
   * @param {Function} opts.notify    (message, type) => void
   */
  constructor({ containerId, getData, notify }) {
    this.containerId = containerId;
    this.getData = getData;
    this.notify = notify;
    this.rates = [];
    this.monthKey = toMonthKey();
    this.rows = [];
    this.ratePer100 = 0;
    this.expanded = new Set(); // investorIds with breakdown open
    this.selected = new Set(); // investorIds chosen for export
    this.isSaving = false;
    this.isExporting = false;
    this.bindHotkeys();
  }

  get container() {
    return document.getElementById(this.containerId);
  }

  /** Rows currently ticked, in table order */
  get selectedRows() {
    return this.rows.filter((r) => this.selected.has(r.investor.investorId));
  }

  // ─── Data ──────────────────────────────────────────────────────────────────

  async loadRates() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.MANAGEMENT_FEE_RATES);
      const result = await response.json();
      this.rates = result.success ? result.rates || [] : [];
    } catch (error) {
      console.error("Error loading management fee rates:", error);
      this.rates = [];
    }
  }

  async saveRate(amount) {
    if (this.isSaving) return;
    this.isSaving = true;
    this.render();

    try {
      const response = await API.put(API_CONFIG.ENDPOINTS.MANAGEMENT_FEE_RATE_BY_MONTH(this.monthKey), {
        amount,
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.message || "Failed to save management fee");
      }
      await this.loadRates();
      this.notify(`Management fee set to ${formatMoney(amount)} per 100% from ${formatMonthLabel(this.monthKey)}`, "success");
    } catch (error) {
      console.error("Error saving management fee rate:", error);
      this.notify(error.message || "Failed to save management fee", "error");
    } finally {
      this.isSaving = false;
      this.render();
    }
  }

  // ─── Selection ─────────────────────────────────────────────────────────────

  toggleSelected(investorId, checked) {
    if (checked) this.selected.add(investorId);
    else this.selected.delete(investorId);
    this.render();
  }

  toggleSelectAll(checked) {
    this.selected = checked ? new Set(this.rows.map((r) => r.investor.investorId)) : new Set();
    this.render();
  }

  toggleBreakdown(investorId) {
    if (this.expanded.has(investorId)) this.expanded.delete(investorId);
    else this.expanded.add(investorId);
    this.render();
  }

  // ─── Export ────────────────────────────────────────────────────────────────

  /** Selected rows ready to export, or null (with a warning) if none */
  getExportRows() {
    const rows = this.selectedRows;
    if (rows.length === 0) {
      this.notify("Select at least one investor to export", "warning");
      return null;
    }
    return rows;
  }

  get exportMeta() {
    return { monthLabel: formatMonthLabel(this.monthKey), ratePer100: this.ratePer100 };
  }

  async exportImage() {
    if (this.isExporting) return;
    const rows = this.getExportRows();
    if (!rows) return;

    this.isExporting = true;
    this.render();
    try {
      const svg = await generateFeeReportSVG(rows, this.exportMeta);
      const blob = await svgToPngBlob(svg);
      showImagePreviewModal(blob, {
        title: "Management Fee",
        subtitle: this.exportMeta.monthLabel,
        fileName: `Management_Fee_${this.monthKey}_${rows.length}_investors.png`,
      });
      if (await copyImageToClipboard(blob)) {
        const pasteKey = getModifierLabel() === "⌘" ? "⌘ Cmd+V" : "Ctrl+V";
        this.notify(`Copied to clipboard — paste with ${pasteKey}`, "success");
      }
    } catch (error) {
      console.error("Management fee export error:", error);
      this.notify(`Failed to export management fee: ${error.message}`, "error");
    } finally {
      this.isExporting = false;
      this.render();
    }
  }

  async copySummary() {
    const rows = this.getExportRows();
    if (!rows) return;
    try {
      await copyTextToClipboard(buildFeeSummaryText(rows, this.exportMeta));
      this.notify(`Copied management fee for ${rows.length} investor${rows.length !== 1 ? "s" : ""}`, "success");
    } catch (error) {
      console.error("Management fee copy error:", error);
      this.notify("Failed to copy management fee summary", "error");
    }
  }

  /**
   * ⌘/Ctrl+K → export image, ⌘/Ctrl+C (no text selected) → copy summary.
   * Same keys as the financial report; only active while this panel is on
   * screen and no modal or text field has focus, so other sections and
   * normal copy keep working.
   */
  bindHotkeys() {
    document.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== "k" && key !== "c") return;

      const container = this.container;
      if (!container || container.getClientRects().length === 0) return; // section hidden
      if (!this.ratePer100 || this.rows.length === 0) return;
      if (document.querySelector(".modal.show")) return;
      if (e.target.closest?.("input, textarea, select, [contenteditable='true']")) return;

      if (key === "k") {
        e.preventDefault();
        this.exportImage();
      } else if (!window.getSelection()?.toString()) {
        e.preventDefault();
        this.copySummary();
      }
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  render() {
    const container = this.container;
    if (!container) return;

    const { investors, properties } = this.getData();
    const rate = resolveRateForMonth(this.rates, this.monthKey);
    this.ratePer100 = rate ? rate.amount : 0;
    this.rows = buildManagementFeeRows({ investors, properties, ratePer100: this.ratePer100, monthKey: this.monthKey });

    // Drop selections for investors no longer listed (e.g. share went to 0)
    const listed = new Set(this.rows.map((r) => r.investor.investorId));
    this.selected = new Set([...this.selected].filter((id) => listed.has(id)));

    container.innerHTML = `
      <div class="card mgmt-fee-card mb-4">
        ${this.renderHeader(rate)}
        ${rate && this.rows.length > 0 ? this.renderToolbar() : ""}
        <div class="card-body p-0">
          ${rate ? this.renderTable() : this.renderEmptyRate()}
        </div>
      </div>
    `;

    const selectAll = container.querySelector('[data-role="select-all"]');
    if (selectAll) selectAll.indeterminate = this.selected.size > 0 && this.selected.size < this.rows.length;

    this.bindEvents();
  }

  renderHeader(rate) {
    const fromMonth = rate ? rateMonthKey(rate) : null;
    const rateHint = rate
      ? fromMonth === this.monthKey
        ? `Effective from ${formatMonthLabel(fromMonth)}`
        : `Carried over from ${formatMonthLabel(fromMonth)}`
      : "Not set yet";

    return `
      <div class="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-3 py-3">
        <div>
          <h5 class="mb-0"><i class="bi bi-receipt me-2"></i>Management Fees</h5>
          <small class="text-muted">${esc(formatMonthLabel(this.monthKey))} · based on each investor's current ownership</small>
        </div>
        <form class="mgmt-fee-rate-form" data-role="rate-form" novalidate>
          <label class="form-label small text-muted mb-1" for="mgmtFeeRateInput">Fee per 100% share / month</label>
          <div class="input-group input-group-sm">
            <span class="input-group-text">$</span>
            <input type="number" class="form-control text-end" id="mgmtFeeRateInput" name="amount"
                   min="0" step="0.01" placeholder="e.g. 100" required
                   value="${rate ? esc(rate.amount) : ""}" ${this.isSaving ? "disabled" : ""}>
            <button type="submit" class="btn btn-primary" ${this.isSaving ? "disabled" : ""}>
              ${this.isSaving
                ? '<span class="spinner-border spinner-border-sm"></span>'
                : '<i class="bi bi-check-lg me-1"></i>Save'}
            </button>
          </div>
          <div class="form-text mt-1">${esc(rateHint)}</div>
        </form>
      </div>
    `;
  }

  renderToolbar() {
    const count = this.selected.size;
    const mod = getModifierLabel();
    const disabled = count === 0 || this.isExporting ? "disabled" : "";

    return `
      <div class="mgmt-fee-toolbar d-flex flex-wrap justify-content-between align-items-center gap-2 px-3 py-2">
        <small class="text-muted">
          ${count > 0
            ? `<strong class="text-body">${count}</strong> of ${this.rows.length} selected · ${esc(formatMoney(summarizeFeeRows(this.selectedRows).totalFee))}`
            : "Tick investors to export"}
        </small>
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-secondary" data-action="copy" ${disabled}
                  title="Copy summary to clipboard (${mod}C)">
            <i class="bi bi-clipboard me-1"></i>Copy <kbd class="mgmt-fee-kbd">${mod}C</kbd>
          </button>
          <button type="button" class="btn btn-outline-primary" data-action="export" ${disabled}
                  title="Export as image (${mod}K)">
            ${this.isExporting
              ? '<span class="spinner-border spinner-border-sm me-1"></span>Exporting…'
              : `<i class="bi bi-image me-1"></i>Export image <kbd class="mgmt-fee-kbd">${mod}K</kbd>`}
          </button>
        </div>
      </div>
    `;
  }

  renderEmptyRate() {
    return `
      <div class="text-center text-muted py-4">
        <i class="bi bi-cash-coin fs-3 d-block mb-2"></i>
        Set the fee for 100% ownership to calculate each investor's monthly management fee.
      </div>
    `;
  }

  renderTable() {
    const rows = this.rows;
    if (rows.length === 0) {
      return `<div class="text-center text-muted py-4">No investor holds an active share this month.</div>`;
    }

    const totals = summarizeFeeRows(rows);
    const allSelected = this.selected.size === rows.length;

    return `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0 mgmt-fee-table">
          <thead class="table-light">
            <tr>
              <th scope="col" class="mgmt-fee-check">
                <input class="form-check-input" type="checkbox" data-role="select-all"
                       aria-label="Select all investors" ${allSelected ? "checked" : ""}>
              </th>
              <th scope="col" class="text-center" style="width:3rem">#</th>
              <th scope="col">Investor</th>
              <th scope="col" class="text-center">Properties</th>
              <th scope="col" class="text-end">Total Share</th>
              <th scope="col" class="text-end">Monthly Fee</th>
              <th scope="col" style="width:2.5rem"><span class="visually-hidden">Details</span></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => this.renderRow(row, index)).join("")}
          </tbody>
          <tfoot>
            <tr class="mgmt-fee-total">
              <th scope="row" colspan="3">Total · ${totals.investors} investor${totals.investors !== 1 ? "s" : ""}</th>
              <td class="text-center">${totals.holdings}</td>
              <td class="text-end">${formatPercent(totals.totalPercentage)}</td>
              <td class="text-end fw-bold">${formatMoney(totals.totalFee)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  renderRow({ investor, holdings, totalPercentage, totalFee }, index) {
    const id = esc(investor.investorId);
    const isOpen = this.expanded.has(investor.investorId);
    const isSelected = this.selected.has(investor.investorId);
    const detailsId = `mgmt-fee-details-${id}`;

    return `
      <tr class="mgmt-fee-row ${isSelected ? "table-active" : ""}" data-investor-id="${id}"
          aria-expanded="${isOpen}" aria-controls="${detailsId}" tabindex="0">
        <td class="mgmt-fee-check">
          <input class="form-check-input" type="checkbox" data-role="select-row" value="${id}"
                 aria-label="Select ${esc(investor.name)}" ${isSelected ? "checked" : ""}>
        </td>
        <td class="text-center text-muted">${index + 1}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            ${this.renderAvatar(investor)}
            <div class="lh-sm">
              <div class="fw-semibold">${esc(investor.name)}</div>
              <small class="text-muted">ID: ${id}</small>
            </div>
          </div>
        </td>
        <td class="text-center">${holdings.length}</td>
        <td class="text-end"><span class="badge bg-primary-subtle text-primary-emphasis">${formatPercent(totalPercentage)}</span></td>
        <td class="text-end fw-semibold">${formatMoney(totalFee)}</td>
        <td class="text-center text-muted"><i class="bi bi-chevron-${isOpen ? "up" : "down"}"></i></td>
      </tr>
      ${isOpen ? this.renderBreakdown(holdings, detailsId) : ""}
    `;
  }

  renderBreakdown(holdings, detailsId) {
    return `
      <tr class="mgmt-fee-details" id="${detailsId}">
        <td colspan="2"></td>
        <td colspan="5" class="pt-0">
          <table class="table table-sm table-borderless mb-0 small">
            <tbody>
              ${holdings
                .map(
                  (h) => `
                    <tr>
                      <td class="text-muted" style="width:5rem">${esc(h.propertyId)}</td>
                      <td>${esc(formatHoldingAddress(h))}</td>
                      <td class="text-end" style="width:6rem">${formatPercent(h.percentage)}</td>
                      <td class="text-end" style="width:7rem">${formatMoney(h.fee)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </td>
      </tr>
    `;
  }

  renderAvatar(investor) {
    const initial = `<span class="mgmt-fee-avatar mgmt-fee-avatar-initial">${esc((investor.name || "?").charAt(0).toUpperCase())}</span>`;
    if (!investor.avatar || !window.ImageUtils) return initial;

    // Fallback initial stays hidden unless the image fails to load
    return `
      <img src="${esc(ImageUtils.getOptimizedImageUrl(investor.avatar, "small"))}" alt=""
           class="mgmt-fee-avatar border"
           onerror="this.nextElementSibling.classList.remove('d-none'); this.remove();">
      ${initial.replace('class="', 'class="d-none ')}
    `;
  }

  bindEvents() {
    const container = this.container;

    container.querySelector('[data-role="rate-form"]')?.addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = parseFloat(e.target.amount.value);
      if (isNaN(amount) || amount < 0) {
        this.notify("Please enter a valid fee amount", "error");
        return;
      }
      this.saveRate(amount);
    });

    container.querySelector('[data-action="copy"]')?.addEventListener("click", () => this.copySummary());
    container.querySelector('[data-action="export"]')?.addEventListener("click", () => this.exportImage());

    container.querySelector('[data-role="select-all"]')?.addEventListener("change", (e) => {
      this.toggleSelectAll(e.target.checked);
    });

    container.querySelectorAll('[data-role="select-row"]').forEach((checkbox) => {
      // Ticking must not also toggle the breakdown row
      checkbox.addEventListener("click", (e) => e.stopPropagation());
      checkbox.addEventListener("change", (e) => this.toggleSelected(e.target.value, e.target.checked));
    });

    container.querySelectorAll(".mgmt-fee-row").forEach((row) => {
      const toggle = () => this.toggleBreakdown(row.dataset.investorId);
      row.addEventListener("click", (e) => {
        // The whole checkbox cell is a hit target for selection
        if (e.target.closest(".mgmt-fee-check")) {
          const id = row.dataset.investorId;
          this.toggleSelected(id, !this.selected.has(id));
          return;
        }
        toggle();
      });
      row.addEventListener("keydown", (e) => {
        if (e.target !== row) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });
  }
}
