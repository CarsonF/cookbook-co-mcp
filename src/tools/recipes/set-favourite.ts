import { z } from 'zod';
import { defineTool } from '../define.js';
import { changedStamp, recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { freshRecipe, staleError, writeResult } from '../shared/recipes.js';

export const setFavourite = defineTool({
  name: 'set_favourite',
  description:
    'Favourite or unfavourite a recipe. Pass `changed` from get_recipe; refused if the recipe was edited since.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    id: recipeId,
    favourite: z.boolean().describe('true to favourite, false to unfavourite'),
    changed: changedStamp,
  },
  run: async ({ id, favourite, changed }, { client, backup }) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const stale = staleError(recipe, changed);
    if (stale) return fail(stale);
    const backupFile = await backup(recipe);
    const saved = await client.recipes.save(recipe, { fave: favourite });
    return json({ ...writeResult(saved), backup: backupFile });
  },
});
