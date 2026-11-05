import { z } from 'zod';
import { aisleId, aisleLabel, AISLES } from '../../api/index.js';
import type { CookbookClient, ShoppingItem } from '../../api/index.js';
import { normalizeName } from '../../domain/shopping/names.js';
import type { Plan } from '../../domain/shopping/plan.js';

export const aisleNames = Object.keys(AISLES) as [string, ...string[]];

export const aisleOverrides = z
  .array(
    z.object({
      item: z.string().describe('Ingredient or item name as it appears'),
      aisle: z.enum(aisleNames),
    }),
  )
  .default([])
  .describe(
    'Aisles you choose for specific items. Use this whenever you know the right aisle: the ' +
      'built-in keyword guess is crude. Not remembered; use set_item_aisle to remember one.',
  );

export function overrideMap(entries: { item: string; aisle: string }[]): Map<string, string> {
  return new Map(entries.map((e) => [normalizeName(e.item), aisleId(e.aisle)!]));
}

export const list = z
  .string()
  .optional()
  .describe('List name or id; defaults to the default list (marked by list_shopping_lists)');

export const on_hand = z
  .array(z.string())
  .default([])
  .describe('Extra ingredient names assumed on hand and skipped');

export const include_staples = z
  .boolean()
  .default(false)
  .describe('Also add staples (water, salt, pepper, cooking oil and spray) normally skipped');

export const apply = z
  .boolean()
  .default(false)
  .describe('false previews only; true makes the change');

export const DEFAULT_LIST = 'Shopping List';

/**
 * The list used when a tool is given none.
 * A configured name must match; the built-in name may fall back to the only other list.
 */
export function findDefaultList<T extends { id: string; name: string }>(
  lists: T[],
  configured?: string,
): T | undefined {
  const key = (configured ?? DEFAULT_LIST).toLowerCase();
  const match = lists.find((l) => l.id === configured || l.name.toLowerCase() === key);
  if (match || configured) return match;
  const others = lists.filter((l) => l.id !== 'common');
  return others.length === 1 ? others[0] : undefined;
}

export async function resolveList(
  client: CookbookClient,
  ref: string | undefined,
  configured?: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const lists = await client.shopping.lists();
  const names = lists.map((l) => l.name).join(', ');
  if (ref) {
    const key = ref.toLowerCase();
    const exact = lists.find((l) => l.id === ref || l.name.toLowerCase() === key);
    if (exact) return exact;
    const partial = lists.filter((l) => l.name.toLowerCase().includes(key));
    if (partial.length === 1) return partial[0];
    return {
      error:
        partial.length === 0
          ? `No list "${ref}". Lists: ${names}`
          : `"${ref}" matches several lists (${partial.map((l) => l.name).join(', ')}); use the full name`,
    };
  }
  const found = findDefaultList(lists, configured);
  if (found) return found;
  return { error: `No "${configured ?? DEFAULT_LIST}" found; pass \`list\`. Lists: ${names}` };
}

export async function applyPlan(client: CookbookClient, listId: string, plan: Plan): Promise<void> {
  await client.shopping.addItems(listId, plan.adds);
  await client.shopping.updateItems(
    listId,
    plan.merges.map((merge) => ({
      id: merge.item.id,
      fields: { qty: merge.qty, measure: merge.measure, item: merge.text },
    })),
  );
}

export function describePlan(plan: Plan) {
  return {
    added: plan.adds.map((a) => ({
      item: a.item,
      aisle: aisleLabel(a.aisle) ?? 'Uncategorized',
    })),
    merged: plan.merges.map((m) => ({ was: m.item.item, now: m.text })),
  };
}

/** An item id, an exact normalized name, or a name contained either way; ambiguity is an error. */
export function pick(items: ShoppingItem[], query: string): ShoppingItem | string {
  const byId = items.find((i) => i.id === query);
  if (byId) return byId;
  const key = normalizeName(query);
  const exact = items.filter((i) => normalizeName(i.name) === key);
  // otherwise every word of the query must be a whole word of the item: "beans" fits "kidney beans"
  const words = key.split(' ');
  const hits =
    exact.length > 0
      ? exact
      : items.filter((i) => {
          const itemWords = normalizeName(i.name).split(' ');
          return words.every((w) => itemWords.includes(w));
        });
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) return `No item matching "${query}"`;
  return `"${query}" matches ${hits.map((i) => `"${i.item}" (${i.id})`).join(', ')}`;
}

export const aisleName = z.enum(aisleNames).describe('Aisle name, e.g. "Pantry - Canned Foods"');
