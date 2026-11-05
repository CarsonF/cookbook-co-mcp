import { z } from 'zod';
import { defineTool } from '../define.js';
import { changedStamp, recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { freshRecipe, staleError, writeResult } from '../shared/recipes.js';

export const rateRecipe = defineTool({
  name: 'rate_recipe',
  description:
    "Set a recipe's rating (0 to 5 stars) without recording that it was cooked. " +
    "Pass the recipe's `changed` value from get_recipe; refused if it was edited since. " +
    'The recipe is backed up first. Use mark_cooked to rate while logging a cook.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    id: recipeId,
    changed: changedStamp,
    rating: z.number().int().min(0).max(5).describe('0 clears the rating'),
  },
  run: async ({ id, changed, rating }, { client, backup }) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const stale = staleError(recipe, changed);
    if (stale) return fail(stale);
    if (recipe.rating === rating) return fail(`The recipe already has a rating of ${rating}`);

    const backupFile = await backup(recipe);
    const saved = await client.recipes.save(recipe, { edits: { rating } });
    return json({ ...writeResult(saved), from: recipe.rating, rating, backup: backupFile });
  },
});
