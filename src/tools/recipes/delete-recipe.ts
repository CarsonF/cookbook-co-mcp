import type { CookbookClient } from '../../api/index.js';
import { defineTool } from '../define.js';
import { recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { freshRecipe } from '../shared/recipes.js';

import { z } from 'zod';

export const deleteRecipe = defineTool({
  name: 'delete_recipe',
  description:
    'Permanently delete a recipe. `name` must match its current name. ' +
    'Without apply=true nothing is deleted and what would be affected is returned. ' +
    'A backup file is saved first, but there is no restore: recreating it means importing the backup by hand. ' +
    'Planner entries and shopping items that mention it are not removed.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    id: recipeId,
    name: z.string().describe("The recipe's current name, to confirm"),
    apply: z.boolean().default(false).describe('false previews only; true deletes'),
  },
  run: async ({ id, name, apply }, { client, backup }) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    if (recipe.name.toLowerCase() !== name.toLowerCase()) {
      return fail(`Recipe ${id} is named "${recipe.name}", not "${name}"; not deleted`);
    }
    const planned = await plannedUses(client, id);
    if (!apply) {
      return json({
        applied: false,
        wouldDelete: recipe.name,
        plannedMeals: planned.length,
        photo: recipe.displayphoto || null,
      });
    }
    const backupFile = await backup(recipe, 'delete');
    await client.recipes.delete(id);
    return json({
      applied: true,
      deleted: recipe.name,
      backup: backupFile,
      plannedMealsStillReferencingIt: planned.length,
    });
  },
});

async function plannedUses(client: CookbookClient, recipeId: number) {
  return (await client.mealPlan.all()).filter((e) => e.diaryrecipe === recipeId);
}
