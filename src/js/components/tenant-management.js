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
        this.signature = ''; // Signature image URL (for main tenants)
        this.originalTenantData = null; // Store original tenant data for change detection
        
        // Pagination properties
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalTenants = 0;
        this.hasNextPage = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Don't load tenants immediately - wait until section is visible
        // this.loadTenants();
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

        // Set up clipboard paste functionality for image URL fields
        this.setupClipboardPasteListeners();

        // Set up change detection for edit mode
        this.setupChangeDetection();

        // Listen for window resize to update table colspan
        window.addEventListener('resize', () => {
            // Re-render the table when window size changes
            if (this.tenants && this.tenants.length > 0) {
                this.renderTenantsTable();
            }
        });
    }

    async loadTenants(page = 1) {
        try {
            this.currentPage = page;
            const offset = (page - 1) * this.pageSize;
            
            // Build URL with pagination parameters
            const url = `${API_CONFIG.ENDPOINTS.TENANTS}?limit=${this.pageSize}&offset=${offset}`;
            const response = await API.get(url);
            const result = await response.json();
            
            // Handle different response formats
            if (result.success && result.tenants) {
                // Standard API response format with pagination info
                this.tenants = result.tenants;
                this.totalTenants = result.total || result.tenants.length;
                this.hasNextPage = result.hasMore || (result.tenants.length === this.pageSize);
            } else if (result.tenants && Array.isArray(result.tenants)) {
                // Direct tenant array format
                this.tenants = result.tenants;
                this.totalTenants = result.total || result.tenants.length;
                this.hasNextPage = result.tenants.length === this.pageSize;
            } else if (Array.isArray(result)) {
                // Direct array response
                this.tenants = result;
                this.totalTenants = result.length;
                this.hasNextPage = result.length === this.pageSize;
            } else {
                console.error('Failed to load tenants:', result.error || 'Unknown format');
                this.showEmptyState();
                return;
            }
            
            console.log('✅ Loaded', this.tenants.length, 'tenants for page', this.currentPage);
            await this.renderTenantsTable();
            this.updatePaginationControls();
            
            // Update sidebar badges
            if (window.updateSidebarBadges) {
                window.updateSidebarBadges();
            }
        } catch (error) {
            console.error('Error loading tenants:', error);
            this.showEmptyState('Error loading tenants. Please try again.');
        }
    }

    async renderTenantsTable() {
        const tbody = document.getElementById('tenantsTableBody');
        if (!tbody) {
            console.error('tenantsTableBody element not found!');
            return;
        }
        
        if (this.tenants.length === 0) {
            this.showEmptyState();
            return;
        }

        // Ensure properties cache is loaded for property details
        if (!this.propertiesCache) {
            await this.loadPropertiesCache();
        }

        // Group tenants by property
        const groupedTenants = this.groupTenantsByProperty(this.tenants);
        
        let html = '';
        Object.keys(groupedTenants).sort().forEach(propertyId => {
            const tenantsInProperty = groupedTenants[propertyId];
            
            // Get property details for the header
            const propertyInfo = this.getPropertyInfo(propertyId);
            const propertyDisplay = propertyInfo 
                ? `${this.escapeHtml(propertyId)} - ${this.escapeHtml(propertyInfo.address)}, ${this.escapeHtml(propertyInfo.unit)}`
                : this.escapeHtml(propertyId);
            
            // Add property header row with copy button
            html += `
                <tr class="table-primary">
                    <td colspan="${this.getTableColspan()}" class="fw-bold" style="width: 100%; padding: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div>
                                <i class="bi bi-building me-2"></i>
                                Property: ${propertyDisplay}
                                <span class="badge bg-primary ms-2">${tenantsInProperty.length} tenant${tenantsInProperty.length !== 1 ? 's' : ''}</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-light" 
                                    onclick="tenantManager.copyTenantList('${propertyId}')" 
                                    title="Copy tenant list to clipboard">
                                <i class="bi bi-clipboard me-1"></i>Copy List
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // Add tenants for this property
            tenantsInProperty.forEach(tenant => {
                html += `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="me-3">
                                    ${tenant.avatar ? 
                                        `<img src="${this.getOptimizedAvatarUrl(tenant.avatar, 'small')}" alt="${this.escapeHtml(tenant.name)}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">` :
                                        `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 14px;">${this.escapeHtml(tenant.name.charAt(0).toUpperCase())}</div>`
                                    }
                                </div>
                                <div>
                                    <div>${this.escapeHtml(tenant.name)}</div>
                                    <small class="text-muted">${this.escapeHtml(tenant.phoneNumber || 'No phone')}</small>
                                </div>
                            </div>
                        </td>
                        <td>${this.escapeHtml(tenant.fin) || '-'}</td>
                        <td>${this.escapeHtml(tenant.passportNumber)}</td>
                        <td>
                            ${this.getRegistrationStatusBadge(tenant.registrationStatus || (tenant.isRegistered ? 'registered' : 'unregistered'))}
                            ${this.hasMainTenantProperty(tenant) ? '<span class="badge bg-primary ms-1">Main Tenant</span>' : ''}
                        </td>
                        <td>
                            ${this.renderPropertyDetails(tenant)}
                        </td>
                        <td>
                            <span class="badge bg-info">
                                ${tenant.properties ? tenant.properties.length : 0} properties
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="tenantManager.editTenant('${tenant.passportNumber}')">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="tenantManager.deleteTenant('${tenant.passportNumber}')">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `;
            });
        });
        
        tbody.innerHTML = html;
    }

    groupTenantsByProperty(tenants) {
        const grouped = {};
        
        tenants.forEach(tenant => {
            const tenantProperties = tenant.properties || [];
            
            if (tenantProperties.length === 0) {
                // Handle tenants with no properties
                if (!grouped['No Property Assigned']) {
                    grouped['No Property Assigned'] = [];
                }
                grouped['No Property Assigned'].push(tenant);
            } else {
                // Group by each property the tenant is assigned to
                tenantProperties.forEach(prop => {
                    let propertyId;
                    
                    if (typeof prop === 'object' && prop.propertyId) {
                        propertyId = prop.propertyId;
                    } else if (typeof prop === 'string') {
                        propertyId = prop;
                    } else {
                        propertyId = prop._id || 'Unknown Property';
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

    showEmptyState(message = 'No tenants found') {
        const tbody = document.getElementById('tenantsTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr>
                <td colspan="${this.getTableColspan()}" class="text-center text-muted py-4">
                    <i class="bi bi-people fs-1"></i>
                    <p class="mt-2">${message}</p>
                </td>
            </tr>
        `;
    }

    async filterTenants(searchTerm) {
        if (!searchTerm.trim()) {
            await this.renderTenantsTable();
            return;
        }

        // Ensure properties cache is loaded for property details
        if (!this.propertiesCache) {
            await this.loadPropertiesCache();
        }

        const filteredTenants = this.tenants.filter(tenant => {
            const basicMatch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tenant.fin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tenant.passportNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tenant.phoneNumber && tenant.phoneNumber.toLowerCase().includes(searchTerm.toLowerCase()));
            
            // Search in property rooms if using new format
            const roomMatch = tenant.properties && Array.isArray(tenant.properties) 
                ? tenant.properties.some(prop => {
                    if (typeof prop === 'object' && prop.room) {
                        return prop.room.toLowerCase().includes(searchTerm.toLowerCase());
                    }
                    return false;
                })
                : (tenant.room && tenant.room.toLowerCase().includes(searchTerm.toLowerCase()));
            
            // Search in property IDs
            const propertyMatch = tenant.properties && Array.isArray(tenant.properties)
                ? tenant.properties.some(prop => {
                    const propertyId = typeof prop === 'object' ? prop.propertyId : prop;
                    return propertyId && propertyId.toLowerCase().includes(searchTerm.toLowerCase());
                })
                : false;
            
            return basicMatch || roomMatch || propertyMatch;
        });

        const tbody = document.getElementById('tenantsTableBody');
        if (!tbody) return;

        if (filteredTenants.length === 0) {
            this.showEmptyState(`No tenants match "${searchTerm}"`);
            return;
        }

        // Group filtered tenants by property
        const groupedTenants = this.groupTenantsByProperty(filteredTenants);
        
        let html = '';
        Object.keys(groupedTenants).sort().forEach(propertyId => {
            const tenantsInProperty = groupedTenants[propertyId];
            
            // Get property details for the header
            const propertyInfo = this.getPropertyInfo(propertyId);
            const propertyDisplay = propertyInfo 
                ? `${this.escapeHtml(propertyId)} - ${this.escapeHtml(propertyInfo.address)}, ${this.escapeHtml(propertyInfo.unit)}`
                : this.escapeHtml(propertyId);
            
            // Add property header row with copy button
            html += `
                <tr class="table-primary">
                    <td colspan="${this.getTableColspan()}" class="fw-bold" style="width: 100%; padding: 0.75rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div>
                                <i class="bi bi-building me-2"></i>
                                Property: ${propertyDisplay}
                                <span class="badge bg-primary ms-2">${tenantsInProperty.length} tenant${tenantsInProperty.length !== 1 ? 's' : ''}</span>
                            </div>
                            <button type="button" class="btn btn-sm btn-outline-light" 
                                    onclick="tenantManager.copyTenantList('${propertyId}')" 
                                    title="Copy tenant list to clipboard">
                                <i class="bi bi-clipboard me-1"></i>Copy List
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            
            // Add tenants for this property
            tenantsInProperty.forEach(tenant => {
                html += `
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="me-3">
                                    ${tenant.avatar ? 
                                        `<img src="${this.getOptimizedAvatarUrl(tenant.avatar, 'small')}" alt="${this.escapeHtml(tenant.name)}" class="rounded-circle" style="width: 36px; height: 36px; object-fit: cover;">` :
                                        `<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white fw-bold" style="width: 36px; height: 36px; font-size: 14px;">${this.escapeHtml(tenant.name.charAt(0).toUpperCase())}</div>`
                                    }
                                </div>
                                <div>
                                    <div>${this.escapeHtml(tenant.name)}</div>
                                    <small class="text-muted">${this.escapeHtml(tenant.phoneNumber || 'No phone')}</small>
                                </div>
                            </div>
                        </td>
                        <td>${this.escapeHtml(tenant.fin) || '-'}</td>
                        <td>${this.escapeHtml(tenant.passportNumber)}</td>
                        <td>
                            ${this.getRegistrationStatusBadge(tenant.registrationStatus || (tenant.isRegistered ? 'registered' : 'unregistered'))}
                            ${this.hasMainTenantProperty(tenant) ? '<span class="badge bg-primary ms-1">Main Tenant</span>' : ''}
                        </td>
                        <td>
                            ${this.renderPropertyDetails(tenant)}
                        </td>
                        <td>
                            <span class="badge bg-info">
                                ${tenant.properties ? tenant.properties.length : 0} properties
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="tenantManager.editTenant('${tenant.passportNumber}')">
                                <i class="bi bi-pencil"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="tenantManager.deleteTenant('${tenant.passportNumber}')">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `;
            });
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
            form.setAttribute('data-tenant-passport', tenant?.passportNumber || '');
            form.setAttribute('data-mode', isEdit ? 'edit' : 'add');
            
            if (isEdit && tenant) {
                // Store original tenant data for change detection
                this.originalTenantData = {
                    name: tenant.name || '',
                    fin: tenant.fin || '',
                    passportNumber: tenant.passportNumber || '',
                    phoneNumber: tenant.phoneNumber || '',
                    registrationStatus: tenant.registrationStatus || (tenant.isRegistered ? 'registered' : 'unregistered'),
                    properties: JSON.parse(JSON.stringify(tenant.properties || [])), // Deep copy
                    passportPics: [...(tenant.passportPics || (tenant.passportPic ? [tenant.passportPic] : []))], // Copy array
                    visaPics: [...(tenant.visaPics || (tenant.visaPic ? [tenant.visaPic] : []))], // Copy array
                    avatar: tenant.avatar || '',
                    signature: tenant.signature || '',
                    // New financial fields
                    rent: tenant.rent || null,
                    deposit: tenant.deposit || null,
                    depositReceiver: tenant.depositReceiver || ''
                };
                
                // Populate form with existing data
                document.getElementById('tenantName').value = tenant.name || '';
                document.getElementById('tenantFin').value = tenant.fin || '';
                document.getElementById('tenantPassport').value = tenant.passportNumber || '';
                document.getElementById('tenantPhoneNumber').value = tenant.phoneNumber || '';
                
                // Populate financial fields (except depositReceiver which is populated after investors are loaded)
                document.getElementById('tenantRent').value = tenant.rent || '';
                document.getElementById('tenantDeposit').value = tenant.deposit || '';
                
                // Set registration status (support backward compatibility)
                const registrationStatus = tenant.registrationStatus || (tenant.isRegistered ? 'registered' : 'unregistered');
                this.setRegistrationStatus(registrationStatus);
                
                // Handle multiple images (with backward compatibility)
                this.passportPics = tenant.passportPics || (tenant.passportPic ? [tenant.passportPic] : []);
                this.visaPics = tenant.visaPics || (tenant.visaPic ? [tenant.visaPic] : []);
                this.signature = tenant.signature || '';
                console.log('📋 Set passportPics:', this.passportPics);
                console.log('📋 Set visaPics:', this.visaPics);
                console.log('📋 Set signature:', this.signature);
                // Don't update gallery here - wait until modal is shown
                
                // Handle avatar
                this.avatar = tenant.avatar || '';
                this.updateAvatarPreview();
                
                // Set up properties - store full property objects with details
                this.selectedPropertiesDetails = (tenant.properties || []).map(prop => {
                    if (typeof prop === 'object' && prop.propertyId) {
                        return {
                            propertyId: prop.propertyId,
                            isMainTenant: prop.isMainTenant || false,
                            room: prop.room || '',
                            moveinDate: prop.moveinDate || '',
                            moveoutDate: prop.moveoutDate || ''
                        };
                    } else {
                        return {
                            propertyId: typeof prop === 'string' ? prop : (prop.propertyId || prop._id),
                            isMainTenant: false,
                            room: '',
                            moveinDate: '',
                            moveoutDate: ''
                        };
                    }
                });
                this.selectedProperties = this.selectedPropertiesDetails.map(p => p.propertyId);
                
            } else {
                // Reset for add mode
                this.selectedProperties = [];
                this.selectedPropertiesDetails = [];
                this.passportPics = [];
                this.visaPics = [];
                this.avatar = '';
                this.signature = '';
                this.updateImageGallery('passport');
                this.updateImageGallery('visa');
                this.updateAvatarPreview();
                this.updateSignaturePreview();
                
                // Reset registration status to unregistered
                this.setRegistrationStatus('unregistered');
                
            }
        }
        
        // Load available properties and populate select
        await this.loadPropertiesForSelect();
        // Load available investors for deposit receiver dropdown
        await this.loadInvestorsForSelect();
        
        // After investors are loaded, populate the depositReceiver field if in edit mode
        if (isEdit && tenant && tenant.depositReceiver) {
            document.getElementById('tenantDepositReceiver').value = tenant.depositReceiver;
        }
        
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
            this.updateSignaturePreview();
            
            // Show/hide signature section based on main tenant status
            this.toggleSignatureSection();
            
            // Set up clipboard paste listeners after modal is shown
            this.setupModalClipboardListeners();
            
            // Set up signature URL input listener
            this.setupSignatureUrlListener();
        }, { once: true });
        
        modal.show();
        
        // For new tenants, clear original data and enable button
        if (!isEdit) {
            this.originalTenantData = null;
            const submitBtn = document.getElementById('tenantSubmitBtn');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('btn-secondary');
                submitBtn.classList.add('btn-primary');
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
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());
        
        // Remove modal classes from body
        document.body.classList.remove('modal-open');
        document.body.style.paddingRight = '';
        document.body.style.overflow = '';
        
        // Reset selected properties
        this.selectedProperties = [];
    }

    async loadPropertiesCache() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.propertiesCache && this.propertiesCacheTime && (now - this.propertiesCacheTime) < this.cacheTimeout) {
                console.log('Using cached properties data');
                return;
            }
            
            const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
            const result = await response.json();
            
            // Cache the result
            if (result.success) {
                this.propertiesCache = result;
                this.propertiesCacheTime = now;
                console.log('✅ Properties cache loaded:', result.properties?.length || 0, 'properties');
            }
        } catch (error) {
            console.error('Error loading properties cache:', error);
        }
    }

    async loadPropertiesForSelect() {
        // First load the cache
        await this.loadPropertiesCache();
        
        try {
            this.populatePropertyCheckboxes(this.propertiesCache || { success: false, properties: [] });
        } catch (error) {
            console.error('Error loading properties:', error);
            const checkboxList = document.getElementById('propertyCheckboxList');
            if (checkboxList) {
                checkboxList.innerHTML = '<li class="px-3 py-2 text-danger">Error loading properties</li>';
            }
        }
    }

    async loadInvestorsForSelect() {
        try {
            const response = await API.get(API_CONFIG.ENDPOINTS.INVESTORS);
            const result = await response.json();
            
            if (result.success && result.data) {
                this.populateInvestorDropdown(result.data);
                console.log('✅ Investors loaded for dropdown:', result.data.length, 'investors');
            } else {
                console.error('Failed to load investors:', result.error || 'Unknown error');
                this.populateInvestorDropdown([]);
            }
        } catch (error) {
            console.error('Error loading investors:', error);
            this.populateInvestorDropdown([]);
        }
    }

    populateInvestorDropdown(investors) {
        const dropdown = document.getElementById('tenantDepositReceiver');
        if (!dropdown) return;
        
        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Select investor who receives deposit...</option>';
        
        if (investors.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No investors available';
            option.disabled = true;
            dropdown.appendChild(option);
            return;
        }
        
        investors.forEach(investor => {
            const option = document.createElement('option');
            option.value = investor.investorId;
            option.textContent = `${investor.investorId} - ${investor.name}`;
            dropdown.appendChild(option);
        });
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
                // Initialize details if not exists
                if (!this.selectedPropertiesDetails) {
                    this.selectedPropertiesDetails = [];
                }
                // Add property details with defaults
                if (!this.selectedPropertiesDetails.find(p => p.propertyId === propertyId)) {
                    this.selectedPropertiesDetails.push({
                        propertyId,
                        isMainTenant: false,
                        room: '',
                        moveinDate: '',
                        moveoutDate: ''
                    });
                }
            }
        } else {
            // Remove property from selection
            this.selectedProperties = this.selectedProperties.filter(id => id !== propertyId);
            if (this.selectedPropertiesDetails) {
                this.selectedPropertiesDetails = this.selectedPropertiesDetails.filter(p => p.propertyId !== propertyId);
            }
        }
        
        this.updateSelectedPropertiesList();
        this.updateDropdownText();
        this.checkForChanges();
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
        this.checkForChanges();
        
        // Update checkbox to reflect removal
        const checkbox = document.getElementById(`property-${propertyId}`);
        if (checkbox) {
            checkbox.checked = false;
        }
    }

    updateSelectedPropertiesList() {
        const listContainer = document.getElementById('selectedPropertiesList');
        const hiddenInput = document.getElementById('tenantProperties');
        
        if (!this.selectedPropertiesDetails) {
            this.selectedPropertiesDetails = [];
        }
        
        if (this.selectedProperties.length === 0) {
            listContainer.innerHTML = '<div class="text-muted">No properties assigned</div>';
            hiddenInput.value = '';
        } else {
            let html = '';
            this.selectedProperties.forEach(propertyId => {
                const propertyDetails = this.selectedPropertiesDetails.find(p => p.propertyId === propertyId) || {
                    propertyId,
                    isMainTenant: false,
                    room: '',
                    moveinDate: '',
                    moveoutDate: ''
                };
                
                // Get property info from cache
                const propertyInfo = this.getPropertyInfo(propertyId);
                const propertyTitle = propertyInfo 
                    ? `${propertyId} - ${propertyInfo.address}, ${propertyInfo.unit}`
                    : propertyId;
                
                html += `
                    <div class="card mb-2">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="card-title mb-0">
                                    <i class="bi bi-building me-2"></i>${propertyTitle}
                                </h6>
                                <button type="button" class="btn btn-sm btn-outline-danger" 
                                        onclick="tenantManager.removePropertyFromTenant('${propertyId}')" 
                                        title="Remove property">
                                    <i class="bi bi-x"></i>
                                </button>
                            </div>
                            
                            <div class="row g-2">
                                <div class="col-12">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" 
                                               id="mainTenant_${propertyId}" 
                                               ${propertyDetails.isMainTenant ? 'checked' : ''}
                                               onchange="tenantManager.updatePropertyDetail('${propertyId}', 'isMainTenant', this.checked)">
                                        <label class="form-check-label" for="mainTenant_${propertyId}">
                                            Main Tenant for this property
                                        </label>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small">Room</label>
                                    <select class="form-select form-select-sm" 
                                            onchange="tenantManager.updatePropertyDetail('${propertyId}', 'room', this.value)"
                                            value="${propertyDetails.room}">
                                        <option value="">Select room</option>
                                        <option value="COMMON1" ${propertyDetails.room === 'COMMON1' ? 'selected' : ''}>Common 1</option>
                                        <option value="COMMON2" ${propertyDetails.room === 'COMMON2' ? 'selected' : ''}>Common 2</option>
                                        <option value="MASTER" ${propertyDetails.room === 'MASTER' ? 'selected' : ''}>Master</option>
                                        <option value="COMPARTMENT1" ${propertyDetails.room === 'COMPARTMENT1' ? 'selected' : ''}>Compartment 1</option>
                                        <option value="COMPARTMENT2" ${propertyDetails.room === 'COMPARTMENT2' ? 'selected' : ''}>Compartment 2</option>
                                        <option value="STORE" ${propertyDetails.room === 'STORE' ? 'selected' : ''}>Store</option>
                                        <option value="COMMON_1_PAX" ${propertyDetails.room === 'COMMON_1_PAX' ? 'selected' : ''}>Common 1 Pax</option>
                                        <option value="COMMON_2_PAX" ${propertyDetails.room === 'COMMON_2_PAX' ? 'selected' : ''}>Common 2 Pax</option>
                                        <option value="SMALL_SINGLE_1_PAX" ${propertyDetails.room === 'SMALL_SINGLE_1_PAX' ? 'selected' : ''}>Small Single 1 Pax</option>
                                        <option value="SMALL_SINGLE_2_PAX" ${propertyDetails.room === 'SMALL_SINGLE_2_PAX' ? 'selected' : ''}>Small Single 2 Pax</option>
                                        <option value="BIG_SINGLE_1_PAX" ${propertyDetails.room === 'BIG_SINGLE_1_PAX' ? 'selected' : ''}>Big Single 1 Pax</option>
                                        <option value="BIG_SINGLE_2_PAX" ${propertyDetails.room === 'BIG_SINGLE_2_PAX' ? 'selected' : ''}>Big Single 2 Pax</option>
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small">Move-in Date</label>
                                    <input type="date" class="form-control form-control-sm" 
                                           value="${propertyDetails.moveinDate ? propertyDetails.moveinDate.split('T')[0] : ''}"
                                           onchange="tenantManager.updatePropertyDetail('${propertyId}', 'moveinDate', this.value)">
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label small">Move-out Date</label>
                                    <input type="date" class="form-control form-control-sm" 
                                           value="${propertyDetails.moveoutDate ? propertyDetails.moveoutDate.split('T')[0] : ''}"
                                           onchange="tenantManager.updatePropertyDetail('${propertyId}', 'moveoutDate', this.value)">
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
        
        return this.propertiesCache.properties.find(prop => prop.propertyId === propertyId);
    }

    updatePropertyDetail(propertyId, field, value) {
        if (!this.selectedPropertiesDetails) {
            this.selectedPropertiesDetails = [];
        }
        
        let property = this.selectedPropertiesDetails.find(p => p.propertyId === propertyId);
        if (!property) {
            property = {
                propertyId,
                isMainTenant: false,
                room: '',
                moveinDate: '',
                moveoutDate: ''
            };
            this.selectedPropertiesDetails.push(property);
        }
        
        property[field] = value;
        console.log(`Updated property ${propertyId} ${field} to:`, value);
        
        // If main tenant status changed, toggle signature section
        if (field === 'isMainTenant') {
            this.toggleSignatureSection();
        }
        
        // Check for changes to enable/disable submit button
        this.checkForChanges();
    }

    async handleTenantSubmit(event) {
        try {
            const form = event.target;
            const formData = new FormData(form);
            const isEdit = form.getAttribute('data-mode') === 'edit';
            const originalPassport = form.getAttribute('data-tenant-passport');

            const tenantData = {
                name: formData.get('name').trim(),
                fin: formData.get('fin').trim().toUpperCase() || null,
                passportNumber: formData.get('passportNumber').trim().toUpperCase(),
                phoneNumber: formData.get('phoneNumber').trim() || null,
                registrationStatus: document.getElementById('tenantRegistrationStatusHidden').value || 'unregistered',
                // Keep backward compatibility with isRegistered field
                isRegistered: document.getElementById('tenantRegistrationStatusHidden').value === 'registered',
                properties: this.selectedPropertiesDetails || this.selectedProperties.map(propertyId => ({
                    propertyId,
                    isMainTenant: false,
                    room: '',
                    moveinDate: '',
                    moveoutDate: ''
                })),
                passportPics: this.passportPics,
                visaPics: this.visaPics,
                avatar: this.avatar || null,
                signature: this.signature || null, // Send null instead of empty string
                // New financial fields
                rent: formData.get('rent') ? parseFloat(formData.get('rent')) : null,
                deposit: formData.get('deposit') ? parseFloat(formData.get('deposit')) : null,
                depositReceiver: formData.get('depositReceiver').trim() || null
            };

            // Debug: log the properties being sent
            console.log('🔄 Tenant update data:', { 
                ...tenantData, 
                propertiesType: typeof this.selectedProperties[0],
                propertiesContent: this.selectedProperties 
            });

            // Validate required fields
            if (!tenantData.name || !tenantData.passportNumber) {
                alert('Please fill in all required fields (Name, Passport Number)');
                return;
            }

            // Validate FIN length if provided
            if (tenantData.fin && tenantData.fin.length > 20) {
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
                await this.updateTenant(originalPassport, tenantData);
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

    async editTenant(passportNumber) {
        // Find the tenant to edit
        const tenant = this.tenants.find(t => t.passportNumber === passportNumber);
        if (!tenant) {
            alert('Tenant not found');
            return;
        }

        // Show the modal with tenant data
        this.showTenantModal(tenant);
    }

    async updateTenant(originalPassport, tenantData) {
        try {
            // Find the tenant to get the ID
            const tenant = this.tenants.find(t => t.passportNumber === originalPassport);
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

    async deleteTenant(passportNumber) {
        if (!confirm(`Are you sure you want to delete tenant ${passportNumber}?`)) {
            return;
        }

        try {
            // Find the tenant to get the ID
            const tenant = this.tenants.find(t => t.passportNumber === passportNumber);
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
        if (text == null || text === undefined) {
            return '';
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, (m) => map[m]);
    }

    // Method to get registration status badge
    getRegistrationStatusBadge(status) {
        switch (status) {
            case 'registered':
                return '<span class="badge bg-success">Registered</span>';
            case 'pending':
                return '<span class="badge bg-warning">Pending Registration</span>';
            case 'unregistered':
            default:
                return '<span class="badge bg-secondary">Unregistered</span>';
        }
    }

    // 3-state toggle button methods
    toggleRegistrationStatus() {
        const button = document.getElementById('tenantRegistrationStatus');
        const hiddenInput = document.getElementById('tenantRegistrationStatusHidden');
        
        if (!button || !hiddenInput) return;
        
        const currentStatus = button.getAttribute('data-status');
        let nextStatus;
        
        // Cycle through states: unregistered → pending → registered → unregistered
        switch (currentStatus) {
            case 'unregistered':
                nextStatus = 'pending';
                break;
            case 'pending':
                nextStatus = 'registered';
                break;
            case 'registered':
                nextStatus = 'unregistered';
                break;
            default:
                nextStatus = 'unregistered';
        }
        
        this.setRegistrationStatus(nextStatus);
    }

    setRegistrationStatus(status) {
        const button = document.getElementById('tenantRegistrationStatus');
        const hiddenInput = document.getElementById('tenantRegistrationStatusHidden');
        const statusText = button.querySelector('.status-text');
        
        if (!button || !hiddenInput || !statusText) return;
        
        // Update button attributes
        button.setAttribute('data-status', status);
        hiddenInput.value = status;
        
        // Update button text
        switch (status) {
            case 'registered':
                statusText.textContent = 'Registered';
                break;
            case 'pending':
                statusText.textContent = 'Pending Registration';
                break;
            case 'unregistered':
            default:
                statusText.textContent = 'Unregistered';
        }
        
        // Check for changes to update the submit button state
        this.checkForChanges();
    }

    // Use global image utilities
    normalizeImageUrl(url) {
        return ImageUtils.normalizeImageUrl(url);
    }

    getOptimizedAvatarUrl(url, size = 'small') {
        return ImageUtils.getOptimizedImageUrl(url, size);
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
            this.checkForChanges();
        } else {
            alert('This image URL is already added');
        }
    }

    removeImage(type, index) {
        const imageArray = type === 'passport' ? this.passportPics : this.visaPics;
        imageArray.splice(index, 1);
        this.updateImageGallery(type);
        this.checkForChanges();
    }

    handleImageError(imgElement, proxyUrl) {
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
                this.checkForChanges();
                
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
        this.checkForChanges(); // Check for changes to enable submit button
        
        console.log('✅ Avatar set from URL:', this.avatar);
    }

    removeAvatar() {
        this.avatar = '';
        this.updateAvatarPreview();
        this.checkForChanges(); // Check for changes to enable submit button
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
                <img src="${this.getOptimizedAvatarUrl(this.avatar, 'medium')}" alt="Avatar preview" 
                     class="rounded-circle border" 
                     style="width: 80px; height: 80px; object-fit: cover; cursor: pointer;" 
                     onclick="window.open('${this.normalizeImageUrl(this.avatar)}', '_blank')" />
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
        const fileInput = document.getElementById('signatureUploadInput');
        if (!fileInput) {
            // Create file input if it doesn't exist
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'signatureUploadInput';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);
        }
        
        document.getElementById('signatureUploadInput').click();
        
        // Add event listener for file selection
        document.getElementById('signatureUploadInput').onchange = (e) => {
            if (e.target.files.length > 0) {
                this.uploadSignature(e.target.files[0]);
            }
        };
    }

    async uploadSignature(file) {
        const uploadButton = document.querySelector("button[onclick=\"tenantManager.openSignatureUpload()\"]");
        const originalText = uploadButton.innerHTML;
        
        try {
            // Show loading state
            uploadButton.disabled = true;
            uploadButton.innerHTML = '<i class="bi bi-hourglass-split"></i> Uploading signature...';
            
            const result = await this.uploadSingleImage(file);
            
            if (result.success) {
                let imageUrl = result.url;
                
                // Normalize the URL
                if (imageUrl && !imageUrl.startsWith('http')) {
                    if (imageUrl.startsWith('/')) {
                        imageUrl = API_CONFIG.BASE_URL + imageUrl;
                    } else {
                        imageUrl = 'https://' + imageUrl;
                    }
                }
                
                this.signature = imageUrl;
                this.updateSignaturePreview();
                this.checkForChanges();
                
                console.log('✅ Signature set to:', this.signature);
            } else {
                alert('Failed to upload signature: ' + result.error);
            }
            
        } catch (error) {
            console.error('Error uploading signature:', error);
            alert('Error uploading signature. Please try again.');
        } finally {
            // Reset button state
            uploadButton.disabled = false;
            uploadButton.innerHTML = originalText;
        }
    }

    setSignatureFromUrl() {
        const urlInput = document.getElementById('tenantSignatureUrl');
        const url = urlInput.value.trim();
        
        if (!url) {
            alert('Please enter a valid image URL');
            return;
        }
        
        this.signature = this.normalizeImageUrl(url);
        this.updateSignaturePreview();
        urlInput.value = ''; // Clear input after adding
        this.checkForChanges();
        
        console.log('✅ Signature set from URL:', this.signature);
    }

    removeSignature() {
        this.signature = '';
        this.updateSignaturePreview();
        this.checkForChanges();
        console.log('🗑️ Signature removed');
    }

    updateSignaturePreview() {
        const preview = document.getElementById('signaturePreview');
        
        if (!preview) {
            return;
        }
        
        if (!this.signature) {
            preview.innerHTML = '<p class="text-muted fst-italic">No signature uploaded</p>';
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
        const signatureSection = document.getElementById('signatureSection');
        if (!signatureSection) return;
        
        // Check if any selected property has this tenant as main tenant
        const isMainTenant = this.selectedPropertiesDetails.some(prop => prop.isMainTenant);
        
        if (isMainTenant) {
            signatureSection.style.display = '';
            console.log('📝 Showing signature section for main tenant');
        } else {
            signatureSection.style.display = 'none';
            // Clear signature if not main tenant
            this.signature = '';
            this.updateSignaturePreview();
            console.log('🚫 Hiding signature section (not main tenant)');
        }
    }

    setupSignatureUrlListener() {
        const urlInput = document.getElementById('tenantSignatureUrl');
        if (urlInput) {
            // Remove existing event listener to avoid duplicates
            urlInput.removeEventListener('keypress', this.signatureUrlHandler);
            
            this.signatureUrlHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.setSignatureFromUrl();
                }
            };
            
            urlInput.addEventListener('keypress', this.signatureUrlHandler);
        }
    }

    // Helper method to check if tenant has any main tenant properties
    hasMainTenantProperty(tenant) {
        if (!tenant.properties || !Array.isArray(tenant.properties)) {
            return false;
        }
        return tenant.properties.some(prop => {
            // Handle both new object format and old string format
            return typeof prop === 'object' && prop.isMainTenant;
        });
    }

    // Helper method to render property details for each tenant
    renderPropertyDetails(tenant) {
        if (!tenant.properties || tenant.properties.length === 0) {
            return '<div class="text-muted small">No properties assigned</div>';
        }
        
        let html = '';
        tenant.properties.forEach((prop, index) => {
            if (typeof prop === 'object' && prop.propertyId) {
                // New format with detailed property info
                const propertyId = this.escapeHtml(prop.propertyId);
                const room = this.escapeHtml(prop.room || 'N/A');
                const moveinDate = prop.moveinDate ? new Date(prop.moveinDate).toLocaleDateString() : 'N/A';
                const moveoutDate = prop.moveoutDate ? new Date(prop.moveoutDate).toLocaleDateString() : 'Current';
                const isMain = prop.isMainTenant ? '<span class="badge bg-primary ms-1" style="font-size: 0.6em;">Main</span>' : '';
                
                html += `
                    <div class="mb-1 ${index > 0 ? 'border-top pt-1' : ''}">
                        <div><strong>${propertyId}</strong> ${isMain}</div>
                        <small class="text-muted">Room: ${room} | In: ${moveinDate} | Out: ${moveoutDate}</small>
                    </div>
                `;
            } else {
                // Old format - just property ID string
                const propertyId = typeof prop === 'string' ? prop : (prop.propertyId || prop._id || 'Unknown');
                html += `
                    <div class="mb-1 ${index > 0 ? 'border-top pt-1' : ''}">
                        <div><strong>${this.escapeHtml(propertyId)}</strong></div>
                        <small class="text-muted">Legacy format - no details</small>
                    </div>
                `;
            }
        });
        
        return html || '<div class="text-muted small">No properties assigned</div>';
    }

    setupChangeDetection() {
        // Set up event listeners for form fields to detect changes
        const form = document.getElementById('tenantForm');
        if (!form) return;

        const fieldsToWatch = [
            'tenantName', 'tenantFin', 'tenantPassport', 'tenantPhoneNumber',
            'tenantRent', 'tenantDeposit', 'tenantDepositReceiver'
        ];

        fieldsToWatch.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => this.checkForChanges());
            }
        });

        // Also listen for registration status changes
        const registrationButtons = form.querySelectorAll('input[name="registrationStatus"]');
        registrationButtons.forEach(button => {
            button.addEventListener('change', () => this.checkForChanges());
        });
    }

    checkForChanges() {
        if (!this.originalTenantData) {
            return; // No original data to compare against
        }

        const currentData = this.getCurrentFormData();
        const hasChanges = this.hasDataChanged(this.originalTenantData, currentData);
        
        const submitBtn = document.getElementById('tenantSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = !hasChanges;
            if (hasChanges) {
                submitBtn.classList.remove('btn-secondary');
                submitBtn.classList.add('btn-primary');
            } else {
                submitBtn.classList.remove('btn-primary');
                submitBtn.classList.add('btn-secondary');
            }
        }
    }

    getCurrentFormData() {
        return {
            name: (document.getElementById('tenantName')?.value || '').trim(),
            fin: (document.getElementById('tenantFin')?.value || '').trim(),
            passportNumber: (document.getElementById('tenantPassport')?.value || '').trim(),
            phoneNumber: (document.getElementById('tenantPhoneNumber')?.value || '').trim(),
            registrationStatus: document.getElementById('tenantRegistrationStatusHidden')?.value || 'unregistered',
            properties: this.selectedPropertiesDetails || [],
            passportPics: this.passportPics || [],
            visaPics: this.visaPics || [],
            avatar: this.avatar || '',
            signature: this.signature || '',
            // New financial fields
            rent: document.getElementById('tenantRent')?.value ? parseFloat(document.getElementById('tenantRent').value) : null,
            deposit: document.getElementById('tenantDeposit')?.value ? parseFloat(document.getElementById('tenantDeposit').value) : null,
            depositReceiver: (document.getElementById('tenantDepositReceiver')?.value || '').trim()
        };
    }

    hasDataChanged(original, current) {
        // Compare basic fields
        const fieldsToCompare = ['name', 'fin', 'passportNumber', 'phoneNumber', 'registrationStatus', 'avatar', 'signature', 'rent', 'deposit', 'depositReceiver'];
        
        for (const field of fieldsToCompare) {
            const originalValue = (original[field] || '').toString().trim();
            const currentValue = (current[field] || '').toString().trim();
            if (originalValue !== currentValue) {
                return true;
            }
        }

        // Compare arrays (passportPics, visaPics)
        if (!this.arraysEqual(original.passportPics || [], current.passportPics || [])) {
            return true;
        }
        if (!this.arraysEqual(original.visaPics || [], current.visaPics || [])) {
            return true;
        }

        // Compare properties array
        if (!this.propertiesEqual(original.properties || [], current.properties || [])) {
            return true;
        }

        return false;
    }

    arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        return arr1.every((item, index) => item === arr2[index]);
    }

    propertiesEqual(props1, props2) {
        if (props1.length !== props2.length) return false;
        
        return props1.every((prop1, index) => {
            const prop2 = props2[index];
            if (!prop2) return false;
            
            return prop1.propertyId === prop2.propertyId &&
                   prop1.isMainTenant === prop2.isMainTenant &&
                   (prop1.room || '') === (prop2.room || '') &&
                   (prop1.moveinDate || '') === (prop2.moveinDate || '') &&
                   (prop1.moveoutDate || '') === (prop2.moveoutDate || '');
        });
    }

    // Setup clipboard paste functionality for image URL input fields
    setupClipboardPasteListeners() {
        // This will be called during init, but actual setup happens when modal is shown
        console.log('📋 Clipboard paste listeners initialized');
    }

    // Set up clipboard listeners specifically when modal is shown
    setupModalClipboardListeners() {
        const imageUrlFields = [
            'tenantAvatarUrl',
            'tenantPassportPicUrl',
            'tenantVisaPicUrl',
            'tenantSignatureUrl'
        ];

        imageUrlFields.forEach(fieldId => {
            this.setupPasteListenerForField(fieldId);
        });
        
        console.log('📋 Modal clipboard listeners set up for tenant dialog');
    }

    setupPasteListenerForField(fieldId) {
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
        try {
            const items = (event.clipboardData || event.originalEvent?.clipboardData)?.items;
            if (!items) {
                console.log('No clipboard items found');
                return;
            }

            let imageFound = false;
            
            // Check all clipboard items for images
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                
                if (item.type.indexOf('image') !== -1) {
                    imageFound = true;
                    const file = item.getAsFile();
                    
                    if (file) {
                        console.log(`📋 Image pasted from clipboard to ${fieldId}:`, file.name, file.type);
                        await this.uploadClipboardImage(file, fieldId);
                        break; // Handle only the first image found
                    }
                }
            }

            if (!imageFound) {
                // Check if there's text content that might be an image URL
                const text = event.clipboardData?.getData('text') || event.originalEvent?.clipboardData?.getData('text');
                if (text && this.isImageUrl(text)) {
                    console.log(`📋 Image URL pasted from clipboard to ${fieldId}:`, text);
                    document.getElementById(fieldId).value = text;
                } else {
                    console.log('No image found in clipboard');
                    // Show a brief message to user
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
            // Show uploading state
            field.placeholder = 'Uploading image from clipboard...';
            field.disabled = true;

            // Upload the image using existing upload method
            const result = await this.uploadSingleImage(file);
            
            if (result.success) {
                // Ensure URL is properly formatted
                let imageUrl = result.url;
                if (imageUrl && !imageUrl.startsWith('http')) {
                    if (imageUrl.startsWith('/')) {
                        imageUrl = API_CONFIG.BASE_URL + imageUrl;
                    } else {
                        imageUrl = 'https://' + imageUrl;
                    }
                }

                // Set the URL in the input field
                field.value = imageUrl;
                
                // Auto-add the image based on the field type
                if (fieldId === 'tenantAvatarUrl') {
                    this.addAvatarFromUrl();
                } else if (fieldId === 'tenantPassportPicUrl') {
                    this.addImageFromUrl('passport');
                } else if (fieldId === 'tenantVisaPicUrl') {
                    this.addImageFromUrl('visa');
                } else if (fieldId === 'tenantSignatureUrl') {
                    this.setSignatureFromUrl();
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

    isImageUrl(url) {
        // Simple check for image URL patterns
        return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url) || 
               url.includes('cloudinary.com') || 
               url.includes('imgur.com') ||
               url.includes('drive.google.com');
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

        const messageDiv = document.createElement('div');
        messageDiv.id = messageId;
        messageDiv.className = `alert alert-${type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'danger'} alert-dismissible fade show mt-2`;
        messageDiv.style.fontSize = '0.875rem';
        messageDiv.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'x-circle'} me-1"></i>
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

    copyTenantList(propertyId) {
        try {
            // Find tenants for this property
            const groupedTenants = this.groupTenantsByProperty(this.tenants);
            const tenantsInProperty = groupedTenants[propertyId];
            
            if (!tenantsInProperty || tenantsInProperty.length === 0) {
                alert('No tenants found for this property');
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
                const mainTenantIndicator = isMainTenant ? ' ✅ (Main Tenant)' : '';
                
                copyText += `${ordinalNumber}. ${tenant.name}${mainTenantIndicator}\n`;
                copyText += `   FIN: ${tenant.fin}\n`;
                copyText += `   Passport: ${tenant.passportNumber}\n\n`;
            });

            // Copy to clipboard
            navigator.clipboard.writeText(copyText).then(() => {
                // Show success message
                this.showCopySuccessMessage(tenantsInProperty.length);
            }).catch(err => {
                console.error('Failed to copy to clipboard:', err);
                // Fallback: show the text in an alert
                alert('Copy failed. Here\'s the text to copy manually:\n\n' + copyText);
            });
            
        } catch (error) {
            console.error('Error copying tenant list:', error);
            alert('Error copying tenant list. Please try again.');
        }
    }

    showCopySuccessMessage(tenantCount) {
        // Create a temporary success message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
        messageDiv.style.cssText = `
            top: 20px; 
            right: 20px; 
            z-index: 9999; 
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        messageDiv.innerHTML = `
            <i class="bi bi-check-circle me-2"></i>
            Copied ${tenantCount} tenant${tenantCount !== 1 ? 's' : ''} to clipboard!
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

    // Pagination methods
    updatePaginationControls() {
        const paginationDiv = document.getElementById('tenantsPagination');
        const pageInfo = document.getElementById('tenantsPageInfo');
        const currentPageSpan = document.getElementById('tenantsCurrentPage');
        const prevButton = document.getElementById('tenantsPrevPage');
        const nextButton = document.getElementById('tenantsNextPage');
        
        if (!paginationDiv || !pageInfo || !currentPageSpan || !prevButton || !nextButton) {
            return;
        }
        
        // Show pagination only if there are tenants or we're not on page 1
        if (this.tenants.length > 0 || this.currentPage > 1) {
            paginationDiv.style.display = 'flex';
            
            // Update page info
            const startIndex = (this.currentPage - 1) * this.pageSize + 1;
            const endIndex = Math.min(startIndex + this.tenants.length - 1, this.totalTenants);
            pageInfo.textContent = this.tenants.length > 0 
                ? `${startIndex}-${endIndex} of ${this.totalTenants || 'many'}`
                : '0';
            
            // Update current page
            currentPageSpan.textContent = this.currentPage;
            
            // Update button states
            prevButton.classList.toggle('disabled', this.currentPage <= 1);
            nextButton.classList.toggle('disabled', !this.hasNextPage);
        } else {
            paginationDiv.style.display = 'none';
        }
    }
    
    async goToNextPage() {
        if (this.hasNextPage) {
            await this.loadTenants(this.currentPage + 1);
        }
    }
    
    async goToPreviousPage() {
        if (this.currentPage > 1) {
            await this.loadTenants(this.currentPage - 1);
        }
    }
}

// Export for use in other modules
window.TenantManagementComponent = TenantManagementComponent;