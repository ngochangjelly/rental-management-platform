/**
 * Management Fee calculation
 *
 * Every investor pays a monthly management fee proportional to their ownership.
 * The fee is configured as the amount charged for 100% of one property, so an
 * investor holding 50% of A and 30% of B pays rate × (50 + 30) / 100.
 *
 * Pure functions (no DOM) so the table, exports and future reports all share
 * one source of truth.
 */

// ─── Months ──────────────────────────────────────────────────────────────────

/** "YYYY-MM" for a local date */
export function toMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Local start (inclusive) and end (exclusive) of a "YYYY-MM" month */
function monthBounds(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

export function formatMonthLabel(monthKey) {
  return monthBounds(monthKey).start.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

/** Month a stored rate applies from (stored as UTC midnight on the 1st) */
export function rateMonthKey(rate) {
  return new Date(rate.effectiveFrom).toISOString().slice(0, 7);
}

// ─── Calculation ─────────────────────────────────────────────────────────────

/**
 * Ownership percentage of one investor property for a month. Uses the latest
 * history entry that is active at any point in the month, so a change effective
 * mid-month already counts. Properties without history fall back to `percentage`.
 */
export function getPercentageForMonth(investorProperty, monthKey) {
  const history = investorProperty.history || [];
  if (history.length === 0) return Number(investorProperty.percentage) || 0;

  const { start, end } = monthBounds(monthKey);
  const active = history
    .filter((h) => {
      const from = new Date(h.effectiveFrom);
      const to = h.effectiveTo ? new Date(h.effectiveTo) : null;
      return from < end && (!to || to > start);
    })
    .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));

  return active.length > 0 ? Number(active[0].percentage) || 0 : 0;
}

/** Rate effective for a month: the newest rate whose month is on or before it */
export function resolveRateForMonth(rates, monthKey) {
  return (
    [...rates]
      .sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom))
      .find((r) => rateMonthKey(r) <= monthKey) || null
  );
}

/**
 * One row per investor with a share in the month, sorted by total share
 * ascending (ties by name).
 *
 * @param {object}   opts
 * @param {object[]} opts.investors
 * @param {object[]} opts.properties   Full property records (for address/archived)
 * @param {number}   opts.ratePer100   Fee for 100% of one property
 * @param {string}   opts.monthKey     "YYYY-MM"
 */
export function buildManagementFeeRows({ investors, properties, ratePer100, monthKey }) {
  const propertyById = new Map(properties.map((p) => [String(p.propertyId), p]));

  return investors
    .map((investor) => {
      const holdings = (investor.properties || [])
        .map((ip) => {
          const property = propertyById.get(String(ip.propertyId)) || null;
          const percentage = getPercentageForMonth(ip, monthKey);
          return {
            propertyId: ip.propertyId,
            property,
            percentage,
            fee: (ratePer100 * percentage) / 100,
          };
        })
        .filter((h) => h.percentage > 0 && !h.property?.isArchived)
        .sort((a, b) => a.percentage - b.percentage);

      const totalPercentage = holdings.reduce((sum, h) => sum + h.percentage, 0);
      return {
        investor,
        holdings,
        totalPercentage,
        totalFee: (ratePer100 * totalPercentage) / 100,
      };
    })
    .filter((row) => row.totalPercentage > 0)
    .sort(
      (a, b) =>
        a.totalPercentage - b.totalPercentage ||
        (a.investor.name || "").localeCompare(b.investor.name || "")
    );
}

/** Grand totals across rows */
export function summarizeFeeRows(rows) {
  return rows.reduce(
    (acc, r) => ({
      investors: acc.investors + 1,
      holdings: acc.holdings + r.holdings.length,
      totalPercentage: acc.totalPercentage + r.totalPercentage,
      totalFee: acc.totalFee + r.totalFee,
    }),
    { investors: 0, holdings: 0, totalPercentage: 0, totalFee: 0 }
  );
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export const formatMoney = (amount) =>
  `$${(Math.round(amount * 100) / 100).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Up to 2 decimals, no trailing zeros: 12.5%, 33.33%, 100%
export const formatPercent = (value) => `${Math.round(value * 100) / 100}%`;

/** "Address, Unit" for a holding, falling back to its property ID */
export const formatHoldingAddress = ({ property, propertyId }) =>
  property ? `${property.address || "Address N/A"}${property.unit ? `, ${property.unit}` : ""}` : String(propertyId);
