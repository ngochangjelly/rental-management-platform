/**
 * Tenant Management Component
 * Handles tenant CRUD operations
 */
class TenantManagementComponent {
    constructor() {
        this.tenants = [];
        this.selectedProperties = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTenants();
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
            
            if (result.success) {
                this.tenants = result.tenants;
                this.renderTenantsTable();
                
                // Update sidebar badges
                if (window.updateSidebarBadges) {
                    window.updateSidebarBadges();
                }
            } else {
                console.error('Failed to load tenants:', result.error);
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Error loading tenants:', error);
            this.showEmptyState('Error loading tenants. Please try again.');
        }
    }

    renderTenantsTable() {
        const tbody = document.getElementById('tenantsTableBody');
        if (!tbody) return;
        
        if (this.tenants.length === 0) {
            this.showEmptyState();
            return;
        }

        let html = '';
        this.tenants.forEach(tenant => {
            html += `
                <tr>
                    <td>${this.escapeHtml(tenant.name)}</td>
                    <td>${this.escapeHtml(tenant.fin)}</td>
                    <td>${this.escapeHtml(tenant.passportNumber)}</td>
                    <td>
                        <span class="badge bg-${tenant.isRegistered ? 'success' : 'secondary'}">
                            ${tenant.isRegistered ? 'Active' : 'Inactive'}
                        </span>
                        ${tenant.isMainTenant ? '<span class="badge bg-primary ms-1">Main</span>' : ''}
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
                <td colspan="6" class="text-center text-muted py-4">
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
            tenant.passportNumber.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const tbody = document.getElementById('tenantsTableBody');
        if (!tbody) return;

        if (filteredTenants.length === 0) {
            this.showEmptyState(`No tenants match "${searchTerm}"`);
            return;
        }

        let html = '';
        filteredTenants.forEach(tenant => {
            html += `
                <tr>
                    <td>${this.escapeHtml(tenant.name)}</td>
                    <td>${this.escapeHtml(tenant.fin)}</td>
                    <td>${this.escapeHtml(tenant.passportNumber)}</td>
                    <td>
                        <span class="badge bg-${tenant.isRegistered ? 'success' : 'secondary'}">
                            ${tenant.isRegistered ? 'Active' : 'Inactive'}
                        </span>
                        ${tenant.isMainTenant ? '<span class="badge bg-primary ms-1">Main</span>' : ''}
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
                document.getElementById('tenantIsRegistered').checked = tenant.isRegistered || false;
                document.getElementById('tenantIsMainTenant').checked = tenant.isMainTenant || false;
                
                // Set up properties
                this.selectedProperties = tenant.properties || [];
                
                // Make FIN readonly in edit mode
                document.getElementById('tenantFin').readOnly = true;
                document.getElementById('tenantFin').classList.add('bg-light');
            } else {
                // Reset for add mode
                this.selectedProperties = [];
                
                // Make FIN editable in add mode
                document.getElementById('tenantFin').readOnly = false;
                document.getElementById('tenantFin').classList.remove('bg-light');
            }
        }
        
        // Load available properties and populate select
        await this.loadPropertiesForSelect();
        this.updateSelectedPropertiesList();
        
        // Show modal
        const modalEl = document.getElementById('tenantModal');
        const modal = new bootstrap.Modal(modalEl);
        
        // Add event listener for when modal is fully hidden
        modalEl.addEventListener('hidden.bs.modal', () => {
            this.cleanupModal();
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
            const response = await API.get(API_CONFIG.ENDPOINTS.PROPERTIES);
            const result = await response.json();
            
            const propertySelect = document.getElementById('propertySelect');
            if (propertySelect && result.success) {
                // Clear existing options except the first one
                propertySelect.innerHTML = '<option value="">Select a property to add</option>';
                
                result.properties.forEach(property => {
                    const option = document.createElement('option');
                    option.value = property.propertyId;
                    option.textContent = `${property.propertyId} - ${property.address}, ${property.unit}`;
                    propertySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading properties:', error);
        }
    }

    addPropertyToTenant() {
        const propertySelect = document.getElementById('propertySelect');
        const selectedPropertyId = propertySelect.value;
        
        if (!selectedPropertyId) {
            alert('Please select a property to add');
            return;
        }
        
        if (this.selectedProperties.includes(selectedPropertyId)) {
            alert('Property is already assigned to this tenant');
            return;
        }
        
        this.selectedProperties.push(selectedPropertyId);
        this.updateSelectedPropertiesList();
        propertySelect.value = ''; // Reset selection
    }

    removePropertyFromTenant(propertyId) {
        this.selectedProperties = this.selectedProperties.filter(id => id !== propertyId);
        this.updateSelectedPropertiesList();
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
                isRegistered: formData.get('isRegistered') === 'on',
                isMainTenant: formData.get('isMainTenant') === 'on',
                properties: this.selectedProperties
            };

            // Validate required fields
            if (!tenantData.name || !tenantData.fin || !tenantData.passportNumber) {
                alert('Please fill in all required fields (Name, FIN, Passport Number)');
                return;
            }

            // Validate FIN format
            const finPattern = /^[STFG][0-9]{7}[A-Z]$/;
            if (!finPattern.test(tenantData.fin)) {
                alert('Invalid FIN format. Please use format: S1234567A');
                return;
            }

            // Validate passport length
            if (tenantData.passportNumber.length < 6 || tenantData.passportNumber.length > 15) {
                alert('Passport number must be between 6 and 15 characters');
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
                alert('Tenant added successfully!');
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

    async updateTenant(fin, tenantData) {
        try {
            const response = await API.put(API_CONFIG.ENDPOINTS.TENANT_BY_FIN(fin), tenantData);
            const result = await response.json();
            
            if (result.success) {
                alert('Tenant updated successfully!');
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
            const response = await API.delete(API_CONFIG.ENDPOINTS.TENANT_BY_FIN(fin));

            const result = await response.json();
            
            if (result.success) {
                alert('Tenant deleted successfully!');
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
            const response = await API.post(`/api/tenants/${encodeURIComponent(fin)}/assign-property`, { propertyId });

            const result = await response.json();
            
            if (result.success) {
                alert('Tenant assigned to property successfully!');
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

    // Public method to refresh the tenants list
    refresh() {
        this.loadTenants();
    }
}

// Export for use in other modules
window.TenantManagementComponent = TenantManagementComponent;