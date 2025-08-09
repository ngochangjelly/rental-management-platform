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
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadProperties();
    }

    bindEvents() {
        // Property selector
        const propertySelector = document.getElementById('propertySelector');
        if (propertySelector) {
            propertySelector.addEventListener('change', (e) => {
                this.selectProperty(e.target.value);
            });
        }

        // Month navigation
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        
        if (prevMonthBtn) {
            prevMonthBtn.addEventListener('click', () => {
                this.changeMonth(-1);
            });
        }
        
        if (nextMonthBtn) {
            nextMonthBtn.addEventListener('click', () => {
                this.changeMonth(1);
            });
        }

        // Add income/expense buttons
        const addIncomeBtn = document.getElementById('addIncomeBtn');
        const addExpenseBtn = document.getElementById('addExpenseBtn');
        
        if (addIncomeBtn) {
            addIncomeBtn.addEventListener('click', () => {
                this.showIncomeExpenseModal('income');
            });
        }
        
        if (addExpenseBtn) {
            addExpenseBtn.addEventListener('click', () => {
                this.showIncomeExpenseModal('expense');
            });
        }
    }

    async loadProperties() {
        try {
            const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
            const result = await response.json();
            
            if (result.success) {
                this.populatePropertySelector(result.properties);
            }
        } catch (error) {
            console.error('Error loading properties:', error);
            this.showError('Failed to load properties');
        }
    }

    populatePropertySelector(properties) {
        const selector = document.getElementById('propertySelector');
        if (!selector) return;

        // Clear existing options except the first one
        selector.innerHTML = '<option value="">Select a property...</option>';
        
        properties.forEach(property => {
            const option = document.createElement('option');
            option.value = property.propertyId;
            option.textContent = `${property.propertyId} - ${property.address}, ${property.unit}`;
            selector.appendChild(option);
        });
    }

    async selectProperty(propertyId) {
        if (!propertyId) {
            this.selectedProperty = null;
            document.getElementById('financialReportContent').style.display = 'none';
            return;
        }

        this.selectedProperty = propertyId;
        document.getElementById('financialReportContent').style.display = 'block';
        
        // Load investors for this property
        await this.loadInvestors(propertyId);
        
        // Load financial report for current month
        await this.loadFinancialReport();
        
        // Update month display
        this.updateMonthDisplay();
    }

    async loadInvestors(propertyId) {
        try {
            const response = await API.get(`${API_CONFIG.BASE_URL}/api/investors/property/${propertyId}`);
            const result = await response.json();
            
            if (result.success) {
                this.investors = result.data;
                this.updateInvestorDisplay();
            }
        } catch (error) {
            console.error('Error loading investors:', error);
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
                `${API_CONFIG.BASE_URL}/api/financial-reports/property/${this.selectedProperty}/${year}/${month}`
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
                    netProfit: 0
                };
            }
            
            this.updateDisplays();
        } catch (error) {
            console.error('Error loading financial report:', error);
            this.showError('Failed to load financial report');
        }
    }

    updateDisplays() {
        this.updateIncomeDisplay();
        this.updateExpenseDisplay();
        this.updateSummaryDisplay();
        this.updateInvestorDisplay();
    }

    updateIncomeDisplay() {
        const incomeList = document.getElementById('incomeList');
        const totalIncomeEl = document.getElementById('totalIncome');
        const noIncomeMessage = document.getElementById('noIncomeMessage');
        
        if (!this.currentReport || !this.currentReport.income || this.currentReport.income.length === 0) {
            incomeList.innerHTML = `
                <div class="text-center text-muted py-4" id="noIncomeMessage">
                    <i class="bi bi-plus-circle fs-1"></i>
                    <p class="mt-2">No income items added</p>
                </div>
            `;
            if (totalIncomeEl) totalIncomeEl.textContent = '$0.00';
            return;
        }

        let html = '';
        let total = 0;
        
        this.currentReport.income.forEach((item, index) => {
            total += item.amount;
            const statusBadge = this.getStatusBadge(item.paidStatus);
            
            html += `
                <div class="border-bottom py-2 mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${this.escapeHtml(item.item)}</h6>
                            <small class="text-muted">
                                Person: ${this.escapeHtml(item.personInCharge)} | 
                                Account: ${this.escapeHtml(item.recipientAccountDetail)}
                            </small>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-success">$${item.amount.toFixed(2)}</div>
                            ${statusBadge}
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
        const expenseList = document.getElementById('expenseList');
        const totalExpensesEl = document.getElementById('totalExpenses');
        
        if (!this.currentReport || !this.currentReport.expenses || this.currentReport.expenses.length === 0) {
            expenseList.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-dash-circle fs-1"></i>
                    <p class="mt-2">No expense items added</p>
                </div>
            `;
            if (totalExpensesEl) totalExpensesEl.textContent = '$0.00';
            return;
        }

        let html = '';
        let total = 0;
        
        this.currentReport.expenses.forEach((item, index) => {
            total += item.amount;
            const statusBadge = this.getStatusBadge(item.paidStatus);
            
            html += `
                <div class="border-bottom py-2 mb-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${this.escapeHtml(item.item)}</h6>
                            <small class="text-muted">
                                Person: ${this.escapeHtml(item.personInCharge)} | 
                                Account: ${this.escapeHtml(item.recipientAccountDetail)}
                            </small>
                        </div>
                        <div class="text-end">
                            <div class="fw-bold text-danger">$${item.amount.toFixed(2)}</div>
                            ${statusBadge}
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

        const netProfitEl = document.getElementById('netProfit');
        if (netProfitEl) {
            netProfitEl.textContent = `$${netProfit.toFixed(2)}`;
            netProfitEl.className = netProfit >= 0 ? 'text-success mb-0' : 'text-danger mb-0';
        }
    }

    updateInvestorDisplay() {
        const investorDistribution = document.getElementById('investorDistribution');
        
        if (!this.investors || this.investors.length === 0) {
            investorDistribution.innerHTML = `
                <div class="text-center text-muted py-3">
                    <i class="bi bi-person-lines-fill fs-1"></i>
                    <p class="mt-2">No investors configured for this property</p>
                </div>
            `;
            return;
        }

        const netProfit = this.currentReport ? 
            (this.currentReport.totalIncome || 0) - (this.currentReport.totalExpenses || 0) : 0;

        let html = '';
        
        this.investors.forEach(investor => {
            const propertyData = investor.properties.find(p => p.propertyId === this.selectedProperty);
            const percentage = propertyData ? propertyData.percentage : 0;
            const investorShare = (netProfit * percentage) / 100;
            
            // Find existing transaction data
            const existingTransaction = this.currentReport && this.currentReport.investorTransactions ?
                this.currentReport.investorTransactions.find(t => t.investorId === investor.investorId) : null;
            
            const alreadyPaid = existingTransaction ? existingTransaction.alreadyPaid : 0;
            const alreadyReceived = existingTransaction ? existingTransaction.alreadyReceived : 0;
            const finalAmount = investorShare - alreadyPaid + alreadyReceived;
            
            html += `
                <div class="card mb-2">
                    <div class="card-body py-2">
                        <div class="row align-items-center">
                            <div class="col-md-3">
                                <h6 class="mb-0">${this.escapeHtml(investor.name)}</h6>
                                <small class="text-muted">${investor.investorId}</small>
                            </div>
                            <div class="col-md-2 text-center">
                                <div class="fw-bold">${percentage}%</div>
                                <small class="text-muted">Share</small>
                            </div>
                            <div class="col-md-2 text-center">
                                <div class="fw-bold text-primary">$${investorShare.toFixed(2)}</div>
                                <small class="text-muted">Profit Share</small>
                            </div>
                            <div class="col-md-2 text-center">
                                <div class="fw-bold text-warning">$${alreadyPaid.toFixed(2)}</div>
                                <small class="text-muted">Paid</small>
                            </div>
                            <div class="col-md-2 text-center">
                                <div class="fw-bold text-info">$${alreadyReceived.toFixed(2)}</div>
                                <small class="text-muted">Received</small>
                            </div>
                            <div class="col-md-1 text-end">
                                <div class="fw-bold ${finalAmount >= 0 ? 'text-success' : 'text-danger'}">
                                    $${finalAmount.toFixed(2)}
                                </div>
                                <small class="text-muted">Final</small>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        investorDistribution.innerHTML = html;
    }

    updateMonthDisplay() {
        const currentMonthEl = document.getElementById('currentMonth');
        const currentMonthBadge = document.getElementById('currentMonthBadge');
        
        if (currentMonthEl) {
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
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
            
            currentMonthBadge.textContent = isCurrentMonth ? 'Current Month' : 'Historical';
            currentMonthBadge.className = isCurrentMonth ? 'badge bg-info fs-6' : 'badge bg-secondary fs-6';
        }
    }

    changeMonth(direction) {
        const newDate = new Date(this.currentDate);
        newDate.setMonth(newDate.getMonth() + direction);
        this.currentDate = newDate;
        
        this.updateMonthDisplay();
        this.loadFinancialReport();
    }

    getStatusBadge(status) {
        switch (status) {
            case 'done':
                return '<span class="badge bg-success">Done</span>';
            case 'pending':
                return '<span class="badge bg-warning">Pending</span>';
            case 'none':
            default:
                return '<span class="badge bg-secondary">None</span>';
        }
    }

    showIncomeExpenseModal(type) {
        // Create modal HTML dynamically
        const modalHtml = this.createIncomeExpenseModalHtml(type);
        
        // Remove existing modal if any
        const existingModal = document.getElementById('incomeExpenseModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('incomeExpenseModal'));
        modal.show();
        
        // Bind form submission
        const form = document.getElementById('incomeExpenseForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveIncomeExpenseItem(type, modal);
        });
    }

    createIncomeExpenseModalHtml(type) {
        const isIncome = type === 'income';
        const title = isIncome ? 'Add Income Item' : 'Add Expense Item';
        const icon = isIncome ? 'plus-circle' : 'dash-circle';
        const color = isIncome ? 'success' : 'danger';
        
        return `
            <div class="modal fade" id="incomeExpenseModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-${icon} me-2"></i>${title}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="incomeExpenseForm">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Item Description <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" name="item" required placeholder="e.g., Rent, Utilities, Repairs">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Amount (SGD) <span class="text-danger">*</span></label>
                                    <div class="input-group">
                                        <span class="input-group-text">$</span>
                                        <input type="number" class="form-control" name="amount" required min="0" step="0.01" placeholder="0.00">
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Person in Charge <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" name="personInCharge" required placeholder="Name of responsible person">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Payment Status</label>
                                    <select class="form-select" name="paidStatus">
                                        <option value="none">None</option>
                                        <option value="pending">Pending</option>
                                        <option value="done">Done</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Account Details <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" name="recipientAccountDetail" required placeholder="Bank or payment details">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Payment Date (Optional)</label>
                                    <input type="date" class="form-control" name="paymentDate">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-${color}">
                                    <i class="bi bi-${icon} me-1"></i>Add ${isIncome ? 'Income' : 'Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }

    async saveIncomeExpenseItem(type, modal) {
        const form = document.getElementById('incomeExpenseForm');
        const formData = new FormData(form);
        
        const itemData = {
            item: formData.get('item'),
            amount: parseFloat(formData.get('amount')),
            personInCharge: formData.get('personInCharge'),
            paidStatus: formData.get('paidStatus'),
            recipientAccountDetail: formData.get('recipientAccountDetail'),
            paymentDate: formData.get('paymentDate') || null
        };

        try {
            const year = this.currentDate.getFullYear();
            const month = this.currentDate.getMonth() + 1;
            
            const endpoint = type === 'income' ? 'income' : 'expenses';
            const response = await API.post(
                `${API_CONFIG.BASE_URL}/api/financial-reports/property/${this.selectedProperty}/${year}/${month}/${endpoint}`,
                itemData
            );
            
            const result = await response.json();
            
            if (result.success) {
                modal.hide();
                await this.loadFinancialReport();
                this.showSuccess(`${type.charAt(0).toUpperCase() + type.slice(1)} item added successfully`);
            } else {
                throw new Error(result.message || `Failed to add ${type} item`);
            }
        } catch (error) {
            console.error(`Error saving ${type} item:`, error);
            this.showError(error.message || `Failed to add ${type} item`);
        }
    }

    editItem(type, index) {
        // TODO: Implement edit functionality
        this.showInfo('Edit functionality coming soon!');
    }

    async deleteItem(type, index) {
        if (!confirm('Are you sure you want to delete this item?')) {
            return;
        }
        
        // TODO: Implement delete functionality
        this.showInfo('Delete functionality coming soon!');
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccess(message) {
        // Simple alert for now - could be enhanced with toast notifications
        alert(`Success: ${message}`);
    }

    showError(message) {
        alert(`Error: ${message}`);
    }

    showInfo(message) {
        alert(`Info: ${message}`);
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