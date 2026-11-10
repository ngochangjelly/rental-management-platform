/**
 * Bulk Property Reports Component
 * Allows users to select multiple properties and view profit results for a specific month
 */

import {
  fetchInvestorsForAvatarStack,
  renderPropertyImageAvatarBadge,
} from "../utils/investor-avatar-stack.js";
import {
  renderStabilityBannerBadge,
  renderStabilityCardBadge,
  renderStabilityStatsBadges,
} from "../utils/property-stability.js";
import {
  renderUnclosedCountBadge,
  renderUnclosedReportBadge,
} from "../utils/unclosed-report-badge.js";
import {
  getModeTokens,
  getNeutralTokens,
  getBadgeTokens,
  getSurfaceTokens,
} from "../utils/financial-report-theme.js";
import { onLanguageChange } from "../i18n.js";

class BulkPropertyReportsComponent {
  constructor() {
    this.properties = [];
    this.selectedProperties = new Set();
    this.lastClickedIndex = -1; // Track last clicked card for shift selection
    this._avatarInvestors = []; // Investors list (with linked properties) for the card image avatar badge
    this._closedStatus = {}; // {propertyId: boolean} report closed state for the selected month
    this._closedStatusKey = null; // "year-month" the statuses above belong to
    this.init();
  }

  init() {
    this.bindEvents();
    this.bindExtractionEvents();
    // Property cards carry the (translated) Stable/Unstable badges
    onLanguageChange(() => {
      if (this.properties.length) this.renderPropertyList();
    });
    this.loadProperties().then(() => this.loadAllInvestors());
    this.setDefaultDate();
    this.syncExtractionDefaults();
    fetchInvestorsForAvatarStack().then((investors) => {
      this._avatarInvestors = investors;
      this.renderPropertyList();
    });
  }

