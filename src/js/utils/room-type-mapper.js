/**
 * Room Type Mapper Utility
 * Provides consistent room type display names and options across the application
 */

// Every room type is either MASTER (singular) or a numbered member of one of
// these families, e.g. COMMON_3, BIG_SINGLE_2. The number is open-ended -
// the UI lets users add more of a family beyond the defaults below.
export const ROOM_FAMILY_LABELS = {
  COMMON: "Common",
  BIG_SINGLE: "Big Single",
  SMALL_SINGLE: "Small Single",
  STORE: "Store",
};

const ROOM_TYPE_PATTERN = /^(COMMON|BIG_SINGLE|SMALL_SINGLE|STORE)_(\d+)$/;

/**
 * Parse a room type key into its family and number.
 * @param {string} roomType
 * @returns {{family: string|null, number: number|null}}
 */
export function parseRoomType(roomType) {
  if (roomType === "MASTER") return { family: "MASTER", number: null };
  const match = ROOM_TYPE_PATTERN.exec(roomType || "");
  if (match) return { family: match[1], number: parseInt(match[2], 10) };
  return { family: null, number: null };
}

// The base set of rooms shown in the picker before the user adds more.
export const DEFAULT_ROOM_TYPES = [
  "MASTER",
  "COMMON_1",
  "COMMON_2",
  "BIG_SINGLE_1",
  "SMALL_SINGLE_1",
  "STORE_1",
];

/**
 * Convert room type enum to human-readable display name. Works for any
 * family/number combination, not just the defaults above.
 * @param {string} roomType - The room type enum value
 * @returns {string} Human-readable room type name, or the original value if not found
 */
export function getRoomTypeDisplayName(roomType) {
  const { family, number } = parseRoomType(roomType);
  if (family === "MASTER") return "Master";
  if (family && ROOM_FAMILY_LABELS[family]) return `${ROOM_FAMILY_LABELS[family]} ${number}`;
  return roomType;
}

// ROOM_TYPE_MAP mirrors DEFAULT_ROOM_TYPES as an ordered {value: label} map,
// kept for consumers that iterate Object.entries() (e.g. the room picker's
// initial population, getRoomTypeOptions below).
export const ROOM_TYPE_MAP = DEFAULT_ROOM_TYPES.reduce((map, roomType) => {
  map[roomType] = getRoomTypeDisplayName(roomType);
  return map;
}, {});

/**
 * Room type color tokens.
 *
 * Design system approach: each family owns a base hue on the color wheel,
 * spaced far enough apart to stay distinguishable. Numbered members of a
 * family share that hue but nudge it by a small fixed step per number, so
 * Common 1 vs Common 2 read as clearly related yet distinct.
 */
const ROOM_TYPE_FAMILY_HUES = {
  MASTER: 268, // violet - premium/master room
  COMMON: 206, // blue - standard shared rooms
  BIG_SINGLE: 300, // magenta - big single rooms
  SMALL_SINGLE: 330, // pink - small single rooms
  STORE: 30, // amber - storage/utility room
  OTHER: 220, // neutral blue-gray - fallback for unrecognized types
};

const ROOM_TYPE_HUE_STEP = 9; // degrees between variants within the same family
const ROOM_TYPE_SATURATION = 58;
const ROOM_TYPE_LIGHTNESS = 42;

/**
 * Get the design-token color for a room type: a family hue plus a small,
 * deterministic offset derived from its number within that family.
 * @param {string} roomType - The room type enum value
 * @returns {{hue: number, saturation: number, lightness: number, family: string}}
 */
export function getRoomTypeColor(roomType) {
  const { family, number } = parseRoomType(roomType);
  const familyKey = family || "OTHER";
  const baseHue = ROOM_TYPE_FAMILY_HUES[familyKey] ?? ROOM_TYPE_FAMILY_HUES.OTHER;
  const variant = number ? number - 1 : 0;
  const hue = (baseHue + variant * ROOM_TYPE_HUE_STEP) % 360;
  return {
    hue,
    saturation: ROOM_TYPE_SATURATION,
    lightness: ROOM_TYPE_LIGHTNESS,
    family: familyKey,
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
 * Compare two room types for sorting: by family order, then by number.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
const FAMILY_ORDER = ["MASTER", "COMMON", "BIG_SINGLE", "SMALL_SINGLE", "STORE"];
export function compareRoomTypes(a, b) {
  const pa = parseRoomType(a);
  const pb = parseRoomType(b);
  const orderDiff = FAMILY_ORDER.indexOf(pa.family) - FAMILY_ORDER.indexOf(pb.family);
  if (orderDiff !== 0) return orderDiff;
  return (pa.number || 0) - (pb.number || 0);
}

/**
 * Generate room type select options HTML. Always includes the default set;
 * if selectedValue is a valid but non-default room type (e.g. a property
 * with more Commons than the default), it's included too so it stays
 * selectable/visible.
 * @param {string} selectedValue - Currently selected room type value
 * @returns {string} HTML string for select options
 */
export function getRoomTypeOptions(selectedValue = "") {
  let options = '<option value="">Select room</option>';

  const values = [...DEFAULT_ROOM_TYPES];
  if (selectedValue && !values.includes(selectedValue) && parseRoomType(selectedValue).family) {
    values.push(selectedValue);
    values.sort(compareRoomTypes);
  }

  values.forEach((value) => {
    const selected = value === selectedValue ? " selected" : "";
    options += `<option value="${value}"${selected}>${getRoomTypeDisplayName(value)}</option>`;
  });

  return options;
}
