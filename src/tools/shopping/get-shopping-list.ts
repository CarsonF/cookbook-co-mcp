import { z } from 'zod';
import { aisleLabel, AISLES } from '../../api/index.js';
import type { ShoppingItem } from '../../api/index.js';
import { defineTool } from '../define.js';
import { fail, json } from '../shared/output.js';
import { list, resolveList } from './shared.js';

export const getShoppingList = defineTool({
  name: 'get_shopping_list',
  description:
    'Show a shopping list: open items grouped by aisle, plus how many are checked off. ' +
    'Items are shown by name, which the check, uncheck, remove and aisle tools accept; ' +
    'pass ids when a name is ambiguous, and show_done to list the checked-off items.',
  hints: ['readOnly'],
  inputSchema: {
    list,
    ids: z.boolean().default(false).describe('Return each item as {id, text} instead of text'),
    show_done: z.boolean().default(false).describe('List the checked-off items, not just a count'),
  },
  run: async ({ list: ref, ids, show_done }, { client }) => {
    const found = await resolveList(client, ref);
    if ('error' in found) return fail(found.error);
    const items = await client.shopping.items(found.id);
    const order = Object.values(AISLES);
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of items.filter((i) => !i.complete)) {
      groups.set(item.aisle, [...(groups.get(item.aisle) ?? []), item]);
    }
    const show = (i: ShoppingItem) => (ids ? { id: i.id, text: i.item } : i.item);
    const aisles = Object.fromEntries(
      [...groups.entries()]
        .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
        .map(([aisle, rows]) => [aisleLabel(aisle) ?? 'Uncategorized', rows.map(show)]),
    );
    const done = items.filter((i) => i.complete);
    return json({
      list: found.name,
      aisles,
      done: show_done ? done.map(show) : done.length,
    });
  },
});
