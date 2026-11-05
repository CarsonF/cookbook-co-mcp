import { z } from 'zod';
import { defineTool } from '../define.js';
import { json } from '../shared/output.js';

export const forgetAisle = defineTool({
  name: 'forget_aisle',
  description: 'Delete the remembered aisle for an item name (it falls back to the keyword guess).',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    item: z.string().min(1).describe('Item name as shown by list_learned_aisles'),
  },
  run: async ({ item }, { client }) =>
    json({ forgotten: item, removed: await client.products.forget(item) }),
});
