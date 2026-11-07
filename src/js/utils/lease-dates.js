/**
 * Date helpers for tenancy periods. Dates are "YYYY-MM-DD" strings, worked
 * out in UTC so a timezone can never move them by a day.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" for a stored date (ISO string or Date); "" when missing. */
export function toISODate(value) {
  if (!value) return "";
  if (typeof value === "string" && ISO_DATE.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Today's date on this device, as "YYYY-MM-DD". */
export function todayISO() {
  const now = new Date();
  return formatParts(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from `fromIso` to `toIso` (negative when `toIso` is earlier). */
export function daysBetween(fromIso, toIso) {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86400000);
}

/** `iso` moved by `days` (can be negative). */
export function addDays(iso, days) {
  const date = new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000);
  return date.toISOString().slice(0, 10);
}

function parseParts(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: m - 1, d };
}

function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function formatParts(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Move-out date after extending a tenancy that ends on `currentEnd` by
 * `months`, keeping the day of the month the tenancy runs to:
 * - 15th → 14th tenancies keep ending on the 14th (14 Dec + 6 = 14 Jun)
 * - month-end tenancies stay at month end (28 Feb + 1 = 31 Mar)
 * - an end date cut short by February is restored from the move-in day
 *   (moved in 31 Aug, ends 28 Feb: + 1 = 31 Mar)
 * Without a move-in date it keeps the end day, capped to the month length.
 */
export function extendLeaseEnd(currentEnd, months, moveIn = "") {
  const end = parseParts(currentEnd);
  const endIsMonthEnd = end.d === daysInMonth(end.y, end.m);
  let anchorDay = end.d;
  let monthEnd = false;

  const inDay = moveIn && ISO_DATE.test(moveIn) ? parseParts(moveIn).d : 0;
  if (inDay === 1 && endIsMonthEnd) {
    // Moved in on the 1st, runs to the last day of the month
    monthEnd = true;
  } else if (inDay && (end.d === inDay || (endIsMonthEnd && inDay > end.d))) {
    // Ends on the move-in day, or did until a short month cut it short
    anchorDay = inDay;
  } else if (inDay && end.d === inDay - 1) {
    // Ends the day before the move-in day each month
    anchorDay = inDay - 1;
  } else if (endIsMonthEnd) {
    monthEnd = true;
  }

  const total = end.m + Number(months);
  const y = end.y + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const length = daysInMonth(y, m);
  return formatParts(y, m, monthEnd ? length : Math.min(anchorDay, length));
}
