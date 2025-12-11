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
      countEl.textContent = `${count} ${
        count === 1 ? "property" : "properties"
      } selected`;
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
      .map((property, index) => {
        const isSelected = this.selectedProperties.has(property.propertyId);
        return `
      <div class="col-6 col-sm-3 col-md-2 property-card-col mb-3">
        <div
          class="card property-select-card ${isSelected ? "selected" : ""}"
          data-property-id="${property.propertyId}"
          data-property-index="${index}"
          style="cursor: pointer; transition: all 0.2s ease;"
        >
          ${
            property.propertyImage
              ? `
            <div class="position-relative property-card-image">
              <img
                src="${property.propertyImage}"
                class="card-img-top"
                alt="${escapeHtml(property.propertyId)}"
                style="width: 100%; height: 100%; object-fit: cover;"
              >
              ${
                isSelected
                  ? `
                <div class="position-absolute top-0 end-0 p-2">
                  <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center"
                       style="width: 28px; height: 28px;">
                    <i class="bi bi-check-lg"></i>
                  </div>
                </div>
              `
                  : ""
              }
            </div>
          `
              : `
            <div class="bg-light d-flex align-items-center justify-content-center position-relative property-card-image">
              <i class="bi bi-building fs-1 text-muted"></i>
              ${
                isSelected
                  ? `
                <div class="position-absolute top-0 end-0 p-2">
                  <div class="bg-success text-white rounded-circle d-flex align-items-center justify-content-center"
                       style="width: 28px; height: 28px;">
                    <i class="bi bi-check-lg"></i>
                  </div>
                </div>
              `
                  : ""
              }
            </div>
          `
          }
          <div class="card-body">
            <h6 class="card-title mb-1 fw-bold">${escapeHtml(
              property.propertyId
            )}</h6>
            <p class="card-text text-muted small mb-0">
              <i class="bi bi-geo-alt me-1"></i>${escapeHtml(
                property.address || "No address"
              )}
            </p>
          </div>
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

                  if (
                    investorsResult.success &&
                    investorsResult.data &&
                    investorsResult.data.length > 0
                  ) {
                    const totalIncome = report.totalIncome || 0;
                    const totalExpenses = report.totalExpenses || 0;
                    const netProfit = totalIncome - totalExpenses;

                    // Calculate investor distribution
                    report.investors = investorsResult.data
                      .map((investor) => {
                        // Find this investor's percentage for the current property
                        const propertyInfo = investor.properties?.find(
                          (p) => p.propertyId === propertyId
                        );

                        // Skip if investor doesn't have this property
                        if (!propertyInfo) {
                          return null;
                        }

                        const percentage = propertyInfo.percentage || 0;
                        const profitShare = (netProfit * percentage) / 100;

                        // Get already paid/received from investor transactions
                        const existingTransaction = report.investorTransactions
                          ? report.investorTransactions.find(
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
                        let expensesPaidByInvestor = 0;
                        if (report.expenses && Array.isArray(report.expenses)) {
                          expensesPaidByInvestor = report.expenses
                            .filter(
                              (exp) =>
                                exp.personInCharge === investor.investorId
                            )
                            .reduce(
                              (sum, exp) => sum + (parseFloat(exp.amount) || 0),
                              0
                            );
                        }

                        // Calculate income received by this investor on behalf of the group
                        let incomeReceivedByInvestor = 0;
                        if (report.income && Array.isArray(report.income)) {
                          incomeReceivedByInvestor = report.income
                            .filter(
                              (inc) =>
                                inc.personInCharge === investor.investorId
                            )
                            .reduce(
                              (sum, inc) => sum + (parseFloat(inc.amount) || 0),
                              0
                            );
                        }

                        // Final amount = investor's share - what they already paid + what they received + expenses they paid on behalf of group - income they received on behalf of group
                        const final =
                          profitShare -
                          alreadyPaid +
                          alreadyReceived +
                          expensesPaidByInvestor -
                          incomeReceivedByInvestor;

                        // Use final amount as SGD amount (everything converted to SGD)
                        const sgdAmount = final;

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
                          final: final,
                          sgdAmount: sgdAmount,
                        };
                      })
                      .filter((inv) => inv !== null); // Remove investors that don't have this property

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
                id="copySettlementBtn"
                class="btn btn-sm btn-light"
                title="Copy settlement instructions to clipboard"
                style="border: none;">
                <i class="bi bi-clipboard"></i> Copy
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
                          <span class="badge bg-warning text-dark fs-6 px-3 py-2">
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
                                isNegative ? "bg-danger" : isPositive ? "bg-success" : "bg-secondary"
                              } d-flex align-items-center gap-1">
                                ${isNegative ? '<i class="bi bi-dash-circle-fill"></i> -' : isPositive ? '<i class="bi bi-plus-circle-fill"></i> +' : ''}$${displayAmount.toFixed(2)}
                              </small>
                            </div>
                          `;
                            })
                            .join("")}
                          <div class="d-flex justify-content-between align-items-center pt-2 mt-1 border-top border-2">
                            <small class="fw-bold text-dark">
                              <i class="bi bi-calculator me-1"></i>
                              Net Amount to Transfer
                            </small>
                            <small class="badge bg-warning text-dark">$${settlement.amount.toFixed(2)}</small>
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
                                    <span class="badge bg-warning text-dark ms-2">$${settlement.amount.toFixed(2)}</span>
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
  }

  bindCopySettlementButton() {
    const copyBtn = document.getElementById("copySettlementBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        this.copySettlementInstructions();
      });
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
        const amountElement = item.querySelector(".badge.bg-warning");

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
              ? propertyData.address || propertyId
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
              ? propertyData.address || propertyId
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
