import {
  ROOM_FAMILY_LABELS,
  DEFAULT_ROOM_TYPES,
  getRoomTypeBadgeStyle,
  getRoomTypeDisplayName,
  parseRoomType,
  compareRoomTypes,
} from '../utils/room-type-mapper.js';
import { renderInvestorAvatarStack, renderInvestorAvatarCircle, getInvestorShortName } from '../utils/investor-avatar-stack.js';
import { getGroupLinkMeta } from '../utils/social-links.js';
import {
  createDefaultPropertyFilters,
  applyPropertyFilters,
  getActivePropertyFilterCount,
  loadPropertyFilters,
  savePropertyFilters,
} from '../utils/property-filters.js';

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
    this._exportSelectedIds = null; // Set of propertyIds chosen for portfolio export (null until first customized)
    this._searchTerm = ''; // Current quick-search text (separate from the filter panel below)
    this.filters = loadPropertyFilters(); // Persisted filter-panel state (investor, and later more criteria)
    this.selectedPropertyId = null; // Property currently loaded in the right-hand detail panel (null = add-mode)
    this._hasAutoSelected = false; // Guards the auto-select-first-property-on-load behavior to fire once
    this._lastSelectedPropertyId = null; // Most recent real (non-add-mode) selection, so Cancel from add-mode can return to it
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadProperties();
    this.loadAcServiceCompanies();
    this.loadAllInvestors();
    this.populateRoomTypesDropdown();
    this.updateFilterSummaryUI();
  }

  // Renders the room picker as 5 family groups (Master, Common, Big Single,
  // Small Single, Store). Master is a single fixed checkbox; the others
  // start with DEFAULT_ROOM_TYPES' members and offer a "+ Add" control to
  // append the next numbered room in that family.
  populateRoomTypesDropdown() {
    const dropdownMenu = document.getElementById("propertyRoomsDropdownMenu");
    const hiddenSelect = document.getElementById("propertyRooms");

    if (!dropdownMenu || !hiddenSelect) return;

    dropdownMenu.innerHTML = '';
    hiddenSelect.innerHTML = '';

    const families = [
      { key: 'MASTER', label: 'Master', numbered: false },
      { key: 'COMMON', label: ROOM_FAMILY_LABELS.COMMON, numbered: true },
      { key: 'BIG_SINGLE', label: ROOM_FAMILY_LABELS.BIG_SINGLE, numbered: true },
      { key: 'SMALL_SINGLE', label: ROOM_FAMILY_LABELS.SMALL_SINGLE, numbered: true },
      { key: 'STORE', label: ROOM_FAMILY_LABELS.STORE, numbered: true },
    ];

    families.forEach(({ key, label, numbered }) => {
      const group = document.createElement('div');
      group.className = 'room-family-group border-bottom';
      group.dataset.family = key;
      dropdownMenu.appendChild(group);

      if (numbered) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-sm btn-link text-decoration-none room-family-add-btn';
        addBtn.innerHTML = `<i class="bi bi-plus-circle me-1"></i>Add ${label}`;
        addBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleAddRoomFamily(key);
        });
        group.appendChild(addBtn);
      }
    });

    DEFAULT_ROOM_TYPES.forEach((roomType) => this.addRoomTypeCheckbox(roomType, { checked: false }));

    // Prevent dropdown from closing when clicking inside
    dropdownMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Idempotently adds a checkbox for roomType into its family's group (kept
  // before that group's "+ Add" button so the button stays at the bottom),
  // plus a matching hidden <select> option. No-ops if it already exists.
  addRoomTypeCheckbox(roomType, { checked = false } = {}) {
    if (document.getElementById(`room_${roomType}`)) return;

    const dropdownMenu = document.getElementById("propertyRoomsDropdownMenu");
    const hiddenSelect = document.getElementById("propertyRooms");
    if (!dropdownMenu || !hiddenSelect) return;

    const { family } = parseRoomType(roomType);
    if (!family) return;

    const group = dropdownMenu.querySelector(`.room-family-group[data-family="${family}"]`);
    if (!group) return;

    const label = getRoomTypeDisplayName(roomType);

    const row = document.createElement('div');
    row.className = 'form-check px-3 py-2';
    row.style.cssText = 'display: flex; align-items: center; gap: 12px; cursor: pointer;';
    row.addEventListener('mouseover', () => { row.style.backgroundColor = '#f8f9fa'; });
    row.addEventListener('mouseout', () => { row.style.backgroundColor = ''; });
    row.innerHTML = `
      <input class="form-check-input property-room-checkbox" type="checkbox" value="${roomType}" id="room_${roomType}"${checked ? ' checked' : ''} style="margin: 0; width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; position: relative;">
      <label class="form-check-label" for="room_${roomType}" style="cursor: pointer; flex: 1; margin: 0;">
        ${label}
      </label>
    `;

    const addBtn = group.querySelector('.room-family-add-btn');
    if (addBtn) {
      group.insertBefore(row, addBtn);
    } else {
      group.appendChild(row);
    }

    row.querySelector('.property-room-checkbox').addEventListener('change', () => {
      this.updatePropertyRoomsSelection();
    });

    const option = document.createElement('option');
    option.value = roomType;
    option.textContent = label;
    hiddenSelect.appendChild(option);
  }

  // "+ Add {family}" handler: appends the next numbered room in that family,
  // checked by default since the user just asked for it.
  handleAddRoomFamily(family) {
    const existingNumbers = Array.from(document.querySelectorAll('.property-room-checkbox'))
      .map(cb => parseRoomType(cb.value))
      .filter(p => p.family === family)
      .map(p => p.number || 0);
    const nextNumber = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;
    this.addRoomTypeCheckbox(`${family}_${nextNumber}`, { checked: true });
    this.updatePropertyRoomsSelection();
  }

  // Makes sure every room in `rooms` has a checkbox, adding any that go
  // beyond the default set (e.g. a property with a 3rd Common) so it isn't
  // silently dropped when the form is next saved.
  ensureRoomOptionsExist(rooms = []) {
    rooms.forEach((room) => this.addRoomTypeCheckbox(room, { checked: false }));
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

    this.renderRoomPricesInputs();
  }

  // Keeps the per-room-type price range inputs in sync with the checked room
  // types, without wiping out values already typed for rooms that stay checked.
  renderRoomPricesInputs() {
    const container = document.getElementById('propertyRoomPricesContainer');
    const wrap = document.getElementById('propertyRoomPricesWrap');
    if (!container || !wrap) return;

    const checkedRooms = Array.from(document.querySelectorAll('.property-room-checkbox:checked')).map(cb => cb.value);

    // Drop rows for rooms that got unchecked
    container.querySelectorAll('.room-price-row').forEach(row => {
      if (!checkedRooms.includes(row.dataset.room)) row.remove();
    });

    // Add rows for newly-checked rooms
    checkedRooms.forEach(room => {
      if (container.querySelector(`.room-price-row[data-room="${room}"]`)) return;
      const label = getRoomTypeDisplayName(room);
      const row = document.createElement('div');
      row.className = 'd-flex align-items-center gap-2 mb-2 room-price-row';
      row.dataset.room = room;
      row.innerHTML = `
        <span class="badge text-truncate" style="min-width:120px;max-width:170px;${getRoomTypeBadgeStyle(room)}" title="${label}">${label}</span>
        <div class="input-group input-group-sm" style="max-width:110px;">
          <span class="input-group-text">$</span>
          <input type="number" class="form-control room-price-min" min="0" step="10" placeholder="Min">
        </div>
        <span class="text-muted small">to</span>
        <div class="input-group input-group-sm" style="max-width:110px;">
          <span class="input-group-text">$</span>
          <input type="number" class="form-control room-price-max" min="0" step="10" placeholder="Max">
        </div>
      `;
      container.appendChild(row);
    });

    // Keep rows ordered by family, then number
    Array.from(container.children)
      .sort((a, b) => compareRoomTypes(a.dataset.room, b.dataset.room))
      .forEach(row => container.appendChild(row));

    wrap.style.display = checkedRooms.length > 0 ? 'block' : 'none';
  }

  // Fills the price range inputs from a property's saved roomPrices; call after
  // renderRoomPricesInputs() has created the rows for the property's rooms.
  populateRoomPricesInputs(roomPrices = []) {
    roomPrices.forEach(rp => {
      const row = document.querySelector(`.room-price-row[data-room="${rp.room}"]`);
      if (!row) return;
      const minInput = row.querySelector('.room-price-min');
      const maxInput = row.querySelector('.room-price-max');
      if (minInput) minInput.value = rp.minPrice || '';
      if (maxInput) maxInput.value = rp.maxPrice || '';
    });
  }

  // Reads the currently-rendered price range rows into a roomPrices payload.
  getRoomPricesFromInputs() {
    return Array.from(document.querySelectorAll('#propertyRoomPricesContainer .room-price-row')).map(row => {
      const minPrice = parseFloat(row.querySelector('.room-price-min')?.value) || 0;
      const maxPrice = parseFloat(row.querySelector('.room-price-max')?.value) || 0;
      return { room: row.dataset.room, minPrice, maxPrice };
    });
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
        this.renderInvestorFilterMenu();
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

  populateManagerDropdown() {
    const dropdown = document.getElementById("manager");
    if (!dropdown) return;

    dropdown.innerHTML = '<option value="">-- Select Manager --</option>';

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

  updateManagerAvatarPreview(investorId) {
    const preview = document.getElementById("managerAvatarPreview");
    const circle = document.getElementById("managerAvatarCircle");
    const nameEl = document.getElementById("managerAvatarName");
    const idEl = document.getElementById("managerAvatarId");

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
        this.showAddPropertyPanel();
      });
    }

    // Detail panel cancel affordances (header X + footer Cancel) — both discard
    // in-progress edits and return the panel to whatever was selected before
    ['propertyPanelCancelBtn', 'propertyPanelCancelBtn2'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => this.handlePanelCancel());
      }
    });

    // Mobile "back to list" button (only visible <768px, see dashboard.html media query)
    const backBtn = document.getElementById('pmBackToListBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => this.exitMobileDetailView());
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

    // Filter panel - reset button
    const filterResetBtn = document.getElementById("propertyFilterResetBtn");
    if (filterResetBtn) {
      filterResetBtn.addEventListener("click", () => {
        this.resetPropertyFilters();
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

    // Manager dropdown - update avatar preview on change
    const managerDropdown = document.getElementById("manager");
    if (managerDropdown) {
      managerDropdown.addEventListener("change", (e) => {
        this.updateManagerAvatarPreview(e.target.value);
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

    // Live-update the Tenant/Admin group badges as the URL is typed/pasted
    ['tenantFacebookGroup', 'adminFacebookGroup'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.updateFbGroupBadges());
      }
    });
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
    // Only show the shimmer when there's nothing on screen yet (first load,
    // or the list is currently empty) — background refreshes (Reload button,
    // the internal re-fetch after a save) keep the existing rows visible
    // until the fresh data replaces them, instead of flashing the whole list.
    if (this.properties.length === 0) {
      this.showLoadingSkeleton();
    }
    try {
      // Fetch all properties in one page; loop only kicks in if the total
      // ever exceeds this page size.
      let allProperties = [];
      let currentPage = 1;
      const itemsPerPage = 500;
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
          if (p.manager) console.log(`🧑‍💼 Property ${p.propertyId} manager:`, p.manager);
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
        this.updatePropertiesCountBadge();
        this.autoSelectFirstPropertyOnce();

        // Update sidebar badges
        if (window.updateSidebarBadges) {
          window.updateSidebarBadges();
        }
      } else {
        this.properties = [];
        this.showEmptyState();
        this.updatePropertiesCountBadge();
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showEmptyState("Error loading properties. Please try again.");
    }
  }

  // Fires once per page session: pre-loads the right-hand detail panel with
  // the first visible property (same active/archived, createdAt-desc order
  // as the list) so the panel is never empty on first load. Guarded so it
  // never fights a user's manual row click or a post-save re-selection on
  // later loadProperties() calls (e.g. from the Reload button).
  autoSelectFirstPropertyOnce() {
    if (this._hasAutoSelected || this.selectedPropertyId) return;
    this._hasAutoSelected = true;

    const visible = this.getVisibleProperties();
    const sorted = this.sortPropertiesForDisplay(visible);
    if (sorted.length > 0) {
      this.showPropertyPanel(sorted[0]);
    }
  }

  updatePropertiesCountBadge() {
    const badge = document.getElementById("propertiesTotalCountBadge");
    if (!badge) return;

    const total = this.properties.length;
    badge.textContent = total;
    badge.style.display = total > 0 ? "" : "none";
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

    const visibleProperties = this.getVisibleProperties();
    if (visibleProperties.length === 0) {
      this.showEmptyState(this.buildFilteredEmptyStateMessage());
      return;
    }

    const sortedProperties = this.sortPropertiesForDisplay(visibleProperties);

    let rowsHtml = "";
    let archivedDividerInserted = false;

    sortedProperties.forEach((property) => {
      const isArchived = !!property.isArchived;

      // Insert section divider before first archived row
      if (isArchived && !archivedDividerInserted) {
        archivedDividerInserted = true;
        const archivedCount = sortedProperties.filter((p) => p.isArchived).length;
        rowsHtml += `
          <div class="d-flex align-items-center gap-2" style="margin: 10px 6px 6px;">
            <i class="bi bi-archive text-secondary" style="font-size: 0.75rem;"></i>
            <span class="text-secondary fw-semibold" style="font-size: 0.7rem;">Archived (${archivedCount})</span>
            <hr class="flex-grow-1 my-0" style="border-color: #adb5bd;">
          </div>`;
      }

      rowsHtml += this.renderPropertyRow(property, isArchived);
    });

    container.innerHTML = rowsHtml;

    // Add row styles
    this.addPropertyRowStyles();

    // Restart the fade-in each render (skeleton -> real rows, and any
    // subsequent refresh) for a smooth transition instead of a hard swap.
    container.classList.remove('pm-list-fade-in');
    void container.offsetWidth; // force reflow so the animation restarts
    container.classList.add('pm-list-fade-in');
  }

  // Shared active/archived, createdAt-desc sort used both here and by the
  // auto-select-first-property hook in loadProperties(), so they always agree
  // on what "first property" means.
  sortPropertiesForDisplay(list) {
    const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    const active = list.filter((p) => !p.isArchived).sort(byNewest);
    const archived = list.filter((p) => p.isArchived).sort(byNewest);
    return [...active, ...archived];
  }

  // Compact list-row for the master-detail left panel. Full property detail
  // (rooms, banking, settlement accounts, FB groups, SP credentials, etc.) is
  // intentionally NOT duplicated here — it's the same property object and
  // shows up in the right-hand form once the row is selected.
  renderPropertyRow(property, isArchived) {
    const isCondo = property.propertyType === 'condo';
    const isSelected = property.propertyId === this.selectedPropertyId;

    const typeGradient = isArchived
      ? 'linear-gradient(135deg, #868e96 0%, #495057 100%)'
      : isCondo
        ? 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    const typeIcon = isCondo ? 'bi-buildings' : 'bi-building';

    // Preview thumbnail: property photo if set, otherwise the same
    // type-gradient + icon placeholder the old cards used.
    const thumbHtml = property.propertyImage
      ? `<div class="pm-row-thumb" style="background-image:url('${property.propertyImage}');"></div>`
      : `<div class="pm-row-thumb d-flex align-items-center justify-content-center" style="background:${typeGradient};">
           <i class="bi ${isArchived ? 'bi-archive' : typeIcon} text-white" style="font-size:1.4rem;opacity:0.85;"></i>
         </div>`;
    // Selection badge — pure CSS visibility (driven by the ancestor .pm-row-selected
    // class), so it's always in sync with actual selection state and never a
    // timed/fading effect.
    const thumbWrapHtml = `<div class="pm-row-thumb-wrap">${thumbHtml}<div class="pm-row-check-badge"><i class="bi bi-check-lg"></i></div></div>`;

    const archivedBadge = isArchived
      ? `<span class="badge bg-secondary" style="font-size:0.6rem;" title="Archived"><i class="bi bi-archive"></i></span>`
      : '';
    const condoBadge = (!isArchived && isCondo)
      ? `<span class="badge" style="background:linear-gradient(135deg,#f6d365,#fda085);color:#7c2d12;font-size:0.6rem;" title="Condominium"><i class="bi bi-buildings"></i></span>`
      : '';
    const lockBadge = property.digitalLockEnabled
      ? `<i class="bi bi-shield-lock-fill" style="color:#6f42c1;font-size:0.75rem;" title="Digital Lock Installed"></i>`
      : '';

    const investorAvatarHtml = renderInvestorAvatarStack(this.allInvestors, property.propertyId, { size: 28, overlap: 10, max: 3 });

    // Room badges — up to 3, then a "+N" overflow badge
    const rooms = property.rooms || [];
    const visibleRooms = rooms.slice(0, 3);
    const extraRoomsCount = rooms.length - visibleRooms.length;
    const roomBadgesHtml = rooms.length > 0
      ? `<div class="d-flex flex-wrap gap-1 mt-1">
          ${visibleRooms.map((room) => `<span class="badge" style="font-size:0.6rem;${getRoomTypeBadgeStyle(room)}">${getRoomTypeDisplayName(room)}</span>`).join('')}
          ${extraRoomsCount > 0 ? `<span class="badge bg-light text-muted border" style="font-size:0.6rem;">+${extraRoomsCount}</span>` : ''}
        </div>`
      : '';

    // Move-in badge (neutral) + move-out badge, color-coded red/orange/green
    // by urgency — same thresholds the old cards used.
    const fmtDate = (d) => new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
    const moveBadges = [];
    if (property.moveInDate) {
      const moveInFormatted = fmtDate(property.moveInDate);
      moveBadges.push(`<span class="badge bg-light text-dark border prop-copy-val" data-copy="${moveInFormatted}" title="Click to copy move-in date" onclick="event.stopPropagation();copyToClipboardInline(this)" style="font-size:0.6rem;"><i class="bi bi-box-arrow-in-right me-1"></i>In: ${moveInFormatted}</span>`);
    }
    if (property.moveOutDate) {
      const moveOut = new Date(property.moveOutDate);
      const diffDays = (moveOut - new Date()) / (1000 * 60 * 60 * 24);
      const badgeBg = diffDays <= 30 ? '#dc3545' : diffDays <= 90 ? '#ff8c00' : '#198754';
      const moveOutFormatted = fmtDate(property.moveOutDate);
      moveBadges.push(`<span class="badge prop-copy-val" data-copy="${moveOutFormatted}" title="Click to copy move-out date" onclick="event.stopPropagation();copyToClipboardInline(this)" style="background:${badgeBg};color:#fff;font-size:0.6rem;"><i class="bi bi-box-arrow-right me-1"></i>Out: ${moveOutFormatted}</span>`);
    }
    const moveDatesHtml = moveBadges.length ? `<div class="d-flex flex-wrap gap-1 mt-1">${moveBadges.join('')}</div>` : '';

    // Accountant / Manager — small avatar + short name, same colors the old
    // card's detail blocks used (purple for accountant, blue for manager).
    const personBadge = (investorId, label, color) => {
      if (!investorId) return '';
      const investor = this.allInvestors.find((i) => i.investorId === investorId);
      if (!investor) return '';
      return `<div class="d-flex align-items-center gap-1">
        ${renderInvestorAvatarCircle(investor, 20)}
        <span class="small text-truncate prop-copy-val" data-copy="${this.escapeHtml(investor.name)}" title="Click to copy ${label} name" onclick="event.stopPropagation();copyToClipboardInline(this)" style="max-width: 90px; color: ${color}; font-weight: 600;">${this.escapeHtml(getInvestorShortName(investor.name))}</span>
      </div>`;
    };
    const accountantHtml = personBadge(property.accountant, 'Accountant', '#6f42c1');
    const managerHtml = personBadge(property.manager, 'Manager', '#0d6efd');
    const peopleRowHtml = (accountantHtml || managerHtml)
      ? `<div class="d-flex align-items-center gap-3 mt-1">${accountantHtml}${managerHtml}</div>`
      : '';

    // SP utility account — same click-to-copy affordance the old card used;
    // stopPropagation so copying doesn't also select the row.
    const spAccountHtml = (property.spAccountUsername || property.spAccountPassword)
      ? `<div class="small d-flex align-items-center gap-1 flex-wrap mt-1">
          <img src="https://www.spgroup.com.sg/dam/spgroup/slices/SP_Group_Logo-01.svg" alt="SP" style="height:12px;width:auto;flex-shrink:0;">
          ${property.spAccountUsername ? `<span class="font-monospace prop-copy-val" data-copy="${this.escapeHtml(property.spAccountUsername)}" title="Click to copy username" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.spAccountUsername)}</span>` : ''}
          ${property.spAccountUsername && property.spAccountPassword ? `<span class="text-muted">/</span>` : ''}
          ${property.spAccountPassword ? `<span class="font-monospace prop-copy-val" data-copy="${this.escapeHtml(property.spAccountPassword)}" title="Click to copy password" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.spAccountPassword)}</span>` : ''}
        </div>`
      : '';

    const archiveActionHtml = !isArchived
      ? `<button type="button" class="btn btn-sm btn-link text-secondary p-0 pm-row-archive-btn" title="Archive" onclick="event.stopPropagation(); propertyManager.archiveProperty('${property.propertyId}')"><i class="bi bi-archive"></i></button>`
      : `<button type="button" class="btn btn-sm btn-link text-secondary p-0 pm-row-archive-btn" title="Unarchive" onclick="event.stopPropagation(); propertyManager.unarchiveProperty('${property.propertyId}')"><i class="bi bi-arrow-counterclockwise"></i></button>`;

    return `
      <div class="pm-row${isSelected ? ' pm-row-selected' : ''}${isArchived ? ' pm-row-archived' : ''}" data-property-id="${this.escapeHtml(property.propertyId)}" onclick="propertyManager.selectProperty('${property.propertyId}')">
        ${thumbWrapHtml}
        <div class="flex-grow-1" style="min-width: 0;">
          <div class="d-flex align-items-center justify-content-between gap-1">
            <div class="d-flex align-items-center gap-1" style="min-width: 0;">
              <span class="pm-row-id fw-semibold small text-truncate prop-copy-val" data-copy="${this.escapeHtml(property.propertyId)}" title="Click to copy Property ID" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.propertyId)}</span>
              ${archivedBadge}${condoBadge}${lockBadge}
            </div>
            ${investorAvatarHtml}
          </div>
          <div class="small text-muted text-truncate prop-copy-val" data-copy="${this.escapeHtml(property.address)}, ${this.escapeHtml(property.unit)}" title="Click to copy address" onclick="event.stopPropagation();copyToClipboardInline(this)">${this.escapeHtml(property.address)}, ${this.escapeHtml(property.unit)}</div>
          <div class="d-flex align-items-center justify-content-between mt-1">
            <span class="small text-success fw-semibold prop-copy-val" data-copy="${property.rent || 0}" title="Click to copy rent" onclick="event.stopPropagation();copyToClipboardInline(this)">$${(property.rent || 0).toLocaleString()}</span>
            <span class="small text-muted prop-copy-val" data-copy="${property.maxPax || 1}" title="Click to copy max occupancy" onclick="event.stopPropagation();copyToClipboardInline(this)"><i class="bi bi-people me-1"></i>${property.maxPax || 1}</span>
            <span class="small text-muted prop-copy-val" data-copy="${property.rentPaymentDate || 1}" title="Click to copy payment date" onclick="event.stopPropagation();copyToClipboardInline(this)"><i class="bi bi-calendar-event me-1"></i>Day ${property.rentPaymentDate || 1}</span>
          </div>
          ${moveDatesHtml}
          ${spAccountHtml}
          ${roomBadgesHtml}
          ${peopleRowHtml}
        </div>
        <div class="pm-row-actions flex-shrink-0">${archiveActionHtml}</div>
      </div>`;
  }

  addPropertyRowStyles() {
    // Add hover/selection styles if not already added
    if (!document.getElementById("property-management-row-styles")) {
      const style = document.createElement("style");
      style.id = "property-management-row-styles";
      style.textContent = `
        .pm-row {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 6px;
          border: 1px solid transparent;
          background: white;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s;
        }
        .pm-row-thumb-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .pm-row-thumb {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          flex-shrink: 0;
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        .pm-list-fade-in {
          animation: pm-list-fadein 0.25s ease;
        }
        @keyframes pm-list-fadein {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .pm-row:hover {
          background: #eef1ff;
        }
        /* Selected state: left accent bar + tinted background + soft ring glow,
           all tied directly to the .pm-row-selected class — no timers, so it
           stays visible for exactly as long as the row is actually selected. */
        .pm-row-selected {
          background: #eef1ff;
          border-color: #667eea;
          box-shadow: 0 0 0 1px #667eea, 0 4px 14px rgba(102, 126, 234, 0.22);
        }
        .pm-row-selected::before {
          content: "";
          position: absolute;
          left: 0;
          top: 6px;
          bottom: 6px;
          width: 4px;
          border-radius: 4px;
          background: #667eea;
        }
        .pm-row-selected .pm-row-id {
          color: #4338ca;
        }
        .pm-row-check-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #667eea;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          line-height: 1;
          box-shadow: 0 0 0 2px #fff, 0 2px 5px rgba(0, 0, 0, 0.2);
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none;
        }
        .pm-row-selected .pm-row-check-badge {
          opacity: 1;
          transform: scale(1);
        }
        .pm-row-archived {
          opacity: 0.65;
        }
        .pm-row-archive-btn {
          opacity: 0;
          transition: opacity 0.15s;
          font-size: 0.9rem;
        }
        .pm-row:hover .pm-row-archive-btn,
        .pm-row-archive-btn:focus {
          opacity: 1;
        }
        /* Form toggle — condo checked state (detail panel's Property Type picker) */
        #propertyTypeCondo:checked + label {
          background: linear-gradient(135deg,#f6d365,#fda085) !important;
          color: #7c2d12 !important;
          border-color: #fda085 !important;
        }
        /* Click-to-copy value fields (still used inside the detail form) */
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
        /* Badges (move-in/move-out) set their own background/color inline,
           which already wins over the rules above — this just swaps the
           hover cue for a brightness dip instead of stacking another
           background on top of the badge's own color. */
        .prop-copy-val.badge:hover {
          filter: brightness(0.92);
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Shimmering placeholder rows shown while loadProperties() is fetching.
  // Reuses .pm-row/.pm-row-thumb's own box (see addPropertyRowStyles() and
  // the matching duplicate rules in dashboard.html's inline <style>) so
  // swapping to real rows once data arrives doesn't jump the scroll area —
  // only the shimmer bars are replaced by actual content.
  showLoadingSkeleton(count = 6) {
    const container = document.getElementById("propertiesContainer");
    if (!container) return;

    const row = `
      <div class="pm-row pm-row-skeleton">
        <div class="pm-row-thumb pm-skeleton"></div>
        <div class="flex-grow-1" style="min-width: 0;">
          <div class="pm-skeleton-bar" style="width: 55%; height: 13px; margin-bottom: 8px;"></div>
          <div class="pm-skeleton-bar" style="width: 85%; height: 11px; margin-bottom: 8px;"></div>
          <div class="pm-skeleton-bar" style="width: 35%; height: 11px;"></div>
        </div>
      </div>`;

    container.innerHTML = row.repeat(count);
    this.addPropertyRowStyles();
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
    this._searchTerm = searchTerm || '';
    this.renderPropertiesTable();
  }

  // ─── Filter panel (investor, and later more criteria) ──────────────────────
  // this.filters is the single source of truth for the panel's state; the
  // quick-search box above is tracked separately in this._searchTerm since it
  // isn't a "filter criterion" the user picks from the panel. Both narrow the
  // same list, applied together in getVisibleProperties().

  /** Properties currently visible in the grid, after the quick search and the filter panel are both applied. */
  getVisibleProperties() {
    let list = this.properties;

    const term = this._searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (property) =>
          property.propertyId.toLowerCase().includes(term) ||
          property.address.toLowerCase().includes(term) ||
          property.unit.toLowerCase().includes(term)
      );
    }

    return applyPropertyFilters(list, this.filters, { allInvestors: this.allInvestors });
  }

  /** Empty-state copy that reflects *why* the grid is empty (no data vs. no match), or undefined for the default message. */
  buildFilteredEmptyStateMessage() {
    const term = this._searchTerm.trim();
    if (term) return `No properties match "${term}"`;
    if (getActivePropertyFilterCount(this.filters) > 0) return "No properties match the selected filters";
    return undefined;
  }

  renderInvestorFilterMenu() {
    const menu = document.getElementById("propertyInvestorFilterMenu");
    if (!menu) return;

    const investors = [...this.allInvestors].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const selected = new Set(this.filters.investorIds);

    menu.innerHTML = investors.length
      ? investors.map((investor) => `
          <label class="dropdown-item d-flex align-items-center gap-2" style="cursor:pointer;">
            <input type="checkbox" class="form-check-input property-investor-filter-checkbox m-0" value="${investor.investorId}" ${selected.has(investor.investorId) ? 'checked' : ''}>
            ${renderInvestorAvatarCircle(investor, 22)}
            <span class="small text-truncate" title="${this.escapeHtml(investor.name || '')}">${this.escapeHtml(getInvestorShortName(investor.name))}</span>
          </label>
        `).join('')
      : '<div class="text-muted small px-3 py-1">No investors found</div>';

    menu.querySelectorAll('.property-investor-filter-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', () => this.handleInvestorFilterChange());
    });
  }

  handleInvestorFilterChange() {
    const checked = Array.from(
      document.querySelectorAll('.property-investor-filter-checkbox:checked')
    ).map((checkbox) => checkbox.value);
    this.filters = { ...this.filters, investorIds: checked };
    this.onFiltersChanged();
  }

  resetPropertyFilters() {
    this.filters = createDefaultPropertyFilters();
    this.renderInvestorFilterMenu();
    this.onFiltersChanged();
  }

  onFiltersChanged() {
    savePropertyFilters(this.filters);
    this.updateFilterSummaryUI();
    this.renderPropertiesTable();
  }

  updateFilterSummaryUI() {
    const investorCount = this.filters.investorIds.length;
    const investorBadge = document.getElementById("propertyInvestorFilterCount");
    if (investorBadge) {
      investorBadge.textContent = investorCount;
      investorBadge.style.display = investorCount > 0 ? '' : 'none';
    }

    const activeCount = getActivePropertyFilterCount(this.filters);
    const summary = document.getElementById("propertyFilterSummary");
    const summaryText = document.getElementById("propertyFilterSummaryText");
    if (summary && summaryText) {
      summary.style.display = activeCount > 0 ? '' : 'none';
      summaryText.textContent = `${activeCount} filter${activeCount === 1 ? '' : 's'} applied`;
    }
  }

  showAddPropertyPanel() {
    this.selectedPropertyId = null;
    this.showPropertyPanel();
    this.enterMobileDetailView();
  }

  // Populates the always-mounted right-hand form with `property`'s data (or
  // resets it to add-mode when called with no argument), and updates the
  // list-panel selection/highlight to match. This used to open a Bootstrap
  // modal; now the form panel is always in the DOM, so this just repopulates
  // it in place.
  showPropertyPanel(property = null) {
    // Store reference to property being edited
    this.editingProperty = property;
    this.selectedPropertyId = property?.propertyId || null;
    if (property) this._lastSelectedPropertyId = property.propertyId;

    // Update panel title and button text
    const isEdit = !!property;
    document.getElementById("propertyModalTitle").textContent = isEdit
      ? "Edit Property"
      : "Add New Property";
    const submitBtn = document.getElementById("propertySubmitBtn");
    submitBtn.disabled = false;
    submitBtn.innerHTML = isEdit
      ? '<i class="bi bi-pencil-square me-1"></i><span id="propertySubmitText">Update Property</span>'
      : '<i class="bi bi-plus-circle me-1"></i><span id="propertySubmitText">Add Property</span>';

    // Reset and populate form
    const form = document.getElementById("propertyForm");
    if (form) {
      form.reset();
      // Rebuild the room picker back to its default set - otherwise "+ Add"
      // rows from a previously edited property would linger across opens.
      this.populateRoomTypesDropdown();
      // form.reset() unchecks the room checkboxes but doesn't touch our custom
      // dropdown label/price rows, so re-sync them before edit-mode repopulates.
      this.updatePropertyRoomsSelection();

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

        // Handle Manager field
        this.populateManagerDropdown();
        if (property.manager) {
          document.getElementById("manager").value = property.manager;
        } else {
          document.getElementById("manager").value = "";
        }
        this.updateManagerAvatarPreview(property.manager || "");

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
          // Make sure rooms beyond the default set (e.g. a 3rd Common) have
          // a checkbox to check, so they aren't silently dropped on save.
          this.ensureRoomOptionsExist(property.rooms);

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

          // Update the selection display, then fill in the saved price ranges
          this.updatePropertyRoomsSelection();
          this.populateRoomPricesInputs(property.roomPrices || []);
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

        // Reset Manager field for add mode
        this.populateManagerDropdown();
        document.getElementById("manager").value = "";
        this.updateManagerAvatarPreview("");

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

    // Reflect the (now-populated, or cleared for add-mode) group URLs as
    // clickable badges next to their inputs.
    this.updateFbGroupBadges();

    // Highlight the matching row in the list panel and reset the detail
    // panel's scroll position so switching properties starts at the top.
    this.highlightSelectedRow();
    const detailBody = document.querySelector('.pm-detail-body');
    if (detailBody) detailBody.scrollTop = 0;

    // Set up the image clipboard-paste listener. The form is always mounted
    // now (no modal to gate on), and the listener is idempotent (guarded by
    // its own data-paste-listener-added flag), so it's safe to call every time.
    this.setupPropertyImageClipboardListener();
  }

  // Renders a small clickable badge next to the Tenant/Admin group inputs,
  // reflecting whatever URL is currently in each field — same badge styling
  // the old property cards used (tenant: blue/green per getGroupLinkMeta
  // depending on Facebook vs WhatsApp; admin: black). Called after the form
  // is populated (add/edit) and live on every keystroke in those fields.
  updateFbGroupBadges() {
    const tenantInput = document.getElementById('tenantFacebookGroup');
    const tenantBadge = document.getElementById('tenantFacebookGroupBadge');
    if (tenantBadge) {
      const url = tenantInput?.value?.trim();
      if (url) {
        const meta = getGroupLinkMeta(url);
        tenantBadge.innerHTML = `<a href="${this.escapeHtml(url)}" onclick="event.preventDefault(); openTenantFbGroup(this);" data-fb-url="${this.escapeHtml(url)}" class="badge text-decoration-none" style="background-color:${meta.color};color:#fff;" title="Tenant ${meta.brand} Group"><i class="bi ${meta.icon} me-1"></i>Tenant Group</a>`;
      } else {
        tenantBadge.innerHTML = '';
      }
    }

    const adminInput = document.getElementById('adminFacebookGroup');
    const adminBadge = document.getElementById('adminFacebookGroupBadge');
    if (adminBadge) {
      const url = adminInput?.value?.trim();
      adminBadge.innerHTML = url
        ? `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="badge bg-dark text-decoration-none" title="Admin Facebook Group"><i class="bi bi-facebook me-1"></i>Admin Group</a>`
        : '';
    }
  }

  // Applies/removes the .pm-row-selected highlight across the rendered list
  // rows to match this.selectedPropertyId, without a full list re-render.
  highlightSelectedRow() {
    document.querySelectorAll('.pm-row').forEach((row) => {
      row.classList.toggle('pm-row-selected', row.dataset.propertyId === this.selectedPropertyId);
    });
  }

  // Swaps the mobile stacked layout (see the #pmLayout media query in
  // dashboard.html) from list-view to detail-view. No-op visually at desktop
  // widths, where both columns are always shown side by side.
  enterMobileDetailView() {
    document.getElementById('pmLayout')?.classList.add('pm-mobile-detail-active');
  }

  exitMobileDetailView() {
    document.getElementById('pmLayout')?.classList.remove('pm-mobile-detail-active');
  }

  // Cancel button handler (header X + footer Cancel). Discards any
  // in-progress edit and reloads the panel back to whatever was selected
  // before — mirrors the old modal's behavior where clicking outside it
  // silently discarded edits. When editing an existing property, that's the
  // same property (reverting unsaved field changes); when in add-mode
  // (selectedPropertyId is already null there), it falls back to the last
  // real property that was open before "Add Property" was clicked.
  handlePanelCancel() {
    const targetId = this.selectedPropertyId || this._lastSelectedPropertyId;
    const targetProperty = targetId
      ? this.properties.find((p) => p.propertyId === targetId)
      : null;
    this.editingProperty = null;
    this.originalPropertyImage = '';
    this.showPropertyPanel(targetProperty || null);
    this.exitMobileDetailView();
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
        roomPrices: this.getRoomPricesFromInputs(),
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
        manager: formData.get("manager")?.trim() || "",
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

      // Show loading state. The submit button now lives in a footer that's a
      // sibling of <form id="propertyForm"> (linked via form="propertyForm"),
      // not a descendant of it, so it can't be found via event.target.querySelector.
      const submitBtn = document.getElementById("propertySubmitBtn");
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

      // Stay open on the saved property: updateProperty()/addProperty() already
      // awaited loadProperties() internally, so this.properties is fresh —
      // re-select the saved id and repopulate the form with the server-confirmed
      // copy, keeping its row highlighted in the list panel.
      this.selectedPropertyId = propertyData.propertyId;
      const savedProperty = this.properties.find((p) => p.propertyId === propertyData.propertyId);
      if (savedProperty) {
        this.showPropertyPanel(savedProperty); // also re-enables submitBtn
      } else {
        this.highlightSelectedRow();
        submitBtn.disabled = false;
      }
    } catch (error) {
      console.error("Error in handlePropertySubmit:", error);
      const isEdit = event.target.getAttribute("data-mode") === "edit";
      alert(
        `An error occurred while ${isEdit ? "updating" : "adding"
        } the property. Please try again.`
      );

      // Reset button state
      const submitBtn = document.getElementById("propertySubmitBtn");
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

    // Load it into the detail panel
    this.showPropertyPanel(property);
  }

  // Row-click entry point from the list panel: loads the property into the
  // detail panel (same lookup as editProperty) and, on mobile, switches the
  // stacked layout from list-view to detail-view.
  async selectProperty(propertyId) {
    await this.editProperty(propertyId);
    this.enterMobileDetailView();
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

  async copyPropertiesAsText(selectedIds = null) {
    const btn = document.getElementById('copyPropertiesTextBtn');
    const origHtml = btn?.innerHTML;
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Copying...'; }

      const active = this.properties
        .filter(p => !p.isArchived)
        .filter(p => !selectedIds || selectedIds.has(p.propertyId))
        .sort((a, b) => (parseInt(a.propertyId) || 0) - (parseInt(b.propertyId) || 0));

      if (active.length === 0) {
        showToast('No properties selected to export', 'warning');
        return;
      }

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

      const headers = ['#', 'Address', 'Unit', 'Rent (S$)', 'Lease', 'Move-in', 'Move-out', 'Accountant', 'Manager'];
      const rows = active.map((p, i) => {
        const acc = this.allInvestors.find(inv => inv.investorId === p.accountant);
        const mgr = this.allInvestors.find(inv => inv.investorId === p.manager);
        return [
          i + 1,
          p.address || '',
          p.unit || '',
          p.rent || '',
          calcLease(p.moveInDate, p.moveOutDate),
          fmtDate(p.moveInDate),
          fmtDate(p.moveOutDate),
          acc ? acc.name : '',
          mgr ? mgr.name : '',
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

  async exportPropertiesAsImage(selectedIds = null) {
    const btn = document.getElementById('exportPropertiesBtn');
    const origHtml = btn?.innerHTML;
    try {
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i>Exporting...'; }
      const active = this.properties
        .filter(p => !p.isArchived)
        .filter(p => !selectedIds || selectedIds.has(p.propertyId))
        .sort((a, b) => (parseInt(a.propertyId) || 0) - (parseInt(b.propertyId) || 0));

      if (active.length === 0) {
        showToast('No properties selected to export', 'warning');
        return;
      }

      // Pre-fetch avatars as base64 so they can be embedded in the SVG
      // (keyed by investor ID — shared cache covers both accountant and manager roles)
      const avatarMap = {};
      const uniqueInvestorIds = [...new Set(active.flatMap(p => [p.accountant, p.manager]).filter(Boolean))];
      await Promise.all(uniqueInvestorIds.map(async id => {
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

  /**
   * Mobile-first portrait card list (one property per compact card, stacked vertically) —
   * scrolls naturally and reads at full size on a phone screen, unlike a wide desktop table.
   */
  _buildPropertiesTableSVG(rows, activeCount, avatarMap = {}) {
    const SVG_W = 420;
    const PAD = 12;
    const cardW = SVG_W - 2 * PAD;
    const CARD_PAD = 12;
    const CARD_GAP = 7;
    const HEADER_H = 62;
    const FOOTER_H = 30;
    const AVATAR_R = 12;

    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const trunc = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const fmtDate = d => d ? new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
    const calcLease = (moveIn, moveOut) => {
      if (!moveIn || !moveOut) return '—';
      const ms = new Date(moveOut) - new Date(moveIn);
      if (ms <= 0) return '—';
      const months = Math.round(ms / (1000 * 60 * 60 * 24 * 30.44));
      if (months < 12) return `${months}mo`;
      const yrs = Math.round(months / 12 * 2) / 2;
      return yrs === 1 ? '1y' : `${yrs}y`;
    };

    const parts = [];
    const avatarClipDefs = [];

    // Header
    parts.push(`<rect x="0" y="0" width="${SVG_W}" height="${HEADER_H}" fill="url(#pmTitleGrad)"/>`);
    parts.push(`<text x="${PAD}" y="26" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="white">Property Portfolio</text>`);
    const dateStr = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' });
    parts.push(`<text x="${PAD}" y="45" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.85)">${esc(dateStr)} · ${activeCount} propert${activeCount === 1 ? 'y' : 'ies'}</text>`);

    // Cards — height is computed per-card so there's no wasted space
    let cursorY = HEADER_H + 10;
    const halfW = (cardW - 2 * CARD_PAD - 10) / 2;

    rows.forEach((prop, idx) => {
      const isArchived = !!prop.isArchived;
      const acc = this.allInvestors.find(i => i.investorId === prop.accountant);
      const mgr = this.allInvestors.find(i => i.investorId === prop.manager);

      const cardX = PAD;
      const cardTop = cursorY;

      const addrBaselineY = cardTop + CARD_PAD + 12;
      const subBaselineY = addrBaselineY + 16;
      const infoBaselineY = subBaselineY + 18;
      const peopleTopY = infoBaselineY + 11;
      const peopleCenterY = peopleTopY + AVATAR_R;
      const peopleTextBaselineY = peopleCenterY + 4;
      const cardBottom = peopleTopY + AVATAR_R * 2 + CARD_PAD;
      const cardH = cardBottom - cardTop;

      const bg = isArchived ? '#eef0f2' : (idx % 2 === 0 ? '#ffffff' : '#f8faff');
      const textFill = isArchived ? '#9aa1ab' : '#1a2233';
      const mutedFill = isArchived ? '#b7bdc6' : '#6b7280';

      parts.push(`<rect x="${cardX}" y="${cardTop}" width="${cardW}" height="${cardH}" rx="10" fill="${bg}" stroke="#e5e7eb" stroke-width="1"/>`);

      // Index badge
      const badgeR = 10;
      const badgeCX = cardX + CARD_PAD + badgeR;
      const badgeCY = addrBaselineY - 7;
      parts.push(`<circle cx="${badgeCX}" cy="${badgeCY}" r="${badgeR}" fill="${isArchived ? '#c3c9d1' : '#667eea'}"/>`);
      parts.push(`<text x="${badgeCX}" y="${badgeCY + 4}" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="white" text-anchor="middle">${idx + 1}</text>`);

      // Address (bold, larger)
      const addrX = badgeCX + badgeR + 8;
      parts.push(`<text x="${addrX}" y="${addrBaselineY}" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="${textFill}">${esc(trunc(prop.address || prop.propertyId, 32))}</text>`);
      if (isArchived) {
        parts.push(`<text x="${cardX + cardW - CARD_PAD}" y="${addrBaselineY}" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#9aa1ab" text-anchor="end">ARCHIVED</text>`);
      }

      // Unit / ID line
      const subText = [prop.unit, `ID ${prop.propertyId}`].filter(Boolean).join('   ·   ');
      parts.push(`<text x="${addrX}" y="${subBaselineY}" font-family="Arial,sans-serif" font-size="11" fill="${mutedFill}">${esc(subText)}</text>`);

      // Rent · Lease · Move-in → Move-out
      const infoText = `${prop.rent ? 'S$' + prop.rent.toLocaleString() : '—'}   ·   ${calcLease(prop.moveInDate, prop.moveOutDate)}   ·   ${fmtDate(prop.moveInDate)} → ${fmtDate(prop.moveOutDate)}`;
      parts.push(`<text x="${cardX + CARD_PAD}" y="${infoBaselineY}" font-family="Arial,sans-serif" font-size="12" font-weight="600" fill="${textFill}">${esc(infoText)}</text>`);

      // People row — Accountant (left) / Manager (right)
      const drawPerson = (investor, roleId, colX, gradId) => {
        const cx = colX + AVATAR_R;
        if (!investor) {
          parts.push(`<circle cx="${cx}" cy="${peopleCenterY}" r="${AVATAR_R}" fill="#e9ecef"/>`);
          parts.push(`<text x="${cx + AVATAR_R + 5}" y="${peopleTextBaselineY}" font-family="Arial,sans-serif" font-size="11" fill="${mutedFill}">—</text>`);
          return;
        }
        const dataUrl = avatarMap[investor.investorId];
        if (dataUrl) {
          const clipId = `${roleId}Clip_${idx}`;
          avatarClipDefs.push(`<clipPath id="${clipId}"><circle cx="${cx}" cy="${peopleCenterY}" r="${AVATAR_R}"/></clipPath>`);
          parts.push(`<circle cx="${cx}" cy="${peopleCenterY}" r="${AVATAR_R}" fill="#e9ecef"/>`);
          parts.push(`<image href="${dataUrl}" x="${cx - AVATAR_R}" y="${peopleCenterY - AVATAR_R}" width="${AVATAR_R * 2}" height="${AVATAR_R * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`);
        } else {
          const initials = investor.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
          parts.push(`<circle cx="${cx}" cy="${peopleCenterY}" r="${AVATAR_R}" fill="url(#${gradId})"/>`);
          parts.push(`<text x="${cx}" y="${peopleCenterY + 4}" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="white" text-anchor="middle">${esc(initials)}</text>`);
        }
        parts.push(`<text x="${cx + AVATAR_R + 5}" y="${peopleTextBaselineY}" font-family="Arial,sans-serif" font-size="11" fill="${textFill}">${esc(trunc(investor.name, 16))}</text>`);
      };

      const leftColX = cardX + CARD_PAD;
      const rightColX = leftColX + halfW + 10;
      drawPerson(acc, 'acc', leftColX, 'pmAccGrad');
      drawPerson(mgr, 'mgr', rightColX, 'pmMgrGrad');

      cursorY = cardBottom + CARD_GAP;
    });

    const footerY = cursorY + FOOTER_H / 2;
    const archivedCount = rows.length - activeCount;
    const footerText = `${activeCount} active propert${activeCount === 1 ? 'y' : 'ies'}${archivedCount > 0 ? ` · ${archivedCount} archived` : ''}`;
    parts.push(`<text x="${SVG_W / 2}" y="${footerY}" font-family="Arial,sans-serif" font-size="11" fill="#6b7280" text-anchor="middle">${esc(footerText)}</text>`);

    const SVG_H = cursorY + FOOTER_H;

    const defs = `<defs><linearGradient id="pmTitleGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#667eea"/><stop offset="100%" stop-color="#764ba2"/></linearGradient><linearGradient id="pmAccGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6f42c1"/><stop offset="100%" stop-color="#9d4edd"/></linearGradient><linearGradient id="pmMgrGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0d6efd"/><stop offset="100%" stop-color="#6ea8fe"/></linearGradient>${avatarClipDefs.join('')}</defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}"><rect width="${SVG_W}" height="${SVG_H}" fill="#f4f5f7"/>${defs}${parts.join('')}</svg>`;
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

  /**
   * Open a checklist modal so the user can pick which active properties to include
   * in the next export, then run the requested export (image or Excel/text) on confirm.
   * Selection persists across openings within the session — defaults to "everything".
   */
  openExportSelectionModal(mode) {
    const active = this.properties
      .filter(p => !p.isArchived)
      .sort((a, b) => (parseInt(a.propertyId) || 0) - (parseInt(b.propertyId) || 0));

    if (active.length === 0) {
      showToast('No properties to export', 'warning');
      return;
    }

    const activeIds = new Set(active.map(p => p.propertyId));
    if (!this._exportSelectedIds) {
      // First time opening — default to everything selected
      this._exportSelectedIds = new Set(activeIds);
    } else {
      // Drop stale ids (archived/deleted since the last time this was opened)
      this._exportSelectedIds = new Set(
        [...this._exportSelectedIds].filter(id => activeIds.has(id))
      );
    }

    document.getElementById('pmExportSelectModal')?.remove();

    const modeConfig = mode === 'image'
      ? { label: 'Export as Image', icon: 'bi-image', btnClass: 'btn-success' }
      : { label: 'Copy as Excel', icon: 'bi-table', btnClass: 'btn-primary' };

    const modalHtml = `
      <div class="modal fade" id="pmExportSelectModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content" style="border-radius:16px;overflow:hidden;">
            <div class="modal-header border-0" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);">
              <div class="d-flex align-items-center gap-2">
                <div class="rounded-circle bg-white d-flex align-items-center justify-content-center" style="width:32px;height:32px;flex-shrink:0;">
                  <i class="bi bi-check2-square text-primary" style="font-size:1rem;"></i>
                </div>
                <h6 class="modal-title text-white fw-bold mb-0">Select Properties to Export</h6>
              </div>
              <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-0">
              <div class="p-3 border-bottom bg-light">
                <input type="text" id="pmExportSearchInput" class="form-control form-control-sm mb-2" placeholder="Search by address or unit...">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="pmExportSelectAllBtn">Select All</button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="pmExportDeselectAllBtn">Deselect All</button>
                  </div>
                  <span class="small fw-semibold text-muted" id="pmExportSelectedCount"></span>
                </div>
              </div>
              <div id="pmExportPropertyList" style="max-height:360px;overflow-y:auto;"></div>
            </div>
            <div class="modal-footer border-0" style="background:#f8f9fa;">
              <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn ${modeConfig.btnClass} btn-sm" id="pmExportConfirmBtn">
                <i class="bi ${modeConfig.icon} me-1"></i>${modeConfig.label}
              </button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    this._renderExportSelectionList(active);
    this._updateExportSelectionCount(active.length);

    document.getElementById('pmExportSearchInput').addEventListener('input', (e) => {
      this._renderExportSelectionList(active, e.target.value);
    });
    document.getElementById('pmExportSelectAllBtn').addEventListener('click', () => {
      active.forEach(p => this._exportSelectedIds.add(p.propertyId));
      this._renderExportSelectionList(active, document.getElementById('pmExportSearchInput').value);
      this._updateExportSelectionCount(active.length);
    });
    document.getElementById('pmExportDeselectAllBtn').addEventListener('click', () => {
      this._exportSelectedIds.clear();
      this._renderExportSelectionList(active, document.getElementById('pmExportSearchInput').value);
      this._updateExportSelectionCount(active.length);
    });

    const modalEl = document.getElementById('pmExportSelectModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: true, keyboard: true });
    modalEl.addEventListener('hidden.bs.modal', () => modalEl.remove(), { once: true });

    document.getElementById('pmExportConfirmBtn').addEventListener('click', () => {
      const selectedIds = new Set(this._exportSelectedIds);
      modal.hide();
      if (mode === 'image') this.exportPropertiesAsImage(selectedIds);
      else this.copyPropertiesAsText(selectedIds);
    });

    modal.show();
  }

  _renderExportSelectionList(active, searchTerm = '') {
    const container = document.getElementById('pmExportPropertyList');
    if (!container) return;

    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? active.filter(p =>
          (p.address || '').toLowerCase().includes(term) ||
          (p.unit || '').toLowerCase().includes(term) ||
          String(p.propertyId).toLowerCase().includes(term))
      : active;

    container.innerHTML = filtered.length
      ? filtered.map(p => {
          const checked = this._exportSelectedIds.has(p.propertyId);
          return `
            <label class="d-flex align-items-center gap-2 px-3 py-2 border-bottom mb-0" style="cursor:pointer;">
              <input type="checkbox" class="form-check-input pm-export-checkbox" data-property-id="${this.escapeHtml(p.propertyId)}" ${checked ? 'checked' : ''} style="flex-shrink:0;">
              <div class="flex-grow-1" style="min-width:0;">
                <div class="small fw-semibold text-truncate">${this.escapeHtml(p.address || p.propertyId)}</div>
                <div class="text-muted text-truncate" style="font-size:0.75rem;">${[p.unit, p.propertyId].filter(Boolean).map(v => this.escapeHtml(v)).join(' · ')}</div>
              </div>
              ${this._renderInvestorAvatarStack(p.propertyId)}
            </label>`;
        }).join('')
      : `<div class="text-center text-muted py-4"><i class="bi bi-search me-1"></i>No matching properties</div>`;

    container.querySelectorAll('.pm-export-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.propertyId;
        if (e.target.checked) this._exportSelectedIds.add(id);
        else this._exportSelectedIds.delete(id);
        this._updateExportSelectionCount(active.length);
      });
    });
  }

  /** Overlapping avatar stack of the investors tied to a property, for quick visual ID in a list row. */
  _renderInvestorAvatarStack(propertyId, max = 4) {
    return renderInvestorAvatarStack(this.allInvestors, propertyId, { max });
  }

  _updateExportSelectionCount(totalCount) {
    const countEl = document.getElementById('pmExportSelectedCount');
    if (countEl) countEl.textContent = `${this._exportSelectedIds.size} of ${totalCount} selected`;
    const confirmBtn = document.getElementById('pmExportConfirmBtn');
    if (confirmBtn) confirmBtn.disabled = this._exportSelectedIds.size === 0;
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
    // Keep the original text in place — just drop a temporary checkmark
    // next to it, rather than replacing the value while confirming.
    const existingIcon = el.querySelector(':scope > .copy-check-icon');
    if (existingIcon) {
      clearTimeout(existingIcon._removeTimeout);
    } else {
      const icon = document.createElement('i');
      icon.className = 'bi bi-check-circle-fill copy-check-icon';
      icon.style.color = '#198754';
      icon.style.marginLeft = '4px';
      el.appendChild(icon);
    }
    const iconEl = el.querySelector(':scope > .copy-check-icon');
    iconEl._removeTimeout = setTimeout(() => {
      iconEl.remove();
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
