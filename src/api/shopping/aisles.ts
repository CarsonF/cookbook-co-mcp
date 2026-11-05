import * as R from 'remeda';

/** Aisle name to the app's aisle id. */
export const AISLES = {
  Baby: '9ae134',
  Beverages: 'a25d15',
  'Bread & Bakery': 'e7c563',
  Breakfast: '8e7f5b',
  'Dairy, Eggs & Fridge': '96fb60',
  Frozen: '5b11e9',
  'Fruits & Vegetables': '45cee2',
  'Health & Beauty': '3db2d0',
  Household: 'a91c3b',
  'Meat & Seafood': '5d9050',
  'Pantry - Baking & Cooking': 'b5df46',
  'Pantry - Canned Foods': 'd9229f',
  'Pantry - Condiments & Sauces': '080f86',
  'Pantry - Herbs & Spices': 'a17057',
  'Pantry - Pasta, Grains & Beans': 'de2a8b',
  'Pantry - Snacks': 'df1974',
  'Pantry - Others': '2501c3',
  Pets: '3a55e7',
  Uncategorized: '7d96ca',
} satisfies Record<string, string>;

/** Aisle id for a name such as "Dairy, Eggs & Fridge" (case-insensitive), or undefined. */
export function aisleId(name: string): string | undefined {
  const wanted = name.trim().toLowerCase();
  return Object.entries(AISLES).find(([n]) => n.toLowerCase() === wanted)?.[1];
}

/** Aisle name for an id, or undefined for an id the app does not know. */
export function aisleLabel(id: string): string | undefined {
  return AISLE_NAMES[id];
}

const AISLE_NAMES: Record<string, string> = R.invert(AISLES);
