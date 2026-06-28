// Note: showToast and escapeHtml are expected to be available globally
import { getRoomTypeDisplayName } from "../utils/room-type-mapper.js";
import i18next from "../i18n.js";

/**
 * Financial Reports Component
 * Handles monthly financial report management with income, expenses, and investor calculations
 */
class FinancialReportsComponent {
  constructor() {
    this.selectedProperty = null;
    this.currentDate = new Date();
    this.currentReport = null;
    this.investors = [];
    this.allInvestors = []; // All investors in the app (for Paid To dropdown)
    this.tenants = []; // Store tenants for selected property
    this.isModalOpen = false;
    this.isIncomeExpenseModalOpen = false;
    this.editingItem = null;
    this.editingItemIndex = null;
    this.pendingDeletes = new Set(); // Track items pending deletion confirmation
    this.pendingClose = false; // Track month close confirmation
    this.selectedItems = new Set(); // Track bulk-selected items (e.g. "income-0", "expense-2")
    this.isEditMode = false; // Whether drag-to-reorder is active
    this._dragSelecting = false; // Whether a drag selection is in progress
    this._dragSelectMode = true; // true = selecting, false = deselecting during drag
    this.propertyReportStatus = {}; // Track {propertyId: {isClosed: boolean}} for current month
    this.allUnpaidVisible = false; // Track all-unpaid overview visibility
    this.propertySubsidy = 0;
    this._utilityBills = [];
    this.init();
  }

  // Fetch the exchange rate effective at the current report's month
  async fetchExchangeRateForPeriod() {
    try {
      const date = this.currentDate || new Date();
      const dateStr = date.toISOString().split("T")[0];
      const res = await API.get(API_CONFIG.ENDPOINTS.EXCHANGE_RATE_AT(dateStr));
      const data = await res.json();
      if (data.success && data.rate) return data.rate.rate;
    } catch (e) {
      // ignore
    }
    return null;
  }

  // Map room type enums to human-readable names (using shared utility)
  getRoomTypeDisplayName(roomType) {
    return getRoomTypeDisplayName(roomType);
  }

  init() {
    this.bindEvents();
    this._propertiesPromise = this.loadProperties();
    if (window.isAdmin && window.isAdmin()) this.loadAllInvestors();

    // Initial cleanup to ensure no leftover modals from previous sessions
    this.forceCleanupModalBackdrops();
  }

