import { z } from 'zod';
import { defineTool } from '../define.js';
import { isoDate } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { plannedMeal, SLOT_NAMES } from './planner.js';

export const scheduleMeal = defineTool({
  name: 'schedule_meal',
  description:
    'Put a recipe (or a free-text note) on the meal planner for a date and meal slot. ' +
    'To change an entry that already exists, use update_planned_meal.',
  hints: [],
  inputSchema: {
    date: isoDate,
    slot: z.enum(SLOT_NAMES).default('Dinner').describe('Meal slot'),
    recipe_id: z.number().int().optional().describe('Omit for a note-only entry'),
    servings: z.number().positive().optional().describe("Defaults to the recipe's servings"),
    note: z.string().default('').describe('Free text; required when there is no recipe_id'),
  },
  run: async ({ date, slot, recipe_id, servings, note }, { client }) => {
    if (recipe_id === undefined && !note) return fail('Give a recipe_id, a note, or both');
    const recipe =
      recipe_id === undefined
        ? undefined
        : (await client.recipes.list()).find((r) => r.id === recipe_id);
    if (recipe_id !== undefined && !recipe) return fail(`No recipe with id ${recipe_id}`);

    const row = await client.mealPlan.save({
      id: 0,
      date,
      slot: SLOT_NAMES.indexOf(slot) + 1,
      serving: servings ?? recipe?.serving ?? 1,
      recipe: recipe_id ?? 0,
      note,
    });
    return json(plannedMeal(row));
  },
});
