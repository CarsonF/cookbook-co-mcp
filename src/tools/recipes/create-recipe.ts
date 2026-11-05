import { z } from 'zod';
import type { Recipe } from '../../api/index.js';
import {
  ambiguousOunces,
  isDrink,
  render,
  toIngredients,
  toInstructions,
} from '../../domain/recipes/edit.js';
import { uploadImage } from '../../files/image-source.js';
import { defineTool } from '../define.js';
import { unknownTagsParam } from '../shared/inputs.js';
import { fail, json, jsonWithText } from '../shared/output.js';
import { settleTags, tagDecision } from '../shared/tags.js';
import { canonicalize, toTitleCase } from '../shared/text.js';

export const createRecipe = defineTool({
  name: 'create_recipe',
  description:
    'Create a recipe from details you have already read or been given, for example from a PDF, ' +
    'a photo of a recipe card or pasted text: read the source yourself, then pass the fields here. ' +
    'Without apply=true nothing is saved and the recipe is returned for review. ' +
    'Use short units (tbsp, tsp, cup, oz, lb, fl oz), "" for bare counts, decimal quantities. ' +
    'Instruction text supports **bold**, __italics__, ~~strikethrough~~; ' +
    'a step may start with a section header line ending in a colon. ' +
    'Refuses a recipe with the same name as an existing one unless allow_duplicate is set.',
  hints: [],
  inputSchema: {
    name: z.string().trim().min(3).max(256).describe('The recipe title'),
    ingredients: z
      .array(
        z.object({
          quantity: z.number().min(0).describe('Decimal, e.g. 0.5 not 1/2; 0 if unspecified'),
          measure: z.string().max(50).describe('Short unit; "" for none'),
          name: z.string().max(255),
          notes: z.string().max(255).optional().describe('Prep detail, e.g. "chopped"'),
          group: z.string().max(50).optional().describe('Section heading, e.g. "For the sauce"'),
        }),
      )
      .min(1)
      .max(200)
      .describe('The complete ingredient list, in the order of the source'),
    instructions: z.array(z.string().max(10240)).min(1).max(100).describe('One string per step'),
    servings: z.number().min(1).max(1000).default(4).describe('How many servings the amounts make'),
    preptime: z.number().int().min(0).max(5999).default(0).describe('Minutes'),
    cooktime: z.number().int().min(0).max(5999).default(0).describe('Minutes'),
    othertime: z.number().int().min(0).max(5999).default(0).describe('Minutes, e.g. chilling'),
    othertimetype: z.string().max(50).default('').describe('Label for othertime'),
    desc: z.string().max(1024).default('').describe('A short description'),
    notes: z.string().max(10240).default('').describe('Tips or anything else from the source'),
    source: z
      .string()
      .max(500)
      .default('')
      .describe('Where the recipe came from, e.g. a URL or book'),
    photo: z
      .string()
      .optional()
      .describe('Absolute path or http(s) URL of an image to use as the recipe photo'),
    tags: z.array(z.string()).default([]).describe('Tag names; new ones are made Title Case'),
    unknown_tags: unknownTagsParam,
    allow_duplicate: z
      .boolean()
      .default(false)
      .describe('Create it even if a recipe with this name exists'),
    apply: z.boolean().default(false).describe('false previews only; true saves the recipe'),
  },
  run: async (input, { client }, mcp) => {
    const [recipes, known] = await Promise.all([client.recipes.list(true), client.tags.list(true)]);
    const same = recipes.find((r) => r.name.toLowerCase() === input.name.toLowerCase());
    if (same && !input.allow_duplicate) {
      return fail(
        `A recipe named "${same.name}" already exists (id ${same.id}); pass allow_duplicate to add another`,
      );
    }
    const settled = await settleTags(
      mcp,
      canonicalize(
        input.tags,
        known.map((t) => t.name),
        toTitleCase,
      ),
      known,
      input.unknown_tags,
      input.apply,
    );
    if (settled.input) return settled.input;
    if (settled.refuse) return fail(settled.refuse);

    const draft = {
      name: input.name,
      desc: input.desc,
      preptime: input.preptime,
      cooktime: input.cooktime,
      othertime: input.othertime,
      othertimetype: input.othertimetype,
      serving: input.servings,
      servingtype: '',
      source: input.source,
      video: '',
      nutrition: '',
      notes: input.notes,
      pairings: '',
      displayphoto: '',
      photos: [],
      ingredientstype: 0,
      ingredients: toIngredients(input.ingredients),
      instructions: toInstructions(input.instructions, []),
    };
    const wantedIds = known.filter((t) => settled.tags.includes(t.name)).map((t) => t.id);
    const drink = isDrink({ name: draft.name, category: wantedIds }, known);
    const warnings = (drink ? [] : ambiguousOunces(draft.ingredients)).map(
      (line) => `"${line}" reads as weight; use fl oz if it is a liquid measure`,
    );
    if (!input.apply) {
      return jsonWithText(
        {
          applied: false,
          name: draft.name,
          tags: settled.tags,
          ...(settled.skipped.length > 0 && { skippedTags: settled.skipped }),
          ...(settled.pending.length > 0 && { decision: tagDecision(settled.pending) }),
          photo: input.photo ? 'will be uploaded' : 'none',
          warnings,
          preview: render(draft as unknown as Recipe),
        },
        ['preview'],
      );
    }

    let photo = 'none';
    if (input.photo) {
      try {
        draft.displayphoto = await uploadImage(client, input.photo);
        photo = 'uploaded';
      } catch (err) {
        photo = `not added: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    const saved = await client.recipes.create(draft, settled.tags);
    return json({
      applied: true,
      id: saved.id,
      name: saved.name,
      changed: saved.changed,
      tags: settled.tags,
      photo,
      warnings,
    });
  },
});
