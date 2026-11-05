import { z } from 'zod';
import { defineTool } from '../define.js';
import { tagId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { toTitleCase } from '../shared/text.js';

export const renameTag = defineTool({
  name: 'rename_tag',
  description: 'Rename a tag everywhere it is used. The new name is made Title Case.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    id: tagId,
    name: z.string().trim().min(1).describe('New name'),
  },
  run: async ({ id, name }, { client }) => {
    const tags = await client.tags.list(true);
    const tag = tags.find((t) => t.id === id);
    if (!tag) return fail(`No tag with id ${id}`);
    const title = toTitleCase(name);
    const clash = tags.find((t) => t.id !== id && t.name.toLowerCase() === title.toLowerCase());
    if (clash) return fail(`A tag named "${clash.name}" already exists (id ${clash.id})`);
    await client.tags.rename(tag, title);
    return json({ id, from: tag.name, to: title });
  },
});
