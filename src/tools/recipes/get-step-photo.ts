import { z } from "zod";
import { sniffImage } from "../../files/image-source.js";
import { defineTool } from "../define.js";
import { recipeId } from "../shared/inputs.js";
import { fail, image } from "../shared/output.js";
import { freshRecipe } from "../shared/recipes.js";

export const getStepPhoto = defineTool({
  name: "get_step_photo",
  description:
    "View the photo attached to one recipe step, as an image. Steps are numbered from 1; " +
    "get_recipe's `stepPhotos` lists the steps that have one.",
  hints: ["readOnly", "openWorld"],
  inputSchema: {
    id: recipeId,
    step: z.number().int().min(1).describe("Step number, counted from 1"),
  },
  run: async ({ id, step }, { client }) => {
    const recipe = (await client.recipes.list()).find((r) => r.id === id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const target = recipe.instructions[step - 1];
    if (!target) return fail(`Recipe ${id} has ${recipe.instructions.length} steps, not ${step}`);
    if (!target.photo) return fail(`Step ${step} has no photo`);

    const bytes = await client.images.download(target.photo);
    const ext = bytes && sniffImage(bytes);
    if (!bytes || !ext) return fail(`Could not fetch the photo for step ${step}`);
    return image(bytes, `image/${ext === "jpg" ? "jpeg" : ext}`, `Step ${step}: ${target.text}`);
  },
});
