import type { CookbookClient, PlannedMealRow } from '../../api/index.js';
import { dropEmpty } from '../shared/output.js';

// meal planner slots; the API numbers them 1..9 in this order
export const SLOT_NAMES = [
  'Breakfast',
  'Snack AM',
  'Lunch',
  'Dinner',
  'Other',
  'Appetizer',
  'Dessert',
  'Snack PM',
  'Side dish',
] as const;

export async function findPlannerEntry(client: CookbookClient, entryId: number) {
  return (await client.mealPlan.all(true)).find((e) => e.diaryid === entryId);
}

export function plannedMeal(row: PlannedMealRow) {
  return dropEmpty({
    id: row.diaryid,
    date: row.diarydate.slice(0, 10),
    slot: SLOT_NAMES[row.diaryslot - 1] ?? String(row.diaryslot),
    recipeId: row.diaryrecipe,
    recipe: row.recipename,
    servings: row.diaryserving,
    note: row.diarynote,
  });
}
