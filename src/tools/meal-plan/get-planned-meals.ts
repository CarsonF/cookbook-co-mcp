import { defineTool } from '../define.js';
import { isoDate } from '../shared/inputs.js';
import { json } from '../shared/output.js';
import { plannedMeal } from './planner.js';

export const getPlannedMeals = defineTool({
  name: 'get_planned_meals',
  description:
    'Planned meals between two dates (inclusive): recipes or notes on the meal planner, by date and slot. ' +
    "Each entry's `id` is what update_planned_meal and unschedule_meal take. " +
    'The server refuses ranges that end over a year from today or span over about two years.',
  hints: ['readOnly'],
  inputSchema: {
    from: isoDate.describe('First day, YYYY-MM-DD'),
    to: isoDate.describe('Last day, YYYY-MM-DD'),
  },
  run: async ({ from, to }, { client }) =>
    json((await client.mealPlan.list(from, to)).map(plannedMeal)),
});
