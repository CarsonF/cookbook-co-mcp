import { z } from 'zod';
import { defineTool } from '../define.js';
import { fail, json } from '../shared/output.js';
import { findPlannerEntry, plannedMeal } from './planner.js';

export const unscheduleMeal = defineTool({
  name: 'unschedule_meal',
  description: 'Remove an entry from the meal planner (the recipe itself is untouched).',
  hints: ['destructive', 'idempotent'],
  inputSchema: { entry_id: z.number().int().describe('`id` from get_planned_meals') },
  run: async ({ entry_id }, { client }) => {
    const entry = await findPlannerEntry(client, entry_id);
    if (!entry) return fail(`No planner entry ${entry_id} within a year of today`);
    await client.mealPlan.remove(entry_id);
    return json({ removed: plannedMeal(entry) });
  },
});
