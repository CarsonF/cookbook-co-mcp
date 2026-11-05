import { defineTool } from '../define.js';
import { json } from '../shared/output.js';

export const listShoppingLists = defineTool({
  name: 'list_shopping_lists',
  description:
    'List the shopping lists by name with open and done item counts. "Shopping List" is the one normally used; ' +
    '"Regular items" is the app\'s built-in list of regular groceries.',
  hints: ['readOnly'],
  inputSchema: {},
  run: async (_args, { client }) => {
    const lists = await client.shopping.lists();
    return json(
      await Promise.all(
        lists.map(async (l) => {
          const items = await client.shopping.items(l.id);
          return {
            name: l.name,
            open: items.filter((i) => !i.complete).length,
            done: items.filter((i) => i.complete).length,
          };
        }),
      ),
    );
  },
});
