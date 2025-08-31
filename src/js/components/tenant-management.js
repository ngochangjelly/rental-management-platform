/**
 * Tenant Management Component (v2 - fixed update endpoint)
 * Handles tenant CRUD operations
 */
class TenantManagementComponent {
    constructor() {
        this.tenants = [];
        this.selectedProperties = [];
        this.propertiesCache = null; // Cache for properties
        this.propertiesCacheTime = null;
        this.cacheTimeout = 30000; // Cache for 30 seconds
        this.passportPics = []; // Array of passport image URLs
        this.visaPics = []; // Array of visa image URLs
        this.avatar = ''; // Single avatar image URL
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Don't load tenants immediately - wait until section is visible
        // this.loadTenants();
    }

    setupEventListeners() {
        // Add tenant button
        const addTenantBtn = document.getElementById('addTenantBtn');
        if (addTenantBtn) {
            addTenantBtn.addEventListener('click', () => {
                this.showAddTenantModal();
            });
        }

        // Tenant form submission (add/edit)
        const tenantForm = document.getElementById('tenantForm');
        if (tenantForm) {
            tenantForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleTenantSubmit(e);
            });
        }

        // Search functionality
        const searchInput = document.getElementById('tenantSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterTenants(e.target.value);
            });
        }
    }

    async loadTenants() {
        try {
            const response = await API.get(API_CONFIG.ENDPOINTS.TENANTS);
            const result = await response.json();
            
            // Handle different response formats
            if (result.success && result.tenants) {
                // Standard API response format
                this.tenants = result.tenants;
            } else if (result.tenants && Array.isArray(result.tenants)) {
                // Direct tenant array format
                this.tenants = result.tenants;
            } else if (Array.isArray(result)) {
                // Direct array response
                this.tenants = result;
            } else {
                console.error('Failed to load tenants:', result.error || 'Unknown format');
                this.showEmptyState();
                return;
            }
            
            console.log('✅ Loaded', this.tenants.length, 'tenants');
            this.renderTenantsTable();
            
            // Update sidebar badges
            if (window.updateSidebarBadges) {
                window.updateSidebarBadges();
            }
        } catch (error) {
            console.error('Error loading tenants:', error);
            this.showEmptyState('Error loading tenants. Please try again.');
        }
    }

    renderTenantsTable() {
        const tbody = document.getElementById('tenantsTableBody');
        if (!tbody) {
            console.error('tenantsTableBody element not found!');
            return;
        }
        
        if (this.tenants.length === 0) {
            this.showEmptyState();
            return;
        }

        let html = '';
        this.tenants.forEach(tenant => {
            const moveinDate = tenant.moveinDate ? new Date(tenant.moveinDate).toLocaleDateString() : 'N/A';
            const moveoutDate = tenant.moveoutDate ? new Date(tenant.moveoutDate).toLocaleDateString() : 'Current';
            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="me-3">
                                ${tenant.avatar ? 
                                    `<img src="${this.normalizeImageUrl(tenant.avatar)}" alt="${this.escapeHtml(tenant.name)}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">` :
                                    `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 14px;">${this.escapeHtml(tenant.name.charAt(0).toUpperCase())}</div>`
                                }
                            </div>
                            <div>
                                <div>${this.escapeHtml(tenant.name)}</div>
                                <small class="text-muted">${this.escapeHtml(tenant.phoneNumber || 'No phone')}</small>
                            </div>
                        </div>
                    </td>
                    <td>${this.escapeHtml(tenant.fin)}</td>
                    <td>${this.escapeHtml(tenant.passportNumber)}</td>
                    <td>
                        <span class="badge bg-${tenant.isRegistered ? 'success' : 'secondary'}">
                            ${tenant.isRegistered ? 'Registered' : 'Unregistered'}
                        </span>
                        ${tenant.isMainTenant ? '<span class="badge bg-primary ms-1">Main</span>' : ''}
                    </td>
                    <td>
                        <div><strong>Room:</strong> ${this.escapeHtml(tenant.room || 'N/A')}</div>
                        <small class="text-muted">In: ${moveinDate} | Out: ${moveoutDate}</small>
                    </td>
                    <td>
                        <span class="badge bg-info">
                            ${tenant.properties ? tenant.properties.length : 0} properties
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="tenantManager.editTenant('${tenant.fin}')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="tenantManager.deleteTenant('${tenant.fin}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }

    showEmptyState(message = 'No tenants found') {
        const tbody = document.getElementById('tenantsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="bi bi-people fs-1"></i>
                    <p class="mt-2">${message}</p>
                </td>
            </tr>
        `;
    }

    filterTenants(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderTenantsTable();
            return;
        }

        const filteredTenants = this.tenants.filter(tenant => 
            tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tenant.fin.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tenant.passportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (tenant.phoneNumber && tenant.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (tenant.room && tenant.room.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        const tbody = document.getElementById('tenantsTableBody');
        if (!tbody) return;

        if (filteredTenants.length === 0) {
            this.showEmptyState(`No tenants match "${searchTerm}"`);
            return;
        }

        let html = '';
        filteredTenants.forEach(tenant => {
            const moveinDate = tenant.moveinDate ? new Date(tenant.moveinDate).toLocaleDateString() : 'N/A';
            const moveoutDate = tenant.moveoutDate ? new Date(tenant.moveoutDate).toLocaleDateString() : 'Current';
            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="me-3">
                                ${tenant.avatar ? 
                                    `<img src="${this.normalizeImageUrl(tenant.avatar)}" alt="${this.escapeHtml(tenant.name)}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">` :
                                    `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 14px;">${this.escapeHtml(tenant.name.charAt(0).toUpperCase())}</div>`
                                }
                            </div>
                            <div>
                                <div>${this.escapeHtml(tenant.name)}</div>
                                <small class="text-muted">${this.escapeHtml(tenant.phoneNumber || 'No phone')}</small>
                            </div>
                        </div>
                    </td>
                    <td>${this.escapeHtml(tenant.fin)}</td>
                    <td>${this.escapeHtml(tenant.passportNumber)}</td>
                    <td>
                        <span class="badge bg-${tenant.isRegistered ? 'success' : 'secondary'}">
                            ${tenant.isRegistered ? 'Registered' : 'Unregistered'}
                        </span>
                        ${tenant.isMainTenant ? '<span class="badge bg-primary ms-1">Main</span>' : ''}
                    </td>
                    <td>
                        <div><strong>Room:</strong> ${this.escapeHtml(tenant.room || 'N/A')}</div>
                        <small class="text-muted">In: ${moveinDate} | Out: ${moveoutDate}</small>
                    </td>
                    <td>
                        <span class="badge bg-info">
                            ${tenant.properties ? tenant.properties.length : 0} properties
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="tenantManager.editTenant('${tenant.fin}')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="tenantManager.deleteTenant('${tenant.fin}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }

    showAddTenantModal() {
        this.showTenantModal();
    }

    async showTenantModal(tenant = null) {
        // Update modal title and button text
        const isEdit = !!tenant;
        document.getElementById('tenantModalTitle').textContent = isEdit ? 'Edit Tenant' : 'Add New Tenant';
        const submitBtn = document.getElementById('tenantSubmitBtn');
        submitBtn.innerHTML = isEdit 
            ? '<i class="bi bi-person-check me-1"></i><span id="tenantSubmitText">Update Tenant</span>'
            : '<i class="bi bi-person-plus me-1"></i><span id="tenantSubmitText">Add Tenant</span>';

        // Reset and populate form
        const form = document.getElementById('tenantForm');
        if (form) {
            form.reset();
            
            // Store the tenant being edited (if any)
            form.setAttribute('data-tenant-fin', tenant?.fin || '');
            form.setAttribute('data-mode', isEdit ? 'edit' : 'add');
            
            if (isEdit && tenant) {
                // Populate form with existing data
                document.getElementById('tenantName').value = tenant.name || '';
                document.getElementById('tenantFin').value = tenant.fin || '';
                document.getElementById('tenantPassport').value = tenant.passportNumber || '';
                document.getElementById('tenantPhoneNumber').value = tenant.phoneNumber || '';
                document.getElementById('tenantRoom').value = tenant.room || '';
                document.getElementById('tenantMoveinDate').value = tenant.moveinDate ? tenant.moveinDate.split('T')[0] : '';
                document.getElementById('tenantMoveoutDate').value = tenant.moveoutDate ? tenant.moveoutDate.split('T')[0] : '';
                document.getElementById('tenantIsRegistered').checked = tenant.isRegistered || false;
                document.getElementById('tenantIsMainTenant').checked = tenant.isMainTenant || false;
                
                // Handle multiple images (with backward compatibility)
                this.passportPics = tenant.passportPics || (tenant.passportPic ? [tenant.passportPic] : []);
                this.visaPics = tenant.visaPics || (tenant.visaPic ? [tenant.visaPic] : []);
                console.log('📋 Set passportPics:', this.passportPics);
                console.log('📋 Set visaPics:', this.visaPics);
                // Don't update gallery here - wait until modal is shown
                
                // Handle avatar
                this.avatar = tenant.avatar || '';
                this.updateAvatarPreview();
                
                // Set up properties - extract property IDs only
                this.selectedProperties = (tenant.properties || []).map(prop => 
                    typeof prop === 'string' ? prop : prop.propertyId || prop._id
                );
                
                // Make FIN readonly in edit mode
                document.getElementById('tenantFin').readOnly = true;
                document.getElementById('tenantFin').classList.add('bg-light');
            } else {
                // Reset for add mode
                this.selectedProperties = [];
                this.passportPics = [];
                this.visaPics = [];
                this.avatar = '';
                this.updateImageGallery('passport');
                this.updateImageGallery('visa');
                this.updateAvatarPreview();
                
                // Make FIN editable in add mode
                document.getElementById('tenantFin').readOnly = false;
                document.getElementById('tenantFin').classList.remove('bg-light');
            }
        }
        
        // Load available properties and populate select
        await this.loadPropertiesForSelect();
        this.updateSelectedPropertiesList();
        
        // Add event listeners for image URL inputs
        this.setupImageUrlListeners();
        
        // Show modal
        const modalEl = document.getElementById('tenantModal');
        const modal = new bootstrap.Modal(modalEl);
        
        // Add event listener for when modal is fully hidden
        modalEl.addEventListener('hidden.bs.modal', () => {
            this.cleanupModal();
        }, { once: true });
        
        // Add event listener for when modal is fully shown
        modalEl.addEventListener('shown.bs.modal', () => {
            this.updateImageGallery('passport');
            this.updateImageGallery('visa');
            this.updateAvatarPreview();
        }, { once: true });
        
        modal.show();
    }

    cleanupModal() {
        // Remove any remaining backdrop
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        
        // Remove modal classes from body
        document.body.classList.remove('modal-open');
        document.body.style.paddingRight = '';
        document.body.style.overflow = '';
        
        // Reset selected properties
        this.selectedProperties = [];
    }

    async loadPropertiesForSelect() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.propertiesCache && this.propertiesCacheTime && (now - this.propertiesCacheTime) < this.cacheTimeout) {
                console.log('Using cached properties data');
                this.populatePropertyCheckboxes(this.propertiesCache);
                return;
            }
            
            const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
            const result = await response.json();
            
            // Cache the result
            if (result.success) {
                this.propertiesCache = result;
                this.propertiesCacheTime = now;
            }
            
            this.populatePropertyCheckboxes(result);
        } catch (error) {
            console.error('Error loading properties:', error);
            const checkboxList = document.getElementById('propertyCheckboxList');
            if (checkboxList) {
                checkboxList.innerHTML = '<li class="px-3 py-2 text-danger">Error loading properties</li>';
            }
        }
    }

    populatePropertyCheckboxes(result) {
        const checkboxList = document.getElementById('propertyCheckboxList');
        if (!checkboxList || !result.success) return;
        
        // Clear existing items
        checkboxList.innerHTML = '';
        
        if (result.properties.length === 0) {
            checkboxList.innerHTML = '<li class="px-3 py-2 text-muted">No properties available</li>';
            return;
        }
        
        result.properties.forEach(property => {
            const listItem = document.createElement('li');
            listItem.className = 'px-3 py-2';
            
            const checkboxId = `property-${property.propertyId}`;
            const isChecked = this.selectedProperties.includes(property.propertyId);
            
            listItem.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="${checkboxId}" 
                           value="${property.propertyId}" ${isChecked ? 'checked' : ''}>
                    <label class="form-check-label" for="${checkboxId}" style="cursor: pointer;">
                        <strong>${property.propertyId}</strong> - ${property.address}, ${property.unit}
                    </label>
                </div>
            `;
            
            // Add click handler to the checkbox
            const checkbox = listItem.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                this.handleCheckboxChange(e.target.value, e.target.checked);
            });
            
            // Prevent dropdown from closing when clicking on list items
            listItem.addEventListener('click', (e) => {
                e.stopPropagation();
                // If clicking on the item (not checkbox), toggle the checkbox
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                    this.handleCheckboxChange(checkbox.value, checkbox.checked);
                }
            });
            
            checkboxList.appendChild(listItem);
        });
        
        // Update dropdown text
        this.updateDropdownText();
    }

    handleCheckboxChange(propertyId, isChecked) {
        if (isChecked) {
            // Add property if not already selected
            if (!this.selectedProperties.includes(propertyId)) {
                this.selectedProperties.push(propertyId);
            }
        } else {
            // Remove property from selection
            this.selectedProperties = this.selectedProperties.filter(id => id !== propertyId);
        }
        
        this.updateSelectedPropertiesList();
        this.updateDropdownText();
    }

    updateDropdownText() {
        const dropdownText = document.getElementById('propertyDropdownText');
        if (!dropdownText) return;
        
        const count = this.selectedProperties.length;
        if (count === 0) {
            dropdownText.textContent = 'Select properties...';
        } else if (count === 1) {
            dropdownText.textContent = '1 property selected';
        } else {
            dropdownText.textContent = `${count} properties selected`;
        }
    }

    // Keep old function for backward compatibility but redirect to new logic
    addPropertyToTenant() {
        // This function is no longer used with multiselect, but keeping for safety
        console.log('addPropertyToTenant called - now handled by handlePropertySelectionChange');
    }

    removePropertyFromTenant(propertyId) {
        this.selectedProperties = this.selectedProperties.filter(id => id !== propertyId);
        this.updateSelectedPropertiesList();
        this.updateDropdownText();
        
        // Update checkbox to reflect removal
        const checkbox = document.getElementById(`property-${propertyId}`);
        if (checkbox) {
            checkbox.checked = false;
        }
    }

    updateSelectedPropertiesList() {
        const listContainer = document.getElementById('selectedPropertiesList');
        const noPropertiesMessage = document.getElementById('noPropertiesMessage');
        const hiddenInput = document.getElementById('tenantProperties');
        
        if (this.selectedProperties.length === 0) {
            listContainer.innerHTML = '<div class="text-muted" id="noPropertiesMessage">No properties assigned</div>';
            hiddenInput.value = '';
        } else {
            let html = '';
            this.selectedProperties.forEach(propertyId => {
                html += `
                    <div class="badge bg-secondary me-2 mb-2 p-2">
                        <i class="bi bi-building me-1"></i>${propertyId}
                        <button type="button" class="btn-close btn-close-white ms-2" aria-label="Remove" 
                                onclick="tenantManager.removePropertyFromTenant('${propertyId}')" style="font-size: 0.7em;"></button>
                    </div>
                `;
            });
            listContainer.innerHTML = html;
            hiddenInput.value = this.selectedProperties.join(',');
        }
        
        // Update dropdown text when list changes
        this.updateDropdownText();
    }

    async handleTenantSubmit(event) {
        try {
            const form = event.target;
            const formData = new FormData(form);
            const isEdit = form.getAttribute('data-mode') === 'edit';
            const originalFin = form.getAttribute('data-tenant-fin');

            const tenantData = {
                name: formData.get('name').trim(),
                fin: formData.get('fin').trim().toUpperCase(),
                passportNumber: formData.get('passportNumber').trim().toUpperCase(),
                phoneNumber: formData.get('phoneNumber').trim(),
                room: formData.get('room'),
                moveinDate: formData.get('moveinDate'),
                moveoutDate: formData.get('moveoutDate') || null,
                isRegistered: formData.get('isRegistered') === 'on',
                isMainTenant: formData.get('isMainTenant') === 'on',
                properties: this.selectedProperties,
                passportPics: this.passportPics,
                visaPics: this.visaPics,
                avatar: this.avatar
            };

            // Debug: log the properties being sent
            console.log('🔄 Tenant update data:', { 
                ...tenantData, 
                propertiesType: typeof this.selectedProperties[0],
                propertiesContent: this.selectedProperties 
            });

            // Validate required fields
            if (!tenantData.name || !tenantData.fin || !tenantData.passportNumber) {
                alert('Please fill in all required fields (Name, FIN, Passport Number)');
                return;
            }

            // Validate FIN length
            if (tenantData.fin.length > 20) {
                alert('FIN cannot exceed 20 characters');
                return;
            }

            // Validate passport length
            if (tenantData.passportNumber.length < 6 || tenantData.passportNumber.length > 15) {
                alert('Passport number must be between 6 and 15 characters');
                return;
            }

            // Validate phone number length (only if provided)
            if (tenantData.phoneNumber && (tenantData.phoneNumber.length < 8 || tenantData.phoneNumber.length > 20)) {
                alert('Phone number must be between 8 and 20 characters');
                return;
            }

            // Validate move-out date is after move-in date (only if both dates are provided)
            if (tenantData.moveoutDate && tenantData.moveinDate && new Date(tenantData.moveoutDate) <= new Date(tenantData.moveinDate)) {
                alert('Move-out date must be after move-in date');
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
                await this.updateTenant(originalFin, tenantData);
            } else {
                await this.addTenant(tenantData);
            }

            // Close modal on success
            const modal = bootstrap.Modal.getInstance(document.getElementById('tenantModal'));
            if (modal) {
                modal.hide();
            }
            
            // Ensure backdrop is removed
            setTimeout(() => {
                const backdrop = document.querySelector('.modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.classList.remove('modal-open');
                document.body.style.paddingRight = '';
            }, 300);

            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;

        } catch (error) {
            console.error('Error in handleTenantSubmit:', error);
            const isEdit = event.target.getAttribute('data-mode') === 'edit';
            alert(`An error occurred while ${isEdit ? 'updating' : 'adding'} the tenant. Please try again.`);
            
            // Reset button state
            const submitBtn = event.target.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                const isEdit = event.target.getAttribute('data-mode') === 'edit';
                submitBtn.innerHTML = isEdit 
                    ? '<i class="bi bi-person-check me-1"></i>Update Tenant'
                    : '<i class="bi bi-person-plus me-1"></i>Add Tenant';
            }
        }
    }

    getTenantDataFromUser(existingTenant = null) {
        const name = prompt('Full Name:', existingTenant?.name || '');
        if (!name) return null;

        const fin = prompt('FIN (Singaporean ID):', existingTenant?.fin || '');
        if (!fin) return null;

        const passportNumber = prompt('Passport Number:', existingTenant?.passportNumber || '');
        if (!passportNumber) return null;

        const isRegistered = confirm('Is this tenant active/registered?');
        const isMainTenant = confirm('Is this the main tenant?');

        return {
            name,
            fin: fin.toUpperCase(),
            passportNumber: passportNumber.toUpperCase(),
            isRegistered,
            isMainTenant,
            properties: existingTenant?.properties || []
        };
    }

    async addTenant(tenantData) {
        try {
            const response = await API.post(API_CONFIG.ENDPOINTS.TENANTS, tenantData);

            const result = await response.json();
            
            if (result.success) {
                await this.loadTenants(); // Reload the list
            } else {
                alert('Failed to add tenant: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding tenant:', error);
            alert('Error adding tenant. Please try again.');
        }
    }

    async editTenant(fin) {
        // Find the tenant to edit
        const tenant = this.tenants.find(t => t.fin === fin);
        if (!tenant) {
            alert('Tenant not found');
            return;
        }

        // Show the modal with tenant data
        this.showTenantModal(tenant);
    }

    async updateTenant(originalFin, tenantData) {
        try {
            // Find the tenant to get the ID
            const tenant = this.tenants.find(t => t.fin === originalFin);
            if (!tenant || !tenant._id) {
                throw new Error('Tenant ID not found');
            }
            
            const response = await API.put(API_CONFIG.ENDPOINTS.TENANT_BY_ID(tenant._id), tenantData);
            const result = await response.json();
            
            if (result.success) {
                await this.loadTenants(); // Reload the list
            } else {
                alert('Failed to update tenant: ' + result.error);
            }
        } catch (error) {
            console.error('Error updating tenant:', error);
            alert('Error updating tenant: ' + error.message);
            throw error; // Re-throw to handle in form submission
        }
    }

    async deleteTenant(fin) {
        if (!confirm(`Are you sure you want to delete tenant ${fin}?`)) {
            return;
        }

        try {
            // Find the tenant to get the ID
            const tenant = this.tenants.find(t => t.fin === fin);
            if (!tenant || !tenant._id) {
                throw new Error('Tenant ID not found');
            }
            
            const response = await API.delete(API_CONFIG.ENDPOINTS.TENANT_BY_ID(tenant._id));

            const result = await response.json();
            
            if (result.success) {
                await this.loadTenants(); // Reload the list
            } else {
                alert('Failed to delete tenant: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting tenant:', error);
            alert('Error deleting tenant. Please try again.');
        }
    }

    // Method to assign tenant to property
    async assignToProperty(fin, propertyId) {
        try {
            const response = await API.post(API_CONFIG.ENDPOINTS.TENANT_ADD_PROPERTY(fin), { propertyId });

            const result = await response.json();
            
            if (result.success) {
                await this.loadTenants(); // Reload the list
            } else {
                alert('Failed to assign tenant to property: ' + result.error);
            }
        } catch (error) {
            console.error('Error assigning tenant to property:', error);
            alert('Error assigning tenant to property. Please try again.');
        }
    }

    // Utility method to escape HTML to prevent XSS
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    // Normalize image URL to ensure it uses the proxy endpoint
    normalizeImageUrl(url) {
        if (!url) return url;
        
        // If it's already a full URL (http/https), return as-is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // If it's already a proxy URL, convert to full URL if needed
        if (url.startsWith('/api/upload/image-proxy/')) {
            // In production, use the full backend URL
            if (API_CONFIG.BASE_URL) {
                return `${API_CONFIG.BASE_URL}${url}`;
            }
            return url; // localhost case
        }
        
        // Build the proxy URL
        let proxyPath;
        
        // If it looks like just a Cloudinary filename (e.g., "wdhtnp08ugp4nhshmkpf.jpg")
        // or a path without version (e.g., "tenant-documents/wdhtnp08ugp4nhshmkpf.jpg")
        if (url.match(/^[a-zA-Z0-9\-_\/]+\.(jpg|jpeg|png)$/i)) {
            // Check if it already includes the folder path
            if (url.includes('/')) {
                proxyPath = `/api/upload/image-proxy/${url}`;
            } else {
                // Assume it's a tenant document image
                proxyPath = `/api/upload/image-proxy/tenant-documents/${url}`;
            }
        } else if (url.startsWith('/')) {
            // If it starts with / but not our proxy path, assume it's a relative proxy URL
            proxyPath = url;
        } else {
            // Default: assume it needs the proxy prefix
            proxyPath = `/api/upload/image-proxy/${url}`;
        }
        
        // In production, use the full backend URL
        if (API_CONFIG.BASE_URL) {
            return `${API_CONFIG.BASE_URL}${proxyPath}`;
        }
        return proxyPath; // localhost case
    }

    // Public method to refresh the tenants list
    refresh() {
        this.loadTenants();
    }

    // Multiple image upload methods
    openImageUpload(type) {
        this.currentUploadType = type;
        const fileInput = document.getElementById('imageUploadInput');
        fileInput.click();
        
        // Add event listener for file selection (supports multiple files)
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.uploadMultipleImages(Array.from(e.target.files), type);
            }
        };
    }

    async uploadMultipleImages(files, type) {
        const uploadButton = document.querySelector(`button[onclick="tenantManager.openImageUpload('${type}')"]`);
        const originalText = uploadButton.innerHTML;
        
        try {
            // Show loading state
            uploadButton.disabled = true;
            uploadButton.innerHTML = `<i class="bi bi-hourglass-split"></i> Uploading ${files.length} image(s)...`;
            
            const uploadPromises = files.map(file => this.uploadSingleImage(file));
            const results = await Promise.all(uploadPromises);
            
            // Add successful uploads to the image array
            const imageArray = type === 'passport' ? this.passportPics : this.visaPics;
            results.forEach(result => {
                if (result.success) {
                    console.log('🔗 Received image URL from upload:', result.url);
                    console.log('🔧 Original URL from backend:', result.originalUrl);
                    console.log('🔧 Public ID from backend:', result.publicId);
                    
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
                    
                    console.log('🔗 Final image URL to store:', imageUrl);
                    imageArray.push(imageUrl);
                }
            });
            
            // Update gallery display
            this.updateImageGallery(type);
            
            const successCount = results.filter(r => r.success).length;
            console.log(`✅ ${successCount}/${files.length} ${type} images uploaded successfully`);
            
            if (successCount < files.length) {
                alert(`${successCount}/${files.length} images uploaded successfully. Some uploads failed.`);
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
            
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    addImageFromUrl(type) {
        const urlInput = document.getElementById(`tenant${type.charAt(0).toUpperCase() + type.slice(1)}PicUrl`);
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Please enter a valid image URL');
            return;
        }
        
        // Add to appropriate array
        const imageArray = type === 'passport' ? this.passportPics : this.visaPics;
        if (!imageArray.includes(url)) {
            imageArray.push(url);
            this.updateImageGallery(type);
            urlInput.value = ''; // Clear input after adding
        } else {
            alert('This image URL is already added');
        }
    }

    removeImage(type, index) {
        const imageArray = type === 'passport' ? this.passportPics : this.visaPics;
        imageArray.splice(index, 1);
        this.updateImageGallery(type);
    }

    handleImageError(imgElement, proxyUrl, type, index) {
        console.error('❌ Image failed to load via proxy:', proxyUrl);
        console.error('Image element:', imgElement);
        console.error('Current src attribute:', imgElement.src);
        console.error('Has fallback been attempted?', imgElement.hasAttribute('data-fallback-attempted'));
        
        // Try to extract Cloudinary path from proxy URL and create direct Cloudinary URL
        try {
            // Extract the path after image-proxy/
            const match = proxyUrl.match(/image-proxy\/(.+)$/);
            if (match) {
                const cloudinaryPath = match[1];
                const directUrl = `https://res.cloudinary.com/djye0w3gi/image/upload/${cloudinaryPath}`;
                console.log('🔄 Trying direct Cloudinary URL as fallback:', directUrl);
                
                // Set a flag to prevent infinite recursion
                if (!imgElement.hasAttribute('data-fallback-attempted')) {
                    imgElement.setAttribute('data-fallback-attempted', 'true');
                    imgElement.src = directUrl;
                    
                    // Test if the direct URL is accessible by making a fetch request
                    fetch(directUrl, { method: 'HEAD' })
                        .then(response => {
                            console.log('🧪 Direct URL test result:', response.status, response.statusText);
                            if (!response.ok) {
                                console.error('🚨 Direct URL also failed:', response.status);
                            }
                        })
                        .catch(err => {
                            console.error('🚨 Direct URL fetch test failed:', err);
                        });
                    
                    return;
                }
            }
        } catch (error) {
            console.error('Error creating fallback URL:', error);
        }
        
        // Final fallback: show error placeholder
        console.log('🚨 All fallback attempts failed, showing error placeholder');
        imgElement.style.objectFit = 'cover';
        imgElement.style.backgroundColor = '#e9ecef';
        imgElement.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'><rect width='150' height='150' fill='%23e9ecef'/><text x='75' y='75' text-anchor='middle' dy='.3em' fill='%236c757d'>Image Failed</text></svg>";
    }

    updateImageGallery(type) {
        const gallery = document.getElementById(`${type}Gallery`);
        const imageArray = type === 'passport' ? this.passportPics : this.visaPics;
        const hiddenInput = document.getElementById(`tenant${type.charAt(0).toUpperCase() + type.slice(1)}Pics`);
        
        if (!gallery || !hiddenInput) {
            return;
        }
        
        // Update hidden input
        hiddenInput.value = JSON.stringify(imageArray);
        
        if (imageArray.length === 0) {
            gallery.innerHTML = '<div class="text-muted small">No images uploaded yet</div>';
            return;
        }
        
        // Create images with proper loading handling
        let html = '<div class="row g-2">';
        imageArray.forEach((url, index) => {
            const icon = type === 'passport' ? 'bi-passport' : 'bi-credit-card';
            const imageHtml = `
                <div class="col-6 col-md-4 mb-3">
                    <div class="position-relative border rounded overflow-hidden">
                        <img src="${this.normalizeImageUrl(url)}" alt="${type} ${index + 1}" 
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
                            <small><i class="bi ${icon} me-1"></i>${type.charAt(0).toUpperCase() + type.slice(1)} ${index + 1}</small>
                        </div>
                    </div>
                </div>
            `;
            html += imageHtml;
        });
        html += '</div>';
        
        gallery.innerHTML = html;
    }

    setupImageUrlListeners() {
        // These are no longer needed with the new multiple image approach
        // The URL inputs now have dedicated "Add" buttons
    }

    // Avatar upload methods
    openAvatarUpload() {
        const fileInput = document.getElementById('avatarUploadInput');
        fileInput.click();
        
        // Add event listener for file selection
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.uploadAvatar(e.target.files[0]);
            }
        };
    }

    async uploadAvatar(file) {
        const uploadButton = document.querySelector("button[onclick=\"tenantManager.openAvatarUpload()\"]");
        const originalText = uploadButton.innerHTML;
        
        try {
            // Show loading state
            uploadButton.disabled = true;
            uploadButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading avatar...';
            
            const result = await this.uploadSingleImage(file);
            
            if (result.success) {
                console.log('🔗 Avatar uploaded successfully:', result.url);
                
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
                
                this.avatar = imageUrl;
                this.updateAvatarPreview();
                
                console.log('✅ Avatar set to:', this.avatar);
            } else {
                alert('Failed to upload avatar: ' + result.error);
            }
            
        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Error uploading avatar. Please try again.');
        } finally {
            // Restore button state
            uploadButton.disabled = false;
            uploadButton.innerHTML = originalText;
        }
    }

    addAvatarFromUrl() {
        const urlInput = document.getElementById('tenantAvatarUrl');
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Please enter a valid image URL');
            return;
        }
        
        this.avatar = url;
        this.updateAvatarPreview();
        urlInput.value = ''; // Clear input after adding
        
        console.log('✅ Avatar set from URL:', this.avatar);
    }

    removeAvatar() {
        this.avatar = '';
        this.updateAvatarPreview();
        console.log('🗑️ Avatar removed');
    }

    updateAvatarPreview() {
        const preview = document.getElementById('avatarPreview');
        const hiddenInput = document.getElementById('tenantAvatar');
        
        if (!preview || !hiddenInput) {
            return;
        }
        
        // Update hidden input
        hiddenInput.value = this.avatar;
        
        if (!this.avatar) {
            preview.innerHTML = '<div class="text-muted small">No avatar selected</div>';
            return;
        }
        
        preview.innerHTML = `
            <div class="position-relative d-inline-block">
                <img src="${this.normalizeImageUrl(this.avatar)}" alt="Avatar preview" 
                     class="rounded-circle border" 
                     style="width: 80px; height: 80px; object-fit: cover; cursor: pointer;" 
                     onclick="window.open('${this.avatar}', '_blank')" />
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
}

// Export for use in other modules
window.TenantManagementComponent = TenantManagementComponent;