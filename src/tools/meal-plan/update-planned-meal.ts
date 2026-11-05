import { z } from 'zod';
import { defineTool } from '../define.js';
import { isoDate } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { findPlannerEntry, plannedMeal, SLOT_NAMES } from './planner.js';

export const updatePlannedMeal = defineTool({
  name: 'update_planned_meal',
  description:
    'Change an existing planner entry: move it to another date or slot, swap the recipe, ' +
    'or change servings or note. Only the fields you pass change. ' +
    'Looks for the entry within a year either side of today.',
  hints: ['destructive', 'idempotent'],
  inputSchema: {
    entry_id: z.number().int().describe('`id` from get_planned_meals'),
    date: isoDate.optional().describe('New date, YYYY-MM-DD'),
    slot: z.enum(SLOT_NAMES).optional().describe('New meal slot'),
    recipe_id: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Swap in this recipe; 0 makes it a note-only entry'),
    servings: z.number().positive().optional().describe('New serving count'),
    note: z.string().optional().describe('Pass "" to clear the note'),
  },
  run: async ({ entry_id, date, slot, recipe_id, servings, note }, { client }) => {
    const current = await findPlannerEntry(client, entry_id);
    if (!current) return fail(`No planner entry ${entry_id} within a year of today`);
    if (recipe_id && !(await client.recipes.list()).some((r) => r.id === recipe_id)) {
      return fail(`No recipe with id ${recipe_id}`);
    }
    if (recipe_id === 0 && !(note ?? current.diarynote)) {
      return fail('A note-only entry needs a note; pass `note` too');
    }

    const row = await client.mealPlan.save({
      id: entry_id,
      date: date ?? current.diarydate.slice(0, 10),
      slot: slot ? SLOT_NAMES.indexOf(slot) + 1 : current.diaryslot,
      serving: servings ?? current.diaryserving,
      recipe: recipe_id ?? current.diaryrecipe,
      note: note ?? current.diarynote ?? '',
    });
    return json(plannedMeal(row));
  },
});
