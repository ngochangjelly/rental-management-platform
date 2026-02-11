import i18next from "i18next";

/**
 * Investor Profit Report Component
 * Displays profit charts and detailed reports for multiple investors
 */
class investorProfitChartComponent {
  constructor() {
    this.investors = [];
    this.selectedInvestors = new Set(); // Support multiple investor selection
    this.profitDataMap = new Map(); // Map of investorId -> profit data
    this.isLoading = false;
    this.isLoadingData = false;
    this.chart = null;
    this.fullscreenChart = null;
    this.chartType = "bar"; // bar, line, doughnut
    this.expandedMonth = null; // Track which month detail is expanded

    // Color palette for investors
    this.investorColors = [
      { bg: "rgba(102, 126, 234, 0.7)", border: "rgba(102, 126, 234, 1)" },
      { bg: "rgba(40, 167, 69, 0.7)", border: "rgba(40, 167, 69, 1)" },
      { bg: "rgba(255, 193, 7, 0.7)", border: "rgba(255, 193, 7, 1)" },
      { bg: "rgba(220, 53, 69, 0.7)", border: "rgba(220, 53, 69, 1)" },
      { bg: "rgba(23, 162, 184, 0.7)", border: "rgba(23, 162, 184, 1)" },
      { bg: "rgba(118, 75, 162, 0.7)", border: "rgba(118, 75, 162, 1)" },
      { bg: "rgba(255, 87, 51, 0.7)", border: "rgba(255, 87, 51, 1)" },
      { bg: "rgba(108, 117, 125, 0.7)", border: "rgba(108, 117, 125, 1)" },
    ];

    // Default to last 6 months
    const now = new Date();
    this.endYear = now.getFullYear();
    this.endMonth = now.getMonth() + 1;

    // Calculate start date (6 months ago)
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    this.startYear = startDate.getFullYear();
    this.startMonth = startDate.getMonth() + 1;

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    this.loadInvestors();
    this.bindEvents();
  }

  /**
   * Bind events
   */
  bindEvents() {
    // Events will be bound after render
  }

  /**
   * Load investors list
   */
  async loadInvestors() {
    try {
      this.isLoading = true;
      this.renderInvestorList();

      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();

      if (result.success) {
        this.investors = result.data || [];
      } else {
        this.investors = [];
      }
    } catch (error) {
      console.error("Error loading investors:", error);
      this.investors = [];
    } finally {
      this.isLoading = false;
      this.renderInvestorList();
    }
  }

  /**
   * Get color for investor by index
   */
  getInvestorColor(investorId) {
    const selectedArray = Array.from(this.selectedInvestors);
    const index = selectedArray.indexOf(investorId);
    return this.investorColors[index % this.investorColors.length];
  }

