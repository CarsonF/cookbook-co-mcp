import type { Recipe } from '../../api/index.js';
import { ambiguousOunces, isPackaged, unitFor } from './edit.js';

export interface ScaledIngredient {
  name: string;
  original: string;
  scaled: string;
  quantity: number;
  measure: string;
  notes: string;
  group: string;
}

export interface Scaled {
  factor: number;
  fromServings: number;
  toServings: number;
  ingredients: ScaledIngredient[];
  warnings: string[];
}

/** Scales ingredient amounts by `factor`; e.g. 2 tbsp at x2 becomes `1/4 cup` with step-up. */
export function scaleRecipe(
  recipe: Recipe,
  factor: number,
  stepUp: boolean,
  drink = false,
): Scaled {
  const ingredients = recipe.ingredients.map((i) => {
    const measure = unitFor(i.measure, drink);
    const fixed = !i.quantity;
    // "15 oz can corn": the 15 oz is the can's size, so scaling changes the number of cans
    if (!fixed && measure && isPackaged(i.name)) {
      const size = describe(i.quantity, measure);
      return {
        name: i.name,
        original: size,
        scaled: factor === 1 ? size : `${amount(factor)} × ${size}`,
        quantity: i.quantity,
        measure,
        notes: i.notes,
        group: i.group,
      };
    }
    const scaled = fixed
      ? { quantity: i.quantity, measure }
      : convert(i.quantity * factor, measure, stepUp);
    return {
      name: i.name,
      original: describe(i.quantity, measure),
      scaled: fixed ? describe(i.quantity, measure) : describe(scaled.quantity, scaled.measure),
      quantity: scaled.quantity,
      measure: scaled.measure,
      notes: i.notes,
      group: i.group,
    };
  });
  return {
    factor,
    fromServings: recipe.serving,
    toServings: recipe.serving * factor,
    ingredients,
    warnings: [...stepWarnings(recipe), ...(drink ? [] : ounceWarnings(recipe))],
  };
}

//#region helpers
const TSP_PER: Record<string, number> = { tsp: 1, tbsp: 3, 'fl oz': 6, cup: 48 };
const OZ_PER: Record<string, number> = { oz: 1, lb: 16 };
const FRACTIONS: [number, string][] = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''],
];

export function convert(quantity: number, measure: string, stepUp: boolean) {
  if (!stepUp) return { quantity, measure };
  if (Object.hasOwn(TSP_PER, measure)) {
    const tsp = quantity * TSP_PER[measure];
    // cup from a quarter cup, tbsp from one tbsp, otherwise teaspoons
    if (tsp >= 12) return { quantity: tsp / 48, measure: 'cup' };
    if (tsp >= 3) return { quantity: tsp / 3, measure: 'tbsp' };
    return { quantity: tsp, measure: 'tsp' };
  }
  if (Object.hasOwn(OZ_PER, measure)) {
    const oz = quantity * OZ_PER[measure];
    return oz >= 16 ? { quantity: oz / 16, measure: 'lb' } : { quantity: oz, measure: 'oz' };
  }
  return { quantity, measure };
}

/** Cooking-friendly amount: `1 1/2`, `⅔`, or a decimal below an eighth. */
function describe(quantity: number, measure: string): string {
  if (!quantity) return measure;
  return `${amount(quantity)} ${measure}`.trim();
}

export function amount(quantity: number): string {
  if (quantity <= 1 / 16) return String(Math.round(quantity * 1000) / 1000);
  let whole = Math.floor(quantity);
  const rest = quantity - whole;
  const [value, glyph] = FRACTIONS.reduce((a, b) =>
    Math.abs(b[0] - rest) < Math.abs(a[0] - rest) ? b : a,
  );
  if (value === 1) whole += 1;
  return `${whole || ''}${whole && glyph ? ' ' : ''}${glyph}` || '0';
}

function ounceWarnings(recipe: Recipe): string[] {
  return ambiguousOunces(recipe.ingredients).map(
    (line) => `"${line}" is treated as weight; write fl oz if it is a liquid measure`,
  );
}

function stepWarnings(recipe: Recipe): string[] {
  const unit =
    /\d\s*(tsp|tbsp|cups?|oz|lbs?|ounces?|pounds?|teaspoons?|tablespoons?|g|grams?|ml|cans?)\b/i;
  return recipe.instructions
    .map((step, n) => ({ step, n }))
    .filter(({ step }) => unit.test(step.text))
    .map(({ n }) => `Step ${n + 1} mentions an amount in its text, which is not scaled`);
}
//#endregion
