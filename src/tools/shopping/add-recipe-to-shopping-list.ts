import { z } from 'zod';
import { isDrink } from '../../domain/recipes/edit.js';
import { aisleMemory } from '../../domain/shopping/aisles.js';
import { planAdditions, recipeLines, splitOnHand } from '../../domain/shopping/plan.js';
import { defineTool } from '../define.js';
import { recipeId } from '../shared/inputs.js';
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

export const addRecipeToShoppingList = defineTool({
  name: 'add_recipe_to_shopping_list',
  description:
    "Add a recipe's ingredients to a shopping list, scaled to a serving count. " +
    'Staples assumed on hand (water, salt, pepper, cooking oils and spray) are skipped and ' +
    'reported. Without apply=true nothing is written and the plan is returned for review. ' +
    'Applying again adds the quantities again, so apply each plan once.',
  hints: [],
  inputSchema: {
    recipe_id: recipeId,
    servings: z.number().positive().optional().describe("Defaults to the recipe's servings"),
    list,
    on_hand,
    include_staples,
    aisles: aisleOverrides,
    apply,
  },
  run: async (
    { recipe_id, servings, list: ref, on_hand: extra, include_staples: staples, aisles, apply: go },
    { client },
  ) => {
    const found = await resolveList(client, ref);
    if ('error' in found) return fail(found.error);
    const recipe = (await client.recipes.list()).find((r) => r.id === recipe_id);
    if (!recipe) return fail(`No recipe with id ${recipe_id}`);

    const factor = servings && recipe.serving ? servings / recipe.serving : 1;
    const drink = isDrink(recipe, await client.tags.list());
    const { needed, skipped } = splitOnHand(recipeLines(recipe, factor, drink), extra, staples);
    const plan = planAdditions(
      await client.shopping.items(found.id),
      needed,
      await aisleMemory(client),
      { recipe: recipe.id, serving: servings ?? recipe.serving },
      overrideMap(aisles),
    );
    if (go) await applyPlan(client, found.id, plan);
    return json({
      applied: go,
      list: found.name,
      recipe: recipe.name,
      servings: servings ?? recipe.serving,
      ...describePlan(plan),
      skippedAsOnHand: skipped,
    });
  },
});
