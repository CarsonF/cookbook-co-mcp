import { z } from 'zod';

export const recipeId = z
  .number()
  .int()
  .describe('Recipe id from search_recipes, get_recipe or get_recent_recipes');

export const tagId = z.number().int().describe('Tag id from list_tags');

export const changedStamp = z.string().describe("The recipe's `changed` value from get_recipe");

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => new Date(`${value}T00:00:00Z`).toISOString().startsWith(value), {
    message: 'Not a real calendar date',
  })
  .describe('YYYY-MM-DD');

export const unknownTagsParam = z
  .enum(['ask', 'create', 'skip'])
  .default('ask')
  .describe(
    'What to do with tag names that do not exist: ask (the default) asks the user, ' +
      'create makes them, skip leaves them off',
  );
