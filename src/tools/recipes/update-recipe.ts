import { describeChanges } from '../../domain/recipes/changes.js';
import {
  ambiguousOunces,
  isDrink,
  render,
  toIngredients,
  toInstructions,
} from '../../domain/recipes/edit.js';
import { defineTool } from '../define.js';
import { changedStamp, recipeId } from '../shared/inputs.js';
import { fail, json, jsonWithText } from '../shared/output.js';
import { freshRecipe, staleError, writeResult } from '../shared/recipes.js';

import * as R from 'remeda';
import { z } from 'zod';

export const updateRecipe = defineTool({
  name: 'update_recipe',
  description:
    'Edit prep/cook times, servings, description, source, ingredients, instructions and notes. ' +
    'Read the recipe with get_recipe first: any ingredients or instructions you pass replace the whole list, so include every item to keep. ' +
    'Without apply=true nothing is written and only the changes are returned for review (show_full adds the whole recipe). ' +
    'Use short units (tbsp, tsp, cup, oz, lb, fl oz), "" for bare counts, decimal quantities. ' +
    'Plain oz means weight: write fl oz for fluid ounces (not needed in drink recipes). ' +
    'Instruction text supports **bold**, __italics__, ~~strikethrough~~. ' +
    'A step that is a single line ending in a colon ("For the filling:") is a section header, written in sentence or title case like normal text. ' +
    'Ingredient `group` is a section heading shared by consecutive ingredients. ' +
    'Notes replace the whole recipe notes text ("" clears it).',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    id: recipeId,
    changed: changedStamp,
    preptime: z.number().int().min(0).optional().describe('Minutes'),
    cooktime: z.number().int().min(0).optional().describe('Minutes'),
    othertime: z.number().int().min(0).optional().describe('Minutes'),
    othertimetype: z.string().optional().describe('Label for othertime, e.g. "Chill Time"'),
    servings: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .describe('How many servings the amounts make; does not rescale ingredients'),
    servingtype: z.string().max(50).optional().describe('Label for servings, e.g. "Cookies"'),
    desc: z.string().max(1024).optional().describe('A short description ("" clears it)'),
    source: z
      .string()
      .max(500)
      .optional()
      .describe('Where the recipe came from, e.g. a URL or book ("" clears it)'),
    ingredients: z
      .array(
        z.object({
          quantity: z.number().min(0).describe('Decimal, e.g. 0.5 not 1/2; 0 if unspecified'),
          measure: z
            .string()
            .describe('Short unit; "" for none; oz is weight, fl oz is fluid ounces'),
          name: z.string(),
          notes: z.string().optional().describe('Prep detail, e.g. "chopped"'),
          group: z.string().optional().describe('Section heading, e.g. "For the sauce"'),
        }),
      )
      .optional()
      .describe('The complete ingredient list'),
    instructions: z
      .array(z.string())
      .optional()
      .describe('The complete step list, one string per step, in order'),
    notes: z
      .string()
      .max(10240)
      .optional()
      .describe('The complete recipe notes (tips etc.), replacing the existing text'),
    apply: z.boolean().default(false).describe('false previews only; true saves'),
    show_full: z
      .boolean()
      .default(false)
      .describe('Preview only: also return the full recipe before and after, not just the changes'),
  },
  run: async (
    { id, changed, ingredients, instructions, notes, servings, apply, show_full, ...fields },
    { client, backup },
  ) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const stale = staleError(recipe, changed);
    if (stale) return fail(stale);

    const edits = {
      ...R.pickBy({ ...fields, serving: servings }, (value) => value !== undefined),
      ...(ingredients && { ingredients: toIngredients(ingredients) }),
      ...(instructions && { instructions: toInstructions(instructions, recipe.instructions) }),
      ...(notes !== undefined && { notes }),
    };
    if (R.isEmpty(edits)) return fail('Nothing to change: pass at least one field to edit');

    // a step photo only carries over when the step text is unchanged
    const lostPhotos = instructions
      ? recipe.instructions.filter((s) => s.photo && !instructions.includes(s.text)).length
      : 0;
    const warnings =
      lostPhotos > 0
        ? [`${lostPhotos} step photo(s) will be dropped because their step text changed`]
        : [];
    if (ingredients && !isDrink(recipe, await client.tags.list())) {
      const unclear = ambiguousOunces(edits.ingredients ?? []);
      warnings.push(
        ...unclear.map((line) => `"${line}" reads as weight; use fl oz if it is a liquid measure`),
      );
    }
    const changes = describeChanges(recipe, { ...recipe, ...edits });
    if (!apply) {
      return jsonWithText(
        {
          applied: false,
          changes,
          ...(warnings.length > 0 && { warnings }),
          ...(show_full && { before: render(recipe), after: render({ ...recipe, ...edits }) }),
        },
        ['before', 'after'],
      );
    }

    const backupFile = await backup(recipe);
    const saved = await client.recipes.save(recipe, { edits });
    return json({
      applied: true,
      backup: backupFile,
      ...writeResult(saved),
      changes,
      ...(warnings.length > 0 && { warnings }),
    });
  },
});
