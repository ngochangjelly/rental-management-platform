/**
 * Property list filter engine.
 *
 * Each filter criterion is a small, self-contained descriptor: `isActive`
 * decides whether the criterion should be applied at all, `matches` decides
 * whether a given property passes it. `applyPropertyFilters` only ever
 * iterates this list, so adding a new filter criterion later (e.g. property
 * type, move-out window) means adding one entry to
 * PROPERTY_FILTER_DEFINITIONS - nothing else in this file, or in the
 * component that uses it, needs to change (open/closed).
 *
 * This module is pure/DOM-free on purpose so the filtering logic can be
 * reasoned about (and unit tested) independently of rendering.
 */

export const PROPERTY_FILTERS_STORAGE_KEY = "pm_property_filters_v1";

export function createDefaultPropertyFilters() {
  return {
    investorIds: [],
  };
}

function investorOwnsProperty(investor, propertyId) {
  return (
    Array.isArray(investor.properties) &&
    investor.properties.some((pr) => pr.propertyId === propertyId)
  );
}

/**
 * `context` carries data the predicates need but that isn't part of the
 * filter state itself (e.g. the investor roster, to resolve which
 * properties an investorId owns).
 */
export const PROPERTY_FILTER_DEFINITIONS = [
  {
    key: "investorIds",
    label: "Investor",
    isActive: (filters) => Array.isArray(filters.investorIds) && filters.investorIds.length > 0,
    matches: (property, filters, context) => {
      const selected = new Set(filters.investorIds);
      return (context.allInvestors || []).some(
        (investor) => selected.has(investor.investorId) && investorOwnsProperty(investor, property.propertyId)
      );
    },
  },
];

export function getActivePropertyFilterDefinitions(filters) {
  return PROPERTY_FILTER_DEFINITIONS.filter((def) => def.isActive(filters));
}

/** Number of distinct filter criteria currently applied (not the number of values picked within them). */
export function getActivePropertyFilterCount(filters) {
  return getActivePropertyFilterDefinitions(filters).length;
}

export function applyPropertyFilters(properties, filters, context = {}) {
  const activeDefs = getActivePropertyFilterDefinitions(filters);
  if (activeDefs.length === 0) return properties;
  return properties.filter((property) => activeDefs.every((def) => def.matches(property, filters, context)));
}

export function loadPropertyFilters() {
  const defaults = createDefaultPropertyFilters();
  try {
    const raw = localStorage.getItem(PROPERTY_FILTERS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      investorIds: Array.isArray(parsed.investorIds) ? parsed.investorIds : defaults.investorIds,
    };
  } catch {
    return defaults;
  }
}

export function savePropertyFilters(filters) {
  try {
    localStorage.setItem(PROPERTY_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* quota exceeded or unavailable - filters just won't persist */
  }
}
