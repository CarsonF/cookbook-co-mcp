import { z } from "zod";
import { defineTool } from "../define.js";
import { changedStamp, recipeId } from "../shared/inputs.js";
import { fail, json } from "../shared/output.js";
import { freshRecipe, staleError, writeResult } from "../shared/recipes.js";

export const removeStepPhoto = defineTool({
  name: "remove_step_photo",
  description:
    "Remove the photo from one recipe step, leaving the step's text. Steps are numbered from 1. " +
    "Pass the recipe's `changed` value from get_recipe; refused if the recipe was edited since. " +
    "The removed photo path is returned.",
  hints: ["destructive", "idempotent"],
  inputSchema: {
    id: recipeId,
    changed: changedStamp,
    step: z.number().int().min(1).describe("Step number, counted from 1"),
  },
  run: async ({ id, changed, step }, { client, backup }) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const stale = staleError(recipe, changed);
    if (stale) return fail(stale);
    const target = recipe.instructions[step - 1];
    if (!target) return fail(`Recipe ${id} has ${recipe.instructions.length} steps, not ${step}`);
    if (!target.photo) return fail(`Step ${step} has no photo`);

    const backupFile = await backup(recipe);
    const instructions = recipe.instructions.map((s, i) =>
      i === step - 1 ? { ...s, photo: "" } : s,
    );
    const saved = await client.recipes.save(recipe, { edits: { instructions } });
    return json({
      ...writeResult(saved),
      step,
      previousPhoto: target.photo,
      backup: backupFile,
    });
  },
});
