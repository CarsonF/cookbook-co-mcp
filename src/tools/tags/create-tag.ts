import { z } from 'zod';
import { defineTool } from '../define.js';
import { json } from '../shared/output.js';
import { canonicalize, toTitleCase } from '../shared/text.js';

export const createTag = defineTool({
  name: 'create_tag',
  description:
    'Create a new recipe tag (category). Names are Title Case ("ground beef" becomes "Ground Beef"). ' +
    'Does nothing if the tag already exists, ignoring case.',
  hints: ['idempotent'],
  inputSchema: { name: z.string().trim().min(1).describe('New tag name') },
  run: async ({ name }, { client }) => {
    const known = await client.tags.list(true);
    const [wanted] = canonicalize(
      [name],
      known.map((t) => t.name),
      toTitleCase,
    );
    const existing = known.find((t) => t.name === wanted);
    if (existing) return json({ created: false, id: existing.id, name: existing.name });
    const { id } = await client.tags.create(wanted);
    return json({ created: true, id, name: wanted });
  },
});
