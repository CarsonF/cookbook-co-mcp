import { z } from 'zod';
import { defineTool } from '../define.js';
import { fail, json } from '../shared/output.js';
import { apply, resolveList } from './shared.js';

export const deleteShoppingList = defineTool({
  name: 'delete_shopping_list',
  description:
    'Permanently delete a shopping list and all its items; this cannot be undone. ' +
    '`name` must match the list\'s current name. The built-in "Regular items" list cannot be deleted. ' +
    'Without apply=true nothing is deleted and the number of items is returned.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    list: z.string().describe('List name or id'),
    name: z.string().describe("The list's current name, to confirm"),
    apply,
  },
  run: async ({ list: ref, name, apply: go }, { client }) => {
    const found = await resolveList(client, ref);
    if ('error' in found) return fail(found.error);
    if (found.id === 'common') return fail('The built-in "Regular items" list cannot be deleted');
    if (found.name.toLowerCase() !== name.toLowerCase()) {
      return fail(`List is named "${found.name}", not "${name}"; not deleted`);
    }
    const count = (await client.shopping.items(found.id)).length;
    if (!go) return json({ applied: false, wouldDelete: found.name, itemCount: count });
    await client.shopping.deleteList(found.id);
    return json({ applied: true, deleted: found.name, itemsDeleted: count });
  },
});
