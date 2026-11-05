import * as R from 'remeda';
import { z } from 'zod';
import { aisleId } from '../../api/index.js';
import type { ShoppingItem } from '../../api/index.js';
import { defineTool } from '../define.js';
import { fail, json } from '../shared/output.js';
import { aisleName, list, pick, resolveList } from './shared.js';

export const setItemAisle = defineTool({
  name: 'set_item_aisle',
  description:
    'Move items on a shopping list to another aisle. By default the aisle is also remembered ' +
    'for that item name, so future adds land there (what the app does when you edit an aisle). ' +
    'Items are item ids from get_shopping_list or names; ambiguity is refused.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    items: z
      .array(z.string())
      .min(1)
      .describe(
        'Item ids from get_shopping_list, or names; a name matching several items is refused',
      ),
    aisle: aisleName,
    list,
    remember: z.boolean().default(true).describe('Also remember this aisle for future adds'),
  },
  run: async ({ items: queries, aisle, list: ref, remember }, { client }) => {
    const found = await resolveList(client, ref);
    if ('error' in found) return fail(found.error);
    const all = await client.shopping.items(found.id);

    const picked: ShoppingItem[] = [];
    const problems: string[] = [];
    for (const query of queries) {
      const hit = pick(all, query);
      if (typeof hit === 'string') problems.push(hit);
      else picked.push(hit);
    }
    if (problems.length > 0) return fail(`${problems.join('; ')}. Nothing was changed.`);

    const id = aisleId(aisle)!;
    await client.shopping.updateItems(
      found.id,
      picked.map((item) => ({ id: item.id, fields: { aisle: id } })),
    );
    if (remember) {
      await client.products.remember(
        R.unique(picked.map((i) => i.name)).map((item) => ({ item, aisle: id })),
      );
    }
    return json({
      list: found.name,
      aisle,
      moved: picked.map((i) => i.item),
      remembered: remember,
    });
  },
});
