import { z } from 'zod';
import { isDrink } from '../../domain/recipes/edit.js';
import { scaleRecipe } from '../../domain/recipes/scale.js';
import { defineTool } from '../define.js';
import { recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { scaledLines } from './output.js';

export const scaleRecipeTool = defineTool({
  name: 'scale_recipe',
  description:
    "Show a recipe's ingredient amounts scaled to a serving count or a multiple. " +
    'Read-only: nothing is saved. Amounts become cooking-friendly fractions and units step up ' +
    '(48 tsp becomes 1 cup). Times and numbers inside instruction text are not scaled; warnings list those steps.',
  hints: ['readOnly'],
  inputSchema: {
    id: recipeId,
    servings: z.number().positive().optional().describe('Target servings; or pass factor'),
    factor: z
      .number()
      .positive()
      .optional()
      .describe('Multiplier, e.g. 0.5 or 2; or pass servings'),
    step_up_units: z
      .boolean()
      .default(true)
      .describe('Convert to a larger unit when it reads better (tsp to tbsp to cup, oz to lb)'),
  },
  run: async ({ id, servings, factor, step_up_units }, { client }) => {
    if ((servings === undefined) === (factor === undefined)) {
      return fail('Pass exactly one of servings or factor');
    }
    const recipe = (await client.recipes.list()).find((r) => r.id === id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    if (servings !== undefined && !recipe.serving)
      return fail('Recipe has no serving count; pass factor');
    const scale = factor ?? servings! / recipe.serving;
    const drink = isDrink(recipe, await client.tags.list());
    const scaled = scaleRecipe(recipe, scale, step_up_units, drink);
    return json({
      recipe: recipe.name,
      servings: `${scaled.fromServings} → ${scaled.toServings}`,
      ingredients: scaledLines(scaled),
      ...(scaled.warnings.length > 0 && { warnings: scaled.warnings }),
    });
  },
});
