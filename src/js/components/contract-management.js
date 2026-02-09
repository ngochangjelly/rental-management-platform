/**
 * Contract Management Component
 * Handles contract creation with editor-like interface
 */
import i18next from "i18next";

class ContractManagementComponent {
  constructor() {
    this.tenants = [];
    this.investors = [];
    this.properties = [];
    this.selectedTenantA = null;
    this.selectedTenantB = []; // Changed to array to support multiple tenants
    this.selectedPropertyId = null; // Track selected property for filtering
    this.additionalClauses = [];
    this.signatures = {
      tenantA: null,
      tenantB: null,
    };
    this.contractData = {
      address: "",
      room: "",
      agreementDate: new Date().toISOString().split("T")[0],
      leasePeriod: "",
      moveInDate: "",
      moveOutDate: "",
      monthlyRental: "",
      securityDeposit: "",
      partialDepositReceived: false,
      partialDepositAmount: "",
      electricityBudget: "400",
      cleaningFee: "20",
      paymentMethod: "BANK_TRANSFER",
      fullPaymentReceived: false,
      pestControlClause: false,
    };

    // Initialize template service
    this.templateService = new ContractTemplateService();

    // Track templates pending deletion confirmation
    this.pendingDeletes = new Set();

    // Flag to prevent auto-fill of dates when loading templates
    this.isLoadingTemplate = false;

    this.init();
  }

  init() {
    this.setupEventListeners();
    // Don't load tenants upfront - load them when property is selected
    this.loadInvestors();
    this.loadProperties();
  }

  setupEventListeners() {
    // Event listeners will be added when modal is shown
  }

  async loadTenants() {
    try {
      // Only load tenants for the selected property
      let url = API_CONFIG.ENDPOINTS.TENANTS + "?limit=100";
      if (this.selectedPropertyId) {
        url += `&property=${this.selectedPropertyId}`;
      }

      const response = await API.get(url);
      const result = await response.json();

      if (result.success && result.tenants) {
        this.tenants = result.tenants;
      } else if (result.tenants && Array.isArray(result.tenants)) {
        this.tenants = result.tenants;
      } else if (Array.isArray(result)) {
        this.tenants = result;
      } else {
        console.error(
          "Failed to load tenants:",
          result.error || "Unknown format",
        );
        this.tenants = [];
      }

      console.log(
        "✅ Loaded",
        this.tenants.length,
        `tenants for contract creation${this.selectedPropertyId ? ` (property: ${this.selectedPropertyId})` : ""}`,
      );

      // Populate dropdowns when data is loaded
      this.populateDropdowns();
    } catch (error) {
      console.error("Error loading tenants:", error);
      this.tenants = [];
    }
  }

  async loadInvestors() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
      const result = await response.json();

      if (result.success && result.data) {
        this.investors = result.data;
      } else {
        console.error(
          "Failed to load investors:",
          result.message || "Unknown format",
        );
        this.investors = [];
      }

      console.log(
        "✅ Loaded",
        this.investors.length,
        "investors for contract creation",
      );

