/**
 * Bulk Property Reports Component
 * Allows users to select multiple properties and view profit results for a specific month
 */

class BulkPropertyReportsComponent {
  constructor() {
    this.properties = [];
    this.selectedProperties = new Set();
    this.lastClickedIndex = -1; // Track last clicked card for shift selection
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadProperties();
    this.setDefaultDate();
  }

  bindEvents() {
    // Fetch reports button
    const fetchBtn = document.getElementById("fetchBulkReportsBtn");
    if (fetchBtn) {
      fetchBtn.addEventListener("click", () => {
        this.fetchBulkReports();
      });
    }

    // Select All button
    const selectAllBtn = document.getElementById("selectAllPropertiesBtn");
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => {
        this.selectAllProperties();
      });
    }

    // Deselect All button
    const deselectAllBtn = document.getElementById("deselectAllPropertiesBtn");
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener("click", () => {
        this.deselectAllProperties();
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

  updateSelectedCount() {
    const countEl = document.getElementById("selectedPropertiesCount");
    if (countEl) {
      const count = this.selectedProperties.size;
      countEl.textContent = `${count} ${count === 1 ? "property" : "properties"} selected`;
    }
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
      const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
      const result = await response.json();

      if (result.success) {
        this.properties = result.properties || [];
        this.renderPropertyList();
      } else {
        this.showError("Failed to load properties");
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showError("Error loading properties. Please try again.");
    }
  }

  renderPropertyList() {
    const container = document.getElementById("bulkPropertyList");
    if (!container) return;

    if (!this.properties || this.properties.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-building-slash me-2"></i>
          No properties available
        </div>
      `;
      return;
    }

    container.innerHTML = this.properties
      .map(
        (property, index) => {
          const isSelected = this.selectedProperties.has(property.propertyId);
          return `
      <div class="col-6 col-sm-3 col-md-2 property-card-col mb-3">
        <div
          class="card property-select-card ${isSelected ? "selected" : ""}"
          data-property-id="${property.propertyId}"
          data-property-index="${index}"
          style="cursor: pointer; transition: all 0.2s ease;"
        >
          ${property.propertyImage ? `
            <div class="position-relative property-card-image">
              <img
                src="${property.propertyImage}"
                class="card-img-top"
                alt="${escapeHtml(property.propertyId)}"
                style="width: 100%; height: 100%; object-fit: cover;"
              >
              ${isSelected ? `
                <div class="position-absolute top-0 end-0 p-2">
                  <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center"
                       style="width: 28px; height: 28px;">
                    <i class="bi bi-check-lg"></i>
                  </div>
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="bg-light d-flex align-items-center justify-content-center position-relative property-card-image">
              <i class="bi bi-building fs-1 text-muted"></i>
              ${isSelected ? `
                <div class="position-absolute top-0 end-0 p-2">
                  <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center"
                       style="width: 28px; height: 28px;">
                    <i class="bi bi-check-lg"></i>
                  </div>
                </div>
              ` : ''}
            </div>
          `}
          <div class="card-body">
            <h6 class="card-title mb-1 fw-bold">${escapeHtml(property.propertyId)}</h6>
            <p class="card-text text-muted small mb-0">
              <i class="bi bi-geo-alt me-1"></i>${escapeHtml(property.address || "No address")}
            </p>
          </div>
        </div>
      </div>
    `;
        }
      )
      .join("");

    // Add click handlers to cards
    const cards = document.querySelectorAll(".property-select-card");
    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        const propertyId = card.dataset.propertyId;
        const currentIndex = parseInt(card.dataset.propertyIndex);

        // Check if Shift key is held for range selection
        if (e.shiftKey && this.lastClickedIndex !== -1 && this.lastClickedIndex !== currentIndex) {
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
          this.renderPropertyList();
        } else {
          // Single selection/deselection
          if (this.selectedProperties.has(propertyId)) {
            this.selectedProperties.delete(propertyId);
            card.classList.remove("selected");
          } else {
            this.selectedProperties.add(propertyId);
            card.classList.add("selected");
          }

          this.lastClickedIndex = currentIndex;
          this.updateSelectedCount();
          // Re-render to update checkmark
          this.renderPropertyList();
        }
      });

      // Add hover effect
      card.addEventListener("mouseenter", () => {
        if (!card.classList.contains("selected")) {
          card.style.borderColor = "#0d6efd";
          card.style.transform = "translateY(-2px)";
          card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        }
      });

      card.addEventListener("mouseleave", () => {
        if (!card.classList.contains("selected")) {
          card.style.borderColor = "";
          card.style.transform = "";
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
      if (this.selectedProperties.has(propertyId)) {
        card.classList.add("selected");
        card.style.borderColor = "#198754";
        card.style.borderWidth = "3px";
        card.style.boxShadow = "0 4px 12px rgba(25,135,84,0.3)";
      } else {
        card.classList.remove("selected");
        card.style.borderColor = "";
        card.style.borderWidth = "";
        card.style.boxShadow = "";
      }
    });
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

                  if (investorsResult.success && investorsResult.data && investorsResult.data.length > 0) {
                    const totalIncome = report.totalIncome || 0;
                    const totalExpenses = report.totalExpenses || 0;
                    const netProfit = totalIncome - totalExpenses;

                    // Calculate investor distribution
                    report.investors = investorsResult.data
                      .map(investor => {
                        // Find this investor's percentage for the current property
                        const propertyInfo = investor.properties?.find(p => p.propertyId === propertyId);

                        // Skip if investor doesn't have this property
                        if (!propertyInfo) {
                          return null;
                        }

                        const percentage = propertyInfo.percentage || 0;
                        const profitShare = (netProfit * percentage) / 100;

                        // Get already paid/received from investor transactions
                        const existingTransaction = report.investorTransactions
                          ? report.investorTransactions.find(t => t.investorId === investor.investorId)
                          : null;
                        const alreadyPaid = existingTransaction ? existingTransaction.alreadyPaid : 0;
                        const alreadyReceived = existingTransaction ? existingTransaction.alreadyReceived : 0;

                        // Calculate expenses paid by this investor on behalf of the group
                        let expensesPaidByInvestor = 0;
                        if (report.expenses && Array.isArray(report.expenses)) {
                          expensesPaidByInvestor = report.expenses
                            .filter(exp => exp.personInCharge === investor.investorId)
                            .reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
                        }

                        // Calculate income received by this investor on behalf of the group
                        let incomeReceivedByInvestor = 0;
                        if (report.income && Array.isArray(report.income)) {
                          incomeReceivedByInvestor = report.income
                            .filter(inc => inc.personInCharge === investor.investorId)
                            .reduce((sum, inc) => sum + (parseFloat(inc.amount) || 0), 0);
                        }

                        // Final amount = investor's share - what they already paid + what they received + expenses they paid on behalf of group - income they received on behalf of group
                        const final = profitShare - alreadyPaid + alreadyReceived + expensesPaidByInvestor - incomeReceivedByInvestor;

                        return {
                          investorName: investor.name || investor.username,
                          investorId: investor.investorId,
                          avatar: investor.avatar || null,
                          sharePercentage: percentage,
                          profitShare: profitShare,
                          expensesPaid: expensesPaidByInvestor,
                          incomeReceived: incomeReceivedByInvestor,
                          alreadyPaid: alreadyPaid,
                          alreadyReceived: alreadyReceived,
                          final: final
                        };
                      })
                      .filter(inv => inv !== null); // Remove investors that don't have this property

                    // Calculate per-property settlements
                    if (report.investors && report.investors.length > 0) {
                      report.settlements = this.calculatePropertySettlements(report.investors);
                    }
                  }
                }
              } catch (error) {
                console.error(`Error fetching investors for ${propertyId}:`, error);
              }

              reports.push({
                propertyId,
                propertyData: this.properties.find((p) => p.propertyId === propertyId),
                report: report,
              });
            } else {
              // Report doesn't exist for this property
              reports.push({
                propertyId,
                propertyData: this.properties.find((p) => p.propertyId === propertyId),
                report: null,
                error: "No report found",
              });
            }
          } else if (response.status === 404) {
            // Report not found
            reports.push({
              propertyId,
              propertyData: this.properties.find((p) => p.propertyId === propertyId),
              report: null,
              error: "No report found",
            });
          }
        } catch (error) {
          console.error(`Error fetching report for ${propertyId}:`, error);
          reports.push({
            propertyId,
            propertyData: this.properties.find((p) => p.propertyId === propertyId),
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
    const investorTotals = new Map(); // Map<investorId, {name, totalFinal, properties: []}>

    reports.forEach((r) => {
      if (r.report) {
        const income = r.report.totalIncome || 0;
        const expenses = r.report.totalExpenses || 0;
        totalProfit += income - expenses;
        reportCount++;

        // Aggregate investor data
        if (r.report.investors && r.report.investors.length > 0) {
          r.report.investors.forEach(inv => {
            if (!investorTotals.has(inv.investorId)) {
              investorTotals.set(inv.investorId, {
                investorId: inv.investorId,
                investorName: inv.investorName,
                avatar: inv.avatar || null,
                totalFinal: 0,
                properties: []
              });
            }
            const investorData = investorTotals.get(inv.investorId);
            investorData.totalFinal += inv.final;
            investorData.properties.push({
              propertyId: r.propertyId,
              final: inv.final,
              sharePercentage: inv.sharePercentage
            });
          });
        }
      }
    });

    // Create property ID to data mapping
    const propertyMap = new Map();
    reports.forEach(r => {
      if (r.propertyData) {
        propertyMap.set(r.propertyId, r.propertyData);
      }
    });

    // Calculate settlement transactions between investors
    const settlements = this.calculateSettlements(investorTotals, propertyMap);

    // Create investor summary HTML
    let investorSummaryHtml = '';
    if (investorTotals.size > 0) {
      const investorArray = Array.from(investorTotals.values()).sort((a, b) => b.totalFinal - a.totalFinal);
      investorSummaryHtml = `
        <div class="card mb-4 border-primary">
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
                    <th class="text-end pe-3">Total Final Amount</th>
                    <th class="text-end pe-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${investorArray.map(inv => `
                    <tr>
                      <td class="ps-3">
                        <strong>${escapeHtml(inv.investorName)}</strong>
                        <br>
                        <small class="text-muted">ID: ${inv.investorId}</small>
                      </td>
                      <td class="text-center">
                        <span class="badge bg-secondary">${inv.properties.length}</span>
                      </td>
                      <td class="text-end pe-3">
                        <span class="fs-5 fw-bold ${inv.totalFinal >= 0 ? 'text-success' : 'text-danger'}">
                          $${inv.totalFinal.toFixed(2)}
                        </span>
                      </td>
                      <td class="text-end pe-3">
                        ${inv.totalFinal > 0
                          ? '<span class="badge bg-success">Will Receive</span>'
                          : inv.totalFinal < 0
                            ? '<span class="badge bg-danger">Must Pay</span>'
                            : '<span class="badge bg-secondary">Balanced</span>'}
                      </td>
                    </tr>
                  `).join('')}
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

    // Create settlement instructions HTML
    let settlementHtml = '';
    if (settlements.length > 0) {
      settlementHtml = `
        <div class="card mb-4 border-success">
          <div class="card-header bg-success text-white">
            <h5 class="mb-0">
              <i class="bi bi-arrow-left-right me-2"></i>
              Settlement Instructions - How to Transfer Money
            </h5>
          </div>
          <div class="card-body">
            <div class="alert alert-info mb-3">
              <i class="bi bi-lightbulb me-2"></i>
              <strong>How to settle:</strong> Follow these ${settlements.length} transaction${settlements.length > 1 ? 's' : ''} to settle all debts between investors.
            </div>
            <div class="list-group">
              ${settlements.map((settlement, index) => `
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
                          ${settlement.fromAvatar ? `
                            <img src="${this.getOptimizedAvatarUrl(settlement.fromAvatar, 'small')}"
                                 alt="${escapeHtml(settlement.fromName)}"
                                 class="rounded-circle me-2"
                                 style="width: 32px; height: 32px; object-fit: cover;"
                                 onerror="this.style.display='none'">
                          ` : `
                            <div class="rounded-circle me-2 d-flex align-items-center justify-content-center"
                                 style="width: 32px; height: 32px; background-color: #dc3545; color: white; font-weight: bold; font-size: 14px;">
                              ${escapeHtml(settlement.fromName.charAt(0).toUpperCase())}
                            </div>
                          `}
                          <strong class="text-danger">${escapeHtml(settlement.fromName)}</strong>
                          <span class="mx-2">
                            <i class="bi bi-arrow-right text-primary"></i>
                          </span>
                          ${settlement.toAvatar ? `
                            <img src="${this.getOptimizedAvatarUrl(settlement.toAvatar, 'small')}"
                                 alt="${escapeHtml(settlement.toName)}"
                                 class="rounded-circle me-2"
                                 style="width: 32px; height: 32px; object-fit: cover;"
                                 onerror="this.style.display='none'">
                          ` : `
                            <div class="rounded-circle me-2 d-flex align-items-center justify-content-center"
                                 style="width: 32px; height: 32px; background-color: #198754; color: white; font-weight: bold; font-size: 14px;">
                              ${escapeHtml(settlement.toName.charAt(0).toUpperCase())}
                            </div>
                          `}
                          <strong class="text-success">${escapeHtml(settlement.toName)}</strong>
                        </div>
                        <div>
                          <span class="badge bg-warning text-dark fs-6 px-3 py-2">
                            $${settlement.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      ${settlement.propertyBreakdown && settlement.propertyBreakdown.length > 0 ? `
                        <div class="mt-2 ps-3 border-start border-3 border-info">
                          <small class="text-muted d-block mb-1"><strong>Step-by-step calculation:</strong></small>
                          ${settlement.propertyBreakdown.map(prop => `
                            <div class="d-flex justify-content-between align-items-center py-1">
                              <small class="text-muted">
                                <i class="bi bi-building me-1"></i>
                                ${escapeHtml(prop.propertyName || prop.propertyId)}
                              </small>
                              <small class="badge bg-secondary">$${prop.amount.toFixed(2)}</small>
                            </div>
                          `).join('')}
                          <div class="d-flex justify-content-between align-items-center pt-2 mt-1 border-top border-2">
                            <small class="fw-bold text-dark">
                              <i class="bi bi-calculator me-1"></i>
                              Total to Transfer
                            </small>
                            <small class="badge bg-warning text-dark">$${settlement.amount.toFixed(2)}</small>
                          </div>
                        </div>
                      ` : `
                        <small class="text-muted d-block mt-1">
                          ${escapeHtml(settlement.fromName)} pays $${settlement.amount.toFixed(2)} to ${escapeHtml(settlement.toName)}
                        </small>
                      `}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            ${settlements.length > 0 ? `
              <div class="mt-3 p-3 bg-light rounded">
                <h6 class="mb-2">
                  <i class="bi bi-calculator me-2"></i>Summary
                </h6>
                <ul class="mb-0">
                  <li><strong>Total Transactions:</strong> ${settlements.length}</li>
                  <li><strong>Total Money Transferred:</strong> $${settlements.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}</li>
                </ul>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (investorTotals.size > 0) {
      // All balanced
      const allBalanced = Array.from(investorTotals.values()).every(inv => Math.abs(inv.totalFinal) < 0.01);
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
            <span class="fs-5 ${totalProfit >= 0 ? "text-success" : "text-danger"}">
              $${totalProfit.toFixed(2)}
            </span>
          </div>
        </div>
        <small class="text-muted">Showing ${reportCount} of ${reports.length} reports</small>
      </div>

      ${investorSummaryHtml}

      ${settlementHtml}

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
                        ${escapeHtml(item.propertyData?.address || "No address")}
                      </p>
                      <hr>
                      <div class="text-center text-warning py-3">
                        <i class="bi bi-exclamation-triangle fs-1"></i>
                        <p class="mt-2 mb-0">${item.error || "No report available"}</p>
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
                <div class="card h-100 ${netProfit >= 0 ? "border-success" : "border-danger"}">
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
                        <span class="text-success fw-bold">$${income.toFixed(2)}</span>
                      </div>
                      <div class="d-flex justify-content-between mb-2">
                        <span class="text-muted">Total Expenses:</span>
                        <span class="text-danger fw-bold">$${expenses.toFixed(2)}</span>
                      </div>
                      <hr>
                      <div class="d-flex justify-content-between">
                        <span class="fw-bold">Net Profit:</span>
                        <span class="fw-bold fs-5 ${netProfit >= 0 ? "text-success" : "text-danger"}">
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
                          Investor Distribution (${item.report.investors.length})
                        </h6>
                        <div class="table-responsive">
                          <table class="table table-sm table-hover mb-0">
                            <thead class="table-light">
                              <tr>
                                <th>Investor</th>
                                <th class="text-end">Share %</th>
                                <th class="text-end">Final</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${item.report.investors.map(inv => `
                                <tr>
                                  <td>
                                    <small class="fw-bold">${escapeHtml(inv.investorName)}</small>
                                  </td>
                                  <td class="text-end">
                                    <small>${inv.sharePercentage}%</small>
                                  </td>
                                  <td class="text-end">
                                    <small class="fw-bold ${inv.final >= 0 ? "text-success" : "text-danger"}">
                                      $${inv.final.toFixed(2)}
                                    </small>
                                  </td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </div>

                        ${item.report.settlements && item.report.settlements.length > 0 ? `
                          <div class="mt-3 p-2 bg-light rounded">
                            <h6 class="small mb-2 text-success">
                              <i class="bi bi-arrow-left-right me-1"></i>
                              Settlement for this property:
                            </h6>
                            <div class="list-group list-group-flush">
                              ${item.report.settlements.map(settlement => `
                                <div class="list-group-item px-2 py-1 bg-transparent border-0">
                                  <small>
                                    <strong class="text-danger">${escapeHtml(settlement.fromName)}</strong>
                                    <i class="bi bi-arrow-right mx-1 text-primary"></i>
                                    <strong class="text-success">${escapeHtml(settlement.toName)}</strong>
                                    <span class="badge bg-warning text-dark ms-2">$${settlement.amount.toFixed(2)}</span>
                                  </small>
                                </div>
                              `).join('')}
                            </div>
                          </div>
                        ` : ''}
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
  }

  calculatePropertySettlements(investors) {
    // Filter out balanced investors (within 1 cent tolerance)
    const activeInvestors = investors.filter(inv => Math.abs(inv.final) >= 0.01);

    if (activeInvestors.length === 0) {
      return [];
    }

    // Separate into creditors (receive money) and debtors (pay money)
    const creditors = activeInvestors
      .filter(inv => inv.final > 0)
      .map(inv => ({ ...inv, remaining: inv.final }))
      .sort((a, b) => b.remaining - a.remaining);

    const debtors = activeInvestors
      .filter(inv => inv.final < 0)
      .map(inv => ({ ...inv, remaining: Math.abs(inv.final) }))
      .sort((a, b) => b.remaining - a.remaining);

    const settlements = [];

    let creditorIndex = 0;
    let debtorIndex = 0;

    // Match debtors with creditors
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];

      // Calculate settlement amount (minimum of what debtor owes and creditor is owed)
      const settlementAmount = Math.min(creditor.remaining, debtor.remaining);

      if (settlementAmount >= 0.01) { // Only record settlements >= 1 cent
        settlements.push({
          fromId: debtor.investorId,
          fromName: debtor.investorName,
          toId: creditor.investorId,
          toName: creditor.investorName,
          amount: settlementAmount
        });
      }

      // Update remaining amounts
      creditor.remaining -= settlementAmount;
      debtor.remaining -= settlementAmount;

      // Move to next creditor/debtor if current one is settled
      if (creditor.remaining < 0.01) {
        creditorIndex++;
      }
      if (debtor.remaining < 0.01) {
        debtorIndex++;
      }
    }

    return settlements;
  }

  calculateSettlements(investorTotals, propertyMap) {
    // Convert to array and filter out balanced investors (within 1 cent tolerance)
    const investors = Array.from(investorTotals.values())
      .filter(inv => Math.abs(inv.totalFinal) >= 0.01);

    if (investors.length === 0) {
      return [];
    }

    // Separate into creditors (receive money) and debtors (pay money)
    const creditors = investors
      .filter(inv => inv.totalFinal > 0)
      .map(inv => ({
        ...inv,
        remaining: inv.totalFinal,
        remainingProperties: [...inv.properties] // Clone properties array
      }))
      .sort((a, b) => b.remaining - a.remaining);

    const debtors = investors
      .filter(inv => inv.totalFinal < 0)
      .map(inv => ({
        ...inv,
        remaining: Math.abs(inv.totalFinal),
        remainingProperties: inv.properties.map(p => ({ ...p, final: Math.abs(p.final) })) // Clone and make absolute
      }))
      .sort((a, b) => b.remaining - a.remaining);

    const settlements = [];

    let creditorIndex = 0;
    let debtorIndex = 0;

    // Match debtors with creditors
    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];

      // Calculate settlement amount (minimum of what debtor owes and creditor is owed)
      const settlementAmount = Math.min(creditor.remaining, debtor.remaining);

      if (settlementAmount >= 0.01) { // Only record settlements >= 1 cent
        // Build property breakdown for this settlement
        const propertyBreakdown = [];
        let remainingToAllocate = settlementAmount;

        // Match properties from debtor and creditor
        for (const debtorProp of debtor.remainingProperties) {
          if (remainingToAllocate < 0.01) break;

          // Find matching property in creditor's properties
          const creditorProp = creditor.remainingProperties.find(p => p.propertyId === debtorProp.propertyId);

          if (creditorProp && creditorProp.final > 0.01 && debtorProp.final > 0.01) {
            // Both have this property, calculate allocation
            const amountFromThisProperty = Math.min(debtorProp.final, creditorProp.final, remainingToAllocate);

            if (amountFromThisProperty >= 0.01) {
              // Get property data for display
              const propertyData = propertyMap ? propertyMap.get(debtorProp.propertyId) : null;

              propertyBreakdown.push({
                propertyId: debtorProp.propertyId,
                propertyName: propertyData ? propertyData.address || debtorProp.propertyId : debtorProp.propertyId,
                amount: amountFromThisProperty
              });

              // Update remaining amounts
              debtorProp.final -= amountFromThisProperty;
              creditorProp.final -= amountFromThisProperty;
              remainingToAllocate -= amountFromThisProperty;
            }
          }
        }

        settlements.push({
          fromId: debtor.investorId,
          fromName: debtor.investorName,
          fromAvatar: debtor.avatar || null,
          toId: creditor.investorId,
          toName: creditor.investorName,
          toAvatar: creditor.avatar || null,
          amount: settlementAmount,
          propertyBreakdown: propertyBreakdown
        });
      }

      // Update remaining amounts
      creditor.remaining -= settlementAmount;
      debtor.remaining -= settlementAmount;

      // Move to next creditor/debtor if current one is settled
      if (creditor.remaining < 0.01) {
        creditorIndex++;
      }
      if (debtor.remaining < 0.01) {
        debtorIndex++;
      }
    }

    return settlements;
  }

  getOptimizedAvatarUrl(url, size = 'small') {
    if (!url) return '';

    // Use ImageUtils if available, otherwise return original URL
    if (typeof ImageUtils !== 'undefined' && ImageUtils.getOptimizedImageUrl) {
      return ImageUtils.getOptimizedImageUrl(url, size);
    }

    return url;
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
