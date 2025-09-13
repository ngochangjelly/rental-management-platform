/**
 * Property Management Component
 * Handles property CRUD operations
 */
class PropertyManagementComponent {
  constructor() {
    this.properties = [];
    this.currentWifiImages = [];
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
    const tbody = document.getElementById("propertiesTableBody");
    const mobileList = document.getElementById("mobilePropertyList");
    
    if (!tbody) return;

    if (this.properties.length === 0) {
      this.showEmptyState();
      this.showMobileEmptyState();
      return;
    }

    // Render desktop table
    let tableHtml = "";
    this.properties.forEach((property) => {
      tableHtml += `
                <tr>
                    <td>${this.escapeHtml(property.propertyId)}</td>
                    <td>${this.escapeHtml(property.address)}</td>
                    <td>${this.escapeHtml(property.unit)}</td>
                    <td>${property.maxPax}</td>
                    <td>$${(property.rent || 0).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="propertyManager.editProperty('${
                          property.propertyId
                        }')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="propertyManager.deleteProperty('${
                          property.propertyId
                        }')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
    });
    tbody.innerHTML = tableHtml;

    // Render mobile cards
    if (mobileList) {
      let mobileHtml = "";
      this.properties.forEach((property) => {
        mobileHtml += `
                  <div class="mobile-property-card">
                      <div class="mobile-property-header">
                          <div class="mobile-property-info">
                              <div class="mobile-property-id">${this.escapeHtml(property.propertyId)}</div>
                              <div class="mobile-property-address">${this.escapeHtml(property.address)}</div>
                          </div>
                      </div>
                      <div class="mobile-property-details">
                          <div><strong>Unit:</strong> ${this.escapeHtml(property.unit)}</div>
                          <div><strong>Rent:</strong> $${(property.rent || 0).toLocaleString()}</div>
                      </div>
                      <div class="mobile-property-actions">
                          <button class="btn btn-outline-primary btn-sm" onclick="propertyManager.editProperty('${property.propertyId}')">
                              <i class="bi bi-pencil"></i> Edit
                          </button>
                          <button class="btn btn-outline-danger btn-sm" onclick="propertyManager.deleteProperty('${property.propertyId}')">
                              <i class="bi bi-trash"></i> Delete
                          </button>
                      </div>
                  </div>
              `;
      });
      mobileList.innerHTML = mobileHtml;
    }
  }

  showEmptyState(message = "No properties found") {
    const tbody = document.getElementById("propertiesTableBody");
    if (!tbody) return;

    tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="bi bi-building fs-1"></i>
                    <p class="mt-2">${message}</p>
                </td>
            </tr>
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

    const tbody = document.getElementById("propertiesTableBody");
    const mobileList = document.getElementById("mobilePropertyList");
    if (!tbody) return;

    if (filteredProperties.length === 0) {
      this.showEmptyState(`No properties match "${searchTerm}"`);
      this.showMobileEmptyState(`No properties match "${searchTerm}"`);
      return;
    }

    // Render filtered desktop table
    let tableHtml = "";
    filteredProperties.forEach((property) => {
      tableHtml += `
                <tr>
                    <td>${this.escapeHtml(property.propertyId)}</td>
                    <td>${this.escapeHtml(property.address)}</td>
                    <td>${this.escapeHtml(property.unit)}</td>
                    <td>${property.maxPax}</td>
                    <td>$${(property.rent || 0).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="propertyManager.editProperty('${
                          property.propertyId
                        }')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="propertyManager.deleteProperty('${
                          property.propertyId
                        }')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
    });
    tbody.innerHTML = tableHtml;

    // Render filtered mobile cards
    if (mobileList) {
      let mobileHtml = "";
      filteredProperties.forEach((property) => {
        mobileHtml += `
                  <div class="mobile-property-card">
                      <div class="mobile-property-header">
                          <div class="mobile-property-info">
                              <div class="mobile-property-id">${this.escapeHtml(property.propertyId)}</div>
                              <div class="mobile-property-address">${this.escapeHtml(property.address)}</div>
                          </div>
                      </div>
                      <div class="mobile-property-details">
                          <div><strong>Unit:</strong> ${this.escapeHtml(property.unit)}</div>
                          <div><strong>Rent:</strong> $${(property.rent || 0).toLocaleString()}</div>
                      </div>
                      <div class="mobile-property-actions">
                          <button class="btn btn-outline-primary btn-sm" onclick="propertyManager.editProperty('${property.propertyId}')">
                              <i class="bi bi-pencil"></i> Edit
                          </button>
                          <button class="btn btn-outline-danger btn-sm" onclick="propertyManager.deleteProperty('${property.propertyId}')">
                              <i class="bi bi-trash"></i> Delete
                          </button>
                      </div>
                  </div>
              `;
      });
      mobileList.innerHTML = mobileHtml;
    }
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
        const result = await API.uploadImage(file);
        
        if (result.success) {
          console.log('🔗 WiFi image uploaded successfully:', result.url);
          
          // Ensure URL is properly formatted
          let imageUrl = result.url;
          if (!imageUrl.startsWith('http')) {
            imageUrl = `https://res.cloudinary.com/your-cloud-name/image/upload/${imageUrl}`;
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
