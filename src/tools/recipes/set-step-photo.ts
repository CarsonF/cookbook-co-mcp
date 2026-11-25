import { z } from "zod";
import { uploadImage } from "../../files/image-source.js";
import { defineTool } from "../define.js";
import { changedStamp, recipeId } from "../shared/inputs.js";
import { fail, json } from "../shared/output.js";
import { freshRecipe, staleError, writeResult } from "../shared/recipes.js";

export const setStepPhoto = defineTool({
  name: "set_step_photo",
  description:
    "Attach a photo to one recipe step, replacing the step's current one, from a local file path " +
    "or an http(s) URL (jpg, png or webp, up to 15 MB). Steps are numbered from 1. " +
    "Pass the recipe's `changed` value from get_recipe; refused if the recipe was edited since.",
  hints: ["destructive", "idempotent", "openWorld"],
  inputSchema: {
    id: recipeId,
    changed: changedStamp,
    step: z.number().int().min(1).describe("Step number, counted from 1"),
    source: z.string().describe("Absolute local file path, or an http(s) image URL"),
  },
  run: async ({ id, changed, step, source }, { client, backup }) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const stale = staleError(recipe, changed);
    if (stale) return fail(stale);
    if (!recipe.instructions[step - 1]) {
      return fail(`Recipe ${id} has ${recipe.instructions.length} steps, not ${step}`);
    }

    const photo = await uploadImage(client, source);

    // the upload can be slow: check again that nobody edited the recipe meanwhile
    const latest = await freshRecipe(client, id);
    const editedMeanwhile = latest && staleError(latest, changed);
    if (!latest || editedMeanwhile) {
      return fail(
        `${editedMeanwhile ?? "Recipe was deleted"} The image was uploaded but not attached.`,
      );
    }
    const backupFile = await backup(latest);
    const instructions = latest.instructions.map((s, i) => (i === step - 1 ? { ...s, photo } : s));
    const saved = await client.recipes.save(latest, { edits: { instructions } });
    return json({
      ...writeResult(saved),
      step,
      photo: saved.instructions[step - 1]?.photo,
      previousPhoto: latest.instructions[step - 1]?.photo,
      backup: backupFile,
    });
  },
});
