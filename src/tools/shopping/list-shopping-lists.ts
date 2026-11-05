import { defineTool } from '../define.js';
import { json } from '../shared/output.js';
import { findDefaultList } from './shared.js';

export const listShoppingLists = defineTool({
  name: 'list_shopping_lists',
  description:
    'List the shopping lists by name with open and done item counts. ' +
    'The default list, used when a tool is given no list, is marked default: true; ' +
    '"Regular items" is the app\'s built-in list of regular groceries.',
  hints: ['readOnly'],
  inputSchema: {},
  run: async (_args, { client, config }) => {
    const lists = await client.shopping.lists();
    const defaultList = findDefaultList(lists, config.defaultShoppingList);
    return json(
      await Promise.all(
        lists.map(async (l) => {
          const items = await client.shopping.items(l.id);
          return {
            name: l.name,
            default: l === defaultList,
            open: items.filter((i) => !i.complete).length,
            done: items.filter((i) => i.complete).length,
          };
        }),
      ),
    );
  },
});
