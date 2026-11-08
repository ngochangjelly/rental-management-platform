import i18next, { onLanguageChange } from "../i18n.js";
import { renderPropertyImageAvatarBadge } from "../utils/investor-avatar-stack.js";

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

    // Property view: one property at a time, its whole monthly profit
    this.view = this._load("iprView") === "property" ? "property" : "investors";
    this.properties = [];
    this.propertiesLoading = false;
    this.propertiesError = null;
    this._propertiesRequested = false;
    this.propertySearch = "";
    this.selectedPropertyId = null;
    this.propertyReports = new Map(); // propertyId -> financial reports
    this.propertyReportsLoading = false;
    this.propertyReportsError = null;
    this._propertyRequestSeq = 0;
    this._shownPropertyId = null;
    this.propertyChart = null;
    this.propertyChartType = "bar"; // bar | line
    // Property view starts at the property's first month; a start picked by
    // hand sticks until another property is chosen: { propertyId, key }
    this.propertyStartOverride = null;

    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    // Investors load on first open of the section (see ensureInvestorsLoaded)
    this.bindEvents();
    onLanguageChange(() => this.handleLanguageChange());
  }

  // Language switched: redraw from the data already loaded
  handleLanguageChange() {
    if (this._propertiesRequested) {
      this.renderPropertyList();
      this.renderPropertyView();
    }
    if (!this._investorsRequested) return;
    this.renderInvestorList();
    this.updateSelectionCount();
    if (this.isLoadingData) return; // the running load renders when it finishes
    this.renderChartArea();
    this.renderChart();
    this.renderMonthlyDetails();
    this.renderSummaryStats();
  }

  /** Called by the dashboard controller each time the section opens. */
  ensureInvestorsLoaded() {
    this.syncYearOptions();
    this.setView(this.view);
  }

  /** Switch between the investor and the property view. */
  setView(view) {
    this.view = view === "property" ? "property" : "investors";
    this._store("iprView", this.view);

    const section = document.getElementById("investor-profit-report-section");
    if (section) {
      section.querySelectorAll("[data-ipr-pane]").forEach((el) => {
        el.hidden = el.dataset.iprPane !== this.view;
      });
      section.querySelectorAll(".ipr-view-tab").forEach((tab) => {
        const active = tab.dataset.iprView === this.view;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      // Doughnut compares investors; one property has nothing to split
      const doughnut = section.querySelector(
        '.chart-type-btn[data-chart-type="doughnut"]',
      );
      if (doughnut) doughnut.hidden = this.view === "property";
    }
    this.updateChartTypeButtons();
    this.syncPeriodInputs();

    if (this.view === "property") {
      this.ensurePropertiesLoaded();
      this.renderPropertyView();
    } else if (!this._investorsRequested) {
      this._investorsRequested = true;
      this.loadInvestors();
    } else {
      this.renderChart(); // it may have been drawn while hidden
    }
  }

  // Year pickers cover 2023 → this year (and any year already chosen)
  syncYearOptions() {
    const propertyStartYear = this.selectedPropertyId
      ? Math.floor(this.getPropertyStartKey() / 12)
      : this.startYear;
    const first = Math.min(2023, this.startYear, this.endYear, propertyStartYear);
    const last = Math.max(new Date().getFullYear(), this.startYear, this.endYear);
    ["investorProfitStartYear", "investorProfitEndYear"].forEach((id) => {
      const select = document.getElementById(id);
      if (!select) return;
      const years = Array.from(select.options).map((o) => Number(o.value));
      if (years[0] === first && years[years.length - 1] === last && years.length === last - first + 1) return;
      const value = select.value;
      select.innerHTML = Array.from({ length: last - first + 1 }, (_, i) => first + i)
        .map((y) => `<option value="${y}">${y}</option>`)
        .join("");
      select.value = value;
    });
  }

  _load(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  _store(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // storage unavailable (private mode) — nothing to remember
    }
  }

  /** Whether year/month falls inside the chosen date range. */
  isInRange(year, month) {
    const k = year * 12 + month - 1;
    return (
      k >= this.startYear * 12 + this.startMonth - 1 &&
      k <= this.endYear * 12 + this.endMonth - 1
    );
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
    // Handle case when investor not found (-1 index)
    const colorIndex = index >= 0 ? index % this.investorColors.length : 0;
    return this.investorColors[colorIndex];
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
          <div
            class="ipr-investor-card ${isSelected ? "selected" : ""}"
            data-investor-id="${investor.investorId}"
            data-investor-index="${index}"
            title="${this.escapeHtml(investor.name)} · ${propertyCount} ${i18next.t("investorProfitChart.properties", "properties")}"
            style="${isSelected ? `border-color: ${color.border}; background: ${color.bg.replace("0.7", "0.12")};` : ""}"
          >
            ${
              avatarUrl
                ? `<img src="${avatarUrl}" class="ipr-investor-avatar" alt="${this.escapeHtml(investor.name)}">`
                : `<div class="ipr-investor-avatar ipr-investor-initials" style="${isSelected ? `background:${color.border};` : ""}">${this.getInitials(investor.name)}</div>`
            }
            <span class="ipr-investor-name">${this.escapeHtml(investor.name)}</span>
            <span class="ipr-investor-count">${propertyCount}</span>
            ${isSelected ? `<i class="bi bi-check-lg ipr-investor-check" style="color:${color.border};"></i>` : ""}
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
      "#investorProfitChartInvestorList .ipr-investor-card",
    );
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        const investorId = card.dataset.investorId;
        this.toggleInvestorSelection(investorId);
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
    this.renderSummaryStats();
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
          const data = result.data || {};
          // The API returns the whole year when start and end share a year
          data.monthlyProfits = (data.monthlyProfits || []).filter((m) =>
            this.isInRange(m.year, m.month),
          );
          this.profitDataMap.set(investorId, data);
        }
      }
    } catch (error) {
      console.error("Error loading profit data:", error);
    } finally {
      this.isLoadingData = false;
      this.renderChartArea();
      this.renderChart();
      this.renderMonthlyDetails();
      this.renderSummaryStats();
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
      const endYear = parseInt(endYearInput.value) || this.endYear;
      const endMonth = parseInt(endMonthInput.value) || this.endMonth;

      // Property tab: the start belongs to this property only
      if (this.view === "property" && this.selectedPropertyId) {
        const sy = parseInt(startYearInput.value);
        const sm = parseInt(startMonthInput.value);
        if (sy && sm) {
          const key = sy * 12 + sm - 1;
          this.propertyStartOverride =
            key === this.getPropertyAutoStartKey()
              ? null
              : { propertyId: this.selectedPropertyId, key };
        }
        const endChanged = endYear !== this.endYear || endMonth !== this.endMonth;
        this.endYear = endYear;
        this.endMonth = endMonth;
        if (endChanged) {
          this.profitDataMap.clear();
          if (this.selectedInvestors.size > 0) this.loadProfitData();
        }
        this.renderPropertyView();
        return;
      }

      this.startYear = parseInt(startYearInput.value) || this.startYear;
      this.startMonth = parseInt(startMonthInput.value) || this.startMonth;
      this.endYear = endYear;
      this.endMonth = endMonth;

      // Clear cached data and reload
      this.profitDataMap.clear();
      if (this.selectedInvestors.size > 0) {
        this.loadProfitData();
      }
      // Property view already holds every report; just redraw
      if (this._propertiesRequested) this.renderPropertyView();
    }
  }

  /**
   * Handle chart type change
   */
  handleChartTypeChange(type) {
    if (this.view === "property") {
      if (type === "doughnut") return;
      this.propertyChartType = type;
      this.updateChartTypeButtons();
      this.renderPropertyChart();
      return;
    }
    this.chartType = type;
    this.updateChartTypeButtons();
    this.renderChart();
  }

  /**
   * Update chart type button styles
   */
  updateChartTypeButtons() {
    const buttons = document.querySelectorAll(".chart-type-btn");
    const active =
      this.view === "property" ? this.propertyChartType : this.chartType;
    buttons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.chartType === active));
      if (btn.dataset.chartType === active) {
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
        // Use sgdProfit which is the pre-calculated investor profit share
        const profitShare = (m.properties || []).reduce((sum, prop) => {
          return sum + (prop.sgdProfit ?? 0);
        }, 0);
        profitMap.set(key, profitShare);
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
          isTrend: true,
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

    // Value on every bar / point, so no hover is needed
    const dataLabelsPlugin = this.investorValueLabels("dataLabels", 11);

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
              grace: "15%", // headroom for the value labels
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

        // Use sgdProfit which is the pre-calculated investor profit share
        const totalProfit = data.monthlyProfits.reduce((sum, m) => {
          const monthProfitShare = (m.properties || []).reduce((propSum, prop) => {
            return propSum + (prop.sgdProfit ?? 0);
          }, 0);
          return sum + monthProfitShare;
        }, 0);

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
              // Totals sit in the legend; below the ring on phones
              position: canvas.parentElement?.clientWidth < 576 ? "bottom" : "right",
              labels: {
                boxWidth: 12,
                padding: 10,
                generateLabels: this.doughnutLegendWithValues(investorTotals),
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
      <div class="d-flex align-items-center justify-content-between mb-4">
        <div class="d-flex align-items-center gap-2">
          <div class="ipr-stat-icon" style="background:#eef2ff;width:38px;height:38px;border-radius:10px">
            <i class="bi bi-calendar3" style="color:#4f46e5"></i>
          </div>
          <div>
            <h6 class="mb-0 fw-semibold">${i18next.t("investorProfitChart.monthlyBreakdown", "Monthly Breakdown")}</h6>
            <small class="text-muted">Click a month to expand property details</small>
          </div>
        </div>
      </div>
      <div class="accordion ipr-month-accordion" id="monthlyProfitAccordion">
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
                // Use sgdProfit which is the pre-calculated investor profit share
                const profit = (monthData.properties || []).reduce((sum, prop) => {
                  return sum + (prop.sgdProfit ?? 0);
                }, 0);
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
                <div class="ipr-prop-card card h-100">
                  <div class="row g-0">
                    <div class="col-4 position-relative">
                      ${
                        imageUrl
                          ? `<img src="${imageUrl}" class="img-fluid rounded-start h-100" style="object-fit: cover; min-height: 120px;" alt="${this.escapeHtml(prop.propertyId)}">`
                          : `<div class="bg-light d-flex align-items-center justify-content-center h-100 rounded-start" style="min-height: 120px;">
                            <i class="bi bi-building fs-1 text-muted"></i>
                          </div>`
                      }
                      ${renderPropertyImageAvatarBadge(this.investors, prop.propertyId, { size: 24, overlap: 9, max: 3 })}
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
   * Render summary stat cards above the investor list
   */
  renderSummaryStats() {
    const container = document.getElementById("investorProfitSummaryStats");
    if (!container) return;

    if (this.profitDataMap.size === 0 || this.selectedInvestors.size === 0) {
      container.innerHTML = "";
      return;
    }

    let totalProfit = 0;
    const trackedProperties = new Set();
    let bestInvestorName = null;
    let bestInvestorProfit = -Infinity;

    for (const [investorId, data] of this.profitDataMap) {
      if (!data || !data.monthlyProfits) continue;
      const investor = this.investors.find((i) => i.investorId === investorId);
      let investorTotal = 0;
      for (const m of data.monthlyProfits) {
        for (const prop of m.properties || []) {
          investorTotal += prop.sgdProfit ?? 0;
          trackedProperties.add(prop.propertyId);
        }
      }
      totalProfit += investorTotal;
      if (investorTotal > bestInvestorProfit) {
        bestInvestorProfit = investorTotal;
        bestInvestorName = investor?.name || investorId;
      }
    }

    const profitPositive = totalProfit >= 0;
    const profitColor = profitPositive ? "#198754" : "#dc3545";

    const trendBadge = (val) => {
      if (val === null) return "";
      const up = val >= 0;
      return `<span class="ipr-trend-badge ${up ? "ipr-trend-up" : "ipr-trend-down"}">
        <i class="bi bi-arrow-${up ? "up" : "down"}-right"></i> ${up ? "+" : ""}$${Math.abs(val).toFixed(0)}
      </span>`;
    };

    container.innerHTML = `
      <div class="col-6 col-md-3">
        <div class="ipr-stat-card card h-100">
          <div class="card-body p-4">
            <div class="d-flex align-items-start justify-content-between mb-3">
              <div>
                <div class="text-muted mb-1" style="font-size:0.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase">Total Profit</div>
                <div class="fw-bold" style="font-size:1.6rem;line-height:1;color:${profitPositive ? "#15803d" : "#b91c1c"}">${profitPositive ? "+" : ""}$${totalProfit.toFixed(0)}</div>
              </div>
              <div class="ipr-stat-icon" style="background:#eef2ff">
                <i class="bi bi-currency-dollar" style="color:#4f46e5"></i>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              ${trendBadge(totalProfit)}
              <small class="text-muted">${this.selectedInvestors.size} investor${this.selectedInvestors.size > 1 ? "s" : ""}</small>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="ipr-stat-card card h-100">
          <div class="card-body p-4">
            <div class="d-flex align-items-start justify-content-between mb-3">
              <div>
                <div class="text-muted mb-1" style="font-size:0.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase">Top Performer</div>
                <div class="fw-bold text-truncate" style="font-size:1.15rem;max-width:120px">${this.escapeHtml(bestInvestorName || "—")}</div>
              </div>
              <div class="ipr-stat-icon" style="background:#f0fdf4">
                <i class="bi bi-trophy" style="color:#15803d"></i>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              ${bestInvestorProfit !== -Infinity ? trendBadge(bestInvestorProfit) : ""}
              <small class="text-muted">best return</small>
            </div>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="ipr-stat-card card h-100">
          <div class="card-body p-4">
            <div class="d-flex align-items-start justify-content-between mb-3">
              <div>
                <div class="text-muted mb-1" style="font-size:0.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase">Properties</div>
                <div class="fw-bold" style="font-size:1.6rem;line-height:1">${trackedProperties.size}</div>
              </div>
              <div class="ipr-stat-icon" style="background:#fffbeb">
                <i class="bi bi-building" style="color:#d97706"></i>
              </div>
            </div>
            <small class="text-muted">tracked this period</small>
          </div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="ipr-stat-card card h-100">
          <div class="card-body p-4">
            <div class="d-flex align-items-start justify-content-between mb-3">
              <div>
                <div class="text-muted mb-1" style="font-size:0.78rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase">Period</div>
                <div class="fw-bold" style="font-size:1rem;line-height:1.3">${this.startMonth}/${this.startYear}<br><span class="text-muted fw-normal" style="font-size:0.85rem">to</span> ${this.endMonth}/${this.endYear}</div>
              </div>
              <div class="ipr-stat-icon" style="background:#f0f9ff">
                <i class="bi bi-calendar3" style="color:#0284c7"></i>
              </div>
            </div>
            <small class="text-muted">selected range</small>
          </div>
        </div>
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
    if (this.view === "property") {
      if (!this.getPropertyMonths().some((m) => m.hasReport)) return;
    } else if (this.profitDataMap.size === 0) {
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
    if (this.view === "property") {
      this.fullscreenChart = new Chart(
        ctx,
        this.buildPropertyChartConfig(this.getPropertyMonths(), true),
      );
      return;
    }
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
        // Use sgdProfit which is the pre-calculated investor profit share
        const profitShare = (m.properties || []).reduce((sum, prop) => {
          return sum + (prop.sgdProfit ?? 0);
        }, 0);
        profitMap.set(key, profitShare);
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
          isTrend: true,
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

    // Value on every bar / point, so no hover is needed
    const dataLabelsPlugin = this.investorValueLabels("fullscreenDataLabels", 14);

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
              grace: "15%", // headroom for the value labels
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

        // Use sgdProfit which is the pre-calculated investor profit share
        const totalProfit = data.monthlyProfits.reduce((sum, m) => {
          const monthProfitShare = (m.properties || []).reduce((propSum, prop) => {
            return propSum + (prop.sgdProfit ?? 0);
          }, 0);
          return sum + monthProfitShare;
        }, 0);

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
              position: canvas.parentElement?.clientWidth < 576 ? "bottom" : "right",
              labels: {
                boxWidth: 16,
                padding: 16,
                font: { size: 14 },
                generateLabels: this.doughnutLegendWithValues(investorTotals),
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
    if (this._propertiesRequested) this.loadProperties();
  }

  // ───────────────────────── Property view ─────────────────────────
  // A property's profit for a month = confirmed income − confirmed expenses of
  // that month's financial report, for the whole property (before any
  // investor split). Same rule as FinancialReport.calculateTotals on the
  // backend: pending items are left out; amounts are SGD (VND items store
  // their SGD value in `amount`).

  t(key, fallback, options = {}) {
    return i18next.t(`investorProfitChart.${key}`, {
      ...options,
      defaultValue: fallback,
    });
  }

  ensurePropertiesLoaded() {
    if (!this._propertiesRequested) {
      this._propertiesRequested = true;
      this.loadProperties();
      return;
    }
    // Refetch the open property so edits made in Financial Reports show up
    if (this.selectedPropertyId && !this.propertyReportsLoading) {
      this.loadPropertyReports(this.selectedPropertyId);
    }
  }

  /** Properties the user can access (same filter as the Properties list). */
  async loadProperties() {
    this.propertiesLoading = true;
    this.propertiesError = null;
    this.renderPropertyList();
    try {
      let all = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await API.get(
          `${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${page}&limit=200&fields=summary`,
        );
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result.message || `HTTP ${res.status}`);
        }
        all = all.concat(result.properties || []);
        totalPages = result.pagination?.totalPages || 1;
        page++;
      } while (page <= totalPages && page <= 20);
      this.properties = all.sort((a, b) =>
        String(a.propertyId).localeCompare(String(b.propertyId), undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
    } catch (error) {
      console.error("Error loading properties:", error);
      this.properties = [];
      this.propertiesError = error;
    } finally {
      this.propertiesLoading = false;
    }

    if (!this.properties.some((p) => p.propertyId === this.selectedPropertyId)) {
      this.selectedPropertyId = null;
    }
    this.renderPropertyList();
    if (this.selectedPropertyId) {
      this.loadPropertyReports(this.selectedPropertyId);
      return;
    }
    // Reopen the last property viewed, or the only one there is
    const saved = this._load("iprPropertyId");
    const pick =
      this.properties.find((p) => p.propertyId === saved) ||
      (this.properties.length === 1 ? this.properties[0] : null);
    if (pick) this.selectProperty(pick.propertyId);
    else this.renderPropertyView();
  }

  selectProperty(propertyId) {
    if (!propertyId || propertyId === this.selectedPropertyId) return;
    this.selectedPropertyId = propertyId;
    this.propertyStartOverride = null;
    this._store("iprPropertyId", propertyId);
    this.renderPropertyList();
    this.loadPropertyReports(propertyId);
  }

  async loadPropertyReports(propertyId) {
    const seq = ++this._propertyRequestSeq;
    this.propertyReportsLoading = true;
    this.propertyReportsError = null;
    this.renderPropertyView();

    let error = null;
    try {
      const res = await API.get(
        API_CONFIG.ENDPOINTS.FINANCIAL_REPORTS_BY_PROPERTY(
          encodeURIComponent(propertyId),
        ),
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || `HTTP ${res.status}`);
      }
      this.propertyReports.set(
        propertyId,
        Array.isArray(result.data) ? result.data : [],
      );
    } catch (e) {
      console.error(`Error loading reports for property ${propertyId}:`, e);
      error = e;
    }
    if (seq !== this._propertyRequestSeq) return; // a newer pick took over
    this.propertyReportsError = error;
    this.propertyReportsLoading = false;
    this.renderPropertyView();
  }

  retryPropertyReports() {
    if (this.selectedPropertyId) this.loadPropertyReports(this.selectedPropertyId);
  }

  handlePropertySearch(value) {
    this.propertySearch = value || "";
    this.renderPropertyList();
  }

  getSelectedProperty() {
    return this.properties.find((p) => p.propertyId === this.selectedPropertyId);
  }

  // "56 Havelock Rd, S161056" → "56 Havelock Rd"
  shortAddress(address) {
    return (address || "")
      .replace(/,?\s*(Singapore|S)\s*\(?\d{6}\)?\s*$/i, "")
      .replace(/\s+\d{6}$/, "")
      .trim();
  }

  _normalize(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  renderPropertyList() {
    const container = document.getElementById("iprPropertyList");
    const countEl = document.getElementById("iprPropertyCount");
    if (!container) return;
    if (countEl) countEl.textContent = "";

    if (this.propertiesLoading) {
      container.innerHTML = `<div class="py-2"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">${this.t("loading", "Loading...")}</span></div></div>`;
      return;
    }
    if (this.propertiesError) {
      container.innerHTML = `<div class="text-danger small py-2">${this.t("loadPropertiesError", "Couldn't load properties.")} <button type="button" class="btn btn-link btn-sm p-0 align-baseline" onclick="investorProfitChart.loadProperties()">${this.t("retry", "Retry")}</button></div>`;
      return;
    }
    if (this.properties.length === 0) {
      container.innerHTML = `<div class="text-muted small py-2"><i class="bi bi-building-x me-1"></i>${this.t("noPropertiesAccess", "No properties you can access")}</div>`;
      return;
    }
    if (countEl) {
      countEl.textContent = `${this.properties.length} ${this.t("propertiesAvailable", "properties you can access")}`;
    }

    const query = this._normalize(this.propertySearch.trim());
    const list = query
      ? this.properties.filter((p) =>
          this._normalize(`${p.propertyId} ${p.unit || ""} ${p.address || ""}`).includes(query),
        )
      : this.properties;

    if (list.length === 0) {
      container.innerHTML = `<div class="text-muted small py-2">${this.t("noPropertiesMatch", "No properties match your search")}</div>`;
      return;
    }

    container.innerHTML = list
      .map((p) => {
        const selected = p.propertyId === this.selectedPropertyId;
        const img = p.propertyImage
          ? ImageUtils.getOptimizedImageUrl(p.propertyImage, "small")
          : null;
        const addr = this.shortAddress(p.address);
        const full = [p.unit, p.address].filter(Boolean).join(", ");
        return `
          <button type="button" class="ipr-prop-chip${selected ? " selected" : ""}"
            data-property-id="${this.escapeHtml(p.propertyId)}"
            aria-pressed="${selected}" title="${this.escapeHtml(full)}">
            ${img ? `<img src="${img}" class="ipr-prop-thumb" alt="" loading="lazy">` : `<span class="ipr-prop-thumb"><i class="bi bi-building"></i></span>`}
            <span class="ipr-prop-chip-id">${this.escapeHtml(p.propertyId)}</span>
            ${addr ? `<span class="ipr-prop-chip-addr">${this.escapeHtml(addr)}</span>` : ""}
            ${selected ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : ""}
          </button>`;
      })
      .join("");

    container.querySelectorAll(".ipr-prop-chip").forEach((chip) => {
      chip.addEventListener("click", () =>
        this.selectProperty(chip.dataset.propertyId),
      );
    });

    // On the swipeable phone row, keep the selected chip in view
    const sel = container.querySelector(".ipr-prop-chip.selected");
    if (sel && container.scrollWidth > container.clientWidth) {
      const c = container.getBoundingClientRect();
      const s = sel.getBoundingClientRect();
      if (s.left < c.left || s.right > c.right) {
        container.scrollLeft += s.left - c.left - 16;
      }
    }
  }

  _round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /** Confirmed and pending totals of one report (pending never counts). */
  computeReportTotals(report) {
    const sum = (items, pending) =>
      (items || []).reduce(
        (s, item) =>
          !!item.isPending === pending ? s + (Number(item.amount) || 0) : s,
        0,
      );
    const income = this._round2(sum(report.income, false));
    const expenses = this._round2(sum(report.expenses, false));
    return {
      income,
      expenses,
      net: this._round2(income - expenses),
      pendingIncome: this._round2(sum(report.income, true)),
      pendingExpenses: this._round2(sum(report.expenses, true)),
    };
  }

  /** Every month in the date range for the selected property. */
  /**
   * Month key (year * 12 + month - 1) the property's profit starts at: its
   * lease start or its first financial report, whichever is earlier.
   */
  getPropertyAutoStartKey() {
    const keys = (this.propertyReports.get(this.selectedPropertyId) || []).map(
      (r) => r.year * 12 + r.month - 1,
    );
    const moveIn = this.getSelectedProperty()?.moveInDate;
    const d = moveIn ? new Date(moveIn) : null;
    if (d && !Number.isNaN(d.getTime())) keys.push(d.getFullYear() * 12 + d.getMonth());
    return keys.length ? Math.min(...keys) : this.startYear * 12 + this.startMonth - 1;
  }

  getPropertyStartKey() {
    const o = this.propertyStartOverride;
    return o && o.propertyId === this.selectedPropertyId ? o.key : this.getPropertyAutoStartKey();
  }

  /** Date pickers show the range of the tab in view. */
  syncPeriodInputs() {
    this.syncYearOptions();
    const startKey =
      this.view === "property" && this.selectedPropertyId
        ? this.getPropertyStartKey()
        : this.startYear * 12 + this.startMonth - 1;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = String(v);
    };
    set("investorProfitStartYear", Math.floor(startKey / 12));
    set("investorProfitStartMonth", (startKey % 12) + 1);
    set("investorProfitEndYear", this.endYear);
    set("investorProfitEndMonth", this.endMonth);
  }

  getPropertyMonths() {
    const reports = this.propertyReports.get(this.selectedPropertyId);
    if (!reports) return [];
    const byMonth = new Map(reports.map((r) => [r.year * 12 + r.month - 1, r]));
    const start = this.getPropertyStartKey();
    const end = this.endYear * 12 + this.endMonth - 1;
    const months = [];
    for (let k = start; k <= end && months.length < 240; k++) {
      const year = Math.floor(k / 12);
      const month = (k % 12) + 1;
      const report = byMonth.get(k);
      if (!report) {
        months.push({ year, month, hasReport: false });
        continue;
      }
      months.push({
        year,
        month,
        hasReport: true,
        ...this.computeReportTotals(report),
        isClosed: !!report.isClosed,
        isSettled: !!report.isSettled,
      });
    }
    return months;
  }

  sumMonths(months) {
    const total = { income: 0, expenses: 0, net: 0 };
    for (const m of months) {
      total.income += m.income;
      total.expenses += m.expenses;
      total.net += m.net;
    }
    return {
      income: this._round2(total.income),
      expenses: this._round2(total.expenses),
      net: this._round2(total.net),
    };
  }

  fmtMoney(value, { sign = false, decimals = 2 } = {}) {
    const abs = Math.abs(value).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const isZero = Number(abs.replace(/,/g, "")) === 0;
    const prefix = isZero ? "" : value < 0 ? "-" : sign ? "+" : "";
    return `${prefix}$${abs}`;
  }

  fmtAxisMoney(value) {
    const abs = Math.abs(value);
    const text =
      abs >= 1000
        ? `${(abs / 1000).toLocaleString("en-US", { maximumFractionDigits: abs >= 10000 ? 0 : 1 })}k`
        : abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
    return `${value < 0 ? "-" : ""}$${text}`;
  }

  /** Short money for chart labels: $850, $1.2k, $15k, $1.3M */
  fmtShortMoney(value, { sign = false } = {}) {
    const abs = Math.abs(value);
    let text;
    if (abs >= 999500) text = `${+(abs / 1e6).toFixed(abs >= 9.95e6 ? 0 : 1)}M`;
    else if (abs >= 999.5) text = `${+(abs / 1000).toFixed(abs >= 9950 ? 0 : 1)}k`;
    else text = String(Math.round(abs));
    const prefix = text === "0" ? "" : value < 0 ? "-" : sign ? "+" : "";
    return `${prefix}$${text}`;
  }

  /**
   * Chart.js plugin that prints the value of every bar and line point, so
   * nothing needs a hover. Labels are measured before drawing:
   *  - every label in a chart uses one format, the widest that fits:
   *    +$1,234 → +$1.2k → 1.2k;
   *  - a label never covers another label, another bar or another point;
   *  - bars: value at the tip (below the bar for a loss);
   *  - lines: the top line labels above its points, the bottom line below,
   *    a middle line on the side with more room; then the other side;
   *  - a label with no free spot is left out (the tooltip still has it).
   * Layout uses the final (post-animation) positions so labels don't
   * flicker while bars grow; they are drawn at the current position.
   */
  valueLabelsPlugin(
    id,
    {
      fontSize = 11,
      skipZero = false, // investor charts use 0 for "no data that month"
      skipDataset = () => false,
      sign = () => false,
      color = () => "#374151",
      weight = () => 600,
    } = {},
  ) {
    const FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const GAP = 4; // mark → its label
    const SPACE = 2; // clear space between two labels
    const formats = [
      { size: fontSize, text: (v, s) => this.fmtMoney(v, { sign: s, decimals: 0 }) },
      { size: fontSize, text: (v, s) => this.fmtShortMoney(v, { sign: s }) },
      { size: Math.max(10, fontSize - 1), text: (v) => this.fmtShortMoney(v).replace("$", "") },
    ];
    const hits = (a, b, pad) =>
      a.x < b.x + b.w + pad &&
      b.x < a.x + a.w + pad &&
      a.y < b.y + b.h + pad &&
      b.y < a.y + a.h + pad;

    // Every visible bar / point, with the box it covers
    const collectMarks = (chart) => {
      const marks = [];
      chart.data.datasets.forEach((ds, di) => {
        if (!chart.isDatasetVisible(di) || skipDataset(ds, di)) return;
        const meta = chart.getDatasetMeta(di);
        const isBar = meta.type === "bar";
        // Point labels clear the dot (radius + border), not just its centre
        const r = isBar ? 0 : (ds.pointRadius ?? 3) + (ds.pointBorderWidth ?? 1);
        meta.data.forEach((el, i) => {
          const v = ds.data[i];
          if (v == null || !Number.isFinite(v)) return;
          const p = el.getProps(["x", "y", "base", "width"], true);
          const box = isBar
            ? { x: p.x - p.width / 2, y: Math.min(p.y, p.base), w: p.width, h: Math.abs(p.base - p.y) }
            : { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r };
          marks.push({ ds, di, i, el, v, isBar, p, r, box, labelled: !(skipZero && v === 0) });
        });
      });
      for (const m of marks) {
        if (m.isBar) continue;
        let up = Infinity;
        let down = Infinity; // distance to the nearest other line, same month
        for (const o of marks) {
          if (o.isBar || o.i !== m.i || o.di === m.di) continue;
          if (o.p.y < m.p.y) up = Math.min(up, m.p.y - o.p.y);
          else if (o.p.y > m.p.y) down = Math.min(down, o.p.y - m.p.y);
        }
        m.below = up !== Infinity && (down === Infinity || down > up);
      }
      return marks;
    };

    const layout = (chart, marks, f, minY) => {
      const { ctx, chartArea: area } = chart;
      const metrics = new Map(); // font → { ascent, h }
      const taken = [];
      const labels = [];
      let dropped = 0;

      for (const m of marks) {
        if (!m.labelled) continue;
        const font = `${weight(m.ds, m.di)} ${f.size}px ${FAMILY}`;
        ctx.font = font;
        if (!metrics.has(font)) {
          const t = ctx.measureText("$0123456789,");
          metrics.set(font, { ascent: t.actualBoundingBoxAscent, h: t.actualBoundingBoxAscent + t.actualBoundingBoxDescent });
        }
        const { ascent, h } = metrics.get(font);
        const text = f.text(m.v, sign(m.ds, m.di));
        const w = ctx.measureText(text).width;
        const clampX = (x) => Math.max(area.left, Math.min(x, chart.width - w - 1));
        const above = m.p.y - m.r - GAP - h;
        const below = m.p.y + m.r + GAP;
        const ys = m.isBar ? [m.v < 0 ? below : above] : m.below ? [below, above] : [above, below];
        // Centred; a bar label may also line up with either edge of its bar
        // to step away from a taller neighbour in a group
        const xs = [m.p.x - w / 2];
        if (m.isBar) xs.push(m.box.x + m.box.w - w, m.box.x);
        const spot = ys
          .flatMap((y) => xs.map((x) => ({ x: clampX(x), y, w, h })))
          .find(
            (b) =>
              b.y >= minY &&
              b.y + b.h <= area.bottom &&
              !taken.some((o) => hits(o, b, SPACE)) &&
              !marks.some((o) => o !== m && hits(o.box, b, 0)),
          );
        if (!spot) {
          dropped++;
          continue;
        }
        taken.push(spot);
        labels.push({ el: m.el, text, font, dx: spot.x - m.p.x, dy: spot.y - m.p.y + ascent, fill: color(m.v, m.ds, m.di) });
      }
      return { labels, dropped };
    };

    return {
      id,
      afterDatasetsDraw: (chart) => {
        const { ctx, chartArea: area } = chart;
        // Labels may rise into the gap under a top legend, never into it
        const lg = chart.legend;
        const minY =
          lg?.options?.display && lg.options.position === "top" && Number.isFinite(lg.bottom)
            ? Math.min(lg.bottom + 2, area.top)
            : 0;
        const marks = collectMarks(chart);
        ctx.save();
        let best = null;
        for (const f of formats) {
          const res = layout(chart, marks, f, minY);
          if (!best || res.labels.length > best.labels.length) best = res;
          if (res.dropped === 0) break;
        }
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.lineJoin = "round";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)"; // halo over lines/grid
        for (const l of best.labels) {
          const { x, y } = l.el.getProps(["x", "y"]);
          ctx.font = l.font;
          ctx.strokeText(l.text, x + l.dx, y + l.dy);
          ctx.fillStyle = l.fill;
          ctx.fillText(l.text, x + l.dx, y + l.dy);
        }
        ctx.restore();
      },
    };
  }

  /** Investor charts: green profit / red loss with a sign; trend lines unlabeled. */
  investorValueLabels(id, fontSize) {
    return this.valueLabelsPlugin(id, {
      fontSize,
      skipZero: true,
      skipDataset: (ds) => ds.isTrend,
      sign: () => true,
      color: (v) => (v >= 0 ? "#198754" : "#dc3545"),
      weight: () => 700,
    });
  }

  /** Doughnut legend items with each investor's total after the name. */
  doughnutLegendWithValues(totals) {
    return (chart) =>
      Chart.overrides.doughnut.plugins.legend.labels
        .generateLabels(chart)
        .map((item) => ({
          ...item,
          text: `${item.text}  ${this.fmtMoney(totals[item.index]?.profit ?? 0, { sign: true, decimals: 0 })}`,
        }));
  }

  monthLabel(year, month, style = "short") {
    const vi = (i18next.language || "").startsWith("vi");
    const shortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const longNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const name = vi
      ? style === "long" ? `Tháng ${month}` : `Th${month}`
      : style === "long" ? longNames[month - 1] : shortNames[month - 1];
    return `${name} ${year}`;
  }

  /** Link to that month's Financial Report, when the user may open it. */
  reportHref(m) {
    if (!m.hasReport || !window.SlugUtils) return null;
    if (typeof window.canAccessModule === "function" && !window.canAccessModule("financial")) {
      return null;
    }
    const property = this.getSelectedProperty();
    const slug = property ? window.SlugUtils.propertySlug(property) : "";
    return slug ? `#/financial/${slug}/${m.year}/${m.month}` : null;
  }

  renderPropertyView() {
    const ids = ["iprPropertyStats", "iprPropertyChartContainer", "iprPropertyMonthly"];
    const els = ids.map((id) => document.getElementById(id));
    const hasData = this.propertyReports.has(this.selectedPropertyId);

    // While fresh data loads, keep what's on screen (dimmed) rather than
    // flashing a spinner
    const dim = this.propertyReportsLoading && (hasData || this._shownPropertyId);
    els.forEach((el) => el?.classList.toggle("ipr-refreshing", !!dim));
    if (this.propertyReportsLoading && !hasData && this._shownPropertyId) return;

    const months = this.getPropertyMonths();
    if (this.view === "property") this.syncPeriodInputs();
    this.renderPropertySubtitle();
    this.renderPropertyStats(months);
    this.renderPropertyChartArea(months);
    this.renderPropertyChart();
    this.renderPropertyMonthly(months);
    this._shownPropertyId = hasData ? this.selectedPropertyId : null;
  }

  renderPropertySubtitle() {
    const el = document.getElementById("iprPropertyChartSubtitle");
    if (!el) return;
    const p = this.getSelectedProperty();
    const base = this.t("netProfitPerMonth", "Net profit per month");
    el.textContent = p
      ? `${base} · ${p.propertyId}${p.unit ? ` ${p.unit}` : ""} ${this.shortAddress(p.address)}`.trim()
      : base;
  }

  renderPropertyStats(months) {
    const el = document.getElementById("iprPropertyStats");
    if (!el) return;
    const reported = months.filter((m) => m.hasReport);
    if (reported.length === 0) {
      el.innerHTML = "";
      return;
    }
    const total = this.sumMonths(reported);
    const avg = this._round2(total.net / reported.length);
    const best = reported.reduce((a, b) => (b.net > a.net ? b : a));
    const worst = reported.reduce((a, b) => (b.net < a.net ? b : a));
    const pct = total.income > 0 ? Math.round((total.expenses / total.income) * 100) : null;
    const signClass = (v) => (v < 0 ? "ipr-neg" : "ipr-pos");

    const tile = (label, value, sub, icon, iconBg, iconColor, valueClass = "") => `
      <div class="col-6 col-lg-3">
        <div class="ipr-stat-card ipr-pstat-card card h-100">
          <div class="card-body p-4">
            <div class="d-flex align-items-start justify-content-between gap-2">
              <div style="min-width:0">
                <div class="ipr-pstat-label">${label}</div>
                <div class="ipr-pstat-value ${valueClass}">${value}</div>
              </div>
              <div class="ipr-stat-icon d-none d-sm-flex" style="background:${iconBg}">
                <i class="bi ${icon}" style="color:${iconColor}"></i>
              </div>
            </div>
            <div class="ipr-pstat-sub">${sub}</div>
          </div>
        </div>
      </div>`;

    el.innerHTML = [
      tile(
        this.t("netProfit", "Net profit"),
        this.fmtMoney(total.net, { sign: true }),
        this.t("avgPerMonth", "Avg {{value}} / month", { value: this.fmtMoney(avg, { sign: true }) }),
        "bi-currency-dollar", "#eef2ff", "#4f46e5", signClass(total.net),
      ),
      tile(
        this.t("income", "Income"),
        this.fmtMoney(total.income),
        this.t("monthsReported", "{{n}} of {{total}} months reported", { n: reported.length, total: months.length }),
        "bi-arrow-down-left-circle", "#f0fdf4", "#15803d",
      ),
      tile(
        this.t("expenses", "Expenses"),
        this.fmtMoney(total.expenses),
        pct === null ? "&nbsp;" : this.t("ofIncome", "{{pct}}% of income", { pct }),
        "bi-arrow-up-right-circle", "#fef2f2", "#b91c1c",
      ),
      tile(
        this.t("bestMonth", "Best month"),
        this.monthLabel(best.year, best.month, "long"),
        `<span class="${signClass(best.net)} fw-semibold">${this.fmtMoney(best.net, { sign: true })}</span>${
          reported.length > 1
            ? ` · ${this.t("lowest", "Lowest")}: ${this.monthLabel(worst.year, worst.month)} <span class="${signClass(worst.net)}">${this.fmtMoney(worst.net, { sign: true })}</span>`
            : ""
        }`,
        "bi-trophy", "#fffbeb", "#d97706",
      ),
    ].join("");
  }

  renderPropertyChartArea(months) {
    const el = document.getElementById("iprPropertyChartContainer");
    const fsBtn = document.getElementById("iprPropertyFullscreenBtn");
    if (!el) return;
    if (this.propertyChart) {
      this.propertyChart.destroy();
      this.propertyChart = null;
    }
    const empty = (icon, text, extra = "") => `
      <div class="text-center text-muted py-5">
        <i class="bi ${icon} fs-1 mb-3 d-block" style="color:#d1d5db"></i>
        <p class="mb-0">${text}</p>${extra}
      </div>`;
    const hasData = this.propertyReports.has(this.selectedPropertyId);
    const reported = months.some((m) => m.hasReport);
    if (fsBtn) fsBtn.disabled = !reported;

    if (!this.selectedPropertyId) {
      el.innerHTML = empty("bi-building", this.t("selectPropertyToView", "Select a property to see its monthly profit"));
    } else if (!hasData && this.propertyReportsLoading) {
      el.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">${this.t("loadingData", "Loading data...")}</span></div></div>`;
    } else if (!hasData) {
      el.innerHTML = empty(
        "bi-exclamation-triangle",
        this.t("loadReportsError", "Couldn't load this property's financial reports."),
        `<button type="button" class="btn btn-sm btn-outline-primary mt-3" onclick="investorProfitChart.retryPropertyReports()">${this.t("retry", "Retry")}</button>`,
      );
    } else if (months.length === 0) {
      el.innerHTML = empty("bi-calendar-x", this.t("startAfterEnd", "The start month is after the end month."));
    } else if (!reported) {
      el.innerHTML = empty("bi-inbox", this.t("noReportsForPeriod", "No financial reports for this property in the selected period"));
    } else {
      el.innerHTML = `<div class="ipr-pchart-wrap"><canvas id="iprPropertyChart" role="img" aria-label="${this.escapeHtml(this.t("netProfitPerMonth", "Net profit per month"))}"></canvas></div>`;
    }
  }

  renderPropertyChart() {
    const canvas = document.getElementById("iprPropertyChart");
    if (this.propertyChart) {
      this.propertyChart.destroy();
      this.propertyChart = null;
    }
    if (!canvas || typeof Chart === "undefined") return;
    const months = this.getPropertyMonths();
    if (!months.some((m) => m.hasReport)) return;
    this.propertyChart = new Chart(
      canvas.getContext("2d"),
      this.buildPropertyChartConfig(months, false),
    );
  }

  buildPropertyChartConfig(months, fullscreen) {
    const type = this.propertyChartType === "line" ? "line" : "bar";
    // Validated pairs: profit/loss diverging blue↔red; lines blue/aqua/orange
    const C = {
      profit: "#2a78d6",
      loss: "#e34948",
      income: "#1baf7a",
      expenses: "#eb6834",
      grid: "#eceef1",
      zero: "#c3c7cf",
      tick: "#6b7280",
      ink: "#374151",
    };
    const fontSize = fullscreen ? 13 : 11;
    const font = { size: fontSize };
    // Month on line 1; year only under the first month and each January
    const labels = months.map((m, i) => {
      const name = this.monthLabel(m.year, m.month).split(" ")[0];
      return i === 0 || m.month === 1 ? [name, String(m.year)] : [name];
    });
    const series = (key) => months.map((m) => (m.hasReport ? m[key] : null));
    const net = series("net");
    const netLabel = this.t("netProfit", "Net profit");
    const incomeLabel = this.t("income", "Income");
    const expensesLabel = this.t("expenses", "Expenses");
    const point = { pointRadius: 4, pointHoverRadius: 6, pointBorderColor: "#fff", pointBorderWidth: 2, tension: 0.3, spanGaps: false };

    const datasets =
      type === "line"
        ? [
            { label: netLabel, data: net, borderColor: C.profit, backgroundColor: C.profit, borderWidth: 2.5, fill: { target: "origin", above: "rgba(42,120,214,0.08)", below: "rgba(227,73,72,0.10)" }, order: 1, ...point },
            { label: incomeLabel, data: series("income"), borderColor: C.income, backgroundColor: C.income, borderWidth: 2, borderDash: [6, 4], fill: false, order: 2, ...point },
            { label: expensesLabel, data: series("expenses"), borderColor: C.expenses, backgroundColor: C.expenses, borderWidth: 2, borderDash: [2, 3], fill: false, order: 3, ...point },
          ]
        : [
            {
              label: netLabel,
              data: net,
              backgroundColor: net.map((v) => (v < 0 ? C.loss : C.profit)),
              hoverBackgroundColor: net.map((v) => (v < 0 ? C.loss : C.profit)),
              borderRadius: 4,
              borderSkipped: "start",
              maxBarThickness: fullscreen ? 64 : 44,
              categoryPercentage: 0.7,
              barPercentage: 0.9,
            },
          ];

    // Value on every point. Net profit (dataset 0) is placed first and in
    // dark ink; income/expenses lines get lighter labels.
    const valueLabels = this.valueLabelsPlugin("iprValueLabels", {
      fontSize,
      sign: (ds, di) => di === 0,
      color: (v, ds, di) => (di === 0 ? C.ink : C.tick),
      weight: (ds, di) => (di === 0 ? 600 : 500),
    });

    return {
      type,
      data: { labels, datasets },
      plugins: [valueLabels],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: type === "bar" ? 18 : 6 } },
        plugins: {
          legend: {
            display: type === "line",
            position: "top",
            align: "start",
            labels: {
              usePointStyle: true,
              pointStyle: "line",
              pointStyleWidth: 26,
              color: C.ink,
              font,
              // Key = a short piece of each line (colour + dash). The default
              // takes the point style, whose white border made keys invisible.
              generateLabels: (chart) =>
                Chart.defaults.plugins.legend.labels.generateLabels(chart).map((item) => {
                  const ds = chart.data.datasets[item.datasetIndex];
                  return {
                    ...item,
                    strokeStyle: ds.borderColor,
                    fillStyle: ds.borderColor,
                    lineWidth: ds.borderWidth,
                    lineDash: ds.borderDash || [],
                  };
                }),
            },
          },
          tooltip: {
            filter: (item) => item.raw !== null && item.raw !== undefined,
            callbacks: {
              title: (items) => {
                const m = items.length ? months[items[0].dataIndex] : null;
                return m ? this.monthLabel(m.year, m.month, "long") : "";
              },
              label: (ctx) =>
                `${ctx.dataset.label}: ${this.fmtMoney(ctx.raw, { sign: ctx.datasetIndex === 0 })}`,
              afterBody: (items) => {
                const m = items.length ? months[items[0].dataIndex] : null;
                if (!m || !m.hasReport) return [];
                const lines = [];
                if (type === "bar") {
                  lines.push(`${incomeLabel}: ${this.fmtMoney(m.income)}`, `${expensesLabel}: ${this.fmtMoney(m.expenses)}`);
                }
                const pending = this.pendingParts(m);
                if (pending.length) {
                  lines.push(`${this.t("pendingNotCounted", "Pending, not counted")}: ${pending.join(" · ")}`);
                }
                return lines;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: C.zero },
            ticks: { color: C.tick, font, maxRotation: 0, autoSkip: true, autoSkipPadding: 8 },
          },
          y: {
            beginAtZero: true,
            grace: "10%",
            border: { display: false },
            grid: { color: (c) => (c.tick && c.tick.value === 0 ? C.zero : C.grid) },
            ticks: { color: C.tick, font, maxTicksLimit: 6, callback: (v) => this.fmtAxisMoney(v) },
          },
        },
      },
    };
  }

  pendingParts(m) {
    const parts = [];
    if (m.pendingIncome) parts.push(`${this.t("income", "Income")} ${this.fmtMoney(m.pendingIncome)}`);
    if (m.pendingExpenses) parts.push(`${this.t("expenses", "Expenses")} ${this.fmtMoney(m.pendingExpenses)}`);
    return parts;
  }

  renderPropertyMonthly(months) {
    const el = document.getElementById("iprPropertyMonthly");
    if (!el) return;
    const reported = months.filter((m) => m.hasReport);
    if (reported.length === 0) {
      el.innerHTML = "";
      return;
    }
    const total = this.sumMonths(reported);
    const signClass = (v) => (v < 0 ? "ipr-neg" : "ipr-pos");
    const inLabel = this.t("inShort", "In");
    const outLabel = this.t("outShort", "Out");

    const rows = [...months]
      .reverse() // newest first, like a statement
      .map((m) => {
        const label = this.monthLabel(m.year, m.month, "long");
        if (!m.hasReport) {
          return `<div class="ipr-pm-row is-empty">
              <div class="ipr-pm-month">${label}</div>
              <div class="ipr-pm-empty">${this.t("noReport", "No report")}</div>
            </div>`;
        }
        const href = this.reportHref(m);
        const tag = href ? "a" : "div";
        const attrs = href
          ? `href="${href}" title="${this.escapeHtml(this.t("openReport", "Open this month's financial report"))}"`
          : "";
        const status = m.isSettled
          ? `<span class="ipr-pm-chip is-settled"><i class="bi bi-check2-circle"></i>${this.t("settled", "Settled")}</span>`
          : m.isClosed
            ? `<span class="ipr-pm-chip is-closed"><i class="bi bi-lock-fill"></i>${this.t("closed", "Closed")}</span>`
            : `<span class="ipr-pm-chip is-open"><i class="bi bi-pencil"></i>${this.t("open", "Open")}</span>`;
        const pending = this.pendingParts(m);
        return `<${tag} class="ipr-pm-row" ${attrs}>
            <div class="ipr-pm-month">${label}</div>
            <div class="ipr-pm-num ipr-pm-income"><span class="ipr-pm-label">${inLabel}</span>${this.fmtMoney(m.income)}</div>
            <div class="ipr-pm-num ipr-pm-expenses"><span class="ipr-pm-label">${outLabel}</span>${this.fmtMoney(m.expenses)}</div>
            <div class="ipr-pm-num ipr-pm-net ${signClass(m.net)}">${this.fmtMoney(m.net, { sign: true })}</div>
            <div class="ipr-pm-status">${status}</div>
            <div class="ipr-pm-go" aria-hidden="true">${href ? '<i class="bi bi-chevron-right"></i>' : ""}</div>
            ${pending.length ? `<div class="ipr-pm-note"><i class="bi bi-hourglass-split me-1"></i>${this.t("pendingNotCounted", "Pending, not counted")}: ${pending.join(" · ")}</div>` : ""}
          </${tag}>`;
      })
      .join("");

    el.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-3">
        <div class="ipr-stat-icon" style="background:#eef2ff;width:38px;height:38px;border-radius:10px">
          <i class="bi bi-calendar3" style="color:#4f46e5"></i>
        </div>
        <div>
          <h6 class="mb-0 fw-semibold">${this.t("monthlyBreakdown", "Monthly Breakdown")}</h6>
          <small class="text-muted">${this.t("propertyMonthlyHint", "Profit = income − expenses for the whole property. Pending items are not counted.")}</small>
        </div>
      </div>
      <div class="ipr-pm-list">
        <div class="ipr-pm-head">
          <div>${this.t("month", "Month")}</div>
          <div class="ipr-pm-num">${this.t("income", "Income")}</div>
          <div class="ipr-pm-num">${this.t("expenses", "Expenses")}</div>
          <div class="ipr-pm-num">${this.t("netProfit", "Net profit")}</div>
          <div class="ipr-pm-status">${this.t("status", "Status")}</div>
          <div class="ipr-pm-go"></div>
        </div>
        <div class="ipr-pm-total">
          <div class="ipr-pm-month">${this.t("total", "Total")}</div>
          <div class="ipr-pm-num ipr-pm-income"><span class="ipr-pm-label">${inLabel}</span>${this.fmtMoney(total.income)}</div>
          <div class="ipr-pm-num ipr-pm-expenses"><span class="ipr-pm-label">${outLabel}</span>${this.fmtMoney(total.expenses)}</div>
          <div class="ipr-pm-num ipr-pm-net ${signClass(total.net)}">${this.fmtMoney(total.net, { sign: true })}</div>
          <div class="ipr-pm-status"><small class="text-muted fw-normal">${this.t("monthsCount", "{{n}} months", { n: reported.length })}</small></div>
          <div class="ipr-pm-go"></div>
        </div>
        ${rows}
      </div>`;
  }
}

// Global initialization
const investorProfitChart = new investorProfitChartComponent();
window.investorProfitChart = investorProfitChart;
