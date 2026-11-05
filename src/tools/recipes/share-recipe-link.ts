import { defineTool } from '../define.js';
import { recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';

export const shareRecipeLink = defineTool({
  name: 'share_recipe_link',
  description:
    'Make a public share link for a recipe: anyone who has the link can read it and add it to their ' +
    'own CookBook library (they need a CookBook account to save it, and get no file or PDF download). ' +
    'Asking again returns the same link. There is no way to revoke it short of deleting the recipe, ' +
    'so only use this when the user wants to publish the recipe. For a file or PDF use export_recipe.',
  hints: ['idempotent', 'openWorld'],
  inputSchema: { id: recipeId },
  run: async ({ id }, { client }) => {
    const recipe = (await client.recipes.list(true)).find((r) => r.id === id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const code = await client.recipes.shareCode(id);
    return json({
      recipe: recipe.name,
      url: `https://app.cookbookmanager.com/recipe/${id}/${code}`,
      note: 'Anyone with this link can view the recipe',
    });
  },
});
