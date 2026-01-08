// Note: showToast and escapeHtml are expected to be available globally
import html2canvas from 'html2canvas';
import { getRoomTypeDisplayName } from '../utils/room-type-mapper.js';

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
    this.tenants = []; // Store tenants for selected property
    this.isModalOpen = false;
    this.isIncomeExpenseModalOpen = false;
    this.editingItem = null;
    this.editingItemIndex = null;
    this.pendingDeletes = new Set(); // Track items pending deletion confirmation
    this.pendingClose = false; // Track month close confirmation
    this.init();
  }

  // Map room type enums to human-readable names (using shared utility)
  getRoomTypeDisplayName(roomType) {
    return getRoomTypeDisplayName(roomType);
  }

  init() {
    this.bindEvents();
    this.loadProperties();

    // Initial cleanup to ensure no leftover modals from previous sessions
    this.forceCleanupModalBackdrops();
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
  }

  async loadProperties() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
      const result = await response.json();

      if (result.success) {
        this.renderPropertyCards(result.properties);
      } else {
        // Handle API errors (like authentication required)
        if (response.status === 401 || response.status === 403) {
          this.showError("Please log in to load properties");
          this.renderPropertyCards([]); // Show empty cards
        } else {
          this.showError(result.error || "Failed to load properties");
          this.renderPropertyCards([]); // Show empty cards
        }
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showError(
        "Failed to load properties. Please check your connection and try again."
      );
      this.renderPropertyCards([]); // Show empty cards with default message
    }
  }

  renderPropertyCards(properties) {
    const container = document.getElementById("propertyCards");
    if (!container) return;

    // Store properties for later use
    this.properties = properties || [];

    // Clear existing cards
    container.innerHTML = "";

    if (!properties || properties.length === 0) {
      // Show message when no properties are available
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-building-slash me-2"></i>
          No properties available - please log in or add properties
        </div>
      `;
      return;
    }

    // Generate property cards
    properties.forEach((property) => {
      const isSelected = this.selectedProperty === property.propertyId;
      const cardHtml = `
        <div class="col-6 col-md-3 col-lg-2 mb-3">
          <div class="card property-card h-100 ${
            isSelected ? "border-primary" : ""
          } overflow-hidden"
               style="cursor: pointer; transition: all 0.2s ease;"
               onclick="window.financialReports.selectProperty('${
                 property.propertyId
               }')">
            ${property.propertyImage ? `
            <div class="card-img-top position-relative" style="height: 160px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;">
              ${isSelected ? '<div class="position-absolute top-0 end-0 p-2"><i class="bi bi-check-circle-fill text-success bg-white rounded-circle" style="font-size: 1.5rem;"></i></div>' : ''}
            </div>
            ` : ''}
            <div class="card-header d-flex justify-content-between align-items-center bg-white">
              <div class="d-flex align-items-center">
                <div class="me-3">
                  <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white"
                       style="width: 40px; height: 40px; font-size: 16px; font-weight: bold;">
                    ${escapeHtml(
                      property.propertyId.substring(0, 2).toUpperCase()
                    )}
                  </div>
                </div>
                <div>
                  <h6 class="mb-0 fw-bold">${escapeHtml(
                    property.propertyId
                  )}</h6>
                  <small class="text-muted">Property ID</small>
                </div>
              </div>
              ${!property.propertyImage && isSelected
                ? '<i class="bi bi-check-circle-fill text-success" style="font-size: 1.2rem;"></i>'
                : ""
              }
            </div>
            <div class="card-body py-2 bg-white">
              <p class="mb-1 small"><strong>Address:</strong> ${escapeHtml(
                property.address
              )}</p>
              <p class="mb-1 small"><strong>Unit:</strong> ${escapeHtml(
                property.unit
              )}</p>
              ${
                property.rent
                  ? `<p class="mb-1 small"><strong>Rent:</strong> $${property.rent}</p>`
                  : ""
              }
              ${
                property.description
                  ? `<p class="mb-1 small text-muted">${escapeHtml(
                      property.description
                    )}</p>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
      container.innerHTML += cardHtml;
    });

    // Add hover effects with CSS
    this.addPropertyCardStyles();
  }

  addPropertyCardStyles() {
    // Add hover styles if not already added
    if (!document.getElementById("property-card-styles")) {
      const style = document.createElement("style");
      style.id = "property-card-styles";
      style.textContent = `
        .property-card {
          min-height: 200px;
          overflow: hidden;
        }
        .property-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.15) !important;
        }
        .property-card.border-primary {
          border-width: 3px !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  initializeTooltips() {
    // Dispose of existing tooltips first to prevent memory leaks
    const existingTooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    existingTooltips.forEach(el => {
      const existingTooltip = bootstrap.Tooltip.getInstance(el);
      if (existingTooltip) {
        existingTooltip.dispose();
      }
    });

    // Initialize new tooltips with custom placement
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl, {
      placement: 'top',
      offset: [15, 0]  // Offset to the right
    }));

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
    // Update visual selection state of property cards
    const allCards = document.querySelectorAll(".property-card");
    allCards.forEach((card) => {
      card.classList.remove("border-primary", "bg-light");
      const checkIcon = card.querySelector(".bi-check-circle-fill");
      if (checkIcon) {
        checkIcon.remove();
      }
    });

    // Find and highlight the selected card
    if (this.selectedProperty) {
      const selectedCard = Array.from(allCards).find(
        (card) =>
          card.onclick &&
          card.onclick.toString().includes(this.selectedProperty)
      );

      if (selectedCard) {
        selectedCard.classList.add("border-primary", "bg-light");
        const header = selectedCard.querySelector(".card-header");
        if (header && !header.querySelector(".bi-check-circle-fill")) {
          const checkIcon = document.createElement("i");
          checkIcon.className = "bi bi-check-circle-fill text-success";
          checkIcon.style.fontSize = "1.2rem";
          header.appendChild(checkIcon);
        }
      }
    }
  }

  async selectProperty(propertyId) {
    // Cleanup any open modals when switching properties
    this.forceCleanupModalBackdrops();
    this.isModalOpen = false;
    this.isIncomeExpenseModalOpen = false;
    this.editingItem = null;
    this.editingItemIndex = null;
    this.pendingDeletes.clear(); // Clear any pending deletion confirmations

    if (!propertyId) {
      this.selectedProperty = null;
      document.getElementById("financialReportContent").style.display = "none";
      return;
    }

    this.selectedProperty = propertyId;
    document.getElementById("financialReportContent").style.display = "block";

    // Update property card selection state
    this.updatePropertyCardSelection();

    // Load investors for this property
    await this.loadInvestors(propertyId);

    // Load tenants for this property
    await this.loadTenants(propertyId);

    // Load financial report for current month
    await this.loadFinancialReport();

    // Update month display
    this.updateMonthDisplay();
  }

  async loadInvestors(propertyId) {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.INVESTORS_BY_PROPERTY(propertyId)
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
        API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(propertyId)
      );
      const result = await response.json();

      if (result.success) {
        this.tenants = result.tenants || [];
        console.log(
          "✅ Loaded tenants for property:",
          this.tenants.length,
          this.tenants
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

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      console.log(
        `loadFinancialReport: Loading data for ${this.selectedProperty} - ${year}/${month}`
      );

      const response = await API.get(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORT(
          this.selectedProperty,
          year,
          month
        )
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          this.currentReport = result.data;
          console.log(
            `loadFinancialReport: Loaded existing report:`,
            this.currentReport
          );
        } else {
          this.currentReport = null;
          console.log(`loadFinancialReport: API returned error:`, result);
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
          `loadFinancialReport: Created empty report for ${year}/${month}`
        );
      }

      console.log(
        `loadFinancialReport: Calling updateDisplays with:`,
        this.currentReport
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
    await this.updateUnpaidRentReminder();
    await this.updateClosedStatus();
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

    // Create compact table format
    let html = `
      <div class="table-responsive">
        <table class="table table-sm table-striped mb-0">
          <thead>
            <tr class="table-success">
              <th class="border-0 small">Item</th>
              <th class="border-0 small">Date</th>
              <th class="border-0 small">Person</th>
              <th class="border-0 small">Paid By</th>
              <th class="border-0 small text-center">Currency</th>
              <th class="border-0 small text-end">Amount</th>
              <th class="border-0 small text-center actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.currentReport.income.forEach((item, index) => {
      total += item.amount;

      // Track currency totals
      const currency = item.currency || 'SGD';
      if (currency === 'VND') {
        totalVND += item.amount;
      } else {
        totalSGD += item.amount;
      }

      // Find investor name by ID (for income, show investor responsible instead of tenant)
      const investor = this.investors.find(
        (inv) => inv.investorId === item.personInCharge
      );
      const investorName = investor ? investor.name : item.personInCharge;
      const investorAvatar = investor?.avatar;

      // Check if this item is pending deletion confirmation
      const itemKey = `income-${index}`;
      const isPendingDelete = this.pendingDeletes.has(itemKey);

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

      html += `
        <tr>
          <td class="small border-0 align-middle ps-3">
            <div class="d-flex align-items-center gap-1">
              <span>${escapeHtml(item.item)}</span>
              ${
                hasAdditionalInfo
                  ? `<i class="bi bi-info-circle text-muted" title="Has additional details or evidence" style="font-size: 12px;"></i>`
                  : ""
              }
            </div>
            ${
              hasDetails
                ? `<div class="small text-muted mt-1" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(
                    item.details
                  )}">${escapeHtml(item.details.substring(0, 50))}${
                    item.details.length > 50 ? "..." : ""
                  }</div>`
                : ""
            }
            ${
              hasEvidence
                ? `<div class="small text-info mt-1"><i class="bi bi-paperclip"></i> ${item.billEvidence.length} file(s)</div>`
                : ""
            }
          </td>
          <td class="small border-0 align-middle">${transactionDate}</td>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center justify-content-center">
              ${
                investorAvatar
                  ? `<img src="${this.getOptimizedAvatarUrl(
                      investorAvatar,
                      "small"
                    )}" alt="${escapeHtml(
                      investorName
                    )}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(
                      investorName
                    )}">`
                  : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 15px;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(
                      investorName
                    )}">${escapeHtml(
                      investorName.charAt(0).toUpperCase()
                    )}</div>`
              }
            </div>
          </td>
          <td class="small border-0 align-middle">
            ${this.renderPaidByAvatar(item.paidBy)}
          </td>
          <td class="small border-0 align-middle text-center">
            ${this.renderCurrencyFlag(item.currency)}
          </td>
          <td class="small border-0 align-middle text-end fw-bold text-success" style="font-size: 16px;">$${item.amount.toFixed(
            2
          )}</td>
          <td class="border-0 align-middle text-center actions-column">
            <div class="btn-group btn-group-sm">
              ${
                hasEvidence
                  ? `<button class="btn btn-outline-info btn-sm p-1" onclick="window.financialReports.showBillEvidence('income', ${index})" title="View Evidence">
                <i class="bi bi-eye"></i>
              </button>`
                  : ""
              }
              <button class="btn btn-outline-primary btn-sm p-1" id="editIncomeBtn-${index}" onclick="window.financialReports.editItem('income', ${index})" title="Edit">
                <span class="edit-icon"><i class="bi bi-pencil"></i></span>
                <span class="loading-spinner d-none">
                  <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                </span>
              </button>
              ${
                isPendingDelete
                  ? `<button class="btn btn-success btn-sm p-1" onclick="window.financialReports.confirmDeleteItem('income', ${index})" title="Confirm delete">
                     <i class="bi bi-check"></i>
                   </button>
                   <button class="btn btn-outline-secondary btn-sm p-1" onclick="window.financialReports.cancelDeleteItem('income', ${index})" title="Cancel">
                     <i class="bi bi-x"></i>
                   </button>`
                  : `<button class="btn btn-outline-danger btn-sm p-1" onclick="window.financialReports.toggleDeleteConfirm('income', ${index})" title="Delete">
                     <i class="bi bi-trash"></i>
                   </button>`
              }
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

    incomeList.innerHTML = html;
    if (totalIncomeEl) {
      totalIncomeEl.textContent = `$${total.toFixed(2)}`;

      // Display currency breakdown
      let breakdownHtml = '';
      if (totalSGD > 0 || totalVND > 0) {
        breakdownHtml = '<div class="mt-2 small text-muted">';
        if (totalSGD > 0) {
          breakdownHtml += `<div class="d-flex justify-content-between"><span>🇸🇬 SGD:</span><span>$${totalSGD.toFixed(2)}</span></div>`;
        }
        if (totalVND > 0) {
          breakdownHtml += `<div class="d-flex justify-content-between"><span>🇻🇳 VND:</span><span>$${totalVND.toFixed(2)}</span></div>`;
        }
        breakdownHtml += '</div>';
      }

      // Find or create breakdown container
      let breakdownContainer = document.getElementById('incomeCurrencyBreakdown');
      if (!breakdownContainer) {
        // Create the breakdown container after the total income element
        breakdownContainer = document.createElement('div');
        breakdownContainer.id = 'incomeCurrencyBreakdown';
        totalIncomeEl.parentElement.appendChild(breakdownContainer);
      }
      breakdownContainer.innerHTML = breakdownHtml;
    }

    // Initialize tooltips
    this.initializeTooltips();
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

    // Create compact table format
    let html = `
      <div class="table-responsive">
        <table class="table table-sm table-striped mb-0">
          <thead>
            <tr class="table-danger">
              <th class="border-0 small">Item</th>
              <th class="border-0 small">Date</th>
              <th class="border-0 small">Person</th>
              <th class="border-0 small text-end">Amount</th>
              <th class="border-0 small text-center actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.currentReport.expenses.forEach((item, index) => {
      total += item.amount;

      // Find investor name by ID
      const investor = this.investors.find(
        (inv) => inv.investorId === item.personInCharge
      );
      const investorName = investor ? investor.name : item.personInCharge;
      const investorAvatar = investor?.avatar;

      // Check if this item is pending deletion confirmation
      const itemKey = `expense-${index}`;
      const isPendingDelete = this.pendingDeletes.has(itemKey);

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

      html += `
        <tr>
          <td class="small border-0 align-middle ps-3">
            <div class="d-flex align-items-center gap-1">
              <span>${escapeHtml(item.item)}</span>
              ${
                hasAdditionalInfo
                  ? `<i class="bi bi-info-circle text-muted" title="Has additional details or evidence" style="font-size: 12px;"></i>`
                  : ""
              }
            </div>
            ${
              hasDetails
                ? `<div class="small text-muted mt-1" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(
                    item.details
                  )}">${escapeHtml(item.details.substring(0, 50))}${
                    item.details.length > 50 ? "..." : ""
                  }</div>`
                : ""
            }
            ${
              hasEvidence
                ? `<div class="small text-info mt-1"><i class="bi bi-paperclip"></i> ${item.billEvidence.length} file(s)</div>`
                : ""
            }
          </td>
          <td class="small border-0 align-middle">${transactionDate}</td>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center justify-content-center">
              ${
                investorAvatar
                  ? `<img src="${this.getOptimizedAvatarUrl(
                      investorAvatar,
                      "small"
                    )}" alt="${escapeHtml(
                      investorName
                    )}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(
                      investorName
                    )}">`
                  : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 15px;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(
                      investorName
                    )}">${escapeHtml(
                      investorName.charAt(0).toUpperCase()
                    )}</div>`
              }
            </div>
          </td>
          <td class="small border-0 align-middle text-end fw-bold text-danger" style="font-size: 16px;">$${item.amount.toFixed(
            2
          )}</td>
          <td class="border-0 align-middle text-center actions-column">
            <div class="btn-group btn-group-sm">
              ${
                hasEvidence
                  ? `<button class="btn btn-outline-info btn-sm p-1" onclick="window.financialReports.showBillEvidence('expense', ${index})" title="View Evidence">
                <i class="bi bi-eye"></i>
              </button>`
                  : ""
              }
              <button class="btn btn-outline-primary btn-sm p-1" id="editExpenseBtn-${index}" onclick="window.financialReports.editItem('expense', ${index})" title="Edit">
                <span class="edit-icon"><i class="bi bi-pencil"></i></span>
                <span class="loading-spinner d-none">
                  <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                </span>
              </button>
              ${
                isPendingDelete
                  ? `<button class="btn btn-success btn-sm p-1" onclick="window.financialReports.confirmDeleteItem('expense', ${index})" title="Confirm delete">
                     <i class="bi bi-check"></i>
                   </button>
                   <button class="btn btn-outline-secondary btn-sm p-1" onclick="window.financialReports.cancelDeleteItem('expense', ${index})" title="Cancel">
                     <i class="bi bi-x"></i>
                   </button>`
                  : `<button class="btn btn-outline-danger btn-sm p-1" onclick="window.financialReports.toggleDeleteConfirm('expense', ${index})" title="Delete">
                     <i class="bi bi-trash"></i>
                   </button>`
              }
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

    expenseList.innerHTML = html;
    if (totalExpensesEl) totalExpensesEl.textContent = `$${total.toFixed(2)}`;

    // Initialize tooltips
    this.initializeTooltips();
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
      "investorDistribution"
    );

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
      const propertyData = investor.properties.find(
        (p) => p.propertyId === this.selectedProperty
      );
      const percentage = propertyData ? propertyData.percentage : 0;
      const profitShare = (netProfit * percentage) / 100;

      // Calculate paid amount (expenses paid by this investor)
      // Note: For expenses, the person who paid is stored in 'personInCharge' field
      const paidAmount = this.currentReport && this.currentReport.expenses
        ? this.currentReport.expenses
            .filter(e => e.personInCharge === investor.investorId)
            .reduce((sum, e) => sum + (e.amount || 0), 0)
        : 0;

      // Calculate received amount (income received by this investor)
      const receivedAmount = this.currentReport && this.currentReport.income
        ? this.currentReport.income
            .filter(i => i.personInCharge === investor.investorId)
            .reduce((sum, i) => sum + (i.amount || 0), 0)
        : 0;

      // Calculate final amount (everything in SGD)
      // Formula: Final = Profit Share + Paid - Received
      // Always recalculate instead of using stored transaction data
      const finalAmount = profitShare + paidAmount - receivedAmount;

      html += `
        <tr>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center gap-2">
              ${
                investor.avatar
                  ? `<img src="${this.getOptimizedAvatarUrl(
                      investor.avatar,
                      "small"
                    )}" alt="${escapeHtml(
                      investor.name
                    )}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">`
                  : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 15px;">${escapeHtml(
                      investor.name.charAt(0).toUpperCase()
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
        API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(this.selectedProperty)
      );

      if (!tenantsResponse.ok) {
        reminderContainer.style.display = "none";
        return;
      }

      const tenantsResult = await tenantsResponse.json();
      const allTenants = tenantsResult.success ? (tenantsResult.tenants || []) : [];

      // Filter tenants whose rental period overlaps with current month
      const currentMonthTenants = allTenants.filter(tenant => {
        if (!tenant.properties || !Array.isArray(tenant.properties)) {
          return false;
        }

        // Find the property record for current property
        // Properties can be either strings or objects with propertyId
        const propertyRecord = tenant.properties.find(prop => {
          const propId = typeof prop === 'object' ? prop.propertyId : prop;
          return propId && propId.toUpperCase() === this.selectedProperty.toUpperCase();
        });

        if (!propertyRecord) {
          return false;
        }

        // Check if tenant has move-in/move-out dates in the property record
        // Property record can be an object with moveinDate/moveoutDate fields
        const moveInDate = propertyRecord && typeof propertyRecord === 'object' && propertyRecord.moveinDate
          ? new Date(propertyRecord.moveinDate)
          : null;
        const moveOutDate = propertyRecord && typeof propertyRecord === 'object' && propertyRecord.moveoutDate
          ? new Date(propertyRecord.moveoutDate)
          : null;

        const reportDate = new Date(year, month - 1, 1); // First day of report month
        const reportEndDate = new Date(year, month, 0); // Last day of report month

        // Tenant should be in property during this month
        if (moveInDate && moveInDate > reportEndDate) {
          return false; // Moved in after this month
        }

        if (moveOutDate && moveOutDate < reportDate) {
          return false; // Moved out before this month
        }

        return true; // Tenant was/is in property during this month
      });

      // Get list of tenants who have paid (appear in income as paidBy)
      const paidTenantIdentifiers = new Set();
      if (this.currentReport.income && Array.isArray(this.currentReport.income)) {
        this.currentReport.income.forEach(incomeItem => {
          if (incomeItem.paidBy && incomeItem.paidBy.startsWith("tenant_")) {
            // Extract tenant ID from "tenant_" prefix
            const tenantId = incomeItem.paidBy.replace("tenant_", "");

            // Find the tenant to get all their identifiers
            const tenant = this.tenants.find(t =>
              (t._id && t._id === tenantId) ||
              (t.tenantId && t.tenantId === tenantId) ||
              (t.name && t.name === tenantId) ||
              (t.fin && t.fin === tenantId) ||
              (t.passportNumber && t.passportNumber === tenantId)
            );

            if (tenant) {
              // Add all possible identifiers for this tenant
              if (tenant._id) paidTenantIdentifiers.add(tenant._id);
              if (tenant.tenantId) paidTenantIdentifiers.add(tenant.tenantId);
              if (tenant.name) paidTenantIdentifiers.add(tenant.name);
              if (tenant.fin) paidTenantIdentifiers.add(tenant.fin);
              if (tenant.passportNumber) paidTenantIdentifiers.add(tenant.passportNumber);
            }
          }
        });
      }

      // Find unpaid tenants
      // Match by multiple identifiers: _id, name, fin, passportNumber
      const unpaidTenants = currentMonthTenants.filter(tenant => {
        const identifiers = [
          tenant._id,
          tenant.tenantId,
          tenant.name,
          tenant.fin,
          tenant.passportNumber
        ].filter(Boolean);

        return !identifiers.some(id => paidTenantIdentifiers.has(id));
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
        const tenantsWithRoomType = unpaidTenants.filter(tenant => tenant.roomType);

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
                <strong>Unpaid Rent Reminder</strong> - ${tenantsWithRoomType.length} tenant${tenantsWithRoomType.length > 1 ? 's' : ''} haven't paid rent yet
              </div>
              <i class="bi bi-chevron-down"></i>
            </div>
            <div class="collapse show" id="${collapseId}">
              <div class="mt-2">
                <small class="d-block mb-2 text-muted">The following tenants should have paid rent for this month:</small>
                <ul class="mb-0">
        `;

        tenantsWithRoomType.forEach(tenant => {
          const displayName = tenant.name || tenant.username || tenant.tenantId;
          const phoneNumber = tenant.phoneNumber || '';
          const roomType = this.getRoomTypeDisplayName(tenant.roomType);
          const facebookUrl = tenant.facebookUrl || '';
          const roommateName = tenant.roommateId?.name || '';
          const roommateAvatar = tenant.roommateId?.avatar || '';

          // Generate roommate avatar HTML
          let roommateAvatarHtml = '';
          if (roommateName) {
            if (roommateAvatar) {
              roommateAvatarHtml = `<img src="${escapeHtml(roommateAvatar)}" alt="${escapeHtml(roommateName)}" class="rounded-circle" style="width: 24px; height: 24px; object-fit: cover; border: 2px solid #0dcaf0;" title="Roommate: ${escapeHtml(roommateName)}" data-bs-toggle="tooltip">`;
            } else {
              const initial = roommateName.charAt(0).toUpperCase();
              roommateAvatarHtml = `<div class="rounded-circle bg-info d-flex align-items-center justify-content-center text-white fw-bold" style="width: 24px; height: 24px; font-size: 12px; border: 2px solid #0dcaf0;" title="Roommate: ${escapeHtml(roommateName)}" data-bs-toggle="tooltip">${escapeHtml(initial)}</div>`;
            }
          }

          html += `
            <li class="mb-2">
              <div class="d-flex align-items-center flex-wrap gap-2">
                <strong>${escapeHtml(displayName)}</strong>
                <span class="text-muted">(${escapeHtml(roomType)})</span>
                ${phoneNumber ? `<a href="https://wa.me/${escapeHtml(phoneNumber.replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener noreferrer" class="badge bg-success text-white text-decoration-none" title="Chat on WhatsApp"><i class="bi bi-whatsapp me-1"></i>WhatsApp</a>` : ''}
                ${facebookUrl ? `<a href="${escapeHtml(facebookUrl)}" target="_blank" rel="noopener noreferrer" class="badge bg-primary text-white text-decoration-none" title="View Facebook Profile"><i class="bi bi-facebook me-1"></i>Facebook</a>` : ''}
                ${roommateAvatarHtml}
              </div>
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
        const tooltipTriggerList = reminderContainer.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltipTriggerList.forEach(tooltipTriggerEl => {
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

    // Reset any pending close state when changing months
    this.pendingClose = false;

    // Clear displays immediately to show loading state
    this.updateIncomeDisplay();
    this.updateExpenseDisplay();
    this.updateSummaryDisplay();
    this.updateInvestorDisplay();

    await this.updateMonthDisplay();
    await this.loadFinancialReport();
  }

  async showIncomeExpenseModal(type, existingItem = null, itemIndex = null) {
    // Prevent multiple modal creations
    if (this.isIncomeExpenseModalOpen) {
      return;
    }

    // Check if month is closed (only for new items)
    if (!existingItem && this.currentReport && this.currentReport.isClosed) {
      this.showError("Cannot add items - this month has been closed");
      return;
    }

    // Check if there are required people for this property (investors for both income and expenses)
    if (type === "income" && (!this.investors || this.investors.length === 0)) {
      this.showError(
        "Please add investors to this property before adding income items."
      );
      return;
    }

    if (
      type === "expense" &&
      (!this.investors || this.investors.length === 0)
    ) {
      this.showError(
        "Please add investors to this property before adding expense items."
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
          "input, select, textarea"
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
        const exchangeRateContainer = modalElement.querySelector("#exchangeRateContainer");
        const exchangeRateInput = modalElement.querySelector("#exchangeRateInput");

        // Show/hide exchange rate field based on currency selection
        if (currencySelect && exchangeRateContainer) {
          currencySelect.addEventListener("change", () => {
            if (currencySelect.value === "VND") {
              exchangeRateContainer.style.display = "block";
            } else {
              exchangeRateContainer.style.display = "none";
              if (exchangeRateInput) {
                exchangeRateInput.value = "";
              }
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
        const displayName = tenant.nickname ? `${baseName} (${tenant.nickname})` : baseName;
        return `<option value="${tenant.tenantId}"${isSelected}>${escapeHtml(
          displayName
        )}</option>`;
      })
      .join("");
  }

  generatePaidByOptions(selectedValue = "") {
    let options = "";

    // Add investor options if available
    if (this.investors && this.investors.length > 0) {
      options += '<optgroup label="Investors">';
      options += this.investors
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
      options += "</optgroup>";
    }

    // Add tenant options if available
    if (this.tenants && this.tenants.length > 0) {
      options += '<optgroup label="Tenants">';
      options += this.tenants
        .map((tenant) => {
          // Use a prefix to distinguish tenant IDs from investor IDs
          const tenantValue = `tenant_${
            tenant._id || tenant.tenantId || tenant.id || tenant.fin
          }`;
          const isSelected = tenantValue === selectedValue ? " selected" : "";
          const baseName = tenant.name || "Unknown Tenant";
          const displayName = tenant.nickname ? `${baseName} (${tenant.nickname})` : baseName;

          // Build additional info string
          const additionalInfo = [];
          if (tenant.roomType) {
            additionalInfo.push(this.getRoomTypeDisplayName(tenant.roomType));
          }
          if (tenant.monthlyRent) {
            additionalInfo.push(`$${tenant.monthlyRent}`);
          }

          const infoString = additionalInfo.length > 0 ? ` - ${additionalInfo.join(', ')}` : '';

          return `<option value="${tenantValue}"${isSelected}>${escapeHtml(
            displayName
          )}${infoString}</option>`;
        })
        .join("");
      options += "</optgroup>";
    }

    // If no options available
    if (!options) {
      return '<option value="" disabled>No investors or tenants available for this property</option>';
    }

    return options;
  }

  renderPaidByAvatar(paidBy) {
    if (!paidBy) {
      return `<div class="d-flex align-items-center justify-content-center">
        <div class="rounded-circle bg-light border d-flex align-items-center justify-content-center text-muted" style="width: 32px; height: 32px; font-size: 16px;" data-bs-toggle="tooltip" data-bs-title="No payer specified">
          <i class="bi bi-person"></i>
        </div>
      </div>`;
    }

    let person = null;
    let displayName = "";
    let avatar = null;
    let roomType = null;

    // Check if it's a tenant (prefixed with 'tenant_')
    if (paidBy.startsWith("tenant_")) {
      const tenantId = paidBy.replace("tenant_", "");
      person = this.tenants.find(
        (t) =>
          (t._id && t._id === tenantId) ||
          (t.tenantId && t.tenantId === tenantId) ||
          (t.id && t.id === tenantId) ||
          (t.fin && t.fin === tenantId)
      );
      if (person) {
        displayName = person.name || "Unknown Tenant";
        avatar = person.avatar;

        // Find room type for the current property
        if (person.properties && this.selectedProperty) {
          const propertyAssociation = person.properties.find(
            (prop) => prop.propertyId === this.selectedProperty
          );
          if (propertyAssociation && propertyAssociation.room) {
            roomType = propertyAssociation.room;
          }
        }
      }
    } else {
      // It's an investor
      person = this.investors.find((i) => i.investorId === paidBy);
      if (person) {
        displayName = person.name || "Unknown Investor";
        avatar = person.avatar;
      }
    }

    if (!person) {
      return `<div class="d-flex align-items-center justify-content-center">
        <div class="rounded-circle bg-warning bg-opacity-25 border border-warning d-flex align-items-center justify-content-center text-warning" style="width: 32px; height: 32px; font-size: 16px;" data-bs-toggle="tooltip" data-bs-title="Unknown payer">
          <i class="bi bi-person-question"></i>
        </div>
      </div>`;
    }

    return `
      <div class="d-flex flex-column align-items-center justify-content-center">
        <div class="d-flex align-items-center justify-content-center mb-1">
          ${
            avatar
              ? `<img src="${this.getOptimizedAvatarUrl(
                  avatar,
                  "small"
                )}" alt="${escapeHtml(
                  displayName
                )}" class="rounded-circle" style="width: 32px; height: 32px; object-fit: cover;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(
                  displayName
                )}">`
              : `<div class="rounded-circle bg-info d-flex align-items-center justify-content-center text-white fw-bold" style="width: 32px; height: 32px; font-size: 14px;" data-bs-toggle="tooltip" data-bs-title="${escapeHtml(
                  displayName
                )}">${escapeHtml(displayName.charAt(0).toUpperCase())}</div>`
          }
        </div>
        ${roomType ? `<div class="badge bg-secondary" style="font-size: 0.65rem; padding: 2px 6px;">${escapeHtml(this.getRoomTypeDisplayName(roomType))}</div>` : ''}
      </div>
    `;
  }

  renderCurrencyFlag(currency) {
    // Default to SGD if currency is not specified
    const curr = currency || 'SGD';

    if (curr === 'VND') {
      return '<span style="font-size: 1.2rem;" title="Vietnamese Dong">🇻🇳</span>';
    } else {
      return '<span style="font-size: 1.2rem;" title="Singapore Dollar">🇸🇬</span>';
    }
  }

  renderPaidByName(paidBy) {
    if (!paidBy) {
      return '-';
    }

    let person = null;
    let displayName = "";
    let roomType = null;

    // Check if it's a tenant (prefixed with 'tenant_')
    if (paidBy.startsWith("tenant_")) {
      const tenantId = paidBy.replace("tenant_", "");
      person = this.tenants.find(
        (t) =>
          (t._id && t._id === tenantId) ||
          (t.tenantId && t.tenantId === tenantId) ||
          (t.id && t.id === tenantId) ||
          (t.fin && t.fin === tenantId)
      );
      if (person) {
        displayName = person.name || "Unknown Tenant";

        // Find room type for the current property
        if (person.properties && this.selectedProperty) {
          const propertyAssociation = person.properties.find(
            (prop) => prop.propertyId === this.selectedProperty
          );
          if (propertyAssociation && propertyAssociation.room) {
            roomType = propertyAssociation.room;
          }
        }
      }
    } else {
      // It's an investor
      person = this.investors.find((i) => i.investorId === paidBy);
      if (person) {
        displayName = person.name || "Unknown Investor";
      }
    }

    if (!person || !displayName) {
      return 'Unknown';
    }

    // Return name with room type if available
    if (roomType) {
      return `${escapeHtml(displayName)}\n(${escapeHtml(this.getRoomTypeDisplayName(roomType))})`;
    }

    return escapeHtml(displayName);
  }

  createIncomeExpenseModalHtml(type, existingItem = null) {
    const isIncome = type === "income";
    const isEditing = existingItem !== null;
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
    const paidByValue = existingItem ? existingItem.paidBy : "";
    const detailsValue = existingItem
      ? escapeHtml(existingItem.details || "")
      : "";
    const dateValue =
      existingItem && existingItem.date
        ? new Date(existingItem.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]; // Default to today
    const currencyValue = existingItem ? (existingItem.currency || 'SGD') : 'SGD';
    const exchangeRateValue = existingItem && existingItem.exchangeRate
      ? existingItem.exchangeRate.toLocaleString('en-US')
      : '';

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
                                        <option value="SGD" ${currencyValue === 'SGD' ? 'selected' : ''}>\ud83c\uddf8\ud83c\uddec SGD - Singapore Dollar</option>
                                        <option value="VND" ${currencyValue === 'VND' ? 'selected' : ''}>\ud83c\uddfb\ud83c\uddf3 VND - Vietnamese Dong</option>
                                    </select>
                                    <div class="form-text">Select the currency for this income</div>
                                </div>
                                <div class="mb-3" id="exchangeRateContainer" style="display: ${currencyValue === 'VND' ? 'block' : 'none'};">
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
                                          personInChargeValue
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
                                    <select class="form-select" name="paidBy">
                                        <option value="">Select who paid (optional)...</option>
                                        ${this.generatePaidByOptions(
                                          paidByValue
                                        )}
                                    </select>
                                    <div class="form-text">Optional: Select who actually paid/initiated this transaction</div>
                                </div>
                                `
                                    : ""
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
    };

    // Add paidBy field only for income transactions
    if (type === "income") {
      const paidBy = formData.get("paidBy");
      if (paidBy) {
        itemData.paidBy = paidBy;
      }

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
      const isEditing = this.editingItem !== null;

      let endpoint;
      let httpMethod;

      if (isEditing) {
        // For editing, we need to include the item index in the endpoint
        endpoint =
          (type === "income"
            ? API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_INCOME(
                this.selectedProperty,
                year,
                month
              )
            : API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_EXPENSES(
                this.selectedProperty,
                year,
                month
              )) + `/${this.editingItemIndex}`;
        httpMethod = "PUT";
      } else {
        // For adding new items
        endpoint =
          type === "income"
            ? API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_INCOME(
                this.selectedProperty,
                year,
                month
              )
            : API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_EXPENSES(
                this.selectedProperty,
                year,
                month
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
          } successfully`
        );
      } else {
        throw new Error(
          result.message ||
            `Failed to ${isEditing ? "update" : "add"} ${type} item`
        );
      }
    } catch (error) {
      console.error(`Error saving ${type} item:`, error);
      this.showError(
        error.message ||
          `Failed to ${isEditing ? "update" : "add"} ${type} item`
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
      (inv) => inv.investorId === investorId
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
          p.propertyId?.toUpperCase() === this.selectedProperty?.toUpperCase()
      );
      console.log("Property data found:", propertyData);
      console.log("Looking for propertyId:", this.selectedProperty);
      console.log(
        "Looking for propertyId (uppercase):",
        this.selectedProperty?.toUpperCase()
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
        this.investors.map((inv) => inv.investorId)
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
            "Existing investor added to this property successfully"
          );
        } else {
          this.showSuccess("New investor created and added successfully");
        }
      }
    } catch (error) {
      console.error(`Error saving investor:`, error);
      this.showError(
        error.message || `Failed to ${investorId ? "update" : "add"} investor`
      );
    }
  }

  async createInvestor(investorData) {
    try {
      // First, check if an investor with this username already exists
      const allInvestorsResponse = await API.get(
        API_CONFIG.ENDPOINTS.INVESTORS
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
            (p) => p.propertyId === this.selectedProperty
          );

          if (hasProperty) {
            throw new Error("Investor is already invested in this property");
          }

          // Investor exists, just add this property to their record

          const addPropertyResponse = await API.post(
            API_CONFIG.ENDPOINTS.INVESTOR_ADD_PROPERTY(
              existingInvestor.investorId
            ),
            {
              propertyId: this.selectedProperty,
              percentage: investorData.percentage,
            }
          );

          const addPropertyResult = await addPropertyResponse.json();

          if (!addPropertyResult.success) {
            throw new Error(
              addPropertyResult.message ||
                "Failed to add property to existing investor"
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
        newInvestor
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
      investorData
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
        "Are you sure you want to remove this investor from this property?"
      )
    ) {
      return;
    }

    try {
      const response = await API.delete(
        API_CONFIG.ENDPOINTS.INVESTOR_REMOVE_PROPERTY(
          investorId,
          this.selectedProperty
        )
      );
      const result = await response.json();

      if (result.success) {
        await this.loadInvestors(this.selectedProperty);

        // Show different messages based on the action taken
        if (result.action === "deleted_completely") {
          this.showSuccess(
            "Investor removed completely from database (no more property investments)"
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
        "No financial report loaded. Please select a property and month."
      );
      return;
    }

    if (!this.currentReport[propertyName]) {
      console.error(
        `Property '${propertyName}' not found in current report:`,
        this.currentReport
      );
      this.showError(`No ${type} data found in current report`);
      return;
    }

    if (!Array.isArray(this.currentReport[propertyName])) {
      console.error(
        `Property '${propertyName}' is not an array:`,
        this.currentReport[propertyName]
      );
      this.showError(`Invalid ${type} data format`);
      return;
    }

    if (index >= this.currentReport[propertyName].length) {
      console.error(
        `Index ${index} is out of bounds for ${propertyName} array of length ${this.currentReport[propertyName].length}`
      );
      console.error(
        `Current ${propertyName} array:`,
        this.currentReport[propertyName]
      );
      this.showError(
        `Item not found - index out of bounds. Refreshing data...`
      );
      // Refresh the financial report to fix the display
      this.loadFinancialReport();
      return;
    }

    const item = this.currentReport[propertyName][index];
    if (!item) {
      console.error(
        `Item at index ${index} is null/undefined in ${propertyName}`
      );
      console.error(
        `Current ${propertyName} array:`,
        this.currentReport[propertyName]
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
              month
            ) + `/${index}`
          : API_CONFIG.ENDPOINTS.FINANCIAL_REPORT_EXPENSES(
              this.selectedProperty,
              year,
              month
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
          } item deleted successfully`
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
          month
        )
      );

      const result = await response.json();

      if (result.success) {
        this.currentReport = result.data;
        await this.updateClosedStatus();
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
          month
        )
      );

      const result = await response.json();

      if (result.success) {
        this.currentReport = result.data;
        await this.updateClosedStatus();
        this.showSuccess("Month reopened successfully!");
      } else {
        throw new Error(result.message || "Failed to reopen month");
      }
    } catch (error) {
      console.error("Error reopening month:", error);
      this.showError(error.message || "Failed to reopen month");
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

      // Get property information
      let propertyInfo = "";
      if (this.selectedProperty) {
        try {
          const property = await this.getPropertyDetails(this.selectedProperty);
          if (property) {
            propertyInfo = `${property.unit}, ${property.address}`;
          } else {
            propertyInfo = `Property ID: ${this.selectedProperty}`;
          }
        } catch (error) {
          console.log("Error fetching property details:", error);
          propertyInfo = `Property ID: ${this.selectedProperty}`;
        }
      }

      currentMonthEl.innerHTML = `
        <div class="d-flex flex-column align-items-center">
          <div class="fw-bold">${month} ${year}${isClosed ? " 🔒" : ""}</div>
          ${propertyInfo ? `<div class="text-muted" style="font-size: 0.9rem;">${propertyInfo}</div>` : ""}
        </div>
      `;
    }

    if (currentMonthBadge) {
      const now = new Date();
      const isCurrentMonth =
        this.currentDate.getMonth() === now.getMonth() &&
        this.currentDate.getFullYear() === now.getFullYear();

      const isClosed = this.currentReport && this.currentReport.isClosed;

      let badgeText, badgeClass;

      if (isClosed) {
        badgeText = "Closed";
        badgeClass = "badge bg-danger";
      } else if (isCurrentMonth) {
        badgeText = "Current Month";
        badgeClass = "badge bg-info";
      } else {
        badgeText = "Historical";
        badgeClass = "badge bg-secondary";
      }

      currentMonthBadge.textContent = badgeText;
      currentMonthBadge.className = badgeClass;
    }
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
      '[id^="editIncomeBtn-"], [id^="editExpenseBtn-"]'
    );
    const deleteButtons = document.querySelectorAll(
      'button[onclick*="toggleDeleteConfirm"], button[onclick*="confirmDeleteItem"]'
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

      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPos = 15;
      const margin = 12;
      const contentWidth = pageWidth - (2 * margin);

      // Helper function to get last 2 words of a name
      const getShortName = (fullName) => {
        if (!fullName) return '-';
        const words = fullName.trim().split(' ');
        return words.length >= 2 ? words.slice(-2).join(' ') : fullName;
      };

      // Helper to get paid by details for PDF (name + room type)
      const getPaidByForPDF = (paidBy) => {
        if (!paidBy) return { name: '-', roomType: null };

        let person = null;
        let displayName = "";
        let roomType = null;

        // Check if it's a tenant (prefixed with 'tenant_')
        if (paidBy.startsWith("tenant_")) {
          const tenantId = paidBy.replace("tenant_", "");
          person = this.tenants.find(
            (t) =>
              (t._id && t._id === tenantId) ||
              (t.tenantId && t.tenantId === tenantId) ||
              (t.id && t.id === tenantId) ||
              (t.fin && t.fin === tenantId)
          );
          if (person) {
            displayName = person.name || "Unknown Tenant";

            // Find room type for the current property - use roomType from API if available
            if (person.roomType) {
              roomType = person.roomType;
            } else if (person.properties && this.selectedProperty) {
              const propertyAssociation = person.properties.find(
                (prop) => prop.propertyId === this.selectedProperty
              );
              if (propertyAssociation && propertyAssociation.room) {
                roomType = propertyAssociation.room;
              }
            }
          }
        } else {
          // It's an investor
          person = this.investors.find((i) => i.investorId === paidBy);
          if (person) {
            displayName = person.name || "Unknown Investor";
          }
        }

        if (!person || !displayName) {
          return { name: 'Unknown', roomType: null };
        }

        return {
          name: getShortName(displayName),
          roomType: roomType ? this.getRoomTypeDisplayName(roomType) : null
        };
      };

      // Helper to remove Vietnamese diacritics for better PDF rendering
      const removeDiacritics = (str) => {
        if (!str) return '';
        return str.normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/đ/g, 'd')
                  .replace(/Đ/g, 'D');
      };

      // Helper to normalize Vietnamese text for PDF display
      // This keeps the text readable by normalizing to NFC (composed form)
      const normalizeVietnamese = (str) => {
        if (!str) return '';
        // Normalize to composed form (NFC) which jsPDF handles better
        return str.normalize('NFC');
      };

      // Helper to wrap text into multiple lines
      const wrapText = (text, maxWidth) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
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

        paragraphs.forEach(paragraph => {
          if (paragraph.trim() === '') {
            // Preserve empty lines
            allLines.push('');
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
        if (!name) return '?';
        const words = name.trim().split(' ');
        return words[words.length - 1];
      };

      // Title with month/year on same line
      const reportMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
      const monthName = reportMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text("FINANCIAL REPORT", pageWidth / 2, yPos, { align: 'center' });

      // Add month/year on the right side of the same line
      pdf.setFontSize(12);
      pdf.text(monthName, pageWidth - margin, yPos, { align: 'right' });

      yPos += 6;
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');
      const propertyLines = propertyHeader.split('\n');
      propertyLines.forEach(line => {
        pdf.text(line, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
      });

      yPos += 4;

      // INCOME SECTION
      pdf.setFont(undefined, 'bold');
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
        pdf.rect(margin, yPos - 4, contentWidth, 5, 'FD');
        pdf.setFont(undefined, 'bold');
        pdf.setFontSize(8);
        pdf.text("Item", colItem, yPos);
        pdf.text("Date", colDate, yPos);
        pdf.text("Person", colPerson, yPos);
        pdf.text("Paid By", colPaidBy, yPos);
        pdf.text("Amount", colAmount, yPos, { align: 'right' });
        yPos += 5;

        pdf.setFont(undefined, 'normal');

        // Process income items with avatars
        for (let idx = 0; idx < this.currentReport.income.length; idx++) {
          const item = this.currentReport.income[idx];
          const investor = this.investors.find(inv => inv.investorId === item.personInCharge);
          const paidByData = getPaidByForPDF(item.paidBy);
          const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';

          // Wrap item text into multiple lines
          const itemText = removeDiacritics(item.item);
          const itemLines = wrapText(itemText, 58); // max width for item column
          const mainLineHeight = 4;
          const itemHeight = Math.max(itemLines.length * mainLineHeight, 6);

          // Check if there are details to show and wrap them
          const hasDetails = item.details && item.details.trim().length > 0;
          let detailsLines = [];
          let detailsHeight = 0;

          if (hasDetails) {
            // Strip diacritics to prevent font breaking in jsPDF (standard fonts don't support Vietnamese)
            const detailsText = removeDiacritics(item.details);
            pdf.setFontSize(7);
            // Use wrapMultiLineText to handle newlines properly
            detailsLines = wrapMultiLineText(detailsText, contentWidth - 8);
            pdf.setFontSize(8);
            // Calculate height: 3.2mm per line + 3mm padding between item and details
            detailsHeight = detailsLines.length > 0 ? (detailsLines.length * 3.2) + 3 : 0;
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
            pdf.rect(margin, yPos - 1, contentWidth, totalRowHeight + 2, 'F');
          }

          // Store starting Y position for this row
          const rowStartY = yPos;

          // Draw item text (multi-line)
          pdf.setFontSize(8);
          itemLines.forEach((line, lineIdx) => {
            pdf.text(line, colItem, rowStartY + (lineIdx * mainLineHeight));
          });

          // Draw other columns on first line
          pdf.text(dateStr, colDate, rowStartY);

          // Show last word of investor name
          if (investor) {
            const lastName = removeDiacritics(getLastWord(investor.name));
            pdf.text(lastName, colPerson, rowStartY);
          }

          // Paid by - show name with badge next to it
          const paidByName = removeDiacritics(paidByData.name);
          pdf.text(paidByName, colPaidBy, rowStartY);

          // Add room type badge next to name if available
          if (paidByData.roomType) {
            const nameWidth = pdf.getTextWidth(paidByName);
            const badgeX = colPaidBy + nameWidth + 1.5;

            pdf.setFontSize(6);
            pdf.setFillColor(108, 117, 125);
            pdf.setDrawColor(108, 117, 125);
            const badgeText = removeDiacritics(paidByData.roomType);
            const badgeWidth = pdf.getTextWidth(badgeText) + 2;
            const badgeHeight = 2.5;

            pdf.roundedRect(badgeX, rowStartY - 2.2, badgeWidth, badgeHeight, 0.5, 0.5, 'FD');
            pdf.setTextColor(255, 255, 255);
            pdf.text(badgeText, badgeX + 1, rowStartY - 0.2);
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
          }

          // Draw amount
          pdf.setTextColor(0, 128, 0);
          pdf.text(`$${item.amount.toFixed(2)}`, colAmount, rowStartY, { align: 'right' });
          pdf.setTextColor(0, 0, 0);

          // Draw details below item if available
          if (detailsLines.length > 0) {
            const detailsStartY = rowStartY + itemHeight + 2;
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont(undefined, 'normal');

            detailsLines.forEach((line, lineIdx) => {
              // Only draw non-empty lines
              if (line.trim() !== '') {
                pdf.text(line, colItem + 2, detailsStartY + (lineIdx * 3.2));
              }
            });

            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
          }

          yPos += totalRowHeight + 1;
        }

        yPos += 2;
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(0, 128, 0);
        pdf.text("Total:", pageWidth - margin - 35, yPos);
        pdf.text(`$${this.currentReport.totalIncome.toFixed(2)}`, colAmount, yPos, { align: 'right' });

        pdf.setTextColor(0, 0, 0);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        yPos += 6;
      } else {
        pdf.setFont(undefined, 'normal');
        pdf.text("No income items", margin + 1, yPos);
        yPos += 6;
      }

      // EXPENSES SECTION
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(11);
      pdf.text("EXPENSES", margin, yPos);
      yPos += 5;

      pdf.setFontSize(8);

      if (this.currentReport.expenses && this.currentReport.expenses.length > 0) {
        // Draw table header (same columns as income)
        pdf.setFillColor(245, 245, 245);
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(margin, yPos - 4, contentWidth, 5, 'FD');
        pdf.setFont(undefined, 'bold');
        pdf.text("Item", colItem, yPos);
        pdf.text("Date", colDate, yPos);
        pdf.text("Person", colPerson, yPos);
        pdf.text("Amount", colAmount, yPos, { align: 'right' });
        yPos += 5;

        pdf.setFont(undefined, 'normal');

        // Process expense items with avatars
        for (let idx = 0; idx < this.currentReport.expenses.length; idx++) {
          const item = this.currentReport.expenses[idx];
          const investor = this.investors.find(inv => inv.investorId === item.personInCharge);
          const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';

          // Wrap item text into multiple lines
          const itemText = removeDiacritics(item.item);
          const itemLines = wrapText(itemText, 58); // max width for item column
          const mainLineHeight = 4;
          const itemHeight = Math.max(itemLines.length * mainLineHeight, 6);

          // Check if there are details to show and wrap them
          const hasDetails = item.details && item.details.trim().length > 0;
          let detailsLines = [];
          let detailsHeight = 0;

          if (hasDetails) {
            // Strip diacritics to prevent font breaking in jsPDF (standard fonts don't support Vietnamese)
            const detailsText = removeDiacritics(item.details);
            pdf.setFontSize(7);
            // Use wrapMultiLineText to handle newlines properly
            detailsLines = wrapMultiLineText(detailsText, contentWidth - 8);
            pdf.setFontSize(8);
            // Calculate height: 3.2mm per line + 3mm padding between item and details
            detailsHeight = detailsLines.length > 0 ? (detailsLines.length * 3.2) + 3 : 0;
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
            pdf.rect(margin, yPos - 1, contentWidth, totalRowHeight + 2, 'F');
          }

          // Store starting Y position for this row
          const rowStartY = yPos;

          // Draw item text (multi-line)
          pdf.setFontSize(8);
          itemLines.forEach((line, lineIdx) => {
            pdf.text(line, colItem, rowStartY + (lineIdx * mainLineHeight));
          });

          // Draw other columns on first line
          pdf.text(dateStr, colDate, rowStartY);

          // Show last word of investor name
          if (investor) {
            const lastName = removeDiacritics(getLastWord(investor.name));
            pdf.text(lastName, colPerson, rowStartY);
          }

          // Draw amount
          pdf.setTextColor(128, 0, 0);
          pdf.text(`$${item.amount.toFixed(2)}`, colAmount, rowStartY, { align: 'right' });
          pdf.setTextColor(0, 0, 0);

          // Draw details below item if available
          if (detailsLines.length > 0) {
            const detailsStartY = rowStartY + itemHeight + 2;
            pdf.setFontSize(7);
            pdf.setTextColor(100, 100, 100);
            pdf.setFont(undefined, 'normal');

            detailsLines.forEach((line, lineIdx) => {
              // Only draw non-empty lines
              if (line.trim() !== '') {
                pdf.text(line, colItem + 2, detailsStartY + (lineIdx * 3.2));
              }
            });

            pdf.setFont(undefined, 'normal');
            pdf.setTextColor(0, 0, 0);
            pdf.setFontSize(8);
          }

          yPos += totalRowHeight + 1;
        }

        yPos += 2;
        pdf.setFont(undefined, 'bold');
        pdf.setTextColor(128, 0, 0);
        pdf.text("Total:", pageWidth - margin - 35, yPos);
        pdf.text(`$${this.currentReport.totalExpenses.toFixed(2)}`, colAmount, yPos, { align: 'right' });

        pdf.setTextColor(0, 0, 0);
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        yPos += 6;
      } else {
        pdf.setFont(undefined, 'normal');
        pdf.text("No expense items", margin + 1, yPos);
        yPos += 6;
      }

      // NET PROFIT SECTION
      const netProfit = (this.currentReport.totalIncome || 0) - (this.currentReport.totalExpenses || 0);

      // Add spacing before NET PROFIT
      yPos += 6;

      // NET PROFIT - no box, no background
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.text("NET PROFIT:", margin, yPos);
      pdf.setTextColor(netProfit >= 0 ? 0 : 150, netProfit >= 0 ? 100 : 0, 0);
      pdf.setFontSize(11);
      pdf.text(`$${netProfit.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      pdf.setTextColor(0, 0, 0);

      // Add spacing after NET PROFIT
      yPos += 10;

      // INVESTOR DISTRIBUTION SECTION
      if (this.investors && this.investors.length > 0) {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.text("INVESTOR DISTRIBUTION", margin, yPos);
        yPos += 5;

        pdf.setFontSize(8);
        pdf.setFillColor(245, 245, 245);
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(margin, yPos - 4, contentWidth, 5, 'FD');
        pdf.setFont(undefined, 'bold');
        pdf.text("Investor", margin + 1, yPos);
        pdf.text("Share", margin + 48, yPos);
        pdf.text("Profit", margin + 63, yPos);
        pdf.text("Paid", margin + 85, yPos);
        pdf.text("Received", margin + 107, yPos);
        pdf.text("Final", pageWidth - margin - 1, yPos, { align: 'right' });
        yPos += 5;

        pdf.setFont(undefined, 'normal');

        // Process investor distribution with avatars
        for (let idx = 0; idx < this.investors.length; idx++) {
          const investor = this.investors[idx];
          const propertyData = investor.properties.find(p => p.propertyId === this.selectedProperty);
          const percentage = propertyData ? propertyData.percentage : 0;
          const investorShare = (netProfit * percentage) / 100;

          const expensesPaid = this.currentReport.expenses
            ? this.currentReport.expenses.filter(e => e.personInCharge === investor.investorId)
                .reduce((sum, e) => sum + e.amount, 0)
            : 0;

          const incomeReceived = this.currentReport.income
            ? this.currentReport.income.filter(i => i.personInCharge === investor.investorId)
                .reduce((sum, i) => sum + i.amount, 0)
            : 0;

          const existingTrans = this.currentReport.investorTransactions
            ? this.currentReport.investorTransactions.find(t => t.investorId === investor.investorId)
            : null;

          const alreadyPaid = existingTrans ? existingTrans.alreadyPaid : 0;
          const alreadyReceived = existingTrans ? existingTrans.alreadyReceived : 0;

          const finalAmount = investorShare - alreadyPaid + alreadyReceived + expensesPaid - incomeReceived;

          // Alternating row colors
          if (idx % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, yPos - 3.5, contentWidth, 4, 'F');
          }

          // Show investor name
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(8);
          let truncInvName = removeDiacritics(investor.name);
          truncInvName = truncInvName.length > 30 ? truncInvName.substring(0, 28) + '..' : truncInvName;
          pdf.text(truncInvName, margin + 1, yPos);

          pdf.text(`${percentage}%`, margin + 48, yPos);
          pdf.text(`$${investorShare.toFixed(2)}`, margin + 63, yPos);
          pdf.text(`$${expensesPaid.toFixed(2)}`, margin + 85, yPos);
          pdf.text(`$${incomeReceived.toFixed(2)}`, margin + 107, yPos);
          pdf.setTextColor(finalAmount >= 0 ? 0 : 150, finalAmount >= 0 ? 100 : 0, 0);
          pdf.setFont(undefined, 'bold');
          pdf.text(`$${finalAmount.toFixed(2)}`, pageWidth - margin - 1, yPos, { align: 'right' });
          pdf.setFont(undefined, 'normal');
          pdf.setTextColor(0, 0, 0);
          yPos += 4;
        }
      }

      // Download PDF
      const fileNameBase = property ? `${removeDiacritics(property.propertyId)}_${removeDiacritics(property.unit)}` : this.selectedProperty;
      const fileName = `Financial_Report_${fileNameBase}_${removeDiacritics(monthName).replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);

      this.showSuccess("Financial report exported as PDF successfully!");
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
      const cached = this.properties.find(p => p.propertyId === propertyId);
      if (cached) {
        console.log('Using cached property:', cached);
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
        console.log('Fetched property from API:', property);
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

    try {
      // Show loading state
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
      btn.disabled = true;

      // Find the financial reports section - target the main content area
      const reportSection = document.querySelector('#financialReportContent') ||
                          document.querySelector('#financial-section');

      if (!reportSection) {
        throw new Error("Could not find report section to capture");
      }

      // Make sure the section is visible
      if (reportSection.style.display === 'none') {
        throw new Error("Please load a financial report first");
      }

      // Capture the screenshot
      const canvas = await html2canvas(reportSection, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
        windowWidth: reportSection.scrollWidth,
        windowHeight: reportSection.scrollHeight
      });

      // Convert canvas to blob and copy to clipboard
      canvas.toBlob(async (blob) => {
        try {
          // Copy to clipboard
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ]);

          // Show success feedback
          btn.innerHTML = '<i class="bi bi-check-circle"></i>';
          btn.classList.remove('btn-light');
          btn.classList.add('btn-success');

          // Restore button after 2 seconds
          setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.classList.remove('btn-success');
            btn.classList.add('btn-light');
            btn.disabled = false;
          }, 2000);

        } catch (clipboardError) {
          console.error("Clipboard error:", clipboardError);
          alert("Screenshot captured but failed to copy to clipboard. Your browser may not support this feature.");

          // Restore button
          btn.innerHTML = originalHTML;
          btn.disabled = false;
        }
      }, 'image/png');

    } catch (error) {
      console.error("Screenshot capture error:", error);
      alert(`Failed to capture screenshot: ${error.message}`);

      // Restore button
      btn.innerHTML = '<i class="bi bi-camera"></i>';
      btn.disabled = false;
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
        `#exportableFinancialReport ${selector}`
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
      try {
        // Get property details
        const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
        const result = await response.json();

        if (result.success) {
          const property = result.properties.find(
            (p) => p.propertyId === this.selectedProperty
          );
          if (property) {
            exportPropertyInfo.textContent = `${property.propertyId} - ${property.address}, ${property.unit}`;
          } else {
            exportPropertyInfo.textContent = `Property ID: ${this.selectedProperty}`;
          }
        }
      } catch (error) {
        console.error("Error fetching property details for export:", error);
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
      sourceCanvas.height
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
      croppedHeight
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
              `File "${file.name}" is too large. Maximum size is 10MB.`
            );
            e.target.value = "";
            return;
          }

          if (!allowedTypes.includes(file.type)) {
            this.showError(
              `File "${file.name}" is not supported. Only images and PDFs are allowed.`
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
          this.uploadedBillEvidence
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
                        item.date
                      ).toLocaleDateString()}<br>`
                    : ""
                }
                ${
                  item.details
                    ? `<strong>Details:</strong> ${escapeHtml(
                        item.details
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
}

// Make component globally accessible
window.FinancialReportsComponent = FinancialReportsComponent;
