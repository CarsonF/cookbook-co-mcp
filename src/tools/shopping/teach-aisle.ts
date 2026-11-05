import { z } from 'zod';
import { aisleId } from '../../api/index.js';
import { defineTool } from '../define.js';
import { json } from '../shared/output.js';
import { aisleName } from './shared.js';

export const teachAisle = defineTool({
  name: 'teach_aisle',
  description:
    'Remember which aisle an item name belongs to, so future adds use it. ' +
    'Replaces any earlier memory for the same name. No list is changed.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    item: z.string().min(1).describe('Item name, e.g. "tortilla chips"'),
    aisle: aisleName,
  },
  run: async ({ item, aisle }, { client }) => {
    await client.products.remember([{ item: item.trim(), aisle: aisleId(aisle)! }]);
    return json({ remembered: item.trim(), aisle });
  },
});
