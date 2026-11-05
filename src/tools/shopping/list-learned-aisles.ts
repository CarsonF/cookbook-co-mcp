import { aisleLabel } from '../../api/index.js';
import { defineTool } from '../define.js';
import { json } from '../shared/output.js';

export const listLearnedAisles = defineTool({
  name: 'list_learned_aisles',
  description:
    'Show the aisles remembered per item name as an {item: aisle} map: the same memory the app uses, which ' +
    'teach_aisle and set_item_aisle save to.',
  hints: ['readOnly'],
  inputSchema: {},
  run: async (_args, { client }) => {
    const docs = await client.products.list();
    return json(
      Object.fromEntries(
        docs
          .sort((a, b) => a.item.localeCompare(b.item))
          .map((d) => [d.item, aisleLabel(d.aisle) ?? d.aisle]),
      ),
    );
  },
});
