import { z } from 'zod';
import { uploadImage } from '../../files/image-source.js';
import { defineTool } from '../define.js';
import { changedStamp, recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';
import { freshRecipe, staleError, writeResult } from '../shared/recipes.js';

export const setRecipePhoto = defineTool({
  name: 'set_recipe_photo',
  description:
    "Replace a recipe's main photo with an image from a local file path or an http(s) URL " +
    "(jpg, png or webp, up to 15 MB). Pass the recipe's `changed` value from get_recipe; " +
    'refused if the recipe was edited since. The old photo path is returned.',
  hints: ['destructive', 'idempotent', 'openWorld'],
  inputSchema: {
    id: recipeId,
    changed: changedStamp,
    source: z.string().describe('Absolute local file path, or an http(s) image URL'),
  },
  run: async ({ id, changed, source }, { client, backup }) => {
    const recipe = await freshRecipe(client, id);
    if (!recipe) return fail(`No recipe with id ${id}`);
    const stale = staleError(recipe, changed);
    if (stale) return fail(stale);

    const photo = await uploadImage(client, source);

    // the upload can be slow: check again that nobody edited the recipe meanwhile
    const latest = await freshRecipe(client, id);
    const editedMeanwhile = latest && staleError(latest, changed);
    if (!latest || editedMeanwhile) {
      return fail(
        `${editedMeanwhile ?? 'Recipe was deleted'} The image was uploaded but not attached.`,
      );
    }
    const backupFile = await backup(latest);
    const saved = await client.recipes.save(latest, { edits: { displayphoto: photo } });
    return json({
      ...writeResult(saved),
      photo: saved.displayphoto,
      previousPhoto: latest.displayphoto,
      backup: backupFile,
    });
  },
});
