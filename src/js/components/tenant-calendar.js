import { getRoomTypeDisplayName } from '../utils/room-type-mapper.js';

/**
 * Tenant Timeline Calendar Component
 * Displays tenant move-in/move-out dates as a waterfall/timeline view
 */
class TenantCalendar {
    constructor() {
        this.currentYear = new Date().getFullYear();
        this.selectedProperty = null;
        this.tenants = [];
        this.currentView = 'table'; // 'table' or 'calendar'
    }

    /**
     * Initialize the calendar with tenant data for a specific property
     */
    loadTenants(propertyId, tenants) {
        this.selectedProperty = propertyId;
        this.tenants = tenants || [];

        // Always render when tenants are loaded
        this.render();
    }

    /**
     * Navigate to previous year
     */
    previousYear() {
        this.currentYear--;
        this.updateYearDisplay();
        this.render();
    }

    /**
     * Navigate to next year
     */
    nextYear() {
        this.currentYear++;
        this.updateYearDisplay();
        this.render();
    }

    /**
     * Update the year display
     */
    updateYearDisplay() {
        const yearDisplay = document.getElementById('calendarYearDisplay');
        if (yearDisplay) {
            yearDisplay.textContent = this.currentYear;
        }
    }

    /**
     * Main render function
     */
    render() {
        const container = document.getElementById('tenantCalendarContainer');
        if (!container) return;

        // Update year display
        this.updateYearDisplay();

        // Filter tenants for selected property
        const propertyTenants = this.getPropertyTenants();

        if (propertyTenants.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-calendar-x fs-1 d-block mb-3"></i>
                    <p class="fs-6">No tenant occupancy data for this property in ${this.currentYear}</p>
                </div>
            `;
            return;
        }

        // Generate calendar HTML
        container.innerHTML = this.generateCalendarHTML(propertyTenants);
    }

    /**
     * Get tenants for the selected property with occupancy in current year
     */
    getPropertyTenants() {
        if (!this.tenants || this.tenants.length === 0) return [];

        const yearStart = new Date(this.currentYear, 0, 1);
        const yearEnd = new Date(this.currentYear, 11, 31, 23, 59, 59);

        return this.tenants
            .map(tenant => {
                // Find the property assignment for the selected property
                const propertyAssignment = tenant.properties?.find(
                    p => p.propertyId === this.selectedProperty
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

        let html = `
            <div class="tenant-timeline-calendar">
                <!-- Month Headers -->
                <div class="calendar-header">
                    <div class="tenant-name-column">Tenant</div>
                    <div class="timeline-container">
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
        const moveoutStr = moveoutDate ? formatDate(moveoutDate) : 'Present';
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
                <div class="moveout-date-marker" title="Move-out: ${moveoutStr}">
                    <i class="bi bi-box-arrow-right"></i>
                    <span class="moveout-date-text">${this.escapeHtml(shortMoveoutStr)}</span>
                </div>
            `;
        }

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
                        title="${displayName}\n${moveinStr} - ${moveoutStr}\nDuration: ${duration} days">
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

// Initialize the calendar component
const tenantCalendar = new TenantCalendar();

// Make it available globally
window.tenantCalendar = tenantCalendar;
