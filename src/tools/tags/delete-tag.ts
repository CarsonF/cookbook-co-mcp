import { defineTool } from '../define.js';
import { tagId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';

import { z } from 'zod';

export const deleteTag = defineTool({
  name: 'delete_tag',
  description:
    'Permanently delete a tag. The app automatically removes it from every recipe that has it ' +
    '(the recipes themselves are kept); this cannot be undone. ' +
    "`name` must match the tag's current name, as a guard against a wrong id. " +
    'Without apply=true nothing is deleted and `usedByRecipes` says how many recipes carry the tag.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    id: tagId,
    name: z.string().describe("The tag's current name, to confirm"),
    apply: z.boolean().default(false).describe('false previews only; true deletes'),
  },
  run: async ({ id, name, apply }, { client }) => {
    const tag = (await client.tags.list(true)).find((t) => t.id === id);
    if (!tag) return fail(`No tag with id ${id}`);
    if (tag.name.toLowerCase() !== name.toLowerCase()) {
      return fail(`Tag ${id} is named "${tag.name}", not "${name}"; not deleted`);
    }
    const recipes = (await client.recipes.list()).filter((r) => r.category.includes(id));
    if (!apply)
      return json({ applied: false, wouldDelete: tag.name, usedByRecipes: recipes.length });
    await client.tags.delete(tag);
    return json({ applied: true, deleted: tag.name, removedFromRecipes: recipes.length });
  },
});
