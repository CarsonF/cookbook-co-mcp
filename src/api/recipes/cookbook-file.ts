import { z } from 'zod';
import type { DraftRecipe, Recipe } from './types.js';

/**
 * The bytes of a .cookbook file for a recipe. The app reads a file as a data URL, so the file
 * holds the raw bytes whose base64 is the scrambled string (its own export attaches it as base64).
 */
export function encodeCookbookFile(recipe: Recipe, tagNames: string[]) {
  const base64 = Buffer.from(JSON.stringify(fileBody(recipe, tagNames)), 'utf8').toString('base64');
  return Buffer.from(scramble(base64), 'base64');
}

/**
 * A new recipe draft from a .cookbook file, the tag names it carried,
 * and the photo paths it points at (the draft itself has no photos until they are copied).
 */
export function decodeCookbookFile(content: Buffer) {
  return draftFromFile(parseFile(content));
}

//#region helpers
/**
 * The body of an exported .cookbook file, matching the app's own export:
 * only its save fields, plain tag ids, no `changed`, placeholder units emptied.
 */
function fileBody(recipe: Recipe, tagNames: string[]) {
  return {
    id: recipe.id,
    fave: recipe.fave,
    name: recipe.name,
    desc: recipe.desc,
    preptime: recipe.preptime,
    cooktime: recipe.cooktime,
    serving: recipe.serving,
    displayphoto: recipe.displayphoto,
    source: recipe.source,
    nutrition: recipe.nutrition,
    category: recipe.category.filter((id) => id > 0),
    directions: recipe.instructions.map((d, i) => ({
      id: i,
      item: i,
      itemId: i + 1,
      text: d.text,
      photo: d.photo,
    })),
    ingredients: recipe.ingredients.map((ing, i) => ({
      id: i,
      quantity: ing.quantity,
      measure: ['.', 'x', 'of'].includes(ing.measure) ? '' : ing.measure,
      name: ing.name,
      notes: ing.notes,
      group: ing.group,
    })),
    lastcook: recipe.lastcook,
    ingredientstype: recipe.ingredientstype,
    video: recipe.video,
    notes: recipe.notes,
    cookcount: recipe.cookcount,
    rating: recipe.rating,
    servingtype: recipe.servingtype,
    pairings: recipe.pairings,
    othertime: recipe.othertime,
    othertimetype: recipe.othertimetype,
    links: recipe.links,
    photos: recipe.photos,
    categoryNames: tagNames,
  };
}

/** Accepts the file's bytes (binary, as the app writes them) or its scrambled text form. */
function parseFile(content: Buffer): unknown {
  const asText = content.toString('latin1');
  const scrambled = /^[A-Za-z0-9+/=\s]+$/.test(asText) ? asText : content.toString('base64');
  // like the app: accept a data: URL, and repair a truncated "...|" ending
  let body = scrambled.trim();
  if (body.startsWith('data:')) body = body.slice(body.indexOf(',') + 1);
  let json = Buffer.from(scramble(body), 'base64').toString('utf8');
  if (json.endsWith('|')) json = `${json.slice(0, -1)}}`;
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('Not a valid .cookbook file');
  }
}

/** Swaps letter case and mirrors digits; applying it twice gives the original text. */
function scramble(text: string) {
  return text
    .split('')
    .map((ch) => (/\d/.test(ch) ? String(9 - Number(ch)) : swapCase(ch)))
    .join('');
}

function draftFromFile(file: unknown) {
  const parsed = CookbookFile.safeParse(file);
  if (!parsed.success) throw new Error('Not a recipe: the file has no name');
  const f = parsed.data;

  const draft: DraftRecipe = {
    name: f.name,
    desc: f.desc,
    preptime: f.preptime,
    cooktime: f.cooktime,
    othertime: f.othertime,
    othertimetype: f.othertimetype,
    serving: f.serving || 1,
    servingtype: f.servingtype,
    source: f.source,
    video: f.video,
    nutrition: f.nutrition,
    notes: f.notes,
    pairings: f.pairings,
    displayphoto: '',
    photos: [],
    ingredientstype: f.ingredientstype,
    ingredients: f.ingredients.map((i, n) => ({ ...i, id: n })),
    instructions: (f.directions ?? f.instructions).map((d, n) => ({
      id: n,
      item: n,
      text: d.text,
      photo: '',
    })),
  };
  return {
    draft,
    tagNames: f.categoryNames,
    photoPaths: { display: f.displayphoto, extra: f.photos },
  };
}

// a .cookbook file comes from anywhere, so every field falls back to empty rather than failing
const text = z.string().catch('');

const num = z.coerce.number().catch(0);

const strings = z
  .array(z.unknown())
  .catch([])
  .transform((list) => list.filter((v) => typeof v === 'string'));

const ingredientFile = z.object({
  quantity: z.coerce.number().catch(0),
  measure: text,
  name: text,
  notes: text,
  group: text,
});

const stepFile = z.object({ text });

const CookbookFile = z.object({
  name: z.string().trim().min(1),
  desc: text,
  preptime: num,
  cooktime: num,
  othertime: num,
  othertimetype: text,
  serving: num,
  servingtype: text,
  source: text,
  video: text,
  nutrition: text,
  notes: text,
  pairings: text,
  displayphoto: text,
  photos: strings,
  ingredientstype: num,
  ingredients: z.array(ingredientFile.catch(ingredientFile.parse({}))).catch([]),
  directions: z
    .array(stepFile.catch({ text: '' }))
    .optional()
    .catch(undefined),
  instructions: z.array(stepFile.catch({ text: '' })).catch([]),
  categoryNames: strings,
});

function swapCase(ch: string): string {
  return ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
}
//#endregion
