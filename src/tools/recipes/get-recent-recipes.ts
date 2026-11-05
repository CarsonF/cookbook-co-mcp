import { z } from 'zod';
import { defineTool } from '../define.js';
import { json } from '../shared/output.js';
import { tagLabels, tagNames } from '../shared/recipes.js';
import { recipeRow } from './output.js';

export const getRecentRecipes = defineTool({
  name: 'get_recent_recipes',
  description:
    "Recent recipes as the app's dashboard shows them: recently viewed, merged with recently edited, newest first.",
  hints: ['readOnly'],
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('Max results (default 10; the app shows 30)'),
    viewed_only: z.boolean().default(false).describe('Ignore edit times, use only views'),
    details: z
      .boolean()
      .default(false)
      .describe('Also return source, created, changed, last cooked and cook count'),
  },
  run: async ({ limit, viewed_only, details }, { client }) => {
    const [recipes, tags, views] = await Promise.all([
      client.recipes.list(),
      client.tags.list(),
      client.recipes.recentViews(),
    ]);
    const names = tagNames(tags);
    const viewedAt = new Map(views.map((v) => [v.id, v.ts]));
    const rows = recipes
      .map((r) => {
        const viewed = viewedAt.get(r.id);
        const edited = Date.parse(`${r.changed.replace(' ', 'T')}Z`) / 1000;
        return { r, viewed, at: viewed_only ? (viewed ?? 0) : Math.max(viewed ?? 0, edited) };
      })
      .filter((row) => row.at > 0)
      .sort((a, b) => b.at - a.at)
      .slice(0, limit);
    return json(
      rows.map(({ r, viewed }) => ({
        ...recipeRow(r, tagLabels(r, names), details),
        ...(viewed && {
          viewed: new Date(viewed * 1000).toISOString().slice(0, 16).replace('T', ' '),
        }),
      })),
    );
  },
});
