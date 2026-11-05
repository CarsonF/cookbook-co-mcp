import { isDrink } from '../../domain/recipes/edit.js';
import { aisleMemory } from '../../domain/shopping/aisles.js';
import { planAdditions, recipeLines, splitOnHand } from '../../domain/shopping/plan.js';
import type { Line } from '../../domain/shopping/plan.js';
import { defineTool } from '../define.js';
import { isoDate } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import {
  aisleOverrides,
  apply,
  applyPlan,
  describePlan,
  include_staples,
  list,
  on_hand,
  overrideMap,
  resolveList,
} from './shared.js';

export const addPlannedMealsToShoppingList = defineTool({
  name: 'add_planned_meals_to_shopping_list',
  description:
    'Add the ingredients for every recipe planned between two dates, each scaled to its ' +
    'planned servings and merged across recipes. Staples are skipped and reported. ' +
    'Without apply=true nothing is written and the plan is returned for review. ' +
    'Applying again adds the quantities again, so apply each plan once.',
  hints: [],
  inputSchema: {
    from: isoDate.describe('First day, YYYY-MM-DD'),
    to: isoDate.describe('Last day, YYYY-MM-DD'),
    list,
    on_hand,
    include_staples,
    aisles: aisleOverrides,
    apply,
  },
  run: async (
    { from, to, list: ref, on_hand: extra, include_staples: staples, aisles, apply: go },
    { client, config },
  ) => {
    const found = await resolveList(client, ref, config.defaultShoppingList);
    if ('error' in found) return fail(found.error);
    const [planned, recipes] = await Promise.all([
      client.mealPlan.list(from, to, true),
      client.recipes.list(),
    ]);
    const meals = planned.filter((m) => m.diaryrecipe > 0);
    if (meals.length === 0) return fail(`No planned recipes between ${from} and ${to}`);

    const tags = await client.tags.list();
    const lines: Line[] = [];
    const used: string[] = [];
    const missing: number[] = [];
    for (const meal of meals) {
      const recipe = recipes.find((r) => r.id === meal.diaryrecipe);
      if (!recipe) {
        missing.push(meal.diaryrecipe);
        continue;
      }
      const factor = recipe.serving ? meal.diaryserving / recipe.serving : 1;
      lines.push(...recipeLines(recipe, factor, isDrink(recipe, tags)));
      used.push(`${meal.diarydate.slice(0, 10)} ${recipe.name} (${meal.diaryserving} servings)`);
    }
    const { needed, skipped } = splitOnHand(lines, extra, staples);
    const plan = planAdditions(
      await client.shopping.items(found.id),
      needed,
      await aisleMemory(client),
      { recipe: 0, serving: 1 },
      overrideMap(aisles),
    );
    if (go) await applyPlan(client, found.id, plan);
    return json({
      applied: go,
      list: found.name,
      meals: used,
      ...(missing.length > 0 && { missingRecipeIds: missing }),
      ...describePlan(plan),
      skippedAsOnHand: skipped,
    });
  },
});
