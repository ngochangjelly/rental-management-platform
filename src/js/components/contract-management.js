/**
 * Contract Management Component
 * Handles contract creation with editor-like interface
 */
class ContractManagementComponent {
  constructor() {
    this.tenants = [];
    this.properties = [];
    this.selectedTenantA = null;
    this.selectedTenantB = null;
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
      tenancyPeriod: "",
      monthlyRental: "",
      securityDeposit: "",
      electricityBudget: "400",
      cleaningFee: "20",
      paymentMethod: "CASH",
    };
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadTenants();
  }

  setupEventListeners() {
    // Event listeners will be added when modal is shown
  }

  async loadTenants() {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.TENANTS + "?limit=100"
      );
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
          result.error || "Unknown format"
        );
        this.tenants = [];
      }

      console.log(
        "✅ Loaded",
        this.tenants.length,
        "tenants for contract creation"
      );
    } catch (error) {
      console.error("Error loading tenants:", error);
      this.tenants = [];
    }
  }

  async loadProperties() {
    try {
      const response = await API.get(
        API_CONFIG.ENDPOINTS.PROPERTIES + "?limit=100"
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
          result.error || "Unknown format"
        );
        this.properties = [];
      }

      console.log(
        "✅ Loaded",
        this.properties.length,
        "properties for contract creation"
      );
    } catch (error) {
      console.error("Error loading properties:", error);
      this.properties = [];
    }
  }

  populateTenantsDropdown() {
    console.log(
      "📋 Populating tenant dropdowns with",
      this.tenants.length,
      "tenants"
    );

    const tenantASelect = document.getElementById("contractTenantA");
    const tenantBSelect = document.getElementById("contractTenantB");

    console.log('🔧 tenantASelect found:', !!tenantASelect, tenantASelect);
    console.log('🔧 tenantBSelect found:', !!tenantBSelect, tenantBSelect);

    if (!tenantASelect || !tenantBSelect) {
      console.error("❌ Tenant select elements not found");
      console.error('❌ tenantASelect:', tenantASelect);
      console.error('❌ tenantBSelect:', tenantBSelect);
      return;
    }

    // Clear existing options
    tenantASelect.innerHTML =
      '<option value="">Select Tenant A (Main Tenant)</option>';
    tenantBSelect.innerHTML = '<option value="">Select Tenant B</option>';
    
    // Add "Add New Tenant" options
    tenantASelect.innerHTML += '<option value="ADD_NEW_TENANT" style="color: #0d6efd; font-weight: 500;"><i class="bi bi-person-plus me-1"></i>+ Add New Tenant</option>';
    tenantBSelect.innerHTML += '<option value="ADD_NEW_TENANT" style="color: #0d6efd; font-weight: 500;"><i class="bi bi-person-plus me-1"></i>+ Add New Tenant</option>';

    // Check if we have tenants
    if (!this.tenants || this.tenants.length === 0) {
      console.warn("⚠️ No tenants available to populate dropdown");
      tenantASelect.innerHTML +=
        '<option value="" disabled>No tenants available</option>';
      return;
    }

    // Populate with tenant data
    this.tenants.forEach((tenant, index) => {
      const fin = tenant.fin || tenant.id || "";
      const passport = tenant.passportNumber || tenant.passport || "";
      const name = tenant.name || "Unnamed Tenant";
      
      // Use index as a fallback identifier to ensure we can always find the tenant
      const identifier = fin || `tenant_${index}`;
      
      console.log(`🔧 Adding tenant option: ${name} with identifier: ${identifier}`, tenant);

      const option = `<option value="${identifier}" data-passport="${passport}" data-name="${name}" data-index="${index}">
                ${name} ${fin ? `(FIN: ${fin})` : ""}
            </option>`;

      tenantASelect.innerHTML += option;
      tenantBSelect.innerHTML += option;
    });

    console.log("✅ Populated tenant dropdowns successfully");

    // Add event listeners for tenant selection (remove existing first)
    console.log('🔧 Setting up event listeners...');
    tenantASelect.removeEventListener("change", this.tenantAChangeHandler);
    tenantBSelect.removeEventListener("change", this.tenantBChangeHandler);

    this.tenantAChangeHandler = (e) => {
      console.log('🔧 Tenant A change event triggered with value:', e.target.value);
      this.handleTenantSelection("A", e.target.value);
    };
    this.tenantBChangeHandler = (e) => {
      console.log('🔧 Tenant B change event triggered with value:', e.target.value);
      this.handleTenantSelection("B", e.target.value);
    };

    tenantASelect.addEventListener("change", this.tenantAChangeHandler);
    tenantBSelect.addEventListener("change", this.tenantBChangeHandler);
    
    console.log('✅ Event listeners attached successfully');
  }

  populatePropertiesDropdown() {
    console.log(
      "🏢 Populating property dropdown with",
      this.properties.length,
      "properties"
    );

    const addressSelect = document.getElementById("contractAddress");

    if (!addressSelect) {
      console.error("❌ Property address select element not found");
      return;
    }

    // Clear existing options
    addressSelect.innerHTML =
      '<option value="">Select property address</option>';

    // Check if we have properties
    if (!this.properties || this.properties.length === 0) {
      console.warn("⚠️ No properties available to populate dropdown");
      addressSelect.innerHTML +=
        '<option value="" disabled>No properties available</option>';
      return;
    }

    // Populate with property data
    this.properties.forEach((property) => {
      const address =
        property.address ||
        property.location ||
        property.name ||
        "Unknown Address";
      const id = property.id || property._id || "";

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

  handleAddressSelection(address) {
    console.log(`🏠 Address selected: ${address}`);
    this.contractData.address = address;
    this.updateContractPreview();
  }

  handleTenantSelection(tenantType, identifier) {
    console.log(`🔄 Handling tenant selection: ${tenantType} = ${identifier}`);
    
    // Handle "Add New Tenant" option
    if (identifier === "ADD_NEW_TENANT") {
      console.log(`🆕 Showing new tenant input fields for Tenant ${tenantType}`);
      this.showNewTenantFields(tenantType);
      return;
    }
    
    console.log('🔧 Available tenants:', this.tenants);
    console.log('🔧 Tenants array length:', this.tenants.length);
    
    let tenant = null;
    
    // Get the select element to access data attributes
    const selectElement = tenantType === "A" ? 
      document.getElementById("contractTenantA") : 
      document.getElementById("contractTenantB");
    
    console.log('🔧 Select element found:', !!selectElement);
    
    if (selectElement) {
      const selectedOption = selectElement.selectedOptions[0];
      console.log('🔧 Selected option:', selectedOption);
      
      if (selectedOption) {
        const tenantIndex = selectedOption.dataset.index;
        console.log('🔧 Tenant index from dataset:', tenantIndex);
        
        if (tenantIndex !== undefined && tenantIndex !== '') {
          const index = parseInt(tenantIndex);
          console.log('🔧 Parsed index:', index, 'Valid range:', index >= 0 && index < this.tenants.length);
          
          if (!isNaN(index) && index >= 0 && index < this.tenants.length) {
            tenant = this.tenants[index];
            console.log(`🎯 Found tenant by index ${index}:`, tenant);
            console.log('🎯 Tenant name:', tenant?.name);
            console.log('🎯 Tenant passport:', tenant?.passportNumber);
            console.log('🎯 Tenant fin:', tenant?.fin);
          }
        }
      }
    }
    
    // Fallback to original logic if index-based lookup fails
    if (!tenant) {
      console.log('🔄 Using fallback logic to find tenant');
      // Try to find by fin or id first
      tenant = this.tenants.find((t) => t.fin === identifier || t.id === identifier);
      
      // If not found and identifier starts with "tenant_", use index
      if (!tenant && identifier.startsWith('tenant_')) {
        const index = parseInt(identifier.replace('tenant_', ''));
        tenant = this.tenants[index];
      }
      
      // If still not found, try by name as last resort
      if (!tenant && identifier) {
        tenant = this.tenants.find((t) => t.name === identifier);
      }
      
      console.log('🎯 Fallback result:', tenant);
    }
    
    console.log(`🎯 Final tenant for ${tenantType}:`, tenant);

    if (tenantType === "A") {
      this.selectedTenantA = tenant;
      console.log('✅ Set selectedTenantA:', this.selectedTenantA);
      
      // Auto-populate signature if this is a main tenant with signature
      if (tenant && tenant.signature && this.isMainTenant(tenant)) {
        console.log('🖋️ Auto-populating Tenant A signature from tenant data');
        this.signatures.tenantA = tenant.signature;
        this.updateSignaturePreview('A');
      }
    } else {
      this.selectedTenantB = tenant;
      console.log('✅ Set selectedTenantB:', this.selectedTenantB);
      
      // Hide new tenant fields if a different tenant is selected
      this.hideNewTenantFields(tenantType);
    }

    console.log('🔄 Calling updateContractPreview...');
    this.updateContractPreview();
    console.log('✅ updateContractPreview called');
  }

  showNewTenantFields(tenantType) {
    const fieldsId = tenantType === 'A' ? 'newTenantAFields' : 'newTenantFields';
    const nameInputId = tenantType === 'A' ? 'newTenantAName' : 'newTenantBName';
    const passportInputId = tenantType === 'A' ? 'newTenantAPassport' : 'newTenantBPassport';
    
    const newTenantFields = document.getElementById(fieldsId);
    if (newTenantFields) {
      newTenantFields.style.display = 'block';
      
      // Clear the fields
      const nameInput = document.getElementById(nameInputId);
      const passportInput = document.getElementById(passportInputId);
      
      if (nameInput) {
        nameInput.value = '';
        nameInput.classList.remove('is-invalid');
      }
      if (passportInput) {
        passportInput.value = '';
        passportInput.classList.remove('is-invalid');
      }
      
      // For Tenant A, also clear email field
      if (tenantType === 'A') {
        const emailInput = document.getElementById('newTenantAEmail');
        if (emailInput) {
          emailInput.value = '';
          emailInput.classList.remove('is-invalid');
        }
      }
      
      // Focus on the name field
      if (nameInput) {
        nameInput.focus();
      }
      
      // Hide the other tenant's fields if they are open
      if (tenantType === 'A') {
        this.hideNewTenantFields('B');
      } else {
        this.hideNewTenantFields('A');
      }
      
      // Setup event listeners for the input fields
      this.setupNewTenantInputListeners(tenantType);
    }
  }
  
  hideNewTenantFields(tenantType = 'B') {
    const fieldsId = tenantType === 'A' ? 'newTenantAFields' : 'newTenantFields';
    const newTenantFields = document.getElementById(fieldsId);
    if (newTenantFields) {
      newTenantFields.style.display = 'none';
      
      // Only clear temporary tenant selections (those created from "Add New Tenant")
      if (tenantType === 'A' && this.selectedTenantA?.isTemporary) {
        this.selectedTenantA = null;
      } else if (tenantType === 'B' && this.selectedTenantB?.isTemporary) {
        this.selectedTenantB = null;
      }
      
      // Only update contract preview if we actually cleared a temporary tenant
      if ((tenantType === 'A' && this.selectedTenantA?.isTemporary) || 
          (tenantType === 'B' && this.selectedTenantB?.isTemporary)) {
        this.updateContractPreview();
      }
    }
  }
  
  setupNewTenantInputListeners(tenantType) {
    const nameInputId = tenantType === 'A' ? 'newTenantAName' : 'newTenantBName';
    const passportInputId = tenantType === 'A' ? 'newTenantAPassport' : 'newTenantBPassport';
    const emailInputId = tenantType === 'A' ? 'newTenantAEmail' : null;
    
    const nameInput = document.getElementById(nameInputId);
    const passportInput = document.getElementById(passportInputId);
    const emailInput = emailInputId ? document.getElementById(emailInputId) : null;
    
    if (!nameInput || !passportInput) {
      return;
    }
    
    // Create unique handler names for each tenant type
    const inputHandlerProp = `newTenant${tenantType}InputHandler`;
    const blurHandlerProp = `newTenant${tenantType}BlurHandler`;
    
    // Remove existing listeners if they exist
    if (this[inputHandlerProp]) {
      nameInput.removeEventListener('input', this[inputHandlerProp]);
      passportInput.removeEventListener('input', this[inputHandlerProp]);
      if (emailInput) emailInput.removeEventListener('input', this[inputHandlerProp]);
    }
    if (this[blurHandlerProp]) {
      nameInput.removeEventListener('blur', this[blurHandlerProp]);
      passportInput.removeEventListener('blur', this[blurHandlerProp]);
      if (emailInput) emailInput.removeEventListener('blur', this[blurHandlerProp]);
    }
    
    // Create bound handlers
    this[inputHandlerProp] = () => this.handleNewTenantInput(tenantType);
    this[blurHandlerProp] = () => this.handleNewTenantBlur(tenantType);
    
    // Add event listeners
    nameInput.addEventListener('input', this[inputHandlerProp]);
    passportInput.addEventListener('input', this[inputHandlerProp]);
    nameInput.addEventListener('blur', this[blurHandlerProp]);
    passportInput.addEventListener('blur', this[blurHandlerProp]);
    
    // Add listeners for email input if it exists (Tenant A only)
    if (emailInput) {
      emailInput.addEventListener('input', this[inputHandlerProp]);
      emailInput.addEventListener('blur', this[blurHandlerProp]);
    }
  }
  
  handleNewTenantInput(tenantType) {
    const nameInputId = tenantType === 'A' ? 'newTenantAName' : 'newTenantBName';
    const passportInputId = tenantType === 'A' ? 'newTenantAPassport' : 'newTenantBPassport';
    const emailInputId = tenantType === 'A' ? 'newTenantAEmail' : null;
    
    const nameInput = document.getElementById(nameInputId);
    const passportInput = document.getElementById(passportInputId);
    const emailInput = emailInputId ? document.getElementById(emailInputId) : null;
    
    if (!nameInput || !passportInput) {
      return;
    }
    
    const name = nameInput.value.trim();
    const passport = passportInput.value.trim();
    const email = emailInput ? emailInput.value.trim() : '';
    
    // Clear error states when user starts typing
    if (name && nameInput.classList.contains('is-invalid')) {
      nameInput.classList.remove('is-invalid');
    }
    if (passport && passportInput.classList.contains('is-invalid')) {
      passportInput.classList.remove('is-invalid');
    }
    if (emailInput && email && emailInput.classList.contains('is-invalid')) {
      emailInput.classList.remove('is-invalid');
    }
    
    // If both required fields have values, create the temporary tenant
    if (name && passport) {
      this.createTemporaryTenant(tenantType, name, passport, email);
    }
  }
  
  handleNewTenantBlur(tenantType) {
    const nameInputId = tenantType === 'A' ? 'newTenantAName' : 'newTenantBName';
    const passportInputId = tenantType === 'A' ? 'newTenantAPassport' : 'newTenantBPassport';
    
    // Validate on blur
    const nameInput = document.getElementById(nameInputId);
    const passportInput = document.getElementById(passportInputId);
    
    if (nameInput && !nameInput.value.trim()) {
      nameInput.classList.add('is-invalid');
    }
    
    if (passportInput && !passportInput.value.trim()) {
      passportInput.classList.add('is-invalid');
    }
  }
  
  createTemporaryTenant(tenantType, name, passport, email = '') {
    // Create a temporary tenant object for the contract
    const newTenant = {
      id: `temp_tenant_${tenantType}_${Date.now()}`,
      name: name,
      passportNumber: passport,
      email: email,
      isTemporary: true,
      createdAt: new Date().toISOString()
    };
    
    // Set this as the selected tenant
    if (tenantType === 'A') {
      this.selectedTenantA = newTenant;
      console.log('✅ Created temporary tenant A:', this.selectedTenantA);
    } else {
      this.selectedTenantB = newTenant;
      console.log('✅ Created temporary tenant B:', this.selectedTenantB);
    }
    
    // Update the contract preview
    this.updateContractPreview();
  }

  setupContractInputs() {
    const inputs = [
      "contractRoom",
      "contractAgreementDate",
      "contractLeasePeriod",
      "contractTenancyPeriod",
      "contractMonthlyRental",
      "contractSecurityDeposit",
      "contractElectricityBudget",
      "contractCleaningFee",
      "contractPaymentMethod",
    ];

    inputs.forEach((inputId) => {
      const input = document.getElementById(inputId);
      if (input) {
        input.addEventListener("input", () => {
          const field =
            inputId.replace("contract", "").charAt(0).toLowerCase() +
            inputId.replace("contract", "").slice(1);
          this.contractData[field] = input.value;
          this.updateContractPreview();
        });
      }
    });
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
      (clause) => clause.id !== id
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
                        <textarea class="form-control" rows="3" placeholder="Enter additional clause..."
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
      `button[onclick="contractManager.openSignatureUpload('${tenantType}')"]`
    );
    const originalText = uploadButton ? uploadButton.innerHTML : "";

    try {
      console.log(
        `🔄 Starting signature upload for Tenant ${tenantType}`,
        file
      );

      // Validate file type and size
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file (PNG, JPG, etc.)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        alert("File size must be less than 10MB");
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
        API_CONFIG.ENDPOINTS.UPLOAD_TENANT_DOCUMENT
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
          `Upload failed with status: ${response.status} ${response.statusText}`
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
          imageUrl
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
    console.log('🔄 updateContractPreview called');
    const preview = document.getElementById("contractPreview");
    if (!preview) {
      console.log('❌ Contract preview element not found');
      return;
    }

    console.log('🔧 selectedTenantA:', this.selectedTenantA);
    console.log('🔧 selectedTenantB:', this.selectedTenantB);

    const tenantAInfo = this.selectedTenantA
      ? {
          name: this.selectedTenantA.name,
          passport: this.selectedTenantA.passportNumber || this.selectedTenantA.passport || this.selectedTenantA.fin,
          email: this.selectedTenantA.email || "",
        }
      : {
          name: "[Tenant A Name]",
          passport: "[Tenant A Passport]",
          email: "[Email]",
        };

    const tenantBInfo = this.selectedTenantB
      ? {
          name: this.selectedTenantB.name,
          passport: this.selectedTenantB.passportNumber || this.selectedTenantB.passport || this.selectedTenantB.fin,
        }
      : { name: "[Tenant B Name]", passport: "[Tenant B Passport]" };
      
    console.log('🔧 tenantAInfo:', tenantAInfo);
    console.log('🔧 tenantBInfo:', tenantBInfo);

    // Generate additional clauses HTML
    let additionalClausesHtml = "";
    this.additionalClauses.forEach((clause, index) => {
      const letter = String.fromCharCode(97 + index + 12); // Start from 'm'
      if (clause.text.trim()) {
        additionalClausesHtml += `<p>${letter}) ${clause.text}</p>\n`;
      }
    });

    preview.innerHTML = `
            <div class="contract-content" style="font-family: 'Times New Roman', serif; line-height: 1.6; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="font-weight: bold; margin-bottom: 10px;">HOUSE SHARING AGREEMENT</h2>
                    <p><strong>Full address:</strong> ${
                      this.contractData.address || "[Property Address]"
                    }</p>
                    <p><strong>Room:</strong> ${
                      this.contractData.room || "[Room Type]"
                    }</p>
                    <p><strong>THIS AGREEMENT is made on:</strong> ${
                      this.contractData.agreementDate ||
                      new Date().toISOString().split("T")[0]
                    }</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p><strong>BETWEEN</strong></p>
                    <p style="margin-left: 20px;">
                        <strong>Main tenant:</strong> ${tenantAInfo.name}<br>
                        <strong>FIN/PASSPORT:</strong> ${
                          tenantAInfo.passport
                        }<br>
                        <strong>Email:</strong> ${tenantAInfo.email}
                    </p>
                    <p style="margin-left: 20px; font-style: italic;">
                        (Hereinafter called "TenantA" which expresses together where the context so admits, shall include all persons having title under 'TenantA') of the one part.
                    </p>
                </div>

                <div style="margin-bottom: 20px;">
                    <p><strong>AND</strong></p>
                    <p style="margin-left: 20px;">
                        <strong>Name:</strong> ${tenantBInfo.name}<br>
                        <strong>Passport:</strong> ${tenantBInfo.passport}
                    </p>
                    <p style="margin-left: 20px; font-style: italic;">
                        (Hereinafter called "Tenant B", which expresses together with where the context so admits, shall include all persons having title under ' Tenant B') of the one part.
                    </p>
                </div>

                <p><strong>Payment method:</strong> ${
                  this.contractData.paymentMethod || "CASH"
                }</p>

                <div style="margin: 30px 0;">
                    <p><strong>NOW IT IS HEREBY AGREED AS FOLLOWS:</strong></p>
                    
                    <div style="margin: 20px 0; line-height: 1.8;">
                        <p><strong>Lease Period:</strong> ${
                          this.contractData.leasePeriod || "[Lease Period]"
                        }</p>
                        
                        <p><strong>Tenancy Period:</strong> ${
                          this.contractData.tenancyPeriod || "[Tenancy Period]"
                        }</p>
                        
                        <p><strong>Moving Time:</strong> Move in after 15:00, Move out before 11:00</p>
                        
                        <p><strong>Monthly Rental:</strong> $${
                          this.contractData.monthlyRental || "[Monthly Rental]"
                        }<br>
                        <small style="margin-left: 20px;">*Room rental rate is strictly confidential<br>
                        *Renewal contract is subject to mutual agreement by Tenant A and Tenant B<br>
                        *Payable by the 1st Day of each calendar month to "Tenant A"</small></p>
                        
                        <p><strong>Security Deposit:</strong> $${
                          this.contractData.securityDeposit ||
                          "[Security Deposit]"
                        }<br>
                        <small style="margin-left: 20px;">*This deposit shall not be utilised to set off rent due and payable during the currency of this Agreement</small></p>
                    </div>
                </div>

                <div style="margin: 20px 0;">
                    <p><small>Monthly rentals include Wi-Fi, utilities, gas, usage of condominium facilities such as swimming pool, barbequepit and multi-purpose hall.</small></p>
                </div>

                <div style="margin: 20px 0;">
                    <p><strong>1. TENANT B(S) HEREBY AGREE(S) WITH TENANT A AS FOLLOWS:</strong></p>
                    <div style="margin-left: 20px;">
                        <p><strong>a)</strong> To pay the equivalent of 1 (ONE) month's rent as a deposit and 1 (ONE) month's rent as an advance upon signing of this Agreement. The deposit is to be held by TenantA as security for the due performance and observance by TenantB of all covenants, conditions, and stipulations on the part of Tenant B herein contained, failing which TenantB shall forfeit to TenantA the said deposit or such part thereof as may be necessary to remedy such default. PROVIDED ALWAYS that Tenant B shall duly perform the said covenants, conditions, and stipulations as aforesaid, up to and including the date of expiration of the term hereby created, Tenant A shall repay the said deposit within 7 (SEVEN) days from the date of such expiration without any interest. This deposit shall not be utilised to offset any rent due and payable during the currency of this Agreement. Such deposit shall be refundable at the end of the term, less deduction for damages caused by the negligence of Tenant B and of any breach of this Agreement.</p>
                        
                        <p><strong>b)</strong> In addition, and without prejudice to any other right power or remedy of Tenant A if the rent hereby reserved or any part thereof shall remain unpaid for 7 (SEVEN) days after the same shall have become due (whether any formal or legal demand therefore shall have been made or not) then, Tenant A shall forfeit the security deposit and at anytime thereafter, repossess The Room and remove all Tenant B's belongings from The Room without being liable for any loss or damage of such removal. Tenant A shall be entitled to recover all legal fees arising from the recovery of unpaid rent by Tenant B.</p>
                        
                        <p><strong>c)</strong> To use and manage the room, premises, and furniture therein in a careful manner and to keep the interior of the premises in a GOOD, CLEAN, TIDY, and TENANTABLE condition except for normal fair wear and tear.</p>
                        
                        <p><strong>d)</strong> Not to do so permits to be done upon the premises or room, which may be unlawful, immoral, or become a nuisance or annoyance to occupiers of adjoining or adjacent room(s).</p>
                        
                        <p><strong>e)</strong> To use the premises for the purpose of private residence only and not to assign, sublet, or otherwise part possession of the premises or any part thereof without the written consent of Tenant A.</p>
                        
                        <p><strong>f)</strong> To peaceably and quietly at the expiration of the tenancy deliver up to Tenant A the room in like condition as if the same were delivered to Tenant B at the commencement of this Agreement, fair wear and tear.</p>
                        
                        <p><strong>g)</strong> Not to create a nuisance, not to use the premises or any part thereof in a manner which may become a nuisance or annoyance to TenantA or the occupants of the premises, building or to neighbouring parties.</p>
                        
                        <p><strong>h)</strong> Strictly NO PETS in the premises.</p>
                        
                        <p><strong>i)</strong> No illegal or immoral activities, not to do or suffer to be done anything in or upon the said premises or any part thereof, any activities of an illegal or immoral nature.</p>
                        
                        <p><strong>j)</strong> To permit Tenant A to carryout due diligence checks to ensure that all times during the currency of this Agreement that Tenant B and/or permitted occupants are not illegal immigrants and comply with all the rules and regulations relating to the Immigration Act and the Employment of Foreign Workers Act (if applicable) and any other Act of Parliament, regulations, or any rules of orders thereunder which relates to foreign residents and workers.</p>
                        
                        <p><strong>k)</strong> To provide TenantA, upon request, for physical inspection, all immigration and employment documents, including but not limited to the passports of all non-local occupants, the employment pass and/or work permits, proof of employment, and to provide TenantA with certified true copies of such documents.</p>
                        
                        <p><strong>l)</strong> Not to bring or store or permit to be brought or stored in the premises or any part thereof any goods which are of a dangerous, obnoxious, inflammable or hazardous nature.</p>
                        
                        <p><strong>m)</strong> At the expiration of the term hereby created, to deliver up the room peacefully and quietly in like condition as the same were delivered to Tenant B at the commencement of the term hereby created. Authorised alterations or additions, fair wear and tear. As the room is delivered in clean condition, Tenant B is expected to clear all personal belongings from the room and the premises, clean the room and their designated area spick and span, in like condition as the same were delivered. In failing to do so, a minimum of SGD$150 (SINGAPORE DOLLARS ONE HUNDRED AND FIFTY ONLY) will be deducted from the security deposit for the time spent cleaning the place.</p>
                        
                        <p><strong>n)</strong> For 6 6-month agreement, the deposit money will be deducted SGD$100 for Air-conditioner services. On a 1-year agreement, the deduction level would be SGD$200. ONLY APPLY FOR A ROOM WITH AN AIR-CONDITIONER.</p>
                        
                        <p><strong>o)</strong> Cost of damage for common area facilities provided previously by Tenant A will be handled by both parties. For the first 200 (SGD) in any single bill, the bill would be divided among all subtenants of the unit. The exceeding amount would be handled by Tenant A. Only applied for 6 months lease and above.</p>
                        
                        <p><strong>p)</strong> No smoking, vaping in the house (the first time violated will get a warning; the next time violated will lead to the contract's termination). Vaping is now illegal in Singapore, and being caught can lead to a jail sentence.</p>
                        
                        <p><strong>q)</strong> No visitors without permission from Tenant B to Tenant A.</p>
                        
                        <p><strong>r)</strong> No gathering (with/without alcoholic consumption) without permission from Tenant A.</p>
                        
                        <p><strong>s)</strong> Strictly keep silent after 10:00 pm (the tenant will receive a warning for the first two times; the third time violation will lead to the contract's termination).</p>
                        
                        <p><strong>t)</strong> Tenant B shall provide written notice to Tenant A at least thirty (30) days before the expiration of the lease term, indicating whether Tenant B intends to renew the tenancy or vacate the premises upon the lease's conclusion.</p>
                        
                        ${additionalClausesHtml}
                    </div>
                </div>

                <div style="margin: 30px 0;">
                    <p><strong>2) AND PROVIDED ALWAYS AS IT IS HEREBY AGREED AS FOLLOWS:</strong></p>
                    <div style="margin-left: 20px;">
                        <p>If the rent hereby reserved or any part thereof shall be unpaid for 7 (SEVEN) days after becoming payable (whether formally demanded in writing or not) OR if any covenants, conditions or stipulations on Tenant B's part therein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained. Tenant A shall terminate the agreement and forfeit the deposit forthwith.</p>
                        
                        <p>Notwithstanding herein contained, Tenant A shall be under no liability to Tenant B for accidents happening, injuries sustained, or loss of life and damage to the property, goods, or chattels in the premises or in any part.</p>
                        
                        <p><strong>a) ELECTRICITY:</strong> A monthly budget of S$${
                          this.contractData.electricityBudget || "400"
                        } (SINGAPORE DOLLARS ${this.numberToWords(
      parseInt(this.contractData.electricityBudget || "400")
    ).toUpperCase()} ONLY) is set for the SP bills for the whole unit. Under circumstances where the total utility bill exceeds the limit cap, the outstanding due will be divided proportionally between all tenants of the unit. Tenant A reserved the right to claim from Tenant B. ONLY APPLY FOR A ROOM WITH AN AIR CONDITIONER.</p>
                        
                        <p><strong>b)</strong> Tenant B must produce an original/photocopy of documents such as NRIC/Passport/Work Permit/Employment Pass/Student Pass to prove his/her identity and legitimate stay in Singapore.</p>
                        
                        <p><strong>c)</strong> Security deposit will be refunded within 7 (SEVEN) days at the end of the lease after deducting any outstanding fees, with no interest.</p>
                        
                        <p><strong>d)</strong> Tenant B will be asked to leave the apartment within 1 (ONE) to 7 (SEVEN) days at the discretion of Tenant A for breach of agreement, and/or any terms and conditions stated in this Agreement if the rental is not paid by the first day of each calendar month.</p>
                        
                        <p><strong>e)</strong> The law applicable in any action arising out of this lease shall be the law of the Republic of Singapore, and the parties hereto submit themselves to the jurisdiction of the laws of Singapore.</p>
                        
                        <p><strong>f)</strong> Cleaning fee: SGD$${
                          this.contractData.cleaningFee || "20"
                        } / 1pax (if all tenants agree to hire a cleaning service)</p>
                    </div>
                </div>

                <div style="margin: 30px 0; text-align: center;">
                    <p><strong>By signing below, both parties agree to abide by all the above terms and conditions</strong></p>
                </div>

                <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                    <div style="text-align: center;">
                        <p><strong>Tenant A</strong></p>
                        <div style="height: 80px; margin: 20px 0;">
                            ${
                              this.signatures.tenantA
                                ? `<img src="${this.signatures.tenantA}" alt="Tenant A Signature" style="max-height: 60px;">`
                                : '<div style="border-bottom: 1px solid #000; width: 200px; margin: 40px 0;"></div>'
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
                                : '<div style="border-bottom: 1px solid #000; width: 200px; margin: 40px 0;"></div>'
                            }
                        </div>
                        <p>${tenantBInfo.name}</p>
                    </div>
                </div>
            </div>
        `;
  }

  // Helper method to check if a tenant is a main tenant
  isMainTenant(tenant) {
    if (!tenant || !tenant.properties || !Array.isArray(tenant.properties)) {
      return false;
    }
    
    // Check if any of the tenant's properties has them as main tenant
    return tenant.properties.some(prop => {
      return typeof prop === 'object' && prop.isMainTenant;
    });
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
      // Show loading state
      const exportBtn = document.querySelector(
        '[onclick="contractManager.exportToPDF()"]'
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

      // Create PDF filename in format: [tenantB]-[roomType]-[propertyAddress]
      const tenantBName = this.selectedTenantB?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "TenantB";
      const roomType = this.contractData.room?.replace(/[^a-zA-Z0-9]/g, "_") || "Room";
      const propertyAddress = this.contractData.address?.replace(/[^a-zA-Z0-9]/g, "_") || "Address";
      
      const filename = `${tenantBName}-${roomType}-${propertyAddress}.pdf`;

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
      const sectionSpacing = 8;

      // Helper function to add text with automatic page breaks
      const addText = (text, options = {}) => {
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

        // Check if we need a new page
        if (currentY > pageHeight - margin - 20) {
          pdf.addPage();
          currentY = margin;
        }

        // Split text into lines that fit the width
        const maxWidth = contentWidth - (options.indent ? 10 : 0);
        const lines = pdf.splitTextToSize(text, maxWidth);

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

      // Helper function to add table
      const addTable = (headers, rows) => {
        const colWidth = contentWidth / 2;

        for (let i = 0; i < rows.length; i++) {
          // Calculate cell content height
          pdf.setFontSize(9);
          const cellLines = pdf.splitTextToSize(rows[i][1], colWidth - 8);
          const cellHeight = Math.max(12, cellLines.length * 5 + 8);

          // Check if we need a new page
          if (currentY + cellHeight > pageHeight - margin - 20) {
            pdf.addPage();
            currentY = margin;
          }

          // Draw borders
          pdf.rect(margin, currentY - 4, colWidth, cellHeight);
          pdf.rect(margin + colWidth, currentY - 4, colWidth, cellHeight);

          // Add header text (left column)
          pdf.setFont(undefined, "bold");
          pdf.setFontSize(10);
          pdf.text(rows[i][0], margin + 4, currentY + 4);

          // Add content text (right column) - wrapped properly
          pdf.setFont(undefined, "normal");
          pdf.setFontSize(9);
          let cellY = currentY + 4;
          for (const line of cellLines) {
            pdf.text(line, margin + colWidth + 4, cellY);
            cellY += 5;
          }

          currentY += cellHeight + 2;
        }
      };

      // Generate contract content
      const tenantAInfo = this.selectedTenantA
        ? {
            name: this.selectedTenantA.name,
            passport: this.selectedTenantA.passportNumber,
            email: this.selectedTenantA.email || "",
          }
        : {
            name: "[Tenant A Name]",
            passport: "[Tenant A Passport]",
            email: "[Email]",
          };

      const tenantBInfo = this.selectedTenantB
        ? {
            name: this.selectedTenantB.name,
            passport: this.selectedTenantB.passportNumber,
          }
        : { name: "[Tenant B Name]", passport: "[Tenant B Passport]" };

      // Header
      addText("HOUSE SHARING AGREEMENT", {
        fontSize: 16,
        bold: true,
        center: true,
        spacing: 10,
      });
      addText(
        `Full address: ${this.contractData.address || "[Property Address]"}`,
        { center: true }
      );
      addText(`Room: ${this.contractData.room || "[Room Type]"}`, {
        center: true,
      });
      addText(
        `THIS AGREEMENT is made on: ${
          this.contractData.agreementDate ||
          new Date().toISOString().split("T")[0]
        }`,
        { center: true, spacing: 15 }
      );

      // Parties
      addText("BETWEEN", { bold: true, spacing: 5 });
      addText(`Main tenant: ${tenantAInfo.name}`, { indent: true });
      addText(`FIN/PASSPORT: ${tenantAInfo.passport}`, { indent: true });
      addText(`Email: ${tenantAInfo.email}`, { indent: true });
      addText(
        "(Hereinafter called \"TenantA\" which expresses together where the context so admits, shall include all persons having title under 'TenantA') of the one part.",
        { indent: true, spacing: 10 }
      );

      addText("AND", { bold: true, spacing: 5 });
      addText(`Name: ${tenantBInfo.name}`, { indent: true });
      addText(`Passport: ${tenantBInfo.passport}`, { indent: true });
      addText(
        "(Hereinafter called \"Tenant B\", which expresses together with where the context so admits, shall include all persons having title under ' Tenant B') of the one part.",
        { indent: true, spacing: 10 }
      );

      addText(`Payment method: ${this.contractData.paymentMethod || "CASH"}`, {
        spacing: 15,
      });

      // Agreement terms
      addText("NOW IT IS HEREBY AGREED AS FOLLOWS:", {
        bold: true,
        spacing: 10,
      });

      // Contract details as simple text
      addText(
        `Lease Period: ${this.contractData.leasePeriod || "[Lease Period]"}`,
        { bold: true, spacing: 8 }
      );
      addText(
        `Tenancy Period: ${
          this.contractData.tenancyPeriod || "[Tenancy Period]"
        }`,
        { bold: true, spacing: 8 }
      );
      addText("Moving Time: Move in after 15:00, Move out before 11:00", {
        bold: true,
        spacing: 8,
      });

      addText(
        `Monthly Rental: $${
          this.contractData.monthlyRental || "[Monthly Rental]"
        }`,
        { bold: true, spacing: 5 }
      );
      addText("*Room rental rate is strictly confidential", {
        fontSize: 9,
        indent: true,
      });
      addText(
        "*Renewal contract is subject to mutual agreement by Tenant A and Tenant B",
        { fontSize: 9, indent: true }
      );
      addText('*Payable by the 1st Day of each calendar month to "Tenant A"', {
        fontSize: 9,
        indent: true,
        spacing: 8,
      });

      addText(
        `Security Deposit: $${
          this.contractData.securityDeposit || "[Security Deposit]"
        }`,
        { bold: true, spacing: 5 }
      );
      addText(
        "*This deposit shall not be utilised to set off rent due and payable during the currency of this Agreement",
        { fontSize: 9, indent: true, spacing: 15 }
      );

      addText(
        "Monthly rentals include Wi-Fi, utilities, gas, usage of condominium facilities such as swimming pool, barbequepit and multi-purpose hall.",
        { fontSize: 9, spacing: 15 }
      );

      // Section 1
      addText("1. TENANT B(S) HEREBY AGREE(S) WITH TENANT A AS FOLLOWS:", {
        bold: true,
        fontSize: 12,
        spacing: 10,
      });

      const section1Clauses = [
        "a) To pay the equivalent of 1 (ONE) month's rent as a deposit and 1 (ONE) month's rent as an advance upon signing of this Agreement. The deposit is to be held by TenantA as security for the due performance and observance by TenantB of all covenants, conditions, and stipulations on the part of Tenant B herein contained, failing which TenantB shall forfeit to TenantA the said deposit or such part thereof as may be necessary to remedy such default.",
        "b) In addition, and without prejudice to any other right power or remedy of Tenant A if the rent hereby reserved or any part thereof shall remain unpaid for 7 (SEVEN) days after the same shall have become due then, Tenant A shall forfeit the security deposit and at anytime thereafter, repossess The Room and remove all Tenant B's belongings from The Room without being liable for any loss or damage of such removal.",
        "c) To use and manage the room, premises, and furniture therein in a careful manner and to keep the interior of the premises in a GOOD, CLEAN, TIDY, and TENANTABLE condition except for normal fair wear and tear.",
        "d) Not to do so permits to be done upon the premises or room, which may be unlawful, immoral, or become a nuisance or annoyance to occupiers of adjoining or adjacent room(s).",
        "e) To use the premises for the purpose of private residence only and not to assign, sublet, or otherwise part possession of the premises or any part thereof without the written consent of Tenant A.",
        "f) To peaceably and quietly at the expiration of the tenancy deliver up to Tenant A the room in like condition as if the same were delivered to Tenant B at the commencement of this Agreement, fair wear and tear.",
        "g) Not to create a nuisance, not to use the premises or any part thereof in a manner which may become a nuisance or annoyance to TenantA or the occupants of the premises, building or to neighbouring parties.",
        "h) Strictly NO PETS in the premises.",
        "i) No illegal or immoral activities, not to do or suffer to be done anything in or upon the said premises or any part thereof, any activities of an illegal or immoral nature.",
        "j) To permit Tenant A to carryout due diligence checks to ensure that all times during the currency of this Agreement that Tenant B and/or permitted occupants are not illegal immigrants and comply with all the rules and regulations relating to the Immigration Act and the Employment of Foreign Workers Act.",
        "k) To provide TenantA, upon request, for physical inspection, all immigration and employment documents, including but not limited to the passports of all non-local occupants, the employment pass and/or work permits, proof of employment.",
        "l) Not to bring or store or permit to be brought or stored in the premises or any part thereof any goods which are of a dangerous, obnoxious, inflammable or hazardous nature.",
        "m) At the expiration of the term hereby created, to deliver up the room peacefully and quietly in like condition as the same were delivered to Tenant B at the commencement of the term hereby created. As the room is delivered in clean condition, Tenant B is expected to clear all personal belongings from the room and the premises, clean the room and their designated area spick and span, in like condition as the same were delivered. In failing to do so, a minimum of SGD$150 will be deducted from the security deposit for the time spent cleaning the place.",
        "n) For 6 6-month agreement, the deposit money will be deducted SGD$100 for Air-conditioner services. On a 1-year agreement, the deduction level would be SGD$200. ONLY APPLY FOR A ROOM WITH AN AIR-CONDITIONER.",
        "o) Cost of damage for common area facilities provided previously by Tenant A will be handled by both parties. For the first 200 (SGD) in any single bill, the bill would be divided among all subtenants of the unit. The exceeding amount would be handled by Tenant A. Only applied for 6 months lease and above.",
        "p) No smoking, vaping in the house (the first time violated will get a warning; the next time violated will lead to the contract's termination). Vaping is now illegal in Singapore, and being caught can lead to a jail sentence.",
        "q) No visitors without permission from Tenant B to Tenant A.",
        "r) No gathering (with/without alcoholic consumption) without permission from Tenant A.",
        "s) Strictly keep silent after 10:00 pm (the tenant will receive a warning for the first two times; the third time violation will lead to the contract's termination).",
        "t) Tenant B shall provide written notice to Tenant A at least thirty (30) days before the expiration of the lease term, indicating whether Tenant B intends to renew the tenancy or vacate the premises upon the lease's conclusion.",
      ];

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

      const section2Clauses = [
        "If the rent hereby reserved or any part thereof shall be unpaid for 7 (SEVEN) days after becoming payable (whether formally demanded in writing or not) OR if any covenants, conditions or stipulations on Tenant B's part therein contained shall not be performed or if anytime Tenant B shall become bankrupt then and in any of the said cases, it shall be lawful for Tenant A at any time hereafter to re-enter and re-possess the room or any thereof, remove all Tenant B's belongings from the premises and not be liable for any loss and damage of such removal. Thereupon, this Agreement shall absolutely cease and determine, but without prejudice to the right of action of Tenant A in respect of any breach of Tenant B's covenants herein contained. Tenant A shall terminate the agreement and forfeit the deposit forthwith.",
        "Notwithstanding herein contained, Tenant A shall be under no liability to Tenant B for accidents happening, injuries sustained, or loss of life and damage to the property, goods, or chattels in the premises or in any part.",
        `a) ELECTRICITY: A monthly budget of S$${
          this.contractData.electricityBudget || "400"
        } (SINGAPORE DOLLARS ${this.numberToWords(
          parseInt(this.contractData.electricityBudget || "400")
        ).toUpperCase()} ONLY) is set for the SP bills for the whole unit. Under circumstances where the total utility bill exceeds the limit cap, the outstanding due will be divided proportionally between all tenants of the unit. Tenant A reserved the right to claim from Tenant B. ONLY APPLY FOR A ROOM WITH AN AIR CONDITIONER.`,
        "b) Tenant B must produce an original/photocopy of documents such as NRIC/Passport/Work Permit/Employment Pass/Student Pass to prove his/her identity and legitimate stay in Singapore.",
        "c) Security deposit will be refunded within 7 (SEVEN) days at the end of the lease after deducting any outstanding fees, with no interest.",
        "d) Tenant B will be asked to leave the apartment within 1 (ONE) to 7 (SEVEN) days at the discretion of Tenant A for breach of agreement, and/or any terms and conditions stated in this Agreement if the rental is not paid by the first day of each calendar month.",
        "e) The law applicable in any action arising out of this lease shall be the law of the Republic of Singapore, and the parties hereto submit themselves to the jurisdiction of the laws of Singapore.",
        `f) Cleaning fee: SGD$${
          this.contractData.cleaningFee || "20"
        } / 1pax (if all tenants agree to hire a cleaning service)`,
      ];

      section2Clauses.forEach((clause) => {
        addText(clause, { indent: true, spacing: 5 });
      });

      currentY += 20;

      // Signature section
      addText(
        "By signing below, both parties agree to abide by all the above terms and conditions",
        { bold: true, center: true, spacing: 30 }
      );

      // Add signature images or lines
      const signatureHeight = 20;

      // Check if we need a new page for signatures
      if (currentY + signatureHeight + 30 > pageHeight - margin - 20) {
        pdf.addPage();
        currentY = margin;
      }

      try {
        // Add Tenant A signature
        if (this.signatures.tenantA) {
          console.log(
            "📝 Adding Tenant A signature to PDF:",
            this.signatures.tenantA
          );
          await this.addImageToPDF(
            pdf,
            this.signatures.tenantA,
            30,
            currentY,
            60,
            signatureHeight
          );
        } else {
          // Draw signature line for Tenant A
          pdf.line(
            30,
            currentY + signatureHeight,
            90,
            currentY + signatureHeight
          );
        }

        // Add Tenant B signature
        if (this.signatures.tenantB) {
          console.log(
            "📝 Adding Tenant B signature to PDF:",
            this.signatures.tenantB
          );
          await this.addImageToPDF(
            pdf,
            this.signatures.tenantB,
            120,
            currentY,
            60,
            signatureHeight
          );
        } else {
          // Draw signature line for Tenant B
          pdf.line(
            120,
            currentY + signatureHeight,
            180,
            currentY + signatureHeight
          );
        }
      } catch (error) {
        console.warn(
          "⚠️ Error adding signatures to PDF, falling back to lines:",
          error
        );
        // Fallback to signature lines if image loading fails
        pdf.line(
          30,
          currentY + signatureHeight,
          90,
          currentY + signatureHeight
        );
        pdf.line(
          120,
          currentY + signatureHeight,
          180,
          currentY + signatureHeight
        );
      }

      currentY += signatureHeight + 10;
      addText("Tenant A", { fontSize: 12, bold: true });
      pdf.text("Tenant B", 120, currentY - lineHeight);

      currentY += 15;
      addText(tenantAInfo.name, { bold: true });
      pdf.text(tenantBInfo.name, 120, currentY - lineHeight);

      pdf.save(filename);
      console.log(`✅ Contract exported successfully as text-based PDF`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Error exporting PDF. Please try again: " + error.message);
    } finally {
      // Restore button state
      const exportBtn = document.querySelector(
        '[onclick="contractManager.exportToPDF()"]'
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
    const tenantAInfo = this.selectedTenantA
      ? {
          name: this.selectedTenantA.name,
          passport: this.selectedTenantA.passportNumber || this.selectedTenantA.passport || this.selectedTenantA.fin,
          email: this.selectedTenantA.email || "",
        }
      : {
          name: "[Tenant A Name]",
          passport: "[Tenant A Passport]",
          email: "[Email]",
        };

    const tenantBInfo = this.selectedTenantB
      ? {
          name: this.selectedTenantB.name,
          passport: this.selectedTenantB.passportNumber || this.selectedTenantB.passport || this.selectedTenantB.fin,
        }
      : { name: "[Tenant B Name]", passport: "[Tenant B Passport]" };

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
                      this.contractData.address || "[Property Address]"
                    }</p>
                    <p style="margin-bottom: 8px;"><strong>Room:</strong> ${
                      this.contractData.room || "[Room Type]"
                    }</p>
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
                        <p style="margin-bottom: 5px;"><strong>FIN/PASSPORT:</strong> ${
                          tenantAInfo.passport
                        }</p>
                        <p style="margin-bottom: 12px;"><strong>Email:</strong> ${
                          tenantAInfo.email
                        }</p>
                        <p style="font-style: italic; margin-bottom: 20px;">
                            (Hereinafter called "TenantA" which expresses together where the context so admits, shall include all persons having title under 'TenantA') of the one part.
                        </p>
                    </div>

                    <p style="margin-bottom: 12px;"><strong>AND</strong></p>
                    <div style="margin-left: 20px;">
                        <p style="margin-bottom: 5px;"><strong>Name:</strong> ${
                          tenantBInfo.name
                        }</p>
                        <p style="margin-bottom: 12px;"><strong>Passport:</strong> ${
                          tenantBInfo.passport
                        }</p>
                        <p style="font-style: italic; margin-bottom: 20px;">
                            (Hereinafter called "Tenant B", which expresses together with where the context so admits, shall include all persons having title under ' Tenant B') of the one part.
                        </p>
                    </div>
                </div>

                <p style="margin-bottom: 30px;"><strong>Payment method:</strong> ${
                  this.contractData.paymentMethod || "CASH"
                }</p>

                <!-- Agreement Terms -->
                <div style="margin-bottom: 30px;">
                    <p style="margin-bottom: 20px;"><strong>NOW IT IS HEREBY AGREED AS FOLLOWS:</strong></p>
                    
                    <!-- Contract Terms as Simple Text -->
                    <div style="margin-bottom: 25px; line-height: 1.8;">
                        <p style="margin-bottom: 12px;"><strong>Lease Period:</strong> ${
                          this.contractData.leasePeriod || "[Lease Period]"
                        }</p>
                        
                        <p style="margin-bottom: 12px;"><strong>Tenancy Period:</strong> ${
                          this.contractData.tenancyPeriod || "[Tenancy Period]"
                        }</p>
                        
                        <p style="margin-bottom: 12px;"><strong>Moving Time:</strong> Move in after 15:00, Move out before 11:00</p>
                        
                        <p style="margin-bottom: 8px;"><strong>Monthly Rental:</strong> $${
                          this.contractData.monthlyRental || "[Monthly Rental]"
                        }</p>
                        <div style="margin-left: 20px; margin-bottom: 12px;">
                            <small style="font-size: 10px; line-height: 1.5;">
                                *Room rental rate is strictly confidential<br>
                                *Renewal contract is subject to mutual agreement by Tenant A and Tenant B<br>
                                *Payable by the 1st Day of each calendar month to "Tenant A"
                            </small>
                        </div>
                        
                        <p style="margin-bottom: 8px;"><strong>Security Deposit:</strong> $${
                          this.contractData.securityDeposit ||
                          "[Security Deposit]"
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
                        <p style="margin-bottom: 15px;"><strong>a)</strong> To pay the equivalent of 1 (ONE) month's rent as a deposit and 1 (ONE) month's rent as an advance upon signing of this Agreement. The deposit is to be held by TenantA as security for the due performance and observance by TenantB of all covenants, conditions, and stipulations on the part of Tenant B herein contained, failing which TenantB shall forfeit to TenantA the said deposit or such part thereof as may be necessary to remedy such default. PROVIDED ALWAYS that Tenant B shall duly perform the said covenants, conditions, and stipulations as aforesaid, up to and including the date of expiration of the term hereby created, Tenant A shall repay the said deposit within 7 (SEVEN) days from the date of such expiration without any interest. This deposit shall not be utilised to offset any rent due and payable during the currency of this Agreement. Such deposit shall be refundable at the end of the term, less deduction for damages caused by the negligence of Tenant B and of any breach of this Agreement.</p>
                        
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
                        
                        <p style="margin-bottom: 15px;"><strong>n)</strong> For 6 6-month agreement, the deposit money will be deducted SGD$100 for Air-conditioner services. On a 1-year agreement, the deduction level would be SGD$200. ONLY APPLY FOR A ROOM WITH AN AIR-CONDITIONER.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>o)</strong> Cost of damage for common area facilities provided previously by Tenant A will be handled by both parties. For the first 200 (SGD) in any single bill, the bill would be divided among all subtenants of the unit. The exceeding amount would be handled by Tenant A. Only applied for 6 months lease and above.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>p)</strong> No smoking, vaping in the house (the first time violated will get a warning; the next time violated will lead to the contract's termination). Vaping is now illegal in Singapore, and being caught can lead to a jail sentence.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>q)</strong> No visitors without permission from Tenant B to Tenant A.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>r)</strong> No gathering (with/without alcoholic consumption) without permission from Tenant A.</p>
                        
                        <p style="margin-bottom: 15px;"><strong>s)</strong> Strictly keep silent after 10:00 pm (the tenant will receive a warning for the first two times; the third time violation will lead to the contract's termination).</p>
                        
                        <p style="margin-bottom: 15px;"><strong>t)</strong> Tenant B shall provide written notice to Tenant A at least thirty (30) days before the expiration of the lease term, indicating whether Tenant B intends to renew the tenancy or vacate the premises upon the lease's conclusion.</p>
                        
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
      parseInt(this.contractData.electricityBudget || "400")
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
                    <div style="margin-top: 40px; text-align: center;">
                        <p style="font-weight: bold; margin-bottom: 30px;">By signing below, both parties agree to abide by all the above terms and conditions</p>
                    </div>

                    <div style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="text-align: center; width: 45%;">
                            <p style="font-weight: bold; margin-bottom: 20px;">Tenant A</p>
                            <div style="height: 80px; margin-bottom: 20px; display: flex; align-items: flex-end; justify-content: center;">
                                ${
                                  this.signatures.tenantA
                                    ? `<img src="${this.signatures.tenantA}" alt="Tenant A Signature" style="max-height: 60px; max-width: 200px;">`
                                    : '<div style="border-bottom: 2px solid #000; width: 200px; height: 1px;"></div>'
                                }
                            </div>
                            <p style="font-weight: bold;">${
                              tenantAInfo.name
                            }</p>
                        </div>
                        <div style="text-align: center; width: 45%;">
                            <p style="font-weight: bold; margin-bottom: 20px;">Tenant B</p>
                            <div style="height: 80px; margin-bottom: 20px; display: flex; align-items: flex-end; justify-content: center;">
                                ${
                                  this.signatures.tenantB
                                    ? `<img src="${this.signatures.tenantB}" alt="Tenant B Signature" style="max-height: 60px; max-width: 200px;">`
                                    : '<div style="border-bottom: 2px solid #000; width: 200px; height: 1px;"></div>'
                                }
                            </div>
                            <p style="font-weight: bold;">${
                              tenantBInfo.name
                            }</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  // Public method to refresh the component
  refresh() {
    this.loadTenants();
  }
}

// Export for use in other modules
window.ContractManagementComponent = ContractManagementComponent;
