// Stable / Unstable status of a property (Property.isStable on the backend).
// Shared by Property Management (toggle + list rows) and Financial Reports
// (on-screen header + exported image) so the label and colors stay in sync.

export const STABILITY_META = {
  stable: { label: 'Stable', color: '#198754', icon: 'bi-check-circle-fill' },
  unstable: { label: 'Unstable', color: '#6f42c1', icon: 'bi-activity' },
};

export function getStabilityMeta(isStable) {
  return isStable === true ? STABILITY_META.stable : STABILITY_META.unstable;
}

export function renderStabilityBadge(isStable, extraStyle = '') {
  const meta = getStabilityMeta(isStable);
  return `<span class="badge" style="background-color:${meta.color};color:#fff;${extraStyle}" title="${meta.label} property"><i class="bi ${meta.icon} me-1"></i>${meta.label}</span>`;
}

// Property selection cards shown at the top of each module (tenants, bills,
// financial reports, ...): the badge is overlaid on a corner of the card's
// image banner so it doesn't add a row to the card.
export function renderStabilityBannerBadge(property, position = 'top-0 start-0') {
  const badge = renderStabilityBadge(
    property?.isStable,
    'font-size:8px;box-shadow:0 1px 3px rgba(0,0,0,0.45);',
  );
  return `<div class="position-absolute ${position} p-1" style="z-index:3;line-height:1;">${badge}</div>`;
}

// Fallback for cards with no image banner: the badge goes in the card body.
export function renderStabilityCardBadge(property) {
  if (property?.propertyImage) return '';
  return renderStabilityBadge(property?.isStable, 'font-size:8px;');
}

// Total / Stable / Unstable count badges for a module's property-list header
// (Financial Reports, Bulk Property Reports). Counts every property passed in.
export function renderStabilityStatsBadges(properties, extraStyle = '') {
  const list = properties || [];
  if (!list.length) return '';
  const stable = list.filter((p) => p.isStable === true).length;
  const badge = ({ color, icon, label }, count) =>
    `<span class="badge" style="background-color:${color};color:#fff;font-size:0.7rem;${extraStyle}" title="${count} ${label.toLowerCase()} ${count === 1 ? 'property' : 'properties'}"><i class="bi ${icon} me-1"></i>${label}: ${count}</span>`;
  return (
    badge({ label: 'Total', color: '#6c757d', icon: 'bi-buildings' }, list.length) +
    badge(STABILITY_META.stable, stable) +
    badge(STABILITY_META.unstable, list.length - stable)
  );
}
