import { z } from 'zod';
import { defineTool } from '../define.js';
import { fail, json } from '../shared/output.js';

export const createShoppingList = defineTool({
  name: 'create_shopping_list',
  description: 'Create a new, empty shopping list. Fails if a list with that name already exists.',
  hints: [],
  inputSchema: { name: z.string().trim().min(1).describe('List name') },
  run: async ({ name }, { client }) => {
    const existing = (await client.shopping.lists()).find(
      (l) => l.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return fail(`A list named "${existing.name}" already exists`);
    return json({ id: await client.shopping.createList(name), name });
  },
});