  /**
   * Render investor selection cards
   */
  renderInvestorList() {
    const container = document.getElementById(
      "investorProfitChartInvestorList",
    );
    if (!container) return;

    if (this.isLoading) {
      container.innerHTML = `
        <div class="col-12 text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">${i18next.t("investorProfitChart.loading", "Loading...")}</span>
          </div>
        </div>
      `;
      return;
    }

    if (!this.investors || this.investors.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center text-muted py-4">
          <i class="bi bi-person-x me-2"></i>
          ${i18next.t("investorProfitChart.noInvestors", "No investors found")}
        </div>
      `;
      return;
    }

    container.innerHTML = this.investors
      .map((investor, index) => {
        const isSelected = this.selectedInvestors.has(investor.investorId);
        const propertyCount = investor.properties?.length || 0;
        const avatarUrl = investor.avatar
          ? ImageUtils.getOptimizedImageUrl(investor.avatar, "small")
          : null;
        const color = isSelected
          ? this.getInvestorColor(investor.investorId)
          : null;

        return `
          <div class="col-6 col-sm-4 col-md-3 col-lg-2 investor-card-col mb-3">
            <div
              class="card investor-select-card h-100 ${isSelected ? "selected" : ""}"
              data-investor-id="${investor.investorId}"
              data-investor-index="${index}"
              style="cursor: pointer; transition: all 0.2s ease; ${isSelected ? `border-color: ${color.border}; border-width: 3px;` : ""}"
            >
              <div class="card-body text-center p-3">
                <div class="position-relative d-inline-block mb-2">
                  ${
                    avatarUrl
                      ? `<img src="${avatarUrl}" class="rounded-circle" style="width: 60px; height: 60px; object-fit: cover; ${isSelected ? `box-shadow: 0 0 0 3px ${color.border};` : ""}" alt="${this.escapeHtml(investor.name)}">`
                      : `<div class="rounded-circle text-white d-flex align-items-center justify-content-center" style="width: 60px; height: 60px; font-size: 1.5rem; background-color: ${isSelected ? color.border : "#667eea"};">${this.getInitials(investor.name)}</div>`
                  }
                  ${
                    isSelected
                      ? `
                    <div class="position-absolute bottom-0 end-0">
                      <div class="text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 20px; height: 20px; background-color: ${color.border};">
                        <i class="bi bi-check-lg" style="font-size: 0.7rem;"></i>
                      </div>
                    </div>
                  `
                      : ""
                  }
                </div>
                <h6 class="card-title mb-1 text-truncate">${this.escapeHtml(investor.name)}</h6>
                <small class="text-muted">
                  <i class="bi bi-building me-1"></i>${propertyCount} ${i18next.t("investorProfitChart.properties", "properties")}
                </small>
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    // Update selection count
    this.updateSelectionCount();
    this.bindInvestorCardEvents();
  }

  /**
   * Update the selection count display
   */
  updateSelectionCount() {
    const countEl = document.getElementById("investorProfitSelectedCount");
    if (countEl) {
      const count = this.selectedInvestors.size;
      countEl.textContent = `${count} ${
        count === 1
          ? i18next.t(
              "investorProfitChart.investorSelected",
              "investor selected",
            )
          : i18next.t(
              "investorProfitChart.investorsSelected",
              "investors selected",
            )
      }`;
    }
  }

  /**
   * Get initials from name
   */
  getInitials(name) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  }

