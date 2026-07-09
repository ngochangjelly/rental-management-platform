/**
 * Financial Category Map Utility
 * Optional income/expense categorization with emoji tags, used for
 * quick-select chips in the add/edit modal, grouped list display,
 * clipboard copy, and image export.
 *
 * Order below is the display/grouping priority — earlier entries render first.
 */

export const INCOME_CATEGORIES = [
  { value: "deposit", label: "Deposit", emoji: "🔑" },
  { value: "rent", label: "Rent", emoji: "💰" },
  { value: "topup_pub", label: "Topup PUB", emoji: "⚡" },
];

export const EXPENSE_CATEGORIES = [
  { value: "deposit", label: "Deposit", emoji: "🔑" },
  { value: "rent", label: "Rent", emoji: "🏠" },
  { value: "utility", label: "Utility (PUB & WiFi)", emoji: "💡" },
  { value: "management_fee", label: "Management Fee", emoji: "📋" },
  { value: "furnishing", label: "Furnishing", emoji: "🛋️" },
];

const OTHER_GROUP = { key: "__other__", label: "Other", emoji: "🗂️" };

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
 * priority order, with uncategorized/unrecognized items bucketed last as
 * "Other". Groups with no entries are omitted, and relative order within
 * each group matches the original array order.
 *
 * @param {Array} items
 * @param {"income"|"expense"} type
 * @returns {Array<{key:string,label:string,emoji:string,entries:Array<{item:object,index:number}>}>}
 */
export function groupItemsByCategory(items, type) {
  const categories = getCategoryList(type);
  const withIndex = items.map((item, index) => ({ item, index }));

  const groups = categories.map((cat) => ({
    key: cat.value,
    label: cat.label,
    emoji: cat.emoji,
    entries: withIndex.filter(({ item }) => item.category === cat.value),
  }));

  const otherEntries = withIndex.filter(
    ({ item }) => !categories.some((cat) => cat.value === item.category),
  );
  groups.push({ ...OTHER_GROUP, entries: otherEntries });

  return groups.filter((g) => g.entries.length > 0);
}
