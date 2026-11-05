import { type CookbookClient, decodeCookbookFile, type Recipe } from '../../api/index.js';
import { render, toIngredients } from '../../domain/recipes/edit.js';
import { uploadImage } from '../../files/image-source.js';

import { settleTags, tagDecision } from '../shared/tags.js';
import { canonicalize, toTitleCase } from '../shared/text.js';
import { defineTool } from '../define.js';
import { unknownTagsParam } from '../shared/inputs.js';
import { jsonWithText } from '../shared/output.js';

import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import * as R from 'remeda';
import { z } from 'zod';

export const importRecipeFile = defineTool({
  name: 'import_recipe_file',
  description:
    'Import recipes from .cookbook files (the CookBook app export format). ' +
    'Without apply=true nothing is saved and each recipe is returned for review. ' +
    'Tags come from the file by name, in Title Case; unknown tags are asked about (unknown_tags). ' +
    "Photos are copied into this account's image storage from the original account's. " +
    'A recipe with the same name and source as an existing one is refused unless allow_duplicate is set.',
  hints: ['openWorld'],
  inputSchema: {
    paths: z.array(z.string()).min(1).max(20).describe('Absolute paths of .cookbook files'),
    unknown_tags: unknownTagsParam,
    allow_duplicate: z
      .boolean()
      .default(false)
      .describe('Import even if a recipe with the same name and source exists'),
    apply: z.boolean().default(false).describe('false previews only; true saves the recipes'),
  },
  run: async ({ paths, unknown_tags, allow_duplicate, apply }, { client }, mcp) => {
    const [recipes, known] = await Promise.all([client.recipes.list(true), client.tags.list(true)]);
    const knownNames = known.map((t) => t.name);
    const files = (await Promise.all(paths.map(readRecipeFile))).map((file) => {
      if (file.error !== undefined) return file;
      return {
        ...file,
        duplicate: allow_duplicate ? undefined : findDuplicate(file.draft, recipes),
        tagNames: canonicalize(file.tagNames, knownNames, toTitleCase),
      };
    });

    // one question for every file, before anything is written
    const wanted = R.unique(files.flatMap((f) => ('error' in f || f.duplicate ? [] : f.tagNames)));
    const settled = await settleTags(mcp, wanted, known, unknown_tags, apply);
    if (settled.input) return settled.input;

    const results = [];
    for (const file of files) {
      if ('error' in file) {
        results.push(file);
        continue;
      }
      const { path, draft, photoPaths } = file;
      if (file.duplicate) {
        results.push({
          path,
          error: `Already in the library as "${file.duplicate.name}" (id ${file.duplicate.id}); pass allow_duplicate to add another copy`,
        });
        continue;
      }
      try {
        if (settled.refuse) throw new Error(settled.refuse);
        const tags = file.tagNames.filter((t) => settled.tags.includes(t));
        const skipped = file.tagNames.filter((t) => settled.skipped.includes(t));
        const pending = file.tagNames.filter((t) => settled.pending.includes(t));
        const photoCount = (photoPaths.display ? 1 : 0) + photoPaths.extra.length;

        if (!apply) {
          results.push({
            path,
            applied: false,
            name: draft.name,
            tags,
            ...(skipped.length > 0 && { skippedTags: skipped }),
            ...(pending.length > 0 && { decision: tagDecision(pending) }),
            photos: photoCount > 0 ? `${photoCount} will be copied` : 'none',
            preview: render(draft as unknown as Recipe),
          });
          continue;
        }
        const photos = await carryPhotos(client, photoPaths);
        const saved = await client.recipes.create({ ...draft, ...photos.fields }, tags);
        results.push({
          path,
          applied: true,
          id: saved.id,
          name: saved.name,
          tags,
          ...(skipped.length > 0 && { skippedTags: skipped }),
          photos: photos.summary,
        });
      } catch (err) {
        results.push({ path, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return jsonWithText(results, ['preview']);
  },
});

//#region helpers
/** A decoded `.cookbook` file with the tag names it carried, or why it cannot be read. */
async function readRecipeFile(path: string) {
  try {
    if (!isAbsolute(path)) throw new Error('Path must be absolute');
    if ((await stat(path)).size > 2 * 1024 * 1024) throw new Error('File is larger than 2 MB');
    const { draft: raw, tagNames, photoPaths } = decodeCookbookFile(await readFile(path));
    const draft = { ...raw, ingredients: toIngredients(raw.ingredients) };
    return { path, draft, photoPaths, tagNames };
  } catch (err) {
    return { path, error: err instanceof Error ? err.message : String(err) };
  }
}

/** The library recipe with the same name and source, if any. */
function findDuplicate(draft: { name: string; source: string }, library: Recipe[]) {
  return library.find(
    (r) => r.name.toLowerCase() === draft.name.toLowerCase() && r.source === draft.source,
  );
}

/** Copies photos from the original account's storage into this account's, best effort. */
async function carryPhotos(
  client: CookbookClient,
  paths: { display: string; extra: string[] },
): Promise<{ fields: { displayphoto: string; photos: string[] }; summary: string }> {
  const copy = async (path: string) => {
    if (!PHOTO_PATH.test(path)) return '';
    try {
      return await uploadImage(client, `https://media.cookbookmanager.com/${path}`);
    } catch {
      return '';
    }
  };
  const displayphoto = paths.display ? await copy(paths.display) : '';
  const extra = await Promise.all(paths.extra.slice(0, MAX_EXTRA_PHOTOS).map(copy));
  const photos = extra.filter(Boolean);
  const wanted = (paths.display ? 1 : 0) + Math.min(paths.extra.length, MAX_EXTRA_PHOTOS);
  const got = (displayphoto ? 1 : 0) + photos.length;
  const summary =
    wanted === 0 ? 'none' : got === wanted ? `${got} copied` : `${got} of ${wanted} copied`;
  return { fields: { displayphoto, photos }, summary };
}

const PHOTO_PATH = /^\d+\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i;

const MAX_EXTRA_PHOTOS = 10;
//#endregion