  /**
   * Bind click events to investor cards
   */
  bindInvestorCardEvents() {
    const cards = document.querySelectorAll(
      "#investorProfitChartInvestorList .investor-select-card",
    );
    cards.forEach((card) => {
      card.addEventListener("click", (e) => {
        const investorId = card.dataset.investorId;
        this.toggleInvestorSelection(investorId);
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
  }

  /**
   * Toggle investor selection
   */
  toggleInvestorSelection(investorId) {
    if (this.selectedInvestors.has(investorId)) {
      this.selectedInvestors.delete(investorId);
      this.profitDataMap.delete(investorId);
    } else {
      this.selectedInvestors.add(investorId);
    }

    this.expandedMonth = null;
    this.renderInvestorList();
    this.loadProfitData();
  }

  /**
   * Select all investors
   */
  selectAllInvestors() {
    this.investors.forEach((investor) => {
      this.selectedInvestors.add(investor.investorId);
    });
    this.renderInvestorList();
    this.loadProfitData();
  }

  /**
   * Deselect all investors
   */
  deselectAllInvestors() {
    this.selectedInvestors.clear();
    this.profitDataMap.clear();
    this.renderInvestorList();
    this.renderChartArea();
    this.renderMonthlyDetails();
  }

  /**
   * Load profit data for all selected investors
   */
  async loadProfitData() {
    if (this.selectedInvestors.size === 0) {
      this.profitDataMap.clear();
      this.renderChartArea();
      this.renderMonthlyDetails();
      return;
    }

    try {
      this.isLoadingData = true;
      this.renderChartArea();

      // Fetch data for investors that don't have data yet
      const fetchPromises = [];
      for (const investorId of this.selectedInvestors) {
        if (!this.profitDataMap.has(investorId)) {
          const endpoint = API_CONFIG.ENDPOINTS.INVESTOR_PROFIT_REPORT(
            investorId,
            this.startYear,
            this.startMonth,
            this.endYear,
            this.endMonth,
          );
          fetchPromises.push(
            API.get(endpoint)
              .then((res) => res.json())
              .then((result) => ({ investorId, result }))
              .catch((error) => ({ investorId, error })),
          );
        }
      }

      const results = await Promise.all(fetchPromises);

      for (const { investorId, result, error } of results) {
        if (error) {
          console.error(
            `Error loading profit data for investor ${investorId}:`,
            error,
          );
          continue;
        }
        if (result.success) {
          this.profitDataMap.set(investorId, result.data);
        }
      }
    } catch (error) {
      console.error("Error loading profit data:", error);
    } finally {
      this.isLoadingData = false;
      this.renderChartArea();
      this.renderChart();
      this.renderMonthlyDetails();
    }
  }

  /**
   * Handle date filter change
   */
  handleDateFilterChange() {
    const startYearInput = document.getElementById("investorProfitStartYear");
    const startMonthInput = document.getElementById("investorProfitStartMonth");
    const endYearInput = document.getElementById("investorProfitEndYear");
    const endMonthInput = document.getElementById("investorProfitEndMonth");

    if (startYearInput && startMonthInput && endYearInput && endMonthInput) {
      this.startYear = parseInt(startYearInput.value) || this.startYear;
      this.startMonth = parseInt(startMonthInput.value) || this.startMonth;
      this.endYear = parseInt(endYearInput.value) || this.endYear;
      this.endMonth = parseInt(endMonthInput.value) || this.endMonth;

      // Clear cached data and reload
      this.profitDataMap.clear();
      if (this.selectedInvestors.size > 0) {
        this.loadProfitData();
      }
    }
  }

  /**
   * Handle chart type change
   */
  handleChartTypeChange(type) {
    this.chartType = type;
    this.updateChartTypeButtons();
    this.renderChart();
  }

  /**
   * Update chart type button styles
   */
  updateChartTypeButtons() {
    const buttons = document.querySelectorAll(".chart-type-btn");
    buttons.forEach((btn) => {
      if (btn.dataset.chartType === this.chartType) {
        btn.classList.remove("btn-outline-primary");
        btn.classList.add("btn-primary");
      } else {
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-outline-primary");
      }
    });
  }

  /**
   * Render the chart area
   */
  renderChartArea() {
    const container = document.getElementById("investorProfitChartContainer");
    if (!container) return;

    if (this.selectedInvestors.size === 0) {
      container.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="bi bi-graph-up fs-1 mb-3 d-block"></i>
          <p>${i18next.t("investorProfitChart.selectInvestorToView", "Select an investor to view profit report")}</p>
        </div>
      `;
      return;
    }

    if (this.isLoadingData) {
      container.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">${i18next.t("investorProfitChart.loadingData", "Loading data...")}</span>
          </div>
          <p class="mt-3 text-muted">${i18next.t("investorProfitChart.loadingProfitData", "Loading profit data...")}</p>
        </div>
      `;
      return;
    }

    // Check if we have any data
    let hasData = false;
    for (const data of this.profitDataMap.values()) {
      if (data && data.monthlyProfits && data.monthlyProfits.length > 0) {
        hasData = true;
        break;
      }
    }

    if (!hasData) {
      container.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="bi bi-inbox fs-1 mb-3 d-block"></i>
          <p>${i18next.t("investorProfitChart.noDataForPeriod", "No profit data available for the selected period")}</p>
        </div>
      `;
      return;
    }

    // Render chart canvas
    container.innerHTML = `
      <div class="chart-wrapper" style="position: relative; height: 350px;">
        <canvas id="investorProfitChart"></canvas>
      </div>
    `;
  }

  /**
   * Get all unique month labels from all investors' data
   */
  getAllMonthLabels() {
    const monthSet = new Set();
    const monthNames =
      i18next.language === "vi"
        ? [
            "Th1",
            "Th2",
            "Th3",
            "Th4",
            "Th5",
            "Th6",
            "Th7",
            "Th8",
            "Th9",
            "Th10",
            "Th11",
            "Th12",
          ]
        : [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];

    for (const data of this.profitDataMap.values()) {
      if (data && data.monthlyProfits) {
        for (const m of data.monthlyProfits) {
          monthSet.add(`${m.year}-${String(m.month).padStart(2, "0")}`);
        }
      }
    }

    return Array.from(monthSet)
      .sort()
      .map((key) => {
        const [year, month] = key.split("-");
        return {
          key,
          label: `${monthNames[parseInt(month) - 1]} ${year}`,
          year: parseInt(year),
          month: parseInt(month),
        };
      });
  }

  /**
   * Render the chart using Chart.js
   */
  renderChart() {
    if (this.profitDataMap.size === 0) return;

    const canvas = document.getElementById("investorProfitChart");
    if (!canvas) return;

    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const ctx = canvas.getContext("2d");
    const allMonths = this.getAllMonthLabels();

    if (allMonths.length === 0) return;

    const labels = allMonths.map((m) => m.label);

    // Build datasets for each selected investor
    const datasets = [];
    const selectedArray = Array.from(this.selectedInvestors);

    for (let i = 0; i < selectedArray.length; i++) {
      const investorId = selectedArray[i];
      const data = this.profitDataMap.get(investorId);
      const investor = this.investors.find(
        (inv) => inv.investorId === investorId,
      );
      const color = this.investorColors[i % this.investorColors.length];

      if (!data || !data.monthlyProfits) continue;

      // Create a map for quick lookup
      const profitMap = new Map();
      for (const m of data.monthlyProfits) {
        const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
        profitMap.set(key, m.sgdProfit || m.totalProfit);
      }

      // Build data array aligned with labels
      const profitValues = allMonths.map((m) => profitMap.get(m.key) || 0);

      if (this.chartType === "bar") {
        // Add bar dataset
        datasets.push({
          label: investor?.name || investorId,
          data: profitValues,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1,
          maxBarThickness: 50,
          order: 2, // Bars render behind line
        });
        // Add trend line for this investor
        datasets.push({
          label: `${investor?.name || investorId} (Trend)`,
          data: profitValues,
          type: "line",
          borderColor: color.border,
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          order: 1, // Line renders on top of bars
        });
      } else if (this.chartType === "line") {
        datasets.push({
          label: investor?.name || investorId,
          data: profitValues,
          borderColor: color.border,
          backgroundColor: color.bg.replace("0.7", "0.1"),
          fill: false,
          tension: 0.4,
          pointBackgroundColor: color.border,
          pointBorderColor: color.border,
          pointRadius: 5,
          pointHoverRadius: 7,
        });
      }
    }

    // Chart configuration based on type
    let chartConfig;

    // Custom plugin to display data labels on top of bars
    const dataLabelsPlugin = {
      id: "dataLabels",
      afterDatasetsDraw: (chart) => {
        if (this.chartType !== "bar") return;

        const ctx = chart.ctx;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          // Skip trend line datasets
          if (dataset.label.includes("(Trend)")) return;

          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach((bar, index) => {
            const value = dataset.data[index];
            if (value === 0) return;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.font = "bold 11px sans-serif";
            ctx.fillStyle = value >= 0 ? "#198754" : "#dc3545";

            const text = `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(0)}`;
            const x = bar.x;
            const y = bar.y - 5;

            ctx.fillText(text, x, y);
            ctx.restore();
          });
        });
      },
    };

    if (this.chartType === "bar" || this.chartType === "line") {
      chartConfig = {
        type: this.chartType,
        data: { labels, datasets },
        plugins: [dataLabelsPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements.length > 0) {
              const index = elements[0].index;
              this.toggleMonthDetail(index);
            }
          },
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: {
                filter: (item) => !item.text.includes("(Trend)"),
              },
            },
            tooltip: {
              filter: (item) => !item.dataset.label.includes("(Trend)"),
              callbacks: {
                label: (context) => {
                  const value = context.raw;
                  return `${context.dataset.label}: ${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
                },
              },
            },
          },
          scales: {
            x: {
              title: {
                display: true,
                text: `${this.startMonth}/${this.startYear} - ${this.endMonth}/${this.endYear}`,
                font: {
                  size: 12,
                  weight: "normal",
                },
                color: "#6c757d",
              },
            },
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => `$${value}`,
              },
            },
          },
        },
      };
    } else if (this.chartType === "doughnut") {
      // For doughnut, show total profit by investor for the selected period
      const investorTotals = [];
      for (let i = 0; i < selectedArray.length; i++) {
        const investorId = selectedArray[i];
        const data = this.profitDataMap.get(investorId);
        const investor = this.investors.find(
          (inv) => inv.investorId === investorId,
        );

        if (!data || !data.monthlyProfits) continue;

        const totalProfit = data.monthlyProfits.reduce(
          (sum, m) => sum + (m.sgdProfit || m.totalProfit),
          0,
        );

        investorTotals.push({
          label: investor?.name || investorId,
          profit: totalProfit,
          color: this.investorColors[i % this.investorColors.length],
        });
      }

      chartConfig = {
        type: "doughnut",
        data: {
          labels: investorTotals.map((i) => i.label),
          datasets: [
            {
              data: investorTotals.map((i) => Math.abs(i.profit)),
              backgroundColor: investorTotals.map((i) => i.color.bg),
              borderColor: investorTotals.map((i) => i.color.border),
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: {
                boxWidth: 12,
                padding: 10,
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = investorTotals[context.dataIndex].profit;
                  return `${context.label}: ${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
                },
              },
            },
          },
        },
      };
    }

    this.chart = new Chart(ctx, chartConfig);
  }

  /**
   * Toggle month detail expansion
   */
  toggleMonthDetail(index) {
    if (this.expandedMonth === index) {
      this.expandedMonth = null;
    } else {
      this.expandedMonth = index;
    }
    this.renderMonthlyDetails();
  }

  /**
   * Render monthly details section
   */
  renderMonthlyDetails() {
    const container = document.getElementById("investorProfitMonthlyDetails");
    if (!container) return;

    if (this.profitDataMap.size === 0) {
      container.innerHTML = "";
      return;
    }

    const allMonths = this.getAllMonthLabels();
    if (allMonths.length === 0) {
      container.innerHTML = "";
      return;
    }

    const monthNames =
      i18next.language === "vi"
        ? [
            "Tháng 1",
            "Tháng 2",
            "Tháng 3",
            "Tháng 4",
            "Tháng 5",
            "Tháng 6",
            "Tháng 7",
            "Tháng 8",
            "Tháng 9",
            "Tháng 10",
            "Tháng 11",
            "Tháng 12",
          ]
        : [
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

    container.innerHTML = `
      <h6 class="mb-3">
        <i class="bi bi-calendar3 me-2"></i>
        ${i18next.t("investorProfitChart.monthlyBreakdown", "Monthly Breakdown")}
      </h6>
      <div class="accordion" id="monthlyProfitAccordion">
        ${allMonths
          .map((month, index) => {
            const isExpanded = this.expandedMonth === index;

            // Calculate total profit across all investors for this month
            let totalProfit = 0;
            const investorProfits = [];

            for (const [investorId, data] of this.profitDataMap) {
              if (!data || !data.monthlyProfits) continue;
              const monthData = data.monthlyProfits.find(
                (m) => m.year === month.year && m.month === month.month,
              );
              if (monthData) {
                const profit = monthData.sgdProfit || monthData.totalProfit;
                totalProfit += profit;
                const investor = this.investors.find(
                  (i) => i.investorId === investorId,
                );
                investorProfits.push({
                  investorId,
                  name: investor?.name || investorId,
                  profit,
                  properties: monthData.properties,
                  color: this.getInvestorColor(investorId),
                });
              }
            }

            const profitClass =
              totalProfit >= 0 ? "text-success" : "text-danger";
            const profitIcon =
              totalProfit >= 0 ? "bi-arrow-up-circle" : "bi-arrow-down-circle";

            return `
              <div class="accordion-item">
                <h2 class="accordion-header">
                  <button class="accordion-button ${isExpanded ? "" : "collapsed"}" type="button"
                    onclick="investorProfitChart.toggleMonthDetail(${index})">
                    <div class="d-flex justify-content-between align-items-center w-100 me-3">
                      <span>
                        <i class="bi bi-calendar-event me-2"></i>
                        ${monthNames[month.month - 1]} ${month.year}
                      </span>
                      <span class="${profitClass} fw-bold">
                        <i class="bi ${profitIcon} me-1"></i>
                        ${totalProfit >= 0 ? "+" : ""}$${totalProfit.toFixed(2)}
                      </span>
                    </div>
                  </button>
                </h2>
                <div class="accordion-collapse collapse ${isExpanded ? "show" : ""}">
                  <div class="accordion-body">
                    ${this.renderMultiInvestorDetails(investorProfits)}
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  /**
   * Render details for multiple investors in a month
   */
  renderMultiInvestorDetails(investorProfits) {
    if (!investorProfits || investorProfits.length === 0) {
      return `<p class="text-muted mb-0">${i18next.t("investorProfitChart.noData", "No data")}</p>`;
    }

    return investorProfits
      .map((inv) => {
        const profitClass = inv.profit >= 0 ? "text-success" : "text-danger";

        return `
          <div class="mb-4">
            <div class="d-flex align-items-center mb-3 pb-2 border-bottom">
              <div class="rounded-circle me-2" style="width: 12px; height: 12px; background-color: ${inv.color.border};"></div>
              <h6 class="mb-0 flex-grow-1">${this.escapeHtml(inv.name)}</h6>
              <span class="${profitClass} fw-bold">
                ${inv.profit >= 0 ? "+" : ""}$${inv.profit.toFixed(2)}
              </span>
            </div>
            ${this.renderPropertyDetails(inv.properties)}
          </div>
        `;
      })
      .join("");
  }

  /**
   * Render property details for a month
   */
  renderPropertyDetails(properties) {
    if (!properties || properties.length === 0) {
      return `<p class="text-muted mb-0 small">${i18next.t("investorProfitChart.noProperties", "No property data")}</p>`;
    }

    return `
      <div class="row g-3">
        ${properties
          .map((prop) => {
            const profitClass =
              prop.sgdProfit >= 0 ? "text-success" : "text-danger";
            const imageUrl = prop.propertyImage
              ? ImageUtils.getOptimizedImageUrl(prop.propertyImage, "medium")
              : null;

            return `
              <div class="col-12 col-md-6">
                <div class="card h-100 border">
                  <div class="row g-0">
                    <div class="col-4">
                      ${
                        imageUrl
                          ? `<img src="${imageUrl}" class="img-fluid rounded-start h-100" style="object-fit: cover; min-height: 120px;" alt="${this.escapeHtml(prop.propertyId)}">`
                          : `<div class="bg-light d-flex align-items-center justify-content-center h-100 rounded-start" style="min-height: 120px;">
                            <i class="bi bi-building fs-1 text-muted"></i>
                          </div>`
                      }
                    </div>
                    <div class="col-8">
                      <div class="card-body py-2 px-3">
                        <h6 class="card-title mb-1">${this.escapeHtml(prop.propertyId)}</h6>
                        <p class="card-text small text-muted mb-2">
                          <i class="bi bi-geo-alt me-1"></i>${this.escapeHtml(prop.address || "N/A")}
                          ${prop.unit ? `<br><i class="bi bi-door-open me-1"></i>${this.escapeHtml(prop.unit)}` : ""}
                        </p>
                        <div class="d-flex justify-content-between align-items-center">
                          <small class="text-muted">
                            ${i18next.t("investorProfitChart.ownership", "Ownership")}: ${prop.percentage}%
                          </small>
                          <span class="${profitClass} fw-bold">
                            ${prop.sgdProfit >= 0 ? "+" : ""}$${prop.sgdProfit.toFixed(2)}
                          </span>
                        </div>
                        <div class="mt-2 pt-2 border-top">
                          <div class="row text-center small">
                            <div class="col-4">
                              <div class="text-success">$${prop.totalIncome.toFixed(0)}</div>
                              <div class="text-muted">${i18next.t("investorProfitChart.income", "Income")}</div>
                            </div>
                            <div class="col-4">
                              <div class="text-danger">$${prop.totalExpenses.toFixed(0)}</div>
                              <div class="text-muted">${i18next.t("investorProfitChart.expenses", "Expenses")}</div>
                            </div>
                            <div class="col-4">
                              <div class="${prop.netProfit >= 0 ? "text-success" : "text-danger"}">$${prop.netProfit.toFixed(0)}</div>
                              <div class="text-muted">${i18next.t("investorProfitChart.net", "Net")}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Open fullscreen chart modal
   */
  openFullscreenChart() {
    if (this.profitDataMap.size === 0) {
      return;
    }

    const modal = new bootstrap.Modal(
      document.getElementById("fullscreenChartModal"),
    );
    modal.show();

    // Render chart after modal is shown
    const modalEl = document.getElementById("fullscreenChartModal");
    modalEl.addEventListener(
      "shown.bs.modal",
      () => {
        this.renderFullscreenChart();
      },
      { once: true },
    );

    // Destroy fullscreen chart when modal is hidden
    modalEl.addEventListener(
      "hidden.bs.modal",
      () => {
        if (this.fullscreenChart) {
          this.fullscreenChart.destroy();
          this.fullscreenChart = null;
        }
      },
      { once: true },
    );
  }

  /**
   * Render chart in fullscreen modal
   */
  renderFullscreenChart() {
    const canvas = document.getElementById("fullscreenProfitChart");
    if (!canvas) return;

    // Destroy existing fullscreen chart
    if (this.fullscreenChart) {
      this.fullscreenChart.destroy();
      this.fullscreenChart = null;
    }

    const ctx = canvas.getContext("2d");
    const allMonths = this.getAllMonthLabels();

    if (allMonths.length === 0) return;

    const labels = allMonths.map((m) => m.label);

    // Build datasets for each selected investor
    const datasets = [];
    const selectedArray = Array.from(this.selectedInvestors);

    for (let i = 0; i < selectedArray.length; i++) {
      const investorId = selectedArray[i];
      const data = this.profitDataMap.get(investorId);
      const investor = this.investors.find(
        (inv) => inv.investorId === investorId,
      );
      const color = this.investorColors[i % this.investorColors.length];

      if (!data || !data.monthlyProfits) continue;

      // Create a map for quick lookup
      const profitMap = new Map();
      for (const m of data.monthlyProfits) {
        const key = `${m.year}-${String(m.month).padStart(2, "0")}`;
        profitMap.set(key, m.sgdProfit || m.totalProfit);
      }

      // Build data array aligned with labels
      const profitValues = allMonths.map((m) => profitMap.get(m.key) || 0);

      if (this.chartType === "bar") {
        // Add bar dataset
        datasets.push({
          label: investor?.name || investorId,
          data: profitValues,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 1,
          maxBarThickness: 80,
          order: 2,
        });
        // Add trend line for this investor
        datasets.push({
          label: `${investor?.name || investorId} (Trend)`,
          data: profitValues,
          type: "line",
          borderColor: color.border,
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          order: 1,
        });
      } else if (this.chartType === "line") {
        datasets.push({
          label: investor?.name || investorId,
          data: profitValues,
          borderColor: color.border,
          backgroundColor: color.bg.replace("0.7", "0.1"),
          fill: false,
          tension: 0.4,
          pointBackgroundColor: color.border,
          pointBorderColor: color.border,
          pointRadius: 6,
          pointHoverRadius: 8,
        });
      }
    }

    // Custom plugin for data labels in fullscreen
    const dataLabelsPlugin = {
      id: "fullscreenDataLabels",
      afterDatasetsDraw: (chart) => {
        if (this.chartType !== "bar") return;

        const ctx = chart.ctx;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          // Skip trend line datasets
          if (dataset.label.includes("(Trend)")) return;

          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach((bar, index) => {
            const value = dataset.data[index];
            if (value === 0) return;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.font = "bold 14px sans-serif";
            ctx.fillStyle = value >= 0 ? "#198754" : "#dc3545";

            const text = `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(0)}`;
            const x = bar.x;
            const y = bar.y - 8;

            ctx.fillText(text, x, y);
            ctx.restore();
          });
        });
      },
    };

    let chartConfig;

    if (this.chartType === "bar" || this.chartType === "line") {
      chartConfig = {
        type: this.chartType,
        data: { labels, datasets },
        plugins: [dataLabelsPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: "top",
              labels: {
                font: { size: 14 },
                filter: (item) => !item.text.includes("(Trend)"),
              },
            },
            tooltip: {
              filter: (item) => !item.dataset.label.includes("(Trend)"),
              callbacks: {
                label: (context) => {
                  const value = context.raw;
                  return `${context.dataset.label}: ${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
                },
              },
            },
          },
          scales: {
            x: {
              title: {
                display: true,
                text: `${this.startMonth}/${this.startYear} - ${this.endMonth}/${this.endYear}`,
                font: { size: 14 },
                color: "#6c757d",
              },
              ticks: {
                font: { size: 12 },
              },
            },
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => `$${value}`,
                font: { size: 12 },
              },
            },
          },
        },
      };
    } else if (this.chartType === "doughnut") {
      const investorTotals = [];
      for (let i = 0; i < selectedArray.length; i++) {
        const investorId = selectedArray[i];
        const data = this.profitDataMap.get(investorId);
        const investor = this.investors.find(
          (inv) => inv.investorId === investorId,
        );

        if (!data || !data.monthlyProfits) continue;

        const totalProfit = data.monthlyProfits.reduce(
          (sum, m) => sum + (m.sgdProfit || m.totalProfit),
          0,
        );

        investorTotals.push({
          label: investor?.name || investorId,
          profit: totalProfit,
          color: this.investorColors[i % this.investorColors.length],
        });
      }

      chartConfig = {
        type: "doughnut",
        data: {
          labels: investorTotals.map((i) => i.label),
          datasets: [
            {
              data: investorTotals.map((i) => Math.abs(i.profit)),
              backgroundColor: investorTotals.map((i) => i.color.bg),
              borderColor: investorTotals.map((i) => i.color.border),
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "right",
              labels: {
                boxWidth: 16,
                padding: 16,
                font: { size: 14 },
              },
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = investorTotals[context.dataIndex].profit;
                  return `${context.label}: ${value >= 0 ? "+" : ""}$${value.toFixed(2)}`;
                },
              },
            },
          },
        },
      };
    }

    this.fullscreenChart = new Chart(ctx, chartConfig);
  }

  /**
   * Refresh data
   */
  refresh() {
    this.loadInvestors();
  }
}

// Global initialization
const investorProfitChart = new investorProfitChartComponent();
window.investorProfitChart = investorProfitChart;
