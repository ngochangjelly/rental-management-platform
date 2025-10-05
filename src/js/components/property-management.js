/**
 * Property Management Component
 * Handles property CRUD operations
 */
class PropertyManagementComponent {
  constructor() {
    this.properties = [];
    this.currentWifiImages = [];
    this.propertyImage = ''; // Store property image URL
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadProperties();
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

    // Search functionality
    const searchInput = document.getElementById("propertySearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filterProperties(e.target.value);
      });
    }
  }

  async loadProperties() {
    try {
      const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
      const result = await response.json();

      if (result.success) {
        this.properties = result.properties;
        this.renderPropertiesTable();

        // Update sidebar badges
        if (window.updateSidebarBadges) {
          window.updateSidebarBadges();
        }
      } else {
        console.error("Failed to load properties:", result.error);
        this.showEmptyState();
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      this.showEmptyState("Error loading properties. Please try again.");
    }
  }

  renderPropertiesTable() {
    const container = document.getElementById("propertiesContainer");

    if (!container) return;

    if (this.properties.length === 0) {
      this.showEmptyState();
      return;
    }

    // Clear container and add card layout
    container.innerHTML = '<div id="propertiesCardGrid" class="row"></div>';
    const gridContainer = document.getElementById("propertiesCardGrid");

    // Render property cards
    let cardsHtml = "";
    this.properties.forEach((property) => {
      const cardHtml = `
        <div class="col-md-6 col-lg-4 mb-4">
          <div class="card property-management-card h-100 overflow-hidden"
               style="transition: all 0.2s ease;">
            ${property.propertyImage ? `
            <div class="card-img-top position-relative" style="height: 200px; background-image: url('${property.propertyImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;">
              <div class="position-absolute top-0 start-0 p-2">
                <span class="badge bg-primary fs-6">${this.escapeHtml(property.propertyId)}</span>
              </div>
            </div>
            ` : `
            <div class="card-img-top position-relative bg-gradient" style="height: 200px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <div class="position-absolute top-0 start-0 p-2">
                <span class="badge bg-white text-primary fs-6">${this.escapeHtml(property.propertyId)}</span>
              </div>
              <div class="position-absolute top-50 start-50 translate-middle">
                <i class="bi bi-building text-white" style="font-size: 3rem; opacity: 0.7;"></i>
              </div>
            </div>
            `}
            <div class="card-header bg-white border-0 pb-0">
              <div class="d-flex align-items-center">
                <div class="me-3">
                  <div class="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white"
                       style="width: 40px; height: 40px; font-size: 14px; font-weight: bold;">
                    ${this.escapeHtml(property.propertyId.substring(0, 2).toUpperCase())}
                  </div>
                </div>
                <div class="flex-grow-1">
                  <h6 class="mb-0 fw-bold">${this.escapeHtml(property.propertyId)}</h6>
                  <small class="text-muted">Property ID</small>
                </div>
              </div>
            </div>
            <div class="card-body pt-2">
              <p class="mb-2 small"><i class="bi bi-geo-alt text-muted me-2"></i>${this.escapeHtml(property.address)}</p>
              <div class="row">
                <div class="col-6">
                  <p class="mb-1 small"><strong>Unit:</strong> ${this.escapeHtml(property.unit)}</p>
                  <p class="mb-1 small"><strong>Max Pax:</strong> ${property.maxPax}</p>
                </div>
                <div class="col-6">
                  <p class="mb-1 small"><strong>Rent:</strong></p>
                  <h6 class="text-success mb-0">$${(property.rent || 0).toLocaleString()}</h6>
                </div>
              </div>
            </div>
            <div class="card-footer bg-white border-0 pt-0">
              <div class="d-flex gap-2">
                <button class="btn btn-outline-primary btn-sm flex-fill" onclick="propertyManager.editProperty('${property.propertyId}')">
                  <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-outline-danger btn-sm flex-fill" onclick="propertyManager.deleteProperty('${property.propertyId}')">
                  <i class="bi bi-trash"></i> Delete
                </button>
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

      if (isEdit && property) {
        // Populate form with existing data
        document.getElementById("propertyId").value = property.propertyId || "";
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

        document.getElementById("rentPaymentDate").value =
          property.rentPaymentDate || 1;
        document.getElementById("rent").value = property.rent || 0;
        document.getElementById("agentName").value = property.agentName || "";
        document.getElementById("agentPhone").value = property.agentPhone || "";
        document.getElementById("landlordBankAccount").value =
          property.landlordBankAccount || "";
        document.getElementById("landlordBankName").value =
          property.landlordBankName || "";
        document.getElementById("landlordAccountName").value =
          property.landlordAccountName || "";
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

        // Handle WiFi images
        if (property.wifiImages && property.wifiImages.length > 0) {
          this.currentWifiImages = [...property.wifiImages];
          this.renderWifiImagesGallery();
        } else {
          this.currentWifiImages = [];
        }

        // Handle property image
        if (property.propertyImage) {
          this.propertyImage = property.propertyImage;
          this.updatePropertyImagePreview();
        } else {
          this.propertyImage = '';
          this.updatePropertyImagePreview();
        }

        // Make propertyId readonly in edit mode
        document.getElementById("propertyId").readOnly = true;
        document.getElementById("propertyId").classList.add("bg-light");
      } else {
        // Set default values for add mode
        const moveInDateInput = document.getElementById("moveInDate");
        if (moveInDateInput) {
          moveInDateInput.value = new Date().toISOString().split("T")[0];
        }

        document.getElementById("maxPax").value = "1";
        document.getElementById("rentPaymentDate").value = "1";
        document.getElementById("rent").value = "0";

        // Clear WiFi images for add mode
        this.currentWifiImages = [];
        this.renderWifiImagesGallery();

        // Clear property image for add mode
        this.propertyImage = '';
        this.updatePropertyImagePreview();

        // Make propertyId editable in add mode
        document.getElementById("propertyId").readOnly = false;
        document.getElementById("propertyId").classList.remove("bg-light");
      }
    }

    // Show modal
    const modalEl = document.getElementById("propertyModal");
    const modal = new bootstrap.Modal(modalEl);

    // Add event listener for when modal is fully hidden
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

      const propertyData = {
        propertyId: formData.get("propertyId").trim().toUpperCase(),
        address: formData.get("address").trim(),
        unit: formData.get("unit").trim(),
        maxPax: parseInt(formData.get("maxPax")) || 1,
        moveInDate:
          formData.get("moveInDate") || new Date().toISOString().split("T")[0],
        rentPaymentDate: parseInt(formData.get("rentPaymentDate")) || 1,
        rent: parseFloat(formData.get("rent")) || 0,
        agentName: formData.get("agentName")?.trim() || "",
        agentPhone: formData.get("agentPhone")?.trim() || "",
        landlordBankAccount: formData.get("landlordBankAccount")?.trim() || "",
        landlordBankName: formData.get("landlordBankName")?.trim() || "",
        landlordAccountName: formData.get("landlordAccountName")?.trim() || "",
        telegramIntegrationEnabled: formData.get("telegramIntegrationEnabled") === "true",
        telegramBotToken: formData.get("telegramBotToken")?.trim() || "",
        telegramChannelId: formData.get("telegramChannelId")?.trim() || "",
        wifiAccountNumber: formData.get("wifiAccountNumber")?.trim() || "",
        wifiAccountHolderName: formData.get("wifiAccountHolderName")?.trim() || "",
        wifiImages: this.currentWifiImages || [],
        propertyImage: this.propertyImage || "",
      };

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
        `An error occurred while ${
          isEdit ? "updating" : "adding"
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

  async deleteProperty(propertyId) {
    if (!confirm(`Are you sure you want to delete property ${propertyId}?`)) {
      return;
    }

    try {
      const response = await API.delete(
        API_CONFIG.ENDPOINTS.PROPERTY_BY_ID(propertyId)
      );

      const result = await response.json();

      if (result.success) {
        await this.loadProperties(); // Reload the list
      } else {
        alert("Failed to delete property: " + result.error);
      }
    } catch (error) {
      console.error("Error deleting property:", error);
      alert("Error deleting property. Please try again.");
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

    if (!url) {
      alert('Please enter a valid image URL');
      return;
    }

    // Set the property image
    this.propertyImage = url;
    this.updatePropertyImagePreview();
    urlInput.value = ''; // Clear input after adding
  }

  updatePropertyImagePreview() {
    const preview = document.getElementById('propertyImagePreview');
    if (!preview) return;

    if (this.propertyImage) {
      preview.innerHTML = `
        <div class="position-relative">
          <img src="${this.propertyImage}" class="img-thumbnail w-100" style="height: 200px; object-fit: cover;"
               alt="Property Image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDUiIGZpbGw9IiNmOGY5ZmEiIHN0cm9rZT0iI2RlZTJlNiIgc3Ryb2tlLXdpZHRoPSIyIi8+PHRleHQgeD0iNTAiIHk9IjU1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNmM3NTdkIiBmb250LXNpemU9IjEyIj5JbWFnZTwvdGV4dD48L3N2Zz4='">
          <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0 rounded-circle p-1"
                  onclick="propertyManager.removePropertyImage()" style="width: 24px; height: 24px; font-size: 0.7rem;">
            <i class="bi bi-x"></i>
          </button>
        </div>
      `;
    } else {
      preview.innerHTML = '<p class="text-muted">No image selected</p>';
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
}

// Export for use in other modules
window.PropertyManagementComponent = PropertyManagementComponent;
