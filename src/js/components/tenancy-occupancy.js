import {
  getRoomTypeDisplayName,
  ROOM_TYPE_MAP,
} from "../utils/room-type-mapper.js";
import i18next from "i18next";

/**
 * Tenancy Occupancy Component
 * Displays tenant occupancy timelines for ALL properties in separate sections
 */
class TenancyOccupancyComponent {
  constructor() {
    this.currentYear = new Date().getFullYear();
    this.properties = [];
    this.tenants = [];
    this.isLoading = false;
    // Filter state
    this.searchQuery = "";
    this.selectedRoom = "";
    this.activeOnly = false;
    this.selectedProperties = new Set(); // Use Set for better performance
    this.lastClickedIndex = -1; // Track last clicked card for shift selection
    this.init();
  }

  /**
   * Initialize the component
   */
  init() {
    // Bind navigation events
    this.bindEvents();
  }

  /**
   * Bind navigation events
   */
  bindEvents() {
    // Navigation buttons will be bound after render
  }

  /**
   * Navigate to previous year
   */
  previousYear() {
    this.currentYear--;
    this.updateYearDisplay();
    this.renderTimelines();
  }

  /**
   * Navigate to next year
   */
  nextYear() {
    this.currentYear++;
    this.updateYearDisplay();
    this.renderTimelines();
  }