  bindEvents() {
    // Fetch reports button
    const fetchBtn = document.getElementById("fetchBulkReportsBtn");
    if (fetchBtn) {
      fetchBtn.addEventListener("click", () => {
        this.fetchBulkReports();
      });
    }

    // Select All / Deselect All toggle — deselects only when every property
    // is already selected, otherwise selects the rest.
    const toggleAllBtn = document.getElementById("toggleAllPropertiesBtn");
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", () => {
        if (this.areAllPropertiesSelected()) {
          this.deselectAllProperties();
        } else {
          this.selectAllProperties();
        }
      });
    }

    // Selected month/year drives the "not closed yet" reminder
    ["bulkReportMonth", "bulkReportYear"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        this.loadUnclosedReminder();
      });
    });

    // Grand View button — generates each selected property's full report
    // snapshot image (the same PNG "Capture Screenshot" produces on the
    // single-property page) and gathers them into one bulk viewer modal.
    // Purely additive/read-only; does not touch any of the profit/settlement
    // calculation logic above.
    const grandViewBtn = document.getElementById("grandViewReportsBtn");
    if (grandViewBtn) {
      grandViewBtn.addEventListener("click", () => {
        this.openGrandReportView();
      });
    }
  }

  selectAllProperties() {
    // Select all properties by adding them to the set
    this.properties.forEach((property) => {
      this.selectedProperties.add(property.propertyId);
    });
    this.updateSelectedCount();
    // Re-render to update checkmarks and selected styles
    this.renderPropertyList();
  }

  deselectAllProperties() {
    // Clear all selections
    this.selectedProperties.clear();
    this.updateSelectedCount();
    // Re-render to update checkmarks and selected styles
    this.renderPropertyList();
  }

  areAllPropertiesSelected() {
    return (
      this.properties.length > 0 &&
      this.properties.every((p) => this.selectedProperties.has(p.propertyId))
    );
  }

  updateSelectedCount() {
    const countEl = document.getElementById("selectedPropertiesCount");
    if (countEl) {
      const count = this.selectedProperties.size;
      countEl.textContent = `${count} ${
        count === 1 ? "property" : "properties"
      } selected`;
    }
    this.updateToggleAllButton();
  }

  // Keep the toggle's label in sync with the current selection.
  updateToggleAllButton() {
    const btn = document.getElementById("toggleAllPropertiesBtn");
    if (!btn) return;
    const allSelected = this.areAllPropertiesSelected();
    btn.innerHTML = allSelected
      ? '<i class="bi bi-x-lg me-1"></i>Deselect All'
      : '<i class="bi bi-check-all me-1"></i>Select All';
    btn.disabled = this.properties.length === 0;
  }

  // Fetch the closed state of every property's report for the selected
  // month, then re-render the grid so not-closed properties get the yellow
  // warning marker (and the header its "Not closed" count). A missing report
  // counts as not closed.
  async loadUnclosedReminder() {
    const month = document.getElementById("bulkReportMonth")?.value;
    const year = document.getElementById("bulkReportYear")?.value;
    if (!month || !year || !this.properties.length) {
      this._closedStatusKey = null;
      this.renderPropertyList();
      return;
    }

    // Hide while loading; a newer month/year change supersedes this one
    const key = `${year}-${month}`;
    this._closedStatusLoadingKey = key;
    this._closedStatusKey = null;
    this.renderPropertyList();

    const status =
      (await this._fetchClosedStatusBulk(year, month)) ||
      (await this._fetchClosedStatusPerProperty(year, month));
    if (this._closedStatusLoadingKey !== key) return;

    this._closedStatus = status;
    this._closedStatusKey = key;
    this.renderPropertyList();
  }

  // {propertyId: isClosed} for every property in one request, or null when
  // the endpoint is unavailable so the caller can fall back
  async _fetchClosedStatusBulk(year, month) {
    try {
      const ids = this.properties.map((p) => p.propertyId);
      const response = await API.get(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_STATUSES(year, month, ids),
      );
      if (!response.ok) return null;
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) return null;

      // Reports store propertyId uppercased — match the list's ids the same way
      const byId = new Map(result.data.map((s) => [String(s.propertyId).toUpperCase(), s]));
      const status = {};
      this.properties.forEach((property) => {
        const report = byId.get(String(property.propertyId).toUpperCase());
        if (report) status[property.propertyId] = !!report.isClosed;
      });
      return status;
    } catch (error) {
      console.debug("Bulk report statuses unavailable, fetching per property:", error);
      return null;
    }
  }

  // Fallback: fetch each property's full report for the month
  async _fetchClosedStatusPerProperty(year, month) {
    const status = {};
    await Promise.all(
      this.properties.map(async (property) => {
        try {
          const response = await API.get(
            API_CONFIG.ENDPOINTS.FINANCIAL_REPORT(property.propertyId, year, month),
          );
          if (!response.ok) return;
          const result = await response.json();
          status[property.propertyId] = !!(result.success && result.data?.isClosed);
        } catch (error) {
          console.debug(`Could not fetch report status for ${property.propertyId}:`, error);
        }
      }),
    );
    return status;
  }

  // "October 2026" for the month the loaded closed statuses belong to
  closedStatusMonthLabel() {
    if (!this._closedStatusKey) return "";
    const [year, month] = this._closedStatusKey.split("-");
    return new Date(year, month - 1, 1).toLocaleDateString("en-SG", {
      month: "long",
      year: "numeric",
    });
  }

  setDefaultDate() {
    const now = new Date();
    const monthSelect = document.getElementById("bulkReportMonth");
    const yearInput = document.getElementById("bulkReportYear");

    if (monthSelect) {
      monthSelect.value = now.getMonth() + 1;
    }

    if (yearInput) {
      yearInput.value = now.getFullYear();
    }
  }

  async loadProperties() {
    try {
      // Fetch all properties with pagination
      let allProperties = [];
      let currentPage = 1;
      const itemsPerPage = 50;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${currentPage}&limit=${itemsPerPage}`);
        const result = await response.json();

        if (result.success) {
          allProperties = allProperties.concat(result.properties || []);
          hasMorePages = result.pagination && currentPage < result.pagination.totalPages;
          currentPage++;
        } else {
          this.showError("Failed to load properties");
          hasMorePages = false;
        }
      }

      this.properties = allProperties;
      this.renderPropertyList();
      this.loadUnclosedReminder();
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showError("Error loading properties. Please try again.");
    }
  }

  renderPropertyList() {
    const container = document.getElementById("bulkPropertyList");
    if (!container) return;

    this.updateToggleAllButton();

    // Total / Stable / Unstable counts in the "Select Properties" card header
    // (white outline so the badges read on the blue header).
    const monthLabel = this.closedStatusMonthLabel();
    const [statusYear, statusMonth] = (this._closedStatusKey || "").split("-");
    const isUnclosed = (p) =>
      !!this._closedStatusKey && !this._closedStatus[p.propertyId];
    const statsEl = document.getElementById("bulkPropertyStats");
    if (statsEl) {
      const outline = "border:1px solid rgba(255,255,255,0.7);";
      statsEl.innerHTML =
        renderStabilityStatsBadges(this.properties, outline) +
        renderUnclosedCountBadge(
          (this.properties || []).filter(isUnclosed).length,
          monthLabel,
          outline,
        );
    }

    if (!this.properties || this.properties.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-building-slash me-2"></i>
          No properties available
        </div>
      `;
      return;
    }

    // CSS Grid — compact cards
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
    container.style.gap = "0.5rem";

    container.innerHTML = [...this.properties]
      .sort((a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0))
      .map((property, index) => {
        const isSelected = this.selectedProperties.has(property.propertyId);
        // Yellow warning marker: this month's report is not closed yet. Its
        // hover tooltip links to the report in a new tab.
        const unclosedBadge = isUnclosed(property)
          ? renderUnclosedReportBadge({
              property,
              year: statusYear,
              month: statusMonth,
              monthLabel,
            })
          : "";
        return `
      <div class="card property-select-card ${isSelected ? "selected" : ""} overflow-hidden"
           data-property-id="${property.propertyId}"
           data-property-index="${index}"
           style="cursor: pointer; transition: all 0.2s ease;">
        ${property.propertyImage
          ? `<div data-role="property-image" style="height: 55px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; position: relative;">
              <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
                   style="position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; font-size: 9px; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 2;">
                ${escapeHtml(property.propertyId.toString().substring(0, 3))}
              </div>
              ${renderPropertyImageAvatarBadge(this._avatarInvestors, property.propertyId, { size: 22, overlap: 9, max: 3 })}
              ${renderStabilityBannerBadge(property, 'bottom-0 start-0')}
              ${unclosedBadge ? `<div class="position-absolute bottom-0 end-0 p-1" style="z-index: 3; line-height: 1;">${unclosedBadge}</div>` : ""}
              <div data-role="selected-overlay" style="position: absolute; inset: 0; background: rgba(13,110,253,0.5); display: ${isSelected ? "flex" : "none"}; align-items: center; justify-content: center;"><i class="bi bi-check-circle-fill text-white" style="font-size: 1.4rem;"></i></div>
            </div>`
          : ""
        }
        <div data-role="card-body" class="d-flex flex-column align-items-center p-2" style="gap: 3px; background: ${isSelected ? "rgba(13,110,253,0.07)" : "#fff"};">
          ${!property.propertyImage
            ? `<div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
                   style="width: 28px; height: 28px; font-size: 11px; flex-shrink: 0;">
                ${escapeHtml(property.propertyId.toString().substring(0, 3))}
              </div>`
            : ""
          }
          <div class="text-center" style="line-height: 1.2; width: 100%;">
            <div class="fw-semibold text-truncate" style="font-size: 10px;" title="${escapeHtml(property.address || "")}">${escapeHtml(property.address || property.propertyId)}</div>
            <div class="text-muted text-truncate" style="font-size: 10px;">${escapeHtml(property.unit || "")}</div>
          </div>
          ${renderStabilityCardBadge(property)}
          ${!property.propertyImage ? unclosedBadge : ""}
          ${!property.propertyImage ? `<i data-role="no-image-check" class="bi bi-check-circle-fill text-primary" style="font-size: 0.9rem; display: ${isSelected ? "inline" : "none"};"></i>` : ""}
        </div>
      </div>
    `;
      })
      .join("");

    // Add click handlers to cards
    const cards = document.querySelectorAll(".property-select-card");
    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        const propertyId = card.dataset.propertyId;
        const currentIndex = parseInt(card.dataset.propertyIndex);

        // Check if Shift key is held for range selection
        if (
          e.shiftKey &&
          this.lastClickedIndex !== -1 &&
          this.lastClickedIndex !== currentIndex
        ) {
          // Range selection
          const startIndex = Math.min(this.lastClickedIndex, currentIndex);
          const endIndex = Math.max(this.lastClickedIndex, currentIndex);

          // Select all properties in the range
          for (let i = startIndex; i <= endIndex; i++) {
            if (this.properties[i]) {
              this.selectedProperties.add(this.properties[i].propertyId);
            }
          }

          this.updateSelectedCount();
          this.updateCardStyles();
        } else {
          // Single selection/deselection
          if (this.selectedProperties.has(propertyId)) {
            this.selectedProperties.delete(propertyId);
          } else {
            this.selectedProperties.add(propertyId);
          }

          this.lastClickedIndex = currentIndex;
          this.updateSelectedCount();
          this.updateCardStyles();
        }
      });

      // Add hover effect
      card.addEventListener("mouseenter", () => {
        if (!card.classList.contains("selected")) {
          card.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)";
        }
      });

      card.addEventListener("mouseleave", () => {
        if (!card.classList.contains("selected")) {
          card.style.boxShadow = "";
        }
      });
    });

    // Apply selected styles
    this.updateCardStyles();

    // Initial count update
    this.updateSelectedCount();
  }

  updateCardStyles() {
    const cards = document.querySelectorAll(".property-select-card");
    cards.forEach((card) => {
      const propertyId = card.dataset.propertyId;
      const isSelected = this.selectedProperties.has(propertyId);

      // Border/ring come from the .selected CSS rule (no size change).
      card.classList.toggle("selected", isSelected);

      const overlay = card.querySelector('[data-role="selected-overlay"]');
      if (overlay) overlay.style.display = isSelected ? "flex" : "none";

      const body = card.querySelector('[data-role="card-body"]');
      if (body) body.style.background = isSelected ? "rgba(13,110,253,0.07)" : "#fff";

      const check = card.querySelector('[data-role="no-image-check"]');
      if (check) check.style.display = isSelected ? "inline" : "none";
    });
  }

  // The % used for a report: the report's stored % first, otherwise the
  // investor's % in effect on the 1st of the report month (same lookup as
  // financial-reports.js _reportPercentage and the backend's getPercentageAtDate)
  reportPercentage(investor, report, propertyId, year, month) {
    const tx = report?.investorTransactions?.find(
      (t) => t.investorId === investor.investorId,
    );
    if (tx?.percentage != null) return Number(tx.percentage) || 0;
    const propertyData = investor.properties?.find(
      (p) => p.propertyId === propertyId,
    );
    if (!propertyData) return 0;
    const history = propertyData.history || [];
    if (history.length === 0) return Number(propertyData.percentage) || 0;
    const reportDate = Date.UTC(
      Number(report?.year ?? year),
      Number(report?.month ?? month) - 1,
      1,
    );
    const entry = history.find(
      (h) =>
        new Date(h.effectiveFrom).getTime() <= reportDate &&
        (!h.effectiveTo || new Date(h.effectiveTo).getTime() > reportDate),
    );
    return Number(entry?.percentage ?? propertyData.percentage) || 0;
  }

  // personInCharge → investor ID whose paid/received an item counts toward.
  // A member's items count toward their group when the group holds a share
  // and the member holds none of their own (same rule as the backend's
  // buildGroupOwnerResolver and financial-reports.js _groupContext). A member
  // of two groups holding the same property keeps their own items.
  buildGroupOwnerResolver(investors, pctById) {
    const groupsOf = new Map();
    investors.forEach((group) => {
      if (!group.isGroup || !((pctById.get(group.investorId) || 0) > 0)) return;
      (group.members || []).forEach((m) => {
        if ((pctById.get(m.investorId) || 0) > 0) return;
        groupsOf.set(m.investorId, [
          ...(groupsOf.get(m.investorId) || []),
          group.investorId,
        ]);
      });
    });
    return (personId) => {
      const groups = groupsOf.get(personId);
      return groups && groups.length === 1 ? groups[0] : personId;
    };
  }

  // Who may see each member's part of a group (admins by default; grantable
  // in User Management). Same check as financial-reports.js.
  canSeeGroupBreakdown() {
    return typeof window.canAccessModule === "function"
      ? window.canAccessModule("investor-group-breakdown")
      : !!window.isAdmin?.();
  }

  // One property's group result split per member, same formula as the
  // single-property report (financial-reports.js _groupBreakdown):
  //   member final = group profit share × member % + member paid − member received
  // Paid/received only count items that rolled up into the group. Anything
  // not owned by a member (unallocated %, items on the group itself, and the
  // group's already paid/received) goes to a "Group account" row, so the
  // rows always add up to the group's own final.
  computeGroupMemberBreakdown(
    groupRow,
    group,
    report,
    ownerOf,
    lookupInvestors = [],
  ) {
    if (!this.canSeeGroupBreakdown()) return null;
    const members = group?.members || [];
    // The server hides member % from users without the permission
    if (
      !members.length ||
      members.some((m) => typeof m.percentage !== "number")
    )
      return null;

    const sumOwn = (items, personId) =>
      (items || [])
        .filter(
          (x) =>
            !x.isPending &&
            x.personInCharge === personId &&
            ownerOf(personId) === group.investorId,
        )
        .reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0);
    const findInvestor = (id) =>
      lookupInvestors.find((i) => i.investorId === id) ||
      (this.allInvestors || []).find((i) => i.investorId === id);

    const rows = members.map((m) => {
      const inv = findInvestor(m.investorId);
      const share = Number(m.percentage) || 0;
      const profitShare = (groupRow.profitShare * share) / 100;
      const paid = sumOwn(report.expenses, m.investorId);
      const received = sumOwn(report.income, m.investorId);
      return {
        investorId: m.investorId,
        name: inv?.name || inv?.username || `Investor ${m.investorId}`,
        avatar: inv?.avatar || null,
        groupPercentage: share,
        profitShare,
        paid,
        received,
        final: profitShare + paid - received,
      };
    });

    const memberFinal = rows.reduce((sum, r) => sum + r.final, 0);
    const rest = groupRow.final - memberFinal;
    const allocated = rows.reduce((sum, r) => sum + r.groupPercentage, 0);
    const unallocated = Math.max(0, Math.round((100 - allocated) * 100) / 100);
    if (Math.abs(rest) >= 0.005 || unallocated > 0) {
      rows.push({
        investorId: `${group.investorId}:account`,
        name:
          unallocated > 0
            ? `Unallocated (${unallocated}% of group)`
            : "Group account",
        avatar: null,
        isRemainder: true,
        groupPercentage: unallocated,
        profitShare: (groupRow.profitShare * unallocated) / 100,
        paid: groupRow.expensesPaid - rows.reduce((s, r) => s + r.paid, 0),
        received:
          groupRow.incomeReceived - rows.reduce((s, r) => s + r.received, 0),
        final: rest,
      });
    }
    return rows;
  }

  // Sum each group's member breakdown across all fetched properties
  aggregateGroupBreakdowns(reports) {
    const groups = new Map();
    reports.forEach((r) => {
      (r.report?.investors || []).forEach((inv) => {
        if (!inv.memberBreakdown) return;
        if (!groups.has(inv.investorId)) {
          groups.set(inv.investorId, {
            investorId: inv.investorId,
            name: inv.investorName,
            avatar: inv.avatar,
            final: 0,
            propertyCount: 0,
            members: new Map(),
          });
        }
        const g = groups.get(inv.investorId);
        g.final += inv.final;
        g.propertyCount += 1;
        inv.memberBreakdown.forEach((m) => {
          if (!g.members.has(m.investorId)) {
            g.members.set(m.investorId, {
              ...m,
              profitShare: 0,
              paid: 0,
              received: 0,
              final: 0,
            });
          }
          const t = g.members.get(m.investorId);
          t.profitShare += m.profitShare;
          t.paid += m.paid;
          t.received += m.received;
          t.final += m.final;
        });
      });
    });
    return Array.from(groups.values()).map((g) => ({
      ...g,
      // Members first (largest share first), group account last; skip an
      // all-zero group account row
      members: Array.from(g.members.values())
        .filter(
          (m) =>
            !m.isRemainder ||
            Math.abs(m.final) >= 0.005 ||
            m.groupPercentage > 0,
        )
        .sort(
          (a, b) =>
            Number(!!a.isRemainder) - Number(!!b.isRemainder) ||
            b.groupPercentage - a.groupPercentage,
        ),
    }));
  }

  // Member rows nested under a group in the Investor Summary table (tree
  // style, like the financial report's investor distribution)
  renderGroupMemberSummaryRows(group) {
    if (!group) return "";
    const money = (v) => `${v < -0.005 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
    return group.members
      .map((m, i) => {
        const last = i === group.members.length - 1;
        const tone =
          m.final > 0.005
            ? "text-success"
            : m.final < -0.005
              ? "text-danger"
              : "text-muted";
        const avatar = m.isRemainder
          ? ""
          : m.avatar
            ? `<img src="${this.getOptimizedAvatarUrl(m.avatar, "small")}" alt="" class="rounded-circle me-2" style="width:22px;height:22px;object-fit:cover;" onerror="this.style.display='none'">`
            : `<span class="rounded-circle me-2 d-inline-flex align-items-center justify-content-center bg-secondary text-white" style="width:22px;height:22px;font-size:10px;">${escapeHtml((m.name || "?").charAt(0).toUpperCase())}</span>`;
        return `
          <tr class="small" style="background:#fafbfc;">
            <td class="ps-3 py-1 border-0">
              <div class="d-flex align-items-center">
                <span class="text-muted me-2" style="font-family:monospace;">${last ? "└" : "├"}</span>
                ${avatar}
                <span class="${m.isRemainder ? "fst-italic text-muted" : ""}">${escapeHtml(m.name)}</span>
                ${m.groupPercentage ? `<span class="text-muted ms-2">${m.groupPercentage}%</span>` : ""}
              </div>
            </td>
            <td class="py-1 border-0"></td>
            <td class="text-end pe-3 py-1 border-0"><span class="${tone}">${money(m.final)}</span></td>
            <td class="text-end pe-3 py-1 border-0">
              <small class="text-muted" title="Profit share ${money(m.profitShare)} + paid ${money(m.paid)} − received ${money(m.received)}">
                paid ${money(m.paid)} · recv ${money(m.received)}
              </small>
            </td>
          </tr>`;
      })
      .join("");
  }

  renderGroupBreakdownHtml(groupBreakdowns) {
    if (!groupBreakdowns.length) return "";
    const money = (v) => `${v < -0.005 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
    return groupBreakdowns
      .map((g) => {
        const status =
          g.final > 0.005
            ? `<span class="badge bg-success">Group receives ${money(g.final)}</span>`
            : g.final < -0.005
              ? `<span class="badge bg-danger">Group pays ${money(-g.final)}</span>`
              : `<span class="badge bg-secondary">Balanced</span>`;
        const rows = g.members
          .map((m) => {
            const finalClass =
              m.final > 0.005
                ? "text-success"
                : m.final < -0.005
                  ? "text-danger"
                  : "text-muted";
            const avatar = m.avatar
              ? `<img src="${this.getOptimizedAvatarUrl(m.avatar, "small")}" alt="" class="rounded-circle me-2" style="width:24px;height:24px;object-fit:cover;" onerror="this.style.display='none'">`
              : `<span class="rounded-circle me-2 d-inline-flex align-items-center justify-content-center bg-secondary text-white" style="width:24px;height:24px;font-size:11px;">${escapeHtml((m.name || "?").charAt(0).toUpperCase())}</span>`;
            return `
              <tr${m.isRemainder ? ' class="text-muted fst-italic"' : ""}>
                <td class="ps-2"><div class="d-flex align-items-center">${m.isRemainder ? "" : avatar}<span>${escapeHtml(m.name)}</span></div></td>
                <td class="text-end">${m.groupPercentage ? `${m.groupPercentage}%` : "—"}</td>
                <td class="text-end d-none d-md-table-cell">${money(m.profitShare)}</td>
                <td class="text-end d-none d-md-table-cell">${money(m.paid)}</td>
                <td class="text-end d-none d-md-table-cell">${money(m.received)}</td>
                <td class="text-end pe-2 fw-bold ${finalClass}">${money(m.final)}</td>
              </tr>`;
          })
          .join("");
        return `
          <div class="mt-3 border rounded">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 px-3 py-2 bg-light border-bottom">
              <div class="fw-bold"><i class="bi bi-people-fill me-2 text-primary"></i>Inside ${escapeHtml(g.name)} <small class="text-muted fw-normal">· ${g.propertyCount} propert${g.propertyCount === 1 ? "y" : "ies"}</small></div>
              ${status}
            </div>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead class="table-light small">
                  <tr>
                    <th class="ps-2">Member</th>
                    <th class="text-end">Group %</th>
                    <th class="text-end d-none d-md-table-cell">Profit share</th>
                    <th class="text-end d-none d-md-table-cell">Paid</th>
                    <th class="text-end d-none d-md-table-cell">Received</th>
                    <th class="text-end pe-2">Final</th>
                  </tr>
                </thead>
                <tbody class="small">${rows}</tbody>
              </table>
            </div>
            <div class="small text-muted px-3 py-2 border-top">
              Final = profit share + paid − received, summed over every property. Positive: ${escapeHtml(g.name)} owes the member. Negative: the member holds money for ${escapeHtml(g.name)}. Rows add up to ${escapeHtml(g.name)}'s ${money(g.final)}.
            </div>
          </div>`;
      })
      .join("");
  }

  async fetchBulkReports() {
    const month = document.getElementById("bulkReportMonth")?.value;
    const year = document.getElementById("bulkReportYear")?.value;

    if (!month || !year) {
      this.showError("Please select both month and year");
      return;
    }

    if (this.selectedProperties.size === 0) {
      this.showError("Please select at least one property");
      return;
    }

    // Show loading
    document.getElementById("bulkReportsLoading").style.display = "block";
    document.getElementById("bulkReportsResults").style.display = "none";

    try {
      const reports = [];

      // Fetch report for each selected property
      for (const propertyId of this.selectedProperties) {
        try {
          const response = await API.get(
            API_CONFIG.ENDPOINTS.FINANCIAL_REPORT(propertyId, year, month)
          );

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const report = result.data;

              // Fetch investors for this property and calculate distribution
              try {
                const investorsResponse = await API.get(
                  API_CONFIG.ENDPOINTS.INVESTORS_BY_PROPERTY(propertyId)
                );

                if (investorsResponse.ok) {
                  const investorsResult = await investorsResponse.json();

                  if (
                    investorsResult.success &&
                    investorsResult.data &&
                    investorsResult.data.length > 0
                  ) {
                    const totalIncome = report.totalIncome || 0;
                    const totalExpenses = report.totalExpenses || 0;
                    const netProfit = totalIncome - totalExpenses;

                    // Same rules as the single-property report
                    // (financial-reports.js _computeInvestorRows): the %
                    // in effect for the report month, and group members'
                    // items counted toward their group, so settlements
                    // are between the group and the other investors.
                    const propertyInvestors = investorsResult.data.filter(
                      (inv) =>
                        inv.properties?.some(
                          (p) => p.propertyId === propertyId,
                        ),
                    );
                    const pctById = new Map(
                      propertyInvestors.map((inv) => [
                        inv.investorId,
                        this.reportPercentage(
                          inv,
                          report,
                          propertyId,
                          year,
                          month,
                        ),
                      ]),
                    );
                    const ownerOf = this.buildGroupOwnerResolver(
                      propertyInvestors,
                      pctById,
                    );
                    const totalFor = (items, investorId) =>
                      (items || [])
                        .filter(
                          (x) =>
                            !x.isPending &&
                            ownerOf(x.personInCharge) === investorId,
                        )
                        .reduce(
                          (sum, x) => sum + (parseFloat(x.amount) || 0),
                          0,
                        );

                    report.investors = propertyInvestors
                      .map((investor) => {
                        const percentage =
                          pctById.get(investor.investorId) || 0;
                        const profitShare = (netProfit * percentage) / 100;

                        // Get already paid/received from investor transactions
                        const existingTransaction = report.investorTransactions
                          ? report.investorTransactions.find(
                              (t) => t.investorId === investor.investorId
                            )
                          : null;
                        const alreadyPaid =
                          existingTransaction?.alreadyPaid || 0;
                        const alreadyReceived =
                          existingTransaction?.alreadyReceived || 0;

                        // Paid / received for the property (pending items
                        // excluded); a group's include its members' items
                        const expensesPaidByInvestor = totalFor(
                          report.expenses,
                          investor.investorId,
                        );
                        const incomeReceivedByInvestor = totalFor(
                          report.income,
                          investor.investorId,
                        );

                        // Final = share − already paid + already received + paid − received
                        const final =
                          profitShare -
                          alreadyPaid +
                          alreadyReceived +
                          expensesPaidByInvestor -
                          incomeReceivedByInvestor;

                        // Members whose items rolled into their group, and
                        // anyone else with 0% and nothing to settle, drop out
                        if (
                          percentage === 0 &&
                          !alreadyPaid &&
                          !alreadyReceived &&
                          !expensesPaidByInvestor &&
                          !incomeReceivedByInvestor
                        ) {
                          return null;
                        }

                        return {
                          investorName: investor.name || investor.username,
                          investorId: investor.investorId,
                          avatar: investor.avatar || null,
                          isGroup: !!investor.isGroup,
                          sharePercentage: percentage,
                          profitShare: profitShare,
                          expensesPaid: expensesPaidByInvestor,
                          incomeReceived: incomeReceivedByInvestor,
                          alreadyPaid: alreadyPaid,
                          alreadyReceived: alreadyReceived,
                          final: final,
                          sgdAmount: final,
                        };
                      })
                      .filter((inv) => inv !== null);

                    // Each group's result split across its members
                    report.investors.forEach((row) => {
                      if (!row.isGroup) return;
                      const group = propertyInvestors.find(
                        (i) => i.investorId === row.investorId,
                      );
                      row.memberBreakdown = this.computeGroupMemberBreakdown(
                        row,
                        group,
                        report,
                        ownerOf,
                        investorsResult.data,
                      );
                    });

                    // Calculate per-property settlements
                    if (report.investors && report.investors.length > 0) {
                      report.settlements = this.calculatePropertySettlements(
                        report.investors
                      );
                    }
                  }
                }
              } catch (error) {
                console.error(
                  `Error fetching investors for ${propertyId}:`,
                  error
                );
              }

              reports.push({
                propertyId,
                propertyData: this.properties.find(
                  (p) => p.propertyId === propertyId
                ),
                report: report,
              });
            } else {
              // Report doesn't exist for this property
              reports.push({
                propertyId,
                propertyData: this.properties.find(
                  (p) => p.propertyId === propertyId
                ),
                report: null,
                error: "No report found",
              });
            }
          } else if (response.status === 404) {
            // Report not found
            reports.push({
              propertyId,
              propertyData: this.properties.find(
                (p) => p.propertyId === propertyId
              ),
              report: null,
              error: "No report found",
            });
          }
        } catch (error) {
          console.error(`Error fetching report for ${propertyId}:`, error);
          reports.push({
            propertyId,
            propertyData: this.properties.find(
              (p) => p.propertyId === propertyId
            ),
            report: null,
            error: "Error fetching report",
          });
        }
      }

      // Display results
      this.displayResults(reports, month, year);

      // Hide loading, show results
      document.getElementById("bulkReportsLoading").style.display = "none";
      document.getElementById("bulkReportsResults").style.display = "block";
    } catch (error) {
      console.error("Error fetching bulk reports:", error);
      document.getElementById("bulkReportsLoading").style.display = "none";
      this.showError("Error fetching reports. Please try again.");
    }
  }

  displayResults(reports, month, year) {
    const container = document.getElementById("bulkReportsContent");
    if (!container) return;

    const monthNames = [
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
    const monthName = monthNames[parseInt(month) - 1];

    // Calculate total profit and aggregate investor data
    let totalProfit = 0;
    let reportCount = 0;
    const investorTotals = new Map(); // Map<investorId, {name, totalFinal, totalSGD, properties: []}>

    reports.forEach((r) => {
      if (r.report) {
        const income = r.report.totalIncome || 0;
        const expenses = r.report.totalExpenses || 0;
        totalProfit += income - expenses;
        reportCount++;

        // Aggregate investor data
        if (r.report.investors && r.report.investors.length > 0) {
          r.report.investors.forEach((inv) => {
            if (!investorTotals.has(inv.investorId)) {
              investorTotals.set(inv.investorId, {
                investorId: inv.investorId,
                investorName: inv.investorName,
                avatar: inv.avatar || null,
                totalFinal: 0,
                totalSGD: 0,
                properties: [],
              });
            }
            const investorData = investorTotals.get(inv.investorId);
            investorData.totalFinal += inv.final;
            investorData.totalSGD += inv.sgdAmount || 0;
            investorData.properties.push({
              propertyId: r.propertyId,
              final: inv.final,
              sgdAmount: inv.sgdAmount || 0,
              sharePercentage: inv.sharePercentage,
            });
          });
        }
      }
    });

    // Create property ID to data mapping
    const propertyMap = new Map();
    reports.forEach((r) => {
      if (r.propertyData) {
        propertyMap.set(r.propertyId, r.propertyData);
      }
    });

    // Calculate settlement transactions between investors (SGD only)
    const settlements = this.calculateSettlementsForCurrency(investorTotals, propertyMap, reports, 'SGD');

    // Attach investorTotals to each settlement for VND reference display
    settlements.forEach(settlement => {
      settlement.investorTotalsMap = investorTotals;
    });

    // Save settlements + reports for image export
    this.lastSettlements = settlements;
    this.lastReports = reports;
    const groupBreakdowns = this.aggregateGroupBreakdowns(reports);
    this.lastGroupBreakdowns = groupBreakdowns;

    // Create investor summary HTML
    let investorSummaryHtml = "";
    if (investorTotals.size > 0) {
      const investorArray = Array.from(investorTotals.values()).sort(
        (a, b) => b.totalFinal - a.totalFinal
      );
      investorSummaryHtml = `
        <div class="card h-100 border-primary">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0">
              <i class="bi bi-person-badge me-2"></i>
              Investor Summary - Total Amounts Across All Properties
            </h5>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th class="ps-3">Investor</th>
                    <th class="text-center">Properties</th>
                    <th class="text-end pe-3">Amount (SGD)</th>
                    <th class="text-end pe-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${investorArray
                    .map(
                      (inv) => {
                        const hasSGD = Math.abs(inv.totalSGD) >= 0.01;
                        return `
                    <tr>
                      <td class="ps-3">
                        <strong>${escapeHtml(inv.investorName)}</strong>
                        <br>
                        <small class="text-muted">ID: ${inv.investorId}</small>
                      </td>
                      <td class="text-center">
                        <span class="badge bg-secondary">${
                          inv.properties.length
                        }</span>
                      </td>
                      <td class="text-end pe-3">
                        ${hasSGD ? `
                        <span class="fs-6 fw-bold ${
                          inv.totalSGD >= 0 ? "text-success" : "text-danger"
                        }">
                          $${inv.totalSGD.toFixed(2)}
                        </span>
                        ` : '<span class="text-muted">-</span>'}
                      </td>
                      <td class="text-end pe-3">
                        ${
                          hasSGD && inv.totalSGD > 0
                            ? '<span class="badge bg-success">Will Receive</span>'
                            : hasSGD && inv.totalSGD < 0
                            ? '<span class="badge bg-danger">Must Pay</span>'
                            : '<span class="badge bg-secondary">Balanced</span>'
                        }
                      </td>
                    </tr>
                    ${this.renderGroupMemberSummaryRows(groupBreakdowns.find((g) => g.investorId === inv.investorId))}
                  `;
                      }
                    )
                    .join("")}
                </tbody>
                <tfoot class="table-light">
                  <tr>
                    <td colspan="4" class="text-center py-2">
                      <small class="text-muted">
                        <i class="bi bi-info-circle me-1"></i>
                        Positive amounts indicate investor will receive money. Negative amounts indicate investor must pay.
                      </small>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    // Create VND reference section HTML (completely separate) - pass reports directly
    let vndReferenceHtml = this.renderAllVNDReferences(reports, investorTotals);

    // Create settlement instructions HTML
    let settlementHtml = "";
    if (settlements.length > 0) {
      settlementHtml = `
        <div class="card h-100 border-success">
          <div class="card-header bg-success text-white">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0">
                <i class="bi bi-arrow-left-right me-2"></i>
                Settlement Instructions - How to Transfer Money
              </h5>
              <button
                id="exportSettlementBtn"
                class="btn btn-sm btn-light me-1"
                title="Export as image (copies to clipboard)"
                style="border: none;">
                <i class="bi bi-image"></i> Image
              </button>
              <button
                id="exportSettlementByPayerBtn"
                class="btn btn-sm btn-light me-1"
                title="Export a phone-friendly image grouped by who pays"
                style="border: none;">
                <i class="bi bi-person-lines-fill"></i> By payer
              </button>
              <button
                id="copySettlementBtn"
                class="btn btn-sm btn-light me-1"
                title="Copy settlement instructions to clipboard"
                style="border: none;">
                <i class="bi bi-clipboard"></i> Copy
              </button>
              <button
                id="copySettlementExcelBtn"
                class="btn btn-sm btn-light"
                title="Copy as a table to paste into Excel / Google Sheets"
                style="border: none;">
                <i class="bi bi-file-earmark-excel text-success"></i> Excel
              </button>
            </div>
          </div>
          <div class="card-body" id="settlementInstructionsContent">
            <div class="alert alert-info mb-3">
              <i class="bi bi-lightbulb me-2"></i>
              <strong>How to settle:</strong> Follow these ${
                settlements.length
              } transaction${
        settlements.length > 1 ? "s" : ""
      } to settle all debts between investors. Transactions are netted across all properties.
            </div>
            <div class="list-group">
              ${settlements
                .map(
                  (settlement, index) => `
                <div class="list-group-item">
                  <div class="d-flex align-items-start">
                    <div class="me-3">
                      <span class="badge bg-primary rounded-circle" style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">
                        ${index + 1}
                      </span>
                    </div>
                    <div class="flex-grow-1">
                      <div class="d-flex align-items-center justify-content-between flex-wrap">
                        <div class="mb-1 mb-md-0 d-flex align-items-center">
                          ${
                            settlement.fromAvatar
                              ? `
                            <img src="${this.getOptimizedAvatarUrl(
                              settlement.fromAvatar,
                              "small"
                            )}"
                                 alt="${escapeHtml(settlement.fromName)}"
                                 class="rounded-circle me-2"
                                 style="width: 32px; height: 32px; object-fit: cover;"
                                 onerror="this.style.display='none'">
                          `
                              : `
                            <div class="rounded-circle me-2 d-flex align-items-center justify-content-center"
                                 style="width: 32px; height: 32px; background-color: #dc3545; color: white; font-weight: bold; font-size: 14px;">
                              ${escapeHtml(
                                settlement.fromName.charAt(0).toUpperCase()
                              )}
                            </div>
                          `
                          }
                          <strong class="text-danger">${escapeHtml(
                            settlement.fromName
                          )}</strong>
                          <span class="mx-2">
                            <i class="bi bi-arrow-right text-primary"></i>
                          </span>
                          ${
                            settlement.toAvatar
                              ? `
                            <img src="${this.getOptimizedAvatarUrl(
                              settlement.toAvatar,
                              "small"
                            )}"
                                 alt="${escapeHtml(settlement.toName)}"
                                 class="rounded-circle me-2"
                                 style="width: 32px; height: 32px; object-fit: cover;"
                                 onerror="this.style.display='none'">
                          `
                              : `
                            <div class="rounded-circle me-2 d-flex align-items-center justify-content-center"
                                 style="width: 32px; height: 32px; background-color: #198754; color: white; font-weight: bold; font-size: 14px;">
                              ${escapeHtml(
                                settlement.toName.charAt(0).toUpperCase()
                              )}
                            </div>
                          `
                          }
                          <strong class="text-success">${escapeHtml(
                            settlement.toName
                          )}</strong>
                        </div>
                        <div>
                          <span class="badge settlement-total-badge fs-6 px-3 py-2" style="background: linear-gradient(135deg, #dc3545, #198754); color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                            ${settlement.currency === 'VND'
                              ? `₫${settlement.amount.toLocaleString('vi-VN', {maximumFractionDigits: 0})}`
                              : `$${settlement.amount.toFixed(2)}`
                            }
                          </span>
                        </div>
                      </div>
                      ${
                        settlement.propertyBreakdown &&
                        settlement.propertyBreakdown.length > 0
                          ? `
                        <div class="mt-2 ps-3 border-start border-3 border-info">
                          <small class="text-muted d-block mb-1"><strong>Step-by-step calculation:</strong></small>
                          ${settlement.propertyBreakdown
                            .map((prop) => {
                              const isNegative = prop.amount < 0;
                              const isPositive = prop.amount > 0;
                              const displayAmount = Math.abs(prop.amount);

                              return `
                            <div class="d-flex justify-content-between align-items-center py-1">
                              <small class="text-muted">
                                <i class="bi bi-building me-1"></i>
                                ${escapeHtml(
                                  prop.propertyName || prop.propertyId
                                )}
                              </small>
                              <small class="badge ${
                                isNegative ? "bg-success" : isPositive ? "bg-danger" : "bg-secondary"
                              } d-flex align-items-center gap-1">
                                ${isNegative ? '<i class="bi bi-plus-circle-fill"></i> +' : isPositive ? '<i class="bi bi-dash-circle-fill"></i> -' : ''}$${displayAmount.toFixed(2)}
                              </small>
                            </div>
                          `;
                            })
                            .join("")}
                          <div class="d-flex justify-content-between align-items-center pt-2 mt-2 border-top border-2" style="background: linear-gradient(135deg, rgba(220,53,69,0.08), rgba(25,135,84,0.08)); border-radius: 6px; padding: 6px 8px;">
                            <small class="fw-bold text-dark">
                              <i class="bi bi-calculator me-1"></i>
                              Net Amount to Transfer
                            </small>
                            <span class="fw-bold text-dark" style="font-size: 0.95rem;">$${settlement.amount.toFixed(2)}</span>
                          </div>
                        </div>
                      `
                          : `
                        <small class="text-muted d-block mt-1">
                          ${escapeHtml(settlement.fromName)} pays $${settlement.amount.toFixed(2)} to ${escapeHtml(settlement.toName)}
                        </small>
                      `
                      }
                    </div>
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
            ${this.renderGroupBreakdownHtml(groupBreakdowns)}
            ${
              settlements.length > 0
                ? `
              <div class="mt-3 p-3 bg-light rounded">
                <h6 class="mb-2">
                  <i class="bi bi-calculator me-2"></i>Summary
                </h6>
                <ul class="mb-0">
                  <li><strong>Total Transactions:</strong> ${
                    settlements.length
                  }</li>
                  <li><strong>Total Amount:</strong> $${settlements
                    .reduce((sum, s) => sum + s.amount, 0)
                    .toFixed(2)}</li>
                </ul>
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    } else if (investorTotals.size > 0) {
      // All balanced
      const allBalanced = Array.from(investorTotals.values()).every(
        (inv) => Math.abs(inv.totalFinal) < 0.01
      );
      if (allBalanced) {
        settlementHtml = `
          <div class="alert alert-success">
            <i class="bi bi-check-circle me-2"></i>
            <strong>All Settled!</strong> All investors are balanced. No transfers needed.
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="alert alert-info mb-4">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <i class="bi bi-calendar-check me-2"></i>
            <strong>Report Period:</strong> ${monthName} ${year}
          </div>
          <div>
            <strong>Total Net Profit:</strong>
            <span class="fs-5 ${
              totalProfit >= 0 ? "text-success" : "text-danger"
            }">
              $${totalProfit.toFixed(2)}
            </span>
          </div>
        </div>
        <small class="text-muted">Showing ${reportCount} of ${
      reports.length
    } reports</small>
      </div>

      <div class="row mb-4">
        <div class="col-lg-6 mb-4 mb-lg-0">
          ${investorSummaryHtml}
        </div>
        <div class="col-lg-6">
          ${settlementHtml}
        </div>
      </div>

      ${vndReferenceHtml}

      <h5 class="mb-3">
        <i class="bi bi-building me-2"></i>
        Property Details
      </h5>
      <div class="row">
        ${reports
          .map((item) => {
            if (!item.report) {
              return `
                <div class="col-md-6 col-lg-3 mb-4">
                  <div class="card h-100 border-warning">
                    <div class="card-body">
                      <h5 class="card-title">
                        <i class="bi bi-building me-2"></i>
                        ${escapeHtml(item.propertyId)}
                      </h5>
                      <p class="card-text text-muted small">
                        ${escapeHtml(
                          item.propertyData?.address || "No address"
                        )}
                      </p>
                      <hr>
                      <div class="text-center text-warning py-3">
                        <i class="bi bi-exclamation-triangle fs-1"></i>
                        <p class="mt-2 mb-0">${
                          item.error || "No report available"
                        }</p>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }

            const income = item.report.totalIncome || 0;
            const expenses = item.report.totalExpenses || 0;
            const netProfit = income - expenses;
            const isClosed = item.report.isClosed || false;

            return `
              <div class="col-md-6 col-lg-3 mb-4">
                <div class="card h-100 ${
                  netProfit >= 0 ? "border-success" : "border-danger"
                }">
                  <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                      <h5 class="card-title mb-0">
                        <i class="bi bi-building me-2"></i>
                        ${escapeHtml(item.propertyId)}
                      </h5>
                      ${
                        isClosed
                          ? '<span class="badge bg-secondary">Closed</span>'
                          : '<span class="badge bg-info">Open</span>'
                      }
                    </div>
                    <p class="card-text text-muted small mb-3">
                      ${escapeHtml(item.propertyData?.address || "No address")}
                    </p>
                    <hr>
                    <div class="mb-3">
                      <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Total Income:</span>
                        <span class="text-success fw-bold">$${income.toFixed(
                          2
                        )}</span>
                      </div>
                      <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Total Expenses:</span>
                        <span class="text-danger fw-bold">$${expenses.toFixed(
                          2
                        )}</span>
                      </div>
                      <hr>
                      <div class="d-flex justify-content-between">
                        <span class="fw-bold">Net Profit:</span>
                        <span class="fw-bold fs-5 ${
                          netProfit >= 0 ? "text-success" : "text-danger"
                        }">
                          $${netProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    ${
                      item.report.investors && item.report.investors.length > 0
                        ? `
                      <div class="mt-3 pt-3 border-top">
                        <h6 class="text-muted mb-2">
                          <i class="bi bi-person-badge me-1"></i>
                          Investor Distribution (${
                            item.report.investors.length
                          })
                        </h6>
                        <div class="table-responsive">
                          <table class="table table-sm table-hover mb-0">
                            <thead class="table-light">
                              <tr>
                                <th>Investor</th>
                                <th class="text-end">Share %</th>
                                <th class="text-end">Amount (SGD)</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${item.report.investors
                                .map(
                                  (inv) => {
                                    const hasSGD = Math.abs(inv.sgdAmount || 0) >= 0.01;
                                    return `
                                <tr>
                                  <td>
                                    <small class="fw-bold">${escapeHtml(
                                      inv.investorName
                                    )}</small>
                                  </td>
                                  <td class="text-end">
                                    <small>${inv.sharePercentage}%</small>
                                  </td>
                                  <td class="text-end">
                                    ${hasSGD ? `
                                    <small class="fw-bold ${
                                      inv.sgdAmount >= 0
                                        ? "text-success"
                                        : "text-danger"
                                    }">
                                      $${inv.sgdAmount.toFixed(2)}
                                    </small>
                                    ` : '<small class="text-muted">-</small>'}
                                  </td>
                                </tr>
                              `;
                                  }
                                )
                                .join("")}
                            </tbody>
                          </table>
                        </div>

                        ${
                          item.report.settlements &&
                          item.report.settlements.length > 0
                            ? `
                          <div class="mt-3 p-2 bg-light rounded">
                            <h6 class="small mb-2 text-success">
                              <i class="bi bi-arrow-left-right me-1"></i>
                              Settlement for this property:
                            </h6>
                            <div class="list-group list-group-flush">
                              ${item.report.settlements
                                .map(
                                  (settlement) => `
                                <div class="list-group-item px-2 py-1 bg-transparent border-0">
                                  <small>
                                    <strong class="text-danger">${escapeHtml(
                                      settlement.fromName
                                    )}</strong>
                                    <i class="bi bi-arrow-right mx-1 text-primary"></i>
                                    <strong class="text-success">${escapeHtml(
                                      settlement.toName
                                    )}</strong>
                                    <span class="badge ms-2" style="background: linear-gradient(135deg, #dc3545, #198754); color: #fff;">$${settlement.amount.toFixed(2)}</span>
                                  </small>
                                </div>
                              `
                                )
                                .join("")}
                            </div>
                          </div>
                        `
                            : ""
                        }
                      </div>
                    `
                        : ""
                    }
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    // Bind copy button event listener after rendering
    this.bindCopySettlementButton();
    this.bindExportSettlementButton();
  }

  bindCopySettlementButton() {
    const copyBtn = document.getElementById("copySettlementBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        this.copySettlementInstructions();
      });
    }
    const excelBtn = document.getElementById("copySettlementExcelBtn");
    if (excelBtn) {
      excelBtn.addEventListener("click", () =>
        this.copySettlementAsSpreadsheet(excelBtn),
      );
    }
  }

  /*
   * Settlement as a spreadsheet table (paste into Excel / Google Sheets),
   * grouped by who pays, one row per property line. Built to read at a
   * glance: each payer's name is one merged cell over all their rows, and
   * each transfer's #, recipient and "Total to send" are merged over that
   * transfer's property rows. "#" is the transfer number on the page and
   * in the image.
   *
   * Amounts are plain numbers (no $ or thousands separators) so they paste
   * as numbers. "Amount (SGD)" is what a property adds to the transfer
   * (negative = it reduces it); a transfer's amounts add up to its "Total
   * to send". Ends with the grand total and the number of transfers.
   *
   * Returns rows of cells: { v, rowspan?, num?, strong? }, or null where a
   * merged cell above covers that spot.
   */
  buildSettlementSpreadsheetRows() {
    const settlements = this.lastSettlements || [];
    const num = (v) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
    const monthLabel =
      document
        .getElementById("bulkReportMonth")
        ?.selectedOptions?.[0]?.textContent?.trim() || "";
    const year = document.getElementById("bulkReportYear")?.value || "";
    const linesOf = (st) =>
      Array.isArray(st.propertyBreakdown) && st.propertyBreakdown.length
        ? st.propertyBreakdown
        : [{ propertyName: "", amount: st.amount }];

    // Group transfers by payer, keeping each payer's transfers in page
    // order; payers who pay the most come first
    const byFrom = new Map();
    settlements.forEach((st, i) => {
      if (!byFrom.has(st.fromName))
        byFrom.set(st.fromName, { total: 0, items: [] });
      const g = byFrom.get(st.fromName);
      g.total += st.amount;
      g.items.push({ st, n: String(i + 1) });
    });
    const groups = [...byFrom.entries()].sort(
      (a, b) => b[1].total - a[1].total,
    );

    const COLS = 6;
    const rows = [
      [
        {
          v: `Settlement ${[monthLabel, year].filter(Boolean).join(" ")}`.trim(),
          strong: true,
        },
      ],
      [
        "#",
        "From (pays)",
        "To (receives)",
        "Property",
        "Amount (SGD)",
        "Total to send (SGD)",
      ].map((v) => ({
        v,
        header: true,
      })),
    ];
    groups.forEach(([fromName, g]) => {
      const groupRows = g.items.reduce(
        (sum, { st }) => sum + linesOf(st).length,
        0,
      );
      let firstOfGroup = true;
      g.items.forEach(({ st, n }) => {
        const lines = linesOf(st);
        lines.forEach((line, li) => {
          const first = li === 0;
          rows.push([
            first ? { v: n, rowspan: lines.length } : null,
            firstOfGroup
              ? { v: fromName, rowspan: groupRows, strong: true }
              : null,
            first ? { v: st.toName, rowspan: lines.length } : null,
            { v: line.propertyName || line.propertyId || "" },
            // Breakdown amounts already add up to the transfer amount
            { v: num(line.amount), num: true },
            first
              ? {
                  v: num(st.amount),
                  rowspan: lines.length,
                  num: true,
                  strong: true,
                }
              : null,
          ]);
          firstOfGroup = false;
        });
      });
    });
    const total = settlements.reduce((sum, st) => sum + st.amount, 0);
    rows.push([]);
    rows.push([
      { v: "" },
      { v: "" },
      { v: "" },
      { v: "" },
      { v: "Total", strong: true },
      { v: num(total), num: true, strong: true },
    ]);
    rows.push([
      { v: "" },
      { v: "" },
      { v: "" },
      { v: "" },
      { v: "Transfers", strong: true },
      { v: String(settlements.length), strong: true },
    ]);
    rows.COLS = COLS;
    return rows;
  }

  async copySettlementAsSpreadsheet(btn) {
    const rows = this.buildSettlementSpreadsheetRows();
    // Tabs/newlines inside a cell would split it, so flatten them
    const clean = (c) =>
      String(c?.v ?? "")
        .replace(/[\t\r\n]+/g, " ")
        .trim();

    // Plain text (no merges possible): a merged value sits on its first row
    const tsv = rows
      .map((r) => r.map((c) => (c ? clean(c) : "")).join("\t"))
      .join("\n");

    // HTML table: Excel and Google Sheets keep rowspan as merged cells
    const border = "border:1px solid #b7b7b7;";
    const html = `<table style="border-collapse:collapse;">${rows
      .map((r) => {
        if (r.length === 0) return `<tr><td colspan="${rows.COLS}"></td></tr>`;
        return `<tr>${r
          .map((c) => {
            if (!c) return ""; // covered by a merged cell above
            const tag = c.header ? "th" : "td";
            const attrs = c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : "";
            const styles = [
              c.header || clean(c) ? border : "",
              "vertical-align:middle;",
              c.header
                ? "background:#d9ead3;font-weight:bold;text-align:center;"
                : "",
              c.strong ? "font-weight:bold;" : "",
              c.num ? "text-align:right;mso-number-format:'0.00';" : "",
            ].join("");
            return `<${tag}${attrs} style="${styles}">${escapeHtml(clean(c))}</${tag}>`;
          })
          .join("")}</tr>`;
      })
      .join("")}</table>`;

    const flash = (ok) => {
      const original = btn.innerHTML;
      btn.innerHTML = ok
        ? '<i class="bi bi-check-lg"></i> Copied!'
        : '<i class="bi bi-x-lg"></i> Failed';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = original;
        btn.disabled = false;
      }, 2000);
    };

    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([tsv], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(tsv);
      }
      flash(true);
      if (typeof showToast === "function") {
        showToast(
          "Table copied — paste into Excel or Google Sheets",
          "success",
          3500,
        );
      }
    } catch (err) {
      console.error("Spreadsheet copy failed:", err);
      flash(false);
    }
  }

  copySettlementInstructions() {
    const contentElement = document.getElementById("settlementInstructionsContent");
    if (!contentElement) {
      console.error("Settlement instructions content not found");
      return;
    }

    // Build simple formatted text
    let textToCopy = "SETTLEMENT INSTRUCTIONS\n";
    textToCopy += "=".repeat(80) + "\n\n";

    // Get all settlement items
    const settlementItems = contentElement.querySelectorAll(".list-group-item");

    if (settlementItems.length === 0) {
      textToCopy += "No settlements needed.\n";
    } else {
      settlementItems.forEach((item, index) => {
        const fromElement = item.querySelector(".text-danger");
        const toElement = item.querySelector(".text-success");
        const amountElement = item.querySelector(".badge.settlement-total-badge");

        const fromName = fromElement ? fromElement.textContent.trim() : "";
        const toName = toElement ? toElement.textContent.trim() : "";
        const amount = amountElement ? amountElement.textContent.trim() : "";

        // Main transaction
        textToCopy += `${index + 1}. ${fromName} → ${toName}  |  ${amount}\n`;

        // Check for property breakdown
        const breakdownContainer = item.querySelector(".border-start.border-3.border-info");
        if (breakdownContainer) {
          const propertyRows = breakdownContainer.querySelectorAll(".d-flex.justify-content-between.align-items-center.py-1");

          if (propertyRows.length > 0) {
            // Collect properties for alignment
            const properties = [];
            propertyRows.forEach((row) => {
              const propertyText = row.querySelector(".text-muted");
              const propertyAmount = row.querySelector(".badge");

              if (propertyText && propertyAmount) {
                // Extract just the property name/address, clean it up
                let propName = propertyText.textContent
                  .trim()
                  .replace(/\s+/g, ' ')
                  .replace(/[\u{1F3E0}\u{1F3E2}\u{1F3E6}]/gu, '')
                  .trim();

                const propAmount = propertyAmount.textContent.trim();
                properties.push({ name: propName, amount: propAmount });
              }
            });

            // Find max property name length for this transaction
            const maxPropLength = Math.max(...properties.map(p => p.name.length), 40);

            // Output properties aligned
            properties.forEach((prop) => {
              const paddedName = prop.name.padEnd(maxPropLength, ' ');
              textToCopy += `     ${paddedName}  |  ${prop.amount}\n`;
            });
          }
        }

        textToCopy += "\n";
      });

      // Summary
      const summarySection = contentElement.querySelector(".bg-light.rounded");
      if (summarySection) {
        textToCopy += "=".repeat(80) + "\n";
        const summaryText = summarySection.innerText || summarySection.textContent;
        const lines = summaryText.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.includes('Summary'));

        lines.forEach(line => {
          if (line) textToCopy += line + "\n";
        });
      }
    }

    // Copy to clipboard
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        // Show success feedback
        this.showCopySuccess();
      })
      .catch((err) => {
        console.error("Failed to copy:", err);
        this.showCopyError();
      });
  }

  showCopySuccess() {
    const copyBtn = document.getElementById("copySettlementBtn");
    if (!copyBtn) return;

    // Save original content
    const originalHTML = copyBtn.innerHTML;

    // Show success state
    copyBtn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
    copyBtn.classList.add("btn-success");
    copyBtn.classList.remove("btn-light");
    copyBtn.disabled = true;

    // Reset after 2 seconds
    setTimeout(() => {
      copyBtn.innerHTML = originalHTML;
      copyBtn.classList.remove("btn-success");
      copyBtn.classList.add("btn-light");
      copyBtn.disabled = false;
    }, 2000);
  }

  showCopyError() {
    const copyBtn = document.getElementById("copySettlementBtn");
    if (!copyBtn) return;

    // Save original content
    const originalHTML = copyBtn.innerHTML;

    // Show error state
    copyBtn.innerHTML = '<i class="bi bi-x-lg"></i> Failed';
    copyBtn.classList.add("btn-danger");
    copyBtn.classList.remove("btn-light");

    // Reset after 2 seconds
    setTimeout(() => {
      copyBtn.innerHTML = originalHTML;
      copyBtn.classList.remove("btn-danger");
      copyBtn.classList.add("btn-light");
    }, 2000);
  }

  calculatePropertySettlements(investors) {
    const settlements = [];

    // Calculate settlements for SGD (all amounts in SGD)
    const sgdInvestors = investors.filter(
      (inv) => Math.abs(inv.sgdAmount || 0) >= 0.01
    );
    if (sgdInvestors.length > 0) {
      const sgdCreditors = sgdInvestors
        .filter((inv) => inv.sgdAmount > 0)
        .map((inv) => ({ ...inv, remaining: inv.sgdAmount }))
        .sort((a, b) => b.remaining - a.remaining);

      const sgdDebtors = sgdInvestors
        .filter((inv) => inv.sgdAmount < 0)
        .map((inv) => ({ ...inv, remaining: Math.abs(inv.sgdAmount) }))
        .sort((a, b) => b.remaining - a.remaining);

      let creditorIndex = 0;
      let debtorIndex = 0;

      while (creditorIndex < sgdCreditors.length && debtorIndex < sgdDebtors.length) {
        const creditor = sgdCreditors[creditorIndex];
        const debtor = sgdDebtors[debtorIndex];

        const settlementAmount = Math.min(creditor.remaining, debtor.remaining);

        if (settlementAmount >= 0.01) {
          settlements.push({
            fromId: debtor.investorId,
            fromName: debtor.investorName,
            toId: creditor.investorId,
            toName: creditor.investorName,
            amount: settlementAmount,
            currency: 'SGD',
          });
        }

        creditor.remaining -= settlementAmount;
        debtor.remaining -= settlementAmount;

        if (creditor.remaining < 0.01) {
          creditorIndex++;
        }
        if (debtor.remaining < 0.01) {
          debtorIndex++;
        }
      }
    }

    return settlements;
  }

  calculateSettlementsForCurrency(investorTotals, propertyMap, reports, currency) {
    // Build settlements based on property-level relationships for a specific currency
    const settlementMap = new Map(); // Key: "fromId->toId", Value: {settlement data}

    // Build a map of property reports for easy access
    const propertyReportsMap = new Map();
    if (reports && Array.isArray(reports)) {
      reports.forEach(r => {
        if (r.report) {
          propertyReportsMap.set(r.propertyId, r.report);
        }
      });
    }

    // Get all unique property IDs
    const propertyIds = new Set();
    for (const investor of investorTotals.values()) {
      for (const prop of investor.properties) {
        propertyIds.add(prop.propertyId);
      }
    }

    // For each property, calculate settlements within that property for this currency
    for (const propertyId of propertyIds) {
      // Get all investors for this property
      const propertyInvestors = [];
      for (const investor of investorTotals.values()) {
        const prop = investor.properties.find(
          (p) => p.propertyId === propertyId
        );
        if (prop) {
          const finalAmount = prop.sgdAmount || 0; // All amounts in SGD
          propertyInvestors.push({
            investorId: investor.investorId,
            investorName: investor.investorName,
            avatar: investor.avatar,
            final: finalAmount,
          });
        }
      }

      // Separate into creditors and debtors for this property
      const creditors = propertyInvestors
        .filter((inv) => inv.final > 0.01)
        .map((inv) => ({ ...inv, remaining: inv.final }))
        .sort((a, b) => b.remaining - a.remaining);

      const debtors = propertyInvestors
        .filter((inv) => inv.final < -0.01)
        .map((inv) => ({ ...inv, remaining: Math.abs(inv.final) }))
        .sort((a, b) => b.remaining - a.remaining);

      // Match debtors with creditors for this property
      let creditorIndex = 0;
      let debtorIndex = 0;

      while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
        const creditor = creditors[creditorIndex];
        const debtor = debtors[debtorIndex];

        const settlementAmount = Math.min(creditor.remaining, debtor.remaining);

        if (settlementAmount >= 0.01) {
          const settlementKey = `${debtor.investorId}->${creditor.investorId}`;

          if (!settlementMap.has(settlementKey)) {
            settlementMap.set(settlementKey, {
              fromId: debtor.investorId,
              fromName: debtor.investorName,
              fromAvatar: debtor.avatar || null,
              toId: creditor.investorId,
              toName: creditor.investorName,
              toAvatar: creditor.avatar || null,
              amount: 0,
              currency: currency,
              propertyBreakdown: [],
            });
          }

          const settlement = settlementMap.get(settlementKey);
          const propertyData = propertyMap ? propertyMap.get(propertyId) : null;

          // Get VND breakdown for this property - show VND amounts the receiver (creditor) received
          const vndBreakdown = this.getVNDBreakdownForProperty(propertyId, propertyReportsMap, creditor.investorId);

          settlement.propertyBreakdown.push({
            propertyId: propertyId,
            propertyName: propertyData
              ? [propertyData.unit, propertyData.address].filter(Boolean).join(', ') || propertyId
              : propertyId,
            amount: settlementAmount,
            vndBreakdown: vndBreakdown, // Add VND reference info
          });
          settlement.amount += settlementAmount;

          // Update remaining amounts
          creditor.remaining -= settlementAmount;
          debtor.remaining -= settlementAmount;
        }

        // Move to next creditor/debtor if current one is settled
        if (creditor.remaining < 0.01) {
          creditorIndex++;
        }
        if (debtor.remaining < 0.01) {
          debtorIndex++;
        }
      }
    }

    // Net out bilateral transactions (A→B and B→A)
    const nettedSettlements = [];
    const processed = new Set();

    for (const [key, settlement] of settlementMap.entries()) {
      if (processed.has(key)) continue;

      const reverseKey = `${settlement.toId}->${settlement.fromId}`;
      const reverseSettlement = settlementMap.get(reverseKey);

      if (reverseSettlement && !processed.has(reverseKey)) {
        // Net out the two settlements
        const netAmount = settlement.amount - reverseSettlement.amount;

        if (Math.abs(netAmount) >= 0.01) {
          // Combine property breakdowns, netting amounts for same properties
          const breakdownMap = new Map();

          // Add original direction amounts
          for (const prop of settlement.propertyBreakdown) {
            breakdownMap.set(prop.propertyId, {
              propertyId: prop.propertyId,
              propertyName: prop.propertyName,
              amount: prop.amount,
            });
          }

          // Subtract reverse direction amounts
          for (const prop of reverseSettlement.propertyBreakdown) {
            if (breakdownMap.has(prop.propertyId)) {
              const existing = breakdownMap.get(prop.propertyId);
              existing.amount -= prop.amount;
              if (Math.abs(existing.amount) < 0.01) {
                breakdownMap.delete(prop.propertyId);
              }
            } else {
              breakdownMap.set(prop.propertyId, {
                propertyId: prop.propertyId,
                propertyName: prop.propertyName,
                amount: -prop.amount,
              });
            }
          }

          const finalBreakdown = Array.from(breakdownMap.values()).filter(
            (p) => Math.abs(p.amount) >= 0.01
          );

          if (netAmount > 0) {
            // Original direction wins
            nettedSettlements.push({
              ...settlement,
              amount: netAmount,
              propertyBreakdown: finalBreakdown,
            });
          } else {
            // Reverse direction wins
            nettedSettlements.push({
              fromId: settlement.toId,
              fromName: settlement.toName,
              fromAvatar: settlement.toAvatar,
              toId: settlement.fromId,
              toName: settlement.fromName,
              toAvatar: settlement.fromAvatar,
              amount: Math.abs(netAmount),
              currency: currency,
              // finalBreakdown amounts are in the "fromId(orig)->toId(orig)" direction;
              // flip the direction here too, so negate (not abs) each property's
              // contribution to preserve which properties add to vs. offset the debt.
              propertyBreakdown: finalBreakdown.map((p) => ({
                ...p,
                amount: -p.amount,
              })),
            });
          }
        }

        processed.add(key);
        processed.add(reverseKey);
      } else if (!processed.has(key)) {
        // No reverse settlement, keep as is
        nettedSettlements.push(settlement);
        processed.add(key);
      }
    }

    // Sort each transaction's step-by-step breakdown by property ID (ascending)
    // so a given property always sits in the same relative position across
    // every investor-pair card, making it easy to track at a glance.
    nettedSettlements.forEach((s) => {
      if (Array.isArray(s.propertyBreakdown)) {
        s.propertyBreakdown.sort(
          (a, b) => (parseInt(a.propertyId) || 0) - (parseInt(b.propertyId) || 0),
        );
      }
    });

    // Convert to array and sort by amount (largest first)
    return nettedSettlements
      .filter((s) => s.amount >= 0.01)
      .sort((a, b) => b.amount - a.amount);
  }

  calculateSettlements(investorTotals, propertyMap) {
    // Build settlements based on property-level relationships
    const settlementMap = new Map(); // Key: "fromId->toId", Value: {settlement data}

    // Get all unique property IDs
    const propertyIds = new Set();
    for (const investor of investorTotals.values()) {
      for (const prop of investor.properties) {
        propertyIds.add(prop.propertyId);
      }
    }

    // For each property, calculate settlements within that property
    for (const propertyId of propertyIds) {
      // Get all investors for this property
      const propertyInvestors = [];
      for (const investor of investorTotals.values()) {
        const prop = investor.properties.find(
          (p) => p.propertyId === propertyId
        );
        if (prop) {
          propertyInvestors.push({
            investorId: investor.investorId,
            investorName: investor.investorName,
            avatar: investor.avatar,
            final: prop.final,
          });
        }
      }

      // Separate into creditors and debtors for this property
      const creditors = propertyInvestors
        .filter((inv) => inv.final > 0.01)
        .map((inv) => ({ ...inv, remaining: inv.final }))
        .sort((a, b) => b.remaining - a.remaining);

      const debtors = propertyInvestors
        .filter((inv) => inv.final < -0.01)
        .map((inv) => ({ ...inv, remaining: Math.abs(inv.final) }))
        .sort((a, b) => b.remaining - a.remaining);

      // Match debtors with creditors for this property
      let creditorIndex = 0;
      let debtorIndex = 0;

      while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
        const creditor = creditors[creditorIndex];
        const debtor = debtors[debtorIndex];

        const settlementAmount = Math.min(creditor.remaining, debtor.remaining);

        if (settlementAmount >= 0.01) {
          const settlementKey = `${debtor.investorId}->${creditor.investorId}`;

          if (!settlementMap.has(settlementKey)) {
            settlementMap.set(settlementKey, {
              fromId: debtor.investorId,
              fromName: debtor.investorName,
              fromAvatar: debtor.avatar || null,
              toId: creditor.investorId,
              toName: creditor.investorName,
              toAvatar: creditor.avatar || null,
              amount: 0,
              propertyBreakdown: [],
            });
          }

          const settlement = settlementMap.get(settlementKey);
          const propertyData = propertyMap ? propertyMap.get(propertyId) : null;

          settlement.propertyBreakdown.push({
            propertyId: propertyId,
            propertyName: propertyData
              ? [propertyData.unit, propertyData.address].filter(Boolean).join(', ') || propertyId
              : propertyId,
            amount: settlementAmount,
          });
          settlement.amount += settlementAmount;

          // Update remaining amounts
          creditor.remaining -= settlementAmount;
          debtor.remaining -= settlementAmount;
        }

        // Move to next creditor/debtor if current one is settled
        if (creditor.remaining < 0.01) {
          creditorIndex++;
        }
        if (debtor.remaining < 0.01) {
          debtorIndex++;
        }
      }
    }

    // Net out bilateral transactions (A→B and B→A)
    const nettedSettlements = [];
    const processed = new Set();

    for (const [key, settlement] of settlementMap.entries()) {
      if (processed.has(key)) continue;

      const reverseKey = `${settlement.toId}->${settlement.fromId}`;
      const reverseSettlement = settlementMap.get(reverseKey);

      if (reverseSettlement && !processed.has(reverseKey)) {
        // Net out the two settlements
        const netAmount = settlement.amount - reverseSettlement.amount;

        if (Math.abs(netAmount) >= 0.01) {
          // Combine property breakdowns, netting amounts for same properties
          const breakdownMap = new Map();

          // Add original direction amounts
          for (const prop of settlement.propertyBreakdown) {
            breakdownMap.set(prop.propertyId, {
              propertyId: prop.propertyId,
              propertyName: prop.propertyName,
              amount: prop.amount,
            });
          }

          // Subtract reverse direction amounts
          for (const prop of reverseSettlement.propertyBreakdown) {
            if (breakdownMap.has(prop.propertyId)) {
              const existing = breakdownMap.get(prop.propertyId);
              existing.amount -= prop.amount;
              if (Math.abs(existing.amount) < 0.01) {
                breakdownMap.delete(prop.propertyId);
              }
            } else {
              breakdownMap.set(prop.propertyId, {
                propertyId: prop.propertyId,
                propertyName: prop.propertyName,
                amount: -prop.amount,
              });
            }
          }

          const finalBreakdown = Array.from(breakdownMap.values()).filter(
            (p) => Math.abs(p.amount) >= 0.01
          );

          if (netAmount > 0) {
            // Original direction wins
            nettedSettlements.push({
              ...settlement,
              amount: netAmount,
              propertyBreakdown: finalBreakdown,
            });
          } else {
            // Reverse direction wins
            nettedSettlements.push({
              fromId: settlement.toId,
              fromName: settlement.toName,
              fromAvatar: settlement.toAvatar,
              toId: settlement.fromId,
              toName: settlement.fromName,
              toAvatar: settlement.fromAvatar,
              amount: Math.abs(netAmount),
              propertyBreakdown: finalBreakdown.map((p) => ({
                ...p,
                amount: Math.abs(p.amount),
              })),
            });
          }
        }

        processed.add(key);
        processed.add(reverseKey);
      } else if (!processed.has(key)) {
        // No reverse settlement, keep as is
        nettedSettlements.push(settlement);
        processed.add(key);
      }
    }

    // Convert to array and sort by amount (largest first)
    return nettedSettlements
      .filter((s) => s.amount >= 0.01)
      .sort((a, b) => b.amount - a.amount);
  }

  getVNDBreakdownForProperty(propertyId, propertyReportsMap, investorId) {
    // Get ALL VND transactions from the property report for reference
    const report = propertyReportsMap.get(propertyId);
    if (!report) return [];

    const vndBreakdown = [];

    // Collect ALL VND income items
    if (report.income && Array.isArray(report.income)) {
      report.income.forEach(item => {
        if (item.currency === 'VND' && item.exchangeRate && item.amount > 0) {
          const vndAmount = item.amount * item.exchangeRate;

          vndBreakdown.push({
            type: 'income',
            item: item.item,
            personInCharge: item.personInCharge,
            paidBy: item.paidBy,
            date: item.date,
            exchangeRate: item.exchangeRate,
            sgdAmount: item.amount,
            vndAmount: vndAmount
          });
        }
      });
    }

    // Collect ALL VND expense items
    if (report.expenses && Array.isArray(report.expenses)) {
      report.expenses.forEach(item => {
        if (item.currency === 'VND' && item.exchangeRate && item.amount > 0) {
          const vndAmount = item.amount * item.exchangeRate;

          vndBreakdown.push({
            type: 'expense',
            item: item.item,
            personInCharge: item.personInCharge,
            date: item.date,
            exchangeRate: item.exchangeRate,
            sgdAmount: item.amount,
            vndAmount: vndAmount
          });
        }
      });
    }

    return vndBreakdown;
  }

  renderAllVNDReferences(reports, investorTotals) {
    // Collect all UNIQUE VND transactions from ALL reports
    const vndTransactionMap = new Map(); // Use map to deduplicate

    reports.forEach(reportItem => {
      if (!reportItem.report) return;

      const report = reportItem.report;
      const propertyId = reportItem.propertyId;
      const propertyName = reportItem.propertyData?.address || propertyId;

      // Collect VND income transactions
      if (report.income && Array.isArray(report.income)) {
        report.income.forEach(item => {
          if (item.currency === 'VND' && item.exchangeRate && item.amount > 0) {
            const vndAmount = item.amount * item.exchangeRate;
            const uniqueKey = `${propertyId}-${item.item}-${item.personInCharge}-${item.date}-${item.amount}`;

            if (!vndTransactionMap.has(uniqueKey)) {
              vndTransactionMap.set(uniqueKey, {
                type: 'income',
                item: item.item,
                personInCharge: item.personInCharge,
                paidBy: item.paidBy,
                date: item.date,
                exchangeRate: item.exchangeRate,
                sgdAmount: item.amount,
                vndAmount: vndAmount,
                propertyId: propertyId,
                propertyName: propertyName
              });
            }
          }
        });
      }

      // Collect VND expense transactions
      if (report.expenses && Array.isArray(report.expenses)) {
        report.expenses.forEach(item => {
          if (item.currency === 'VND' && item.exchangeRate && item.amount > 0) {
            const vndAmount = item.amount * item.exchangeRate;
            const uniqueKey = `${propertyId}-${item.item}-${item.personInCharge}-${item.date}-${item.amount}`;

            if (!vndTransactionMap.has(uniqueKey)) {
              vndTransactionMap.set(uniqueKey, {
                type: 'expense',
                item: item.item,
                personInCharge: item.personInCharge,
                date: item.date,
                exchangeRate: item.exchangeRate,
                sgdAmount: item.amount,
                vndAmount: vndAmount,
                propertyId: propertyId,
                propertyName: propertyName
              });
            }
          }
        });
      }
    });

    if (vndTransactionMap.size === 0) {
      return '';
    }

    // Convert map to array
    const allVndData = Array.from(vndTransactionMap.values());

    // Helper to get investor name
    const getInvestorName = (investorId) => {
      if (investorTotals && investorTotals.has(investorId)) {
        return investorTotals.get(investorId).investorName;
      }
      return investorId;
    };

    // Group by property
    const byProperty = new Map();
    allVndData.forEach(txn => {
      if (!byProperty.has(txn.propertyId)) {
        byProperty.set(txn.propertyId, {
          propertyName: txn.propertyName,
          transactions: []
        });
      }
      byProperty.get(txn.propertyId).transactions.push(txn);
    });

    let html = `
      <div class="card mb-4 border-info">
        <div class="card-header bg-info text-white">
          <h5 class="mb-0">
            <i class="bi bi-cash-coin me-2"></i>
            🇻🇳 VND Transaction Reference
          </h5>
        </div>
        <div class="card-body">
          <div class="alert alert-info mb-3">
            <i class="bi bi-info-circle me-2"></i>
            Below are all VND transactions for reference. These amounts show who received VND income and the exchange rates used. All calculations in settlement instructions use SGD.
          </div>
    `;

    for (const [propertyId, data] of byProperty) {
      html += `
        <div class="mb-4">
          <h6 class="fw-bold text-dark mb-2">
            <i class="bi bi-building me-2"></i>${escapeHtml(data.propertyName || propertyId)}
          </h6>
          <div class="table-responsive">
            <table class="table table-sm table-hover align-middle">
              <thead class="table-light">
                <tr>
                  <th style="width: 200px;">Recipient</th>
                  <th style="width: 250px;">Item</th>
                  <th style="width: 130px;">Date</th>
                  <th class="text-end" style="width: 120px;">SGD Amount</th>
                  <th class="text-center" style="width: 130px;">Exchange Rate</th>
                  <th class="text-end" style="width: 150px;">VND Amount</th>
                </tr>
              </thead>
              <tbody>
      `;

      data.transactions.forEach(txn => {
        const dateStr = txn.date
          ? new Date(txn.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "No date";

        const recipientName = getInvestorName(txn.personInCharge);

        // Get investor avatar
        const investorData = investorTotals.get(txn.personInCharge);
        const avatar = investorData?.avatar;

        html += `
          <tr>
            <td>
              <div class="d-flex align-items-center">
                ${
                  avatar
                    ? `<img src="${this.getOptimizedAvatarUrl(avatar, 'small')}"
                           alt="${escapeHtml(recipientName)}"
                           class="rounded-circle me-2"
                           style="width: 32px; height: 32px; object-fit: cover;"
                           onerror="this.style.display='none'">`
                    : `<div class="rounded-circle me-2 d-flex align-items-center justify-content-center bg-success text-white fw-bold"
                            style="width: 32px; height: 32px; font-size: 14px;">
                         ${escapeHtml(recipientName.charAt(0).toUpperCase())}
                       </div>`
                }
                <span class="fw-bold">${escapeHtml(recipientName)}</span>
              </div>
            </td>
            <td>
              <span class="fst-italic text-muted">${escapeHtml(txn.item)}</span>
            </td>
            <td>
              <small class="text-muted">
                <i class="bi bi-calendar3 me-1"></i>${dateStr}
              </small>
            </td>
            <td class="text-end">
              <strong class="text-primary">$${txn.sgdAmount.toFixed(2)}</strong>
            </td>
            <td class="text-center">
              <span class="badge bg-secondary">🇻🇳 ${txn.exchangeRate.toLocaleString('vi-VN')}</span>
            </td>
            <td class="text-end">
              <strong class="text-info">₫${txn.vndAmount.toLocaleString('vi-VN', {maximumFractionDigits: 0})}</strong>
            </td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    // Calculate summary by exchange rate
    const summaryByRate = new Map();
    allVndData.forEach(txn => {
      const rate = txn.exchangeRate;
      if (!summaryByRate.has(rate)) {
        summaryByRate.set(rate, {
          exchangeRate: rate,
          totalSGD: 0,
          totalVND: 0,
          count: 0
        });
      }
      const summary = summaryByRate.get(rate);
      summary.totalSGD += txn.sgdAmount;
      summary.totalVND += txn.vndAmount;
      summary.count += 1;
    });

    // Add summary section
    if (summaryByRate.size > 0) {
      html += `
        <div class="mt-4 p-3 bg-light rounded border border-primary">
          <h6 class="mb-3 text-primary">
            <i class="bi bi-calculator me-2"></i>🇻🇳 Summary by Exchange Rate
          </h6>
          <div class="table-responsive">
            <table class="table table-bordered table-hover mb-0 align-middle">
              <thead class="table-light">
                <tr>
                  <th style="width: 180px;">Exchange Rate</th>
                  <th class="text-end" style="width: 150px;">Total SGD</th>
                  <th class="text-end" style="width: 200px;">Total VND</th>
                  <th class="text-center" style="width: 130px;">Transactions</th>
                </tr>
              </thead>
              <tbody>
      `;

      // Sort by exchange rate
      const sortedRates = Array.from(summaryByRate.values()).sort((a, b) => a.exchangeRate - b.exchangeRate);

      sortedRates.forEach(summary => {
        html += `
          <tr>
            <td>
              <span class="badge bg-secondary">🇻🇳 ${summary.exchangeRate.toLocaleString('vi-VN')}</span>
            </td>
            <td class="text-end">
              <strong class="text-primary">$${summary.totalSGD.toFixed(2)}</strong>
            </td>
            <td class="text-end">
              <strong class="text-info">₫${summary.totalVND.toLocaleString('vi-VN', {maximumFractionDigits: 0})}</strong>
            </td>
            <td class="text-center">
              <span class="badge bg-info">${summary.count}</span>
            </td>
          </tr>
        `;
      });

      // Calculate grand totals
      const grandTotalSGD = sortedRates.reduce((sum, s) => sum + s.totalSGD, 0);
      const grandTotalVND = sortedRates.reduce((sum, s) => sum + s.totalVND, 0);
      const grandTotalCount = sortedRates.reduce((sum, s) => sum + s.count, 0);

      html += `
              </tbody>
              <tfoot>
                <tr class="table-primary border-top border-3 border-primary">
                  <td class="fw-bold fs-5 py-3">Total</td>
                  <td class="text-end py-3">
                    <strong class="text-primary fs-4">$${grandTotalSGD.toFixed(2)}</strong>
                  </td>
                  <td class="text-end py-3">
                    <strong class="text-info fs-4">₫${grandTotalVND.toLocaleString('vi-VN', {maximumFractionDigits: 0})}</strong>
                  </td>
                  <td class="text-center py-3">
                    <span class="badge bg-primary fs-6 px-3 py-2">${grandTotalCount}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }

    return html;
  }

  renderVNDReferenceSection(settlement) {
    // Collect all unique VND transactions across all properties in this settlement
    if (!settlement.propertyBreakdown || settlement.propertyBreakdown.length === 0) {
      return '';
    }

    // Flatten all VND breakdowns from all properties
    const allVndTransactions = [];
    settlement.propertyBreakdown.forEach(prop => {
      if (prop.vndBreakdown && prop.vndBreakdown.length > 0) {
        prop.vndBreakdown.forEach(vnd => {
          allVndTransactions.push({
            ...vnd,
            propertyId: prop.propertyId,
            propertyName: prop.propertyName
          });
        });
      }
    });

    if (allVndTransactions.length === 0) {
      return '';
    }

    // Get investor names from the map
    const getInvestorName = (investorId) => {
      if (settlement.investorTotalsMap && settlement.investorTotalsMap.has(investorId)) {
        return settlement.investorTotalsMap.get(investorId).investorName;
      }
      return investorId;
    };

    // Group by property for display
    const byProperty = new Map();
    allVndTransactions.forEach(txn => {
      if (!byProperty.has(txn.propertyId)) {
        byProperty.set(txn.propertyId, {
          propertyName: txn.propertyName,
          transactions: []
        });
      }
      byProperty.get(txn.propertyId).transactions.push(txn);
    });

    let html = `
      <div class="mt-3 p-3 bg-light rounded border border-info">
        <h6 class="mb-2 text-info">
          <i class="bi bi-cash-coin me-2"></i>VND Reference - Transaction Details
        </h6>
        <small class="text-muted d-block mb-2">Below are VND transactions from this property (for reference only, calculations use SGD)</small>
    `;

    for (const [propertyId, data] of byProperty) {
      html += `
        <div class="mb-3">
          <div class="fw-bold text-dark mb-2">
            <i class="bi bi-building me-1"></i>${escapeHtml(data.propertyName || propertyId)}
          </div>
      `;

      data.transactions.forEach(txn => {
        const dateStr = txn.date
          ? new Date(txn.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "No date";

        // Get the actual person who received this income from the transaction
        const recipientName = getInvestorName(txn.personInCharge);

        html += `
          <div class="ms-3 mb-2 p-2 bg-white rounded border border-secondary" style="font-size: 0.9em;">
            <div class="d-flex justify-content-between align-items-start">
              <div class="flex-grow-1">
                <span class="fw-bold text-success">${escapeHtml(recipientName)}</span>
                <span class="text-muted">received</span>
                <span class="fw-bold text-primary">$${txn.sgdAmount.toFixed(2)}</span>
                <span class="text-muted">from</span>
                <span class="fst-italic">${escapeHtml(txn.item)}</span>
              </div>
            </div>
            <div class="mt-1 d-flex justify-content-between align-items-center">
              <small class="text-muted">
                <i class="bi bi-calendar3 me-1"></i>${dateStr}
              </small>
              <div>
                <span class="text-muted me-2">Exchange rate:</span>
                <span class="badge bg-secondary">${txn.exchangeRate.toLocaleString('vi-VN')}</span>
                <span class="mx-2">→</span>
                <span class="text-info fw-bold">₫${txn.vndAmount.toLocaleString('vi-VN', {maximumFractionDigits: 0})}</span>
              </div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  getOptimizedAvatarUrl(url, size = "small") {
    if (!url) return "";

    // Use ImageUtils if available, otherwise return original URL
    if (typeof ImageUtils !== "undefined" && ImageUtils.getOptimizedImageUrl) {
      return ImageUtils.getOptimizedImageUrl(url, size);
    }

    return url;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settlement Extraction Tool
  // ─────────────────────────────────────────────────────────────────────────

  /** Sync extraction month/year inputs with current date */
  syncExtractionDefaults() {
    const now = new Date();
    const m = document.getElementById("extractMonth");
    const y = document.getElementById("extractYear");
    if (m) m.value = now.getMonth() + 1;
    if (y) y.value = now.getFullYear();
  }

  bindExtractionEvents() {
    const btn = document.getElementById("extractSettlementBtn");
    if (btn) btn.addEventListener("click", () => this.fetchSettlementExtraction());
  }

  /** Fetch ALL investors from the global endpoint, populate dropdowns */
  async loadAllInvestors() {
    try {
      const resp = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      if (!resp.ok) return;
      const result = await resp.json();
      const list = Array.isArray(result) ? result : (result.data || result.investors || []);
      this.allInvestors = list
        .map((inv) => ({
          investorId: inv.investorId,
          name: inv.name || inv.username || inv.investorId,
          avatar: inv.avatar || null,
          isGroup: !!inv.isGroup,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.error("Failed to load investors:", err);
      this.allInvestors = [];
    }
    this.populateExtractionDropdowns();
  }

  populateExtractionDropdowns() {
    const payerSel = document.getElementById("extractPayerSelect");
    if (!payerSel) return;
    const investors = this.allInvestors || [];
    const label = (inv) =>
      `${escapeHtml(inv.name)}${inv.isGroup ? " (group)" : ""}`;

    payerSel.innerHTML = `<option value="">Select payer…</option>${investors
      .map(
        (inv) =>
          `<option value="${escapeHtml(inv.investorId)}">${label(inv)}</option>`,
      )
      .join("")}`;

    if (!this.extractPayeeIds) this.extractPayeeIds = new Set();
    const menu = document.getElementById("extractPayeeMenu");
    if (menu) {
      menu.innerHTML = `
        <input type="search" class="form-control form-control-sm mb-2" id="extractPayeeSearch" placeholder="Search investors…" autocomplete="off">
        <div class="d-flex justify-content-between small mb-1 px-1">
          <a href="#" id="extractPayeeAll">Select all</a>
          <a href="#" id="extractPayeeNone" class="text-muted">Clear</a>
        </div>
        <div id="extractPayeeList">
          ${investors
            .map(
              (inv) => `
            <label class="dropdown-item d-flex align-items-center gap-2 rounded py-2" data-name="${escapeHtml(inv.name.toLowerCase())}" data-id="${escapeHtml(inv.investorId)}" style="cursor:pointer;">
              <input type="checkbox" class="form-check-input m-0 flex-shrink-0" value="${escapeHtml(inv.investorId)}">
              <span class="text-truncate">${escapeHtml(inv.name)}</span>
              ${inv.isGroup ? '<span class="badge bg-primary-subtle text-primary ms-auto">Group</span>' : ""}
            </label>`,
            )
            .join("")}
        </div>`;

      const list = menu.querySelector("#extractPayeeList");
      list.addEventListener("change", (e) => {
        const box = e.target.closest('input[type="checkbox"]');
        if (!box) return;
        if (box.checked) this.extractPayeeIds.add(box.value);
        else this.extractPayeeIds.delete(box.value);
        this.updatePayeePickerLabel();
      });
      menu
        .querySelector("#extractPayeeSearch")
        .addEventListener("input", (e) => {
          const q = e.target.value.trim().toLowerCase();
          list.querySelectorAll("label[data-name]").forEach((row) => {
            row.classList.toggle(
              "d-none",
              !!q && !row.dataset.name.includes(q),
            );
          });
        });
      const setAll = (checked) => (e) => {
        e.preventDefault();
        const payerId = payerSel.value;
        list.querySelectorAll("label[data-id]").forEach((row) => {
          if (row.classList.contains("d-none")) return; // respects the search filter
          const id = row.dataset.id;
          if (checked && id === payerId) return; // never the payer themselves
          row.querySelector("input").checked = checked;
          if (checked) this.extractPayeeIds.add(id);
          else this.extractPayeeIds.delete(id);
        });
        this.updatePayeePickerLabel();
      };
      menu
        .querySelector("#extractPayeeAll")
        .addEventListener("click", setAll(true));
      menu
        .querySelector("#extractPayeeNone")
        .addEventListener("click", setAll(false));
    }

    this.bindPayeePickerPopup();

    // The payer can't also be a payee
    payerSel.addEventListener("change", () => this.syncPayeeOptionsWithPayer());
    this.syncPayeeOptionsWithPayer();
  }

  // Payee checklist popup. It's moved to <body> and placed under the button
  // with page coordinates, so the card it sits in can't clip it.
  bindPayeePickerPopup() {
    const toggle = document.getElementById("extractPayeeToggle");
    const menu = document.getElementById("extractPayeeMenu");
    if (!toggle || !menu || toggle.dataset.bound) return;
    toggle.dataset.bound = "1";
    document.body.appendChild(menu);
    Object.assign(menu.style, {
      position: "absolute",
      zIndex: "1035",
      margin: "0",
    });

    const place = () => {
      const r = toggle.getBoundingClientRect();
      const width = Math.min(Math.max(r.width, 260), window.innerWidth - 32);
      const left = Math.min(
        Math.max(16, r.left),
        window.innerWidth - 16 - width,
      );
      menu.style.width = `${width}px`;
      menu.style.left = `${left + window.scrollX}px`;
      menu.style.top = `${r.bottom + 4 + window.scrollY}px`;
    };
    const isOpen = () => menu.classList.contains("show");
    const open = () => {
      place();
      menu.classList.add("show");
      toggle.setAttribute("aria-expanded", "true");
      menu.querySelector("#extractPayeeSearch")?.focus({ preventScroll: true });
    };
    const close = () => {
      menu.classList.remove("show");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => (isOpen() ? close() : open()));
    document.addEventListener("mousedown", (e) => {
      if (isOpen() && !menu.contains(e.target) && !toggle.contains(e.target))
        close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen()) {
        close();
        toggle.focus();
      }
    });
    window.addEventListener("resize", () => isOpen() && place());
    // Keep it under the button when any scroll container moves (capture
    // phase catches scrolling inside the dashboard's own panels too)
    document.addEventListener(
      "scroll",
      (e) => {
        if (isOpen() && !menu.contains(e.target)) place();
      },
      true,
    );
    // Close when the page section changes (button no longer visible)
    window.addEventListener("hashchange", close);
    this._closePayeePicker = close;
  }

  syncPayeeOptionsWithPayer() {
    const payerId = document.getElementById("extractPayerSelect")?.value;
    document
      .querySelectorAll("#extractPayeeList label[data-id]")
      .forEach((row) => {
        const isPayer = !!payerId && row.dataset.id === payerId;
        const box = row.querySelector("input");
        box.disabled = isPayer;
        row.classList.toggle("opacity-50", isPayer);
        if (isPayer && box.checked) {
          box.checked = false;
          this.extractPayeeIds?.delete(row.dataset.id);
        }
      });
    this.updatePayeePickerLabel();
  }

  updatePayeePickerLabel() {
    const toggle = document.getElementById("extractPayeeToggle");
    if (!toggle) return;
    const ids = [...(this.extractPayeeIds || [])];
    const names = ids.map(
      (id) =>
        (this.allInvestors || []).find((i) => i.investorId === id)?.name || id,
    );
    toggle.textContent =
      names.length === 0
        ? "Select payees…"
        : names.length <= 2
          ? names.join(", ")
          : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
    toggle.title = names.join(", ");
  }

  /*
   * Settlement Extraction rules (recorded expense items only):
   *  - Only confirmed items: pending items are left out, the same as every
   *    profit / settlement calculation, and counted separately so nothing
   *    disappears silently.
   *  - Payer: the item's person in charge is the payer, or is a member of
   *    the payer group whose items count toward that group for that
   *    property and month (same group rule as the profit split).
   *  - Payee: the item's "paid to" is one of the chosen payees. When it's a
   *    group member and the member isn't picked, it counts toward their
   *    group (if picked) by the same rule. Each item goes to exactly one
   *    payee, so it can never be counted twice.
   *  - Amounts are SGD (VND items store their SGD amount plus the rate).
   */
  async fetchSettlementExtraction() {
    const month   = document.getElementById("extractMonth")?.value;
    const year    = document.getElementById("extractYear")?.value;
    const payerId = document.getElementById("extractPayerSelect")?.value;
    const payeeIds = [...(this.extractPayeeIds || [])].filter(
      (id) => id !== payerId,
    );
    this._closePayeePicker?.();

    if (!month || !year || !payerId || payeeIds.length === 0) {
      this.showError(
        "Please select month, year, a payer and at least one payee.",
      );
      return;
    }

    const findInvestor = (id) =>
      (this.allInvestors || []).find((i) => i.investorId === id);
    const payerInvestor = findInvestor(payerId) || {
      investorId: payerId,
      name: payerId,
    };
    const payeeInvestors = payeeIds.map(
      (id) => findInvestor(id) || { investorId: id, name: id },
    );
    const payeeSet = new Set(payeeIds);

    document.getElementById("extractionLoading").style.display = "block";
    document.getElementById("extractionResultsArea").style.display = "none";

    try {
      const results = [];
      let pendingSkipped = 0;
      const failed = [];

      await Promise.all(
        (this.properties || []).map(async (property) => {
          const propertyId = property.propertyId;
          try {
            const resp = await API.get(
              API_CONFIG.ENDPOINTS.FINANCIAL_REPORT(propertyId, year, month),
            );
            if (resp.status === 404) return; // no report this month
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (!data.success || !data.data) return;
            const report = data.data;

            // Who holds what for this property and month → group roll-up
            let ownerOf = (id) => id;
            const invResp = await API.get(
              API_CONFIG.ENDPOINTS.INVESTORS_BY_PROPERTY(propertyId),
            );
            // Without the investor list the group rule can't be applied, so
            // treat it as a failed property rather than guess
            if (!invResp.ok)
              throw new Error(`investors HTTP ${invResp.status}`);
            {
              const invResult = await invResp.json();
              const propertyInvestors = (invResult.data || []).filter((inv) =>
                inv.properties?.some((p) => p.propertyId === propertyId),
              );
              const pctById = new Map(
                propertyInvestors.map((inv) => [
                  inv.investorId,
                  this.reportPercentage(inv, report, propertyId, year, month),
                ]),
              );
              ownerOf = this.buildGroupOwnerResolver(
                propertyInvestors,
                pctById,
              );
            }

            const payeeFor = (paidTo) => {
              if (!paidTo) return null;
              if (payeeSet.has(paidTo)) return paidTo;
              const owner = ownerOf(paidTo);
              return payeeSet.has(owner) ? owner : null;
            };

            const matching = [];
            (report.expenses || []).forEach((exp) => {
              const fromPayer =
                exp.personInCharge === payerId ||
                ownerOf(exp.personInCharge) === payerId;
              const payee = fromPayer ? payeeFor(exp.paidTo) : null;
              if (!payee || payee === payerId) return;
              if (exp.isPending) {
                pendingSkipped += 1;
                return;
              }
              matching.push({
                ...exp,
                _payeeId: payee,
                // Recorded by a group member on the group's behalf
                _viaId:
                  exp.personInCharge !== payerId ? exp.personInCharge : null,
                // Paid to a member, counted toward their group
                _paidToId: exp.paidTo !== payee ? exp.paidTo : null,
              });
            });

            if (matching.length > 0) {
              results.push({
                propertyId,
                propertyData: property,
                expenses: matching,
                total: matching.reduce(
                  (sum, e) => sum + (parseFloat(e.amount) || 0),
                  0,
                ),
              });
            }
          } catch (err) {
            console.error(`Extraction failed for ${propertyId}:`, err);
            failed.push(property);
          }
        }),
      );

      // Highest total first
      results.sort((a, b) => b.total - a.total);

      // Per-payee totals
      const payeeTotals = payeeInvestors
        .map((inv) => {
          const items = results.flatMap((r) =>
            r.expenses.filter((e) => e._payeeId === inv.investorId),
          );
          return {
            ...inv,
            count: items.length,
            total: items.reduce(
              (sum, e) => sum + (parseFloat(e.amount) || 0),
              0,
            ),
          };
        })
        .sort((a, b) => b.total - a.total);

      // Cache for export
      this.lastExtractionData = {
        results,
        payerInvestor,
        payeeInvestors,
        payeeTotals,
        pendingSkipped,
        failedCount: failed.length,
        month,
        year,
      };

      this.displaySettlementExtraction(this.lastExtractionData);
    } catch (err) {
      console.error("Extraction error:", err);
      this.showError("Failed to extract settlements. Please try again.");
    } finally {
      document.getElementById("extractionLoading").style.display = "none";
    }
  }

  // Name lookup for the extraction view
  _extractName(id) {
    return (
      (this.allInvestors || []).find((i) => i.investorId === id)?.name ||
      id ||
      "Unknown"
    );
  }

  // SGD amount, plus the VND figure for VND items
  _extractAmountLabel(exp) {
    const amt = parseFloat(exp.amount) || 0;
    const sgd = `$${amt.toFixed(2)}`;
    if (exp.currency === "VND" && exp.exchangeRate) {
      return `${sgd} (₫${(amt * exp.exchangeRate).toLocaleString("vi-VN", { maximumFractionDigits: 0 })})`;
    }
    return sgd;
  }

  displaySettlementExtraction({
    results,
    payerInvestor,
    payeeInvestors,
    payeeTotals,
    pendingSkipped,
    failedCount,
    month,
    year,
  }) {
    const MONTH_NAMES = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    const monthName = MONTH_NAMES[parseInt(month) - 1];
    const grandTotal = results.reduce((s, r) => s + r.total, 0);
    const totalTx = results.reduce((s, r) => s + r.expenses.length, 0);
    const payerName = payerInvestor?.name || "Unknown";
    const multi = payeeInvestors.length > 1;
    const payeeNames = payeeInvestors.map((p) => p.name).join(", ");

    const renderAvatar = (avatar, name, bgColor, size = 26) => {
      if (avatar) {
        return `<img src="${this.getOptimizedAvatarUrl(avatar, "small")}" class="rounded-circle me-1 flex-shrink-0" style="width:${size}px;height:${size}px;object-fit:cover;" alt="${escapeHtml(name)}">`;
      }
      return `<div class="rounded-circle me-1 d-inline-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px;background:${bgColor};">${escapeHtml((name || "?").charAt(0).toUpperCase())}</div>`;
    };

    const warnings = [];
    if (pendingSkipped > 0) {
      warnings.push(
        `${pendingSkipped} pending item${pendingSkipped !== 1 ? "s" : ""} between them ${pendingSkipped !== 1 ? "are" : "is"} not included until confirmed.`,
      );
    }
    if (failedCount > 0) {
      warnings.push(
        `${failedCount} propert${failedCount !== 1 ? "ies" : "y"} couldn't be loaded, so the totals may be incomplete. Try again.`,
      );
    }
    const warningHtml = warnings.length
      ? `<div class="alert alert-warning py-2 small mb-3"><i class="bi bi-exclamation-triangle me-1"></i>${warnings.map(escapeHtml).join(" ")}</div>`
      : "";

    let html = `
      <div class="card border-success">
        <div class="card-header bg-success text-white">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0">
              <i class="bi bi-arrow-left-right me-2"></i>Settlement Extraction — ${escapeHtml(monthName)} ${escapeHtml(year)}
            </h5>
            <div class="d-flex gap-1">
              <button id="exportExtractionBtn" class="btn btn-sm btn-light" title="Export as image (copies to clipboard)">
                <i class="bi bi-image"></i> Image
              </button>
            </div>
          </div>
        </div>
        <div class="card-body" id="extractionResultsContent">`;

    if (results.length === 0) {
      html += `
          ${warningHtml}
          <div class="text-center text-muted py-5">
            <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
            <p>No confirmed expense payments from <strong>${escapeHtml(payerName)}</strong> to <strong>${escapeHtml(payeeNames)}</strong> in ${escapeHtml(monthName)} ${escapeHtml(year)}.</p>
          </div>`;
    } else {
      html += `
          <div class="alert alert-info mb-3">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <i class="bi bi-lightbulb me-1"></i>
              <span>Found <strong>${totalTx} payment${totalTx !== 1 ? "s" : ""}</strong> across <strong>${results.length} propert${results.length !== 1 ? "ies" : "y"}</strong> where</span>
              <span class="d-inline-flex align-items-center">
                ${renderAvatar(payerInvestor?.avatar, payerName, "#dc3545")}
                <strong class="text-danger">${escapeHtml(payerName)}</strong>
              </span>
              <span>owes</span>
              <strong class="text-success">${multi ? `${payeeInvestors.length} payees` : escapeHtml(payeeNames)}</strong>
              <span>— Grand Total: <strong class="text-dark">$${grandTotal.toFixed(2)} SGD</strong></span>
            </div>
            <div class="small text-muted mt-1">
              Confirmed expense payments only. Group members' items count toward their group. Profit-share settlement is not included here — see Settlement Instructions above.
            </div>
          </div>
          ${warningHtml}`;

      // Per-payee totals
      if (multi) {
        html += `
          <div class="border rounded mb-3">
            <div class="px-3 py-2 bg-light border-bottom small fw-bold text-uppercase text-muted">Owed to each payee</div>
            ${payeeTotals
              .map(
                (t) => `
              <div class="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
                <div class="d-flex align-items-center">
                  ${renderAvatar(t.avatar, t.name, "#198754", 24)}
                  <span class="${t.count ? "fw-semibold" : "text-muted"}">${escapeHtml(t.name)}</span>
                  <small class="text-muted ms-2">${t.count} payment${t.count !== 1 ? "s" : ""}</small>
                </div>
                <strong class="${t.count ? "" : "text-muted"}">$${t.total.toFixed(2)}</strong>
              </div>`,
              )
              .join("")}
            <div class="d-flex justify-content-between px-3 py-2 fw-bold">
              <span>Total</span><span>$${grandTotal.toFixed(2)}</span>
            </div>
          </div>`;
      }

      // Property cards
      html += `<div class="list-group mb-3">`;
      results.forEach((result) => {
        const prop = result.propertyData || {};
        const propLabel = [prop.unit || "", prop.address || result.propertyId]
          .filter(Boolean)
          .join(" · ");

        html += `
          <div class="list-group-item px-3 py-3">
            <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="badge bg-secondary">${escapeHtml(result.propertyId)}</span>
                <span class="fw-semibold">${escapeHtml(propLabel)}</span>
              </div>
              <span class="badge bg-warning text-dark fs-6 px-3 py-1 flex-shrink-0">$${result.total.toFixed(2)}</span>
            </div>
            <div class="ps-2 border-start border-3 border-info mb-2">`;

        result.expenses.forEach((exp) => {
          const dateStr = exp.date
            ? new Date(exp.date).toLocaleDateString("en-SG", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })
            : "—";
          const notes = [];
          if (multi)
            notes.push(
              `→ <strong class="text-success">${escapeHtml(this._extractName(exp._payeeId))}</strong>`,
            );
          if (exp._viaId)
            notes.push(
              `recorded by ${escapeHtml(this._extractName(exp._viaId))}`,
            );
          if (exp._paidToId)
            notes.push(
              `paid to ${escapeHtml(this._extractName(exp._paidToId))}`,
            );

          html += `
              <div class="d-flex justify-content-between align-items-start py-1 border-bottom border-light">
                <div class="flex-grow-1 me-2">
                  <span class="fw-medium">${escapeHtml(exp.item || "—")}</span>
                  <small class="text-muted ms-2">· ${escapeHtml(dateStr)}</small>
                  ${notes.length ? `<br><small class="text-muted">${notes.join(" · ")}</small>` : ""}
                  ${exp.details ? `<br><small class="text-muted fst-italic">${escapeHtml(exp.details)}</small>` : ""}
                </div>
                <small class="badge bg-danger flex-shrink-0">+${escapeHtml(this._extractAmountLabel(exp))}</small>
              </div>`;
        });

        html += `
            </div>
          </div>`;
      });
      html += `</div>`;

      // Summary
      html += `
          <div class="p-3 bg-light rounded">
            <div class="d-flex justify-content-between mb-1">
              <span class="text-muted">Properties:</span><strong>${results.length}</strong>
            </div>
            <div class="d-flex justify-content-between mb-1">
              <span class="text-muted">Payments:</span><strong>${totalTx}</strong>
            </div>
            <hr class="my-2">
            <div class="d-flex justify-content-between align-items-center">
              <span class="text-muted fw-bold">Grand Total (SGD):</span>
              <span class="badge bg-warning text-dark fs-5 px-3">$${grandTotal.toFixed(2)}</span>
            </div>
          </div>`;
    }

    html += `</div></div>`;

    const area = document.getElementById("extractionResultsArea");
    area.innerHTML = html;
    area.style.display = "block";

    const exportBtn = document.getElementById("exportExtractionBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportExtractionAsImage());
    }
  }

  async exportExtractionAsImage() {
    const btn = document.getElementById("exportExtractionBtn");
    if (!btn) return;

    const data = this.lastExtractionData;
    if (!data || !data.results) {
      alert("No extraction data to export.");
      return;
    }

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    btn.disabled = true;

    try {
      const svgStr = await this._generateExtractionSVG(data);
      const blob   = await this._svgToPngBlob(svgStr);

      // Show preview modal first (non-blocking)
      const payerName = data.payerInvestor?.name || "Payer";
      const payees = data.payeeInvestors || [];
      const payeeName =
        payees.length === 1 ? payees[0].name : `${payees.length}_payees`;
      const monthYear = [data.month, data.year].filter(Boolean).join("/");
      this._showImagePreview(blob, {
        fileName: `Settlement_Extraction_${payerName}_to_${payeeName}_${monthYear}.png`.replace(/\s+/g, "_"),
        title: "Extraction Preview",
        subtitle: `${payerName} → ${payeeName}${monthYear ? " · " + monthYear : ""}`,
      });

      // Also copy to clipboard (best-effort)
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        if (typeof showToast === "function") {
          const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
          showToast(`Image copied! Paste with ${isMac ? "⌘ Cmd+V" : "Ctrl+V"}`, "success", 4000);
        }
      } catch (_clipErr) {
        // Clipboard copy is optional — preview modal is the primary deliverable
      }

      btn.innerHTML = '<i class="bi bi-check-circle"></i>';
      btn.classList.remove("btn-light");
      btn.classList.add("btn-success");

      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove("btn-success");
        btn.classList.add("btn-light");
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error("Extraction export error:", err);
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      alert(`Failed to export image: ${err.message}`);
    }
  }

  /**
   * Generate a mobile-optimized SVG for the settlement extraction.
   * W=430 (iPhone 14 Pro Max width). Portrait layout.
   *
   * Styling/layout only — every number below (results, grandTotal,
   * totalTx, each result.total / exp.amount / exp.currency / exp.date /
   * exp.item) is read exactly as computed by fetchSettlementExtraction()
   * above; nothing here changes what's calculated, only how it's drawn.
   * Profit-share settlement amounts are deliberately excluded — that has
   * its own dedicated section in "Property Profit Results" and is never
   * shown here, so the two totals can't be double-counted/double-shown.
   * The visual language — dark base + accent haze, brand logo, Noto Serif
   * type, and every color — matches the single-property report export
   * (_generateReportSVG in financial-reports.js), all sourced from the
   * shared financial-report-theme module so the two can't drift apart
   * again. Extraction is always a list of amounts owed, so it stays
   * permanently in "expense" (red) mode rather than switching on a
   * profit/loss sign.
   *
   * Layout is deliberately dense for phone viewing: a property card only
   * shows the separate "Property Total" bar once it actually has 2+
   * expense rows to sum — a single amount is already the total, so
   * repeating it below would just waste space. The payer/payee row
   * anchors each name to its own side
   * (payer left, payee right, arrow fixed at the card's horizontal
   * center) instead of chaining position off the other name's rendered
   * length — that chained approach is what let a long payee name run
   * under the total badge; independent anchoring can't overlap regardless
   * of how long either name is.
   *
   * Rows never get an alternating background — that read as busy/table-like
   * rather than premium. Instead each row gets a soft edge-to-edge fading
   * divider underneath it (ROW_DIV_FADE), the exact same convention the
   * report export uses between its own item rows, so both exports read as
   * one continuous panel per property/section.
   *
   * No dollar amount gets a colored pill/badge either — every amount
   * (expense rows, profit settlement, subtotals, grand total) is plain
   * right-aligned text, with a leading +/- carrying the sign instead of a
   * colored tag. Distinction between amounts comes from typography (size
   * and weight — totals are simply bigger/bolder) and the row's own label
   * text, not color, for a flatter, more editorial "statement" look.
   */
  async _generateExtractionSVG({
    results,
    payerInvestor,
    payeeInvestors = [],
    payeeTotals = [],
    month,
    year,
  }) {
    const multi = payeeInvestors.length > 1;
    const payeeInvestor = multi ? null : payeeInvestors[0];
    const W = 430;
    const M = 16;
    const CARD_MX = 4;
    const cardX   = M + CARD_MX;            // 20
    const cardW   = W - 2 * (M + CARD_MX); // 390
    const INNER_L = cardX + 12;             // 32
    const INNER_R = cardX + cardW - 12;     // 398

    const CARD_PAD   = 10;
    const PROP_HDR_H = 24;   // property header (single line: badge + unit + address)
    const EXP_ROW_H  = 23;   // each expense / profit-settlement row
    const PROP_TOT_H = 22;   // property subtotal row (only rendered when a card has 2+ amounts)
    const SEP_H      = 5;
    const CARD_GAP   = 8;

    const nodes  = [];
    const defs   = [];
    let   y      = 0;
    let   clipIdx = 0;
    const p = (s) => nodes.push(s);

    const fontFaceStyle = await this._loadFontFaceStyle();

    // Brand logo — same asset + fetch pattern as the report export.
    let logoDataUri = null;
    try {
      const logoResp = await fetch("/logo.png");
      if (logoResp.ok) {
        const logoBlob = await logoResp.blob();
        logoDataUri = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(logoBlob);
        });
      }
    } catch {
      /* logo optional */
    }

    // Fetch avatars
    const urls = new Set();
    if (payerInvestor?.avatar) urls.add(payerInvestor.avatar);
    payeeInvestors.forEach((inv) => inv.avatar && urls.add(inv.avatar));
    const avatarCache = {};
    await Promise.all([...urls].map(async (url) => {
      try {
        const resp = await fetch(this.getOptimizedAvatarUrl(url, "small"));
        if (!resp.ok) return;
        const blob = await resp.blob();
        avatarCache[url] = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch { /* initials fallback */ }
    }));

    // ── Colour palette — same tokens & "dark base + accent haze" language
    // as the report export (see financial-report-theme.js).
    const expenseTokens = getModeTokens(false); // "loss"/red — extraction is always a payable list
    const receiveTokens = getModeTokens(true);  // "profit"/green — used only for the payee side
    const neutralTokens = getNeutralTokens();
    const badgeTokens   = getBadgeTokens();
    const surfaceTokens = getSurfaceTokens();

    const BASE_BG      = expenseTokens.base;
    const PANEL_BG     = expenseTokens.panel;
    const SUMMARY_BG   = expenseTokens.summaryBg;
    const FOOTER_BG    = expenseTokens.footerBg;
    const BRAND        = neutralTokens.brand;
    const TEXT_HI      = neutralTokens.textPrimary;
    const TEXT_MED     = neutralTokens.textMuted;
    const DIVIDER      = neutralTokens.dividerNeutral;
    // Cards reuse the header's own PANEL_BG rather than surfaceTokens.bg
    // (a cool dark slate meant for neutral live-dashboard UI, never used
    // inside the report export itself). The report's export never mixes
    // hues — every surface is a shade of the same warm mode palette — so
    // reusing PANEL_BG here keeps property cards in that same family
    // instead of reading as an unrelated black block dropped on top.
    const CARD_BG      = PANEL_BG;
    const CARD_BORDER  = surfaceTokens.border;
    const EXPENSE_CLR  = expenseTokens.accent;
    const RECEIVE_CLR  = receiveTokens.accent;
    const CHIP_BG      = badgeTokens.bg;
    const CHIP_TXT     = badgeTokens.text;

    // Full-bleed background haze — same recipe as the report export.
    defs.push(
      `<radialGradient id="exHaze" cx="50%" cy="0%" r="90%">
        <stop offset="0%" stop-color="${EXPENSE_CLR}" stop-opacity="0.20"/>
        <stop offset="45%" stop-color="${EXPENSE_CLR}" stop-opacity="0.07"/>
        <stop offset="100%" stop-color="${EXPENSE_CLR}" stop-opacity="0"/>
      </radialGradient>`
    );

    // Row divider — fades out at both edges instead of a flat full-width
    // line or an alternating row background, so rows read as one
    // continuous panel (no table-style odd/even banding) with just a
    // subtle premium seam between entries. Same treatment the report
    // export uses for its item rows (rowDivGrad in _generateReportSVG),
    // kept neutral here (not tied to any one row's red/teal color) since
    // it separates rows of different types (expense vs. profit settlement).
    defs.push(
      `<linearGradient id="exRowDivGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>`
    );
    const ROW_DIV_FADE = "url(#exRowDivGrad)";

    const renderCircleAvatar = (avatarUrl, name, cx, cy, r = 13, fallbackColor = TEXT_MED) => {
      const dataUri = avatarUrl ? avatarCache[avatarUrl] : null;
      if (dataUri) {
        const id = `ec${clipIdx++}`;
        defs.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
        p(`<image href="${dataUri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`);
      } else {
        p(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fallbackColor || this._getAvatarColor(name)}"/>`);
        p(`<text x="${cx}" y="${cy + Math.round(r * 0.44)}" font-size="${Math.round(r * 0.95)}" fill="#fff" font-weight="700" text-anchor="middle">${this._svgEsc((name || "?").charAt(0).toUpperCase())}</text>`);
      }
    };

    const MONTH_NAMES = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    const monthName = MONTH_NAMES[parseInt(month) - 1];
    const genDate   = new Date().toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });

    const grandTotal = results.reduce((s, r) => s + r.total, 0);
    const totalTx = results.reduce((s, r) => s + r.expenses.length, 0);
    const payerName = payerInvestor?.name || "Unknown";
    const payeeName = multi
      ? `${payeeInvestors.length} payees`
      : payeeInvestor?.name || "Unknown";

    // ── Header — logo + kicker + period only. The payer/payee identity
    // deliberately does NOT repeat here — it used to (a second, more
    // heavily truncated copy of both names right above the avatar panel
    // that already shows them properly), which just duplicated the same
    // information worse. The avatar panel below is the single, richer
    // place that identity lives: avatars, color-coding, explicit
    // "Payer"/"Payee" labels beat a plain truncated title text anyway. ──
    const HDR_H = 56;
    const LOGO_SIZE = 30;
    const LOGO_X = M;
    const LOGO_Y = Math.round((HDR_H - LOGO_SIZE) / 2);
    p(`<rect x="0" y="0" width="${W}" height="${HDR_H}" fill="${PANEL_BG}"/>`);
    if (logoDataUri) {
      p(`<image href="${logoDataUri}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_SIZE}" height="${LOGO_SIZE}"/>`);
    }
    const TX = LOGO_X + (logoDataUri ? LOGO_SIZE + 10 : 0);
    const HDR_MIDY = HDR_H / 2;
    p(`<text x="${TX}" y="${HDR_MIDY - 2}" font-size="9.5" fill="#ffffff" font-weight="600" letter-spacing="2" opacity="0.7">SETTLEMENT EXTRACTION</text>`);
    p(`<text x="${TX}" y="${HDR_MIDY + 15}" font-size="9.5" fill="#ffffff" opacity="0.6">Generated ${this._svgEsc(genDate)}</text>`);
    p(`<text x="${W - M}" y="${HDR_MIDY + 6}" font-size="19" fill="#ffffff" font-weight="700" text-anchor="end">${this._svgEsc(monthName)} ${this._svgEsc(String(year))}</text>`);
    y = HDR_H;

    // ── Payer → Payee panel ─────────────────────────────────────────────────
    // Row 1 is avatar + role label only (no name text) — the photo already
    // identifies the person, and every length of investor name has to
    // ellipsize somewhere on a 430px-wide export no matter how it's
    // truncated (word-boundary-aware or not), which reads as unfinished.
    // A short, always-intact "Payer"/"Payee" label plus the red/green
    // color-coding is enough for who's who; the full names still appear in
    // the footer caption at the bottom of the export. Two stacked rows so
    // nothing ever competes for the same horizontal space: row 1 is
    // payer/arrow/payee (each anchored to its own side of the card, so
    // neither can run into the other); row 2 is the total badge on its
    // own, full-width row underneath.
    const ROW1_H = 34;
    const ROW2_H = 28;
    const INFO_H = ROW1_H + ROW2_H;
    p(`<rect x="0" y="${y}" width="${W}" height="${INFO_H}" fill="${SUMMARY_BG}"/>`);
    p(`<rect x="0" y="${y}" width="4" height="${INFO_H}" fill="${BRAND}"/>`);

    const avatarR = 13;
    const row1MidY = y + ROW1_H / 2;

    // Payer — left-anchored, always expense/red like the report's EXPENSE_CLR
    const fromCx = INNER_L + avatarR;
    renderCircleAvatar(payerInvestor?.avatar, payerName, fromCx, row1MidY, avatarR, EXPENSE_CLR);
    p(`<text x="${fromCx + avatarR + 6}" y="${row1MidY + 5}" font-size="14" fill="${EXPENSE_CLR}" font-weight="700">Payer</text>`);

    // Payee — right-anchored, always receive/green like the report's INCOME_CLR.
    // Anchored independently of the payer block above, so it can never be
    // pushed into (or overlap) anything else on this row.
    // Several payees: overlapping avatars (up to 3), rightmost first
    const shown = multi ? payeeInvestors.slice(0, 3) : [payeeInvestor];
    const STEP = avatarR * 1.4;
    for (let i = shown.length - 1; i >= 0; i--) {
      const inv = shown[i];
      renderCircleAvatar(
        inv?.avatar,
        inv?.name || "?",
        INNER_R - avatarR - i * STEP,
        row1MidY,
        avatarR,
        RECEIVE_CLR,
      );
    }
    const leftmostCx = INNER_R - avatarR - (shown.length - 1) * STEP;
    const payeeLabel = multi ? `${payeeInvestors.length} Payees` : "Payee";
    p(
      `<text x="${leftmostCx - avatarR - 6}" y="${row1MidY + 5}" font-size="14" fill="${RECEIVE_CLR}" font-weight="700" text-anchor="end">${payeeLabel}</text>`,
    );

    // Arrow — fixed at the row's horizontal center, independent of either name's length.
    p(`<text x="${(INNER_L + INNER_R) / 2}" y="${row1MidY + 5}" font-size="18" fill="${TEXT_MED}" text-anchor="middle">&#x2192;</text>`);

    // Row 2 — total badge on its own full-width row (label left, value right,
    // same convention as the "Grand Total" card at the bottom of this export).
    const row2Top = y + ROW1_H;
    const row2MidY = row2Top + ROW2_H / 2;
    p(`<line x1="${INNER_L}" y1="${row2Top}" x2="${INNER_R}" y2="${row2Top}" stroke="${DIVIDER}" stroke-width="1"/>`);

    const txLabel = `${totalTx} tx · ${results.length} prop`;
    p(`<text x="${INNER_L}" y="${row2MidY + 3}" font-size="9" fill="${TEXT_MED}">${this._svgEsc(txLabel)}</text>`);

    const totalStr = `$${grandTotal.toFixed(2)}`;
    p(`<text x="${INNER_R}" y="${row2MidY + 6}" font-size="19" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${this._svgEsc(totalStr)}</text>`);

    y += INFO_H + 10;

    // ── Property cards ────────────────────────────────────────────────────
    results.forEach((result) => {
      const prop    = result.propertyData || {};
      const unit    = prop.unit    || "";
      const address = prop.address || result.propertyId;
      const numExp  = result.expenses.length;
      const rowCount = numExp;
      // A single amount already IS the property total — showing a
      // separate "Property Total" bar right below it would just repeat
      // the same number, so that bar only earns its place once there's
      // more than one recorded expense to actually sum.
      const hasSubtotal = rowCount >= 2;

      // Card height: header + expense rows + (separator + subtotal, only if 2+ rows) + padding
      const cardH = CARD_PAD + PROP_HDR_H + rowCount * EXP_ROW_H
        + (hasSubtotal ? SEP_H + PROP_TOT_H : 0) + CARD_PAD;

      // Card shell — same dark "surface" card used for neutral (non
      // profit/loss) containers throughout the report module.
      p(`<rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="8" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1.5"/>`);

      // ── Property header — one line: propertyId badge + unit + address,
      // all sharing the same baseline. Used to be two stacked lines
      // (badge+unit, then address on its own row below) — pure wasted
      // vertical space, since there's plenty of horizontal room for all
      // three once the address is truncated to whatever's actually left
      // over after the badge and unit claim their width. ──
      let yi = y + CARD_PAD;

      const propIdStr  = this._svgTrunc(result.propertyId, 20);
      const propIdW    = Math.max(48, propIdStr.length * 6.5 + 12);
      p(`<rect x="${INNER_L}" y="${yi + 2}" width="${propIdW}" height="16" rx="4" fill="${CHIP_BG}"/>`);
      p(`<text x="${INNER_L + propIdW / 2}" y="${yi + 13}" font-size="9" fill="${CHIP_TXT}" font-weight="700" text-anchor="middle">${this._svgEsc(propIdStr)}</text>`);

      let headerX = INNER_L + propIdW + 8;
      if (unit) {
        p(`<text x="${headerX}" y="${yi + 13}" font-size="11" fill="${TEXT_HI}" font-weight="700">${this._svgEsc(unit)}</text>`);
        headerX += unit.length * 7.8 + 8; // rough width estimate for font-size 11 bold, consistent with the badge-width formula above
      }

      const addrMaxPx    = Math.max(0, INNER_R - headerX);
      const addrMaxChars = Math.max(4, Math.floor(addrMaxPx / 6.2)); // rough width estimate for font-size 9.5 regular
      const addrStr      = this._svgTrunc(address, addrMaxChars);
      p(`<text x="${headerX}" y="${yi + 13}" font-size="9.5" fill="${TEXT_MED}">${this._svgEsc(addrStr)}</text>`);

      yi += PROP_HDR_H;

      // ── Expense rows (recorded reimbursements: personInCharge=payer, paidTo=payee) ──
      result.expenses.forEach((exp, ei) => {
        const rowY = yi + ei * EXP_ROW_H;

        // Date
        const dateStr = exp.date
          ? new Date(exp.date).toLocaleDateString("en-SG", { day: "2-digit", month: "short" })
          : "—";
        p(`<text x="${INNER_L}" y="${rowY + 15}" font-size="9" fill="${TEXT_MED}" opacity="0.85">${this._svgEsc(dateStr)}</text>`);

        // Description (+ who it's owed to, when there are several payees)
        const descStr = this._svgTrunc(exp.item || "—", multi ? 22 : 34);
        p(
          `<text x="${INNER_L + 46}" y="${rowY + 15}" font-size="10" fill="${TEXT_HI}">${this._svgEsc(descStr)}</text>`,
        );
        if (multi) {
          const toStr = `→ ${this._svgTrunc(this._extractName(exp._payeeId), 14)}`;
          p(
            `<text x="${INNER_R - 78}" y="${rowY + 15}" font-size="9" fill="${RECEIVE_CLR}" font-weight="600" text-anchor="end">${this._svgEsc(toStr)}</text>`,
          );
        }

        // Amount — plain text, no colored badge: sign prefix carries the
        // direction (+ owed / - credited), same baseline as the date and
        // description to its left.
        // Always the SGD amount (VND items store SGD + rate), so rows add
        // up to the totals below
        const amt = parseFloat(exp.amount) || 0;
        const sign = amt < 0 ? "-" : "+";
        const amtStr = `${sign}$${Math.abs(amt).toFixed(2)}`;
        p(
          `<text x="${INNER_R}" y="${rowY + 15}" font-size="11" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${this._svgEsc(amtStr)}</text>`,
        );

        // Row separator — soft edge-to-edge fade, same treatment the
        // report export uses between its item rows, instead of an
        // alternating row background.
        p(`<line x1="${INNER_L}" y1="${rowY + EXP_ROW_H}" x2="${INNER_R}" y2="${rowY + EXP_ROW_H}" stroke="${ROW_DIV_FADE}" stroke-width="1"/>`);
      });

      yi += rowCount * EXP_ROW_H;

      // ── Property subtotal — only when there's more than one amount to sum ──
      if (hasSubtotal) {
        p(`<line x1="${INNER_L}" y1="${yi + SEP_H / 2}" x2="${INNER_R}" y2="${yi + SEP_H / 2}" stroke="${DIVIDER}" stroke-width="1"/>`);
        yi += SEP_H;

        p(`<text x="${INNER_L}" y="${yi + PROP_TOT_H - 7}" font-size="10" fill="${TEXT_HI}" font-weight="700">Property Total</text>`);
        const ptStr = `$${result.total.toFixed(2)}`;
        p(`<text x="${INNER_R}" y="${yi + PROP_TOT_H - 7}" font-size="13" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${this._svgEsc(ptStr)}</text>`);
      }

      y += cardH + CARD_GAP;
    });

    // ── Owed to each payee (several payees only) ───────────────────────────
    if (multi) {
      const ROW = 22;
      const boxH = 22 + payeeTotals.length * ROW + 6;
      p(
        `<rect x="${cardX}" y="${y}" width="${cardW}" height="${boxH}" rx="8" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`,
      );
      p(
        `<text x="${INNER_L}" y="${y + 16}" font-size="9.5" fill="${TEXT_MED}" font-weight="600" letter-spacing="0.5">OWED TO EACH PAYEE</text>`,
      );
      payeeTotals.forEach((t, i) => {
        const ry = y + 22 + i * ROW;
        const cy = ry + ROW / 2;
        renderCircleAvatar(t.avatar, t.name, INNER_L + 8, cy, 8, RECEIVE_CLR);
        p(
          `<text x="${INNER_L + 22}" y="${cy + 4}" font-size="10.5" fill="${t.count ? TEXT_HI : TEXT_MED}" font-weight="600">${this._svgEsc(this._svgTrunc(t.name, 30))}</text>`,
        );
        p(
          `<text x="${INNER_R - 90}" y="${cy + 4}" font-size="9" fill="${TEXT_MED}" text-anchor="end">${t.count} payment${t.count !== 1 ? "s" : ""}</text>`,
        );
        p(
          `<text x="${INNER_R}" y="${cy + 4}" font-size="11.5" fill="${t.count ? TEXT_HI : TEXT_MED}" font-weight="700" text-anchor="end">$${t.total.toFixed(2)}</text>`,
        );
      });
      y += boxH + 8;
    }

    // ── Grand total card — mirrors the report's summary-bar convention ────
    const gtH = 48;
    p(`<rect x="${cardX}" y="${y}" width="${cardW}" height="${gtH}" rx="8" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`);
    p(`<text x="${INNER_L}" y="${y + 16}" font-size="10" fill="${TEXT_MED}" font-weight="600" letter-spacing="0.5">TOTAL TRANSACTIONS</text>`);
    p(`<text x="${INNER_R}" y="${y + 16}" font-size="10" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${totalTx}</text>`);
    p(`<line x1="${INNER_L}" y1="${y + 22}" x2="${INNER_R}" y2="${y + 22}" stroke="${DIVIDER}" stroke-width="0.5"/>`);
    p(`<text x="${INNER_L}" y="${y + 40}" font-size="11" fill="${TEXT_HI}" font-weight="700">Grand Total (SGD)</text>`);
    const gtStr = `$${grandTotal.toFixed(2)}`;
    p(`<text x="${INNER_R}" y="${y + 40}" font-size="16" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${this._svgEsc(gtStr)}</text>`);
    y += gtH + 8;

    // ── Footer — same bar treatment as the report ──────────────────────────
    p(`<rect x="0" y="${y}" width="${W}" height="22" fill="${FOOTER_BG}"/>`);
    p(`<text x="${W / 2}" y="${y + 15}" font-size="9" fill="${TEXT_MED}" text-anchor="middle">${this._svgEsc(payerName)} &#x2192; ${this._svgEsc(payeeName)} &#xB7; ${this._svgEsc(monthName)} ${this._svgEsc(String(year))} &#xB7; Auto-generated</text>`);
    y += 22;

    const H = y;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Noto Serif,serif">`,
      `<defs>${fontFaceStyle}${defs.join("")}</defs>`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="${BASE_BG}"/>`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#exHaze)"/>`,
      ...nodes,
      `</svg>`,
    ].join("");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settlement image export (mobile-optimized SVG → PNG)
  // ─────────────────────────────────────────────────────────────────────────

  bindExportSettlementButton() {
    const btn = document.getElementById("exportSettlementBtn");
    if (btn) {
      btn.addEventListener("click", () => this.exportSettlementAsImage());
    }
    const byPayerBtn = document.getElementById("exportSettlementByPayerBtn");
    if (byPayerBtn) {
      byPayerBtn.addEventListener("click", () =>
        this.exportSettlementByPayerImage(byPayerBtn),
      );
    }
  }

  // Transfers grouped by payer (same order as the Excel copy): payers who
  // pay the most first, each payer's transfers in page order, "#" = the
  // transfer number on the page.
  _groupSettlementsByPayer(settlements) {
    const byFrom = new Map();
    settlements.forEach((st, i) => {
      if (!byFrom.has(st.fromName)) {
        byFrom.set(st.fromName, {
          name: st.fromName,
          avatar: st.fromAvatar,
          total: 0,
          transfers: [],
        });
      }
      const g = byFrom.get(st.fromName);
      g.total += st.amount;
      g.transfers.push({ ...st, n: i + 1 });
    });
    return [...byFrom.values()].sort((a, b) => b.total - a.total);
  }

  async exportSettlementByPayerImage(btn) {
    const settlements = (this.lastSettlements || []).filter(
      (s) => s.currency !== "VND",
    );
    if (settlements.length === 0) {
      alert("No settlement data to export.");
      return;
    }
    const originalHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    btn.disabled = true;
    try {
      const monthLabel =
        document
          .getElementById("bulkReportMonth")
          ?.selectedOptions?.[0]?.textContent?.trim() || "";
      const year = document.getElementById("bulkReportYear")?.value || "";
      // Properties that fed the calculation (report loaded), same count as
      // the page's "Showing X of Y reports" and the other image
      const propertyCount = (this.lastReports || []).filter(
        (r) => r.report,
      ).length;
      const svgStr = await this._generateSettlementByPayerSVG(
        settlements,
        monthLabel,
        year,
        propertyCount,
      );
      const blob = await this._svgToPngBlob(svgStr);
      this._showImagePreview(blob, {
        fileName:
          `Settlement_By_Payer_${[monthLabel, year].filter(Boolean).join("_") || "export"}.png`.replace(
            /\s+/g,
            "_",
          ),
        title: "Settlement by Payer",
        subtitle: [monthLabel, year].filter(Boolean).join(" "),
      });
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        if (typeof showToast === "function") {
          const isMac = /Mac|iPhone|iPad|iPod/.test(
            navigator.platform || navigator.userAgent,
          );
          showToast(
            `Image copied! Paste with ${isMac ? "⌘ Cmd+V" : "Ctrl+V"}`,
            "success",
            4000,
          );
        }
      } catch {
        // Clipboard is optional — the preview is the main result
      }
    } catch (err) {
      console.error("By-payer export error:", err);
      alert(`Failed to export image: ${err.message}`);
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  /*
   * Phone-first settlement image, grouped by payer (430px wide, portrait).
   * Per payer: a header with avatar, name and what they pay in total; then
   * each transfer as "#n → recipient ……… amount" with its property lines
   * underneath (what each property adds; negative = it reduces the
   * transfer). Every number comes straight from the settlement data, so the
   * lines add up to the transfer and transfers to the payer's total.
   * Text is measured with a canvas so names/addresses are cut to fit and
   * never run into the amounts.
   */
  async _generateSettlementByPayerSVG(
    settlements,
    monthLabel = "",
    year = "",
    propertyCount = null,
  ) {
    const groups = this._groupSettlementsByPayer(settlements);

    // Two 430px columns side by side (one when there's a single payer). A
    // tall narrow image gets shrunk hard by chat apps (they cap the longest
    // side), which made text blurry; two columns halve the height, like the
    // other settlement image and the report export.
    const COL_W = 430;
    const COLS = groups.length > 1 ? 2 : 1;
    const W = COL_W * COLS;
    const M = 14; // page / column margin
    const PAD = 16; // card inner padding
    // Geometry of the area being drawn: full width for header, summary and
    // footer; one column for each payer card (see useColumn)
    let cardX = M;
    let cardW = W - 2 * M;
    let IL = cardX + PAD; // inner left
    let IR = cardX + cardW - PAD; // inner right
    const useFullWidth = () => {
      cardX = M;
      cardW = W - 2 * M;
      IL = cardX + PAD;
      IR = cardX + cardW - PAD;
    };
    const useColumn = (col) => {
      cardX = col * COL_W + M;
      cardW = COL_W - 2 * M;
      IL = cardX + PAD;
      IR = cardX + cardW - PAD;
    };

    const CARD_GAP = 12;

    const grandTotal = settlements.reduce((sum, st) => sum + st.amount, 0);

    const nodes = [];
    const defs = [];
    let clipIdx = 0;
    const p = (str) => nodes.push(str);
    const esc = (t) => this._svgEsc(t);
    const money = (v) =>
      `${v < -0.005 ? "\u2212" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Text fitting with real measurements (same font family as the image)
    const ctx = document.createElement("canvas").getContext("2d");
    const fit = (text, maxPx, size, weight = 400) => {
      const t = String(text || "");
      ctx.font = `${weight} ${size}px "Noto Serif", serif`;
      if (ctx.measureText(t).width <= maxPx) return t;
      let lo = 0;
      let hi = t.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (ctx.measureText(t.slice(0, mid) + "\u2026").width <= maxPx)
          lo = mid;
        else hi = mid - 1;
      }
      return t.slice(0, lo).trimEnd() + "\u2026";
    };
    const textW = (text, size, weight = 400) => {
      ctx.font = `${weight} ${size}px "Noto Serif", serif`;
      return ctx.measureText(String(text || "")).width;
    };

    const fontFaceStyle = await this._loadFontFaceStyle();
    let logoDataUri = null;
    try {
      const logoResp = await fetch("/logo.png");
      if (logoResp.ok) {
        const logoBlob = await logoResp.blob();
        logoDataUri = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(logoBlob);
        });
      }
    } catch {
      /* logo optional */
    }
    const avatarCache = await this._fetchSettlementAvatarsAsBase64(settlements);

    // Same palette as the other exports
    const expenseTokens = getModeTokens(false);
    const receiveTokens = getModeTokens(true);
    const neutralTokens = getNeutralTokens();
    const badgeTokens = getBadgeTokens();
    const surfaceTokens = getSurfaceTokens();
    const BASE_BG = expenseTokens.base;
    const PANEL_BG = expenseTokens.panel;
    const SUMMARY_BG = expenseTokens.summaryBg;
    const FOOTER_BG = expenseTokens.footerBg;
    const BRAND = neutralTokens.brand;
    const TEXT_HI = neutralTokens.textPrimary;
    const TEXT_MED = neutralTokens.textMuted;
    const DIVIDER = neutralTokens.dividerNeutral;
    const CARD_BG = PANEL_BG;
    const CARD_BORDER = surfaceTokens.border;
    const PAY_CLR = expenseTokens.accent;
    const GET_CLR = receiveTokens.accent;
    const CHIP_BG = badgeTokens.bg;
    const CHIP_TXT = badgeTokens.text;
    const NUM = 'style="font-variant-numeric:tabular-nums"';

    defs.push(
      `<radialGradient id="bpHaze" cx="50%" cy="0%" r="90%">
        <stop offset="0%" stop-color="${PAY_CLR}" stop-opacity="0.18"/>
        <stop offset="45%" stop-color="${PAY_CLR}" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="${PAY_CLR}" stop-opacity="0"/>
      </radialGradient>`,
    );

    const avatar = (url, name, cx, cy, r, ring) => {
      const dataUri = url ? avatarCache[url] : null;
      if (dataUri) {
        const id = `bpa${clipIdx++}`;
        defs.push(
          `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`,
        );
        p(
          `<image href="${dataUri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`,
        );
      } else {
        p(
          `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${this._getAvatarColor(name)}"/>`,
        );
        p(
          `<text x="${cx}" y="${cy + r * 0.36}" font-size="${Math.round(r * 1.0)}" fill="#fff" font-weight="700" text-anchor="middle">${esc((name || "?").charAt(0).toUpperCase())}</text>`,
        );
      }
      if (ring)
        p(
          `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ring}" stroke-width="1.5"/>`,
        );
    };

    const genDate = new Date().toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const period = [monthLabel, year].filter(Boolean).join(" ");
    let y = 0;

    // ── Header ──────────────────────────────────────────────────────────
    const HDR_H = 60;
    p(`<rect x="0" y="0" width="${W}" height="${HDR_H}" fill="${PANEL_BG}"/>`);
    const LOGO = 30;
    if (logoDataUri)
      p(
        `<image href="${logoDataUri}" x="${M}" y="${(HDR_H - LOGO) / 2}" width="${LOGO}" height="${LOGO}"/>`,
      );
    const TX = M + (logoDataUri ? LOGO + 10 : 0);
    p(
      `<text x="${TX}" y="${HDR_H / 2 - 3}" font-size="9.5" fill="#ffffff" font-weight="600" letter-spacing="2" opacity="0.7">SETTLEMENT BY PAYER</text>`,
    );
    p(
      `<text x="${TX}" y="${HDR_H / 2 + 14}" font-size="9.5" fill="#ffffff" opacity="0.6">Generated ${esc(genDate)}</text>`,
    );
    if (period)
      p(
        `<text x="${W - M}" y="${HDR_H / 2 + 7}" font-size="19" fill="#ffffff" font-weight="700" text-anchor="end">${esc(period)}</text>`,
      );
    y = HDR_H;

    // ── Hero: total to transfer + key counts ─────────────────────────────
    const linesOf = (st) =>
      Array.isArray(st.propertyBreakdown) && st.propertyBreakdown.length
        ? st.propertyBreakdown
        : [];
    const propsOf = (sts) =>
      new Set(
        sts.flatMap((st) =>
          linesOf(st).map((l) => l.propertyId || l.propertyName),
        ),
      ).size;
    const HERO_H = 104;
    y += 12;
    p(
      `<rect x="${cardX}" y="${y}" width="${cardW}" height="${HERO_H}" rx="14" fill="${SUMMARY_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`,
    );
    p(
      `<text x="${IL}" y="${y + 24}" font-size="8.5" fill="${TEXT_MED}" font-weight="700" letter-spacing="1.4">TOTAL TO TRANSFER · SGD</text>`,
    );
    p(
      `<text x="${IL}" y="${y + 56}" font-size="30" fill="${TEXT_HI}" font-weight="800" ${NUM}>${esc(money(grandTotal))}</text>`,
    );
    const stats = [
      [
        String(settlements.length),
        settlements.length === 1 ? "transfer" : "transfers",
      ],
      [String(groups.length), groups.length === 1 ? "payer" : "payers"],
      [String(propertyCount ?? propsOf(settlements)), "properties"],
    ];
    const statW = (IR - IL) / stats.length;
    p(
      `<line x1="${IL}" y1="${y + 70}" x2="${IR}" y2="${y + 70}" stroke="${DIVIDER}" stroke-width="0.8"/>`,
    );
    stats.forEach(([v, label], i) => {
      const sx = IL + i * statW;
      if (i > 0)
        p(
          `<line x1="${sx}" y1="${y + 78}" x2="${sx}" y2="${y + 96}" stroke="${DIVIDER}" stroke-width="0.8"/>`,
        );
      const tx = i === 0 ? sx : sx + 12;
      p(
        `<text x="${tx}" y="${y + 92}" font-size="13" fill="${TEXT_HI}" font-weight="700" ${NUM}>${esc(v)}<tspan font-size="9.5" fill="${TEXT_MED}" font-weight="400" dx="4">${esc(label)}</tspan></text>`,
      );
    });
    y += HERO_H + 16;

    // ── One card per payer ─────────────────────────────────────────────
    // Payer at the top; a thin connector runs down from their avatar to
    // each person they pay, with that transfer's properties underneath.
    const HEAD_H = 64;
    const ROW_H = 34; // transfer row
    const PL_H = 18; // property line
    const AFTER = 8; // space after a transfer
    const AR = 17; // payer avatar radius
    const RR = 11; // recipient avatar radius
    // Connector x (under payer avatar), recipient avatar centre x and
    // recipient name / property text x, for the current column
    let vx = 0;
    let rcxBase = 0;
    let nameX = 0;

    // "#06-16, 3 Geylang East Ave 1" → unit + address
    const splitProp = (label) => {
      const t = String(label || "");
      const m = t.match(/^(#[^,]+),\s*(.*)$/);
      return m ? [m[1], m[2]] : ["", t];
    };

    const cardHeight = (g) =>
      HEAD_H +
      g.transfers.reduce(
        (sum, st) => sum + ROW_H + linesOf(st).length * PL_H + AFTER,
        0,
      ) +
      8;

    // Split payers into columns, in order: fill the left column up to half
    // the total height, the rest goes right
    const heights = groups.map(cardHeight);
    const half = heights.reduce((sum, h) => sum + h + CARD_GAP + 2, 0) / COLS;
    const columns = Array.from({ length: COLS }, () => []);
    let acc = 0;
    groups.forEach((g, i) => {
      const step = heights[i] + CARD_GAP + 2;
      const goLeft =
        COLS === 1 ||
        (columns[1].length === 0 &&
          (columns[0].length === 0 || acc + step / 2 <= half));
      if (goLeft) {
        columns[0].push(g);
        acc += step;
      } else {
        columns[1].push(g);
      }
    });

    const cardsTop = y;
    let cardsBottom = y;
    columns.forEach((colGroups, col) => {
      useColumn(col);
      vx = IL + AR;
      rcxBase = vx + 26 + RR;
      nameX = rcxBase + RR + 9;
      y = cardsTop;
      colGroups.forEach((g) => {
        const cardH = cardHeight(g);
        const clipId = `bpc${clipIdx++}`;
        defs.push(
          `<clipPath id="${clipId}"><rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="14"/></clipPath>`,
        );
        p(
          `<rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="14" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`,
        );
        // Slightly lifted header band
        p(
          `<rect x="${cardX}" y="${y}" width="${cardW}" height="${HEAD_H}" fill="#ffffff" fill-opacity="0.035" clip-path="url(#${clipId})"/>`,
        );
        p(
          `<line x1="${cardX}" y1="${y + HEAD_H}" x2="${cardX + cardW}" y2="${y + HEAD_H}" stroke="${DIVIDER}" stroke-width="0.8"/>`,
        );

        // Header: avatar · name · counts | TO PAY amount
        const hy = y + HEAD_H / 2;
        const totalStr = money(g.total);
        const totalW = textW(totalStr, 19, 800);
        const hx = IL + AR * 2 + 12;
        p(
          `<text x="${hx}" y="${hy - 2}" font-size="15" fill="${TEXT_HI}" font-weight="700">${esc(fit(g.name, IR - totalW - 16 - hx, 15, 700))}</text>`,
        );
        const n = g.transfers.length;
        const pc = propsOf(g.transfers);
        const sub = `Pays ${n} ${n === 1 ? "person" : "people"} · ${pc} propert${pc === 1 ? "y" : "ies"}`;
        p(
          `<text x="${hx}" y="${hy + 14}" font-size="9.5" fill="${TEXT_MED}">${esc(sub)}</text>`,
        );
        p(
          `<text x="${IR}" y="${hy - 8}" font-size="8" fill="${PAY_CLR}" font-weight="700" letter-spacing="1.2" text-anchor="end">TO PAY</text>`,
        );
        p(
          `<text x="${IR}" y="${hy + 13}" font-size="19" fill="${TEXT_HI}" font-weight="800" text-anchor="end" ${NUM}>${esc(totalStr)}</text>`,
        );

        // Transfers (connector first so avatars sit on top of it)
        let ty = y + HEAD_H + 4;
        const rowsAt = [];
        g.transfers.forEach((st) => {
          rowsAt.push(ty + ROW_H / 2);
          ty += ROW_H + linesOf(st).length * PL_H + AFTER;
        });
        const lastCy = rowsAt[rowsAt.length - 1];
        const R = 7; // elbow radius
        p(
          `<path d="M${vx},${hy + AR} V${lastCy - R}" stroke="${DIVIDER}" stroke-width="1.2" fill="none"/>`,
        );
        rowsAt.forEach((cy) => {
          p(
            `<path d="M${vx},${cy - R} Q${vx},${cy} ${vx + R},${cy} H${rcxBase - RR - 3}" stroke="${DIVIDER}" stroke-width="1.2" fill="none"/>`,
          );
        });
        avatar(g.avatar, g.name, IL + AR, hy, AR, null);

        ty = y + HEAD_H + 4;
        g.transfers.forEach((st, ti) => {
          const cy = rowsAt[ti];
          avatar(st.toAvatar, st.toName, rcxBase, cy, RR, null);

          const amtStr = money(st.amount);
          const amtW = textW(amtStr, 13.5, 800);
          const chip = `#${st.n}`;
          const chipW = textW(chip, 8.5, 700) + 10;
          const nameMax = IR - amtW - 14 - nameX - chipW - 8;
          const shownName = fit(st.toName, nameMax, 12.5, 700);
          p(
            `<text x="${nameX}" y="${cy + 4.5}" font-size="12.5" fill="${GET_CLR}" font-weight="700">${esc(shownName)}</text>`,
          );
          const cx0 = nameX + textW(shownName, 12.5, 700) + 8;
          p(
            `<rect x="${cx0}" y="${cy - 7}" width="${chipW}" height="14" rx="7" fill="${CHIP_BG}"/>`,
          );
          p(
            `<text x="${cx0 + chipW / 2}" y="${cy + 3}" font-size="8.5" fill="${CHIP_TXT}" font-weight="700" text-anchor="middle">${esc(chip)}</text>`,
          );
          p(
            `<text x="${IR}" y="${cy + 5}" font-size="13.5" fill="${TEXT_HI}" font-weight="800" text-anchor="end" ${NUM}>${esc(amtStr)}</text>`,
          );

          // Property lines: unit in brighter text, address muted, amount
          // (only when there's more than one — a single line is the transfer)
          const lines = linesOf(st);
          const single = lines.length === 1;
          let ly = ty + ROW_H;
          lines.forEach((line) => {
            const base = ly + PL_H / 2 + 3;
            const lAmt = single ? "" : money(line.amount);
            const lAmtW = single ? 0 : textW(lAmt, 10, 400);
            const maxW = IR - lAmtW - 12 - nameX;
            const [unit, addr] = splitProp(
              line.propertyName || line.propertyId,
            );
            const unitW = unit ? textW(unit, 9.5, 700) : 0;
            if (unit)
              p(
                `<text x="${nameX}" y="${base}" font-size="9.5" fill="${TEXT_HI}" font-weight="700" opacity="0.85">${esc(unit)}</text>`,
              );
            const addrX = nameX + (unit ? unitW + 6 : 0);
            p(
              `<text x="${addrX}" y="${base}" font-size="9.5" fill="${TEXT_MED}">${esc(fit(addr, maxW - (addrX - nameX), 9.5))}</text>`,
            );
            if (lAmt) {
              const credit = line.amount < -0.005;
              p(
                `<text x="${IR}" y="${base}" font-size="10" fill="${credit ? GET_CLR : TEXT_MED}" font-weight="${credit ? 600 : 400}" text-anchor="end" ${NUM}>${esc(lAmt)}</text>`,
              );
            }
            ly += PL_H;
          });
          ty = ly + AFTER;
        });

        y += cardH + CARD_GAP + 2;
      });
      cardsBottom = Math.max(cardsBottom, y);
    });
    y = cardsBottom;
    useFullWidth();

    // ── Footer: grand total + legend ───────────────────────────────────
    y += 4;
    p(
      `<line x1="${cardX}" y1="${y}" x2="${cardX + cardW}" y2="${y}" stroke="${DIVIDER}" stroke-width="0.8"/>`,
    );
    p(
      `<text x="${IL - 2}" y="${y + 22}" font-size="9" fill="${TEXT_MED}" font-weight="700" letter-spacing="1">GRAND TOTAL</text>`,
    );
    p(
      `<text x="${IR + 2}" y="${y + 23}" font-size="15" fill="${TEXT_HI}" font-weight="800" text-anchor="end" ${NUM}>${esc(money(grandTotal))}</text>`,
    );
    y += 36;
    p(`<rect x="0" y="${y}" width="${W}" height="30" fill="${FOOTER_BG}"/>`);
    p(
      `<text x="${W / 2}" y="${y + 19}" font-size="8.5" fill="${TEXT_MED}" text-anchor="middle">Amounts in SGD · #n = transfer number on the report · <tspan fill="${GET_CLR}">−green</tspan> = reduces the transfer</text>`,
    );
    y += 30;

    const H = Math.ceil(y);
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Noto Serif,serif">`,
      `<defs>${fontFaceStyle}${defs.join("")}</defs>`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="${BASE_BG}"/>`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#bpHaze)"/>`,
      ...nodes,
      `</svg>`,
    ].join("");
  }

  async exportSettlementAsImage() {
    const btn = document.getElementById("exportSettlementBtn");
    if (!btn) return;

    const settlements = this.lastSettlements;
    if (!settlements || settlements.length === 0) {
      alert("No settlement data to export.");
      return;
    }

    // Properties that actually fed into this calculation (report successfully loaded)
    const properties = (this.lastReports || [])
      .filter((r) => r.report && r.propertyData)
      .map((r) => r.propertyData);

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    btn.disabled = true;

    try {
      // Read once, pass into the SVG so its header can show the period
      // (display-only — doesn't feed into any calculation).
      const monthLabel = document.getElementById("bulkReportMonth")?.selectedOptions?.[0]?.textContent?.trim() || "";
      const year = document.getElementById("bulkReportYear")?.value || "";

      const svgStr = await this._generateSettlementSVG(
        settlements,
        properties,
        monthLabel,
        year,
        this.lastGroupBreakdowns || [],
      );
      const blob = await this._svgToPngBlob(svgStr);

      // Show preview modal first (non-blocking)
      this._showImagePreview(blob, {
        fileName: `Settlement_Transfers_${(monthLabel + "_" + year).replace(/\s+/g, "_") || "export"}.png`,
        title: "Settlement Preview",
        subtitle: [monthLabel, year].filter(Boolean).join(" "),
      });

      // Also copy to clipboard (best-effort)
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        if (typeof showToast === "function") {
          const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
          showToast(`Image copied! Paste with ${isMac ? "⌘ Cmd+V" : "Ctrl+V"}`, "success", 4000);
        }
      } catch (_clipErr) {
        // Clipboard copy is optional — preview modal is the primary deliverable
      }

      btn.innerHTML = '<i class="bi bi-check-circle"></i>';
      btn.classList.remove("btn-light");
      btn.classList.add("btn-success");

      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove("btn-success");
        btn.classList.add("btn-light");
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error("Settlement export error:", err);
      btn.innerHTML = originalHTML;
      btn.disabled = false;
      alert(`Failed to export image: ${err.message}`);
    }
  }

  /** Fetch avatar images for all settlement participants → base64 data URIs */
  async _fetchSettlementAvatarsAsBase64(settlements) {
    const urls = new Set();
    settlements.forEach((s) => {
      if (s.fromAvatar) urls.add(s.fromAvatar);
      if (s.toAvatar) urls.add(s.toAvatar);
    });

    const cache = {};
    await Promise.all(
      [...urls].map(async (url) => {
        try {
          // "medium" (160x160) rather than "small" (80x80) — this cache only
          // feeds the exported image, which renders at up to 3× canvas scale
          // (see _svgToPngBlob) and gets pinch-zoomed, so avatars need real
          // resolution to stay crisp, not just look right at 1x on screen.
          const optimized = this.getOptimizedAvatarUrl(url, "medium");
          const resp = await fetch(optimized);
          if (!resp.ok) return;
          const blob = await resp.blob();
          cache[url] = await new Promise((res) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch {
          // fall back to initials circle
        }
      }),
    );
    return cache;
  }

  /**
   * Build a Cloudinary transform URL sized to the actual thumbnail box
   * (unlike getOptimizedAvatarUrl's fixed 80×80 square preset, which — when
   * sliced into a wide/short landscape box — upscales a tiny square crop and
   * produces a badly pixelated, "broken"-looking image).
   */
  _getPropertyThumbnailUrl(url, boxW, boxH, scale = 3) {
    if (!url) return url;
    const baseUrl = ImageUtils.normalizeImageUrl(url);

    if (baseUrl.includes("/api/upload/image-proxy/")) {
      // Cloudinary via our proxy — safe to fetch directly, apply a sized transform.
      const w = Math.max(1, Math.round(boxW * scale));
      const h = Math.max(1, Math.round(boxH * scale));
      const transformation = `w_${w},h_${h},c_fill,f_auto,q_auto`;
      return baseUrl.replace(
        "/api/upload/image-proxy/",
        `/api/upload/image-proxy/${transformation}/`,
      );
    }

    // Full external URL. Cloudinary's own delivery domain sends CORS headers
    // and can be fetched directly; anything else (e.g. property photos
    // imported from a third-party listing source on their own S3 bucket)
    // usually doesn't, so route it through our backend proxy — otherwise
    // the export's fetch() fails with a CORS error and the photo can't load.
    if (/^https?:\/\/res\.cloudinary\.com\//i.test(baseUrl)) {
      return baseUrl;
    }
    return `/api/upload/external-image-proxy?url=${encodeURIComponent(baseUrl)}`;
  }

  async _fetchPropertyImagesAsBase64(properties, boxW, boxH) {
    const cache = {};
    await Promise.all(
      properties
        .filter((p) => p.propertyImage)
        .map(async (p) => {
          try {
            const optimized = this._getPropertyThumbnailUrl(p.propertyImage, boxW, boxH);
            const resp = await fetch(optimized);
            if (!resp.ok) return;
            const blob = await resp.blob();
            cache[p.propertyImage] = await new Promise((res) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result);
              reader.readAsDataURL(blob);
            });
          } catch {
            // fall back to a plain color tile
          }
        }),
    );
    return cache;
  }

  /** XML-escape for safe SVG embedding */
  _svgEsc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Fetch Noto Serif font faces as base64 @font-face style block for SVG embedding */
  async _loadFontFaceStyle() {
    const _toB64DataUri = async (url) => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const bytes = new Uint8Array(buf);
        let s = "";
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return `data:font/truetype;base64,${btoa(s)}`;
      } catch {
        return null;
      }
    };
    const [fontRegUri, fontBoldUri] = await Promise.all([
      _toB64DataUri("/fonts/NotoSerif-Regular.ttf"),
      _toB64DataUri("/fonts/NotoSerif-Bold.ttf"),
    ]);
    return fontRegUri || fontBoldUri
      ? `<style>
      @font-face { font-family: 'Noto Serif'; font-weight: 400; src: url('${fontRegUri}') format('truetype'); }
      @font-face { font-family: 'Noto Serif'; font-weight: 700; src: url('${fontBoldUri}') format('truetype'); }
    </style>`
      : "";
  }

  /** Truncate text to maxChars with ellipsis */
  _svgTrunc(text, maxChars) {
    if (!text) return "";
    return text.length > maxChars ? text.substring(0, maxChars - 1) + "\u2026" : text;
  }

  /** Word-wrap text into lines of at most maxChars */
  _svgWrapText(text, maxChars) {
    const words = (text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (test.length <= maxChars) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  /** Deterministic avatar fallback color from name */
  _getAvatarColor(name) {
    const palette = ["#ef4444","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6","#8b5cf6","#ec4899"];
    let h = 0;
    const s = name || "?";
    for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  /** Convert SVG string to high-res PNG Blob at 2× scale */
  /** Convert SVG string to a high-res PNG Blob. Renders at up to 3× so text
   * and embedded photos stay crisp when the exported image is pinch-zoomed
   * (matches financial-reports.js's _svgToPngBlob). */
  _svgToPngBlob(svgStr) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const TARGET_SCALE = 3;
        const MAX_CANVAS_PIXELS = 24_000_000; // safe headroom under common mobile canvas limits
        const scale = Math.min(
          TARGET_SCALE,
          Math.sqrt(MAX_CANVAS_PIXELS / (img.naturalWidth * img.naturalHeight)),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
          "image/png",
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to render SVG"));
      };
      img.src = url;
    });
  }

  /** Show an exported PNG blob in a Bootstrap preview modal (mirrors financial-reports.js pattern) */
  _showImagePreview(blob, { fileName = "export.png", title = "Image Preview", subtitle = "" } = {}) {
    const objectUrl = URL.createObjectURL(blob);

    // Remove any stale preview modal
    document.getElementById("bulkImagePreviewModal")?.remove();

    const modalHtml = `
      <div class="modal fade" id="bulkImagePreviewModal" tabindex="-1"
           aria-labelledby="bulkImagePreviewModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content" style="border-radius:16px;overflow:hidden;">
            <div class="modal-header border-0 pb-0" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
              <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle bg-white d-flex align-items-center justify-content-center"
                     style="width:32px;height:32px;flex-shrink:0;">
                  <i class="bi bi-image text-primary" style="font-size:1rem;"></i>
                </div>
                <h6 class="modal-title text-white fw-bold mb-0" id="bulkImagePreviewModalLabel">
                  ${escapeHtml(title)}
                  ${subtitle ? `<small class="fw-normal opacity-75 ms-2" style="font-size:0.75rem;">${escapeHtml(subtitle)}</small>` : ""}
                </h6>
              </div>
              <button type="button" class="btn-close btn-close-white ms-auto"
                      data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0 text-center bg-dark" style="min-height:200px;">
              <img id="bulkPreviewImg" src="${objectUrl}" alt="${escapeHtml(title)}"
                   style="max-width:100%;display:block;margin:0 auto;" />
            </div>
            <div class="modal-footer border-0 justify-content-between"
                 style="background:#f8f9fa;">
              <div class="text-muted" style="font-size:0.78rem;">
                <i class="bi bi-keyboard me-1"></i>Press <kbd>Esc</kbd> to close
              </div>
              <div class="d-flex gap-2">
                <a href="${objectUrl}" download="${escapeHtml(fileName)}"
                   class="btn btn-primary btn-sm">
                  <i class="bi bi-download me-1"></i>Download PNG
                </a>
                <button type="button" class="btn btn-outline-secondary btn-sm"
                        data-bs-dismiss="modal">
                  <i class="bi bi-x-lg me-1"></i>Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modalEl = document.getElementById("bulkImagePreviewModal");
    const modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });

    // Revoke object URL when the modal is fully hidden to free memory
    modalEl.addEventListener("hidden.bs.modal", () => {
      URL.revokeObjectURL(objectUrl);
      modalEl.remove();
    }, { once: true });

    // Explicit Escape handler — dynamically created modals can miss Bootstrap's built-in keyboard trap
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        modal.hide();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    modalEl.addEventListener("hidden.bs.modal", () => {
      document.removeEventListener("keydown", onKeyDown);
    }, { once: true });

    modal.show();
  }

  /**
   * Generate a mobile-optimized settlement SVG (portrait, iPhone 14 Pro/Max).
   * Width = 390px. Height is dynamic based on settlement count and breakdown depth.
   *
   * Styling only — every number below (settlements, properties, each
   * settlement.amount / propertyBreakdown[].amount, totals) is read
   * exactly as computed upstream (calculatePropertySettlements /
   * calculateSettlementsForCurrency); nothing here changes what's
   * calculated, only how it's drawn. Re-themed to match the settlement
   * extraction export (_generateExtractionSVG) and the single-property
   * report export (_generateReportSVG in financial-reports.js): same
   * dark base + accent haze, brand logo, Noto Serif type, and every color
   * sourced from the shared financial-report-theme module instead of a
   * one-off hand-rolled purple palette, so all three exports read as one
   * family instead of three different apps. Like the extraction export,
   * this stays in "expense" (red) mode — it's fundamentally a list of
   * debts to settle, not a profit/loss figure. No dollar amount gets a
   * colored pill/badge — every amount is plain right-aligned text (a
   * leading +/- carries direction on line items; running totals just
   * show the plain figure, no sign, matching the extraction export's
   * convention) — distinction comes from typography weight/size, not color.
   */
  async _generateSettlementSVG(
    settlements,
    properties = [],
    monthLabel = "",
    year = "",
    groupBreakdowns = [],
  ) {
    // ── Layout constants ──────────────────────────────────────────────────
    // Two columns, each keeping the original single-column card geometry;
    // content fills the left column up to its target height, then flows
    // into the right column (like CSS `column-fill: auto`).
    const COL_W   = 430;   // iPhone 14 Pro Max logical width — per column
    const COL_GAP = 10;    // gap between the two columns
    const TOTAL_W = COL_W * 2 + COL_GAP;
    const M       = 12;    // page margin
    const CARD_MX = 4;     // extra horizontal inset per card
    const cardW   = COL_W - 2 * (M + CARD_MX); // 398 — same card width in both columns

    // Property list: compact chips (small square photo + address + unit).
    // It's reference info only, so it stays small and the settlement cards
    // below get the space.
    const PROP_COLS = 6;
    const PROP_GAP = 6;
    const PROP_THUMB_H = 24; // square thumbnail
    const propCardW =
      (TOTAL_W - 2 * M - (PROP_COLS - 1) * PROP_GAP) / PROP_COLS;
    const propCardH = PROP_THUMB_H + 4;

    // Row heights within each card
    const CARD_PAD_TOP    = 12;
    const CARD_PAD_BOT    = 12;
    const SUB_ROW_H       = 24; // "from" / "to" sub-row (stacked, so long names don't get cut off)
    const SUB_ROW_GAP     = 6;
    const NAME_ROW_H      = SUB_ROW_H * 2 + SUB_ROW_GAP; // stacked from/to rows
    const AMT_ROW_H       = 24; // transfer amount row
    const LABEL_ROW_H     = 18; // "step-by-step" label
    const PROP_ROW_H      = 20; // each property line
    const SEP_H           = 8;  // separator before net total
    const NET_ROW_H       = 30; // net total row (plain text, bigger figure)
    const CARD_GAP        = 8;  // gap between cards

    const nodes  = [];
    const defs   = [];
    let   clipIdx = 0;
    const p = (s) => nodes.push(s);

    const fontFaceStyle = await this._loadFontFaceStyle();

    // Brand logo — same asset + fetch pattern as the report and extraction exports.
    let logoDataUri = null;
    try {
      const logoResp = await fetch("/logo.png");
      if (logoResp.ok) {
        const logoBlob = await logoResp.blob();
        logoDataUri = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.readAsDataURL(logoBlob);
        });
      }
    } catch {
      /* logo optional */
    }

    // ── Colour palette — same tokens & "dark base + accent haze" language
    // as the report and extraction exports (see financial-report-theme.js).
    const expenseTokens = getModeTokens(false); // "loss"/red — a settlement list is always a payable list
    const receiveTokens = getModeTokens(true);  // "profit"/green — used only for the receiving side
    const neutralTokens = getNeutralTokens();
    const badgeTokens   = getBadgeTokens();
    const surfaceTokens = getSurfaceTokens();

    const BASE_BG     = expenseTokens.base;
    const PANEL_BG    = expenseTokens.panel;
    const SUMMARY_BG  = expenseTokens.summaryBg;
    const FOOTER_BG   = expenseTokens.footerBg;
    const BRAND       = neutralTokens.brand;
    const TEXT_HI     = neutralTokens.textPrimary;
    const TEXT_MED    = neutralTokens.textMuted;
    const DIVIDER     = neutralTokens.dividerNeutral;
    // Cards reuse the header's own PANEL_BG rather than a separate surface
    // tone — the report family never mixes hues, every surface is a shade
    // of the same warm mode palette, so this keeps every card in that
    // same family instead of reading as an unrelated block dropped on top.
    const CARD_BG     = PANEL_BG;
    const CARD_BORDER = surfaceTokens.border;
    const EXPENSE_CLR = expenseTokens.accent; // "from" / paying side
    const RECEIVE_CLR = receiveTokens.accent; // "to" / receiving side
    const CHIP_BG     = badgeTokens.bg;       // neutral reference marker (step number, property ID)
    const CHIP_TXT    = badgeTokens.text;

    // Full-bleed background haze — same recipe as the report/extraction exports.
    defs.push(
      `<radialGradient id="setHaze" cx="50%" cy="0%" r="90%">
        <stop offset="0%" stop-color="${EXPENSE_CLR}" stop-opacity="0.18"/>
        <stop offset="45%" stop-color="${EXPENSE_CLR}" stop-opacity="0.06"/>
        <stop offset="100%" stop-color="${EXPENSE_CLR}" stop-opacity="0"/>
      </radialGradient>`
    );
    // Row divider — fades out at both edges instead of a flat line, same
    // convention the report and extraction exports use between item rows.
    defs.push(
      `<linearGradient id="setRowDivGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>`
    );
    const ROW_DIV_FADE = "url(#setRowDivGrad)";

    // Avatar + property thumbnail caches
    // (group members' avatars ride along as extra "from" entries)
    const avatarCache = await this._fetchSettlementAvatarsAsBase64([
      ...settlements,
      ...groupBreakdowns.flatMap((g) =>
        g.members.map((m) => ({ fromAvatar: m.avatar })),
      ),
    ]);
    const propImageCache = await this._fetchPropertyImagesAsBase64(
      properties,
      PROP_THUMB_H * 2,
      PROP_THUMB_H * 2,
    );

    const renderCircleAvatar = (avatarUrl, name, cx, cy, r = 13, fallbackColor = TEXT_MED) => {
      const dataUri = avatarUrl ? avatarCache[avatarUrl] : null;
      if (dataUri) {
        const id = `sc${clipIdx++}`;
        defs.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
        p(`<image href="${dataUri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`);
      } else {
        const fc = fallbackColor || this._getAvatarColor(name);
        p(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fc}"/>`);
        p(`<text x="${cx}" y="${cy + Math.round(r * 0.44)}" font-size="${Math.round(r * 0.95)}" fill="#fff" font-weight="700" text-anchor="middle">${this._svgEsc((name || "?").charAt(0).toUpperCase())}</text>`);
      }
    };

    const genDate = new Date().toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" });

    // ── Header — logo + kicker + period, same structure as the report and
    // extraction exports. ──────────────────────────────────────────────
    const HDR_H = 58;
    const LOGO_SIZE = 32;
    const LOGO_X = M;
    const LOGO_Y = Math.round((HDR_H - LOGO_SIZE) / 2);
    p(`<rect x="0" y="0" width="${TOTAL_W}" height="${HDR_H}" fill="${PANEL_BG}"/>`);
    if (logoDataUri) {
      p(`<image href="${logoDataUri}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_SIZE}" height="${LOGO_SIZE}"/>`);
    }
    const TX = LOGO_X + (logoDataUri ? LOGO_SIZE + 10 : 0);
    const HDR_MIDY = HDR_H / 2;
    p(`<text x="${TX}" y="${HDR_MIDY - 3}" font-size="11" fill="#ffffff" font-weight="600" letter-spacing="2" opacity="0.7">SETTLEMENT INSTRUCTIONS</text>`);
    const subLabel = `${properties.length} propert${properties.length === 1 ? "y" : "ies"} · ${settlements.length} transaction${settlements.length === 1 ? "" : "s"}`;
    p(`<text x="${TX}" y="${HDR_MIDY + 16}" font-size="10" fill="#ffffff" opacity="0.6">${this._svgEsc(subLabel)} · Generated ${this._svgEsc(genDate)}</text>`);
    if (monthLabel || year) {
      p(`<text x="${TOTAL_W - M}" y="${HDR_MIDY + 7}" font-size="20" fill="#ffffff" font-weight="700" text-anchor="end">${this._svgEsc([monthLabel, year].filter(Boolean).join(" "))}</text>`);
    }
    let y = HDR_H;

    // ── Info box (full width) ───────────────────────────────────────────
    const txCount = settlements.length;
    const infoText = `Follow these ${txCount} transaction${txCount !== 1 ? "s" : ""} to settle all debts between investors. Transactions are netted across all properties.`;
    const infoWrapChars = Math.floor(52 * (TOTAL_W / COL_W));
    const infoLines = this._svgWrapText(infoText, infoWrapChars);
    const INFO_H = 14 + infoLines.length * 14 + 10;
    p(`<rect x="0" y="${y}" width="${TOTAL_W}" height="${INFO_H}" fill="${SUMMARY_BG}"/>`);
    p(`<rect x="0" y="${y}" width="4" height="${INFO_H}" fill="${BRAND}"/>`);
    infoLines.forEach((line, i) => {
      p(`<text x="${M + 8}" y="${y + 20 + i * 14}" font-size="10.5" fill="${TEXT_MED}">${this._svgEsc(line)}</text>`);
    });
    y += INFO_H + 10;

    // ── Selected properties (full width) — compact chips: tiny photo on
    // the left, address + unit on the right. ────────────────────────────
    if (properties.length > 0) {
      const propsSorted = [...properties].sort(
        (a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0),
      );
      const propRows = Math.ceil(propsSorted.length / PROP_COLS);
      const textX0 = 2 + PROP_THUMB_H + 6; // text offset inside a chip
      const textMaxChars = Math.max(
        8,
        Math.floor((propCardW - textX0 - 4) / 4.4),
      );

      p(
        `<text x="${M}" y="${y + 8}" font-size="8.5" fill="${TEXT_MED}" font-weight="700" letter-spacing="0.5" opacity="0.7">PROPERTIES (${propsSorted.length})</text>`,
      );
      y += 14;
      const gridTop = y;

      propsSorted.forEach((prop, i) => {
        const col = i % PROP_COLS;
        const row = Math.floor(i / PROP_COLS);
        const px = M + col * (propCardW + PROP_GAP);
        const py = gridTop + row * (propCardH + PROP_GAP);
        const tx = px + 2;
        const ty = py + 2;

        p(
          `<rect x="${px}" y="${py}" width="${propCardW}" height="${propCardH}" rx="6" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`,
        );

        const dataUri = prop.propertyImage
          ? propImageCache[prop.propertyImage]
          : null;
        if (dataUri) {
          const clipId = `pc${clipIdx++}`;
          defs.push(
            `<clipPath id="${clipId}"><rect x="${tx}" y="${ty}" width="${PROP_THUMB_H}" height="${PROP_THUMB_H}" rx="4"/></clipPath>`,
          );
          p(
            `<image href="${dataUri}" x="${tx}" y="${ty}" width="${PROP_THUMB_H}" height="${PROP_THUMB_H}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`,
          );
        } else {
          const fc = this._getAvatarColor(
            prop.address || prop.propertyId || "?",
          );
          p(
            `<rect x="${tx}" y="${ty}" width="${PROP_THUMB_H}" height="${PROP_THUMB_H}" rx="4" fill="${fc}"/>`,
          );
          const initial = (prop.unit || prop.propertyId || "?")
            .toString()
            .charAt(0)
            .toUpperCase();
          p(
            `<text x="${tx + PROP_THUMB_H / 2}" y="${ty + PROP_THUMB_H / 2 + 4}" font-size="11" fill="#ffffff" font-weight="700" text-anchor="middle">${this._svgEsc(initial)}</text>`,
          );
        }

        const addrStr = this._svgTrunc(
          prop.address || prop.propertyId || "",
          textMaxChars,
        );
        const lineY = prop.unit ? py + 12 : py + propCardH / 2 + 3;
        p(
          `<text x="${px + textX0}" y="${lineY}" font-size="8" fill="${TEXT_HI}" font-weight="700">${this._svgEsc(addrStr)}</text>`,
        );
        if (prop.unit) {
          const unitStr = this._svgTrunc(prop.unit, textMaxChars);
          p(
            `<text x="${px + textX0}" y="${py + 22}" font-size="7.5" fill="${TEXT_MED}">${this._svgEsc(unitStr)}</text>`,
          );
        }
      });

      y = gridTop + propRows * propCardH + (propRows - 1) * PROP_GAP + 12;
    }

    const colTop = y;

    // ── Card height + renderer (parameterized by column x-offset) ───────
    const cardHeightOf = (settlement) => {
      const hasBreakdown = Array.isArray(settlement.propertyBreakdown) && settlement.propertyBreakdown.length > 0;
      const numProps     = hasBreakdown ? settlement.propertyBreakdown.length : 0;
      // The top amount row is skipped when there's a breakdown — the "Net
      // Amount to Transfer" line at the bottom already shows this same
      // figure, so showing both was a duplicated, confusing number.
      let innerH = NAME_ROW_H + (hasBreakdown ? 0 : AMT_ROW_H);
      if (hasBreakdown) innerH += LABEL_ROW_H + numProps * PROP_ROW_H + SEP_H + NET_ROW_H;
      return CARD_PAD_TOP + innerH + CARD_PAD_BOT;
    };

    const renderCard = (settlement, index, xOffset, yTop) => {
      const cardX   = xOffset + M + CARD_MX;
      const INNER_L = cardX + 12;
      const INNER_R = cardX + cardW - 12;
      const hasBreakdown = Array.isArray(settlement.propertyBreakdown) && settlement.propertyBreakdown.length > 0;
      const cardH   = cardHeightOf(settlement);
      const cardY   = yTop;

      // Card shell — same dark panel tone as every other surface in this export.
      p(`<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="10" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1.5"/>`);

      // ── Row 1: step number + from (top line) / to (bottom line) ───────
      // Stacked instead of side-by-side so long investor names get the
      // full card width instead of being squeezed and cut off.
      const CHARS_PER_PX = 1 / 7; // matches this file's existing text-width estimate

      // From person (top line): step number + avatar + name
      const y_from  = cardY + CARD_PAD_TOP + Math.floor(SUB_ROW_H / 2);
      const BADGE_R = 11;
      const badgeCx = INNER_L + BADGE_R;
      p(`<circle cx="${badgeCx}" cy="${y_from}" r="${BADGE_R}" fill="${CHIP_BG}"/>`);
      p(`<text x="${badgeCx}" y="${y_from + 4}" font-size="${index < 9 ? 11 : 9}" fill="${CHIP_TXT}" font-weight="700" text-anchor="middle">${index + 1}</text>`);

      const FROM_R    = 12;
      const fromCx    = badgeCx + BADGE_R + 6 + FROM_R;
      renderCircleAvatar(settlement.fromAvatar, settlement.fromName, fromCx, y_from, FROM_R, EXPENSE_CLR);

      const fromNameX     = fromCx + FROM_R + 5;
      const fromMaxChars  = Math.max(10, Math.floor((INNER_R - fromNameX) * CHARS_PER_PX));
      const fromNameStr   = this._svgTrunc(settlement.fromName, fromMaxChars);
      p(`<text x="${fromNameX}" y="${y_from + 5}" font-size="12" fill="${EXPENSE_CLR}" font-weight="700">${this._svgEsc(fromNameStr)}</text>`);

      // To person (bottom line): down-arrow + avatar + name, indented under the badge
      const y_to = y_from + SUB_ROW_H + SUB_ROW_GAP;
      p(`<text x="${badgeCx}" y="${y_to + 5}" font-size="13" fill="${TEXT_MED}" text-anchor="middle">&#x21B3;</text>`);

      const TO_R = 12;
      const toCx = fromCx; // align under the from-avatar
      renderCircleAvatar(settlement.toAvatar, settlement.toName, toCx, y_to, TO_R, RECEIVE_CLR);

      const toNameX    = fromNameX; // align under the from-name
      const toMaxChars = Math.max(10, Math.floor((INNER_R - toNameX) * CHARS_PER_PX));
      const toNameStr  = this._svgTrunc(settlement.toName, toMaxChars);
      p(`<text x="${toNameX}" y="${y_to + 5}" font-size="12" fill="${RECEIVE_CLR}" font-weight="700">${this._svgEsc(toNameStr)}</text>`);

      // ── Row 2: transfer amount — plain text, right-aligned, no badge.
      // Only rendered when there's no breakdown to show it in; otherwise
      // the "Net Amount to Transfer" line below already shows this same
      // figure, so showing both was a duplicated number. ──
      if (!hasBreakdown) {
        const y_amt  = cardY + CARD_PAD_TOP + NAME_ROW_H + Math.floor(AMT_ROW_H / 2);
        const amtStr = settlement.currency === "VND"
          ? `₫${settlement.amount.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`
          : `$${settlement.amount.toFixed(2)}`;
        p(`<text x="${INNER_R}" y="${y_amt + 5}" font-size="16" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${this._svgEsc(amtStr)}</text>`);
      }

      // ── Property breakdown ────────────────────────────────────────────
      if (hasBreakdown) {
        let yi = cardY + CARD_PAD_TOP + NAME_ROW_H;

        // "Step-by-step calculation:" label
        p(`<text x="${INNER_L}" y="${yi + LABEL_ROW_H - 5}" font-size="8.5" fill="${TEXT_MED}" font-weight="600" letter-spacing="0.5" opacity="0.85">STEP-BY-STEP CALCULATION</text>`);
        yi += LABEL_ROW_H;

        // Property rows — plain text, no colored pill/icon; sign prefix
        // alone carries direction (matches the extraction export's line items).
        settlement.propertyBreakdown.forEach((prop) => {
          const rowY       = yi;
          yi              += PROP_ROW_H;
          const propName   = this._svgTrunc(prop.propertyName || prop.propertyId, 50);
          p(`<text x="${INNER_L + 2}" y="${rowY + 14}" font-size="9.5" fill="${TEXT_MED}">${this._svgEsc(propName)}</text>`);

          const isNeg      = prop.amount < 0;
          const dispAmt    = Math.abs(prop.amount);
          const propAmtStr = `${isNeg ? "+" : "-"}$${dispAmt.toFixed(2)}`;
          p(`<text x="${INNER_R - 2}" y="${rowY + 14}" font-size="10" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${this._svgEsc(propAmtStr)}</text>`);

          // Soft row separator — same fading-divider convention as the
          // report and extraction exports, instead of a colored pill per row.
          p(`<line x1="${INNER_L}" y1="${rowY + PROP_ROW_H}" x2="${INNER_R}" y2="${rowY + PROP_ROW_H}" stroke="${ROW_DIV_FADE}" stroke-width="1"/>`);
        });

        // Separator
        p(`<line x1="${INNER_L}" y1="${yi + 2}" x2="${INNER_R}" y2="${yi + 2}" stroke="${DIVIDER}" stroke-width="1"/>`);
        yi += SEP_H;

        // Net total row — plain text, no filled badge/band. The separator
        // line above is the only divider; the figure itself is just larger
        // and bolder so it still reads as the final answer. No leading
        // sign here — it's a running total, not a single directional line
        // item (same convention as the extraction export's totals).
        p(`<text x="${INNER_L + 2}" y="${yi + NET_ROW_H - 9}" font-size="12" fill="${TEXT_HI}" font-weight="700">Net Amount to Transfer</text>`);
        const netAmtStr = settlement.currency === "VND"
          ? `₫${settlement.amount.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`
          : `$${settlement.amount.toFixed(2)}`;
        p(`<text x="${INNER_R - 2}" y="${yi + NET_ROW_H - 9}" font-size="19" fill="${TEXT_HI}" font-weight="800" text-anchor="end">${this._svgEsc(netAmtStr)}</text>`);
      }

      return cardY + cardH + CARD_GAP;
    };

    // ── Split settlements across 2 columns: fill the left column up to its
    // target (balanced) height first, then flow the remainder to the right —
    // same idea as CSS `column-fill: auto`. ───────────────────────────────
    const heights = settlements.map(cardHeightOf);
    const totalContentH = heights.reduce((sum, h) => sum + h + CARD_GAP, 0);
    const targetColH = totalContentH / 2;

    const leftCol = [];
    const rightCol = [];
    let leftAccum = 0;
    let leftFull = false;
    settlements.forEach((settlement, index) => {
      const h = heights[index];
      if (!leftFull) {
        const prospective = leftAccum + h + CARD_GAP;
        if (leftCol.length === 0 || prospective <= targetColH) {
          leftCol.push({ settlement, index });
          leftAccum = prospective;
          return;
        }
        leftFull = true;
      }
      rightCol.push({ settlement, index });
    });

    // ── Render both columns ─────────────────────────────────────────────
    let leftY = colTop;
    leftCol.forEach(({ settlement, index }) => {
      leftY = renderCard(settlement, index, 0, leftY);
    });

    let rightY = colTop;
    rightCol.forEach(({ settlement, index }) => {
      rightY = renderCard(settlement, index, COL_W + COL_GAP, rightY);
    });

    y = rightCol.length > 0 ? Math.max(leftY, rightY) : leftY;

    const fullCardX = M + CARD_MX;
    const fullCardW = TOTAL_W - 2 * (M + CARD_MX);
    const fullInnerL = fullCardX + 12;
    const fullInnerR = fullCardX + fullCardW - 12;

    // ── Inside each group (full width): how the group's total splits
    // across its members. Only present for users allowed to see it. ─────
    const money = (v) => `${v < -0.005 ? "-" : ""}$${Math.abs(v).toFixed(2)}`;
    groupBreakdowns.forEach((g) => {
      const HEAD_H = 40;
      const COLHEAD_H = 18;
      const ROW_H = 26;
      const NOTE_H = 22;
      const cardH = HEAD_H + COLHEAD_H + g.members.length * ROW_H + NOTE_H;
      p(
        `<rect x="${fullCardX}" y="${y}" width="${fullCardW}" height="${cardH}" rx="10" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1.5"/>`,
      );

      // Header: group avatar + "Inside <group>" + group total
      const gcy = y + HEAD_H / 2 + 2;
      renderCircleAvatar(
        g.avatar,
        g.name,
        fullInnerL + 12,
        gcy,
        12,
        RECEIVE_CLR,
      );
      p(
        `<text x="${fullInnerL + 30}" y="${gcy - 2}" font-size="9" fill="${TEXT_MED}" font-weight="700" letter-spacing="0.6">INSIDE THE GROUP</text>`,
      );
      p(
        `<text x="${fullInnerL + 30}" y="${gcy + 11}" font-size="12.5" fill="${TEXT_HI}" font-weight="700">${this._svgEsc(g.name)} &#xB7; ${g.members.filter((m) => !m.isRemainder).length} members</text>`,
      );
      const gLabel =
        g.final > 0.005
          ? "Group receives"
          : g.final < -0.005
            ? "Group pays"
            : "Balanced";
      const gColor =
        g.final > 0.005
          ? RECEIVE_CLR
          : g.final < -0.005
            ? EXPENSE_CLR
            : TEXT_MED;
      p(
        `<text x="${fullInnerR}" y="${gcy - 2}" font-size="9" fill="${TEXT_MED}" font-weight="700" text-anchor="end">${gLabel.toUpperCase()}</text>`,
      );
      p(
        `<text x="${fullInnerR}" y="${gcy + 13}" font-size="16" fill="${gColor}" font-weight="800" text-anchor="end">$${Math.abs(g.final).toFixed(2)}</text>`,
      );

      // Column headers
      const cols = [
        { key: "pct", label: "GROUP %", x: fullInnerL + 360 },
        { key: "profitShare", label: "PROFIT SHARE", x: fullInnerL + 470 },
        { key: "paid", label: "PAID", x: fullInnerL + 560 },
        { key: "received", label: "RECEIVED", x: fullInnerL + 650 },
        { key: "final", label: "FINAL", x: fullInnerR },
      ];
      let ry = y + HEAD_H;
      p(
        `<line x1="${fullInnerL}" y1="${ry}" x2="${fullInnerR}" y2="${ry}" stroke="${DIVIDER}" stroke-width="0.5"/>`,
      );
      p(
        `<text x="${fullInnerL}" y="${ry + 12}" font-size="8" fill="${TEXT_MED}" font-weight="700" letter-spacing="0.5">MEMBER</text>`,
      );
      cols.forEach((c) =>
        p(
          `<text x="${c.x}" y="${ry + 12}" font-size="8" fill="${TEXT_MED}" font-weight="700" letter-spacing="0.5" text-anchor="end">${c.label}</text>`,
        ),
      );
      ry += COLHEAD_H;

      g.members.forEach((m, i) => {
        const cy = ry + ROW_H / 2;
        if (i > 0)
          p(
            `<line x1="${fullInnerL}" y1="${ry}" x2="${fullInnerR}" y2="${ry}" stroke="${ROW_DIV_FADE}" stroke-width="1"/>`,
          );
        let nameX = fullInnerL;
        if (!m.isRemainder) {
          renderCircleAvatar(m.avatar, m.name, fullInnerL + 9, cy, 9);
          nameX = fullInnerL + 24;
        }
        p(
          `<text x="${nameX}" y="${cy + 4}" font-size="10.5" fill="${m.isRemainder ? TEXT_MED : TEXT_HI}" font-weight="${m.isRemainder ? 400 : 600}"${m.isRemainder ? ' font-style="italic"' : ""}>${this._svgEsc(this._svgTrunc(m.name, 42))}</text>`,
        );
        const vals = {
          pct: m.groupPercentage ? `${m.groupPercentage}%` : "—",
          profitShare: money(m.profitShare),
          paid: money(m.paid),
          received: money(m.received),
          final: money(m.final),
        };
        cols.forEach((c) => {
          const isFinal = c.key === "final";
          const fill = isFinal
            ? m.final > 0.005
              ? RECEIVE_CLR
              : m.final < -0.005
                ? EXPENSE_CLR
                : TEXT_MED
            : TEXT_MED;
          p(
            `<text x="${c.x}" y="${cy + 4}" font-size="${isFinal ? 11.5 : 10}" fill="${fill}" font-weight="${isFinal ? 800 : 400}" text-anchor="end">${this._svgEsc(vals[c.key])}</text>`,
          );
        });
        ry += ROW_H;
      });

      const note = `Final = profit share + paid − received over all properties. Positive: ${g.name} owes the member · Negative: the member holds money for ${g.name}.`;
      p(
        `<text x="${fullInnerL}" y="${ry + 14}" font-size="8.5" fill="${TEXT_MED}" opacity="0.85">${this._svgEsc(note)}</text>`,
      );
      y += cardH + 8;
    });

    // ── Summary (full width, only when multiple settlements) ────────────
    if (settlements.length > 1) {
      const totalSGD = settlements
        .filter((s) => s.currency !== "VND")
        .reduce((sum, s) => sum + s.amount, 0);
      const sumH = 52;
      p(`<rect x="${fullCardX}" y="${y}" width="${fullCardW}" height="${sumH}" rx="8" fill="${CARD_BG}" stroke="${CARD_BORDER}" stroke-width="1"/>`);
      p(`<text x="${fullInnerL}" y="${y + 20}" font-size="10" fill="${TEXT_MED}" font-weight="600">Total Transactions:</text>`);
      p(`<text x="${fullInnerR}" y="${y + 20}" font-size="10" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${settlements.length}</text>`);
      p(`<line x1="${fullInnerL}" y1="${y + 28}" x2="${fullInnerR}" y2="${y + 28}" stroke="${DIVIDER}" stroke-width="0.5"/>`);
      p(`<text x="${fullInnerL}" y="${y + 44}" font-size="11" fill="${TEXT_HI}" font-weight="700">Total Amount (SGD):</text>`);
      p(`<text x="${fullInnerR}" y="${y + 44}" font-size="14" fill="${TEXT_HI}" font-weight="700" text-anchor="end">$${totalSGD.toFixed(2)}</text>`);
      y += sumH + 8;
    }

    // ── Footer — same bar treatment as the report and extraction exports ──
    p(`<rect x="0" y="${y}" width="${TOTAL_W}" height="24" fill="${FOOTER_BG}"/>`);
    p(`<text x="${TOTAL_W / 2}" y="${y + 16}" font-size="9.5" fill="${TEXT_MED}" text-anchor="middle">Netted across all properties &#xB7; Amounts in SGD &#xB7; Auto-generated</text>`);
    y += 24;

    // ── Compose SVG ──────────────────────────────────────────────────────
    const H = y;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TOTAL_W}" height="${H}" viewBox="0 0 ${TOTAL_W} ${H}" font-family="Noto Serif,serif">`,
      `<defs>${fontFaceStyle}${defs.join("")}</defs>`,
      `<rect x="0" y="0" width="${TOTAL_W}" height="${H}" fill="${BASE_BG}"/>`,
      `<rect x="0" y="0" width="${TOTAL_W}" height="${H}" fill="url(#setHaze)"/>`,
      ...nodes,
      `</svg>`,
    ].join("");
  }

  // ═══════════════════════════════════════════════════════════════════
  // Grand View — bulk report snapshot gallery
  //
  // Reuses the exact same export pipeline the single-property Financial
  // Report page's "Capture Screenshot" button already uses
  // (FinancialReportsComponent._generateReportSVG() + _svgToPngBlob()),
  // driven once per selected property, so every image here is
  // pixel-identical to what Capture Screenshot would produce for that
  // property. None of that ~900-line SVG-drawing code is duplicated or
  // modified — it's called as-is on the app's single shared
  // FinancialReportsComponent instance.
  //
  // Strictly read-only: every request here is a GET (the report data
  // itself was already fetched by fetchBulkReports() above; this only
  // adds a per-property GET for the raw investor list the SVG needs,
  // plus the logo/font/avatar GETs the export always makes). Nothing
  // here ever POSTs/PUTs/DELETEs, so no report/settlement figure is
  // written, changed, or recalculated. The shared component's live
  // selection state is snapshotted before the batch and restored
  // afterwards (in a finally block), so visiting the Financial Reports
  // section later is completely unaffected.
  // ═══════════════════════════════════════════════════════════════════

  async openGrandReportView() {
    try {
      const withReport = (this.lastReports || []).filter((r) => r.report);

      console.log(
        `[GrandView] ${(this.lastReports || []).length} propert${(this.lastReports || []).length === 1 ? "y" : "ies"} fetched, ` +
          `${withReport.length} with a report to render`
      );

      if (withReport.length === 0) {
        this.notifyGrandView(
          (this.lastReports || []).length === 0
            ? "Please fetch reports first, then open Grand View to see them all together."
            : "None of the fetched properties have a report for this month yet.",
          "warning"
        );
        return;
      }

      this.renderGrandReportModal(withReport.length);
      await this.generateGrandReportImages(withReport);
    } catch (error) {
      console.error("[GrandView] Failed to open report gallery:", error);
      this.notifyGrandView(
        "Could not open Grand View — see browser console for details.",
        "error"
      );
    }
  }

  // Toast is fixed-position (top-right) so it's visible no matter how far
  // the page is scrolled — falls back to the in-page alert banner used
  // elsewhere in this component if the global toast helper isn't loaded.
  notifyGrandView(message, type = "info") {
    if (typeof showToast === "function") {
      showToast(message, type, 5000);
    } else {
      this.showError(message);
    }
  }

  // Reuse the app's single FinancialReportsComponent instance — the same
  // one "Capture Screenshot" runs on — instead of constructing a second
  // copy, which would double up its DOM event listeners (add-income
  // button, month nav, etc. would each fire twice). Mirrors exactly how
  // dashboard-controller.js lazily creates it on first visit to that
  // section, so this never creates more than one instance app-wide.
  async getFinancialReportsInstance() {
    if (window.financialReports) return window.financialReports;

    const dc = window.dashboardController;
    if (dc) {
      dc.components = dc.components || {};
      if (!dc.components.financialReports) {
        dc.components.financialReports = new FinancialReportsComponent();
      }
      window.financialReports = dc.components.financialReports;
    } else {
      // Defensive fallback — shouldn't happen inside the dashboard shell.
      window.financialReports = new FinancialReportsComponent();
    }

    // Its property list (needed for the report title/address) loads
    // asynchronously on construction — wait for it so the first image
    // generated isn't missing the property title.
    if (window.financialReports._propertiesPromise) {
      await window.financialReports._propertiesPromise;
    }
    return window.financialReports;
  }

  renderGrandReportModal(total) {
    const stale = document.getElementById("grandReportModal");
    if (stale) stale.remove();

    const modalHtml = `
      <div class="modal fade" id="grandReportModal" tabindex="-1" aria-labelledby="grandReportModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-fullscreen">
          <div class="modal-content" style="background:#f1f3f5;">
            <div class="modal-header bg-dark text-white">
              <h5 class="modal-title d-flex align-items-center gap-2" id="grandReportModalLabel">
                <i class="bi bi-collection"></i>Grand View — All Property Reports
                <span class="badge bg-light text-dark" id="grandReportProgressBadge">0 / ${total}</span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0 d-flex flex-column" style="min-height:0;">
              <div class="border-bottom bg-white px-3 py-2" style="flex-shrink:0;" id="grandReportProgressBar">
                <div class="progress" style="height:6px;">
                  <div class="progress-bar bg-success" id="grandReportProgressFill" style="width:0%;"></div>
                </div>
                <small class="text-muted" id="grandReportProgressLabel">Generating report snapshots…</small>
              </div>
              <div class="flex-grow-1" style="overflow-y:auto;">
                <div class="p-3" id="grandReportGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(260px, 1fr));gap:1rem;"></div>
              </div>
            </div>
          </div>

          <!-- Lightbox overlay -->
          <div id="grandReportLightbox" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:2000;align-items:center;justify-content:center;flex-direction:column;">
            <button type="button" class="btn btn-light btn-sm" id="grandReportLightboxClose" style="position:absolute;top:16px;right:16px;z-index:2002;"><i class="bi bi-x-lg"></i></button>
            <button type="button" class="btn btn-light" id="grandReportLightboxPrev" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);z-index:2002;"><i class="bi bi-chevron-left"></i></button>
            <button type="button" class="btn btn-light" id="grandReportLightboxNext" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);z-index:2002;"><i class="bi bi-chevron-right"></i></button>
            <img id="grandReportLightboxImg" src="" style="max-width:90vw;max-height:80vh;object-fit:contain;box-shadow:0 8px 40px rgba(0,0,0,0.6);border-radius:4px;background:#fff;">
            <div class="text-white text-center mt-3 d-flex align-items-center gap-3" id="grandReportLightboxCaption"></div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    const modalElement = document.getElementById("grandReportModal");
    const modal = new bootstrap.Modal(modalElement, {
      backdrop: true,
      keyboard: true,
    });

    this._grandReportObjectUrls = [];
    this._grandReportItems = [];
    this._grandReportCancelled = false;

    modalElement.addEventListener("hidden.bs.modal", () => {
      if (this._grandReportKeyHandler) {
        document.removeEventListener("keydown", this._grandReportKeyHandler);
        this._grandReportKeyHandler = null;
      }
      // Signal any in-flight generation loop to stop early, and free the
      // PNG object URLs it already produced.
      this._grandReportCancelled = true;
      (this._grandReportObjectUrls || []).forEach((u) => URL.revokeObjectURL(u));
      this._grandReportObjectUrls = [];
      this._grandReportItems = [];
      modalElement.remove();
    });

    this.bindGrandReportModalEvents(modalElement);

    modal.show();
  }

  bindGrandReportModalEvents(modalElement) {
    const grid = modalElement.querySelector("#grandReportGrid");
    if (grid) {
      grid.addEventListener("click", (e) => {
        const tile = e.target.closest("[data-role='report-tile']");
        if (!tile || tile.dataset.status !== "done") return;
        this.openGrandReportLightbox(tile.dataset.id);
      });
    }

    const lightbox = modalElement.querySelector("#grandReportLightbox");
    modalElement
      .querySelector("#grandReportLightboxClose")
      ?.addEventListener("click", () => this.closeGrandReportLightbox());
    modalElement
      .querySelector("#grandReportLightboxPrev")
      ?.addEventListener("click", () => this.stepGrandReportLightbox(-1));
    modalElement
      .querySelector("#grandReportLightboxNext")
      ?.addEventListener("click", () => this.stepGrandReportLightbox(1));
    lightbox?.addEventListener("click", (e) => {
      if (e.target === lightbox) this.closeGrandReportLightbox();
    });

    this._grandReportKeyHandler = (e) => {
      if (!lightbox || lightbox.style.display === "none") return;
      if (e.key === "Escape") this.closeGrandReportLightbox();
      if (e.key === "ArrowLeft") this.stepGrandReportLightbox(-1);
      if (e.key === "ArrowRight") this.stepGrandReportLightbox(1);
    };
    document.addEventListener("keydown", this._grandReportKeyHandler);
  }

  // Renders one placeholder tile per property up front (so the grid layout
  // doesn't jump around as results stream in), then fills each tile in as
  // its image finishes. Strictly sequential: every iteration reuses the
  // same shared FinancialReportsComponent instance, so two properties can
  // never be generated concurrently without their data crossing over.
  async generateGrandReportImages(withReport) {
    const grid = document.getElementById("grandReportGrid");
    if (!grid) return;

    withReport.forEach((r) => {
      grid.insertAdjacentHTML("beforeend", this.renderGrandReportTile(r));
    });

    let fr;
    try {
      fr = await this.getFinancialReportsInstance();
    } catch (error) {
      console.error("[GrandView] Could not prepare report generator:", error);
      this.notifyGrandView(
        "Could not prepare the report generator — see console.",
        "error"
      );
      return;
    }

    // Snapshot the singleton's live selection so the Financial Reports
    // section is completely unaffected once we're done (restored in the
    // finally block below no matter how the loop ends).
    const snapshot = {
      selectedProperty: fr.selectedProperty,
      currentReport: fr.currentReport,
      investors: fr.investors,
      currentDate: fr.currentDate,
    };

    const monthSel = document.getElementById("bulkReportMonth")?.value;
    const yearSel = document.getElementById("bulkReportYear")?.value;

    let completed = 0;
    try {
      for (const r of withReport) {
        if (this._grandReportCancelled) break; // modal was closed mid-batch

        try {
          const investors = await this.fetchRawInvestorsForSVG(
            r.propertyId,
            r.report
          );
          if (this._grandReportCancelled) break;

          fr.selectedProperty = r.propertyId;
          fr.currentReport = r.report;
          fr.investors = investors;
          if (monthSel && yearSel) {
            fr.currentDate = new Date(
              parseInt(yearSel),
              parseInt(monthSel) - 1,
              1
            );
          }

          const svgStr = await fr._generateReportSVG();
          const blob = await fr._svgToPngBlob(svgStr);
          if (this._grandReportCancelled) break;

          const objectUrl = URL.createObjectURL(blob);
          this._grandReportObjectUrls.push(objectUrl);

          const item = {
            id: `report-${r.propertyId}`,
            propertyId: r.propertyId,
            propertyAddress: r.propertyData?.address || r.propertyId,
            propertyUnit: r.propertyData?.unit || "",
            objectUrl,
            fileName: `Financial_Report_${r.propertyId}_${monthSel || ""}_${yearSel || ""}.png`.replace(
              /[^a-zA-Z0-9_.-]/g,
              "_"
            ),
          };
          this._grandReportItems.push(item);
          this.updateGrandReportTile(r.propertyId, "done", item);
        } catch (error) {
          console.error(
            `[GrandView] Failed to generate report image for ${r.propertyId}:`,
            error
          );
          this.updateGrandReportTile(r.propertyId, "error");
        }

        completed++;
        this.updateGrandReportProgress(completed, withReport.length);
      }
    } finally {
      fr.selectedProperty = snapshot.selectedProperty;
      fr.currentReport = snapshot.currentReport;
      fr.investors = snapshot.investors;
      fr.currentDate = snapshot.currentDate;
    }

    if (!this._grandReportCancelled) {
      const progressBar = document.getElementById("grandReportProgressBar");
      if (progressBar) progressBar.style.display = "none";
    }
  }

  // Closed reports carry a baked-in investorSnapshot and don't need the
  // raw per-property investor list at all — see _getInvestorDataForSVG()
  // in financial-reports.js, which short-circuits on isClosed+snapshot.
  // Skipping the fetch in that case avoids an unnecessary round trip.
  async fetchRawInvestorsForSVG(propertyId, report) {
    if (report?.isClosed && report?.investorSnapshot?.length > 0) return [];

    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.INVESTORS_BY_PROPERTY(propertyId)
      );
      if (!response.ok) return [];
      const result = await response.json();
      return result.success && Array.isArray(result.data) ? result.data : [];
    } catch (error) {
      console.error(
        `[GrandView] Failed to load investors for ${propertyId}:`,
        error
      );
      return [];
    }
  }

  renderGrandReportTile(r) {
    const address = r.propertyData?.address || r.propertyId;
    const unit = r.propertyData?.unit || "";
    return `
      <div class="card h-100" data-role="report-tile" data-id="report-${escapeHtml(r.propertyId)}" data-status="pending" style="overflow:hidden;">
        <div class="d-flex align-items-center justify-content-center bg-light" style="height:180px;" data-role="tile-media">
          <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
        </div>
        <div class="card-body py-2 px-2">
          <div class="text-truncate small fw-semibold" title="${escapeHtml(address)}">${escapeHtml(address)}</div>
          ${unit ? `<div class="text-muted" style="font-size:11px;">${escapeHtml(unit)}</div>` : ""}
        </div>
      </div>
    `;
  }

  updateGrandReportTile(propertyId, status, item) {
    const tile = document.querySelector(
      `[data-role="report-tile"][data-id="report-${CSS.escape(String(propertyId))}"]`
    );
    if (!tile) return;
    tile.dataset.status = status;
    tile.style.cursor = status === "done" ? "pointer" : "default";

    const media = tile.querySelector('[data-role="tile-media"]');
    if (!media) return;

    if (status === "done" && item) {
      media.innerHTML = `<img src="${item.objectUrl}" style="width:100%;height:100%;object-fit:cover;object-position:top;" alt="${escapeHtml(item.propertyAddress)}">`;
    } else if (status === "error") {
      media.innerHTML = `<div class="text-danger text-center small p-2"><i class="bi bi-exclamation-triangle d-block mb-1" style="font-size:1.3rem;"></i>Failed to generate</div>`;
    }
  }

  updateGrandReportProgress(completed, total) {
    const badge = document.getElementById("grandReportProgressBadge");
    if (badge) badge.textContent = `${completed} / ${total}`;
    const fill = document.getElementById("grandReportProgressFill");
    if (fill) fill.style.width = `${Math.round((completed / total) * 100)}%`;
    const label = document.getElementById("grandReportProgressLabel");
    if (label) {
      label.textContent =
        completed >= total
          ? `Done — ${total} report${total === 1 ? "" : "s"} generated`
          : `Generating report snapshots… (${completed} / ${total})`;
    }
  }

  openGrandReportLightbox(id) {
    const index = (this._grandReportItems || []).findIndex(
      (it) => it.id === id
    );
    if (index === -1) return;
    this._grandReportLightboxIndex = index;
    this.renderGrandReportLightbox();
    const lightbox = document.getElementById("grandReportLightbox");
    if (lightbox) lightbox.style.display = "flex";
  }

  stepGrandReportLightbox(delta) {
    const list = this._grandReportItems;
    if (!list || list.length === 0) return;
    this._grandReportLightboxIndex =
      (this._grandReportLightboxIndex + delta + list.length) % list.length;
    this.renderGrandReportLightbox();
  }

  renderGrandReportLightbox() {
    const it = this._grandReportItems?.[this._grandReportLightboxIndex];
    if (!it) return;

    const img = document.getElementById("grandReportLightboxImg");
    const caption = document.getElementById("grandReportLightboxCaption");
    if (img) img.src = it.objectUrl;
    if (caption) {
      caption.innerHTML = `
        <div>
          <div class="fw-bold">${escapeHtml(it.propertyAddress)}${it.propertyUnit ? ` · ${escapeHtml(it.propertyUnit)}` : ""}</div>
          <div class="small text-white-50">${this._grandReportLightboxIndex + 1} / ${this._grandReportItems.length}</div>
        </div>
        <a href="${it.objectUrl}" download="${escapeHtml(it.fileName)}" class="btn btn-sm btn-light"><i class="bi bi-download me-1"></i>Download PNG</a>
      `;
    }
  }

  closeGrandReportLightbox() {
    const lightbox = document.getElementById("grandReportLightbox");
    if (lightbox) lightbox.style.display = "none";
  }

  showError(message) {
    // Create or update error alert
    let alert = document.getElementById("bulkReportsError");
    if (!alert) {
      alert = document.createElement("div");
      alert.id = "bulkReportsError";
      alert.className = "alert alert-danger alert-dismissible fade show";
      alert.innerHTML = `
        <i class="bi bi-exclamation-triangle me-2"></i>
        <span id="bulkReportsErrorMessage"></span>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `;

      const section = document.getElementById("bulk-reports-section");
      if (section) {
        const firstCard = section.querySelector(".card");
        if (firstCard) {
          firstCard.parentNode.insertBefore(alert, firstCard);
        }
      }
    }

    const messageSpan = document.getElementById("bulkReportsErrorMessage");
    if (messageSpan) {
      messageSpan.textContent = message;
    }

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      if (alert && alert.parentNode) {
        alert.remove();
      }
    }, 5000);
  }
}

// Make component globally accessible
window.BulkPropertyReportsComponent = BulkPropertyReportsComponent;
