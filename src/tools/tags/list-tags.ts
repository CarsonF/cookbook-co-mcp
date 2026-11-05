import { defineTool } from '../define.js';
import { json } from '../shared/output.js';

export const listTags = defineTool({
  name: 'list_tags',
  description:
    'List all recipe tags (categories) as a {name: id} map. Recipes carry tags by name; rename_tag and delete_tag take an id from here.',
  hints: ['readOnly'],
  inputSchema: {},
  run: async (_args, { client }) =>
    json(Object.fromEntries((await client.tags.list()).map(({ id, name }) => [name, id]))),
});
