import { encodeCookbookFile } from '../../api/index.js';
import { isDrink } from '../../domain/recipes/edit.js';
import { scaleRecipe } from '../../domain/recipes/scale.js';
import { exportPath } from '../../files/export-path.js';
import {
  fetchPhotos,
  PDF_FONT_SIZES,
  PDF_LAYOUTS,
  PDF_SECTIONS,
  photoPaths,
  recipePdf,
} from '../../pdf/index.js';
import { defineTool } from '../define.js';
import { recipeId } from '../shared/inputs.js';
import { fail, json } from '../shared/output.js';

import { stat, writeFile } from 'node:fs/promises';
import { z } from 'zod';

export const exportRecipe = defineTool({
  name: 'export_recipe',
  description:
    'Write a recipe to a local file: a .cookbook file that the CookBook app can import, or a PDF in the ' +
    "app's own A4 recipe layouts, with photo and nutrition (optionally scaled to `servings`). " +
    'Nothing is published and the library is not changed. ' +
    'Files go to ~/Downloads unless output_path is given; an existing file is not overwritten unless overwrite is set. ' +
    'For a public link use share_recipe_link.',
  hints: ['idempotent'],
  inputSchema: {
    id: recipeId,
    format: z
      .enum(['file', 'pdf'])
      .describe('file: .cookbook file for the CookBook app; pdf: printable A4 recipe page'),
    servings: z
      .number()
      .positive()
      .optional()
      .describe('pdf only: scale the ingredient amounts to this many servings'),
    layout: z
      .enum(PDF_LAYOUTS)
      .optional()
      .describe(
        "pdf only: the app's full-page style. side_by_side_full (default): wide photo, ingredients beside steps. " +
          'side_by_side_compact: small photo beside steps, ingredients in a narrow column. ' +
          'detailed_step_by_step: facts beside the photo, two-column ingredients, extra and step photos beside the steps. ' +
          'minimalistic: single column, no photo',
      ),
    exclude: z
      .array(z.enum(PDF_SECTIONS))
      .optional()
      .describe(
        'pdf only: sections to leave out. info is yield, times, rating, source and tags; ' +
          'custom is the pairings field; step_photos only matters for detailed_step_by_step. ' +
          'The main photo cannot be excluded (the app has no option for it)',
      ),
    font_size: z
      .enum(PDF_FONT_SIZES)
      .optional()
      .describe('pdf only: text size, regular by default; small is 0.75x and xlarge 1.5x'),
    output_path: z.string().optional().describe('Absolute path ending in .cookbook or .pdf'),
    overwrite: z.boolean().default(false).describe('Replace the output file if it exists'),
  },
  run: async (
    { id, format, servings, layout, exclude, font_size, output_path, overwrite },
    { client, config },
  ) => {
    const [recipes, tags] = await Promise.all([client.recipes.list(true), client.tags.list()]);
    const recipe = recipes.find((r) => r.id === id);
    if (!recipe) return fail(`No recipe with id ${id}`);

    const names = recipe.category
      .map((c) => tags.find((t) => t.id === c)?.name)
      .filter((n) => !!n) as string[];
    if (format === 'file') {
      const path = await exportPath({
        dirs: config.exportDirs,
        name: recipe.name,
        ext: 'cookbook',
        output: output_path,
        overwrite,
      });
      await writeFile(path, encodeCookbookFile(recipe, names));
      return json({ recipe: recipe.name, path, bytes: (await stat(path)).size });
    }

    if (servings !== undefined && !recipe.serving)
      return fail('Recipe has no serving count to scale from');
    const drink = isDrink(recipe, tags);
    const scaled =
      servings === undefined
        ? undefined
        : scaleRecipe(recipe, servings / recipe.serving, true, drink);
    const path = await exportPath({
      dirs: config.exportDirs,
      name: recipe.name,
      ext: 'pdf',
      output: output_path,
      overwrite,
    });
    const wanted = photoPaths(recipe, { layout, exclude });
    const photos = await fetchPhotos((path) => client.images.download(path), wanted);
    // the app lists a recipe's tags in tag-list order
    const tagNames = tags.filter((t) => recipe.category.includes(t.id)).map((t) => t.name);
    await writeFile(
      path,
      await recipePdf(recipe, tagNames, { scaled, photos, layout, exclude, fontSize: font_size }),
    );
    return json({
      recipe: recipe.name,
      path,
      bytes: (await stat(path)).size,
      servings: scaled?.toServings ?? recipe.serving,
      layout: layout ?? 'side_by_side_full',
      photos:
        wanted.length === 0
          ? 'none'
          : photos.size === wanted.length
            ? `${photos.size} included`
            : `${photos.size} of ${wanted.length} included (others are not JPEG or PNG, or not reachable)`,
    });
  },
});
