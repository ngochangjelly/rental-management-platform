/**
 * Bulk Property Reports Component
 * Allows users to select multiple properties and view profit results for a specific month
 */

import {
  fetchInvestorsForAvatarStack,
  renderPropertyImageAvatarBadge,
} from "../utils/investor-avatar-stack.js";

class BulkPropertyReportsComponent {
  constructor() {
    this.properties = [];
    this.selectedProperties = new Set();
    this.lastClickedIndex = -1; // Track last clicked card for shift selection
    this._avatarInvestors = []; // Investors list (with linked properties) for the card image avatar badge
    this.init();
  }

  init() {
    this.bindEvents();
    this.bindExtractionEvents();
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

    // CSS Grid — compact cards
    container.style.display = "grid";
    container.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
    container.style.gap = "0.5rem";

    container.innerHTML = [...this.properties]
      .sort((a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0))
      .map((property, index) => {
        const isSelected = this.selectedProperties.has(property.propertyId);
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
          card.style.transform = "translateY(-2px)";
          card.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)";
        }
      });

      card.addEventListener("mouseleave", () => {
        if (!card.classList.contains("selected")) {
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
      const isSelected = this.selectedProperties.has(propertyId);

      card.classList.toggle("selected", isSelected);
      card.style.border = isSelected ? "3px solid #0d6efd" : "";
      card.style.boxShadow = isSelected ? "0 0 0 3px rgba(13,110,253,0.2), 0 4px 12px rgba(13,110,253,0.25)" : "";

      const overlay = card.querySelector('[data-role="selected-overlay"]');
      if (overlay) overlay.style.display = isSelected ? "flex" : "none";

      const body = card.querySelector('[data-role="card-body"]');
      if (body) body.style.background = isSelected ? "rgba(13,110,253,0.07)" : "#fff";

      const check = card.querySelector('[data-role="no-image-check"]');
      if (check) check.style.display = isSelected ? "inline" : "none";
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
                        // (excluding pending items, to match the single-property report)
                        let expensesPaidByInvestor = 0;
                        if (report.expenses && Array.isArray(report.expenses)) {
                          expensesPaidByInvestor = report.expenses
                            .filter(
                              (exp) =>
                                !exp.isPending &&
                                exp.personInCharge === investor.investorId
                            )
                            .reduce(
                              (sum, exp) => sum + (parseFloat(exp.amount) || 0),
                              0
                            );
                        }

                        // Calculate income received by this investor on behalf of the group
                        // (excluding pending items, to match the single-property report)
                        let incomeReceivedByInvestor = 0;
                        if (report.income && Array.isArray(report.income)) {
                          incomeReceivedByInvestor = report.income
                            .filter(
                              (inc) =>
                                !inc.isPending &&
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

    // Save settlements + reports for image export
    this.lastSettlements = settlements;
    this.lastReports = reports;

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
                id="exportSettlementBtn"
                class="btn btn-sm btn-light me-1"
                title="Export as image (copies to clipboard)"
                style="border: none;">
                <i class="bi bi-image"></i> Image
              </button>
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
    const payeeSel = document.getElementById("extractPayeeSelect");
    if (!payerSel || !payeeSel) return;

    const opts = (this.allInvestors || [])
      .map((inv) => `<option value="${inv.investorId}">${escapeHtml(inv.name)}</option>`)
      .join("");

    payerSel.innerHTML = `<option value="">Select payer…</option>${opts}`;
    payeeSel.innerHTML = `<option value="">Select payee…</option>${opts}`;
  }

  async fetchSettlementExtraction() {
    const month   = document.getElementById("extractMonth")?.value;
    const year    = document.getElementById("extractYear")?.value;
    const payerId = document.getElementById("extractPayerSelect")?.value;
    const payeeId = document.getElementById("extractPayeeSelect")?.value;

    if (!month || !year || !payerId || !payeeId) {
      this.showError("Please select month, year, payer, and payee.");
      return;
    }
    if (payerId === payeeId) {
      this.showError("Payer and payee must be different investors.");
      return;
    }

    const payerInvestor = (this.allInvestors || []).find((i) => i.investorId === payerId);
    const payeeInvestor = (this.allInvestors || []).find((i) => i.investorId === payeeId);

    document.getElementById("extractionLoading").style.display = "block";
    document.getElementById("extractionResultsArea").style.display = "none";

    try {
      const results = [];

      await Promise.all(
        (this.properties || []).map(async (property) => {
          try {
            const resp = await API.get(
              API_CONFIG.ENDPOINTS.FINANCIAL_REPORT(property.propertyId, year, month),
            );
            if (!resp.ok) return;
            const data = await resp.json();
            if (!data.success || !data.data) return;

            const matching = (data.data.expenses || []).filter(
              (exp) => exp.personInCharge === payerId && exp.paidTo === payeeId,
            );

            if (matching.length > 0) {
              results.push({
                propertyId:   property.propertyId,
                propertyData: property,
                expenses:     matching,
                total:        matching.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
              });
            }
          } catch { /* skip */ }
        }),
      );

      // Highest total first
      results.sort((a, b) => b.total - a.total);

      // Cache for export
      this.lastExtractionData = { results, payerInvestor, payeeInvestor, month, year };

      this.displaySettlementExtraction(results, payerInvestor, payeeInvestor, month, year);
    } catch (err) {
      console.error("Extraction error:", err);
      this.showError("Failed to extract settlements. Please try again.");
    } finally {
      document.getElementById("extractionLoading").style.display = "none";
    }
  }

  displaySettlementExtraction(results, payerInvestor, payeeInvestor, month, year) {
    const MONTH_NAMES = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    const monthName   = MONTH_NAMES[parseInt(month) - 1];
    const grandTotal  = results.reduce((s, r) => s + r.total, 0);
    const totalTx     = results.reduce((s, r) => s + r.expenses.length, 0);
    const payerName   = payerInvestor?.name || "Unknown";
    const payeeName   = payeeInvestor?.name || "Unknown";

    const renderAvatar = (avatar, name, bgColor) => {
      if (avatar) {
        return `<img src="${this.getOptimizedAvatarUrl(avatar, "small")}" class="rounded-circle me-1" style="width:26px;height:26px;object-fit:cover;" alt="${escapeHtml(name)}">`;
      }
      return `<div class="rounded-circle me-1 d-inline-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0" style="width:26px;height:26px;font-size:11px;background:${bgColor};">${escapeHtml(name.charAt(0).toUpperCase())}</div>`;
    };

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
          <div class="text-center text-muted py-5">
            <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
            <p>No expense transactions found where <strong>${escapeHtml(payerName)}</strong> paid <strong>${escapeHtml(payeeName)}</strong> in ${escapeHtml(monthName)} ${escapeHtml(year)}.</p>
          </div>`;
    } else {
      // Info alert
      html += `
          <div class="alert alert-info mb-3">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <i class="bi bi-lightbulb me-1"></i>
              <span>Found <strong>${totalTx} transaction${totalTx !== 1 ? "s" : ""}</strong> across <strong>${results.length} propert${results.length !== 1 ? "ies" : "y"}</strong> where</span>
              <span class="d-inline-flex align-items-center">
                ${renderAvatar(payerInvestor?.avatar, payerName, "#dc3545")}
                <strong class="text-danger">${escapeHtml(payerName)}</strong>
              </span>
              <span>paid</span>
              <span class="d-inline-flex align-items-center">
                ${renderAvatar(payeeInvestor?.avatar, payeeName, "#198754")}
                <strong class="text-success">${escapeHtml(payeeName)}</strong>
              </span>
              <span>— Grand Total: <strong class="text-dark">$${grandTotal.toFixed(2)} SGD</strong></span>
            </div>
          </div>`;

      // Property cards
      html += `<div class="list-group mb-3">`;
      results.forEach((result) => {
        const prop    = result.propertyData || {};
        const unit    = prop.unit    || "";
        const address = prop.address || result.propertyId;
        const propLabel = [unit, address].filter(Boolean).join(" · ");

        html += `
          <div class="list-group-item px-3 py-3">
            <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="badge bg-secondary">${escapeHtml(result.propertyId)}</span>
                <span class="fw-semibold">${escapeHtml(propLabel)}</span>
              </div>
              <span class="badge bg-warning text-dark fs-6 px-3 py-1 flex-shrink-0">$${result.total.toFixed(2)}</span>
            </div>
            <div class="ps-2 border-start border-3 border-info">
              <small class="text-muted fw-bold d-block mb-1">Transactions:</small>`;

        result.expenses.forEach((exp) => {
          const dateStr = exp.date
            ? new Date(exp.date).toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" })
            : "—";
          const curr = exp.currency || "SGD";
          const amt  = parseFloat(exp.amount) || 0;
          const amtStr = curr === "VND"
            ? `₫${amt.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`
            : `$${amt.toFixed(2)}`;

          html += `
              <div class="d-flex justify-content-between align-items-start py-1 border-bottom border-light">
                <div class="flex-grow-1 me-2">
                  <span class="fw-medium">${escapeHtml(exp.item || "—")}</span>
                  <small class="text-muted ms-2">· ${escapeHtml(dateStr)}</small>
                  ${exp.details ? `<br><small class="text-muted fst-italic">${escapeHtml(exp.details)}</small>` : ""}
                </div>
                <small class="badge bg-danger d-flex align-items-center gap-1 flex-shrink-0">
                  <i class="bi bi-plus-circle-fill"></i> +${escapeHtml(amtStr)}
                </small>
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
              <span class="text-muted">Total Transactions:</span><strong>${totalTx}</strong>
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

    // Bind export button
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
      const payeeName = data.payeeInvestor?.name || "Payee";
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
   */
  async _generateExtractionSVG({ results, payerInvestor, payeeInvestor, month, year }) {
    const W       = 430;
    const M       = 16;
    const CARD_MX = 4;
    const cardX   = M + CARD_MX;            // 20
    const cardW   = W - 2 * (M + CARD_MX); // 390
    const INNER_L = cardX + 12;             // 32
    const INNER_R = cardX + cardW - 12;     // 398

    const CARD_PAD   = 12;
    const PROP_HDR_H = 46;   // property header (2 lines: ID+unit / address)
    const EXP_ROW_H  = 26;   // each expense row
    const PROP_TOT_H = 28;   // property subtotal row
    const SEP_H      = 6;
    const CARD_GAP   = 10;

    const nodes  = [];
    const defs   = [];
    let   y      = 0;
    let   clipIdx = 0;
    const p = (s) => nodes.push(s);

    const fontFaceStyle = await this._loadFontFaceStyle();

    // Fetch avatars
    const urls = new Set();
    if (payerInvestor?.avatar) urls.add(payerInvestor.avatar);
    if (payeeInvestor?.avatar) urls.add(payeeInvestor.avatar);
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

    const renderCircleAvatar = (avatarUrl, name, cx, cy, r = 13, fallbackColor = "#6c757d") => {
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
    const totalTx    = results.reduce((s, r) => s + r.expenses.length, 0);
    const payerName  = payerInvestor?.name || "Unknown";
    const payeeName  = payeeInvestor?.name || "Unknown";

    // ── Header ───────────────────────────────────────────────────────────
    const HDR_H = 80;
    p(`<rect x="0" y="0" width="${W}" height="${HDR_H}" fill="#0f172a"/>`);
    p(`<text x="${M}" y="22" font-size="8" fill="#94a3b8" font-weight="600" letter-spacing="2.5">SETTLEMENT EXTRACTION</text>`);
    p(`<text x="${M}" y="48" font-size="18" fill="#ffffff" font-weight="700">${this._svgEsc(monthName)} ${this._svgEsc(String(year))}</text>`);
    p(`<text x="${W - M}" y="48" font-size="22" fill="#64748b" text-anchor="end">&#x21C4;</text>`);
    p(`<text x="${W - M}" y="68" font-size="9" fill="#64748b" text-anchor="end">Generated ${this._svgEsc(genDate)}</text>`);
    y = HDR_H;

    // ── Payer → Payee info box ────────────────────────────────────────────
    const INFO_H = 58;
    p(`<rect x="0" y="${y}" width="${W}" height="${INFO_H}" fill="#e8f4fd"/>`);
    p(`<rect x="0" y="${y}" width="4" height="${INFO_H}" fill="#0d6efd"/>`);

    const avatarR = 14;
    const infoMidY = y + INFO_H / 2;

    // Payer
    const fromCx = M + 8 + avatarR;
    renderCircleAvatar(payerInvestor?.avatar, payerName, fromCx, infoMidY, avatarR, "#dc3545");
    const fromNameX = fromCx + avatarR + 5;
    const fromNameStr = this._svgTrunc(payerName, 16);
    p(`<text x="${fromNameX}" y="${infoMidY - 6}" font-size="12" fill="#dc3545" font-weight="700">${this._svgEsc(fromNameStr)}</text>`);
    p(`<text x="${fromNameX}" y="${infoMidY + 8}" font-size="9" fill="#6c757d">Payer</text>`);

    // Arrow
    const arrowX = fromNameX + fromNameStr.length * 7.5 + 8;
    p(`<text x="${arrowX}" y="${infoMidY + 5}" font-size="18" fill="#6c757d">&#x2192;</text>`);

    // Payee
    const toCx = arrowX + 20 + 5 + avatarR;
    renderCircleAvatar(payeeInvestor?.avatar, payeeName, toCx, infoMidY, avatarR, "#198754");
    const toNameX = toCx + avatarR + 5;
    const toNameStr = this._svgTrunc(payeeName, 16);
    p(`<text x="${toNameX}" y="${infoMidY - 6}" font-size="12" fill="#198754" font-weight="700">${this._svgEsc(toNameStr)}</text>`);
    p(`<text x="${toNameX}" y="${infoMidY + 8}" font-size="9" fill="#6c757d">Payee</text>`);

    // Total badge (right side)
    const totalStr  = `$${grandTotal.toFixed(2)}`;
    const totBadgeW = Math.max(82, totalStr.length * 8.5 + 16);
    const totBadgeX = INNER_R - totBadgeW;
    p(`<rect x="${totBadgeX}" y="${infoMidY - 14}" width="${totBadgeW}" height="26" rx="7" fill="#ffc107"/>`);
    p(`<text x="${totBadgeX + totBadgeW / 2}" y="${infoMidY + 4}" font-size="13" fill="#212529" font-weight="700" text-anchor="middle">${this._svgEsc(totalStr)}</text>`);

    // Sub-label under total
    const txLabel = `${totalTx} tx · ${results.length} prop`;
    p(`<text x="${totBadgeX + totBadgeW / 2}" y="${infoMidY + 20}" font-size="8" fill="#6c757d" text-anchor="middle">${this._svgEsc(txLabel)}</text>`);

    y += INFO_H + 12;

    // ── Property cards ────────────────────────────────────────────────────
    results.forEach((result) => {
      const prop    = result.propertyData || {};
      const unit    = prop.unit    || "";
      const address = prop.address || result.propertyId;
      const numExp  = result.expenses.length;

      // Card height: header + expense rows + separator + subtotal + padding
      const cardH = CARD_PAD + PROP_HDR_H + numExp * EXP_ROW_H + SEP_H + PROP_TOT_H + CARD_PAD;

      // Card shell
      p(`<rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="8" fill="#ffffff" stroke="#dee2e6" stroke-width="1.5"/>`);

      // ── Property header (2 lines) ──
      let yi = y + CARD_PAD;

      // Line 1: propertyId badge + unit
      const propIdStr  = this._svgTrunc(result.propertyId, 20);
      const propIdW    = Math.max(50, propIdStr.length * 6.5 + 12);
      p(`<rect x="${INNER_L}" y="${yi + 4}" width="${propIdW}" height="18" rx="4" fill="#6c757d"/>`);
      p(`<text x="${INNER_L + propIdW / 2}" y="${yi + 16}" font-size="9" fill="#ffffff" font-weight="700" text-anchor="middle">${this._svgEsc(propIdStr)}</text>`);
      if (unit) {
        p(`<text x="${INNER_L + propIdW + 8}" y="${yi + 16}" font-size="11" fill="#1e293b" font-weight="700">${this._svgEsc(unit)}</text>`);
      }

      // Line 2: address
      const addrStr = this._svgTrunc(address, 48);
      p(`<text x="${INNER_L}" y="${yi + 36}" font-size="9.5" fill="#6c757d">${this._svgEsc(addrStr)}</text>`);

      yi += PROP_HDR_H;

      // ── Expense rows ──
      result.expenses.forEach((exp, ei) => {
        const rowY = yi + ei * EXP_ROW_H;

        // Alternating row bg
        if (ei % 2 === 1) {
          p(`<rect x="${cardX + 1}" y="${rowY}" width="${cardW - 2}" height="${EXP_ROW_H}" fill="#f8fafc"/>`);
        }

        // Date
        const dateStr = exp.date
          ? new Date(exp.date).toLocaleDateString("en-SG", { day: "2-digit", month: "short" })
          : "—";
        p(`<text x="${INNER_L}" y="${rowY + 17}" font-size="9" fill="#94a3b8">${this._svgEsc(dateStr)}</text>`);

        // Description
        const descStr = this._svgTrunc(exp.item || "—", 34);
        p(`<text x="${INNER_L + 46}" y="${rowY + 17}" font-size="10" fill="#1e293b">${this._svgEsc(descStr)}</text>`);

        // Amount badge
        const curr   = exp.currency || "SGD";
        const amt    = parseFloat(exp.amount) || 0;
        const amtStr = curr === "VND"
          ? `+\u20ab${amt.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`
          : `+$${amt.toFixed(2)}`;
        const amtBW  = Math.max(60, amtStr.length * 6.5 + 14);
        const amtBX  = INNER_R - amtBW;
        p(`<rect x="${amtBX}" y="${rowY + 4}" width="${amtBW}" height="18" rx="5" fill="#dc3545"/>`);
        // Icon circle
        p(`<circle cx="${amtBX + 9}" cy="${rowY + 13}" r="4.5" fill="#ffffff"/>`);
        p(`<text x="${amtBX + 9}" y="${rowY + 16}" font-size="6.5" fill="#dc3545" font-weight="800" text-anchor="middle">+</text>`);
        p(`<text x="${amtBX + 19 + (amtBW - 19) / 2}" y="${rowY + 16}" font-size="9" fill="#ffffff" font-weight="700" text-anchor="middle">${this._svgEsc(amtStr)}</text>`);
      });

      yi += numExp * EXP_ROW_H;

      // ── Property subtotal ──
      p(`<line x1="${INNER_L}" y1="${yi + SEP_H / 2}" x2="${INNER_R}" y2="${yi + SEP_H / 2}" stroke="#dee2e6" stroke-width="1"/>`);
      yi += SEP_H;

      p(`<text x="${INNER_L}" y="${yi + PROP_TOT_H - 8}" font-size="10" fill="#1e293b" font-weight="700">Property Total</text>`);
      const ptStr  = `$${result.total.toFixed(2)}`;
      const ptBW   = Math.max(76, ptStr.length * 8 + 16);
      const ptBX   = INNER_R - ptBW;
      p(`<rect x="${ptBX}" y="${yi + 4}" width="${ptBW}" height="20" rx="6" fill="#ffc107"/>`);
      p(`<text x="${ptBX + ptBW / 2}" y="${yi + 18}" font-size="11" fill="#212529" font-weight="700" text-anchor="middle">${this._svgEsc(ptStr)}</text>`);

      y += cardH + CARD_GAP;
    });

    // ── Grand total card ──────────────────────────────────────────────────
    const gtH = 60;
    p(`<rect x="${cardX}" y="${y}" width="${cardW}" height="${gtH}" rx="8" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"/>`);
    p(`<text x="${INNER_L}" y="${y + 22}" font-size="10" fill="#6c757d" font-weight="600">Total Transactions:</text>`);
    p(`<text x="${INNER_R}" y="${y + 22}" font-size="10" fill="#1e293b" font-weight="700" text-anchor="end">${totalTx}</text>`);
    p(`<line x1="${INNER_L}" y1="${y + 30}" x2="${INNER_R}" y2="${y + 30}" stroke="#dee2e6" stroke-width="0.5"/>`);
    p(`<text x="${INNER_L}" y="${y + 50}" font-size="11" fill="#1e293b" font-weight="700">Grand Total (SGD):</text>`);
    const gtStr = `$${grandTotal.toFixed(2)}`;
    const gtBW  = Math.max(86, gtStr.length * 9 + 16);
    const gtBX  = INNER_R - gtBW;
    p(`<rect x="${gtBX}" y="${y + 36}" width="${gtBW}" height="22" rx="6" fill="#ffc107"/>`);
    p(`<text x="${gtBX + gtBW / 2}" y="${y + 51}" font-size="13" fill="#212529" font-weight="700" text-anchor="middle">${this._svgEsc(gtStr)}</text>`);
    y += gtH + 10;

    // ── Footer ───────────────────────────────────────────────────────────
    y += 6;
    p(`<text x="${W / 2}" y="${y + 12}" font-size="8.5" fill="#94a3b8" text-anchor="middle">${this._svgEsc(payerName)} &#x2192; ${this._svgEsc(payeeName)} &#xB7; ${this._svgEsc(monthName)} ${this._svgEsc(String(year))}</text>`);
    y += 28;

    const H = y;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Noto Serif,serif">`,
      `<defs>${fontFaceStyle}${defs.join("")}</defs>`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="#f1f5f9"/>`,
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
      const svgStr = await this._generateSettlementSVG(settlements, properties);
      const blob = await this._svgToPngBlob(svgStr);

      // Show preview modal first (non-blocking)
      const monthLabel = document.getElementById("bulkReportMonth")?.selectedOptions?.[0]?.textContent?.trim() || "";
      const year = document.getElementById("bulkReportYear")?.value || "";
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
   */
  async _generateSettlementSVG(settlements, properties = []) {
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

    // Property preview grid (matches the "Select Properties" picker card style:
    // rounded photo, ID badge overlaid top-left, address + unit below)
    const PROP_COLS   = 6;
    const PROP_GAP    = 10;
    const PROP_THUMB_H = 52;
    const PROP_LABEL_H = 22; // address line + unit line
    const propCardW   = (TOTAL_W - 2 * M - (PROP_COLS - 1) * PROP_GAP) / PROP_COLS;
    const propCardH   = PROP_THUMB_H + 4 + PROP_LABEL_H;

    // Row heights within each card
    const CARD_PAD_TOP    = 14;
    const CARD_PAD_BOT    = 14;
    const SUB_ROW_H       = 26; // "from" / "to" sub-row (stacked, so long names don't get cut off)
    const SUB_ROW_GAP     = 6;
    const NAME_ROW_H      = SUB_ROW_H * 2 + SUB_ROW_GAP; // stacked from/to rows
    const AMT_ROW_H       = 30; // transfer amount badge row
    const LABEL_ROW_H     = 20; // "step-by-step" label
    const PROP_ROW_H      = 22; // each property line
    const SEP_H           = 8;  // separator before net total
    const NET_ROW_H       = 34; // net total row (plain text, bigger figure)
    const CARD_GAP        = 10; // gap between cards

    // ── Dark purple premium palette ──────────────────────────────────────
    const PAGE_BG    = "#0b0912"; // near-black with a purple tint
    const CARD_BG    = "#181322"; // card surface
    const CARD_BG_2  = "#1d1830"; // slightly raised surface (info box, thumbnails w/o photo)
    const BORDER     = "#2c2440"; // subtle card border
    const DIVIDER    = "#2c2440";
    const TEXT_HI    = "#f6f3ff"; // primary text (near-white, purple-tinted)
    const TEXT_MED   = "#b6adcf"; // secondary text
    const TEXT_LOW   = "#7d7398"; // muted / labels
    const ACCENT_PURPLE    = "#8b5cf6"; // primary purple accent
    const ACCENT_GREEN     = "#2fbf71"; // credit / positive — deep emerald (premium, not neon) for text/icons on the dark card
    const ACCENT_RED       = "#ff6b81"; // debit / payment (coral) — for text/icons directly on the dark card
    const ACCENT_GREEN_FILL = "#2f8f5b"; // muted deep green for filled pill badges — blends into the dark theme instead of popping
    const ACCENT_RED_FILL   = "#b3394a"; // muted deep red for filled pill badges — blends into the dark theme instead of popping

    const nodes  = [];
    const defs   = [];
    let   clipIdx = 0;
    const p = (s) => nodes.push(s);

    const fontFaceStyle = await this._loadFontFaceStyle();

    // Coral (payer) → lime (payee) gradient for the rare no-breakdown
    // fallback amount badge.
    defs.push(`<linearGradient id="netAmountGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="${ACCENT_RED_FILL}"/><stop offset="100%" stop-color="${ACCENT_GREEN_FILL}"/></linearGradient>`);

    // Header background — deep, muted purple-black.
    defs.push(`<linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3a2266"/><stop offset="100%" stop-color="#120b1f"/></linearGradient>`);

    // Avatar + property thumbnail caches
    const avatarCache = await this._fetchSettlementAvatarsAsBase64(settlements);
    const propImageCache = await this._fetchPropertyImagesAsBase64(properties, propCardW, PROP_THUMB_H);

    const renderCircleAvatar = (avatarUrl, name, cx, cy, r = 13, fallbackColor = "#6c757d") => {
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

    // ── Header (full width) — deep purple-black premium bar ─────────────
    const HDR_H = 52;
    p(`<rect x="0" y="0" width="${TOTAL_W}" height="${HDR_H}" fill="url(#headerGradient)"/>`);
    p(`<rect x="0" y="0" width="${TOTAL_W}" height="1" fill="#ffffff" opacity="0.08"/>`);
    p(`<rect x="0" y="${HDR_H - 1}" width="${TOTAL_W}" height="1" fill="#000000" opacity="0.35"/>`);
    const titleStr = "SETTLEMENT INSTRUCTIONS";
    const titleY   = Math.round(HDR_H / 2) + 5;
    p(`<text x="${M}" y="${titleY}" font-size="16" fill="${TEXT_HI}" font-weight="700" letter-spacing="0.5">${titleStr}</text>`);

    // Prominent bubble showing total properties involved in this calculation
    const titleW   = titleStr.length * 9.5;
    const countStr = String(properties.length);
    const bubbleR  = 13;
    const bubbleCx = M + titleW + 16 + bubbleR;
    const bubbleCy = Math.round(HDR_H / 2);
    p(`<circle cx="${bubbleCx}" cy="${bubbleCy}" r="${bubbleR}" fill="${ACCENT_PURPLE}" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.5"/>`);
    p(`<text x="${bubbleCx}" y="${bubbleCy + 4}" font-size="12" fill="#ffffff" font-weight="800" text-anchor="middle">${this._svgEsc(countStr)}</text>`);

    p(`<text x="${TOTAL_W - M}" y="21" font-size="18" fill="${ACCENT_PURPLE}" text-anchor="end">&#x21C4;</text>`);
    p(`<text x="${TOTAL_W - M}" y="38" font-size="9" fill="${TEXT_MED}" text-anchor="end">Generated ${this._svgEsc(genDate)}</text>`);
    let y = HDR_H;

    // ── Info box (full width) ───────────────────────────────────────────
    const txCount = settlements.length;
    const infoText = `Follow these ${txCount} transaction${txCount !== 1 ? "s" : ""} to settle all debts between investors. Transactions are netted across all properties.`;
    const infoWrapChars = Math.floor(52 * (TOTAL_W / COL_W));
    const infoLines = this._svgWrapText(infoText, infoWrapChars);
    const INFO_H = 14 + infoLines.length * 14 + 10;
    p(`<rect x="0" y="${y}" width="${TOTAL_W}" height="${INFO_H}" fill="${CARD_BG_2}"/>`);
    p(`<rect x="0" y="${y}" width="4" height="${INFO_H}" fill="${ACCENT_PURPLE}"/>`);
    infoLines.forEach((line, i) => {
      p(`<text x="${M + 8}" y="${y + 20 + i * 14}" font-size="10.5" fill="${TEXT_MED}">${this._svgEsc(line)}</text>`);
    });
    y += INFO_H + 12;

    // ── Selected properties (full width) — mirrors the "Select Properties"
    // picker card: photo with a numbered ID badge overlaid top-left, then
    // the full address and unit underneath. ────────────────────────────
    if (properties.length > 0) {
      const propsSorted = [...properties].sort(
        (a, b) => (parseInt(b.propertyId) || 0) - (parseInt(a.propertyId) || 0),
      );
      const propRows = Math.ceil(propsSorted.length / PROP_COLS);
      const addrMaxChars = Math.max(8, Math.floor(propCardW / 4.6));
      const unitMaxChars = Math.max(6, Math.floor(propCardW / 4.6));

      p(`<text x="${M}" y="${y + 12}" font-size="10" fill="${TEXT_LOW}" font-weight="700" letter-spacing="0.5">PROPERTIES IN THIS CALCULATION (${propsSorted.length})</text>`);
      y += 22;
      const gridTop = y;

      propsSorted.forEach((prop, i) => {
        const col = i % PROP_COLS;
        const row = Math.floor(i / PROP_COLS);
        const px  = M + col * (propCardW + PROP_GAP);
        const py  = gridTop + row * (propCardH + PROP_GAP);

        // Card shell
        p(`<rect x="${px}" y="${py}" width="${propCardW}" height="${propCardH}" rx="8" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="1"/>`);

        // Thumbnail photo
        const dataUri = prop.propertyImage ? propImageCache[prop.propertyImage] : null;
        if (dataUri) {
          const clipId = `pc${clipIdx++}`;
          defs.push(`<clipPath id="${clipId}"><rect x="${px}" y="${py}" width="${propCardW}" height="${PROP_THUMB_H}" rx="8"/></clipPath>`);
          p(`<image href="${dataUri}" x="${px}" y="${py}" width="${propCardW}" height="${PROP_THUMB_H}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`);
        } else {
          const fc = this._getAvatarColor(prop.address || prop.propertyId || "?");
          p(`<rect x="${px}" y="${py}" width="${propCardW}" height="${PROP_THUMB_H}" rx="8" fill="${fc}"/>`);
          const initial = (prop.unit || prop.propertyId || "?").toString().charAt(0).toUpperCase();
          p(`<text x="${px + propCardW / 2}" y="${py + PROP_THUMB_H / 2 + 4}" font-size="14" fill="#ffffff" font-weight="700" text-anchor="middle">${this._svgEsc(initial)}</text>`);
        }
        p(`<line x1="${px}" y1="${py + PROP_THUMB_H}" x2="${px + propCardW}" y2="${py + PROP_THUMB_H}" stroke="${DIVIDER}" stroke-width="1"/>`);

        // Property ID, overlaid top-left — plain white number, no badge/pill.
        // This is an internal reference only, so it's kept small and quiet
        // rather than drawing attention like the picker card's ID bubble.
        const idStr = this._svgTrunc((prop.propertyId || "").toString(), 3);
        const idX   = px + 8;
        const idY   = py + 16;
        p(`<text x="${idX + 1}" y="${idY + 1}" font-size="11" fill="#000000" fill-opacity="0.55" font-weight="700">${this._svgEsc(idStr)}</text>`);
        p(`<text x="${idX}" y="${idY}" font-size="11" fill="#ffffff" font-weight="700">${this._svgEsc(idStr)}</text>`);

        // Address + unit, below the photo
        const addrStr = this._svgTrunc(prop.address || prop.propertyId || "", addrMaxChars);
        p(`<text x="${px + propCardW / 2}" y="${py + PROP_THUMB_H + 13}" font-size="8.5" fill="${TEXT_HI}" font-weight="700" text-anchor="middle">${this._svgEsc(addrStr)}</text>`);
        if (prop.unit) {
          const unitStr = this._svgTrunc(prop.unit, unitMaxChars);
          p(`<text x="${px + propCardW / 2}" y="${py + PROP_THUMB_H + 24}" font-size="8" fill="${TEXT_MED}" text-anchor="middle">${this._svgEsc(unitStr)}</text>`);
        }
      });

      y = gridTop + propRows * propCardH + (propRows - 1) * PROP_GAP + 14;
    }

    const colTop = y;

    // ── Card height + renderer (parameterized by column x-offset) ───────
    const cardHeightOf = (settlement) => {
      const hasBreakdown = Array.isArray(settlement.propertyBreakdown) && settlement.propertyBreakdown.length > 0;
      const numProps     = hasBreakdown ? settlement.propertyBreakdown.length : 0;
      // The top amount badge is skipped when there's a breakdown — the dark
      // "Net Amount to Transfer" band at the bottom already shows this same
      // figure, so showing both was a confusing, duplicated red/green badge.
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

      // Card shell
      p(`<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="10" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="1.5"/>`);

      // ── Row 1: number badge + from (top line) / to (bottom line) ──────
      // Stacked instead of side-by-side so long investor names get the
      // full card width instead of being squeezed and cut off.
      const CHARS_PER_PX = 1 / 7; // matches this file's existing text-width estimate

      // From person (top line): number badge + avatar + name
      const y_from  = cardY + CARD_PAD_TOP + Math.floor(SUB_ROW_H / 2);
      const BADGE_R = 11;
      const badgeCx = INNER_L + BADGE_R;
      p(`<circle cx="${badgeCx}" cy="${y_from}" r="${BADGE_R}" fill="${ACCENT_PURPLE}"/>`);
      p(`<text x="${badgeCx}" y="${y_from + 4}" font-size="${index < 9 ? 11 : 9}" fill="#fff" font-weight="700" text-anchor="middle">${index + 1}</text>`);

      const FROM_R    = 12;
      const fromCx    = badgeCx + BADGE_R + 6 + FROM_R;
      renderCircleAvatar(settlement.fromAvatar, settlement.fromName, fromCx, y_from, FROM_R, ACCENT_RED_FILL);

      const fromNameX     = fromCx + FROM_R + 5;
      const fromMaxChars  = Math.max(10, Math.floor((INNER_R - fromNameX) * CHARS_PER_PX));
      const fromNameStr   = this._svgTrunc(settlement.fromName, fromMaxChars);
      p(`<text x="${fromNameX}" y="${y_from + 5}" font-size="12" fill="${ACCENT_RED}" font-weight="700">${this._svgEsc(fromNameStr)}</text>`);

      // To person (bottom line): down-arrow + avatar + name, indented under the badge
      const y_to = y_from + SUB_ROW_H + SUB_ROW_GAP;
      p(`<text x="${badgeCx}" y="${y_to + 5}" font-size="13" fill="${TEXT_LOW}" text-anchor="middle">&#x21B3;</text>`);

      const TO_R = 12;
      const toCx = fromCx; // align under the from-avatar
      renderCircleAvatar(settlement.toAvatar, settlement.toName, toCx, y_to, TO_R, ACCENT_GREEN_FILL);

      const toNameX    = fromNameX; // align under the from-name
      const toMaxChars = Math.max(10, Math.floor((INNER_R - toNameX) * CHARS_PER_PX));
      const toNameStr  = this._svgTrunc(settlement.toName, toMaxChars);
      p(`<text x="${toNameX}" y="${y_to + 5}" font-size="12" fill="${ACCENT_GREEN}" font-weight="700">${this._svgEsc(toNameStr)}</text>`);

      // ── Row 2: transfer amount badge (right-aligned) — only when there's
      // no breakdown to show it in; otherwise the dark "Net Amount to
      // Transfer" band below already shows this same figure, so showing
      // both was a confusing, duplicated red/green badge. ──
      if (!hasBreakdown) {
        const y_amt      = cardY + CARD_PAD_TOP + NAME_ROW_H + Math.floor(AMT_ROW_H / 2);
        const amtStr     = settlement.currency === "VND"
          ? `\u20ab${settlement.amount.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`
          : `$${settlement.amount.toFixed(2)}`;
        const amtBadgeW  = Math.max(78, amtStr.length * 8 + 16);
        const amtBadgeX  = INNER_R - amtBadgeW;
        const amtBadgeH  = 26;
        p(`<rect x="${amtBadgeX}" y="${y_amt - Math.floor(amtBadgeH / 2)}" width="${amtBadgeW}" height="${amtBadgeH}" rx="7" fill="url(#netAmountGradient)"/>`);
        p(`<text x="${amtBadgeX + amtBadgeW / 2}" y="${y_amt + 5}" font-size="14" fill="#ffffff" font-weight="800" text-anchor="middle">${this._svgEsc(amtStr)}</text>`);
      }

      // ── Property breakdown ────────────────────────────────────────────
      if (hasBreakdown) {
        let yi = cardY + CARD_PAD_TOP + NAME_ROW_H;

        // "Step-by-step calculation:" label
        p(`<text x="${INNER_L}" y="${yi + LABEL_ROW_H - 6}" font-size="8.5" fill="${TEXT_LOW}" font-weight="600" letter-spacing="0.5">STEP-BY-STEP CALCULATION</text>`);
        yi += LABEL_ROW_H;

        // Property rows
        settlement.propertyBreakdown.forEach((prop) => {
          const rowY       = yi;
          yi              += PROP_ROW_H;
          const propName   = this._svgTrunc(prop.propertyName || prop.propertyId, 50);
          p(`<text x="${INNER_L + 2}" y="${rowY + 15}" font-size="9.5" fill="${TEXT_MED}">${this._svgEsc(propName)}</text>`);

          const isNeg       = prop.amount < 0;
          const dispAmt     = Math.abs(prop.amount);
          const propAmtStr  = `${isNeg ? "+" : "-"}$${dispAmt.toFixed(2)}`;
          // Match UI: solid green for credit, solid red for payment out
          const propBg      = isNeg ? ACCENT_GREEN_FILL : ACCENT_RED_FILL;
          const iconChar    = isNeg ? "+" : "\u2212";
          const propBadgeH  = 20;
          const propBadgeW  = Math.max(76, propAmtStr.length * 7 + 28);
          const propBadgeX  = INNER_R - propBadgeW;
          const propBadgeCy = rowY + 2 + Math.floor(propBadgeH / 2);
          // Badge background
          p(`<rect x="${propBadgeX}" y="${rowY + 2}" width="${propBadgeW}" height="${propBadgeH}" rx="5" fill="${propBg}"/>`);
          // White circle icon with +/- inside (matching UI's bi-plus-circle-fill / bi-dash-circle-fill)
          const iconCx = propBadgeX + 11;
          p(`<circle cx="${iconCx}" cy="${propBadgeCy}" r="5.5" fill="#ffffff"/>`);
          p(`<text x="${iconCx}" y="${propBadgeCy + 3.5}" font-size="8" fill="${propBg}" font-weight="800" text-anchor="middle">${iconChar}</text>`);
          // Amount text (offset right of icon)
          const textCx = propBadgeX + 22 + (propBadgeW - 22) / 2;
          p(`<text x="${textCx}" y="${propBadgeCy + 3.5}" font-size="9.5" fill="#ffffff" font-weight="700" text-anchor="middle">${this._svgEsc(propAmtStr)}</text>`);
        });

        // Separator
        p(`<line x1="${INNER_L}" y1="${yi + 2}" x2="${INNER_R}" y2="${yi + 2}" stroke="${DIVIDER}" stroke-width="1"/>`);
        yi += SEP_H;

        // Net total row \u2014 plain text, no filled badge/band. The separator
        // line above is the only divider; the figure itself is just larger
        // and bolder so it still reads as the final answer.
        p(`<text x="${INNER_L + 2}" y="${yi + NET_ROW_H - 10}" font-size="12" fill="${TEXT_HI}" font-weight="700">Net Amount to Transfer</text>`);
        const netAmtStr  = settlement.currency === "VND"
          ? `\u20ab${settlement.amount.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}`
          : `$${settlement.amount.toFixed(2)}`;
        p(`<text x="${INNER_R - 2}" y="${yi + NET_ROW_H - 10}" font-size="21" fill="${TEXT_HI}" font-weight="800" text-anchor="end">${this._svgEsc(netAmtStr)}</text>`);
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

    // ── Summary (full width, only when multiple settlements) ────────────
    const fullCardX  = M + CARD_MX;
    const fullCardW  = TOTAL_W - 2 * (M + CARD_MX);
    const fullInnerL = fullCardX + 12;
    const fullInnerR = fullCardX + fullCardW - 12;
    if (settlements.length > 1) {
      const totalSGD  = settlements
        .filter((s) => s.currency !== "VND")
        .reduce((sum, s) => sum + s.amount, 0);
      const sumH      = 56;
      p(`<rect x="${fullCardX}" y="${y}" width="${fullCardW}" height="${sumH}" rx="8" fill="${CARD_BG_2}" stroke="${BORDER}" stroke-width="1"/>`);
      p(`<text x="${fullInnerL}" y="${y + 22}" font-size="10" fill="${TEXT_MED}" font-weight="600">Total Transactions:</text>`);
      p(`<text x="${fullInnerR}" y="${y + 22}" font-size="10" fill="${TEXT_HI}" font-weight="700" text-anchor="end">${settlements.length}</text>`);
      p(`<line x1="${fullInnerL}" y1="${y + 30}" x2="${fullInnerR}" y2="${y + 30}" stroke="${DIVIDER}" stroke-width="0.5"/>`);
      p(`<text x="${fullInnerL}" y="${y + 46}" font-size="10" fill="${TEXT_MED}" font-weight="600">Total Amount (SGD):</text>`);
      p(`<text x="${fullInnerR}" y="${y + 46}" font-size="12" fill="${ACCENT_GREEN}" font-weight="700" text-anchor="end">$${totalSGD.toFixed(2)}</text>`);
      y += sumH + 10;
    }

    // ── Footer (full width) ──────────────────────────────────────────────
    y += 8;
    p(`<text x="${TOTAL_W / 2}" y="${y + 12}" font-size="8.5" fill="${TEXT_LOW}" text-anchor="middle">Netted across all properties &#xB7; Amounts in SGD</text>`);
    y += 28;

    // ── Compose SVG ──────────────────────────────────────────────────────
    const H = y;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${TOTAL_W}" height="${H}" viewBox="0 0 ${TOTAL_W} ${H}" font-family="Noto Serif,serif">`,
      `<defs>${fontFaceStyle}${defs.join("")}</defs>`,
      `<rect x="0" y="0" width="${TOTAL_W}" height="${H}" fill="${PAGE_BG}"/>`,
      ...nodes,
      `</svg>`,
    ].join("");
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
