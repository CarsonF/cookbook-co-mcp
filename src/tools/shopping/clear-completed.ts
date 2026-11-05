import { defineTool } from '../define.js';
import { fail, json } from '../shared/output.js';
import { list, resolveList } from './shared.js';

export const clearCompleted = defineTool({
  name: 'clear_completed',
  description:
    'Delete every checked-off item from a shopping list. The open items stay. This cannot be undone.',
  hints: ['destructive', 'idempotent'],
  inputSchema: { list },
  run: async ({ list: ref }, { client, config }) => {
    const found = await resolveList(client, ref, config.defaultShoppingList);
    if ('error' in found) return fail(found.error);
    const done = (await client.shopping.items(found.id)).filter((i) => i.complete);
    await client.shopping.deleteItems(
      found.id,
      done.map((item) => item.id),
    );
    return json({ list: found.name, cleared: done.length });
  },
});
