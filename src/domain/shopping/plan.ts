import type { Recipe, ShoppingItem } from '../../api/index.js';
import { isPackaged, normalizeMeasure, unitFor } from '../recipes/edit.js';
import { amount, convert } from '../recipes/scale.js';
import { aisleFor } from './aisles.js';
import { normalizeName } from './names.js';

export interface Line {
  name: string;
  qty: number;
  measure: string;
}

export interface Plan {
  adds: Omit<ShoppingItem, 'id'>[];
  merges: { item: ShoppingItem; qty: number; measure: string; text: string }[];
}

/** Ingredient lines for a recipe at `factor`, with staples split out unless included. */
export function recipeLines(recipe: Recipe, factor: number, drink = false): Line[] {
  return recipe.ingredients.map((i) => {
    const measure = unitFor(i.measure, drink);
    // "15 oz can corn": the size is part of the item, and the quantity is how many cans to buy
    if (i.quantity && measure && isPackaged(i.name)) {
      const size = `${amount(i.quantity)} ${measure}`;
      return { name: `${size} ${i.name}`, qty: Math.max(1, Math.ceil(factor - 1e-9)), measure: '' };
    }
    return { name: i.name, qty: i.quantity * factor, measure };
  });
}

/** Staples are assumed on hand: water, salt, pepper, cooking oils and spray, plus `extra` names. */
export function splitOnHand(
  lines: Line[],
  extra: string[],
  includeStaples: boolean,
): { needed: Line[]; skipped: string[] } {
  const extras = extra.map(normalizeName);
  const needed: Line[] = [];
  const skipped: string[] = [];
  for (const line of lines) {
    const key = normalizeName(line.name);
    const onHand = (!includeStaples && STAPLES.some((p) => p.test(key))) || extras.includes(key);
    if (onHand) skipped.push(line.name);
    else needed.push(line);
  }
  return { needed, skipped: [...new Set(skipped)] };
}

/** Combines lines with the same name and compatible unit; e.g. 2 tbsp + 2 tbsp becomes ¼ cup. */
export function combineLines(lines: Line[]): Line[] {
  const groups = new Map<string, Line[]>();
  for (const line of lines) {
    const key = `${normalizeName(line.name)}|${family(line.measure, line.name)}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  return [...groups.values()].map((group) => sum(group));
}

/** Folds lines into the open items already on a list; unmatched lines become new items. */
export function planAdditions(
  existing: ShoppingItem[],
  lines: Line[],
  products: Map<string, string>,
  source: { recipe: number; serving: number },
  overrides: Map<string, string> = new Map(),
): Plan {
  const plan: Plan = { adds: [], merges: [] };
  const open = new Map(
    existing
      .filter((i) => !i.complete)
      .map((i) => [`${normalizeName(i.name)}|${family(i.measure, i.name)}`, i] as const),
  );
  for (const line of combineLines(lines)) {
    const match = open.get(`${normalizeName(line.name)}|${family(line.measure, line.name)}`);
    if (match) {
      const total = sum([{ name: match.name, qty: match.qty, measure: match.measure }, line]);
      plan.merges.push({
        item: match,
        qty: total.qty,
        measure: total.measure,
        text: itemText(total),
      });
      open.delete(`${normalizeName(line.name)}|${family(line.measure, line.name)}`);
    } else {
      plan.adds.push({
        name: line.name,
        item: itemText(line),
        qty: line.qty,
        measure: line.measure,
        aisle: overrides.get(normalizeName(line.name)) ?? aisleFor(line.name, products),
        complete: false,
        serving: source.serving,
        recipe: source.recipe,
      });
    }
  }
  return plan;
}

export function itemText(line: Line): string {
  // a size folded into the name ("15 oz can corn") reads best as "2 × 15 oz can corn"
  const count = line.qty
    ? amount(line.qty) + (/^\d/.test(line.name) && !line.measure ? ' ×' : '')
    : '';
  return `${count} ${line.measure} ${line.name}`.replace(/\s+/g, ' ').trim();
}

//#region helpers
const STAPLES = [
  /^(cold |warm |hot )?water$/,
  /^(kosher |sea |fine |table )?salt( and (black )?pepper)?$/,
  /^(ground |black |ground black )?pepper$/,
  /^(extra virgin |extra-virgin )?olive oil$/,
  /^(vegetable|canola|cooking) oil$/,
  /^(cooking|nonstick|non stick) spray$/,
];

/** Units that can be added together share a family; others only merge when identical. */
function family(measure: string, name: string): string {
  const m = normalizeMeasure(measure);
  // a can's size is a label: only identical sizes add up, and nothing is converted
  if (isPackaged(name)) return `package:${m.toLowerCase()}`;
  if (Object.hasOwn(TSP, m)) return 'volume';
  if (Object.hasOwn(OZ, m)) return 'weight';
  return `unit:${m.toLowerCase()}`;
}

const TSP: Record<string, number> = { tsp: 1, tbsp: 3, 'fl oz': 6, cup: 48 };

const OZ: Record<string, number> = { oz: 1, lb: 16 };

function sum(lines: Line[]): Line {
  const [first] = lines;
  const measure = normalizeMeasure(first.measure);
  const base = family(first.measure, first.name);
  if (base === 'volume' || base === 'weight') {
    // single lines too, so 32 oz of ground beef reads as 2 lb
    const table = base === 'volume' ? TSP : OZ;
    const total = lines.reduce((t, l) => t + l.qty * table[normalizeMeasure(l.measure)], 0);
    const unit = base === 'volume' ? 'tsp' : 'oz';
    const stepped = first.qty ? convert(total, unit, true) : { quantity: first.qty, measure };
    return { name: first.name, qty: stepped.quantity, measure: stepped.measure };
  }
  return { name: first.name, qty: lines.reduce((t, l) => t + l.qty, 0), measure };
}
//#endregion
