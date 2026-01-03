/**
 * Room Type Mapper Utility
 * Provides consistent room type display names and options across the application
 */

// Room type enum to display name mapping
export const ROOM_TYPE_MAP = {
  'COMMON1': 'Common 1',
  'COMMON2': 'Common 2',
  'MASTER': 'Master',
  'COMPARTMENT1': 'Compartment 1',
  'COMPARTMENT2': 'Compartment 2',
  'STORE': 'Store',
  'COMMON_1_PAX': 'Common 1 Pax',
  'COMMON_2_PAX': 'Common 2 Pax',
  'SMALL_SINGLE_1_PAX': 'Small Single 1 Pax',
  'SMALL_SINGLE_2_PAX': 'Small Single 2 Pax',
  'BIG_SINGLE_1_PAX': 'Big Single 1 Pax',
  'BIG_SINGLE_2_PAX': 'Big Single 2 Pax'
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
 * Generate room type select options HTML
 * @param {string} selectedValue - Currently selected room type value
 * @returns {string} HTML string for select options
 */
export function getRoomTypeOptions(selectedValue = '') {
  let options = '<option value="">Select room</option>';

  Object.entries(ROOM_TYPE_MAP).forEach(([value, label]) => {
    const selected = value === selectedValue ? ' selected' : '';
    options += `<option value="${value}"${selected}>${label}</option>`;
  });

  return options;
}
