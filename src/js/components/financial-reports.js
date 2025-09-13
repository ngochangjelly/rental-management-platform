// Note: showToast and escapeHtml are expected to be available globally
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

  init() {
    this.bindEvents();
    this.loadProperties();

    // Initial cleanup to ensure no leftover modals from previous sessions
    this.forceCleanupModalBackdrops();
  }

  bindEvents() {
    // Property selector
    const propertySelector = document.getElementById("propertySelector");
    if (propertySelector) {
      propertySelector.addEventListener("change", (e) => {
        this.selectProperty(e.target.value);
      });
    }

    // Month navigation
    const prevMonthBtn = document.getElementById("prevMonth");
    const nextMonthBtn = document.getElementById("nextMonth");

    console.log('Financial Reports - Binding month navigation buttons:');
    console.log('  prevMonthBtn found:', !!prevMonthBtn);
    console.log('  nextMonthBtn found:', !!nextMonthBtn);

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => {
        console.log('Previous month button clicked');
        this.changeMonth(-1);
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
        console.log('Next month button clicked');
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
          console.error('Error showing investor modal:', error);
          this.isModalOpen = false;
        }
      });
    }

    // Export functionality
    const exportBtn = document.getElementById("exportFinancialReportBtn");
    const copyBtn = document.getElementById("copyFinancialReportBtn");

    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!exportBtn.disabled) {
          this.exportFinancialReport();
        }
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (!copyBtn.disabled) {
          this.copyFinancialReportToClipboard();
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
        this.populatePropertySelector(result.properties);
      } else {
        // Handle API errors (like authentication required)
        if (response.status === 401 || response.status === 403) {
          this.showError("Please log in to load properties");
          this.populatePropertySelector([]); // Show empty selector
        } else {
          this.showError(result.error || "Failed to load properties");
          this.populatePropertySelector([]); // Show empty selector
        }
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showError(
        "Failed to load properties. Please check your connection and try again."
      );
      this.populatePropertySelector([]); // Show empty selector with default message
    }
  }

  populatePropertySelector(properties) {
    const selector = document.getElementById("propertySelector");
    if (!selector) return;

    // Clear existing options
    selector.innerHTML = "";

    if (!properties || properties.length === 0) {
      // Show message when no properties are available
      selector.innerHTML =
        '<option value="" disabled>No properties available - please log in or add properties</option>';
      return;
    }

    // Add default selection option
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select a property...";
    selector.appendChild(defaultOption);

    // Add property options
    properties.forEach((property) => {
      const option = document.createElement("option");
      option.value = property.propertyId;
      option.textContent = `${property.propertyId} - ${property.address}, ${property.unit}`;
      selector.appendChild(option);
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

    if (!propertyId) {
      this.selectedProperty = null;
      document.getElementById("financialReportContent").style.display = "none";
      return;
    }

    this.selectedProperty = propertyId;
    document.getElementById("financialReportContent").style.display = "block";

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
      const response = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(propertyId)
      );
      const result = await response.json();

      if (result.success) {
        this.tenants = result.tenants || [];
      } else {
        this.tenants = [];
      }
    } catch (error) {
      console.error("Error loading tenants:", error);
      this.tenants = [];
    }
  }

  async loadFinancialReport() {
    if (!this.selectedProperty) {
      console.log('loadFinancialReport: No selected property');
      return;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      console.log(`loadFinancialReport: Loading data for ${this.selectedProperty} - ${year}/${month}`);

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
          console.log(`loadFinancialReport: Loaded existing report:`, this.currentReport);
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
        console.log(`loadFinancialReport: Created empty report for ${year}/${month}`);
      }

      console.log(`loadFinancialReport: Calling updateDisplays with:`, this.currentReport);
      this.updateDisplays();
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
      this.updateDisplays();
    }
  }

  updateDisplays() {
    this.updateIncomeDisplay();
    this.updateExpenseDisplay();
    this.updateSummaryDisplay();
    this.updateInvestorDisplay();
    this.updateClosedStatus();
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

    // Create compact table format
    let html = `
      <div class="table-responsive">
        <table class="table table-sm mb-0">
          <thead>
            <tr class="table-success">
              <th class="border-0 small">Item</th>
              <th class="border-0 small">Date</th>
              <th class="border-0 small">Person</th>
              <th class="border-0 small text-end">Amount</th>
              <th class="border-0 small text-center actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.currentReport.income.forEach((item, index) => {
      total += item.amount;

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
      const transactionDate = item.date ? new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) : 'No date';

      // Check if item has additional details or evidence
      const hasDetails = item.details && item.details.trim() !== '';
      const hasEvidence = item.billEvidence && item.billEvidence.length > 0;
      const hasAdditionalInfo = hasDetails || hasEvidence;

      html += `
        <tr>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center gap-1">
              <i class="bi bi-plus-circle-fill text-success me-1"></i>
              <span>${escapeHtml(item.item)}</span>
              ${hasAdditionalInfo ? `<i class="bi bi-info-circle text-muted" title="Has additional details or evidence" style="font-size: 12px;"></i>` : ''}
            </div>
            ${hasDetails ? `<div class="small text-muted mt-1" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.details)}">${escapeHtml(item.details.substring(0, 50))}${item.details.length > 50 ? '...' : ''}</div>` : ''}
            ${hasEvidence ? `<div class="small text-info mt-1"><i class="bi bi-paperclip"></i> ${item.billEvidence.length} file(s)</div>` : ''}
          </td>
          <td class="small border-0 align-middle">${transactionDate}</td>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center justify-content-center">
              ${investorAvatar ? 
                `<img src="${this.getOptimizedAvatarUrl(investorAvatar, 'small')}" alt="${escapeHtml(investorName)}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">` :
                `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 15px;">${escapeHtml(investorName.charAt(0).toUpperCase())}</div>`
              }
            </div>
          </td>
          <td class="small border-0 align-middle text-end fw-bold text-success">$${item.amount.toFixed(2)}</td>
          <td class="border-0 align-middle text-center actions-column">
            <div class="btn-group btn-group-sm">
              ${hasEvidence ? `<button class="btn btn-outline-info btn-sm p-1" onclick="window.financialReports.showBillEvidence('income', ${index})" title="View Evidence">
                <i class="bi bi-eye"></i>
              </button>` : ''}
              <button class="btn btn-outline-primary btn-sm p-1" id="editIncomeBtn-${index}" onclick="window.financialReports.editItem('income', ${index})" title="Edit">
                <span class="edit-icon"><i class="bi bi-pencil"></i></span>
                <span class="loading-spinner d-none">
                  <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                </span>
              </button>
              ${isPendingDelete 
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
    if (totalIncomeEl) totalIncomeEl.textContent = `$${total.toFixed(2)}`;
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
        <table class="table table-sm mb-0">
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
      const transactionDate = item.date ? new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) : 'No date';

      // Check if item has additional details or evidence
      const hasDetails = item.details && item.details.trim() !== '';
      const hasEvidence = item.billEvidence && item.billEvidence.length > 0;
      const hasAdditionalInfo = hasDetails || hasEvidence;

      html += `
        <tr>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center gap-1">
              <i class="bi bi-dash-circle-fill text-danger me-1"></i>
              <span>${escapeHtml(item.item)}</span>
              ${hasAdditionalInfo ? `<i class="bi bi-info-circle text-muted" title="Has additional details or evidence" style="font-size: 12px;"></i>` : ''}
            </div>
            ${hasDetails ? `<div class="small text-muted mt-1" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(item.details)}">${escapeHtml(item.details.substring(0, 50))}${item.details.length > 50 ? '...' : ''}</div>` : ''}
            ${hasEvidence ? `<div class="small text-info mt-1"><i class="bi bi-paperclip"></i> ${item.billEvidence.length} file(s)</div>` : ''}
          </td>
          <td class="small border-0 align-middle">${transactionDate}</td>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center justify-content-center">
              ${investorAvatar ? 
                `<img src="${this.getOptimizedAvatarUrl(investorAvatar, 'small')}" alt="${escapeHtml(investorName)}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">` :
                `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 15px;">${escapeHtml(investorName.charAt(0).toUpperCase())}</div>`
              }
            </div>
          </td>
          <td class="small border-0 align-middle text-end fw-bold text-danger">$${item.amount.toFixed(2)}</td>
          <td class="border-0 align-middle text-center actions-column">
            <div class="btn-group btn-group-sm">
              ${hasEvidence ? `<button class="btn btn-outline-info btn-sm p-1" onclick="window.financialReports.showBillEvidence('expense', ${index})" title="View Evidence">
                <i class="bi bi-eye"></i>
              </button>` : ''}
              <button class="btn btn-outline-primary btn-sm p-1" id="editExpenseBtn-${index}" onclick="window.financialReports.editItem('expense', ${index})" title="Edit">
                <span class="edit-icon"><i class="bi bi-pencil"></i></span>
                <span class="loading-spinner d-none">
                  <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                </span>
              </button>
              ${isPendingDelete 
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
  }

  updateSummaryDisplay() {
    if (!this.currentReport) return;

    const totalIncome = this.currentReport.totalIncome || 0;
    const totalExpenses = this.currentReport.totalExpenses || 0;
    const netProfit = totalIncome - totalExpenses;

    const netProfitEl = document.getElementById("netProfit");
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
      const investorShare = (netProfit * percentage) / 100;

      // Find existing transaction data
      const existingTransaction =
        this.currentReport && this.currentReport.investorTransactions
          ? this.currentReport.investorTransactions.find(
              (t) => t.investorId === investor.investorId
            )
          : null;

      const alreadyPaid = existingTransaction
        ? existingTransaction.alreadyPaid
        : 0;
      const alreadyReceived = existingTransaction
        ? existingTransaction.alreadyReceived
        : 0;

      // Calculate expenses paid by this investor on behalf of the group
      const expensesPaidByInvestor =
        this.currentReport && this.currentReport.expenses
          ? this.currentReport.expenses
              .filter(
                (expense) => expense.personInCharge === investor.investorId
              )
              .reduce((total, expense) => total + expense.amount, 0)
          : 0;

      // Calculate income received by this investor on behalf of the group
      const incomeReceivedByInvestor =
        this.currentReport && this.currentReport.income
          ? this.currentReport.income
              .filter((income) => income.personInCharge === investor.investorId)
              .reduce((total, income) => total + income.amount, 0)
          : 0;

      // Final amount = investor's share - what they already paid + what they received + expenses they paid on behalf of group - income they received on behalf of group
      const finalAmount =
        investorShare -
        alreadyPaid +
        alreadyReceived +
        expensesPaidByInvestor -
        incomeReceivedByInvestor;

      html += `
        <tr>
          <td class="small border-0 align-middle">
            <div class="d-flex align-items-center justify-content-center">
              ${investor.avatar ? 
                `<img src="${this.getOptimizedAvatarUrl(investor.avatar, 'small')}" alt="${escapeHtml(investor.name)}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">` :
                `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 15px;">${escapeHtml(investor.name.charAt(0).toUpperCase())}</div>`
              }
            </div>
          </td>
          <td class="small border-0 align-middle text-center fw-bold">${percentage}%</td>
          <td class="small border-0 align-middle text-end fw-bold text-primary">$${investorShare.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end fw-bold text-warning">$${expensesPaidByInvestor.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end fw-bold text-info">$${incomeReceivedByInvestor.toFixed(2)}</td>
          <td class="small border-0 align-middle text-end fw-bold ${finalAmount >= 0 ? "text-success" : "text-danger"}">$${finalAmount.toFixed(2)}</td>
          <td class="border-0 align-middle text-center actions-column">
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary btn-sm p-1" onclick="window.financialReports.editInvestor('${investor.investorId}')" title="Edit">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger btn-sm p-1" onclick="window.financialReports.removeInvestor('${investor.investorId}')" title="Remove">
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
  }

  updateMonthDisplay() {
    // Call the enhanced version that includes closed status
    this.updateMonthDisplayWithClosedStatus();
  }

  changeMonth(direction) {
    console.log(`changeMonth called with direction: ${direction}`);
    console.log(`Current date before change:`, this.currentDate);
    
    const newDate = new Date(this.currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    this.currentDate = newDate;

    console.log(`Current date after change:`, this.currentDate);
    console.log(`Selected property:`, this.selectedProperty);

    // Reset any pending close state when changing months
    this.pendingClose = false;

    this.updateMonthDisplay();
    this.loadFinancialReport();
  }

  async showIncomeExpenseModal(type, existingItem = null, itemIndex = null) {
    // Prevent multiple modal creations
    if (this.isIncomeExpenseModalOpen) {
      return;
    }

    // Check if month is closed (only for new items)
    if (!existingItem && this.currentReport && this.currentReport.isClosed) {
      this.showError('Cannot add items - this month has been closed');
      return;
    }

    // Check if there are required people for this property (investors for both income and expenses)
    if (type === "income" && (!this.investors || this.investors.length === 0)) {
      this.showError(
        "Please add investors to this property before adding income items."
      );
      return;
    }
    
    if (type === "expense" && (!this.investors || this.investors.length === 0)) {
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
      if (existingItem && existingItem.billEvidence && existingItem.billEvidence.length > 0) {
        this.displayExistingBillEvidence(existingItem.billEvidence);
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

  generateInvestorOptions(selectedValue = '') {
    if (!this.investors || this.investors.length === 0) {
      return '<option value="" disabled>No investors available for this property</option>';
    }

    return this.investors
      .map((investor) => {
        const isSelected = investor.investorId === selectedValue ? ' selected' : '';
        return `<option value="${investor.investorId}"${isSelected}>${escapeHtml(
          investor.name
        )} (ID: ${investor.investorId})</option>`;
      })
      .join("");
  }

  generateTenantOptions(selectedValue = '') {
    if (!this.tenants || this.tenants.length === 0) {
      return '<option value="" disabled>No tenants available for this property</option>';
    }

    return this.tenants
      .map((tenant) => {
        const isSelected = tenant.tenantId === selectedValue ? ' selected' : '';
        const displayName = tenant.name || 'Unknown Tenant';
        return `<option value="${tenant.tenantId}"${isSelected}>${escapeHtml(displayName)}</option>`;
      })
      .join("");
  }

  createIncomeExpenseModalHtml(type, existingItem = null) {
    const isIncome = type === "income";
    const isEditing = existingItem !== null;
    const title = isEditing 
      ? (isIncome ? "Edit Income Item" : "Edit Expense Item")
      : (isIncome ? "Add Income Item" : "Add Expense Item");
    const icon = isIncome ? "plus-circle" : "dash-circle";
    const editIcon = "pencil";
    const color = isIncome ? "success" : "danger";
    const buttonText = isEditing ? "Update" : "Add";
    const buttonIcon = isEditing ? editIcon : icon;

    const itemValue = existingItem ? escapeHtml(existingItem.item) : '';
    const amountValue = existingItem ? existingItem.amount : '';
    const personInChargeValue = existingItem ? existingItem.personInCharge : '';
    const accountDetailValue = existingItem ? escapeHtml(existingItem.recipientAccountDetail || '') : '';
    const paidByValue = existingItem ? existingItem.paidBy : '';
    const detailsValue = existingItem ? escapeHtml(existingItem.details || '') : '';
    const billEvidenceValue = existingItem ? existingItem.billEvidence || [] : [];
    const dateValue = existingItem && existingItem.date 
      ? new Date(existingItem.date).toISOString().split('T')[0] 
      : new Date().toISOString().split('T')[0]; // Default to today

    return `
            <div class="modal fade" id="incomeExpenseModal" tabindex="-1" aria-labelledby="incomeExpenseModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="incomeExpenseModalLabel">
                                <i class="bi bi-${isEditing ? editIcon : icon} me-2"></i>${title}
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
                                <div class="mb-3">
                                    <label class="form-label">Date <span class="text-danger">*</span></label>
                                    <input type="date" class="form-control" name="date" required value="${dateValue}">
                                    <div class="form-text">Date when this ${type} occurred</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Person in Charge <span class="text-danger">*</span></label>
                                    <select class="form-select" name="personInCharge" required>
                                        <option value="">Select investor...</option>
                                        ${this.generateInvestorOptions(personInChargeValue)}
                                    </select>
                                    <div class="form-text">Select the ${isIncome ? 'investor responsible for collecting this income' : 'investor responsible for this expense'}</div>
                                </div>
                                ${isIncome ? `
                                <div class="mb-3">
                                    <label class="form-label">Paid By</label>
                                    <select class="form-select" name="paidBy">
                                        <option value="">Select who paid (optional)...</option>
                                        ${this.generateInvestorOptions(paidByValue)}
                                    </select>
                                    <div class="form-text">Optional: Select who actually paid/initiated this transaction</div>
                                </div>
                                ` : ''}
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
        endpoint = (type === "income"
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
        httpMethod = 'PUT';
      } else {
        // For adding new items
        endpoint = type === "income"
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
        httpMethod = 'POST';
      }

      const response = httpMethod === 'PUT' 
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
        this.updateDisplays();
        this.showSuccess(
          `${
            type.charAt(0).toUpperCase() + type.slice(1)
          } item ${isEditing ? 'updated' : 'added'} successfully`
        );
      } else {
        throw new Error(result.message || `Failed to ${isEditing ? 'update' : 'add'} ${type} item`);
      }
    } catch (error) {
      console.error(`Error saving ${type} item:`, error);
      this.showError(error.message || `Failed to ${isEditing ? 'update' : 'add'} ${type} item`);
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
      console.log('Investor modal shown event triggered');
      console.log('investorId passed to modal:', investorId);
      
      // Pre-fill form if editing existing investor (do this after modal is shown)
      if (investorId) {
        console.log('About to fill investor form...');
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
    console.log('fillInvestorForm called with investorId:', investorId);
    console.log('Available investors:', this.investors);
    console.log('Selected property:', this.selectedProperty);
    
    const investor = this.investors.find(
      (inv) => inv.investorId === investorId
    );
    
    console.log('Found investor:', investor);
    
    if (investor) {
      const form = document.getElementById("investorForm");
      console.log('Form element found:', !!form);

      if (!form) {
        console.error('Investor form not found in DOM');
        return;
      }

      const usernameInput = form.querySelector('input[name="username"]');
      const nameInput = form.querySelector('input[name="name"]');
      const phoneInput = form.querySelector('input[name="phone"]');
      const emailInput = form.querySelector('input[name="email"]');
      const percentageInput = form.querySelector('input[name="percentage"]');

      console.log('Input elements found:', {
        username: !!usernameInput,
        name: !!nameInput,
        phone: !!phoneInput,
        email: !!emailInput,
        percentage: !!percentageInput
      });

      if (usernameInput) {
        usernameInput.value = investor.username || "";
        console.log('Set username:', investor.username);
        // Trigger change event to ensure any validation or listeners are notified
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (nameInput) {
        nameInput.value = investor.name || "";
        console.log('Set name:', investor.name);
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (phoneInput) {
        phoneInput.value = investor.phone || "";
        console.log('Set phone:', investor.phone);
        phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (emailInput) {
        emailInput.value = investor.email || "";
        console.log('Set email:', investor.email);
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Find the property data for this specific property
      // Try both the original and uppercase versions since backend normalizes to uppercase
      const propertyData = investor.properties.find(
        (p) => p.propertyId === this.selectedProperty || 
               p.propertyId === this.selectedProperty?.toUpperCase() ||
               p.propertyId?.toUpperCase() === this.selectedProperty?.toUpperCase()
      );
      console.log('Property data found:', propertyData);
      console.log('Looking for propertyId:', this.selectedProperty);
      console.log('Looking for propertyId (uppercase):', this.selectedProperty?.toUpperCase());
      console.log('Investor properties:', investor.properties);
      
      if (propertyData && percentageInput) {
        percentageInput.value = propertyData.percentage;
        console.log('Set percentage:', propertyData.percentage);
        percentageInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (percentageInput) {
        console.warn('No property data found or percentage input missing');
        // Set a default value if no property data found
        percentageInput.value = "";
      }
    } else {
      console.error('Investor not found with ID:', investorId);
      console.log('Available investor IDs:', this.investors.map(inv => inv.investorId));
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
      this.showError('Cannot edit items - this month has been closed');
      return;
    }

    // Validate inputs first
    if (typeof index !== 'number' || index < 0) {
      console.error('Invalid index provided to editItem:', index);
      this.showError('Invalid item index');
      return;
    }

    // Map singular type names to plural property names in currentReport
    const propertyName = type === 'expense' ? 'expenses' : type === 'income' ? 'income' : type;
    
    // More detailed validation
    if (!this.currentReport) {
      console.error('No current report loaded');
      this.showError('No financial report loaded. Please select a property and month.');
      return;
    }

    if (!this.currentReport[propertyName]) {
      console.error(`Property '${propertyName}' not found in current report:`, this.currentReport);
      this.showError(`No ${type} data found in current report`);
      return;
    }

    if (!Array.isArray(this.currentReport[propertyName])) {
      console.error(`Property '${propertyName}' is not an array:`, this.currentReport[propertyName]);
      this.showError(`Invalid ${type} data format`);
      return;
    }

    if (index >= this.currentReport[propertyName].length) {
      console.error(`Index ${index} is out of bounds for ${propertyName} array of length ${this.currentReport[propertyName].length}`);
      console.error(`Current ${propertyName} array:`, this.currentReport[propertyName]);
      this.showError(`Item not found - index out of bounds. Refreshing data...`);
      // Refresh the financial report to fix the display
      this.loadFinancialReport();
      return;
    }

    const item = this.currentReport[propertyName][index];
    if (!item) {
      console.error(`Item at index ${index} is null/undefined in ${propertyName}`);
      console.error(`Current ${propertyName} array:`, this.currentReport[propertyName]);
      this.showError('Item not found - item is empty. Refreshing data...');
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
      this.showError('Cannot delete items - this month has been closed');
      return;
    }

    const itemKey = `${type}-${index}`;
    this.pendingDeletes.add(itemKey);
    
    // Re-render the displays to show the check/cancel buttons
    if (type === 'income') {
      this.updateIncomeDisplay();
    } else {
      this.updateExpenseDisplay();
    }
  }

  cancelDeleteItem(type, index) {
    const itemKey = `${type}-${index}`;
    this.pendingDeletes.delete(itemKey);
    
    // Re-render the displays to show the trash button again
    if (type === 'income') {
      this.updateIncomeDisplay();
    } else {
      this.updateExpenseDisplay();
    }
  }

  async confirmDeleteItem(type, index) {
    // Check if month is closed
    if (this.currentReport && this.currentReport.isClosed) {
      this.showError('Cannot delete items - this month has been closed');
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
        this.updateDisplays();
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
    const buttonId = type === 'income' ? `editIncomeBtn-${index}` : `editExpenseBtn-${index}`;
    const button = document.getElementById(buttonId);
    
    if (button) {
      const editIcon = button.querySelector('.edit-icon');
      const loadingSpinner = button.querySelector('.loading-spinner');
      
      if (isLoading) {
        button.disabled = true;
        if (editIcon) editIcon.classList.add('d-none');
        if (loadingSpinner) loadingSpinner.classList.remove('d-none');
      } else {
        button.disabled = false;
        if (editIcon) editIcon.classList.remove('d-none');
        if (loadingSpinner) loadingSpinner.classList.add('d-none');
      }
    }
  }

  // Toggle close month confirmation
  toggleCloseConfirm() {
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
    this.updateClosedStatus();
  }

  // Cancel close confirmation
  cancelCloseConfirm() {
    this.pendingClose = false;
    this.updateClosedStatus();
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
        this.updateClosedStatus();
        this.showSuccess("Month closed successfully!");
      } else {
        throw new Error(result.message || "Failed to close month");
      }
    } catch (error) {
      console.error("Error closing month:", error);
      this.showError(error.message || "Failed to close month");
      this.updateClosedStatus();
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
        this.updateClosedStatus();
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
  updateClosedStatus() {
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
          closeBtn.innerHTML = '<i class="bi bi-lock" style="color: #ffffff !important"></i>';
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
    this.updateMonthDisplayWithClosedStatus();

    // Disable/enable action buttons
    this.toggleActionButtons(!isClosed);
  }

  // Update month display to show closed status
  updateMonthDisplayWithClosedStatus() {
    const currentMonthEl = document.getElementById("currentMonth");
    const currentMonthBadge = document.getElementById("currentMonthBadge");

    if (currentMonthEl) {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];

      const month = monthNames[this.currentDate.getMonth()];
      const year = this.currentDate.getFullYear();
      const isClosed = this.currentReport && this.currentReport.isClosed;
      
      currentMonthEl.textContent = `${month} ${year}${isClosed ? " 🔒" : ""}`;
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
      addIncomeBtn.title = enabled ? "Add Income Item" : "Cannot add items - month is closed";
    }

    if (addExpenseBtn) {
      addExpenseBtn.disabled = !enabled;
      addExpenseBtn.style.opacity = enabled ? "1" : "0.5";
      addExpenseBtn.title = enabled ? "Add Expense Item" : "Cannot add items - month is closed";
    }

    if (addInvestorBtn) {
      addInvestorBtn.disabled = !enabled;
      addInvestorBtn.style.opacity = enabled ? "1" : "0.5";
      addInvestorBtn.title = enabled ? "Add Investor" : "Cannot add investors - month is closed";
    }

    // Update existing action buttons in the tables
    const editButtons = document.querySelectorAll('[id^="editIncomeBtn-"], [id^="editExpenseBtn-"]');
    const deleteButtons = document.querySelectorAll('button[onclick*="toggleDeleteConfirm"], button[onclick*="confirmDeleteItem"]');

    editButtons.forEach(btn => {
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? "1" : "0.5";
      btn.title = enabled ? "Edit" : "Cannot edit - month is closed";
    });

    deleteButtons.forEach(btn => {
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

  async exportFinancialReport() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }

    // Check if html2canvas is available
    if (typeof html2canvas === 'undefined') {
      this.showError("Export library not loaded. Please refresh the page and try again.");
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
      exportBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exporting...';
      exportBtn.disabled = true;

      // Update export header with property info and current data
      await this.prepareExportData();
      
      // Show the header for export
      const reportHeader = document.getElementById("reportHeader");
      reportHeader.classList.remove("d-none");

      // Hide navigation and action buttons for export
      const elementsToHide = [
        '.btn', '.modal', '.modal-backdrop', 
        '#prevMonth', '#nextMonth', '#addIncomeBtn', '#addExpenseBtn', '#addInvestorBtn',
        '.edit-icon', '.loading-spinner', '[onclick]', '.actions-column', '.month-navigation-section'
      ];
      
      const hiddenElements = [];
      elementsToHide.forEach(selector => {
        const elements = document.querySelectorAll(`#exportableFinancialReport ${selector}`);
        elements.forEach(el => {
          if (!el.id.includes('export') && !el.id.includes('Export')) {
            el.style.display = 'none';
            hiddenElements.push({ element: el, originalDisplay: el.style.display });
          }
        });
      });

      // Wait longer for DOM to fully update and render
      await new Promise(resolve => setTimeout(resolve, 300));

      // Get the element and calculate optimal dimensions
      const exportElement = document.getElementById('exportableFinancialReport');
      
      // Force layout recalculation and ensure all content is rendered
      exportElement.style.height = 'auto';
      exportElement.style.minHeight = 'auto';
      exportElement.offsetHeight; // Force reflow
      
      // Scroll to bottom to ensure all lazy content is rendered
      const originalScrollTop = window.scrollY;
      exportElement.scrollIntoView({ behavior: 'instant', block: 'end' });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Calculate dimensions with more comprehensive approach
      const computedStyle = window.getComputedStyle(exportElement);
      const paddingTop = parseInt(computedStyle.paddingTop) || 0;
      const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
      const marginTop = parseInt(computedStyle.marginTop) || 0;
      const marginBottom = parseInt(computedStyle.marginBottom) || 0;
      
      const contentHeight = exportElement.scrollHeight;
      const clientHeight = exportElement.clientHeight;
      const offsetHeight = exportElement.offsetHeight;
      
      // Use the largest calculated height plus generous buffer
      const elementHeight = Math.max(contentHeight, clientHeight, offsetHeight) + paddingTop + paddingBottom + marginTop + marginBottom;
      const elementWidth = Math.max(exportElement.scrollWidth, exportElement.offsetWidth, 1000); // Force wider canvas for full content
      
      // Add buffer to ensure no content is cut off (reduced for compact layout - 25% of content height, minimum 200px)
      const heightBuffer = Math.max(200, Math.floor(elementHeight * 0.25));
      const totalHeight = elementHeight + heightBuffer;
      
      console.log('Export dimensions:', { 
        contentHeight, 
        clientHeight, 
        offsetHeight, 
        elementHeight, 
        heightBuffer, 
        totalHeight, 
        elementWidth 
      });
      
      // Restore original scroll position
      window.scrollTo(0, originalScrollTop);
      
      // Create the canvas with very generous height buffer to prevent cut-off
      const canvas = await html2canvas(exportElement, {
        backgroundColor: '#ffffff',
        scale: 2.0, // High scale for maximum quality
        useCORS: true,
        allowTaint: false, // Better quality with strict CORS
        height: totalHeight,
        width: elementWidth,
        windowWidth: elementWidth,
        windowHeight: totalHeight,
        logging: true, // Enable logging to debug issues
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        removeContainer: true, // Remove container padding
        letterRendering: true, // Better text rendering
        imageTimeout: 15000, // Allow time for high-quality rendering
        onclone: function(clonedDocument) {
          // Ensure cloned document has proper dimensions
          const clonedElement = clonedDocument.getElementById('exportableFinancialReport');
          if (clonedElement) {
            clonedElement.style.height = 'auto';
            clonedElement.style.minHeight = totalHeight + 'px';
            clonedElement.style.width = elementWidth + 'px';
            clonedElement.style.minWidth = elementWidth + 'px';
            clonedElement.style.maxWidth = 'none';
            clonedElement.style.overflow = 'visible';
            clonedElement.style.margin = '0';
            clonedElement.style.padding = '0';
          }
        }
      });

      // Restore hidden elements
      hiddenElements.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay;
      });
      
      // Hide header again
      reportHeader.classList.add("d-none");

      // Crop canvas to remove white space
      const croppedCanvas = this.cropCanvasToContent(canvas);

      // Create high-quality download link
      const link = document.createElement('a');
      link.download = this.generateFileName();
      // Use maximum PNG quality
      link.href = croppedCanvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showSuccess("Financial report exported successfully!");
    } catch (error) {
      console.error('Export error:', error);
      this.showError(`Failed to export financial report: ${error.message}`);
    } finally {
      // Restore button state
      const exportBtn = document.getElementById("exportFinancialReportBtn");
      exportBtn.innerHTML = '<i class="bi bi-camera me-1"></i>Export Image';
      exportBtn.disabled = false;
      // Reset the export flag
      this._isExporting = false;
    }
  }

  async copyFinancialReportToClipboard() {
    if (!this.selectedProperty || !this.currentReport) {
      this.showError("Please select a property and load financial data first");
      return;
    }

    // Check if html2canvas is available
    if (typeof html2canvas === 'undefined') {
      this.showError("Export library not loaded. Please refresh the page and try again.");
      return;
    }

    // Prevent duplicate calls
    if (this._isCopiingToClipboard) {
      return;
    }
    this._isCopiingToClipboard = true;

    try {
      // Show loading state
      const copyBtn = document.getElementById("copyFinancialReportBtn");
      copyBtn.innerHTML = '<i class="bi bi-hourglass-split"></i>';
      copyBtn.disabled = true;

      // Prepare export data and show header
      await this.prepareExportData();
      const reportHeader = document.getElementById("reportHeader");
      reportHeader.classList.remove("d-none");

      // Hide navigation and action buttons for export
      const elementsToHide = [
        '.btn', '.modal', '.modal-backdrop', 
        '#prevMonth', '#nextMonth', '#addIncomeBtn', '#addExpenseBtn', '#addInvestorBtn',
        '.edit-icon', '.loading-spinner', '[onclick]', '.actions-column', '.month-navigation-section'
      ];
      
      const hiddenElements = [];
      elementsToHide.forEach(selector => {
        const elements = document.querySelectorAll(`#exportableFinancialReport ${selector}`);
        elements.forEach(el => {
          if (!el.id.includes('export') && !el.id.includes('Export')) {
            el.style.display = 'none';
            hiddenElements.push({ element: el, originalDisplay: el.style.display });
          }
        });
      });

      // Wait longer for DOM to fully update and render
      await new Promise(resolve => setTimeout(resolve, 300));

      // Get the element and calculate optimal dimensions for clipboard
      const exportElement = document.getElementById('exportableFinancialReport');
      
      // Force layout recalculation and ensure all content is rendered
      exportElement.style.height = 'auto';
      exportElement.style.minHeight = 'auto';
      exportElement.offsetHeight; // Force reflow
      
      // Scroll to bottom to ensure all lazy content is rendered
      const originalScrollTop = window.scrollY;
      exportElement.scrollIntoView({ behavior: 'instant', block: 'end' });
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Calculate dimensions with more comprehensive approach
      const computedStyle = window.getComputedStyle(exportElement);
      const paddingTop = parseInt(computedStyle.paddingTop) || 0;
      const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
      const marginTop = parseInt(computedStyle.marginTop) || 0;
      const marginBottom = parseInt(computedStyle.marginBottom) || 0;
      
      const contentHeight = exportElement.scrollHeight;
      const clientHeight = exportElement.clientHeight;
      const offsetHeight = exportElement.offsetHeight;
      
      // Use the largest calculated height plus generous buffer
      const elementHeight = Math.max(contentHeight, clientHeight, offsetHeight) + paddingTop + paddingBottom + marginTop + marginBottom;
      const elementWidth = Math.max(exportElement.scrollWidth, exportElement.offsetWidth, 1000); // Force wider canvas for full content
      
      // Add buffer to ensure no content is cut off (reduced for compact layout - 25% of content height, minimum 200px)
      const heightBuffer = Math.max(200, Math.floor(elementHeight * 0.25));
      const totalHeight = elementHeight + heightBuffer;
      
      console.log('Clipboard export dimensions:', { 
        contentHeight, 
        clientHeight, 
        offsetHeight, 
        elementHeight, 
        heightBuffer, 
        totalHeight, 
        elementWidth 
      });
      
      // Restore original scroll position
      window.scrollTo(0, originalScrollTop);
      
      // Create canvas with very generous height buffer to prevent cut-off
      const canvas = await html2canvas(exportElement, {
        backgroundColor: '#ffffff',
        scale: 2.0, // High scale for maximum quality
        useCORS: true,
        allowTaint: false, // Better quality with strict CORS
        height: totalHeight,
        width: elementWidth,
        windowWidth: elementWidth,
        windowHeight: totalHeight,
        logging: false, // Keep logging off for clipboard to avoid console spam
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        removeContainer: true, // Remove container padding
        letterRendering: true, // Better text rendering
        imageTimeout: 15000, // Allow time for high-quality rendering
        onclone: function(clonedDocument) {
          // Ensure cloned document has proper dimensions
          const clonedElement = clonedDocument.getElementById('exportableFinancialReport');
          if (clonedElement) {
            clonedElement.style.height = 'auto';
            clonedElement.style.minHeight = totalHeight + 'px';
            clonedElement.style.width = elementWidth + 'px';
            clonedElement.style.minWidth = elementWidth + 'px';
            clonedElement.style.maxWidth = 'none';
            clonedElement.style.overflow = 'visible';
            clonedElement.style.margin = '0';
            clonedElement.style.padding = '0';
          }
        }
      });

      // Restore hidden elements first
      hiddenElements.forEach(({ element, originalDisplay }) => {
        element.style.display = originalDisplay;
      });
      
      // Hide header again
      reportHeader.classList.add("d-none");

      // Crop canvas to remove white space
      const croppedCanvas = this.cropCanvasToContent(canvas);

      // Convert to high-quality blob and copy to clipboard
      const blob = await new Promise((resolve) => {
        croppedCanvas.toBlob(resolve, 'image/png', 1.0); // Maximum PNG quality
      });

      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          this.showSuccess("Financial report copied to clipboard!");
        } else {
          this.showError("Clipboard functionality not supported in this browser.");
        }
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);
        this.showError("Failed to copy to clipboard. Your browser may not support this feature.");
      }

    } catch (error) {
      console.error('Copy error:', error);
      this.showError(`Failed to copy financial report: ${error.message}`);
    } finally {
      // Always restore button state and reset flag
      const copyBtn = document.getElementById("copyFinancialReportBtn");
      if (copyBtn) {
        copyBtn.innerHTML = '<i class="bi bi-clipboard" style="color: #ffffff !important;"></i>';
        copyBtn.disabled = false;
      }
      // Reset the copying flag
      this._isCopiingToClipboard = false;
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
          const property = result.properties.find(p => p.propertyId === this.selectedProperty);
          if (property) {
            exportPropertyInfo.textContent = `${property.propertyId} - ${property.address}, ${property.unit}`;
          } else {
            exportPropertyInfo.textContent = `Property ID: ${this.selectedProperty}`;
          }
        }
      } catch (error) {
        console.error('Error fetching property details for export:', error);
        exportPropertyInfo.textContent = `Property ID: ${this.selectedProperty}`;
      }
    }
    
    if (exportDateRange) {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      const month = monthNames[this.currentDate.getMonth()];
      const year = this.currentDate.getFullYear();
      exportDateRange.textContent = `${month} ${year} Financial Report`;
    }
  }

  generateFileName() {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    
    const month = monthNames[this.currentDate.getMonth()];
    const year = this.currentDate.getFullYear();
    const propertyId = this.selectedProperty;
    
    return `Financial_Report_${propertyId}_${month}_${year}.png`;
  }

  // Crop canvas to remove white space around content
  cropCanvasToContent(sourceCanvas) {
    const ctx = sourceCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
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
    
    console.log('Cropping canvas:', { 
      original: { width: sourceCanvas.width, height: sourceCanvas.height },
      bounds: { minX, minY, maxX, maxY },
      cropped: { width: croppedWidth, height: croppedHeight }
    });
    
    // Create new canvas with cropped dimensions
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = croppedWidth;
    croppedCanvas.height = croppedHeight;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    // Copy the cropped region
    croppedCtx.drawImage(
      sourceCanvas, 
      minX, minY, croppedWidth, croppedHeight,
      0, 0, croppedWidth, croppedHeight
    );
    
    return croppedCanvas;
  }

  // Setup file upload handling
  setupFileUploadHandling() {
    const fileInput = document.getElementById('billEvidenceFiles');
    const previewContainer = document.getElementById('billEvidencePreview');
    
    if (fileInput && previewContainer) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        // Validate file count
        if (files.length > 10) {
          this.showError('Maximum 10 files allowed');
          e.target.value = '';
          return;
        }
        
        // Validate file sizes and types
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        
        for (const file of files) {
          if (file.size > maxSize) {
            this.showError(`File "${file.name}" is too large. Maximum size is 10MB.`);
            e.target.value = '';
            return;
          }
          
          if (!allowedTypes.includes(file.type)) {
            this.showError(`File "${file.name}" is not supported. Only images and PDFs are allowed.`);
            e.target.value = '';
            return;
          }
        }
        
        // Upload files
        try {
          await this.uploadBillEvidenceFiles(files);
          this.displayFilePreview(files);
        } catch (error) {
          this.showError(`Failed to upload files: ${error.message}`);
          e.target.value = '';
        }
      });
    }
  }

  // Upload bill evidence files to backend
  async uploadBillEvidenceFiles(files) {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    
    try {
      const response = await API.post('/api/upload/bill-evidence', formData, {
        'Content-Type': 'multipart/form-data'
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Store uploaded file URLs for later use
        this.uploadedBillEvidence = result.files.map(file => file.url);
        console.log('Bill evidence uploaded successfully:', this.uploadedBillEvidence);
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading bill evidence:', error);
      throw error;
    }
  }

  // Display file preview for newly uploaded files
  displayFilePreview(files) {
    const previewContainer = document.getElementById('billEvidencePreview');
    if (!previewContainer) return;
    
    previewContainer.innerHTML = '';
    
    if (files.length > 0) {
      const previewHtml = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> ${files.length} file(s) uploaded successfully:
          <ul class="mb-0 mt-1">
            ${files.map(file => `<li class="small">${escapeHtml(file.name)}</li>`).join('')}
          </ul>
        </div>
      `;
      previewContainer.innerHTML = previewHtml;
    }
  }

  // Display existing bill evidence for editing
  displayExistingBillEvidence(billEvidence) {
    const existingContainer = document.getElementById('existingBillEvidence');
    if (!existingContainer || !billEvidence || billEvidence.length === 0) return;
    
    const evidenceHtml = `
      <div class="alert alert-info">
        <i class="bi bi-info-circle"></i> Existing evidence (${billEvidence.length} file(s)):
        <div class="mt-2">
          ${billEvidence.map((url, index) => {
            const fileName = this.extractFileNameFromUrl(url);
            const isImage = this.isImageFile(url);
            const normalizedUrl = this.normalizeImageUrl(url);
            
            return `
              <div class="d-flex align-items-center gap-2 mb-1">
                <small class="text-muted">${index + 1}.</small>
                ${isImage ? `<img src="${normalizedUrl}" class="img-thumbnail" style="width: 40px; height: 40px; object-fit: cover;">` : `<i class="bi bi-file-earmark-pdf text-danger"></i>`}
                <a href="${normalizedUrl}" target="_blank" class="small text-decoration-none">${fileName}</a>
              </div>
            `;
          }).join('')}
        </div>
        <small class="text-muted">Upload new files to replace existing evidence, or leave empty to keep current files.</small>
      </div>
    `;
    existingContainer.innerHTML = evidenceHtml;
  }

  // Extract file name from URL
  extractFileNameFromUrl(url) {
    if (!url) return 'Unknown file';
    
    try {
      // Extract filename from Cloudinary URL or path
      const parts = url.split('/');
      const lastPart = parts[parts.length - 1];
      
      // Remove query parameters if present
      const cleanName = lastPart.split('?')[0];
      
      // If it's a Cloudinary public_id with extension
      if (cleanName.includes('.')) {
        return cleanName;
      }
      
      // If it's just a public_id, add generic extension
      return `${cleanName}.file`;
    } catch (error) {
      return 'File';
    }
  }

  // Check if file is an image based on URL
  isImageFile(url) {
    if (!url) return false;
    
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const extension = url.toLowerCase().split('.').pop()?.split('?')[0];
    
    return imageExtensions.includes(extension);
  }

  // Normalize image URL to ensure it uses the proxy endpoint
  normalizeImageUrl(url) {
    if (!url) return url;
    
    // If it's already a full URL (http/https), return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it's already a proxy URL, convert to full URL if needed
    if (url.startsWith('/api/upload/image-proxy/')) {
      // In production, use the full backend URL
      if (API_CONFIG.BASE_URL) {
        return `${API_CONFIG.BASE_URL}${url}`;
      }
      return url; // localhost case
    }
    
    // Build the proxy URL
    let proxyPath;
    
    // If it looks like just a Cloudinary filename (e.g., "wdhtnp08ugp4nhshmkpf.jpg")
    // or a path without version (e.g., "tenant-documents/wdhtnp08ugp4nhshmkpf.jpg")
    if (url.match(/^[a-zA-Z0-9\-_\/]+\.(jpg|jpeg|png)$/i)) {
      // Check if it already includes the folder path
      if (url.includes('/')) {
        proxyPath = `/api/upload/image-proxy/${url}`;
      } else {
        // Assume it's a tenant document image
        proxyPath = `/api/upload/image-proxy/tenant-documents/${url}`;
      }
    } else if (url.startsWith('/')) {
      // If it starts with / but not our proxy path, assume it's a relative proxy URL
      proxyPath = url;
    } else {
      // Default: assume it needs the proxy prefix
      proxyPath = `/api/upload/image-proxy/${url}`;
    }
    
    // In production, use the full backend URL
    if (API_CONFIG.BASE_URL) {
      return `${API_CONFIG.BASE_URL}${proxyPath}`;
    }
    return proxyPath; // localhost case
  }

  // Get optimized avatar URL with size transformations
  getOptimizedAvatarUrl(url, size = 'small') {
    if (!url) return url;

    const baseUrl = this.normalizeImageUrl(url);
    
    // If it's not a Cloudinary URL through our proxy, return as-is
    if (!baseUrl.includes('/api/upload/image-proxy/')) {
      return baseUrl;
    }

    // Define size presets
    const sizePresets = {
      small: 'w_80,h_80,c_fill,f_auto,q_auto', // 40px display size, 2x for retina
      medium: 'w_160,h_160,c_fill,f_auto,q_auto', // 80px display size, 2x for retina  
      large: 'w_200,h_200,c_fill,f_auto,q_auto'  // Larger preview size
    };

    const transformation = sizePresets[size] || sizePresets.small;
    
    // Add transformation to Cloudinary URL
    // Replace /image-proxy/ with /image-proxy/w_80,h_80,c_fill,f_auto,q_auto/
    const optimizedUrl = baseUrl.replace('/api/upload/image-proxy/', `/api/upload/image-proxy/${transformation}/`);
    
    console.log(`🎨 Optimized avatar URL (${size}):`, optimizedUrl);
    return optimizedUrl;
  }

  // Show bill evidence in a modal
  showBillEvidence(type, index) {
    // Validate inputs
    if (!this.currentReport) {
      this.showError('No financial report loaded');
      return;
    }

    const propertyName = type === 'expense' ? 'expenses' : type === 'income' ? 'income' : type;
    
    if (!this.currentReport[propertyName] || index >= this.currentReport[propertyName].length) {
      this.showError('Item not found');
      return;
    }

    const item = this.currentReport[propertyName][index];
    if (!item.billEvidence || item.billEvidence.length === 0) {
      this.showError('No bill evidence available');
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
    
    const evidenceHtml = item.billEvidence.map((url, index) => {
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
          ${isImage ? 
            `<img src="${normalizedUrl}" class="img-fluid rounded" style="max-height: 400px; width: 100%; object-fit: contain;">` : 
            `<div class="text-center p-4 bg-light rounded">
              <i class="bi bi-file-earmark-pdf text-danger" style="font-size: 3rem;"></i>
              <p class="mt-2 mb-0">PDF File</p>
              <small class="text-muted">Click "Open" to view</small>
            </div>`
          }
        </div>
      `;
    }).join('');

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
                ${item.date ? `<strong>Date:</strong> ${new Date(item.date).toLocaleDateString()}<br>` : ''}
                ${item.details ? `<strong>Details:</strong> ${escapeHtml(item.details)}<br>` : ''}
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
