import * as XLSX from "xlsx";
import {
  getRoomTypeDisplayName,
  getRoomTypeOptions,
} from "../utils/room-type-mapper.js";
import { renderTenantSocialBadges } from "../utils/social-links.js";

/**
 * Tenant Management Component (v2 - fixed update endpoint)
 * Handles tenant CRUD operations
 */
class TenantManagementComponent {
  constructor() {
    this.tenants = [];
    this.selectedProperty = null; // Currently selected property for filtering tenants
    this.properties = []; // List of all properties for navigation
    this.selectedProperties = [];
    this.selectedPropertiesDetails = []; // Initialize property details array
    this.originalPropertiesDetails = []; // Store original properties for edit mode fallback
    this.propertiesCache = null; // Cache for properties
    this.propertiesCacheTime = null;
    this.cacheTimeout = 30000; // Cache for 30 seconds
    this.passportPics = []; // Array of passport image URLs
    this.visaPics = []; // Array of visa image URLs
    this.avatar = ""; // Single avatar image URL
    this.signature = ""; // Signature image URL
    this.originalTenantData = null; // Store original tenant data for change detection
    this.todos = []; // Array of todo items

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupAdminControls();
    // Load properties to display property cards
    this.loadProperties();
  }

  // Call this when section becomes visible to ensure listeners are attached
  ensureEventListeners() {
    this.setupEventListeners();
  }

  setupAdminControls() {
    // Hide/disable upload button for non-admin users
    const uploadBtn = document.querySelector(
      'button[onclick*="tenantExcelUpload"]',
    );
    if (uploadBtn && !isAdmin()) {
      uploadBtn.style.display = "none";
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
          console.error("Failed to load properties:", result.error);
          hasMorePages = false;
        }
      }

      this.properties = allProperties;

      // Filter properties if current user is an investor
      await this.filterPropertiesByInvestor();