      // Populate dropdowns when data is loaded
      this.populateDropdowns();
    } catch (error) {
      console.error("Error loading investors:", error);
      this.investors = [];
    }
  }

  populateDropdowns() {
    // Only populate if we have the dropdown elements (meaning the modal/form is visible)
    const tenantASelect = document.getElementById("contractTenantA");
    if (tenantASelect) {
      this.populateTenantsDropdown();
    }
  }

  async loadProperties() {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTIES + "?limit=100",
      );
      const result = await response.json();

      if (result.success && result.properties) {
        this.properties = result.properties;
      } else if (result.properties && Array.isArray(result.properties)) {
        this.properties = result.properties;
      } else if (Array.isArray(result)) {
        this.properties = result;
      } else {
        console.error(
          "Failed to load properties:",
          result.error || "Unknown format",
        );
        this.properties = [];
      }

      console.log(
        "✅ Loaded",
        this.properties.length,
        "properties for contract creation",
      );
    } catch (error) {
      console.error("Error loading properties:", error);
      this.properties = [];
    }
  }

  // Helper function to get property address by property ID
  getPropertyAddress(propertyId) {
    if (!this.properties || !propertyId) return propertyId;

    const property = this.properties.find(
      (prop) =>
        prop.propertyId === propertyId ||
        prop.id === propertyId ||
        prop._id === propertyId,
    );

    if (property) {
      return (
        property.address || property.location || property.name || propertyId
      );
    }

    return propertyId; // Fallback to ID if property not found
  }

  // Helper function for fuzzy search
  fuzzyMatch(searchText, targetText) {
    if (!searchText) return true;
    if (!targetText) return false;

    const search = searchText.toLowerCase();
    const target = targetText.toLowerCase();

    // Direct substring match (highest priority)
    if (target.includes(search)) return true;

    // Fuzzy character-by-character match
    let searchIndex = 0;
    for (let i = 0; i < target.length && searchIndex < search.length; i++) {
      if (target[i] === search[searchIndex]) {
        searchIndex++;
      }
    }
    return searchIndex === search.length;
  }

  // Helper function to check if tenant belongs to selected property
  tenantBelongsToProperty(person, propertyId) {
    if (!propertyId) return true; // No filter, show all
    if (!person.properties || !Array.isArray(person.properties)) return false;

    // Convert propertyId to string for comparison (handles ObjectId and string IDs)
    const targetId = String(propertyId);

    return person.properties.some((prop) => {
      let propId;
      if (typeof prop === "object") {
        propId = prop.propertyId || prop._id || prop.id;
      } else {
        propId = prop;
      }

      // Convert to string and compare
      const propIdStr = String(propId);

      // Log for debugging
      console.log(
        `🔍 Comparing property IDs: tenant property "${propIdStr}" vs selected "${targetId}"`,
      );

      return propIdStr === targetId;
    });
  }

  populateTenantsDropdown() {
    console.log(
      "📋 Populating tenant dropdowns with",
      this.tenants.length,
      "tenants and",
      this.investors.length,
      "investors",
      this.selectedPropertyId
        ? `(filtered by property: ${this.selectedPropertyId})`
        : "(no property filter)",
    );

    const tenantASelect = document.getElementById("contractTenantA");
    const tenantBSelect = document.getElementById("contractTenantB");

    console.log("🔧 tenantASelect found:", !!tenantASelect, tenantASelect);
    console.log("🔧 tenantBSelect found:", !!tenantBSelect, tenantBSelect);

    if (!tenantASelect || !tenantBSelect) {
      console.error("❌ Tenant select elements not found");
      console.error("❌ tenantASelect:", tenantASelect);
      console.error("❌ tenantBSelect:", tenantBSelect);
      return;
    }

    // If no property selected yet, show message to select property first
    if (!this.selectedPropertyId) {
      const selectPropertyMessage = i18next.t(
        "createContract.selectPropertyFirst",
        "Please select a property first",
      );
      tenantASelect.innerHTML = `<option value="">${i18next.t("createContract.tenantAMain", "Tenant A (Main Tenant)")}</option>`;
      tenantASelect.innerHTML += `<option value="" disabled>${selectPropertyMessage}</option>`;
      tenantBSelect.innerHTML = `<option value="" disabled>${selectPropertyMessage}</option>`;
      // Also clear the checkbox dropdown
      this.populateTenantBCheckboxDropdown([], []);
      return;
    }

    // Store all tenant/investor data for fuzzy search
    this._allTenantOptions = [];
    this._allInvestorOptions = [];

    // Tenants are already filtered by property from the API
    const filteredTenants = this.tenants;

    // Filter investors by selected property (client-side since API doesn't support it)
    const filteredInvestors = this.investors.filter((investor) => {
      const belongs = this.tenantBelongsToProperty(
        investor,
        this.selectedPropertyId,
      );
      return belongs;
    });

    console.log(
      `📋 Showing ${filteredTenants.length} tenants and ${filteredInvestors.length} investors`,
    );

    // Clear existing options
    tenantASelect.innerHTML = `<option value="">${i18next.t("createContract.tenantAMain", "Tenant A (Main Tenant)")}</option>`;
    tenantBSelect.innerHTML = ""; // No default option for multi-select

    // Add "Add New Tenant" options
    tenantASelect.innerHTML += `<option value="ADD_NEW_TENANT" style="color: #0d6efd; font-weight: 500;"><i class="bi bi-person-plus me-1"></i>${i18next.t("createContract.addNewTenant", "+ Add New Tenant")}</option>`;
    tenantBSelect.innerHTML += `<option value="ADD_NEW_TENANT" style="color: #0d6efd; font-weight: 500;"><i class="bi bi-person-plus me-1"></i>${i18next.t("createContract.addNewTenant", "+ Add New Tenant")}</option>`;

    // Add "Enter Custom Text" option
    tenantASelect.innerHTML += `<option value="CUSTOM_TEXT" style="color: #198754; font-weight: 500;">✏️ ${i18next.t("createContract.enterCustomText", "Enter Custom Text")}</option>`;
    tenantBSelect.innerHTML += `<option value="CUSTOM_TEXT" style="color: #198754; font-weight: 500;">✏️ ${i18next.t("createContract.enterCustomText", "Enter Custom Text")}</option>`;

    // Populate custom checkbox dropdown for Tenant B
    this.populateTenantBCheckboxDropdown(filteredTenants, filteredInvestors);

    // Check if we have filtered tenants or investors
    if (filteredTenants.length === 0 && filteredInvestors.length === 0) {
      const message = this.selectedPropertyId
        ? i18next.t(
            "createContract.noTenantsForProperty",
            "No tenants or investors for selected property",
          )
        : i18next.t(
            "createContract.noTenantsAvailable",
            "No tenants or investors available",
          );
      console.warn(`⚠️ ${message}`);
      tenantASelect.innerHTML += `<option value="" disabled>${message}</option>`;
      tenantBSelect.innerHTML += `<option value="" disabled>${message}</option>`;
      return;
    }

    // Add section header for tenants (only if we have filtered tenants)
    if (filteredTenants.length > 0) {
      tenantASelect.innerHTML += `<optgroup label="── ${i18next.t("createContract.tenants", "Tenants")} ──">`;
      tenantBSelect.innerHTML += `<optgroup label="── ${i18next.t("createContract.tenants", "Tenants")} ──">`;

      // Populate with filtered tenant data
      filteredTenants.forEach((tenant) => {
        const fin = tenant.fin || tenant.id || "";
        const passport = tenant.passportNumber || tenant.passport || "";
        const name =
          tenant.name ||
          i18next.t("createContract.unnamedTenant", "Unnamed Tenant");

        // Find the ORIGINAL index in the unfiltered array
        const originalIndex = this.tenants.findIndex((t) => t === tenant);

        // Use FIN or original index as identifier
        const identifier = fin || `tenant_${originalIndex}`;

        // Build property information for display
        let propertyInfo = "";
        if (
          tenant.properties &&
          Array.isArray(tenant.properties) &&
          tenant.properties.length > 0
        ) {
          const mainProperties = tenant.properties.filter((prop) => {
            if (typeof prop === "object") {
              return prop.isMainTenant === true;
            }
            return false;
          });

          if (mainProperties.length > 0) {
            // Show main tenant properties with full addresses
            const propertyAddresses = mainProperties
              .map((prop) => {
                const propId = prop.propertyId;
                return this.getPropertyAddress(propId);
              })
              .join(", ");
            propertyInfo = ` - ${i18next.t("createContract.mainTenantOf", "Main tenant of")}: ${propertyAddresses}`;
          } else {
            // Show first property if no main tenant status
            const firstProp = tenant.properties[0];
            const propId =
              typeof firstProp === "object" ? firstProp.propertyId : firstProp;
            if (propId) {
              const address = this.getPropertyAddress(propId);
              propertyInfo = ` - Property: ${address}`;
            }
          }
        }

        const displayText = `${name} ${
          fin ? `(FIN: ${fin})` : ""
        }${propertyInfo}`;

        // Store for fuzzy search
        this._allTenantOptions.push({
          identifier,
          displayText,
          searchText: `${name} ${fin} ${passport}`.toLowerCase(),
          type: "tenant",
          passport,
          name,
          index: originalIndex,
        });

        console.log(
          `🔧 Adding tenant option: ${name} with identifier: ${identifier}, original index: ${originalIndex}`,
          tenant,
        );

        const option = `<option value="${identifier}" data-type="tenant" data-passport="${passport}" data-name="${name}" data-index="${originalIndex}">
                  ${displayText}
              </option>`;

        tenantASelect.innerHTML += option;
        tenantBSelect.innerHTML += option;
      });

      tenantASelect.innerHTML += "</optgroup>";
      tenantBSelect.innerHTML += "</optgroup>";
    }

    // Add section header for investors (only if we have filtered investors)
    if (filteredInvestors.length > 0) {
      tenantASelect.innerHTML += `<optgroup label="── ${i18next.t("createContract.investors", "Investors")} ──">`;
      tenantBSelect.innerHTML += `<optgroup label="── ${i18next.t("createContract.investors", "Investors")} ──">`;

      // Populate with filtered investor data
      filteredInvestors.forEach((investor) => {
        const fin = investor.fin || "";
        const passport = investor.passport || "";
        const name =
          investor.name ||
          i18next.t("createContract.unnamedInvestor", "Unnamed Investor");
        const investorId = investor.investorId;

        // Find the ORIGINAL index in the unfiltered array
        const originalIndex = this.investors.findIndex((i) => i === investor);

        // Use investorId as identifier with investor prefix
        const identifier = `investor_${investorId}`;

        // Build property information for display
        let propertyInfo = "";
        if (
          investor.properties &&
          Array.isArray(investor.properties) &&
          investor.properties.length > 0
        ) {
          const propertyAddresses = investor.properties
            .map((prop) => {
              let propId;
              if (typeof prop === "object") {
                propId = prop.propertyId || prop._id;
              } else {
                propId = prop;
              }
              return propId ? this.getPropertyAddress(propId) : null;
            })
            .filter((address) => address)
            .join(", ");

          if (propertyAddresses) {
            propertyInfo = ` - Properties: ${propertyAddresses}`;
          }
        }

        const displayText = `${name} ${
          fin ? `(FIN: ${fin})` : ""
        } [Investor]${propertyInfo}`;

        // Store for fuzzy search
        this._allInvestorOptions.push({
          identifier,
          displayText,
          searchText: `${name} ${fin} ${passport}`.toLowerCase(),
          type: "investor",
          passport,
          name,
          index: originalIndex,
          investorId,
        });

        console.log(
          `🔧 Adding investor option: ${name} with identifier: ${identifier}, original index: ${originalIndex}`,
          investor,
        );

        const option = `<option value="${identifier}" data-type="investor" data-passport="${passport}" data-name="${name}" data-index="${originalIndex}" data-investor-id="${investorId}">
                  ${displayText}
              </option>`;

        tenantASelect.innerHTML += option;
        tenantBSelect.innerHTML += option;
      });

      tenantASelect.innerHTML += "</optgroup>";
      tenantBSelect.innerHTML += "</optgroup>";
    }

    console.log("✅ Populated tenant dropdowns successfully");

    // Setup fuzzy search for tenant dropdowns
    this.setupTenantSearch();

    // Add event listeners for tenant selection (remove existing first)
    console.log("🔧 Setting up event listeners...");
    tenantASelect.removeEventListener("change", this.tenantAChangeHandler);
    tenantBSelect.removeEventListener("change", this.tenantBChangeHandler);

    this.tenantAChangeHandler = (e) => {
      console.log(
        "🔧 Tenant A change event triggered with value:",
        e.target.value,
      );
      this.handleTenantSelection("A", e.target.value);
    };
    this.tenantBChangeHandler = (e) => {
      const selectedOptions = Array.from(e.target.selectedOptions);
      const selectedValues = selectedOptions
        .map((opt) => opt.value)
        .filter((val) => val);
      console.log(
        "🔧 Tenant B change event triggered with values:",
        selectedValues,
      );
      this.handleTenantBMultiSelection(selectedValues);
    };

    tenantASelect.addEventListener("change", this.tenantAChangeHandler);
    tenantBSelect.addEventListener("change", this.tenantBChangeHandler);

    console.log("✅ Event listeners attached successfully");
  }

  // Populate custom checkbox dropdown for Tenant B
  populateTenantBCheckboxDropdown(filteredTenants, filteredInvestors) {
    const dropdownMenu = document.getElementById("tenantBDropdownMenu");
    const tenantBSelect = document.getElementById("contractTenantB");

    if (!dropdownMenu) {
      console.log("❌ Tenant B dropdown menu not found");
      return;
    }

    // Clear existing options
    dropdownMenu.innerHTML = "";

    // Add search input
    dropdownMenu.innerHTML += `
      <div class="px-3 pt-3 pb-2">
        <input type="text" class="form-control form-control-sm" id="tenantBSearchInput" placeholder="🔍 ${i18next.t("createContract.searchTenant", "Search tenant...")}" style="border-radius: 4px;">
      </div>
      <div class="dropdown-divider my-0"></div>
    `;

    // Add special options
    dropdownMenu.innerHTML += `
      <div class="form-check px-3 py-2" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor=''">
        <input class="form-check-input" type="checkbox" value="ADD_NEW_TENANT" id="tenantB_add_new" style="margin: 0; width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; position: relative;">
        <label class="form-check-label" for="tenantB_add_new" style="color: #0d6efd; font-weight: 500; cursor: pointer; flex: 1; margin: 0;">
          <i class="bi bi-person-plus me-1"></i>${i18next.t("createContract.addNewTenant", "+ Add New Tenant")}
        </label>
      </div>
      <div class="form-check px-3 py-2" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor=''">
        <input class="form-check-input" type="checkbox" value="CUSTOM_TEXT" id="tenantB_custom" style="margin: 0; width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; position: relative;">
        <label class="form-check-label" for="tenantB_custom" style="color: #198754; font-weight: 500; cursor: pointer; flex: 1; margin: 0;">
          ✏️ ${i18next.t("createContract.enterCustomText", "Enter Custom Text")}
        </label>
      </div>
      <div class="dropdown-divider my-0"></div>
    `;

    // Add tenants section
    if (filteredTenants.length > 0) {
      dropdownMenu.innerHTML += `<div class="px-3 py-2" style="background-color: #f8f9fa; font-weight: 600; font-size: 0.875rem;">${i18next.t("createContract.tenants", "Tenants")}</div>`;

      filteredTenants.forEach((tenant, index) => {
        const fin = tenant.fin || tenant.id || "";
        const passport = tenant.passportNumber || tenant.passport || "";
        const name =
          tenant.name ||
          i18next.t("createContract.unnamedTenant", "Unnamed Tenant");
        const originalIndex = this.tenants.findIndex((t) => t === tenant);
        const identifier = fin || `tenant_${originalIndex}`;

        const displayText = `${name}${fin ? ` (FIN: ${fin})` : passport ? ` (Passport: ${passport})` : ""}`;

        dropdownMenu.innerHTML += `
          <div class="form-check px-3 py-2" data-search-text="${name.toLowerCase()} ${fin.toLowerCase()} ${passport.toLowerCase()}" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor=''">
            <input class="form-check-input tenant-b-checkbox" type="checkbox" value="${identifier}"
                   id="tenantB_${identifier}"
                   data-type="tenant"
                   data-index="${originalIndex}"
                   data-name="${name}"
                   data-passport="${passport}"
                   style="margin: 0; width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; position: relative;">
            <label class="form-check-label" for="tenantB_${identifier}" style="cursor: pointer; flex: 1; margin: 0;">
              ${displayText}
            </label>
          </div>
        `;
      });
    }

    // Add investors section
    if (filteredInvestors.length > 0) {
      dropdownMenu.innerHTML += '<div class="dropdown-divider my-0"></div>';
      dropdownMenu.innerHTML += `<div class="px-3 py-2" style="background-color: #f8f9fa; font-weight: 600; font-size: 0.875rem;">${i18next.t("createContract.investors", "Investors")}</div>`;

      filteredInvestors.forEach((investor, index) => {
        const fin = investor.fin || "";
        const passport = investor.passport || "";
        const name =
          investor.name ||
          i18next.t("createContract.unnamedInvestor", "Unnamed Investor");
        const investorId = investor.investorId;
        const originalIndex = this.investors.findIndex((i) => i === investor);
        const identifier = `investor_${investorId}`;

        const displayText = `${name}${fin ? ` (FIN: ${fin})` : passport ? ` (Passport: ${passport})` : ""}`;

        dropdownMenu.innerHTML += `
          <div class="form-check px-3 py-2" data-search-text="${name.toLowerCase()} ${fin.toLowerCase()} ${passport.toLowerCase()}" style="display: flex; align-items: center; gap: 12px; cursor: pointer;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor=''">
            <input class="form-check-input tenant-b-checkbox" type="checkbox" value="${identifier}"
                   id="tenantB_${identifier}"
                   data-type="investor"
                   data-index="${originalIndex}"
                   data-investor-id="${investorId}"
                   data-name="${name}"
                   data-passport="${passport}"
                   style="margin: 0; width: 18px; height: 18px; flex-shrink: 0; cursor: pointer; position: relative;">
            <label class="form-check-label" for="tenantB_${identifier}" style="cursor: pointer; flex: 1; margin: 0;">
              ${displayText}
            </label>
          </div>
        `;
      });
    }

    // Setup event listeners for checkboxes
    this.setupTenantBCheckboxListeners();

    // Setup search functionality
    this.setupTenantBSearch();

    // Prevent dropdown from closing when clicking inside
    const dropdownMenuElement = document.getElementById("tenantBDropdownMenu");
    if (dropdownMenuElement) {
      dropdownMenuElement.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }
  }

  // Setup event listeners for Tenant B checkboxes
  setupTenantBCheckboxListeners() {
    const checkboxes = document.querySelectorAll(".tenant-b-checkbox");
    const specialCheckboxes = document.querySelectorAll(
      "#tenantB_add_new, #tenantB_custom",
    );

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.handleTenantBCheckboxChange();
      });
    });

    specialCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        if (e.target.checked) {
          // Uncheck all other options when special option is selected
          checkboxes.forEach((cb) => (cb.checked = false));
          specialCheckboxes.forEach((cb) => {
            if (cb !== e.target) cb.checked = false;
          });

          // Handle special options
          if (e.target.value === "ADD_NEW_TENANT") {
            this.showNewTenantFields("B");
          } else if (e.target.value === "CUSTOM_TEXT") {
            this.showCustomTenantField("B");
          }
        }
      });
    });
  }

  // Handle Tenant B checkbox changes
  handleTenantBCheckboxChange() {
    const checkboxes = document.querySelectorAll(".tenant-b-checkbox:checked");
    const selectedValues = Array.from(checkboxes).map((cb) => cb.value);

    // Update the hidden select element
    const tenantBSelect = document.getElementById("contractTenantB");
    if (tenantBSelect) {
      // Clear all selections
      Array.from(tenantBSelect.options).forEach(
        (opt) => (opt.selected = false),
      );

      // Select the checked options
      selectedValues.forEach((value) => {
        const option = Array.from(tenantBSelect.options).find(
          (opt) => opt.value === value,
        );
        if (option) {
          option.selected = true;
        }
      });
    }

    // Update the display text
    this.updateTenantBDisplayText();

    // Trigger the multi-selection handler
    this.handleTenantBMultiSelection(selectedValues);
  }

  // Update the display text for selected tenants
  updateTenantBDisplayText() {
    const checkboxes = document.querySelectorAll(".tenant-b-checkbox:checked");
    const displayText = document.getElementById("tenantBSelectedText");

    if (!displayText) return;

    if (checkboxes.length === 0) {
      displayText.textContent = i18next.t(
        "createContract.selectTenants",
        "Select tenants...",
      );
      displayText.className = "text-muted";
    } else if (checkboxes.length === 1) {
      const name = checkboxes[0].getAttribute("data-name");
      displayText.textContent = name;
      displayText.className = "text-dark";
    } else {
      displayText.textContent = i18next
        .t("createContract.tenantsSelected", "{{count}} tenants selected")
        .replace("{{count}}", checkboxes.length);
      displayText.className = "text-dark";
    }
  }

  // Setup search for Tenant B checkbox dropdown
  setupTenantBSearch() {
    const searchInput = document.getElementById("tenantBSearchInput");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const checkboxItems = document.querySelectorAll(
        "#tenantBDropdownMenu .form-check[data-search-text]",
      );

      checkboxItems.forEach((item) => {
        const searchText = item.getAttribute("data-search-text");
        if (searchText.includes(searchTerm)) {
          item.style.display = "";
        } else {
          item.style.display = "none";
        }
      });
    });
  }

  // Setup fuzzy search for tenant dropdowns
  setupTenantSearch() {
    const tenantASelect = document.getElementById("contractTenantA");
    const tenantBSelect = document.getElementById("contractTenantB");

    if (!tenantASelect || !tenantBSelect) return;

    // Find or create search input containers
    const setupSearchForSelect = (selectElement, searchId) => {
      // Check if search input already exists
      let searchInput = document.getElementById(searchId);

      if (!searchInput) {
        // Create search input
        searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.id = searchId;
        searchInput.className = "form-control form-control-sm mb-2";
        searchInput.placeholder = `🔍 ${i18next.t("createContract.searchTenantDetailed", "Search tenant by name, FIN, or passport...")}`;
        searchInput.style.fontSize = "0.875rem";

        // Insert before the select element
        selectElement.parentNode.insertBefore(searchInput, selectElement);
      }

      // Clear any existing event listeners by replacing the element
      const newSearchInput = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(newSearchInput, searchInput);

      // Store all original options (excluding special options)
      const allOptions = Array.from(selectElement.options).filter(
        (opt) => opt.value !== "" && opt.value !== "ADD_NEW_TENANT",
      );

      // Add input event listener for fuzzy search
      newSearchInput.addEventListener("input", (e) => {
        const searchText = e.target.value.trim();
        this.filterTenantOptions(selectElement, searchText, allOptions);
      });

      // Clear search on select change
      selectElement.addEventListener("change", () => {
        newSearchInput.value = "";
      });
    };

    // Setup search for both dropdowns
    setupSearchForSelect(tenantASelect, "tenantASearch");
    setupSearchForSelect(tenantBSelect, "tenantBSearch");
  }

  // Filter tenant options based on fuzzy search
  filterTenantOptions(selectElement, searchText, allOptions) {
    if (!searchText) {
      // Show all options if search is empty
      this.restoreAllOptions(selectElement, allOptions);
      return;
    }

    // Get current selected value to preserve it
    const currentValue = selectElement.value;

    // Filter options using fuzzy match
    const matchingOptions = allOptions.filter((option) => {
      const optionText = option.textContent || option.innerText || "";
      const optionValue = option.value;
      return (
        this.fuzzyMatch(searchText, optionText) ||
        this.fuzzyMatch(searchText, optionValue)
      );
    });

    // Rebuild select options
    selectElement.innerHTML = `<option value="">${i18next.t("createContract.selectTenant", "Select Tenant")}</option>`;
    selectElement.innerHTML += `<option value="ADD_NEW_TENANT" style="color: #0d6efd; font-weight: 500;">${i18next.t("createContract.addNewTenant", "+ Add New Tenant")}</option>`;

    if (matchingOptions.length === 0) {
      selectElement.innerHTML += `<option value="" disabled>${i18next.t("createContract.noTenantsAvailable", "No tenants or investors available")}</option>`;
    } else {
      // Group by type (tenant vs investor)
      const tenantOptions = matchingOptions.filter(
        (opt) => opt.dataset.type === "tenant",
      );
      const investorOptions = matchingOptions.filter(
        (opt) => opt.dataset.type === "investor",
      );

      if (tenantOptions.length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = `── ${i18next.t("createContract.tenants", "Tenants")} ──`;
        tenantOptions.forEach((opt) =>
          optgroup.appendChild(opt.cloneNode(true)),
        );
        selectElement.appendChild(optgroup);
      }

      if (investorOptions.length > 0) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = `── ${i18next.t("createContract.investors", "Investors")} ──`;
        investorOptions.forEach((opt) =>
          optgroup.appendChild(opt.cloneNode(true)),
        );
        selectElement.appendChild(optgroup);
      }
    }

    // Restore previous selection if it still exists
    if (
      currentValue &&
      selectElement.querySelector(`option[value="${currentValue}"]`)
    ) {
      selectElement.value = currentValue;
    }
  }

  // Restore all options to select element
  restoreAllOptions(selectElement, allOptions) {
    const currentValue = selectElement.value;

    selectElement.innerHTML = `<option value="">${i18next.t("createContract.selectTenant", "Select Tenant")}</option>`;
    selectElement.innerHTML += `<option value="ADD_NEW_TENANT" style="color: #0d6efd; font-weight: 500;">${i18next.t("createContract.addNewTenant", "+ Add New Tenant")}</option>`;

    // Group by type
    const tenantOptions = allOptions.filter(
      (opt) => opt.dataset.type === "tenant",
    );
    const investorOptions = allOptions.filter(
      (opt) => opt.dataset.type === "investor",
    );

    if (tenantOptions.length > 0) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = `── ${i18next.t("createContract.tenants", "Tenants")} ──`;
      tenantOptions.forEach((opt) => optgroup.appendChild(opt.cloneNode(true)));
      selectElement.appendChild(optgroup);
    }

    if (investorOptions.length > 0) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = `── ${i18next.t("createContract.investors", "Investors")} ──`;
      investorOptions.forEach((opt) =>
        optgroup.appendChild(opt.cloneNode(true)),
      );
      selectElement.appendChild(optgroup);
    }

    // Restore previous selection
    if (
      currentValue &&
      selectElement.querySelector(`option[value="${currentValue}"]`)
    ) {
      selectElement.value = currentValue;
    }
  }

  populatePropertiesDropdown() {
    console.log(
      "🏢 Populating property dropdown with",
      this.properties.length,
      "properties",
    );

    const addressSelect = document.getElementById("contractAddress");

    if (!addressSelect) {
      console.error("❌ Property address select element not found");
      return;
    }

    // Clear existing options
    addressSelect.innerHTML = `<option value="">${i18next.t("createContract.selectPropertyAddress", "Select property address")}</option>`;

    // Add "Add New Property" option
    addressSelect.innerHTML += `<option value="ADD_NEW_PROPERTY" style="color: #0d6efd; font-weight: 500;"><i class="bi bi-building-plus me-1"></i>${i18next.t("createContract.addNewProperty", "+ Add New Property")}</option>`;

    // Add "Enter Custom Text" option
    addressSelect.innerHTML += `<option value="CUSTOM_TEXT" style="color: #198754; font-weight: 500;">✏️ ${i18next.t("createContract.enterCustomText", "Enter Custom Text")}</option>`;

    // Check if we have properties
    if (!this.properties || this.properties.length === 0) {
      addressSelect.innerHTML += `<option value="" disabled>${i18next.t("createContract.noPropertiesAvailable", "No properties available")}</option>`;
      return;
    }

    // Populate with property data
    this.properties.forEach((property) => {
      const address =
        property.address ||
        property.location ||
        property.name ||
        i18next.t("createContract.unknownAddress", "Unknown Address");
      const id = property.propertyId || property.id || property._id || "";

      const option = `<option value="${address}" data-property-id="${id}">
                ${address}
            </option>`;

      addressSelect.innerHTML += option;
    });

    console.log("✅ Populated property dropdown successfully");

    // Add event listener for address selection
    addressSelect.removeEventListener("change", this.addressChangeHandler);
    this.addressChangeHandler = (e) =>
      this.handleAddressSelection(e.target.value);
    addressSelect.addEventListener("change", this.addressChangeHandler);
  }

  async handleAddressSelection(address) {
    console.log(`🏠 Address selected: ${address}`);

    const newPropertyFields = document.getElementById("newPropertyFields");
    const customAddressField = document.getElementById("customAddressField");
    const addressSelect = document.getElementById("contractAddress");

    if (address === "ADD_NEW_PROPERTY") {
      // Show custom property fields
      if (newPropertyFields) {
        newPropertyFields.style.display = "block";
      }
      if (customAddressField) {
        customAddressField.style.display = "none";
      }
      // Clear address data and property filter
      this.contractData.address = "";
      this.selectedPropertyId = null;
      console.log("🔍 No property filter (adding new property)");
    } else if (address === "CUSTOM_TEXT") {
      // Show custom text input
      if (customAddressField) {
        customAddressField.style.display = "block";

        // Focus on the custom address input and add event listener
        const customAddressInput = document.getElementById("customAddressText");
        if (customAddressInput) {
          // Remove existing event listener before clearing value
          if (this.customAddressInputHandler) {
            customAddressInput.removeEventListener(
              "input",
              this.customAddressInputHandler,
            );
          }

          customAddressInput.value = "";
          customAddressInput.focus();

          // Add event listener to update preview on input
          this.customAddressInputHandler = () => this.updateContractPreview();
          customAddressInput.addEventListener(
            "input",
            this.customAddressInputHandler,
          );
        }
      }
      if (newPropertyFields) {
        newPropertyFields.style.display = "none";
      }
      // Clear address data and property filter
      this.contractData.address = "";
      this.selectedPropertyId = null;
      console.log("✏️ Custom text entry selected for property address");
    } else {
      // Hide both custom fields
      if (newPropertyFields) {
        newPropertyFields.style.display = "none";
      }
      if (customAddressField) {
        customAddressField.style.display = "none";
      }
      // Set selected address
      this.contractData.address = address;

      // Extract property ID from selected option
      if (addressSelect && address) {
        const selectedOption = addressSelect.querySelector(
          `option[value="${address}"]`,
        );
        this.selectedPropertyId = selectedOption
          ? selectedOption.dataset.propertyId
          : null;
        console.log(`🔍 Selected property ID: "${this.selectedPropertyId}"`);
        console.log(
          `🔍 Selected option data:`,
          selectedOption
            ? {
                value: selectedOption.value,
                propertyId: selectedOption.dataset.propertyId,
                text: selectedOption.textContent,
              }
            : "not found",
        );
      }

      // Load tenants only when a valid property is selected
      await this.loadTenants();
    }

    // Refresh tenant dropdowns with property filter
    this.populateTenantsDropdown();

    // Auto-select main tenant for Tenant A if a property is selected
    if (
      this.selectedPropertyId &&
      address &&
      address !== "ADD_NEW_PROPERTY" &&
      address !== "CUSTOM_TEXT"
    ) {
      this.autoSelectMainTenantForProperty(this.selectedPropertyId);
    }

    this.updateContractPreview();
  }

  autoSelectMainTenantForProperty(propertyId) {
    console.log(`🔍 Looking for main tenant for property ID: ${propertyId}`);

    // Find the main tenant for this property
    const mainTenant = this.tenants.find((tenant) => {
      if (!tenant.properties || tenant.properties.length === 0) {
        return false;
      }

      // Check if this tenant has this property and is marked as main tenant
      return tenant.properties.some(
        (prop) => prop.propertyId === propertyId && prop.isMainTenant === true,
      );
    });

    if (mainTenant) {
      console.log(`✅ Found main tenant for property: ${mainTenant.name}`);

      // Set the selected tenant
      this.selectedTenantA = mainTenant;

      // Update the Tenant A dropdown
      const tenantASelect = document.getElementById("contractTenantA");
      if (tenantASelect) {
        // Find the option that matches this tenant
        const tenantOption = Array.from(tenantASelect.options).find(
          (option) => {
            return (
              option.value === mainTenant.fin ||
              option.value === mainTenant.id ||
              option.dataset.index !== undefined
            );
          },
        );

        if (tenantOption) {
          tenantASelect.value = tenantOption.value;
          console.log(`✅ Auto-selected Tenant A: ${mainTenant.name}`);

          // Trigger the tenant selection handler to populate other fields
          this.handleTenantSelection("A", tenantOption.value);
        }
      }
    } else {
      console.log(`ℹ️ No main tenant found for property ID: ${propertyId}`);
    }
  }

  handleTenantSelection(tenantType, identifier) {
    console.log(`🔄 Handling tenant selection: ${tenantType} = ${identifier}`);

    // Handle "Add New Tenant" option
    if (identifier === "ADD_NEW_TENANT") {
      console.log(
        `🆕 Showing new tenant input fields for Tenant ${tenantType}`,
      );
      this.showNewTenantFields(tenantType);
      return;
    }

    // Handle "Custom Text" option
    if (identifier === "CUSTOM_TEXT") {
      console.log(`✏️ Showing custom text field for Tenant ${tenantType}`);
      this.showCustomTenantField(tenantType);
      return;
    }

    console.log("🔧 Available tenants:", this.tenants);
    console.log("🔧 Available investors:", this.investors);
    console.log("🔧 Tenants array length:", this.tenants.length);
    console.log("🔧 Investors array length:", this.investors.length);

    let tenant = null;

    // Get the select element to access data attributes
    const selectElement =
      tenantType === "A"
        ? document.getElementById("contractTenantA")
        : document.getElementById("contractTenantB");

    console.log("🔧 Select element found:", !!selectElement);

    if (selectElement) {
      const selectedOption = selectElement.selectedOptions[0];
      console.log("🔧 Selected option:", selectedOption);

      if (selectedOption) {
        const dataType = selectedOption.dataset.type;
        const index = selectedOption.dataset.index;
        console.log("🔧 Data type:", dataType, "Index from dataset:", index);

        if (index !== undefined && index !== "") {
          const parsedIndex = parseInt(index);
          console.log("🔧 Parsed index:", parsedIndex);

          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            if (
              dataType === "investor" &&
              parsedIndex < this.investors.length
            ) {
              // Handle investor selection
              tenant = this.investors[parsedIndex];
              console.log(`🎯 Found investor by index ${parsedIndex}:`, tenant);
              console.log("🎯 Investor name:", tenant?.name);
              console.log("🎯 Investor passport:", tenant?.passport);
              console.log("🎯 Investor fin:", tenant?.fin);
            } else if (
              dataType === "tenant" &&
              parsedIndex < this.tenants.length
            ) {
              // Handle tenant selection
              tenant = this.tenants[parsedIndex];
              console.log(`🎯 Found tenant by index ${parsedIndex}:`, tenant);
              console.log("🎯 Tenant name:", tenant?.name);
              console.log("🎯 Tenant passport:", tenant?.passportNumber);
              console.log("🎯 Tenant fin:", tenant?.fin);
            }
          }
        }
      }
    }

    // Fallback to original logic if index-based lookup fails
    if (!tenant) {
      console.log("🔄 Using fallback logic to find tenant or investor");

      // Check if identifier is for an investor
      if (identifier.startsWith("investor_")) {
        const investorId = identifier.replace("investor_", "");
        tenant = this.investors.find((i) => i.investorId === investorId);
        console.log("🎯 Found investor by ID:", tenant);
      } else {
        // Try to find tenant by fin or id first
        tenant = this.tenants.find(
          (t) => t.fin === identifier || t.id === identifier,
        );

        // If not found and identifier starts with "tenant_", use index
        if (!tenant && identifier.startsWith("tenant_")) {
          const index = parseInt(identifier.replace("tenant_", ""));
          tenant = this.tenants[index];
        }

        // If still not found, try by name as last resort
        if (!tenant && identifier) {
          tenant = this.tenants.find((t) => t.name === identifier);
        }
      }

      console.log("🎯 Fallback result:", tenant);
    }

    console.log(`🎯 Final tenant for ${tenantType}:`, tenant);

    if (tenantType === "A") {
      this.selectedTenantA = tenant;
      console.log("✅ Set selectedTenantA:", this.selectedTenantA);

      // Update dropdown display to show selected tenant
      if (
        tenant &&
        identifier &&
        identifier !== "ADD_NEW_TENANT" &&
        identifier !== ""
      ) {
        const tenantASelect = document.getElementById("contractTenantA");
        if (tenantASelect) {
          tenantASelect.value = identifier;
          console.log("🎯 Updated Tenant A dropdown display to:", identifier);
        }
      }

      // Auto-populate signature if this is a main tenant with signature
      if (tenant && tenant.signature && this.isMainTenant(tenant)) {
        console.log("🖋️ Auto-populating Tenant A signature from tenant data");
        this.signatures.tenantA = tenant.signature;
        this.updateSignaturePreview("A");
      }

      // Hide new tenant fields if a real tenant is selected (not ADD_NEW_TENANT or empty)
      if (identifier && identifier !== "ADD_NEW_TENANT" && identifier !== "") {
        this.hideNewTenantFields(tenantType);
      }
    } else {
      this.selectedTenantB = tenant;
      console.log("✅ Set selectedTenantB:", this.selectedTenantB);

      // Update dropdown display to show selected tenant
      if (
        tenant &&
        identifier &&
        identifier !== "ADD_NEW_TENANT" &&
        identifier !== ""
      ) {
        const tenantBSelect = document.getElementById("contractTenantB");
        if (tenantBSelect) {
          tenantBSelect.value = identifier;
          console.log("🎯 Updated Tenant B dropdown display to:", identifier);
        }
      }

      // Auto-populate signature if this is a main tenant with signature
      if (tenant && tenant.signature && this.isMainTenant(tenant)) {
        console.log("🖋️ Auto-populating Tenant B signature from tenant data");
        this.signatures.tenantB = tenant.signature;
        this.updateSignaturePreview("B");
      }

      // Auto-fill move-in and move-out dates if tenant has property information
      // BUT only if we're not currently loading a template (to preserve template dates)
      if (
        !this.isLoadingTemplate &&
        tenant &&
        tenant.properties &&
        tenant.properties.length > 0
      ) {
        console.log(
          "🏠 Auto-filling move-in/move-out dates from tenant property info",
        );

        // Find the most recent property with move-in/move-out dates
        let propertyWithDates = null;
        for (const property of tenant.properties) {
          if (property.moveinDate || property.moveoutDate) {
            propertyWithDates = property;
            break; // Use the first property that has date information
          }
        }

        if (propertyWithDates) {
          console.log("📅 Found property with dates:", propertyWithDates);

          // Auto-fill move-in date
          if (propertyWithDates.moveinDate) {
            const moveInInput = document.getElementById("contractMoveInDate");
            if (moveInInput) {
              const moveInDate = new Date(propertyWithDates.moveinDate)
                .toISOString()
                .split("T")[0];
              moveInInput.value = moveInDate;
              this.contractData.moveInDate = moveInDate;
              console.log("✅ Auto-filled move-in date:", moveInDate);
            }
          }

          // Auto-fill move-out date
          if (propertyWithDates.moveoutDate) {
            const moveOutInput = document.getElementById("contractMoveOutDate");
            if (moveOutInput) {
              const moveOutDate = new Date(propertyWithDates.moveoutDate)
                .toISOString()
                .split("T")[0];
              moveOutInput.value = moveOutDate;
              this.contractData.moveOutDate = moveOutDate;
              console.log("✅ Auto-filled move-out date:", moveOutDate);
            }
          }

          // Auto-fill room type from property data
          if (propertyWithDates.room) {
            const roomInput = document.getElementById("contractRoom");
            if (roomInput) {
              roomInput.value = propertyWithDates.room;
              this.contractData.room = propertyWithDates.room;
              console.log("✅ Auto-filled room type:", propertyWithDates.room);
            }
          }

          // Auto-fill rent and deposit from tenant data
          if (tenant) {
            // Auto-fill monthly rental
            if (tenant.rent) {
              const monthlyRentalInput = document.getElementById(
                "contractMonthlyRental",
              );
              if (monthlyRentalInput) {
                monthlyRentalInput.value = tenant.rent;
                this.contractData.monthlyRental = tenant.rent;
                console.log("✅ Auto-filled monthly rental:", tenant.rent);
              }
            }

            // Auto-fill security deposit
            if (tenant.deposit) {
              const securityDepositInput = document.getElementById(
                "contractSecurityDeposit",
              );
              if (securityDepositInput) {
                securityDepositInput.value = tenant.deposit;
                this.contractData.securityDeposit = tenant.deposit;
                console.log("✅ Auto-filled security deposit:", tenant.deposit);
              }
            }
          }
        } else {
          console.log(
            "ℹ️ No property with move-in/move-out dates found for tenant",
          );
        }
      } else if (this.isLoadingTemplate) {
        console.log("⏭️ Skipping auto-fill of dates (loading template)");
      }

      // Hide new tenant fields if a real tenant is selected (not ADD_NEW_TENANT or empty)
      if (identifier && identifier !== "ADD_NEW_TENANT" && identifier !== "") {
        this.hideNewTenantFields(tenantType);
      }
    }

    console.log("🔄 Calling updateContractPreview...");
    this.updateContractPreview();
    console.log("✅ updateContractPreview called");
  }

  handleTenantBMultiSelection(identifiers) {
    console.log("🔄 Handling multiple Tenant B selections:", identifiers);

    // Clear the existing selectedTenantB array
    this.selectedTenantB = [];

    // Handle special cases (ADD_NEW_TENANT, CUSTOM_TEXT)
    if (identifiers.includes("ADD_NEW_TENANT")) {
      console.log("🆕 Showing new tenant input fields for Tenant B");
      this.showNewTenantFields("B");
      return;
    }

    if (identifiers.includes("CUSTOM_TEXT")) {
      console.log("✏️ Showing custom text field for Tenant B");
      this.showCustomTenantField("B");
      return;
    }

    // Hide custom/new tenant fields if real tenants are selected
    if (identifiers.length > 0) {
      this.hideNewTenantFields("B");
    }

    // Get the select element to access data attributes
    const tenantBSelect = document.getElementById("contractTenantB");

    if (!tenantBSelect) {
      console.error("❌ Tenant B select element not found");
      return;
    }

    // Process each selected identifier
    identifiers.forEach((identifier) => {
      if (
        !identifier ||
        identifier === "ADD_NEW_TENANT" ||
        identifier === "CUSTOM_TEXT"
      ) {
        return;
      }

      let tenant = null;

      // Find the checkbox element for this identifier (not the hidden select option)
      const checkbox = document.querySelector(
        `.tenant-b-checkbox[value="${identifier}"]`,
      );

      if (checkbox) {
        const dataType = checkbox.getAttribute("data-type");
        const index = checkbox.getAttribute("data-index");

        console.log(
          `🔧 Processing: ${identifier}, type: ${dataType}, index: ${index}`,
        );

        if (index !== undefined && index !== "" && index !== null) {
          const parsedIndex = parseInt(index);

          if (!isNaN(parsedIndex) && parsedIndex >= 0) {
            if (
              dataType === "investor" &&
              parsedIndex < this.investors.length
            ) {
              tenant = this.investors[parsedIndex];
              console.log(`🎯 Found investor by index ${parsedIndex}:`, tenant);
            } else if (
              dataType === "tenant" &&
              parsedIndex < this.tenants.length
            ) {
              tenant = this.tenants[parsedIndex];
              console.log(`🎯 Found tenant by index ${parsedIndex}:`, tenant);
            }
          }
        }
      }

      // Fallback logic if index-based lookup fails
      if (!tenant) {
        console.log("🔄 Using fallback logic for:", identifier);

        if (identifier.startsWith("investor_")) {
          const investorId = identifier.replace("investor_", "");
          tenant = this.investors.find((i) => i.investorId === investorId);
        } else {
          tenant = this.tenants.find(
            (t) => t.fin === identifier || t.id === identifier,
          );

          if (!tenant && identifier.startsWith("tenant_")) {
            const index = parseInt(identifier.replace("tenant_", ""));
            tenant = this.tenants[index];
          }

          if (!tenant && identifier) {
            tenant = this.tenants.find((t) => t.name === identifier);
          }
        }
      }

      // Add tenant to selectedTenantB array if found
      if (tenant) {
        this.selectedTenantB.push(tenant);
        console.log("✅ Added tenant to selectedTenantB:", tenant.name);
      }
    });

    console.log("✅ Final selectedTenantB array:", this.selectedTenantB);

    // Auto-fill move-in and move-out dates from the first selected tenant with property info
    // BUT only if we're not currently loading a template (to preserve template dates)
    if (!this.isLoadingTemplate && this.selectedTenantB.length > 0) {
      // Find the first tenant with property information containing dates
      let tenantWithDates = null;
      let propertyWithDates = null;

      for (const tenant of this.selectedTenantB) {
        if (tenant && tenant.properties && tenant.properties.length > 0) {
          for (const property of tenant.properties) {
            if (property.moveinDate || property.moveoutDate) {
              tenantWithDates = tenant;
              propertyWithDates = property;
              break;
            }
          }
          if (propertyWithDates) break;
        }
      }

      if (propertyWithDates) {
        console.log(
          "📅 Found property with dates for Tenant B:",
          propertyWithDates,
        );

        // Auto-fill move-in date
        if (propertyWithDates.moveinDate) {
          const moveInInput = document.getElementById("contractMoveInDate");
          if (moveInInput) {
            const moveInDate = new Date(propertyWithDates.moveinDate)
              .toISOString()
              .split("T")[0];
            moveInInput.value = moveInDate;
            this.contractData.moveInDate = moveInDate;
            console.log(
              "✅ Auto-filled move-in date from Tenant B:",
              moveInDate,
            );
          }
        }

        // Auto-fill move-out date
        if (propertyWithDates.moveoutDate) {
          const moveOutInput = document.getElementById("contractMoveOutDate");
          if (moveOutInput) {
            const moveOutDate = new Date(propertyWithDates.moveoutDate)
              .toISOString()
              .split("T")[0];
            moveOutInput.value = moveOutDate;
            this.contractData.moveOutDate = moveOutDate;
            console.log(
              "✅ Auto-filled move-out date from Tenant B:",
              moveOutDate,
            );
          }
        }

        // Auto-fill room type from property data
        if (propertyWithDates.room) {
          const roomInput = document.getElementById("contractRoom");
          if (roomInput) {
            roomInput.value = propertyWithDates.room;
            this.contractData.room = propertyWithDates.room;
            console.log(
              "✅ Auto-filled room type from Tenant B:",
              propertyWithDates.room,
            );
          }
        }

        // Auto-fill rent and deposit from tenant data
        if (tenantWithDates) {
          // Auto-fill monthly rental
          if (tenantWithDates.rent) {
            const monthlyRentalInput = document.getElementById(
              "contractMonthlyRental",
            );
            if (monthlyRentalInput) {
              monthlyRentalInput.value = tenantWithDates.rent;
              this.contractData.monthlyRental = tenantWithDates.rent;
              console.log(
                "✅ Auto-filled monthly rental from Tenant B:",
                tenantWithDates.rent,
              );
            }
          }

          // Auto-fill security deposit
          if (tenantWithDates.deposit) {
            const securityDepositInput = document.getElementById(
              "contractSecurityDeposit",
            );
            if (securityDepositInput) {
              securityDepositInput.value = tenantWithDates.deposit;
              this.contractData.securityDeposit = tenantWithDates.deposit;
              console.log(
                "✅ Auto-filled security deposit from Tenant B:",
                tenantWithDates.deposit,
              );
            }
          }
        }

        // Auto-populate signature if this is a main tenant with signature
        if (
          tenantWithDates &&
          tenantWithDates.signature &&
          this.isMainTenant(tenantWithDates)
        ) {
          console.log("🖋️ Auto-populating Tenant B signature from tenant data");
          this.signatures.tenantB = tenantWithDates.signature;
          this.updateSignaturePreview("B");
        }
      } else {
        console.log(
          "ℹ️ No property with move-in/move-out dates found for selected Tenant B",
        );
      }
    } else if (this.isLoadingTemplate) {
      console.log("⏭️ Skipping auto-fill of dates (loading template)");
    }

    // Update the contract preview
    console.log("🔄 Calling updateContractPreview...");
    this.updateContractPreview();
    console.log("✅ updateContractPreview called");
  }

  showNewTenantFields(tenantType) {
    const fieldsId =
      tenantType === "A" ? "newTenantAFields" : "newTenantFields";
    const nameInputId =
      tenantType === "A" ? "newTenantAName" : "newTenantBName";
    const passportInputId =
      tenantType === "A" ? "newTenantAPassport" : "newTenantBPassport";
    const finInputId = tenantType === "A" ? "newTenantAFin" : "newTenantBFin";

    const newTenantFields = document.getElementById(fieldsId);
    if (newTenantFields) {
      newTenantFields.style.display = "block";

      // Clear the fields
      const nameInput = document.getElementById(nameInputId);
      const passportInput = document.getElementById(passportInputId);
      const finInput = document.getElementById(finInputId);

      if (nameInput) {
        nameInput.value = "";
        nameInput.classList.remove("is-invalid");
      }
      if (passportInput) {
        passportInput.value = "";
        passportInput.classList.remove("is-invalid");
      }
      if (finInput) {
        finInput.value = "";
        finInput.classList.remove("is-invalid");
      }

      // For Tenant A, also clear email field
      if (tenantType === "A") {
        const emailInput = document.getElementById("newTenantAEmail");
        if (emailInput) {
          emailInput.value = "";
          emailInput.classList.remove("is-invalid");
        }
      }

      // Focus on the name field
      if (nameInput) {
        nameInput.focus();
      }

      // Setup event listeners for the input fields
      this.setupNewTenantInputListeners(tenantType);
    }
  }

  showCustomTenantField(tenantType) {
    // Hide the "Add New Tenant" fields
    this.hideNewTenantFields(tenantType);

    // Show the custom text input
    const customFieldId =
      tenantType === "A" ? "customTenantAField" : "customTenantBField";
    const customInputId =
      tenantType === "A" ? "customTenantAText" : "customTenantBText";
    const handlerName =
      tenantType === "A"
        ? "customTenantAInputHandler"
        : "customTenantBInputHandler";

    const customField = document.getElementById(customFieldId);
    if (customField) {
      customField.style.display = "block";

      // Clear and focus the input
      const customInput = document.getElementById(customInputId);
      if (customInput) {
        // Remove existing event listener before clearing value
        if (this[handlerName]) {
          customInput.removeEventListener("input", this[handlerName]);
        }

        customInput.value = "";
        customInput.focus();

        // Add event listener to update preview on input
        this[handlerName] = () => this.updateContractPreview();
        customInput.addEventListener("input", this[handlerName]);
      }
    }
  }

  hideCustomTenantField(tenantType) {
    const customFieldId =
      tenantType === "A" ? "customTenantAField" : "customTenantBField";
    const customField = document.getElementById(customFieldId);
    if (customField) {
      customField.style.display = "none";
    }
  }

  hideNewTenantFields(tenantType = "B") {
    const fieldsId =
      tenantType === "A" ? "newTenantAFields" : "newTenantFields";
    const newTenantFields = document.getElementById(fieldsId);
    if (newTenantFields) {
      newTenantFields.style.display = "none";

      // Only clear temporary tenant selections (those created from "Add New Tenant")
      if (tenantType === "A" && this.selectedTenantA?.isTemporary) {
        this.selectedTenantA = null;
      } else if (tenantType === "B") {
        // For Tenant B (now an array), filter out temporary tenants
        const hadTemporary =
          Array.isArray(this.selectedTenantB) &&
          this.selectedTenantB.some((t) => t?.isTemporary);
        if (hadTemporary) {
          this.selectedTenantB = this.selectedTenantB.filter(
            (t) => !t?.isTemporary,
          );
        }
      }

      // Only update contract preview if we actually cleared a temporary tenant
      const hadTemporaryB =
        tenantType === "B" &&
        Array.isArray(this.selectedTenantB) &&
        this.selectedTenantB.some((t) => t?.isTemporary);
      if (
        (tenantType === "A" && this.selectedTenantA?.isTemporary) ||
        hadTemporaryB
      ) {
        this.updateContractPreview();
      }
    }
  }

  setupNewTenantInputListeners(tenantType) {
    const nameInputId =
      tenantType === "A" ? "newTenantAName" : "newTenantBName";
    const passportInputId =
      tenantType === "A" ? "newTenantAPassport" : "newTenantBPassport";
    const finInputId = tenantType === "A" ? "newTenantAFin" : "newTenantBFin";
    const emailInputId = tenantType === "A" ? "newTenantAEmail" : null;

    const nameInput = document.getElementById(nameInputId);
    const passportInput = document.getElementById(passportInputId);
    const finInput = document.getElementById(finInputId);
    const emailInput = emailInputId
      ? document.getElementById(emailInputId)
      : null;

    if (!nameInput || (!passportInput && !finInput)) {
      return;
    }

    // Create unique handler names for each tenant type
    const inputHandlerProp = `newTenant${tenantType}InputHandler`;
    const blurHandlerProp = `newTenant${tenantType}BlurHandler`;

    // Remove existing listeners if they exist
    if (this[inputHandlerProp]) {
      nameInput.removeEventListener("input", this[inputHandlerProp]);
      if (passportInput)
        passportInput.removeEventListener("input", this[inputHandlerProp]);
      if (finInput)
        finInput.removeEventListener("input", this[inputHandlerProp]);
      if (emailInput)
        emailInput.removeEventListener("input", this[inputHandlerProp]);
    }
    if (this[blurHandlerProp]) {
      nameInput.removeEventListener("blur", this[blurHandlerProp]);
      if (passportInput)
        passportInput.removeEventListener("blur", this[blurHandlerProp]);
      if (finInput) finInput.removeEventListener("blur", this[blurHandlerProp]);
      if (emailInput)
        emailInput.removeEventListener("blur", this[blurHandlerProp]);
    }

    // Create bound handlers
    this[inputHandlerProp] = () => this.handleNewTenantInput(tenantType);
    this[blurHandlerProp] = () => this.handleNewTenantBlur(tenantType);

    // Add event listeners
    nameInput.addEventListener("input", this[inputHandlerProp]);
    if (passportInput) {
      passportInput.addEventListener("input", this[inputHandlerProp]);
      passportInput.addEventListener("blur", this[blurHandlerProp]);
    }
    if (finInput) {
      finInput.addEventListener("input", this[inputHandlerProp]);
      finInput.addEventListener("blur", this[blurHandlerProp]);
    }
    nameInput.addEventListener("blur", this[blurHandlerProp]);

    // Add listeners for email input if it exists (Tenant A only)
    if (emailInput) {
      emailInput.addEventListener("input", this[inputHandlerProp]);
      emailInput.addEventListener("blur", this[blurHandlerProp]);
    }
  }

  handleNewTenantInput(tenantType) {
    const nameInputId =
      tenantType === "A" ? "newTenantAName" : "newTenantBName";
    const passportInputId =
      tenantType === "A" ? "newTenantAPassport" : "newTenantBPassport";
    const finInputId = tenantType === "A" ? "newTenantAFin" : "newTenantBFin";
    const emailInputId = tenantType === "A" ? "newTenantAEmail" : null;

    const nameInput = document.getElementById(nameInputId);
    const passportInput = document.getElementById(passportInputId);
    const finInput = document.getElementById(finInputId);
    const emailInput = emailInputId
      ? document.getElementById(emailInputId)
      : null;

    if (!nameInput) {
      return;
    }

    const name = nameInput.value.trim();
    const passport = passportInput ? passportInput.value.trim() : "";
    const fin = finInput ? finInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";

    // Clear error states when user starts typing
    if (name && nameInput.classList.contains("is-invalid")) {
      nameInput.classList.remove("is-invalid");
    }
    if (
      passport &&
      passportInput &&
      passportInput.classList.contains("is-invalid")
    ) {
      passportInput.classList.remove("is-invalid");
    }
    if (fin && finInput && finInput.classList.contains("is-invalid")) {
      finInput.classList.remove("is-invalid");
    }
    if (emailInput && email && emailInput.classList.contains("is-invalid")) {
      emailInput.classList.remove("is-invalid");
    }

    // If name and at least one ID field have values, create the temporary tenant
    if (name && (passport || fin)) {
      this.createTemporaryTenant(tenantType, name, passport, fin, email);
    }
  }

  handleNewTenantBlur(tenantType) {
    const nameInputId =
      tenantType === "A" ? "newTenantAName" : "newTenantBName";
    const passportInputId =
      tenantType === "A" ? "newTenantAPassport" : "newTenantBPassport";
    const finInputId = tenantType === "A" ? "newTenantAFin" : "newTenantBFin";

    // Validate on blur
    const nameInput = document.getElementById(nameInputId);
    const passportInput = document.getElementById(passportInputId);
    const finInput = document.getElementById(finInputId);

    if (nameInput && !nameInput.value.trim()) {
      nameInput.classList.add("is-invalid");
    }

    // Check that at least one ID field has a value
    const hasPassport = passportInput && passportInput.value.trim();
    const hasFin = finInput && finInput.value.trim();

    if (!hasPassport && !hasFin) {
      if (passportInput && !passportInput.classList.contains("is-invalid")) {
        passportInput.classList.add("is-invalid");
      }
      if (finInput && !finInput.classList.contains("is-invalid")) {
        finInput.classList.add("is-invalid");
      }
    } else {
      // Remove validation errors if at least one ID field is filled
      if (
        passportInput &&
        passportInput.classList.contains("is-invalid") &&
        hasPassport
      ) {
        passportInput.classList.remove("is-invalid");
      }
      if (finInput && finInput.classList.contains("is-invalid") && hasFin) {
        finInput.classList.remove("is-invalid");
      }
    }
  }

  createTemporaryTenant(tenantType, name, passport = "", fin = "", email = "") {
    // Create a temporary tenant object for the contract
    const newTenant = {
      id: `temp_tenant_${tenantType}_${Date.now()}`,
      name: name,
      passportNumber: passport,
      finNumber: fin,
      email: email,
      isTemporary: true,
      createdAt: new Date().toISOString(),
    };

    // Set this as the selected tenant
    if (tenantType === "A") {
      this.selectedTenantA = newTenant;
      console.log("✅ Created temporary tenant A:", this.selectedTenantA);
    } else {
      // For Tenant B, replace the array with just this new tenant
      this.selectedTenantB = [newTenant];
      console.log("✅ Created temporary tenant B:", this.selectedTenantB);
    }

    // Update the contract preview
    this.updateContractPreview();
  }

  setupContractInputs() {
    const inputs = [
      "contractRoom",
      "contractAgreementDate",
      "contractLeasePeriod",
      "contractMoveInDate",
      "contractMoveOutDate",
      "contractMonthlyRental",
      "contractSecurityDeposit",
      "contractDepositMonths",
      "contractAdvanceMonths",
      "contractElectricityBudget",
      "contractCleaningFee",
      "contractPaymentMethod",
    ];

    inputs.forEach((inputId) => {
      const input = document.getElementById(inputId);
      if (input) {
        // Set initial value from contractData
        const field =
          inputId.replace("contract", "").charAt(0).toLowerCase() +
          inputId.replace("contract", "").slice(1);
        if (
          this.contractData[field] !== undefined &&
          this.contractData[field] !== ""
        ) {
          input.value = this.contractData[field];
        }

        // For date inputs, use 'change' event as well as 'input' for better compatibility
        const eventType = input.type === "date" ? "change" : "input";

        // Set up event listener
        input.addEventListener(eventType, () => {
          this.contractData[field] = input.value;
          this.updateContractPreview();
        });

        // For date inputs, also add 'input' event to catch all changes
        if (input.type === "date") {
          input.addEventListener("input", () => {
            this.contractData[field] = input.value;
            this.updateContractPreview();
          });
        }
      }
    });

    // Handle the full payment received checkbox
    const fullPaymentCheckbox = document.getElementById(
      "contractFullPaymentReceived",
    );

    // Handle partial deposit received checkbox
    const partialDepositCheckbox = document.getElementById(
      "contractPartialDepositReceived",
    );
    const partialDepositAmountContainer = document.getElementById(
      "partialDepositAmountContainer",
    );
    const partialDepositAmountInput = document.getElementById(
      "contractPartialDepositAmount",
    );

    if (fullPaymentCheckbox) {
      fullPaymentCheckbox.addEventListener("change", () => {
        this.contractData.fullPaymentReceived = fullPaymentCheckbox.checked;
        // Mutual exclusion: uncheck partial deposit if full payment is checked
        if (fullPaymentCheckbox.checked && partialDepositCheckbox) {
          partialDepositCheckbox.checked = false;
          this.contractData.partialDepositReceived = false;
          this.contractData.partialDepositAmount = "";
          if (partialDepositAmountContainer) {
            partialDepositAmountContainer.style.display = "none";
          }
          if (partialDepositAmountInput) {
            partialDepositAmountInput.value = "";
          }
        }
        this.updateContractPreview();
      });
    }

    // Handle the pest control clause checkbox
    const pestControlCheckbox = document.getElementById("pestControlClause");
    if (pestControlCheckbox) {
      pestControlCheckbox.addEventListener("change", () => {
        this.contractData.pestControlClause = pestControlCheckbox.checked;
        this.updateContractPreview();
      });
    }

    if (partialDepositCheckbox) {
      partialDepositCheckbox.addEventListener("change", () => {
        this.contractData.partialDepositReceived = partialDepositCheckbox.checked;
        // Mutual exclusion: uncheck full payment if partial deposit is checked
        if (partialDepositCheckbox.checked && fullPaymentCheckbox) {
          fullPaymentCheckbox.checked = false;
          this.contractData.fullPaymentReceived = false;
        }
        if (partialDepositAmountContainer) {
          partialDepositAmountContainer.style.display = partialDepositCheckbox.checked
            ? "block"
            : "none";
        }
        if (!partialDepositCheckbox.checked) {
          this.contractData.partialDepositAmount = "";
          if (partialDepositAmountInput) {
            partialDepositAmountInput.value = "";
          }
        }
        this.updateContractPreview();
      });
    }

    if (partialDepositAmountInput) {
      partialDepositAmountInput.addEventListener("input", () => {
        this.contractData.partialDepositAmount = partialDepositAmountInput.value;
        this.updateContractPreview();
      });
    }

    // Handle custom property address input
    const newPropertyAddressInput =
      document.getElementById("newPropertyAddress");
    if (newPropertyAddressInput) {
      newPropertyAddressInput.addEventListener("input", () => {
        this.contractData.address = newPropertyAddressInput.value;
        this.updateContractPreview();
      });
    }
  }

  addClause() {
    this.additionalClauses.push({
      id: Date.now(),
      text: "",
    });
    this.renderAdditionalClauses();
  }

  removeClause(id) {
    this.additionalClauses = this.additionalClauses.filter(
      (clause) => clause.id !== id,
    );
    this.renderAdditionalClauses();
  }

  updateClause(id, text) {
    const clause = this.additionalClauses.find((c) => c.id === id);
    if (clause) {
      clause.text = text;
      this.updateContractPreview();
    }
  }

  renderAdditionalClauses() {
    const container = document.getElementById("additionalClausesContainer");
    if (!container) return;

    let html = "";
    this.additionalClauses.forEach((clause, index) => {
      const letter = String.fromCharCode(97 + index + 21); // Start from 'v' (after existing clauses a-u)
      html += `
                <div class="mb-3 additional-clause" data-id="${clause.id}">
                    <div class="input-group">
                        <span class="input-group-text">${letter})</span>
                        <textarea class="form-control" rows="3" placeholder="${i18next.t("createContract.enterAdditionalClause", "Enter additional clause...")}"
                                  onchange="contractManager.updateClause(${clause.id}, this.value)"
                                  onfocus="this.style.minHeight='120px'">${clause.text}</textarea>
                        <button class="btn btn-outline-danger" type="button" 
                                onclick="contractManager.removeClause(${clause.id})">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                </div>
            `;
    });

    container.innerHTML = html;
    this.updateContractPreview();
  }

  openSignatureUpload(tenantType) {
    let fileInput = document.getElementById("signatureUploadInput");
    if (!fileInput) {
      // Create file input if it doesn't exist
      const input = document.createElement("input");
      input.type = "file";
      input.id = "signatureUploadInput";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      fileInput = input;

      console.log("✅ Created signature upload input element");
    }

    // Clear any previous files
    fileInput.value = "";

    this.currentSignatureType = tenantType;
    console.log(`📁 Opening signature upload for Tenant ${tenantType}`);

    // Remove any existing event listeners to avoid duplicates
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);

    // Add fresh event listener for file selection
    newFileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        console.log(`📎 File selected: ${e.target.files[0].name}`);
        this.uploadSignature(e.target.files[0], tenantType);
      } else {
        console.log("❌ No file selected");
      }
    });

    // Trigger file selection
    newFileInput.click();
  }

  async uploadSignature(file, tenantType) {
    // Get the upload button for loading state
    const uploadButton = document.querySelector(
      `button[onclick="contractManager.openSignatureUpload('${tenantType}')"]`,
    );
    const originalText = uploadButton ? uploadButton.innerHTML : "";

    try {
      console.log(
        `🔄 Starting signature upload for Tenant ${tenantType}`,
        file,
      );

      // Validate file type and size
      if (!file.type.startsWith("image/")) {
        alert(
          i18next.t(
            "createContract.pleaseSelectImage",
            "Please select an image file (PNG, JPG, etc.)",
          ),
        );
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        alert(
          i18next.t(
            "createContract.fileSizeMustBeLess",
            "File size must be less than 10MB",
          ),
        );
        return;
      }

      // Show loading state
      if (uploadButton) {
        uploadButton.disabled = true;
        uploadButton.innerHTML =
          '<i class="bi bi-hourglass-split"></i> Uploading...';
      }

      const formData = new FormData();
      formData.append("image", file);

      const uploadUrl = buildApiUrl(
        API_CONFIG.ENDPOINTS.UPLOAD_TENANT_DOCUMENT,
      );
      console.log("🔧 Upload URL:", uploadUrl);

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Upload failed with status: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log("🔧 Upload result:", result);

      if (result.success && result.url) {
        let imageUrl = result.url;

        // Ensure URL is properly formatted
        if (imageUrl && !imageUrl.startsWith("http")) {
          if (imageUrl.startsWith("/")) {
            imageUrl = API_CONFIG.BASE_URL + imageUrl;
          } else {
            imageUrl = "https://" + imageUrl;
          }
        }

        this.signatures[tenantType] = imageUrl;
        this.updateSignaturePreview(tenantType);
        this.updateContractPreview(); // Update the contract preview with the new signature
        console.log(
          `✅ Signature uploaded successfully for Tenant ${tenantType}:`,
          imageUrl,
        );

        // Show success message briefly
        if (uploadButton) {
          uploadButton.innerHTML =
            '<i class="bi bi-check-circle text-success"></i> Uploaded!';
          setTimeout(() => {
            uploadButton.innerHTML = originalText;
            uploadButton.disabled = false;
          }, 2000);
        }
      } else {
        throw new Error(result.error || "Unknown upload error");
      }
    } catch (error) {
      console.error("❌ Error uploading signature:", error);
      alert(`Error uploading signature: ${error.message}. Please try again.`);

      // Reset button state
      if (uploadButton) {
        uploadButton.innerHTML = originalText;
        uploadButton.disabled = false;
      }
    }
  }

  updateSignaturePreview(tenantType) {
    const preview = document.getElementById(`signature${tenantType}Preview`);
    if (!preview) return;

    const signature = this.signatures[tenantType];

    if (!signature) {
      preview.innerHTML = `
                <div class="text-center p-3 border border-dashed rounded">
                    <i class="bi bi-pen fs-2 text-muted"></i>
                    <p class="text-muted mb-0">No signature uploaded</p>
                </div>
            `;
      return;
    }

    preview.innerHTML = `
            <div class="position-relative">
                <img src="${signature}" alt="Tenant ${tenantType} Signature" 
                     class="img-fluid border rounded" style="max-height: 100px;">
                <button type="button" 
                        class="btn btn-danger btn-sm position-absolute top-0 end-0 m-1"
                        onclick="contractManager.removeSignature('${tenantType}')"
                        style="border-radius: 50%; width: 30px; height: 30px; padding: 0;">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `;
  }

  removeSignature(tenantType) {
    this.signatures[tenantType] = null;
    this.updateSignaturePreview(tenantType);
    this.updateContractPreview(); // Update the contract preview after removing signature
  }

  updateContractPreview() {
    console.log("🔄 updateContractPreview called");
    const preview = document.getElementById("contractPreview");
    if (!preview) {
      console.log("❌ Contract preview element not found");
      return;
    }

    console.log("🔧 selectedTenantA:", this.selectedTenantA);
    console.log("🔧 selectedTenantB:", this.selectedTenantB);

    // Check for custom text inputs
    const customTenantAText = document.getElementById("customTenantAText");
    const customTenantBText = document.getElementById("customTenantBText");
    const customAddressText = document.getElementById("customAddressText");

    const tenantAInfo = this.selectedTenantA
      ? {
          name: this.selectedTenantA.name,
          passport:
            this.selectedTenantA.passportNumber ||
            this.selectedTenantA.passport ||
            "",
          fin: this.selectedTenantA.finNumber || this.selectedTenantA.fin || "",
          email: this.selectedTenantA.email || "",
        }
      : customTenantAText && customTenantAText.value.trim()
        ? {
            name: customTenantAText.value.trim(),
            passport: "",
            fin: "",
            email: "",
          }
        : {
            name: "[Tenant A Name]",
            passport: "[Tenant A Passport]",
            fin: "[Tenant A FIN]",
            email: "[Email]",
          };

    // Handle multiple Tenant B selections
    let tenantBInfo;
    if (
      Array.isArray(this.selectedTenantB) &&
      this.selectedTenantB.length > 0
    ) {
      // Multiple tenants selected
      tenantBInfo = this.selectedTenantB.map((tenant) => ({
        name: tenant.name,
        passport: tenant.passportNumber || tenant.passport || "",
        fin: tenant.finNumber || tenant.fin || "",
      }));
    } else if (customTenantBText && customTenantBText.value.trim()) {
      // Custom text input
      tenantBInfo = [
        {
          name: customTenantBText.value.trim(),
          passport: "",
          fin: "",
        },
      ];
    } else {
      // No tenant selected - show placeholder
      tenantBInfo = [
        {
          name: "[Tenant B Name]",
          passport: "[Tenant B Passport]",
          fin: "[Tenant B FIN]",
        },
      ];
    }

    console.log("🔧 tenantAInfo:", tenantAInfo);
    console.log("🔧 tenantBInfo:", tenantBInfo);

    // Generate additional clauses HTML
    let additionalClausesHtml = "";
    this.additionalClauses.forEach((clause, index) => {
      const letter = String.fromCharCode(97 + index + 12); // Start from 'm'
      if (clause.text.trim()) {
        additionalClausesHtml += `<p>${letter}) ${clause.text}</p>\n`;
      }
    });

    // Get property address from custom input if available
    const propertyAddress =
      customAddressText && customAddressText.value.trim()
        ? customAddressText.value.trim()
        : this.contractData.address || "[Property Address]";

    preview.innerHTML = `
            <div class="contract-content" style="font-family: 'Times New Roman', serif; line-height: 1.6; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="font-weight: bold; margin-bottom: 10px;">HOUSE SHARING AGREEMENT</h2>
                    <p><strong>Full address:</strong> ${propertyAddress}</p>
                    <p><strong>Room:</strong> ${this.formatRoomType(
                      this.contractData.room,
                    )}</p>
                    <p><strong>THIS AGREEMENT is made on:</strong> ${
                      this.contractData.agreementDate ||
                      new Date().toISOString().split("T")[0]
                    }</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p><strong>BETWEEN</strong></p>
                    <p style="margin-left: 20px;">
                        <strong>Main tenant:</strong> ${tenantAInfo.name}<br>
                        ${
                          tenantAInfo.passport
                            ? `<strong>Passport:</strong> ${tenantAInfo.passport}<br>`
                            : ""
                        }
                        ${
                          tenantAInfo.fin
                            ? `<strong>FIN:</strong> ${tenantAInfo.fin}<br>`
                            : ""
                        }
                        <strong>Email:</strong> ${tenantAInfo.email}
                    </p>
                    <p style="margin-left: 20px; font-style: italic;">
                        (Hereinafter called "Tenant A", which expression together, where the context so admits, shall include all persons having title under 'Tenant A') of the one part.
                    </p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p><strong>AND</strong></p>
                    ${tenantBInfo
                      .map(
                        (tenant, index) => `
                        <p style="margin-left: 20px;">
                            ${tenantBInfo.length > 1 ? `<strong>Tenant ${index + 1}:</strong><br>` : ""}
                            <strong>Name:</strong> ${tenant.name}<br>
                            ${
                              tenant.passport
                                ? `<strong>Passport:</strong> ${tenant.passport}<br>`
                                : ""
                            }
                            ${
                              tenant.fin
                                ? `<strong>FIN:</strong> ${tenant.fin}`
                                : ""
                            }
                        </p>
                    `,
                      )
                      .join("")}
                    <p style="margin-left: 20px; font-style: italic;">
                        (Hereinafter called "Tenant B", which expression together, where the context so admits, shall include all persons having title under 'Tenant B') of the other part.
                    </p>
                </div>

                <p><strong>Payment method:</strong> ${this.formatPaymentMethod(
                  this.contractData.paymentMethod,
                )}</p>

                <div style="margin: 30px 0;">
                    <p><strong>NOW IT IS HEREBY AGREED AS FOLLOWS:</strong></p>
                    
                    <div style="margin: 20px 0; line-height: 1.8;">
                        <p><strong>Lease Period:</strong> ${this.formatLeasePeriod()}</p>

                        <p><strong>Tenancy Period:</strong> ${this.formatTenancyPeriod()}</p>
                        
                        <p><strong>Moving Time:</strong> Move in after 15:00, Move out before 11:00</p>
                        
                        <p><strong>Monthly Rental:</strong> $${
                          this.contractData.monthlyRental || "[Monthly Rental]"
                        }<br>
                        <small style="margin-left: 20px;">*Room rental rate is strictly confidential<br>
                        *Renewal contract is subject to mutual agreement by Tenant A and Tenant B${
                          this.contractData.fullPaymentReceived
                            ? `<br><strong style="font-size: 14px;">*Tenant A hereby confirms receipt of full rental payment for the entire tenancy period (S$${this.calculateTotalRental().toFixed(
                                2,
                              )})</strong>`
                            : '<br>*Payable by the 1st Day of each calendar month to "Tenant A"'
                        }</small></p>
                        
                        <p><strong>Security Deposit:</strong> $${
                          this.contractData.securityDeposit ||
                          this.contractData.monthlyRental ||
                          "[Security Deposit]"
                        }${
                          this.contractData.partialDepositReceived &&
                          this.contractData.partialDepositAmount
                            ? ` <em>(Partial deposit received: $${this.contractData.partialDepositAmount})</em>`
                            : ""
                        }<br>
                        <small style="margin-left: 20px;">*This deposit shall not be utilised to set off rent due and payable during the currency of this Agreement</small></p>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <p><small>Monthly rentals include Wi-Fi, utilities, gas, usage of condominium facilities such as swimming pool, barbecue pit and multi-purpose hall.</small></p>
                </div>

                <div style="margin: 20px 0;">
                    <p><strong>1. TENANT B(S) HEREBY AGREE(S) WITH TENANT A AS FOLLOWS:</strong></p>
                    <div style="margin-left: 20px;">
                        ${
                          this.contractData.fullPaymentReceived
                            ? ""
                            : `<p><strong>a)</strong> To pay the equivalent of ${this.formatMonthsText(this.contractData.depositMonths || 1)}'s rent as a deposit on the agreement date (${
                                this.contractData.agreementDate
                                  ? this.formatDate(
                                      this.contractData.agreementDate,
                                    )
                                  : "[Agreement Date]"
                              }) and ${this.formatMonthsText(this.contractData.advanceMonths || 1)}'s rent as an advance on the move-in date (${
                                this.contractData.moveInDate
                                  ? this.formatDate(
                                      this.contractData.moveInDate,
                                    )
                                  : "[Move-in Date]"
                              }). The deposit is to be held by TenantA as security for the due performance and observance by TenantB of all covenants, conditions, and stipulations on the part of Tenant B herein contained, failing which TenantB shall forfeit to TenantA the said deposit or such part thereof as may be necessary to remedy such default. PROVIDED ALWAYS that Tenant B shall duly perform the said covenants, conditions, and stipulations as aforesaid, up to and including the date of expiration of the term hereby created, Tenant A shall repay the said deposit within 7 (SEVEN) days from the date of such expiration without any interest. This deposit shall not be utilised to offset any rent due and payable during the currency of this Agreement. Such deposit shall be refundable at the end of the term, less deduction for damages caused by the negligence of Tenant B and of any breach of this Agreement.</p>`
                        }
                        
                        ${
                          this.contractData.fullPaymentReceived
                            ? ""
                            : "<p><strong>b)</strong> In addition, and without prejudice to any other right power or remedy of Tenant A if the rent hereby reserved or any part thereof shall remain unpaid for 7 (SEVEN) days after the same shall have become due (whether any formal or legal demand therefore shall have been made or not) then, Tenant A shall forfeit the security deposit and at anytime thereafter, repossess The Room and remove all Tenant B's belongings from The Room without being liable for any loss or damage of such removal. Tenant A shall be entitled to recover all legal fees arising from the recovery of unpaid rent by Tenant B.</p>"
                        }
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "a" : "c"
                        })</strong> To use and manage the room, premises, and furniture therein in a careful manner and to keep the interior of the premises in a GOOD, CLEAN, TIDY, and TENANTABLE condition except for normal fair wear and tear.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "b" : "d"
                        })</strong> Not to do or permit to be done upon the premises or room anything which may be unlawful, immoral, or become a nuisance or annoyance to occupiers of adjoining or adjacent room(s).</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "c" : "e"
                        })</strong> To use the premises for the purpose of private residence only and not to assign, sublet, or otherwise part possession of the premises or any part thereof without the written consent of Tenant A.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "d" : "f"
                        })</strong> To peaceably and quietly at the expiration of the tenancy deliver up to Tenant A the room in like condition as the same was delivered to Tenant B at the commencement of this Agreement, except for fair wear and tear.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "e" : "g"
                        })</strong> Not to create a nuisance, not to use the premises or any part thereof in a manner which may become a nuisance or annoyance to TenantA or the occupants of the premises, building or to neighbouring parties.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "f" : "h"
                        })</strong> Strictly NO PETS in the premises.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "g" : "i"
                        })</strong> No illegal or immoral activities, not to do or suffer to be done anything in or upon the said premises or any part thereof, any activities of an illegal or immoral nature.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "h" : "j"
                        })</strong> To permit Tenant A to carryout due diligence checks to ensure that all times during the currency of this Agreement that Tenant B and/or permitted occupants are not illegal immigrants and comply with all the rules and regulations relating to the Immigration Act and the Employment of Foreign Workers Act (if applicable) and any other Act of Parliament, regulations, or any rules of orders thereunder which relates to foreign residents and workers.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "i" : "k"
                        })</strong> To provide TenantA, upon request, for physical inspection, all immigration and employment documents, including but not limited to the passports of all non-local occupants, the employment pass and/or work permits, proof of employment, and to provide TenantA with certified true copies of such documents.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "j" : "l"
                        })</strong> Not to bring or store or permit to be brought or stored in the premises or any part thereof any goods which are of a dangerous, obnoxious, inflammable or hazardous nature.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "k" : "m"
                        })</strong> At the expiration of the term hereby created, to deliver up the room peacefully and quietly in like condition as the same were delivered to Tenant B at the commencement of the term hereby created. Authorised alterations or additions, fair wear and tear. As the room is delivered in clean condition, Tenant B is expected to clear all personal belongings from the room and the premises, clean the room and their designated area spick and span, in like condition as the same were delivered. In failing to do so, a minimum of SGD$150 (SINGAPORE DOLLARS ONE HUNDRED AND FIFTY ONLY) will be deducted from the security deposit for the time spent cleaning the place.</p>

                        ${
                          this.hasAircon()
                            ? `<p><strong>${
                                this.contractData.fullPaymentReceived
                                  ? "l"
                                  : "n"
                              })</strong> For 6 6-month agreement, the deposit money will be deducted SGD$100 for Air-conditioner services. On a 1-year agreement, the deduction level would be SGD$200. ONLY APPLY FOR A ROOM WITH AN AIR-CONDITIONER.</p>`
                            : ""
                        }

                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "m"
                              : "o"
                            : this.contractData.fullPaymentReceived
                              ? "l"
                              : "n"
                        })</strong> Cost of damage for common area facilities provided previously by Tenant A will be handled by both parties. For the first 200 (SGD) in any single bill, the bill would be divided among all subtenants of the unit. The exceeding amount would be handled by Tenant A. Only applied for 6 months lease and above.</p>
                        
                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "n"
                              : "p"
                            : this.contractData.fullPaymentReceived
                              ? "m"
                              : "o"
                        })</strong> No smoking, vaping in the house (the first time violated will get a warning; the next time violated will lead to the contract's termination). Vaping is now illegal in Singapore, and being caught can lead to a jail sentence.</p>

                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "o"
                              : "q"
                            : this.contractData.fullPaymentReceived
                              ? "n"
                              : "p"
                        })</strong> No visitors without permission from Tenant B to Tenant A.</p>

                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "p"
                              : "r"
                            : this.contractData.fullPaymentReceived
                              ? "o"
                              : "q"
                        })</strong> No gathering (with/without alcoholic consumption) without permission from Tenant A.</p>

                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "q"
                              : "s"
                            : this.contractData.fullPaymentReceived
                              ? "p"
                              : "r"
                        })</strong> Strictly keep silent after 10:00 pm (the tenant will receive a warning for the first two times; the third time violation will lead to the contract's termination).</p>

                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "r"
                              : "t"
                            : this.contractData.fullPaymentReceived
                              ? "q"
                              : "s"
                        })</strong> Tenant B shall provide written notice to Tenant A at least thirty (30) days before the expiration of the lease term, indicating whether Tenant B intends to renew the tenancy or vacate the premises upon the lease's conclusion.</p>

                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "s"
                              : "u"
                            : this.contractData.fullPaymentReceived
                              ? "r"
                              : "t"
                        })</strong> Strictly NO DRUGS or drug-related activities in the premises. Drug possession, consumption, or trafficking is illegal in Singapore and carries severe penalties including imprisonment, caning, and even death penalty for serious drug offenses. Any violation will result in immediate termination of this Agreement and forfeiture of all deposits.</p>

                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "t"
                              : "v"
                            : this.contractData.fullPaymentReceived
                              ? "s"
                              : "u"
                        })</strong> No electricity reconnection, rewiring, or electrical modifications without prior written consent from Tenant A. Unauthorized electrical work can cause fires, leading to significant property damage and personal injury. Any unauthorized electrical modifications will result in immediate termination of this Agreement and Tenant B will be liable for all damages.</p>

                        <p><strong>${
                          this.hasAircon()
                            ? this.contractData.fullPaymentReceived
                              ? "u"
                              : "w"
                            : this.contractData.fullPaymentReceived
                              ? "t"
                              : "v"
                        })</strong> Early Termination And Notice Period: Should Tenant B wish to terminate this Agreement prior to the expiration of the lease term, Tenant B shall give to Tenant A not less than thirty (30) calendar days' prior written notice of such intention to quit and surrender the premises. Upon compliance with this notice requirement and subject to Tenant B fulfilling all obligations under this Agreement including but not limited to payment of all outstanding rent, utilities, and restoration of the premises to its original condition (fair wear and tear excepted), the security deposit shall be refunded in full within seven (7) days of the termination date. However, should Tenant B fail to provide the requisite thirty (30) days' written notice, or terminate this Agreement without such notice, Tenant B shall forfeit the entire security deposit as liquidated damages for breach of this covenant, and such forfeiture shall be in addition to any other remedies available to Tenant A at law or in equity.</p>

                        ${
                          this.contractData.pestControlClause
                            ? `<p><strong>${
                                this.hasAircon()
                                  ? this.contractData.fullPaymentReceived
                                    ? "v"
                                    : "x"
                                  : this.contractData.fullPaymentReceived
                                    ? "u"
                                    : "w"
                              })</strong> PEST INFESTATION LIABILITY: The Tenant B acknowledges that the premises have been inspected and are delivered free from any pest infestation including but not limited to bedbugs, cockroaches, ants, and other vermin. The Tenant B shall ensure proper hygiene and cleanliness of all personal belongings, bedding, and furniture before moving into the premises. In the event that any pest infestation is discovered within the premises during the tenancy period, the Tenant B shall be liable for pest control treatment costs and replacement of any damaged furniture, fixtures, or belongings up to a maximum amount of SGD$1,000.00. The Tenant B agrees to immediately notify Tenant A upon discovery of any signs of pest infestation and shall cooperate fully in any pest control measures undertaken.</p>`
                            : ""
                        }


                        ${additionalClausesHtml}
                    </div>
                </div>

                <div style="margin: 30px 0;">
                    <p><strong>2) AND PROVIDED ALWAYS AS IT IS HEREBY AGREED AS FOLLOWS:</strong></p>
                    <div style="margin-left: 20px;">
                        ${
                          this.contractData.fullPaymentReceived
                            ? "<p>If any covenants, conditions or stipulations on Tenant B's part herein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained.</p>"
                            : "<p>If the rent hereby reserved or any part thereof shall be unpaid for 7 (SEVEN) days after becoming payable (whether formally demanded in writing or not) OR if any covenants, conditions or stipulations on Tenant B's part therein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained. Tenant A shall terminate the agreement and forfeit the deposit forthwith.</p>"
                        }
                        
                        <p>Notwithstanding herein contained, Tenant A shall be under no liability to Tenant B for accidents happening, injuries sustained, or loss of life and damage to the property, goods, or chattels in the premises or in any part.</p>
                        
                        <p><strong>a) ELECTRICITY:</strong> A monthly budget of S$${
                          this.contractData.electricityBudget || "400"
                        } (SINGAPORE DOLLARS ${this.numberToWords(
                          parseInt(
                            this.contractData.electricityBudget || "400",
                          ),
                        ).toUpperCase()} ONLY) is set for the SP bills for the whole unit. Under circumstances where the total utility bill exceeds the limit cap, the outstanding due will be divided proportionally between all tenants of the unit. Tenant A reserved the right to claim from Tenant B. ONLY APPLY FOR A ROOM WITH AN AIR CONDITIONER.</p>
                        
                        <p><strong>b)</strong> Tenant B must produce an original/photocopy of documents such as NRIC/Passport/Work Permit/Employment Pass/Student Pass to prove his/her identity and legitimate stay in Singapore.</p>
                        
                        <p><strong>c)</strong> Security deposit will be refunded within 7 (SEVEN) days at the end of the lease after deducting any outstanding fees, with no interest.</p>
                        
                        ${
                          this.contractData.fullPaymentReceived
                            ? ""
                            : "<p><strong>d)</strong> Tenant B will be asked to leave the apartment within 1 (ONE) to 7 (SEVEN) days at the discretion of Tenant A for breach of agreement, and/or any terms and conditions stated in this Agreement if the rental is not paid by the first day of each calendar month.</p>"
                        }
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "d" : "e"
                        })</strong> The law applicable in any action arising out of this lease shall be the law of the Republic of Singapore, and the parties hereto submit themselves to the jurisdiction of the laws of Singapore.</p>
                        
                        <p><strong>${
                          this.contractData.fullPaymentReceived ? "e" : "f"
                        })</strong> Cleaning fee: SGD$${
                          this.contractData.cleaningFee || "20"
                        } / 1pax (if all tenants agree to hire a cleaning service)</p>
                    </div>
                </div>

                <div style="margin: 30px 0; text-align: center; page-break-inside: avoid; break-inside: avoid;">
                    <p><strong>By signing below, both parties agree to abide by all the above terms and conditions</strong></p>
                
                    <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;">
                        <p><strong>Tenant A</strong></p>
                        <div style="height: 80px; margin: 20px 0;">
                            ${
                              this.signatures.tenantA
                                ? `<img src="${this.signatures.tenantA}" alt="Tenant A Signature" style="max-height: 60px;">`
                                : '<div style="height: 60px;"></div>'
                            }
                        </div>
                        <p>${tenantAInfo.name}</p>
                    </div>
                    <div style="text-align: center;">
                        <p><strong>Tenant B</strong></p>
                        <div style="height: 80px; margin: 20px 0;">
                            ${
                              this.signatures.tenantB
                                ? `<img src="${this.signatures.tenantB}" alt="Tenant B Signature" style="max-height: 60px;">`
                                : '<div style="height: 60px;"></div>'
                            }
                        </div>
                        <p>${tenantBInfo.name}</p>
                    </div>
                    </div>
                </div>
            </div>
        `;
  }

  // Helper method to calculate total rental amount
  calculateTotalRental() {
    const monthlyRental = parseFloat(this.contractData.monthlyRental) || 0;
    const leasePeriod = this.contractData.leasePeriod || "";

    // Extract number of months from lease period (e.g., "6 months", "12 months", "1 year")
    let months = 0;
    const leasePeriodLower = leasePeriod.toLowerCase();

    if (leasePeriodLower.includes("month")) {
      // Extract number before 'month' or 'months'
      const match = leasePeriodLower.match(/(\d+)\s*months?/);
      if (match) {
        months = parseInt(match[1]);
      }
    } else if (leasePeriodLower.includes("year")) {
      // Extract number before 'year' or 'years' and convert to months
      const match = leasePeriodLower.match(/(\d+)\s*years?/);
      if (match) {
        months = parseInt(match[1]) * 12;
      }
    }

    return monthlyRental * months;
  }

  // Helper method to check if a tenant is a main tenant
  isMainTenant(tenant) {
    if (!tenant || !tenant.properties || !Array.isArray(tenant.properties)) {
      return false;
    }

    // Check if any of the tenant's properties has them as main tenant
    return tenant.properties.some((prop) => {
      return typeof prop === "object" && prop.isMainTenant;
    });
  }

  formatTenancyPeriod() {
    const moveInDate = this.contractData.moveInDate;
    const moveOutDate = this.contractData.moveOutDate;

    if (!moveInDate && !moveOutDate) {
      return "[Tenancy Period]";
    }

    if (!moveInDate) {
      return `[Move-in Date] - ${this.formatDate(moveOutDate)}`;
    }

    if (!moveOutDate) {
      return `${this.formatDate(moveInDate)} - [Move-out Date]`;
    }

    return `${this.formatDate(moveInDate)} - ${this.formatDate(moveOutDate)}`;
  }

  formatDate(dateString) {
    if (!dateString) return "[Date]";

    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, "0");
      const monthNames = [
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
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return dateString;
    }
  }

  formatPaymentMethod(method) {
    const paymentMethods = {
      CASH: "Cash",
      BANK_TRANSFER: "Bank Transfer",
      CHECK: "Check",
    };

    return paymentMethods[method] || method || "Cash";
  }

  formatRoomType(roomType) {
    if (!roomType) return "[Room Type]";

    // Map of room type codes to display labels
    const roomTypeLabels = {
      COMMON1: "Common 1",
      COMMON2: "Common 2",
      MASTER: "Master",
      COMPARTMENT1: "Compartment 1",
      COMPARTMENT2: "Compartment 2",
      STORE: "Store",
      COMMON_1_PAX: "Common 1 Pax",
      COMMON_2_PAX: "Common 2 Pax",
      SMALL_SINGLE_1_PAX: "Small Single 1 Pax",
      SMALL_SINGLE_2_PAX: "Small Single 2 Pax",
      BIG_SINGLE_1_PAX: "Big Single 1 Pax",
      BIG_SINGLE_2_PAX: "Big Single 2 Pax",
      SINGLE_1_PAX_NO_AIRCON: "Single 1 Pax No Aircon",
      SINGLE_2_PAX_NO_AIRCON: "Single 2 Pax No Aircon",
      MEDIUM_SINGLE_1_PAX: "Medium Single Room (1 Pax)",
      LARGE_SINGLE_1_PAX: "Large Single Room (1 Pax)",
      SMALL_SHARED_2_PAX: "Small Shared Room (2 Pax)",
      MEDIUM_SHARED_2_PAX: "Medium Shared Room (2 Pax)",
      LARGE_SHARED_2_PAX: "Large Shared Room (2 Pax)",
      MASTER_BEDROOM: "Master Bedroom",
      COMMON_ROOM: "Common Room",
      STUDIO: "Studio",
      ONE_BEDROOM: "1 Bedroom",
      TWO_BEDROOM: "2 Bedroom",
      THREE_BEDROOM: "3 Bedroom",
    };

    return roomTypeLabels[roomType] || roomType;
  }

  formatDateForFilename(dateString) {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, "0");
      const monthNames = [
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
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year
      return `${day}${month}${year}`;
    } catch (e) {
      return "";
    }
  }

  hasAircon() {
    // Check if room type includes "NO_AIRCON"
    const roomType = this.contractData.room || "";
    return !roomType.includes("NO_AIRCON");
  }

  calculateLeasePeriod(moveInDate, moveOutDate) {
    if (!moveInDate || !moveOutDate) {
      return null;
    }

    try {
      const startDate = new Date(moveInDate);
      const endDate = new Date(moveOutDate);

      // Calculate total days
      const totalDays = Math.floor(
        (endDate - startDate) / (1000 * 60 * 60 * 24),
      );

      if (totalDays < 0) {
        return null; // Invalid date range
      }

      // Calculate months, weeks, and days
      const months = Math.floor(totalDays / 30);
      const remainingDaysAfterMonths = totalDays % 30;
      const weeks = Math.floor(remainingDaysAfterMonths / 7);
      const days = remainingDaysAfterMonths % 7;

      // Build the lease period string
      const parts = [];

      if (months > 0) {
        parts.push(`${months} month${months > 1 ? "s" : ""}`);
      }

      if (weeks > 0) {
        parts.push(`${weeks} week${weeks > 1 ? "s" : ""}`);
      }

      if (days > 0) {
        parts.push(`${days} day${days > 1 ? "s" : ""}`);
      }

      return parts.length > 0 ? parts.join(", ") : "0 days";
    } catch (e) {
      console.error("Error calculating lease period:", e);
      return null;
    }
  }

  formatLeasePeriod() {
    // If lease period is manually entered, use it
    if (
      this.contractData.leasePeriod &&
      this.contractData.leasePeriod.trim() !== ""
    ) {
      return this.contractData.leasePeriod;
    }

    // Otherwise, calculate from move-in and move-out dates
    const calculated = this.calculateLeasePeriod(
      this.contractData.moveInDate,
      this.contractData.moveOutDate,
    );

    return calculated || "[Lease Period]";
  }

  formatMonthsText(months) {
    if (!months || months == 0) return "0 (ZERO) month";

    const num = parseFloat(months);
    if (num === 0.5) {
      return "0.5 (HALF) month";
    } else if (num === 1) {
      return "1 (ONE) month";
    } else if (num === 1.5) {
      return "1.5 (ONE AND A HALF) months";
    } else if (num === 2) {
      return "2 (TWO) months";
    } else if (num === 2.5) {
      return "2.5 (TWO AND A HALF) months";
    } else if (num === 3) {
      return "3 (THREE) months";
    } else {
      const word = this.numberToWords(Math.floor(num)).toUpperCase();
      const decimal = num % 1;
      if (decimal === 0.5) {
        return `${num} (${word} AND A HALF) months`;
      }
      return `${num} (${word}) months`;
    }
  }

  numberToWords(num) {
    const ones = [
      "",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
      "thirteen",
      "fourteen",
      "fifteen",
      "sixteen",
      "seventeen",
      "eighteen",
      "nineteen",
    ];
    const tens = [
      "",
      "",
      "twenty",
      "thirty",
      "forty",
      "fifty",
      "sixty",
      "seventy",
      "eighty",
      "ninety",
    ];

    if (num === 0) return "zero";
    if (num < 20) return ones[num];
    if (num < 100)
      return (
        tens[Math.floor(num / 10)] +
        (num % 10 !== 0 ? " " + ones[num % 10] : "")
      );
    if (num < 1000) {
      const hundreds = Math.floor(num / 100);
      const remainder = num % 100;
      let result = ones[hundreds] + " hundred";
      if (remainder !== 0) {
        result += " " + this.numberToWords(remainder);
      }
      return result;
    }
    if (num < 1000000) {
      const thousands = Math.floor(num / 1000);
      const remainder = num % 1000;
      let result = this.numberToWords(thousands) + " thousand";
      if (remainder !== 0) {
        result += " " + this.numberToWords(remainder);
      }
      return result;
    }

    return num.toString();
  }

  async exportToPDF() {
    try {
      // Sync form values to contractData before export to ensure we have the latest values
      this.syncFormValuesToContractData();

      // Show loading state
      const exportBtn = document.querySelector(
        '[onclick="contractManager.exportToPDF()"]',
      );
      if (exportBtn) {
        exportBtn.innerHTML =
          '<i class="bi bi-hourglass-split me-1"></i>Generating PDF...';
        exportBtn.disabled = true;
      }

      // Wait for libraries to be loaded
      if (typeof html2canvas === "undefined") {
        console.log("Loading html2canvas...");
        await new Promise((resolve) => {
          const checkHtml2Canvas = () => {
            if (typeof html2canvas !== "undefined") {
              resolve();
            } else {
              setTimeout(checkHtml2Canvas, 100);
            }
          };
          checkHtml2Canvas();
        });
      }

      // jsPDF should be available as it's imported as a dependency
      if (typeof jsPDF === "undefined") {
        throw new Error("jsPDF library not available - check imports");
      }

      const contractContent = document.getElementById("contractPreview");
      if (!contractContent) {
        throw new Error("Contract preview not found");
      }

      // Create PDF filename in format: [tenantB]-[roomType]-[rent]-[moveIn]-[moveOut]-[propertyAddress]
      const tenantBName =
        Array.isArray(this.selectedTenantB) && this.selectedTenantB.length > 0
          ? this.selectedTenantB
              .map((t) => t.name)
              .join("_")
              .replace(/[^a-zA-Z0-9_]/g, "_")
          : "TenantB";
      const roomType = this.formatRoomType(this.contractData.room).replace(
        /[^a-zA-Z0-9]/g,
        "_",
      );

      // Add monthly rental to filename
      const monthlyRent = this.contractData.monthlyRental
        ? `${this.contractData.monthlyRental}`
        : "0";

      // Format dates for filename (DDMMMYY)
      const moveInDateFormatted = this.formatDateForFilename(
        this.contractData.moveInDate,
      );
      const moveOutDateFormatted = this.formatDateForFilename(
        this.contractData.moveOutDate,
      );
      const dateRange =
        moveInDateFormatted && moveOutDateFormatted
          ? `${moveInDateFormatted}-${moveOutDateFormatted}`
          : "";

      // Get address from custom input if available, otherwise from contractData
      const customAddressText = document.getElementById("customAddressText");
      const addressSource =
        customAddressText && customAddressText.value.trim()
          ? customAddressText.value.trim()
          : this.contractData.address;

      // Remove Singapore and postcode from address for filename
      let cleanAddress = addressSource || "Address";
      // Remove Singapore and common variations
      cleanAddress = cleanAddress.replace(/,?\s*Singapore\s*\d*$/i, "");
      cleanAddress = cleanAddress.replace(/,?\s*S\d{6}$/i, ""); // Remove Singapore postcode format
      cleanAddress = cleanAddress.replace(/,?\s*\d{6}$/i, ""); // Remove 6-digit postcode
      const propertyAddress =
        cleanAddress.replace(/[^a-zA-Z0-9]/g, "_") || "Address";

      // Build filename: [tenantB]-[roomType]-[rent]-[dateRange]-[address]
      const filenameParts = [tenantBName, roomType, monthlyRent];
      if (dateRange) {
        filenameParts.push(dateRange);
      }
      filenameParts.push(propertyAddress);

      const filename = `${filenameParts.join("-")}.pdf`;

      console.log("📄 Creating text-based PDF...");

      // Create PDF with text-based approach for better control
      const pdf = new jsPDF("p", "mm", "a4");

      // A4 dimensions in mm
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;

      let currentY = margin;
      const lineHeight = 5;

      // Helper function to add page numbers at the bottom center of each page
      const addPageNumbers = () => {
        const totalPages = pdf.internal.getNumberOfPages();

        // Save current settings
        const currentFontSize = pdf.internal.getFontSize();
        const currentFont = pdf.internal.getFont();

        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(10);
          pdf.setFont(undefined, "normal");

          // Add page number at middle bottom
          const pageText = `${i}`;
          const textWidth = pdf.getTextWidth(pageText);
          const x = (pageWidth - textWidth) / 2;
          const y = pageHeight - 10; // 10mm from bottom

          pdf.text(pageText, x, y);
        }

        // Restore settings
        pdf.setFontSize(currentFontSize);
        pdf.setFont(currentFont.fontName, currentFont.fontStyle);
      };

      // Helper function to add text with automatic page breaks
      const addText = (text, options = {}) => {
        // If text is empty/null/undefined, just add spacing if provided
        if (!text || String(text).trim() === "") {
          currentY += options.spacing || 0;
          return;
        }

        const fontSize = options.fontSize || 10;
        const isBold = options.bold || false;
        const isCenter = options.center || false;
        const leftMargin = options.indent ? margin + 10 : margin;

        pdf.setFontSize(fontSize);
        if (isBold) {
          pdf.setFont(undefined, "bold");
        } else {
          pdf.setFont(undefined, "normal");
        }

        // Check if we need a new page (leaving space for page number)
        if (currentY > pageHeight - margin - 20) {
          pdf.addPage();
          currentY = margin;
        }

        // Split text into lines that fit the width
        const maxWidth = contentWidth - (options.indent ? 10 : 0);
        const lines = pdf.splitTextToSize(String(text), maxWidth);

        for (let i = 0; i < lines.length; i++) {
          if (currentY > pageHeight - margin - 20) {
            pdf.addPage();
            currentY = margin;
          }

          if (isCenter) {
            const textWidth = pdf.getTextWidth(lines[i]);
            pdf.text(lines[i], (pageWidth - textWidth) / 2, currentY);
          } else {
            pdf.text(lines[i], leftMargin, currentY);
          }
          currentY += lineHeight;
        }

        currentY += options.spacing || 0;
      };

      // Check for custom text inputs (customAddressText already declared above for filename)
      const customTenantAText = document.getElementById("customTenantAText");
      const customTenantBText = document.getElementById("customTenantBText");

      // Generate contract content
      const tenantAInfo = this.selectedTenantA
        ? {
            name: this.selectedTenantA.name,
            passport:
              this.selectedTenantA.passportNumber ||
              this.selectedTenantA.passport ||
              "",
            fin: this.selectedTenantA.finNumber || this.selectedTenantA.fin || "",
            email: this.selectedTenantA.email || "",
          }
        : customTenantAText && customTenantAText.value.trim()
          ? {
              name: customTenantAText.value.trim(),
              passport: "",
              fin: "",
              email: "",
            }
          : {
              name: "[Tenant A Name]",
              passport: "[Tenant A Passport]",
              fin: "[Tenant A FIN]",
              email: "[Email]",
            };

      // Handle multiple Tenant B selections for PDF
      let tenantBInfo;
      if (
        Array.isArray(this.selectedTenantB) &&
        this.selectedTenantB.length > 0
      ) {
        // Multiple tenants selected
        tenantBInfo = this.selectedTenantB.map((tenant) => ({
          name: tenant.name,
          passport: tenant.passportNumber || tenant.passport || "",
          fin: tenant.finNumber || tenant.fin || "",
        }));
      } else if (customTenantBText && customTenantBText.value.trim()) {
        // Custom text input
        tenantBInfo = [
          {
            name: customTenantBText.value.trim(),
            passport: "",
            fin: "",
          },
        ];
      } else {
        // No tenant selected - show placeholder
        tenantBInfo = [
          {
            name: "[Tenant B Name]",
            passport: "[Tenant B Passport]",
            fin: "[Tenant B FIN]",
          },
        ];
      }

      // Get property address from custom input if available
      const propertyAddressForPDF =
        customAddressText && customAddressText.value.trim()
          ? customAddressText.value.trim()
          : this.contractData.address || "[Property Address]";

      // Header
      addText("HOUSE SHARING AGREEMENT", {
        fontSize: 16,
        bold: true,
        center: true,
        spacing: 10,
      });
      addText(`Full address: ${propertyAddressForPDF}`, { center: true });
      addText(`Room: ${this.formatRoomType(this.contractData.room)}`, {
        center: true,
      });
      addText(
        `THIS AGREEMENT is made on: ${
          this.contractData.agreementDate ||
          new Date().toISOString().split("T")[0]
        }`,
        { center: true, spacing: 15 },
      );

      // Parties
      addText("BETWEEN", { bold: true, spacing: 5 });
      addText(`Main tenant: ${tenantAInfo.name}`, { indent: true });
      if (tenantAInfo.passport) {
        addText(`Passport: ${tenantAInfo.passport}`, { indent: true });
      }
      if (tenantAInfo.fin) {
        addText(`FIN: ${tenantAInfo.fin}`, { indent: true });
      }
      addText(`Email: ${tenantAInfo.email}`, { indent: true });
      addText(
        "(Hereinafter called \"TenantA\" which expresses together where the context so admits, shall include all persons having title under 'TenantA') of the one part.",
        { indent: true, spacing: 10 },
      );

      addText("AND", { bold: true, spacing: 5 });
      // Handle multiple Tenant B entries
      for (let index = 0; index < tenantBInfo.length; index++) {
        const tenant = tenantBInfo[index];
        const isLastTenant = index === tenantBInfo.length - 1;

        if (tenantBInfo.length > 1) {
          addText("Tenant " + (index + 1) + ":", {
            indent: true,
            bold: true,
            spacing: 2,
          });
        }

        const nameValue = tenant.name || "[Tenant Name]";
        addText("Name: " + nameValue, { indent: true });

        if (tenant.passport && String(tenant.passport).trim()) {
          addText("Passport: " + String(tenant.passport), { indent: true });
        }

        if (tenant.fin && String(tenant.fin).trim()) {
          addText("FIN: " + String(tenant.fin), {
            indent: true,
            spacing: isLastTenant ? 0 : 5,
          });
        } else if (!isLastTenant) {
          addText("", { spacing: 5 });
        }
      }
      addText(
        "(Hereinafter called \"Tenant B\", which expresses together with where the context so admits, shall include all persons having title under ' Tenant B') of the one part.",
        { indent: true, spacing: 10 },
      );

      addText(
        `Payment method: ${this.formatPaymentMethod(
          this.contractData.paymentMethod,
        )}`,
        {
          spacing: 10,
        },
      );

      // Agreement terms
      addText("NOW IT IS HEREBY AGREED AS FOLLOWS:", {
        bold: true,
        spacing: 8,
      });

      // Contract details as simple text
      addText(`Lease Period: ${this.formatLeasePeriod()}`, {
        bold: true,
        spacing: 8,
      });
      addText(`Tenancy Period: ${this.formatTenancyPeriod()}`, {
        bold: true,
        spacing: 8,
      });
      addText("Moving Time: Move in after 15:00, Move out before 11:00", {
        bold: true,
        spacing: 8,
      });

      addText(
        `Monthly Rental: $${
          this.contractData.monthlyRental || "[Monthly Rental]"
        }`,
        { bold: true, spacing: 5 },
      );
      addText("*Room rental rate is strictly confidential", {
        fontSize: 9,
        indent: true,
      });
      addText(
        "*Renewal contract is subject to mutual agreement by Tenant A and Tenant B",
        { fontSize: 9, indent: true },
      );
      addText('*Payable by the 1st Day of each calendar month to "Tenant A"', {
        fontSize: 9,
        indent: true,
        spacing: this.contractData.fullPaymentReceived ? 0 : 8,
      });

      // Add full payment confirmation note if checked
      if (this.contractData.fullPaymentReceived) {
        addText(
          `*Tenant A hereby confirms receipt of full rental payment for the entire tenancy period (S$${this.calculateTotalRental().toFixed(
            2,
          )})`,
          { fontSize: 12, bold: true, indent: true, spacing: 8 },
        );
      }

      addText(
        `Security Deposit: $${
          this.contractData.securityDeposit ||
          this.contractData.monthlyRental ||
          "[Security Deposit]"
        }${
          this.contractData.partialDepositReceived &&
          this.contractData.partialDepositAmount
            ? ` (Partial deposit received: $${this.contractData.partialDepositAmount})`
            : ""
        }`,
        { bold: true, spacing: 5 },
      );
      addText(
        "*This deposit shall not be utilised to set off rent due and payable during the currency of this Agreement",
        { fontSize: 9, indent: true, spacing: 10 },
      );

      addText(
        "Monthly rentals include Wi-Fi, utilities, gas, usage of condominium facilities such as swimming pool, barbequepit and multi-purpose hall.",
        { fontSize: 9, spacing: 10 },
      );

      // Section 1
      addText("1. TENANT B(S) HEREBY AGREE(S) WITH TENANT A AS FOLLOWS:", {
        bold: true,
        fontSize: 12,
        spacing: 10,
      });

      const section1Clauses = [];

      // Conditionally add rent payment clauses
      if (!this.contractData.fullPaymentReceived) {
        const depositText = this.formatMonthsText(
          this.contractData.depositMonths || 1,
        );
        const advanceText = this.formatMonthsText(
          this.contractData.advanceMonths || 1,
        );
        const agreementDate = this.contractData.agreementDate
          ? this.formatDate(this.contractData.agreementDate)
          : "[Agreement Date]";
        const moveInDate = this.contractData.moveInDate
          ? this.formatDate(this.contractData.moveInDate)
          : "[Move-in Date]";

        section1Clauses.push(
          `a) To pay the equivalent of ${depositText}'s rent as a deposit on the agreement date (${agreementDate}) and ${advanceText}'s rent as an advance on the move-in date (${moveInDate}). The deposit is to be held by TenantA as security for the due performance and observance by TenantB of all covenants, conditions, and stipulations on the part of Tenant B herein contained, failing which TenantB shall forfeit to TenantA the said deposit or such part thereof as may be necessary to remedy such default.`,
          "b) In addition, and without prejudice to any other right power or remedy of Tenant A if the rent hereby reserved or any part thereof shall remain unpaid for 7 (SEVEN) days after the same shall have become due then, Tenant A shall forfeit the security deposit and at anytime thereafter, repossess The Room and remove all Tenant B's belongings from The Room without being liable for any loss or damage of such removal.",
        );
      }

      // Add remaining clauses with appropriate letters
      const baseClauseTexts = [
        "To use and manage the room, premises, and furniture therein in a careful manner and to keep the interior of the premises in a GOOD, CLEAN, TIDY, and TENANTABLE condition except for normal fair wear and tear.",
        "Not to do or permit to be done upon the premises or room anything which may be unlawful, immoral, or become a nuisance or annoyance to occupiers of adjoining or adjacent room(s).",
        "To use the premises for the purpose of private residence only and not to assign, sublet, or otherwise part possession of the premises or any part thereof without the written consent of Tenant A.",
        "To peaceably and quietly at the expiration of the tenancy deliver up to Tenant A the room in like condition as the same was delivered to Tenant B at the commencement of this Agreement, except for fair wear and tear.",
        "Not to create a nuisance, not to use the premises or any part thereof in a manner which may become a nuisance or annoyance to TenantA or the occupants of the premises, building or to neighbouring parties.",
        "Strictly NO PETS in the premises.",
        "No illegal or immoral activities, not to do or suffer to be done anything in or upon the said premises or any part thereof, any activities of an illegal or immoral nature.",
        "To permit Tenant A to carry out due diligence checks to ensure that at all times during the currency of this Agreement, Tenant B and/or permitted occupants are not illegal immigrants and comply with all the rules and regulations relating to the Immigration Act and the Employment of Foreign Workers Act.",
        "To provide TenantA, upon request, for physical inspection, all immigration and employment documents, including but not limited to the passports of all non-local occupants, the employment pass and/or work permits, proof of employment.",
        "Not to bring or store or permit to be brought or stored in the premises or any part thereof any goods which are of a dangerous, obnoxious, inflammable or hazardous nature.",
        "At the expiration of the term hereby created, to deliver up the room peacefully and quietly in like condition as the same was delivered to Tenant B at the commencement of the term hereby created. As the room is delivered in clean condition, Tenant B is expected to clear all personal belongings from the room and the premises, and clean the room and their designated area to the same condition as delivered. Failing to do so will result in a minimum deduction of SGD$150 from the security deposit for cleaning expenses.",
        "For a 6-month agreement, SGD$100 will be deducted from the deposit for air-conditioner servicing. For a 1-year agreement, SGD$200 will be deducted. This applies only to rooms with an air-conditioner.",
        "Costs of damage to common area facilities provided by Tenant A will be shared by both parties. For the first SGD$200 of any single bill, the cost will be divided among all subtenants of the unit. Any amount exceeding SGD$200 will be borne by Tenant A. This applies only to leases of 6 months and above.",
        "No smoking or vaping in the premises (first violation will result in a warning; subsequent violations will lead to contract termination). Vaping is illegal in Singapore and carries criminal penalties including potential imprisonment.",
        "No visitors without permission from Tenant B to Tenant A.",
        "No gathering (with/without alcoholic consumption) without permission from Tenant A.",
        "Strictly keep silent after 10:00 pm (the tenant will receive a warning for the first two times; the third time violation will lead to the contract's termination).",
        "Tenant B shall provide written notice to Tenant A at least thirty (30) days before the expiration of the lease term, indicating whether Tenant B intends to renew the tenancy or vacate the premises upon the lease's conclusion.",
        "Strictly NO DRUGS or drug-related activities in the premises. Drug possession, consumption, or trafficking is illegal in Singapore and carries severe penalties including imprisonment, caning, and even death penalty for serious drug offenses. Any violation will result in immediate termination of this Agreement and forfeiture of all deposits.",
        "No electricity reconnection, rewiring, or electrical modifications without prior written consent from Tenant A. Unauthorized electrical work can cause fires, leading to significant property damage and personal injury. Any unauthorized electrical modifications will result in immediate termination of this Agreement and Tenant B will be liable for all damages.",
        "Early Termination And Notice Period: Should Tenant B wish to terminate this Agreement prior to the expiration of the lease term, Tenant B shall give to Tenant A not less than thirty (30) calendar days' prior written notice of such intention to quit and surrender the premises. Upon compliance with this notice requirement and subject to Tenant B fulfilling all obligations under this Agreement including but not limited to payment of all outstanding rent, utilities, and restoration of the premises to its original condition (fair wear and tear excepted), the security deposit shall be refunded in full within seven (7) days of the termination date. However, should Tenant B fail to provide the requisite thirty (30) days' written notice, or terminate this Agreement without such notice, Tenant B shall forfeit the entire security deposit as liquidated damages for breach of this covenant, and such forfeiture shall be in addition to any other remedies available to Tenant A at law or in equity.",
      ];

      // Add pest control clause if checkbox is checked
      if (this.contractData.pestControlClause) {
        baseClauseTexts.push(
          "PEST INFESTATION LIABILITY: The Tenant B acknowledges that the premises have been inspected and are delivered free from any pest infestation including but not limited to bedbugs, cockroaches, ants, and other vermin. The Tenant B shall ensure proper hygiene and cleanliness of all personal belongings, bedding, and furniture before moving into the premises. In the event that any pest infestation is discovered within the premises during the tenancy period, the Tenant B shall be liable for pest control treatment costs and replacement of any damaged furniture, fixtures, or belongings up to a maximum amount of SGD$1,000.00. The Tenant B agrees to immediately notify Tenant A upon discovery of any signs of pest infestation and shall cooperate fully in any pest control measures undertaken.",
        );
      }

      // Add remaining clauses with proper letter sequence, skipping air-conditioner clause if no aircon
      let clauseOffset = 0;
      baseClauseTexts.forEach((clauseText, index) => {
        // Check if this is the air-conditioner clause
        const isAirconClause = clauseText.includes("air-conditioner servicing");

        // Skip air-conditioner clause if room has no aircon
        if (isAirconClause && !this.hasAircon()) {
          clauseOffset = 1; // Adjust offset for subsequent clauses
          return;
        }

        const letterIndex = this.contractData.fullPaymentReceived
          ? index - clauseOffset
          : index + 2 - clauseOffset;
        const letter = String.fromCharCode(97 + letterIndex); // a, b, c, etc.
        section1Clauses.push(`${letter}) ${clauseText}`);
      });

      section1Clauses.forEach((clause) => {
        addText(clause, { indent: true, spacing: 3 });
      });

      // Add additional clauses if any
      this.additionalClauses.forEach((clause, index) => {
        const letter = String.fromCharCode(97 + index + 21); // Start from 'v'
        if (clause.text.trim()) {
          addText(`${letter}) ${clause.text}`, { indent: true, spacing: 3 });
        }
      });

      currentY += 15;

      // Section 2
      addText("2) AND PROVIDED ALWAYS AS IT IS HEREBY AGREED AS FOLLOWS:", {
        bold: true,
        fontSize: 12,
        spacing: 10,
      });

      const section2Clauses = [];

      // Conditional first clause based on payment status
      if (this.contractData.fullPaymentReceived) {
        section2Clauses.push(
          "If any covenants, conditions or stipulations on Tenant B's part herein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained.",
        );
      } else {
        section2Clauses.push(
          "If the rent hereby reserved or any part thereof shall be unpaid for 7 (SEVEN) days after becoming payable (whether formally demanded in writing or not) OR if any covenants, conditions or stipulations on Tenant B's part therein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained. Tenant A shall terminate the agreement and forfeit the deposit forthwith.",
        );
      }

      section2Clauses.push(
        "Notwithstanding herein contained, Tenant A shall be under no liability to Tenant B for accidents happening, injuries sustained, or loss of life and damage to the property, goods, or chattels in the premises or in any part.",
        `a) ELECTRICITY: A monthly budget of S$${
          this.contractData.electricityBudget || "400"
        } (SINGAPORE DOLLARS ${this.numberToWords(
          parseInt(this.contractData.electricityBudget || "400"),
        ).toUpperCase()} ONLY) is set for the SP bills for the whole unit. Under circumstances where the total utility bill exceeds the limit cap, the outstanding due will be divided proportionally between all tenants of the unit. Tenant A reserved the right to claim from Tenant B. ONLY APPLY FOR A ROOM WITH AN AIR CONDITIONER.`,
        "b) Tenant B must produce an original/photocopy of documents such as NRIC/Passport/Work Permit/Employment Pass/Student Pass to prove his/her identity and legitimate stay in Singapore.",
        "c) Security deposit will be refunded within 7 (SEVEN) days at the end of the lease after deducting any outstanding fees, with no interest.",
      );

      // Conditionally add monthly payment clause
      if (!this.contractData.fullPaymentReceived) {
        section2Clauses.push(
          "d) Tenant B will be asked to leave the apartment within 1 (ONE) to 7 (SEVEN) days at the discretion of Tenant A for breach of agreement, and/or any terms and conditions stated in this Agreement if the rental is not paid by the first day of each calendar month.",
        );
      }

      // Add remaining clauses with adjusted letters
      const lawClauseLetter = this.contractData.fullPaymentReceived ? "d" : "e";
      const cleaningClauseLetter = this.contractData.fullPaymentReceived
        ? "e"
        : "f";

      section2Clauses.push(
        `${lawClauseLetter}) The law applicable in any action arising out of this lease shall be the law of the Republic of Singapore, and the parties hereto submit themselves to the jurisdiction of the laws of Singapore.`,
        `${cleaningClauseLetter}) Cleaning fee: SGD$${
          this.contractData.cleaningFee || "20"
        } / 1pax (if all tenants agree to hire a cleaning service)`,
      );

      section2Clauses.forEach((clause) => {
        addText(clause, { indent: true, spacing: 5 });
      });

      currentY += 20;

      // Signature section
      const signatureHeight = 20;

      // Check if we need a new page for the entire signature section (text + signatures)
      // Only create new page if we're very close to the bottom (less than 80 units remaining)
      if (currentY + 80 > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
      }

      addText(
        "By signing below, both parties agree to abide by all the above terms and conditions",
        { bold: true, center: true, spacing: 15 },
      );

      try {
        // Add Tenant A signature
        if (this.signatures.tenantA) {
          console.log(
            "📝 Adding Tenant A signature to PDF:",
            this.signatures.tenantA,
          );
          await this.addImageToPDF(
            pdf,
            this.signatures.tenantA,
            30,
            currentY,
            60,
            signatureHeight,
          );
        }

        // Add Tenant B signature
        if (this.signatures.tenantB) {
          console.log(
            "📝 Adding Tenant B signature to PDF:",
            this.signatures.tenantB,
          );
          await this.addImageToPDF(
            pdf,
            this.signatures.tenantB,
            120,
            currentY,
            60,
            signatureHeight,
          );
        }
      } catch (error) {
        console.warn("⚠️ Error adding signatures to PDF:", error);
      }

      currentY += signatureHeight + 15;

      // Add signature labels and names
      pdf.setFontSize(12);
      pdf.text("Tenant A", 30, currentY);
      pdf.text("Tenant B", 120, currentY);

      currentY += 10;
      pdf.setFontSize(10);
      pdf.text(tenantAInfo.name || "[Tenant A]", 30, currentY);

      // Handle multiple Tenant B names - show each on a separate line
      const tenantBX = 120; // X position for Tenant B
      let tenantBY = currentY; // Starting Y position

      tenantBInfo.forEach((tenant, index) => {
        const tenantName = tenant.name || "[Tenant B]";
        pdf.text(tenantName, tenantBX, tenantBY);
        tenantBY += 5; // Move to next line for next tenant
      });

      // Add page numbers to all pages
      addPageNumbers();

      pdf.save(filename);
      console.log(`✅ Contract exported successfully as text-based PDF`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Error exporting PDF. Please try again: " + error.message);
    } finally {
      // Restore button state
      const exportBtn = document.querySelector(
        '[onclick="contractManager.exportToPDF()"]',
      );
      if (exportBtn) {
        exportBtn.innerHTML = '<i class="bi bi-file-pdf me-1"></i>Export PDF';
        exportBtn.disabled = false;
      }
    }
  }

  // Helper method to add image to PDF
  async addImageToPDF(pdf, imageUrl, x, y, width, height) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = function () {
        try {
          // Create a canvas to convert the image
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // Set canvas size to match desired dimensions
          canvas.width = width * 4; // Higher resolution for better quality
          canvas.height = height * 4;

          // Draw image on canvas with white background
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Convert to base64
          const dataURL = canvas.toDataURL("image/jpeg", 0.8);

          // Add image to PDF
          pdf.addImage(dataURL, "JPEG", x, y, width, height);
          console.log("✅ Successfully added signature image to PDF");
          resolve();
        } catch (error) {
          console.error("❌ Error processing signature image:", error);
          reject(error);
        }
      };

      img.onerror = function (error) {
        console.error("❌ Error loading signature image:", error);
        reject(error);
      };

      // Load the image
      img.src = imageUrl;
    });
  }

  generateCleanContractForPDF() {
    // Check for custom text inputs
    const customTenantAText = document.getElementById("customTenantAText");
    const customTenantBText = document.getElementById("customTenantBText");
    const customAddressText = document.getElementById("customAddressText");

    const tenantAInfo = this.selectedTenantA
      ? {
          name: this.selectedTenantA.name,
          passport:
            this.selectedTenantA.passportNumber ||
            this.selectedTenantA.passport ||
            "",
          fin: this.selectedTenantA.finNumber || this.selectedTenantA.fin || "",
          email: this.selectedTenantA.email || "",
        }
      : customTenantAText && customTenantAText.value.trim()
        ? {
            name: customTenantAText.value.trim(),
            passport: "",
            fin: "",
            email: "",
          }
        : {
            name: "[Tenant A Name]",
            passport: "[Tenant A Passport]",
            fin: "[Tenant A FIN]",
            email: "[Email]",
          };

    // Handle multiple Tenant B selections for clean PDF
    let tenantBInfo;
    if (
      Array.isArray(this.selectedTenantB) &&
      this.selectedTenantB.length > 0
    ) {
      // Multiple tenants selected
      tenantBInfo = this.selectedTenantB.map((tenant) => ({
        name: tenant.name,
        passport: tenant.passportNumber || tenant.passport || "",
        fin: tenant.finNumber || tenant.fin || "",
      }));
    } else if (customTenantBText && customTenantBText.value.trim()) {
      // Custom text input
      tenantBInfo = [
        {
          name: customTenantBText.value.trim(),
          passport: "",
          fin: "",
        },
      ];
    } else {
      // No tenant selected - show placeholder
      tenantBInfo = [
        {
          name: "[Tenant B Name]",
          passport: "[Tenant B Passport]",
          fin: "[Tenant B FIN]",
        },
      ];
    }

    // Get property address from custom input if available
    const propertyAddressForPDF =
      customAddressText && customAddressText.value.trim()
        ? customAddressText.value.trim()
        : this.contractData.address || "[Property Address]";

    // Generate additional clauses HTML (starting from letter 'v' after clause 'u')
    let additionalClausesHtml = "";
    this.additionalClauses.forEach((clause, index) => {
      const letter = String.fromCharCode(97 + index + 21); // Start from 'v'
      if (clause.text.trim()) {
        additionalClausesHtml += `<p style="margin-bottom: 12px;"><strong>${letter})</strong> ${clause.text}</p>\n`;
      }
    });

    return `
            <div style="padding: 0; margin: 0; font-family: 'Times New Roman', serif; line-height: 1.8; color: #000;">
                <!-- Header Section -->
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="font-weight: bold; margin-bottom: 15px; font-size: 18px;">HOUSE SHARING AGREEMENT</h2>
                    <p style="margin-bottom: 8px;"><strong>Full address:</strong> ${
                      propertyAddressForPDF
                    }</p>
                    <p style="margin-bottom: 8px;"><strong>Room:</strong> ${this.formatRoomType(
                      this.contractData.room,
                    )}</p>
                    <p style="margin-bottom: 20px;"><strong>THIS AGREEMENT is made on:</strong> ${
                      this.contractData.agreementDate ||
                      new Date().toISOString().split("T")[0]
                    }</p>
                </div>

                <!-- Parties Section -->
                <div style="margin-bottom: 25px;">
                    <p style="margin-bottom: 12px;"><strong>BETWEEN</strong></p>
                    <div style="margin-left: 20px; margin-bottom: 15px;">
                        <p style="margin-bottom: 5px;"><strong>Main tenant:</strong> ${
                          tenantAInfo.name
                        }</p>
                        ${
                          tenantAInfo.passport
                            ? `<p style="margin-bottom: 5px;"><strong>Passport:</strong> ${tenantAInfo.passport}</p>`
                            : ""
                        }
                        ${
                          tenantAInfo.fin
                            ? `<p style="margin-bottom: 5px;"><strong>FIN:</strong> ${tenantAInfo.fin}</p>`
                            : ""
                        }
                        <p style="margin-bottom: 12px;"><strong>Email:</strong> ${
                          tenantAInfo.email
                        }</p>
                        <p style="font-style: italic; margin-bottom: 20px;">
                            (Hereinafter called "TenantA" which expresses together where the context so admits, shall include all persons having title under 'TenantA') of the one part.
                        </p>
                    </div>

                    <p style="margin-bottom: 12px;"><strong>AND</strong></p>
                    <div style="margin-left: 20px;">
                        ${tenantBInfo
                          .map(
                            (tenant, index) => `
                            ${tenantBInfo.length > 1 ? `<p style="margin-bottom: 5px;"><strong>Tenant ${index + 1}:</strong></p>` : ""}
                            <p style="margin-bottom: 5px;"><strong>Name:</strong> ${tenant.name}</p>
                            ${
                              tenant.passport
                                ? `<p style="margin-bottom: 5px;"><strong>Passport:</strong> ${tenant.passport}</p>`
                                : ""
                            }
                            ${
                              tenant.fin
                                ? `<p style="margin-bottom: 12px;"><strong>FIN:</strong> ${tenant.fin}</p>`
                                : ""
                            }
                            ${index < tenantBInfo.length - 1 ? '<div style="margin-bottom: 10px;"></div>' : ""}
                        `,
                          )
                          .join("")}
                        <p style="font-style: italic; margin-bottom: 20px;">
                            (Hereinafter called "Tenant B", which expresses together with where the context so admits, shall include all persons having title under ' Tenant B') of the one part.
                        </p>
                    </div>
                </div>

                <p style="margin-bottom: 30px;"><strong>Payment method:</strong> ${this.formatPaymentMethod(
                  this.contractData.paymentMethod,
                )}</p>

                <!-- Agreement Terms -->
                <div style="margin-bottom: 30px;">
                    <p style="margin-bottom: 20px;"><strong>NOW IT IS HEREBY AGREED AS FOLLOWS:</strong></p>
                    
                    <!-- Contract Terms as Simple Text -->
                    <div style="margin-bottom: 25px; line-height: 1.8;">
                        <p style="margin-bottom: 12px;"><strong>Lease Period:</strong> ${this.formatLeasePeriod()}</p>

                        <p style="margin-bottom: 12px;"><strong>Tenancy Period:</strong> ${this.formatTenancyPeriod()}</p>
                        
                        <p style="margin-bottom: 12px;"><strong>Moving Time:</strong> Move in after 15:00, Move out before 11:00</p>
                        
                        <p style="margin-bottom: 8px;"><strong>Monthly Rental:</strong> $${
                          this.contractData.monthlyRental || "[Monthly Rental]"
                        }</p>
                        <div style="margin-left: 20px; margin-bottom: 12px;">
                            <small style="font-size: 10px; line-height: 1.5;">
                                *Room rental rate is strictly confidential<br>
                                *Renewal contract is subject to mutual agreement by Tenant A and Tenant B${
                                  this.contractData.fullPaymentReceived
                                    ? `<br><strong style="font-size: 14px;">*Tenant A hereby confirms receipt of full rental payment for the entire tenancy period (S$${this.calculateTotalRental().toFixed(
                                        2,
                                      )})</strong>`
                                    : '<br>*Payable by the 1st Day of each calendar month to "Tenant A"'
                                }
                            </small>
                        </div>
                        
                        <p style="margin-bottom: 8px;"><strong>Security Deposit:</strong> $${
                          this.contractData.securityDeposit ||
                          this.contractData.monthlyRental ||
                          "[Security Deposit]"
                        }${
                          this.contractData.partialDepositReceived &&
                          this.contractData.partialDepositAmount
                            ? ` <em>(Partial deposit received: $${this.contractData.partialDepositAmount})</em>`
                            : ""
                        }</p>
                        <div style="margin-left: 20px; margin-bottom: 12px;">
                            <small style="font-size: 10px;">*This deposit shall not be utilised to set off rent due and payable during the currency of this Agreement</small>
                        </div>
                    </div>
                </div>

                <p style="margin-bottom: 25px; font-size: 11px; font-style: italic;">Monthly rentals include Wi-Fi, utilities, gas, usage of condominium facilities such as swimming pool, barbequepit and multi-purpose hall.</p>

                <!-- Section 1: Tenant B Agreements -->
                <div style="margin-bottom: 30px;">
                    <p style="margin-bottom: 20px; font-weight: bold; font-size: 14px;">1. TENANT B(S) HEREBY AGREE(S) WITH TENANT A AS FOLLOWS:</p>
                    <div style="margin-left: 15px;">
                        <p style="margin-bottom: 15px;"><strong>a)</strong> To pay the equivalent of ${this.formatMonthsText(this.contractData.depositMonths || 1)}'s rent as a deposit on the agreement date (${
                          this.contractData.agreementDate
                            ? this.formatDate(this.contractData.agreementDate)
                            : "[Agreement Date]"
                        }) and ${this.formatMonthsText(this.contractData.advanceMonths || 1)}'s rent as an advance on the move-in date (${
                          this.contractData.moveInDate
                            ? this.formatDate(this.contractData.moveInDate)
                            : "[Move-in Date]"
                        }). The deposit is to be held by TenantA as security for the due performance and observance by TenantB of all covenants, conditions, and stipulations on the part of Tenant B herein contained, failing which TenantB shall forfeit to TenantA the said deposit or such part thereof as may be necessary to remedy such default. PROVIDED ALWAYS that Tenant B shall duly perform the said covenants, conditions, and stipulations as aforesaid, up to and including the date of expiration of the term hereby created, Tenant A shall repay the said deposit within 7 (SEVEN) days from the date of such expiration without any interest. This deposit shall not be utilised to offset any rent due and payable during the currency of this Agreement. Such deposit shall be refundable at the end of the term, less deduction for damages caused by the negligence of Tenant B and of any breach of this Agreement.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>b)</strong> In addition, and without prejudice to any other right power or remedy of Tenant A if the rent hereby reserved or any part thereof shall remain unpaid for 7 (SEVEN) days after the same shall have become due (whether any formal or legal demand therefore shall have been made or not) then, Tenant A shall forfeit the security deposit and at anytime thereafter, repossess The Room and remove all Tenant B's belongings from The Room without being liable for any loss or damage of such removal. Tenant A shall be entitled to recover all legal fees arising from the recovery of unpaid rent by Tenant B.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>c)</strong> To use and manage the room, premises, and furniture therein in a careful manner and to keep the interior of the premises in a GOOD, CLEAN, TIDY, and TENANTABLE condition except for normal fair wear and tear.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>d)</strong> Not to do so permits to be done upon the premises or room, which may be unlawful, immoral, or become a nuisance or annoyance to occupiers of adjoining or adjacent room(s).</p>
                        
                        <p style="margin-bottom: 15px;"><strong>e)</strong> To use the premises for the purpose of private residence only and not to assign, sublet, or otherwise part possession of the premises or any part thereof without the written consent of Tenant A.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>f)</strong> To peaceably and quietly at the expiration of the tenancy deliver up to Tenant A the room in like condition as if the same were delivered to Tenant B at the commencement of this Agreement, fair wear and tear.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>g)</strong> Not to create a nuisance, not to use the premises or any part thereof in a manner which may become a nuisance or annoyance to TenantA or the occupants of the premises, building or to neighbouring parties.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>h)</strong> Strictly NO PETS in the premises.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>i)</strong> No illegal or immoral activities, not to do or suffer to be done anything in or upon the said premises or any part thereof, any activities of an illegal or immoral nature.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>j)</strong> To permit Tenant A to carryout due diligence checks to ensure that all times during the currency of this Agreement that Tenant B and/or permitted occupants are not illegal immigrants and comply with all the rules and regulations relating to the Immigration Act and the Employment of Foreign Workers Act (if applicable) and any other Act of Parliament, regulations, or any rules of orders thereunder which relates to foreign residents and workers.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>k)</strong> To provide TenantA, upon request, for physical inspection, all immigration and employment documents, including but not limited to the passports of all non-local occupants, the employment pass and/or work permits, proof of employment, and to provide TenantA with certified true copies of such documents.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>l)</strong> Not to bring or store or permit to be brought or stored in the premises or any part thereof any goods which are of a dangerous, obnoxious, inflammable or hazardous nature.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>m)</strong> At the expiration of the term hereby created, to deliver up the room peacefully and quietly in like condition as the same were delivered to Tenant B at the commencement of the term hereby created. Authorised alterations or additions, fair wear and tear. As the room is delivered in clean condition, Tenant B is expected to clear all personal belongings from the room and the premises, clean the room and their designated area spick and span, in like condition as the same were delivered. In failing to do so, a minimum of SGD$150 (SINGAPORE DOLLARS ONE HUNDRED AND FIFTY ONLY) will be deducted from the security deposit for the time spent cleaning the place.</p>

                        ${this.hasAircon() ? '<p style="margin-bottom: 15px;"><strong>n)</strong> For 6 6-month agreement, the deposit money will be deducted SGD$100 for Air-conditioner services. On a 1-year agreement, the deduction level would be SGD$200. ONLY APPLY FOR A ROOM WITH AN AIR-CONDITIONER.</p>' : ""}

                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "o" : "n"})</strong> Cost of damage for common area facilities provided previously by Tenant A will be handled by both parties. For the first 200 (SGD) in any single bill, the bill would be divided among all subtenants of the unit. The exceeding amount would be handled by Tenant A. Only applied for 6 months lease and above.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "p" : "o"})</strong> No smoking, vaping in the house (the first time violated will get a warning; the next time violated will lead to the contract's termination). Vaping is now illegal in Singapore, and being caught can lead to a jail sentence.</p>

                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "q" : "p"})</strong> No visitors without permission from Tenant B to Tenant A.</p>

                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "r" : "q"})</strong> No gathering (with/without alcoholic consumption) without permission from Tenant A.</p>

                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "s" : "r"})</strong> Strictly keep silent after 10:00 pm (the tenant will receive a warning for the first two times; the third time violation will lead to the contract's termination).</p>

                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "t" : "s"})</strong> Tenant B shall provide written notice to Tenant A at least thirty (30) days before the expiration of the lease term, indicating whether Tenant B intends to renew the tenancy or vacate the premises upon the lease's conclusion.</p>

                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "u" : "t"})</strong> Strictly NO DRUGS or drug-related activities in the premises. Drug possession, consumption, or trafficking is illegal in Singapore and carries severe penalties including imprisonment, caning, and even death penalty for serious drug offenses. Any violation will result in immediate termination of this Agreement and forfeiture of all deposits.</p>

                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "v" : "u"})</strong> No electricity reconnection, rewiring, or electrical modifications without prior written consent from Tenant A. Unauthorized electrical work can cause fires, leading to significant property damage and personal injury. Any unauthorized electrical modifications will result in immediate termination of this Agreement and Tenant B will be liable for all damages.</p>

                        <p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "w" : "v"})</strong> EARLY TERMINATION AND NOTICE PERIOD: Should Tenant B wish to terminate this Agreement prior to the expiration of the lease term, Tenant B shall give to Tenant A not less than thirty (30) calendar days' prior written notice of such intention to quit and surrender the premises. Upon compliance with this notice requirement and subject to Tenant B fulfilling all obligations under this Agreement including but not limited to payment of all outstanding rent, utilities, and restoration of the premises to its original condition (fair wear and tear excepted), the security deposit shall be refunded in full within seven (7) days of the termination date. However, should Tenant B fail to provide the requisite thirty (30) days' written notice, or terminate this Agreement without such notice, Tenant B shall forfeit the entire security deposit as liquidated damages for breach of this covenant, and such forfeiture shall be in addition to any other remedies available to Tenant A at law or in equity.</p>

                        ${
                          this.contractData.pestControlClause
                            ? `<p style="margin-bottom: 15px;"><strong>${this.hasAircon() ? "x" : "w"})</strong> PEST INFESTATION LIABILITY: The Tenant B acknowledges that the premises have been inspected and are delivered free from any pest infestation including but not limited to bedbugs, cockroaches, ants, and other vermin. The Tenant B shall ensure proper hygiene and cleanliness of all personal belongings, bedding, and furniture before moving into the premises. In the event that any pest infestation is discovered within the premises during the tenancy period, the Tenant B shall be liable for pest control treatment costs and replacement of any damaged furniture, fixtures, or belongings up to a maximum amount of SGD$1,000.00. The Tenant B agrees to immediately notify Tenant A upon discovery of any signs of pest infestation and shall cooperate fully in any pest control measures undertaken.</p>`
                            : ""
                        }


                        ${additionalClausesHtml}
                    </div>
                </div>

                <!-- Page break opportunity -->
                <div style="page-break-before: always; margin-top: 30px;">
                    <!-- Section 2: Additional Provisions -->
                    <div style="margin-bottom: 30px;">
                        <p style="margin-bottom: 20px; font-weight: bold; font-size: 14px;">2) AND PROVIDED ALWAYS AS IT IS HEREBY AGREED AS FOLLOWS:</p>
                        <div style="margin-left: 15px;">
                            <p style="margin-bottom: 15px;">If the rent hereby reserved or any part thereof shall be unpaid for 7 (SEVEN) days after becoming payable (whether formally demanded in writing or not) OR if any covenants, conditions or stipulations on Tenant B's part therein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained. Tenant A shall terminate the agreement and forfeit the deposit forthwith.</p>
                            
                            <p style="margin-bottom: 15px;">Notwithstanding herein contained, Tenant A shall be under no liability to Tenant B for accidents happening, injuries sustained, or loss of life and damage to the property, goods, or chattels in the premises or in any part.</p>
                            
                            <p style="margin-bottom: 15px;"><strong>a) ELECTRICITY:</strong> A monthly budget of S$${
                              this.contractData.electricityBudget || "400"
                            } (SINGAPORE DOLLARS ${this.numberToWords(
                              parseInt(
                                this.contractData.electricityBudget || "400",
                              ),
                            ).toUpperCase()} ONLY) is set for the SP bills for the whole unit. Under circumstances where the total utility bill exceeds the limit cap, the outstanding due will be divided proportionally between all tenants of the unit. Tenant A reserved the right to claim from Tenant B. ONLY APPLY FOR A ROOM WITH AN AIR CONDITIONER.</p>
                            
                            <p style="margin-bottom: 15px;"><strong>b)</strong> Tenant B must produce an original/photocopy of documents such as NRIC/Passport/Work Permit/Employment Pass/Student Pass to prove his/her identity and legitimate stay in Singapore.</p>
                            
                            <p style="margin-bottom: 15px;"><strong>c)</strong> Security deposit will be refunded within 7 (SEVEN) days at the end of the lease after deducting any outstanding fees, with no interest.</p>
                            
                            <p style="margin-bottom: 15px;"><strong>d)</strong> Tenant B will be asked to leave the apartment within 1 (ONE) to 7 (SEVEN) days at the discretion of Tenant A for breach of agreement, and/or any terms and conditions stated in this Agreement if the rental is not paid by the first day of each calendar month.</p>
                            
                            <p style="margin-bottom: 15px;"><strong>e)</strong> The law applicable in any action arising out of this lease shall be the law of the Republic of Singapore, and the parties hereto submit themselves to the jurisdiction of the laws of Singapore.</p>
                            
                            <p style="margin-bottom: 20px;"><strong>f)</strong> Cleaning fee: SGD$${
                              this.contractData.cleaningFee || "20"
                            } / 1pax (if all tenants agree to hire a cleaning service)</p>
                        </div>
                    </div>

                    <!-- Signature Section -->
                    <div style="text-align: center;">
                        <p style="font-weight: bold;">By signing below, both parties agree to abide by all the above terms and conditions</p>
                    
                        <div style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center; width: 45%;">
                            <p style="font-weight: bold; margin-bottom: 15px;">Tenant A</p>
                            <div style="height: 60px; margin-bottom: 15px; display: flex; align-items: flex-end; justify-content: center;">
                                ${
                                  this.signatures.tenantA
                                    ? `<img src="${this.signatures.tenantA}" alt="Tenant A Signature" style="max-height: 50px; max-width: 200px;">`
                                    : '<div style="height: 50px;"></div>'
                                }
                            </div>
                            <p style="font-weight: bold;">${
                              tenantAInfo.name
                            }</p>
                        </div>
                        <div style="text-align: center; width: 45%;">
                            <p style="font-weight: bold; margin-bottom: 15px;">Tenant B</p>
                            <div style="height: 60px; margin-bottom: 15px; display: flex; align-items: flex-end; justify-content: center;">
                                ${
                                  this.signatures.tenantB
                                    ? `<img src="${this.signatures.tenantB}" alt="Tenant B Signature" style="max-height: 50px; max-width: 200px;">`
                                    : '<div style="height: 50px;"></div>'
                                }
                            </div>
                            <p style="font-weight: bold;">${
                              tenantBInfo.name
                            }</p>
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  // Public method to refresh the component
  refresh() {
    // Only reload tenants if a property is already selected
    if (this.selectedPropertyId) {
      this.loadTenants();
    }
    this.loadInvestors();
    this.loadProperties();
  }

  // ================== TEMPLATE FUNCTIONALITY ==================

  async initializeTemplateSection() {
    console.log("🔧 Initializing contract template section");
    await this.loadAndRenderTemplates();
  }

  renderTemplatesLoadingSkeleton() {
    const templatesList = document.getElementById("templatesList");
    if (!templatesList) return;

    // Show loading skeleton with fixed height to prevent layout shift
    templatesList.innerHTML = `
      <div class="loading-skeleton" style="min-height: 300px;">
        ${[1, 2, 3]
          .map(
            () => `
          <div class="template-item d-flex justify-content-between align-items-center p-2 border rounded mb-2 bg-light" style="animation: pulse 1.5s ease-in-out infinite;">
            <div class="template-info flex-grow-1">
              <div class="d-flex align-items-center">
                <div style="width: 16px; height: 16px; background-color: #dee2e6; border-radius: 3px; margin-right: 8px;"></div>
                <div style="flex: 1;">
                  <div style="height: 16px; background-color: #dee2e6; border-radius: 3px; width: 70%; margin-bottom: 6px;"></div>
                  <div style="height: 12px; background-color: #dee2e6; border-radius: 3px; width: 40%;"></div>
                </div>
              </div>
            </div>
            <div style="width: 32px; height: 32px; background-color: #dee2e6; border-radius: 4px;"></div>
          </div>
        `,
          )
          .join("")}
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      </style>
    `;
  }

  async loadAndRenderTemplates() {
    try {
      // Show loading skeleton first
      this.renderTemplatesLoadingSkeleton();

      const result = await this.templateService.getAllTemplates();
      if (result.success && result.items && result.items.length > 0) {
        this.renderTemplatesList(result.items);
      } else {
        this.renderEmptyTemplatesList();
      }
    } catch (error) {
      console.error("❌ Error loading templates:", error);
      this.renderEmptyTemplatesList();
    }
  }

  renderTemplatesList(templates) {
    const templatesList = document.getElementById("templatesList");
    if (!templatesList) return;

    templatesList.innerHTML = templates
      .map(
        (template) => `
      <div class="template-item d-flex justify-content-between align-items-center p-2 border rounded mb-2 bg-light" data-template-name="${
        template.data.name
      }">
        <div class="template-info flex-grow-1" style="cursor: pointer;" onclick="contractManager.loadTemplate('${
          template.data.name
        }')">
          <div class="d-flex align-items-center">
            <i class="bi bi-bookmark me-2 text-primary"></i>
            <div>
              <span class="fw-semibold text-primary">${
                template.data.name
              }</span>
              ${
                template.data.additionalData?.description
                  ? `<br><small class="text-muted">${template.data.additionalData.description}</small>`
                  : ""
              }
              <br><small class="text-muted">Updated: ${new Date(
                template.data.updatedAt,
              ).toLocaleDateString()}</small>
            </div>
          </div>
        </div>
        ${
          this.pendingDeletes.has(template.data.name)
            ? `<button class="btn btn-success btn-sm" onclick="contractManager.confirmDeleteTemplate('${template.data.name}')" title="Confirm delete">
                 <i class="bi bi-check"></i>
               </button>
               <button class="btn btn-outline-secondary btn-sm" onclick="contractManager.cancelDeleteTemplate('${template.data.name}')" title="Cancel">
                 <i class="bi bi-x"></i>
               </button>`
            : `<button class="btn btn-outline-danger btn-sm" onclick="contractManager.toggleDeleteConfirm('${template.data.name}')" title="Delete Template">
                 <i class="bi bi-trash"></i>
               </button>`
        }
      </div>
    `,
      )
      .join("");
  }

  renderEmptyTemplatesList() {
    const templatesList = document.getElementById("templatesList");
    if (!templatesList) return;

    templatesList.innerHTML = `
      <div class="text-center text-muted py-3">
        <i class="bi bi-bookmark-dash fs-4"></i>
        <p class="mb-0 small">No saved templates yet</p>
        <small>Save your first template to reuse contract data</small>
      </div>
    `;
  }

  async showSaveTemplateModal() {
    // Save directly without modal
    await this.saveTemplateDirectly();
  }

  async saveTemplateDirectly() {
    try {
      // Generate template name using the specified format: [tenantB] [roomtype] [rental] [address]
      const templateName = this.generateTemplateName();

      if (!templateName) {
        showToast(
          "Unable to generate template name. Please fill in required fields.",
          "error",
        );
        return;
      }

      // Gather all current contract data
      const currentData = this.gatherCurrentContractData();

      // Check for custom tenant text
      const customTenantAText = document.getElementById("customTenantAText");
      const customTenantBText = document.getElementById("customTenantBText");
      const tenantASelect = document.getElementById("contractTenantA");
      const tenantBSelect = document.getElementById("contractTenantB");

      // Use custom text if "CUSTOM_TEXT" option is selected
      let tenantAToSave = this.selectedTenantA;
      if (
        tenantASelect &&
        tenantASelect.value === "CUSTOM_TEXT" &&
        customTenantAText &&
        customTenantAText.value.trim()
      ) {
        tenantAToSave = {
          name: customTenantAText.value.trim(),
          passportNumber: "",
          finNumber: "",
          email: "",
          isCustomText: true,
        };
      }

      let tenantBToSave = this.selectedTenantB;
      if (
        tenantBSelect &&
        tenantBSelect.value === "CUSTOM_TEXT" &&
        customTenantBText &&
        customTenantBText.value.trim()
      ) {
        tenantBToSave = {
          name: customTenantBText.value.trim(),
          passportNumber: "",
          finNumber: "",
          isCustomText: true,
        };
      }

      const additionalData = {
        description: `Auto-saved template: ${templateName}`,
        selectedTenantA: tenantAToSave,
        selectedTenantB: tenantBToSave,
        additionalClauses: [...this.additionalClauses],
      };

      const result = await this.templateService.saveTemplate(
        templateName,
        currentData,
        additionalData,
      );

      if (result.success) {
        showToast(`Template "${templateName}" saved successfully!`, "success");

        // Refresh templates list
        await this.loadAndRenderTemplates();
      } else {
        showToast("Failed to save template: " + result.error, "error");
      }
    } catch (error) {
      console.error("❌ Error saving template:", error);
      showToast("Error saving template", "error");
    }
  }

  generateTemplateName() {
    console.log(
      "🏷️ Generating template name, selectedTenantB:",
      this.selectedTenantB,
    );

    // Check for custom tenant B text
    const customTenantBText = document.getElementById("customTenantBText");
    const customTenantBField = document.getElementById("customTenantBField");

    // Check if custom field is visible and has value
    const isCustomText =
      customTenantBField &&
      customTenantBField.style.display !== "none" &&
      customTenantBText &&
      customTenantBText.value.trim();

    const tenantBName = isCustomText
      ? customTenantBText.value.trim()
      : Array.isArray(this.selectedTenantB) && this.selectedTenantB.length > 0
        ? this.selectedTenantB.map((t) => t.name).join("_")
        : "NoTenantB";

    console.log("🏷️ Generated tenant B name:", tenantBName);

    const roomType =
      this.contractData.room ||
      document.getElementById("contractRoom")?.value ||
      "Unknown-Room";
    const rental =
      this.contractData.monthlyRental ||
      document.getElementById("contractMonthlyRental")?.value ||
      "0";

    // Check for custom address text
    const customAddressText = document.getElementById("customAddressText");
    const addressSelect = document.getElementById("contractAddress");
    const address =
      addressSelect &&
      addressSelect.value === "CUSTOM_TEXT" &&
      customAddressText &&
      customAddressText.value.trim()
        ? customAddressText.value.trim()
        : this.contractData.address ||
          document.getElementById("contractAddress")?.value ||
          "Unknown-Address";

    // Clean and format the components
    const cleanTenantB = tenantBName
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    const cleanRoom = roomType
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    const cleanRental = String(rental).replace(/[^0-9]/g, "");
    const cleanAddress = address
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .substring(0, 30); // Limit address length

    return `${cleanTenantB} ${cleanRoom} ${cleanRental} ${cleanAddress}`;
  }

  syncFormValuesToContractData() {
    // Sync critical form values to contractData to ensure export has the latest data
    const formFields = [
      "moveInDate",
      "moveOutDate",
      "leasePeriod",
      "monthlyRental",
      "securityDeposit",
      "room",
      "address",
      "agreementDate",
      "electricityBudget",
      "cleaningFee",
    ];

    formFields.forEach((field) => {
      const element = document.getElementById(
        `contract${field.charAt(0).toUpperCase() + field.slice(1)}`,
      );
      if (element && element.value) {
        this.contractData[field] = element.value;
      }
    });

    // Handle custom address text
    const contractAddressElement = document.getElementById("contractAddress");
    const customAddressText = document.getElementById("customAddressText");
    if (
      contractAddressElement &&
      contractAddressElement.value === "CUSTOM_TEXT" &&
      customAddressText &&
      customAddressText.value.trim()
    ) {
      this.contractData.address = customAddressText.value.trim();
    }

    // Sync payment method
    const paymentMethodElement = document.getElementById(
      "contractPaymentMethod",
    );
    if (paymentMethodElement && paymentMethodElement.value) {
      this.contractData.paymentMethod = paymentMethodElement.value;
    }

    // Sync checkbox states
    const fullPaymentElement = document.getElementById("fullPaymentReceived");
    if (fullPaymentElement) {
      this.contractData.fullPaymentReceived = fullPaymentElement.checked;
    }

    const partialDepositElement = document.getElementById(
      "contractPartialDepositReceived",
    );
    if (partialDepositElement) {
      this.contractData.partialDepositReceived = partialDepositElement.checked;
    }

    const partialDepositAmountElement = document.getElementById(
      "contractPartialDepositAmount",
    );
    if (partialDepositAmountElement) {
      this.contractData.partialDepositAmount = partialDepositAmountElement.value;
    }

    const pestControlElement = document.getElementById("pestControlClause");
    if (pestControlElement) {
      this.contractData.pestControlClause = pestControlElement.checked;
    }

    console.log("✅ Synced form values to contractData:", {
      moveInDate: this.contractData.moveInDate,
      moveOutDate: this.contractData.moveOutDate,
      leasePeriod: this.contractData.leasePeriod,
    });
  }

  gatherCurrentContractData() {
    // Get form values
    const contractData = { ...this.contractData };

    // Update with current form values
    const formFields = [
      "address",
      "room",
      "agreementDate",
      "leasePeriod",
      "moveInDate",
      "moveOutDate",
      "monthlyRental",
      "securityDeposit",
      "electricityBudget",
      "cleaningFee",
    ];

    formFields.forEach((field) => {
      const element = document.getElementById(
        `contract${field.charAt(0).toUpperCase() + field.slice(1)}`,
      );
      if (element) {
        contractData[field] = element.value;
      }
    });

    // Check for custom address text
    const contractAddressElement = document.getElementById("contractAddress");
    const customAddressText = document.getElementById("customAddressText");
    if (
      contractAddressElement &&
      contractAddressElement.value === "CUSTOM_TEXT" &&
      customAddressText &&
      customAddressText.value.trim()
    ) {
      contractData.address = customAddressText.value.trim();
    }

    // Get payment method
    const paymentMethodElement = document.getElementById(
      "contractPaymentMethod",
    );
    if (paymentMethodElement) {
      contractData.paymentMethod = paymentMethodElement.value;
    }

    // Get full payment received status
    const fullPaymentElement = document.getElementById("fullPaymentReceived");
    if (fullPaymentElement) {
      contractData.fullPaymentReceived = fullPaymentElement.checked;
    }

    // Get partial deposit received status
    const partialDepositElement = document.getElementById(
      "contractPartialDepositReceived",
    );
    if (partialDepositElement) {
      contractData.partialDepositReceived = partialDepositElement.checked;
    }

    // Get partial deposit amount
    const partialDepositAmountElement = document.getElementById(
      "contractPartialDepositAmount",
    );
    if (partialDepositAmountElement) {
      contractData.partialDepositAmount = partialDepositAmountElement.value;
    }

    // Get pest control clause status
    const pestControlElement = document.getElementById("pestControlClause");
    if (pestControlElement) {
      contractData.pestControlClause = pestControlElement.checked;
    }

    return contractData;
  }

  async loadTemplate(templateName) {
    try {
      const result = await this.templateService.getTemplate(templateName);

      if (!result.success) {
        showToast("Failed to load template: " + result.error, "error");
        return;
      }

      const templateData = result.data;

      // Set flag to prevent auto-fill of dates when loading template
      this.isLoadingTemplate = true;

      // Populate contract data
      this.contractData = { ...templateData.contractData };

      // Store the dates separately to restore them after tenant loading
      const savedMoveInDate = templateData.contractData.moveInDate;
      const savedMoveOutDate = templateData.contractData.moveOutDate;

      // Populate form fields
      Object.keys(this.contractData).forEach((field) => {
        // Special handling for checkbox fields
        const element =
          field === "pestControlClause"
            ? document.getElementById("pestControlClause")
            : document.getElementById(
                `contract${field.charAt(0).toUpperCase() + field.slice(1)}`,
              );

        if (element) {
          if (element.type === "checkbox") {
            element.checked = this.contractData[field];
          } else {
            element.value = this.contractData[field] || "";
          }
        }
      });

      // Handle partial deposit amount container visibility
      const partialDepositAmountContainer = document.getElementById(
        "partialDepositAmountContainer",
      );
      if (partialDepositAmountContainer) {
        partialDepositAmountContainer.style.display = this.contractData
          .partialDepositReceived
          ? "block"
          : "none";
      }

      // Load tenant selections if available
      if (templateData.additionalData?.selectedTenantA) {
        this.selectedTenantA = templateData.additionalData.selectedTenantA;
        await this.loadTenantFromTemplate("A", this.selectedTenantA);
      }

      if (templateData.additionalData?.selectedTenantB) {
        // Handle both old format (single object) and new format (array)
        const tenantBData = templateData.additionalData.selectedTenantB;

        if (Array.isArray(tenantBData)) {
          // New format: already an array
          this.selectedTenantB = tenantBData;
        } else if (tenantBData && typeof tenantBData === "object") {
          // Old format: single object, convert to array
          this.selectedTenantB = [tenantBData];
        } else {
          this.selectedTenantB = [];
        }

        // Load all tenant B selections
        await this.loadMultipleTenantBFromTemplate(this.selectedTenantB);
      }

      // Restore the dates after tenant loading to ensure they're not overwritten
      if (savedMoveInDate) {
        const moveInInput = document.getElementById("contractMoveInDate");
        if (moveInInput) {
          moveInInput.value = savedMoveInDate;
          this.contractData.moveInDate = savedMoveInDate;
        }
      }

      if (savedMoveOutDate) {
        const moveOutInput = document.getElementById("contractMoveOutDate");
        if (moveOutInput) {
          moveOutInput.value = savedMoveOutDate;
          this.contractData.moveOutDate = savedMoveOutDate;
        }
      }

      // Load additional clauses
      if (templateData.additionalData?.additionalClauses) {
        this.additionalClauses = [
          ...templateData.additionalData.additionalClauses,
        ];
        this.renderAdditionalClauses();
      }

      // Clear the flag after loading is complete
      this.isLoadingTemplate = false;

      showToast(`Template "${templateName}" loaded successfully!`, "success");
    } catch (error) {
      console.error("❌ Error loading template:", error);
      showToast("Error loading template", "error");
      // Clear the flag in case of error
      this.isLoadingTemplate = false;
    }
  }

  async loadTenantFromTemplate(tenantType, tenantData) {
    const selectId = `contractTenant${tenantType}`;
    const tenantSelect = document.getElementById(selectId);

    if (!tenantSelect) return;

    // Check if this tenant exists in the dropdown (existing tenant)
    const existingTenantOption = Array.from(tenantSelect.options).find(
      (option) => {
        return option.value === (tenantData.fin || tenantData.id || "");
      },
    );

    if (existingTenantOption && existingTenantOption.value !== "") {
      // Tenant exists in dropdown, select it
      tenantSelect.value = existingTenantOption.value;
      tenantSelect.dispatchEvent(new Event("change"));
    } else {
      // Custom tenant, need to show new tenant fields and populate them
      tenantSelect.value = "ADD_NEW_TENANT";
      tenantSelect.dispatchEvent(new Event("change"));

      // Wait for the fields to appear
      setTimeout(() => {
        this.populateNewTenantFields(tenantType, tenantData);
      }, 100);
    }
  }

  async loadMultipleTenantBFromTemplate(tenantsData) {
    if (!Array.isArray(tenantsData) || tenantsData.length === 0) {
      return;
    }

    // Get all checkboxes in the tenant B dropdown
    const allCheckboxes = document.querySelectorAll(".tenant-b-checkbox");

    // Clear all existing selections first
    allCheckboxes.forEach((cb) => (cb.checked = false));

    // Check the boxes for each tenant in the template
    for (const tenantData of tenantsData) {
      // Find the matching checkbox by FIN or other identifier
      const identifier =
        tenantData.fin || tenantData.finNumber || tenantData.id;

      if (identifier) {
        // Try to find checkbox with this identifier
        const checkbox = Array.from(allCheckboxes).find((cb) => {
          return (
            cb.value === identifier ||
            cb.value.includes(identifier) ||
            cb.getAttribute("data-name") === tenantData.name
          );
        });

        if (checkbox) {
          checkbox.checked = true;
        }
      }
    }

    // Trigger the change event to update display and process selections
    this.handleTenantBCheckboxChange();

    // Update the contract preview
    this.updateContractPreview();
  }

  populateNewTenantFields(tenantType, tenantData) {
    const fieldPrefix = tenantType === "A" ? "newTenantA" : "newTenantB";

    // Populate name field
    const nameField = document.getElementById(`${fieldPrefix}Name`);
    if (nameField && tenantData.name) {
      nameField.value = tenantData.name;
    }

    // Populate passport field
    const passportField = document.getElementById(`${fieldPrefix}Passport`);
    if (passportField && (tenantData.passportNumber || tenantData.passport)) {
      passportField.value =
        tenantData.passportNumber || tenantData.passport || "";
    }

    // Populate FIN field
    const finField = document.getElementById(`${fieldPrefix}Fin`);
    if (finField && (tenantData.finNumber || tenantData.fin)) {
      finField.value = tenantData.finNumber || tenantData.fin || "";
    }

    // Populate email field (for Tenant A)
    if (tenantType === "A") {
      const emailField = document.getElementById(`${fieldPrefix}Email`);
      if (emailField && tenantData.email) {
        emailField.value = tenantData.email;
      }
    }

    console.log(
      `✅ Populated new tenant ${tenantType} fields with template data`,
    );
  }

  toggleDeleteConfirm(templateName) {
    this.pendingDeletes.add(templateName);
    // Re-render templates to show check/cancel buttons
    this.loadAndRenderTemplates();
  }

  cancelDeleteTemplate(templateName) {
    this.pendingDeletes.delete(templateName);
    // Re-render templates to show trash button again
    this.loadAndRenderTemplates();
  }

  async confirmDeleteTemplate(templateName) {
    this.pendingDeletes.delete(templateName);

    try {
      const result = await this.templateService.deleteTemplate(templateName);

      if (result.success) {
        showToast(
          `Template "${templateName}" deleted successfully!`,
          "success",
        );
        await this.loadAndRenderTemplates();
      } else {
        showToast("Failed to delete template: " + result.error, "error");
      }
    } catch (error) {
      console.error("❌ Error deleting template:", error);
      showToast("Error deleting template", "error");
    }
  }

  resetForm() {
    try {
      // Reset contract data to defaults
      this.contractData = {
        address: "",
        room: "",
        agreementDate: new Date().toISOString().split("T")[0],
        leasePeriod: "",
        moveInDate: "",
        moveOutDate: "",
        monthlyRental: "",
        securityDeposit: "",
        partialDepositReceived: false,
        partialDepositAmount: "",
        electricityBudget: "400",
        cleaningFee: "20",
        paymentMethod: "BANK_TRANSFER",
        fullPaymentReceived: false,
        pestControlClause: false,
      };

      // Reset tenant selections
      this.selectedTenantA = null;
      this.selectedTenantB = []; // Reset to empty array

      // Reset additional clauses
      this.additionalClauses = [];

      // Reset signatures
      this.signatures = {
        tenantA: null,
        tenantB: null,
      };

      // Reset form fields
      this.resetFormFields();

      // Reset tenant dropdowns
      this.resetTenantDropdowns();

      // Hide new tenant fields
      this.hideNewTenantFields();

      // Re-render additional clauses (empty)
      this.renderAdditionalClauses();

      // Update contract preview
      this.updateContractPreview();

      showToast("Form reset successfully", "success");
    } catch (error) {
      console.error("❌ Error resetting form:", error);
      showToast("Error resetting form", "error");
    }
  }

  resetFormFields() {
    // Reset all contract form fields
    const formFields = [
      "contractAddress",
      "contractRoom",
      "contractAgreementDate",
      "contractLeasePeriod",
      "contractMoveInDate",
      "contractMoveOutDate",
      "contractMonthlyRental",
      "contractSecurityDeposit",
      "contractElectricityBudget",
      "contractCleaningFee",
    ];

    formFields.forEach((fieldId) => {
      const element = document.getElementById(fieldId);
      if (element) {
        if (fieldId === "contractAgreementDate") {
          element.value = new Date().toISOString().split("T")[0];
        } else if (fieldId === "contractElectricityBudget") {
          element.value = "400";
        } else if (fieldId === "contractCleaningFee") {
          element.value = "20";
        } else {
          element.value = "";
        }
      }
    });

    // Reset payment method dropdown
    const paymentMethodElement = document.getElementById(
      "contractPaymentMethod",
    );
    if (paymentMethodElement) {
      paymentMethodElement.value = "BANK_TRANSFER";
    }

    // Reset full payment checkbox
    const fullPaymentElement = document.getElementById("fullPaymentReceived");
    if (fullPaymentElement) {
      fullPaymentElement.checked = false;
    }

    // Reset partial deposit checkbox and input
    const partialDepositCheckbox = document.getElementById(
      "contractPartialDepositReceived",
    );
    if (partialDepositCheckbox) {
      partialDepositCheckbox.checked = false;
    }

    const partialDepositAmountContainer = document.getElementById(
      "partialDepositAmountContainer",
    );
    if (partialDepositAmountContainer) {
      partialDepositAmountContainer.style.display = "none";
    }

    const partialDepositAmountInput = document.getElementById(
      "contractPartialDepositAmount",
    );
    if (partialDepositAmountInput) {
      partialDepositAmountInput.value = "";
    }

    // Reset pest control checkbox
    const pestControlElement = document.getElementById("pestControlClause");
    if (pestControlElement) {
      pestControlElement.checked = false;
    }

    // Reset new tenant fields
    const newTenantFields = [
      "newTenantAName",
      "newTenantAPassport",
      "newTenantAFin",
      "newTenantAEmail",
      "newTenantBName",
      "newTenantBPassport",
      "newTenantBFin",
    ];

    newTenantFields.forEach((fieldId) => {
      const element = document.getElementById(fieldId);
      if (element) {
        element.value = "";
      }
    });
  }

  resetTenantDropdowns() {
    // Reset tenant dropdowns to default
    const tenantASelect = document.getElementById("contractTenantA");
    const tenantBSelect = document.getElementById("contractTenantB");

    if (tenantASelect) {
      tenantASelect.value = "";
    }

    if (tenantBSelect) {
      tenantBSelect.value = "";
    }
  }

  hideNewTenantFields() {
    // Hide new tenant A fields
    const newTenantAFields = document.getElementById("newTenantAFields");
    if (newTenantAFields) {
      newTenantAFields.style.display = "none";
    }

    // Hide new tenant B fields
    const newTenantBFields = document.getElementById("newTenantFields");
    if (newTenantBFields) {
      newTenantBFields.style.display = "none";
    }
  }
}

// Export for use in other modules
window.ContractManagementComponent = ContractManagementComponent;
