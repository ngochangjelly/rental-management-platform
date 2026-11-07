/**
 * Create Contract → "Extend Tenancy".
 *
 * The admin picks a property, Tenant A and the Tenant B tenants who are
 * staying on, and how long to extend from the current move-out. On confirm,
 * each Tenant B's move-out date is saved, the contract form is filled
 * (original move-in → new move-out) and the contract PDF is exported.
 *
 * Behind the `contractExtension` feature flag (admins only for now).
 */
import i18next, { onLanguageChange } from "../i18n.js";
import { formatDateVi, formatLeasePeriodVi } from "./contract-clauses.js";
import { isMobileViewport, mobileLayers } from "../utils/mobile-ux.js";
import { isFeatureEnabled } from "../utils/feature-flags.js";
import { addDays, daysBetween, extendLeaseEnd, toISODate, todayISO } from "../utils/lease-dates.js";
import { getRoomTypeBadgeStyle } from "../utils/room-type-mapper.js";
import "./contract-extension.css";

export const CONTRACT_EXTENSION_FLAG = "contractExtension";

const LAYER = "contract-extension";
const MONTH_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24];
const DEFAULT_MONTHS = 6;
const WHOLE_MONTHS = /^\d+ months?$/;

// `t` escapes interpolated values, for HTML. `tText` doesn't: use it for
// textContent and toasts, where escaping would show up as &amp;.
const t = (key, options) => i18next.t(`contractExtension.${key}`, options);
const tText = (key, options) =>
  i18next.t(`contractExtension.${key}`, { ...options, interpolation: { escapeValue: false } });

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const propertyIdOf = (p) => p?.propertyId || p?.id || p?._id || "";
const samePropertyId = (a, b) => String(a ?? "").toUpperCase() === String(b ?? "").toUpperCase();

/** The tenant's stay at `propertyId` (room, dates, main-tenant flag). */
function findStay(tenant, propertyId) {
  return (
    (tenant?.properties || []).find(
      (p) => p && typeof p === "object" && samePropertyId(p.propertyId, propertyId),
    ) || null
  );
}

/**
 * The tenant's `properties` with the stay at `propertyId` ending on
 * `moveOut`, or null when they have no stay there. The backend re-derives the
 * stay's move-out from its room assignments: an open (current) assignment
 * leaves it on the stay, otherwise the last assignment's date wins, so that
 * one moves too.
 */