  /**
   * Handle search input change
   */
  handleSearchChange(value) {
    this.searchQuery = value;
    // Debounce the search
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.loadData();
    }, 300);
  }

  /**
   * Handle room filter change
   */
  handleRoomChange(value) {
    this.selectedRoom = value;
    this.loadData();
  }

  /**
   * Handle active only toggle
   */
  handleActiveOnlyChange(checked) {
    this.activeOnly = checked;
    this.loadData();
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.searchQuery = "";
    this.selectedRoom = "";
    this.activeOnly = false;
    this.selectedProperties.clear();
    // Update UI
    const searchInput = document.getElementById("tenancyOccupancySearch");
    const roomSelect = document.getElementById("tenancyOccupancyRoom");
    const activeCheckbox = document.getElementById(
      "tenancyOccupancyActiveOnly",
    );
    if (searchInput) searchInput.value = "";
    if (roomSelect) roomSelect.value = "";
    if (activeCheckbox) activeCheckbox.checked = false;
    this.updatePropertyCardStyles();
    this.loadData();
  }

  /**
   * Render property cards for selection
   */
  renderPropertyCards() {
    const container = document.getElementById("tenancyOccupancyPropertyList");
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
                alt="${this.escapeHtml(property.propertyId)}"
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
            <h6 class="card-title mb-1 fw-bold">${this.escapeHtml(
              property.propertyId,
            )}</h6>
            <p class="card-text text-muted small mb-0">
              <i class="bi bi-geo-alt me-1"></i>${this.escapeHtml(
                property.address || "No address",
              )}
            </p>
          </div>
        </div>
      </div>
    `;
      })
      .join("");

    // Add click handlers to cards
    this.bindPropertyCardEvents();

    // Apply selected styles
    this.updatePropertyCardStyles();

    // Initial count update
    this.updatePropertyFilterLabel();
  }

  /**
   * Bind click events to property cards
   */
  bindPropertyCardEvents() {
    const cards = document.querySelectorAll(
      "#tenancyOccupancyPropertyList .property-select-card",
    );
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

          this.updatePropertyFilterLabel();
          this.renderPropertyCards();
        } else {
          // Single selection/deselection
          if (this.selectedProperties.has(propertyId)) {
            this.selectedProperties.delete(propertyId);
          } else {
            this.selectedProperties.add(propertyId);
          }

          this.lastClickedIndex = currentIndex;
          this.updatePropertyFilterLabel();
          // Re-render to update checkmark
          this.renderPropertyCards();
        }

        // Update timelines after selection change
        this.renderTimelines();
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
   * Update property card styles based on selection
   */
  updatePropertyCardStyles() {
    const cards = document.querySelectorAll(
      "#tenancyOccupancyPropertyList .property-select-card",
    );
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

  /**
   * Handle property selection change (for backward compatibility)
   */
  handlePropertySelection(propertyId, checked) {
    if (checked) {
      this.selectedProperties.add(propertyId);
    } else {
      this.selectedProperties.delete(propertyId);
    }
    this.updatePropertyFilterLabel();
    this.renderTimelines();
  }

  /**
   * Select all properties
   */
  selectAllProperties() {
    // Select all properties by adding them to the set
    this.properties.forEach((property) => {
      this.selectedProperties.add(property.propertyId);
    });
    this.updatePropertyFilterLabel();
    // Re-render to update checkmarks and selected styles
    this.renderPropertyCards();
    this.renderTimelines();
  }

  /**
   * Deselect all properties
   */
  deselectAllProperties() {
    // Clear all selections
    this.selectedProperties.clear();
    this.updatePropertyFilterLabel();
    // Re-render to update checkmarks and selected styles
    this.renderPropertyCards();
    this.renderTimelines();
  }

  /**
   * Filter property cards based on search input
   */
  filterPropertyCards(searchValue) {
    const container = document.getElementById("tenancyOccupancyPropertyList");
    if (!container) return;

    const searchTerm = searchValue.toLowerCase().trim();
    const cardCols = container.querySelectorAll(".property-card-col");

    if (!searchTerm) {
      // Show all cards
      cardCols.forEach((col) => {
        col.style.display = "";
      });
      return;
    }

    cardCols.forEach((col) => {
      const card = col.querySelector(".property-select-card");
      const propertyId = card.dataset.propertyId;
      const property = this.properties.find((p) => p.propertyId === propertyId);

      if (property) {
        const displayName = property.unit
          ? `${property.propertyId} - ${property.unit}`
          : property.propertyId;
        const address = property.address || "";
        const searchableText = `${displayName} ${address}`.toLowerCase();

        if (searchableText.includes(searchTerm)) {
          col.style.display = "";
        } else {
          col.style.display = "none";
        }
      }
    });
  }

  /**
   * Update the property filter label
   */
  updatePropertyFilterLabel() {
    const countEl = document.getElementById("tenancyOccupancyPropertyCount");
    if (countEl) {
      const count = this.selectedProperties.size;
      countEl.textContent = `${count} ${
        count === 1 ? "property" : "properties"
      } selected`;
    }
  }

  /**
   * Update the year display
   */
  updateYearDisplay() {
    const yearDisplay = document.getElementById("tenancyOccupancyYearDisplay");
    if (yearDisplay) {
      yearDisplay.textContent = this.currentYear;
    }
  }

  /**
   * Load all data (properties and tenants)
   */
  async loadData() {
    this.isLoading = true;
    this.renderLoadingState();

    try {
      // Build tenant query with filters
      let tenantQuery = `${API_CONFIG.ENDPOINTS.TENANTS}?limit=10000`;
      if (this.searchQuery) {
        tenantQuery += `&search=${encodeURIComponent(this.searchQuery)}`;
      }
      if (this.selectedRoom) {
        tenantQuery += `&room=${encodeURIComponent(this.selectedRoom)}`;
      }
      if (this.activeOnly) {
        tenantQuery += `&activeOnly=true`;
      }

      // Fetch properties and tenants in parallel
      const [propertiesResponse, tenantsResponse] = await Promise.all([
        API.get(API_CONFIG.ENDPOINTS.PROPERTIES),
        API.get(tenantQuery),
      ]);

      if (propertiesResponse.ok) {
        const result = await propertiesResponse.json();

        // API returns { success: true, properties: [...] }
        if (result.success && result.properties) {
          this.properties = result.properties;
        } else if (Array.isArray(result.properties)) {
          this.properties = result.properties;
        } else if (Array.isArray(result)) {
          this.properties = result;
        } else {
          this.properties = [];
          this.properties = [];
        }
      } else {
        this.properties = [];
      }

      if (tenantsResponse.ok) {
        const result = await tenantsResponse.json();
        // API returns { success: true, tenants: [...] } or { data: [...] }
        if (result.success && result.tenants) {
          this.tenants = result.tenants;
        } else if (result.data && Array.isArray(result.data)) {
          this.tenants = result.data;
        } else if (Array.isArray(result.tenants)) {
          this.tenants = result.tenants;
        } else if (Array.isArray(result)) {
          this.tenants = result;
        } else {
          this.tenants = [];
        }
      } else {
        this.tenants = [];
      }

      // Check investor restrictions
      const investorPropertyIds = await getInvestorPropertyIds();
      if (investorPropertyIds && Array.isArray(this.properties)) {
        // Filter properties for investor
        this.properties = this.properties.filter((p) =>
          investorPropertyIds.includes(p.propertyId),
        );
      }

      // Sort properties by propertyId
      if (Array.isArray(this.properties) && this.properties.length > 0) {
        this.properties.sort((a, b) =>
          a.propertyId.localeCompare(b.propertyId),
        );
      }

      this.isLoading = false;
      this.render();
    } catch (error) {
      console.error("Error loading tenancy occupancy data:", error);
      this.isLoading = false;
      this.renderError();
    }
  }

  /**
   * Render loading state
   */
  renderLoadingState() {
    const container = document.getElementById("tenancyOccupancyContainer");
    if (!container) return;

    container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">${i18next.t("tenancyOccupancy.loading", "Loading...")}</span>
                </div>
                <p class="mt-3 text-muted">${i18next.t("tenancyOccupancy.loadingData", "Loading occupancy data...")}</p>
            </div>
        `;

    // Update property filter options (will show "No properties available" until data loads)
    this.renderPropertyCards();
    this.updatePropertyFilterLabel();
  }

  /**
   * Render error state
   */
  renderError() {
    const container = document.getElementById("tenancyOccupancyContainer");
    if (!container) return;

    container.innerHTML = `
            <div class="text-center text-danger py-5">
                <i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i>
                <p class="fs-6">${i18next.t("tenancyOccupancy.error", "Error loading occupancy data. Please try again.")}</p>
                <button class="btn btn-primary btn-sm" onclick="tenancyOccupancyComponent.loadData()">
                    <i class="bi bi-arrow-clockwise me-1"></i>${i18next.t("tenancyOccupancy.retry", "Retry")}
                </button>
            </div>
        `;
  }

  /**
   * Main render function
   */
  render() {
    const container = document.getElementById("tenancyOccupancyContainer");

    if (!container) {
      console.error("[DEBUG] tenancyOccupancyContainer not found!");
      return;
    }

    // Update year display
    this.updateYearDisplay();

    // Initialize selected properties to all if not set (first load only)
    if (this.selectedProperties.size === 0 && this.properties.length > 0) {
      this.properties.forEach((property) => {
        this.selectedProperties.add(property.propertyId);
      });
    } else {
      // Filter out any selected properties that are no longer available
      const beforeFilter = this.selectedProperties.size;
      const availableIds = new Set(this.properties.map((p) => p.propertyId));
      for (const id of this.selectedProperties) {
        if (!availableIds.has(id)) {
          this.selectedProperties.delete(id);
        }
      }
      const afterFilter = this.selectedProperties.size;
      if (beforeFilter !== afterFilter) {
        // Properties were filtered out
      }
    }

    // Update property filter options
    this.renderPropertyCards();
    this.updatePropertyFilterLabel();

    if (this.properties.length === 0) {
      container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-building fs-1 d-block mb-3"></i>
                    <p class="fs-6">${i18next.t("tenancyOccupancy.noProperties", "No properties found.")}</p>
                </div>
            `;
      return;
    }

    this.renderTimelines();
  }

  /**
   * Render all property timelines
   */
  renderTimelines() {
    const container = document.getElementById("tenancyOccupancyContainer");
    if (!container) return;

    let html = "";

    // Filter properties based on selection
    const filteredProperties =
      this.selectedProperties.size === 0
        ? this.properties
        : this.properties.filter((property) =>
            this.selectedProperties.has(property.propertyId),
          );

    // Render a timeline section for each filtered property
    filteredProperties.forEach((property, index) => {
      const propertyTenants = this.getPropertyTenants(property.propertyId);
      html += this.renderPropertySection(property, propertyTenants, index);
    });

    container.innerHTML = html;
  }

  /**
   * Get tenants for a specific property with occupancy in current year
   */
  getPropertyTenants(propertyId) {
    if (!this.tenants || this.tenants.length === 0) return [];

    const yearStart = new Date(this.currentYear, 0, 1);
    const yearEnd = new Date(this.currentYear, 11, 31, 23, 59, 59);

    return this.tenants
      .map((tenant) => {
        // Find the property assignment for the selected property
        const propertyAssignment = tenant.properties?.find(
          (p) => p.propertyId === propertyId,
        );

        if (!propertyAssignment || !propertyAssignment.moveinDate) {
          return null;
        }

        const moveinDate = new Date(propertyAssignment.moveinDate);
        const moveoutDate = propertyAssignment.moveoutDate
          ? new Date(propertyAssignment.moveoutDate)
          : null; // null means still residing

        // Check if occupancy overlaps with current year
        const occupancyStart = moveinDate;
        const occupancyEnd = moveoutDate || new Date(); // Use today if no moveout date

        // Skip if occupancy doesn't overlap with current year
        if (occupancyEnd < yearStart || occupancyStart > yearEnd) {
          return null;
        }

        return {
          ...tenant,
          moveinDate: propertyAssignment.moveinDate,
          moveoutDate: propertyAssignment.moveoutDate,
          room: propertyAssignment.room,
          isMainTenant: propertyAssignment.isMainTenant,
          leavePlans: propertyAssignment.leavePlans || [],
          propertyId: propertyAssignment.propertyId,
        };
      })
      .filter((t) => t !== null && t.room) // Filter out tenants without a room
      .sort((a, b) => new Date(a.moveinDate) - new Date(b.moveinDate));
  }

  /**
   * Render a single property section with its timeline
   */
  renderPropertySection(property, tenants, index) {
    const propertyLabel = property.unit
      ? `${property.propertyId} - ${property.unit}`
      : property.propertyId;

    const address = property.address || "";
    const tenantCount = tenants.length;
    const currentTenants = tenants.filter((t) => !t.moveoutDate).length;

    // Determine badge color based on occupancy
    let badgeClass = "bg-secondary";
    if (currentTenants > 0) {
      badgeClass = "bg-success";
    }

    let timelineHtml = "";
    if (tenants.length === 0) {
      timelineHtml = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-calendar-x fs-3 d-block mb-2"></i>
                    <p class="small mb-0">${i18next.t("tenancyOccupancy.noTenants", "No tenant occupancy data for {{year}}").replace("{{year}}", this.currentYear)}</p>
                </div>
            `;
    } else {
      timelineHtml = this.generateCalendarHTML(tenants);
    }

    return `
            <div class="card mb-4 property-timeline-card" data-property-id="${property.propertyId}">
                <div class="card-header d-flex justify-content-between align-items-center bg-light">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-building text-primary"></i>
                        <div>
                            <h6 class="mb-0 fw-bold">${this.escapeHtml(propertyLabel)}</h6>
                            ${address ? `<small class="text-muted">${this.escapeHtml(address)}</small>` : ""}
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge ${badgeClass}" title="${i18next.t("tenancyOccupancy.currentTenants", "Current tenants")}: ${currentTenants}">
                            <i class="bi bi-people-fill me-1"></i>${currentTenants} ${i18next.t("tenancyOccupancy.active", "active")}
                        </span>
                        <span class="badge bg-secondary" title="${i18next.t("tenancyOccupancy.totalInYear", "Total in {{year}}").replace("{{year}}", this.currentYear)}">
                            ${tenantCount} ${i18next.t("tenancyOccupancy.total", "total")}
                        </span>
                    </div>
                </div>
                <div class="card-body p-3" style="overflow-x: auto">
                    ${timelineHtml}
                </div>
            </div>
        `;
  }

  /**
   * Calculate today marker position as percentage
   */
  getTodayMarkerPosition() {
    const today = new Date();
    const todayYear = today.getFullYear();

    // Only show marker if viewing current year
    if (todayYear !== this.currentYear) {
      return null;
    }

    const yearStart = new Date(this.currentYear, 0, 1);
    const yearEnd = new Date(this.currentYear, 11, 31);
    const totalDaysInYear =
      Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24)) + 1;
    const daysFromYearStart = Math.floor(
      (today - yearStart) / (1000 * 60 * 60 * 24),
    );

    return (daysFromYearStart / totalDaysInYear) * 100;
  }

  /**
   * Generate the calendar HTML with timeline bars
   */
  generateCalendarHTML(tenants) {
    const months = [
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

    // Calculate the number of days in each month for current year
    const daysInMonths = months.map((_, index) =>
      new Date(this.currentYear, index + 1, 0).getDate(),
    );

    const totalDaysInYear = daysInMonths.reduce((sum, days) => sum + days, 0);

    // Calculate today marker position
    const todayPosition = this.getTodayMarkerPosition();
    const today = new Date();
    const todayFormatted = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const todayMarkerHtml =
      todayPosition !== null
        ? `
            <div class="today-marker" style="left: ${todayPosition}%;" title="${i18next.t("tenancyOccupancy.today", "Today")} - ${todayFormatted}">
                <div class="today-marker-line"></div>
                <div class="today-marker-label">${todayFormatted}</div>
            </div>
        `
        : "";

    let html = `
            <div class="tenant-timeline-calendar" style="position: relative;">
                ${todayMarkerHtml}
                <!-- Month Headers -->
                <div class="calendar-header">
                    <div class="tenant-name-column">${i18next.t("tenancyOccupancy.tenant", "Tenant")}</div>
                    <div class="timeline-container" style="position: relative;">
        `;

    // Render month headers
    daysInMonths.forEach((days, index) => {
      const widthPercent = (days / totalDaysInYear) * 100;
      html += `
                <div class="month-header" style="width: ${widthPercent}%;">
                    <span class="month-name">${months[index]}</span>
                    <span class="month-year">${this.currentYear}</span>
                </div>
            `;
    });

    html += `
                    </div>
                </div>

                <!-- Tenant Rows -->
                <div class="calendar-rows">
        `;

    // Render each tenant as a row
    tenants.forEach((tenant, index) => {
      html += this.generateTenantRow(
        tenant,
        index,
        totalDaysInYear,
        daysInMonths,
      );
    });

    html += `
                </div>
            </div>
        `;

    return html;
  }

  /**
   * Generate a single tenant row with occupancy bar
   */
  generateTenantRow(tenant, index, totalDaysInYear, daysInMonths) {
    const moveinDate = new Date(tenant.moveinDate);
    const moveoutDate = tenant.moveoutDate
      ? new Date(tenant.moveoutDate)
      : null;

    // Calculate bar position and width
    const yearStart = new Date(this.currentYear, 0, 1);
    const yearEnd = new Date(this.currentYear, 11, 31);

    // Clamp dates to current year
    const barStart = moveinDate < yearStart ? yearStart : moveinDate;
    const barEnd = moveoutDate && moveoutDate < yearEnd ? moveoutDate : yearEnd;

    // Calculate position from year start
    const daysFromYearStart = Math.floor(
      (barStart - yearStart) / (1000 * 60 * 60 * 24),
    );
    const barDuration =
      Math.ceil((barEnd - barStart) / (1000 * 60 * 60 * 24)) + 1;

    const leftPercent = (daysFromYearStart / totalDaysInYear) * 100;
    const widthPercent = (barDuration / totalDaysInYear) * 100;

    // Determine bar color based on status
    const today = new Date();
    const fortyDaysFromNow = new Date(
      today.getTime() + 40 * 24 * 60 * 60 * 1000,
    );

    let barColor = "#667eea"; // Default blue
    let isFutureMoveout = false;
    if (!tenant.moveoutDate) {
      barColor = "#48bb78"; // Green for current tenants
    } else if (moveoutDate && moveoutDate < today) {
      barColor = "#a0aec0"; // Gray for past tenants
    } else if (
      moveoutDate &&
      moveoutDate >= today &&
      moveoutDate <= fortyDaysFromNow
    ) {
      barColor = "#ef4444"; // Red for tenants moving out within 40 days (Sắp trả phòng)
      isFutureMoveout = true;
    }

    // Format dates for tooltip
    const formatDate = (date) => {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const moveinStr = formatDate(moveinDate);
    const moveoutStr = moveoutDate
      ? formatDate(moveoutDate)
      : i18next.t("tenancyOccupancy.present", "Present");
    const duration = moveoutDate
      ? Math.ceil((moveoutDate - moveinDate) / (1000 * 60 * 60 * 24))
      : Math.ceil((new Date() - moveinDate) / (1000 * 60 * 60 * 24));

    // Get display name for room type
    const roomDisplayName = tenant.room
      ? getRoomTypeDisplayName(tenant.room)
      : "N/A";

    // Generate avatar HTML
    const displayName = tenant.nickname || tenant.name;
    let avatarHtml = "";
    if (tenant.avatar) {
      avatarHtml = `<img src="${this.escapeHtml(tenant.avatar)}" alt="${this.escapeHtml(displayName)}" class="tenant-avatar">`;
    } else {
      const initial = displayName.charAt(0).toUpperCase();
      avatarHtml = `<div class="tenant-avatar-placeholder">${this.escapeHtml(initial)}</div>`;
    }

    // Generate social media badges
    let socialBadgesHtml = "";
    if (tenant.facebookUrl) {
      socialBadgesHtml += `<a href="${this.escapeHtml(tenant.facebookUrl)}" target="_blank" rel="noopener noreferrer" class="social-badge facebook-badge" title="Facebook"><i class="bi bi-facebook"></i></a>`;
    }
    if (tenant.phoneNumber) {
      const cleanPhone = tenant.phoneNumber.replace(/[^0-9]/g, "");
      socialBadgesHtml += `<a href="https://wa.me/${cleanPhone}" target="_blank" rel="noopener noreferrer" class="social-badge whatsapp-badge" title="WhatsApp"><i class="bi bi-whatsapp"></i></a>`;
    }

    // Format move-out date for display (short format for badge)
    const formatShortDate = (date) => {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };

    // Generate move-in date badge
    const shortMoveinStr = formatShortDate(moveinDate);
    const moveinBadgeHtml = `
                <div class="movein-date-marker" title="${i18next.t("tenancyOccupancy.moveIn", "Move-in")}: ${moveinStr}">
                    <i class="bi bi-box-arrow-in-right"></i>
                    <span class="movein-date-text">${this.escapeHtml(shortMoveinStr)}</span>
                </div>
            `;

    // Generate move-out date badge if tenant has moved out
    let moveoutBadgeHtml = "";
    if (tenant.moveoutDate && moveoutDate) {
      const shortMoveoutStr = formatShortDate(moveoutDate);
      moveoutBadgeHtml = `
                <div class="moveout-date-marker" title="${i18next.t("tenancyOccupancy.moveOut", "Move-out")}: ${moveoutStr}">
                    <i class="bi bi-box-arrow-right"></i>
                    <span class="moveout-date-text">${this.escapeHtml(shortMoveoutStr)}</span>
                </div>
            `;
    }

    const durationText = i18next.t("tenancyOccupancy.duration", "Duration");
    const daysText = i18next.t("tenancyOccupancy.days", "days");

    // Generate leave plan intervals (yellow bars)
    let leavePlansHtml = "";
    let totalLeaveDays = 0;

    if (tenant.leavePlans && tenant.leavePlans.length > 0) {
      tenant.leavePlans.forEach((leavePlan) => {
        const lpStart = new Date(leavePlan.startDate);
        const lpEnd = new Date(leavePlan.endDate);

        // Only show leave plans that overlap with current year
        if (lpEnd < yearStart || lpStart > yearEnd) return;

        // Clamp to current year
        const clampedStart = lpStart < yearStart ? yearStart : lpStart;
        const clampedEnd = lpEnd > yearEnd ? yearEnd : lpEnd;

        // Calculate position and width
        const lpDaysFromYearStart = Math.floor(
          (clampedStart - yearStart) / (1000 * 60 * 60 * 24),
        );
        const lpDuration =
          Math.ceil((clampedEnd - clampedStart) / (1000 * 60 * 60 * 24)) + 1;
        totalLeaveDays += lpDuration;

        const lpLeftPercent = (lpDaysFromYearStart / totalDaysInYear) * 100;
        const lpWidthPercent = (lpDuration / totalDaysInYear) * 100;

        const lpStartStr = formatDate(lpStart);
        const lpEndStr = formatDate(lpEnd);
        const reasonText = leavePlan.reason
          ? `\n${i18next.t("tenancyOccupancy.reason", "Reason")}: ${leavePlan.reason}`
          : "";

        const reasonHtml = leavePlan.reason
          ? `<div class="leave-plan-tooltip-reason">
               <i class="bi bi-chat-left-text"></i>
               <span>${this.escapeHtml(leavePlan.reason)}</span>
             </div>`
          : "";

        leavePlansHtml += `
                    <div class="leave-plan-bar"
                        data-leave-plan-id="${leavePlan.id}"
                        data-tenant-id="${tenant._id}"
                        data-property-id="${tenant.propertyId}"
                        style="left: ${lpLeftPercent}%; width: ${lpWidthPercent}%;"
                        onclick="tenancyOccupancyComponent.openLeavePlanModal('${tenant._id}', '${tenant.propertyId}', '${leavePlan.id}')">
                        <div class="leave-plan-tooltip">
                            <div class="leave-plan-tooltip-header">
                                <i class="bi bi-luggage-fill"></i>
                                <span>${i18next.t("tenancyOccupancy.leavePlan", "Leave/Holiday")}</span>
                            </div>
                            <div class="leave-plan-tooltip-dates">
                                <i class="bi bi-calendar-event"></i>
                                <span>${lpStartStr} - ${lpEndStr}</span>
                            </div>
                            <div class="leave-plan-tooltip-duration">
                                <i class="bi bi-clock"></i>
                                <span>${lpDuration} ${daysText}</span>
                            </div>
                            ${reasonHtml}
                        </div>
                        <span class="leave-plan-delete-btn"
                            title="${i18next.t("tenancyOccupancy.delete", "Delete")}"
                            onclick="event.stopPropagation(); tenancyOccupancyComponent.deleteLeavePlanQuick('${tenant._id}', '${tenant.propertyId}', '${leavePlan.id}')">
                            <i class="bi bi-x-lg"></i>
                        </span>
                    </div>
                `;
      });
    }

    // Add leave days badge if any
    const leaveDaysBadgeHtml =
      totalLeaveDays > 0
        ? `
            <span class="leave-days-badge" title="${i18next.t("tenancyOccupancy.totalLeaveDays", "Total leave days")}: ${totalLeaveDays}">
                <i class="bi bi-luggage"></i> ${totalLeaveDays}
            </span>
        `
        : "";

    // Add leave plan button
    const addLeavePlanBtnHtml = `
            <button class="add-leave-plan-btn"
                title="${i18next.t("tenancyOccupancy.addLeavePlanTooltip", "Add away days when tenant is on holiday or away from home. This will be deducted from utility expenses.")}"
                onclick="tenancyOccupancyComponent.openLeavePlanModal('${tenant._id}', '${tenant.propertyId}')">
                <i class="bi bi-luggage-fill me-1"></i>${i18next.t("tenancyOccupancy.awayDays", "Away")}
            </button>
        `;

    return `
            <div class="tenant-row">
                <div class="tenant-name-column">
                    <div class="tenant-info-wrapper">
                        ${avatarHtml}
                        <div class="tenant-info">
                            <div class="tenant-name-text">${this.escapeHtml(displayName)} ${leaveDaysBadgeHtml}</div>
                            <div class="tenant-room-text">${roomDisplayName}</div>
                        </div>
                        <div class="tenant-actions-column">
                            ${socialBadgesHtml ? `<div class="tenant-social-badges">${socialBadgesHtml}</div>` : ""}
                            ${addLeavePlanBtnHtml}
                        </div>
                    </div>
                </div>
                <div class="timeline-container">
                    <div
                        class="occupancy-bar ${!tenant.moveoutDate ? "current-tenant" : ""} ${isFutureMoveout ? "future-moveout" : ""}"
                        style="left: ${leftPercent}%; width: ${widthPercent}%; background-color: ${barColor};">
                        ${moveinBadgeHtml}
                        <span class="occupancy-bar-label" title="${this.escapeHtml(displayName)}&#10;${roomDisplayName}&#10;${i18next.t("tenancyOccupancy.moveIn", "Move-in")}: ${moveinStr}&#10;${i18next.t("tenancyOccupancy.moveOut", "Move-out")}: ${moveoutStr}&#10;${durationText}: ${duration} ${daysText}${totalLeaveDays > 0 ? `&#10;${i18next.t("tenancyOccupancy.totalLeaveDays", "Total leave days")}: ${totalLeaveDays}` : ""}">${this.escapeHtml(displayName)}</span>
                        ${moveoutBadgeHtml}
                        ${leavePlansHtml}
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Open leave plan modal for add/edit
   */
  openLeavePlanModal(tenantId, propertyId, leavePlanId = null) {
    // Find tenant data
    const tenant = this.tenants.find((t) => t._id === tenantId);
    if (!tenant) return;

    const propertyAssignment = tenant.properties?.find(
      (p) => p.propertyId === propertyId,
    );
    if (!propertyAssignment) return;

    // Find existing leave plan if editing
    let existingLeavePlan = null;
    if (leavePlanId && propertyAssignment.leavePlans) {
      existingLeavePlan = propertyAssignment.leavePlans.find(
        (lp) => lp.id === leavePlanId,
      );
    }

    const displayName = tenant.nickname || tenant.name;
    const isEdit = !!existingLeavePlan;
    const modalTitle = isEdit
      ? i18next.t("tenancyOccupancy.editLeavePlan", "Edit Leave Plan")
      : i18next.t("tenancyOccupancy.addLeavePlan", "Add Leave Plan");

    // Format dates for input
    const formatDateForInput = (dateStr) => {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      return date.toISOString().split("T")[0];
    };

    const startDateValue = existingLeavePlan
      ? formatDateForInput(existingLeavePlan.startDate)
      : "";
    const endDateValue = existingLeavePlan
      ? formatDateForInput(existingLeavePlan.endDate)
      : "";
    const reasonValue = existingLeavePlan?.reason || "";

    // Create modal HTML
    const modalHtml = `
            <div class="modal fade" id="leavePlanModal" tabindex="-1" aria-labelledby="leavePlanModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="leavePlanModalLabel">
                                <i class="bi bi-luggage me-2"></i>${modalTitle}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold">${i18next.t("tenancyOccupancy.tenant", "Tenant")}</label>
                                <div class="form-control-plaintext">${this.escapeHtml(displayName)}</div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label for="leavePlanStartDate" class="form-label">${i18next.t("tenancyOccupancy.startDate", "Start Date")} *</label>
                                    <input type="date" class="form-control" id="leavePlanStartDate" value="${startDateValue}" required>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label for="leavePlanEndDate" class="form-label">${i18next.t("tenancyOccupancy.endDate", "End Date")} *</label>
                                    <input type="date" class="form-control" id="leavePlanEndDate" value="${endDateValue}" required>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="leavePlanReason" class="form-label">${i18next.t("tenancyOccupancy.reason", "Reason")}</label>
                                <input type="text" class="form-control" id="leavePlanReason" value="${this.escapeHtml(reasonValue)}"
                                    placeholder="${i18next.t("tenancyOccupancy.reasonPlaceholder", "e.g., Holiday, Family visit")}" maxlength="200">
                            </div>
                        </div>
                        <div class="modal-footer">
                            ${
                              isEdit
                                ? `
                                <button type="button" class="btn btn-danger me-auto" onclick="tenancyOccupancyComponent.deleteLeavePlan('${tenantId}', '${propertyId}', '${leavePlanId}')">
                                    <i class="bi bi-trash me-1"></i>${i18next.t("tenancyOccupancy.delete", "Delete")}
                                </button>
                            `
                                : ""
                            }
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">${i18next.t("tenancyOccupancy.cancel", "Cancel")}</button>
                            <button type="button" class="btn btn-primary" onclick="tenancyOccupancyComponent.saveLeavePlan('${tenantId}', '${propertyId}', ${isEdit ? `'${leavePlanId}'` : "null"})">
                                <i class="bi bi-check-lg me-1"></i>${i18next.t("tenancyOccupancy.save", "Save")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    // Remove existing modal if any
    const existingModal = document.getElementById("leavePlanModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("leavePlanModal"),
    );
    modal.show();

    // Clean up when modal is hidden
    document
      .getElementById("leavePlanModal")
      .addEventListener("hidden.bs.modal", function () {
        this.remove();
      });
  }

  /**
   * Save leave plan (add or update)
   */
  async saveLeavePlan(tenantId, propertyId, leavePlanId = null) {
    const startDate = document.getElementById("leavePlanStartDate").value;
    const endDate = document.getElementById("leavePlanEndDate").value;
    const reason = document.getElementById("leavePlanReason").value.trim();

    // Validate
    if (!startDate || !endDate) {
      window.showToast &&
        window.showToast(
          i18next.t(
            "tenancyOccupancy.datesRequired",
            "Start and end dates are required",
          ),
          "error",
        );
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      window.showToast &&
        window.showToast(
          i18next.t(
            "tenancyOccupancy.invalidDateRange",
            "Start date must be before end date",
          ),
          "error",
        );
      return;
    }

    try {
      const isEdit = !!leavePlanId;
      const url = isEdit
        ? `${API_CONFIG.ENDPOINTS.TENANTS}/${tenantId}/properties/${propertyId}/leave-plans/${leavePlanId}`
        : `${API_CONFIG.ENDPOINTS.TENANTS}/${tenantId}/properties/${propertyId}/leave-plans`;

      const response = await API[isEdit ? "put" : "post"](url, {
        startDate,
        endDate,
        reason: reason || undefined,
      });

      if (response.ok) {
        const result = await response.json();

        // Close modal
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("leavePlanModal"),
        );
        modal.hide();

        // Update local tenant data
        this.updateTenantLeavePlan(
          tenantId,
          propertyId,
          result.leavePlan,
          isEdit,
        );

        // Re-render only the affected property section
        this.rerenderPropertySection(propertyId);

        // Show success message
        window.showToast &&
          window.showToast(
            isEdit
              ? i18next.t(
                  "tenancyOccupancy.leavePlanUpdated",
                  "Leave plan updated successfully",
                )
              : i18next.t(
                  "tenancyOccupancy.leavePlanAdded",
                  "Leave plan added successfully",
                ),
            "success",
          );
      } else {
        const error = await response.json();
        window.showToast &&
          window.showToast(
            error.error ||
              i18next.t(
                "tenancyOccupancy.saveFailed",
                "Failed to save leave plan",
              ),
            "error",
          );
      }
    } catch (error) {
      console.error("Error saving leave plan:", error);
      window.showToast &&
        window.showToast(
          i18next.t("tenancyOccupancy.saveFailed", "Failed to save leave plan"),
          "error",
        );
    }
  }

  /**
   * Delete leave plan
   */
  async deleteLeavePlan(tenantId, propertyId, leavePlanId) {
    if (
      !confirm(
        i18next.t(
          "tenancyOccupancy.confirmDelete",
          "Are you sure you want to delete this leave plan?",
        ),
      )
    ) {
      return;
    }

    try {
      const url = `${API_CONFIG.ENDPOINTS.TENANTS}/${tenantId}/properties/${propertyId}/leave-plans/${leavePlanId}`;
      const response = await API.delete(url);

      if (response.ok) {
        // Close modal
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("leavePlanModal"),
        );
        modal.hide();

        // Remove leave plan from local tenant data
        this.removeTenantLeavePlan(tenantId, propertyId, leavePlanId);

        // Re-render only the affected property section
        this.rerenderPropertySection(propertyId);

        // Show success message
        window.showToast &&
          window.showToast(
            i18next.t(
              "tenancyOccupancy.leavePlanDeleted",
              "Leave plan deleted successfully",
            ),
            "success",
          );
      } else {
        const error = await response.json();
        window.showToast &&
          window.showToast(
            error.error ||
              i18next.t(
                "tenancyOccupancy.deleteFailed",
                "Failed to delete leave plan",
              ),
            "error",
          );
      }
    } catch (error) {
      console.error("Error deleting leave plan:", error);
      window.showToast &&
        window.showToast(
          i18next.t(
            "tenancyOccupancy.deleteFailed",
            "Failed to delete leave plan",
          ),
          "error",
        );
    }
  }

  /**
   * Quick delete leave plan directly from yellow bar (without modal)
   */
  async deleteLeavePlanQuick(tenantId, propertyId, leavePlanId) {
    if (
      !confirm(
        i18next.t(
          "tenancyOccupancy.confirmDelete",
          "Are you sure you want to delete this leave plan?",
        ),
      )
    ) {
      return;
    }

    try {
      const url = `${API_CONFIG.ENDPOINTS.TENANTS}/${tenantId}/properties/${propertyId}/leave-plans/${leavePlanId}`;
      const response = await API.delete(url);

      if (response.ok) {
        // Remove leave plan from local tenant data
        this.removeTenantLeavePlan(tenantId, propertyId, leavePlanId);

        // Re-render only the affected property section
        this.rerenderPropertySection(propertyId);

        // Show success message
        window.showToast &&
          window.showToast(
            i18next.t(
              "tenancyOccupancy.leavePlanDeleted",
              "Leave plan deleted successfully",
            ),
            "success",
          );
      } else {
        const error = await response.json();
        window.showToast &&
          window.showToast(
            error.error ||
              i18next.t(
                "tenancyOccupancy.deleteFailed",
                "Failed to delete leave plan",
              ),
            "error",
          );
      }
    } catch (error) {
      console.error("Error deleting leave plan:", error);
      window.showToast &&
        window.showToast(
          i18next.t(
            "tenancyOccupancy.deleteFailed",
            "Failed to delete leave plan",
          ),
          "error",
        );
    }
  }

  /**
   * Update tenant leave plan in local data
   */
  updateTenantLeavePlan(tenantId, propertyId, leavePlan, isEdit) {
    const tenant = this.tenants.find((t) => t._id === tenantId);
    if (!tenant) return;

    const propertyAssignment = tenant.properties?.find(
      (p) => p.propertyId === propertyId,
    );
    if (!propertyAssignment) return;

    if (!propertyAssignment.leavePlans) {
      propertyAssignment.leavePlans = [];
    }

    if (isEdit) {
      // Update existing leave plan
      const index = propertyAssignment.leavePlans.findIndex(
        (lp) => lp.id === leavePlan.id,
      );
      if (index !== -1) {
        propertyAssignment.leavePlans[index] = leavePlan;
      }
    } else {
      // Add new leave plan
      propertyAssignment.leavePlans.push(leavePlan);
    }
  }

  /**
   * Remove tenant leave plan from local data
   */
  removeTenantLeavePlan(tenantId, propertyId, leavePlanId) {
    const tenant = this.tenants.find((t) => t._id === tenantId);
    if (!tenant) return;

    const propertyAssignment = tenant.properties?.find(
      (p) => p.propertyId === propertyId,
    );
    if (!propertyAssignment || !propertyAssignment.leavePlans) return;

    const index = propertyAssignment.leavePlans.findIndex(
      (lp) => lp.id === leavePlanId,
    );
    if (index !== -1) {
      propertyAssignment.leavePlans.splice(index, 1);
    }
  }

  /**
   * Re-render only a specific property section
   */
  rerenderPropertySection(propertyId) {
    const property = this.properties.find((p) => p.propertyId === propertyId);
    if (!property) return;

    const propertyCard = document.querySelector(
      `.property-timeline-card[data-property-id="${propertyId}"]`,
    );
    if (!propertyCard) return;

    const propertyTenants = this.getPropertyTenants(propertyId);
    const cardBody = propertyCard.querySelector(".card-body");

    if (cardBody) {
      if (propertyTenants.length === 0) {
        cardBody.innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-calendar-x fs-3 d-block mb-2"></i>
                        <p class="small mb-0">${i18next.t("tenancyOccupancy.noTenants", "No tenant occupancy data for {{year}}").replace("{{year}}", this.currentYear)}</p>
                    </div>
                `;
      } else {
        cardBody.innerHTML = this.generateCalendarHTML(propertyTenants);
      }
    }

    // Update the badge counts in the header
    const currentTenants = propertyTenants.filter((t) => !t.moveoutDate).length;
    const activeBadge = propertyCard.querySelector(
      ".badge.bg-success, .badge.bg-secondary",
    );
    if (activeBadge) {
      activeBadge.innerHTML = `<i class="bi bi-people-fill me-1"></i>${currentTenants} ${i18next.t("tenancyOccupancy.active", "active")}`;
      activeBadge.className =
        currentTenants > 0 ? "badge bg-success" : "badge bg-secondary";
    }

    const totalBadge = propertyCard.querySelectorAll(".badge")[1];
    if (totalBadge) {
      totalBadge.textContent = `${propertyTenants.length} ${i18next.t("tenancyOccupancy.total", "total")}`;
    }
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
}

// Initialize the component
const tenancyOccupancyComponent = new TenancyOccupancyComponent();
console.log(
  "[DEBUG] TenancyOccupancyComponent initialized:",
  tenancyOccupancyComponent,
);

// Make it available globally
window.tenancyOccupancyComponent = tenancyOccupancyComponent;
console.log(
  "[DEBUG] tenancyOccupancyComponent attached to window:",
  window.tenancyOccupancyComponent,
);
