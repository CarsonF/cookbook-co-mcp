import type { Recipe } from '../../api/index.js';
import { ambiguousOunces, isDrink, render, toIngredients } from '../../domain/recipes/edit.js';
import { uploadImage } from '../../files/image-source.js';
import { defineTool } from '../define.js';
import { unknownTagsParam } from '../shared/inputs.js';
import { fail, json, jsonWithText } from '../shared/output.js';
import { settleTags, tagDecision } from '../shared/tags.js';
import { canonicalize, toTitleCase } from '../shared/text.js';

import { z } from 'zod';

export const importRecipeFromUrl = defineTool({
  name: 'import_recipe_from_url',
  description:
    'Import a recipe from a web page URL into the library. ' +
    'Without apply=true nothing is saved and the parsed recipe is returned for review. ' +
    'Refuses a URL that is already saved as a recipe source unless allow_duplicate is set.',
  hints: ['openWorld'],
  inputSchema: {
    url: z.string().url().describe('Recipe web page URL'),
    tags: z.array(z.string()).default([]).describe('Tags to apply to the new recipe'),
    unknown_tags: unknownTagsParam,
    allow_duplicate: z
      .boolean()
      .default(false)
      .describe('Import even if this URL is already a saved recipe source'),
    apply: z.boolean().default(false).describe('false previews only; true saves the recipe'),
  },
  run: async ({ url, tags, unknown_tags, allow_duplicate, apply }, { client }, mcp) => {
    const [recipes, known] = await Promise.all([client.recipes.list(true), client.tags.list(true)]);
    const duplicate = recipes.find((r) => sameUrl(r.source, url));
    if (duplicate && !allow_duplicate) {
      return fail(
        `Already imported as "${duplicate.name}" (id ${duplicate.id}); pass allow_duplicate to add another copy`,
      );
    }
    const settled = await settleTags(
      mcp,
      canonicalize(
        tags,
        known.map((t) => t.name),
        toTitleCase,
      ),
      known,
      unknown_tags,
      apply,
    );
    if (settled.input) return settled.input;
    if (settled.refuse) return fail(settled.refuse);
    const wanted = settled.tags;

    const draft = await client.recipes.parseUrl(url);
    const parsed = { ...draft, ingredients: toIngredients(draft.ingredients) };
    const preview = render(parsed as unknown as Recipe);
    const wantedIds = known.filter((t) => wanted.includes(t.name)).map((t) => t.id);
    const drink = isDrink({ name: parsed.name, category: wantedIds }, known);
    const unclearOunces = (drink ? [] : ambiguousOunces(parsed.ingredients)).map(
      (line) => `"${line}" reads as weight; edit it to fl oz if it is a liquid measure`,
    );
    if (!apply) {
      return jsonWithText(
        {
          applied: false,
          name: parsed.name,
          source: parsed.source,
          tags: wanted,
          ...(settled.skipped.length > 0 && { skippedTags: settled.skipped }),
          ...(settled.pending.length > 0 && { decision: tagDecision(settled.pending) }),
          preview,
          warnings: unclearOunces,
        },
        ['preview'],
      );
    }

    // the parser's photo lives on a temporary media URL; re-upload it so the recipe keeps it
    let photo = 'kept';
    if (/^https?:\/\//.test(parsed.displayphoto)) {
      try {
        parsed.displayphoto = await uploadImage(client, parsed.displayphoto);
      } catch {
        parsed.displayphoto = '';
        photo = 'missing';
      }
    }
    const saved = await client.recipes.create(parsed, wanted);
    return json({ applied: true, id: saved.id, name: saved.name, changed: saved.changed, photo });
  },
});

/** Same page ignoring scheme, www, fragment, trailing slash and utm_* tracking parameters. */
function sameUrl(a: string, b: string): boolean {
  const norm = (value: string): string | undefined => {
    try {
      const url = new URL(value.trim());
      const query = [...url.searchParams]
        .filter(([key]) => !key.startsWith('utm_'))
        .sort(([x], [y]) => x.localeCompare(y))
        .map(([key, val]) => `${key}=${val}`)
        .join('&');
      return `${url.host.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}?${query}`;
    } catch {
      return undefined;
    }
  };
  const left = norm(a);
  return left !== undefined && left === norm(b);
}
