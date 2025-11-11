/**
 * YearCalendar Component
 * A beautiful, reusable year calendar component with Apple-like design
 * Shows a full year view with highlighted dates
 */

class YearCalendar {
  constructor(options = {}) {
    this.year = options.year || new Date().getFullYear();
    this.highlightedDates = options.highlightedDates || []; // Array of Date objects
    this.onDateClick = options.onDateClick || null;
    this.theme = options.theme || 'light';
    this.title = options.title || `${this.year} Calendar`;
  }

  /**
   * Generate the calendar HTML
   * @returns {string} HTML string
   */
  render() {
    const monthsHtml = this.generateMonthsGrid();

    return `
      <div class="year-calendar" data-year="${this.year}">
        <div class="year-calendar-header">
          <h3 class="year-calendar-title">${this.title}</h3>
          <div class="year-calendar-controls">
            <button class="year-calendar-btn prev-year" data-action="prev">
              <i class="bi bi-chevron-left"></i>
            </button>
            <span class="year-calendar-year">${this.year}</span>
            <button class="year-calendar-btn next-year" data-action="next">
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
        <div class="year-calendar-grid">
          ${monthsHtml}
        </div>
        ${this.generateLegend()}
      </div>
    `;
  }

  /**
   * Generate the grid of 12 months
   */
  generateMonthsGrid() {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return months.map((month, index) => {
      return this.generateMonthCard(index, month);
    }).join('');
  }

  /**
   * Generate a single month card
   */
  generateMonthCard(monthIndex, monthName) {
    const daysHtml = this.generateMonthDays(monthIndex);

    return `
      <div class="year-calendar-month">
        <div class="month-header">
          <span class="month-name">${monthName}</span>
        </div>
        <div class="month-weekdays">
          <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
        </div>
        <div class="month-days">
          ${daysHtml}
        </div>
      </div>
    `;
  }

  /**
   * Generate days for a specific month
   */
  generateMonthDays(monthIndex) {
    const firstDay = new Date(this.year, monthIndex, 1);
    const lastDay = new Date(this.year, monthIndex + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    let daysHtml = '';

    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      daysHtml += '<span class="day empty"></span>';
    }

    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(this.year, monthIndex, day);
      const isHighlighted = this.isDateHighlighted(currentDate);
      const isToday = this.isToday(currentDate);
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;

      const classes = ['day'];
      if (isHighlighted) classes.push('highlighted');
      if (isToday) classes.push('today');
      if (isWeekend) classes.push('weekend');

      const dateString = currentDate.toISOString().split('T')[0];

      daysHtml += `
        <span class="${classes.join(' ')}" data-date="${dateString}">
          ${day}
        </span>
      `;
    }