      this.renderPropertyCards(this.properties);
    } catch (error) {
      console.error("Error loading properties:", error);
      this.renderPropertyCards([]);
    }
  }

  async filterPropertiesByInvestor() {
    try {
      console.log("🔄 [Tenants] Starting property filter check...");
      const investorPropertyIds = await getInvestorPropertyIds();
      console.log(
        "📋 [Tenants] Investor property IDs result:",
        investorPropertyIds,
      );

      // If null, user is not an investor - show all properties
      if (investorPropertyIds === null) {
        console.log(
          "ℹ️ [Tenants] User is not an investor, showing all properties",
        );
        return;
      }

      // Filter to show only investor's properties
      console.log(
        "🔍 [Tenants] Filtering properties for investor:",
        investorPropertyIds,
      );
      const originalCount = this.properties.length;
      console.log(
        "📦 [Tenants] Properties before filter:",
        this.properties.map((p) => p.propertyId),
      );
      this.properties = this.properties.filter((property) =>
        investorPropertyIds.includes(property.propertyId),
      );
      console.log(
        `📊 [Tenants] Filtered properties: ${originalCount} → ${this.properties.length}`,
      );
      console.log(
        "📦 [Tenants] Properties after filter:",
        this.properties.map((p) => p.propertyId),
      );
    } catch (error) {
      console.error(
        "❌ [Tenants] Error filtering properties by investor:",
        error,
      );
      // Don't throw - just log and continue with all properties
    }
  }

  renderPropertyCards(properties) {
    const container = document.getElementById("tenantPropertyCards");
    if (!container) {
      console.warn("tenantPropertyCards container not found");
      return;
    }

    // Set container to use CSS Grid — compact cards, ~10 per row on wide screens
    container.style.display = "grid";
    container.style.gridTemplateColumns =
      "repeat(auto-fill, minmax(120px, 1fr))";
    container.style.gap = "0.5rem";
    container.style.maxWidth = "100%";

    // Clear existing cards
    container.innerHTML = "";

    if (!properties || properties.length === 0) {
      container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center;" class="text-muted py-4">
                    <i class="bi bi-building-slash me-2"></i>
                    No properties available
                </div>
            `;
      return;
    }

    // Add special card for unassigned tenants
    const isUnassignedSelected = this.selectedProperty === "UNASSIGNED";
    const unassignedCardHtml = `
            <div class="card property-card-compact ${isUnassignedSelected ? "border-warning selected-card" : "border-secondary"} overflow-hidden"
                 style="cursor: pointer; transition: all 0.2s ease;"
                 data-property-id="UNASSIGNED"
                 onclick="tenantManager.selectUnassignedTenants()">
                <div class="d-flex flex-column align-items-center justify-content-center p-2 bg-light" style="min-height: 80px; gap: 4px;">
                    <div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white"
                         style="width: 32px; height: 32px; font-size: 13px; flex-shrink: 0;">
                        <i class="bi bi-question-circle"></i>
                    </div>
                    <div class="text-center" style="line-height: 1.2;">
                        <div class="fw-bold" style="font-size: 11px;">Unassigned</div>
                        <div class="text-muted" style="font-size: 10px;">No Property</div>
                    </div>
                    <i data-role="unassigned-check" class="bi bi-check-circle-fill text-warning" style="font-size: 0.85rem; display: ${isUnassignedSelected ? "inline" : "none"};"></i>
                </div>
            </div>
        `;
    container.innerHTML += unassignedCardHtml;

    // Generate property cards
    properties.forEach((property) => {
      const isSelected = this.selectedProperty === property.propertyId;
      const cardHtml = `
                <div class="card property-card-compact ${isSelected ? "selected-card" : ""} overflow-hidden"
                     style="cursor: pointer; transition: all 0.2s ease;"
                     data-property-id="${property.propertyId}"
                     onclick="tenantManager.selectProperty('${property.propertyId}')">
                    ${property.propertyImage
          ? `<div data-role="property-image" style="height: 55px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; position: relative;">
                            <div data-role="selected-overlay" style="position: absolute; inset: 0; background: rgba(13,110,253,0.5); display: ${isSelected ? "flex" : "none"}; align-items: center; justify-content: center;"><i class="bi bi-check-circle-fill text-white" style="font-size: 1.4rem;"></i></div>
                          </div>`
          : ""
        }
                    <div data-role="card-body" class="d-flex flex-column align-items-center p-2" style="gap: 3px; background: ${isSelected ? "rgba(13,110,253,0.07)" : "#fff"};">
                        <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold"
                             style="width: 28px; height: 28px; font-size: 11px; flex-shrink: 0;">
                            ${this.escapeHtml(property.propertyId.toString().substring(0, 3))}
                        </div>
                        <div class="text-center" style="line-height: 1.2; width: 100%;">
                            <div class="fw-semibold text-truncate" style="font-size: 10px;" title="${this.escapeHtml(property.address)}">${this.escapeHtml(property.address)}</div>
                            <div class="text-muted text-truncate" style="font-size: 10px;">${this.escapeHtml(property.unit)}</div>
                        </div>
                        ${!property.propertyImage ? `<i data-role="no-image-check" class="bi bi-check-circle-fill text-primary" style="font-size: 0.9rem; display: ${isSelected ? "inline" : "none"};"></i>` : ""}
                    </div>
                </div>
            `;
      container.innerHTML += cardHtml;
    });

    // Add hover effects
    this.addPropertyNavigationCardStyles();
  }

  addPropertyNavigationCardStyles() {
    if (!document.getElementById("tenant-property-nav-card-styles")) {
      const style = document.createElement("style");
      style.id = "tenant-property-nav-card-styles";
      style.textContent = `
                .property-card-compact {
                    border-radius: 6px;
                    border: 1px solid #dee2e6;
                }
                .property-card-compact:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.15) !important;
                }
                .property-card-compact.selected-card {
                    border: 3px solid #0d6efd !important;
                    box-shadow: 0 0 0 3px rgba(13,110,253,0.2), 0 4px 12px rgba(13,110,253,0.25) !important;
                }
            `;
      document.head.appendChild(style);
    }
  }

  async selectProperty(propertyId) {
    // Don't reload if already selected
    if (this.selectedProperty === propertyId) {
      return;
    }

    this.selectedProperty = propertyId;

    // Only update the visual selection state without full re-render
    this.updatePropertyCardSelection(propertyId);

    // Sync URL — use resolved property object if available (from router deep-link)
    const property =
      this._slugResolvedProperty ||
      this.properties.find((p) => p.propertyId === propertyId);
    if (property) {
      const slug = window.SlugUtils.propertySlug(property);
      window.appRouter?.replace(`/tenants/${slug}`);
    }

    // Load tenants for this property
    await this.loadTenantsForProperty(propertyId);
  }

  async selectUnassignedTenants() {
    // Don't reload if already selected
    if (this.selectedProperty === "UNASSIGNED") {
      return;
    }

    this.selectedProperty = "UNASSIGNED";

    // Update visual selection
    this.updatePropertyCardSelection("UNASSIGNED");

    // Load unassigned tenants
    await this.loadUnassignedTenants();
  }

  updatePropertyCardSelection(propertyId) {
    const allCards = document.querySelectorAll(".property-card-compact");
    allCards.forEach((card) => {
      const cardPropId = card.dataset.propertyId || "";
      const isSelected = cardPropId === String(this.selectedProperty);

      if (cardPropId === "UNASSIGNED") {
        card.classList.toggle("border-warning", isSelected);
        card.classList.toggle("selected-card", isSelected);
        card.classList.toggle("border-secondary", !isSelected);
        const check = card.querySelector('[data-role="unassigned-check"]');
        if (check) check.style.display = isSelected ? "inline" : "none";
        return;
      }

      card.classList.toggle("selected-card", isSelected);

      const overlay = card.querySelector('[data-role="selected-overlay"]');
      if (overlay) overlay.style.display = isSelected ? "flex" : "none";

      const body = card.querySelector('[data-role="card-body"]');
      if (body) body.style.background = isSelected ? "rgba(13,110,253,0.07)" : "#fff";

      const check = card.querySelector('[data-role="no-image-check"]');
      if (check) check.style.display = isSelected ? "inline" : "none";
    });
  }

  async loadTenantsForProperty(propertyId) {
    try {
      console.log(`🔄 Loading tenants for property: ${propertyId}`);

      // Show loading skeleton while fetching data
      this.showLoadingSkeleton();

      // Use the property-specific endpoint to load only tenants for this property
      const response = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTY_TENANTS(propertyId),
      );
      const result = await response.json();

      // Handle different response formats
      if (result.success && result.data) {
        this.tenants = result.data;
      } else if (result.tenants && Array.isArray(result.tenants)) {
        this.tenants = result.tenants;
      } else if (Array.isArray(result)) {
        this.tenants = result;
      } else {
        console.error("Unexpected API response format:", result);
        this.tenants = [];
      }

      console.log(
        `✅ Loaded ${this.tenants.length} tenants for property ${propertyId}`,
      );

      // Ensure properties cache is loaded once
      if (!this.propertiesCache) {
        await this.loadPropertiesCache();
      }

      await this.renderTenantsTable();

      // Load tenants into calendar view
      if (window.tenantCalendar) {
        window.tenantCalendar.loadTenants(propertyId, this.tenants);
      }

      // Update sidebar badges
      if (window.updateSidebarBadges) {
        window.updateSidebarBadges();
      }
    } catch (error) {
      console.error("Error loading tenants for property:", error);
      this.showEmptyState("Error loading tenants. Please try again.");
    }
  }

  async loadUnassignedTenants() {
    try {
      console.log("🔄 Loading unassigned tenants...");

      // Show loading skeleton while fetching data
      this.showLoadingSkeleton();

      // Use server-side filter for unassigned tenants (much faster)
      const response = await API.get(
        `${API_CONFIG.ENDPOINTS.TENANTS}?unassigned=true&limit=10000`,
      );
      const result = await response.json();

      // Handle different response formats
      if (result.success && result.tenants) {
        this.tenants = result.tenants;
      } else if (result.tenants && Array.isArray(result.tenants)) {
        this.tenants = result.tenants;
      } else if (Array.isArray(result)) {
        this.tenants = result;
      } else {
        this.tenants = [];
      }

      console.log(`✅ Found ${this.tenants.length} unassigned tenants`);

      // Ensure properties cache is loaded once
      if (!this.propertiesCache) {
        await this.loadPropertiesCache();
      }

      await this.renderTenantsTable();

      // Clear calendar view for unassigned tenants (they have no occupancy)
      if (window.tenantCalendar) {
        window.tenantCalendar.loadTenants("UNASSIGNED", []);
      }

      // Update sidebar badges
      if (window.updateSidebarBadges) {
        window.updateSidebarBadges();
      }
    } catch (error) {
      console.error("Error loading unassigned tenants:", error);
      this.showEmptyState("Error loading tenants. Please try again.");
    }
  }

  // Helper method to get correct colspan based on screen size
  getTableColspan() {
    // Check if we're on mobile where 2 columns are hidden
    if (window.innerWidth <= 767.98) {
      return "5"; // 7 total columns - 2 hidden columns = 5 visible columns
    }
    return "7"; // Desktop: all columns visible
  }

  setupEventListeners() {
    // Add tenant button - use window.tenantManager to ensure correct instance
    const addTenantBtn = document.getElementById("addTenantBtn");
    if (addTenantBtn && !addTenantBtn._tenantListenerAttached) {
      addTenantBtn.addEventListener("click", () => {
        window.tenantManager?.showAddTenantModal();
      });
      addTenantBtn._tenantListenerAttached = true;
    }

    // Tenant form submission (add/edit)
    const tenantForm = document.getElementById("tenantForm");
    if (tenantForm && !tenantForm._tenantListenerAttached) {
      tenantForm.addEventListener("submit", (e) => {
        e.preventDefault();
        window.tenantManager?.handleTenantSubmit(e);
      });
      tenantForm._tenantListenerAttached = true;
    }

    // Search functionality
    const searchInput = document.getElementById("tenantSearchInput");
    if (searchInput && !searchInput._tenantListenerAttached) {
      searchInput.addEventListener("input", (e) => {
        window.tenantManager?.filterTenants(e.target.value);
      });
      searchInput._tenantListenerAttached = true;
    }

    // Set up clipboard paste functionality for image URL fields
    this.setupClipboardPasteListeners();

    // Set up change detection for edit mode
    this.setupChangeDetection();

    // Listen for window resize to update table colspan
    window.addEventListener("resize", () => {
      // Re-render the table when window size changes
      if (this.tenants && this.tenants.length > 0) {
        this.renderTenantsTable();
      }
    });
  }

  // Legacy method - now redirects to property-based loading
  async loadTenants() {
    console.warn("loadTenants() called - please use selectProperty() instead");
    // If a property is selected, reload it
    if (this.selectedProperty) {
      await this.loadTenantsForProperty(this.selectedProperty);
    } else {
      // Show message to select a property
      const tbody = document.getElementById("tenantsTableBody");
      if (tbody) {
        tbody.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="bi bi-building fs-1 d-block mb-3"></i>
                        <p class="fs-5">Please select a property to view tenants</p>
                    </div>
                `;
      }
    }
  }

  showLoadingSkeleton() {
    const tbody = document.getElementById("tenantsTableBody");
    if (!tbody) return;

    // Add shimmer animation styles if not already present
    if (!document.getElementById("tenant-skeleton-styles")) {
      const style = document.createElement("style");
      style.id = "tenant-skeleton-styles";
      style.textContent = `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }
        .skeleton-card {
          background: #fff;
          border: 1px solid #dee2e6;
          border-radius: 0.375rem;
          overflow: hidden;
        }
      `;
      document.head.appendChild(style);
    }

    // Create skeleton cards matching the tenant card layout
    const skeletonCount = 6; // Show 6 skeleton cards
    let html =
      '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 280px)); gap: 0.125rem; max-width: 100%;">';

    for (let i = 0; i < skeletonCount; i++) {
      html += `
        <div style="max-width: 260px; width: 100%; justify-self: center;">
          <div class="skeleton-card">
            <!-- Header skeleton -->
            <div class="d-flex align-items-center p-3 border-bottom" style="background: #f8f9fa;">
              <div class="skeleton-shimmer rounded-circle me-3" style="width: 50px; height: 50px; flex-shrink: 0;"></div>
              <div class="flex-grow-1">
                <div class="skeleton-shimmer mb-2" style="height: 16px; width: 70%;"></div>
                <div class="skeleton-shimmer" style="height: 12px; width: 50%;"></div>
              </div>
            </div>
            <!-- Body skeleton -->
            <div class="p-3">
              <div class="d-flex justify-content-between mb-2">
                <div class="skeleton-shimmer" style="height: 14px; width: 40%;"></div>
                <div class="skeleton-shimmer" style="height: 14px; width: 30%;"></div>
              </div>
              <div class="d-flex justify-content-between mb-2">
                <div class="skeleton-shimmer" style="height: 14px; width: 35%;"></div>
                <div class="skeleton-shimmer" style="height: 14px; width: 45%;"></div>
              </div>
              <div class="d-flex justify-content-between mb-3">
                <div class="skeleton-shimmer" style="height: 14px; width: 45%;"></div>
                <div class="skeleton-shimmer" style="height: 14px; width: 25%;"></div>
              </div>
              <!-- Badge skeleton -->
              <div class="d-flex gap-2">
                <div class="skeleton-shimmer" style="height: 22px; width: 60px; border-radius: 12px;"></div>
                <div class="skeleton-shimmer" style="height: 22px; width: 80px; border-radius: 12px;"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    html += "</div>";
    tbody.innerHTML = html;
  }

  async renderTenantsTable() {
    const tbody = document.getElementById("tenantsTableBody");
    if (!tbody) {
      console.error("tenantsTableBody element not found!");
      return;
    }

    if (!this.selectedProperty) {
      tbody.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-building fs-1 d-block mb-3"></i>
                    <p class="fs-5">Please select a property to view tenants</p>
                </div>
            `;
      return;
    }

    if (this.tenants.length === 0) {
      const message =
        this.selectedProperty === "UNASSIGNED"
          ? "No unassigned tenants found"
          : `No tenants found for ${this.selectedProperty}`;
      this.showEmptyState(message);
      return;
    }

    // Properties cache is already loaded in loadTenantsForProperty
    // Sort tenants: active tenants first, expired tenants last
    const sortedTenants = [...this.tenants].sort((a, b) => {
      const aIsOutdated = this.isTenantOutdated(a, this.selectedProperty);
      const bIsOutdated = this.isTenantOutdated(b, this.selectedProperty);

      // If one is outdated and the other isn't, sort accordingly
      if (aIsOutdated && !bIsOutdated) return 1; // a goes after b
      if (!aIsOutdated && bIsOutdated) return -1; // a goes before b

      // If both have the same status, maintain original order
      return 0;
    });

    // Group tenants by roommate relationships
    const tenantGroups = this.groupTenantsByRoommates(sortedTenants);

    // Create CSS Grid layout for single property with max-width 260px per card
    let html =
      '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 280px)); gap: 0.125rem; max-width: 100%;">';

    tenantGroups.forEach((group) => {
      if (group.length > 1) {
        // Render roommate group with special styling
        html += this.renderRoommateGroup(group);
      } else {
        // Render single tenant
        const tenant = group[0];
        html += this.renderSingleTenant(tenant);
      }
    });

    html += "</div>";
    tbody.innerHTML = html;

    // Update registered tenants badge
    this.updateRegisteredTenantsBadge();

    // Add card styles if not already present
    this.addTenantDetailCardStyles();

    // Setup todo badge hover listeners
    this.setupTodoBadgeListeners();
  }

  groupTenantsByRoommates(tenants) {
    const groups = [];
    const processed = new Set();

    tenants.forEach((tenant) => {
      if (processed.has(tenant._id)) return;

      const group = [tenant];
      processed.add(tenant._id);

      // Find roommate
      const roommateId = tenant.roommateId?._id || tenant.roommateId;
      if (roommateId) {
        const roommate = tenants.find((t) => t._id === roommateId);
        if (roommate && !processed.has(roommate._id)) {
          group.push(roommate);
          processed.add(roommate._id);
        }
      }

      groups.push(group);
    });

    return groups;
  }

  renderRoommateGroup(group) {
    const isOutdated = group.every((t) =>
      this.isTenantOutdated(t, this.selectedProperty),
    );

    // Calculate width based on number of roommates (each card is 260px + 0.125rem gap)
    const groupWidth =
      group.length === 2
        ? "520px"
        : group.length === 3
          ? "780px"
          : group.length === 4
            ? "1040px"
            : "100%";

    // Span columns based on group size
    const gridColumnSpan = `span ${group.length}`;

    let html = `
      <div style="max-width: ${groupWidth}; width: fit-content; grid-column: ${gridColumnSpan};">
        <div class="roommate-group-container ${isOutdated ? "group-outdated" : ""}">
          <div class="roommate-group-header">
            <i class="bi bi-people-fill me-2"></i>
            <strong>Roommates in Same Room</strong>
            <span class="badge bg-success ms-2">${group.length} tenants</span>
          </div>
          <div style="display: flex; gap: 0.125rem;">
    `;

    group.forEach((tenant) => {
      html += this.renderSingleTenant(tenant, true);
    });

    html += `
          </div>
        </div>
      </div>
    `;

    return html;
  }

  renderSingleTenant(tenant, isInGroup = false) {
    const registrationStatus =
      tenant.registrationStatus ||
      (tenant.isRegistered ? "registered" : "unregistered");
    const isMainTenant = this.hasMainTenantProperty(tenant);
    const isOutdated = this.isTenantOutdated(tenant, this.selectedProperty);

    // Find room info for this tenant in the selected property
    let roomInfo = "No property";
    let moveInDate = "N/A";
    let moveOutDate = "N/A";
    let rentAmount = tenant.rent || "N/A";

    if (this.selectedProperty !== "UNASSIGNED") {
      const propertyInfo = tenant.properties?.find((prop) => {
        const propId = typeof prop === "object" ? prop.propertyId : prop;
        return propId === this.selectedProperty;
      });
      if (propertyInfo && typeof propertyInfo === "object") {
        // Sync legacy flat fields from roomAssignments if needed
        if (propertyInfo.roomAssignments?.length > 0) {
          this.syncLegacyFieldsFromRoomAssignments(propertyInfo);
        }
        roomInfo = propertyInfo.room
          ? getRoomTypeDisplayName(propertyInfo.room)
          : "No room";
        if (propertyInfo.moveinDate) {
          const date = new Date(propertyInfo.moveinDate);
          moveInDate = `${date.getDate().toString().padStart(2, "0")}/${(
            date.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}/${date.getFullYear()}`;
        }
        if (propertyInfo.moveoutDate) {
          const date = new Date(propertyInfo.moveoutDate);
          moveOutDate = `${date.getDate().toString().padStart(2, "0")}/${(
            date.getMonth() + 1
          )
            .toString()
            .padStart(2, "0")}/${date.getFullYear()}`;
        }
      } else {
        roomInfo = "No room";
      }
    }

    return `
                <div style="max-width: 260px; width: 100%; justify-self: center;">
                    <div class="card h-100 tenant-detail-card shadow-sm ${isOutdated ? "tenant-outdated" : ""
      }">
                        <div class="card-body">
                            <div class="d-flex align-items-start gap-3 mb-3">
                                <div class="flex-shrink-0">
                                    ${tenant.avatar
        ? `<img src="${this.getOptimizedAvatarUrl(
          tenant.avatar,
          "small",
        )}" alt="${this.escapeHtml(
          tenant.name,
        )}" class="rounded-circle" style="width: 60px; height: 60px; object-fit: cover;">`
        : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 60px; height: 60px; font-size: 24px;">${this.escapeHtml(
          tenant.name.charAt(0).toUpperCase(),
        )}</div>`
      }
                                </div>
                                <div class="flex-grow-1 min-w-0">
                                    <div class="d-flex justify-content-between align-items-start mb-1">
                                        <div>
                                            <h5 class="mb-0">${this.escapeHtml(
        tenant.name,
      )}</h5>
                                            ${tenant.nickname
        ? `<small class="text-muted">（${this.escapeHtml(
          tenant.nickname,
        )}）</small>`
        : ""
      }
                                        </div>
                                        <div class="d-flex gap-2 align-items-center">
                                            ${this.renderTenantTodoBadge(tenant)}
                                            ${isMainTenant
        ? '<span class="badge bg-primary">Main</span>'
        : ""
      }
                                        </div>
                                    </div>
                                    <p class="text-muted mb-0">${this.escapeHtml(
        tenant.phoneNumber || "No phone",
      )}</p>
                                </div>
                            </div>
                            <div class="small mb-3">
                                <div class="mb-2"><strong>FIN:</strong> ${this.escapeHtml(tenant.fin) || "-"
      }</div>
                                <div class="mb-2"><strong>Passport:</strong> ${this.escapeHtml(
        tenant.passportNumber,
      )}</div>
                                <div class="mb-2"><strong>Room:</strong> ${this.escapeHtml(
        roomInfo,
      )}</div>
                                <div class="mb-2"><strong>Rent:</strong> ${typeof rentAmount === "number"
        ? "$" + rentAmount.toFixed(2)
        : rentAmount
      }</div>
                                <div class="mb-2"><strong>Cleaning Fee:</strong> ${typeof tenant.cleaningFee === "number"
        ? "$" + tenant.cleaningFee.toFixed(2)
        : "N/A"
      }</div>
                                ${tenant.isUtilitySubsidized
        ? '<div class="mb-2"><span class="badge bg-warning text-dark"><i class="bi bi-lightning-charge me-1"></i>Utility Subsidized</span></div>'
        : ""
      }
                                ${tenant.isHouseCleaner
        ? '<div class="mb-2"><span class="badge bg-info"><i class="bi bi-brush me-1"></i>House Cleaner</span></div>'
        : ""
      }
                                <div class="mb-2"><strong>Move-in:</strong> ${this.escapeHtml(
        moveInDate,
      )}</div>
                                <div class="mb-2"><strong>Move-out:</strong> ${this.escapeHtml(
        moveOutDate,
      )}</div>
                            </div>
                            <div class="d-flex gap-1 align-items-center mb-3 flex-wrap">
                                ${this.getRegistrationStatusBadge(
        registrationStatus,
      )}
                                ${tenant.properties &&
        tenant.properties.length > 1
        ? `<span class="badge bg-info">${tenant.properties.length} properties</span>`
        : ""
      }
                                ${renderTenantSocialBadges(tenant)}
                            </div>
                            <div class="btn-group w-100" role="group">
                                <button class="btn btn-outline-primary btn-sm" onclick="tenantManager.editTenant('${tenant._id
      }')">
                                    <i class="bi bi-pencil"></i> Edit
                                </button>
                                <button class="btn btn-outline-danger btn-sm" onclick="tenantManager.deleteTenant('${tenant._id
      }')">
                                    <i class="bi bi-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
  }

  addTenantDetailCardStyles() {
    if (!document.getElementById("tenant-detail-card-styles")) {
      const style = document.createElement("style");
      style.id = "tenant-detail-card-styles";
      style.textContent = `
                .tenant-detail-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    border: 1px solid #dee2e6;
                }
                .tenant-detail-card .card-body {
                    padding: 0.75rem 0.5rem;
                }
                .tenant-detail-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.15) !important;
                }
                .tenant-outdated {
                    opacity: 0.5;
                    background-color: #f8f9fa;
                }
                .tenant-outdated:hover {
                    opacity: 0.7;
                }
                .roommate-group-container {
                    background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
                    border: 3px solid #2196F3;
                    border-radius: 16px;
                    padding: 20px;
                    margin-bottom: 10px;
                    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
                    position: relative;
                }
                .roommate-group-container::before {
                    content: "";
                    position: absolute;
                    top: -2px;
                    left: -2px;
                    right: -2px;
                    bottom: -2px;
                    background: linear-gradient(45deg, #2196F3, #9C27B0, #2196F3);
                    border-radius: 16px;
                    z-index: -1;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .roommate-group-container:hover::before {
                    opacity: 1;
                    animation: borderGlow 3s linear infinite;
                }
                @keyframes borderGlow {
                    0%, 100% {
                        background: linear-gradient(45deg, #2196F3, #9C27B0, #2196F3);
                    }
                    50% {
                        background: linear-gradient(45deg, #9C27B0, #2196F3, #9C27B0);
                    }
                }
                .roommate-group-container.group-outdated {
                    background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
                    border-color: #9e9e9e;
                    opacity: 0.7;
                }
                .roommate-group-header {
                    background: white;
                    padding: 12px 20px;
                    border-radius: 10px;
                    margin-bottom: 15px;
                    font-size: 1.1rem;
                    color: #1976D2;
                    display: flex;
                    align-items: center;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .roommate-group-header i {
                    font-size: 1.3rem;
                }
                .roommate-group-container .tenant-detail-card {
                    border: 2px solid #ffffff;
                    background: white;
                }
                .tenant-todo-badge {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.75rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 0.25rem;
                    transition: all 0.2s ease;
                }
                .tenant-todo-badge:hover {
                    transform: scale(1.05);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .tenant-todo-popover {
                    position: absolute;
                    top: calc(100% + 8px);
                    right: 0;
                    background: white;
                    border: 1px solid #dee2e6;
                    border-radius: 0.5rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 1000;
                    min-width: 250px;
                    max-width: 350px;
                    animation: fadeIn 0.2s ease;
                }
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .tenant-todo-popover .popover-header {
                    background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                    padding: 0.75rem 1rem;
                    font-weight: 600;
                    font-size: 0.875rem;
                    border-radius: 0.5rem 0.5rem 0 0;
                }
                .tenant-todo-popover .popover-body {
                    padding: 0.75rem 1rem;
                    max-height: 300px;
                    overflow-y: auto;
                }
                .tenant-todo-popover .todo-item {
                    padding: 0.5rem 0;
                    font-size: 0.875rem;
                    line-height: 1.4;
                    color: #212529;
                    border-bottom: 1px solid #f0f0f0;
                }
                .tenant-todo-popover .todo-item:last-child {
                    border-bottom: none;
                    padding-bottom: 0;
                }
                .tenant-todo-popover .todo-completion-info {
                    font-size: 0.75rem;
                    color: #6c757d;
                    margin-top: 0.25rem;
                    font-style: italic;
                }
            `;
      document.head.appendChild(style);
    }
  }

  renderTenantCardItem(tenant) {
    const registrationStatus =
      tenant.registrationStatus ||
      (tenant.isRegistered ? "registered" : "unregistered");
    const isMainTenant = this.hasMainTenantProperty(tenant);

    // Find room info for this tenant
    const roomInfo =
      tenant.properties &&
        tenant.properties.length > 0 &&
        typeof tenant.properties[0] === "object"
        ? tenant.properties[0].room
          ? getRoomTypeDisplayName(tenant.properties[0].room)
          : "No room"
        : "No room";

    return `
            <div class="list-group-item">
                <div class="d-flex align-items-start gap-3">
                    <div class="flex-shrink-0">
                        ${tenant.avatar
        ? `<img src="${this.getOptimizedAvatarUrl(
          tenant.avatar,
          "small",
        )}" alt="${this.escapeHtml(
          tenant.name,
        )}" class="rounded-circle" style="width: 48px; height: 48px; object-fit: cover;">`
        : `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 48px; height: 48px; font-size: 18px;">${this.escapeHtml(
          tenant.name.charAt(0).toUpperCase(),
        )}</div>`
      }
                    </div>
                    <div class="flex-grow-1 min-w-0">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <div>
                                <h6 class="mb-0">${this.escapeHtml(
        tenant.name,
      )}</h6>
                                <small class="text-muted">${this.escapeHtml(
        tenant.phoneNumber || "No phone",
      )}</small>
                            </div>
                            <div class="d-flex gap-1 align-items-center">
                                ${this.renderTenantTodoBadge(tenant)}
                                ${isMainTenant
        ? '<span class="badge bg-primary">Main</span>'
        : ""
      }
                            </div>
                        </div>
                        <div class="small text-muted mb-2">
                            <div><strong>FIN:</strong> ${this.escapeHtml(tenant.fin) || "-"
      }</div>
                            <div><strong>Passport:</strong> ${this.escapeHtml(
        tenant.passportNumber,
      )}</div>
                            <div><strong>Room:</strong> ${this.escapeHtml(
        roomInfo,
      )}</div>
                        </div>
                        <div class="d-flex gap-1 align-items-center mb-2">
                            ${this.getRegistrationStatusBadge(
        registrationStatus,
      )}
                            ${tenant.properties && tenant.properties.length > 1
        ? `<span class="badge bg-info">${tenant.properties.length} properties</span>`
        : ""
      }
                        </div>
                        <div class="btn-group btn-group-sm w-100" role="group">
                            <button class="btn btn-outline-primary" onclick="tenantManager.editTenant('${tenant._id
      }')">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-outline-danger" onclick="tenantManager.deleteTenant('${tenant._id
      }')">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  addPropertyTenantCardStyles() {
    if (!document.getElementById("property-tenant-card-styles")) {
      const style = document.createElement("style");
      style.id = "property-tenant-card-styles";
      style.textContent = `
                .property-tenant-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    border: 1px solid #dee2e6;
                }
                .property-tenant-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.15) !important;
                }
                .property-tenant-card .list-group-item {
                    border-left: none;
                    border-right: none;
                    transition: background-color 0.2s ease;
                }
                .property-tenant-card .list-group-item:hover {
                    background-color: #f8f9fa;
                }
                .property-tenant-card .list-group-item:first-child {
                    border-top: none;
                }
                .property-tenant-card .list-group-item:last-child {
                    border-bottom: none;
                }
                .tenant-list-body {
                    transition: max-height 0.3s ease, opacity 0.3s ease;
                    overflow: hidden;
                }
            `;
      document.head.appendChild(style);
    }
  }

  togglePropertyCard(propertyId) {
    // Find the card element
    const card = document.querySelector(
      `.property-tenant-card[data-property-id="${propertyId}"]`,
    );
    if (!card) return;

    // Find the tenant list body and footer within this card
    const tenantListBody = card.querySelector(".tenant-list-body");
    const cardFooter = card.querySelector(".tenant-card-footer");
    const chevron = card.querySelector(".tenant-card-chevron");

    if (!tenantListBody || !cardFooter || !chevron) return;

    // Toggle visibility
    const isExpanded = tenantListBody.style.display !== "none";

    if (isExpanded) {
      // Collapse
      tenantListBody.style.display = "none";
      cardFooter.style.display = "none";
      chevron.style.transform = "rotate(0deg)";
    } else {
      // Expand
      tenantListBody.style.display = "block";
      cardFooter.style.display = "block";
      chevron.style.transform = "rotate(180deg)";
    }
  }

  groupTenantsByProperty(tenants) {
    const grouped = {};

    tenants.forEach((tenant) => {
      const tenantProperties = tenant.properties || [];

      if (tenantProperties.length === 0) {
        // Handle tenants with no properties
        if (!grouped["No Property Assigned"]) {
          grouped["No Property Assigned"] = [];
        }
        grouped["No Property Assigned"].push(tenant);
      } else {
        // Group by each property the tenant is assigned to
        tenantProperties.forEach((prop) => {
          let propertyId;

          if (typeof prop === "object" && prop.propertyId) {
            propertyId = prop.propertyId;
          } else if (typeof prop === "string") {
            propertyId = prop;
          } else {
            propertyId = prop._id || "Unknown Property";
          }

          if (!grouped[propertyId]) {
            grouped[propertyId] = [];
          }
          grouped[propertyId].push(tenant);
        });
      }
    });

    return grouped;
  }

  updateRegisteredTenantsBadge() {
    const badge = document.getElementById("registeredTenantsBadge");
    if (!badge) return;

    // Count registered tenants
    const registeredCount = this.tenants.filter((tenant) => {
      const status =
        tenant.registrationStatus ||
        (tenant.isRegistered ? "registered" : "unregistered");
      return status === "registered";
    }).length;

    // Update badge text
    badge.textContent = `${registeredCount} registered`;
  }

  showEmptyState(message = "No tenants found") {
    const tbody = document.getElementById("tenantsTableBody");
    if (!tbody) return;

    tbody.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-people fs-1 d-block mb-3"></i>
                <p class="fs-5">${message}</p>
            </div>
        `;

    // Update badge to show 0 when empty
    this.updateRegisteredTenantsBadge();
  }

  async filterTenants(searchTerm) {
    if (!this.selectedProperty) {
      return;
    }

    if (!searchTerm.trim()) {
      // Reload based on what's selected
      if (this.selectedProperty === "UNASSIGNED") {
        await this.loadUnassignedTenants();
      } else {
        await this.loadTenantsForProperty(this.selectedProperty);
      }
      return;
    }

    const filteredTenants = this.tenants.filter((tenant) => {
      const basicMatch =
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.fin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.passportNumber
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (tenant.phoneNumber &&
          tenant.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      // Search in property rooms if using new format
      const roomMatch =
        tenant.properties && Array.isArray(tenant.properties)
          ? tenant.properties.some((prop) => {
            if (typeof prop === "object" && prop.room) {
              return prop.room
                .toLowerCase()
                .includes(searchTerm.toLowerCase());
            }
            return false;
          })
          : false;

      return basicMatch || roomMatch;
    });

    const tbody = document.getElementById("tenantsTableBody");
    if (!tbody) return;

    if (filteredTenants.length === 0) {
      this.showEmptyState(`No tenants match "${searchTerm}"`);
      return;
    }

    // Temporarily replace tenants array for rendering
    const originalTenants = this.tenants;
    this.tenants = filteredTenants;
    await this.renderTenantsTable();
    this.tenants = originalTenants;
  }

  showAddTenantModal() {
    // Check if a property is selected
    if (!this.selectedProperty || this.selectedProperty === "UNASSIGNED") {
      alert("Please select a property first before adding a tenant");
      return;
    }
    this.showTenantModal();
  }

  async showTenantModal(tenant = null) {
    // Update modal title and button text
    const isEdit = !!tenant;
    document.getElementById("tenantModalTitle").textContent = isEdit
      ? "Edit Tenant"
      : "Add New Tenant";
    const submitBtn = document.getElementById("tenantSubmitBtn");
    submitBtn.innerHTML = isEdit
      ? '<i class="bi bi-person-check me-1"></i><span id="tenantSubmitText">Update Tenant</span>'
      : '<i class="bi bi-person-plus me-1"></i><span id="tenantSubmitText">Add Tenant</span>';

    // Reset and populate form
    const form = document.getElementById("tenantForm");
    if (form) {
      form.reset();

      // Store the tenant being edited (if any)
      form.setAttribute("data-tenant-id", tenant?._id || "");
      form.setAttribute("data-tenant-passport", tenant?.passportNumber || "");
      form.setAttribute("data-mode", isEdit ? "edit" : "add");

      if (isEdit && tenant) {
        // Store original tenant data for change detection
        this.originalTenantData = {
          name: tenant.name || "",
          nickname: tenant.nickname || "",
          fin: tenant.fin || "",
          passportNumber: tenant.passportNumber || "",
          phoneNumber: tenant.phoneNumber || "",
          facebookUrl: tenant.facebookUrl || "",
          registrationStatus:
            tenant.registrationStatus ||
            (tenant.isRegistered ? "registered" : "unregistered"),
          properties: JSON.parse(JSON.stringify(tenant.properties || [])), // Deep copy
          passportPics: [
            ...(tenant.passportPics ||
              (tenant.passportPic ? [tenant.passportPic] : [])),
          ], // Copy array
          visaPics: [
            ...(tenant.visaPics || (tenant.visaPic ? [tenant.visaPic] : [])),
          ], // Copy array
          avatar: tenant.avatar || "",
          signature: tenant.signature || "",
          // New financial fields
          rent: tenant.rent || null,
          deposit: tenant.deposit || null,
          depositReceiver: tenant.depositReceiver || "",
          cleaningFee: tenant.cleaningFee || null,
          isUtilitySubsidized: tenant.isUtilitySubsidized || false,
          isHouseCleaner: tenant.isHouseCleaner || false,
          // Roommate relationship
          roommateId:
            typeof tenant.roommateId === "object"
              ? tenant.roommateId?._id || ""
              : tenant.roommateId || "",
          // Notes and todos
          notes: tenant.notes || "",
          todos: JSON.parse(JSON.stringify(tenant.todos || [])), // Deep copy
        };

        // Populate form with existing data
        document.getElementById("tenantName").value = tenant.name || "";
        document.getElementById("tenantNickname").value = tenant.nickname || "";
        document.getElementById("tenantFin").value = tenant.fin || "";
        document.getElementById("tenantPassport").value =
          tenant.passportNumber || "";
        document.getElementById("tenantPhoneNumber").value =
          tenant.phoneNumber || "";
        document.getElementById("tenantFacebookUrl").value =
          tenant.facebookUrl || "";

        // Populate financial fields (except depositReceiver which is populated after investors are loaded)
        document.getElementById("tenantRent").value = tenant.rent || "";
        document.getElementById("tenantDeposit").value = tenant.deposit || "";
        document.getElementById("tenantCleaningFee").value =
          tenant.cleaningFee || "";
        document.getElementById("tenantIsUtilitySubsidized").checked =
          tenant.isUtilitySubsidized || false;
        document.getElementById("tenantIsHouseCleaner").checked =
          tenant.isHouseCleaner || false;

        // Populate notes and todos
        document.getElementById("tenantNotes").value = tenant.notes || "";
        this.todos = tenant.todos || [];
        this.renderTodoList();

        // Set registration status (support backward compatibility)
        const registrationStatus =
          tenant.registrationStatus ||
          (tenant.isRegistered ? "registered" : "unregistered");
        this.setRegistrationStatus(registrationStatus);

        // Handle multiple images (with backward compatibility)
        this.passportPics =
          tenant.passportPics ||
          (tenant.passportPic ? [tenant.passportPic] : []);
        this.visaPics =
          tenant.visaPics || (tenant.visaPic ? [tenant.visaPic] : []);
        this.signature = tenant.signature || "";
        console.log("📋 Set passportPics:", this.passportPics);
        console.log("📋 Set visaPics:", this.visaPics);
        console.log("📋 Set signature:", this.signature);
        // Don't update gallery here - wait until modal is shown

        // Handle avatar
        this.avatar = tenant.avatar || "";
        this.updateAvatarPreview();

        // Set up properties - store full property objects with details including roomAssignments
        this.selectedPropertiesDetails = (tenant.properties || []).map(
          (prop) => {
            if (typeof prop === "object" && prop.propertyId) {
              // Handle roomAssignments - migrate from legacy if needed
              let roomAssignments = prop.roomAssignments || [];
              if (roomAssignments.length === 0 && prop.room && prop.moveinDate) {
                // Migrate from legacy single room/date fields
                roomAssignments = [{
                  id: `ra_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                  room: prop.room,
                  moveinDate: prop.moveinDate,
                  moveoutDate: prop.moveoutDate || "",
                  rent: tenant.rent || null  // Use tenant's rent for legacy migration
                }];
              }
              return {
                propertyId: prop.propertyId,
                isMainTenant: prop.isMainTenant || false,
                roomAssignments: roomAssignments,
                // Keep legacy fields for backward compatibility
                room: prop.room || "",
                moveinDate: prop.moveinDate || "",
                moveoutDate: prop.moveoutDate || "",
                leavePlans: prop.leavePlans || []
              };
            } else {
              return {
                propertyId:
                  typeof prop === "string" ? prop : prop.propertyId || prop._id,
                isMainTenant: false,
                roomAssignments: [],
                room: "",
                moveinDate: "",
                moveoutDate: "",
                leavePlans: []
              };
            }
          },
        );
        // Store original properties for fallback during save (deep copy)
        this.originalPropertiesDetails = JSON.parse(JSON.stringify(this.selectedPropertiesDetails));
        this.selectedProperties = this.selectedPropertiesDetails.map(
          (p) => p.propertyId,
        );

        // Populate global room/date/main tenant fields from first property (if exists)
        if (this.selectedPropertiesDetails.length > 0) {
          const firstProperty = this.selectedPropertiesDetails[0];
          const roomField = document.getElementById("tenantRoom");
          const moveInField = document.getElementById("tenantMoveInDate");
          const moveOutField = document.getElementById("tenantMoveOutDate");
          const mainTenantField = document.getElementById("tenantIsMainTenant");

          if (roomField && firstProperty.room) {
            // Convert uppercase DB value (e.g., COMMON_1_PAX) to lowercase HTML option value (e.g., common_1_pax)
            roomField.value = firstProperty.room.toLowerCase();
          }
          if (moveInField && firstProperty.moveinDate) {
            // Convert ISO date string to YYYY-MM-DD format for date input
            moveInField.value = firstProperty.moveinDate.split("T")[0];
          }
          if (moveOutField && firstProperty.moveoutDate) {
            // Convert ISO date string to YYYY-MM-DD format for date input
            moveOutField.value = firstProperty.moveoutDate.split("T")[0];
          }
          if (mainTenantField) {
            mainTenantField.checked = firstProperty.isMainTenant || false;
          }
        }
      } else {
        // Reset for add mode
        this.selectedProperties = [];
        this.selectedPropertiesDetails = [];
        this.originalPropertiesDetails = [];
        this.passportPics = [];
        this.visaPics = [];
        this.avatar = "";
        this.signature = "";
        this.todos = [];
        this.updateImageGallery("passport");
        this.updateImageGallery("visa");
        this.updateAvatarPreview();
        this.updateSignaturePreview();
        this.renderTodoList();

        // Reset registration status to unregistered
        this.setRegistrationStatus("unregistered");

        // Reset room/date/main tenant fields for add mode
        const roomField = document.getElementById("tenantRoom");
        const moveInField = document.getElementById("tenantMoveInDate");
        const moveOutField = document.getElementById("tenantMoveOutDate");
        const mainTenantField = document.getElementById("tenantIsMainTenant");
        if (roomField) roomField.value = "";
        if (moveInField) moveInField.value = "";
        if (moveOutField) moveOutField.value = "";
        if (mainTenantField) mainTenantField.checked = false;

        // Auto-assign the currently selected property (if not UNASSIGNED)
        if (this.selectedProperty && this.selectedProperty !== "UNASSIGNED") {
          this.selectedProperties = [this.selectedProperty];
          this.selectedPropertiesDetails = [{
            propertyId: this.selectedProperty,
            isMainTenant: false,
            room: "",
            moveinDate: "",
            moveoutDate: "",
          }];
        }
      }
    }

    // Load available properties and populate select
    await this.loadPropertiesForSelect();
    // Load available investors for deposit receiver dropdown
    await this.loadInvestorsForSelect();
    // Load potential roommates for roommate dropdown
    await this.loadRoommatesForSelect(tenant?._id);

    // After investors are loaded, populate the depositReceiver field if in edit mode
    if (isEdit && tenant && tenant.depositReceiver) {
      document.getElementById("tenantDepositReceiver").value =
        tenant.depositReceiver;
    }

    // After roommates are loaded, populate the roommateId field if in edit mode
    if (isEdit && tenant && tenant.roommateId) {
      const roommateIdValue =
        typeof tenant.roommateId === "object"
          ? tenant.roommateId._id
          : tenant.roommateId;
      document.getElementById("tenantRoommateId").value = roommateIdValue || "";
    }

    this.updateSelectedPropertiesList();

    // Add event listeners for image URL inputs
    this.setupImageUrlListeners();

    // Show modal
    const modalEl = document.getElementById("tenantModal");
    const modal = new bootstrap.Modal(modalEl);

    // Add event listener for when modal is fully hidden
    modalEl.addEventListener(
      "hidden.bs.modal",
      () => {
        this.cleanupModal();
        // Revert URL back to property-level route
        const property = this.properties.find(
          (p) => p.propertyId === this.selectedProperty,
        );
        if (property && window.SlugUtils) {
          const slug = window.SlugUtils.propertySlug(property);
          window.appRouter?.replace(`/tenants/${slug}`);
        }
      },
      { once: true },
    );

    // Add event listener for when modal is fully shown
    modalEl.addEventListener(
      "shown.bs.modal",
      () => {
        this.updateImageGallery("passport");
        this.updateImageGallery("visa");
        this.updateAvatarPreview();
        this.updateSignaturePreview();

        // Show/hide signature section based on main tenant status
        this.toggleSignatureSection();

        // Set up clipboard paste listeners after modal is shown
        this.setupModalClipboardListeners();

        // Set up signature URL input listener
        this.setupSignatureUrlListener();
      },
      { once: true },
    );

    modal.show();

    // For new tenants, clear original data and enable button
    if (!isEdit) {
      this.originalTenantData = null;
      const submitBtn = document.getElementById("tenantSubmitBtn");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("btn-secondary");
        submitBtn.classList.add("btn-primary");
      }
    } else {
      // For edit mode, check for changes after modal is shown
      setTimeout(() => {
        this.checkForChanges();
      }, 100);
    }
  }

  cleanupModal() {
    // Remove any remaining backdrop
    const backdrops = document.querySelectorAll(".modal-backdrop");
    backdrops.forEach((backdrop) => backdrop.remove());

    // Remove modal classes from body
    document.body.classList.remove("modal-open");
    document.body.style.paddingRight = "";
    document.body.style.overflow = "";

    // Reset selected properties and details
    // Note: This is called AFTER the form has been submitted, so it doesn't affect the save
    this.selectedProperties = [];
    this.selectedPropertiesDetails = [];
    this.originalPropertiesDetails = [];
  }

  async loadPropertiesCache() {
    try {
      // Check cache first
      const now = Date.now();
      if (
        this.propertiesCache &&
        this.propertiesCacheTime &&
        now - this.propertiesCacheTime < this.cacheTimeout
      ) {
        console.log("Using cached properties data");
        return;
      }

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
          hasMorePages = false;
        }
      }

      // Cache the result
      this.propertiesCache = { success: true, properties: allProperties };
      this.propertiesCacheTime = now;
      console.log(
        "✅ Properties cache loaded:",
        allProperties.length,
        "properties",
      );
    } catch (error) {
      console.error("Error loading properties cache:", error);
    }
  }

  async loadPropertiesForSelect() {
    // Load the cache for property name lookups
    await this.loadPropertiesCache();
    // Property dropdown is no longer used - tenant is assigned to currentselected property
  }

  async loadInvestorsForSelect() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();

      if (result.success && result.data) {
        this.populateInvestorDropdown(result.data);
        console.log(
          "✅ Investors loaded for dropdown:",
          result.data.length,
          "investors",
        );
      } else {
        console.error(
          "Failed to load investors:",
          result.error || "Unknown error",
        );
        this.populateInvestorDropdown([]);
      }
    } catch (error) {
      console.error("Error loading investors:", error);
      this.populateInvestorDropdown([]);
    }
  }

  populateInvestorDropdown(investors) {
    const dropdown = document.getElementById("tenantDepositReceiver");
    if (!dropdown) return;

    // Clear existing options except the first one
    dropdown.innerHTML =
      '<option value="">Select investor who receives deposit...</option>';

    if (investors.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No investors available";
      option.disabled = true;
      dropdown.appendChild(option);
      return;
    }

    investors.forEach((investor) => {
      const option = document.createElement("option");
      option.value = investor.investorId;
      option.textContent = `${investor.investorId} - ${investor.name}`;
      dropdown.appendChild(option);
    });
  }

  async loadRoommatesForSelect(currentTenantId = null) {
    try {
      // Get current property from selected properties
      const currentProperties = this.selectedPropertiesDetails.map(
        (p) => p.propertyId,
      );

      if (currentProperties.length === 0) {
        this.populateRoommateDropdown([], currentTenantId);
        return;
      }

      // Fetch all tenants from the same properties
      const allTenants = [];
      for (const propertyId of currentProperties) {
        const response = await API.get(
          `${API_CONFIG.ENDPOINTS.TENANTS}?property=${propertyId}&limit=1000`,
        );
        const result = await response.json();

        if (result.success && result.tenants) {
          allTenants.push(...result.tenants);
        }
      }

      // Remove duplicates based on _id and filter out current tenant
      const uniqueTenants = allTenants.filter(
        (tenant, index, self) =>
          index === self.findIndex((t) => t._id === tenant._id) &&
          tenant._id !== currentTenantId,
      );

      this.populateRoommateDropdown(uniqueTenants, currentTenantId);
      console.log(
        "✅ Roommates loaded for dropdown:",
        uniqueTenants.length,
        "potential roommates",
      );
    } catch (error) {
      console.error("Error loading roommates:", error);
      this.populateRoommateDropdown([], currentTenantId);
    }
  }

  populateRoommateDropdown(tenants, currentTenantId = null) {
    const dropdown = document.getElementById("tenantRoommateId");
    if (!dropdown) return;

    // Clear existing options
    dropdown.innerHTML =
      '<option value="">No roommate (lives alone in room)</option>';

    if (tenants.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Assign properties first to see potential roommates";
      option.disabled = true;
      dropdown.appendChild(option);
      return;
    }

    tenants.forEach((tenant) => {
      const option = document.createElement("option");
      option.value = tenant._id;
      const tenantName = tenant.name || "Unnamed Tenant";
      const tenantRoom = tenant.properties?.[0]?.room || "No room";
      option.textContent = `${tenantName} (${tenantRoom})`;
      dropdown.appendChild(option);
    });
  }

  populatePropertyCheckboxes(result) {
    // Property dropdown checkbox list is no longer used
    // Tenant is assigned to single selected property
  }

  async handleCheckboxChange(propertyId, isChecked) {
    // Property dropdown checkbox is no longer used
    // Tenant is assigned to single selected property
  }

  updateDropdownText() {
    // Property dropdown is no longer used - tenant is assigned to single property
  }

  // Keep old function for backward compatibility but redirect to new logic
  addPropertyToTenant() {
    // This function is no longer used with multiselect, but keeping for safety
    console.log(
      "addPropertyToTenant called - now handled by handlePropertySelectionChange",
    );
  }

  removePropertyFromTenant(propertyId) {
    if (!confirm('Remove this property assignment from the tenant?')) return;
    this.selectedProperties = this.selectedProperties.filter(id => id !== propertyId);
    this.selectedPropertiesDetails = this.selectedPropertiesDetails.filter(p => p.propertyId !== propertyId);
    this.updateSelectedPropertiesList();
    this.checkForChanges();
  }

  updateSelectedPropertiesList() {
    const listContainer = document.getElementById("selectedPropertiesList");
    const hiddenInput = document.getElementById("tenantProperties");

    // Guard against null elements (modal not yet in DOM)
    if (!listContainer || !hiddenInput) {
      return;
    }

    if (!this.selectedPropertiesDetails) {
      this.selectedPropertiesDetails = [];
    }

    if (this.selectedProperties.length === 0) {
      listContainer.innerHTML =
        '<div class="text-muted">No property assigned. Please select a property first.</div>';
      hiddenInput.value = "";
    } else {
      let html = "";
      this.selectedProperties.forEach((propertyId) => {
        const propertyDetails = this.selectedPropertiesDetails.find(
          (p) => p.propertyId === propertyId,
        ) || {
          propertyId,
          isMainTenant: false,
          roomAssignments: [],
          room: "",
          moveinDate: "",
          moveoutDate: "",
        };

        // Get room assignments (migrate from legacy if needed)
        let roomAssignments = propertyDetails.roomAssignments || [];
        if (roomAssignments.length === 0 && propertyDetails.room && propertyDetails.moveinDate) {
          // Migrate from legacy single room/date fields
          roomAssignments = [{
            id: `ra_legacy_${propertyId}`,
            room: propertyDetails.room,
            moveinDate: propertyDetails.moveinDate,
            moveoutDate: propertyDetails.moveoutDate || "",
            rent: this.originalTenantData?.rent || null  // Use tenant's rent for legacy migration
          }];
          // Update the property details to include the migrated roomAssignments
          propertyDetails.roomAssignments = roomAssignments;
        }

        // Get property info from cache
        const propertyInfo = this.getPropertyInfo(propertyId);
        const propertyTitle = propertyInfo
          ? `${propertyId} - ${propertyInfo.address}, ${propertyInfo.unit}`
          : propertyId;

        // Render room assignments cards
        const roomAssignmentsHtml = roomAssignments.map((ra, index) => {
          const isActive = !ra.moveoutDate;
          const canDelete = roomAssignments.length > 1;
          return `
            <div class="card mb-2 ${isActive ? 'border-success' : 'border-secondary'}" data-assignment-id="${ra.id}">
              <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <small class="text-muted">
                    ${isActive ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Historical</span>'}
                  </small>
                  ${canDelete ? `
                    <button type="button" class="btn btn-sm btn-link text-danger p-0"
                            onclick="tenantManager.removeRoomAssignment('${propertyId}', '${ra.id}')"
                            title="Remove this room assignment">
                      <i class="bi bi-trash"></i>
                    </button>
                  ` : ''}
                </div>
                <div class="row g-2">
                  <div class="col-6 col-md-3">
                    <label class="form-label small mb-1">Room</label>
                    <select class="form-select form-select-sm"
                            onchange="tenantManager.updateRoomAssignment('${propertyId}', '${ra.id}', 'room', this.value)">
                      ${getRoomTypeOptions(ra.room)}
                    </select>
                  </div>
                  <div class="col-6 col-md-2">
                    <label class="form-label small mb-1">Rent</label>
                    <div class="input-group input-group-sm">
                      <span class="input-group-text">$</span>
                      <input type="number" class="form-control form-control-sm"
                             value="${ra.rent || ''}"
                             min="0" step="0.01"
                             placeholder="0"
                             onchange="tenantManager.updateRoomAssignment('${propertyId}', '${ra.id}', 'rent', this.value ? parseFloat(this.value) : null)">
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <label class="form-label small mb-1">Move-in</label>
                    <input type="date" class="form-control form-control-sm"
                           value="${ra.moveinDate ? ra.moveinDate.split('T')[0] : ''}"
                           onchange="tenantManager.updateRoomAssignment('${propertyId}', '${ra.id}', 'moveinDate', this.value)">
                  </div>
                  <div class="col-6 col-md-4">
                    <label class="form-label small mb-1">Move-out</label>
                    <input type="date" class="form-control form-control-sm"
                           value="${ra.moveoutDate ? ra.moveoutDate.split('T')[0] : ''}"
                           onchange="tenantManager.updateRoomAssignment('${propertyId}', '${ra.id}', 'moveoutDate', this.value)">
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        html += `
                    <div class="card mb-2">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="card-title mb-0">
                                    <i class="bi bi-building me-2"></i>${propertyTitle}
                                </h6>
                                <button type="button" class="btn btn-sm btn-outline-danger"
                                        onclick="tenantManager.removePropertyFromTenant('${propertyId}')"
                                        title="Remove property assignment">
                                    <i class="bi bi-trash"></i> Remove
                                </button>
                            </div>

                            <!-- Main Tenant Checkbox -->
                            <div class="row g-2 mb-3">
                                <div class="col-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox"
                                               id="mainTenant_${propertyId}"
                                               ${propertyDetails.isMainTenant ? "checked" : ""}
                                               onchange="tenantManager.updatePropertyDetail('${propertyId}', 'isMainTenant', this.checked)">
                                        <label class="form-check-label" for="mainTenant_${propertyId}">
                                            Main Tenant for this property
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- Room Assignments Section -->
                            <div class="room-assignments-section">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <label class="form-label small mb-0 fw-bold">Room Assignments</label>
                                    <button type="button" class="btn btn-sm btn-outline-primary"
                                            onclick="tenantManager.addRoomAssignment('${propertyId}')">
                                        <i class="bi bi-plus"></i> Add Room
                                    </button>
                                </div>
                                <div id="roomAssignments_${propertyId}">
                                    ${roomAssignmentsHtml || '<div class="text-muted small">No room assignments. Click "Add Room" to add one.</div>'}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
      });
      listContainer.innerHTML = html;
      hiddenInput.value = JSON.stringify(this.selectedPropertiesDetails);
    }

    // Update dropdown text when list changes
    this.updateDropdownText();
  }

  getPropertyInfo(propertyId) {
    if (!this.propertiesCache || !this.propertiesCache.properties) {
      return null;
    }

    return this.propertiesCache.properties.find(
      (prop) => prop.propertyId === propertyId,
    );
  }

  updatePropertyDetail(propertyId, field, value) {
    if (!this.selectedPropertiesDetails) {
      this.selectedPropertiesDetails = [];
    }

    let property = this.selectedPropertiesDetails.find(
      (p) => p.propertyId === propertyId,
    );
    if (!property) {
      // Try to get the original property data to preserve existing values
      const originalProperty = (this.originalPropertiesDetails || []).find(
        (p) => p.propertyId === propertyId,
      );
      property = originalProperty
        ? { ...originalProperty } // Copy from original to preserve all fields
        : {
            propertyId,
            isMainTenant: false,
            room: "",
            moveinDate: "",
            moveoutDate: "",
          };
      this.selectedPropertiesDetails.push(property);
      console.log(`Created new property detail for ${propertyId} from ${originalProperty ? 'original' : 'default'}`);
    }

    property[field] = value;
    console.log(`Updated property ${propertyId} ${field} to:`, value);

    // If main tenant status changed, toggle signature section
    if (field === "isMainTenant") {
      this.toggleSignatureSection();
    }

    // Check for changes to enable/disable submit button
    this.checkForChanges();
  }

  // Add a new room assignment to a property
  addRoomAssignment(propertyId) {
    const propertyDetail = this.selectedPropertiesDetails.find(
      (p) => p.propertyId === propertyId
    );

    if (!propertyDetail) {
      console.warn(`Property ${propertyId} not found in selectedPropertiesDetails`);
      return;
    }

    // Initialize roomAssignments array if needed
    if (!propertyDetail.roomAssignments) {
      // Migrate from legacy single room
      if (propertyDetail.room && propertyDetail.moveinDate) {
        propertyDetail.roomAssignments = [{
          id: `ra_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          room: propertyDetail.room,
          moveinDate: propertyDetail.moveinDate,
          moveoutDate: propertyDetail.moveoutDate || "",
          rent: this.originalTenantData?.rent || null  // Use tenant's rent for legacy migration
        }];
      } else {
        propertyDetail.roomAssignments = [];
      }
    }

    // Get the previous active assignment's rent to carry over (optional)
    const previousActiveAssignment = propertyDetail.roomAssignments.find(ra => !ra.moveoutDate);
    const previousRent = previousActiveAssignment?.rent || null;

    // Close previous active assignment (set moveout date to today)
    const today = new Date().toISOString().split('T')[0];
    propertyDetail.roomAssignments.forEach(ra => {
      if (!ra.moveoutDate) {
        ra.moveoutDate = today;
      }
    });

    // Add new active assignment (rent starts empty - user should enter new rent)
    propertyDetail.roomAssignments.push({
      id: `ra_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      room: "",
      moveinDate: today,
      moveoutDate: "",
      rent: null  // New room assignment starts with no rent - user should enter it
    });

    console.log(`Added new room assignment to property ${propertyId}`);
    this.updateSelectedPropertiesList();
    this.checkForChanges();
  }

  // Update a specific room assignment field
  updateRoomAssignment(propertyId, assignmentId, field, value) {
    const propertyDetail = this.selectedPropertiesDetails.find(
      (p) => p.propertyId === propertyId
    );

    if (!propertyDetail || !propertyDetail.roomAssignments) {
      console.warn(`Property ${propertyId} or roomAssignments not found`);
      return;
    }

    const assignment = propertyDetail.roomAssignments.find(
      (ra) => ra.id === assignmentId
    );

    if (assignment) {
      // Convert room to uppercase for consistency with backend
      if (field === 'room') {
        assignment[field] = value ? value.toUpperCase() : value;
      } else {
        assignment[field] = value;
      }
      console.log(`Updated room assignment ${assignmentId} ${field} to:`, value);

      // Also sync legacy fields from the most recent/active assignment
      this.syncLegacyFieldsFromRoomAssignments(propertyDetail);

      this.checkForChanges();
    }
  }

  // Remove a room assignment (only allowed if more than one exists)
  removeRoomAssignment(propertyId, assignmentId) {
    const propertyDetail = this.selectedPropertiesDetails.find(
      (p) => p.propertyId === propertyId
    );

    if (!propertyDetail || !propertyDetail.roomAssignments) {
      console.warn(`Property ${propertyId} or roomAssignments not found`);
      return;
    }

    // Only allow deletion if more than one assignment exists
    if (propertyDetail.roomAssignments.length <= 1) {
      alert('Cannot delete the only room assignment. Remove the property instead.');
      return;
    }

    propertyDetail.roomAssignments = propertyDetail.roomAssignments.filter(
      (ra) => ra.id !== assignmentId
    );

    // Sync legacy fields after removal
    this.syncLegacyFieldsFromRoomAssignments(propertyDetail);

    console.log(`Removed room assignment ${assignmentId} from property ${propertyId}`);
    this.updateSelectedPropertiesList();
    this.checkForChanges();
  }

  // Helper to sync legacy room/moveinDate/moveoutDate fields from roomAssignments
  syncLegacyFieldsFromRoomAssignments(propertyDetail) {
    const roomAssignments = propertyDetail.roomAssignments || [];
    if (roomAssignments.length > 0) {
      // Find active assignment (no moveoutDate) or get the most recent one
      const activeAssignment = roomAssignments.find(ra => !ra.moveoutDate);
      const latestAssignment = activeAssignment || roomAssignments[roomAssignments.length - 1];
      const firstAssignment = roomAssignments[0];

      // Sync legacy fields
      propertyDetail.room = latestAssignment?.room || propertyDetail.room;
      propertyDetail.moveinDate = firstAssignment?.moveinDate || propertyDetail.moveinDate;
      propertyDetail.moveoutDate = latestAssignment?.moveoutDate || propertyDetail.moveoutDate;
    }
  }

  // Helper method to get properties for form submission with proper fallback logic
  getPropertiesToSubmit() {
    // Ensure selectedPropertiesDetails is synchronized with selectedProperties
    // This fixes an issue where editing dates could cause properties to be lost
    if (this.selectedProperties && this.selectedProperties.length > 0) {
      // Make sure each selected property has a corresponding detail entry
      const detailsMap = new Map(
        (this.selectedPropertiesDetails || []).map(p => [p.propertyId, p])
      );
      const originalMap = new Map(
        (this.originalPropertiesDetails || []).map(p => [p.propertyId, p])
      );

      const syncedProperties = this.selectedProperties.map(propertyId => {
        // First try selectedPropertiesDetails
        if (detailsMap.has(propertyId)) {
          return detailsMap.get(propertyId);
        }
        // Then try originalPropertiesDetails
        if (originalMap.has(propertyId)) {
          return originalMap.get(propertyId);
        }
        // Fallback to default
        return {
          propertyId,
          isMainTenant: false,
          roomAssignments: [],
          room: "",
          moveinDate: "",
          moveoutDate: "",
        };
      });

      if (syncedProperties.length > 0) {
        // Ensure all properties have synced legacy fields before returning
        syncedProperties.forEach(prop => {
          if (prop.roomAssignments && prop.roomAssignments.length > 0) {
            this.syncLegacyFieldsFromRoomAssignments(prop);
          }
        });
        console.log("📋 Using synced properties:", syncedProperties);
        return syncedProperties;
      }
    }

    // Original fallback logic
    if (this.selectedPropertiesDetails && this.selectedPropertiesDetails.length > 0) {
      // Ensure all properties have synced legacy fields
      this.selectedPropertiesDetails.forEach(prop => {
        if (prop.roomAssignments && prop.roomAssignments.length > 0) {
          this.syncLegacyFieldsFromRoomAssignments(prop);
        }
      });
      console.log("📋 Using selectedPropertiesDetails:", this.selectedPropertiesDetails);
      return this.selectedPropertiesDetails;
    }

    if (this.originalPropertiesDetails && this.originalPropertiesDetails.length > 0) {
      console.log("📋 Using originalPropertiesDetails (fallback):", this.originalPropertiesDetails);
      return this.originalPropertiesDetails;
    }

    // Final fallback - map from selectedProperties
    const mapped = (this.selectedProperties || []).map((propertyId) => ({
      propertyId,
      isMainTenant: false,
      roomAssignments: [],
      room: "",
      moveinDate: "",
      moveoutDate: "",
    }));

    if (mapped.length === 0) {
      console.warn("⚠️ No properties found in primary sources, checking originalPropertiesDetails...");
      console.warn("Debug info:", {
        selectedProperties: this.selectedProperties,
        selectedPropertiesDetails: this.selectedPropertiesDetails,
        originalPropertiesDetails: this.originalPropertiesDetails,
      });

      // CRITICAL: If we have original properties, use them as last resort to prevent data loss
      if (this.originalPropertiesDetails && this.originalPropertiesDetails.length > 0) {
        console.log("📋 Using originalPropertiesDetails as last resort fallback:", this.originalPropertiesDetails);
        return this.originalPropertiesDetails;
      }
    }

    return mapped;
  }

  async handleTenantSubmit(event) {
    try {
      const form = event.target;
      const formData = new FormData(form);
      const isEdit = form.getAttribute("data-mode") === "edit";
      const tenantId = form.getAttribute("data-tenant-id");
      const originalPassport = form.getAttribute("data-tenant-passport");

      const tenantData = {
        name: formData.get("name").trim(),
        nickname: formData.get("nickname")?.trim() || null,
        fin: formData.get("fin").trim().toUpperCase() || null,
        passportNumber: formData.get("passportNumber").trim().toUpperCase(),
        phoneNumber: formData.get("phoneNumber").trim() || null,
        facebookUrl: formData.get("facebookUrl")?.trim() || null,
        registrationStatus:
          document.getElementById("tenantRegistrationStatusHidden").value ||
          "unregistered",
        // Keep backward compatibility with isRegistered field
        isRegistered:
          document.getElementById("tenantRegistrationStatusHidden").value ===
          "registered",
        properties: this.getPropertiesToSubmit(),
        passportPics: this.passportPics,
        visaPics: this.visaPics,
        avatar: this.avatar || null,
        signature: this.signature || null, // Send null instead of empty string
        // New financial fields
        rent: formData.get("rent") ? parseFloat(formData.get("rent")) : null,
        deposit: formData.get("deposit")
          ? parseFloat(formData.get("deposit"))
          : null,
        depositReceiver: formData.get("depositReceiver").trim() || null,
        cleaningFee: formData.get("cleaningFee")
          ? parseFloat(formData.get("cleaningFee"))
          : null,
        isUtilitySubsidized:
          document.getElementById("tenantIsUtilitySubsidized")?.checked ||
          false,
        isHouseCleaner:
          document.getElementById("tenantIsHouseCleaner")?.checked || false,
        // Roommate relationship
        roommateId: formData.get("roommateId")?.trim() || null,
        // Notes and todos
        notes: formData.get("notes")?.trim() || null,
        todos: this.todos || [],
      };

      // Debug: log the properties being sent
      console.log("🔄 Tenant update data:", {
        ...tenantData,
        selectedProperties: this.selectedProperties,
        selectedPropertiesDetails: this.selectedPropertiesDetails,
        originalPropertiesDetails: this.originalPropertiesDetails,
        propertiesBeingSent: tenantData.properties,
      });

      // Validate required fields
      if (!tenantData.name) {
        alert("Please fill in the required field: Name");
        return;
      }

      // Validate property is assigned
      if (!tenantData.properties || tenantData.properties.length === 0) {
        alert("Please select a property before adding a tenant");
        return;
      }

      // Validate FIN length if provided
      if (tenantData.fin && tenantData.fin.length > 20) {
        alert("FIN cannot exceed 20 characters");
        return;
      }

      // Validate passport length if provided
      if (
        tenantData.passportNumber &&
        (tenantData.passportNumber.length < 6 ||
          tenantData.passportNumber.length > 15)
      ) {
        alert("Passport number must be between 6 and 15 characters");
        return;
      }

      // Validate phone number length (only if provided)
      if (
        tenantData.phoneNumber &&
        (tenantData.phoneNumber.length < 8 ||
          tenantData.phoneNumber.length > 20)
      ) {
        alert("Phone number must be between 8 and 20 characters");
        return;
      }

      // Validate move-out date is after move-in date (only if both dates are provided)
      if (
        tenantData.moveoutDate &&
        tenantData.moveinDate &&
        new Date(tenantData.moveoutDate) <= new Date(tenantData.moveinDate)
      ) {
        alert("Move-out date must be after move-in date");
        return;
      }

      // Show loading state
      const submitBtn = event.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = isEdit
        ? '<i class="bi bi-hourglass-split me-1"></i>Updating Tenant...'
        : '<i class="bi bi-hourglass-split me-1"></i>Adding Tenant...';

      // Add or update the tenant
      if (isEdit) {
        await this.updateTenant(tenantId, tenantData);
      } else {
        await this.addTenant(tenantData);
      }

      // Close modal on success
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("tenantModal"),
      );
      if (modal) {
        modal.hide();
      }

      // Ensure backdrop is removed
      setTimeout(() => {
        const backdrop = document.querySelector(".modal-backdrop");
        if (backdrop) {
          backdrop.remove();
        }
        document.body.classList.remove("modal-open");
        document.body.style.paddingRight = "";
      }, 300);

      // Reset button state
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    } catch (error) {
      console.error("Error in handleTenantSubmit:", error);
      const isEdit = event.target.getAttribute("data-mode") === "edit";
      alert(
        `An error occurred while ${isEdit ? "updating" : "adding"
        } the tenant. Please try again.`,
      );

      // Reset button state
      const submitBtn = event.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        const isEdit = event.target.getAttribute("data-mode") === "edit";
        submitBtn.innerHTML = isEdit
          ? '<i class="bi bi-person-check me-1"></i>Update Tenant'
          : '<i class="bi bi-person-plus me-1"></i>Add Tenant';
      }
    }
  }

  getTenantDataFromUser(existingTenant = null) {
    const name = prompt("Full Name:", existingTenant?.name || "");
    if (!name) return null;

    const fin = prompt("FIN (Singaporean ID):", existingTenant?.fin || "");
    if (!fin) return null;

    const passportNumber = prompt(
      "Passport Number:",
      existingTenant?.passportNumber || "",
    );
    if (!passportNumber) return null;

    const isRegistered = confirm("Is this tenant active/registered?");
    const isMainTenant = confirm("Is this the main tenant?");

    return {
      name,
      fin: fin.toUpperCase(),
      passportNumber: passportNumber.toUpperCase(),
      isRegistered,
      isMainTenant,
      properties: existingTenant?.properties || [],
    };
  }

  async addTenant(tenantData) {
    try {
      const response = await API.post(API_CONFIG.ENDPOINTS.TENANTS, tenantData);

      const result = await response.json();

      if (result.success) {
        // Notify other modules that tenant data has changed
        if (window.dashboardController) {
          window.dashboardController.markTenantDataChanged();
        }
        // Reload the list
        if (this.selectedProperty === "UNASSIGNED") {
          await this.loadUnassignedTenants();
        } else if (this.selectedProperty) {
          await this.loadTenantsForProperty(this.selectedProperty);
        } else {
          await this.loadTenants();
        }
      } else {
        alert("Failed to add tenant: " + result.error);
      }
    } catch (error) {
      console.error("Error adding tenant:", error);
      alert("Error adding tenant. Please try again.");
    }
  }

  async editTenant(tenantId) {
    // Find the tenant to edit by ID
    const tenant = this.tenants.find((t) => t._id === tenantId);
    if (!tenant) {
      alert("Tenant not found");
      return;
    }

    // Sync URL to reflect the specific tenant being viewed:
    // /tenants/<property-slug>/<tenant-name-slug>
    const property = this.properties.find(
      (p) => p.propertyId === this.selectedProperty,
    );
    if (property && window.SlugUtils) {
      const propSlug = window.SlugUtils.propertySlug(property);
      const nameSlug = window.SlugUtils.toSlug(tenant.name || "");
      window.appRouter?.replace(`/tenants/${propSlug}/${nameSlug}`);
    }

    // Show the modal with tenant data
    this.showTenantModal(tenant);
  }

  async updateTenant(tenantId, tenantData) {
    try {
      // Validate tenant ID exists
      if (!tenantId) {
        throw new Error("Tenant ID not found");
      }

      const response = await API.put(
        API_CONFIG.ENDPOINTS.TENANT_BY_ID(tenantId),
        tenantData,
      );
      const result = await response.json();

      if (result.success) {
        // Notify other modules that tenant data has changed
        if (window.dashboardController) {
          window.dashboardController.markTenantDataChanged();
        }

        // Optimized update: Update tenant in place instead of reloading entire list
        const updatedTenant = result.tenant;
        if (updatedTenant) {
          // Check if tenant's property assignment changed (requires full reload)
          const oldTenant = this.tenants.find((t) => t._id === tenantId);
          const oldPropertyIds = (oldTenant?.properties || []).map(p => p.propertyId).sort().join(',');
          const newPropertyIds = (updatedTenant.properties || []).map(p => p.propertyId).sort().join(',');
          const propertyChanged = oldPropertyIds !== newPropertyIds;

          if (propertyChanged) {
            // Property assignment changed - need full reload to handle list membership
            console.log("📋 Property assignment changed, reloading list...");
            if (this.selectedProperty === "UNASSIGNED") {
              await this.loadUnassignedTenants();
            } else if (this.selectedProperty) {
              await this.loadTenantsForProperty(this.selectedProperty);
            } else {
              await this.loadTenants();
            }
          } else {
            // Same property - update in place for better performance
            const tenantIndex = this.tenants.findIndex((t) => t._id === tenantId);
            if (tenantIndex !== -1) {
              // Preserve any extra fields that might have been added during display
              this.tenants[tenantIndex] = { ...this.tenants[tenantIndex], ...updatedTenant };
              console.log("📋 Tenant updated in place, re-rendering table...");
              await this.renderTenantsTable();
            } else {
              // Tenant not in current list - might be viewing different property
              console.log("📋 Tenant not in current view, skipping re-render");
            }
          }
        } else {
          // No tenant data returned - fallback to reload
          if (this.selectedProperty === "UNASSIGNED") {
            await this.loadUnassignedTenants();
          } else if (this.selectedProperty) {
            await this.loadTenantsForProperty(this.selectedProperty);
          } else {
            await this.loadTenants();
          }
        }
      } else {
        alert("Failed to update tenant: " + result.error);
      }
    } catch (error) {
      console.error("Error updating tenant:", error);
      alert("Error updating tenant: " + error.message);
      throw error; // Re-throw to handle in form submission
    }
  }

  async deleteTenant(tenantId) {
    // Find the tenant to get their name for the confirmation message
    const tenant = this.tenants.find((t) => t._id === tenantId);
    if (!tenant) {
      alert("Tenant not found");
      return;
    }

    if (!confirm(`Are you sure you want to delete tenant ${tenant.name}?`)) {
      return;
    }

    try {
      if (!tenant._id) {
        throw new Error("Tenant ID not found");
      }

      const response = await API.delete(
        API_CONFIG.ENDPOINTS.TENANT_BY_ID(tenant._id),
      );

      const result = await response.json();

      if (result.success) {
        // Notify other modules that tenant data has changed
        if (window.dashboardController) {
          window.dashboardController.markTenantDataChanged();
        }
        // Reload the list
        if (this.selectedProperty === "UNASSIGNED") {
          await this.loadUnassignedTenants();
        } else if (this.selectedProperty) {
          await this.loadTenantsForProperty(this.selectedProperty);
        } else {
          await this.loadTenants();
        }
      } else {
        alert("Failed to delete tenant: " + result.error);
      }
    } catch (error) {
      console.error("Error deleting tenant:", error);
      alert("Error deleting tenant. Please try again.");
    }
  }

  // Method to assign tenant to property
  async assignToProperty(fin, propertyId) {
    try {
      const response = await API.post(
        API_CONFIG.ENDPOINTS.TENANT_ADD_PROPERTY(fin),
        { propertyId },
      );

      const result = await response.json();

      if (result.success) {
        // Notify other modules that tenant data has changed
        if (window.dashboardController) {
          window.dashboardController.markTenantDataChanged();
        }
        await this.loadTenants(); // Reload the list
      } else {
        alert("Failed to assign tenant to property: " + result.error);
      }
    } catch (error) {
      console.error("Error assigning tenant to property:", error);
      alert("Error assigning tenant to property. Please try again.");
    }
  }

  // Utility method to escape HTML to prevent XSS
  escapeHtml(text) {
    if (text == null || text === undefined) {
      return "";
    }
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
  }

  // Method to get registration status badge
  getRegistrationStatusBadge(status) {
    switch (status) {
      case "registered":
        return '<span class="badge bg-success">Registered</span>';
      case "pending":
        return '<span class="badge bg-warning">Pending Registration</span>';
      case "pending_deregistration":
        return '<span class="badge bg-info">Pending Deregistration</span>';
      case "unregistered":
      default:
        return '<span class="badge bg-secondary">Unregistered</span>';
    }
  }

  // Method to render todo badge with popover
  renderTenantTodoBadge(tenant) {
    if (!tenant.todos || tenant.todos.length === 0) {
      return "";
    }

    const pendingTodos = tenant.todos.filter((todo) => !todo.completed);
    if (pendingTodos.length === 0) {
      return "";
    }

    const todoListHtml = pendingTodos
      .map((todo) => {
        let todoHtml = `<div class="todo-item">• ${this.escapeHtml(todo.text)}`;

        // Add completion info if available (for historical data)
        if (todo.completedBy && todo.completedAt) {
          const completedDate = new Date(todo.completedAt);
          const dateStr = completedDate.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          todoHtml += `<div class="todo-completion-info">Completed by ${this.escapeHtml(todo.completedBy)} on ${dateStr}</div>`;
        }

        todoHtml += "</div>";
        return todoHtml;
      })
      .join("");

    const badgeId = `todo-badge-${tenant._id}`;
    const popoverId = `todo-popover-${tenant._id}`;

    return `
      <span
        class="badge bg-warning text-dark tenant-todo-badge position-relative"
        id="${badgeId}"
        data-tenant-id="${tenant._id}"
        style="cursor: pointer;"
      >
        <i class="bi bi-list-task"></i> ${pendingTodos.length}
        <div class="tenant-todo-popover" id="${popoverId}" style="display: none;">
          <div class="popover-header">Pending Tasks (${pendingTodos.length})</div>
          <div class="popover-body">${todoListHtml}</div>
        </div>
      </span>
    `;
  }

  // Setup event listeners for todo badge hover interactions
  setupTodoBadgeListeners() {
    const badges = document.querySelectorAll(".tenant-todo-badge");
    badges.forEach((badge) => {
      const popover = badge.querySelector(".tenant-todo-popover");
      if (!popover) return;

      badge.addEventListener("mouseenter", () => {
        popover.style.display = "block";
      });

      badge.addEventListener("mouseleave", () => {
        popover.style.display = "none";
      });
    });
  }

  // 3-state toggle button methods
  toggleRegistrationStatus() {
    const button = document.getElementById("tenantRegistrationStatus");
    const hiddenInput = document.getElementById(
      "tenantRegistrationStatusHidden",
    );

    if (!button || !hiddenInput) return;

    const currentStatus = button.getAttribute("data-status");
    let nextStatus;

    // Cycle through states: unregistered → pending → registered → pending_deregistration → unregistered
    switch (currentStatus) {
      case "unregistered":
        nextStatus = "pending";
        break;
      case "pending":
        nextStatus = "registered";
        break;
      case "registered":
        nextStatus = "pending_deregistration";
        break;
      case "pending_deregistration":
        nextStatus = "unregistered";
        break;
      default:
        nextStatus = "unregistered";
    }

    this.setRegistrationStatus(nextStatus);
  }

  setRegistrationStatus(status) {
    const button = document.getElementById("tenantRegistrationStatus");
    const hiddenInput = document.getElementById(
      "tenantRegistrationStatusHidden",
    );
    const statusText = button.querySelector(".status-text");

    if (!button || !hiddenInput || !statusText) return;

    // Update button attributes
    button.setAttribute("data-status", status);
    hiddenInput.value = status;

    // Update button text
    switch (status) {
      case "registered":
        statusText.textContent = "Registered";
        break;
      case "pending":
        statusText.textContent = "Pending Registration";
        break;
      case "pending_deregistration":
        statusText.textContent = "Pending Deregistration";
        break;
      case "unregistered":
      default:
        statusText.textContent = "Unregistered";
    }

    // Check for changes to update the submit button state
    this.checkForChanges();
  }

  // Use global image utilities
  normalizeImageUrl(url) {
    return ImageUtils.normalizeImageUrl(url);
  }

  getOptimizedAvatarUrl(url, size = "small") {
    return ImageUtils.getOptimizedImageUrl(url, size);
  }

  // Public method to refresh the tenants list
  refresh() {
    // Reload current property if one is selected
    if (this.selectedProperty === "UNASSIGNED") {
      this.loadUnassignedTenants();
    } else if (this.selectedProperty) {
      this.loadTenantsForProperty(this.selectedProperty);
    } else {
      this.loadTenants();
    }
  }

  // Multiple image upload methods
  openImageUpload(type) {
    this.currentUploadType = type;
    const fileInput = document.getElementById("imageUploadInput");
    fileInput.click();

    // Add event listener for file selection (supports multiple files)
    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        this.uploadMultipleImages(Array.from(e.target.files), type);
      }
    };
  }

  async uploadMultipleImages(files, type) {
    const uploadButton = document.querySelector(
      `button[onclick="tenantManager.openImageUpload('${type}')"]`,
    );
    const originalText = uploadButton.innerHTML;

    try {
      // Show loading state
      uploadButton.disabled = true;
      uploadButton.innerHTML = `<i class="bi bi-hourglass-split"></i> Uploading ${files.length} image(s)...`;

      const uploadPromises = files.map((file) => this.uploadSingleImage(file));
      const results = await Promise.all(uploadPromises);

      // Add successful uploads to the image array
      const imageArray =
        type === "passport" ? this.passportPics : this.visaPics;
      results.forEach((result) => {
        if (result.success) {
          console.log("🔗 Received image URL from upload:", result.url);
          console.log("🔧 Original URL from backend:", result.originalUrl);
          console.log("🔧 Public ID from backend:", result.publicId);

          // Ensure URL is properly formatted
          let imageUrl = result.url;
          if (imageUrl && !imageUrl.startsWith("http")) {
            // If it's a relative URL starting with /, prepend the API base URL
            if (imageUrl.startsWith("/")) {
              imageUrl = API_CONFIG.BASE_URL + imageUrl;
            } else {
              // Otherwise assume it needs https:// prefix
              imageUrl = "https://" + imageUrl;
            }
          }

          console.log("🔗 Final image URL to store:", imageUrl);
          imageArray.push(imageUrl);
        }
      });

      // Update gallery display
      this.updateImageGallery(type);
      this.checkForChanges();

      const successCount = results.filter((r) => r.success).length;
      console.log(
        `✅ ${successCount}/${files.length} ${type} images uploaded successfully`,
      );

      if (successCount < files.length) {
        alert(
          `${successCount}/${files.length} images uploaded successfully. Some uploads failed.`,
        );
      }
    } catch (error) {
      console.error(`Error uploading ${type} images:`, error);
      alert(`Error uploading ${type} images. Please try again.`);
    } finally {
      // Restore button state
      uploadButton.disabled = false;
      uploadButton.innerHTML = originalText;
    }
  }

  async uploadSingleImage(file) {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const uploadUrl = buildApiUrl(
        API_CONFIG.ENDPOINTS.UPLOAD_TENANT_DOCUMENT,
      );
      console.log("🔧 Upload URL:", uploadUrl);
      console.log("🔧 Base URL:", API_CONFIG.BASE_URL);

      const response = await fetch(uploadUrl, {
        method: "POST",
        credentials: "include", // Important for cookies
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });

      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  addImageFromUrl(type) {
    const urlInput = document.getElementById(
      `tenant${type.charAt(0).toUpperCase() + type.slice(1)}PicUrl`,
    );
    const url = urlInput.value.trim();

    if (!url) {
      alert("Please enter a valid image URL");
      return;
    }

    // Add to appropriate array
    const imageArray = type === "passport" ? this.passportPics : this.visaPics;
    if (!imageArray.includes(url)) {
      imageArray.push(url);
      this.updateImageGallery(type);
      urlInput.value = ""; // Clear input after adding
      this.checkForChanges();
    } else {
      alert("This image URL is already added");
    }
  }

  removeImage(type, index) {
    const imageArray = type === "passport" ? this.passportPics : this.visaPics;
    imageArray.splice(index, 1);
    this.updateImageGallery(type);
    this.checkForChanges();
  }

  handleImageError(imgElement, proxyUrl) {
    console.error("❌ Image failed to load via proxy:", proxyUrl);
    console.error("Image element:", imgElement);
    console.error("Current src attribute:", imgElement.src);
    console.error(
      "Has fallback been attempted?",
      imgElement.hasAttribute("data-fallback-attempted"),
    );

    // Try to extract Cloudinary path from proxy URL and create direct Cloudinary URL
    try {
      // Extract the path after image-proxy/
      const match = proxyUrl.match(/image-proxy\/(.+)$/);
      if (match) {
        const cloudinaryPath = match[1];
        const directUrl = `https://res.cloudinary.com/djye0w3gi/image/upload/${cloudinaryPath}`;
        console.log("🔄 Trying direct Cloudinary URL as fallback:", directUrl);

        // Set a flag to prevent infinite recursion
        if (!imgElement.hasAttribute("data-fallback-attempted")) {
          imgElement.setAttribute("data-fallback-attempted", "true");
          imgElement.src = directUrl;

          // Test if the direct URL is accessible by making a fetch request
          fetch(directUrl, { method: "HEAD" })
            .then((response) => {
              console.log(
                "🧪 Direct URL test result:",
                response.status,
                response.statusText,
              );
              if (!response.ok) {
                console.error("🚨 Direct URL also failed:", response.status);
              }
            })
            .catch((err) => {
              console.error("🚨 Direct URL fetch test failed:", err);
            });

          return;
        }
      }
    } catch (error) {
      console.error("Error creating fallback URL:", error);
    }

    // Final fallback: show error placeholder
    console.log("🚨 All fallback attempts failed, showing error placeholder");
    imgElement.style.objectFit = "cover";
    imgElement.style.backgroundColor = "#e9ecef";
    imgElement.src =
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'><rect width='150' height='150' fill='%23e9ecef'/><text x='75' y='75' text-anchor='middle' dy='.3em' fill='%236c757d'>Image Failed</text></svg>";
  }

  updateImageGallery(type) {
    const gallery = document.getElementById(`${type}Gallery`);
    const imageArray = type === "passport" ? this.passportPics : this.visaPics;
    const hiddenInput = document.getElementById(
      `tenant${type.charAt(0).toUpperCase() + type.slice(1)}Pics`,
    );

    if (!gallery || !hiddenInput) {
      return;
    }

    // Update hidden input
    hiddenInput.value = JSON.stringify(imageArray);

    if (imageArray.length === 0) {
      gallery.innerHTML =
        '<div class="text-muted small">No images uploaded yet</div>';
      return;
    }

    // Create images with proper loading handling
    let html = '<div class="row g-2">';
    imageArray.forEach((url, index) => {
      const icon = type === "passport" ? "bi-passport" : "bi-credit-card";
      const imageHtml = `
                <div class="col-6 col-md-4 mb-3">
                    <div class="position-relative border rounded overflow-hidden">
                        <img src="${this.normalizeImageUrl(
        url,
      )}" alt="${type} ${index + 1}" 
                             class="img-fluid w-100" 
                             style="height: 150px; object-fit: contain; cursor: pointer; background-color: #f8f9fa;"
                             onclick="window.open('${url}', '_blank')" />
                        <button type="button" 
                                class="btn btn-danger position-absolute top-0 end-0 m-1"
                                onclick="tenantManager.removeImage('${type}', ${index})"
                                style="padding: 2px; font-size: 0.8rem; opacity: 0.9; border-radius: 50%; width: 28px; height: 28px; display: flex !important; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 1000; background-color: #dc3545 !important; border: 2px solid white; line-height: 1;"
                                onmouseover="this.style.opacity='1'; this.style.transform='scale(1.1)'"
                                onmouseout="this.style.opacity='0.9'; this.style.transform='scale(1)'"
                                title="Delete image">
                            ✕
                        </button>
                        <div class="position-absolute bottom-0 start-0 end-0 bg-primary bg-opacity-90 text-white text-center py-2">
                            <small><i class="bi ${icon} me-1"></i>${type.charAt(0).toUpperCase() + type.slice(1)
        } ${index + 1}</small>
                        </div>
                    </div>
                </div>
            `;
      html += imageHtml;
    });
    html += "</div>";

    gallery.innerHTML = html;
  }

  setupImageUrlListeners() {
    // These are no longer needed with the new multiple image approach
    // The URL inputs now have dedicated "Add" buttons
  }

  // Avatar upload methods
  openAvatarUpload() {
    const fileInput = document.getElementById("avatarUploadInput");
    fileInput.click();

    // Add event listener for file selection
    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        this.uploadAvatar(e.target.files[0]);
      }
    };
  }

  async uploadAvatar(file) {
    const uploadButton = document.querySelector(
      'button[onclick="tenantManager.openAvatarUpload()"]',
    );
    const originalText = uploadButton.innerHTML;

    try {
      // Show loading state
      uploadButton.disabled = true;
      uploadButton.innerHTML =
        '<i class="bi bi-hourglass-split"></i> Uploading avatar...';

      const result = await this.uploadSingleImage(file);

      if (result.success) {
        console.log("🔗 Avatar uploaded successfully:", result.url);

        // Ensure URL is properly formatted
        let imageUrl = result.url;
        if (imageUrl && !imageUrl.startsWith("http")) {
          // If it's a relative URL starting with /, prepend the API base URL
          if (imageUrl.startsWith("/")) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            // Otherwise assume it needs https:// prefix
            imageUrl = "https://" + imageUrl;
          }
        }

        this.avatar = imageUrl;
        this.updateAvatarPreview();
        this.checkForChanges();

        console.log("✅ Avatar set to:", this.avatar);
      } else {
        alert("Failed to upload avatar: " + result.error);
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Error uploading avatar. Please try again.");
    } finally {
      // Restore button state
      uploadButton.disabled = false;
      uploadButton.innerHTML = originalText;
    }
  }

  addAvatarFromUrl() {
    const urlInput = document.getElementById("tenantAvatarUrl");
    const url = urlInput.value.trim();

    if (!url) {
      alert("Please enter a valid image URL");
      return;
    }

    this.avatar = url;
    this.updateAvatarPreview();
    urlInput.value = ""; // Clear input after adding
    this.checkForChanges(); // Check for changes to enable submit button

    console.log("✅ Avatar set from URL:", this.avatar);
  }

  removeAvatar() {
    this.avatar = "";
    this.updateAvatarPreview();
    this.checkForChanges(); // Check for changes to enable submit button
    console.log("🗑️ Avatar removed");
  }

  updateAvatarPreview() {
    const preview = document.getElementById("avatarPreview");
    const hiddenInput = document.getElementById("tenantAvatar");

    if (!preview || !hiddenInput) {
      return;
    }

    // Update hidden input
    hiddenInput.value = this.avatar;

    if (!this.avatar) {
      preview.innerHTML =
        '<div class="text-muted small">No avatar selected</div>';
      return;
    }

    preview.innerHTML = `
            <div class="position-relative d-inline-block">
                <img src="${this.getOptimizedAvatarUrl(
      this.avatar,
      "medium",
    )}" alt="Avatar preview" 
                     class="rounded-circle border" 
                     style="width: 80px; height: 80px; object-fit: cover; cursor: pointer;" 
                     onclick="window.open('${this.normalizeImageUrl(
      this.avatar,
    )}', '_blank')" />
                <button type="button" 
                        class="btn btn-danger position-absolute top-0 end-0"
                        onclick="tenantManager.removeAvatar()"
                        style="padding: 2px; font-size: 0.7rem; border-radius: 50%; width: 24px; height: 24px; display: flex !important; align-items: center; justify-content: center; transform: translate(25%, -25%);"
                        title="Remove avatar">
                    ✕
                </button>
                <div class="text-center mt-2">
                    <small class="text-muted">Avatar Preview</small>
                </div>
            </div>
        `;
  }

  // ==================== SIGNATURE METHODS ====================

  openSignatureUpload() {
    const fileInput = document.getElementById("signatureUploadInput");
    if (!fileInput) {
      // Create file input if it doesn't exist
      const input = document.createElement("input");
      input.type = "file";
      input.id = "signatureUploadInput";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
    }

    document.getElementById("signatureUploadInput").click();

    // Add event listener for file selection
    document.getElementById("signatureUploadInput").onchange = (e) => {
      if (e.target.files.length > 0) {
        this.uploadSignature(e.target.files[0]);
      }
    };
  }

  async uploadSignature(file) {
    const uploadButton = document.querySelector(
      'button[onclick="tenantManager.openSignatureUpload()"]',
    );
    const originalText = uploadButton.innerHTML;

    try {
      // Show loading state
      uploadButton.disabled = true;
      uploadButton.innerHTML =
        '<i class="bi bi-hourglass-split"></i> Uploading signature...';

      const result = await this.uploadSingleImage(file);

      if (result.success) {
        let imageUrl = result.url;

        // Normalize the URL
        if (imageUrl && !imageUrl.startsWith("http")) {
          if (imageUrl.startsWith("/")) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            imageUrl = "https://" + imageUrl;
          }
        }

        this.signature = imageUrl;
        this.updateSignaturePreview();
        this.checkForChanges();

        console.log("✅ Signature set to:", this.signature);
      } else {
        alert("Failed to upload signature: " + result.error);
      }
    } catch (error) {
      console.error("Error uploading signature:", error);
      alert("Error uploading signature. Please try again.");
    } finally {
      // Reset button state
      uploadButton.disabled = false;
      uploadButton.innerHTML = originalText;
    }
  }

  setSignatureFromUrl() {
    const urlInput = document.getElementById("tenantSignatureUrl");
    const url = urlInput.value.trim();

    if (!url) {
      alert("Please enter a valid image URL");
      return;
    }

    this.signature = this.normalizeImageUrl(url);
    this.updateSignaturePreview();
    urlInput.value = ""; // Clear input after adding
    this.checkForChanges();

    console.log("✅ Signature set from URL:", this.signature);
  }

  removeSignature() {
    this.signature = "";
    this.updateSignaturePreview();
    this.checkForChanges();
    console.log("🗑️ Signature removed");
  }

  updateSignaturePreview() {
    const preview = document.getElementById("signaturePreview");

    if (!preview) {
      return;
    }

    if (!this.signature) {
      preview.innerHTML =
        '<p class="text-muted fst-italic">No signature uploaded</p>';
      return;
    }

    preview.innerHTML = `
            <div class="position-relative d-inline-block">
                <img src="${this.signature}" 
                     alt="Signature Preview" 
                     class="img-thumbnail" 
                     style="max-width: 200px; max-height: 100px; cursor: pointer;"
                     onclick="window.open('${this.signature}', '_blank')" />
                <button type="button" 
                        class="btn btn-danger position-absolute top-0 end-0"
                        onclick="tenantManager.removeSignature()"
                        style="padding: 2px; font-size: 0.7rem; border-radius: 50%; width: 24px; height: 24px; display: flex !important; align-items: center; justify-content: center; transform: translate(25%, -25%);"
                        title="Remove signature">
                    ✕
                </button>
                <div class="text-center mt-2">
                    <small class="text-muted">Signature Preview</small>
                </div>
            </div>
        `;
  }

  toggleSignatureSection() {
    const signatureSection = document.getElementById("signatureSection");
    if (!signatureSection) return;

    // Always show signature section for all tenants (not just main tenants)
    signatureSection.style.display = "";
  }

  setupSignatureUrlListener() {
    const urlInput = document.getElementById("tenantSignatureUrl");
    if (urlInput) {
      // Remove existing event listener to avoid duplicates
      urlInput.removeEventListener("keypress", this.signatureUrlHandler);

      this.signatureUrlHandler = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.setSignatureFromUrl();
        }
      };

      urlInput.addEventListener("keypress", this.signatureUrlHandler);
    }
  }

  // Helper method to check if tenant has any main tenant properties
  hasMainTenantProperty(tenant) {
    if (!tenant.properties || !Array.isArray(tenant.properties)) {
      return false;
    }
    return tenant.properties.some((prop) => {
      // Handle both new object format and old string format
      return typeof prop === "object" && prop.isMainTenant;
    });
  }

  // Helper method to check if tenant is outdated (moveout date has passed)
  isTenantOutdated(tenant, propertyId) {
    if (!tenant.properties || !Array.isArray(tenant.properties)) {
      return false;
    }

    // If checking for a specific property
    if (propertyId && propertyId !== "UNASSIGNED") {
      const property = tenant.properties.find((prop) => {
        const propId = typeof prop === "object" ? prop.propertyId : prop;
        return propId === propertyId;
      });

      if (property && typeof property === "object" && property.moveoutDate) {
        const moveoutDate = new Date(property.moveoutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day
        return moveoutDate < today;
      }
      return false;
    }

    // For unassigned or general check, check if ANY property has passed moveout date
    return tenant.properties.some((prop) => {
      if (typeof prop === "object" && prop.moveoutDate) {
        const moveoutDate = new Date(prop.moveoutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return moveoutDate < today;
      }
      return false;
    });
  }

  // Helper method to render property details for each tenant
  renderPropertyDetails(tenant) {
    if (!tenant.properties || tenant.properties.length === 0) {
      return '<div class="text-muted small">No properties assigned</div>';
    }

    let html = "";
    tenant.properties.forEach((prop, index) => {
      if (typeof prop === "object" && prop.propertyId) {
        // New format with detailed property info
        const propertyId = this.escapeHtml(prop.propertyId);
        const room = this.escapeHtml(
          prop.room ? getRoomTypeDisplayName(prop.room) : "N/A",
        );
        const moveinDate = prop.moveinDate
          ? new Date(prop.moveinDate).toLocaleDateString()
          : "N/A";
        const moveoutDate = prop.moveoutDate
          ? new Date(prop.moveoutDate).toLocaleDateString()
          : "Current";
        const isMain = prop.isMainTenant
          ? '<span class="badge bg-primary ms-1" style="font-size: 0.6em;">Main</span>'
          : "";

        html += `
                    <div class="mb-1 ${index > 0 ? "border-top pt-1" : ""}">
                        <div><strong>${propertyId}</strong> ${isMain}</div>
                        <small class="text-muted">Room: ${room} | In: ${moveinDate} | Out: ${moveoutDate}</small>
                    </div>
                `;
      } else {
        // Old format - just property ID string
        const propertyId =
          typeof prop === "string"
            ? prop
            : prop.propertyId || prop._id || "Unknown";
        html += `
                    <div class="mb-1 ${index > 0 ? "border-top pt-1" : ""}">
                        <div><strong>${this.escapeHtml(
          propertyId,
        )}</strong></div>
                        <small class="text-muted">Legacy format - no details</small>
                    </div>
                `;
      }
    });

    return html || '<div class="text-muted small">No properties assigned</div>';
  }

  setupChangeDetection() {
    // Set up event listeners for form fields to detect changes
    const form = document.getElementById("tenantForm");
    if (!form) return;

    const fieldsToWatch = [
      "tenantName",
      "tenantNickname",
      "tenantFin",
      "tenantPassport",
      "tenantPhoneNumber",
      "tenantFacebookUrl",
      "tenantRent",
      "tenantDeposit",
      "tenantDepositReceiver",
      "tenantCleaningFee",
      "tenantNotes",
    ];

    fieldsToWatch.forEach((fieldId) => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener("input", () => this.checkForChanges());
      }
    });

    // Also listen for registration status changes
    const registrationButtons = form.querySelectorAll(
      'input[name="registrationStatus"]',
    );
    registrationButtons.forEach((button) => {
      button.addEventListener("change", () => this.checkForChanges());
    });

    // Listen for checkbox changes
    const isHouseCleanerCheckbox = document.getElementById(
      "tenantIsHouseCleaner",
    );
    if (isHouseCleanerCheckbox) {
      isHouseCleanerCheckbox.addEventListener("change", () =>
        this.checkForChanges(),
      );
    }
    const isUtilitySubsidizedCheckbox = document.getElementById(
      "tenantIsUtilitySubsidized",
    );
    if (isUtilitySubsidizedCheckbox) {
      isUtilitySubsidizedCheckbox.addEventListener("change", () =>
        this.checkForChanges(),
      );
    }

    // Listen for roommate dropdown changes
    const roommateDropdown = document.getElementById("tenantRoommateId");
    if (roommateDropdown) {
      roommateDropdown.addEventListener("change", () => this.checkForChanges());
    }

    // Listen for global room/date/main tenant field changes
    const roomField = document.getElementById("tenantRoom");
    const moveInField = document.getElementById("tenantMoveInDate");
    const moveOutField = document.getElementById("tenantMoveOutDate");
    const mainTenantField = document.getElementById("tenantIsMainTenant");

    if (roomField) {
      roomField.addEventListener("change", () => {
        this.syncGlobalFieldToFirstProperty("room", roomField.value.toUpperCase());
      });
    }
    if (moveInField) {
      moveInField.addEventListener("change", () => {
        this.syncGlobalFieldToFirstProperty("moveinDate", moveInField.value);
      });
    }
    if (moveOutField) {
      moveOutField.addEventListener("change", () => {
        this.syncGlobalFieldToFirstProperty("moveoutDate", moveOutField.value);
      });
    }
    if (mainTenantField) {
      mainTenantField.addEventListener("change", () => {
        this.syncGlobalFieldToFirstProperty("isMainTenant", mainTenantField.checked);
      });
    }
  }

  // Sync global form field to first property in selectedPropertiesDetails
  syncGlobalFieldToFirstProperty(field, value) {
    if (this.selectedPropertiesDetails && this.selectedPropertiesDetails.length > 0) {
      this.selectedPropertiesDetails[0][field] = value;
      // Also update the property card UI if it exists
      this.updateSelectedPropertiesList();
    }
    this.checkForChanges();
  }

  checkForChanges() {
    if (!this.originalTenantData) {
      return; // No original data to compare against
    }

    const currentData = this.getCurrentFormData();
    const hasChanges = this.hasDataChanged(
      this.originalTenantData,
      currentData,
    );

    const submitBtn = document.getElementById("tenantSubmitBtn");
    if (submitBtn) {
      submitBtn.disabled = !hasChanges;
      if (hasChanges) {
        submitBtn.classList.remove("btn-secondary");
        submitBtn.classList.add("btn-primary");
      } else {
        submitBtn.classList.remove("btn-primary");
        submitBtn.classList.add("btn-secondary");
      }
    }
  }

  getCurrentFormData() {
    return {
      name: (document.getElementById("tenantName")?.value || "").trim(),
      nickname: (document.getElementById("tenantNickname")?.value || "").trim(),
      fin: (document.getElementById("tenantFin")?.value || "").trim(),
      passportNumber: (
        document.getElementById("tenantPassport")?.value || ""
      ).trim(),
      phoneNumber: (
        document.getElementById("tenantPhoneNumber")?.value || ""
      ).trim(),
      facebookUrl: (
        document.getElementById("tenantFacebookUrl")?.value || ""
      ).trim(),
      registrationStatus:
        document.getElementById("tenantRegistrationStatusHidden")?.value ||
        "unregistered",
      properties: this.selectedPropertiesDetails || [],
      passportPics: this.passportPics || [],
      visaPics: this.visaPics || [],
      avatar: this.avatar || "",
      signature: this.signature || "",
      // New financial fields
      rent: document.getElementById("tenantRent")?.value
        ? parseFloat(document.getElementById("tenantRent").value)
        : null,
      deposit: document.getElementById("tenantDeposit")?.value
        ? parseFloat(document.getElementById("tenantDeposit").value)
        : null,
      depositReceiver: (
        document.getElementById("tenantDepositReceiver")?.value || ""
      ).trim(),
      cleaningFee: document.getElementById("tenantCleaningFee")?.value
        ? parseFloat(document.getElementById("tenantCleaningFee").value)
        : null,
      isUtilitySubsidized:
        document.getElementById("tenantIsUtilitySubsidized")?.checked || false,
      isHouseCleaner:
        document.getElementById("tenantIsHouseCleaner")?.checked || false,
      // Roommate relationship
      roommateId: (
        document.getElementById("tenantRoommateId")?.value || ""
      ).trim(),
      // Notes and todos
      notes: (document.getElementById("tenantNotes")?.value || "").trim(),
      todos: this.todos || [],
    };
  }

  hasDataChanged(original, current) {
    // Compare basic fields
    const fieldsToCompare = [
      "name",
      "nickname",
      "fin",
      "passportNumber",
      "phoneNumber",
      "facebookUrl",
      "registrationStatus",
      "avatar",
      "signature",
      "rent",
      "deposit",
      "depositReceiver",
      "cleaningFee",
      "isUtilitySubsidized",
      "isHouseCleaner",
      "roommateId",
      "notes",
    ];

    // Numeric fields that should be compared as numbers
    const numericFields = ["rent", "deposit", "cleaningFee"];
    // Boolean fields that should be compared as booleans
    const booleanFields = ["isUtilitySubsidized", "isHouseCleaner"];

    for (const field of fieldsToCompare) {
      if (numericFields.includes(field)) {
        // For numeric fields, compare as numbers (treat null, undefined, and empty string as null)
        const originalValue =
          original[field] === null ||
            original[field] === undefined ||
            original[field] === ""
            ? null
            : Number(original[field]);
        const currentValue =
          current[field] === null ||
            current[field] === undefined ||
            current[field] === ""
            ? null
            : Number(current[field]);
        if (originalValue !== currentValue) {
          return true;
        }
      } else if (booleanFields.includes(field)) {
        // For boolean fields, compare as booleans
        const originalValue =
          original[field] === true || original[field] === "true";
        const currentValue =
          current[field] === true || current[field] === "true";
        if (originalValue !== currentValue) {
          return true;
        }
      } else {
        // For string fields, compare as strings
        const originalValue = (original[field] || "").toString().trim();
        const currentValue = (current[field] || "").toString().trim();
        if (originalValue !== currentValue) {
          return true;
        }
      }
    }

    // Compare arrays (passportPics, visaPics)
    if (
      !this.arraysEqual(original.passportPics || [], current.passportPics || [])
    ) {
      return true;
    }
    if (!this.arraysEqual(original.visaPics || [], current.visaPics || [])) {
      return true;
    }

    // Compare properties array
    if (
      !this.propertiesEqual(original.properties || [], current.properties || [])
    ) {
      return true;
    }

    // Compare todos array
    if (!this.todosEqual(original.todos || [], current.todos || [])) {
      return true;
    }

    return false;
  }

  arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((item, index) => item === arr2[index]);
  }

  todosEqual(todos1, todos2) {
    if (todos1.length !== todos2.length) return false;

    return todos1.every((todo1, index) => {
      const todo2 = todos2[index];
      if (!todo2) return false;

      return (
        todo1.id === todo2.id &&
        todo1.text === todo2.text &&
        todo1.completed === todo2.completed
      );
    });
  }

  propertiesEqual(props1, props2) {
    if (props1.length !== props2.length) return false;

    return props1.every((prop1, index) => {
      const prop2 = props2[index];
      if (!prop2) return false;

      return (
        prop1.propertyId === prop2.propertyId &&
        prop1.isMainTenant === prop2.isMainTenant &&
        (prop1.room || "") === (prop2.room || "") &&
        (prop1.moveinDate || "") === (prop2.moveinDate || "") &&
        (prop1.moveoutDate || "") === (prop2.moveoutDate || "")
      );
    });
  }

  // Setup clipboard paste functionality for image URL input fields
  setupClipboardPasteListeners() {
    // This will be called during init, but actual setup happens when modal is shown
    console.log("📋 Clipboard paste listeners initialized");
  }

  // Set up clipboard listeners specifically when modal is shown
  setupModalClipboardListeners() {
    const imageUrlFields = [
      "tenantAvatarUrl",
      "tenantPassportPicUrl",
      "tenantVisaPicUrl",
      "tenantSignatureUrl",
    ];

    imageUrlFields.forEach((fieldId) => {
      this.setupPasteListenerForField(fieldId);
    });

    console.log("📋 Modal clipboard listeners set up for tenant dialog");
  }

  setupPasteListenerForField(fieldId) {
    const field = document.getElementById(fieldId);
    if (field && !field.hasAttribute("data-paste-listener-added")) {
      field.setAttribute("data-paste-listener-added", "true");

      // Add paste event listener
      field.addEventListener("paste", async (e) => {
        e.preventDefault();
        await this.handleImagePaste(e, fieldId);
      });

      // Add visual feedback for paste capability
      const currentPlaceholder =
        field.placeholder || "Paste Cloudinary URL here";
      if (!currentPlaceholder.includes("Ctrl+V")) {
        field.placeholder =
          currentPlaceholder + " (Ctrl+V to paste from clipboard)";
      }
      field.title = "You can paste images from clipboard here (Ctrl+V)";

      // Add a visual indicator
      field.style.borderLeft = "3px solid #0d6efd";
      field.setAttribute("data-clipboard-enabled", "true");

      console.log(`✅ Clipboard paste listener added to ${fieldId}`);
    }
  }

  async handleImagePaste(event, fieldId) {
    try {
      const items = (event.clipboardData || event.originalEvent?.clipboardData)
        ?.items;
      if (!items) {
        console.log("No clipboard items found");
        return;
      }

      let imageFound = false;

      // Check all clipboard items for images
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.indexOf("image") !== -1) {
          imageFound = true;
          const file = item.getAsFile();

          if (file) {
            console.log(
              `📋 Image pasted from clipboard to ${fieldId}:`,
              file.name,
              file.type,
            );
            await this.uploadClipboardImage(file, fieldId);
            break; // Handle only the first image found
          }
        }
      }

      if (!imageFound) {
        // Check if there's text content that might be an image URL
        const text =
          event.clipboardData?.getData("text") ||
          event.originalEvent?.clipboardData?.getData("text");
        if (text && this.isImageUrl(text)) {
          console.log(
            `📋 Image URL pasted from clipboard to ${fieldId}:`,
            text,
          );
          document.getElementById(fieldId).value = text;
        } else {
          console.log("No image found in clipboard");
          // Show a brief message to user
          this.showPasteMessage(
            fieldId,
            "No image found in clipboard",
            "warning",
          );
        }
      }
    } catch (error) {
      console.error("Error handling clipboard paste:", error);
      this.showPasteMessage(fieldId, "Error pasting from clipboard", "error");
    }
  }

  async uploadClipboardImage(file, fieldId) {
    const field = document.getElementById(fieldId);
    const originalPlaceholder = field.placeholder;

    try {
      // Show uploading state
      field.placeholder = "Uploading image from clipboard...";
      field.disabled = true;

      // Upload the image using existing upload method
      const result = await this.uploadSingleImage(file);

      if (result.success) {
        // Ensure URL is properly formatted
        let imageUrl = result.url;
        if (imageUrl && !imageUrl.startsWith("http")) {
          if (imageUrl.startsWith("/")) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            imageUrl = "https://" + imageUrl;
          }
        }

        // Set the URL in the input field
        field.value = imageUrl;

        // Auto-add the image based on the field type
        if (fieldId === "tenantAvatarUrl") {
          this.addAvatarFromUrl();
        } else if (fieldId === "tenantPassportPicUrl") {
          this.addImageFromUrl("passport");
        } else if (fieldId === "tenantVisaPicUrl") {
          this.addImageFromUrl("visa");
        } else if (fieldId === "tenantSignatureUrl") {
          this.setSignatureFromUrl();
        }

        this.showPasteMessage(
          fieldId,
          "Image uploaded successfully!",
          "success",
        );
        console.log(
          `✅ Clipboard image uploaded successfully to ${fieldId}:`,
          imageUrl,
        );
      } else {
        this.showPasteMessage(
          fieldId,
          "Failed to upload image: " + result.error,
          "error",
        );
      }
    } catch (error) {
      console.error("Error uploading clipboard image:", error);
      this.showPasteMessage(fieldId, "Error uploading image", "error");
    } finally {
      // Restore field state
      field.placeholder = originalPlaceholder;
      field.disabled = false;
    }
  }

  isImageUrl(url) {
    // Simple check for image URL patterns
    return (
      /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url) ||
      url.includes("cloudinary.com") ||
      url.includes("imgur.com") ||
      url.includes("drive.google.com")
    );
  }

  showPasteMessage(fieldId, message, type) {
    // Create a temporary message element
    const field = document.getElementById(fieldId);
    const messageId = `paste-message-${fieldId}`;

    // Remove any existing message
    const existingMessage = document.getElementById(messageId);
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement("div");
    messageDiv.id = messageId;
    messageDiv.className = `alert alert-${type === "success" ? "success" : type === "warning" ? "warning" : "danger"
      } alert-dismissible fade show mt-2`;
    messageDiv.style.fontSize = "0.875rem";
    messageDiv.innerHTML = `
            <i class="bi bi-${type === "success"
        ? "check-circle"
        : type === "warning"
          ? "exclamation-triangle"
          : "x-circle"
      } me-1"></i>
            ${message}
        `;

    // Insert after the field
    field.parentNode.insertBefore(messageDiv, field.nextSibling);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 3000);
  }

  // Helper function to get move-in date for a tenant's specific property
  getTenantMoveInDate(tenant, propertyId) {
    if (!tenant.properties || !Array.isArray(tenant.properties)) {
      return null;
    }

    const property = tenant.properties.find(
      (prop) => typeof prop === "object" && prop.propertyId === propertyId,
    );

    if (property && property.moveinDate) {
      const date = new Date(property.moveinDate);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }

    return null;
  }

  copyTenantList(propertyId) {
    try {
      // Find tenants for this property
      const groupedTenants = this.groupTenantsByProperty(this.tenants);
      const tenantsInProperty = groupedTenants[propertyId];

      if (!tenantsInProperty || tenantsInProperty.length === 0) {
        alert("No tenants found for this property");
        return;
      }

      // Get property info for display
      const propertyInfo = this.getPropertyInfo(propertyId);
      const propertyDisplay = propertyInfo
        ? `${propertyInfo.address}, ${propertyInfo.unit}`
        : propertyId;

      // Format tenant list
      let copyText = `Property: ${propertyDisplay}\n\n`;

      tenantsInProperty.forEach((tenant, index) => {
        const ordinalNumber = index + 1;
        const isMainTenant = this.hasMainTenantProperty(tenant);
        const mainTenantIndicator = isMainTenant ? " ✅ (Main Tenant)" : "";

        copyText += `${ordinalNumber}. ${tenant.name}${mainTenantIndicator}\n`;
        copyText += `   FIN: ${tenant.fin}\n`;
        copyText += `   Passport: ${tenant.passportNumber}\n\n`;
      });

      // Copy to clipboard
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          // Show success message
          this.showCopySuccessMessage(tenantsInProperty.length);
        })
        .catch((err) => {
          console.error("Failed to copy to clipboard:", err);
          // Fallback: show the text in an alert
          alert(
            "Copy failed. Here's the text to copy manually:\n\n" + copyText,
          );
        });
    } catch (error) {
      console.error("Error copying tenant list:", error);
      alert("Error copying tenant list. Please try again.");
    }
  }

  copyAllTenants() {
    try {
      // Check if a property is selected
      if (!this.selectedProperty) {
        alert("Please select a property first");
        return;
      }

      // Check if there are tenants to copy
      if (!this.tenants || this.tenants.length === 0) {
        const message =
          this.selectedProperty === "UNASSIGNED"
            ? "No unassigned tenants to copy"
            : "No tenants found for this property";
        alert(message);
        return;
      }

      // Filter out outdated tenants
      const activeTenants = this.tenants.filter(
        (tenant) => !this.isTenantOutdated(tenant, this.selectedProperty),
      );

      if (activeTenants.length === 0) {
        alert("No active tenants to copy (all tenants are outdated)");
        return;
      }

      // Get property info for display
      let propertyDisplay = "";
      if (this.selectedProperty === "UNASSIGNED") {
        propertyDisplay = "Unassigned Tenants";
      } else {
        const propertyInfo = this.getPropertyInfo(this.selectedProperty);
        propertyDisplay = propertyInfo
          ? `${propertyInfo.address}, ${propertyInfo.unit} (${this.selectedProperty})`
          : this.selectedProperty;
      }

      // Format tenant list with all requested fields
      let copyText = `Property: ${propertyDisplay}\n`;
      copyText += `Total Active Tenants: ${activeTenants.length}\n`;
      copyText += `Generated on: ${new Date().toLocaleString()}\n`;
      copyText += `${"=".repeat(80)}\n\n`;

      activeTenants.forEach((tenant, index) => {
        const ordinalNumber = index + 1;
        const isMainTenant = this.hasMainTenantProperty(tenant);
        const mainTenantIndicator = isMainTenant ? " ✅ (Main Tenant)" : "";
        const registrationStatus =
          tenant.registrationStatus ||
          (tenant.isRegistered ? "registered" : "unregistered");
        const moveinDate = this.getTenantMoveInDate(
          tenant,
          this.selectedProperty,
        );

        copyText += `${ordinalNumber}. ${tenant.name}${mainTenantIndicator}\n`;
        copyText += `   FIN: ${tenant.fin || "N/A"}\n`;
        copyText += `   Passport: ${tenant.passportNumber || "N/A"}\n`;
        copyText += `   Registration Status: ${registrationStatus.toUpperCase()}\n`;
        if (moveinDate) {
          copyText += `   Move-in Date: ${moveinDate}\n`;
        }
        copyText += `\n`;
      });

      // Copy to clipboard
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          // Show success message
          this.showCopySuccessMessage(activeTenants.length);
        })
        .catch((err) => {
          console.error("Failed to copy to clipboard:", err);
          // Fallback: show the text in an alert
          alert(
            "Copy failed. Here's the text to copy manually:\n\n" + copyText,
          );
        });
    } catch (error) {
      console.error("Error copying tenant list:", error);
      alert("Error copying tenant list. Please try again.");
    }
  }

  copyRegisteredTenants() {
    try {
      // Check if a property is selected
      if (!this.selectedProperty) {
        alert("Please select a property first");
        return;
      }

      // Check if there are tenants to copy
      if (!this.tenants || this.tenants.length === 0) {
        const message =
          this.selectedProperty === "UNASSIGNED"
            ? "No unassigned tenants to copy"
            : "No tenants found for this property";
        alert(message);
        return;
      }

      // Filter for only registered and non-outdated tenants
      const registeredTenants = this.tenants.filter((tenant) => {
        const registrationStatus =
          tenant.registrationStatus ||
          (tenant.isRegistered ? "registered" : "unregistered");
        const isOutdated = this.isTenantOutdated(tenant, this.selectedProperty);
        return registrationStatus === "registered" && !isOutdated;
      });

      // Check if there are any registered tenants
      if (registeredTenants.length === 0) {
        const message =
          this.selectedProperty === "UNASSIGNED"
            ? "No registered active unassigned tenants to copy"
            : "No registered active tenants found for this property";
        alert(message);
        return;
      }

      // Get property info for display
      let propertyDisplay = "";
      if (this.selectedProperty === "UNASSIGNED") {
        propertyDisplay = "Unassigned Tenants";
      } else {
        const propertyInfo = this.getPropertyInfo(this.selectedProperty);
        propertyDisplay = propertyInfo
          ? `${propertyInfo.address}, ${propertyInfo.unit} (${this.selectedProperty})`
          : this.selectedProperty;
      }

      // Format tenant list with all requested fields
      let copyText = `Property: ${propertyDisplay}\n`;
      copyText += `Registered Active Tenants Only: ${registeredTenants.length}\n`;
      copyText += `Generated on: ${new Date().toLocaleString()}\n`;
      copyText += `${"=".repeat(80)}\n\n`;

      registeredTenants.forEach((tenant, index) => {
        const ordinalNumber = index + 1;
        const isMainTenant = this.hasMainTenantProperty(tenant);
        const mainTenantIndicator = isMainTenant ? " ✅ (Main Tenant)" : "";
        const moveinDate = this.getTenantMoveInDate(
          tenant,
          this.selectedProperty,
        );

        copyText += `${ordinalNumber}. ${tenant.name}${mainTenantIndicator}\n`;
        copyText += `   FIN: ${tenant.fin || "N/A"}\n`;
        copyText += `   Passport: ${tenant.passportNumber || "N/A"}\n`;
        copyText += `   Registration Status: REGISTERED\n`;
        if (moveinDate) {
          copyText += `   Move-in Date: ${moveinDate}\n`;
        }
        copyText += `\n`;
      });

      // Copy to clipboard
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          // Show success message
          this.showCopySuccessMessage(registeredTenants.length);
        })
        .catch((err) => {
          console.error("Failed to copy to clipboard:", err);
          // Fallback: show the text in an alert
          alert(
            "Copy failed. Here's the text to copy manually:\n\n" + copyText,
          );
        });
    } catch (error) {
      console.error("Error copying registered tenant list:", error);
      alert("Error copying registered tenant list. Please try again.");
    }
  }

  copyRegisteredAndPendingTenants(includeMoveIn = true) {
    try {
      // Check if a property is selected
      if (!this.selectedProperty) {
        alert("Please select a property first");
        return;
      }

      // Check if there are tenants to copy
      if (!this.tenants || this.tenants.length === 0) {
        const message =
          this.selectedProperty === "UNASSIGNED"
            ? "No unassigned tenants to copy"
            : "No tenants found for this property";
        alert(message);
        return;
      }

      // Helper to get registration status
      const getStatus = (tenant) =>
        tenant.registrationStatus ||
        (tenant.isRegistered ? "registered" : "unregistered");

      // Filter for registered tenants (non-outdated)
      const registeredTenants = this.tenants.filter((tenant) => {
        const isOutdated = this.isTenantOutdated(tenant, this.selectedProperty);
        return getStatus(tenant) === "registered" && !isOutdated;
      });

      // Filter for pending tenants (non-outdated)
      const pendingTenants = this.tenants.filter((tenant) => {
        const isOutdated = this.isTenantOutdated(tenant, this.selectedProperty);
        return getStatus(tenant) === "pending" && !isOutdated;
      });

      const totalCount = registeredTenants.length + pendingTenants.length;

      // Check if there are any matching tenants
      if (totalCount === 0) {
        const message =
          this.selectedProperty === "UNASSIGNED"
            ? "No registered or pending active unassigned tenants to copy"
            : "No registered or pending active tenants found for this property";
        alert(message);
        return;
      }

      // Get property info for display
      let propertyDisplay = "";
      if (this.selectedProperty === "UNASSIGNED") {
        propertyDisplay = "Unassigned Tenants";
      } else {
        const propertyInfo = this.getPropertyInfo(this.selectedProperty);
        propertyDisplay = propertyInfo
          ? `${propertyInfo.address}, ${propertyInfo.unit}`
          : this.selectedProperty;
      }

      // Helper to format a single tenant entry (WhatsApp/Messenger friendly)
      const formatTenant = (tenant, index) => {
        const isMainTenant = this.hasMainTenantProperty(tenant);
        const mainTenantIndicator = isMainTenant ? " (Main)" : "";

        let entry = `${index}. *${tenant.name}*${mainTenantIndicator}`;
        entry += `\nFIN: ${tenant.fin || "-"}`;
        entry += `\nPassport: ${tenant.passportNumber || "-"}`;
        if (includeMoveIn) {
          const moveinDate = this.getTenantMoveInDate(tenant, this.selectedProperty);
          if (moveinDate) {
            entry += `\nMove-in: ${moveinDate}`;
          }
        }
        return entry;
      };

      // Build the copy text (WhatsApp/Messenger friendly format)
      let copyText = `📍 *${propertyDisplay}*\n\n`;

      let runningIndex = 1;

      // Registered tenants section
      if (registeredTenants.length > 0) {
        copyText += `✅ *REGISTERED* (${registeredTenants.length})\n\n`;
        registeredTenants.forEach((tenant) => {
          copyText += formatTenant(tenant, runningIndex++) + "\n\n";
        });
      }

      // Pending tenants section
      if (pendingTenants.length > 0) {
        copyText += `⏳ *PENDING* (${pendingTenants.length})\n\n`;
        pendingTenants.forEach((tenant) => {
          copyText += formatTenant(tenant, runningIndex++) + "\n\n";
        });
      }

      // Summary
      copyText += `📊 *Total: ${totalCount}*`;

      // Copy to clipboard
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          this.showCopySuccessMessage(totalCount);
        })
        .catch((err) => {
          console.error("Failed to copy to clipboard:", err);
          alert("Copy failed. Here's the text to copy manually:\n\n" + copyText);
        });
    } catch (error) {
      console.error("Error copying registered and pending tenant list:", error);
      alert("Error copying tenant list. Please try again.");
    }
  }

  copyOutdatedTenants() {
    try {
      // Check if a property is selected
      if (!this.selectedProperty) {
        alert("Please select a property first");
        return;
      }

      // Check if there are tenants to copy
      if (!this.tenants || this.tenants.length === 0) {
        const message =
          this.selectedProperty === "UNASSIGNED"
            ? "No unassigned tenants to copy"
            : "No tenants found for this property";
        alert(message);
        return;
      }

      // Filter for only outdated tenants
      const outdatedTenants = this.tenants.filter((tenant) =>
        this.isTenantOutdated(tenant, this.selectedProperty),
      );

      // Check if there are any outdated tenants
      if (outdatedTenants.length === 0) {
        const message =
          this.selectedProperty === "UNASSIGNED"
            ? "No outdated unassigned tenants to copy"
            : "No outdated tenants found for this property";
        alert(message);
        return;
      }

      // Get property info for display
      let propertyDisplay = "";
      if (this.selectedProperty === "UNASSIGNED") {
        propertyDisplay = "Unassigned Tenants";
      } else {
        const propertyInfo = this.getPropertyInfo(this.selectedProperty);
        propertyDisplay = propertyInfo
          ? `${propertyInfo.address}, ${propertyInfo.unit} (${this.selectedProperty})`
          : this.selectedProperty;
      }

      // Format tenant list with all requested fields
      let copyText = `Property: ${propertyDisplay}\n`;
      copyText += `Outdated Tenants Only: ${outdatedTenants.length}\n`;
      copyText += `Generated on: ${new Date().toLocaleString()}\n`;
      copyText += `${"=".repeat(80)}\n\n`;

      outdatedTenants.forEach((tenant, index) => {
        const ordinalNumber = index + 1;
        const isMainTenant = this.hasMainTenantProperty(tenant);
        const mainTenantIndicator = isMainTenant ? " ✅ (Main Tenant)" : "";
        const registrationStatus =
          tenant.registrationStatus ||
          (tenant.isRegistered ? "registered" : "unregistered");
        const moveinDate = this.getTenantMoveInDate(
          tenant,
          this.selectedProperty,
        );

        // Get moveout date
        let moveoutDate = "N/A";
        if (tenant.properties && Array.isArray(tenant.properties)) {
          const property = tenant.properties.find((prop) => {
            const propId = typeof prop === "object" ? prop.propertyId : prop;
            return this.selectedProperty !== "UNASSIGNED"
              ? propId === this.selectedProperty
              : true;
          });
          if (
            property &&
            typeof property === "object" &&
            property.moveoutDate
          ) {
            const date = new Date(property.moveoutDate);
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            moveoutDate = `${day}/${month}/${year}`;
          }
        }

        copyText += `${ordinalNumber}. ${tenant.name}${mainTenantIndicator}\n`;
        copyText += `   FIN: ${tenant.fin || "N/A"}\n`;
        copyText += `   Passport: ${tenant.passportNumber || "N/A"}\n`;
        copyText += `   Registration Status: ${registrationStatus.toUpperCase()}\n`;
        if (moveinDate) {
          copyText += `   Move-in Date: ${moveinDate}\n`;
        }
        copyText += `   Move-out Date: ${moveoutDate}\n`;
        copyText += `\n`;
      });

      // Copy to clipboard
      navigator.clipboard
        .writeText(copyText)
        .then(() => {
          // Show success message
          this.showCopySuccessMessage(outdatedTenants.length);
        })
        .catch((err) => {
          console.error("Failed to copy to clipboard:", err);
          // Fallback: show the text in an alert
          alert(
            "Copy failed. Here's the text to copy manually:\n\n" + copyText,
          );
        });
    } catch (error) {
      console.error("Error copying outdated tenant list:", error);
      alert("Error copying outdated tenant list. Please try again.");
    }
  }

  showCopySuccessMessage(tenantCount) {
    // Create a temporary success message
    const messageDiv = document.createElement("div");
    messageDiv.className =
      "alert alert-success alert-dismissible fade show position-fixed";
    messageDiv.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
    messageDiv.innerHTML = `
            <i class="bi bi-check-circle me-2"></i>
            Copied ${tenantCount} tenant${tenantCount !== 1 ? "s" : ""
      } to clipboard!
            <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        `;

    document.body.appendChild(messageDiv);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 3000);
  }

  // Pagination removed - now using property-based navigation

  /**
   * Download tenants as Excel file
   * Sorts active tenants first, then inactive
   */
  async downloadTenantExcel() {
    if (!this.selectedProperty) {
      alert("Please select a property first");
      return;
    }

    try {
      // Get current tenants (already loaded and sorted by backend)
      let tenants = this.tenants || [];

      if (tenants.length === 0) {
        alert("No tenants to download for this property");
        return;
      }

      // Sort tenants: active first, then inactive (moved out)
      const now = new Date();
      tenants = [...tenants].sort((a, b) => {
        const aProp =
          a.properties?.find((p) => p.propertyId === this.selectedProperty) ||
          {};
        const bProp =
          b.properties?.find((p) => p.propertyId === this.selectedProperty) ||
          {};

        const aIsActive =
          !aProp.moveoutDate || new Date(aProp.moveoutDate) > now;
        const bIsActive =
          !bProp.moveoutDate || new Date(bProp.moveoutDate) > now;

        // Active tenants first
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;

        // If both same status, sort by name
        return (a.name || "").localeCompare(b.name || "");
      });

      // Prepare data for Excel
      const excelData = tenants.map((tenant) => {
        // Get property info for this property
        const propertyInfo =
          tenant.properties?.find(
            (p) => p.propertyId === this.selectedProperty,
          ) || {};

        const isActive =
          !propertyInfo.moveoutDate ||
          new Date(propertyInfo.moveoutDate) > new Date();

        return {
          "Tenant ID": tenant._id || "",
          Name: tenant.name || "",
          Nickname: tenant.nickname || "",
          "FIN/NRIC": tenant.fin || "",
          "Passport Number": tenant.passportNumber || "",
          "Phone Number": tenant.phoneNumber || "",
          "Facebook URL": tenant.facebookUrl || "",
          "Registration Status": tenant.registrationStatus || "unregistered",
          "Property ID": this.selectedProperty,
          Room: propertyInfo.room || "",
          "Move-in Date": propertyInfo.moveinDate
            ? new Date(propertyInfo.moveinDate).toISOString().split("T")[0]
            : "",
          "Move-out Date": propertyInfo.moveoutDate
            ? new Date(propertyInfo.moveoutDate).toISOString().split("T")[0]
            : "",
          "Is Main Tenant": propertyInfo.isMainTenant ? "Yes" : "No",
          "Monthly Rent (SGD)": tenant.rent || "",
          "Deposit Amount (SGD)": tenant.deposit || "",
          "Deposit Receiver": tenant.depositReceiver || "",
          "Cleaning Fee (SGD)": tenant.cleaningFee || "",
          "Utility Subsidized": tenant.isUtilitySubsidized ? "Yes" : "No",
          "Is House Cleaner": tenant.isHouseCleaner ? "Yes" : "No",
          "Avatar URL": tenant.avatar || "",
          "Signature URL": tenant.signature || "",
          Status: isActive ? "Active" : "Inactive",
        };
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 25 }, // Tenant ID
        { wch: 20 }, // Name
        { wch: 15 }, // Nickname
        { wch: 15 }, // FIN/NRIC
        { wch: 15 }, // Passport
        { wch: 15 }, // Phone
        { wch: 40 }, // Facebook URL
        { wch: 18 }, // Registration Status
        { wch: 40 }, // Property ID
        { wch: 15 }, // Room
        { wch: 12 }, // Move-in Date
        { wch: 12 }, // Move-out Date
        { wch: 15 }, // Is Main Tenant
        { wch: 18 }, // Monthly Rent
        { wch: 18 }, // Deposit Amount
        { wch: 20 }, // Deposit Receiver
        { wch: 18 }, // Cleaning Fee
        { wch: 18 }, // Is House Cleaner
        { wch: 50 }, // Avatar URL
        { wch: 50 }, // Signature URL
        { wch: 10 }, // Status
      ];
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Tenants");

      // Generate filename with property ID and date
      const propertyName =
        this.selectedProperty === "UNASSIGNED"
          ? "Unassigned"
          : this.selectedProperty.replace(/[^a-zA-Z0-9]/g, "_");
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `Tenants_${propertyName}_${dateStr}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      this.showSuccessMessage(
        `Downloaded ${tenants.length} tenant(s) to ${filename}`,
      );
    } catch (error) {
      console.error("Error downloading Excel:", error);
      alert("Failed to download Excel file: " + error.message);
    }
  }

  /**
   * Handle Excel file upload for bulk tenant update
   */
  async handleExcelUpload(event) {
    // Check admin permission
    if (!isAdmin()) {
      alert("Only administrators can upload tenant data");
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    // Reset file input so same file can be uploaded again
    event.target.value = "";

    if (!this.selectedProperty) {
      alert("Please select a property first");
      return;
    }

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          // Parse Excel file
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          // Get first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            alert("No data found in Excel file");
            return;
          }

          // Validate and prepare tenant updates
          const updates = [];
          const errors = [];

          jsonData.forEach((row, index) => {
            const rowNum = index + 2; // +2 for Excel row (header is row 1)

            // Validate required fields
            if (!row["Tenant ID"]) {
              errors.push(`Row ${rowNum}: Missing Tenant ID`);
              return;
            }
            if (!row["Name"]) {
              errors.push(`Row ${rowNum}: Missing Name`);
              return;
            }
            if (!row["Passport Number"]) {
              errors.push(`Row ${rowNum}: Missing Passport Number`);
              return;
            }

            // Prepare update object
            const update = {
              tenantId: row["Tenant ID"],
              name: row["Name"],
              nickname: row["Nickname"] || null,
              fin: row["FIN/NRIC"] || null,
              passportNumber: row["Passport Number"],
              phoneNumber: row["Phone Number"] || null,
              facebookUrl: row["Facebook URL"] || null,
              registrationStatus: row["Registration Status"] || "unregistered",
              rent: row["Monthly Rent (SGD)"]
                ? parseFloat(row["Monthly Rent (SGD)"])
                : null,
              deposit: row["Deposit Amount (SGD)"]
                ? parseFloat(row["Deposit Amount (SGD)"])
                : null,
              depositReceiver: row["Deposit Receiver"] || null,
              cleaningFee: row["Cleaning Fee (SGD)"]
                ? parseFloat(row["Cleaning Fee (SGD)"])
                : null,
              isUtilitySubsidized: row["Utility Subsidized"] === "Yes",
              isHouseCleaner: row["Is House Cleaner"] === "Yes",
              avatar: row["Avatar URL"] || null,
              signature: row["Signature URL"] || null,
              // Property assignment info
              propertyId: row["Property ID"] || this.selectedProperty,
              room: row["Room"] || null,
              moveinDate: row["Move-in Date"] || null,
              moveoutDate: row["Move-out Date"] || null,
              isMainTenant: row["Is Main Tenant"] === "Yes",
            };

            updates.push(update);
          });

          if (errors.length > 0) {
            alert("Validation errors:\n\n" + errors.join("\n"));
            return;
          }

          // Confirm before updating
          const confirmed = confirm(
            `Upload ${updates.length} tenant update(s)?\n\n` +
            "This will update existing tenants based on Tenant ID.\n" +
            "Make sure the data is correct before proceeding.",
          );

          if (!confirmed) return;

          // Send bulk update to backend
          await this.bulkUpdateTenants(updates);
        } catch (parseError) {
          console.error("Error parsing Excel:", parseError);
          alert("Failed to parse Excel file: " + parseError.message);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error uploading Excel:", error);
      alert("Failed to upload Excel file: " + error.message);
    }
  }

  /**
   * Send bulk tenant updates to backend
   */
  async bulkUpdateTenants(updates) {
    try {
      const response = await API.post(
        API_CONFIG.ENDPOINTS.TENANTS + "/bulk-update",
        {
          updates: updates,
        },
      );

      const result = await response.json();

      if (result.success) {
        // Notify other modules that tenant data has changed
        if (window.dashboardController) {
          window.dashboardController.markTenantDataChanged();
        }
        this.showSuccessMessage(
          `Successfully updated ${result.updatedCount || updates.length
          } tenant(s)`,
        );

        // Reload tenants for current property
        if (this.selectedProperty === "UNASSIGNED") {
          await this.loadUnassignedTenants();
        } else {
          await this.loadTenantsForProperty(this.selectedProperty);
        }
      } else {
        alert("Failed to update tenants: " + (result.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error in bulk update:", error);
      alert("Failed to update tenants: " + error.message);
    }
  }

  /**
   * Show success message helper
   */
  showSuccessMessage(message) {
    const messageDiv = document.createElement("div");
    messageDiv.className =
      "alert alert-success alert-dismissible fade show position-fixed";
    messageDiv.style.cssText = `
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
    messageDiv.innerHTML = `
            <i class="bi bi-check-circle me-2"></i>
            ${message}
            <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
        `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }

  // Todo list management methods
  addTodoItem() {
    const input = document.getElementById("tenantNewTodoInput");
    const text = input.value.trim();

    if (!text) {
      alert("Please enter a task");
      return;
    }

    if (text.length > 500) {
      alert("Task text cannot exceed 500 characters");
      return;
    }

    const todo = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: text,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    this.todos.push(todo);
    this.renderTodoList();
    input.value = "";
    this.checkForChanges(); // Trigger change detection
  }

  removeTodoItem(todoId) {
    this.todos = this.todos.filter((todo) => todo.id !== todoId);
    this.renderTodoList();
    this.checkForChanges(); // Trigger change detection
  }

  toggleTodoItem(todoId) {
    const todo = this.todos.find((t) => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;

      // Track completion information
      if (todo.completed) {
        // Task is being marked as completed
        todo.completedAt = new Date();
        const currentUser = window.getCurrentUser
          ? window.getCurrentUser()
          : null;
        todo.completedBy = currentUser ? currentUser.username : "Unknown User";
      } else {
        // Task is being unmarked
        todo.completedAt = null;
        todo.completedBy = null;
      }

      this.renderTodoList();
      this.checkForChanges(); // Trigger change detection
    }
  }

  renderTodoList() {
    const container = document.getElementById("tenantTodoItems");
    if (!container) return;

    if (this.todos.length === 0) {
      container.innerHTML = '<p class="text-muted mb-0">No tasks yet</p>';
      return;
    }

    let html = '<div class="list-group list-group-flush">';

    this.todos.forEach((todo) => {
      // Format completion info
      let completionInfo = "";
      if (todo.completed && todo.completedBy) {
        const completedDate = todo.completedAt
          ? new Date(todo.completedAt)
          : null;
        const dateStr = completedDate
          ? completedDate.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }) +
          " " +
          completedDate.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })
          : "";
        completionInfo = `
          <div class="small text-muted mt-1">
            <i class="bi bi-check-circle-fill text-success me-1"></i>
            Completed by ${this.escapeHtml(todo.completedBy)} ${dateStr ? "on " + dateStr : ""}
          </div>
        `;
      }

      html += `
        <div class="list-group-item px-0 d-flex align-items-start gap-2">
          <input
            type="checkbox"
            class="form-check-input mt-1 flex-shrink-0"
            ${todo.completed ? "checked" : ""}
            onchange="tenantManager.toggleTodoItem('${todo.id}')"
          />
          <div class="flex-grow-1">
            <span class="${todo.completed ? "text-decoration-line-through text-muted" : ""}">
              ${this.escapeHtml(todo.text)}
            </span>
            ${completionInfo}
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger flex-shrink-0"
            onclick="tenantManager.removeTodoItem('${todo.id}')"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `;
    });

    html += "</div>";
    container.innerHTML = html;

    // Update hidden field for form submission
    const hiddenField = document.getElementById("tenantTodosHidden");
    if (hiddenField) {
      hiddenField.value = JSON.stringify(this.todos);
    }
  }
}

// Export for use in other modules
window.TenantManagementComponent = TenantManagementComponent;
