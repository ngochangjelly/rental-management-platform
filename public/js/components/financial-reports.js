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
    this.isModalOpen = false;
    this.isIncomeExpenseModalOpen = false;
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

    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => {
        this.changeMonth(-1);
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
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
          console.log("Income/Expense modal already open, ignoring click");
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
          console.log("Income/Expense modal already open, ignoring click");
          return;
        }

        this.showIncomeExpenseModal("expense").catch(console.error);
      });
    }

    if (addInvestorBtn) {
      addInvestorBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent multiple modal creations
        if (this.isModalOpen) {
          console.log("Modal already open, ignoring click");
          return;
        }

        this.showInvestorModal();
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
      this.showError("Failed to load properties. Please check your connection and try again.");
      this.populatePropertySelector([]); // Show empty selector with default message
    }
  }

  populatePropertySelector(properties) {
    const selector = document.getElementById("propertySelector");
    if (!selector) return;

    // Clear existing options
    selector.innerHTML = '';

    if (!properties || properties.length === 0) {
      // Show message when no properties are available
      selector.innerHTML = '<option value="" disabled>No properties available - please log in or add properties</option>';
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
    
    if (!propertyId) {
      this.selectedProperty = null;
      document.getElementById("financialReportContent").style.display = "none";
      return;
    }

    this.selectedProperty = propertyId;
    document.getElementById("financialReportContent").style.display = "block";

    // Load investors for this property
    await this.loadInvestors(propertyId);

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

  async loadFinancialReport() {
    if (!this.selectedProperty) return;

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

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
      }

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
                <div class="text-center text-muted py-4" id="noIncomeMessage">
                    <i class="bi bi-plus-circle fs-1"></i>
                    <p class="mt-2">No income items added</p>
                </div>
            `;
      if (totalIncomeEl) totalIncomeEl.textContent = "$0.00";
      return;
    }

    let html = "";
    let total = 0;

    this.currentReport.income.forEach((item, index) => {
      total += item.amount;

      // Find investor name by ID
      const investor = this.investors.find(
        (inv) => inv.investorId === item.personInCharge
      );
      const investorName = investor ? investor.name : item.personInCharge;

      html += `
                <div class="border-bottom py-2 mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${escapeHtml(item.item)}</h6>
                            <small class="text-muted">
                                Person: ${escapeHtml(investorName)}${
        item.recipientAccountDetail
          ? " | Account: " + escapeHtml(item.recipientAccountDetail)
          : ""
      }
                            </small>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-success">$${item.amount.toFixed(
                              2
                            )}</div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary me-2" onclick="window.financialReports.editItem('income', ${index})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="window.financialReports.deleteItem('income', ${index})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
    });

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
                <div class="text-center text-muted py-4">
                    <i class="bi bi-dash-circle fs-1"></i>
                    <p class="mt-2">No expense items added</p>
                </div>
            `;
      if (totalExpensesEl) totalExpensesEl.textContent = "$0.00";
      return;
    }

    let html = "";
    let total = 0;

    this.currentReport.expenses.forEach((item, index) => {
      total += item.amount;

      // Find investor name by ID
      const investor = this.investors.find(
        (inv) => inv.investorId === item.personInCharge
      );
      const investorName = investor ? investor.name : item.personInCharge;

      html += `
                <div class="border-bottom py-2 mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${escapeHtml(item.item)}</h6>
                            <small class="text-muted">
                                Person: ${escapeHtml(investorName)}${
        item.recipientAccountDetail
          ? " | Account: " + escapeHtml(item.recipientAccountDetail)
          : ""
      }
                            </small>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-danger">$${item.amount.toFixed(
                              2
                            )}</div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <button class="btn btn-sm btn-outline-primary me-2" onclick="window.financialReports.editItem('expense', ${index})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="window.financialReports.deleteItem('expense', ${index})">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            `;
    });

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

    let html = "";

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
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <!-- Mobile layout -->
                        <div class="d-md-none">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <h6 class="mb-1">${escapeHtml(investor.name)}</h6>
                                    <small class="text-muted">${investor.investorId}</small>
                                    ${
                                      investor.phone
                                        ? `<br><small class="text-muted">${escapeHtml(
                                            investor.phone
                                          )}</small>`
                                        : ""
                                    }
                                </div>
                                <div class="text-end">
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="window.financialReports.editInvestor('${
                                      investor.investorId
                                    }')" title="Edit">
                                        <i class="bi bi-pencil"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="window.financialReports.removeInvestor('${
                                      investor.investorId
                                    }')" title="Remove">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="row text-center">
                                <div class="col-4">
                                    <div class="fw-bold">${percentage}%</div>
                                    <small class="text-muted">Share</small>
                                </div>
                                <div class="col-4">
                                    <div class="fw-bold text-primary">$${investorShare.toFixed(2)}</div>
                                    <small class="text-muted">Profit Share</small>
                                </div>
                                <div class="col-4">
                                    <div class="fw-bold text-warning">$${expensesPaidByInvestor.toFixed(2)}</div>
                                    <small class="text-muted">Paid</small>
                                </div>
                            </div>
                            <div class="row text-center mt-2">
                                <div class="col-6">
                                    <div class="fw-bold text-info">$${incomeReceivedByInvestor.toFixed(2)}</div>
                                    <small class="text-muted">Received</small>
                                </div>
                                <div class="col-6">
                                    <div class="fw-bold ${
                                      finalAmount >= 0 ? "text-success" : "text-danger"
                                    }">
                                        $${finalAmount.toFixed(2)}
                                    </div>
                                    <small class="text-muted">Final</small>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Desktop layout -->
                        <div class="row align-items-center d-none d-md-flex">
                            <div class="col-md-3 col-lg-2">
                                <h6 class="mb-0">${escapeHtml(investor.name)}</h6>
                                <small class="text-muted">${investor.investorId}</small>
                                ${
                                  investor.phone
                                    ? `<br><small class="text-muted">${escapeHtml(
                                        investor.phone
                                      )}</small>`
                                    : ""
                                }
                            </div>
                            <div class="col-md-1 col-lg-1 text-center">
                                <div class="fw-bold">${percentage}%</div>
                                <small class="text-muted">Share</small>
                            </div>
                            <div class="col-md-2 col-lg-2 text-center">
                                <div class="fw-bold text-primary">$${investorShare.toFixed(2)}</div>
                                <small class="text-muted">Profit Share</small>
                            </div>
                            <div class="col-md-2 col-lg-2 text-center">
                                <div class="fw-bold text-warning">$${expensesPaidByInvestor.toFixed(2)}</div>
                                <small class="text-muted">Paid</small>
                            </div>
                            <div class="col-md-2 col-lg-2 text-center">
                                <div class="fw-bold text-info">$${incomeReceivedByInvestor.toFixed(2)}</div>
                                <small class="text-muted">Received</small>
                            </div>
                            <div class="col-md-1 col-lg-2 text-center">
                                <div class="fw-bold ${
                                  finalAmount >= 0 ? "text-success" : "text-danger"
                                }">
                                    $${finalAmount.toFixed(2)}
                                </div>
                                <small class="text-muted">Final</small>
                            </div>
                            <div class="col-md-1 col-lg-1 text-end">
                                <button class="btn btn-sm btn-outline-primary me-1" onclick="window.financialReports.editInvestor('${
                                  investor.investorId
                                }')" title="Edit">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="window.financialReports.removeInvestor('${
                                  investor.investorId
                                }')" title="Remove">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
    });

    investorDistribution.innerHTML = html;
  }

  updateMonthDisplay() {
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
      currentMonthEl.textContent = `${month} ${year}`;
    }

    if (currentMonthBadge) {
      const now = new Date();
      const isCurrentMonth =
        this.currentDate.getMonth() === now.getMonth() &&
        this.currentDate.getFullYear() === now.getFullYear();

      currentMonthBadge.textContent = isCurrentMonth
        ? "Current Month"
        : "Historical";
      
      // Use smaller font size for better mobile display
      const isMobile = window.innerWidth < 768;
      const fontSizeClass = isMobile ? "" : "fs-6"; // No fs-6 on mobile, use CSS instead
      
      currentMonthBadge.className = isCurrentMonth
        ? `badge bg-info ${fontSizeClass}`.trim()
        : `badge bg-secondary ${fontSizeClass}`.trim();
    }
  }

  changeMonth(direction) {
    const newDate = new Date(this.currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    this.currentDate = newDate;

    this.updateMonthDisplay();
    this.loadFinancialReport();
  }

  async showIncomeExpenseModal(type) {
    console.log("=== Starting showIncomeExpenseModal ===", type);

    // Prevent multiple modal creations
    if (this.isIncomeExpenseModalOpen) {
      console.log("Income/Expense modal already open, aborting");
      return;
    }

    // Check if there are investors for this property
    if (!this.investors || this.investors.length === 0) {
      this.showError(
        `Please add investors to this property before adding ${type} items.`
      );
      return;
    }

    this.isIncomeExpenseModalOpen = true;

    // Force cleanup any existing modals
    this.cleanupExistingModals();

    // Create modal HTML dynamically
    const modalHtml = this.createIncomeExpenseModalHtml(type);
    console.log(
      "Generated income/expense modal HTML length:",
      modalHtml.length
    );

    // Add modal to page
    console.log("Adding income/expense modal HTML to document body");
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Wait a tick to ensure DOM is updated
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Show modal
    const modalElement = document.getElementById("incomeExpenseModal");
    console.log("Income/Expense modal element found:", !!modalElement);
    console.log("Modal element HTML length:", modalElement?.innerHTML?.length);

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
    });

    // Clean up modal when hidden
    modalElement.addEventListener("hidden.bs.modal", () => {
      console.log("Income/Expense modal hidden event fired");
      this.isIncomeExpenseModalOpen = false;
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
        console.log("Income/Expense form submit event triggered");

        // Prevent multiple submissions
        if (form.dataset.submitting === "true") {
          console.log("Income/Expense form already submitting, ignoring");
          return;
        }

        form.dataset.submitting = "true";
        this.saveIncomeExpenseItem(type, modal).finally(() => {
          form.dataset.submitting = "false";
        });
      });
    }
  }

  generateInvestorOptions() {
    if (!this.investors || this.investors.length === 0) {
      return '<option value="" disabled>No investors available for this property</option>';
    }

    return this.investors
      .map((investor) => {
        return `<option value="${investor.investorId}">${escapeHtml(
          investor.name
        )} (ID: ${investor.investorId})</option>`;
      })
      .join("");
  }

  createIncomeExpenseModalHtml(type) {
    const isIncome = type === "income";
    const title = isIncome ? "Add Income Item" : "Add Expense Item";
    const icon = isIncome ? "plus-circle" : "dash-circle";
    const color = isIncome ? "success" : "danger";

    return `
            <div class="modal fade" id="incomeExpenseModal" tabindex="-1" aria-labelledby="incomeExpenseModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="incomeExpenseModalLabel">
                                <i class="bi bi-${icon} me-2"></i>${title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <form id="incomeExpenseForm">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Item Description <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" name="item" required placeholder="e.g., Rent, Utilities, Repairs" autocomplete="off">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Amount (SGD) <span class="text-danger">*</span></label>
                                    <div class="input-group">
                                        <span class="input-group-text">$</span>
                                        <input type="number" class="form-control" name="amount" required min="0" step="0.01" placeholder="0.00" autocomplete="off">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Person in Charge <span class="text-danger">*</span></label>
                                    <select class="form-select" name="personInCharge" required>
                                        <option value="">Select investor...</option>
                                        ${this.generateInvestorOptions()}
                                    </select>
                                    <div class="form-text">Select the investor responsible for this ${type}</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Account Details</label>
                                    <input type="text" class="form-control" name="recipientAccountDetail" placeholder="Bank or payment details (optional)" autocomplete="off">
                                    <div class="form-text">Optional: Add bank account or payment method details</div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-${color}">
                                    <i class="bi bi-${icon} me-1"></i>Add ${
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
      personInCharge: formData.get("personInCharge"),
      recipientAccountDetail: formData.get("recipientAccountDetail"),
    };

    console.log("Form data being sent for", type, ":", itemData);
    console.log("Item field value:", formData.get("item"));
    console.log("Amount field value:", formData.get("amount"));
    console.log("PersonInCharge field value:", formData.get("personInCharge"));

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      const endpoint =
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

      const response = await API.post(endpoint, itemData);

      const result = await response.json();

      if (result.success) {
        // Force close modal and cleanup
        this.isIncomeExpenseModalOpen = false;
        modal.hide();
        
        // Use a more aggressive cleanup approach
        setTimeout(() => {
          this.forceCleanupModalBackdrops();
        }, 150);

        await this.loadFinancialReport();
        this.showSuccess(
          `${
            type.charAt(0).toUpperCase() + type.slice(1)
          } item added successfully`
        );
      } else {
        throw new Error(result.message || `Failed to add ${type} item`);
      }
    } catch (error) {
      console.error(`Error saving ${type} item:`, error);
      this.showError(error.message || `Failed to add ${type} item`);
    }
  }

  showInvestorModal(investorId = null) {
    console.log("=== Starting showInvestorModal ===");

    // Prevent multiple modal creations
    if (this.isModalOpen) {
      console.log("Modal already open, aborting");
      return;
    }

    this.isModalOpen = true;

    // Force cleanup any existing modals (including Bootstrap instances)
    this.cleanupExistingModals();

    // Create investor modal HTML dynamically
    const modalHtml = this.createInvestorModalHtml(investorId);
    console.log("Generated modal HTML length:", modalHtml.length);
    console.log("Modal HTML preview:", modalHtml.substring(0, 200) + "...");

    // Add modal to page
    console.log("Adding modal HTML to document body");
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modalElement = document.getElementById("investorModal");
    console.log("Modal element found:", !!modalElement);
    console.log("Modal element HTML length:", modalElement?.innerHTML?.length);

    const modal = new bootstrap.Modal(modalElement, {
      backdrop: true,
      keyboard: true,
      focus: false,
    });

    // Pre-fill form if editing existing investor
    if (investorId) {
      this.fillInvestorForm(investorId);
    }

    // Focus on first input after modal is shown
    modalElement.addEventListener("shown.bs.modal", () => {
      console.log("Modal shown event fired");
      const firstInput = modalElement.querySelector('input[name="username"]');
      console.log(
        "First input found in shown event:",
        !!firstInput,
        "value:",
        firstInput?.value
      );

      if (firstInput) {
        // Test if input is focusable and typable immediately
        firstInput.focus();
        console.log(
          "Focused on first input, active element:",
          document.activeElement === firstInput
        );

        // Test setting value programmatically
        setTimeout(() => {
          firstInput.value = "test123";
          console.log("Set test value, input value now:", firstInput.value);
          firstInput.value = ""; // Clear it
        }, 100);
      }
    });

    // Clean up modal when hidden
    modalElement.addEventListener("hidden.bs.modal", () => {
      console.log("Investor modal hidden event fired");
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
    console.log("Form found for event binding:", !!form);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      console.log("Form submit event triggered");

      // Prevent multiple submissions
      if (form.dataset.submitting === "true") {
        console.log("Form already submitting, ignoring");
        return;
      }

      form.dataset.submitting = "true";
      this.saveInvestor(investorId, modal).finally(() => {
        form.dataset.submitting = "false";
      });
    });
  }

  cleanupExistingModals() {
    console.log("Cleaning up existing modals");

    // Find all modals with our IDs
    const modalIds = ["investorModal", "incomeExpenseModal"];

    modalIds.forEach((modalId) => {
      const existingModal = document.getElementById(modalId);
      if (existingModal) {
        console.log(`Removing existing modal: ${modalId}`);

        // Try to hide the modal first if it has a Bootstrap instance
        try {
          const bootstrapModal = bootstrap.Modal.getInstance(existingModal);
          if (bootstrapModal) {
            console.log(`Hiding and disposing Bootstrap modal instance for ${modalId}`);
            bootstrapModal.hide();
            bootstrapModal.dispose();
          }
        } catch (e) {
          console.log(`No Bootstrap instance for ${modalId}:`, e.message);
        }

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
      console.log("Removing modal backdrop");
      backdrop.remove();
    });

    // Also check for any Bootstrap modal classes and elements
    const modalElements = document.querySelectorAll(".modal");
    modalElements.forEach((modal) => {
      if (modal.id === "investorModal" || modal.id === "incomeExpenseModal") {
        console.log("Force removing modal element:", modal.id);
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
    const investor = this.investors.find(
      (inv) => inv.investorId === investorId
    );
    if (investor) {
      const form = document.getElementById("investorForm");
      form.querySelector('input[name="username"]').value =
        investor.username || "";
      form.querySelector('input[name="name"]').value = investor.name;
      form.querySelector('input[name="phone"]').value = investor.phone || "";
      form.querySelector('input[name="email"]').value = investor.email || "";

      const propertyData = investor.properties.find(
        (p) => p.propertyId === this.selectedProperty
      );
      if (propertyData) {
        form.querySelector('input[name="percentage"]').value =
          propertyData.percentage;
      }
    }
  }

  async saveInvestor(investorId, modal) {
    const form = document.getElementById("investorForm");

    // Test simple form access first
    console.log("Form found:", !!form);
    console.log("Form innerHTML length:", form?.innerHTML?.length);

    // Try to get all input elements first
    const allInputs = form.querySelectorAll("input");
    console.log("Total inputs found:", allInputs.length);

    allInputs.forEach((input, index) => {
      console.log(
        `Input ${index}: name="${input.name}", type="${input.type}", value="${input.value}"`
      );
    });

    // Now try specific elements
    const usernameInput = form.querySelector('input[name="username"]');
    const nameInput = form.querySelector('input[name="name"]');
    const phoneInput = form.querySelector('input[name="phone"]');
    const emailInput = form.querySelector('input[name="email"]');
    const percentageInput = form.querySelector('input[name="percentage"]');

    console.log("Specific elements:");
    console.log(
      "Username:",
      usernameInput,
      "exists:",
      !!usernameInput,
      "value:",
      usernameInput?.value
    );
    console.log(
      "Name:",
      nameInput,
      "exists:",
      !!nameInput,
      "value:",
      nameInput?.value
    );
    console.log(
      "Phone:",
      phoneInput,
      "exists:",
      !!phoneInput,
      "value:",
      phoneInput?.value
    );
    console.log(
      "Email:",
      emailInput,
      "exists:",
      !!emailInput,
      "value:",
      emailInput?.value
    );
    console.log(
      "Percentage:",
      percentageInput,
      "exists:",
      !!percentageInput,
      "value:",
      percentageInput?.value
    );

    // Try alternative form data extraction methods
    const formData = new FormData(form);
    console.log("FormData entries:");
    for (const [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`);
    }

    // Get values using different approaches
    const investorData = {
      username: usernameInput?.value || formData.get("username") || "",
      name: nameInput?.value || formData.get("name") || "",
      phone: phoneInput?.value || formData.get("phone") || "",
      email: emailInput?.value || formData.get("email") || "",
      percentage:
        parseFloat(percentageInput?.value || formData.get("percentage")) || 0,
    };

    console.log("Final investor data:", investorData);

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
          this.showSuccess("Existing investor added to this property successfully");
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
      console.log("Creating investor with data:", investorData);
      
      // First, check if an investor with this username already exists
      const allInvestorsResponse = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const allInvestorsResult = await allInvestorsResponse.json();
      
      console.log("All investors response:", allInvestorsResult);
      
      if (allInvestorsResult.success && allInvestorsResult.data) {
        // Look for existing investor by username or name
        const existingInvestor = allInvestorsResult.data.find(
          investor => {
            // Check by username if both have username
            if (investor.username && investorData.username) {
              return investor.username === investorData.username;
            }
            // Otherwise check by name (case insensitive)
            return investor.name.toLowerCase() === investorData.name.toLowerCase();
          }
        );
        
        console.log("Found existing investor:", existingInvestor);
        
        if (existingInvestor) {
          // Check if this property is already in the investor's portfolio
          const hasProperty = existingInvestor.properties.some(
            p => p.propertyId === this.selectedProperty
          );
          
          if (hasProperty) {
            throw new Error("Investor is already invested in this property");
          }
          
          // Investor exists, just add this property to their record
          console.log("Adding property to existing investor:", existingInvestor.investorId);
          
          const addPropertyResponse = await API.post(
            API_CONFIG.ENDPOINTS.INVESTOR_ADD_PROPERTY(existingInvestor.investorId),
            {
              propertyId: this.selectedProperty,
              percentage: investorData.percentage
            }
          );
          
          const addPropertyResult = await addPropertyResponse.json();
          
          if (!addPropertyResult.success) {
            throw new Error(addPropertyResult.message || "Failed to add property to existing investor");
          }
          
          console.log("Successfully added property to existing investor");
          this.lastActionWasAddPropertyToExisting = true; // Set flag for success message
          return; // Successfully added property to existing investor
        }
      }
      
      // Investor doesn't exist, create a new one
      console.log("Creating new investor");
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

      console.log("Creating investor with data:", newInvestor);
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

  editInvestor(investorId) {
    this.showInvestorModal(investorId);
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
        API_CONFIG.ENDPOINTS.INVESTOR_REMOVE_PROPERTY(investorId, this.selectedProperty)
      );
      const result = await response.json();

      if (result.success) {
        await this.loadInvestors(this.selectedProperty);
        
        // Show different messages based on the action taken
        if (result.action === "deleted_completely") {
          this.showSuccess("Investor removed completely from database (no more property investments)");
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
    // TODO: Implement edit functionality
    this.showInfo(`Edit functionality for ${type} item #${index + 1} coming soon!`);
  }

  async deleteItem(type, index) {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth() + 1;

      // Build the endpoint URL for deleting the specific item
      const endpoint = type === "income"
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
        this.showSuccess(
          `${type.charAt(0).toUpperCase() + type.slice(1)} item deleted successfully`
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

  // Public method to refresh the component
  refresh() {
    if (this.selectedProperty) {
      this.loadFinancialReport();
    }
  }
}

// Make component globally accessible
window.FinancialReportsComponent = FinancialReportsComponent;