  async loadAllInvestors() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();
      if (result.success) {
        this.allInvestors = result.data || [];
      }
    } catch (error) {
      console.error("Error loading all investors:", error);
      this.allInvestors = [];
    }
  }

  bindEvents() {
    // Property cards will use onclick handlers defined in renderPropertyCards

    // Month navigation
    const prevMonthBtn = document.getElementById("prevMonth");
    const nextMonthBtn = document.getElementById("nextMonth");

    console.log("Financial Reports - Binding month navigation buttons:");
    console.log("  prevMonthBtn found:", !!prevMonthBtn);
    console.log("  nextMonthBtn found:", !!nextMonthBtn);

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => {
        console.log("Previous month button clicked");
        this.changeMonth(-1);
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
        console.log("Next month button clicked");
        this.changeMonth(1);
      });
    }

    // Add income/expense buttons
    const addIncomeBtn = document.getElementById("addIncomeBtn");
    const addExpenseBtn = document.getElementById("addExpenseBtn");
    const addInvestorBtn = document.getElementById("addInvestorBtn");

    if (addIncomeBtn) {
      addIncomeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent multiple modal creations
        if (this.isIncomeExpenseModalOpen) {
          return;
        }

        this.showIncomeExpenseModal("income").catch(console.error);
      });
    }

    if (addExpenseBtn) {
      addExpenseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent multiple modal creations
        if (this.isIncomeExpenseModalOpen) {
          return;
        }

        this.showIncomeExpenseModal("expense").catch(console.error);
      });
    }

    const fillUtilityBillBtn = document.getElementById("fillUtilityBillBtn");
    if (fillUtilityBillBtn) {
      fillUtilityBillBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.isIncomeExpenseModalOpen) {
          this.fillUtilityBillExpense().catch(console.error);
        }
      });
    }

    if (addInvestorBtn) {
      addInvestorBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent multiple modal creations
        if (this.isModalOpen) {
          return;
        }

        try {
          await this.showInvestorModal();
        } catch (error) {
          console.error("Error showing investor modal:", error);
          this.isModalOpen = false;
        }
      });
    }

    // Export functionality
    const exportBtn = document.getElementById("exportFinancialReportBtn");
    const printBtn = document.getElementById("printFinancialReportBtn");

    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!exportBtn.disabled) {
          this.exportFinancialReportAsPDF();
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!printBtn.disabled) {
          this.printFinancialReport();
        }
      });
    }

    // Screenshot functionality
    const screenshotBtn = document.getElementById("captureScreenshotBtn");
    if (screenshotBtn) {
      screenshotBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!screenshotBtn.disabled) {
          this.captureScreenshot();
        }
      });
    }

    // Copy report summary functionality
    const copyReportSummaryBtn = document.getElementById(
      "copyReportSummaryBtn",
    );
    if (copyReportSummaryBtn) {
      copyReportSummaryBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!copyReportSummaryBtn.disabled) {
          this.copyReportSummary();
        }
      });
    }

    // Close/Reopen functionality
    const closeBtn = document.getElementById("closeMonthBtn");
    const reopenBtn = document.getElementById("reopenMonthBtn");

    if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!closeBtn.disabled) {
          this.toggleCloseConfirm();
        }
      });
    }

    if (reopenBtn) {
      reopenBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!reopenBtn.disabled) {
          this.reopenMonth();
        }
      });
    }

    // Settlement buttons
    const markSettledBtn = document.getElementById("markSettledBtn");
    const unmarkSettledBtn = document.getElementById("unmarkSettledBtn");
    if (markSettledBtn) {
      markSettledBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!markSettledBtn.disabled) this.markSettled();
      });
    }
    if (unmarkSettledBtn) {
      unmarkSettledBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!unmarkSettledBtn.disabled) this.unmarkSettled();
      });
    }

    // Carry Forward button
    const carryForwardBtn = document.getElementById("carryForwardBtn");
    if (carryForwardBtn) {
      carryForwardBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!carryForwardBtn.disabled) {
          this.carryForwardToNextMonth();
        }
      });
    }

    // All Unpaid Overview button
    const viewAllUnpaidBtn = document.getElementById("viewAllUnpaidBtn");
    if (viewAllUnpaidBtn) {
      viewAllUnpaidBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggleAllUnpaidReminderSection();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById("refreshFinancialReport");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (this.selectedProperty) {
          // Show loading state
          refreshBtn.disabled = true;
          const icon = refreshBtn.querySelector("i");
          if (icon) {
            icon.classList.add("spin-animation");
          }

          try {
            await this.loadFinancialReport();
          } finally {
            refreshBtn.disabled = false;
            if (icon) {
              icon.classList.remove("spin-animation");
            }
          }
        }
      });
    }

    // Hotkeys: Cmd/Ctrl+K → export image, Cmd/Ctrl+C (no selection) → copy report summary
    document.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;

      if (e.key === "k") {
        const btn = document.getElementById("captureScreenshotBtn");
        if (btn && !btn.disabled) {
          e.preventDefault();
          this.captureScreenshot();
        }
      } else if (e.key === "c" && !window.getSelection()?.toString()) {
        const btn = document.getElementById("copyReportSummaryBtn");
        if (btn && !btn.disabled) {
          e.preventDefault();
          this.copyReportSummary();
        }
      }
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
          // Handle API errors (like authentication required)
          if (response.status === 401 || response.status === 403) {
            this.showError("Please log in to load properties");
            this.renderPropertyCards([]);
            return;
          }
          hasMorePages = false;
        }
      }

      this.renderPropertyCards(allProperties);
      // Load report statuses for all properties (async, will re-render when done)
      this.loadPropertyReportStatuses();
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showError(
        "Failed to load properties. Please check your connection and try again.",
      );
      this.renderPropertyCards([]); // Show empty cards with default message
    }
  }

  async loadPropertyReportStatuses() {
    if (!this.properties || this.properties.length === 0) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;
    const cacheKey = `${year}-${month}`;

    // Skip if already loaded for this month or a fetch is already running
    if (
      this._statusCacheKey === cacheKey &&
      Object.keys(this.propertyReportStatus).length > 0
    )
      return;
    if (this._loadingStatuses) return;

    this._loadingStatuses = true;
    this.propertyReportStatus = {};

    try {
      await Promise.all(
        this.properties.map(async (property) => {
          try {
            const response = await API.get(
              API_CONFIG.ENDPOINTS.FINANCIAL_REPORT(
                property.propertyId,
                year,
                month,
              ),
            );
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                this.propertyReportStatus[property.propertyId] = {
                  isClosed: result.data.isClosed || false,
                  isSettled: result.data.isSettled || false,
                };
              }
            }
          } catch (error) {
            console.debug(
              `Could not fetch report status for ${property.propertyId}:`,
              error,
            );
          }
        }),
      );
    } finally {
      this._loadingStatuses = false;
      this._statusCacheKey = cacheKey;
    }

    this.renderPropertyCards(this.properties);
  }

  renderPropertyCards(properties) {
    const container = document.getElementById("propertyCards");
    if (!container) return;

    // Store properties for later use
    this.properties = properties || [];

    // Re-sync URL now that we have full property data (unit + address for slug).
    // This corrects the URL if selectProperty() ran before properties were loaded
    // and fell back to the raw propertyId.
    if (this.selectedProperty && window.appRouter) {
      const _selected = this.properties.find(
        (p) => p.propertyId === this.selectedProperty,
      );
      if (_selected) {
        const _y = this.currentDate.getFullYear();
        const _m = this.currentDate.getMonth() + 1;
        window.appRouter.replace(
          `/financial/${window.SlugUtils.propertySlug(_selected)}/${_y}/${_m}`,
        );
      }
    }

    // Use CSS Grid for compact layout
    container.style.display = "grid";
    container.style.gridTemplateColumns =
      "repeat(auto-fill, minmax(120px, 1fr))";
    container.style.gap = "0.5rem";

    // Persist filter across re-renders
    if (!this.propertyFilter) this.propertyFilter = "all";

    // Clear existing cards
    container.innerHTML = "";

    if (!properties || properties.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center;" class="text-muted py-4">
          <i class="bi bi-building-slash me-2"></i>
          No properties available - please log in or add properties
        </div>
      `;
      return;
    }

    // Filter bar
    const filterDef = [
      { key: "all",         label: "All",                                                          color: "#6c757d" },
      { key: "settled",     label: '<i class="bi bi-cash-coin me-1"></i>Settled',                  color: "#0d9488" },
      { key: "not-settled", label: '<i class="bi bi-cash-coin me-1"></i>Not Settled',              color: "#0d9488" },
      { key: "locked",      label: '<i class="bi bi-lock-fill me-1"></i>Locked',                   color: "#198754" },
      { key: "not-locked",  label: '<i class="bi bi-unlock-fill me-1"></i>Not Locked',             color: "#198754" },
    ];
    const filterBar = document.createElement("div");
    filterBar.style.cssText = "grid-column: 1 / -1; display: flex; gap: 6px; flex-wrap: wrap;";
    filterBar.innerHTML = filterDef.map(({ key, label, color }) => {
      const active = this.propertyFilter === key;
      const baseStyle = `font-size: 11px; padding: 2px 10px; border-radius: 20px; border: 1.5px solid; cursor: pointer; transition: all 0.15s;`;
      const activeStyle  = `background:${color}; border-color:${color}; color:#fff;`;
      const inactiveStyle = `background:transparent; border-color:${color}; color:${color};`;
      return `<button style="${baseStyle}${active ? activeStyle : inactiveStyle}" onclick="window.financialReports.setPropertyFilter('${key}')">${label}</button>`;
    }).join("");
    container.appendChild(filterBar);

    // Generate compact property cards
    const allSorted = [...properties].sort(
      (a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0),
    );
    const sortedProperties = allSorted.filter((p) => {
      const status = this.propertyReportStatus[p.propertyId];
      if (this.propertyFilter === "settled")     return status && status.isSettled;
      if (this.propertyFilter === "not-settled") return !status || !status.isSettled;
      if (this.propertyFilter === "locked")      return status && status.isClosed;
      if (this.propertyFilter === "not-locked")  return !status || !status.isClosed;
      return true;
    });
    if (sortedProperties.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "grid-column: 1 / -1; text-align: center;";
      empty.className = "text-muted py-3";
      empty.innerHTML = `<i class="bi bi-funnel me-1"></i>No properties match this filter`;
      container.appendChild(empty);
      return;
    }
    sortedProperties.forEach((property) => {
      const isSelected =
        String(this.selectedProperty) === String(property.propertyId);
      const reportStatus = this.propertyReportStatus[property.propertyId];
      const isReportClosed = reportStatus && reportStatus.isClosed;
      const isReportSettled = reportStatus && reportStatus.isSettled;
      const cardStatusColor = isReportSettled
        ? "#0d9488"
        : isReportClosed
          ? "#198754"
          : null;
      const cardHtml = `
        <div class="card property-card-compact ${isSelected ? "selected-card" : ""} ${isReportSettled ? "property-card-settled" : isReportClosed ? "property-card-closed" : ""} overflow-hidden"
             style="cursor: pointer; transition: all 0.2s ease;"
             data-property-id="${property.propertyId}"
             onclick="window.financialReports.selectProperty('${property.propertyId}')">
          ${
            property.propertyImage
              ? `<div data-role="property-image" style="height: 55px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; position: relative;">
                 ${isReportClosed ? '<div class="position-absolute top-0 start-0 p-1"><span class="badge bg-success" style="font-size: 8px;"><i class="bi bi-lock-fill"></i></span></div>' : ""}
                 ${isReportSettled ? `<div style="position: absolute; inset: 0; background: rgba(13,148,136,0.42); display: ${isSelected ? "none" : "flex"}; align-items: center; justify-content: center;"><i class="bi bi-cash-coin text-white" style="font-size: 1.3rem; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));"></i></div>` : ""}
                 <div data-role="selected-overlay" style="position: absolute; inset: 0; background: rgba(13,110,253,0.5); display: ${isSelected ? "flex" : "none"}; align-items: center; justify-content: center;"><i class="bi bi-check-circle-fill text-white" style="font-size: 1.4rem;"></i></div>
               </div>`
              : ""
          }
          <div data-role="card-body" class="d-flex flex-column align-items-center p-2" style="gap: 3px; background: ${isSelected ? "rgba(13,110,253,0.07)" : isReportSettled ? "rgba(13,148,136,0.07)" : "#fff"};">
            <div class="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                 style="width: 28px; height: 28px; font-size: 11px; flex-shrink: 0; background-color: ${cardStatusColor || "#0d6efd"};">
              ${isReportSettled ? '<i class="bi bi-cash-coin" style="font-size: 10px;"></i>' : isReportClosed ? '<i class="bi bi-lock-fill" style="font-size: 10px;"></i>' : escapeHtml(property.propertyId.substring(0, 3))}
            </div>
            <div class="text-center" style="line-height: 1.2; width: 100%;">
              <div class="fw-semibold text-truncate" style="font-size: 10px;" title="${escapeHtml(property.address)}">${escapeHtml(property.address)}</div>
              <div class="text-muted text-truncate" style="font-size: 10px;">${escapeHtml(property.unit)}</div>
            </div>
            ${!property.propertyImage ? `<i data-role="no-image-check" class="bi bi-check-circle-fill text-primary" style="font-size: 0.9rem; display: ${isSelected ? "inline" : "none"};"></i>` : ""}
            ${!property.propertyImage && isReportSettled && !isSelected ? `<span class="badge" style="font-size: 8px;background:#0d9488;"><i class="bi bi-cash-coin me-1"></i>Settled</span>` : ""}
            ${!property.propertyImage && isReportClosed && !isReportSettled && !isSelected ? '<span class="badge bg-success" style="font-size: 8px;"><i class="bi bi-lock-fill me-1"></i>Done</span>' : ""}
          </div>
        </div>
      `;
      container.innerHTML += cardHtml;
    });

    // Add hover effects with CSS
    this.addPropertyCardStyles();

    // Re-apply selection state after re-render
    this.updatePropertyCardSelection();
  }

  addPropertyCardStyles() {
    if (!document.getElementById("property-card-styles")) {
      const style = document.createElement("style");
      style.id = "property-card-styles";
      style.textContent = `
        .property-card-compact {
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }
        .property-card-compact:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.15) !important;
        }
        .property-card-compact.selected-card {
          border: 3px solid #0d6efd !important;
          box-shadow: 0 0 0 3px rgba(13,110,253,0.2), 0 4px 12px rgba(13,110,253,0.25) !important;
        }
        .property-card-compact.property-card-closed {
          border: 2px solid #198754 !important;
        }
        .property-card-compact.property-card-closed.selected-card {
          border: 3px solid #0d6efd !important;
          box-shadow: 0 0 0 3px rgba(13,110,253,0.2), 0 4px 12px rgba(13,110,253,0.25) !important;
        }
        .property-card-compact.property-card-settled {
          border: 2px solid #0d9488 !important;
          box-shadow: 0 0 0 2px rgba(13,148,136,0.18), 0 2px 8px rgba(13,148,136,0.15) !important;
          background: rgba(13,148,136,0.04);
        }
        .property-card-compact.property-card-settled.selected-card {
          border: 3px solid #0d6efd !important;
          box-shadow: 0 0 0 3px rgba(13,110,253,0.2), 0 4px 12px rgba(13,110,253,0.25) !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  setPropertyFilter(filter) {
    this.propertyFilter = filter;
    this.renderPropertyCards(this.properties);
  }

  initializeTooltips() {
    // Dispose of existing tooltips first to prevent memory leaks
    const existingTooltips = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]',
    );
    existingTooltips.forEach((el) => {
      const existingTooltip = bootstrap.Tooltip.getInstance(el);
      if (existingTooltip) {
        existingTooltip.dispose();
      }
    });

    // Patch hotkey labels to match the user's OS (⌘ on Mac, Ctrl on others)
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
      navigator.userAgentData?.platform === 'macOS';
    const mod = isMac ? '⌘' : 'Ctrl+';
    document.getElementById('captureScreenshotBtn')
      ?.setAttribute('data-bs-title', `Export report as image (${mod}K)`);
    document.getElementById('copyReportSummaryBtn')
      ?.setAttribute('data-bs-title', `Copy report summary to clipboard (${mod}C)`);

    // Initialize new tooltips with custom placement
    const tooltipTriggerList = document.querySelectorAll(
      '[data-bs-toggle="tooltip"]',
    );
    [...tooltipTriggerList].map(
      (tooltipTriggerEl) =>
        new bootstrap.Tooltip(tooltipTriggerEl, {
          placement: "top",
          offset: [15, 0], // Offset to the right
        }),
    );

    // Add custom tooltip styles if not already added
    if (!document.getElementById("custom-tooltip-styles")) {
      const style = document.createElement("style");
      style.id = "custom-tooltip-styles";
      style.textContent = `
        .tooltip .tooltip-inner {
          background-color: #5a67d8;
          color: white;
          font-size: 0.875rem;
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
        }
        .tooltip .tooltip-arrow::before {
          border-top-color: #5a67d8 !important;
          border-bottom-color: #5a67d8 !important;
          border-left-color: #5a67d8 !important;
          border-right-color: #5a67d8 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  updatePropertyCardSelection() {
    const allCards = document.querySelectorAll(".property-card-compact");
    allCards.forEach((card) => {
      const isSelected =
        String(card.dataset.propertyId) === String(this.selectedProperty);
      card.classList.toggle("selected-card", isSelected);

      // Update image overlay
      const overlay = card.querySelector('[data-role="selected-overlay"]');
      if (overlay) {
        overlay.style.display = isSelected ? "flex" : "none";
      }

      // Update body background
      const body = card.querySelector('[data-role="card-body"]');
      if (body) {
        body.style.background = isSelected ? "rgba(13,110,253,0.07)" : "#fff";
      }

      // Update check icon for cards without images
      const noImageCheck = card.querySelector('[data-role="no-image-check"]');
      if (noImageCheck) {
        noImageCheck.style.display = isSelected ? "inline" : "none";
      }
    });
  }

  async selectProperty(propertyId) {
    // Cleanup any open modals when switching properties
    this.forceCleanupModalBackdrops();
    this.isModalOpen = false;
    this.isIncomeExpenseModalOpen = false;
    this.editingItem = null;
    this.editingItemIndex = null;
    this.pendingDeletes.clear(); // Clear any pending deletion confirmations
    this.selectedItems.clear(); // Clear any bulk selections

    if (!propertyId) {
      this.selectedProperty = null;
      document.getElementById("financialReportContent").style.display = "none";
      this.updatePropertyGroupLinks(null);
      window.appRouter?.replace("/financial");
      return;
    }

    this.selectedProperty = propertyId;
    this.currentReport = null; // clear stale report so month display is immediately correct
    this.propertySubsidy = 0;
    this._utilityBills = [];
    document.getElementById("financialReportContent").style.display = "block";

    // Update property card selection state
    this.updatePropertyCardSelection();

    // Show the correct month/year immediately — no network call needed
    this.updateMonthDisplay();

    // Load investors, tenants, property details, and utility bills in parallel
    await Promise.all([
      this.loadInvestors(propertyId),
      this.loadTenants(propertyId),
      this._loadPropertySubsidyAndBills(propertyId),
    ]);

    // Load financial report (needs investors/tenants for display; also calls updateMonthDisplay internally)
    await this.loadFinancialReport();

    // Sync URL so this state is bookmarkable.
    // Use human-readable property slug (unit + address). Fall back to the
    // router-resolved property object if this.properties isn't loaded yet.
    const _y = this.currentDate.getFullYear();
    const _m = this.currentDate.getMonth() + 1;
    const _propData =
      this.properties.find((p) => p.propertyId === this.selectedProperty) ||
      this._slugResolvedProperty;
    const _slug = _propData
      ? window.SlugUtils.propertySlug(_propData)
      : this.selectedProperty;
    window.appRouter?.replace(`/financial/${_slug}/${_y}/${_m}`);
  }

  async loadInvestors(propertyId) {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.INVESTORS_BY_PROPERTY(propertyId),
      );
      const result = await response.json();

      if (result.success) {
        this.investors = result.data;
        this.updateInvestorDisplay();
      }
    } catch (error) {
      console.error("Error loading investors:", error);
      this.investors = [];
      this.updateInvestorDisplay();
    }
  }

  async loadTenants(propertyId) {
    try {
      console.log("🏠 Loading tenants for property:", propertyId);

      // Use the corrected property-specific endpoint
      const response = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(propertyId),
      );
      const result = await response.json();

      if (result.success) {
        this.tenants = result.tenants || [];
        console.log(
          "✅ Loaded tenants for property:",
          this.tenants.length,
          this.tenants,
        );
      } else {
        this.tenants = [];
        console.log("⚠️ No tenants found or API returned false success");
      }
    } catch (error) {
      console.error("❌ Error loading tenants:", error);
      this.tenants = [];
    }
  }

  async loadFinancialReport() {
    if (!this.selectedProperty) {
      console.log("loadFinancialReport: No selected property");
      return;
    }

    // Reset edit mode when loading a new report
    this.isEditMode = false;
    const editBtn = document.getElementById("toggleEditModeBtn");
    if (editBtn) {
      editBtn.innerHTML = '<i class="bi bi-arrows-move me-1"></i>Reorder';
      editBtn.style.background = "rgba(255,255,255,0.2)";
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      const response = await API.get(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORT(
          this.selectedProperty,
          year,
          month,
        ),
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          this.currentReport = result.data;
        } else {
          this.currentReport = null;
        }
      } else if (response.status === 404) {
        // No report exists for this month - start fresh
        this.currentReport = {
          propertyId: this.selectedProperty,
          year: year,
          month: month,
          income: [],
          expenses: [],
          investorTransactions: [],
          totalIncome: 0,
          totalExpenses: 0,
          netProfit: 0,
        };
        console.log(
          `loadFinancialReport: Created empty report for ${year}/${month}`,
        );
      }

      console.log(
        `loadFinancialReport: Calling updateDisplays with:`,
        this.currentReport,
      );
      await this.updateDisplays();
    } catch (error) {
      console.error("Error loading financial report:", error);
      // Don't show error alert - just log it and continue with empty report
      this.currentReport = {
        propertyId: this.selectedProperty,
        year: this.currentDate.getFullYear(),
        month: this.currentDate.getMonth() + 1,
        income: [],
        expenses: [],
        investorTransactions: [],
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0,
      };
      await this.updateDisplays();
    }
  }

  async updateDisplays() {
    this.updateIncomeDisplay();
    this.updateExpenseDisplay();
    this.updateSummaryDisplay();
    this.updateInvestorDisplay();
    this._renderPubOverageBanner();
    await this.updateUnpaidRentReminder();
    await this.updateClosedStatus();
  }

  async _loadPropertySubsidyAndBills(propertyId) {
    try {
      const [propRes, billsRes] = await Promise.allSettled([
        API.get(API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(propertyId)).then((r) =>
          r.json(),
        ),
        API.get(
          API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(propertyId),
        ).then((r) => r.json()),
      ]);
      this.propertySubsidy =
        propRes.status === "fulfilled" && propRes.value.success
          ? propRes.value.property?.subsidizedPub || 0
          : 0;
      this._utilityBills =
        billsRes.status === "fulfilled" && billsRes.value.success
          ? billsRes.value.bills || []
          : [];
    } catch {
      this.propertySubsidy = 0;
      this._utilityBills = [];
    }
  }

  _findOverlappingUtilityBill() {
    if (!this.propertySubsidy || !this._utilityBills.length) return null;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;
    // Reporting month window: 1st–last day
    const reportStart = new Date(year, month - 1, 1);
    const reportEnd = new Date(year, month, 0); // last day of month
    reportEnd.setHours(23, 59, 59, 999);

    for (const bill of this._utilityBills) {
      let overlap = false;

      if (bill.billingPeriodStart && bill.billingPeriodEnd) {
        const bStart = new Date(bill.billingPeriodStart);
        bStart.setHours(0, 0, 0, 0);
        const bEnd = new Date(bill.billingPeriodEnd);
        bEnd.setHours(23, 59, 59, 999);
        overlap = bStart <= reportEnd && bEnd >= reportStart;
      } else {
        // No billing period dates — match by bill year/month
        overlap = bill.year === year && bill.month === month;
      }

      if (overlap && (bill.totalAmount || 0) > this.propertySubsidy) {
        return bill;
      }
    }
    return null;
  }

  _renderPubOverageBanner() {
    const banner = document.getElementById("pubOverageBanner");
    if (!banner) return;

    const bill = this._findOverlappingUtilityBill();
    if (!bill) {
      banner.style.display = "none";
      banner.innerHTML = "";
      return;
    }

    const excess = (bill.totalAmount || 0) - this.propertySubsidy;
    const fmtDate = (v) =>
      v
        ? new Date(v).toLocaleDateString("en-SG", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : null;
    const period =
      bill.billingPeriodStart || bill.billingPeriodEnd
        ? `${fmtDate(bill.billingPeriodStart) || "?"} – ${fmtDate(bill.billingPeriodEnd) || "?"}`
        : `${bill.month}/${bill.year}`;

    banner.style.display = "";
    banner.innerHTML = `
      <div class="alert mb-0 d-flex align-items-start gap-3"
           style="background:#fff1f0;border:1.5px solid #dc3545;border-radius:8px;padding:12px 16px;">
        <div style="font-size:1.6rem;line-height:1;">⚡</div>
        <div class="flex-grow-1">
          <div class="fw-bold text-danger" style="font-size:0.97rem;">
            SP Group bill exceeds max coverage for this period
          </div>
          <div class="text-secondary mt-1" style="font-size:0.85rem;">
            Billing period: <strong>${escapeHtml(period)}</strong> &nbsp;·&nbsp;
            Bill total: <strong class="text-danger">$${(bill.totalAmount || 0).toFixed(2)}</strong> &nbsp;·&nbsp;
            Max covered: <strong>$${this.propertySubsidy.toFixed(2)}</strong> &nbsp;·&nbsp;
            <strong class="text-danger">Over by $${excess.toFixed(2)}</strong>
          </div>
        </div>
        <div class="text-end flex-shrink-0">
          <span class="badge bg-danger" style="font-size:0.85rem;padding:6px 10px;">
            +$${excess.toFixed(2)} overpub
          </span>
        </div>
      </div>`;
  }

  updateIncomeDisplay() {
    const incomeList = document.getElementById("incomeList");
    const totalIncomeEl = document.getElementById("totalIncome");

    if (
      !this.currentReport ||
      !this.currentReport.income ||
      this.currentReport.income.length === 0
    ) {
      incomeList.innerHTML = `
                <div class="text-center text-muted py-2" id="noIncomeMessage">
                    <i class="bi bi-plus-circle fs-4"></i>
                    <p class="mt-1 mb-0 small">No income items added</p>
                </div>
            `;
      if (totalIncomeEl) totalIncomeEl.textContent = "$0.00";
      return;
    }

    let total = 0;
    let totalSGD = 0;
    let totalVND = 0;
    let pendingIncomeTotal = 0;

    // Bulk action bar for income
    const incomeSelectedCount = [...this.selectedItems].filter((k) =>
      k.startsWith("income-"),
    ).length;
    const incomeBulkBar =
      incomeSelectedCount > 0
        ? `
      <div class="d-flex align-items-center gap-2 mb-2 px-1 py-2 rounded bulk-action-bar" style="background:#fff3cd;border:1px solid #ffc107;">
        <span class="small fw-semibold text-warning-emphasis">${incomeSelectedCount} item${incomeSelectedCount > 1 ? "s" : ""} selected</span>
        <button class="btn btn-danger btn-sm ms-auto" onclick="window.financialReports.bulkDeleteSelected('income')">
          <i class="bi bi-trash me-1"></i>Delete Selected (${incomeSelectedCount})
        </button>
        <button class="btn btn-outline-secondary btn-sm" onclick="window.financialReports.clearSelection('income')">
          <i class="bi bi-x"></i> Clear
        </button>
      </div>`
        : "";

    const incomeIsClosed = this.currentReport?.isClosed || !this.isEditMode;

    // Desktop table
    let tableHtml = `
      <div class="table-responsive d-none d-md-block">
        <table class="table table-sm table-striped mb-0" id="incomeTable">
          <thead>
            <tr class="table-success">
              <th class="border-0" style="width:20px;"></th>
              <th class="border-0 small" style="width:32px;">
                <input type="checkbox" class="form-check-input" id="selectAllIncome"
                  onchange="window.financialReports.toggleSelectAll('income', this.checked)"
                  ${incomeSelectedCount === this.currentReport.income.length ? "checked" : ""}>
              </th>
              <th class="border-0 small">Item</th>
              <th class="border-0 small">Date</th>
              <th class="border-0 small">Person</th>
              <th class="border-0 small">Paid By</th>
              <th class="border-0 small text-center">Currency</th>
              <th class="border-0 small text-end">Amount</th>
              <th class="border-0 small text-center actions-column">Actions</th>
            </tr>
          </thead>
          <tbody id="incomeTbody">`;

    // Mobile cards
    let cardsHtml = `
      <div class="d-md-none d-flex flex-column gap-2" id="incomeMobileCards">
        <div class="d-flex align-items-center gap-2 pb-1">
          <input type="checkbox" class="form-check-input" id="selectAllIncomeMobile"
            onchange="window.financialReports.toggleSelectAll('income', this.checked)"
            ${incomeSelectedCount === this.currentReport.income.length ? "checked" : ""}>
          <span class="small text-muted">Select all</span>
        </div>`;

    this.currentReport.income.forEach((item, index) => {
      // Track currency totals — pending items are excluded from confirmed totals
      const currency = item.currency || "SGD";
      if (item.isPending) {
        pendingIncomeTotal += item.amount;
      } else {
        total += item.amount;
        if (currency === "VND") {
          totalVND += item.amount;
        } else {
          totalSGD += item.amount;
        }
      }

      // Find investor name by ID (for income, show investor responsible instead of tenant)
      const investor = this.investors.find(
        (inv) => inv.investorId === item.personInCharge,
      );
      const investorName = investor ? investor.name : item.personInCharge;
      const investorAvatar = investor?.avatar;

      // Check if this item is pending deletion confirmation
      const itemKey = `income-${index}`;
      const isPendingDelete = this.pendingDeletes.has(itemKey);
      const isSelected = this.selectedItems.has(itemKey);

      // Format date for display
      const transactionDate = item.date
        ? new Date(item.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "No date";

      // Check if item has additional details or evidence
      const hasDetails = item.details && item.details.trim() !== "";
      const hasEvidence = item.billEvidence && item.billEvidence.length > 0;
      const hasAdditionalInfo = hasDetails || hasEvidence;

      // Shared: investor avatar (both desktop and mobile use slightly different sizes)
      const investorAvatarDesktop = investorAvatar
        ? `<img src="${this.getOptimizedAvatarUrl(investorAvatar, "small")}" alt="${escapeHtml(investorName)}" class="rounded-circle" style="width:36px;height:36px;object-fit:cover;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(investorName)}">`
        : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width:36px;height:36px;font-size:15px;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(investorName)}">${escapeHtml(investorName.charAt(0).toUpperCase())}</div>`;

      const investorAvatarMobile = investorAvatar
        ? `<img src="${this.getOptimizedAvatarUrl(investorAvatar, "small")}" alt="${escapeHtml(investorName)}" class="rounded-circle" style="width:26px;height:26px;object-fit:cover;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(investorName)}">`
        : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width:26px;height:26px;font-size:12px;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(investorName)}">${escapeHtml(investorName.charAt(0).toUpperCase())}</div>`;

      // Shared: action buttons (desktop)
      const evidenceBtn = hasEvidence
        ? `<button class="btn btn-outline-info btn-sm p-1" onclick="window.financialReports.showBillEvidence('income', ${index})" title="View Evidence"><i class="bi bi-eye"></i></button>`
        : "";
      const editBtn = `<button class="btn btn-outline-primary btn-sm p-1" id="editIncomeBtn-${index}" onclick="window.financialReports.editItem('income', ${index})" title="Edit">
        <span class="edit-icon"><i class="bi bi-pencil"></i></span>
        <span class="loading-spinner d-none"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></span>
      </button>`;
      const deleteBtn = isPendingDelete
        ? `<button class="btn btn-success btn-sm p-1" onclick="window.financialReports.confirmDeleteItem('income', ${index})" title="Confirm delete"><i class="bi bi-check"></i></button>
           <button class="btn btn-outline-secondary btn-sm p-1" onclick="window.financialReports.cancelDeleteItem('income', ${index})" title="Cancel"><i class="bi bi-x"></i></button>`
        : `<button class="btn btn-outline-danger btn-sm p-1" onclick="window.financialReports.toggleDeleteConfirm('income', ${index})" title="Delete"><i class="bi bi-trash"></i></button>`;
      // Mobile buttons: explicit icon colors to prevent inheritance issues
      const evidenceBtnMobile = hasEvidence
        ? `<button class="btn btn-outline-info btn-sm p-1" onclick="window.financialReports.showBillEvidence('income', ${index})" title="View Evidence"><i class="bi bi-eye" style="color:#0dcaf0;"></i></button>`
        : "";
      const editBtnMobile = `<button class="btn btn-outline-primary btn-sm p-1" id="editIncomeBtn-${index}" onclick="window.financialReports.editItem('income', ${index})" title="Edit">
        <span class="edit-icon"><i class="bi bi-pencil" style="color:#0d6efd;"></i></span>
        <span class="loading-spinner d-none"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></span>
      </button>`;
      const deleteBtnMobile = isPendingDelete
        ? `<button class="btn btn-success btn-sm p-1" onclick="window.financialReports.confirmDeleteItem('income', ${index})" title="Confirm delete"><i class="bi bi-check" style="color:#fff;"></i></button>
           <button class="btn btn-outline-secondary btn-sm p-1" onclick="window.financialReports.cancelDeleteItem('income', ${index})" title="Cancel"><i class="bi bi-x" style="color:#6c757d;"></i></button>`
        : `<button class="btn btn-outline-danger btn-sm p-1" onclick="window.financialReports.toggleDeleteConfirm('income', ${index})" title="Delete"><i class="bi bi-trash" style="color:#dc3545;"></i></button>`;

      // --- Desktop table row ---
      tableHtml += `
        <tr data-item-key="${itemKey}" data-item-index="${index}" class="${isSelected ? "table-warning bulk-selected" : ""}" style="cursor:pointer;${item.isPending ? "background:#fffde7;" : ""}">
          ${incomeIsClosed ? '<td class="border-0" style="width:20px;"></td>' : '<td class="border-0 align-middle text-center drag-handle" style="width:20px;cursor:grab;color:#adb5bd;font-size:14px;padding:0 4px;user-select:none;" title="Drag to reorder">⠿</td>'}
          <td class="border-0 align-middle text-center" style="width:32px;">
            <input type="checkbox" class="form-check-input bulk-checkbox" data-item-key="${itemKey}"
              ${isSelected ? "checked" : ""}
              onchange="window.financialReports.toggleItemSelection('income', ${index})"
              onclick="event.stopPropagation()">
          </td>
          <td class="small border-0 align-middle ps-3">
            <div class="d-flex align-items-center gap-1">
              ${item.isPending ? `<span style="background:#f59e0b;color:#7c2d12;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;flex-shrink:0;letter-spacing:0.3px;">PENDING</span>` : ""}
              <span>${escapeHtml(item.item)}</span>
              ${hasAdditionalInfo ? `<i class="bi bi-info-circle text-muted" title="Has additional details or evidence" style="font-size:12px;"></i>` : ""}
            </div>
            ${hasDetails ? `<div class="small text-muted mt-1" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.details)}">${escapeHtml(item.details.substring(0, 50))}${item.details.length > 50 ? "..." : ""}</div>` : ""}
            ${hasEvidence ? `<div class="small text-info mt-1"><i class="bi bi-paperclip"></i> ${item.billEvidence.length} file(s)</div>` : ""}
          </td>
          <td class="small border-0 align-middle">${transactionDate}</td>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center justify-content-center">${investorAvatarDesktop}</div>
          </td>
          <td class="small border-0 align-middle">${this.renderPaidByAvatar(item.paidBy)}</td>
          <td class="small border-0 align-middle text-center">${this.renderCurrencyFlag(item.currency)}</td>
          <td class="small border-0 align-middle text-end fw-bold" style="font-size:16px;color:${item.isPending ? "#b45309" : "#198754"};">$${item.amount.toFixed(2)}</td>
          <td class="border-0 align-middle text-center actions-column">
            <div class="btn-group btn-group-sm">${evidenceBtn}${editBtn}${deleteBtn}</div>
          </td>
        </tr>`;

      // --- Mobile card (single-row flat layout) ---
      const paidByInline = this._renderPaidByAvatarInline(item.paidBy);
      cardsHtml += `
        <div data-item-index="${index}" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:${isSelected ? "#fffbe6" : item.isPending ? "#fffde7" : "#fff"};border-radius:10px;border:1px solid ${item.isPending ? "#f59e0b" : "#e0e0e0"};border-left:3px solid ${item.isPending ? "#f59e0b" : "#198754"};">
          ${incomeIsClosed ? "" : '<span class="drag-handle" style="color:#ccc;font-size:16px;cursor:grab;flex-shrink:0;padding:0 2px;user-select:none;" title="Drag to reorder">⠿</span>'}
          <input type="checkbox" class="form-check-input flex-shrink-0 bulk-checkbox" style="margin:0;" data-item-key="${itemKey}"
            ${isSelected ? "checked" : ""}
            onchange="window.financialReports.toggleItemSelection('income', ${index})"
            onclick="event.stopPropagation()">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <div style="display:flex;align-items:center;gap:4px;min-width:0;">
                ${item.isPending ? '<span style="background:#f59e0b;color:#7c2d12;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;flex-shrink:0;letter-spacing:0.3px;">PENDING</span>' : ""}
                <span style="font-weight:600;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.item)}</span>
              </div>
              <span style="font-weight:700;color:${item.isPending ? "#b45309" : "#198754"};white-space:nowrap;font-size:0.9rem;flex-shrink:0;">$${item.amount.toFixed(2)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <span style="font-size:0.75rem;color:#6c757d;">${transactionDate}</span>
              <span style="font-size:0.8rem;">${this.renderCurrencyFlag(item.currency)}</span>
              <span style="display:flex;align-items:center;gap:4px;">${investorAvatarMobile}${paidByInline ? `<span style="font-size:0.65rem;color:#adb5bd;margin:0 2px;">→</span>${paidByInline}` : ""}</span>
              ${hasEvidence ? `<span style="font-size:0.72rem;color:#0dcaf0;"><i class="bi bi-paperclip"></i>${item.billEvidence.length}</span>` : ""}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
            ${evidenceBtnMobile}${editBtnMobile}${deleteBtnMobile}
          </div>
        </div>`;
    });

    tableHtml += `</tbody></table></div>`;
    cardsHtml += `</div>`;

    let html = `${incomeBulkBar}${tableHtml}${cardsHtml}`;

    incomeList.innerHTML = html;
    if (totalIncomeEl) {
      totalIncomeEl.textContent = `$${total.toFixed(2)}`;

      // Display currency breakdown
      let breakdownHtml = "";
      if (totalSGD > 0 || totalVND > 0 || pendingIncomeTotal > 0) {
        breakdownHtml = '<div class="mt-2 small text-muted">';
        if (totalSGD > 0) {
          breakdownHtml += `<div class="d-flex justify-content-between"><span>🇸🇬 SGD:</span><span>$${totalSGD.toFixed(2)}</span></div>`;
        }
        if (totalVND > 0) {
          breakdownHtml += `<div class="d-flex justify-content-between"><span>🇻🇳 VND:</span><span>$${totalVND.toFixed(2)}</span></div>`;
        }
        if (pendingIncomeTotal > 0) {
          breakdownHtml += `<div class="d-flex justify-content-between mt-1 fw-semibold" style="color:#b45309;border-top:1px solid #fde68a;padding-top:4px;"><span>⏳ Pending:</span><span>$${pendingIncomeTotal.toFixed(2)}</span></div>`;
        }
        breakdownHtml += "</div>";
      }

      // Find or create breakdown container
      let breakdownContainer = document.getElementById(
        "incomeCurrencyBreakdown",
      );
      if (!breakdownContainer) {
        // Create the breakdown container after the total income element
        breakdownContainer = document.createElement("div");
        breakdownContainer.id = "incomeCurrencyBreakdown";
        totalIncomeEl.parentElement.appendChild(breakdownContainer);
      }
      breakdownContainer.innerHTML = breakdownHtml;
    }

    // Initialize tooltips
    this.initializeTooltips();
    // Bind drag-to-select on income table
    this._initDragSelection("incomeTbody", "income");
    // Bind drag-to-reorder on income table and mobile cards
    this._initDragReorder("incomeTbody", "incomeMobileCards", "income");
  }

  updateExpenseDisplay() {
    const expenseList = document.getElementById("expenseList");
    const totalExpensesEl = document.getElementById("totalExpenses");

    if (
      !this.currentReport ||
      !this.currentReport.expenses ||
      this.currentReport.expenses.length === 0
    ) {
      expenseList.innerHTML = `
                <div class="text-center text-muted py-2">
                    <i class="bi bi-dash-circle fs-4"></i>
                    <p class="mt-1 mb-0 small">No expense items added</p>
                </div>
            `;
      if (totalExpensesEl) totalExpensesEl.textContent = "$0.00";
      return;
    }

    let total = 0;
    let pendingExpenseTotal = 0;

    // Bulk action bar for expenses
    const expenseSelectedCount = [...this.selectedItems].filter((k) =>
      k.startsWith("expense-"),
    ).length;
    const expenseBulkBar =
      expenseSelectedCount > 0
        ? `
      <div class="d-flex align-items-center gap-2 mb-2 px-1 py-2 rounded bulk-action-bar" style="background:#fff3cd;border:1px solid #ffc107;">
        <span class="small fw-semibold text-warning-emphasis">${expenseSelectedCount} item${expenseSelectedCount > 1 ? "s" : ""} selected</span>
        <button class="btn btn-danger btn-sm ms-auto" onclick="window.financialReports.bulkDeleteSelected('expense')">
          <i class="bi bi-trash me-1"></i>Delete Selected (${expenseSelectedCount})
        </button>
        <button class="btn btn-outline-secondary btn-sm" onclick="window.financialReports.clearSelection('expense')">
          <i class="bi bi-x"></i> Clear
        </button>
      </div>`
        : "";

    const expenseIsClosed = this.currentReport?.isClosed || !this.isEditMode;

    // Desktop table
    let tableHtml = `
      <div class="table-responsive d-none d-md-block">
        <table class="table table-sm table-striped mb-0" id="expenseTable">
          <thead>
            <tr class="table-danger">
              <th class="border-0" style="width:20px;"></th>
              <th class="border-0 small" style="width:32px;">
                <input type="checkbox" class="form-check-input" id="selectAllExpenses"
                  onchange="window.financialReports.toggleSelectAll('expense', this.checked)"
                  ${expenseSelectedCount === this.currentReport.expenses.length ? "checked" : ""}>
              </th>
              <th class="border-0 small">Item</th>
              <th class="border-0 small">Date</th>
              <th class="border-0 small">Person</th>
              <th class="border-0 small text-center">Paid To</th>
              <th class="border-0 small text-end">Amount</th>
              <th class="border-0 small text-center actions-column">Actions</th>
            </tr>
          </thead>
          <tbody id="expenseTbody">`;

    // Mobile cards
    let cardsHtml = `
      <div class="d-md-none d-flex flex-column gap-2" id="expenseMobileCards">
        <div class="d-flex align-items-center gap-2 pb-1">
          <input type="checkbox" class="form-check-input" id="selectAllExpensesMobile"
            onchange="window.financialReports.toggleSelectAll('expense', this.checked)"
            ${expenseSelectedCount === this.currentReport.expenses.length ? "checked" : ""}>
          <span class="small text-muted">Select all</span>
        </div>`;

    this.currentReport.expenses.forEach((item, index) => {
      if (item.isPending) {
        pendingExpenseTotal += item.amount;
      } else {
        total += item.amount;
      }

      // Find investor name by ID
      const investor = this.investors.find(
        (inv) => inv.investorId === item.personInCharge,
      );
      const investorName = investor ? investor.name : item.personInCharge;
      const investorAvatar = investor?.avatar;

      // Check if this item is pending deletion confirmation
      const itemKey = `expense-${index}`;
      const isPendingDelete = this.pendingDeletes.has(itemKey);
      const isSelected = this.selectedItems.has(itemKey);

      // Format date for display
      const transactionDate = item.date
        ? new Date(item.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "No date";

      // Check if item has additional details or evidence
      const hasDetails = item.details && item.details.trim() !== "";
      const hasEvidence = item.billEvidence && item.billEvidence.length > 0;
      const hasAdditionalInfo = hasDetails || hasEvidence;

      // Shared: investor avatar
      const investorAvatarDesktop = investorAvatar
        ? `<img src="${this.getOptimizedAvatarUrl(investorAvatar, "small")}" alt="${escapeHtml(investorName)}" class="rounded-circle" style="width:36px;height:36px;object-fit:cover;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(investorName)}">`
        : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width:36px;height:36px;font-size:15px;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(investorName)}">${escapeHtml(investorName.charAt(0).toUpperCase())}</div>`;

      const investorAvatarMobile = investorAvatar
        ? `<img src="${this.getOptimizedAvatarUrl(investorAvatar, "small")}" alt="${escapeHtml(investorName)}" class="rounded-circle" style="width:26px;height:26px;object-fit:cover;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(investorName)}">`
        : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width:26px;height:26px;font-size:12px;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(investorName)}">${escapeHtml(investorName.charAt(0).toUpperCase())}</div>`;

      // paid-to avatar: desktop (flex-column with badge) vs mobile (inline)
      const unknownCircle = `<div class="rounded-circle bg-light border d-flex align-items-center justify-content-center text-muted" style="width:32px;height:32px;font-size:16px;" data-bs-toggle="tooltip" data-bs-title="Unknown recipient"><i class="bi bi-person"></i></div>`;
      const paidToAvatarHtml =
        item.paidTo === "unknown"
          ? unknownCircle
          : item.paidTo
            ? this.renderPaidByAvatar(item.paidTo)
            : `<span class="text-muted small">—</span>`;
      const paidToInline =
        item.paidTo === "unknown"
          ? `<div class="rounded-circle bg-light border d-flex align-items-center justify-content-center text-muted" style="width:26px;height:26px;font-size:14px;" data-bs-toggle="tooltip" data-bs-title="Unknown recipient"><i class="bi bi-person"></i></div>`
          : item.paidTo
            ? this._renderPaidByAvatarInline(item.paidTo)
            : "";

      // Shared: action buttons (desktop)
      const evidenceBtn = hasEvidence
        ? `<button class="btn btn-outline-info btn-sm p-1" onclick="window.financialReports.showBillEvidence('expense', ${index})" title="View Evidence"><i class="bi bi-eye"></i></button>`
        : "";
      const editBtn = `<button class="btn btn-outline-primary btn-sm p-1" id="editExpenseBtn-${index}" onclick="window.financialReports.editItem('expense', ${index})" title="Edit">
        <span class="edit-icon"><i class="bi bi-pencil"></i></span>
        <span class="loading-spinner d-none"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></span>
      </button>`;
      const deleteBtn = isPendingDelete
        ? `<button class="btn btn-success btn-sm p-1" onclick="window.financialReports.confirmDeleteItem('expense', ${index})" title="Confirm delete"><i class="bi bi-check"></i></button>
           <button class="btn btn-outline-secondary btn-sm p-1" onclick="window.financialReports.cancelDeleteItem('expense', ${index})" title="Cancel"><i class="bi bi-x"></i></button>`
        : `<button class="btn btn-outline-danger btn-sm p-1" onclick="window.financialReports.toggleDeleteConfirm('expense', ${index})" title="Delete"><i class="bi bi-trash"></i></button>`;
      // Mobile buttons: explicit icon colors to prevent inheritance issues
      const evidenceBtnMobile = hasEvidence
        ? `<button class="btn btn-outline-info btn-sm p-1" onclick="window.financialReports.showBillEvidence('expense', ${index})" title="View Evidence"><i class="bi bi-eye" style="color:#0dcaf0;"></i></button>`
        : "";
      const editBtnMobile = `<button class="btn btn-outline-primary btn-sm p-1" id="editExpenseBtn-${index}" onclick="window.financialReports.editItem('expense', ${index})" title="Edit">
        <span class="edit-icon"><i class="bi bi-pencil" style="color:#0d6efd;"></i></span>
        <span class="loading-spinner d-none"><span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></span>
      </button>`;
      const deleteBtnMobile = isPendingDelete
        ? `<button class="btn btn-success btn-sm p-1" onclick="window.financialReports.confirmDeleteItem('expense', ${index})" title="Confirm delete"><i class="bi bi-check" style="color:#fff;"></i></button>
           <button class="btn btn-outline-secondary btn-sm p-1" onclick="window.financialReports.cancelDeleteItem('expense', ${index})" title="Cancel"><i class="bi bi-x" style="color:#6c757d;"></i></button>`
        : `<button class="btn btn-outline-danger btn-sm p-1" onclick="window.financialReports.toggleDeleteConfirm('expense', ${index})" title="Delete"><i class="bi bi-trash" style="color:#dc3545;"></i></button>`;

      // --- Desktop table row ---
      tableHtml += `
        <tr data-item-key="${itemKey}" data-item-index="${index}" class="${isSelected ? "table-warning bulk-selected" : ""}" style="cursor:pointer;${item.isPending ? "background:#fffde7;" : ""}">
          ${expenseIsClosed ? '<td class="border-0" style="width:20px;"></td>' : '<td class="border-0 align-middle text-center drag-handle" style="width:20px;cursor:grab;color:#adb5bd;font-size:14px;padding:0 4px;user-select:none;" title="Drag to reorder">⠿</td>'}
          <td class="border-0 align-middle text-center" style="width:32px;">
            <input type="checkbox" class="form-check-input bulk-checkbox" data-item-key="${itemKey}"
              ${isSelected ? "checked" : ""}
              onchange="window.financialReports.toggleItemSelection('expense', ${index})"
              onclick="event.stopPropagation()">
          </td>
          <td class="small border-0 align-middle ps-3">
            <div class="d-flex align-items-center gap-1">
              ${item.isPending ? `<span style="background:#f59e0b;color:#7c2d12;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;flex-shrink:0;letter-spacing:0.3px;">PENDING</span>` : ""}
              <span>${escapeHtml(item.item)}</span>
              ${hasAdditionalInfo ? `<i class="bi bi-info-circle text-muted" title="Has additional details or evidence" style="font-size:12px;"></i>` : ""}
            </div>
            ${hasDetails ? `<div class="small text-muted mt-1" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.details)}">${escapeHtml(item.details.substring(0, 50))}${item.details.length > 50 ? "..." : ""}</div>` : ""}
            ${hasEvidence ? `<div class="small text-info mt-1"><i class="bi bi-paperclip"></i> ${item.billEvidence.length} file(s)</div>` : ""}
          </td>
          <td class="small border-0 align-middle">${transactionDate}</td>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center justify-content-center">${investorAvatarDesktop}</div>
          </td>
          <td class="small border-0 align-middle text-center">${paidToAvatarHtml}</td>
          <td class="small border-0 align-middle text-end fw-bold" style="font-size:16px;color:${item.isPending ? "#b45309" : "#dc3545"};">$${item.amount.toFixed(2)}</td>
          <td class="border-0 align-middle text-center actions-column">
            <div class="btn-group btn-group-sm">${evidenceBtn}${editBtn}${deleteBtn}</div>
          </td>
        </tr>`;

      // --- Mobile card (single-row flat layout) ---
      cardsHtml += `
        <div data-item-index="${index}" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:${isSelected ? "#fffbe6" : item.isPending ? "#fffde7" : "#fff"};border-radius:10px;border:1px solid ${item.isPending ? "#f59e0b" : "#e0e0e0"};border-left:3px solid ${item.isPending ? "#f59e0b" : "#dc3545"};">
          ${expenseIsClosed ? "" : '<span class="drag-handle" style="color:#ccc;font-size:16px;cursor:grab;flex-shrink:0;padding:0 2px;user-select:none;" title="Drag to reorder">⠿</span>'}
          <input type="checkbox" class="form-check-input flex-shrink-0 bulk-checkbox" style="margin:0;" data-item-key="${itemKey}"
            ${isSelected ? "checked" : ""}
            onchange="window.financialReports.toggleItemSelection('expense', ${index})"
            onclick="event.stopPropagation()">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <div style="display:flex;align-items:center;gap:4px;min-width:0;">
                ${item.isPending ? '<span style="background:#f59e0b;color:#7c2d12;font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap;flex-shrink:0;letter-spacing:0.3px;">PENDING</span>' : ""}
                <span style="font-weight:600;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.item)}</span>
              </div>
              <span style="font-weight:700;color:${item.isPending ? "#b45309" : "#dc3545"};white-space:nowrap;font-size:0.9rem;flex-shrink:0;">$${item.amount.toFixed(2)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <span style="font-size:0.75rem;color:#6c757d;">${transactionDate}</span>
              <span style="display:flex;align-items:center;gap:4px;">${investorAvatarMobile}${paidToInline ? `<span style="font-size:0.65rem;color:#adb5bd;margin:0 2px;">→</span>${paidToInline}` : ""}</span>
              ${hasEvidence ? `<span style="font-size:0.72rem;color:#0dcaf0;"><i class="bi bi-paperclip"></i>${item.billEvidence.length}</span>` : ""}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">
            ${evidenceBtnMobile}${editBtnMobile}${deleteBtnMobile}
          </div>
        </div>`;
    });

    tableHtml += `</tbody></table></div>`;
    cardsHtml += `</div>`;

    let html = `${expenseBulkBar}${tableHtml}${cardsHtml}`;
    expenseList.innerHTML = html;
    if (totalExpensesEl) {
      totalExpensesEl.textContent = `$${total.toFixed(2)}`;

      // Display pending expense breakdown
      let expenseBreakdownEl = document.getElementById(
        "expensePendingBreakdown",
      );
      if (!expenseBreakdownEl) {
        expenseBreakdownEl = document.createElement("div");
        expenseBreakdownEl.id = "expensePendingBreakdown";
        totalExpensesEl.parentElement.appendChild(expenseBreakdownEl);
      }
      if (pendingExpenseTotal > 0) {
        expenseBreakdownEl.innerHTML = `<div class="mt-1 small fw-semibold" style="color:#b45309;border-top:1px solid #fde68a;padding-top:4px;"><span>⏳ Pending: $${pendingExpenseTotal.toFixed(2)}</span></div>`;
      } else {
        expenseBreakdownEl.innerHTML = "";
      }
    }

    // Initialize tooltips
    this.initializeTooltips();
    // Bind drag-to-select on expense table
    this._initDragSelection("expenseTbody", "expense");
    // Bind drag-to-reorder on expense table and mobile cards
    this._initDragReorder("expenseTbody", "expenseMobileCards", "expense");
  }

  updateSummaryDisplay() {
    const netProfitEl = document.getElementById("netProfit");

    if (!this.currentReport) {
      // No report loaded - show $0.00
      if (netProfitEl) {
        netProfitEl.textContent = "$0.00";
        netProfitEl.className = "text-success mb-0";
      }
      return;
    }

    const totalIncome = this.currentReport.totalIncome || 0;
    const totalExpenses = this.currentReport.totalExpenses || 0;
    const netProfit = totalIncome - totalExpenses;

    if (netProfitEl) {
      netProfitEl.textContent = `$${netProfit.toFixed(2)}`;
      netProfitEl.className =
        netProfit >= 0 ? "text-success mb-0" : "text-danger mb-0";
    }
  }

  updateInvestorDisplay() {
    const investorDistribution = document.getElementById(
      "investorDistribution",
    );

    // Check if report is closed and has snapshot data - use frozen snapshot instead of recalculating
    const isClosed = this.currentReport && this.currentReport.isClosed;
    const hasSnapshot =
      this.currentReport &&
      this.currentReport.investorSnapshot &&
      this.currentReport.investorSnapshot.length > 0;

    // For closed reports with snapshot, use the snapshot data
    if (isClosed && hasSnapshot) {
      this.renderInvestorDisplayFromSnapshot();
      return;
    }

    // For open reports or reports without snapshot, calculate dynamically
    if (!this.investors || this.investors.length === 0) {
      investorDistribution.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="bi bi-person-lines-fill fs-1"></i>
                    <p class="mt-2">No investors configured for this property</p>
                </div>
            `;
      return;
    }

    const netProfit = this.currentReport
      ? (this.currentReport.totalIncome || 0) -
        (this.currentReport.totalExpenses || 0)
      : 0;

    // Create compact table format
    let html = `
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <thead>
            <tr class="table-info">
              <th class="border-0 small">Investor</th>
              <th class="border-0 small text-center">Share %</th>
              <th class="border-0 small text-end">Profit Share</th>
              <th class="border-0 small text-end">Paid</th>
              <th class="border-0 small text-end">Received</th>
              <th class="border-0 small text-end">Final</th>
              <th class="border-0 small text-center actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.investors.forEach((investor) => {
      // Try to get percentage from report's investorTransactions (snapshot) first
      const investorTransaction =
        this.currentReport?.investorTransactions?.find(
          (t) => t.investorId === investor.investorId,
        );
      // Fall back to live investor data if no snapshot exists
      const propertyData = investor.properties.find(
        (p) => p.propertyId === this.selectedProperty,
      );
      const percentage =
        investorTransaction?.percentage ??
        (propertyData ? propertyData.percentage : 0);
      const profitShare = (netProfit * percentage) / 100;

      // Calculate paid amount (expenses paid by this investor, excluding pending)
      // Note: For expenses, the person who paid is stored in 'personInCharge' field
      const paidAmount =
        this.currentReport && this.currentReport.expenses
          ? this.currentReport.expenses
              .filter(
                (e) => !e.isPending && e.personInCharge === investor.investorId,
              )
              .reduce((sum, e) => sum + (e.amount || 0), 0)
          : 0;

      // Calculate received amount (income received by this investor, excluding pending)
      const receivedAmount =
        this.currentReport && this.currentReport.income
          ? this.currentReport.income
              .filter(
                (i) => !i.isPending && i.personInCharge === investor.investorId,
              )
              .reduce((sum, i) => sum + (i.amount || 0), 0)
          : 0;

      // Calculate final amount (everything in SGD)
      // Formula: Final = Profit Share + Paid - Received
      const finalAmount = profitShare + paidAmount - receivedAmount;

      html += `
        <tr>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center gap-2">
              ${
                investor.avatar
                  ? `<img src="${this.getOptimizedAvatarUrl(
                      investor.avatar,
                      "small",
                    )}" alt="${escapeHtml(
                      investor.name,
                    )}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">`
                  : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 15px;">${escapeHtml(
                      investor.name.charAt(0).toUpperCase(),
                    )}</div>`
              }
              <span class="fw-semibold">${escapeHtml(investor.name)}</span>
            </div>
          </td>
          <td class="small border-0 align-middle text-center fw-bold">${percentage}%</td>
          <td class="small border-0 align-middle text-end ${
            profitShare >= 0 ? "text-primary" : "text-danger"
          }" style="font-size: 16px;">$${profitShare.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end ${
            paidAmount > 0 ? "text-warning" : "text-muted"
          }" style="font-size: 16px;">$${paidAmount.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end ${
            receivedAmount > 0 ? "text-info" : "text-muted"
          }" style="font-size: 16px;">$${receivedAmount.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end fw-bold ${
            finalAmount >= 0 ? "text-success" : "text-danger"
          }" style="font-size: 16px;">$${finalAmount.toFixed(2)}</td>
          <td class="border-0 align-middle text-center actions-column">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary btn-sm p-1" onclick="window.financialReports.editInvestor('${
                investor.investorId
              }')" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm p-1" onclick="window.financialReports.removeInvestor('${
                investor.investorId
              }')" title="Remove">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    investorDistribution.innerHTML = html;

    // Initialize tooltips
    this.initializeTooltips();
  }

  // Render investor display using frozen snapshot data (for closed reports)
  renderInvestorDisplayFromSnapshot() {
    const investorDistribution = document.getElementById(
      "investorDistribution",
    );

    const snapshot = this.currentReport.investorSnapshot;

    if (!snapshot || snapshot.length === 0) {
      investorDistribution.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="bi bi-person-lines-fill fs-1"></i>
                    <p class="mt-2">No investor data available for this closed report</p>
                </div>
            `;
      return;
    }

    // Create compact table format - same layout but with frozen data and no action buttons
    let html = `
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <thead>
            <tr class="table-info">
              <th class="border-0 small">Investor</th>
              <th class="border-0 small text-center">Share %</th>
              <th class="border-0 small text-end">Profit Share</th>
              <th class="border-0 small text-end">Paid</th>
              <th class="border-0 small text-end">Received</th>
              <th class="border-0 small text-end">Final</th>
            </tr>
          </thead>
          <tbody>
    `;

    snapshot.forEach((investorData) => {
      const {
        name,
        avatar,
        percentage,
        profitShare,
        paidAmount,
        receivedAmount,
        finalAmount,
      } = investorData;

      html += `
        <tr>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center gap-2">
              ${
                avatar
                  ? `<img src="${this.getOptimizedAvatarUrl(
                      avatar,
                      "small",
                    )}" alt="${escapeHtml(
                      name,
                    )}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">`
                  : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 15px;">${escapeHtml(
                      name.charAt(0).toUpperCase(),
                    )}</div>`
              }
              <span class="fw-semibold">${escapeHtml(name)}</span>
            </div>
          </td>
          <td class="small border-0 align-middle text-center fw-bold">${percentage}%</td>
          <td class="small border-0 align-middle text-end ${
            profitShare >= 0 ? "text-primary" : "text-danger"
          }" style="font-size: 16px;">$${profitShare.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end ${
            paidAmount > 0 ? "text-warning" : "text-muted"
          }" style="font-size: 16px;">$${paidAmount.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end ${
            receivedAmount > 0 ? "text-info" : "text-muted"
          }" style="font-size: 16px;">$${receivedAmount.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end fw-bold ${
            finalAmount >= 0 ? "text-success" : "text-danger"
          }" style="font-size: 16px;">$${finalAmount.toFixed(2)}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    investorDistribution.innerHTML = html;

    // Initialize tooltips
    this.initializeTooltips();
  }

  async updateUnpaidRentReminder() {
    const reminderContainer = document.getElementById("unpaidRentReminder");
    if (!reminderContainer || !this.selectedProperty || !this.currentReport) {
      return;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      // Fetch tenants for this property
      const tenantsResponse = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(this.selectedProperty),
      );

      if (!tenantsResponse.ok) {
        reminderContainer.style.display = "none";
        return;
      }

      const tenantsResult = await tenantsResponse.json();
      const allTenants = tenantsResult.success
        ? tenantsResult.tenants || []
        : [];

      // Filter tenants whose rental period overlaps with current month
      const currentMonthTenants = allTenants.filter((tenant) => {
        if (!tenant.properties || !Array.isArray(tenant.properties)) {
          return false;
        }

        // Find the property record for current property
        // Properties can be either strings or objects with propertyId
        const propertyRecord = tenant.properties.find((prop) => {
          const propId = typeof prop === "object" ? prop.propertyId : prop;
          return (
            propId &&
            propId.toUpperCase() === this.selectedProperty.toUpperCase()
          );
        });

        if (!propertyRecord) {
          return false;
        }

        // Check if tenant has move-in/move-out dates in the property record
        // Property record can be an object with moveinDate/moveoutDate fields
        const moveInDate =
          propertyRecord &&
          typeof propertyRecord === "object" &&
          propertyRecord.moveinDate
            ? new Date(propertyRecord.moveinDate)
            : null;
        const moveOutDate =
          propertyRecord &&
          typeof propertyRecord === "object" &&
          propertyRecord.moveoutDate
            ? new Date(propertyRecord.moveoutDate)
            : null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reportDate = new Date(year, month - 1, 1); // First day of report month
        const reportEndDate = new Date(year, month, 0); // Last day of report month

        // Tenant should be in property during this month
        if (moveInDate && moveInDate > reportEndDate) {
          return false; // Moved in after this month entirely
        }

        // If move-in date is in the reporting month but hasn't happened yet (after today),
        // annotate the tenant so we can display their upcoming move-in date
        if (moveInDate && moveInDate >= reportDate && moveInDate > today) {
          tenant._upcomingMoveInDate = moveInDate;
        } else {
          tenant._upcomingMoveInDate = null;
        }

        if (moveOutDate && moveOutDate < reportDate) {
          return false; // Moved out before this month
        }

        // Annotate if tenant moves out within this reporting month
        if (
          moveOutDate &&
          moveOutDate >= reportDate &&
          moveOutDate <= reportEndDate
        ) {
          tenant._moveOutDateThisMonth = moveOutDate;
          tenant._moveInDateForDisplay = moveInDate;
        } else {
          tenant._moveOutDateThisMonth = null;
          tenant._moveInDateForDisplay = null;
        }

        // Store move-out date for CSS differentiation in unpaid reminder
        tenant._moveOutDate = moveOutDate;

        return true; // Tenant was/is in property during this month
      });

      // Get payment amounts per tenant (appear in income as paidBy)
      const paidAmountsByTenantId = new Map();
      if (
        this.currentReport.income &&
        Array.isArray(this.currentReport.income)
      ) {
        this.currentReport.income.forEach((incomeItem) => {
          const paidByList = Array.isArray(incomeItem.paidBy)
            ? incomeItem.paidBy
            : incomeItem.paidBy
              ? [incomeItem.paidBy]
              : [];
          paidByList.forEach((paidByValue) => {
            if (!paidByValue || !paidByValue.startsWith("tenant_")) return;
            const tenantId = paidByValue.replace("tenant_", "");
            const tenant = this.tenants.find(
              (t) =>
                (t._id && t._id === tenantId) ||
                (t.tenantId && t.tenantId === tenantId) ||
                (t.name && t.name === tenantId) ||
                (t.fin && t.fin === tenantId) ||
                (t.passportNumber && t.passportNumber === tenantId),
            );
            if (tenant && tenant._id) {
              const currentAmount = paidAmountsByTenantId.get(tenant._id) || 0;
              paidAmountsByTenantId.set(
                tenant._id,
                currentAmount + (incomeItem.amount || 0),
              );
            }
          });
        });
      }

      // Build roommate groups: tenants sharing the same room
      // A tenant with roommateId is linked to another tenant
      const roomGroups = new Map(); // groupKey -> [tenant1, tenant2, ...]
      const tenantToGroup = new Map(); // tenantId -> groupKey

      currentMonthTenants.forEach((tenant) => {
        if (tenantToGroup.has(tenant._id)) return; // Already assigned

        const roommateId = tenant.roommateId?._id || tenant.roommateId || null;

        // Check if roommate is already in a group
        if (roommateId && tenantToGroup.has(roommateId)) {
          const groupKey = tenantToGroup.get(roommateId);
          roomGroups.get(groupKey).push(tenant);
          tenantToGroup.set(tenant._id, groupKey);
        } else {
          // Create new group
          const groupKey = tenant._id;
          roomGroups.set(groupKey, [tenant]);
          tenantToGroup.set(tenant._id, groupKey);

          // If roommate exists, add them to this group too
          if (roommateId) {
            const roommateTenant = currentMonthTenants.find(
              (t) => t._id === roommateId,
            );
            if (roommateTenant && !tenantToGroup.has(roommateId)) {
              roomGroups.get(groupKey).push(roommateTenant);
              tenantToGroup.set(roommateId, groupKey);
            }
          }
        }
      });

      // Find unpaid tenants - exclude roommates if room rent is fully covered
      const unpaidTenants = currentMonthTenants.filter((tenant) => {
        const groupKey = tenantToGroup.get(tenant._id);
        const roommates = roomGroups.get(groupKey) || [tenant];

        // Calculate total rent for this room (all roommates)
        const totalRoomRent = roommates.reduce(
          (sum, t) => sum + (typeof getEffectiveTenantRent === "function" ? (getEffectiveTenantRent(t) || 0) : (t.rent || 0)),
          0,
        );

        // Calculate total paid by all roommates in this room
        const totalPaid = roommates.reduce(
          (sum, t) => sum + (paidAmountsByTenantId.get(t._id) || 0),
          0,
        );

        // If total paid covers the room rent, don't show any tenant from this room
        if (totalPaid >= totalRoomRent && totalRoomRent > 0) {
          return false;
        }

        // Otherwise, check if this individual tenant has paid
        const hasPaid = paidAmountsByTenantId.has(tenant._id);
        return !hasPaid;
      });

      // Display the reminder
      if (unpaidTenants.length === 0) {
        reminderContainer.innerHTML = `
          <div class="alert alert-success mb-3">
            <i class="bi bi-check-circle me-2"></i>
            <strong>All tenants have paid!</strong> No pending rent payments for this month.
          </div>
        `;
        reminderContainer.style.display = "block";
      } else {
        // Filter out tenants without room type
        const tenantsWithRoomType = unpaidTenants.filter(
          (tenant) => tenant.roomType,
        );

        if (tenantsWithRoomType.length === 0) {
          reminderContainer.style.display = "none";
          return;
        }

        const collapseId = `unpaidRentCollapse_${this.selectedProperty}_${year}_${month}`;
        let html = `
          <div class="alert alert-warning mb-3">
            <div class="d-flex justify-content-between align-items-center" style="cursor: pointer;" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="true" aria-controls="${collapseId}">
              <div>
                <i class="bi bi-exclamation-triangle me-2"></i>
                <strong>Unpaid Rent Reminder</strong> - ${tenantsWithRoomType.length} tenant${tenantsWithRoomType.length > 1 ? "s" : ""} haven't paid rent yet
              </div>
              <i class="bi bi-chevron-down"></i>
            </div>
            <div class="collapse show" id="${collapseId}">
              <div class="mt-2">
                <small class="d-block mb-2 text-muted">The following tenants should have paid rent for this month:</small>
                <ul class="mb-0">
        `;

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        tenantsWithRoomType.forEach((tenant) => {
          const displayName = tenant.name || tenant.username || tenant.tenantId;
          const phoneNumber = tenant.phoneNumber || "";
          const roomType = this.getRoomTypeDisplayName(tenant.roomType);
          const facebookUrl = tenant.facebookUrl || "";
          const roommateName = tenant.roommateId?.name || "";
          const roommateAvatar = tenant.roommateId?.avatar || "";
          const hasMovedOut = tenant._moveOutDate && tenant._moveOutDate < now;
          const upcomingMoveIn = tenant._upcomingMoveInDate
            ? tenant._upcomingMoveInDate.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : null;

          // Generate roommate avatar HTML
          let roommateAvatarHtml = "";
          if (roommateName) {
            if (roommateAvatar) {
              roommateAvatarHtml = `<img src="${escapeHtml(roommateAvatar)}" alt="${escapeHtml(roommateName)}" class="rounded-circle" style="width: 24px; height: 24px; object-fit: cover; border: 2px solid #0dcaf0;" title="Roommate: ${escapeHtml(roommateName)}" data-bs-toggle="tooltip">`;
            } else {
              const initial = roommateName.charAt(0).toUpperCase();
              roommateAvatarHtml = `<div class="rounded-circle bg-info d-flex align-items-center justify-content-center text-white fw-bold" style="width: 24px; height: 24px; font-size: 12px; border: 2px solid #0dcaf0;" title="Roommate: ${escapeHtml(roommateName)}" data-bs-toggle="tooltip">${escapeHtml(initial)}</div>`;
            }
          }

          // Build fee badges
          const _effectiveRent1 = typeof getEffectiveTenantRent === "function" ? getEffectiveTenantRent(tenant) : tenant.rent;
          const rentBadge = _effectiveRent1
            ? `<span class="badge bg-secondary" title="Monthly Rent">Rent: $${Number(_effectiveRent1).toFixed(2)}</span>`
            : "";
          const cleaningBadge = tenant.cleaningFee
            ? `<span class="badge bg-secondary" title="Cleaning Fee">Cleaning: $${tenant.cleaningFee.toFixed(2)}</span>`
            : "";
          const pubBadge = !tenant.isUtilitySubsidized
            ? `<span class="badge bg-info text-dark" title="Tenant pays PUB utility bill">PUB</span>`
            : "";

          const moveInBadge = upcomingMoveIn
            ? `<span class="badge bg-warning text-dark" title="Upcoming move-in date"><i class="bi bi-calendar-event me-1"></i>Moving in: ${escapeHtml(upcomingMoveIn)}</span>`
            : "";

          let periodBadge = "";
          if (tenant._moveOutDateThisMonth) {
            const fmt = (d) =>
              d.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
            const from = tenant._moveInDateForDisplay
              ? fmt(tenant._moveInDateForDisplay)
              : "—";
            const to = fmt(tenant._moveOutDateThisMonth);
            periodBadge = `<span class="badge bg-secondary" title="Rental period this month"><i class="bi bi-calendar-range me-1"></i>${escapeHtml(from)} – ${escapeHtml(to)}</span>`;
          }

          const tenantNotes = tenant.notes ? tenant.notes.trim() : "";
          const movedOutBadge = hasMovedOut
            ? `<span class="badge text-white" style="background-color:#6c757d;font-size:0.7em;"><i class="bi bi-box-arrow-right me-1"></i>Moved Out</span>`
            : "";
          const liStyle = hasMovedOut
            ? `opacity:0.55;filter:grayscale(0.4);`
            : "";
          html += `
            <li class="mb-2" style="${liStyle}">
              <div class="d-flex align-items-center flex-wrap gap-2">
                <strong${hasMovedOut ? ` class="text-muted"` : ""}>${escapeHtml(displayName)}</strong>
                <span class="text-muted">(${escapeHtml(roomType)})</span>
                ${movedOutBadge}
                ${moveInBadge}
                ${periodBadge}
                ${rentBadge}
                ${cleaningBadge}
                ${pubBadge}
                ${phoneNumber ? `<a href="https://wa.me/${escapeHtml(phoneNumber.replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener noreferrer" class="badge bg-success text-white text-decoration-none" title="Chat on WhatsApp"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>` : ""}
                ${facebookUrl ? `<a href="${escapeHtml(facebookUrl)}" target="_blank" rel="noopener noreferrer" class="badge bg-primary text-white text-decoration-none" title="View Facebook Profile"><i class="bi bi-facebook me-1"></i>Facebook</a>` : ""}
                ${roommateAvatarHtml}
              </div>
              ${tenantNotes ? `<div class="text-muted small mt-1"><i class="bi bi-sticky me-1"></i>${escapeHtml(tenantNotes)}</div>` : ""}
            </li>
          `;
        });

        html += `
              </ul>
              </div>
            </div>
          </div>
        `;

        reminderContainer.innerHTML = html;
        reminderContainer.style.display = "block";

        // Initialize Bootstrap tooltips for roommate avatars
        const tooltipTriggerList = reminderContainer.querySelectorAll(
          '[data-bs-toggle="tooltip"]',
        );
        tooltipTriggerList.forEach((tooltipTriggerEl) => {
          // Dispose existing tooltip first to prevent conflicts
          const existingTooltip =
            bootstrap.Tooltip.getInstance(tooltipTriggerEl);
          if (existingTooltip) {
            existingTooltip.dispose();
          }
          new bootstrap.Tooltip(tooltipTriggerEl);
        });
      }
    } catch (error) {
      console.error("Error loading unpaid rent reminder:", error);
      reminderContainer.style.display = "none";
    }
  }

  async updateMonthDisplay() {
    // Call the enhanced version that includes closed status
    await this.updateMonthDisplayWithClosedStatus();
  }

  async changeMonth(direction) {
    console.log(`changeMonth called with direction: ${direction}`);
    console.log(`Current date before change:`, this.currentDate);

    const newDate = new Date(this.currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    this.currentDate = newDate;

    console.log(`Current date after change:`, this.currentDate);
    console.log(`Selected property:`, this.selectedProperty);

    // Clear current report to prevent showing old data
    this.currentReport = null;

    // Invalidate status cache so the new month's statuses are fetched
    this._statusCacheKey = null;

    // Reset any pending close state when changing months
    this.pendingClose = false;

    // Clear displays immediately to show loading state
    this.updateIncomeDisplay();
    this.updateExpenseDisplay();
    this.updateSummaryDisplay();
    this.updateInvestorDisplay();

    await this.updateMonthDisplay();
    await this.loadFinancialReport();
    // Reload property report statuses for the new month
    this.loadPropertyReportStatuses();
    // Refresh all-unpaid overview if it's currently visible
    if (this.allUnpaidVisible) {
      this.refreshAllUnpaidReminderSection();
    }

    // Sync URL so the new month is bookmarkable
    if (this.selectedProperty && window.appRouter) {
      const _y = this.currentDate.getFullYear();
      const _m = this.currentDate.getMonth() + 1;
      const _propData = this.properties.find(
        (p) => p.propertyId === this.selectedProperty,
      );
      const _slug = _propData
        ? window.SlugUtils.propertySlug(_propData)
        : this.selectedProperty;
      window.appRouter.replace(`/financial/${_slug}/${_y}/${_m}`);
    }
  }

  async fillUtilityBillExpense() {
    if (!this.selectedProperty) {
      showToast("Please select a property first", "error");
      return;
    }
    if (this.currentReport?.isClosed) {
      showToast("Cannot add items — this month is closed", "error");
      return;
    }
    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;
      const monthName = this.currentDate.toLocaleString("en-SG", {
        month: "long",
      });

      // First: check utility bill tracker for a matching entry
      let amount = null;
      let details = "";
      const ubRes = await API.get(
        API_CONFIG.ENDPOINTS.UTILITY_BILLS_BY_PROPERTY(this.selectedProperty),
      );
      const ubData = await ubRes.json();
      const ubEntry = (ubData.bills || []).find(
        (b) => b.year === year && b.month === month,
      );
      if (ubEntry) {
        amount = ubEntry.totalAmount ?? 0;
        const fmt = (d) =>
          d
            ? new Date(d).toLocaleDateString("en-SG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : null;
        const start = fmt(ubEntry.billingPeriodStart);
        const end = fmt(ubEntry.billingPeriodEnd);
        details = start && end ? `${start} – ${end}` : start || "";
      } else {
        // Fall back to tenant bill
        const res = await API.get(
          API_CONFIG.ENDPOINTS.BILL_BY_PROPERTY_MONTH(
            this.selectedProperty,
            year,
            month,
          ),
        );
        if (!res.ok) {
          showToast(
            `No utility bill found for ${monthName} ${year}. Add one in Utility Bill Tracker first.`,
            "warning",
          );
          return;
        }
        const data = await res.json();
        if (!data.success || !data.bill) {
          showToast(
            `No utility bill found for ${monthName} ${year}. Add one in Utility Bill Tracker first.`,
            "warning",
          );
          return;
        }
        amount = data.bill.utilityFee ?? 0;
        details = data.bill.billingPeriod || "";
      }

      const itemTitle = details
        ? `⚡ Utility Bill — ${details}`
        : `⚡ Utility Bill — ${monthName} ${year}`;
      const prefilled = {
        item: itemTitle,
        amount,
        date: new Date(year, month - 1, 1).toISOString().split("T")[0],
        details: "",
        recipientAccountDetail: "",
        personInCharge: "",
        currency: "SGD",
      };
      await this.showIncomeExpenseModal("expense", prefilled, null);
    } catch (err) {
      console.error("fillUtilityBillExpense error:", err);
      showToast("Failed to fetch utility bill: " + err.message, "error");
    }
  }

  async showIncomeExpenseModal(type, existingItem = null, itemIndex = null) {
    // Prevent multiple modal creations
    if (this.isIncomeExpenseModalOpen) {
      return;
    }

    // Check if month is closed (only for new items, not edits)
    if (
      itemIndex === null &&
      this.currentReport &&
      this.currentReport.isClosed
    ) {
      this.showError("Cannot add items - this month has been closed");
      return;
    }

    // Check if there are required people for this property (investors for both income and expenses)
    if (type === "income" && (!this.investors || this.investors.length === 0)) {
      this.showError(
        "Please add investors to this property before adding income items.",
      );
      return;
    }

    if (
      type === "expense" &&
      (!this.investors || this.investors.length === 0)
    ) {
      this.showError(
        "Please add investors to this property before adding expense items.",
      );
      return;
    }

    this.isIncomeExpenseModalOpen = true;
    this.editingItem = existingItem;
    this.editingItemIndex = itemIndex;

    // Force cleanup any existing modals
    this.cleanupExistingModals();

    // Create modal HTML dynamically
    const modalHtml = this.createIncomeExpenseModalHtml(type, existingItem);

    // Add modal to page
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Wait a tick to ensure DOM is updated
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Show modal
    const modalElement = document.getElementById("incomeExpenseModal");

    if (!modalElement) {
      console.error("Modal element not found in DOM");
      this.isIncomeExpenseModalOpen = false;
      return;
    }

    const modal = new bootstrap.Modal(modalElement, {
      backdrop: true,
      keyboard: true,
      focus: false, // Disable Bootstrap's focus management
    });

    // Focus on first input after modal is shown
    modalElement.addEventListener("shown.bs.modal", () => {
      const firstInput = modalElement.querySelector('input[name="item"]');
      if (firstInput) {
        // Remove any disabled attributes and ensure inputs are interactive
        const allInputs = modalElement.querySelectorAll(
          "input, select, textarea",
        );
        allInputs.forEach((input) => {
          input.removeAttribute("disabled");
          input.removeAttribute("readonly");
          input.style.pointerEvents = "auto";
          input.tabIndex = 0;

          // Add explicit click handler to ensure focus works
          input.addEventListener("click", function (e) {
            e.stopPropagation();
            this.focus();
          });

          input.addEventListener("mousedown", function (e) {
            e.stopPropagation();
          });
        });

        // Multiple attempts to focus
        setTimeout(() => {
          firstInput.focus();
        }, 100);

        setTimeout(() => {
          firstInput.focus();
          firstInput.select();
        }, 300);
      }

      // Setup file upload handling
      this.setupFileUploadHandling();

      // Display existing bill evidence if editing
      if (
        existingItem &&
        existingItem.billEvidence &&
        existingItem.billEvidence.length > 0
      ) {
        this.displayExistingBillEvidence(existingItem.billEvidence);
      }

      // Setup currency and exchange rate handling for income
      if (type === "income") {
        const currencySelect = modalElement.querySelector("#currencySelect");
        const exchangeRateContainer = modalElement.querySelector(
          "#exchangeRateContainer",
        );
        const exchangeRateInput =
          modalElement.querySelector("#exchangeRateInput");

        // Show/hide exchange rate field based on currency selection
        if (currencySelect && exchangeRateContainer) {
          currencySelect.addEventListener("change", async () => {
            if (currencySelect.value === "VND") {
              exchangeRateContainer.style.display = "block";
              // Pre-fill rate from module if not already set
              if (exchangeRateInput && !exchangeRateInput.value) {
                const rate = await this.fetchExchangeRateForPeriod();
                if (rate)
                  exchangeRateInput.value =
                    Number(rate).toLocaleString("en-US");
              }
            } else {
              exchangeRateContainer.style.display = "none";
              if (exchangeRateInput) {
                exchangeRateInput.value = "";
              }
            }
          });
        }

        // Pre-fill exchange rate for new VND entries (not editing existing)
        if (
          exchangeRateInput &&
          currencySelect?.value === "VND" &&
          !exchangeRateInput.value
        ) {
          this.fetchExchangeRateForPeriod().then((rate) => {
            if (rate && exchangeRateInput && !exchangeRateInput.value) {
              exchangeRateInput.value = Number(rate).toLocaleString("en-US");
            }
          });
        }

        // Format exchange rate with thousand separator
        if (exchangeRateInput) {
          exchangeRateInput.addEventListener("input", (e) => {
            let value = e.target.value.replace(/,/g, "");
            if (!isNaN(value) && value !== "") {
              e.target.value = Number(value).toLocaleString("en-US");
            }
          });

          // Clean up formatting on blur to ensure valid number
          exchangeRateInput.addEventListener("blur", (e) => {
            let value = e.target.value.replace(/,/g, "");
            if (!isNaN(value) && value !== "") {
              e.target.value = Number(value).toLocaleString("en-US");
            }
          });
        }

        // Setup custom paid-by multi-select dropdown
        this.setupPaidByDropdown();
      }
    });

    // Clean up modal when hidden
    modalElement.addEventListener("hidden.bs.modal", () => {
      // Clear any loading states only if we didn't just successfully save
      if (this.editingItemIndex !== null && !this._modalClosedBySuccess) {
        this.setEditButtonLoading(type, this.editingItemIndex, false);
      }
      this._modalClosedBySuccess = false;

      this.isIncomeExpenseModalOpen = false;
      this.editingItem = null;
      this.editingItemIndex = null;
      // Reset uploaded bill evidence
      this.uploadedBillEvidence = [];
      modalElement.remove();

      // Force cleanup of backdrops after a short delay
      setTimeout(() => {
        this.forceCleanupModalBackdrops();
      }, 100);
    });

    modal.show();

    // Bind form submission for income/expense
    const form = document.getElementById("incomeExpenseForm");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();

        // Prevent multiple submissions
        if (form.dataset.submitting === "true") {
          return;
        }

        form.dataset.submitting = "true";
        this.saveIncomeExpenseItem(type, modal).finally(() => {
          form.dataset.submitting = "false";
        });
      });
    }
  }

  generateInvestorOptions(selectedValue = "") {
    if (!this.investors || this.investors.length === 0) {
      return '<option value="" disabled>No investors available for this property</option>';
    }

    return this.investors
      .map((investor) => {
        const isSelected =
          investor.investorId === selectedValue ? " selected" : "";
        return `<option value="${
          investor.investorId
        }"${isSelected}>${escapeHtml(investor.name)} (ID: ${
          investor.investorId
        })</option>`;
      })
      .join("");
  }

  generateTenantOptions(selectedValue = "") {
    if (!this.tenants || this.tenants.length === 0) {
      return '<option value="" disabled>No tenants available for this property</option>';
    }

    return this.tenants
      .map((tenant) => {
        const isSelected = tenant.tenantId === selectedValue ? " selected" : "";
        const baseName = tenant.name || "Unknown Tenant";
        const displayName = tenant.nickname
          ? `${baseName} (${tenant.nickname})`
          : baseName;
        return `<option value="${tenant.tenantId}"${isSelected}>${escapeHtml(
          displayName,
        )}</option>`;
      })
      .join("");
  }

  generatePaidByOptions(selectedValues = []) {
    const vals = Array.isArray(selectedValues)
      ? selectedValues
      : selectedValues
        ? [selectedValues]
        : [];
    let options = "";

    // Add investor options if available
    if (this.investors && this.investors.length > 0) {
      options += '<optgroup label="Investors">';
      options += this.investors
        .map((investor) => {
          const isSelected = vals.includes(investor.investorId)
            ? " selected"
            : "";
          return `<option value="${investor.investorId}"${isSelected}>${escapeHtml(investor.name)} (ID: ${investor.investorId})</option>`;
        })
        .join("");
      options += "</optgroup>";
    }

    // Add tenant options split into active and outdated (moved out > 1 month)
    if (this.tenants && this.tenants.length > 0) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const activeOptions = [];
      const outdatedOptions = [];

      this.tenants.forEach((tenant) => {
        const tenantValue = `tenant_${tenant._id || tenant.tenantId || tenant.id || tenant.fin}`;
        const isSelected = vals.includes(tenantValue) ? " selected" : "";
        const baseName = tenant.name || "Unknown Tenant";
        const displayName = tenant.nickname
          ? `${baseName} (${tenant.nickname})`
          : baseName;

        const additionalInfo = [];
        if (tenant.roomType)
          additionalInfo.push(this.getRoomTypeDisplayName(tenant.roomType));
        if (tenant.monthlyRent) additionalInfo.push(`$${tenant.monthlyRent}`);
        const infoString =
          additionalInfo.length > 0 ? ` - ${additionalInfo.join(", ")}` : "";

        const propertyRecord = tenant.properties?.find(
          (p) => p.propertyId === this.selectedProperty,
        );
        const moveoutDate = propertyRecord?.moveoutDate
          ? new Date(propertyRecord.moveoutDate)
          : null;
        const isOutdated = moveoutDate && moveoutDate < oneMonthAgo;

        if (isOutdated) {
          outdatedOptions.push(
            `<option value="${tenantValue}"${isSelected} style="color:#999;font-style:italic;">${escapeHtml(displayName)}${infoString} ↩ moved out</option>`,
          );
        } else {
          activeOptions.push(
            `<option value="${tenantValue}"${isSelected}>${escapeHtml(displayName)}${infoString}</option>`,
          );
        }
      });

      if (activeOptions.length > 0) {
        options += '<optgroup label="Tenants">';
        options += activeOptions.join("");
        options += "</optgroup>";
      }

      if (outdatedOptions.length > 0) {
        options += '<optgroup label="Tenants — Moved Out (Outdated)">';
        options += outdatedOptions.join("");
        options += "</optgroup>";
      }
    }

    if (!options) {
      return '<option value="" disabled>No investors or tenants available for this property</option>';
    }

    return options;
  }

  generatePaidByDropdownItems(selectedValues = []) {
    const vals = Array.isArray(selectedValues)
      ? selectedValues
      : selectedValues
        ? [selectedValues]
        : [];

    const makeMiniAvatar = (name, avatarUrl, bgClass = "bg-info") => {
      const initial = escapeHtml((name || "?").charAt(0).toUpperCase());
      if (avatarUrl) {
        return `<img src="${this.getOptimizedAvatarUrl(avatarUrl, "small")}" class="rounded-circle flex-shrink-0" style="width:26px;height:26px;object-fit:cover;" alt="${escapeHtml(name)}">`;
      }
      return `<div class="rounded-circle ${bgClass} d-flex align-items-center justify-content-center text-white flex-shrink-0" style="width:26px;height:26px;font-size:11px;font-weight:600;">${initial}</div>`;
    };

    let html = "";

    if (this.investors && this.investors.length > 0) {
      html += `<div class="px-3 pt-2 pb-1 text-uppercase text-muted fw-semibold" style="font-size:0.65rem;letter-spacing:0.06em;">Investors</div>`;
      this.investors.forEach((investor) => {
        const isChecked = vals.includes(investor.investorId) ? " checked" : "";
        const mini = makeMiniAvatar(
          investor.name,
          investor.avatar,
          "bg-secondary",
        );
        html += `<label class="d-flex align-items-center gap-2 px-3 py-2 paid-by-item" style="cursor:pointer;" data-value="${investor.investorId}">
          <input type="checkbox" class="form-check-input m-0 flex-shrink-0" value="${investor.investorId}"${isChecked}>
          ${mini}
          <span class="small flex-grow-1">${escapeHtml(investor.name)} <span class="text-muted" style="font-size:0.8em;">(ID: ${investor.investorId})</span></span>
        </label>`;
      });
    }

    if (this.tenants && this.tenants.length > 0) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const activeItems = [];
      const outdatedItems = [];

      this.tenants.forEach((tenant) => {
        const tenantValue = `tenant_${tenant._id || tenant.tenantId || tenant.id || tenant.fin}`;
        const isChecked = vals.includes(tenantValue) ? " checked" : "";
        const baseName = tenant.name || "Unknown Tenant";
        const displayName = tenant.nickname
          ? `${baseName} (${tenant.nickname})`
          : baseName;
        const mini = makeMiniAvatar(displayName, tenant.avatar, "bg-info");

        const additionalInfo = [];
        if (tenant.roomType)
          additionalInfo.push(this.getRoomTypeDisplayName(tenant.roomType));
        if (tenant.monthlyRent) additionalInfo.push(`$${tenant.monthlyRent}`);
        const infoStr = additionalInfo.length
          ? `<span class="text-muted ms-1" style="font-size:0.8em;">${additionalInfo.join(" · ")}</span>`
          : "";

        const propertyRecord = tenant.properties?.find(
          (p) => p.propertyId === this.selectedProperty,
        );
        const moveoutDate = propertyRecord?.moveoutDate
          ? new Date(propertyRecord.moveoutDate)
          : null;
        const isOutdated = moveoutDate && moveoutDate < oneMonthAgo;

        if (isOutdated) {
          const movedOutStr = moveoutDate.toLocaleDateString("en-GB", {
            month: "short",
            year: "2-digit",
          });
          outdatedItems.push(`<label class="d-flex align-items-center gap-2 px-3 py-2 paid-by-item paid-by-outdated" style="cursor:pointer;opacity:0.6;" data-value="${tenantValue}">
            <input type="checkbox" class="form-check-input m-0 flex-shrink-0" value="${tenantValue}"${isChecked}>
            ${mini}
            <span class="small flex-grow-1 fst-italic text-muted">${escapeHtml(displayName)}${infoStr} <span class="badge bg-secondary ms-1" style="font-size:0.6rem;">↩ out ${escapeHtml(movedOutStr)}</span></span>
          </label>`);
        } else {
          activeItems.push(`<label class="d-flex align-items-center gap-2 px-3 py-2 paid-by-item" style="cursor:pointer;" data-value="${tenantValue}">
            <input type="checkbox" class="form-check-input m-0 flex-shrink-0" value="${tenantValue}"${isChecked}>
            ${mini}
            <span class="small flex-grow-1">${escapeHtml(displayName)}${infoStr}</span>
          </label>`);
        }
      });

      if (activeItems.length > 0) {
        html += `<div class="border-top mx-2 my-1"></div><div class="px-3 pt-1 pb-1 text-uppercase text-muted fw-semibold" style="font-size:0.65rem;letter-spacing:0.06em;">Tenants</div>`;
        html += activeItems.join("");
      }
      if (outdatedItems.length > 0) {
        html += `<div class="border-top mx-2 my-1"></div><div class="px-3 pt-1 pb-1 text-uppercase text-muted fw-semibold" style="font-size:0.65rem;letter-spacing:0.06em;">Moved Out</div>`;
        html += outdatedItems.join("");
      }
    }

    return (
      html ||
      `<div class="px-3 py-2 text-muted small">No investors or tenants available</div>`
    );
  }

  setupPaidByDropdown() {
    const toggleBtn = document.getElementById("paidByToggleBtn");
    const panel = document.getElementById("paidByPanel");
    const hiddenSelect = document.getElementById("paidByHiddenSelect");
    const btnLabel = document.getElementById("paidByBtnLabel");
    const pillsContainer = document.getElementById("paidBySelectedPills");
    const wrapper = document.getElementById("paidByDropdownWrapper");

    if (!toggleBtn || !panel || !hiddenSelect || !wrapper) return;

    const updateState = () => {
      const checkedBoxes = panel.querySelectorAll(
        'input[type="checkbox"]:checked',
      );
      const values = Array.from(checkedBoxes).map((cb) => cb.value);

      Array.from(hiddenSelect.options).forEach((opt) => {
        opt.selected = values.includes(opt.value);
      });

      if (values.length === 0) {
        btnLabel.innerHTML = `<span class="text-muted">Select who paid (optional)...</span>`;
      } else {
        const getFirstName = (v) => {
          const info = this._resolvePaidByPerson(v);
          return info
            ? info.displayName.split(" ").slice(0, 2).join(" ")
            : "Unknown";
        };
        const first = escapeHtml(getFirstName(values[0]));
        btnLabel.innerHTML =
          values.length === 1
            ? first
            : `${first} <span class="badge bg-primary ms-1">+${values.length - 1}</span>`;
      }

      if (pillsContainer) {
        pillsContainer.innerHTML = values
          .map((v) => {
            const info = this._resolvePaidByPerson(v);
            const name = info ? info.displayName : "Unknown";
            const initial = name.charAt(0).toUpperCase();
            const avatarEl = info?.avatar
              ? `<img src="${this.getOptimizedAvatarUrl(info.avatar, "small")}" class="rounded-circle" style="width:16px;height:16px;object-fit:cover;" alt="">`
              : `<span class="rounded-circle bg-info d-inline-flex align-items-center justify-content-center text-white" style="width:16px;height:16px;font-size:8px;">${escapeHtml(initial)}</span>`;
            return `<span class="badge d-inline-flex align-items-center gap-1" style="background:#e9ecef;color:#495057;font-weight:500;padding:4px 8px;border-radius:20px;font-size:0.78rem;">${avatarEl}${escapeHtml(name.split(" ")[0])}</span>`;
          })
          .join("");
      }
    };

    panel.addEventListener("mouseover", (e) => {
      const item = e.target.closest(".paid-by-item");
      if (item) item.style.backgroundColor = "#f8f9fa";
    });
    panel.addEventListener("mouseout", (e) => {
      const item = e.target.closest(".paid-by-item");
      if (item) item.style.backgroundColor = "";
    });

    panel.addEventListener("change", (e) => {
      if (e.target.type === "checkbox") updateState();
    });

    wrapper.addEventListener("show.bs.dropdown", () => {
      const chevron = toggleBtn.querySelector(".bi");
      if (chevron) {
        chevron.classList.remove("bi-chevron-down");
        chevron.classList.add("bi-chevron-up");
      }
    });
    wrapper.addEventListener("hide.bs.dropdown", () => {
      const chevron = toggleBtn.querySelector(".bi");
      if (chevron) {
        chevron.classList.remove("bi-chevron-up");
        chevron.classList.add("bi-chevron-down");
      }
    });

    updateState();
  }

  // Like generatePaidByOptions but uses ALL investors in the app (not just property investors)
  generatePaidToOptions(selectedValue = "") {
    let options = "";

    // All investors in the app
    if (this.allInvestors && this.allInvestors.length > 0) {
      options += '<optgroup label="Investors">';
      options += this.allInvestors
        .map((investor) => {
          const isSelected =
            investor.investorId === selectedValue ? " selected" : "";
          return `<option value="${investor.investorId}"${isSelected}>${escapeHtml(investor.name)} (ID: ${investor.investorId})</option>`;
        })
        .join("");
      options += "</optgroup>";
    }

    // Tenants for the selected property
    if (this.tenants && this.tenants.length > 0) {
      options += '<optgroup label="Tenants">';
      options += this.tenants
        .map((tenant) => {
          const tenantValue = `tenant_${tenant._id || tenant.tenantId || tenant.id || tenant.fin}`;
          const isSelected = tenantValue === selectedValue ? " selected" : "";
          const baseName = tenant.name || "Unknown Tenant";
          const displayName = tenant.nickname
            ? `${baseName} (${tenant.nickname})`
            : baseName;
          const additionalInfo = [];
          if (tenant.roomType)
            additionalInfo.push(this.getRoomTypeDisplayName(tenant.roomType));
          if (tenant.monthlyRent) additionalInfo.push(`$${tenant.monthlyRent}`);
          const infoString =
            additionalInfo.length > 0 ? ` - ${additionalInfo.join(", ")}` : "";
          return `<option value="${tenantValue}"${isSelected}>${escapeHtml(displayName)}${infoString}</option>`;
        })
        .join("");
      options += "</optgroup>";
    }

    return options;
  }

  _resolvePaidByPerson(paidByValue) {
    if (!paidByValue) return null;
    let person = null;
    let displayName = "";
    let avatar = null;
    let roomType = null;
    let contactUrl = null;

    if (paidByValue.startsWith("tenant_")) {
      const tenantId = paidByValue.replace("tenant_", "");
      person = this.tenants.find(
        (t) =>
          (t._id && t._id === tenantId) ||
          (t.tenantId && t.tenantId === tenantId) ||
          (t.id && t.id === tenantId) ||
          (t.fin && t.fin === tenantId),
      );
      if (person) {
        displayName = person.name || "Unknown Tenant";
        avatar = person.avatar;
        if (person.properties && this.selectedProperty) {
          const assoc = person.properties.find(
            (p) => p.propertyId === this.selectedProperty,
          );
          if (assoc?.room) roomType = assoc.room;
        }
        const phone = (person.phoneNumber || "").replace(/[^0-9]/g, "");
        if (person.facebookUrl) {
          contactUrl = person.facebookUrl;
        } else if (phone) {
          contactUrl = `https://wa.me/${phone}`;
        }
      }
    } else {
      person =
        this.investors.find((i) => i.investorId === paidByValue) ||
        (this.allInvestors &&
          this.allInvestors.find((i) => i.investorId === paidByValue));
      if (person) {
        displayName = person.name || "Unknown Investor";
        avatar = person.avatar;
      }
    }

    if (!person) return null;
    return { displayName, avatar, roomType, contactUrl };
  }

  _renderAvatarCircle(info, size = 32) {
    if (!info) {
      return `<div class="rounded-circle bg-warning bg-opacity-25 border border-warning d-flex align-items-center justify-content-center text-warning" style="width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.5)}px;" data-bs-toggle="tooltip" data-bs-title="Unknown payer"><i class="bi bi-person-question"></i></div>`;
    }
    const { displayName, avatar, contactUrl } = info;
    const linkAttrs = contactUrl
      ? `href="${escapeHtml(contactUrl)}" target="_blank" rel="noopener noreferrer" style="cursor:pointer;" title="Message ${escapeHtml(displayName)}"`
      : "";
    const wrap = (inner) =>
      contactUrl ? `<a ${linkAttrs}>${inner}</a>` : inner;

    if (avatar) {
      return wrap(
        `<img src="${this.getOptimizedAvatarUrl(avatar, "small")}" alt="${escapeHtml(displayName)}" class="rounded-circle border border-2 border-white" style="width: ${size}px; height: ${size}px; object-fit: cover;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(displayName)}">`,
      );
    }
    return wrap(
      `<div class="rounded-circle bg-info border border-2 border-white d-flex align-items-center justify-content-center text-white fw-bold" style="width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.44)}px;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(displayName)}">${escapeHtml(displayName.charAt(0).toUpperCase())}</div>`,
    );
  }

  renderPaidByAvatar(paidBy) {
    const paidByArray = !paidBy
      ? []
      : Array.isArray(paidBy)
        ? paidBy.filter((v) => v)
        : [paidBy];

    if (paidByArray.length === 0) {
      return `<div class="d-flex align-items-center justify-content-center">
        <div class="rounded-circle bg-light border d-flex align-items-center justify-content-center text-muted" style="width: 32px; height: 32px; font-size: 16px;" data-bs-toggle="tooltip" data-bs-title="No payer specified">
          <i class="bi bi-person"></i>
        </div>
      </div>`;
    }

    const persons = paidByArray.map((pb) => this._resolvePaidByPerson(pb));

    if (persons.length === 1) {
      const info = persons[0];
      if (!info) {
        return `<div class="d-flex align-items-center justify-content-center">
          <div class="rounded-circle bg-warning bg-opacity-25 border border-warning d-flex align-items-center justify-content-center text-warning" style="width: 32px; height: 32px; font-size: 16px;" data-bs-toggle="tooltip" data-bs-title="Unknown payer">
            <i class="bi bi-person-question"></i>
          </div>
        </div>`;
      }
      return `
        <div class="d-flex flex-column align-items-center justify-content-center">
          <div class="d-flex align-items-center justify-content-center mb-1">
            ${this._renderAvatarCircle(info)}
          </div>
          ${info.roomType ? `<div class="badge bg-secondary" style="font-size: 0.65rem; padding: 2px 6px;">${escapeHtml(this.getRoomTypeDisplayName(info.roomType))}</div>` : ""}
        </div>
      `;
    }

    // Multiple payers: overlapping avatars
    const tooltipText = persons
      .map((p) => (p ? p.displayName : "Unknown"))
      .join(", ");
    const avatarCircles = persons
      .map((info, i) => {
        const ml = i > 0 ? "margin-left: -10px;" : "";
        const zIndex = `z-index: ${persons.length - i};`;
        return `<div style="position: relative; ${zIndex} ${ml}">${this._renderAvatarCircle(info)}</div>`;
      })
      .join("");

    return `<div class="d-flex align-items-center justify-content-center" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(tooltipText)}">${avatarCircles}</div>`;
  }

  // Compact inline version for mobile cards — avatars only, room type in tooltip only
  _renderPaidByAvatarInline(paidBy, size = 26) {
    const paidByArray = !paidBy
      ? []
      : Array.isArray(paidBy)
        ? paidBy.filter((v) => v)
        : [paidBy];

    if (paidByArray.length === 0) return "";

    const persons = paidByArray.map((pb) => this._resolvePaidByPerson(pb));
    const tooltipParts = persons.map((p) => {
      if (!p) return "Unknown";
      return p.roomType
        ? `${p.displayName} (${this.getRoomTypeDisplayName(p.roomType)})`
        : p.displayName;
    });
    const tooltipText = tooltipParts.join(", ");

    const circles = persons
      .map((info, i) => {
        const ml = i > 0 ? `margin-left:-${Math.round(size * 0.3)}px;` : "";
        return `<div style="position:relative;z-index:${persons.length - i};${ml}">${this._renderAvatarCircle(info, size)}</div>`;
      })
      .join("");

    return `<div class="d-flex align-items-center" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(tooltipText)}">${circles}</div>`;
  }

  renderCurrencyFlag(currency) {
    // Default to SGD if currency is not specified
    const curr = currency || "SGD";

    if (curr === "VND") {
      return '<span style="font-size: 1.2rem;" title="Vietnamese Dong">🇻🇳</span>';
    } else {
      return '<span style="font-size: 1.2rem;" title="Singapore Dollar">🇸🇬</span>';
    }
  }

  renderPaidByName(paidBy) {
    const paidByArray = !paidBy
      ? []
      : Array.isArray(paidBy)
        ? paidBy.filter((v) => v)
        : [paidBy];

    if (paidByArray.length === 0) return "-";

    const names = paidByArray.map((pb) => {
      const info = this._resolvePaidByPerson(pb);
      if (!info) return "Unknown";
      if (info.roomType) {
        return `${escapeHtml(info.displayName)}\n(${escapeHtml(this.getRoomTypeDisplayName(info.roomType))})`;
      }
      return escapeHtml(info.displayName);
    });

    return names.join(", ");
  }

  createIncomeExpenseModalHtml(type, existingItem = null) {
    const isIncome = type === "income";
    const isEditing = existingItem !== null && this.editingItemIndex !== null;
    const title = isEditing
      ? isIncome
        ? "Edit Income Item"
        : "Edit Expense Item"
      : isIncome
        ? "Add Income Item"
        : "Add Expense Item";
    const icon = isIncome ? "plus-circle" : "dash-circle";
    const editIcon = "pencil";
    const color = isIncome ? "success" : "danger";
    const buttonText = isEditing ? "Update" : "Add";
    const buttonIcon = isEditing ? editIcon : icon;

    const itemValue = existingItem ? escapeHtml(existingItem.item) : "";
    const amountValue = existingItem ? existingItem.amount : "";
    const personInChargeValue = existingItem ? existingItem.personInCharge : "";
    const accountDetailValue = existingItem
      ? escapeHtml(existingItem.recipientAccountDetail || "")
      : "";
    const paidByValues = existingItem
      ? Array.isArray(existingItem.paidBy)
        ? existingItem.paidBy
        : existingItem.paidBy
          ? [existingItem.paidBy]
          : []
      : [];
    const paidToValue = existingItem ? existingItem.paidTo || "" : "";
    const detailsValue = existingItem
      ? escapeHtml(existingItem.details || "")
      : "";
    const dateValue =
      existingItem && existingItem.date
        ? new Date(existingItem.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]; // Default to today
    const currencyValue = existingItem ? existingItem.currency || "SGD" : "SGD";
    const exchangeRateValue =
      existingItem && existingItem.exchangeRate
        ? existingItem.exchangeRate.toLocaleString("en-US")
        : "";
    const isPendingValue = existingItem
      ? existingItem.isPending || false
      : false;

    return `
            <div class="modal fade" id="incomeExpenseModal" tabindex="-1" aria-labelledby="incomeExpenseModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="incomeExpenseModalLabel">
                                <i class="bi bi-${
                                  isEditing ? editIcon : icon
                                } me-2"></i>${title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="incomeExpenseForm">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Item Description <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" name="item" required placeholder="e.g., Rent, Utilities, Repairs" autocomplete="off" value="${itemValue}">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Amount (SGD) <span class="text-danger">*</span></label>
                                    <div class="input-group">
                                        <span class="input-group-text">$</span>
                                        <input type="number" class="form-control" name="amount" required min="0" step="0.01" placeholder="0.00" autocomplete="off" value="${amountValue}">
                                    </div>
                                </div>
                                ${
                                  isIncome
                                    ? `
                                <div class="mb-3">
                                    <label class="form-label">Currency <span class="text-danger">*</span></label>
                                    <select class="form-select" name="currency" id="currencySelect" required>
                                        <option value="SGD" ${currencyValue === "SGD" ? "selected" : ""}>\ud83c\uddf8\ud83c\uddec SGD - Singapore Dollar</option>
                                        <option value="VND" ${currencyValue === "VND" ? "selected" : ""}>\ud83c\uddfb\ud83c\uddf3 VND - Vietnamese Dong</option>
                                    </select>
                                    <div class="form-text">Select the currency for this income</div>
                                </div>
                                <div class="mb-3" id="exchangeRateContainer" style="display: ${currencyValue === "VND" ? "block" : "none"};">
                                    <label class="form-label">Exchange Rate</label>
                                    <input type="text" class="form-control" name="exchangeRate" id="exchangeRateInput" placeholder="e.g., 20,800" autocomplete="off" value="${exchangeRateValue}">
                                    <div class="form-text">Enter the exchange rate (e.g., 20800 VND = 1 SGD)</div>
                                </div>
                                `
                                    : ""
                                }
                                <div class="mb-3">
                                    <label class="form-label">Date <span class="text-danger">*</span></label>
                                    <input type="date" class="form-control" name="date" required value="${dateValue}">
                                    <div class="form-text">Date when this ${type} occurred</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Person in Charge <span class="text-danger">*</span></label>
                                    <select class="form-select" name="personInCharge" required>
                                        <option value="">Select investor...</option>
                                        ${this.generateInvestorOptions(
                                          personInChargeValue,
                                        )}
                                    </select>
                                    <div class="form-text">Select the ${
                                      isIncome
                                        ? "investor responsible for collecting this income"
                                        : "investor responsible for this expense"
                                    }</div>
                                </div>
                                ${
                                  isIncome
                                    ? `
                                <div class="mb-3">
                                    <label class="form-label">Paid By</label>
                                    <div class="dropdown" id="paidByDropdownWrapper">
                                        <button type="button"
                                                class="btn btn-outline-secondary w-100 text-start d-flex align-items-center justify-content-between"
                                                data-bs-toggle="dropdown"
                                                data-bs-auto-close="outside"
                                                aria-expanded="false"
                                                id="paidByToggleBtn">
                                            <span id="paidByBtnLabel" class="text-muted">Select who paid (optional)...</span>
                                            <i class="bi bi-chevron-down small ms-1"></i>
                                        </button>
                                        <div class="dropdown-menu w-100 p-0 shadow-sm" style="max-height:260px;overflow-y:auto;" id="paidByPanel">
                                            ${this.generatePaidByDropdownItems(paidByValues)}
                                        </div>
                                    </div>
                                    <select name="paidBy" multiple id="paidByHiddenSelect" style="display:none;">
                                        ${this.generatePaidByOptions(paidByValues)}
                                    </select>
                                    <div id="paidBySelectedPills" class="mt-2 d-flex flex-wrap gap-1"></div>
                                    <div class="form-text">Select one or multiple payers. Outdated tenants (moved out &gt;1 month) appear dimmed at the bottom.</div>
                                </div>
                                `
                                    : `
                                <div class="mb-3">
                                    <label class="form-label">Paid To</label>
                                    <select class="form-select" name="paidTo">
                                        <option value="">Select recipient (optional)...</option>
                                        <option value="unknown" ${paidToValue === "unknown" ? "selected" : ""}>&#128100; Unknown</option>
                                        ${this.generatePaidToOptions(paidToValue)}
                                    </select>
                                    <div class="form-text">Optional: Select who this expense was paid to</div>
                                </div>
                                `
                                }
                                <div class="mb-3">
                                    <label class="form-label">Account Details</label>
                                    <input type="text" class="form-control" name="recipientAccountDetail" placeholder="Bank or payment details (optional)" autocomplete="off" value="${accountDetailValue}">
                                    <div class="form-text">Optional: Add bank account or payment method details</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Details</label>
                                    <textarea class="form-control" name="details" rows="3" placeholder="Additional details about this ${type} (optional)" maxlength="500">${detailsValue}</textarea>
                                    <div class="form-text">Optional: Add any additional details or notes (max 500 characters)</div>
                                </div>
                                <div class="mb-3 p-3 rounded" style="background:${isPendingValue ? "#fffde7" : "#f8f9fa"};border:1px solid ${isPendingValue ? "#f59e0b" : "#dee2e6"};" id="pendingCheckboxWrapper">
                                    <div class="form-check mb-0">
                                        <input type="checkbox" class="form-check-input" name="isPending" id="isPendingCheck" ${isPendingValue ? "checked" : ""}
                                            onchange="(function(cb){var w=document.getElementById('pendingCheckboxWrapper');w.style.background=cb.checked?'#fffde7':'#f8f9fa';w.style.borderColor=cb.checked?'#f59e0b':'#dee2e6';})(this)">
                                        <label class="form-check-label" for="isPendingCheck">
                                            <span class="fw-semibold"><i class="bi bi-hourglass-split me-1" style="color:#f59e0b;"></i>Mark as Pending</span>
                                            <div class="small text-muted mt-1">Tenant hasn't paid / bill not yet settled — item is visible for tracking but <strong>excluded from this month's totals</strong>. Untick when payment is received.</div>
                                        </label>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Bill Evidence</label>
                                    <input type="file" class="form-control" id="billEvidenceFiles" multiple accept="image/*,.pdf" style="display: none;">
                                    <div class="d-grid gap-2">
                                        <button type="button" class="btn btn-outline-secondary" onclick="document.getElementById('billEvidenceFiles').click()">
                                            <i class="bi bi-cloud-upload"></i> Upload Files (Optional)
                                        </button>
                                    </div>
                                    <div class="form-text">Optional: Upload receipts, bills, or other evidence (images or PDFs, max 10 files)</div>
                                    <div id="billEvidencePreview" class="mt-2"></div>
                                    <div id="existingBillEvidence" class="mt-2"></div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-${color}">
                                    <i class="bi bi-${buttonIcon} me-1"></i>${buttonText} ${
                                      isIncome ? "Income" : "Expense"
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
  }

  async saveIncomeExpenseItem(type, modal) {
    const form = document.getElementById("incomeExpenseForm");
    const formData = new FormData(form);

    const itemData = {
      item: formData.get("item"),
      amount: parseFloat(formData.get("amount")),
      date: formData.get("date"),
      personInCharge: formData.get("personInCharge"),
      recipientAccountDetail: formData.get("recipientAccountDetail"),
      details: formData.get("details") || "",
      isPending: formData.get("isPending") === "on",
    };

    // Add paidBy, currency, exchange rate only for income transactions
    if (type === "income") {
      const paidByValues = formData.getAll("paidBy").filter((v) => v);
      itemData.paidBy = paidByValues;

      // Add currency and exchange rate
      const currency = formData.get("currency");
      if (currency) {
        itemData.currency = currency;
      }

      const exchangeRate = formData.get("exchangeRate");
      if (exchangeRate) {
        // Remove commas and convert to number
        const cleanedRate = exchangeRate.replace(/,/g, "");
        if (!isNaN(cleanedRate) && cleanedRate !== "") {
          itemData.exchangeRate = parseFloat(cleanedRate);
        }
      }
    }

    // Add paidTo field only for expense transactions
    if (type === "expense") {
      const paidTo = formData.get("paidTo");
      if (paidTo) {
        itemData.paidTo = paidTo;
      }
    }

    // Add uploaded bill evidence URLs
    if (this.uploadedBillEvidence && this.uploadedBillEvidence.length > 0) {
      itemData.billEvidence = this.uploadedBillEvidence;
    } else if (this.editingItem && this.editingItem.billEvidence) {
      // Keep existing evidence if no new files uploaded
      itemData.billEvidence = this.editingItem.billEvidence;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;
      const isEditing =
        this.editingItem !== null && this.editingItemIndex !== null;

      let endpoint;
      let httpMethod;

      if (isEditing) {
        // For editing, we need to include the item index in the endpoint
        endpoint =
          (type === "income"
            ? API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_INCOME(
                this.selectedProperty,
                year,
                month,
              )
            : API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_EXPENSES(
                this.selectedProperty,
                year,
                month,
              )) + `/${this.editingItemIndex}`;
        httpMethod = "PUT";
      } else {
        // For adding new items
        endpoint =
          type === "income"
            ? API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_INCOME(
                this.selectedProperty,
                year,
                month,
              )
            : API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_EXPENSES(
                this.selectedProperty,
                year,
                month,
              );
        httpMethod = "POST";
      }

      const response =
        httpMethod === "PUT"
          ? await API.put(endpoint, itemData)
          : await API.post(endpoint, itemData);

      const result = await response.json();

      if (result.success) {
        // Mark that modal is being closed due to success
        this._modalClosedBySuccess = true;

        // Force close modal and cleanup
        this.isIncomeExpenseModalOpen = false;
        this.editingItem = null;
        this.editingItemIndex = null;
        modal.hide();

        // Use a more aggressive cleanup approach
        setTimeout(() => {
          this.forceCleanupModalBackdrops();
        }, 150);

        await this.loadFinancialReport();
        // Force a display refresh to ensure indices are correct
        await this.updateDisplays();
        this.showSuccess(
          `${type.charAt(0).toUpperCase() + type.slice(1)} item ${
            isEditing ? "updated" : "added"
          } successfully`,
        );
      } else {
        throw new Error(
          result.message ||
            `Failed to ${isEditing ? "update" : "add"} ${type} item`,
        );
      }
    } catch (error) {
      console.error(`Error saving ${type} item:`, error);
      this.showError(
        error.message ||
          `Failed to ${isEditing ? "update" : "add"} ${type} item`,
      );
    } finally {
      // Hide loading state when done (whether success or error)
      if (this.editingItemIndex !== null) {
        this.setEditButtonLoading(type, this.editingItemIndex, false);
      }
    }
  }

  async showInvestorModal(investorId = null) {
    // Prevent multiple modal creations
    if (this.isModalOpen) {
      return;
    }

    this.isModalOpen = true;

    // Force cleanup any existing modals (including Bootstrap instances)
    this.cleanupExistingModals();

    // Create investor modal HTML dynamically
    const modalHtml = this.createInvestorModalHtml(investorId);

    // Add modal to page
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Wait a tick to ensure DOM is updated
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Show modal
    const modalElement = document.getElementById("investorModal");

    if (!modalElement) {
      console.error("Investor modal element not found in DOM");
      this.isModalOpen = false;
      return;
    }

    const modal = new bootstrap.Modal(modalElement, {
      backdrop: true,
      keyboard: true,
      focus: false,
    });

    // Focus on first input after modal is shown
    modalElement.addEventListener("shown.bs.modal", () => {
      console.log("Investor modal shown event triggered");
      console.log("investorId passed to modal:", investorId);

      // Pre-fill form if editing existing investor (do this after modal is shown)
      if (investorId) {
        console.log("About to fill investor form...");
        // Add a small delay to ensure DOM is fully ready
        setTimeout(() => {
          this.fillInvestorForm(investorId);
        }, 50);
      }

      const firstInput = modalElement.querySelector('input[name="username"]');

      if (firstInput) {
        // Test if input is focusable and typable immediately
        setTimeout(() => {
          firstInput.focus();
        }, 100);
      }
    });

    // Clean up modal when hidden
    modalElement.addEventListener("hidden.bs.modal", () => {
      this.isModalOpen = false;
      modalElement.remove();

      // Force cleanup of backdrops after a short delay
      setTimeout(() => {
        this.forceCleanupModalBackdrops();
      }, 100);
    });

    modal.show();

    // Bind form submission
    const form = document.getElementById("investorForm");

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      // Prevent multiple submissions
      if (form.dataset.submitting === "true") {
        return;
      }

      form.dataset.submitting = "true";
      this.saveInvestor(investorId, modal).finally(() => {
        form.dataset.submitting = "false";
      });
    });
  }

  cleanupExistingModals() {
    // Find all modals with our IDs
    const modalIds = ["investorModal", "incomeExpenseModal"];

    modalIds.forEach((modalId) => {
      const existingModal = document.getElementById(modalId);
      if (existingModal) {
        // Try to hide the modal first if it has a Bootstrap instance
        try {
          const bootstrapModal = bootstrap.Modal.getInstance(existingModal);
          if (bootstrapModal) {
            bootstrapModal.hide();
            bootstrapModal.dispose();
          }
        } catch (e) {}

        // Remove the element
        existingModal.remove();
      }
    });

    // Force cleanup of all modal-related elements
    this.forceCleanupModalBackdrops();
  }

  forceCleanupModalBackdrops() {
    // Clear any backdrop elements that might be left behind
    const backdrops = document.querySelectorAll(".modal-backdrop");
    backdrops.forEach((backdrop) => {
      backdrop.remove();
    });

    // Also check for any Bootstrap modal classes and elements
    const modalElements = document.querySelectorAll(".modal");
    modalElements.forEach((modal) => {
      if (modal.id === "investorModal" || modal.id === "incomeExpenseModal") {
        modal.remove();
      }
    });

    // Reset body classes and styles that Bootstrap might have added
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
    document.body.style.removeProperty("margin-right");

    // Force reflow to ensure changes take effect
    document.body.offsetHeight;
  }

  createInvestorModalHtml(investorId) {
    const isEdit = !!investorId;
    const title = isEdit ? "Edit Investor" : "Add Investor";

    return `
            <div class="modal fade" id="investorModal" tabindex="-1" aria-labelledby="investorModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="investorModalLabel">
                                <i class="bi bi-person-plus me-2"></i>${title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="investorForm">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Username <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" name="username" required placeholder="Enter unique username" autocomplete="off">
                                    <div class="form-text">Unique username for this investor (e.g., john_smith, investor1)</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Investor Name <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" name="name" required placeholder="Enter full name" autocomplete="off">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Percentage Share <span class="text-danger">*</span></label>
                                    <div class="input-group">
                                        <input type="number" class="form-control" name="percentage" required min="0" max="100" step="0.1" placeholder="0.0" autocomplete="off">
                                        <span class="input-group-text">%</span>
                                    </div>
                                    <div class="form-text">Enter percentage share (0-100%)</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Phone Number (Optional)</label>
                                    <input type="tel" class="form-control" name="phone" placeholder="Enter phone number" autocomplete="off">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Email (Optional)</label>
                                    <input type="email" class="form-control" name="email" placeholder="Enter email address" autocomplete="off">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-check-circle me-1"></i>${
                                      isEdit ? "Update" : "Add"
                                    } Investor
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
  }

  fillInvestorForm(investorId) {
    console.log("fillInvestorForm called with investorId:", investorId);
    console.log("Available investors:", this.investors);
    console.log("Selected property:", this.selectedProperty);

    const investor = this.investors.find(
      (inv) => inv.investorId === investorId,
    );

    console.log("Found investor:", investor);

    if (investor) {
      const form = document.getElementById("investorForm");
      console.log("Form element found:", !!form);

      if (!form) {
        console.error("Investor form not found in DOM");
        return;
      }

      const usernameInput = form.querySelector('input[name="username"]');
      const nameInput = form.querySelector('input[name="name"]');
      const phoneInput = form.querySelector('input[name="phone"]');
      const emailInput = form.querySelector('input[name="email"]');
      const percentageInput = form.querySelector('input[name="percentage"]');

      console.log("Input elements found:", {
        username: !!usernameInput,
        name: !!nameInput,
        phone: !!phoneInput,
        email: !!emailInput,
        percentage: !!percentageInput,
      });

      if (usernameInput) {
        usernameInput.value = investor.username || "";
        console.log("Set username:", investor.username);
        // Trigger change event to ensure any validation or listeners are notified
        usernameInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (nameInput) {
        nameInput.value = investor.name || "";
        console.log("Set name:", investor.name);
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (phoneInput) {
        phoneInput.value = investor.phone || "";
        console.log("Set phone:", investor.phone);
        phoneInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (emailInput) {
        emailInput.value = investor.email || "";
        console.log("Set email:", investor.email);
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      }

      // Find the property data for this specific property
      // Try both the original and uppercase versions since backend normalizes to uppercase
      const propertyData = investor.properties.find(
        (p) =>
          p.propertyId === this.selectedProperty ||
          p.propertyId === this.selectedProperty?.toUpperCase() ||
          p.propertyId?.toUpperCase() === this.selectedProperty?.toUpperCase(),
      );
      console.log("Property data found:", propertyData);
      console.log("Looking for propertyId:", this.selectedProperty);
      console.log(
        "Looking for propertyId (uppercase):",
        this.selectedProperty?.toUpperCase(),
      );
      console.log("Investor properties:", investor.properties);

      if (propertyData && percentageInput) {
        percentageInput.value = propertyData.percentage;
        console.log("Set percentage:", propertyData.percentage);
        percentageInput.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (percentageInput) {
        console.warn("No property data found or percentage input missing");
        // Set a default value if no property data found
        percentageInput.value = "";
      }
    } else {
      console.error("Investor not found with ID:", investorId);
      console.log(
        "Available investor IDs:",
        this.investors.map((inv) => inv.investorId),
      );
    }
  }

  async saveInvestor(investorId, modal) {
    const form = document.getElementById("investorForm");
    const formData = new FormData(form);

    const investorData = {
      username: formData.get("username") || "",
      name: formData.get("name") || "",
      phone: formData.get("phone") || "",
      email: formData.get("email") || "",
      percentage: parseFloat(formData.get("percentage")) || 0,
    };

    try {
      if (investorId) {
        // Update existing investor
        await this.updateInvestor(investorId, investorData);
      } else {
        // Create new investor
        await this.createInvestor(investorData);
      }

      // Force close modal and cleanup
      this.isModalOpen = false;
      modal.hide();

      // Use a more aggressive cleanup approach
      setTimeout(() => {
        this.forceCleanupModalBackdrops();
      }, 150);

      await this.loadInvestors(this.selectedProperty);

      // Show different messages based on whether we're editing or creating
      if (investorId) {
        this.showSuccess("Investor updated successfully");
      } else {
        // Check if this was an existing investor being added to a new property
        const wasExistingInvestor = this.lastActionWasAddPropertyToExisting;
        this.lastActionWasAddPropertyToExisting = false; // Reset flag

        if (wasExistingInvestor) {
          this.showSuccess(
            "Existing investor added to this property successfully",
          );
        } else {
          this.showSuccess("New investor created and added successfully");
        }
      }
    } catch (error) {
      console.error(`Error saving investor:`, error);
      this.showError(
        error.message || `Failed to ${investorId ? "update" : "add"} investor`,
      );
    }
  }

  async createInvestor(investorData) {
    try {
      // First, check if an investor with this username already exists
      const allInvestorsResponse = await API.get(
        API_CONFIG.ENDPOINTS.INVESTORS,
      );
      const allInvestorsResult = await allInvestorsResponse.json();

      if (allInvestorsResult.success && allInvestorsResult.data) {
        // Look for existing investor by username or name
        const existingInvestor = allInvestorsResult.data.find((investor) => {
          // Check by username if both have username
          if (investor.username && investorData.username) {
            return investor.username === investorData.username;
          }
          // Otherwise check by name (case insensitive)
          return (
            investor.name.toLowerCase() === investorData.name.toLowerCase()
          );
        });

        if (existingInvestor) {
          // Check if this property is already in the investor's portfolio
          const hasProperty = existingInvestor.properties.some(
            (p) => p.propertyId === this.selectedProperty,
          );

          if (hasProperty) {
            throw new Error("Investor is already invested in this property");
          }

          // Investor exists, just add this property to their record

          const addPropertyResponse = await API.post(
            API_CONFIG.ENDPOINTS.INVESTOR_ADD_PROPERTY(
              existingInvestor.investorId,
            ),
            {
              propertyId: this.selectedProperty,
              percentage: investorData.percentage,
            },
          );

          const addPropertyResult = await addPropertyResponse.json();

          if (!addPropertyResult.success) {
            throw new Error(
              addPropertyResult.message ||
                "Failed to add property to existing investor",
            );
          }

          this.lastActionWasAddPropertyToExisting = true; // Set flag for success message
          return; // Successfully added property to existing investor
        }
      }

      // Investor doesn't exist, create a new one
      const investorId = await this.generateInvestorId();

      const newInvestor = {
        investorId,
        username: investorData.username,
        name: investorData.name,
        phone: investorData.phone,
        email: investorData.email,
        properties: [
          {
            propertyId: this.selectedProperty,
            percentage: investorData.percentage,
          },
        ],
      };

      const response = await API.post(
        API_CONFIG.ENDPOINTS.INVESTORS,
        newInvestor,
      );
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to create investor");
      }
    } catch (error) {
      console.error("Error in createInvestor:", error);
      throw error;
    }
  }

  async generateInvestorId() {
    try {
      // Get all existing investors to find the next available ID
      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();

      if (result.success && result.data) {
        // Find the highest numeric ID and increment
        let maxId = 0;
        result.data.forEach((investor) => {
          const numericId = parseInt(investor.investorId);
          if (!isNaN(numericId) && numericId > maxId) {
            maxId = numericId;
          }
        });
        return (maxId + 1).toString();
      } else {
        return "1"; // First investor
      }
    } catch (error) {
      console.error("Error generating investor ID:", error);
      return Date.now().toString(); // Fallback to timestamp
    }
  }

  async updateInvestor(investorId, investorData) {
    const response = await API.put(
      API_CONFIG.ENDPOINTS.INVESTOR_BY_ID(investorId),
      investorData,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Failed to update investor");
    }
  }

  async editInvestor(investorId) {
    await this.showInvestorModal(investorId);
  }

  async removeInvestor(investorId) {
    if (
      !confirm(
        "Are you sure you want to remove this investor from this property?",
      )
    ) {
      return;
    }

    try {
      const response = await API.delete(
        API_CONFIG.ENDPOINTS.INVESTOR_REMOVE_PROPERTY(
          investorId,
          this.selectedProperty,
        ),
      );
      const result = await response.json();

      if (result.success) {
        await this.loadInvestors(this.selectedProperty);

        // Show different messages based on the action taken
        if (result.action === "deleted_completely") {
          this.showSuccess(
            "Investor removed completely from database (no more property investments)",
          );
        } else {
          this.showSuccess("Investor removed from this property successfully");
        }
      } else {
        throw new Error(result.message || "Failed to remove investor");
      }
    } catch (error) {
      console.error("Error removing investor:", error);
      this.showError(error.message || "Failed to remove investor");
    }
  }

  editItem(type, index) {
    // Check if month is closed
    if (this.currentReport && this.currentReport.isClosed) {
      this.showError("Cannot edit items - this month has been closed");
      return;
    }

    // Validate inputs first
    if (typeof index !== "number" || index < 0) {
      console.error("Invalid index provided to editItem:", index);
      this.showError("Invalid item index");
      return;
    }

    // Map singular type names to plural property names in currentReport
    const propertyName =
      type === "expense" ? "expenses" : type === "income" ? "income" : type;

    // More detailed validation
    if (!this.currentReport) {
      console.error("No current report loaded");
      this.showError(
        "No financial report loaded. Please select a property and month.",
      );
      return;
    }

    if (!this.currentReport[propertyName]) {
      console.error(
        `Property '${propertyName}' not found in current report:`,
        this.currentReport,
      );
      this.showError(`No ${type} data found in current report`);
      return;
    }

    if (!Array.isArray(this.currentReport[propertyName])) {
      console.error(
        `Property '${propertyName}' is not an array:`,
        this.currentReport[propertyName],
      );
      this.showError(`Invalid ${type} data format`);
      return;
    }

    if (index >= this.currentReport[propertyName].length) {
      console.error(
        `Index ${index} is out of bounds for ${propertyName} array of length ${this.currentReport[propertyName].length}`,
      );
      console.error(
        `Current ${propertyName} array:`,
        this.currentReport[propertyName],
      );
      this.showError(
        `Item not found - index out of bounds. Refreshing data...`,
      );
      // Refresh the financial report to fix the display
      this.loadFinancialReport();
      return;
    }

    const item = this.currentReport[propertyName][index];
    if (!item) {
      console.error(
        `Item at index ${index} is null/undefined in ${propertyName}`,
      );
      console.error(
        `Current ${propertyName} array:`,
        this.currentReport[propertyName],
      );
      this.showError("Item not found - item is empty. Refreshing data...");
      // Refresh the financial report to fix the display
      this.loadFinancialReport();
      return;
    }

    console.log(`Editing ${type} item at index ${index}:`, item);

    // Show loading state
    this.setEditButtonLoading(type, index, true);
    this.showIncomeExpenseModal(type, item, index);
  }

  // ─── Bulk selection helpers ───────────────────────────────────────────────

  toggleItemSelection(type, index) {
    const key = `${type}-${index}`;
    if (this.selectedItems.has(key)) {
      this.selectedItems.delete(key);
    } else {
      this.selectedItems.add(key);
    }
    if (type === "income") {
      this.updateIncomeDisplay();
    } else {
      this.updateExpenseDisplay();
    }
  }

  toggleSelectAll(type, checked) {
    const items =
      type === "income"
        ? this.currentReport?.income || []
        : this.currentReport?.expenses || [];
    items.forEach((_, i) => {
      const key = `${type}-${i}`;
      if (checked) {
        this.selectedItems.add(key);
      } else {
        this.selectedItems.delete(key);
      }
    });
    if (type === "income") {
      this.updateIncomeDisplay();
    } else {
      this.updateExpenseDisplay();
    }
  }

  clearSelection(type) {
    [...this.selectedItems]
      .filter((k) => k.startsWith(`${type}-`))
      .forEach((k) => this.selectedItems.delete(k));
    if (type === "income") {
      this.updateIncomeDisplay();
    } else {
      this.updateExpenseDisplay();
    }
  }

  async bulkDeleteSelected(type) {
    if (this.currentReport && this.currentReport.isClosed) {
      this.showError("Cannot delete items - this month has been closed");
      return;
    }

    const keys = [...this.selectedItems].filter((k) =>
      k.startsWith(`${type}-`),
    );
    if (keys.length === 0) return;

    // Sort indices descending so deleting by index doesn't shift remaining indices
    const indices = keys
      .map((k) => parseInt(k.split("-")[1], 10))
      .sort((a, b) => b - a);

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;

    let successCount = 0;
    let firstError = null;

    for (const idx of indices) {
      try {
        const endpoint =
          type === "income"
            ? API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_INCOME(
                this.selectedProperty,
                year,
                month,
              ) + `/${idx}`
            : API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_EXPENSES(
                this.selectedProperty,
                year,
                month,
              ) + `/${idx}`;

        const response = await API.delete(endpoint);
        const result = await response.json();

        if (result.success) {
          successCount++;
        } else {
          firstError = result.message || `Failed to delete ${type} item`;
        }
      } catch (err) {
        firstError = err.message || `Failed to delete ${type} item`;
      }
    }

    // Clear selections for this type
    keys.forEach((k) => this.selectedItems.delete(k));

    await this.loadFinancialReport();
    await this.updateDisplays();

    if (successCount > 0) {
      this.showSuccess(
        `${successCount} ${type} item${successCount > 1 ? "s" : ""} deleted`,
      );
    }
    if (firstError) {
      this.showError(firstError);
    }
  }

  _initDragSelection(tbodyId, type) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const onMouseDown = (e) => {
      const row = e.target.closest("tr[data-item-key]");
      if (!row) return;
      // Don't start drag on checkbox/button clicks or drag-reorder handle
      if (e.target.closest("button, input, a, .drag-handle")) return;

      this._dragSelecting = true;
      const key = row.dataset.itemKey;
      // Determine mode: if item already selected, this drag deselects; otherwise selects
      this._dragSelectMode = !this.selectedItems.has(key);
      // Toggle the starting row
      if (this._dragSelectMode) {
        this.selectedItems.add(key);
      } else {
        this.selectedItems.delete(key);
      }
      this._refreshRowSelection(row, key, type);
      e.preventDefault(); // prevent text selection during drag
    };

    const onMouseOver = (e) => {
      if (!this._dragSelecting) return;
      const row = e.target.closest("tr[data-item-key]");
      if (!row) return;
      const key = row.dataset.itemKey;
      if (!key.startsWith(`${type}-`)) return;
      if (this._dragSelectMode) {
        this.selectedItems.add(key);
      } else {
        this.selectedItems.delete(key);
      }
      this._refreshRowSelection(row, key, type);
    };

    const onMouseUp = () => {
      if (!this._dragSelecting) return;
      this._dragSelecting = false;
      // Re-render to update the bulk action bar count
      if (type === "income") {
        this.updateIncomeDisplay();
      } else {
        this.updateExpenseDisplay();
      }
    };

    tbody.addEventListener("mousedown", onMouseDown);
    tbody.addEventListener("mouseover", onMouseOver);
    // Listen on document so mouseup outside tbody still ends drag
    document.addEventListener("mouseup", onMouseUp, { once: false });
    // Store reference to remove old listener on re-render
    if (this[`_${type}MouseUpHandler`]) {
      document.removeEventListener("mouseup", this[`_${type}MouseUpHandler`]);
    }
    this[`_${type}MouseUpHandler`] = onMouseUp;
  }

  _refreshRowSelection(row, key, type) {
    const checkbox = row.querySelector(".bulk-checkbox");
    const isSelected = this.selectedItems.has(key);
    if (checkbox) checkbox.checked = isSelected;
    if (isSelected) {
      row.classList.add("table-warning", "bulk-selected");
    } else {
      row.classList.remove("table-warning", "bulk-selected");
    }
  }

  // ─── Drag-to-reorder ─────────────────────────────────────────────────────

  _initDragReorder(tbodyId, mobileCardsId, type) {
    if (this.currentReport?.isClosed || !this.isEditMode) return;

    let dragSrcIndex = null;
    let dragAllowed = false;

    const bindDragEvents = (container, selector) => {
      const elements = Array.from(container.querySelectorAll(selector));
      elements.forEach((el) => {
        const handle = el.querySelector(".drag-handle");
        if (handle) {
          handle.addEventListener("mousedown", () => {
            dragAllowed = true;
          });
        }

        el.setAttribute("draggable", "true");

        el.addEventListener("dragstart", (e) => {
          if (!dragAllowed) {
            e.preventDefault();
            return;
          }
          dragSrcIndex = parseInt(el.dataset.itemIndex);
          e.dataTransfer.effectAllowed = "move";
          el.style.opacity = "0.45";
        });

        el.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          el.classList.add("drag-row-over");
        });

        el.addEventListener("dragleave", () => {
          el.classList.remove("drag-row-over");
        });

        el.addEventListener("drop", (e) => {
          e.preventDefault();
          el.classList.remove("drag-row-over");
          const targetIndex = parseInt(el.dataset.itemIndex);
          if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
            this._reorderItems(type, dragSrcIndex, targetIndex);
          }
          dragSrcIndex = null;
          dragAllowed = false;
        });

        el.addEventListener("dragend", () => {
          el.style.opacity = "";
          container
            .querySelectorAll(".drag-row-over")
            .forEach((r) => r.classList.remove("drag-row-over"));
          dragAllowed = false;
          dragSrcIndex = null;
        });
      });
    };

    const tbody = document.getElementById(tbodyId);
    if (tbody) bindDragEvents(tbody, "tr[data-item-index]");

    const mobileContainer = document.getElementById(mobileCardsId);
    if (mobileContainer)
      bindDragEvents(mobileContainer, "div[data-item-index]");

    document.addEventListener("mouseup", () => {
      dragAllowed = false;
    });
  }

  _reorderItems(type, fromIndex, toIndex) {
    const arr =
      type === "income"
        ? this.currentReport.income
        : this.currentReport.expenses;
    const [item] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, item);

    if (type === "income") {
      this.updateIncomeDisplay();
    } else {
      this.updateExpenseDisplay();
    }

    this._saveReorder(type).catch(console.error);
  }

  async _saveReorder(type) {
    if (!this.selectedProperty || !this.currentReport) return;
    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;
      const items =
        type === "income"
          ? this.currentReport.income
          : this.currentReport.expenses;
      const endpoint =
        type === "income"
          ? API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_INCOME_REORDER(
              this.selectedProperty,
              year,
              month,
            )
          : API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_EXPENSES_REORDER(
              this.selectedProperty,
              year,
              month,
            );
      const response = await API.put(endpoint, { items });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      this.currentReport = result.data;
    } catch (err) {
      console.error("Failed to save reorder:", err);
      this.showError("Failed to save new order. Reloading...");
      this.loadFinancialReport();
    }
  }

  toggleEditMode() {
    if (this.currentReport?.isClosed) return;
    this.isEditMode = !this.isEditMode;
    // Re-render both sections to show/hide drag handles
    this.updateIncomeDisplay();
    this.updateExpenseDisplay();
    // Update toggle button appearance
    const btn = document.getElementById("toggleEditModeBtn");
    if (btn) {
      if (this.isEditMode) {
        btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Done';
        btn.style.background = "#22c55e";
        btn.title = "Exit edit mode";
      } else {
        btn.innerHTML = '<i class="bi bi-arrows-move me-1"></i>Reorder';
        btn.style.background = "rgba(255,255,255,0.2)";
        btn.title = "Enter edit mode to drag and reorder items";
      }
    }
  }

  // ─── End drag-to-reorder ──────────────────────────────────────────────────

  toggleDeleteConfirm(type, index) {
    // Check if month is closed
    if (this.currentReport && this.currentReport.isClosed) {
      this.showError("Cannot delete items - this month has been closed");
      return;
    }

    const itemKey = `${type}-${index}`;
    this.pendingDeletes.add(itemKey);

    // Re-render the displays to show the check/cancel buttons
    if (type === "income") {
      this.updateIncomeDisplay();
    } else {
      this.updateExpenseDisplay();
    }
  }

  cancelDeleteItem(type, index) {
    const itemKey = `${type}-${index}`;
    this.pendingDeletes.delete(itemKey);

    // Re-render the displays to show the trash button again
    if (type === "income") {
      this.updateIncomeDisplay();
    } else {
      this.updateExpenseDisplay();
    }
  }

  async confirmDeleteItem(type, index) {
    // Check if month is closed
    if (this.currentReport && this.currentReport.isClosed) {
      this.showError("Cannot delete items - this month has been closed");
      return;
    }

    const itemKey = `${type}-${index}`;
    this.pendingDeletes.delete(itemKey);

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      // Build the endpoint URL for deleting the specific item
      const endpoint =
        type === "income"
          ? API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_INCOME(
              this.selectedProperty,
              year,
              month,
            ) + `/${index}`
          : API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_EXPENSES(
              this.selectedProperty,
              year,
              month,
            ) + `/${index}`;

      const response = await API.delete(endpoint);
      const result = await response.json();

      if (result.success) {
        await this.loadFinancialReport();
        // Force a display refresh to ensure indices are correct
        await this.updateDisplays();
        this.showSuccess(
          `${
            type.charAt(0).toUpperCase() + type.slice(1)
          } item deleted successfully`,
        );
      } else {
        throw new Error(result.message || `Failed to delete ${type} item`);
      }
    } catch (error) {
      console.error(`Error deleting ${type} item:`, error);
      this.showError(error.message || `Failed to delete ${type} item`);
    }
  }

  showToast(message, type = "info") {
    showToast(message, type);
  }

  showSuccess(message) {
    this.showToast(message, "success");
  }

  showError(message) {
    this.showToast(message, "error");
  }

  showInfo(message) {
    this.showToast(message, "info");
  }

  // Set loading state for edit button
  setEditButtonLoading(type, index, isLoading) {
    const buttonId =
      type === "income" ? `editIncomeBtn-${index}` : `editExpenseBtn-${index}`;
    const button = document.getElementById(buttonId);

    if (button) {
      const editIcon = button.querySelector(".edit-icon");
      const loadingSpinner = button.querySelector(".loading-spinner");

      if (isLoading) {
        button.disabled = true;
        if (editIcon) editIcon.classList.add("d-none");
        if (loadingSpinner) loadingSpinner.classList.remove("d-none");
      } else {
        button.disabled = false;
        if (editIcon) editIcon.classList.remove("d-none");
        if (loadingSpinner) loadingSpinner.classList.add("d-none");
      }
    }
  }

  // Toggle close month confirmation
  async toggleCloseConfirm() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }

    if (this.currentReport.isClosed) {
      this.showError("This month is already closed");
      return;
    }

    // Add to pending closes set
    this.pendingClose = true;
    await this.updateClosedStatus();
  }

  // Cancel close confirmation
  async cancelCloseConfirm() {
    this.pendingClose = false;
    await this.updateClosedStatus();
  }

  // Confirm close month
  async confirmCloseMonth() {
    this.pendingClose = false;

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      const response = await API.post(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_CLOSE(
          this.selectedProperty,
          year,
          month,
        ),
      );

      const result = await response.json();

      if (result.success) {
        this.currentReport = result.data;
        await this.updateClosedStatus();
        // Update property card to show closed status
        this.propertyReportStatus[this.selectedProperty] = {
          isClosed: true,
          isSettled: result.data.isSettled || false,
        };
        this.renderPropertyCards(this.properties);
        this.showSuccess("Month closed successfully!");
      } else {
        throw new Error(result.message || "Failed to close month");
      }
    } catch (error) {
      console.error("Error closing month:", error);
      this.showError(error.message || "Failed to close month");
      await this.updateClosedStatus();
    }
  }

  // Reopen current month
  async reopenMonth() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }

    if (!this.currentReport.isClosed) {
      this.showError("This month is not closed");
      return;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      const response = await API.post(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_REOPEN(
          this.selectedProperty,
          year,
          month,
        ),
      );

      const result = await response.json();

      if (result.success) {
        this.currentReport = result.data;
        await this.updateClosedStatus();
        // Update property card to show reopened status
        this.propertyReportStatus[this.selectedProperty] = {
          isClosed: false,
          isSettled: false,
        };
        this.renderPropertyCards(this.properties);
        this.showSuccess("Month reopened successfully!");
      } else {
        throw new Error(result.message || "Failed to reopen month");
      }
    } catch (error) {
      console.error("Error reopening month:", error);
      this.showError(error.message || "Failed to reopen month");
    }
  }

  // Mark investor settlement as paid out
  async markSettled() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }
    if (!this.currentReport.isClosed) {
      this.showError("Report must be closed before marking as settled");
      return;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      const response = await API.post(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_SETTLE(
          this.selectedProperty,
          year,
          month,
        ),
      );
      const result = await response.json();

      if (result.success) {
        this.currentReport = result.data;
        await this.updateClosedStatus();
        this.propertyReportStatus[this.selectedProperty] = {
          isClosed: true,
          isSettled: true,
        };
        this.renderPropertyCards(this.properties);
        this.showSuccess(
          "Settlement marked — investor payments recorded as paid out!",
        );
      } else {
        throw new Error(result.message || "Failed to mark settlement");
      }
    } catch (error) {
      console.error("Error marking settlement:", error);
      this.showError(error.message || "Failed to mark settlement");
    }
  }

  // Unmark settlement status
  async unmarkSettled() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      const response = await API.post(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_UNSETTLE(
          this.selectedProperty,
          year,
          month,
        ),
      );
      const result = await response.json();

      if (result.success) {
        this.currentReport = result.data;
        await this.updateClosedStatus();
        this.propertyReportStatus[this.selectedProperty] = {
          isClosed: true,
          isSettled: false,
        };
        this.renderPropertyCards(this.properties);
        this.showSuccess("Settlement status removed");
      } else {
        throw new Error(result.message || "Failed to unmark settlement");
      }
    } catch (error) {
      console.error("Error unmarking settlement:", error);
      this.showError(error.message || "Failed to unmark settlement");
    }
  }

  // Carry forward all income & expense items to the next month
  async carryForwardToNextMonth() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }

    const hasItems =
      this.currentReport.income.length > 0 ||
      this.currentReport.expenses.length > 0;
    if (!hasItems) {
      this.showError("No income or expense items to carry forward");
      return;
    }

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
    const currentMonth = monthNames[this.currentDate.getMonth()];
    const currentYear = this.currentDate.getFullYear();
    const nextMonthIndex =
      this.currentDate.getMonth() === 11 ? 0 : this.currentDate.getMonth() + 1;
    const nextYear =
      this.currentDate.getMonth() === 11 ? currentYear + 1 : currentYear;
    const nextMonth = monthNames[nextMonthIndex];

    const totalItems =
      this.currentReport.income.length + this.currentReport.expenses.length;

    if (
      !confirm(
        `Carry forward ${totalItems} item(s) from ${currentMonth} ${currentYear} to ${nextMonth} ${nextYear}?\n\nEach item will be prefixed with "[${currentMonth.substring(0, 3)} ${currentYear}]" to identify its origin.`,
      )
    ) {
      return;
    }

    const btn = document.getElementById("carryForwardBtn");
    if (btn) btn.disabled = true;

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      const response = await API.post(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_CARRY_FORWARD(
          this.selectedProperty,
          year,
          month,
        ),
      );

      const result = await response.json();

      if (result.success) {
        this.showSuccess(result.message);
      } else {
        throw new Error(result.message || "Failed to carry forward report");
      }
    } catch (error) {
      console.error("Error carrying forward report:", error);
      this.showError(error.message || "Failed to carry forward report");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Lock all unlocked reports for the current month
  async lockAllReports() {
    if (!this.properties || this.properties.length === 0) {
      this.showError("No properties to lock");
      return;
    }

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;

    const unlocked = this.properties.filter((p) => {
      const status = this.propertyReportStatus[p.propertyId];
      return !status || !status.isClosed;
    });

    if (unlocked.length === 0) {
      this.showSuccess("All reports for this month are already locked");
      return;
    }

    const btn = document.getElementById("lockAllReportsBtn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-1"></span>Locking...';
    }

    let locked = 0;
    let failed = 0;

    await Promise.all(
      unlocked.map(async (property) => {
        try {
          const response = await API.post(
            API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_CLOSE(
              property.propertyId,
              year,
              month,
            ),
          );
          if (response.status === 404) {
            // No report exists for this property — treat as locked (nothing to lock)
            this.propertyReportStatus[property.propertyId] = { isClosed: true };
            locked++;
            return;
          }
          const result = await response.json();
          if (result.success) {
            this.propertyReportStatus[property.propertyId] = { isClosed: true };
            locked++;
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
        }
      }),
    );

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-lock-fill me-1"></i>Lock All';
    }

    this.renderPropertyCards(this.properties);

    // Refresh current report UI if selected property was just locked
    if (
      this.selectedProperty &&
      this.propertyReportStatus[this.selectedProperty]?.isClosed &&
      this.currentReport &&
      !this.currentReport.isClosed
    ) {
      this.currentReport.isClosed = true;
      await this.updateClosedStatus();
    }

    if (failed === 0) {
      this.showSuccess(
        `Locked ${locked} report${locked !== 1 ? "s" : ""} for ${month}/${year}`,
      );
    } else {
      this.showSuccess(
        `Locked ${locked}, failed ${failed} for ${month}/${year}`,
      );
    }
  }

  // Update UI based on closed status
  async updateClosedStatus() {
    const isClosed = this.currentReport && this.currentReport.isClosed;
    const isPendingClose = this.pendingClose;

    // Update button visibility and state
    const closeBtn = document.getElementById("closeMonthBtn");
    const reopenBtn = document.getElementById("reopenMonthBtn");

    if (closeBtn) {
      if (isClosed) {
        closeBtn.style.display = "none";
      } else {
        closeBtn.style.display = "inline-block";

        // Update button based on pending state
        if (isPendingClose) {
          // Show confirmation buttons (like delete confirmation)
          closeBtn.innerHTML = `
            <div class="btn-group btn-group-sm">
              <button class="btn btn-success btn-sm p-1" onclick="window.financialReports.confirmCloseMonth()" title="Confirm close month">
                <i class="bi bi-check" style="color: #ffffff !important"></i>
              </button>
              <button class="btn btn-outline-secondary btn-sm p-1" onclick="window.financialReports.cancelCloseConfirm()" title="Cancel">
                <i class="bi bi-x"></i>
              </button>
            </div>
          `;
          closeBtn.className = "btn btn-sm";
          closeBtn.style.backgroundColor = "transparent";
          closeBtn.style.border = "none";
          closeBtn.style.padding = "0";
        } else {
          // Show normal close button
          closeBtn.innerHTML =
            '<i class="bi bi-lock" style="color: #ffffff !important"></i>';
          closeBtn.className = "btn btn-sm btn-warning";
          closeBtn.style.backgroundColor = "#ff6b35";
          closeBtn.style.borderColor = "#ff6b35";
          closeBtn.style.color = "#ffffff !important";
          closeBtn.style.padding = "";
          closeBtn.title = "Close this month (prevents further editing)";
        }
      }
    }

    if (reopenBtn) {
      reopenBtn.style.display = isClosed ? "inline-block" : "none";
    }

    const isSettled = this.currentReport && this.currentReport.isSettled;
    const markSettledBtn = document.getElementById("markSettledBtn");
    const unmarkSettledBtn = document.getElementById("unmarkSettledBtn");
    if (markSettledBtn) {
      markSettledBtn.style.display =
        isClosed && !isSettled ? "inline-block" : "none";
    }
    if (unmarkSettledBtn) {
      unmarkSettledBtn.style.display =
        isClosed && isSettled ? "inline-block" : "none";
      if (isSettled && this.currentReport?.settledBy) {
        const settledDate = this.currentReport.settledAt
          ? new Date(this.currentReport.settledAt).toLocaleDateString("en-SG")
          : "";
        unmarkSettledBtn.title = `Settled by ${this.currentReport.settledBy}${settledDate ? ` on ${settledDate}` : ""} — click to undo`;
      }
    }

    const carryForwardBtn = document.getElementById("carryForwardBtn");
    if (carryForwardBtn) {
      const hasItems =
        this.currentReport &&
        (this.currentReport.income.length > 0 ||
          this.currentReport.expenses.length > 0);
      carryForwardBtn.style.display = hasItems ? "inline-block" : "none";
    }

    // Update month display with closed indicator
    await this.updateMonthDisplayWithClosedStatus();

    // Disable/enable action buttons
    this.toggleActionButtons(!isClosed);
  }

  // Update month display to show closed status
  async updateMonthDisplayWithClosedStatus() {
    const currentMonthEl = document.getElementById("currentMonth");
    const currentMonthBadge = document.getElementById("currentMonthBadge");

    if (currentMonthEl) {
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

      const month = monthNames[this.currentDate.getMonth()];
      const year = this.currentDate.getFullYear();
      const isClosed = this.currentReport && this.currentReport.isClosed;
      const isSettled = this.currentReport && this.currentReport.isSettled;

      // Get property information — prefer in-memory cache to avoid async network call
      let propertyInfo = "";
      let property = null;
      if (this.selectedProperty) {
        property =
          this.properties?.find(
            (p) => p.propertyId === this.selectedProperty,
          ) ||
          this._slugResolvedProperty ||
          null;

        if (!property) {
          try {
            property = await this.getPropertyDetails(this.selectedProperty);
          } catch (error) {
            console.log("Error fetching property details:", error);
          }
        }

        propertyInfo = property
          ? `${property.unit}, ${property.address}`
          : `Property ID: ${this.selectedProperty}`;
      }

      const statusIcon = isSettled ? " 🤝" : isClosed ? " 🔒" : "";
      currentMonthEl.innerHTML = `
        <div class="d-flex flex-column align-items-center">
          <div class="fw-bold">${month} ${year}${statusIcon}</div>
          ${propertyInfo ? `<div class="text-muted" style="font-size: 0.9rem;">${propertyInfo}</div>` : ""}
        </div>
      `;

      // Update the dedicated last-updated info bar
      const lastUpdatedDiv = document.getElementById("reportLastUpdated");
      const lastUpdatedDateEl = document.getElementById(
        "reportLastUpdatedDate",
      );
      const lastUpdatedByEl = document.getElementById("reportLastUpdatedBy");
      if (lastUpdatedDiv && lastUpdatedDateEl && lastUpdatedByEl) {
        const lastUpdatedAt = this.currentReport?.updatedAt;
        const lastUpdatedBy = this.currentReport?.lastUpdatedBy;
        if (lastUpdatedAt) {
          const formattedDate = new Date(lastUpdatedAt).toLocaleString(
            "en-SG",
            {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          );
          lastUpdatedDateEl.textContent = formattedDate;
          lastUpdatedByEl.textContent = lastUpdatedBy || "—";
          lastUpdatedDiv.style.display = "flex";
        } else {
          lastUpdatedDiv.style.display = "none";
        }
      }

      // Update property group links
      this.updatePropertyGroupLinks(property);
    }

    if (currentMonthBadge) {
      const now = new Date();
      const isCurrentMonth =
        this.currentDate.getMonth() === now.getMonth() &&
        this.currentDate.getFullYear() === now.getFullYear();

      const isClosed = this.currentReport && this.currentReport.isClosed;
      const isSettledBadge = this.currentReport && this.currentReport.isSettled;

      let badgeText, badgeClass;

      if (isSettledBadge) {
        badgeText = "Settled ✓";
        badgeClass = "badge";
        currentMonthBadge.style.backgroundColor = "#0d9488";
        currentMonthBadge.style.color = "#fff";
      } else if (isClosed) {
        badgeText = "Closed";
        badgeClass = "badge bg-danger";
        currentMonthBadge.style.backgroundColor = "";
        currentMonthBadge.style.color = "";
      } else if (isCurrentMonth) {
        badgeText = "Current Month";
        badgeClass = "badge bg-info";
        currentMonthBadge.style.backgroundColor = "";
        currentMonthBadge.style.color = "";
      } else {
        badgeText = "Historical";
        badgeClass = "badge bg-secondary";
        currentMonthBadge.style.backgroundColor = "";
        currentMonthBadge.style.color = "";
      }

      currentMonthBadge.textContent = badgeText;
      currentMonthBadge.className = badgeClass;
    }
  }

  updatePropertyGroupLinks(property) {
    const groupLinksContainer = document.getElementById("propertyGroupLinks");
    const tenantContainer = document.getElementById("tenantGroupLinkContainer");
    const adminContainer = document.getElementById("adminGroupLinkContainer");
    if (!groupLinksContainer || !tenantContainer || !adminContainer) return;

    const tenantGroup = property && property.tenantFacebookGroup;
    const adminGroup = property && property.adminFacebookGroup;

    if (!tenantGroup && !adminGroup) {
      groupLinksContainer.style.display = "none";
      return;
    }

    tenantContainer.innerHTML = tenantGroup
      ? `<a href="${escapeHtml(tenantGroup)}" target="_blank" rel="noopener noreferrer"
            class="btn btn-sm btn-outline-primary">
           <i class="bi bi-facebook me-1"></i>Tenant Group
         </a>`
      : "";

    adminContainer.innerHTML = adminGroup
      ? `<a href="${escapeHtml(adminGroup)}" target="_blank" rel="noopener noreferrer"
            class="btn btn-sm btn-outline-success">
           <i class="bi bi-facebook me-1"></i>Admin Group
         </a>`
      : "";

    groupLinksContainer.style.display = "";
  }

  // Toggle action buttons (add/edit/delete) based on closed status
  toggleActionButtons(enabled) {
    // Disable/enable add buttons
    const addIncomeBtn = document.getElementById("addIncomeBtn");
    const addExpenseBtn = document.getElementById("addExpenseBtn");
    const addInvestorBtn = document.getElementById("addInvestorBtn");

    if (addIncomeBtn) {
      addIncomeBtn.disabled = !enabled;
      addIncomeBtn.style.opacity = enabled ? "1" : "0.5";
      addIncomeBtn.title = enabled
        ? "Add Income Item"
        : "Cannot add items - month is closed";
    }

    if (addExpenseBtn) {
      addExpenseBtn.disabled = !enabled;
      addExpenseBtn.style.opacity = enabled ? "1" : "0.5";
      addExpenseBtn.title = enabled
        ? "Add Expense Item"
        : "Cannot add items - month is closed";
    }

    if (addInvestorBtn) {
      addInvestorBtn.disabled = !enabled;
      addInvestorBtn.style.opacity = enabled ? "1" : "0.5";
      addInvestorBtn.title = enabled
        ? "Add Investor"
        : "Cannot add investors - month is closed";
    }

    // Update existing action buttons in the tables
    const editButtons = document.querySelectorAll(
      '[id^="editIncomeBtn-"], [id^="editExpenseBtn-"]',
    );
    const deleteButtons = document.querySelectorAll(
      'button[onclick*="toggleDeleteConfirm"], button[onclick*="confirmDeleteItem"]',
    );

    editButtons.forEach((btn) => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? "1" : "0.5";
      btn.title = enabled ? "Edit" : "Cannot edit - month is closed";
    });

    deleteButtons.forEach((btn) => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? "1" : "0.5";
      btn.title = enabled ? "Delete" : "Cannot delete - month is closed";
    });

    // Disable bulk delete buttons when closed
    document
      .querySelectorAll(".bulk-action-bar button.btn-danger")
      .forEach((btn) => {
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? "1" : "0.5";
      });

    // Disable checkboxes when closed
    document
      .querySelectorAll(".bulk-checkbox, #selectAllIncome, #selectAllExpenses")
      .forEach((cb) => {
        cb.disabled = !enabled;
      });

    // Hide/show reorder toggle button based on lock state
    const toggleEditModeBtn = document.getElementById("toggleEditModeBtn");
    if (toggleEditModeBtn) {
      toggleEditModeBtn.style.display = enabled ? "" : "none";
      if (!enabled && this.isEditMode) {
        // Force exit edit mode if report gets locked
        this.isEditMode = false;
        this.updateIncomeDisplay();
        this.updateExpenseDisplay();
      }
    }
  }

  // Public method to refresh the component
  refresh() {
    if (this.selectedProperty) {
      this.loadFinancialReport();
    }
  }

  async exportFinancialReportAsPDF() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }

    // Prevent duplicate calls
    if (this._isExporting) {
      return;
    }
    this._isExporting = true;

    try {
      // Show loading state
      const exportBtn = document.getElementById("exportFinancialReportBtn");
      exportBtn.innerHTML =
        '<i class="bi bi-hourglass-split"></i> Exporting...';
      exportBtn.disabled = true;

      // Get property details
      const property = await this.getPropertyDetails(this.selectedProperty);
      const propertyHeader = property
        ? `Unit ${property.unit}, ${property.address}\nProperty ID: ${property.propertyId}`
        : `Property ID: ${this.selectedProperty}`;

      // Create PDF using globally loaded jsPDF
      const pdf = new window.jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      // Embed Noto Serif for full Vietnamese support
      const _loadFont = async (url) => {
        const buf = await (await fetch(url)).arrayBuffer();
        const bytes = new Uint8Array(buf);
        let s = "";
        for (let i = 0; i < bytes.length; i++)
          s += String.fromCharCode(bytes[i]);
        return btoa(s);
      };
      const [_regB64, _boldB64] = await Promise.all([
        _loadFont("/fonts/NotoSerif-Regular.ttf"),
        _loadFont("/fonts/NotoSerif-Bold.ttf"),
      ]);
      pdf.addFileToVFS("NotoSerif-Regular.ttf", _regB64);
      pdf.addFont("NotoSerif-Regular.ttf", "NotoSerif", "normal");
      pdf.addFileToVFS("NotoSerif-Bold.ttf", _boldB64);
      pdf.addFont("NotoSerif-Bold.ttf", "NotoSerif", "bold");
      pdf.setFont("NotoSerif", "normal");

      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPos = 15;
      const margin = 12;
      const contentWidth = pageWidth - 2 * margin;

      // Helper function to get last 2 words of a name
      const getShortName = (fullName) => {
        if (!fullName) return "-";
        const words = fullName.trim().split(" ");
        return words.length >= 2 ? words.slice(-2).join(" ") : fullName;
      };

      // Helper to get paid by details for PDF (name + room type)
      const getPaidByForPDF = (paidBy) => {
        const paidByArray = !paidBy
          ? []
          : Array.isArray(paidBy)
            ? paidBy.filter((v) => v)
            : [paidBy];

        if (paidByArray.length === 0) return { name: "-", roomType: null };

        const resolveSingle = (pb) => {
          let person = null;
          let displayName = "";
          let roomType = null;

          if (pb.startsWith("tenant_")) {
            const tenantId = pb.replace("tenant_", "");
            person = this.tenants.find(
              (t) =>
                (t._id && t._id === tenantId) ||
                (t.tenantId && t.tenantId === tenantId) ||
                (t.id && t.id === tenantId) ||
                (t.fin && t.fin === tenantId),
            );
            if (person) {
              displayName = person.name || "Unknown Tenant";
              if (person.roomType) {
                roomType = person.roomType;
              } else if (person.properties && this.selectedProperty) {
                const assoc = person.properties.find(
                  (p) => p.propertyId === this.selectedProperty,
                );
                if (assoc?.room) roomType = assoc.room;
              }
            }
          } else {
            person =
              this.investors.find((i) => i.investorId === pb) ||
              (this.allInvestors &&
                this.allInvestors.find((i) => i.investorId === pb));
            if (person) displayName = person.name || "Unknown Investor";
          }

          if (!person || !displayName)
            return { name: "Unknown", roomType: null };
          return {
            name: getShortName(displayName),
            roomType: roomType ? this.getRoomTypeDisplayName(roomType) : null,
          };
        };

        if (paidByArray.length === 1) return resolveSingle(paidByArray[0]);

        const resolved = paidByArray.map(resolveSingle);
        const names = resolved.map((r) => r.name).join(", ");
        return { name: names, roomType: null };
      };

      // Strip diacritics for PDF filenames only (cleaner file names on all OS)
      const removeDiacritics = (str) => {
        if (!str) return "";
        return str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .replace(/Đ/g, "D");
      };

      // Helper to wrap text into multiple lines
      const wrapText = (text, maxWidth) => {
        const words = text.split(" ");
        const lines = [];
        let currentLine = "";

        words.forEach((word) => {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const width = pdf.getTextWidth(testLine);

          if (width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });

        if (currentLine) {
          lines.push(currentLine);
        }

        return lines;
      };

      // Helper to wrap multi-line text (handles newlines and preserves structure)
      const wrapMultiLineText = (text, maxWidth) => {
        if (!text) return [];

        const allLines = [];
        // Split by newlines first to preserve line breaks
        const paragraphs = text.split(/\n/);

        paragraphs.forEach((paragraph) => {
          if (paragraph.trim() === "") {
            // Preserve empty lines
            allLines.push("");
          } else {
            // Wrap each paragraph
            const wrappedLines = wrapText(paragraph, maxWidth);
            allLines.push(...wrappedLines);
          }
        });

        return allLines;
      };

      // Helper to get last word from name
      const getLastWord = (name) => {
        if (!name) return "?";
        const words = name.trim().split(" ");
        return words[words.length - 1];
      };

      // Title with month/year on same line
      const reportMonth = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth(),
        1,
      );
      const monthName = reportMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      pdf.setFontSize(16);
      pdf.setFont("NotoSerif", "bold");
      pdf.text("FINANCIAL REPORT", pageWidth / 2, yPos, { align: "center" });

      // Add month/year on the right side of the same line
      pdf.setFontSize(12);
      pdf.text(monthName, pageWidth - margin, yPos, { align: "right" });

      yPos += 6;
      pdf.setFontSize(9);
      pdf.setFont("NotoSerif", "normal");
      const propertyLines = propertyHeader.split("\n");
      propertyLines.forEach((line) => {
        pdf.text(line, pageWidth / 2, yPos, { align: "center" });
        yPos += 4;
      });

      yPos += 4;

      // PUB OVERAGE INDICATOR (only when utility bill exceeds subsidizedPub for this period)
      const _overBill = this._findOverlappingUtilityBill();
      if (_overBill) {
        const _excess = (_overBill.totalAmount || 0) - this.propertySubsidy;
        const _barH = 7;
        const _accentW = 2;
        // Left accent strip (solid red)
        pdf.setFillColor(220, 53, 69);
        pdf.rect(margin, yPos, _accentW, _barH, "F");
        // Background strip (pale red)
        pdf.setFillColor(255, 243, 243);
        pdf.rect(margin + _accentW, yPos, contentWidth - _accentW, _barH, "F");
        // Label
        pdf.setFont("NotoSerif", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(185, 28, 28);
        pdf.text("PUB OVERAGE", margin + _accentW + 2.5, yPos + 4.5);
        // Detail text
        const _fmtD = (v) =>
          v
            ? new Date(v).toLocaleDateString("en-SG", {
                day: "2-digit",
                month: "short",
              })
            : null;
        const _period =
          _overBill.billingPeriodStart || _overBill.billingPeriodEnd
            ? `${_fmtD(_overBill.billingPeriodStart) || "?"}-${_fmtD(_overBill.billingPeriodEnd) || "?"}`
            : `${_overBill.month}/${_overBill.year}`;
        pdf.setFont("NotoSerif", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(120, 0, 0);
        pdf.text(
          `${_period}  |  Bill $${(_overBill.totalAmount || 0).toFixed(2)}  max $${this.propertySubsidy.toFixed(2)}`,
          margin + _accentW + 26,
          yPos + 4.5,
        );
        // Badge pill on right edge
        const _badgeTxt = `+$${_excess.toFixed(2)}`;
        pdf.setFont("NotoSerif", "bold");
        pdf.setFontSize(7);
        const _bw = pdf.getTextWidth(_badgeTxt) + 4;
        const _bx = pageWidth - margin - _bw - 1;
        pdf.setFillColor(220, 53, 69);
        pdf.roundedRect(_bx, yPos + 1.2, _bw, 4.5, 1.2, 1.2, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.text(_badgeTxt, _bx + _bw / 2, yPos + 4.4, { align: "center" });
        pdf.setTextColor(0, 0, 0);
        yPos += _barH + 4;
      }

      // INCOME SECTION
      pdf.setFont("NotoSerif", "bold");
      pdf.setFontSize(11);
      pdf.text("INCOME", margin, yPos);
      yPos += 5;

      pdf.setFontSize(8);

      // Define consistent column positions (adjusted to prevent overlapping)
      const colItem = margin + 1;
      const colDate = margin + 62;
      const colPerson = margin + 82;
      const colPaidBy = margin + 115;
      const colAmount = pageWidth - margin - 1;

      if (this.currentReport.income && this.currentReport.income.length > 0) {
        // Draw table header with professional gray
        pdf.setFillColor(245, 245, 245);
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(margin, yPos - 4, contentWidth, 5, "FD");
        pdf.setFont("NotoSerif", "bold");
        pdf.setFontSize(8);
        pdf.text("Item", colItem, yPos);
        pdf.text("Date", colDate, yPos);
        pdf.text("Person", colPerson, yPos);
        pdf.text("Paid By", colPaidBy, yPos);
        pdf.text("Amount", colAmount, yPos, { align: "right" });
        yPos += 5;

        pdf.setFont("NotoSerif", "normal");

        // Process income items with avatars
        for (let idx = 0; idx < this.currentReport.income.length; idx++) {
          const item = this.currentReport.income[idx];
          const investor = this.investors.find(
            (inv) => inv.investorId === item.personInCharge,
          );
          const paidByData = getPaidByForPDF(item.paidBy);
          const dateStr = item.date
            ? new Date(item.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "-";

          // Wrap item text into multiple lines
          const itemText = item.item;
          const itemLines = wrapText(itemText, 58); // max width for item column
          const mainLineHeight = 4;
          const itemHeight = Math.max(itemLines.length * mainLineHeight, 6);

          // Check if there are details to show and wrap them
          const hasDetails = item.details && item.details.trim().length > 0;
          let detailsLines = [];
          let detailsHeight = 0;

          if (hasDetails) {
            // Strip diacritics to prevent font breaking in jsPDF (standard fonts don't support Vietnamese)
            const detailsText = item.details;
            pdf.setFontSize(7);
            // Use wrapMultiLineText to handle newlines properly
            detailsLines = wrapMultiLineText(detailsText, contentWidth - 8);
            pdf.setFontSize(8);
            // Calculate height: 3.2mm per line + 3mm padding between item and details
            detailsHeight =
              detailsLines.length > 0 ? detailsLines.length * 3.2 + 3 : 0;
          }

          const totalRowHeight = itemHeight + detailsHeight;

          // Check if we need a new page
          if (yPos + totalRowHeight > pdf.internal.pageSize.getHeight() - 20) {
            pdf.addPage();
            yPos = 20;
          }

          // Draw alternating row background
          if (idx % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, yPos - 1, contentWidth, totalRowHeight + 2, "F");
          }

          // Store starting Y position for this row
          const rowStartY = yPos;

          // Draw item text (multi-line)
          pdf.setFontSize(8);
          itemLines.forEach((line, lineIdx) => {
            pdf.text(line, colItem, rowStartY + lineIdx * mainLineHeight);
          });

          // Draw other columns on first line
          pdf.text(dateStr, colDate, rowStartY);

          // Show last word of investor name
          if (investor) {
            const lastName = getLastWord(investor.name);
            pdf.text(lastName, colPerson, rowStartY);
          }

          // Paid by - show name with badge next to it
          const paidByName = paidByData.name;
          pdf.text(paidByName, colPaidBy, rowStartY);

          // Add room type badge next to name if available
          if (paidByData.roomType) {
            const nameWidth = pdf.getTextWidth(paidByName);
            const badgeX = colPaidBy + nameWidth + 1.5;

            pdf.setFontSize(6);
            pdf.setFillColor(108, 117, 125);
            pdf.setDrawColor(108, 117, 125);
            const badgeText = paidByData.roomType;
            const badgeWidth = pdf.getTextWidth(badgeText) + 2;
            const badgeHeight = 2.5;

            pdf.roundedRect(
              badgeX,
              rowStartY - 2.2,
              badgeWidth,
              badgeHeight,
              0.5,
              0.5,
              "FD",
            );
            pdf.setTextColor(255, 255, 255);
            pdf.text(badgeText, badgeX + 1, rowStartY - 0.2);
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
          }

          // Draw amount
          pdf.setTextColor(0, 128, 0);
          pdf.text(`$${item.amount.toFixed(2)}`, colAmount, rowStartY, {
            align: "right",
          });
          pdf.setTextColor(0, 0, 0);

          // Draw details below item if available
          if (detailsLines.length > 0) {
            const detailsStartY = rowStartY + itemHeight + 2;
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont("NotoSerif", "normal");

            detailsLines.forEach((line, lineIdx) => {
              // Only draw non-empty lines
              if (line.trim() !== "") {
                pdf.text(line, colItem + 2, detailsStartY + lineIdx * 3.2);
              }
            });

            pdf.setFont("NotoSerif", "normal");
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
          }

          yPos += totalRowHeight + 1;
        }

        yPos += 2;
        pdf.setFont("NotoSerif", "bold");
        pdf.setTextColor(0, 128, 0);
        pdf.text("Total:", pageWidth - margin - 35, yPos);
        pdf.text(
          `$${this.currentReport.totalIncome.toFixed(2)}`,
          colAmount,
          yPos,
          { align: "right" },
        );

        pdf.setTextColor(0, 0, 0);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        yPos += 6;
      } else {
        pdf.setFont("NotoSerif", "normal");
        pdf.text("No income items", margin + 1, yPos);
        yPos += 6;
      }

      // EXPENSES SECTION
      pdf.setFont("NotoSerif", "bold");
      pdf.setFontSize(11);
      pdf.text("EXPENSES", margin, yPos);
      yPos += 5;

      pdf.setFontSize(8);

      if (
        this.currentReport.expenses &&
        this.currentReport.expenses.length > 0
      ) {
        // Draw table header (same columns as income, with Paid To)
        pdf.setFillColor(245, 245, 245);
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(margin, yPos - 4, contentWidth, 5, "FD");
        pdf.setFont("NotoSerif", "bold");
        pdf.text("Item", colItem, yPos);
        pdf.text("Date", colDate, yPos);
        pdf.text("Person", colPerson, yPos);
        pdf.text("Paid To", colPaidBy, yPos);
        pdf.text("Amount", colAmount, yPos, { align: "right" });
        yPos += 5;

        pdf.setFont("NotoSerif", "normal");

        // Process expense items with avatars
        for (let idx = 0; idx < this.currentReport.expenses.length; idx++) {
          const item = this.currentReport.expenses[idx];
          const investor = this.investors.find(
            (inv) => inv.investorId === item.personInCharge,
          );
          const paidToData = getPaidByForPDF(
            item.paidTo === "unknown" ? null : item.paidTo,
          );
          const paidToDisplayName =
            item.paidTo === "unknown" ? "Unknown" : paidToData.name;
          const dateStr = item.date
            ? new Date(item.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "-";

          // Wrap item text into multiple lines
          const itemText = item.item;
          const itemLines = wrapText(itemText, 58); // max width for item column
          const mainLineHeight = 4;
          const itemHeight = Math.max(itemLines.length * mainLineHeight, 6);

          // Check if there are details to show and wrap them
          const hasDetails = item.details && item.details.trim().length > 0;
          let detailsLines = [];
          let detailsHeight = 0;

          if (hasDetails) {
            // Strip diacritics to prevent font breaking in jsPDF (standard fonts don't support Vietnamese)
            const detailsText = item.details;
            pdf.setFontSize(7);
            // Use wrapMultiLineText to handle newlines properly
            detailsLines = wrapMultiLineText(detailsText, contentWidth - 8);
            pdf.setFontSize(8);
            // Calculate height: 3.2mm per line + 3mm padding between item and details
            detailsHeight =
              detailsLines.length > 0 ? detailsLines.length * 3.2 + 3 : 0;
          }

          const totalRowHeight = itemHeight + detailsHeight;

          // Check if we need a new page
          if (yPos + totalRowHeight > pdf.internal.pageSize.getHeight() - 20) {
            pdf.addPage();
            yPos = 20;
          }

          // Draw alternating row background
          if (idx % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, yPos - 1, contentWidth, totalRowHeight + 2, "F");
          }

          // Store starting Y position for this row
          const rowStartY = yPos;

          // Draw item text (multi-line)
          pdf.setFontSize(8);
          itemLines.forEach((line, lineIdx) => {
            pdf.text(line, colItem, rowStartY + lineIdx * mainLineHeight);
          });

          // Draw other columns on first line
          pdf.text(dateStr, colDate, rowStartY);

          // Show last word of investor name
          if (investor) {
            const lastName = getLastWord(investor.name);
            pdf.text(lastName, colPerson, rowStartY);
          }

          // Paid To column
          const paidToName = paidToDisplayName;
          if (paidToName && paidToName !== "-") {
            pdf.text(paidToName, colPaidBy, rowStartY);
            if (paidToData.roomType) {
              const nameWidth = pdf.getTextWidth(paidToName);
              const badgeX = colPaidBy + nameWidth + 1.5;
              pdf.setFontSize(6);
              pdf.setFillColor(108, 117, 125);
              pdf.setDrawColor(108, 117, 125);
              const badgeText = paidToData.roomType;
              const badgeWidth = pdf.getTextWidth(badgeText) + 2;
              const badgeHeight = 2.5;
              pdf.roundedRect(
                badgeX,
                rowStartY - 2.2,
                badgeWidth,
                badgeHeight,
                0.5,
                0.5,
                "FD",
              );
              pdf.setTextColor(255, 255, 255);
              pdf.text(badgeText, badgeX + 1, rowStartY - 0.2);
              pdf.setTextColor(0, 0, 0);
              pdf.setFontSize(8);
            }
          }

          // Draw amount
          pdf.setTextColor(128, 0, 0);
          pdf.text(`$${item.amount.toFixed(2)}`, colAmount, rowStartY, {
            align: "right",
          });
          pdf.setTextColor(0, 0, 0);

          // Draw details below item if available
          if (detailsLines.length > 0) {
            const detailsStartY = rowStartY + itemHeight + 2;
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont("NotoSerif", "normal");

            detailsLines.forEach((line, lineIdx) => {
              // Only draw non-empty lines
              if (line.trim() !== "") {
                pdf.text(line, colItem + 2, detailsStartY + lineIdx * 3.2);
              }
            });

            pdf.setFont("NotoSerif", "normal");
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
          }

          yPos += totalRowHeight + 1;
        }

        yPos += 2;
        pdf.setFont("NotoSerif", "bold");
        pdf.setTextColor(128, 0, 0);
        pdf.text("Total:", pageWidth - margin - 35, yPos);
        pdf.text(
          `$${this.currentReport.totalExpenses.toFixed(2)}`,
          colAmount,
          yPos,
          { align: "right" },
        );

        pdf.setTextColor(0, 0, 0);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        yPos += 6;
      } else {
        pdf.setFont("NotoSerif", "normal");
        pdf.text("No expense items", margin + 1, yPos);
        yPos += 6;
      }

      // NET PROFIT SECTION
      const netProfit =
        (this.currentReport.totalIncome || 0) -
        (this.currentReport.totalExpenses || 0);

      // Add spacing before NET PROFIT
      yPos += 6;

      // NET PROFIT - no box, no background
      pdf.setFontSize(10);
      pdf.setFont("NotoSerif", "bold");
      pdf.text("NET PROFIT:", margin, yPos);
      pdf.setTextColor(netProfit >= 0 ? 0 : 150, netProfit >= 0 ? 100 : 0, 0);
      pdf.setFontSize(11);
      pdf.text(`$${netProfit.toFixed(2)}`, pageWidth - margin, yPos, {
        align: "right",
      });
      pdf.setTextColor(0, 0, 0);

      // Add spacing after NET PROFIT
      yPos += 10;

      // INVESTOR DISTRIBUTION SECTION
      // Check if report is closed and has snapshot data - use frozen snapshot instead of recalculating
      const isClosed = this.currentReport && this.currentReport.isClosed;
      const hasSnapshot =
        this.currentReport &&
        this.currentReport.investorSnapshot &&
        this.currentReport.investorSnapshot.length > 0;

      // Determine which data source to use
      const investorDataSource =
        isClosed && hasSnapshot
          ? this.currentReport.investorSnapshot
          : this.investors;

      if (investorDataSource && investorDataSource.length > 0) {
        pdf.setFontSize(11);
        pdf.setFont("NotoSerif", "bold");
        pdf.text("INVESTOR DISTRIBUTION", margin, yPos);
        yPos += 5;

        pdf.setFontSize(8);
        pdf.setFillColor(245, 245, 245);
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(margin, yPos - 4, contentWidth, 5, "FD");
        pdf.setFont("NotoSerif", "bold");
        pdf.text("Investor", margin + 1, yPos);
        pdf.text("Share", margin + 48, yPos);
        pdf.text("Profit", margin + 63, yPos);
        pdf.text("Paid", margin + 85, yPos);
        pdf.text("Received", margin + 107, yPos);
        pdf.text("Final", pageWidth - margin - 1, yPos, { align: "right" });
        yPos += 5;

        pdf.setFont("NotoSerif", "normal");

        // Process investor distribution
        for (let idx = 0; idx < investorDataSource.length; idx++) {
          let investorName,
            percentage,
            investorShare,
            expensesPaid,
            incomeReceived,
            finalAmount;

          if (isClosed && hasSnapshot) {
            // Use snapshot data (frozen at time of closing)
            const snapshotData = investorDataSource[idx];
            investorName = snapshotData.name;
            percentage = snapshotData.percentage;
            investorShare = snapshotData.profitShare;
            expensesPaid = snapshotData.paidAmount;
            incomeReceived = snapshotData.receivedAmount;
            finalAmount = snapshotData.finalAmount;
          } else {
            // Calculate dynamically (for open reports)
            const investor = investorDataSource[idx];
            investorName = investor.name;
            // Try to get percentage from report's investorTransactions (snapshot) first
            const investorTransaction =
              this.currentReport?.investorTransactions?.find(
                (t) => t.investorId === investor.investorId,
              );
            // Fall back to live investor data if no snapshot exists
            const propertyData = investor.properties.find(
              (p) => p.propertyId === this.selectedProperty,
            );
            percentage =
              investorTransaction?.percentage ??
              (propertyData ? propertyData.percentage : 0);
            investorShare = (netProfit * percentage) / 100;

            expensesPaid = this.currentReport.expenses
              ? this.currentReport.expenses
                  .filter((e) => e.personInCharge === investor.investorId)
                  .reduce((sum, e) => sum + e.amount, 0)
              : 0;

            incomeReceived = this.currentReport.income
              ? this.currentReport.income
                  .filter((i) => i.personInCharge === investor.investorId)
                  .reduce((sum, i) => sum + i.amount, 0)
              : 0;

            finalAmount = investorShare + expensesPaid - incomeReceived;
          }

          // Alternating row colors
          if (idx % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, yPos - 3.5, contentWidth, 4, "F");
          }

          // Show investor name
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(8);
          let truncInvName = investorName;
          truncInvName =
            truncInvName.length > 30
              ? truncInvName.substring(0, 28) + ".."
              : truncInvName;
          pdf.text(truncInvName, margin + 1, yPos);

          pdf.text(`${percentage}%`, margin + 48, yPos);
          pdf.text(`$${investorShare.toFixed(2)}`, margin + 63, yPos);
          pdf.text(`$${expensesPaid.toFixed(2)}`, margin + 85, yPos);
          pdf.text(`$${incomeReceived.toFixed(2)}`, margin + 107, yPos);
          pdf.setTextColor(
            finalAmount >= 0 ? 0 : 150,
            finalAmount >= 0 ? 100 : 0,
            0,
          );
          pdf.setFont("NotoSerif", "bold");
          pdf.text(`$${finalAmount.toFixed(2)}`, pageWidth - margin - 1, yPos, {
            align: "right",
          });
          pdf.setFont("NotoSerif", "normal");
          pdf.setTextColor(0, 0, 0);
          yPos += 4;
        }
      }

      // Download PDF
      const fileNameBase = property
        ? `${removeDiacritics(property.propertyId)}_${removeDiacritics(property.unit)}`
        : this.selectedProperty;
      const fileName = `Financial_Report_${fileNameBase}_${removeDiacritics(monthName).replace(/\s+/g, "_")}.pdf`;
      pdf.save(fileName);

      this.showSuccess(i18next.t("financialReport.exportPdfSuccess"));
    } catch (error) {
      console.error("Export error:", error);
      this.showError(`Failed to export financial report: ${error.message}`);
    } finally {
      // Restore button state
      const exportBtn = document.getElementById("exportFinancialReportBtn");
      exportBtn.innerHTML = '<i class="bi bi-file-pdf"></i>';
      exportBtn.disabled = false;
      this._isExporting = false;
    }
  }

  async getPropertyDetails(propertyId) {
    // First try to find in cached properties
    if (this.properties && this.properties.length > 0) {
      const cached = this.properties.find((p) => p.propertyId === propertyId);
      if (cached) {
        console.log("Using cached property:", cached);
        return cached;
      }
    }

    // If not in cache, fetch from API
    try {
      const response = await fetch(`${API_BASE_URL}/properties/${propertyId}`, {
        headers: {
          "x-api-key": API_KEY,
        },
      });
      if (response.ok) {
        const property = await response.json();
        console.log("Fetched property from API:", property);
        return property;
      }
    } catch (error) {
      console.error("Error fetching property details:", error);
    }
    return null;
  }

  async printFinancialReport() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }

    try {
      // Prepare report for export
      await this.prepareReportForExport();

      // Wait for DOM updates
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Trigger print dialog
      window.print();

      // Restore UI after a delay (to allow print dialog to open)
      setTimeout(() => {
        this.restoreReportAfterExport();
      }, 500);
    } catch (error) {
      console.error("Print error:", error);
      this.showError(`Failed to print financial report: ${error.message}`);
      this.restoreReportAfterExport();
    }
  }

  async captureScreenshot() {
    if (!this.selectedProperty || !this.currentReport) {
      alert("Please select a property and load financial data first");
      return;
    }

    const btn = document.getElementById("captureScreenshotBtn");
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.innerHTML =
      '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    btn.title = "Exporting…";
    btn.disabled = true;

    try {
      const svgStr = await this._generateReportSVG();
      const blob = await this._svgToPngBlob(svgStr);

      // Show preview modal first (non-blocking)
      this._showReportImagePreview(blob);

      // Also copy to clipboard (best-effort)
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        const isMac = /Mac|iPhone|iPad|iPod/.test(
          navigator.platform || navigator.userAgent,
        );
        const pasteKey = isMac ? "⌘ Cmd+V" : "Ctrl+V";
        const title = i18next.t("financialReport.exportCopied");
        const hint = i18next.t("financialReport.exportPasteHint", { key: pasteKey });
        showToast(`${title} ${hint}`, "success", 5000);
      } catch (_clipErr) {
        // Clipboard copy is optional — preview modal is the primary deliverable
      }

      btn.innerHTML = '<i class="bi bi-check-circle"></i>';
      btn.classList.remove("btn-light");
      btn.classList.add("btn-success");

      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.title = "Capture Screenshot";
        btn.classList.remove("btn-success");
        btn.classList.add("btn-light");
        btn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error("Report capture error:", error);
      alert(`Failed to capture report: ${error.message}`);
      btn.innerHTML = originalHTML;
      btn.title = "Capture Screenshot";
      btn.disabled = false;
    }
  }

  /** Show exported report image in a Bootstrap preview modal */
  _showReportImagePreview(blob) {
    const objectUrl = URL.createObjectURL(blob);

    // Build filename for the download link
    const property = this.properties?.find(p => p.propertyId === this.selectedProperty);
    const date = this.currentDate || new Date();
    const monthName = date.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
    const safeName = (property
      ? `${property.propertyId}_${property.unit}`
      : this.selectedProperty || 'report'
    ).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Financial_Report_${safeName}_${monthName.replace(/\s+/g, '_')}.png`;

    // Remove any stale preview modal
    document.getElementById('frImagePreviewModal')?.remove();

    const modalHtml = `
      <div class="modal fade" id="frImagePreviewModal" tabindex="-1"
           aria-labelledby="frImagePreviewModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content" style="border-radius:16px;overflow:hidden;">
            <div class="modal-header border-0 pb-0" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
              <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle bg-white d-flex align-items-center justify-content-center"
                     style="width:32px;height:32px;flex-shrink:0;">
                  <i class="bi bi-image text-primary" style="font-size:1rem;"></i>
                </div>
                <h6 class="modal-title text-white fw-bold mb-0" id="frImagePreviewModalLabel">
                  Report Preview
                  <small class="fw-normal opacity-75 ms-2" style="font-size:0.75rem;">${monthName}</small>
                </h6>
              </div>
              <button type="button" class="btn-close btn-close-white ms-auto"
                      data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0 text-center bg-dark" style="min-height:200px;">
              <img id="frPreviewImg" src="${objectUrl}" alt="Financial Report"
                   style="max-width:100%;display:block;margin:0 auto;" />
            </div>
            <div class="modal-footer border-0 justify-content-between"
                 style="background:#f8f9fa;">
              <div class="text-muted" style="font-size:0.78rem;">
                <i class="bi bi-keyboard me-1"></i>Press <kbd>Esc</kbd> to close
              </div>
              <div class="d-flex gap-2">
                <a id="frPreviewDownloadBtn" href="${objectUrl}" download="${fileName}"
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

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modalEl = document.getElementById('frImagePreviewModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });

    // Revoke object URL when the modal is fully hidden to free memory
    modalEl.addEventListener('hidden.bs.modal', () => {
      URL.revokeObjectURL(objectUrl);
      modalEl.remove();
    }, { once: true });

    // Explicit Escape handler — dynamically created modals can miss Bootstrap's built-in keyboard trap
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        modal.hide();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    modalEl.addEventListener('hidden.bs.modal', () => {
      document.removeEventListener('keydown', onKeyDown);
    }, { once: true });

    modal.show();
  }

  /** Convert an SVG string to a high-resolution PNG Blob (2× scale) */
  _svgToPngBlob(svgStr) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext("2d");
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

  /** Deterministic avatar background color derived from person name */
  _getAvatarColor(name) {
    const palette = [
      "#ef4444",
      "#f97316",
      "#eab308",
      "#22c55e",
      "#14b8a6",
      "#3b82f6",
      "#8b5cf6",
      "#ec4899",
    ];
    let h = 0;
    const s = name || "?";
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  /** Truncate text to maxChars, appending ellipsis if needed */
  _svgTrunc(text, maxChars) {
    if (!text) return "";
    return text.length > maxChars
      ? text.substring(0, maxChars - 1) + "\u2026"
      : text;
  }

  /** XML-escape a value for safe embedding in SVG attributes / text */
  _svgEsc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Collect investor rows for SVG, respecting closed-report snapshot */
  _getInvestorDataForSVG() {
    const isClosed = this.currentReport?.isClosed;
    const snapshot = this.currentReport?.investorSnapshot;
    if (isClosed && snapshot?.length > 0) {
      return snapshot.map((s) => ({
        name: s.name,
        avatar: s.avatar || null,
        percentage: s.percentage,
        profitShare: s.profitShare,
        paidAmount: s.paidAmount,
        receivedAmount: s.receivedAmount,
        finalAmount: s.finalAmount,
      }));
    }

    if (!this.investors || this.investors.length === 0) return [];

    const netProfit = this.currentReport
      ? (this.currentReport.totalIncome || 0) -
        (this.currentReport.totalExpenses || 0)
      : 0;

    return this.investors.map((investor) => {
      const tx = this.currentReport?.investorTransactions?.find(
        (t) => t.investorId === investor.investorId,
      );
      const propData = investor.properties?.find(
        (p) => p.propertyId === this.selectedProperty,
      );
      const percentage = tx?.percentage ?? (propData ? propData.percentage : 0);
      const profitShare = (netProfit * percentage) / 100;
      const paidAmount = (this.currentReport?.expenses || [])
        .filter((e) => e.personInCharge === investor.investorId)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      const receivedAmount = (this.currentReport?.income || [])
        .filter((i) => i.personInCharge === investor.investorId)
        .reduce((sum, i) => sum + (i.amount || 0), 0);
      return {
        name: investor.name,
        avatar: investor.avatar || null,
        percentage,
        profitShare,
        paidAmount,
        receivedAmount,
        finalAmount: profitShare + paidAmount - receivedAmount,
      };
    });
  }

  /** Fetch avatar images and return a map of original URL → base64 data URI */
  async _fetchAvatarsAsBase64() {
    const urls = new Set();
    this.investors.forEach((inv) => inv.avatar && urls.add(inv.avatar));
    this.allInvestors?.forEach((inv) => inv.avatar && urls.add(inv.avatar));
    (this.currentReport?.investorSnapshot || []).forEach(
      (s) => s.avatar && urls.add(s.avatar),
    );
    this.tenants?.forEach((t) => t.avatar && urls.add(t.avatar));

    const cache = {};
    await Promise.all(
      [...urls].map(async (url) => {
        try {
          const optimized = this.getOptimizedAvatarUrl(url, "small");
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
   * Build a professional SVG financial report string.
   * Entirely separate from the web UI — pure vector, stays crisp at any zoom.
   */
  async _generateReportSVG() {
    const report = this.currentReport;
    const income = report.income || [];
    const expenses = report.expenses || [];
    const investorData = this._getInvestorDataForSVG();

    // Pre-fetch avatar images → base64 data URIs (for circular photo avatars)
    const avatarCache = await this._fetchAvatarsAsBase64();

    // Fetch brand logo as base64 for embedding in SVG
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

    // Fetch Noto Serif as base64 for @font-face embedding — required for canvas rendering
    const _toB64DataUri = async (url) => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const bytes = new Uint8Array(buf);
        let s = "";
        for (let i = 0; i < bytes.length; i++)
          s += String.fromCharCode(bytes[i]);
        return `data:font/truetype;base64,${btoa(s)}`;
      } catch {
        return null;
      }
    };
    const [fontRegUri, fontBoldUri] = await Promise.all([
      _toB64DataUri("/fonts/NotoSerif-Regular.ttf"),
      _toB64DataUri("/fonts/NotoSerif-Bold.ttf"),
    ]);
    const fontFaceStyle =
      fontRegUri || fontBoldUri
        ? `<style>
      @font-face { font-family: 'Noto Serif'; font-weight: 400; src: url('${fontRegUri}') format('truetype'); }
      @font-face { font-family: 'Noto Serif'; font-weight: 700; src: url('${fontBoldUri}') format('truetype'); }
    </style>`
        : "";

    // Property info
    const property = this.properties?.find(
      (p) => p.propertyId === this.selectedProperty,
    );
    // Single title: unit · address (postcode omitted if already in address string)
    const propTitle = property
      ? (() => {
          const addr = property.address || "";
          const pc = property.postcode || "";
          const pcPart = pc && !addr.includes(pc) ? pc : "";
          return (
            [property.unit, addr, pcPart].filter(Boolean).join("  ·  ") ||
            property.name ||
            property.propertyId
          );
        })()
      : this.selectedProperty;

    // Date labels
    const MONTH_NAMES = [
      "JANUARY",
      "FEBRUARY",
      "MARCH",
      "APRIL",
      "MAY",
      "JUNE",
      "JULY",
      "AUGUST",
      "SEPTEMBER",
      "OCTOBER",
      "NOVEMBER",
      "DECEMBER",
    ];
    const monthYear = `${MONTH_NAMES[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;
    const genDate = new Date().toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Totals
    const totalIncome = report.totalIncome || 0;
    const totalExpenses = report.totalExpenses || 0;
    const netProfit = totalIncome - totalExpenses;

    // Layout constants
    const W = 800;
    const M = 24;
    const CW = W - M * 2; // 752
    const COL_GAP = 8;
    const COL_W = (CW - COL_GAP) / 2; // 372

    const HEADER_H = 90;
    const SUMMARY_H = 58;
    const SEC_H = 32;
    const THDR_H = 22;
    const INV_ROW_H = 40; // fixed height for investor rows
    const SEC_PAD = 10;

    const nodes = [];
    const defs = []; // SVG <defs> for avatar clip paths
    let y = 0;
    let clipIdx = 0;
    const p = (s) => nodes.push(s);

    // Helper: render a circular avatar (photo if available, else fallback colored initial)
    // fallbackColor matches UI: investors → Bootstrap bg-secondary (#6c757d), tenants → bg-info (#0dcaf0-ish → #17a2b8)
    const renderCircleAvatar = (
      avatarUrl,
      name,
      cx,
      cy,
      r = 14,
      fallbackColor = "#6c757d",
    ) => {
      const dataUri = avatarUrl ? avatarCache[avatarUrl] : null;
      if (dataUri) {
        const clipId = `ac${clipIdx++}`;
        defs.push(
          `<clipPath id="${clipId}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`,
        );
        p(
          `<image href="${dataUri}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`,
        );
      } else {
        p(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fallbackColor}"/>`);
        p(
          `<text x="${cx}" y="${cy + Math.round(r * 0.44)}" font-size="${Math.round(r * 0.95)}" fill="#ffffff" font-weight="700" text-anchor="middle">${this._svgEsc((name || "?").charAt(0).toUpperCase())}</text>`,
        );
      }
    };

    // Render a compact cluster of person avatars + short name + optional room badge
    // Used for paidBy (income) and paidTo (expense) rows in the exported image
    const renderPersonCluster = (persons, colX, rowY) => {
      const R = 9;
      const STEP = R * 2 - 3; // 3px overlap between avatars
      const startX = colX + 34;

      // Small arrow indicator
      p(
        `<text x="${startX}" y="${rowY + R + 3}" font-size="9" fill="#94a3b8" font-weight="600">→</text>`,
      );

      const avatarStartX = startX + 13;
      persons.forEach((person, idx) => {
        const cx = avatarStartX + R + idx * STEP;
        const cy = rowY + R;
        if (person.isUnknown) {
          p(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="#f59e0b"/>`);
          p(
            `<text x="${cx}" y="${cy + 4}" font-size="9" fill="#fff" font-weight="700" text-anchor="middle">?</text>`,
          );
        } else {
          const fallback = person.isTenant ? "#0ea5e9" : "#6c757d";
          renderCircleAvatar(
            person.avatar || null,
            person.displayName,
            cx,
            cy,
            R,
            fallback,
          );
        }
        // White border ring between overlapping circles
        p(
          `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#fff" stroke-width="1.5"/>`,
        );
      });

      const clusterW = R * 2 + (persons.length - 1) * STEP;
      const textX = avatarStartX + clusterW + 5;

      // Last-word name(s)
      const nameStr = persons
        .map((q) => {
          if (q.isUnknown) return "Unknown";
          const parts = q.displayName.trim().split(/\s+/);
          return parts.length > 1 ? parts[parts.length - 1] : parts[0];
        })
        .join(", ");
      p(
        `<text x="${textX}" y="${rowY + R + 4}" font-size="10" fill="${META_TXT}">${this._svgEsc(nameStr)}</text>`,
      );

      // Room type badge (first person that has one)
      const withRoom = persons.find((q) => q?.roomType);
      if (withRoom) {
        const approxNameW = nameStr.length * 5.8;
        const badgeX = textX + approxNameW + 4;
        const badgeText = this._svgEsc(
          this.getRoomTypeDisplayName(withRoom.roomType),
        );
        const badgeW = badgeText.length * 5.5 + 8;
        p(
          `<rect x="${badgeX}" y="${rowY + 1}" width="${badgeW}" height="${R * 2 - 2}" rx="4" fill="#dbeafe"/>`,
        );
        p(
          `<text x="${badgeX + badgeW / 2}" y="${rowY + R + 3}" font-size="8" fill="${COL_HDR_TXT}" text-anchor="middle" font-weight="600">${badgeText}</text>`,
        );
      }
    };

    // ── Colour palette ────────────────────────────────────────────
    const BRAND = "#2aabb5"; // teal (header bg, logo)
    const DEEP_BLUE = "#1548a1"; // section headers, column labels
    const COL_HDR_BG = "#dbeafe"; // column header row bg
    const COL_HDR_TXT = "#1548a1"; // column header text
    const ROW_ALT_BG = "#f0f7ff"; // alternating row tint
    const ROW_DIV = "#bfdbfe"; // row / section separator lines
    const SUMMARY_BG = "#f0f7ff"; // summary bar bg
    const FOOTER_BG = "#f0f7ff"; // footer bg
    const ITEM_CNT = "#93c5fd"; // item-count text in section header
    const META_TXT = "#64748b"; // subtitle / date / currency
    const INCOME_CLR = "#16a34a";
    const EXPENSE_CLR = "#dc2626";

    // ── Header ────────────────────────────────────────────────────
    const LOGO_SIZE = 52;
    const LOGO_X = M;
    const LOGO_Y = Math.round((HEADER_H - LOGO_SIZE) / 2);
    p(
      `<rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="${DEEP_BLUE}"/>`,
    );
    // Brand logo
    if (logoDataUri) {
      p(
        `<image href="${logoDataUri}" x="${LOGO_X}" y="${LOGO_Y}" width="${LOGO_SIZE}" height="${LOGO_SIZE}"/>`,
      );
    }
    // Header text (offset right of logo)
    const TX = LOGO_X + (logoDataUri ? LOGO_SIZE + 10 : 0);
    p(
      `<text x="${TX}" y="24" font-size="11" fill="#ffffff" font-weight="600" letter-spacing="2" opacity="0.7">FINANCIAL REPORT</text>`,
    );
    p(
      `<text x="${W - M}" y="26" font-size="17" fill="#ffffff" font-weight="700" text-anchor="end">${this._svgEsc(monthYear)}</text>`,
    );
    p(
      `<text x="${TX}" y="62" font-size="20" fill="#ffffff" font-weight="700">${this._svgEsc(propTitle)}</text>`,
    );
    p(
      `<text x="${W - M}" y="80" font-size="12" fill="#ffffff" text-anchor="end" opacity="0.65">Generated ${this._svgEsc(genDate)}</text>`,
    );
    if (report.isClosed) {
      p(
        `<rect x="${W - M - 66}" y="6" width="62" height="16" rx="8" fill="#dc2626"/>`,
      );
      p(
        `<text x="${W - M - 35}" y="18" font-size="10" fill="#ffffff" font-weight="700" text-anchor="middle" letter-spacing="1">CLOSED</text>`,
      );
    }
    y = HEADER_H;

    // ── PUB overage strip (only when utility bill exceeds subsidizedPub) ──────
    const _ovBill = this._findOverlappingUtilityBill();
    if (_ovBill) {
      const OVPUB_H = 30;
      const _excess = (_ovBill.totalAmount || 0) - this.propertySubsidy;
      const _fmtD = (v) =>
        v
          ? new Date(v).toLocaleDateString("en-SG", {
              day: "2-digit",
              month: "short",
            })
          : null;
      const _period =
        _ovBill.billingPeriodStart || _ovBill.billingPeriodEnd
          ? `${_fmtD(_ovBill.billingPeriodStart) || "?"} – ${_fmtD(_ovBill.billingPeriodEnd) || "?"}`
          : `${_ovBill.month}/${_ovBill.year}`;
      const _detail = this._svgEsc(
        `${_period}  ·  Bill $${(_ovBill.totalAmount || 0).toFixed(2)}  ·  Max $${this.propertySubsidy.toFixed(2)}`,
      );
      const _badgeTxt = this._svgEsc(`+$${_excess.toFixed(2)}`);
      const _badgeW = _excess.toFixed(2).length * 7 + 28;
      // Strip background + left accent
      p(
        `<rect x="0" y="${y}" width="${W}" height="${OVPUB_H}" fill="#fff1f0"/>`,
      );
      p(`<rect x="0" y="${y}" width="5" height="${OVPUB_H}" fill="#dc2626"/>`);
      p(
        `<line x1="0" y1="${y + OVPUB_H}" x2="${W}" y2="${y + OVPUB_H}" stroke="#fca5a5" stroke-width="1"/>`,
      );
      // Label
      p(
        `<text x="14" y="${y + 19}" font-size="11" fill="#991b1b" font-weight="700" letter-spacing="0.5">PUB OVERAGE</text>`,
      );
      // Detail
      p(
        `<text x="110" y="${y + 19}" font-size="11" fill="#7f1d1d">${_detail}</text>`,
      );
      // Badge pill
      p(
        `<rect x="${W - M - _badgeW}" y="${y + 6}" width="${_badgeW}" height="18" rx="9" fill="#dc2626"/>`,
      );
      p(
        `<text x="${W - M - _badgeW / 2}" y="${y + 19}" font-size="11" fill="#ffffff" font-weight="700" text-anchor="middle">${_badgeTxt}</text>`,
      );
      y += OVPUB_H;
    }

    // ── Per-item metadata: wrapped description lines + subtitle text + row height ──
    const wrapText = (text, maxChars) => {
      if (!text) return [""];
      const words = text.split(/\s+/);
      const lines = [];
      let line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (test.length <= maxChars) {
          line = test;
        } else {
          if (line) lines.push(line);
          line = w; // single word exceeds limit: just place it alone
        }
      }
      if (line) lines.push(line);
      return lines.length ? lines : [""];
    };

    // Build row metadata for income (includes paidBy avatar cluster)
    const makeIncomeMeta = (item) => {
      const descLines = wrapText(item.item || "", 36);
      const noteLines = item.details ? wrapText(item.details, 42) : [];
      const subtitle = item.date
        ? new Date(item.date).toLocaleDateString("en-SG", {
            day: "2-digit",
            month: "short",
          })
        : "";
      const paidByList = Array.isArray(item.paidBy)
        ? item.paidBy.filter(Boolean)
        : item.paidBy
          ? [item.paidBy]
          : [];
      const paidByPersons = paidByList
        .map((pv) => {
          const resolved = this._resolvePaidByPerson(pv);
          if (!resolved) return null;
          return {
            ...resolved,
            isTenant: typeof pv === "string" && pv.startsWith("tenant_"),
          };
        })
        .filter(Boolean);
      const rowH = Math.max(
        40,
        4 +
          descLines.length * 16 +
          noteLines.length * 14 +
          (subtitle ? 15 : 0) +
          (paidByPersons.length > 0 ? 22 : 0) +
          4,
      );
      return { descLines, noteLines, subtitle, paidByPersons, rowH };
    };

    // Build row metadata for expenses (date + paidTo avatar cluster)
    const makeExpenseMeta = (item) => {
      const descLines = wrapText(item.item || "", 36);
      const noteLines = item.details ? wrapText(item.details, 42) : [];
      const subtitle = item.date
        ? new Date(item.date).toLocaleDateString("en-SG", {
            day: "2-digit",
            month: "short",
          })
        : "";
      let paidToPersons = [];
      if (item.paidTo === "unknown") {
        paidToPersons = [
          {
            displayName: "Unknown",
            avatar: null,
            roomType: null,
            isTenant: false,
            isUnknown: true,
          },
        ];
      } else if (item.paidTo) {
        const resolved = this._resolvePaidByPerson(item.paidTo);
        if (resolved) {
          paidToPersons = [
            {
              ...resolved,
              isTenant:
                typeof item.paidTo === "string" &&
                item.paidTo.startsWith("tenant_"),
            },
          ];
        }
      }
      const rowH = Math.max(
        40,
        4 +
          descLines.length * 16 +
          noteLines.length * 14 +
          (subtitle ? 15 : 0) +
          (paidToPersons.length > 0 ? 22 : 0) +
          4,
      );
      return { descLines, noteLines, subtitle, paidToPersons, rowH };
    };

    // ── 2-column section helper (dynamic row heights) ─────────────
    const renderTwoColSection = (
      items,
      metas,
      title,
      totalAmt,
      accentColor,
      rowRenderer,
    ) => {
      p(
        `<rect x="0" y="${y}" width="${W}" height="${SEC_H}" fill="${DEEP_BLUE}"/>`,
      );
      p(
        `<rect x="0" y="${y}" width="4" height="${SEC_H}" fill="${accentColor}"/>`,
      );
      p(
        `<text x="${M + 8}" y="${y + 21}" font-size="13" fill="#ffffff" font-weight="700" letter-spacing="1">${this._svgEsc(title)}</text>`,
      );
      p(
        `<text x="${W - M - 80}" y="${y + 21}" font-size="11" fill="${ITEM_CNT}" text-anchor="end">${items.length} item${items.length !== 1 ? "s" : ""}</text>`,
      );
      p(
        `<text x="${W - M}" y="${y + 21}" font-size="14" fill="#ffffff" text-anchor="end" font-weight="700">$${totalAmt.toFixed(2)}</text>`,
      );
      y += SEC_H;

      if (items.length === 0) {
        p(
          `<text x="${W / 2}" y="${y + 18}" font-size="13" fill="${ITEM_CNT}" text-anchor="middle">No items recorded</text>`,
        );
        y += 28;
      } else {
        // Column headers
        p(
          `<rect x="${M}" y="${y}" width="${COL_W}" height="${THDR_H}" fill="${COL_HDR_BG}"/>`,
        );
        p(
          `<rect x="${M + COL_W + COL_GAP}" y="${y}" width="${COL_W}" height="${THDR_H}" fill="${COL_HDR_BG}"/>`,
        );
        p(
          `<text x="${M + 26}" y="${y + 15}" font-size="10" fill="${COL_HDR_TXT}" font-weight="700" letter-spacing="0.5">DESCRIPTION</text>`,
        );
        p(
          `<text x="${M + COL_W - 4}" y="${y + 15}" font-size="10" fill="${COL_HDR_TXT}" font-weight="700" text-anchor="end">AMOUNT</text>`,
        );
        p(
          `<text x="${M + COL_W + COL_GAP + 26}" y="${y + 15}" font-size="10" fill="${COL_HDR_TXT}" font-weight="700" letter-spacing="0.5">DESCRIPTION</text>`,
        );
        p(
          `<text x="${M + CW - 4}" y="${y + 15}" font-size="10" fill="${COL_HDR_TXT}" font-weight="700" text-anchor="end">AMOUNT</text>`,
        );
        y += THDR_H;

        // Newspaper flow: first half fills left col top-to-bottom, second half fills right col
        const split = Math.ceil(items.length / 2);
        const leftItems = items.slice(0, split);
        const leftMetas = metas.slice(0, split);
        const rightItems = items.slice(split);
        const rightMetas = metas.slice(split);
        const contentStartY = y;

        let leftY = contentStartY;
        leftItems.forEach((item, li) => {
          const meta = leftMetas[li];
          const itemH = meta.rowH;
          if (li % 2 === 1)
            p(
              `<rect x="${M}" y="${leftY}" width="${COL_W}" height="${itemH}" fill="${ROW_ALT_BG}"/>`,
            );
          rowRenderer(item, meta, itemH, M, leftY, COL_W);
          p(
            `<line x1="${M}" y1="${leftY + itemH}" x2="${M + COL_W}" y2="${leftY + itemH}" stroke="${ROW_DIV}" stroke-width="1"/>`,
          );
          leftY += itemH;
        });

        let rightY = contentStartY;
        rightItems.forEach((item, ri) => {
          const meta = rightMetas[ri];
          const itemH = meta.rowH;
          if (ri % 2 === 1)
            p(
              `<rect x="${M + COL_W + COL_GAP}" y="${rightY}" width="${COL_W}" height="${itemH}" fill="${ROW_ALT_BG}"/>`,
            );
          rowRenderer(item, meta, itemH, M + COL_W + COL_GAP, rightY, COL_W);
          p(
            `<line x1="${M + COL_W + COL_GAP}" y1="${rightY + itemH}" x2="${M + CW}" y2="${rightY + itemH}" stroke="${ROW_DIV}" stroke-width="1"/>`,
          );
          rightY += itemH;
        });

        y =
          contentStartY +
          Math.max(leftY - contentStartY, rightY - contentStartY);
      }
      y += SEC_PAD;
      p(
        `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${ROW_DIV}" stroke-width="1"/>`,
      );
    };

    // ── Income rows (personInCharge avatar + description + paidBy avatar cluster) ──
    const renderIncomeRow = (item, meta, pairH, colX, rowY, colW) => {
      if (item.isPending) {
        p(
          `<rect x="${colX}" y="${rowY}" width="${colW}" height="${pairH}" fill="#fffde7"/>`,
        );
      }
      const investor = this.investors.find(
        (inv) => inv.investorId === item.personInCharge,
      );
      const name = investor ? investor.name : item.personInCharge || "?";
      const cx = colX + 16;
      const cy = rowY + Math.floor(pairH / 2);
      renderCircleAvatar(investor?.avatar || null, name, cx, cy);
      meta.descLines.forEach((line, li) => {
        p(
          `<text x="${colX + 34}" y="${rowY + 16 + li * 16}" font-size="13" fill="#0f172a">${this._svgEsc(line)}</text>`,
        );
      });
      if (meta.noteLines.length > 0) {
        const noteStartY = rowY + 16 + meta.descLines.length * 16 + 2;
        meta.noteLines.forEach((line, li) => {
          p(
            `<text x="${colX + 34}" y="${noteStartY + li * 14}" font-size="11" fill="#64748b" font-style="italic">${this._svgEsc(line)}</text>`,
          );
        });
      }
      const metaBaseY =
        rowY + 16 + meta.descLines.length * 16 + meta.noteLines.length * 14 + 2;
      if (meta.subtitle) {
        p(
          `<text x="${colX + 34}" y="${metaBaseY}" font-size="10" fill="${META_TXT}">${this._svgEsc(meta.subtitle)}</text>`,
        );
      }
      if (meta.paidByPersons && meta.paidByPersons.length > 0) {
        renderPersonCluster(
          meta.paidByPersons,
          colX,
          metaBaseY + (meta.subtitle ? 1 : -14),
        );
      }
      const amountColor = item.isPending ? "#b45309" : "#16a34a";
      p(
        `<text x="${colX + colW - 4}" y="${rowY + 16}" font-size="13" fill="${amountColor}" font-weight="700" text-anchor="end">$${(item.amount || 0).toFixed(2)}</text>`,
      );
      if (item.isPending) {
        const bW = 52;
        const bX = colX + colW - 4 - bW;
        p(
          `<rect x="${bX}" y="${rowY + 21}" width="${bW}" height="13" rx="6" fill="#f59e0b"/>`,
        );
        p(
          `<text x="${bX + bW / 2}" y="${rowY + 31}" font-size="8" fill="#7c2d12" font-weight="700" text-anchor="middle">PENDING</text>`,
        );
      } else {
        const curr = item.currency || "SGD";
        p(
          `<text x="${colX + colW - 4}" y="${rowY + 30}" font-size="10" fill="${META_TXT}" text-anchor="end">${curr}</text>`,
        );
      }
    };

    const incomeMetas = income.map(makeIncomeMeta);
    renderTwoColSection(
      income,
      incomeMetas,
      "INCOME",
      totalIncome,
      "#22c55e",
      renderIncomeRow,
    );

    // ── Expense rows (personInCharge avatar + description + paidTo avatar cluster) ──
    const renderExpenseRow = (item, meta, pairH, colX, rowY, colW) => {
      if (item.isPending) {
        p(
          `<rect x="${colX}" y="${rowY}" width="${colW}" height="${pairH}" fill="#fffde7"/>`,
        );
      }
      const investor = this.investors.find(
        (inv) => inv.investorId === item.personInCharge,
      );
      const name = investor ? investor.name : item.personInCharge || "?";
      const cx = colX + 16;
      const cy = rowY + Math.floor(pairH / 2);
      renderCircleAvatar(investor?.avatar || null, name, cx, cy);
      meta.descLines.forEach((line, li) => {
        p(
          `<text x="${colX + 34}" y="${rowY + 16 + li * 16}" font-size="13" fill="#0f172a">${this._svgEsc(line)}</text>`,
        );
      });
      if (meta.noteLines.length > 0) {
        const noteStartY = rowY + 16 + meta.descLines.length * 16 + 2;
        meta.noteLines.forEach((line, li) => {
          p(
            `<text x="${colX + 34}" y="${noteStartY + li * 14}" font-size="11" fill="#64748b" font-style="italic">${this._svgEsc(line)}</text>`,
          );
        });
      }
      const metaBaseY =
        rowY + 16 + meta.descLines.length * 16 + meta.noteLines.length * 14 + 2;
      if (meta.subtitle) {
        p(
          `<text x="${colX + 34}" y="${metaBaseY}" font-size="10" fill="${META_TXT}">${this._svgEsc(meta.subtitle)}</text>`,
        );
      }
      if (meta.paidToPersons && meta.paidToPersons.length > 0) {
        renderPersonCluster(
          meta.paidToPersons,
          colX,
          metaBaseY + (meta.subtitle ? 1 : -14),
        );
      }
      const expAmountColor = item.isPending ? "#b45309" : "#dc2626";
      p(
        `<text x="${colX + colW - 4}" y="${rowY + 16}" font-size="13" fill="${expAmountColor}" font-weight="700" text-anchor="end">$${(item.amount || 0).toFixed(2)}</text>`,
      );
      if (item.isPending) {
        const bW = 52;
        const bX = colX + colW - 4 - bW;
        p(
          `<rect x="${bX}" y="${rowY + 21}" width="${bW}" height="13" rx="6" fill="#f59e0b"/>`,
        );
        p(
          `<text x="${bX + bW / 2}" y="${rowY + 31}" font-size="8" fill="#7c2d12" font-weight="700" text-anchor="middle">PENDING</text>`,
        );
      }
    };

    const expenseMetas = expenses.map(makeExpenseMeta);
    renderTwoColSection(
      expenses,
      expenseMetas,
      "EXPENSES",
      totalExpenses,
      "#ef4444",
      renderExpenseRow,
    );

    // ── Summary bar (after expenses, before investor distribution) ─
    const netColor = netProfit >= 0 ? INCOME_CLR : EXPENSE_CLR;
    const cell = Math.floor(W / 3);
    p(
      `<rect x="0" y="${y}" width="${W}" height="${SUMMARY_H}" fill="${SUMMARY_BG}"/>`,
    );
    p(
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${ROW_DIV}" stroke-width="1"/>`,
    );
    p(
      `<text x="${cell * 0 + cell / 2}" y="${y + 16}" font-size="10" fill="${DEEP_BLUE}" text-anchor="middle" font-weight="700" letter-spacing="1.5">TOTAL INCOME</text>`,
    );
    p(
      `<text x="${cell * 0 + cell / 2}" y="${y + 44}" font-size="20" fill="${INCOME_CLR}" text-anchor="middle" font-weight="700">$${totalIncome.toFixed(2)}</text>`,
    );
    p(
      `<line x1="${cell}" y1="${y + 8}" x2="${cell}" y2="${y + SUMMARY_H - 8}" stroke="${ROW_DIV}" stroke-width="1"/>`,
    );
    p(
      `<text x="${cell * 1 + cell / 2}" y="${y + 16}" font-size="10" fill="${DEEP_BLUE}" text-anchor="middle" font-weight="700" letter-spacing="1.5">TOTAL EXPENSES</text>`,
    );
    p(
      `<text x="${cell * 1 + cell / 2}" y="${y + 44}" font-size="20" fill="${EXPENSE_CLR}" text-anchor="middle" font-weight="700">$${totalExpenses.toFixed(2)}</text>`,
    );
    p(
      `<line x1="${cell * 2}" y1="${y + 8}" x2="${cell * 2}" y2="${y + SUMMARY_H - 8}" stroke="${ROW_DIV}" stroke-width="1"/>`,
    );
    p(
      `<text x="${cell * 2 + cell / 2}" y="${y + 16}" font-size="10" fill="${DEEP_BLUE}" text-anchor="middle" font-weight="700" letter-spacing="1.5">NET PROFIT</text>`,
    );
    p(
      `<text x="${cell * 2 + cell / 2}" y="${y + 44}" font-size="20" fill="${netColor}" text-anchor="middle" font-weight="700">$${netProfit.toFixed(2)}</text>`,
    );
    p(
      `<line x1="0" y1="${y + SUMMARY_H}" x2="${W}" y2="${y + SUMMARY_H}" stroke="${ROW_DIV}" stroke-width="1"/>`,
    );
    y += SUMMARY_H;

    // ── Investor distribution ─────────────────────────────────────
    p(
      `<rect x="0" y="${y}" width="${W}" height="${SEC_H}" fill="${DEEP_BLUE}"/>`,
    );
    p(`<rect x="0" y="${y}" width="4" height="${SEC_H}" fill="${BRAND}"/>`);
    p(
      `<text x="${M + 8}" y="${y + 21}" font-size="13" fill="#ffffff" font-weight="700" letter-spacing="1">INVESTOR DISTRIBUTION</text>`,
    );
    y += SEC_H;

    if (investorData.length === 0) {
      p(
        `<text x="${W / 2}" y="${y + 18}" font-size="13" fill="${ITEM_CNT}" text-anchor="middle">No investor data configured</text>`,
      );
      y += 28;
    } else {
      const IC = {
        name: { x: M + 34, anchor: "start" },
        share: { x: M + 205, anchor: "middle" },
        profit: { x: M + 360, anchor: "end" },
        paid: { x: M + 490, anchor: "end" },
        recv: { x: M + 624, anchor: "end" },
        final: { x: M + CW, anchor: "end" },
      };
      p(
        `<rect x="${M}" y="${y}" width="${CW}" height="${THDR_H}" fill="${COL_HDR_BG}"/>`,
      );
      [
        ["INVESTOR", IC.name.x, IC.name.anchor],
        ["SHARE", IC.share.x, IC.share.anchor],
        ["PROFIT SHARE", IC.profit.x, IC.profit.anchor],
        ["PAID", IC.paid.x, IC.paid.anchor],
        ["RECEIVED", IC.recv.x, IC.recv.anchor],
        ["FINAL", IC.final.x, IC.final.anchor],
      ].forEach(([label, x, anchor]) => {
        p(
          `<text x="${x}" y="${y + 15}" font-size="10" fill="${COL_HDR_TXT}" font-weight="700" letter-spacing="0.5" text-anchor="${anchor}">${label}</text>`,
        );
      });
      y += THDR_H;

      investorData.forEach((inv, ri) => {
        const rowY = y;
        if (ri % 2 === 1) {
          p(
            `<rect x="${M}" y="${rowY}" width="${CW}" height="${INV_ROW_H}" fill="${ROW_ALT_BG}"/>`,
          );
        }
        const cx = M + 16;
        const cy = rowY + Math.floor(INV_ROW_H / 2);
        renderCircleAvatar(inv.avatar || null, inv.name, cx, cy);
        p(
          `<text x="${IC.name.x}" y="${rowY + Math.floor(INV_ROW_H / 2) + 5}" font-size="13" fill="#0f172a" font-weight="600">${this._svgEsc(this._svgTrunc(inv.name, 22))}</text>`,
        );
        p(
          `<text x="${IC.share.x}" y="${rowY + Math.floor(INV_ROW_H / 2) + 5}" font-size="13" fill="#0f172a" text-anchor="middle">${inv.percentage}%</text>`,
        );
        p(
          `<text x="${IC.profit.x}" y="${rowY + Math.floor(INV_ROW_H / 2) + 5}" font-size="13" fill="#0f172a" text-anchor="end">$${inv.profitShare.toFixed(2)}</text>`,
        );
        p(
          `<text x="${IC.paid.x}" y="${rowY + Math.floor(INV_ROW_H / 2) + 5}" font-size="13" fill="#0f172a" text-anchor="end">$${inv.paidAmount.toFixed(2)}</text>`,
        );
        p(
          `<text x="${IC.recv.x}" y="${rowY + Math.floor(INV_ROW_H / 2) + 5}" font-size="13" fill="#0f172a" text-anchor="end">$${inv.receivedAmount.toFixed(2)}</text>`,
        );
        const finC = inv.finalAmount >= 0 ? INCOME_CLR : EXPENSE_CLR;
        p(
          `<text x="${IC.final.x}" y="${rowY + Math.floor(INV_ROW_H / 2) + 5}" font-size="14" fill="${finC}" font-weight="700" text-anchor="end">$${inv.finalAmount.toFixed(2)}</text>`,
        );
        p(
          `<line x1="${M}" y1="${rowY + INV_ROW_H}" x2="${M + CW}" y2="${rowY + INV_ROW_H}" stroke="${ROW_DIV}" stroke-width="1"/>`,
        );
        y += INV_ROW_H;
      });
    }

    y += SEC_PAD;

    // ── Footer ────────────────────────────────────────────────────
    p(
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${ROW_DIV}" stroke-width="1"/>`,
    );
    y += 1;
    p(`<rect x="0" y="${y}" width="${W}" height="24" fill="${FOOTER_BG}"/>`);
    p(
      `<text x="${W / 2}" y="${y + 16}" font-size="10" fill="${META_TXT}" text-anchor="middle">All amounts in SGD unless noted otherwise  ·  Auto-generated report</text>`,
    );
    y += 24;

    const totalH = y + 4;
    const defsBlock = `<defs>${fontFaceStyle}${defs.join("")}</defs>`;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}" font-family="Noto Serif,serif" font-size="13">` +
      defsBlock +
      `<rect width="${W}" height="${totalH}" fill="#ffffff"/>` +
      nodes.join("") +
      `</svg>`
    );
  }

  /**
   * Get person name from investor ID or tenant ID
   */
  getPersonName(personId) {
    if (!personId) return "";

    if (Array.isArray(personId)) {
      return personId
        .map((id) => this.getPersonName(id))
        .filter(Boolean)
        .join(", ");
    }

    // Check if it's a tenant (prefixed with 'tenant_')
    if (personId.startsWith("tenant_")) {
      const tenantId = personId.replace("tenant_", "");
      const tenant = this.tenants.find(
        (t) =>
          (t._id && t._id === tenantId) ||
          (t.tenantId && t.tenantId === tenantId) ||
          (t.id && t.id === tenantId) ||
          (t.fin && t.fin === tenantId),
      );
      return tenant ? tenant.name : personId;
    }

    // It's an investor — check property investors first, then all investors
    const investor =
      this.investors.find((i) => i.investorId === personId) ||
      (this.allInvestors &&
        this.allInvestors.find((i) => i.investorId === personId));
    return investor ? investor.name : personId;
  }

  getPersonRoomType(personId) {
    if (!personId) return null;

    if (Array.isArray(personId)) {
      for (const id of personId) {
        const rt = this.getPersonRoomType(id);
        if (rt) return rt;
      }
      return null;
    }

    if (!personId.startsWith("tenant_")) return null;

    const tenantId = personId.replace("tenant_", "");
    const tenant = this.tenants.find(
      (t) =>
        (t._id && t._id === tenantId) ||
        (t.tenantId && t.tenantId === tenantId) ||
        (t.id && t.id === tenantId) ||
        (t.fin && t.fin === tenantId),
    );

    if (tenant && tenant.roomType) {
      return this.getRoomTypeDisplayName(tenant.roomType);
    }
    return null;
  }

  /**
   * Copy a formatted summary of income and expenses to clipboard
   */
  async copyReportSummary() {
    if (!this.selectedProperty || !this.currentReport) {
      showToast(
        "Please select a property and load financial data first",
        "warning",
      );
      return;
    }

    const btn = document.getElementById("copyReportSummaryBtn");
    if (!btn) return;

    try {
      // Get current month name and year
      const monthNames = [
        "JANUARY",
        "FEBRUARY",
        "MARCH",
        "APRIL",
        "MAY",
        "JUNE",
        "JULY",
        "AUGUST",
        "SEPTEMBER",
        "OCTOBER",
        "NOVEMBER",
        "DECEMBER",
      ];
      const currentMonth = monthNames[this.currentDate.getMonth()];
      const currentYear = this.currentDate.getFullYear();

      // Build the summary text
      const property = this.properties?.find(
        (p) => p.propertyId === this.selectedProperty,
      );
      const propertyLine = property
        ? `${property.propertyId} - ${property.unit} - ${property.address}${property.postcode ? " " + property.postcode : ""}`
        : "";
      let summary = `THU CHI ${currentMonth} - ${currentYear}\n${propertyLine}\n\n`;

      // Income section (THU)
      summary += "THU\n";
      if (this.currentReport.income && this.currentReport.income.length > 0) {
        this.currentReport.income.forEach((item) => {
          const amount = item.amount.toFixed(2);
          const currencyPrefix = item.currency === "VND" ? "🇻🇳$" : "$";
          const fullName = this.getPersonName(item.personInCharge);
          const shortName = fullName.split(" ").pop(); // Get last word only
          let payeeInfo = "";
          if (item.paidBy) {
            const payeeName = this.getPersonName(item.paidBy);
            const roomType = this.getPersonRoomType(item.paidBy);
            payeeInfo = roomType ? `${payeeName} (${roomType})` : payeeName;
          }
          const itemWithPayee = payeeInfo
            ? `${item.item} (${payeeInfo})`
            : item.item;
          const pendingPrefix = item.isPending ? "🟡 " : "";
          summary += `${pendingPrefix}- ${itemWithPayee} - ${currencyPrefix}${amount} - ${shortName}\n`;
        });
      } else {
        summary += "- (không có)\n";
      }

      // Expense section (CHI)
      summary += "\nCHI\n";
      if (
        this.currentReport.expenses &&
        this.currentReport.expenses.length > 0
      ) {
        this.currentReport.expenses.forEach((item) => {
          const amount = item.amount.toFixed(2);
          const currencyPrefix = item.currency === "VND" ? "🇻🇳$" : "$";
          const fullName = this.getPersonName(item.personInCharge);
          const shortName = fullName.split(" ").pop(); // Get last word only
          let paidToInfo = "";
          if (item.paidTo === "unknown") {
            paidToInfo = "Unknown";
          } else if (item.paidTo) {
            const paidToName = this.getPersonName(item.paidTo);
            const roomType = this.getPersonRoomType(item.paidTo);
            paidToInfo = roomType ? `${paidToName} (${roomType})` : paidToName;
          }
          const itemWithPaidTo = paidToInfo
            ? `${item.item} (→${paidToInfo})`
            : item.item;
          const expPendingPrefix = item.isPending ? "🟡 " : "";
          summary += `${expPendingPrefix}- ${itemWithPaidTo} - ${currencyPrefix}${amount} - ${shortName}\n`;
        });
      } else {
        summary += "- (không có)\n";
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(summary);

      // Show success feedback
      const originalHTML = btn.innerHTML;
      btn.innerHTML =
        '<i class="bi bi-check-circle" style="color: #ffffff !important"></i>';
      btn.classList.remove("btn-light");
      btn.classList.add("btn-success");
      btn.style.backgroundColor = "#28a745";
      btn.style.borderColor = "#28a745";

      showToast(i18next.t("financialReport.copyReportSuccess"), "success");

      // Restore button after 2 seconds
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove("btn-success");
        btn.classList.add("btn-light");
        btn.style.backgroundColor = "#ffffff";
        btn.style.borderColor = "#dee2e6";
      }, 2000);
    } catch (error) {
      console.error("Copy to clipboard error:", error);
      showToast("Failed to copy to clipboard", "error");
    }
  }

  async prepareReportForExport() {
    // Update export header with property info and current data
    await this.prepareExportData();

    // Show the header for export
    const reportHeader = document.getElementById("reportHeader");
    reportHeader.classList.remove("d-none");

    // Hide navigation and action buttons for export
    const elementsToHide = [
      ".btn",
      ".modal",
      ".modal-backdrop",
      "#prevMonth",
      "#nextMonth",
      "#addIncomeBtn",
      "#addExpenseBtn",
      "#addInvestorBtn",
      ".edit-icon",
      ".loading-spinner",
      "[onclick]",
      ".actions-column",
      ".month-navigation-section",
    ];

    this._hiddenElements = [];
    elementsToHide.forEach((selector) => {
      const elements = document.querySelectorAll(
        `#exportableFinancialReport ${selector}`,
      );
      elements.forEach((el) => {
        if (!el.id.includes("export") && !el.id.includes("Export")) {
          const originalDisplay = window.getComputedStyle(el).display;
          el.style.display = "none";
          this._hiddenElements.push({ element: el, originalDisplay });
        }
      });
    });
  }

  restoreReportAfterExport() {
    // Restore hidden elements
    if (this._hiddenElements) {
      this._hiddenElements.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay;
      });
      this._hiddenElements = null;
    }

    // Hide header again
    const reportHeader = document.getElementById("reportHeader");
    if (reportHeader) {
      reportHeader.classList.add("d-none");
    }
  }

  async prepareExportData() {
    // Update export header with current property and date info
    const exportPropertyInfo = document.getElementById("exportPropertyInfo");
    const exportDateRange = document.getElementById("exportDateRange");

    if (exportPropertyInfo && this.selectedProperty) {
      // Use already loaded properties instead of fetching again
      const property = this.properties?.find(
        (p) => p.propertyId === this.selectedProperty,
      );
      if (property) {
        exportPropertyInfo.textContent = `${property.propertyId} - ${property.address}, ${property.unit}`;
      } else {
        exportPropertyInfo.textContent = `Property ID: ${this.selectedProperty}`;
      }
    }

    if (exportDateRange) {
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

      const month = monthNames[this.currentDate.getMonth()];
      const year = this.currentDate.getFullYear();
      exportDateRange.textContent = `${month} ${year} Financial Report`;
    }
  }

  generateFileName() {
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

    const month = monthNames[this.currentDate.getMonth()];
    const year = this.currentDate.getFullYear();
    const propertyId = this.selectedProperty;

    return `Financial_Report_${propertyId}_${month}_${year}.png`;
  }

  // Crop canvas to remove white space around content
  cropCanvasToContent(sourceCanvas) {
    const ctx = sourceCanvas.getContext("2d");
    const imageData = ctx.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    );
    const data = imageData.data;

    let minX = sourceCanvas.width;
    let minY = sourceCanvas.height;
    let maxX = 0;
    let maxY = 0;

    // Find the bounds of non-white content
    for (let y = 0; y < sourceCanvas.height; y++) {
      for (let x = 0; x < sourceCanvas.width; x++) {
        const index = (y * sourceCanvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];

        // Check if pixel is not white/transparent (allow for slight variations)
        if (!(r >= 250 && g >= 250 && b >= 250) || a < 250) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    // Add small padding to ensure content isn't too tight
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(sourceCanvas.width, maxX + padding);
    maxY = Math.min(sourceCanvas.height, maxY + padding);

    // Calculate cropped dimensions
    const croppedWidth = maxX - minX;
    const croppedHeight = maxY - minY;

    console.log("Cropping canvas:", {
      original: { width: sourceCanvas.width, height: sourceCanvas.height },
      bounds: { minX, minY, maxX, maxY },
      cropped: { width: croppedWidth, height: croppedHeight },
    });

    // Create new canvas with cropped dimensions
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = croppedWidth;
    croppedCanvas.height = croppedHeight;
    const croppedCtx = croppedCanvas.getContext("2d");

    // Copy the cropped region
    croppedCtx.drawImage(
      sourceCanvas,
      minX,
      minY,
      croppedWidth,
      croppedHeight,
      0,
      0,
      croppedWidth,
      croppedHeight,
    );

    return croppedCanvas;
  }

  // Setup file upload handling
  setupFileUploadHandling() {
    const fileInput = document.getElementById("billEvidenceFiles");
    const previewContainer = document.getElementById("billEvidencePreview");

    if (fileInput && previewContainer) {
      fileInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Validate file count
        if (files.length > 10) {
          this.showError("Maximum 10 files allowed");
          e.target.value = "";
          return;
        }

        // Validate file sizes and types
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/jpg",
          "application/pdf",
        ];

        for (const file of files) {
          if (file.size > maxSize) {
            this.showError(
              `File "${file.name}" is too large. Maximum size is 10MB.`,
            );
            e.target.value = "";
            return;
          }

          if (!allowedTypes.includes(file.type)) {
            this.showError(
              `File "${file.name}" is not supported. Only images and PDFs are allowed.`,
            );
            e.target.value = "";
            return;
          }
        }

        // Upload files
        try {
          await this.uploadBillEvidenceFiles(files);
          this.displayFilePreview(files);
        } catch (error) {
          this.showError(`Failed to upload files: ${error.message}`);
          e.target.value = "";
        }
      });
    }
  }

  // Upload bill evidence files to backend
  async uploadBillEvidenceFiles(files) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await API.post("/api/upload/bill-evidence", formData, {
        "Content-Type": "multipart/form-data",
      });

      const result = await response.json();

      if (result.success) {
        // Store uploaded file URLs for later use
        this.uploadedBillEvidence = result.files.map((file) => file.url);
        console.log(
          "Bill evidence uploaded successfully:",
          this.uploadedBillEvidence,
        );
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading bill evidence:", error);
      throw error;
    }
  }

  // Display file preview for newly uploaded files
  displayFilePreview(files) {
    const previewContainer = document.getElementById("billEvidencePreview");
    if (!previewContainer) return;

    previewContainer.innerHTML = "";

    if (files.length > 0) {
      const previewHtml = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> ${
            files.length
          } file(s) uploaded successfully:
          <ul class="mb-0 mt-1">
            ${files
              .map((file) => `<li class="small">${escapeHtml(file.name)}</li>`)
              .join("")}
          </ul>
        </div>
      `;
      previewContainer.innerHTML = previewHtml;
    }
  }

  // Display existing bill evidence for editing
  displayExistingBillEvidence(billEvidence) {
    const existingContainer = document.getElementById("existingBillEvidence");
    if (!existingContainer || !billEvidence || billEvidence.length === 0)
      return;

    const evidenceHtml = `
      <div class="alert alert-info">
        <i class="bi bi-info-circle"></i> Existing evidence (${
          billEvidence.length
        } file(s)):
        <div class="mt-2">
          ${billEvidence
            .map((url, index) => {
              const fileName = this.extractFileNameFromUrl(url);
              const isImage = this.isImageFile(url);
              const normalizedUrl = this.normalizeImageUrl(url);

              return `
              <div class="d-flex align-items-center gap-2 mb-1">
                <small class="text-muted">${index + 1}.</small>
                ${
                  isImage
                    ? `<img src="${normalizedUrl}" class="img-thumbnail" style="width: 40px; height: 40px; object-fit: cover;">`
                    : `<i class="bi bi-file-earmark-pdf text-danger"></i>`
                }
                <a href="${normalizedUrl}" target="_blank" class="small text-decoration-none">${fileName}</a>
              </div>
            `;
            })
            .join("")}
        </div>
        <small class="text-muted">Upload new files to replace existing evidence, or leave empty to keep current files.</small>
      </div>
    `;
    existingContainer.innerHTML = evidenceHtml;
  }

  // Extract file name from URL
  extractFileNameFromUrl(url) {
    if (!url) return "Unknown file";

    try {
      // Extract filename from Cloudinary URL or path
      const parts = url.split("/");
      const lastPart = parts[parts.length - 1];

      // Remove query parameters if present
      const cleanName = lastPart.split("?")[0];

      // If it's a Cloudinary public_id with extension
      if (cleanName.includes(".")) {
        return cleanName;
      }

      // If it's just a public_id, add generic extension
      return `${cleanName}.file`;
    } catch (error) {
      return "File";
    }
  }

  // Check if file is an image based on URL
  isImageFile(url) {
    if (!url) return false;

    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
    const extension = url.toLowerCase().split(".").pop()?.split("?")[0];

    return imageExtensions.includes(extension);
  }

  // Use global image utilities
  normalizeImageUrl(url) {
    return ImageUtils.normalizeImageUrl(url);
  }

  getOptimizedAvatarUrl(url, size = "small") {
    return ImageUtils.getOptimizedImageUrl(url, size);
  }

  // Show bill evidence in a modal
  showBillEvidence(type, index) {
    // Validate inputs
    if (!this.currentReport) {
      this.showError("No financial report loaded");
      return;
    }

    const propertyName =
      type === "expense" ? "expenses" : type === "income" ? "income" : type;

    if (
      !this.currentReport[propertyName] ||
      index >= this.currentReport[propertyName].length
    ) {
      this.showError("Item not found");
      return;
    }

    const item = this.currentReport[propertyName][index];
    if (!item.billEvidence || item.billEvidence.length === 0) {
      this.showError("No bill evidence available");
      return;
    }

    // Create evidence modal HTML
    const modalHtml = this.createBillEvidenceModalHtml(item, type);

    // Add modal to page
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modalElement = document.getElementById("billEvidenceModal");
    const modal = new bootstrap.Modal(modalElement, {
      backdrop: true,
      keyboard: true,
    });

    // Clean up modal when hidden
    modalElement.addEventListener("hidden.bs.modal", () => {
      modalElement.remove();
    });

    modal.show();
  }

  // Create bill evidence modal HTML
  createBillEvidenceModalHtml(item, type) {
    const isIncome = type === "income";
    const title = `${isIncome ? "Income" : "Expense"} Evidence - ${item.item}`;

    const evidenceHtml = item.billEvidence
      .map((url, index) => {
        const fileName = this.extractFileNameFromUrl(url);
        const isImage = this.isImageFile(url);
        const normalizedUrl = this.normalizeImageUrl(url);

        return `
        <div class="mb-3 p-3 border rounded">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold">File ${index + 1}: ${fileName}</span>
            <a href="${normalizedUrl}" target="_blank" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-download"></i> Open
            </a>
          </div>
          ${
            isImage
              ? `<img src="${normalizedUrl}" class="img-fluid rounded" style="max-height: 400px; width: 100%; object-fit: contain;">`
              : `<div class="text-center p-4 bg-light rounded">
              <i class="bi bi-file-earmark-pdf text-danger" style="font-size: 3rem;"></i>
              <p class="mt-2 mb-0">PDF File</p>
              <small class="text-muted">Click "Open" to view</small>
            </div>`
          }
        </div>
      `;
      })
      .join("");

    return `
      <div class="modal fade" id="billEvidenceModal" tabindex="-1" aria-labelledby="billEvidenceModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="billEvidenceModalLabel">
                <i class="bi bi-paperclip me-2"></i>${title}
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="mb-3">
                <strong>Item:</strong> ${escapeHtml(item.item)}<br>
                <strong>Amount:</strong> $${item.amount.toFixed(2)}<br>
                ${
                  item.date
                    ? `<strong>Date:</strong> ${new Date(
                        item.date,
                      ).toLocaleDateString()}<br>`
                    : ""
                }
                ${
                  item.details
                    ? `<strong>Details:</strong> ${escapeHtml(
                        item.details,
                      )}<br>`
                    : ""
                }
              </div>
              <hr>
              <h6>Bill Evidence (${item.billEvidence.length} files):</h6>
              ${evidenceHtml}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── All Properties Unpaid Overview ───────────────────────────────────────

  toggleAllUnpaidReminderSection() {
    const section = document.getElementById("allUnpaidReminderSection");
    const btn = document.getElementById("viewAllUnpaidBtn");
    if (!section) return;

    if (this.allUnpaidVisible) {
      section.style.display = "none";
      this.allUnpaidVisible = false;
      if (btn) {
        btn.innerHTML = '<i class="bi bi-bell-fill me-1"></i>Unpaid Overview';
        btn.classList.remove("btn-outline-warning");
        btn.classList.add("btn-warning");
      }
    } else {
      section.style.display = "block";
      this.allUnpaidVisible = true;
      if (btn) {
        btn.innerHTML =
          '<i class="bi bi-bell-slash-fill me-1"></i>Hide Overview';
        btn.classList.remove("btn-warning");
        btn.classList.add("btn-outline-warning");
      }
      this.refreshAllUnpaidReminderSection();
    }
  }

  async refreshAllUnpaidReminderSection() {
    const content = document.getElementById("allUnpaidReminderContent");
    if (!content) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth() + 1;
    const monthName = this.currentDate.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });

    content.innerHTML = `
      <div class="card border-warning">
        <div class="card-header bg-warning text-dark d-flex justify-content-between align-items-center">
          <div>
            <i class="bi bi-bell-fill me-2"></i>
            <strong>Unpaid Rent Overview</strong>
            <span class="badge bg-dark ms-2">${escapeHtml(monthName)}</span>
          </div>
          <div class="spinner-border spinner-border-sm text-dark" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <div class="card-body">
          <p class="text-muted mb-0"><i class="bi bi-hourglass-split me-1"></i>Fetching data for all properties…</p>
        </div>
      </div>
    `;

    const properties = this.properties || [];
    if (properties.length === 0) {
      content.innerHTML = `<div class="alert alert-info mb-0"><i class="bi bi-info-circle me-2"></i>No properties loaded yet.</div>`;
      return;
    }

    try {
      // Fetch report + tenants for all properties in parallel
      const results = await Promise.all(
        properties.map(async (property) => {
          const propertyId = property.propertyId;
          try {
            const [reportRes, tenantsRes] = await Promise.all([
              API.get(
                API_CONFIG.ENDPOINTS.FINANCIAL_REPORT(propertyId, year, month),
              ),
              API.get(API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(propertyId)),
            ]);
            let report = null;
            if (reportRes.ok) {
              const d = await reportRes.json();
              if (d.success) report = d.data;
            }
            let tenants = [];
            if (tenantsRes.ok) {
              const d = await tenantsRes.json();
              if (d.success) tenants = d.tenants || [];
            }
            return { property, report, tenants };
          } catch (_) {
            return { property, report: null, tenants: [] };
          }
        }),
      );

      // Compute unpaid per property
      const propertyResults = results.map(({ property, report, tenants }) => ({
        property,
        unpaid: this._computeUnpaidTenants(
          tenants,
          report,
          year,
          month,
          property.propertyId,
        ),
        totalActive: tenants.filter((t) =>
          this._isTenantActiveThisMonth(t, property.propertyId, year, month),
        ).length,
      }));

      this._renderAllUnpaidResults(content, propertyResults, monthName);
    } catch (error) {
      console.error("Error loading all unpaid rent reminders:", error);
      content.innerHTML = `<div class="alert alert-danger mb-0"><i class="bi bi-exclamation-circle me-2"></i>Failed to load unpaid rent overview. Please try again.</div>`;
    }
  }

  _isTenantActiveThisMonth(tenant, propertyId, year, month) {
    if (!tenant.properties || !Array.isArray(tenant.properties)) return false;
    const propertyRecord = tenant.properties.find((prop) => {
      const propId = typeof prop === "object" ? prop.propertyId : prop;
      return propId && propId.toUpperCase() === propertyId.toUpperCase();
    });
    if (!propertyRecord) return false;
    const moveInDate = propertyRecord?.moveinDate
      ? new Date(propertyRecord.moveinDate)
      : null;
    const moveOutDate = propertyRecord?.moveoutDate
      ? new Date(propertyRecord.moveoutDate)
      : null;
    const reportDate = new Date(year, month - 1, 1);
    const reportEndDate = new Date(year, month, 0);
    if (moveInDate && moveInDate > reportEndDate) return false;
    if (moveOutDate && moveOutDate < reportDate) return false;
    return true;
  }

  _computeUnpaidTenants(allTenants, report, year, month, propertyId) {
    const reportDate = new Date(year, month - 1, 1);
    const reportEndDate = new Date(year, month, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentMonthTenants = allTenants.filter((tenant) => {
      if (!tenant.properties || !Array.isArray(tenant.properties)) return false;
      const propertyRecord = tenant.properties.find((prop) => {
        const propId = typeof prop === "object" ? prop.propertyId : prop;
        return propId && propId.toUpperCase() === propertyId.toUpperCase();
      });
      if (!propertyRecord) return false;
      const moveInDate = propertyRecord?.moveinDate
        ? new Date(propertyRecord.moveinDate)
        : null;
      const moveOutDate = propertyRecord?.moveoutDate
        ? new Date(propertyRecord.moveoutDate)
        : null;
      if (moveInDate && moveInDate > reportEndDate) return false;
      tenant._upcomingMoveInDate =
        moveInDate && moveInDate >= reportDate && moveInDate > today
          ? moveInDate
          : null;
      tenant._moveInInMonth =
        moveInDate && moveInDate >= reportDate && moveInDate <= reportEndDate
          ? moveInDate
          : null;
      if (moveOutDate && moveOutDate < reportDate) return false;
      tenant._moveOutInMonth =
        moveOutDate && moveOutDate >= reportDate && moveOutDate <= reportEndDate
          ? moveOutDate
          : null;
      return true;
    });

    // Map paid amounts from income
    const paidAmountsByTenantId = new Map();
    (report?.income || []).forEach((incomeItem) => {
      if (incomeItem.paidBy && incomeItem.paidBy.startsWith("tenant_")) {
        const tenantId = incomeItem.paidBy.replace("tenant_", "");
        const tenant = currentMonthTenants.find(
          (t) =>
            (t._id && t._id === tenantId) ||
            (t.tenantId && t.tenantId === tenantId) ||
            (t.name && t.name === tenantId) ||
            (t.fin && t.fin === tenantId) ||
            (t.passportNumber && t.passportNumber === tenantId),
        );
        if (tenant?._id) {
          paidAmountsByTenantId.set(
            tenant._id,
            (paidAmountsByTenantId.get(tenant._id) || 0) +
              (incomeItem.amount || 0),
          );
        }
      }
    });

    // Build roommate groups
    const roomGroups = new Map();
    const tenantToGroup = new Map();
    currentMonthTenants.forEach((tenant) => {
      if (tenantToGroup.has(tenant._id)) return;
      const roommateId = tenant.roommateId?._id || tenant.roommateId || null;
      if (roommateId && tenantToGroup.has(roommateId)) {
        const groupKey = tenantToGroup.get(roommateId);
        roomGroups.get(groupKey).push(tenant);
        tenantToGroup.set(tenant._id, groupKey);
      } else {
        const groupKey = tenant._id;
        roomGroups.set(groupKey, [tenant]);
        tenantToGroup.set(tenant._id, groupKey);
        if (roommateId) {
          const roommateTenant = currentMonthTenants.find(
            (t) => t._id === roommateId,
          );
          if (roommateTenant && !tenantToGroup.has(roommateId)) {
            roomGroups.get(groupKey).push(roommateTenant);
            tenantToGroup.set(roommateId, groupKey);
          }
        }
      }
    });

    return currentMonthTenants.filter((tenant) => {
      if (!tenant.roomType) return false;
      const groupKey = tenantToGroup.get(tenant._id);
      const roommates = roomGroups.get(groupKey) || [tenant];
      const totalRoomRent = roommates.reduce(
        (sum, t) => sum + (typeof getEffectiveTenantRent === "function" ? (getEffectiveTenantRent(t) || 0) : (t.rent || 0)),
        0,
      );
      const totalPaid = roommates.reduce(
        (sum, t) => sum + (paidAmountsByTenantId.get(t._id) || 0),
        0,
      );
      if (totalPaid >= totalRoomRent && totalRoomRent > 0) return false;
      return !paidAmountsByTenantId.has(tenant._id);
    });
  }

  _renderAllUnpaidResults(container, propertyResults, monthName) {
    const totalUnpaid = propertyResults.reduce(
      (sum, r) => sum + r.unpaid.length,
      0,
    );
    const propertiesWithUnpaid = propertyResults.filter(
      (r) => r.unpaid.length > 0,
    );
    const propertiesAllPaid = propertyResults.filter(
      (r) => r.unpaid.length === 0 && r.totalActive > 0,
    );

    const refreshBtn = `<button class="btn btn-sm btn-dark py-0" onclick="window.financialReports && window.financialReports.refreshAllUnpaidReminderSection()" title="Refresh"><i class="bi bi-arrow-clockwise"></i></button>`;

    let html = `
      <div class="card border-warning shadow-sm">
        <div class="card-header bg-warning text-dark py-2 d-flex justify-content-between align-items-center">
          <span><i class="bi bi-bell-fill me-2"></i><strong>Unpaid Rent</strong> <span class="fw-normal opacity-75">— ${escapeHtml(monthName)}</span></span>
          <div class="d-flex align-items-center gap-2">
            ${
              totalUnpaid > 0
                ? `<span class="badge bg-danger">${totalUnpaid} unpaid</span>`
                : `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i>All paid</span>`
            }
            ${refreshBtn}
          </div>
        </div>
    `;

    if (totalUnpaid === 0) {
      html += `
        <div class="card-body py-2">
          <span class="text-success small"><i class="bi bi-check-circle-fill me-1"></i>All tenants across all properties have paid for ${escapeHtml(monthName)}.</span>
        </div>
      `;
    } else {
      html += `<div class="table-responsive"><table class="table table-sm table-hover mb-0 align-middle">
        <thead class="table-light"><tr>
          <th class="small border-0 ps-3">Property</th>
          <th class="small border-0">Tenant</th>
          <th class="small border-0">Room</th>
          <th class="small border-0">Fees</th>
          <th class="small border-0 text-end pe-3">Contact</th>
        </tr></thead>
        <tbody>`;

      propertiesWithUnpaid.forEach(({ property, unpaid, totalActive }) => {
        const propertyName = escapeHtml(property.name || property.propertyId);
        const propertyUnit = property.unit ? escapeHtml(property.unit) : null;
        const propertyAddress = property.address
          ? escapeHtml(property.address)
          : null;

        unpaid.forEach((tenant, idx) => {
          const displayName = escapeHtml(
            tenant.name || tenant.username || tenant.tenantId || "Unknown",
          );
          const roomType = escapeHtml(
            this.getRoomTypeDisplayName(tenant.roomType),
          );
          const phoneNumber = tenant.phoneNumber || "";
          const facebookUrl = tenant.facebookUrl || "";
          const roommateName = tenant.roommateId?.name || "";
          const roommateAvatar = tenant.roommateId?.avatar || "";
          const upcomingMoveIn = tenant._upcomingMoveInDate
            ? tenant._upcomingMoveInDate.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })
            : null;
          const moveInInMonth = tenant._moveInInMonth
            ? tenant._moveInInMonth.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })
            : null;
          const moveOutInMonth = tenant._moveOutInMonth
            ? tenant._moveOutInMonth.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })
            : null;

          let roommateHtml = "";
          if (roommateName) {
            if (roommateAvatar) {
              roommateHtml = `<img src="${escapeHtml(roommateAvatar)}" class="rounded-circle ms-1" style="width:16px;height:16px;object-fit:cover;border:1.5px solid #0dcaf0;" title="w/ ${escapeHtml(roommateName)}" data-bs-toggle="tooltip">`;
            } else {
              roommateHtml = `<span class="rounded-circle bg-info text-white d-inline-flex align-items-center justify-content-center ms-1" style="width:16px;height:16px;font-size:9px;border:1.5px solid #0dcaf0;" title="w/ ${escapeHtml(roommateName)}" data-bs-toggle="tooltip">${escapeHtml(roommateName.charAt(0).toUpperCase())}</span>`;
            }
          }

          const feeParts = [];
          const _effectiveRent2 = typeof getEffectiveTenantRent === "function" ? getEffectiveTenantRent(tenant) : tenant.rent;
          if (_effectiveRent2)
            feeParts.push(
              `<span class="badge bg-secondary" style="font-size:0.7em;">$${Number(_effectiveRent2).toFixed(0)}</span>`,
            );
          if (tenant.cleaningFee)
            feeParts.push(
              `<span class="badge bg-light text-dark border" style="font-size:0.7em;">+$${tenant.cleaningFee.toFixed(0)}</span>`,
            );
          if (!tenant.isUtilitySubsidized)
            feeParts.push(
              `<span class="badge bg-info text-dark" style="font-size:0.7em;">PUB</span>`,
            );
          if (upcomingMoveIn)
            feeParts.push(
              `<span class="badge bg-warning text-dark" style="font-size:0.7em;"><i class="bi bi-calendar-event me-1"></i>${escapeHtml(upcomingMoveIn)}</span>`,
            );
          if (moveInInMonth)
            feeParts.push(
              `<span class="badge bg-success text-white" style="font-size:0.7em;"><i class="bi bi-box-arrow-in-right me-1"></i>In ${escapeHtml(moveInInMonth)}</span>`,
            );
          if (moveOutInMonth)
            feeParts.push(
              `<span class="badge bg-orange text-white" style="font-size:0.7em;background-color:#fd7e14 !important;"><i class="bi bi-box-arrow-right me-1"></i>Out ${escapeHtml(moveOutInMonth)}</span>`,
            );

          const waLink = phoneNumber
            ? `<a href="https://wa.me/${escapeHtml(phoneNumber.replace(/[^0-9]/g, ""))}" target="_blank" rel="noopener noreferrer" class="btn btn-success btn-sm py-0 px-1" style="font-size:0.75em;" title="WhatsApp"><i class="bi bi-whatsapp"></i></a>`
            : "";
          const fbLink = facebookUrl
            ? `<a href="${escapeHtml(facebookUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm py-0 px-1" style="font-size:0.75em;" title="Facebook"><i class="bi bi-facebook"></i></a>`
            : "";

          // Show property cell only on first tenant row (rowspan)
          const propCell =
            idx === 0
              ? `<td class="ps-3 border-0 fw-semibold small text-nowrap" rowspan="${unpaid.length}" style="border-left:3px solid #dc3545 !important;vertical-align:top;padding-top:0.5rem;">
                <i class="bi bi-building me-1 text-danger"></i>${propertyName}
                ${propertyUnit ? `<div class="fw-normal" style="font-size:0.78em;">${propertyUnit}</div>` : ""}
                ${propertyAddress ? `<div class="text-muted fw-normal" style="font-size:0.73em;max-width:120px;white-space:normal;">${propertyAddress}</div>` : ""}
                <div class="text-muted fw-normal" style="font-size:0.75em;">${unpaid.length}/${totalActive} unpaid</div>
               </td>`
              : "";

          const tenantNotes = tenant.notes ? tenant.notes.trim() : "";
          html += `<tr>
            ${propCell}
            <td class="border-0 small">${displayName}${roommateHtml}${tenantNotes ? `<div class="text-muted mt-1" style="font-size:0.78em;"><i class="bi bi-sticky me-1"></i>${escapeHtml(tenantNotes)}</div>` : ""}</td>
            <td class="border-0 small text-muted text-nowrap">${roomType}</td>
            <td class="border-0"><div class="d-flex gap-1 flex-wrap">${feeParts.join("")}</div></td>
            <td class="border-0 text-end pe-3"><div class="d-flex gap-1 justify-content-end">${waLink}${fbLink}</div></td>
          </tr>`;
        });
      });

      html += `</tbody></table></div>`;

      // Fully-paid properties as compact footer
      if (propertiesAllPaid.length > 0) {
        const allPaidId = `allPaidProperties_${Date.now()}`;
        html += `
          <div class="card-footer py-1 px-3 bg-light border-top">
            <span class="text-muted small" style="cursor:pointer;" data-bs-toggle="collapse" data-bs-target="#${allPaidId}">
              <i class="bi bi-check-circle-fill text-success me-1"></i>${propertiesAllPaid.length} propert${propertiesAllPaid.length > 1 ? "ies" : "y"} fully paid
              <i class="bi bi-chevron-down small ms-1"></i>
            </span>
            <div class="collapse" id="${allPaidId}">
              <div class="d-flex flex-wrap gap-1 mt-1">
                ${propertiesAllPaid.map((r) => `<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check me-1"></i>${escapeHtml(r.property.name || r.property.propertyId)}</span>`).join("")}
              </div>
            </div>
          </div>
        `;
      }
    }

    html += `</div>`;
    container.innerHTML = html;

    container.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      const existing = bootstrap.Tooltip.getInstance(el);
      if (existing) existing.dispose();
      new bootstrap.Tooltip(el);
    });
  }
}

// Make component globally accessible
window.FinancialReportsComponent = FinancialReportsComponent;
