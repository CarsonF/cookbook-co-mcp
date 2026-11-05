import { z } from 'zod';
import type { Recipe } from '../../api/index.js';
import { defineTool } from '../define.js';
import { json } from '../shared/output.js';
import { tagLabels, tagNames } from '../shared/recipes.js';
import { recipeRow } from './output.js';

export const searchRecipes = defineTool({
  name: 'search_recipes',
  description:
    'Search recipes by text (name, description, ingredients, notes) and/or tag. ' +
    'Rows are short; call get_recipe for the full recipe and its `changed` value before editing.',
  hints: ['readOnly'],
  inputSchema: {
    query: z.string().optional().describe('Case-insensitive text to find'),
    tag: z.string().optional().describe('Tag name, e.g. "Soup"'),
    favourite: z.boolean().optional().describe('true: only favourites, false: only the rest'),
    sort: z
      .enum([
        'name',
        'newest',
        'oldest',
        'updated',
        'last_cooked',
        'rating',
        'cook_count',
        'total_time',
      ])
      .optional()
      .describe('Matches the app sorts; newest/updated approximate "recent recipes"'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('Max results (default 10); `total` is always the full count'),
    details: z
      .boolean()
      .default(false)
      .describe('Also return source, created, changed, last cooked and cook count'),
  },
  run: async ({ query, tag, favourite, sort, limit, details }, { client }) => {
    const [recipes, tags] = await Promise.all([client.recipes.list(), client.tags.list()]);
    const names = tagNames(tags);
    const needle = query?.toLowerCase();
    const hits = recipes.filter(
      (r) =>
        (favourite === undefined || r.fave === favourite) &&
        (tag === undefined ||
          r.category.some((id) => names.get(id)?.toLowerCase() === tag.toLowerCase())) &&
        (needle === undefined || haystack(r).includes(needle)),
    );
    if (sort) hits.sort(SORTS[sort]);
    return json({
      total: hits.length,
      recipes: hits.slice(0, limit).map((r) => recipeRow(r, tagLabels(r, names), details)),
    });
  },
});

//#region helpers
const SORTS: Record<string, (a: Recipe, b: Recipe) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  newest: (a, b) => b.created.localeCompare(a.created),
  oldest: (a, b) => a.created.localeCompare(b.created),
  updated: (a, b) => b.changed.localeCompare(a.changed),
  last_cooked: (a, b) => (b.lastcook ?? '').localeCompare(a.lastcook ?? ''),
  rating: (a, b) => b.rating - a.rating,
  cook_count: (a, b) => b.cookcount - a.cookcount,
  total_time: (a, b) => a.preptime + a.cooktime - (b.preptime + b.cooktime),
};

function haystack(r: Recipe): string {
  const parts = [r.name, r.desc, r.notes, ...r.ingredients.map((i) => i.name)];
  return parts.join('\n').toLowerCase();
}
//#endregion