    return daysHtml;
  }

  /**
   * Check if a date should be highlighted
   */
  isDateHighlighted(date) {
    return this.highlightedDates.some(highlightedDate => {
      const hd = new Date(highlightedDate);
      return hd.getFullYear() === date.getFullYear() &&
             hd.getMonth() === date.getMonth() &&
             hd.getDate() === date.getDate();
    });
  }

  /**
   * Check if a date is today
   */
  isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  }

  /**
   * Generate legend
   */
  generateLegend() {
    return `
      <div class="year-calendar-legend">
        <div class="legend-item">
          <span class="legend-dot highlighted"></span>
          <span class="legend-text">Service Day</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot today"></span>
          <span class="legend-text">Today</span>
        </div>
      </div>
    `;
  }

  /**
   * Update highlighted dates and re-render
   */
  updateHighlightedDates(dates) {
    this.highlightedDates = dates;
  }

  /**
   * Change year
   */
  changeYear(year) {
    this.year = year;
  }

  /**
   * Get CSS styles for the calendar
   */
  static getStyles() {
    return `
      .year-calendar {
        background: #ffffff;
        border-radius: 20px;
        padding: 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }

      .year-calendar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 28px;
        padding-bottom: 20px;
        border-bottom: 1px solid #e5e5e7;
      }

      .year-calendar-title {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        color: #1d1d1f;
        letter-spacing: -0.5px;
      }

      .year-calendar-controls {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .year-calendar-btn {
        background: #f5f5f7;
        border: none;
        border-radius: 8px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        color: #1d1d1f;
      }

      .year-calendar-btn:hover {
        background: #e8e8ed;
        transform: scale(1.05);
      }

      .year-calendar-btn:active {
        transform: scale(0.95);
      }

      .year-calendar-year {
        font-size: 18px;
        font-weight: 500;
        color: #1d1d1f;
        min-width: 60px;
        text-align: center;
      }

      .year-calendar-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 20px;
        margin-bottom: 24px;
      }

      @media (min-width: 768px) {
        .year-calendar-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      @media (min-width: 1200px) {
        .year-calendar-grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }

      .year-calendar-month {
        background: #fafafa;
        border-radius: 12px;
        padding: 16px;
        transition: all 0.2s ease;
      }

      .year-calendar-month:hover {
        background: #f5f5f7;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }

      .month-header {
        margin-bottom: 12px;
      }

      .month-name {
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
        letter-spacing: -0.2px;
      }

      .month-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        margin-bottom: 8px;
      }

      .month-weekdays span {
        text-align: center;
        font-size: 11px;
        font-weight: 500;
        color: #86868b;
        padding: 4px 0;
      }

      .month-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }

      .day {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 400;
        color: #1d1d1f;
        border-radius: 6px;
        cursor: default;
        transition: all 0.15s ease;
        position: relative;
      }

      .day.empty {
        visibility: hidden;
      }

      .day:not(.empty):hover {
        background: #e8e8ed;
      }

      .day.weekend {
        color: #86868b;
      }

      .day.today {
        background: #007aff;
        color: white;
        font-weight: 600;
      }

      .day.today:hover {
        background: #0051d5;
      }

      .day.highlighted {
        background: linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%);
        color: white;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
      }

      .day.highlighted:hover {
        background: linear-gradient(135deg, #ff3b30 0%, #ff5252 100%);
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(255, 59, 48, 0.4);
      }

      .day.highlighted.today {
        background: linear-gradient(135deg, #007aff 0%, #0051d5 100%);
        box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
      }

      .year-calendar-legend {
        display: flex;
        justify-content: center;
        gap: 24px;
        padding-top: 20px;
        border-top: 1px solid #e5e5e7;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .legend-dot {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        display: inline-block;
      }

      .legend-dot.highlighted {
        background: linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%);
      }

      .legend-dot.today {
        background: #007aff;
      }

      .legend-text {
        font-size: 13px;
        color: #86868b;
        font-weight: 500;
      }

      /* Animation for calendar entrance */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .year-calendar-month {
        animation: fadeInUp 0.3s ease forwards;
      }

      .year-calendar-month:nth-child(1) { animation-delay: 0.05s; }
      .year-calendar-month:nth-child(2) { animation-delay: 0.1s; }
      .year-calendar-month:nth-child(3) { animation-delay: 0.15s; }
      .year-calendar-month:nth-child(4) { animation-delay: 0.2s; }
      .year-calendar-month:nth-child(5) { animation-delay: 0.25s; }
      .year-calendar-month:nth-child(6) { animation-delay: 0.3s; }
      .year-calendar-month:nth-child(7) { animation-delay: 0.35s; }
      .year-calendar-month:nth-child(8) { animation-delay: 0.4s; }
      .year-calendar-month:nth-child(9) { animation-delay: 0.45s; }
      .year-calendar-month:nth-child(10) { animation-delay: 0.5s; }
      .year-calendar-month:nth-child(11) { animation-delay: 0.55s; }
      .year-calendar-month:nth-child(12) { animation-delay: 0.6s; }
    `;
  }

  /**
   * Initialize calendar event listeners
   */
  static initEventListeners(containerElement, calendar) {
    // Year navigation
    const prevBtn = containerElement.querySelector('.prev-year');
    const nextBtn = containerElement.querySelector('.next-year');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        calendar.changeYear(calendar.year - 1);
        containerElement.innerHTML = calendar.render();
        YearCalendar.initEventListeners(containerElement, calendar);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        calendar.changeYear(calendar.year + 1);
        containerElement.innerHTML = calendar.render();
        YearCalendar.initEventListeners(containerElement, calendar);
      });
    }

    // Date clicks
    if (calendar.onDateClick) {
      const dayElements = containerElement.querySelectorAll('.day:not(.empty)');
      dayElements.forEach(dayEl => {
        dayEl.addEventListener('click', () => {
          const dateString = dayEl.getAttribute('data-date');
          if (dateString) {
            calendar.onDateClick(new Date(dateString));
          }
        });
      });
    }
  }

  /**
   * Inject styles into the document
   */
  static injectStyles() {
    if (!document.getElementById('year-calendar-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'year-calendar-styles';
      styleEl.textContent = YearCalendar.getStyles();
      document.head.appendChild(styleEl);
    }
  }
}

/**
 * Calculate recurring dates (e.g., every 3 months)
 * @param {Date} startDate - The starting date
 * @param {number} intervalMonths - Interval in months
 * @param {number} occurrences - Number of occurrences (default: 4 for quarterly)
 * @returns {Array<Date>} Array of dates
 */
function calculateRecurringDates(startDate, intervalMonths = 3, occurrences = 4) {
  const dates = [];
  const date = new Date(startDate);

  for (let i = 0; i < occurrences; i++) {
    dates.push(new Date(date));
    date.setMonth(date.getMonth() + intervalMonths);
  }

  return dates;
}

/**
 * Calculate all service dates for a given year
 * @param {Date} startDate - The initial service date
 * @param {number} year - The year to calculate for
 * @param {number} intervalMonths - Interval in months (default: 3)
 * @returns {Array<Date>} Array of service dates in the specified year
 */
function getServiceDatesForYear(startDate, year, intervalMonths = 3) {
  const dates = [];
  const start = new Date(startDate);

  // Start from the beginning of the year or the start date, whichever is later
  const yearStart = new Date(year, 0, 1);
  let currentDate = new Date(start);

  // If start date is after the year we're looking at, calculate backwards
  if (start.getFullYear() > year) {
    while (currentDate.getFullYear() > year) {
      currentDate.setMonth(currentDate.getMonth() - intervalMonths);
    }
    // Move forward to get into the target year
    while (currentDate.getFullYear() < year) {
      currentDate.setMonth(currentDate.getMonth() + intervalMonths);
    }
  }
  // If start date is before the year, calculate forwards
  else if (start.getFullYear() < year) {
    while (currentDate.getFullYear() < year) {
      currentDate.setMonth(currentDate.getMonth() + intervalMonths);
    }
  }

  // Collect all dates within the target year
  while (currentDate.getFullYear() === year) {
    dates.push(new Date(currentDate));
    currentDate.setMonth(currentDate.getMonth() + intervalMonths);
  }

  return dates;
}

// Export for use in other modules
window.YearCalendar = YearCalendar;
window.calculateRecurringDates = calculateRecurringDates;
window.getServiceDatesForYear = getServiceDatesForYear;
