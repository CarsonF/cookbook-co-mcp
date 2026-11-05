import { z } from 'zod';
import type { ShoppingItem } from '../../api/index.js';
import { defineTool } from '../define.js';
import { fail, json } from '../shared/output.js';
import { list, pick, resolveList } from './shared.js';

/** The check, uncheck and remove tools: the same lookup, a different write. */
export function itemActionTool(options: {
  name: string;
  verb: string;
  action: 'check' | 'uncheck' | 'remove';
}) {
  const { name, verb, action } = options;
  return defineTool({
    name,
    description:
      `${verb} items on a shopping list. Each entry is an item id from get_shopping_list or a ` +
      'name; a name matching several items is refused and nothing changes.',
    hints: action === 'remove' ? ['destructive', 'idempotent'] : ['idempotent'],
    inputSchema: {
      items: z
        .array(z.string())
        .min(1)
        .describe(
          'Item ids from get_shopping_list, or names; a name matching several items is refused',
        ),
      list,
    },
    run: async ({ items: queries, list: ref }, { client, config }) => {
      const found = await resolveList(client, ref, config.defaultShoppingList);
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

      const ids = picked.map((i) => i.id);
      if (action === 'remove') await client.shopping.deleteItems(found.id, ids);
      else {
        await client.shopping.updateItems(
          found.id,
          ids.map((id) => ({ id, fields: { complete: action === 'check' } })),
        );
      }
      return json({
        list: found.name,
        [action === 'remove' ? 'removed' : action + 'ed']: picked.map((i) => i.item),
      });
    },
  });
}
