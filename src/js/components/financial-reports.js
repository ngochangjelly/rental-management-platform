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
    this.editingItem = null;
    this.editingItemIndex = null;
    this.pendingDeletes = new Set(); // Track items pending deletion confirmation
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
      
      // Check if this item is pending deletion confirmation
      const itemKey = `income-${index}`;
      const isPendingDelete = this.pendingDeletes.has(itemKey);

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
                        <button class="btn btn-sm btn-outline-primary me-2" id="editIncomeBtn-${index}" onclick="window.financialReports.editItem('income', ${index})">
                            <span class="edit-icon"><i class="bi bi-pencil"></i></span>
                            <span class="loading-spinner d-none">
                                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            </span>
                        </button>
                        ${isPendingDelete 
                          ? `<button class="btn btn-sm btn-success" onclick="window.financialReports.confirmDeleteItem('income', ${index})" title="Click to confirm deletion">
                               <i class="bi bi-check-circle"></i>
                             </button>
                             <button class="btn btn-sm btn-outline-secondary ms-1" onclick="window.financialReports.cancelDeleteItem('income', ${index})" title="Cancel deletion">
                               <i class="bi bi-x-circle"></i>
                             </button>`
                          : `<button class="btn btn-sm btn-outline-danger" onclick="window.financialReports.toggleDeleteConfirm('income', ${index})">
                               <i class="bi bi-trash"></i>
                             </button>`
                        }
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
      
      // Check if this item is pending deletion confirmation
      const itemKey = `expense-${index}`;
      const isPendingDelete = this.pendingDeletes.has(itemKey);

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
                        <button class="btn btn-sm btn-outline-primary me-2" id="editExpenseBtn-${index}" onclick="window.financialReports.editItem('expense', ${index})">
                            <span class="edit-icon"><i class="bi bi-pencil"></i></span>
                            <span class="loading-spinner d-none">
                                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            </span>
                        </button>
                        ${isPendingDelete 
                          ? `<button class="btn btn-sm btn-success" onclick="window.financialReports.confirmDeleteItem('expense', ${index})" title="Click to confirm deletion">
                               <i class="bi bi-check-circle"></i>
                             </button>
                             <button class="btn btn-sm btn-outline-secondary ms-1" onclick="window.financialReports.cancelDeleteItem('expense', ${index})" title="Cancel deletion">
                               <i class="bi bi-x-circle"></i>
                             </button>`
                          : `<button class="btn btn-sm btn-outline-danger" onclick="window.financialReports.toggleDeleteConfirm('expense', ${index})">
                               <i class="bi bi-trash"></i>
                             </button>`
                        }
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
                                    <h6 class="mb-1">${escapeHtml(
                                      investor.name
                                    )}</h6>
                                    <small class="text-muted">${
                                      investor.investorId
                                    }</small>
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
                                    <div class="fw-bold text-primary">$${investorShare.toFixed(
                                      2
                                    )}</div>
                                    <small class="text-muted">Profit Share</small>
                                </div>
                                <div class="col-4">
                                    <div class="fw-bold text-warning">$${expensesPaidByInvestor.toFixed(
                                      2
                                    )}</div>
                                    <small class="text-muted">Paid</small>
                                </div>
                            </div>
                            <div class="row text-center mt-2">
                                <div class="col-6">
                                    <div class="fw-bold text-info">$${incomeReceivedByInvestor.toFixed(
                                      2
                                    )}</div>
                                    <small class="text-muted">Received</small>
                                </div>
                                <div class="col-6">
                                    <div class="fw-bold ${
                                      finalAmount >= 0
                                        ? "text-success"
                                        : "text-danger"
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
                                <h6 class="mb-0">${escapeHtml(
                                  investor.name
                                )}</h6>
                                <small class="text-muted">${
                                  investor.investorId
                                }</small>
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
                                <div class="fw-bold text-primary">$${investorShare.toFixed(
                                  2
                                )}</div>
                                <small class="text-muted">Profit Share</small>
                            </div>
                            <div class="col-md-2 col-lg-2 text-center">
                                <div class="fw-bold text-warning">$${expensesPaidByInvestor.toFixed(
                                  2
                                )}</div>
                                <small class="text-muted">Paid</small>
                            </div>
                            <div class="col-md-2 col-lg-2 text-center">
                                <div class="fw-bold text-info">$${incomeReceivedByInvestor.toFixed(
                                  2
                                )}</div>
                                <small class="text-muted">Received</small>
                            </div>
                            <div class="col-md-1 col-lg-2 text-center">
                                <div class="fw-bold ${
                                  finalAmount >= 0
                                    ? "text-success"
                                    : "text-danger"
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

  async showIncomeExpenseModal(type, existingItem = null, itemIndex = null) {
    // Prevent multiple modal creations
    if (this.isIncomeExpenseModalOpen) {
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
                                    <div class="form-text">Select the investor responsible for this ${type}</div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Account Details</label>
                                    <input type="text" class="form-control" name="recipientAccountDetail" placeholder="Bank or payment details (optional)" autocomplete="off" value="${accountDetailValue}">
                                    <div class="form-text">Optional: Add bank account or payment method details</div>
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
    };

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
      // Pre-fill form if editing existing investor (do this after modal is shown)
      if (investorId) {
        this.fillInvestorForm(investorId);
      }

      const firstInput = modalElement.querySelector('input[name="username"]');

      if (firstInput) {
        // Test if input is focusable and typable immediately
        firstInput.focus();
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
    const investor = this.investors.find(
      (inv) => inv.investorId === investorId
    );
    if (investor) {
      const form = document.getElementById("investorForm");

      const usernameInput = form.querySelector('input[name="username"]');
      const nameInput = form.querySelector('input[name="name"]');
      const phoneInput = form.querySelector('input[name="phone"]');
      const emailInput = form.querySelector('input[name="email"]');
      const percentageInput = form.querySelector('input[name="percentage"]');

      if (usernameInput) {
        usernameInput.value = investor.username || "";
      }
      if (nameInput) {
        nameInput.value = investor.name || "";
      }
      if (phoneInput) {
        phoneInput.value = investor.phone || "";
      }
      if (emailInput) {
        emailInput.value = investor.email || "";
      }

      const propertyData = investor.properties.find(
        (p) => p.propertyId === this.selectedProperty
      );
      if (propertyData && percentageInput) {
        percentageInput.value = propertyData.percentage;
      }
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
    // Map singular type names to plural property names in currentReport
    const propertyName = type === 'expense' ? 'expenses' : type === 'income' ? 'income' : type;
    
    if (!this.currentReport || !this.currentReport[propertyName] || !this.currentReport[propertyName][index]) {
      this.showError('Item not found');
      return;
    }

    // Show loading state
    this.setEditButtonLoading(type, index, true);
    const item = this.currentReport[propertyName][index];
    this.showIncomeExpenseModal(type, item, index);
  }

  toggleDeleteConfirm(type, index) {
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

  // Public method to refresh the component
  refresh() {
    if (this.selectedProperty) {
      this.loadFinancialReport();
    }
  }
}

// Make component globally accessible
window.FinancialReportsComponent = FinancialReportsComponent;
