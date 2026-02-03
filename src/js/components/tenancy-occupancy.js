import { getRoomTypeDisplayName, ROOM_TYPE_MAP } from '../utils/room-type-mapper.js';
import i18next from 'i18next';

/**
 * Tenancy Occupancy Component
 * Displays tenant occupancy timelines for ALL properties in separate sections
 */
class TenancyOccupancyComponent {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.properties = [];
        this.tenants = [];
        this.isLoading = false;
        // Filter state
        this.searchQuery = '';
        this.selectedRoom = '';
        this.activeOnly = false;
        this.init();
    }

    /**
     * Initialize the component
     */
    init() {
        // Bind navigation events
        this.bindEvents();
    }

    /**
     * Bind navigation events
     */
    bindEvents() {
        // Navigation buttons will be bound after render
    }

    /**
     * Navigate to previous year
     */
    previousYear() {
        this.currentYear--;
        this.updateYearDisplay();
        this.renderTimelines();
    }

    /**
     * Navigate to next year
     */
    nextYear() {
        this.currentYear++;
        this.updateYearDisplay();
        this.renderTimelines();
    }

    /**
     * Handle search input change
     */
    handleSearchChange(value) {
        this.searchQuery = value;
        // Debounce the search
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        this.searchTimeout = setTimeout(() => {
            this.loadData();
        }, 300);
    }

    /**
     * Handle room filter change
     */
    handleRoomChange(value) {
        this.selectedRoom = value;
        this.loadData();
    }

    /**
     * Handle active only toggle
     */
    handleActiveOnlyChange(checked) {
        this.activeOnly = checked;
        this.loadData();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.searchQuery = '';
        this.selectedRoom = '';
        this.activeOnly = false;
        // Update UI
        const searchInput = document.getElementById('tenancyOccupancySearch');
        const roomSelect = document.getElementById('tenancyOccupancyRoom');
        const activeCheckbox = document.getElementById('tenancyOccupancyActiveOnly');
        if (searchInput) searchInput.value = '';
        if (roomSelect) roomSelect.value = '';
        if (activeCheckbox) activeCheckbox.checked = false;
        this.loadData();
    }

    /**
     * Update the year display
     */
    updateYearDisplay() {
        const yearDisplay = document.getElementById('tenancyOccupancyYearDisplay');
        if (yearDisplay) {
            yearDisplay.textContent = this.currentYear;
        }
    }

    /**
     * Load all data (properties and tenants)
     */
    async loadData() {
        this.isLoading = true;
        this.renderLoadingState();

        try {
            // Build tenant query with filters
            let tenantQuery = `${API_CONFIG.ENDPOINTS.TENANTS}?limit=10000`;
            if (this.searchQuery) {
                tenantQuery += `&search=${encodeURIComponent(this.searchQuery)}`;
            }
            if (this.selectedRoom) {
                tenantQuery += `&room=${encodeURIComponent(this.selectedRoom)}`;
            }
            if (this.activeOnly) {
                tenantQuery += `&activeOnly=true`;
            }

            // Fetch properties and tenants in parallel
            const [propertiesResponse, tenantsResponse] = await Promise.all([
                API.get(API_CONFIG.ENDPOINTS.PROPERTIES),
                API.get(tenantQuery)
            ]);

            if (propertiesResponse.ok) {
                const result = await propertiesResponse.json();
                // API returns { success: true, properties: [...] }
                if (result.success && result.properties) {
                    this.properties = result.properties;
                } else if (Array.isArray(result.properties)) {
                    this.properties = result.properties;
                } else if (Array.isArray(result)) {
                    this.properties = result;
                } else {
                    this.properties = [];
                }
            } else {
                this.properties = [];
            }

            if (tenantsResponse.ok) {
                const result = await tenantsResponse.json();
                // API returns { success: true, tenants: [...] } or { data: [...] }
                if (result.success && result.tenants) {
                    this.tenants = result.tenants;
                } else if (result.data && Array.isArray(result.data)) {
                    this.tenants = result.data;
                } else if (Array.isArray(result.tenants)) {
                    this.tenants = result.tenants;
                } else if (Array.isArray(result)) {
                    this.tenants = result;
                } else {
                    this.tenants = [];
                }
            } else {
                this.tenants = [];
            }

            // Check investor restrictions
            const investorPropertyIds = await getInvestorPropertyIds();
            if (investorPropertyIds && Array.isArray(this.properties)) {
                // Filter properties for investor
                this.properties = this.properties.filter(p =>
                    investorPropertyIds.includes(p.propertyId)
                );
            }

            // Sort properties by propertyId
            if (Array.isArray(this.properties) && this.properties.length > 0) {
                this.properties.sort((a, b) => a.propertyId.localeCompare(b.propertyId));
            }

            this.isLoading = false;
            this.render();
        } catch (error) {
            console.error('Error loading tenancy occupancy data:', error);
            this.isLoading = false;
            this.renderError();
        }
    }

    /**
     * Render loading state
     */
    renderLoadingState() {
        const container = document.getElementById('tenancyOccupancyContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">${i18next.t('tenancyOccupancy.loading', 'Loading...')}</span>
                </div>
                <p class="mt-3 text-muted">${i18next.t('tenancyOccupancy.loadingData', 'Loading occupancy data...')}</p>
            </div>
        `;
    }

    /**
     * Render error state
     */
    renderError() {
        const container = document.getElementById('tenancyOccupancyContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center text-danger py-5">
                <i class="bi bi-exclamation-triangle fs-1 d-block mb-3"></i>
                <p class="fs-6">${i18next.t('tenancyOccupancy.error', 'Error loading occupancy data. Please try again.')}</p>
                <button class="btn btn-primary btn-sm" onclick="tenancyOccupancyComponent.loadData()">
                    <i class="bi bi-arrow-clockwise me-1"></i>${i18next.t('tenancyOccupancy.retry', 'Retry')}
                </button>
            </div>
        `;
    }

    /**
     * Main render function
     */
    render() {
        const container = document.getElementById('tenancyOccupancyContainer');
        if (!container) return;

        // Update year display
        this.updateYearDisplay();

        if (this.properties.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-building fs-1 d-block mb-3"></i>
                    <p class="fs-6">${i18next.t('tenancyOccupancy.noProperties', 'No properties found.')}</p>
                </div>
            `;
            return;
        }

        this.renderTimelines();
    }

    /**
     * Render all property timelines
     */
    renderTimelines() {
        const container = document.getElementById('tenancyOccupancyContainer');
        if (!container) return;

        let html = '';

        // Render a timeline section for each property
        this.properties.forEach((property, index) => {
            const propertyTenants = this.getPropertyTenants(property.propertyId);
            html += this.renderPropertySection(property, propertyTenants, index);
        });

        container.innerHTML = html;
    }

    /**
     * Get tenants for a specific property with occupancy in current year
     */
    getPropertyTenants(propertyId) {
        if (!this.tenants || this.tenants.length === 0) return [];

        const yearStart = new Date(this.currentYear, 0, 1);
        const yearEnd = new Date(this.currentYear, 11, 31, 23, 59, 59);

        return this.tenants
            .map(tenant => {
                // Find the property assignment for the selected property
                const propertyAssignment = tenant.properties?.find(
                    p => p.propertyId === propertyId
                );

                if (!propertyAssignment || !propertyAssignment.moveinDate) {
                    return null;
                }

                const moveinDate = new Date(propertyAssignment.moveinDate);
                const moveoutDate = propertyAssignment.moveoutDate
                    ? new Date(propertyAssignment.moveoutDate)
                    : null; // null means still residing

                // Check if occupancy overlaps with current year
                const occupancyStart = moveinDate;
                const occupancyEnd = moveoutDate || new Date(); // Use today if no moveout date

                // Skip if occupancy doesn't overlap with current year
                if (occupancyEnd < yearStart || occupancyStart > yearEnd) {
                    return null;
                }

                return {
                    ...tenant,
                    moveinDate: propertyAssignment.moveinDate,
                    moveoutDate: propertyAssignment.moveoutDate,
                    room: propertyAssignment.room,
                    isMainTenant: propertyAssignment.isMainTenant
                };
            })
            .filter(t => t !== null && t.room) // Filter out tenants without a room
            .sort((a, b) => new Date(a.moveinDate) - new Date(b.moveinDate));
    }

    /**
     * Render a single property section with its timeline
     */
    renderPropertySection(property, tenants, index) {
        const propertyLabel = property.unit
            ? `${property.propertyId} - ${property.unit}`
            : property.propertyId;

        const address = property.address || '';
        const tenantCount = tenants.length;
        const currentTenants = tenants.filter(t => !t.moveoutDate).length;

        // Determine badge color based on occupancy
        let badgeClass = 'bg-secondary';
        if (currentTenants > 0) {
            badgeClass = 'bg-success';
        }

        let timelineHtml = '';
        if (tenants.length === 0) {
            timelineHtml = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-calendar-x fs-3 d-block mb-2"></i>
                    <p class="small mb-0">${i18next.t('tenancyOccupancy.noTenants', 'No tenant occupancy data for {{year}}').replace('{{year}}', this.currentYear)}</p>
                </div>
            `;
        } else {
            timelineHtml = this.generateCalendarHTML(tenants);
        }

        return `
            <div class="card mb-4 property-timeline-card" data-property-id="${property.propertyId}">
                <div class="card-header d-flex justify-content-between align-items-center bg-light">
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-building text-primary"></i>
                        <div>
                            <h6 class="mb-0 fw-bold">${this.escapeHtml(propertyLabel)}</h6>
                            ${address ? `<small class="text-muted">${this.escapeHtml(address)}</small>` : ''}
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge ${badgeClass}" title="${i18next.t('tenancyOccupancy.currentTenants', 'Current tenants')}: ${currentTenants}">
                            <i class="bi bi-people-fill me-1"></i>${currentTenants} ${i18next.t('tenancyOccupancy.active', 'active')}
                        </span>
                        <span class="badge bg-secondary" title="${i18next.t('tenancyOccupancy.totalInYear', 'Total in {{year}}').replace('{{year}}', this.currentYear)}">
                            ${tenantCount} ${i18next.t('tenancyOccupancy.total', 'total')}
                        </span>
                    </div>
                </div>
                <div class="card-body p-3" style="overflow-x: auto">
                    ${timelineHtml}
                </div>
            </div>
        `;
    }

    /**
     * Calculate today marker position as percentage
     */
    getTodayMarkerPosition() {
        const today = new Date();
        const todayYear = today.getFullYear();

        // Only show marker if viewing current year
        if (todayYear !== this.currentYear) {
            return null;
        }

        const yearStart = new Date(this.currentYear, 0, 1);
        const yearEnd = new Date(this.currentYear, 11, 31);
        const totalDaysInYear = Math.ceil((yearEnd - yearStart) / (1000 * 60 * 60 * 24)) + 1;
        const daysFromYearStart = Math.floor((today - yearStart) / (1000 * 60 * 60 * 24));

        return (daysFromYearStart / totalDaysInYear) * 100;
    }

    /**
     * Generate the calendar HTML with timeline bars
     */
    generateCalendarHTML(tenants) {
        const months = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        // Calculate the number of days in each month for current year
        const daysInMonths = months.map((_, index) =>
            new Date(this.currentYear, index + 1, 0).getDate()
        );

        const totalDaysInYear = daysInMonths.reduce((sum, days) => sum + days, 0);

        // Calculate today marker position
        const todayPosition = this.getTodayMarkerPosition();
        const todayMarkerHtml = todayPosition !== null ? `
            <div class="today-marker" style="left: ${todayPosition}%;" title="${i18next.t('tenancyOccupancy.today', 'Today')}">
                <div class="today-marker-line"></div>
                <div class="today-marker-label">${i18next.t('tenancyOccupancy.today', 'Today')}</div>
            </div>
        ` : '';

        let html = `
            <div class="tenant-timeline-calendar" style="position: relative;">
                ${todayMarkerHtml}
                <!-- Month Headers -->
                <div class="calendar-header">
                    <div class="tenant-name-column">${i18next.t('tenancyOccupancy.tenant', 'Tenant')}</div>
                    <div class="timeline-container" style="position: relative;">
        `;

        // Render month headers
        daysInMonths.forEach((days, index) => {
            const widthPercent = (days / totalDaysInYear) * 100;
            html += `
                <div class="month-header" style="width: ${widthPercent}%;">
                    <span class="month-name">${months[index]}</span>
                    <span class="month-year">${this.currentYear}</span>
                </div>
            `;
        });

        html += `
                    </div>
                </div>

                <!-- Tenant Rows -->
                <div class="calendar-rows">
        `;

        // Render each tenant as a row
        tenants.forEach((tenant, index) => {
            html += this.generateTenantRow(tenant, index, totalDaysInYear, daysInMonths);
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Generate a single tenant row with occupancy bar
     */
    generateTenantRow(tenant, index, totalDaysInYear, daysInMonths) {
        const moveinDate = new Date(tenant.moveinDate);
        const moveoutDate = tenant.moveoutDate ? new Date(tenant.moveoutDate) : null;

        // Calculate bar position and width
        const yearStart = new Date(this.currentYear, 0, 1);
        const yearEnd = new Date(this.currentYear, 11, 31);

        // Clamp dates to current year
        const barStart = moveinDate < yearStart ? yearStart : moveinDate;
        const barEnd = moveoutDate && moveoutDate < yearEnd ? moveoutDate : yearEnd;

        // Calculate position from year start
        const daysFromYearStart = Math.floor((barStart - yearStart) / (1000 * 60 * 60 * 24));
        const barDuration = Math.ceil((barEnd - barStart) / (1000 * 60 * 60 * 24)) + 1;

        const leftPercent = (daysFromYearStart / totalDaysInYear) * 100;
        const widthPercent = (barDuration / totalDaysInYear) * 100;

        // Determine bar color based on status
        let barColor = '#667eea'; // Default blue
        if (!tenant.moveoutDate) {
            barColor = '#48bb78'; // Green for current tenants
        } else if (moveoutDate && moveoutDate < new Date()) {
            barColor = '#a0aec0'; // Gray for past tenants
        }

        // Format dates for tooltip
        const formatDate = (date) => {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        };

        const moveinStr = formatDate(moveinDate);
        const moveoutStr = moveoutDate ? formatDate(moveoutDate) : i18next.t('tenancyOccupancy.present', 'Present');
        const duration = moveoutDate
            ? Math.ceil((moveoutDate - moveinDate) / (1000 * 60 * 60 * 24))
            : Math.ceil((new Date() - moveinDate) / (1000 * 60 * 60 * 24));

        // Get display name for room type
        const roomDisplayName = tenant.room ? getRoomTypeDisplayName(tenant.room) : 'N/A';

        // Generate avatar HTML
        const displayName = tenant.nickname || tenant.name;
        let avatarHtml = '';
        if (tenant.avatar) {
            avatarHtml = `<img src="${this.escapeHtml(tenant.avatar)}" alt="${this.escapeHtml(displayName)}" class="tenant-avatar">`;
        } else {
            const initial = displayName.charAt(0).toUpperCase();
            avatarHtml = `<div class="tenant-avatar-placeholder">${this.escapeHtml(initial)}</div>`;
        }

        // Generate social media badges
        let socialBadgesHtml = '';
        if (tenant.facebookUrl) {
            socialBadgesHtml += `<a href="${this.escapeHtml(tenant.facebookUrl)}" target="_blank" rel="noopener noreferrer" class="social-badge facebook-badge" title="Facebook"><i class="bi bi-facebook"></i></a>`;
        }
        if (tenant.phoneNumber) {
            const cleanPhone = tenant.phoneNumber.replace(/[^0-9]/g, '');
            socialBadgesHtml += `<a href="https://wa.me/${cleanPhone}" target="_blank" rel="noopener noreferrer" class="social-badge whatsapp-badge" title="WhatsApp"><i class="bi bi-whatsapp"></i></a>`;
        }

        // Format move-out date for display (short format for badge)
        const formatShortDate = (date) => {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        };

        // Generate move-out date badge if tenant has moved out
        let moveoutBadgeHtml = '';
        if (tenant.moveoutDate && moveoutDate) {
            const shortMoveoutStr = formatShortDate(moveoutDate);
            moveoutBadgeHtml = `
                <div class="moveout-date-marker" title="${i18next.t('tenancyOccupancy.moveOut', 'Move-out')}: ${moveoutStr}">
                    <i class="bi bi-box-arrow-right"></i>
                    <span class="moveout-date-text">${this.escapeHtml(shortMoveoutStr)}</span>
                </div>
            `;
        }

        const durationText = i18next.t('tenancyOccupancy.duration', 'Duration');
        const daysText = i18next.t('tenancyOccupancy.days', 'days');

        return `
            <div class="tenant-row">
                <div class="tenant-name-column">
                    <div class="tenant-info-wrapper">
                        ${avatarHtml}
                        <div class="tenant-info">
                            <div class="tenant-name-text">${this.escapeHtml(displayName)}</div>
                            <div class="tenant-room-text">${roomDisplayName}</div>
                        </div>
                        ${socialBadgesHtml ? `<div class="tenant-social-badges">${socialBadgesHtml}</div>` : ''}
                    </div>
                </div>
                <div class="timeline-container">
                    <div
                        class="occupancy-bar ${!tenant.moveoutDate ? 'current-tenant' : ''}"
                        style="left: ${leftPercent}%; width: ${widthPercent}%; background-color: ${barColor};"
                        title="${displayName}\n${moveinStr} - ${moveoutStr}\n${durationText}: ${duration} ${daysText}">
                        <span class="occupancy-bar-label">${this.escapeHtml(displayName)}</span>
                        ${moveoutBadgeHtml}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the component
const tenancyOccupancyComponent = new TenancyOccupancyComponent();

// Make it available globally
window.tenancyOccupancyComponent = tenancyOccupancyComponent;
