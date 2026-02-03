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
                    isMainTenant: propertyAssignment.isMainTenant,
                    leavePlans: propertyAssignment.leavePlans || [],
                    propertyId: propertyAssignment.propertyId
                };
            })
            .filter(t => t !== null && t.room) // Filter out tenants without a room
            .sort((a, b) => new Date(a.moveinDate) - new Date(b.moveinDate));
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
        const today = new Date();
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        const todayMarkerHtml = todayPosition !== null ? `
            <div class="today-marker" style="left: ${todayPosition}%;" title="Today - ${todayFormatted}">
                <div class="today-marker-line"></div>
                <div class="today-marker-label">${todayFormatted}</div>
            </div>
        ` : '';

        let html = `
            <div class="tenant-timeline-calendar" style="position: relative;">
                ${todayMarkerHtml}
                <!-- Month Headers -->
                <div class="calendar-header">
                    <div class="tenant-name-column">Tenant</div>
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
        const today = new Date();
        const fortyDaysFromNow = new Date(today.getTime() + (40 * 24 * 60 * 60 * 1000));

        let barColor = '#667eea'; // Default blue
        let isFutureMoveout = false;
        if (!tenant.moveoutDate) {
            barColor = '#48bb78'; // Green for current tenants
        } else if (moveoutDate && moveoutDate < today) {
            barColor = '#a0aec0'; // Gray for past tenants
        } else if (moveoutDate && moveoutDate >= today && moveoutDate <= fortyDaysFromNow) {
            barColor = '#ef4444'; // Red for tenants moving out within 40 days (Sắp trả phòng)
            isFutureMoveout = true;
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

        // Generate leave plan intervals (yellow bars)
        let leavePlansHtml = '';
        let totalLeaveDays = 0;

        if (tenant.leavePlans && tenant.leavePlans.length > 0) {
            tenant.leavePlans.forEach(leavePlan => {
                const lpStart = new Date(leavePlan.startDate);
                const lpEnd = new Date(leavePlan.endDate);

                // Only show leave plans that overlap with current year
                if (lpEnd < yearStart || lpStart > yearEnd) return;

                // Clamp to current year
                const clampedStart = lpStart < yearStart ? yearStart : lpStart;
                const clampedEnd = lpEnd > yearEnd ? yearEnd : lpEnd;

                // Calculate position and width
                const lpDaysFromYearStart = Math.floor((clampedStart - yearStart) / (1000 * 60 * 60 * 24));
                const lpDuration = Math.ceil((clampedEnd - clampedStart) / (1000 * 60 * 60 * 24)) + 1;
                totalLeaveDays += lpDuration;

                const lpLeftPercent = (lpDaysFromYearStart / totalDaysInYear) * 100;
                const lpWidthPercent = (lpDuration / totalDaysInYear) * 100;

                const lpStartStr = formatDate(lpStart);
                const lpEndStr = formatDate(lpEnd);
                const reasonText = leavePlan.reason ? `\nReason: ${leavePlan.reason}` : '';

                leavePlansHtml += `
                    <div class="leave-plan-bar"
                        data-leave-plan-id="${leavePlan.id}"
                        style="left: ${lpLeftPercent}%; width: ${lpWidthPercent}%;"
                        title="Away/Holiday\n${lpStartStr} - ${lpEndStr}\n${lpDuration} days${reasonText}">
                    </div>
                `;
            });
        }

        // Add leave days badge if any
        const leaveDaysBadgeHtml = totalLeaveDays > 0 ? `
            <span class="leave-days-badge" title="Total leave days: ${totalLeaveDays}">
                <i class="bi bi-luggage"></i> ${totalLeaveDays}
            </span>
        ` : '';

        return `
            <div class="tenant-row">
                <div class="tenant-name-column">
                    <div class="tenant-info-wrapper">
                        ${avatarHtml}
                        <div class="tenant-info">
                            <div class="tenant-name-text">${this.escapeHtml(displayName)} ${leaveDaysBadgeHtml}</div>
                            <div class="tenant-room-text">${roomDisplayName}</div>
                        </div>
                        ${socialBadgesHtml ? `<div class="tenant-social-badges">${socialBadgesHtml}</div>` : ''}
                    </div>
                </div>
                <div class="timeline-container">
                    <div
                        class="occupancy-bar ${!tenant.moveoutDate ? 'current-tenant' : ''} ${isFutureMoveout ? 'future-moveout' : ''}"
                        style="left: ${leftPercent}%; width: ${widthPercent}%; background-color: ${barColor};"
                        title="${displayName}\n${moveinStr} - ${moveoutStr}\nDuration: ${duration} days">
                        <span class="occupancy-bar-label">${this.escapeHtml(displayName)}</span>
                        ${moveoutBadgeHtml}
                        ${leavePlansHtml}
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
