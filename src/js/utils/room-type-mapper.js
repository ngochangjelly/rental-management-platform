/**
 * Room Type Mapper Utility
 * Provides consistent room type display names and options across the application
 */

// Room type enum to display name mapping
export const ROOM_TYPE_MAP = {
  COMMON1: "Common 1",
  COMMON2: "Common 2",
  MASTER: "Master",
  COMPARTMENT1: "Compartment 1",
  COMPARTMENT2: "Compartment 2",
  STORE: "Store",
  COMMON_1_PAX: "Common 1 Pax",
  COMMON_2_PAX: "Common 2 Pax",
  COMMON_3_PAX: "Common 3 Pax",
  SMALL_SINGLE_1_PAX: "Small Single 1 Pax",
  SMALL_SINGLE_2_PAX: "Small Single 2 Pax",
  BIG_SINGLE_1_PAX: "Big Single 1 Pax",
  BIG_SINGLE_2_PAX: "Big Single 2 Pax",
  SINGLE_1_PAX_NO_AIRCON: "Single 1 Pax No Aircon",
  SINGLE_2_PAX_NO_AIRCON: "Single 2 Pax No Aircon",
};

/**
 * Convert room type enum to human-readable display name
 * @param {string} roomType - The room type enum value
 * @returns {string} Human-readable room type name, or the original value if not found
 */
export function getRoomTypeDisplayName(roomType) {
  return ROOM_TYPE_MAP[roomType] || roomType;
}

/**
 * Room type color tokens.
 *
 * Design system approach: each "family" of room types (common, compartment,
 * master, single, store) owns a base hue on the color wheel, spaced far
 * enough apart to stay distinguishable. Individual room types within a
 * family (e.g. Common 1 vs Common 2) share that hue but nudge it by a small
 * fixed step, so they read as clearly related yet distinct - close on the
 * wheel rather than arbitrary colors.
 *
 * Adding a new room type to ROOM_TYPE_MAP does not require touching this
 * table: the family is inferred from the key name, and the variant step is
 * assigned automatically based on declaration order within that family.
 */
const ROOM_TYPE_FAMILY_HUES = {
  common: 206, // blue - standard shared rooms
  compartment: 165, // teal - compartment-style rooms
  master: 268, // violet - premium/master room
  single: 300, // rose/magenta - single-occupant rooms
  store: 30, // amber - storage/utility room
  other: 220, // neutral blue-gray - fallback for unrecognized types
};

const ROOM_TYPE_HUE_STEP = 9; // degrees between variants within the same family
const ROOM_TYPE_SATURATION = 58;
const ROOM_TYPE_LIGHTNESS = 42;

function getRoomTypeFamily(roomType) {
  if (!roomType) return "other";
  if (roomType.startsWith("COMMON")) return "common";
  if (roomType.startsWith("COMPARTMENT")) return "compartment";
  if (roomType === "MASTER") return "master";
  if (roomType === "STORE") return "store";
  if (roomType.includes("SINGLE")) return "single";
  return "other";
}

// Stable per-family variant index, derived once from ROOM_TYPE_MAP's
// declaration order (e.g. COMMON1 -> 0, COMMON2 -> 1, COMMON_1_PAX -> 2, ...)
const ROOM_TYPE_VARIANT_INDEX = (() => {
  const counters = {};
  const index = {};
  Object.keys(ROOM_TYPE_MAP).forEach((roomType) => {
    const family = getRoomTypeFamily(roomType);
    const variant = counters[family] || 0;
    index[roomType] = variant;
    counters[family] = variant + 1;
  });
  return index;
})();

/**
 * Get the design-token color for a room type: a family hue plus a small,
 * deterministic offset for its variant within that family.
 * @param {string} roomType - The room type enum value
 * @returns {{hue: number, saturation: number, lightness: number, family: string}}
 */
export function getRoomTypeColor(roomType) {
  const family = getRoomTypeFamily(roomType);
  const baseHue = ROOM_TYPE_FAMILY_HUES[family] ?? ROOM_TYPE_FAMILY_HUES.other;
  const variant = ROOM_TYPE_VARIANT_INDEX[roomType] ?? 0;
  const hue = (baseHue + variant * ROOM_TYPE_HUE_STEP) % 360;
  return {
    hue,
    saturation: ROOM_TYPE_SATURATION,
    lightness: ROOM_TYPE_LIGHTNESS,
    family,
  };
}

/**
 * Get an inline `style` value that colors a room type badge, ready to drop
 * into a `style="${...}"` attribute.
 * @param {string} roomType - The room type enum value
 * @returns {string} CSS declarations for background-color and text color
 */
export function getRoomTypeBadgeStyle(roomType) {
  const { hue, saturation, lightness } = getRoomTypeColor(roomType);
  return `background-color:hsl(${hue} ${saturation}% ${lightness}%);color:#fff;`;
}

/**
 * Generate room type select options HTML
 * @param {string} selectedValue - Currently selected room type value
 * @returns {string} HTML string for select options
 */
export function getRoomTypeOptions(selectedValue = "") {
  let options = '<option value="">Select room</option>';

  Object.entries(ROOM_TYPE_MAP).forEach(([value, label]) => {
    const selected = value === selectedValue ? " selected" : "";
    options += `<option value="${value}"${selected}>${label}</option>`;
  });

  return options;
}
