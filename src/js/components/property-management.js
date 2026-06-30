import { ROOM_TYPE_MAP } from '../utils/room-type-mapper.js';

/**
 * Property Management Component
 * Handles property CRUD operations
 */
class PropertyManagementComponent {
  constructor() {
    this.properties = [];
    this.currentWifiImages = [];
    this.propertyImage = ''; // Store property image URL
    this.originalPropertyImage = ''; // Store original property image URL for edit mode (to preserve if not changed)
    this.editingProperty = null; // Store reference to property being edited
    this.currentAcContactNumbers = []; // Store AC service contact numbers
    this.allInvestors = []; // Store all investors for management fee payee dropdown
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadProperties();
    this.loadAcServiceCompanies();
    this.loadAllInvestors();
    this.populateRoomTypesDropdown();
  }

  populateRoomTypesDropdown() {
    const dropdownMenu = document.getElementById("propertyRoomsDropdownMenu");
    const hiddenSelect = document.getElementById("propertyRooms");

    if (!dropdownMenu || !hiddenSelect) return;

    // Clear existing content
    dropdownMenu.innerHTML = '';
    hiddenSelect.innerHTML = '';

    // Populate hidden select options
    Object.entries(ROOM_TYPE_MAP).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      hiddenSelect.appendChild(option);
    });

    // Add checkboxes to dropdown menu
    Object.entries(ROOM_TYPE_MAP).forEach(([value, label]) => {
      dropdownMenu.innerHTML += `
        <div class="form-check px-3 py-2" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor=''">
          <input class="form-check-input property-room-checkbox" type="checkbox" value="${value}" id="room_${value}" style="margin: 0; width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; position: relative;">
          <label class="form-check-label" for="room_${value}" style="cursor: pointer; flex: 1; margin: 0;">
            ${label}
          </label>
        </div>
      `;
    });

    // Setup event listeners for checkboxes
    this.setupPropertyRoomsCheckboxListeners();

    // Prevent dropdown from closing when clicking inside
    const dropdownMenuElement = document.getElementById('propertyRoomsDropdownMenu');
    if (dropdownMenuElement) {
      dropdownMenuElement.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  setupPropertyRoomsCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.property-room-checkbox');

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.updatePropertyRoomsSelection();
      });
    });
  }

  updatePropertyRoomsSelection() {
    const checkboxes = document.querySelectorAll('.property-room-checkbox');
    const hiddenSelect = document.getElementById("propertyRooms");
    const selectedText = document.getElementById("propertyRoomsSelectedText");

    if (!hiddenSelect || !selectedText) return;

    // Get selected rooms
    const selectedRooms = [];
    checkboxes.forEach(checkbox => {
      const option = Array.from(hiddenSelect.options).find(opt => opt.value === checkbox.value);
      if (option) {
        option.selected = checkbox.checked;
        if (checkbox.checked) {
          selectedRooms.push(option.textContent);
        }
      }
    });

    // Update display text
    if (selectedRooms.length === 0) {
      selectedText.textContent = 'Select rooms...';
      selectedText.classList.add('text-muted');
    } else if (selectedRooms.length <= 3) {
      selectedText.textContent = selectedRooms.join(', ');
      selectedText.classList.remove('text-muted');
    } else {
      selectedText.textContent = `${selectedRooms.length} rooms selected`;
      selectedText.classList.remove('text-muted');
    }
  }

  async loadAcServiceCompanies() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.AC_SERVICE_COMPANIES_ACTIVE);
      const result = await response.json();

      if (result.success) {
        this.acServiceCompanies = result.companies || [];
        console.log(`📋 Loaded ${this.acServiceCompanies.length} AC service companies`);
        this.populateAcServiceCompanyDropdown();
      } else {
        console.error("Failed to load AC service companies:", result.error);
        this.acServiceCompanies = [];
      }
    } catch (error) {
      console.error("Error loading AC service companies:", error);
      this.acServiceCompanies = [];
    }
  }

  async loadAllInvestors() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();

      if (result.success) {
        this.allInvestors = result.data || result.investors || [];
        console.log(`📋 Loaded ${this.allInvestors.length} investors for management fee dropdown`);
        // Re-render cards in case properties loaded before investors (race condition)
        if (this.properties && this.properties.length > 0) {
          this.renderPropertiesTable();
        }
      } else {
        console.error("Failed to load investors:", result.error);
        this.allInvestors = [];
      }
    } catch (error) {
      console.error("Error loading investors:", error);
      this.allInvestors = [];
    }
  }

  getNextPropertyId() {
    if (!this.properties || this.properties.length === 0) return 1;

    // Find all numeric IDs
    const numericIds = this.properties
      .map(p => {
        const id = p.propertyId;
        // Try to match numbers in the ID (handles cases like "PROP001" or "123")
        const match = id?.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
      })
      .filter(id => id !== null);

    if (numericIds.length === 0) return this.properties.length + 1;

    // Return max + 1
    return Math.max(...numericIds) + 1;
  }

  populateManagementFeePayeeDropdown(propertyId = null) {
    const dropdown = document.getElementById("managementFeePayee");
    if (!dropdown) return;

    // Clear existing options except the first one
    dropdown.innerHTML = '<option value="">-- Select Investor --</option>';

    // If a propertyId is provided, filter investors for that property
    // Otherwise, show all investors
    let investorsToShow = this.allInvestors;

    if (propertyId) {
      // Filter to show only investors who own this property
      investorsToShow = this.allInvestors.filter(investor =>
        investor.properties && investor.properties.some(p => p.propertyId === propertyId)
      );
    }

    // Add investors as options
    investorsToShow.forEach(investor => {
      const option = document.createElement('option');
      option.value = investor.investorId;
      option.textContent = `${investor.name} (${investor.investorId})`;
      dropdown.appendChild(option);
    });

    console.log(`📋 Populated management fee payee dropdown with ${investorsToShow.length} investors`);
  }

  populateAccountantDropdown() {
    const dropdown = document.getElementById("accountant");
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">-- Select Accountant --</option>';

    this.allInvestors.forEach(investor => {
      const option = document.createElement('option');
      option.value = investor.investorId;
      option.textContent = `${investor.name} (${investor.investorId})`;
      dropdown.appendChild(option);
    });

    // Force reset to placeholder — browsers may restore a prior selection
    // when a matching option is appended back into the dropdown
    dropdown.selectedIndex = 0;
  }

  updateAccountantAvatarPreview(investorId) {
    const preview = document.getElementById("accountantAvatarPreview");
    const circle = document.getElementById("accountantAvatarCircle");
    const nameEl = document.getElementById("accountantAvatarName");
    const idEl = document.getElementById("accountantAvatarId");

    if (!investorId) {
      if (preview) preview.style.display = "none";
      return;
    }

    const investor = this.allInvestors.find(i => i.investorId === investorId);
    if (!investor) {
      if (preview) preview.style.display = "none";
      return;
    }

    if (preview) preview.style.display = "flex";
    if (nameEl) nameEl.textContent = investor.name;
    if (idEl) idEl.textContent = investor.investorId;

    if (circle) {
      if (investor.avatar) {
        circle.innerHTML = `<img src="${investor.avatar}" style="width:100%;height:100%;object-fit:cover;" alt="${this.escapeHtml(investor.name)}">`;
      } else {
        const initials = investor.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        circle.style.background = 'linear-gradient(135deg,#6f42c1,#9d4edd)';
        circle.style.display = 'flex';
        circle.style.alignItems = 'center';
        circle.style.justifyContent = 'center';
        circle.innerHTML = `<span style="color:#fff;font-weight:700;font-size:16px;">${initials}</span>`;
      }
    }
  }

  populateAcServiceCompanyDropdown() {
    const dropdown = document.getElementById("acServiceCompanyId");
    if (!dropdown) return;

    // Clear existing options except the first one
    dropdown.innerHTML = '<option value="">-- Select AC Service Company --</option>';

    // Add companies as options
    this.acServiceCompanies.forEach(company => {
      const option = document.createElement('option');
      option.value = company.companyId;
      option.textContent = `${company.name} (${company.phone})`;
      dropdown.appendChild(option);
    });
  }

  setupEventListeners() {
    // Add property button
    const addPropertyBtn = document.getElementById("addPropertyBtn");
    if (addPropertyBtn) {
      addPropertyBtn.addEventListener("click", () => {
        this.showAddPropertyModal();
      });
    }

    // Property form submission (add/edit)
    const propertyForm = document.getElementById("propertyForm");
    if (propertyForm) {
      propertyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handlePropertySubmit(e);
      });
    }

    // Set default move-in date to today
    const moveInDateInput = document.getElementById("moveInDate");
    if (moveInDateInput && !moveInDateInput.value) {
      moveInDateInput.value = new Date().toISOString().split("T")[0];
    }

    // AC Service Date change listener
    const acServiceDateInput = document.getElementById("acServiceDate");
    if (acServiceDateInput) {
      acServiceDateInput.addEventListener("change", (e) => {
        this.handleAcServiceDateChange(e.target.value);
      });
    }

    // Search functionality
    const searchInput = document.getElementById("propertySearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filterProperties(e.target.value);
      });
    }

    // OneMap API - Fetch address from postcode
    const fetchAddressBtn = document.getElementById("fetchAddressBtn");
    if (fetchAddressBtn) {
      fetchAddressBtn.addEventListener("click", () => {
        const postcode = document.getElementById("postcode").value;
        this.fetchAddressFromPostcode(postcode);
      });
    }

    // Accountant dropdown - update avatar preview on change
    const accountantDropdown = document.getElementById("accountant");
    if (accountantDropdown) {
      accountantDropdown.addEventListener("change", (e) => {
        this.updateAccountantAvatarPreview(e.target.value);
      });
    }

    // Auto-fetch when 6 digits are entered
    const postcodeInput = document.getElementById("postcode");
    if (postcodeInput) {
      postcodeInput.addEventListener("input", (e) => {
        const postcode = e.target.value.trim();
        if (postcode.length === 6 && /^\d+$/.test(postcode)) {
          this.fetchAddressFromPostcode(postcode);
        }
      });
    }
  }

  async fetchAddressFromPostcode(postcode) {
    if (!postcode || postcode.length !== 6 || !/^\d+$/.test(postcode)) {
      if (postcode.length === 6) {
        alert("Please enter a valid 6-digit postal code.");
      }
      return;
    }

    const fetchBtn = document.getElementById("fetchAddressBtn");
    const originalBtnHtml = fetchBtn?.innerHTML;

    try {
      if (fetchBtn) {
        fetchBtn.disabled = true;
        fetchBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
      }

      console.log(`🔍 Fetching address for postcode: ${postcode}`);
      const onemapToken = process.env.ONEMAP_API_TOKEN;
      const response = await fetch(
        `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postcode}&returnGeom=N&getAddrDetails=Y`,
        {
          headers: onemapToken ? { Authorization: onemapToken } : {},
        }
      );
      const data = await response.json();

      if (data && data.results && data.results.length > 0) {
        const result = data.results[0];
        // OneMap returns a full ADDRESS field like "122 MIDDLE ROAD SINGAPORE 188065"
        // We'll use it and strip the " SINGAPORE 188065" part for a cleaner look
        let address = result.ADDRESS || "";
        if (address) {
          address = address.replace(/ SINGAPORE \d{6}$/i, "");
        }

        const addressInput = document.getElementById("address");
        if (addressInput) {
          addressInput.value = address;
          // Trigger input event to ensure any listeners (like validation) are fired
          addressInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        console.log(`✅ Address found: ${address}`);
      } else {
        console.warn("No results found for this postcode.");
        alert("No address found for this postal code. Please enter manually.");
      }
    } catch (error) {
      console.error("Error fetching address from OneMap:", error);
      alert("Error connecting to OneMap API. Please enter address manually.");
    } finally {
      if (fetchBtn) {
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = originalBtnHtml;
      }
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
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${currentPage}&limit=${itemsPerPage}&includeArchived=true`);
        const result = await response.json();

        if (result.success) {
          allProperties = allProperties.concat(result.properties || []);

          // Check if there are more pages
          if (result.pagination) {
            hasMorePages = currentPage < result.pagination.totalPages;
            currentPage++;
          } else {
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }
      }

      if (allProperties.length > 0) {
        this.properties = allProperties;
        console.log('📦 Loaded properties:', this.properties.length);

        // Debug: Log rent values from API
        this.properties.forEach(p => {
          console.log(`🔍 DEBUG - Property ${p.propertyId} rent from API:`, p.rent, 'type:', typeof p.rent);
          if (p.accountant) console.log(`🧾 Property ${p.propertyId} accountant:`, p.accountant);
        });

        // Filter properties if current user is an investor
        await this.filterPropertiesByInvestor();

        // Debug: Log first property to check if images are present
        if (this.properties.length > 0) {
          console.log('🔍 First property sample:', {
            id: this.properties[0].propertyId,
            hasImage: !!this.properties[0].propertyImage,
            imageUrl: this.properties[0].propertyImage
          });
        }
        this.renderPropertiesTable();

        // Update sidebar badges
        if (window.updateSidebarBadges) {
          window.updateSidebarBadges();
        }
      } else {
        this.properties = [];
        this.showEmptyState();
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showEmptyState("Error loading properties. Please try again.");
    }
  }

  async filterPropertiesByInvestor() {
    try {
      console.log('🔄 Starting property filter check...');
      const investorPropertyIds = await getInvestorPropertyIds();
      console.log('📋 Investor property IDs result:', investorPropertyIds);

      // If null, user is not an investor - show all properties
      if (investorPropertyIds === null) {
        console.log('ℹ️ User is not an investor, showing all properties');
        return;
      }

      // Filter to show only investor's properties
      console.log('🔍 Filtering properties for investor:', investorPropertyIds);
      const originalCount = this.properties.length;
      console.log('📦 Properties before filter:', this.properties.map(p => p.propertyId));
      this.properties = this.properties.filter(property =>
        investorPropertyIds.includes(property.propertyId)
      );
      console.log(`📊 Filtered properties: ${originalCount} → ${this.properties.length}`);
      console.log('📦 Properties after filter:', this.properties.map(p => p.propertyId));
    } catch (error) {
      console.error('❌ Error filtering properties by investor:', error);
      // Don't throw - just log and continue with all properties
    }
  }

  renderPropertiesTable() {
    const container = document.getElementById("propertiesContainer");

    if (!container) return;

    if (this.properties.length === 0) {
      this.showEmptyState();
      return;
    }

    // Clear container and set up CSS Grid layout
    container.innerHTML = '<div id="propertiesCardGrid"></div>';
    const gridContainer = document.getElementById("propertiesCardGrid");

    // Set CSS Grid with auto-fill and max-width 280px
    gridContainer.style.display = "grid";
    gridContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(260px, 280px))";
    gridContainer.style.gap = "1rem";
    gridContainer.style.justifyContent = "center";
    gridContainer.style.maxWidth = "100%";

    const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    const activeProperties = this.properties.filter(p => !p.isArchived).sort(byNewest);
    const archivedProperties = this.properties.filter(p => p.isArchived).sort(byNewest);
    const sortedProperties = [...activeProperties, ...archivedProperties];

    let cardsHtml = "";
    let archivedDividerInserted = false;

    sortedProperties.forEach((property) => {
      const isArchived = !!property.isArchived;

      // Insert section divider before first archived card
      if (isArchived && !archivedDividerInserted) {
        archivedDividerInserted = true;
        cardsHtml += `
          <div style="grid-column: 1 / -1; margin-top: 1.5rem; margin-bottom: 0.25rem;">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-archive text-secondary"></i>
              <span class="text-secondary fw-semibold small">Archived Properties (${archivedProperties.length})</span>
              <hr class="flex-grow-1 my-0" style="border-color: #adb5bd;">
            </div>
          </div>`;
      }

      const isCondo = property.propertyType === 'condo';
      const cardOpacity = isArchived ? 'opacity: 0.6;' : '';
      const cardFilter = isArchived ? 'filter: grayscale(60%);' : '';
      const imgOverlay = isArchived ? `<div class="position-absolute top-0 start-0 w-100 h-100" style="background: rgba(0,0,0,0.35);"></div>` : '';
      const archivedBadge = isArchived ? `<span class="badge bg-secondary ms-1" style="font-size: 0.65rem; vertical-align: middle;"><i class="bi bi-archive me-1"></i>Archived</span>` : '';
      const cardBorder = isArchived ? 'border: 1.5px dashed #adb5bd !important;' : '';

      // Type-specific styling
      const typeGradient = isArchived
        ? 'linear-gradient(135deg, #868e96 0%, #495057 100%)'
        : isCondo
          ? 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      const typeIcon = isCondo ? 'bi-buildings' : 'bi-building';
      const typeAvatarBg = isArchived ? 'bg-secondary' : isCondo ? '' : 'bg-primary';
      const typeAvatarStyle = isArchived
        ? ''
        : isCondo
          ? 'background:linear-gradient(135deg,#f6d365,#fda085);'
          : '';
      const typeIdBadgeClass = isCondo ? '' : isArchived ? 'text-secondary' : 'text-primary';
      const typeIdBadgeStyle = isCondo
        ? 'background:rgba(0,0,0,0.45);color:white;'
        : isArchived
          ? ''
          : '';
      const typeBadge = isCondo
        ? `<span class="badge ms-1" style="background:linear-gradient(135deg,#f6d365,#fda085);color:#7c2d12;font-size:0.6rem;vertical-align:middle;" title="Condominium"><i class="bi bi-buildings me-1"></i>Condo</span>`
        : `<span class="badge bg-primary ms-1" style="font-size:0.6rem;vertical-align:middle;" title="HDB"><i class="bi bi-building me-1"></i>HDB</span>`;
      const cardExtraClass = isCondo ? 'pm-card-condo' : '';

      // Move-out overlay badge
      let moveOutOverlayHtml = '';
      if (property.moveOutDate) {
        const moveOut = new Date(property.moveOutDate);
        const diffDays = (moveOut - new Date()) / (1000 * 60 * 60 * 24);
        let badgeBg;
        if (diffDays < 0) badgeBg = 'rgba(220,53,69,0.92)';         // overdue — red
        else if (diffDays <= 30) badgeBg = 'rgba(220,53,69,0.92)';  // ≤1 month — red
        else if (diffDays <= 90) badgeBg = 'rgba(255,140,0,0.92)';  // ≤3 months — orange
        else badgeBg = 'rgba(25,135,84,0.85)';                      // > 3 months — green
        const moveOutFormatted = moveOut.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
        moveOutOverlayHtml = `
          <div class="position-absolute bottom-0 start-0 end-0 px-2 pb-1" style="background: linear-gradient(transparent, rgba(0,0,0,0.45)); pointer-events: none;">
            <span class="badge" style="background:${badgeBg}; font-size: 0.6rem;"><i class="bi bi-calendar-x me-1"></i>Out: ${moveOutFormatted}</span>
          </div>`;
      }

      const cardHtml = `
        <div style="width: 100%;">
          <div class="card property-management-card h-100 overflow-hidden ${cardExtraClass}"
               style="transition: all 0.2s ease; ${cardOpacity} ${cardFilter} ${cardBorder}">
            ${property.propertyImage ? `
            <div class="card-img-top position-relative" style="height: 130px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;">
              ${imgOverlay}
              <div class="position-absolute top-0 start-0 p-2">
                <span class="badge bg-primary" style="font-size: 0.75rem;">${this.escapeHtml(property.propertyId)}</span>
              </div>
              ${property.digitalLockEnabled ? `<div class="position-absolute top-0 end-0 p-2"><span class="badge" style="background:rgba(111,66,193,0.85);font-size:0.65rem;"><i class="bi bi-shield-lock-fill me-1"></i>Lock</span></div>` : ''}
              ${moveOutOverlayHtml}
            </div>
            ` : `
            <div class="card-img-top position-relative bg-gradient" style="height: 130px; background: ${typeGradient};">
              <div class="position-absolute top-0 start-0 p-2">
                <span class="badge bg-white ${typeIdBadgeClass}" style="font-size: 0.75rem;${typeIdBadgeStyle}">${this.escapeHtml(property.propertyId)}</span>
              </div>
              ${property.digitalLockEnabled ? `<div class="position-absolute top-0 end-0 p-2"><span class="badge" style="background:rgba(111,66,193,0.85);font-size:0.65rem;"><i class="bi bi-shield-lock-fill me-1"></i>Lock</span></div>` : ''}
              <div class="position-absolute top-50 start-50 translate-middle">
                <i class="bi ${isArchived ? 'bi-archive' : typeIcon} text-white" style="font-size: 3rem; opacity: 0.7;"></i>
              </div>
              ${moveOutOverlayHtml}
            </div>
            `}
            <div class="card-header bg-white border-0 pb-0">
              <div class="d-flex align-items-center">
                <div class="me-3">
                  <div class="rounded-circle ${typeAvatarBg} d-flex align-items-center justify-content-center text-white"
                       style="width: 40px; height: 40px; font-size: 14px; font-weight: bold; ${typeAvatarStyle}">
                    ${this.escapeHtml(property.propertyId.substring(0, 2).toUpperCase())}
                  </div>
                </div>
                <div class="flex-grow-1">
                  <h6 class="mb-0 fw-bold"><span class="prop-copy-val" data-copy="${this.escapeHtml(property.propertyId)}" title="Click to copy property ID" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.propertyId)}</span>${archivedBadge}${!isArchived ? typeBadge : ''}${property.digitalLockEnabled ? `<span class="badge ms-1" style="background:linear-gradient(135deg,#6f42c1,#9d4edd);font-size:0.6rem;vertical-align:middle;" title="Digital Lock Installed"><i class="bi bi-shield-lock-fill me-1"></i>Lock</span>` : ''}</h6>
                  <small class="text-muted">Property ID</small>
                </div>
              </div>
            </div>
            <div class="card-body pt-2">
              <p class="mb-2 small d-flex align-items-start gap-1">
                <i class="bi bi-geo-alt text-muted me-1 mt-1" style="flex-shrink:0;"></i>
                <span class="flex-grow-1 prop-copy-val" data-copy="${this.escapeHtml(property.address)}" title="Click to copy address" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.address)}</span>
              </p>
              <div class="row">
                <div class="col-6">
                  <p class="mb-1 small"><strong>Unit:</strong> <span class="prop-copy-val" data-copy="${this.escapeHtml(property.unit)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.unit)}</span></p>
                  <p class="mb-1 small"><strong>Max Pax:</strong> <span class="prop-copy-val" data-copy="${property.maxPax}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${property.maxPax}</span></p>
                </div>
                <div class="col-6">
                  <p class="mb-1 small"><strong>Rent:</strong></p>
                  <h6 class="text-success mb-0 prop-copy-val" data-copy="${property.rent || 0}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">$${(property.rent || 0).toLocaleString()}</h6>
                </div>
              </div>
              <div class="mt-2">
                <p class="mb-1 small"><strong>Payment Date:</strong> ${property.rentPaymentDate ? `<span class="prop-copy-val" data-copy="${property.rentPaymentDate}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">Day ${property.rentPaymentDate}</span>` : 'Not set'}</p>
                <p class="mb-1 small"><strong>Move-in:</strong> ${property.moveInDate ? `<span class="prop-copy-val" data-copy="${new Date(property.moveInDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${new Date(property.moveInDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : 'Not set'}</p>
                <p class="mb-1 small"><strong>Move-out:</strong> ${property.moveOutDate ? `<span class="prop-copy-val" data-copy="${new Date(property.moveOutDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${new Date(property.moveOutDate).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : 'Not set'}</p>
                <p class="mb-1 small"><strong>PUB Subsidy:</strong> $<span class="prop-copy-val" data-copy="${property.subsidizedPub || 0}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${(property.subsidizedPub || 0).toLocaleString()}</span></p>
                ${(property.spAccountUsername || property.spAccountPassword) ? `
                <div class="mb-1 small d-flex align-items-center gap-1 flex-wrap">
                  <img src="https://www.spgroup.com.sg/dam/spgroup/slices/SP_Group_Logo-01.svg" alt="SP" style="height:14px;width:auto;flex-shrink:0;">
                  ${property.spAccountUsername ? `<span class="font-monospace prop-copy-val" data-copy="${this.escapeHtml(property.spAccountUsername)}" title="Click to copy username" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.spAccountUsername)}</span>` : ''}
                  ${property.spAccountUsername && property.spAccountPassword ? `<span class="text-muted">/</span>` : ''}
                  ${property.spAccountPassword ? `<span class="font-monospace prop-copy-val" data-copy="${this.escapeHtml(property.spAccountPassword)}" title="Click to copy password" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.spAccountPassword)}</span>` : ''}
                </div>` : ''}
              </div>
              ${property.rooms && property.rooms.length > 0 ? `
              <div class="mt-2">
                <p class="mb-1 small"><strong>Rooms:</strong></p>
                <div class="d-flex flex-wrap gap-1">
                  ${property.rooms.map(room => `<span class="badge bg-secondary">${ROOM_TYPE_MAP[room] || room}</span>`).join('')}
                </div>
              </div>
              ` : ''}
              ${property.landlordBankName || property.landlordAccountName ? `
              <div class="mt-2 p-2 bg-light rounded">
                <p class="mb-1 small fw-bold"><i class="bi bi-bank me-1"></i>Landlord Bank</p>
                ${property.landlordBankName ? `<p class="mb-0 small prop-copy-val text-truncate" data-copy="${this.escapeHtml(property.landlordBankName)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.landlordBankName)}</p>` : ''}
                ${property.landlordAccountName ? `<p class="mb-0 small text-muted prop-copy-val text-truncate" data-copy="${this.escapeHtml(property.landlordAccountName)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.landlordAccountName)}</p>` : ''}
                ${property.landlordBankAccount ? `<p class="mb-0 small font-monospace prop-copy-val text-truncate" data-copy="${this.escapeHtml(property.landlordBankAccount)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.landlordBankAccount)}</p>` : ''}
              </div>
              ` : ''}
              ${(() => {
                if (!property.accountant) return '';
                const acc = this.allInvestors.find(i => i.investorId === property.accountant);
                if (!acc) { console.warn(`⚠️ Accountant investor not found: ${property.accountant}, allInvestors count: ${this.allInvestors.length}`); return ''; }
                const initials = acc.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                const avatarHtml = acc.avatar
                  ? `<img src="${acc.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="${this.escapeHtml(acc.name)}">`
                  : `<span style="color:#fff;font-weight:700;font-size:11px;">${initials}</span>`;
                const circleBg = acc.avatar ? '' : 'background:linear-gradient(135deg,#6f42c1,#9d4edd);';
                return `
                <div class="mt-2 p-2 bg-light rounded d-flex align-items-center gap-2">
                  <div style="width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;${circleBg}">${avatarHtml}</div>
                  <div>
                    <div style="font-size:0.7rem;color:#6f42c1;font-weight:600;line-height:1;"><i class="bi bi-calculator me-1"></i>Accountant</div>
                    <div class="small fw-semibold prop-copy-val" data-copy="${this.escapeHtml(acc.name)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)" style="line-height:1.3;">${this.escapeHtml(acc.name)}</div>
                  </div>
                </div>`;
              })()}
              ${(property.settlementSgd?.bankName || property.settlementVnd?.bankName) ? `
              <div class="mt-2 p-2 bg-light rounded">
                <p class="mb-1 small fw-bold"><i class="bi bi-cash-stack me-1"></i>Settlement</p>
                ${property.settlementSgd?.bankName ? `
                <div class="mb-2">
                  <div class="d-flex align-items-center gap-1 mb-1">
                    <span class="badge bg-success">SGD</span>
                    <span class="small fw-semibold prop-copy-val" data-copy="${this.escapeHtml(property.settlementSgd.bankName)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.settlementSgd.bankName)}</span>
                  </div>
                  ${property.settlementSgd.accountHolderName ? `<p class="mb-0 small prop-copy-val text-truncate" data-copy="${this.escapeHtml(property.settlementSgd.accountHolderName)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.settlementSgd.accountHolderName)}</p>` : ''}
                  ${property.settlementSgd.accountNumber ? `<p class="mb-0 small font-monospace prop-copy-val text-truncate" data-copy="${this.escapeHtml(property.settlementSgd.accountNumber)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.settlementSgd.accountNumber)}</p>` : ''}
                </div>
                ` : ''}
                ${property.settlementVnd?.bankName ? `
                <div>
                  <div class="d-flex align-items-center gap-1 mb-1">
                    <span class="badge bg-warning text-dark">VND</span>
                    <span class="small fw-semibold prop-copy-val" data-copy="${this.escapeHtml(property.settlementVnd.bankName)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.settlementVnd.bankName)}</span>
                  </div>
                  ${property.settlementVnd.accountHolderName ? `<p class="mb-0 small prop-copy-val text-truncate" data-copy="${this.escapeHtml(property.settlementVnd.accountHolderName)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.settlementVnd.accountHolderName)}</p>` : ''}
                  ${property.settlementVnd.accountNumber ? `<p class="mb-0 small font-monospace prop-copy-val text-truncate" data-copy="${this.escapeHtml(property.settlementVnd.accountNumber)}" title="Click to copy" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.settlementVnd.accountNumber)}</p>` : ''}
                </div>
                ` : ''}
              </div>
              ` : ''}
              ${(property.tenantFacebookGroup || property.adminFacebookGroup) ? `
              <div class="mt-2 d-flex flex-wrap gap-1">
                ${property.tenantFacebookGroup ? `<a href="${this.escapeHtml(property.tenantFacebookGroup)}" onclick="event.preventDefault(); openTenantFbGroup(this);" data-fb-url="${this.escapeHtml(property.tenantFacebookGroup)}" class="badge bg-primary text-decoration-none" title="Tenant Facebook Group"><i class="bi bi-facebook me-1"></i>Tenant Group</a>` : ''}
                ${property.adminFacebookGroup ? `<a href="${this.escapeHtml(property.adminFacebookGroup)}" target="_blank" rel="noopener noreferrer" class="badge bg-dark text-decoration-none" title="Admin Facebook Group"><i class="bi bi-facebook me-1"></i>Admin Group</a>` : ''}
              </div>
              ` : ''}
            </div>
            <div class="card-footer bg-white border-0 pt-0">
              <div class="d-flex gap-2">
                ${!isArchived ? `
                <button class="btn btn-outline-primary btn-sm flex-fill" onclick="propertyManager.editProperty('${property.propertyId}')">
                  <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-outline-warning btn-sm flex-fill" onclick="propertyManager.archiveProperty('${property.propertyId}')">
                  <i class="bi bi-archive"></i> Archive
                </button>
                ` : `
                <button class="btn btn-outline-secondary btn-sm flex-fill" onclick="propertyManager.unarchiveProperty('${property.propertyId}')">
                  <i class="bi bi-arrow-counterclockwise"></i> Unarchive
                </button>
                `}
              </div>
            </div>
          </div>
        </div>
      `;
      cardsHtml += cardHtml;
    });

    gridContainer.innerHTML = cardsHtml;

    // Add card styles
    this.addPropertyCardStyles();
  }

  addPropertyCardStyles() {
    // Add hover styles if not already added
    if (!document.getElementById("property-management-card-styles")) {
      const style = document.createElement("style");
      style.id = "property-management-card-styles";
      style.textContent = `
        .property-management-card {
          cursor: pointer;
          border: 1px solid #e3e6f0;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .property-management-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
          border-color: #007bff;
        }
        .property-management-card .card-img-top {
          border-radius: 12px 12px 0 0;
        }
        .property-management-card .badge {
          font-size: 0.8rem;
          padding: 0.5rem 0.75rem;
        }
        .property-management-card .card-footer {
          background: linear-gradient(90deg, #f8f9fa 0%, #ffffff 100%);
        }
        .property-management-card .card-body {
          padding: 0.75rem 0.5rem;
        }
        .property-management-card .card-header {
          padding: 0.75rem 0.5rem;
        }
        .property-management-card .card-footer {
          padding: 0.75rem 0.5rem;
        }
        /* Condo card — warm gold accent */
        .pm-card-condo {
          border-color: #fde68a !important;
        }
        .pm-card-condo:hover {
          border-color: #f59e0b !important;
          box-shadow: 0 8px 25px rgba(245,158,11,0.22) !important;
        }
        /* Form toggle — condo checked state */
        #propertyTypeCondo:checked + label {
          background: linear-gradient(135deg,#f6d365,#fda085) !important;
          color: #7c2d12 !important;
          border-color: #fda085 !important;
        }
        /* Click-to-copy value fields */
        .prop-copy-val {
          border-radius: 4px;
          padding: 1px 3px;
          transition: background 0.15s, color 0.15s;
          cursor: pointer;
        }
        .prop-copy-val:hover {
          background: #e9f0ff;
          color: #0d6efd;
        }
      `;
      document.head.appendChild(style);
    }
  }

  showEmptyState(message = "No properties found") {
    const container = document.getElementById("propertiesContainer");
    if (!container) return;

    container.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi bi-building fs-1"></i>
        <h5 class="mt-3">${message}</h5>
        <p class="text-muted">Click "Add Property" to get started</p>
      </div>
    `;
  }

  showMobileEmptyState(message = "No properties found") {
    const mobileList = document.getElementById("mobilePropertyList");
    if (!mobileList) return;

    mobileList.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="bi bi-building fs-1"></i>
                <p class="mt-2">${message}</p>
            </div>
        `;
  }

  filterProperties(searchTerm) {
    if (!searchTerm.trim()) {
      this.renderPropertiesTable();
      return;
    }

    const filteredProperties = this.properties.filter(
      (property) =>
        property.propertyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.unit.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredProperties.length === 0) {
      this.showEmptyState(`No properties match "${searchTerm}"`);
      return;
    }

    // Temporarily store current properties and render filtered results
    const originalProperties = this.properties;
    this.properties = filteredProperties;
    this.renderPropertiesTable();
    this.properties = originalProperties;
  }

  showAddPropertyModal() {
    this.showPropertyModal();
  }

  showPropertyModal(property = null) {
    // Store reference to property being edited
    this.editingProperty = property;

    // Update modal title and button text
    const isEdit = !!property;
    document.getElementById("propertyModalTitle").textContent = isEdit
      ? "Edit Property"
      : "Add New Property";
    const submitBtn = document.getElementById("propertySubmitBtn");
    submitBtn.innerHTML = isEdit
      ? '<i class="bi bi-pencil-square me-1"></i><span id="propertySubmitText">Update Property</span>'
      : '<i class="bi bi-plus-circle me-1"></i><span id="propertySubmitText">Add Property</span>';

    // Reset and populate form
    const form = document.getElementById("propertyForm");
    if (form) {
      form.reset();

      // Store the property being edited (if any)
      form.setAttribute("data-property-id", property?.propertyId || "");
      form.setAttribute("data-mode", isEdit ? "edit" : "add");

      const propertyIdInput = document.getElementById("propertyId");
      const propertyIdHelp = document.getElementById("propertyIdHelp");

      if (!isEdit) {
        const nextId = this.getNextPropertyId();
        if (propertyIdInput) {
          propertyIdInput.value = nextId;
          propertyIdInput.readOnly = true;
          propertyIdInput.classList.add("bg-light");
        }
        if (propertyIdHelp) {
          propertyIdHelp.textContent = "Property ID is automatically generated.";
        }
      }

      if (isEdit && property) {
        if (propertyIdInput) {
          propertyIdInput.value = property.propertyId || "";
          propertyIdInput.readOnly = true;
          propertyIdInput.classList.add("bg-light");
        }
        if (propertyIdHelp) {
          propertyIdHelp.textContent = "Property ID cannot be changed after creation.";
        }

        // Populate form with existing data
        document.getElementById("propertyId").value = property.propertyId || "";
        document.getElementById("postcode").value = property.postcode || "";
        document.getElementById("address").value = property.address || "";
        document.getElementById("unit").value = property.unit || "";
        document.getElementById("maxPax").value = property.maxPax || 1;

        // Format date for input
        if (property.moveInDate) {
          const date = new Date(property.moveInDate);
          document.getElementById("moveInDate").value = date
            .toISOString()
            .split("T")[0];
        } else {
          document.getElementById("moveInDate").value = new Date()
            .toISOString()
            .split("T")[0];
        }

        // Format move-out date for input
        if (property.moveOutDate) {
          const moveOutDate = new Date(property.moveOutDate);
          document.getElementById("moveOutDate").value = moveOutDate
            .toISOString()
            .split("T")[0];
        } else {
          document.getElementById("moveOutDate").value = "";
        }

        document.getElementById("rentPaymentDate").value =
          property.rentPaymentDate || 1;
        document.getElementById("rent").value = property.rent || 0;
        console.log('🔍 DEBUG - Editing property, rent value set to form:', property.rent);
        document.getElementById("airconUnits").value = property.airconUnits || 0;
        document.getElementById("subsidizedPub").value = property.subsidizedPub ?? 400;
        document.getElementById("agentName").value = property.agentName || "";
        document.getElementById("agentPhone").value = property.agentPhone || "";
        document.getElementById("landlordBankAccount").value =
          property.landlordBankAccount || "";
        document.getElementById("landlordBankName").value =
          property.landlordBankName || "";
        document.getElementById("landlordAccountName").value =
          property.landlordAccountName || "";

        // Settlement accounts (custom dropdown with bank logos)
        const sgdBankValue = property.settlementSgd?.bankName || "";
        document.getElementById("settlementSgdBank").value = sgdBankValue;
        const sgdBankText = document.getElementById("settlementSgdBankText");
        if (sgdBankText) {
          if (sgdBankValue) {
            sgdBankText.classList.remove('text-muted');
            const badgeHtml = window.getBankBadgeHtml ? window.getBankBadgeHtml(sgdBankValue) : '';
            sgdBankText.innerHTML = badgeHtml + sgdBankValue;
          } else {
            sgdBankText.classList.add('text-muted');
            sgdBankText.textContent = 'Select bank...';
          }
        }
        document.getElementById("settlementSgdAccountNumber").value =
          property.settlementSgd?.accountNumber || "";
        document.getElementById("settlementSgdAccountHolder").value =
          property.settlementSgd?.accountHolderName || "";

        const vndBankValue = property.settlementVnd?.bankName || "";
        document.getElementById("settlementVndBank").value = vndBankValue;
        const vndBankText = document.getElementById("settlementVndBankText");
        if (vndBankText) {
          if (vndBankValue) {
            vndBankText.classList.remove('text-muted');
            const badgeHtml = window.getBankBadgeHtml ? window.getBankBadgeHtml(vndBankValue) : '';
            vndBankText.innerHTML = badgeHtml + vndBankValue;
          } else {
            vndBankText.classList.add('text-muted');
            vndBankText.textContent = 'Select bank...';
          }
        }
        document.getElementById("settlementVndAccountNumber").value =
          property.settlementVnd?.accountNumber || "";
        document.getElementById("settlementVndAccountHolder").value =
          property.settlementVnd?.accountHolderName || "";

        document.getElementById("tenantFacebookGroup").value =
          property.tenantFacebookGroup || "";
        document.getElementById("adminFacebookGroup").value =
          property.adminFacebookGroup || "";

        document.getElementById("telegramBotToken").value =
          property.telegramBotToken || "";
        document.getElementById("telegramChannelId").value =
          property.telegramChannelId || "";

        // Set Telegram integration checkbox
        const telegramIntegrationCheckbox = document.getElementById("telegramIntegrationEnabled");
        if (telegramIntegrationCheckbox) {
          telegramIntegrationCheckbox.checked = property.telegramIntegrationEnabled === true;
        }

        document.getElementById("wifiAccountNumber").value =
          property.wifiAccountNumber || "";
        document.getElementById("wifiAccountHolderName").value =
          property.wifiAccountHolderName || "";

        // Handle AC Service fields
        if (property.acServiceCompanyId) {
          const dropdown = document.getElementById("acServiceCompanyId");
          if (dropdown) {
            dropdown.value = property.acServiceCompanyId;
          }
        }

        if (property.acServiceDate) {
          const date = new Date(property.acServiceDate);
          document.getElementById("acServiceDate").value = date
            .toISOString()
            .split("T")[0];
          // Show the calendar button
          const calendarBtn = document.getElementById("viewServiceCalendarBtn");
          if (calendarBtn) {
            calendarBtn.style.display = "block";
          }
        } else {
          document.getElementById("acServiceDate").value = "";
          const calendarBtn = document.getElementById("viewServiceCalendarBtn");
          if (calendarBtn) {
            calendarBtn.style.display = "none";
          }
        }

        // Handle Management Fee fields
        this.populateManagementFeePayeeDropdown(property.propertyId);

        // Handle Accountant field
        this.populateAccountantDropdown();
        if (property.accountant) {
          document.getElementById("accountant").value = property.accountant;
        } else {
          document.getElementById("accountant").value = "";
        }
        this.updateAccountantAvatarPreview(property.accountant || "");

        if (property.managementFeeStart) {
          const feeDate = new Date(property.managementFeeStart);
          document.getElementById("managementFeeStart").value = feeDate
            .toISOString()
            .split("T")[0];
        } else {
          document.getElementById("managementFeeStart").value = "";
        }

        if (property.managementFeePayee) {
          document.getElementById("managementFeePayee").value = property.managementFeePayee;
        } else {
          document.getElementById("managementFeePayee").value = "";
        }

        // Handle WiFi images
        if (property.wifiImages && property.wifiImages.length > 0) {
          this.currentWifiImages = [...property.wifiImages];
          this.renderWifiImagesGallery();
        } else {
          this.currentWifiImages = [];
        }

        // Handle property image - store both current and original for fallback
        const imageUrl = property.propertyImage || '';
        this.propertyImage = imageUrl;
        this.originalPropertyImage = imageUrl; // Store original for fallback during save
        console.log('✅ Loaded property image:', this.propertyImage);
        this.updatePropertyImagePreview();

        // Handle property rooms selection
        if (property.rooms && Array.isArray(property.rooms)) {
          // Clear all checkboxes first
          const checkboxes = document.querySelectorAll('.property-room-checkbox');
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
          });

          // Check the rooms that are in the property
          property.rooms.forEach(room => {
            const checkbox = document.getElementById(`room_${room}`);
            if (checkbox) {
              checkbox.checked = true;
            }
          });

          // Update the selection display
          this.updatePropertyRoomsSelection();
        }

        // Handle digital lock fields
        const digitalLockYes = document.getElementById("digitalLockYes");
        const digitalLockNo = document.getElementById("digitalLockNo");
        if (digitalLockYes && digitalLockNo) {
          const enabled = property.digitalLockEnabled === true;
          digitalLockYes.checked = enabled;
          digitalLockNo.checked = !enabled;
          this.onDigitalLockToggle(enabled);
        }
        const digitalLockPinInput = document.getElementById("digitalLockPin");
        if (digitalLockPinInput) {
          digitalLockPinInput.value = property.digitalLockPin || "";
        }

        // Property type (HDB / Condo)
        const propTypeValue = property.propertyType || 'hdb';
        const propTypeRadio = document.getElementById(propTypeValue === 'condo' ? 'propertyTypeCondo' : 'propertyTypeHdb');
        if (propTypeRadio) propTypeRadio.checked = true;

        // SP utility account
        const spUsernameInput = document.getElementById("spAccountUsername");
        if (spUsernameInput) spUsernameInput.value = property.spAccountUsername || "";
        const spPasswordInput = document.getElementById("spAccountPassword");
        if (spPasswordInput) spPasswordInput.value = property.spAccountPassword || "";

        // Make propertyId readonly in edit mode
        document.getElementById("propertyId").readOnly = true;
        document.getElementById("propertyId").classList.add("bg-light");
      } else {
        // Set default values for add mode
        const moveInDateInput = document.getElementById("moveInDate");
        if (moveInDateInput) {
          moveInDateInput.value = new Date().toISOString().split("T")[0];
        }

        // Clear move-out date for add mode
        const moveOutDateInput = document.getElementById("moveOutDate");
        if (moveOutDateInput) {
          moveOutDateInput.value = "";
        }

        document.getElementById("maxPax").value = "1";
        document.getElementById("rentPaymentDate").value = "1";
        document.getElementById("rent").value = "0";

        // Clear WiFi images for add mode
        this.currentWifiImages = [];
        this.renderWifiImagesGallery();

        // Clear property image for add mode
        this.propertyImage = '';
        this.originalPropertyImage = '';
        this.updatePropertyImagePreview();

        // Clear AC service contact numbers for add mode
        this.currentAcContactNumbers = [];
        this.renderAcContactNumbersList();

        // Reset Management Fee fields for add mode
        this.populateManagementFeePayeeDropdown(); // Show all investors for new property
        document.getElementById("managementFeeStart").value = "";
        document.getElementById("managementFeePayee").value = "";

        // Reset Accountant field for add mode
        this.populateAccountantDropdown();
        document.getElementById("accountant").value = "";
        this.updateAccountantAvatarPreview("");

        // Reset settlement bank dropdowns for add mode
        const sgdBankText = document.getElementById("settlementSgdBankText");
        if (sgdBankText) {
          sgdBankText.classList.add('text-muted');
          sgdBankText.textContent = 'Select bank...';
        }
        const vndBankText = document.getElementById("settlementVndBankText");
        if (vndBankText) {
          vndBankText.classList.add('text-muted');
          vndBankText.textContent = 'Select bank...';
        }

        // Reset digital lock for add mode
        const digitalLockNoReset = document.getElementById("digitalLockNo");
        if (digitalLockNoReset) digitalLockNoReset.checked = true;
        const digitalLockYesReset = document.getElementById("digitalLockYes");
        if (digitalLockYesReset) digitalLockYesReset.checked = false;
        this.onDigitalLockToggle(false);
        const digitalLockPinInputReset = document.getElementById("digitalLockPin");
        if (digitalLockPinInputReset) digitalLockPinInputReset.value = "";

        // Reset property type to HDB for add mode
        const hdbRadioReset = document.getElementById("propertyTypeHdb");
        if (hdbRadioReset) hdbRadioReset.checked = true;

        // Reset SP account for add mode
        const spUsernameReset = document.getElementById("spAccountUsername");
        if (spUsernameReset) spUsernameReset.value = "";
        const spPasswordReset = document.getElementById("spAccountPassword");
        if (spPasswordReset) spPasswordReset.value = "";

        // Make propertyId editable in add mode
        document.getElementById("propertyId").readOnly = false;
        document.getElementById("propertyId").classList.remove("bg-light");

        // Reset postcode field for add mode only (form.reset() may not clear it if it has a default)
        const postcodeField = document.getElementById("postcode");
        if (postcodeField) {
          postcodeField.value = "";
        }
      }
    }

    // Show modal
    const modalEl = document.getElementById("propertyModal");
    const modal = new bootstrap.Modal(modalEl);

    // Move focus out before Bootstrap sets aria-hidden="true" on close
    modalEl.addEventListener(
      "hide.bs.modal",
      () => {
        if (document.activeElement && modalEl.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      },
      { once: true }
    );

    modalEl.addEventListener(
      "hidden.bs.modal",
      () => {
        this.cleanupModal();
      },
      { once: true }
    );

    modal.show();

    // Set up clipboard paste listeners after modal is shown
    modalEl.addEventListener('shown.bs.modal', () => {
      this.setupPropertyImageClipboardListener();
    }, { once: true });
  }

  cleanupModal() {
    // Remove any remaining backdrop
    const backdrops = document.querySelectorAll(".modal-backdrop");
    backdrops.forEach((backdrop) => backdrop.remove());

    // Remove modal classes from body
    document.body.classList.remove("modal-open");
    document.body.style.paddingRight = "";
    document.body.style.overflow = "";

    // Clear editing property reference and original image
    // Note: These are cleared AFTER the form has been submitted, so they don't affect the save
    this.editingProperty = null;
    this.originalPropertyImage = '';
  }

  getPropertyDataFromUser(existingProperty = null) {
    const propertyId = prompt(
      "Property ID:",
      existingProperty?.propertyId || ""
    );
    if (!propertyId) return null;

    const address = prompt("Address:", existingProperty?.address || "");
    if (!address) return null;

    const unit = prompt("Unit:", existingProperty?.unit || "");
    if (!unit) return null;

    const maxPax = parseInt(
      prompt("Max Occupants:", existingProperty?.maxPax || "1")
    );
    if (isNaN(maxPax) || maxPax < 1) return null;

    const rent = parseFloat(
      prompt("Monthly Rent:", existingProperty?.rent || "0")
    );
    if (isNaN(rent) || rent < 0) return null;

    return {
      propertyId,
      address,
      unit,
      maxPax,
      rent,
      agentName: existingProperty?.agentName || "",
      agentPhone: existingProperty?.agentPhone || "",
      landlordBankAccount: existingProperty?.landlordBankAccount || "",
      landlordBankName: existingProperty?.landlordBankName || "",
      landlordAccountName: existingProperty?.landlordAccountName || "",
    };
  }

  async handlePropertySubmit(event) {
    try {
      const form = event.target;
      const formData = new FormData(form);
      const isEdit = form.getAttribute("data-mode") === "edit";
      const originalPropertyId = form.getAttribute("data-property-id");

      // Get AC service date and handle empty strings
      const acServiceDateValue = formData.get("acServiceDate")?.trim();

      // Get selected rooms from multi-select
      const roomsSelect = document.getElementById("propertyRooms");
      const selectedRooms = roomsSelect ? Array.from(roomsSelect.selectedOptions).map(option => option.value) : [];

      // When editing, spread existing property first to preserve unchanged fields (like propertyImage)
      const propertyData = {
        ...(isEdit && this.editingProperty ? this.editingProperty : {}),
        propertyId: (formData.get("propertyId") || this.getNextPropertyId().toString()).trim().toUpperCase(),
        postcode: formData.get("postcode")?.trim() || "",
        address: formData.get("address").trim(),
        unit: formData.get("unit").trim(),
        maxPax: parseInt(formData.get("maxPax")) || 1,
        moveInDate:
          formData.get("moveInDate") || new Date().toISOString().split("T")[0],
        moveOutDate: formData.get("moveOutDate")?.trim() || null,
        rentPaymentDate: parseInt(formData.get("rentPaymentDate")) || 1,
        rent: parseFloat(formData.get("rent")) || 0,
        airconUnits: parseInt(formData.get("airconUnits")) || 0,
        subsidizedPub: parseFloat(formData.get("subsidizedPub")) || 400,
        rooms: selectedRooms,
        agentName: formData.get("agentName")?.trim() || "",
        agentPhone: formData.get("agentPhone")?.trim() || "",
        landlordBankAccount: formData.get("landlordBankAccount")?.trim() || "",
        landlordBankName: formData.get("landlordBankName")?.trim() || "",
        landlordAccountName: formData.get("landlordAccountName")?.trim() || "",
        settlementSgd: {
          bankName: formData.get("settlementSgdBank")?.trim() || "",
          accountNumber: formData.get("settlementSgdAccountNumber")?.trim() || "",
          accountHolderName: formData.get("settlementSgdAccountHolder")?.trim() || "",
        },
        settlementVnd: {
          bankName: formData.get("settlementVndBank")?.trim() || "",
          accountNumber: formData.get("settlementVndAccountNumber")?.trim() || "",
          accountHolderName: formData.get("settlementVndAccountHolder")?.trim() || "",
        },
        tenantFacebookGroup: formData.get("tenantFacebookGroup")?.trim() || "",
        adminFacebookGroup: formData.get("adminFacebookGroup")?.trim() || "",
        telegramIntegrationEnabled: formData.get("telegramIntegrationEnabled") === "true",
        telegramBotToken: formData.get("telegramBotToken")?.trim() || "",
        telegramChannelId: formData.get("telegramChannelId")?.trim() || "",
        wifiAccountNumber: formData.get("wifiAccountNumber")?.trim() || "",
        wifiAccountHolderName: formData.get("wifiAccountHolderName")?.trim() || "",
        wifiImages: this.currentWifiImages || [],
        // Use hidden field as primary source (more reliable), fallback to this.propertyImage and existing value
        propertyImage: formData.get("propertyImage")?.trim() || this.propertyImage || this.editingProperty?.propertyImage || "",
        acServiceCompanyId: formData.get("acServiceCompanyId")?.trim() || "",
        acServiceDate: acServiceDateValue || null,
        managementFeeStart: formData.get("managementFeeStart")?.trim() || null,
        managementFeePayee: formData.get("managementFeePayee")?.trim() || "",
        accountant: formData.get("accountant")?.trim() || "",
        digitalLockEnabled: formData.get("digitalLockEnabled") === "true",
        digitalLockPin: formData.get("digitalLockPin")?.trim() || "",
        spAccountUsername: formData.get("spAccountUsername")?.trim() || "",
        spAccountPassword: formData.get("spAccountPassword")?.trim() || "",
        propertyType: formData.get("propertyType") || 'hdb',
      };

      // Debug: Log property data being saved
      console.log('🧾 DEBUG - accountant from form:', formData.get("accountant"));
      console.log('🔍 DEBUG - Postcode from form:', formData.get("postcode"));
      console.log('🔍 DEBUG - Hidden field propertyImage:', formData.get("propertyImage"));
      console.log('🔍 DEBUG - this.propertyImage:', this.propertyImage);
      console.log('🔍 DEBUG - editingProperty.propertyImage:', this.editingProperty?.propertyImage);
      console.log('🔍 DEBUG - Final propertyImage being saved:', propertyData.propertyImage);
      console.log('🔍 DEBUG - PropertyData being saved:', propertyData);

      // Validate required fields
      if (
        !propertyData.propertyId ||
        !propertyData.address ||
        !propertyData.unit
      ) {
        alert(
          "Please fill in all required fields (Property ID, Address, Unit)"
        );
        return;
      }

      // Validate numeric fields
      if (propertyData.maxPax < 1 || propertyData.maxPax > 20) {
        alert("Maximum occupancy must be between 1 and 20");
        return;
      }

      if (
        propertyData.rentPaymentDate < 1 ||
        propertyData.rentPaymentDate > 31
      ) {
        alert("Rent payment date must be between 1 and 31");
        return;
      }

      if (propertyData.rent < 0) {
        alert("Rent cannot be negative");
        return;
      }

      // Show loading state
      const submitBtn = event.target.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = isEdit
        ? '<i class="bi bi-hourglass-split me-1"></i>Updating Property...'
        : '<i class="bi bi-hourglass-split me-1"></i>Adding Property...';

      // Add or update the property
      if (isEdit) {
        await this.updateProperty(originalPropertyId, propertyData);
      } else {
        await this.addProperty(propertyData);
      }

      // Close modal on success
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("propertyModal")
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
      console.error("Error in handlePropertySubmit:", error);
      const isEdit = event.target.getAttribute("data-mode") === "edit";
      alert(
        `An error occurred while ${isEdit ? "updating" : "adding"
        } the property. Please try again.`
      );

      // Reset button state
      const submitBtn = event.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        const isEdit = event.target.getAttribute("data-mode") === "edit";
        submitBtn.innerHTML = isEdit
          ? '<i class="bi bi-pencil-square me-1"></i>Update Property'
          : '<i class="bi bi-plus-circle me-1"></i>Add Property';
      }
    }
  }

  async addProperty(propertyData) {
    try {
      const response = await API.post(
        API_CONFIG.ENDPOINTS.PROPERTIES,
        propertyData
      );
      const result = await response.json();

      if (result.success) {
        await this.loadProperties(); // Reload the list
      } else {
        alert("Failed to add property: " + result.error);
      }
    } catch (error) {
      console.error("Error adding property:", error);
      alert("Error adding property. Please try again.");
    }
  }

  async editProperty(propertyId) {
    // Find the property to edit
    const property = this.properties.find((p) => p.propertyId === propertyId);
    if (!property) {
      alert("Property not found");
      return;
    }

    // Show the modal with property data
    this.showPropertyModal(property);
  }

  async updateProperty(propertyId, propertyData) {
    try {
      const response = await API.put(
        API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(propertyId),
        propertyData
      );
      const result = await response.json();

      if (result.success) {
        await this.loadProperties(); // Reload the list
      } else {
        alert("Failed to update property: " + result.error);
      }
    } catch (error) {
      console.error("Error updating property:", error);
      alert("Error updating property: " + error.message);
      throw error; // Re-throw to handle in form submission
    }
  }

  async archiveProperty(propertyId) {
    if (!confirm(`Archive property ${propertyId}?\n\nThe property will be hidden from all other modules but its tenants and data will be preserved. You can unarchive it at any time.`)) {
      return;
    }

    try {
      const response = await API.delete(
        API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(propertyId)
      );

      const result = await response.json();

      if (result.success) {
        await this.loadProperties();
      } else {
        alert("Failed to archive property: " + result.error);
      }
    } catch (error) {
      console.error("Error archiving property:", error);
      alert("Error archiving property. Please try again.");
    }
  }

  async unarchiveProperty(propertyId) {
    if (!confirm(`Unarchive property ${propertyId}?\n\nIt will become visible again in all modules.`)) {
      return;
    }

    try {
      const response = await API.patch(
        `${API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(propertyId)}/unarchive`
      );

      const result = await response.json();

      if (result.success) {
        await this.loadProperties();
      } else {
        alert("Failed to unarchive property: " + result.error);
      }
    } catch (error) {
      console.error("Error unarchiving property:", error);
      alert("Error unarchiving property. Please try again.");
    }
  }

  // WiFi Images Upload Methods
  openWifiImagesUpload() {
    const fileInput = document.getElementById('wifiImagesUploadInput');
    fileInput.click();

    // Add event listener for file selection
    fileInput.onchange = async (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        await this.uploadWifiImages(files);
      }
    };
  }

  async uploadWifiImages(files) {
    const uploadButton = document.querySelector("button[onclick=\"propertyManager.openWifiImagesUpload()\"]");
    const originalText = uploadButton.innerHTML;

    try {
      uploadButton.disabled = true;
      uploadButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading...';

      for (const file of files) {
        const result = await this.uploadSingleImage(file);

        if (result.success) {
          console.log('🔗 WiFi image uploaded successfully:', result.url);

          // Ensure URL is properly formatted
          let imageUrl = result.url;
          if (imageUrl && !imageUrl.startsWith('http')) {
            // If it's a relative URL starting with /, prepend the API base URL
            if (imageUrl.startsWith('/')) {
              imageUrl = API_CONFIG.BASE_URL + imageUrl;
            } else {
              // Otherwise assume it needs https:// prefix
              imageUrl = 'https://' + imageUrl;
            }
          }

          // Add to current WiFi images array
          if (!this.currentWifiImages.includes(imageUrl)) {
            this.currentWifiImages.push(imageUrl);
          }
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      }

      // Update the gallery display
      this.renderWifiImagesGallery();

    } catch (error) {
      console.error('Error uploading WiFi images:', error);
      alert(`Error uploading images: ${error.message}`);
    } finally {
      uploadButton.disabled = false;
      uploadButton.innerHTML = originalText;
    }
  }

  addWifiImageUrl() {
    const url = prompt('Enter WiFi image URL:');
    if (url && url.trim()) {
      const trimmedUrl = url.trim();
      if (!this.currentWifiImages.includes(trimmedUrl)) {
        this.currentWifiImages.push(trimmedUrl);
        this.renderWifiImagesGallery();
      } else {
        alert('This URL is already added.');
      }
    }
  }

  renderWifiImagesGallery() {
    const gallery = document.getElementById('wifiImagesGallery');
    if (!gallery) return;

    if (!this.currentWifiImages || this.currentWifiImages.length === 0) {
      gallery.innerHTML = '<p class="text-muted">No WiFi images added yet.</p>';
      return;
    }

    let galleryHtml = '<div class="row g-2">';
    this.currentWifiImages.forEach((imageUrl, index) => {
      galleryHtml += `
        <div class="col-md-3 col-sm-4 col-6">
          <div class="position-relative">
            <img src="${imageUrl}" class="img-thumbnail w-100" style="height: 120px; object-fit: cover;" 
                 alt="WiFi Image ${index + 1}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiNmOGY5ZmEiIHN0cm9rZT0iI2RlZTJlNiIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAiIHk9IjU1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmM3NTdkIiBmb250LXNpemU9IjEyIj5JbWFnZTwvdGV4dD48L3N2Zz4='">
            <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 rounded-circle p-1" 
                    onclick="propertyManager.removeWifiImage(${index})" style="width: 24px; height: 24px; font-size: 0.7rem;">
              <i class="bi bi-x"></i>
            </button>
          </div>
        </div>
      `;
    });
    galleryHtml += '</div>';

    gallery.innerHTML = galleryHtml;
  }

  // Property Image Upload Methods
  openImageUpload() {
    const fileInput = document.getElementById('propertyImageUploadInput');
    fileInput.click();

    // Add event listener for file selection
    fileInput.onchange = async (event) => {
      const files = event.target.files;
      if (files.length > 0) {
        await this.uploadPropertyImage(files[0]); // Only take the first file
      }
    };
  }

  async uploadPropertyImage(file) {
    const uploadButton = document.querySelector("button[onclick=\"propertyManager.openImageUpload()\"]");
    const originalText = uploadButton.innerHTML;

    try {
      uploadButton.disabled = true;
      uploadButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading...';

      const result = await this.uploadSingleImage(file);

      if (result.success) {
        console.log('🔗 Property image uploaded successfully:', result.url);

        // Ensure URL is properly formatted
        let imageUrl = result.url;
        if (imageUrl && !imageUrl.startsWith('http')) {
          // If it's a relative URL starting with /, prepend the API base URL
          if (imageUrl.startsWith('/')) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            // Otherwise assume it needs https:// prefix
            imageUrl = 'https://' + imageUrl;
          }
        }

        // Set the property image
        this.propertyImage = imageUrl;
        this.updatePropertyImagePreview();

      } else {
        throw new Error(result.error || 'Upload failed');
      }

    } catch (error) {
      console.error('Error uploading property image:', error);
      alert(`Error uploading image: ${error.message}`);
    } finally {
      uploadButton.disabled = false;
      uploadButton.innerHTML = originalText;
    }
  }

  addImageFromUrl() {
    const urlInput = document.getElementById('propertyImageUrl');
    const url = urlInput.value.trim();
    console.log('🖼️ addImageFromUrl called, url:', url);

    if (!url) {
      console.log('🖼️ addImageFromUrl - URL is empty, not setting');
      alert('Please enter a valid image URL');
      return;
    }

    // Set the property image
    this.propertyImage = url;
    console.log('🖼️ addImageFromUrl - this.propertyImage set to:', this.propertyImage);
    this.updatePropertyImagePreview();
    urlInput.value = ''; // Clear input after adding
  }

  updatePropertyImagePreview() {
    const preview = document.getElementById('propertyImagePreview');
    if (!preview) return;

    // Always sync the hidden field with this.propertyImage
    const hiddenField = document.getElementById('propertyImageHidden');
    if (hiddenField) {
      hiddenField.value = this.propertyImage || '';
    }

    if (this.propertyImage) {
      preview.innerHTML = `
        <div class="position-relative" style="width: 100%; height: 100%;">
          <img src="${this.propertyImage}" class="w-100 h-100 rounded" style="object-fit: cover;"
               alt="Property Image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiNmOGY5ZmEiIHN0cm9rZT0iI2RlZTJlNiIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAiIHk9IjU1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmM3NTdkIiBmb250LXNpemU9IjEyIj5JbWFnZTwvdGV4dD48L3N2Zz4='">
          <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 m-1 rounded-circle p-1"
                  onclick="propertyManager.removePropertyImage()" style="width: 24px; height: 24px; font-size: 0.7rem;">
            <i class="bi bi-x"></i>
          </button>
        </div>
      `;
    } else {
      preview.innerHTML = `
        <div class="d-flex align-items-center justify-content-center h-100">
          <div class="text-center text-muted">
            <i class="bi bi-image" style="font-size: 2rem;"></i>
            <br><small>No image selected</small>
          </div>
        </div>
      `;
    }
  }

  removePropertyImage() {
    if (confirm('Are you sure you want to remove this property image?')) {
      this.propertyImage = '';
      this.updatePropertyImagePreview();
    }
  }

  // Setup clipboard paste functionality for property image URL field
  setupPropertyImageClipboardListener() {
    const fieldId = 'propertyImageUrl';
    const field = document.getElementById(fieldId);

    if (field && !field.hasAttribute('data-paste-listener-added')) {
      field.setAttribute('data-paste-listener-added', 'true');

      // Add paste event listener
      field.addEventListener('paste', async (e) => {
        e.preventDefault();
        await this.handleImagePaste(e, fieldId);
      });

      // Add visual feedback for paste capability
      const currentPlaceholder = field.placeholder || 'Paste Cloudinary URL here';
      if (!currentPlaceholder.includes('Ctrl+V')) {
        field.placeholder = currentPlaceholder + ' (Ctrl+V to paste from clipboard)';
      }
      field.title = 'You can paste images from clipboard here (Ctrl+V)';

      // Add a visual indicator
      field.style.borderLeft = '3px solid #0d6efd';
      field.setAttribute('data-clipboard-enabled', 'true');

      console.log(`✅ Clipboard paste listener added to ${fieldId}`);
    }
  }

  async handleImagePaste(event, fieldId) {
    console.log(`📋 Handling paste event for ${fieldId}`);

    try {
      const clipboardData = event.clipboardData || event.originalEvent?.clipboardData;
      if (!clipboardData) {
        console.log('No clipboard data available');
        return;
      }

      let imageFound = false;

      // Check for image files in clipboard
      if (clipboardData.files && clipboardData.files.length > 0) {
        for (const file of clipboardData.files) {
          if (file.type.startsWith('image/')) {
            imageFound = true;
            console.log(`📋 Image pasted from clipboard to ${fieldId}:`, file.name, file.type);
            await this.uploadClipboardImage(file, fieldId);
            break; // Handle only the first image found
          }
        }
      }

      if (!imageFound) {
        // Check if there's text content that might be an image URL
        const text = clipboardData.getData('text');
        if (text && this.isImageUrl(text)) {
          console.log(`📋 Image URL pasted from clipboard to ${fieldId}:`, text);
          document.getElementById(fieldId).value = text;
        } else {
          console.log('No image found in clipboard');
          this.showPasteMessage(fieldId, 'No image found in clipboard', 'warning');
        }
      }
    } catch (error) {
      console.error('Error handling clipboard paste:', error);
      this.showPasteMessage(fieldId, 'Error pasting from clipboard', 'error');
    }
  }

  async uploadClipboardImage(file, fieldId) {
    const field = document.getElementById(fieldId);
    const originalPlaceholder = field.placeholder;

    try {
      // Show loading state
      field.placeholder = 'Uploading image...';
      field.disabled = true;

      const result = await this.uploadSingleImage(file);

      if (result.success) {
        let imageUrl = result.url;
        if (imageUrl && !imageUrl.startsWith('http')) {
          // If it's a relative URL starting with /, prepend the API base URL
          if (imageUrl.startsWith('/')) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            // Otherwise assume it needs https:// prefix
            imageUrl = 'https://' + imageUrl;
          }
        }

        field.value = imageUrl;

        // Trigger the add image function if this is the property image URL field
        if (fieldId === 'propertyImageUrl') {
          this.addImageFromUrl();
        }

        this.showPasteMessage(fieldId, 'Image uploaded successfully!', 'success');
        console.log(`✅ Clipboard image uploaded successfully to ${fieldId}:`, imageUrl);
      } else {
        this.showPasteMessage(fieldId, 'Failed to upload image: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Error uploading clipboard image:', error);
      this.showPasteMessage(fieldId, 'Error uploading image', 'error');
    } finally {
      // Restore field state
      field.placeholder = originalPlaceholder;
      field.disabled = false;
    }
  }

  isImageUrl(text) {
    try {
      const url = new URL(text);
      return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname) ||
        text.includes('cloudinary.com') ||
        text.includes('imgur.com') ||
        text.includes('postimg.cc');
    } catch {
      return false;
    }
  }

  showPasteMessage(fieldId, message, type) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Create or update message element
    let messageEl = document.getElementById(`${fieldId}-paste-message`);
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.id = `${fieldId}-paste-message`;
      messageEl.className = 'small mt-1';
      field.parentNode.appendChild(messageEl);
    }

    // Set message and color
    messageEl.textContent = message;
    messageEl.className = `small mt-1 text-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'warning'}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (messageEl && messageEl.parentNode) {
        messageEl.remove();
      }
    }, 3000);
  }

  async uploadSingleImage(file) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const uploadUrl = buildApiUrl(API_CONFIG.ENDPOINTS.UPLOAD_TENANT_DOCUMENT);
      console.log('🔧 Upload URL:', uploadUrl);
      console.log('🔧 Base URL:', API_CONFIG.BASE_URL);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Image uploaded successfully:', result);
        return result;
      } else {
        console.error('❌ Upload failed:', result);
        return { success: false, error: result.error || 'Upload failed' };
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      return { success: false, error: error.message || 'Upload failed' };
    }
  }

  removeWifiImage(index) {
    if (confirm('Are you sure you want to remove this WiFi image?')) {
      this.currentWifiImages.splice(index, 1);
      this.renderWifiImagesGallery();
    }
  }

  // Utility method to escape HTML to prevent XSS
  escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Public method to refresh the properties list
  refresh() {
    this.loadProperties();
  }

  // AC Service Calendar Methods
  handleAcServiceDateChange(dateValue) {
    const calendarBtn = document.getElementById("viewServiceCalendarBtn");
    const calendarContainer = document.getElementById("acServiceCalendarContainer");

    if (dateValue) {
      // Show calendar button
      if (calendarBtn) {
        calendarBtn.style.display = "block";
      }
      // Auto-show calendar
      this.currentAcServiceDate = dateValue;
      this.showServiceCalendar();
    } else {
      // Hide calendar button and container
      if (calendarBtn) {
        calendarBtn.style.display = "none";
      }
      if (calendarContainer) {
        calendarContainer.style.display = "none";
      }
    }
  }

  showServiceCalendar() {
    const acServiceDate = document.getElementById("acServiceDate").value;

    if (!acServiceDate) {
      alert("Please select an AC service date first");
      return;
    }

    const calendarContainer = document.getElementById("acServiceCalendarContainer");
    if (!calendarContainer) return;

    // Import YearCalendar if not already available
    if (typeof YearCalendar === 'undefined') {
      console.error('YearCalendar component not loaded');
      return;
    }

    // Calculate service dates for the current year
    const currentYear = new Date().getFullYear();
    const serviceDates = this.calculateServiceDates(acServiceDate, currentYear);

    // Create calendar instance
    const calendar = new YearCalendar({
      year: currentYear,
      highlightedDates: serviceDates,
      title: 'AC Service Schedule',
      onDateClick: null
    });

    // Inject styles
    YearCalendar.injectStyles();

    // Render calendar
    calendarContainer.innerHTML = calendar.render();
    calendarContainer.style.display = "block";

    // Initialize event listeners with custom year change handler
    this.initCalendarEventListeners(calendarContainer, calendar, acServiceDate);
  }

  initCalendarEventListeners(containerElement, calendar, acServiceDate) {
    // Year navigation
    const prevBtn = containerElement.querySelector('.prev-year');
    const nextBtn = containerElement.querySelector('.next-year');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        calendar.changeYear(calendar.year - 1);
        const newServiceDates = this.calculateServiceDates(acServiceDate, calendar.year);
        calendar.updateHighlightedDates(newServiceDates);
        containerElement.innerHTML = calendar.render();
        this.initCalendarEventListeners(containerElement, calendar, acServiceDate);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        calendar.changeYear(calendar.year + 1);
        const newServiceDates = this.calculateServiceDates(acServiceDate, calendar.year);
        calendar.updateHighlightedDates(newServiceDates);
        containerElement.innerHTML = calendar.render();
        this.initCalendarEventListeners(containerElement, calendar, acServiceDate);
      });
    }
  }

  calculateServiceDates(startDateStr, year) {
    const startDate = new Date(startDateStr);
    const dates = [];

    // Helper function to get service dates for a year
    const getServiceDatesForYear = (targetYear) => {
      const yearDates = [];
      let currentDate = new Date(startDate);

      // If start date is after the target year, calculate backwards
      if (startDate.getFullYear() > targetYear) {
        while (currentDate.getFullYear() > targetYear) {
          currentDate.setMonth(currentDate.getMonth() - 3);
        }
        // Move forward to get into the target year
        while (currentDate.getFullYear() < targetYear) {
          currentDate.setMonth(currentDate.getMonth() + 3);
        }
      }
      // If start date is before the target year, calculate forwards
      else if (startDate.getFullYear() < targetYear) {
        while (currentDate.getFullYear() < targetYear) {
          currentDate.setMonth(currentDate.getMonth() + 3);
        }
      }

      // Collect all dates within the target year
      while (currentDate.getFullYear() === targetYear) {
        yearDates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 3);
      }

      return yearDates;
    };

    return getServiceDatesForYear(year);
  }

  // AC Service Contact Numbers Methods
  addAcContactNumber() {
    const input = document.getElementById('acContactNumberInput');
    const number = input.value.trim();

    if (!number) {
      alert('Please enter a phone number');
      return;
    }

    // Basic phone number validation
    if (number.length < 8 || number.length > 20) {
      alert('Phone number must be between 8 and 20 characters');
      return;
    }

    // Check for duplicates
    if (this.currentAcContactNumbers.includes(number)) {
      alert('This phone number is already added');
      return;
    }

    // Add number to the list
    this.currentAcContactNumbers.push(number);
    this.renderAcContactNumbersList();

    // Clear input
    input.value = '';
    input.focus();
  }

  removeAcContactNumber(index) {
    if (confirm('Are you sure you want to remove this contact number?')) {
      this.currentAcContactNumbers.splice(index, 1);
      this.renderAcContactNumbersList();
    }
  }

  renderAcContactNumbersList() {
    const listContainer = document.getElementById('acContactNumbersList');
    if (!listContainer) return;

    if (!this.currentAcContactNumbers || this.currentAcContactNumbers.length === 0) {
      listContainer.innerHTML = '<p class="text-muted small mb-0">No contact numbers added yet</p>';
      return;
    }

    let html = '<div class="d-flex flex-column gap-2">';
    this.currentAcContactNumbers.forEach((number, index) => {
      html += `
        <div class="d-flex align-items-center justify-content-between bg-white rounded p-2 border">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-telephone-fill text-primary"></i>
            <span class="fw-medium">${this.escapeHtml(number)}</span>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger rounded-circle p-1"
            onclick="propertyManager.removeAcContactNumber(${index})"
            style="width: 24px; height: 24px; line-height: 1;"
          >
            <i class="bi bi-x" style="font-size: 14px;"></i>
          </button>
        </div>
      `;
    });
    html += '</div>';

    listContainer.innerHTML = html;
  }

  onDigitalLockToggle(enabled) {
    const pinSection = document.getElementById("digitalLockPinSection");
    if (pinSection) {
      pinSection.style.display = enabled ? "block" : "none";
    }
    if (!enabled) {
      const pinInput = document.getElementById("digitalLockPin");
      if (pinInput) pinInput.value = "";
    }
  }

  async copyPropertiesAsText() {
    const btn = document.getElementById('copyPropertiesTextBtn');
    const origHtml = btn?.innerHTML;
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Copying...'; }

      const active = this.properties
        .filter(p => !p.isArchived)
        .sort((a, b) => {
          const nameA = this.allInvestors.find(i => i.investorId === a.accountant)?.name || '';
          const nameB = this.allInvestors.find(i => i.investorId === b.accountant)?.name || '';
          return nameA.localeCompare(nameB);
        });

      const fmtDate = d => d ? new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const calcLease = (moveIn, moveOut) => {
        if (!moveIn || !moveOut) return '';
        const ms = new Date(moveOut) - new Date(moveIn);
        if (ms <= 0) return '';
        const months = Math.round(ms / (1000 * 60 * 60 * 24 * 30.44));
        if (months < 12) return `${months} mo`;
        const yrs = Math.round(months / 12 * 2) / 2;
        return yrs === 1 ? '1 year' : `${yrs} years`;
      };

      const headers = ['#', 'Address', 'Unit', 'Rent (S$)', 'Lease', 'Move-in', 'Move-out', 'Accountant'];
      const rows = active.map((p, i) => {
        const acc = this.allInvestors.find(inv => inv.investorId === p.accountant);
        return [
          i + 1,
          p.address || '',
          p.unit || '',
          p.rent || '',
          calcLease(p.moveInDate, p.moveOutDate),
          fmtDate(p.moveInDate),
          fmtDate(p.moveOutDate),
          acc ? acc.name : '',
        ];
      });

      const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n');
      await navigator.clipboard.writeText(tsv);

      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
      showToast(`${active.length} properties copied — paste with ${isMac ? '⌘ Cmd+V' : 'Ctrl+V'} in Excel`, 'success', 5000);

      if (btn) {
        btn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Copied!';
        btn.classList.replace('btn-outline-primary', 'btn-success');
        setTimeout(() => {
          btn.innerHTML = origHtml;
          btn.classList.replace('btn-success', 'btn-outline-primary');
          btn.disabled = false;
        }, 2000);
      }
    } catch (err) {
      console.error('Copy as text failed:', err);
      showToast('Failed to copy: ' + err.message, 'danger');
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
  }

  async _fetchAvatarDataUrl(url) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  }

  async exportPropertiesAsImage() {
    const btn = document.getElementById('exportPropertiesBtn');
    const origHtml = btn?.innerHTML;
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Exporting...'; }
      const active = this.properties
        .filter(p => !p.isArchived)
        .sort((a, b) => {
          const nameA = this.allInvestors.find(i => i.investorId === a.accountant)?.name || '';
          const nameB = this.allInvestors.find(i => i.investorId === b.accountant)?.name || '';
          return nameA.localeCompare(nameB);
        });

      // Pre-fetch avatars as base64 so they can be embedded in the SVG
      const avatarMap = {};
      const uniqueAccountants = [...new Set(active.map(p => p.accountant).filter(Boolean))];
      await Promise.all(uniqueAccountants.map(async id => {
        const inv = this.allInvestors.find(i => i.investorId === id);
        if (inv?.avatar) avatarMap[id] = await this._fetchAvatarDataUrl(inv.avatar);
      }));

      const svgStr = this._buildPropertiesTableSVG(active, active.length, avatarMap);
      const blob = await this._propSvgToPngBlob(svgStr);
      this._showPropImagePreview(blob);
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
        showToast(`Copied to clipboard — paste with ${isMac ? '⌘ Cmd+V' : 'Ctrl+V'}`, 'success', 5000);
      } catch (_clipErr) {
        // Clipboard copy is optional — preview modal is the primary deliverable
      }
    } catch (err) {
      console.error('Export properties image failed:', err);
      alert('Export failed: ' + err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
    }
  }

  _buildPropertiesTableSVG(rows, activeCount, avatarMap = {}) {
    const TITLE_H = 56;
    const COL_H = 36;
    const ROW_H = 44;
    const PAD = 24;
    const FOOTER_H = 32;

    const COLS = [
      { label: '#',          w: 40,  align: 'middle' },
      { label: 'Address',    w: 330, align: 'start'  },
      { label: 'Rent (S$)',  w: 95,  align: 'end'    },
      { label: 'Lease',      w: 90,  align: 'middle' },
      { label: 'Move-in',    w: 110, align: 'middle' },
      { label: 'Move-out',   w: 110, align: 'middle' },
      { label: 'Accountant', w: 207, align: 'start'  },
    ];

    const tableW = COLS.reduce((s, c) => s + c.w, 0);
    const SVG_W = tableW + 2 * PAD;
    const SVG_H = TITLE_H + COL_H + rows.length * ROW_H + FOOTER_H;

    const colX = [];
    let cx = PAD;
    COLS.forEach(col => { colX.push(cx); cx += col.w; });

    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const calcLease = (moveIn, moveOut) => {
      if (!moveIn || !moveOut) return '—';
      const ms = new Date(moveOut) - new Date(moveIn);
      if (ms <= 0) return '—';
      const months = Math.round(ms / (1000 * 60 * 60 * 24 * 30.44));
      if (months < 12) return `${months} mo`;
      const yrs = Math.round(months / 12 * 2) / 2;
      return yrs === 1 ? '1 year' : `${yrs} years`;
    };

    const parts = [];
    const avatarClipDefs = [];

    parts.push(`<rect width="${SVG_W}" height="${SVG_H}" fill="#f8f9fa"/>`);

    parts.push(`<rect x="0" y="0" width="${SVG_W}" height="${TITLE_H}" fill="url(#pmTitleGrad)"/>`);
    parts.push(`<text x="${PAD + 8}" y="${TITLE_H / 2 + 7}" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="white">Property Portfolio Overview</text>`);
    const dateStr = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
    parts.push(`<text x="${SVG_W - PAD - 8}" y="${TITLE_H / 2 + 7}" font-family="Arial,sans-serif" font-size="12" fill="rgba(255,255,255,0.8)" text-anchor="end">${esc(dateStr)}</text>`);

    parts.push(`<rect x="${PAD}" y="${TITLE_H}" width="${tableW}" height="${COL_H}" fill="#2d3748"/>`);
    COLS.forEach((col, i) => {
      const tx = col.align === 'end' ? colX[i] + col.w - 8 : col.align === 'middle' ? colX[i] + col.w / 2 : colX[i] + 8;
      const anchor = col.align === 'end' ? 'end' : col.align === 'middle' ? 'middle' : 'start';
      parts.push(`<text x="${tx}" y="${TITLE_H + COL_H / 2 + 5}" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#e2e8f0" text-anchor="${anchor}">${esc(col.label)}</text>`);
    });

    let archivedSepDrawn = false;
    rows.forEach((prop, idx) => {
      const rowY = TITLE_H + COL_H + idx * ROW_H;
      const isArchived = !!prop.isArchived;

      if (isArchived && !archivedSepDrawn) {
        archivedSepDrawn = true;
        parts.push(`<rect x="${PAD}" y="${rowY}" width="${tableW}" height="2" fill="#cbd5e0"/>`);
      }

      const rowBg = isArchived ? '#f0f0f0' : idx % 2 === 0 ? '#ffffff' : '#f8faff';
      const textFill = isArchived ? '#9ca3af' : '#1a202c';
      parts.push(`<rect x="${PAD}" y="${rowY}" width="${tableW}" height="${ROW_H}" fill="${rowBg}"/>`);
      parts.push(`<line x1="${PAD}" y1="${rowY + ROW_H}" x2="${PAD + tableW}" y2="${rowY + ROW_H}" stroke="#e2e8f0" stroke-width="0.5"/>`);

      const textY = rowY + ROW_H / 2 + 5;
      const acc = this.allInvestors.find(i => i.investorId === prop.accountant);

      const cells = [
        { v: String(idx + 1),                                    align: 'middle', colIdx: 0 },
        { v: prop.rent ? `$${prop.rent.toLocaleString()}` : '—', align: 'end',    colIdx: 2 },
        { v: calcLease(prop.moveInDate, prop.moveOutDate),       align: 'middle', colIdx: 3 },
        { v: fmtDate(prop.moveInDate),                           align: 'middle', colIdx: 4 },
        { v: fmtDate(prop.moveOutDate),                          align: 'middle', colIdx: 5 },
      ];
      // Render non-address, non-accountant cells
      cells.forEach(({ v, align, colIdx }) => {
        const col = COLS[colIdx];
        const tx = align === 'end' ? colX[colIdx] + col.w - 8 : align === 'middle' ? colX[colIdx] + col.w / 2 : colX[colIdx] + 8;
        const anchor = align === 'end' ? 'end' : align === 'middle' ? 'middle' : 'start';
        parts.push(`<text x="${tx}" y="${textY}" font-family="Arial,sans-serif" font-size="12" fill="${textFill}" text-anchor="${anchor}">${esc(v)}</text>`);
      });

      // Accountant cell: avatar circle + name
      const AVATAR_R = 13;
      const avatarCX = colX[6] + 8 + AVATAR_R;
      const avatarCY = rowY + ROW_H / 2;
      if (acc) {
        const dataUrl = avatarMap[prop.accountant];
        if (dataUrl) {
          const clipId = `accClip_${idx}`;
          avatarClipDefs.push(`<clipPath id="${clipId}"><circle cx="${avatarCX}" cy="${avatarCY}" r="${AVATAR_R}"/></clipPath>`);
          parts.push(`<circle cx="${avatarCX}" cy="${avatarCY}" r="${AVATAR_R}" fill="#e9ecef"/>`);
          parts.push(`<image href="${dataUrl}" x="${avatarCX - AVATAR_R}" y="${avatarCY - AVATAR_R}" width="${AVATAR_R * 2}" height="${AVATAR_R * 2}" clip-path="url(#accClip_${idx})" preserveAspectRatio="xMidYMid slice"/>`);
        } else {
          const initials = acc.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
          parts.push(`<circle cx="${avatarCX}" cy="${avatarCY}" r="${AVATAR_R}" fill="url(#pmAccGrad)"/>`);
          parts.push(`<text x="${avatarCX}" y="${avatarCY + 4}" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="white" text-anchor="middle">${esc(initials)}</text>`);
        }
        const nameX = avatarCX + AVATAR_R + 5;
        parts.push(`<text x="${nameX}" y="${textY}" font-family="Arial,sans-serif" font-size="12" fill="${textFill}">${esc(trunc(acc.name, 22))}</text>`);
      } else {
        parts.push(`<text x="${colX[6] + 8}" y="${textY}" font-family="Arial,sans-serif" font-size="12" fill="${textFill}">—</text>`);
      }

      // Address: two lines (address line 1, unit line 2) — no truncation
      const addrX = colX[1] + 8;
      const addrLine1Y = rowY + 16;
      const addrLine2Y = rowY + 31;
      parts.push(`<text x="${addrX}" y="${addrLine1Y}" font-family="Arial,sans-serif" font-size="12" fill="${textFill}">${esc(prop.address || '—')}</text>`);
      if (prop.unit) {
        parts.push(`<text x="${addrX}" y="${addrLine2Y}" font-family="Arial,sans-serif" font-size="11" fill="${isArchived ? '#b0b8c4' : '#6b7280'}">${esc(prop.unit)}</text>`);
      }

      COLS.forEach((_, i) => {
        if (i > 0) parts.push(`<line x1="${colX[i]}" y1="${rowY}" x2="${colX[i]}" y2="${rowY + ROW_H}" stroke="#e2e8f0" stroke-width="0.5"/>`);
      });
    });

    parts.push(`<rect x="${PAD}" y="${TITLE_H}" width="${tableW}" height="${COL_H + rows.length * ROW_H}" fill="none" stroke="#cbd5e0" stroke-width="1"/>`);

    const footerY = TITLE_H + COL_H + rows.length * ROW_H + 10;
    const archivedCount = rows.length - activeCount;
    const footerText = `${activeCount} active propert${activeCount === 1 ? 'y' : 'ies'}${archivedCount > 0 ? ` · ${archivedCount} archived` : ''}`;
    parts.push(`<text x="${SVG_W / 2}" y="${footerY + 12}" font-family="Arial,sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">${esc(footerText)}</text>`);

    const defs = `<defs><linearGradient id="pmTitleGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/></linearGradient><linearGradient id="pmAccGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6f42c1"/><stop offset="100%" stop-color="#9d4edd"/></linearGradient>${avatarClipDefs.join('')}</defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}">${defs}${parts.join('')}</svg>`;
  }

  _propSvgToPngBlob(svgStr) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to render SVG')); };
      img.src = url;
    });
  }

  _showPropImagePreview(blob) {
    const objectUrl = URL.createObjectURL(blob);
    const fileName = `Property_Portfolio_${new Date().toISOString().slice(0, 10)}.png`;

    document.getElementById('pmImagePreviewModal')?.remove();

    const modalHtml = `
      <div class="modal fade" id="pmImagePreviewModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content" style="border-radius:16px;overflow:hidden;">
            <div class="modal-header border-0 pb-0" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
              <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle bg-white d-flex align-items-center justify-content-center" style="width:32px;height:32px;flex-shrink:0;">
                  <i class="bi bi-image text-primary" style="font-size:1rem;"></i>
                </div>
                <h6 class="modal-title text-white fw-bold mb-0">Property Portfolio Export</h6>
              </div>
              <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0 text-center bg-dark" style="min-height:200px;">
              <img src="${objectUrl}" alt="Property Portfolio" style="max-width:100%;display:block;margin:0 auto;"/>
            </div>
            <div class="modal-footer border-0 justify-content-between" style="background:#f8f9fa;">
              <div class="text-muted" style="font-size:0.78rem;"><i class="bi bi-keyboard me-1"></i>Press <kbd>Esc</kbd> to close</div>
              <div class="d-flex gap-2">
                <a href="${objectUrl}" download="${fileName}" class="btn btn-primary btn-sm">
                  <i class="bi bi-download me-1"></i>Download PNG
                </a>
                <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">
                  <i class="bi bi-x-lg me-1"></i>Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modalEl = document.getElementById('pmImagePreviewModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
    modalEl.addEventListener('hidden.bs.modal', () => { URL.revokeObjectURL(objectUrl); modalEl.remove(); }, { once: true });
    const onKey = e => { if (e.key === 'Escape') modal.hide(); };
    document.addEventListener('keydown', onKey);
    modalEl.addEventListener('hidden.bs.modal', () => document.removeEventListener('keydown', onKey), { once: true });
    modal.show();
  }


}

// Export for use in other modules
window.PropertyManagementComponent = PropertyManagementComponent;

function copyPropertyAddress(btn) {
  const address = btn.getAttribute('data-address');
  navigator.clipboard.writeText(address).then(() => {
    btn.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
    setTimeout(() => { btn.innerHTML = '<i class="bi bi-copy"></i>'; }, 1500);
  });
}
window.copyPropertyAddress = copyPropertyAddress;

function copyToClipboardInline(el) {
  const text = el.dataset.copy !== undefined ? el.dataset.copy : el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const orig = el.innerHTML;
    el.innerHTML = '✓ Copied';
    el.style.color = '#198754';
    setTimeout(() => {
      el.innerHTML = orig;
      el.style.color = '';
    }, 1500);
  });
}
window.copyToClipboardInline = copyToClipboardInline;

async function openTenantFbGroup(el) {
  const url = el.dataset.fbUrl;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
  } catch (error) {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.left = "-999999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
window.openTenantFbGroup = openTenantFbGroup;
