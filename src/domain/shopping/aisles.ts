import { AISLES, type CookbookClient } from '../../api/index.js';
import { normalizeName } from './names.js';

export function aisleFor(name: string, products: Map<string, string>): string {
  const remembered = products.get(name.toLowerCase()) ?? products.get(normalizeName(name));
  if (remembered) return remembered;
  return KEYWORD_AISLES.find(([pattern]) => pattern.test(name))?.[1] ?? AISLES.Uncategorized;
}

/** Item name to aisle id from the app's remembered products; keys are lowercase and normalized. */
export async function aisleMemory(client: CookbookClient) {
  const memory = new Map<string, string>();
  for (const p of await client.products.list()) {
    memory.set(p.item.toLowerCase(), p.aisle);
    memory.set(normalizeName(p.item), p.aisle);
  }
  return memory;
}

// first match wins, so specific phrases (tomato paste, beef broth) come before broad ones (tomato, beef)
const KEYWORD_AISLES: [RegExp, string][] = [
  [
    /\b(canned|can of|tomato paste|tomato sauce|diced tomato|crushed tomato|fire-roasted|broth|stock|coconut milk)/i,
    'd9229f',
  ],
  [
    /\b(cumin|paprika|oregano|cayenne|cinnamon|nutmeg|chili powder|thyme|rosemary|seasoning|spice|red pepper flakes|garlic powder|onion powder|bay leaf)/i,
    'a17057',
  ],
  [/\b(sauce|ketchup|mustard|mayo|vinegar|dressing|salsa|soy|oil)\b/i, '080f86'],
  [
    /\b(milk|cheese|cheddar|mozzarella|parmesan|feta|butter|yogurt|yoghurt|cream|egg|cottage)/i,
    '96fb60',
  ],
  [
    /\b(chicken|beef|pork|turkey|sausage|bacon|salmon|shrimp|fish|steak|lamb|ham|tilapia)/i,
    '5d9050',
  ],
  [
    /\b(apple|banana|lemon|lime|orange|onion|garlic|potato|tomato|lettuce|spinach|carrot|bell pepper|jalapeno|chile|cilantro|parsley|avocado|zucchini|squash|celery|mushroom|broccoli|berr|grape|cucumber|ginger|basil)/i,
    '45cee2',
  ],
  [/\b(bread|bun|tortilla|bagel|roll|pita|croissant)/i, 'e7c563'],
  [/\b(frozen|ice cream|ice)\b/i, '5b11e9'],
  [/\b(pasta|rice|noodle|bean|lentil|quinoa|oat|couscous|gnocchi)/i, 'de2a8b'],
  [/\b(flour|sugar|baking|vanilla|yeast|cocoa|chocolate chip|cornstarch|honey|syrup)/i, 'b5df46'],
  [/\b(juice|soda|wine|beer|coffee|tea|water)\b/i, 'a25d15'],
  [/\b(paper towel|soap|detergent|foil|trash bag|sponge|wrap)/i, 'a91c3b'],
];
