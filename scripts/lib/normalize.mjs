export const TARGET_ITEM_NAME = "Hot 'n Spicy McChicken";

export function normalizeItemName(value) {
  return value
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isTargetItemName(value) {
  const normalized = normalizeItemName(value);
  return normalized === 'hot n spicy mcchicken' || normalized.includes('hot n spicy mcchicken');
}
