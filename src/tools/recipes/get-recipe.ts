import { defineTool } from '../define.js';
import { recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { tagLabels, tagNames } from '../shared/recipes.js';
import { leanRecipe } from './output.js';

export const getRecipe = defineTool({
  name: 'get_recipe',
  description:
    'Get one recipe in full: ingredients, instructions (plain strings), tags, timings. ' +
    'Empty fields are left out. Its `changed` value is required by the edit tools.',
  hints: ['readOnly'],
  inputSchema: { id: recipeId },
  run: async ({ id }, { client }) => {
    const [recipes, tags] = await Promise.all([client.recipes.list(), client.tags.list()]);
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    return json(leanRecipe(recipe, tagLabels(recipe, tagNames(tags))));
  },
});
