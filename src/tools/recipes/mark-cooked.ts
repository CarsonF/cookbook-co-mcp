import { z } from 'zod';
import { defineTool } from '../define.js';
import { isoDate, recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { freshRecipe } from '../shared/recipes.js';

export const markCooked = defineTool({
  name: 'mark_cooked',
  description:
    'Record that a recipe was cooked (now, or on a past date), optionally setting its rating. ' +
    'Each call adds one to the cook count and sets the last-cooked date, so call it once per time cooked. ' +
    'To change only the rating, use rate_recipe.',
  hints: [],
  inputSchema: {
    id: recipeId,
    date: isoDate.optional().describe('The day it was cooked; defaults to today'),
    rating: z
      .number()
      .int()
      .min(0)
      .max(5)
      .optional()
      .describe('0 to 5; omit to keep the current rating'),
  },
  run: async ({ id, date, rating }, { client }) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    await client.recipes.markCooked(recipe, rating, date && `${date} 12:00:00`);
    return json({
      id,
      cookcount: recipe.cookcount + 1,
      rating: rating ?? recipe.rating,
      cookedOn: date ?? 'today',
    });
  },
});
