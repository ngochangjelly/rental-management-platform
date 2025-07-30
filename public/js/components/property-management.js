/**
 * Property Management Component
 * Handles property CRUD operations
 */
class PropertyManagementComponent {
    constructor() {
        this.properties = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadProperties();
    }

    setupEventListeners() {
        // Add property button
        const addPropertyBtn = document.getElementById('addPropertyBtn');
        if (addPropertyBtn) {
            addPropertyBtn.addEventListener('click', () => {
                this.showAddPropertyModal();
            });
        }

        // Search functionality
        const searchInput = document.getElementById('propertySearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterProperties(e.target.value);
            });
        }
    }

    async loadProperties() {
        try {
            const response = await fetch('/api/properties');
            const result = await response.json();
            
            if (result.success) {
                this.properties = result.properties;
                this.renderPropertiesTable();
            } else {
                console.error('Failed to load properties:', result.error);
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Error loading properties:', error);
            this.showEmptyState('Error loading properties. Please try again.');
        }
    }

    renderPropertiesTable() {
        const tbody = document.getElementById('propertiesTableBody');
        if (!tbody) return;
        
        if (this.properties.length === 0) {
            this.showEmptyState();
            return;
        }

        let html = '';
        this.properties.forEach(property => {
            html += `
                <tr>
                    <td>${this.escapeHtml(property.propertyId)}</td>
                    <td>${this.escapeHtml(property.address)}</td>
                    <td>${this.escapeHtml(property.unit)}</td>
                    <td>${property.maxPax}</td>
                    <td>$${(property.rent || 0).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="propertyManager.editProperty('${property.propertyId}')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="propertyManager.deleteProperty('${property.propertyId}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }

    showEmptyState(message = 'No properties found') {
        const tbody = document.getElementById('propertiesTableBody');
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

    filterProperties(searchTerm) {
        if (!searchTerm.trim()) {
            this.renderPropertiesTable();
            return;
        }

        const filteredProperties = this.properties.filter(property => 
            property.propertyId.toLowerCase().includes(searchTerm.toLowerCase()) ||
            property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
            property.unit.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const tbody = document.getElementById('propertiesTableBody');
        if (!tbody) return;

        if (filteredProperties.length === 0) {
            this.showEmptyState(`No properties match "${searchTerm}"`);
            return;
        }

        let html = '';
        filteredProperties.forEach(property => {
            html += `
                <tr>
                    <td>${this.escapeHtml(property.propertyId)}</td>
                    <td>${this.escapeHtml(property.address)}</td>
                    <td>${this.escapeHtml(property.unit)}</td>
                    <td>${property.maxPax}</td>
                    <td>$${(property.rent || 0).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="propertyManager.editProperty('${property.propertyId}')">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="propertyManager.deleteProperty('${property.propertyId}')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }

    showAddPropertyModal() {
        // For now, show a simple prompt - in a real app, you'd show a proper modal
        const propertyData = this.getPropertyDataFromUser();
        if (propertyData) {
            this.addProperty(propertyData);
        }
    }

    getPropertyDataFromUser(existingProperty = null) {
        const propertyId = prompt('Property ID:', existingProperty?.propertyId || '');
        if (!propertyId) return null;

        const address = prompt('Address:', existingProperty?.address || '');
        if (!address) return null;

        const unit = prompt('Unit:', existingProperty?.unit || '');
        if (!unit) return null;

        const maxPax = parseInt(prompt('Max Occupants:', existingProperty?.maxPax || '1'));
        if (isNaN(maxPax) || maxPax < 1) return null;

        const rent = parseFloat(prompt('Monthly Rent:', existingProperty?.rent || '0'));
        if (isNaN(rent) || rent < 0) return null;

        return {
            propertyId,
            address,
            unit,
            maxPax,
            rent,
            agentName: existingProperty?.agentName || '',
            agentPhone: existingProperty?.agentPhone || '',
            landlordBankAccount: existingProperty?.landlordBankAccount || '',
            landlordBankName: existingProperty?.landlordBankName || '',
            landlordAccountName: existingProperty?.landlordAccountName || ''
        };
    }

    async addProperty(propertyData) {
        try {
            const response = await fetch('/api/properties', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(propertyData)
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Property added successfully!');
                await this.loadProperties(); // Reload the list
            } else {
                alert('Failed to add property: ' + result.error);
            }
        } catch (error) {
            console.error('Error adding property:', error);
            alert('Error adding property. Please try again.');
        }
    }

    async editProperty(propertyId) {
        // Find the property to edit
        const property = this.properties.find(p => p.propertyId === propertyId);
        if (!property) {
            alert('Property not found');
            return;
        }

        // Get updated data from user
        const updatedData = this.getPropertyDataFromUser(property);
        if (!updatedData) return;

        try {
            const response = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedData)
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Property updated successfully!');
                await this.loadProperties(); // Reload the list
            } else {
                alert('Failed to update property: ' + result.error);
            }
        } catch (error) {
            console.error('Error updating property:', error);
            alert('Error updating property. Please try again.');
        }
    }

    async deleteProperty(propertyId) {
        if (!confirm(`Are you sure you want to delete property ${propertyId}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            
            if (result.success) {
                alert('Property deleted successfully!');
                await this.loadProperties(); // Reload the list
            } else {
                alert('Failed to delete property: ' + result.error);
            }
        } catch (error) {
            console.error('Error deleting property:', error);
            alert('Error deleting property. Please try again.');
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

    // Public method to refresh the properties list
    refresh() {
        this.loadProperties();
    }
}

// Export for use in other modules
window.PropertyManagementComponent = PropertyManagementComponent;