import { z } from 'zod';
import { defineTool } from '../define.js';
import { changedStamp, recipeId, unknownTagsParam } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { freshRecipe, staleError, writeResult } from '../shared/recipes.js';
import { settleTags } from '../shared/tags.js';
import { canonicalize, toTitleCase } from '../shared/text.js';

export const setTags = defineTool({
  name: 'set_tags',
  description:
    "Replace a recipe's tags, given as names (see list_tags); new names are made Title Case. " +
    "Pass the recipe's `changed` value from get_recipe; the write is refused if the recipe was edited since.",
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    id: recipeId,
    tags: z.array(z.string()).describe('The complete tag list, not a delta'),
    changed: changedStamp,
    unknown_tags: unknownTagsParam,
  },
  run: async ({ id, tags, changed, unknown_tags }, { client, backup }, mcp) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const stale = staleError(recipe, changed);
    if (stale) return fail(stale);

    const known = await client.tags.list(true);
    const settled = await settleTags(
      mcp,
      canonicalize(
        tags,
        known.map((t) => t.name),
        toTitleCase,
      ),
      known,
      unknown_tags,
      true,
    );
    if (settled.input) return settled.input;
    if (settled.refuse) return fail(settled.refuse);
    const backupFile = await backup(recipe);
    const saved = await client.recipes.save(recipe, { tags: settled.tags });
    return json({
      ...writeResult(saved),
      tags: settled.tags,
      ...(settled.skipped.length > 0 && { skippedTags: settled.skipped }),
      backup: backupFile,
    });
  },
});
