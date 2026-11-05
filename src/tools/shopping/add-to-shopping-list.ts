import { z } from 'zod';
import { normalizeMeasure } from '../../domain/recipes/edit.js';
import { aisleMemory } from '../../domain/shopping/aisles.js';
import { planAdditions } from '../../domain/shopping/plan.js';
import type { Line } from '../../domain/shopping/plan.js';
import { defineTool } from '../define.js';
import { fail, json } from '../shared/output.js';
import { aisleNames, applyPlan, describePlan, list, overrideMap, resolveList } from './shared.js';

export const addToShoppingList = defineTool({
  name: 'add_to_shopping_list',
  description:
    'Add items to a shopping list. An open item with the same name and a compatible unit has ' +
    "its quantity increased instead of being duplicated. Aisle: the one you pass, else the app's " +
    'remembered aisle for that name, else a crude keyword guess, else Uncategorized.',
  hints: [],
  inputSchema: {
    items: z
      .array(
        z.object({
          name: z.string().min(1).describe('e.g. "milk" or "lemons"'),
          quantity: z.number().min(0).optional().describe('Decimal; omit for no quantity'),
          measure: z.string().optional().describe('Short unit such as cup or lb; omit for none'),
          aisle: z
            .enum(aisleNames)
            .optional()
            .describe('Choose this whenever you know it; the keyword guess is crude'),
        }),
      )
      .min(1)
      .describe('Items to add; the same name and unit as an open item adds to its quantity'),
    list,
  },
  run: async ({ items, list: ref }, { client, config }) => {
    const found = await resolveList(client, ref, config.defaultShoppingList);
    if ('error' in found) return fail(found.error);
    const lines: Line[] = items.map((i) => ({
      name: i.name.trim(),
      qty: i.quantity ?? 0,
      measure: normalizeMeasure(i.measure ?? ''),
    }));
    const chosen = items.flatMap((i) => (i.aisle ? [{ item: i.name, aisle: i.aisle }] : []));
    const plan = planAdditions(
      await client.shopping.items(found.id),
      lines,
      await aisleMemory(client),
      { recipe: 0, serving: 1 },
      overrideMap(chosen),
    );
    await applyPlan(client, found.id, plan);
    return json({ list: found.name, ...describePlan(plan) });
  },
});
