/**
 * Tenant Management Component
 * Handles tenant CRUD operations
 */
class TenantManagementComponent {
    constructor() {
        this.tenants = [];
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
            const response = await fetch('/api/tenants');
            const result = await response.json();
            
            if (result.success) {
                this.tenants = result.tenants;
                this.renderTenantsTable();
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
        // For now, show a simple prompt - in a real app, you'd show a proper modal
        const tenantData = this.getTenantDataFromUser();
        if (tenantData) {
            this.addTenant(tenantData);
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
            const response = await fetch('/api/tenants', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tenantData)
            });

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

        // Get updated data from user
        const updatedData = this.getTenantDataFromUser(tenant);
        if (!updatedData) return;

        try {
            const response = await fetch(`/api/tenants/${encodeURIComponent(fin)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedData)
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Tenant updated successfully!');
                await this.loadTenants(); // Reload the list
            } else {
                alert('Failed to update tenant: ' + result.error);
            }
        } catch (error) {
            console.error('Error updating tenant:', error);
            alert('Error updating tenant. Please try again.');
        }
    }

    async deleteTenant(fin) {
        if (!confirm(`Are you sure you want to delete tenant ${fin}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/tenants/${encodeURIComponent(fin)}`, {
                method: 'DELETE'
            });

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
            const response = await fetch(`/api/tenants/${encodeURIComponent(fin)}/assign-property`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ propertyId })
            });

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