export function withMoveOut(properties, propertyId, moveOut) {
  let found = false;
  const next = (properties || []).map((stay) => {
    if (!stay || typeof stay !== "object" || !samePropertyId(stay.propertyId, propertyId)) {
      return stay;
    }
    found = true;
    const assignments = (stay.roomAssignments || []).map((ra) => ({ ...ra }));
    if (assignments.length && assignments.every((ra) => ra.moveoutDate)) {
      assignments[assignments.length - 1].moveoutDate = moveOut;
    }
    return { ...stay, roomAssignments: assignments, moveoutDate: moveOut };
  });
  return found ? next : null;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function apiError(response, data) {
  const base = data?.error || data?.message || `HTTP ${response.status}`;
  const detail = data?.details?.[0]?.message;
  return detail ? `${base}: ${detail}` : base;
}

function modalHtml() {
  const common = (key) => i18next.t(`common.${key}`);
  return `
  <div class="modal fade cx-modal" id="contractExtensionModal" tabindex="-1" aria-labelledby="cxTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable modal-fullscreen-md-down cx-dialog">
      <div class="modal-content">
        <div class="modal-header cx-header">
          <span class="cx-header-icon" aria-hidden="true"><i class="bi bi-calendar-plus"></i></span>
          <div class="cx-header-text">
            <h5 class="modal-title" id="cxTitle" data-i18n="contractExtension.title">${t("title")}</h5>
            <div class="cx-subtitle" data-i18n="contractExtension.subtitle">${t("subtitle")}</div>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"
                  aria-label="${esc(common("close"))}" data-i18n-aria-label="common.close"></button>
        </div>
        <div class="modal-body">
          <fieldset class="cx-fields" id="cxFields">
            <div class="cx-field">
              <label class="form-label" for="cxProperty" data-i18n="contractExtension.property">${t("property")}</label>
              <select class="form-select" id="cxProperty"></select>
            </div>
            <div class="cx-field">
              <label class="form-label" for="cxTenantA" data-i18n="contractExtension.tenantA">${t("tenantA")}</label>
              <select class="form-select" id="cxTenantA"></select>
            </div>
            <div class="cx-field">
              <div class="cx-label-row">
                <span class="form-label mb-0" id="cxTenantBLabel" data-i18n="contractExtension.tenantB">${t("tenantB")}</span>
                <small class="text-muted" data-i18n="contractExtension.tenantBHint">${t("tenantBHint")}</small>
              </div>
              <div class="cx-tenant-list" id="cxTenantB" role="group" aria-labelledby="cxTenantBLabel"></div>
            </div>
            <div class="cx-field cx-dates">
              <div class="cx-date cx-date-current">
                <label class="form-label" for="cxCurrentMoveOut" data-i18n="contractExtension.currentMoveOut">${t("currentMoveOut")}</label>
                <input type="date" class="form-control" id="cxCurrentMoveOut">
                <div class="form-text" data-i18n="contractExtension.currentMoveOutHint">${t("currentMoveOutHint")}</div>
              </div>
              <div class="cx-date">
                <label class="form-label" for="cxMonths" data-i18n="contractExtension.extendBy">${t("extendBy")}</label>
                <select class="form-select" id="cxMonths"></select>
              </div>
              <div class="cx-date">
                <label class="form-label" for="cxNewMoveOut" data-i18n="contractExtension.newMoveOut">${t("newMoveOut")}</label>
                <input type="date" class="form-control" id="cxNewMoveOut">
                <div class="form-text" data-i18n="contractExtension.newMoveOutHint">${t("newMoveOutHint")}</div>
              </div>
            </div>
            <div id="cxSummary" aria-live="polite"></div>
            <div class="cx-field cx-clause">
              <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" id="cxAddClause" checked>
                <label class="form-check-label" for="cxAddClause" data-i18n="contractExtension.addClause">${t("addClause")}</label>
              </div>
              <div class="form-text" data-i18n="contractExtension.addClauseHint">${t("addClauseHint")}</div>
              <blockquote class="cx-clause-preview" id="cxClausePreview" hidden></blockquote>
            </div>
          </fieldset>
        </div>
        <div class="modal-footer cx-footer">
          <div class="cx-error" id="cxError" role="alert" hidden></div>
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" data-i18n="common.cancel">${esc(common("cancel"))}</button>
          <button type="button" class="btn btn-primary cx-submit" id="cxSubmit"></button>
        </div>
      </div>
    </div>
  </div>`;
}

export class ContractExtensionDialog {
  /** @param {object} manager the ContractManagementComponent */
  constructor(manager) {
    this.manager = manager;
    this.modalEl = null;
    this.modal = null;
    this.els = {};
    this.state = null;
    this._tenantsReq = 0;
    onLanguageChange(() => {
      if (this.isOpen()) this.renderAll();
    });
  }

  isOpen() {
    return !!this.modalEl?.classList.contains("show");
  }

  async open() {
    if (!isFeatureEnabled(CONTRACT_EXTENSION_FLAG)) return;
    this.ensureModal();
    const m = this.manager;
    if (!m.properties?.length) await m.loadProperties();

    // Start from the property already picked in the contract form, if any
    const formProperty = m.selectedPropertyId || "";
    const propertyId = this.activeProperties().some((p) => samePropertyId(propertyIdOf(p), formProperty))
      ? formProperty
      : "";
    this.state = this.freshState(propertyId);
    this.renderAll();
    this.modal.show();
    if (propertyId) this.loadTenants({ fromForm: true });
  }

  freshState(propertyId) {
    return {
      propertyId,
      tenants: [],
      loading: false,
      loadError: "",
      tenantAKey: "", // "tenant:<_id>" or "investor:<investorId>"
      tenantBIds: new Set(),
      showPast: false,
      currentMoveOut: "",
      currentEdited: false, // typed by the user: stop filling it from Tenant B
      months: DEFAULT_MONTHS, // or "custom" once the new date is typed
      newMoveOut: "",
      addClause: true,
      busy: false,
      busyText: "",
      error: "",
    };
  }

  hide() {
    if (!this.isOpen()) return mobileLayers?.close(LAYER) ?? Promise.resolve();
    return new Promise((resolve) => {
      this.modalEl.addEventListener(
        "hidden.bs.modal",
        () => Promise.resolve(mobileLayers?.close(LAYER)).then(resolve),
        { once: true },
      );
      this.modal.hide();
    });
  }

  // ─── Setup ───────────────────────────────────────────────────────────────

  ensureModal() {
    if (this.modalEl) return;
    document.body.insertAdjacentHTML("beforeend", modalHtml());
    this.modalEl = document.getElementById("contractExtensionModal");
    this.modal = new bootstrap.Modal(this.modalEl, { backdrop: true, keyboard: true });
    const $ = (sel) => this.modalEl.querySelector(sel);
    this.els = {
      fields: $("#cxFields"),
      property: $("#cxProperty"),
      tenantA: $("#cxTenantA"),
      tenantB: $("#cxTenantB"),
      currentMoveOut: $("#cxCurrentMoveOut"),
      months: $("#cxMonths"),
      newMoveOut: $("#cxNewMoveOut"),
      summary: $("#cxSummary"),
      addClause: $("#cxAddClause"),
      clausePreview: $("#cxClausePreview"),
      error: $("#cxError"),
      submit: $("#cxSubmit"),
    };
    const { els } = this;

    els.property.addEventListener("change", () => {
      this.state = { ...this.freshState(els.property.value), addClause: this.state.addClause };
      this.renderAll();
      if (this.state.propertyId) this.loadTenants();
    });

    els.tenantA.addEventListener("change", () => {
      const s = this.state;
      s.tenantAKey = els.tenantA.value;
      s.tenantBIds.delete(this.tenantAId()); // can't be on both sides
      s.error = "";
      this.renderTenantB();
      this.syncDates();
      this.renderSummary();
    });

    els.tenantB.addEventListener("change", (e) => {
      const box = e.target.closest('input[type="checkbox"]');
      if (!box) return;
      const s = this.state;
      if (box.checked) s.tenantBIds.add(box.value);
      else s.tenantBIds.delete(box.value);
      box.closest(".cx-tenant")?.classList.toggle("is-checked", box.checked);
      s.error = "";
      this.syncDates();
      this.renderSummary();
    });

    els.tenantB.addEventListener("click", (e) => {
      if (e.target.closest("[data-cx-toggle-past]")) {
        this.state.showPast = !this.state.showPast;
        this.renderTenantB();
      } else if (e.target.closest("[data-cx-retry]")) {
        this.loadTenants();
      }
    });

    const onCurrentMoveOut = () => {
      const s = this.state;
      s.currentMoveOut = els.currentMoveOut.value;
      s.currentEdited = true;
      s.error = "";
      this.syncDates();
      this.renderSummary();
    };
    els.currentMoveOut.addEventListener("change", onCurrentMoveOut);
    els.currentMoveOut.addEventListener("input", onCurrentMoveOut);

    els.months.addEventListener("change", () => {
      const s = this.state;
      s.months = els.months.value === "custom" ? "custom" : Number(els.months.value);
      s.error = "";
      this.syncDates();
      this.renderSummary();
    });

    const onNewMoveOut = () => {
      const s = this.state;
      s.newMoveOut = els.newMoveOut.value;
      s.months = "custom";
      s.error = "";
      this.renderMonths();
      this.renderSummary();
    };
    els.newMoveOut.addEventListener("change", onNewMoveOut);
    els.newMoveOut.addEventListener("input", onNewMoveOut);

    els.addClause.addEventListener("change", () => {
      this.state.addClause = els.addClause.checked;
      this.renderSummary();
    });

    els.submit.addEventListener("click", () => this.submit());

    // Stay open while tenants are being saved
    this.modalEl.addEventListener("hide.bs.modal", (e) => {
      if (this.state?.busy) e.preventDefault();
    });
    // Phones: the back gesture closes the dialog instead of leaving the page
    this.modalEl.addEventListener("show.bs.modal", () => {
      if (!isMobileViewport()) return;
      mobileLayers.open(LAYER, () => {
        if (this.state?.busy) return false;
        this.modal.hide();
      });
    });
    this.modalEl.addEventListener("hidden.bs.modal", () => mobileLayers.close(LAYER));
  }

  async loadTenants({ fromForm = false } = {}) {
    const s = this.state;
    const propertyId = s.propertyId;
    const req = ++this._tenantsReq;
    s.loading = true;
    s.loadError = "";
    this.renderTenantA();
    this.renderTenantB();
    try {
      const response = await API.get(
        `${API_CONFIG.ENDPOINTS.TENANTS}?limit=200&property=${encodeURIComponent(propertyId)}`,
      );
      const data = await readJson(response);
      if (req !== this._tenantsReq) return; // another property was picked meanwhile
      if (!response.ok || data.success === false) throw new Error(apiError(response, data));
      const list = Array.isArray(data.tenants) ? data.tenants : Array.isArray(data) ? data : [];
      s.tenants = list.filter((tenant) => tenant?._id && findStay(tenant, propertyId));
      this.prefillPeople(fromForm);
    } catch (error) {
      if (req !== this._tenantsReq) return;
      s.tenants = [];
      s.loadError = error.message;
    } finally {
      if (req === this._tenantsReq) {
        s.loading = false;
        this.renderAll();
      }
    }
  }

  // Tenant A: the contract form's pick when it's for this property, else the
  // house's main tenant. Tenant B: the form's picks for this property.
  prefillPeople(fromForm) {
    const s = this.state;
    const m = this.manager;
    const listed = (id) => s.tenants.some((tenant) => tenant._id === id);

    let key = "";
    const formA = fromForm ? m.selectedTenantA : null;
    if (formA?.investorId && this.propertyInvestors().some((i) => i.investorId === formA.investorId)) {
      key = `investor:${formA.investorId}`;
    } else if (formA?._id && listed(formA._id)) {
      key = `tenant:${formA._id}`;
    }
    if (!key) {
      const { current, past } = this.sortedStays();
      const main = [...current, ...past].find((row) => row.stay.isMainTenant);
      if (main) key = `tenant:${main.tenant._id}`;
    }
    s.tenantAKey = key;

    s.tenantBIds = new Set();
    if (fromForm && Array.isArray(m.selectedTenantB)) {
      for (const tenant of m.selectedTenantB) {
        if (tenant?._id && listed(tenant._id) && `tenant:${tenant._id}` !== key) {
          s.tenantBIds.add(tenant._id);
        }
      }
    }
    // Picked tenants who already moved out need the past list open
    s.showPast = this.sortedStays().past.some((row) => s.tenantBIds.has(row.tenant._id));
    s.currentEdited = false;
  }

  // ─── Derived data ────────────────────────────────────────────────────────

  activeProperties() {
    return [...(this.manager.properties || [])]
      .filter((p) => !p.isArchived && propertyIdOf(p))
      .sort((a, b) => (parseInt(propertyIdOf(b)) || 0) - (parseInt(propertyIdOf(a)) || 0));
  }

  property() {
    return (
      (this.manager.properties || []).find((p) =>
        samePropertyId(propertyIdOf(p), this.state.propertyId),
      ) || null
    );
  }

  propertyInvestors() {
    const propertyId = this.state.propertyId;
    if (!propertyId) return [];
    return (this.manager.investors || []).filter((investor) =>
      (investor.properties || []).some((p) =>
        samePropertyId(typeof p === "object" ? p?.propertyId || p?._id || p?.id : p, propertyId),
      ),
    );
  }

  tenantAId() {
    const key = this.state.tenantAKey;
    return key.startsWith("tenant:") ? key.slice("tenant:".length) : "";
  }

  tenantASelection() {
    const key = this.state.tenantAKey;
    if (key.startsWith("investor:")) {
      const id = key.slice("investor:".length);
      const record = (this.manager.investors || []).find((i) => i.investorId === id);
      return record ? { type: "investor", record } : null;
    }
    const record = this.state.tenants.find((tenant) => tenant._id === this.tenantAId());
    return record ? { type: "tenant", record } : null;
  }

  /** Stays at this property, split into current (soonest to end first) and past. */
  sortedStays() {
    const s = this.state;
    const today = todayISO();
    const rows = s.tenants.map((tenant) => ({ tenant, stay: findStay(tenant, s.propertyId) }));
    const end = (row) => toISODate(row.stay.moveoutDate);
    const byName = (a, b) => (a.tenant.name || "").localeCompare(b.tenant.name || "");
    const current = rows
      .filter((row) => !end(row) || end(row) >= today)
      .sort((a, b) => (end(a) || "9999").localeCompare(end(b) || "9999") || byName(a, b));
    const past = rows
      .filter((row) => end(row) && end(row) < today)
      .sort((a, b) => end(b).localeCompare(end(a)) || byName(a, b));
    return { current, past };
  }

  /** Picked Tenant B tenants, in list order (the first sets the current move-out). */
  selectedTenantsB() {
    const { current, past } = this.sortedStays();
    return [...current, ...past]
      .filter((row) => this.state.tenantBIds.has(row.tenant._id))
      .map((row) => row.tenant);
  }

  /** When the tenancy began: the earliest move-in among the picked Tenant B. */
  originalMoveIn(tenantsB = this.selectedTenantsB()) {
    const dates = tenantsB
      .map((tenant) => toISODate(findStay(tenant, this.state.propertyId)?.moveinDate))
      .filter(Boolean)
      .sort();
    return dates[0] || "";
  }

  /** Everything the extension needs, or null while something is missing. */
  plan() {
    const s = this.state;
    const tenantsB = this.selectedTenantsB();
    if (!s.propertyId || !this.tenantASelection() || !tenantsB.length) return null;
    if (!s.currentMoveOut || !s.newMoveOut || s.newMoveOut <= s.currentMoveOut) return null;
    const stay = findStay(tenantsB[0], s.propertyId);
    return {
      propertyId: s.propertyId,
      tenantsB,
      names: tenantsB.map((tenant) => tenant.name || "?").join(", "),
      room: stay?.room || "",
      moveIn: this.originalMoveIn(tenantsB),
      currentMoveOut: s.currentMoveOut,
      newMoveOut: s.newMoveOut,
      months: s.months,
      deposit: tenantsB.reduce((sum, tenant) => sum + (parseFloat(tenant.deposit) || 0), 0),
    };
  }

  validationError() {
    const s = this.state;
    const { els } = this;
    if (!s.propertyId) return { message: tText("errors.noProperty"), el: els.property };
    if (!this.tenantASelection()) return { message: tText("errors.noTenantA"), el: els.tenantA };
    if (!this.selectedTenantsB().length) {
      return { message: tText("errors.noTenantB"), el: els.tenantB.querySelector("input") };
    }
    if (!s.currentMoveOut) return { message: tText("errors.noCurrentMoveOut"), el: els.currentMoveOut };
    if (!s.newMoveOut) return { message: tText("errors.noNewMoveOut"), el: els.newMoveOut };
    if (s.newMoveOut <= s.currentMoveOut) return { message: tText("errors.notLater"), el: els.newMoveOut };
    return null;
  }

  warnings(plan) {
    const list = [];
    if (plan.currentMoveOut < todayISO()) list.push(t("warnings.pastMoveOut"));
    const ends = new Set(
      plan.tenantsB.map((tenant) => toISODate(findStay(tenant, plan.propertyId)?.moveoutDate)),
    );
    if (ends.size > 1) list.push(t("warnings.differentDates", { date: this.fmtDate(plan.newMoveOut) }));
    if (!plan.moveIn) list.push(t("warnings.noMoveIn"));
    const houseLeaseEnd = toISODate(this.property()?.moveOutDate);
    if (houseLeaseEnd && houseLeaseEnd < plan.newMoveOut) {
      list.push(t("warnings.headLease", { date: this.fmtDate(houseLeaseEnd) }));
    }
    for (const booking of this.incomingBookings(plan)) {
      list.push(t("warnings.incoming", { name: booking.name, date: this.fmtDate(booking.date) }));
    }
    return list;
  }

  // Other tenants due to move into the same room before the new move-out
  // (a same-day handover on the new move-out date is fine).
  incomingBookings(plan) {
    if (!plan.room) return [];
    const skip = new Set(plan.tenantsB.map((tenant) => tenant._id));
    if (this.tenantAId()) skip.add(this.tenantAId());
    const bookings = [];
    for (const tenant of this.state.tenants) {
      if (skip.has(tenant._id)) continue;
      const stay = findStay(tenant, plan.propertyId);
      if (!stay) continue;
      const rooms = stay.roomAssignments?.length ? stay.roomAssignments : [stay];
      const clash = rooms.find((ra) => {
        const start = toISODate(ra.moveinDate);
        return ra.room === plan.room && start >= plan.currentMoveOut && start < plan.newMoveOut;
      });
      if (clash) bookings.push({ name: tenant.name || "?", date: toISODate(clash.moveinDate) });
    }
    return bookings;
  }

  // Contract wording: always English, like the rest of the contract
  clauseText(plan) {
    const m = this.manager;
    const span = `from ${m.formatDate(plan.currentMoveOut)} to ${m.formatDate(plan.newMoveOut)}`;
    const deposit = plan.deposit > 0 ? `of S$${plan.deposit.toLocaleString("en-SG")} ` : "";
    return [
      plan.moveIn
        ? `This Agreement extends the existing tenancy of The Room, which commenced on ${m.formatDate(plan.moveIn)}.`
        : "This Agreement extends the existing tenancy of The Room.",
      typeof plan.months === "number"
        ? `The tenancy end date is extended by ${m.formatMonthsText(plan.months)}, ${span}.`
        : `The tenancy end date is extended ${span}.`,
      `The security deposit ${deposit}paid under the existing tenancy is carried forward and held by Tenant A under this Agreement, so it does not need to be paid again.`,
    ].join(" ");
  }

  isVietnamese() {
    return (i18next.language || "").startsWith("vi");
  }

  fmtDate(iso) {
    if (!iso) return "";
    return this.isVietnamese() ? formatDateVi(iso) : this.manager.formatDate(iso);
  }

  fmtLength(fromIso, toIso) {
    const length = this.leaseLength(fromIso, toIso);
    return this.isVietnamese() ? formatLeasePeriodVi({ leasePeriod: length }) : length;
  }

  // Length of a tenancy, in whole months when its dates line up either way:
  // 15 Jun → 15 Dec and 15 Jun → 14 Dec are both "6 months".
  leaseLength(fromIso, toIso) {
    const exact = this.manager.calculateLeasePeriod(fromIso, toIso) || "";
    if (WHOLE_MONTHS.test(exact)) return exact;
    const inclusive = this.manager.calculateLeasePeriod(fromIso, addDays(toIso, 1)) || "";
    return WHOLE_MONTHS.test(inclusive) ? inclusive : exact;
  }

  // What to put in the form's Lease Period: "" lets the form work it out
  // from the dates, which only needs help for 15th → 14th tenancies.
  contractLeasePeriod(plan) {
    if (!plan.moveIn) return "";
    const exact = this.manager.calculateLeasePeriod(plan.moveIn, plan.newMoveOut) || "";
    const length = this.leaseLength(plan.moveIn, plan.newMoveOut);
    return length === exact ? "" : length;
  }

  // Fills the dates from the first Tenant B and the chosen months, unless the
  // user typed their own.
  syncDates() {
    const s = this.state;
    const tenantsB = this.selectedTenantsB();
    const stay = findStay(tenantsB[0], s.propertyId);
    if (!s.currentEdited) s.currentMoveOut = toISODate(stay?.moveoutDate);
    if (s.months !== "custom") {
      s.newMoveOut = s.currentMoveOut
        ? extendLeaseEnd(s.currentMoveOut, s.months, this.originalMoveIn(tenantsB))
        : "";
    }
    this.els.currentMoveOut.value = s.currentMoveOut;
    this.els.newMoveOut.value = s.newMoveOut;
    this.els.newMoveOut.min = s.currentMoveOut ? addDays(s.currentMoveOut, 1) : "";
    this.renderMonths();
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  renderAll() {
    this.renderProperty();
    this.renderTenantA();
    this.renderTenantB();
    this.syncDates();
    this.renderSummary();
    this.renderBusy();
  }

  renderProperty() {
    const sel = this.els.property;
    sel.innerHTML =
      `<option value="">${esc(tText("selectProperty"))}</option>` +
      this.activeProperties()
        .map((p) => {
          const id = propertyIdOf(p);
          const address = [p.address || p.name || "", p.unit || ""].filter(Boolean).join(", ");
          return `<option value="${esc(id)}">${esc(`${id} · ${address}`)}</option>`;
        })
        .join("");
    sel.value = this.state.propertyId;
  }

  renderTenantA() {
    const s = this.state;
    const sel = this.els.tenantA;
    if (!s.propertyId || s.loading) {
      sel.innerHTML = `<option value="">${esc(tText(s.loading ? "loadingTenants" : "selectTenantA"))}</option>`;
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    const { current, past } = this.sortedStays();
    const mains = [...current, ...past].filter((row) => row.stay.isMainTenant);
    const others = current.filter((row) => !row.stay.isMainTenant);
    const tenantOptions = [...mains, ...others]
      .map((row) => {
        const tag = row.stay.isMainTenant ? ` (${tText("mainTenantTag")})` : "";
        return `<option value="tenant:${esc(row.tenant._id)}">${esc((row.tenant.name || "?") + tag)}</option>`;
      })
      .join("");
    const investorOptions = this.propertyInvestors()
      .map((i) => `<option value="investor:${esc(i.investorId)}">${esc(i.name || i.investorId)}</option>`)
      .join("");
    sel.innerHTML =
      `<option value="">${esc(tText("selectTenantA"))}</option>` +
      (tenantOptions ? `<optgroup label="${esc(tText("tenants"))}">${tenantOptions}</optgroup>` : "") +
      (investorOptions ? `<optgroup label="${esc(tText("investors"))}">${investorOptions}</optgroup>` : "");
    sel.value = s.tenantAKey;
    if (sel.value !== s.tenantAKey) s.tenantAKey = ""; // no longer listed
  }

  renderTenantB() {
    const s = this.state;
    const box = this.els.tenantB;
    if (!s.propertyId) {
      box.innerHTML = `<div class="cx-empty">${t("pickPropertyFirst")}</div>`;
      return;
    }
    if (s.loading) {
      box.innerHTML = `<div class="cx-empty"><span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${t("loadingTenants")}</div>`;
      return;
    }
    if (s.loadError) {
      box.innerHTML = `<div class="cx-empty text-danger">${t("loadFailed", { error: s.loadError })}
        <button type="button" class="btn btn-link btn-sm p-0 align-baseline" data-cx-retry>${t("retry")}</button></div>`;
      return;
    }
    const tenantAId = this.tenantAId();
    const { current, past } = this.sortedStays();
    const visible = (rows) => rows.filter((row) => row.tenant._id !== tenantAId);
    const currentRows = visible(current);
    const pastRows = visible(past);

    let html = currentRows.length
      ? currentRows.map((row) => this.tenantRowHtml(row, false)).join("")
      : `<div class="cx-empty">${t("noCurrentTenants")}</div>`;
    if (pastRows.length) {
      html += `<button type="button" class="cx-past-toggle" data-cx-toggle-past aria-expanded="${s.showPast}">
          <i class="bi bi-chevron-${s.showPast ? "up" : "down"}" aria-hidden="true"></i>
          ${s.showPast ? t("hidePast") : t("showPast", { count: pastRows.length })}
        </button>`;
      if (s.showPast) html += pastRows.map((row) => this.tenantRowHtml(row, true)).join("");
    }
    box.innerHTML = html;
  }

  tenantRowHtml({ tenant, stay }, isPast) {
    const checked = this.state.tenantBIds.has(tenant._id);
    const moveIn = toISODate(stay.moveinDate);
    const moveOut = toISODate(stay.moveoutDate);
    const room = stay.room
      ? `<span class="badge cx-room" style="${getRoomTypeBadgeStyle(stay.room)}">${esc(this.manager.formatRoomType(stay.room))}</span>`
      : "";
    const dates = `<span class="cx-tenant-dates"><i class="bi bi-calendar-range" aria-hidden="true"></i>${esc(this.fmtDate(moveIn) || "?")} → ${esc(this.fmtDate(moveOut) || "?")}</span>`;
    return `
      <label class="cx-tenant${checked ? " is-checked" : ""}${isPast ? " is-past" : ""}">
        <input class="form-check-input" type="checkbox" value="${esc(tenant._id)}"${checked ? " checked" : ""}>
        <span class="cx-tenant-body">
          <span class="cx-tenant-name">${esc(tenant.name || "?")}</span>
          <span class="cx-tenant-meta">${room}${dates}</span>
        </span>
        ${this.stayStatusHtml(moveOut, isPast)}
      </label>`;
  }

  stayStatusHtml(moveOut, isPast) {
    if (!moveOut) return `<span class="cx-status">${t("noMoveOut")}</span>`;
    if (isPast) return `<span class="cx-status">${t("movedOut")}</span>`;
    const days = daysBetween(todayISO(), moveOut);
    if (days === 0) return `<span class="cx-status is-soon">${t("endsToday")}</span>`;
    return `<span class="cx-status${days <= 30 ? " is-soon" : ""}">${t("endsInDays", { count: days })}</span>`;
  }

  renderMonths() {
    const s = this.state;
    const sel = this.els.months;
    sel.innerHTML =
      MONTH_CHOICES.map((n) => `<option value="${n}">${esc(tText("months", { count: n }))}</option>`).join("") +
      (s.months === "custom" ? `<option value="custom">${esc(tText("custom"))}</option>` : "");
    sel.value = String(s.months);
  }

  renderSummary() {
    const s = this.state;
    const plan = this.plan();
    let html = "";
    if (plan) {
      const items = [
        [
          "bi-person-check",
          t("summaryTenants", {
            names: plan.names,
            from: this.fmtDate(plan.currentMoveOut),
            to: this.fmtDate(plan.newMoveOut),
            length: this.fmtLength(plan.currentMoveOut, plan.newMoveOut),
          }),
        ],
        plan.moveIn && [
          "bi-file-earmark-pdf",
          t("summaryContract", {
            from: this.fmtDate(plan.moveIn),
            to: this.fmtDate(plan.newMoveOut),
            length: this.fmtLength(plan.moveIn, plan.newMoveOut),
          }),
        ],
        ["bi-pen", t("summaryAgreementDate", { date: this.fmtDate(todayISO()) })],
      ].filter(Boolean);
      html += `<div class="cx-summary">
          <div class="cx-summary-title">${t("summaryTitle")}</div>
          <ul>${items.map(([icon, text]) => `<li><i class="bi ${icon}" aria-hidden="true"></i><span>${text}</span></li>`).join("")}</ul>
        </div>`;
      const warnings = this.warnings(plan);
      if (warnings.length) {
        html += `<div class="cx-warnings">${warnings
          .map((w) => `<div class="cx-warning"><i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i><span>${w}</span></div>`)
          .join("")}</div>`;
      }
    }
    this.els.summary.innerHTML = html;

    this.els.addClause.checked = s.addClause;
    const showClause = !!(plan && s.addClause);
    this.els.clausePreview.hidden = !showClause;
    this.els.clausePreview.textContent = showClause ? this.clauseText(plan) : "";

    this.els.error.hidden = !s.error;
    this.els.error.textContent = s.error;
  }

  renderBusy() {
    const { busy, busyText } = this.state;
    this.els.fields.disabled = busy;
    this.modalEl.querySelectorAll("[data-bs-dismiss]").forEach((btn) => {
      btn.disabled = busy;
    });
    this.els.submit.disabled = busy;
    this.els.submit.innerHTML = busy
      ? `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${esc(busyText)}`
      : `<i class="bi bi-calendar-check me-1" aria-hidden="true"></i>${esc(tText("submit"))}`;
  }

  setBusy(text) {
    this.state.busy = !!text;
    this.state.busyText = text || "";
    this.renderBusy();
  }

  // ─── Saving ──────────────────────────────────────────────────────────────

  async submit() {
    const s = this.state;
    if (s.busy) return;
    const invalid = this.validationError();
    if (invalid) {
      s.error = invalid.message;
      this.renderSummary();
      invalid.el?.focus();
      return;
    }
    const plan = this.plan();
    s.error = "";
    // Saved tenants show the new move-out; keep the dates as confirmed so a
    // retry after a failure doesn't extend twice.
    s.currentEdited = true;
    this.renderSummary();

    this.setBusy(tText("updating"));
    const updated = [];
    for (const tenant of plan.tenantsB) {
      try {
        updated.push(await this.saveMoveOut(tenant, plan));
      } catch (error) {
        console.error(`Extending tenancy for ${tenant.name} failed:`, error);
        this.afterSave(updated);
        this.setBusy(false);
        const name = tenant.name || "?";
        s.error = updated.length
          ? tText("errors.partial", {
              done: updated.map((x) => x.name).join(", "),
              name,
              error: error.message,
            })
          : tText("errors.updateFailed", { name, error: error.message });
        this.renderAll();
        return;
      }
    }
    this.afterSave(updated);

    this.setBusy(tText("preparing"));
    try {
      await this.manager.applyTenancyExtension({
        propertyId: plan.propertyId,
        tenantA: this.tenantASelection(),
        tenantsB: updated,
        moveInDate: plan.moveIn,
        moveOutDate: plan.newMoveOut,
        leasePeriod: this.contractLeasePeriod(plan),
        clauseText: s.addClause ? this.clauseText(plan) : "",
      });
    } catch (error) {
      console.error("Filling the extended contract failed:", error);
      this.setBusy(false);
      s.error = tText("errors.contractFailed", { error: error.message });
      this.renderAll();
      return;
    }

    this.setBusy(false);
    await this.hide();
    showToast(
      tText("success", { date: this.fmtDate(plan.newMoveOut), names: plan.names }),
      "success",
      6000,
    );
    await this.manager.exportToPDF();
  }

  // Reads the tenant fresh (keeps edits made elsewhere since the list
  // loaded), moves the stay's move-out and checks the server kept it.
  async saveMoveOut(tenant, plan) {
    const url = API_CONFIG.ENDPOINTS.TENANT_BY_ID(tenant._id);
    const response = await API.get(url);
    const data = await readJson(response);
    if (!response.ok || !data.tenant) throw new Error(apiError(response, data));

    const properties = withMoveOut(data.tenant.properties, plan.propertyId, plan.newMoveOut);
    if (!properties) throw new Error(tText("errors.notInProperty"));

    const saveResponse = await API.put(url, { properties });
    const saved = await readJson(saveResponse);
    if (!saveResponse.ok || !saved.success) throw new Error(apiError(saveResponse, saved));

    const savedTenant = saved.tenant || { ...data.tenant, properties };
    const savedMoveOut = toISODate(findStay(savedTenant, plan.propertyId)?.moveoutDate);
    if (savedMoveOut !== plan.newMoveOut) {
      throw new Error(tText("errors.notSaved", { date: savedMoveOut || "—" }));
    }
    return savedTenant;
  }

  afterSave(updated) {
    if (!updated.length) return;
    const byId = new Map(updated.map((tenant) => [tenant._id, tenant]));
    this.state.tenants = this.state.tenants.map((tenant) => byId.get(tenant._id) || tenant);
    window.dashboardController?.markTenantDataChanged?.();
  }
}
