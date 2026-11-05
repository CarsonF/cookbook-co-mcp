import { z } from 'zod';
import { defineTool } from '../define.js';
import { changedStamp, recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { freshRecipe, staleError, writeResult } from '../shared/recipes.js';

export const renameRecipe = defineTool({
  name: 'rename_recipe',
  description:
    "Rename a recipe. Pass the recipe's `changed` value from get_recipe; refused if it was edited since. " +
    'The recipe is backed up first.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    id: recipeId,
    changed: changedStamp,
    name: z.string().trim().min(1).max(200).describe('The new recipe name'),
  },
  run: async ({ id, changed, name }, { client, backup }) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const stale = staleError(recipe, changed);
    if (stale) return fail(stale);
    if (recipe.name === name) return fail('The recipe already has that name');

    const backupFile = await backup(recipe);
    const saved = await client.recipes.save(recipe, { edits: { name } });
    return json({ ...writeResult(saved), from: recipe.name, backup: backupFile });
  },
});
