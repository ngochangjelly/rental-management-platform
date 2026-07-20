/**
 * Financial Category Map Utility
 * Optional income/expense categorization with emoji tags, used for
 * quick-select chips in the add/edit modal, grouped list display,
 * clipboard copy, and image export.
 *
 * Order below is the display/grouping priority — earlier entries render first.
 */

export const INCOME_CATEGORIES = [
  { value: "deposit", label: "Deposit", emoji: "💵" },
  { value: "rent", label: "Rent", emoji: "💰" },
  { value: "topup_pub", label: "Topup PUB", emoji: "⚡" },
];

export const EXPENSE_CATEGORIES = [
  { value: "deposit", label: "Deposit", emoji: "💵" },
  { value: "rent", label: "Rent", emoji: "💰" },
  { value: "utility", label: "Utility (PUB & WiFi)", emoji: "⚡" },
  { value: "management_fee", label: "Management Fee", emoji: "👷‍♂️" },
  { value: "sales_fee", label: "Sales Fee", emoji: "🤝" },
  { value: "furnishing", label: "Furnishing", emoji: "🛏️" },
];

const OTHER_GROUP = { key: "__other__", label: "Other", emoji: "🗂️" };
const PENDING_GROUP = { key: "__pending__", label: "Pending", emoji: "⏳" };

/**
 * @param {"income"|"expense"} type
 */
export function getCategoryList(type) {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/**
 * @param {"income"|"expense"} type
 * @param {string} value
 * @returns {{value:string,label:string,emoji:string}|null}
 */
export function getCategoryMeta(type, value) {
  if (!value) return null;
  return getCategoryList(type).find((c) => c.value === value) || null;
}

export function getCategoryEmoji(type, value) {
  return getCategoryMeta(type, value)?.emoji || "";
}

export function getCategoryLabel(type, value) {
  return getCategoryMeta(type, value)?.label || "";
}

/**
 * Renders the quick-select emoji chip row for the add/edit modal.
 * Optional/deselectable: clicking the active chip again clears it
 * (handled by the caller's selectCategoryChip toggle logic).
 */
export function renderCategoryChipsHtml(type, selectedValue = "") {
  const typeClass = type === "income" ? "chip-income" : "chip-expense";
  return getCategoryList(type)
    .map((cat) => {
      const isActive = cat.value === selectedValue;
      return `<button type="button" class="category-chip ${typeClass}${isActive ? " active" : ""}" data-value="${cat.value}" onclick="window.financialReports.selectCategoryChip(this)">
        <span class="category-chip-emoji">${cat.emoji}</span><span class="category-chip-label">${cat.label}</span>
      </button>`;
    })
    .join("");
}

/**
 * Groups items (with their original array index preserved) by category
 * priority order, with uncategorized/unrecognized items bucketed as
 * "Other". Pending items are pulled out of their category groups entirely
 * and placed in a trailing "Pending" section of their own (still ordered
 * by category priority within that section), since they're unconfirmed
 * and shouldn't be mixed in with settled items. Groups with no entries are
 * omitted, and relative order within each group matches the original
 * array order.
 *
 * @param {Array} items
 * @param {"income"|"expense"} type
 * @returns {Array<{key:string,label:string,emoji:string,entries:Array<{item:object,index:number}>}>}
 */
/**
 * Stable-clusters entries so that items sharing the same cluster key (see
 * keyFn) sit next to each other, ordered by that key's first appearance in
 * the list. No visible sub-header — this only affects ordering within a
 * category.
 */
function clusterByPayee(entries, keyFn) {
  const firstSeenOrder = [];
  entries.forEach(({ item }) => {
    const key = keyFn(item);
    if (!firstSeenOrder.includes(key)) {
      firstSeenOrder.push(key);
    }
  });
  return entries
    .map((entry, originalIndex) => ({ entry, originalIndex }))
    .sort((a, b) => {
      const rankDiff =
        firstSeenOrder.indexOf(keyFn(a.entry.item)) -
        firstSeenOrder.indexOf(keyFn(b.entry.item));
      return rankDiff !== 0 ? rankDiff : a.originalIndex - b.originalIndex;
    })
    .map(({ entry }) => entry);
}

// Income has no single "person in charge" payer field — a payment can be
// split across multiple tenants (item.paidBy is an array) — so the cluster
// key normalizes that into one comparable string per item.
function paidByKey(item) {
  const paidBy = item.paidBy;
  if (!paidBy) return "";
  return Array.isArray(paidBy) ? [...paidBy].sort().join(",") : paidBy;
}

export function groupItemsByCategory(items, type) {
  const categories = getCategoryList(type);
  const withIndex = items.map((item, index) => ({ item, index }));

  // Income clusters by who actually paid (item.paidBy); expenses cluster by
  // the person in charge of that expense — there's no "paid by" equivalent
  // on the expense side.
  const clusterKeyFn =
    type === "income" ? paidByKey : (item) => item.personInCharge;
  const cluster = (entries) => clusterByPayee(entries, clusterKeyFn);

  const categoryRank = (item) => {
    const rank = categories.findIndex((cat) => cat.value === item.category);
    return rank === -1 ? categories.length : rank;
  };

  const regularEntries = withIndex.filter(({ item }) => !item.isPending);
  const pendingEntries = withIndex.filter(({ item }) => item.isPending);

  const groups = categories.map((cat) => ({
    key: cat.value,
    label: cat.label,
    emoji: cat.emoji,
    entries: cluster(
      regularEntries.filter(({ item }) => item.category === cat.value),
    ),
  }));

  const otherEntries = regularEntries.filter(
    ({ item }) => !categories.some((cat) => cat.value === item.category),
  );
  groups.push({ ...OTHER_GROUP, entries: cluster(otherEntries) });

  const pendingByCategoryRank = [...pendingEntries].sort(
    (a, b) => categoryRank(a.item) - categoryRank(b.item),
  );
  const pendingGrouped = categories
    .map((cat) =>
      cluster(
        pendingByCategoryRank.filter(({ item }) => item.category === cat.value),
      ),
    )
    .flat();
  const pendingOther = cluster(
    pendingByCategoryRank.filter(
      ({ item }) => !categories.some((cat) => cat.value === item.category),
    ),
  );
  groups.push({ ...PENDING_GROUP, entries: [...pendingGrouped, ...pendingOther] });

  return groups.filter((g) => g.entries.length > 0);
}
