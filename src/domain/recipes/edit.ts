import type { Ingredient, Instruction, Recipe, Tag } from '../../api/index.js';

export interface IngredientInput {
  quantity: number;
  measure: string;
  name: string;
  notes?: string;
  group?: string;
}

export function toIngredients(inputs: IngredientInput[]): Ingredient[] {
  return inputs.map((i, n) => ({
    id: n,
    quantity: i.quantity,
    measure: normalizeMeasure(i.measure),
    name: i.name,
    notes: i.notes ?? '',
    group: i.group ?? '',
  }));
}

/** Keeps a step's photo when the same text already existed. */
export function toInstructions(texts: string[], previous: Instruction[]): Instruction[] {
  const photos = new Map(previous.map((p) => [p.text, p.photo]));
  return texts.map((text, n) => ({ id: n, item: n, text, photo: photos.get(text) ?? '' }));
}

/** Plain-text rendering for before/after review, e.g. `2 tbsp olive oil (extra virgin)`. */
export function render(recipe: Recipe): string {
  const times = `prep ${recipe.preptime}m, cook ${recipe.cooktime}m`;
  const other = recipe.othertime ? `, ${recipe.othertimetype || 'other'} ${recipe.othertime}m` : '';
  const lines = [`Times: ${times}${other}`, 'Ingredients:'];
  let group: string | undefined;
  for (const i of recipe.ingredients) {
    if (i.group !== group) lines.push(`  [${i.group || 'no group'}]`);
    group = i.group;
    const qty = [i.quantity || '', i.measure === '.' ? '' : i.measure, i.name].filter(Boolean);
    lines.push(`  - ${qty.join(' ')}${i.notes ? ` (${i.notes})` : ''}`);
  }
  lines.push('Instructions:');
  let step = 0;
  for (const s of recipe.instructions) {
    const { header, body } = splitHeader(s.text);
    if (header) lines.push(`  ${header}`);
    if (body) lines.push(`  ${++step}. ${body}`);
  }
  return lines.join('\n');
}

/** Package sizes ("15 oz can corn") are labels, not quantities to convert up to pounds. */
export function isPackaged(name: string): boolean {
  return PACKAGE_WORD.test(name.trim());
}

/** Drinks use plain "oz" for fluid ounces; everything else uses it for weight. */
export function isDrink(recipe: Pick<Recipe, 'name' | 'category'>, tags: Tag[]): boolean {
  const names = tags.filter((t) => recipe.category.includes(t.id)).map((t) => t.name);
  return names.some((n) => DRINK_TAG.test(n)) || DRINK_NAME.test(recipe.name);
}

/** The unit as written, except that a drink's plain oz is a fluid ounce. */
export function unitFor(measure: string, drink: boolean): string {
  const unit = normalizeMeasure(measure);
  return drink && unit === 'oz' ? 'fl oz' : unit;
}

/**
 * Plain "oz" is weight; fluid ounces must say "fl oz" (outside drink recipes).
 * Flags liquid-looking ingredients written with plain oz, e.g. `32 oz vegetable broth`.
 */
export function ambiguousOunces(ingredients: Ingredient[]): string[] {
  return ingredients
    .filter(
      (i) =>
        normalizeMeasure(i.measure) === 'oz' && LIQUID.test(i.name) && !NOT_LIQUID.test(i.name),
    )
    .map((i) => `${i.quantity} oz ${i.name}`.trim());
}

//#region helpers
const PACKAGE_WORD =
  /^(cans?|jars?|cartons?|boxe?s?|bottles?|bags?|packets?|packages?|pkgs?|blocks?|tubs?|containers?)\b/i;
const DRINK_TAG = /^(drinks?|beverages?|cocktails?|smoothies?)$/i;
const DRINK_NAME =
  /\b(cocktails?|punch|lemonade|margaritas?|sangria|smoothies?|mojito|martini|spritz|mocktail|milkshake)\b/i;

const LIQUID =
  /\b(broth|stock|milk|cream|juice|water|wine|beer|oil|vinegar|syrup|extract|rum|vodka|liqueur|coffee|tea|buttermilk|half.and.half|soda|marinade|dressing)\b/i;
const NOT_LIQUID = /\b(cream cheese|sour cream|condensed|evaporated)\b/i;

/**
 * A step may start with a section header line ending in a colon, e.g. `Almond-Raspberry:`;
 * the app stores it as `Header:\nstep text`, or alone when the step is only a header.
 */
export function splitHeader(text: string): { header?: string; body: string } {
  const withBody = /^([^\n]+:)[ \t]*\n([\s\S]*)$/.exec(text.trim());
  if (withBody) return { header: withBody[1], body: withBody[2].trim() };
  const alone = text.trim();
  return alone.endsWith(':') && !alone.includes('\n')
    ? { header: alone, body: '' }
    : { body: alone };
}

const MEASURES: Record<string, string> = {
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbs: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cups: 'cup',
  c: 'cup',
  ounce: 'oz',
  ounces: 'oz',
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  'fl oz': 'fl oz',
  'fl. oz': 'fl oz',
  'fl oz.': 'fl oz',
  'fl. oz.': 'fl oz',
  floz: 'fl oz',
  'fluid oz': 'fl oz',
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
};

export function normalizeMeasure(measure: string): string {
  const key = measure.trim().toLowerCase();
  // the app saves these placeholders as an empty unit
  if (['.', 'x', 'of'].includes(key)) return '';
  return (
    (Object.hasOwn(MEASURES, key) ? MEASURES[key] : undefined) ??
    (['tbsp', 'tsp', 'cup', 'oz', 'lb', 'fl oz'].includes(key) ? key : measure.trim())
  );
}
//#endregion
