import type { Ingredient, Recipe } from '../../api/index.js';
import type { Scaled } from '../../domain/recipes/scale.js';
import { dropEmpty } from '../shared/output.js';

/** A recipe as an agent reads it: no ids, no empty fields, steps as plain strings. */
export function leanRecipe(recipe: Recipe, tags: string[]) {
  return dropEmpty({
    id: recipe.id,
    name: recipe.name,
    changed: recipe.changed,
    tags,
    serving: recipe.serving,
    preptime: recipe.preptime,
    cooktime: recipe.cooktime,
    othertime: recipe.othertime,
    othertimetype: recipe.othertimetype,
    servingtype: recipe.servingtype,
    desc: recipe.desc,
    source: recipe.source,
    notes: recipe.notes,
    nutrition: recipe.nutrition,
    pairings: recipe.pairings,
    video: recipe.video,
    favourite: recipe.fave,
    rating: recipe.rating,
    cookcount: recipe.cookcount,
    lastcook: recipe.lastcook,
    photo: !PLACEHOLDER_PHOTOS.includes(recipe.displayphoto),
    stepPhotos: recipe.instructions.filter((s) => s.photo).length,
    ingredients: recipe.ingredients.map(leanIngredient),
    instructions: recipe.instructions.map((s) => s.text),
  });
}

/** A list row: the fields needed to choose a recipe; `details` adds the bookkeeping ones. */
export function recipeRow(recipe: Recipe, tags: string[], details = false) {
  return dropEmpty({
    id: recipe.id,
    name: recipe.name,
    tags,
    serving: recipe.serving,
    preptime: recipe.preptime,
    cooktime: recipe.cooktime,
    favourite: recipe.fave,
    rating: recipe.rating,
    ...(details && {
      source: recipe.source,
      created: recipe.created,
      changed: recipe.changed,
      lastcook: recipe.lastcook,
      cookcount: recipe.cookcount,
    }),
  });
}

/** `2 tbsp → 4 tbsp olive oil (extra virgin)`, one string per ingredient. */
export function scaledLines(scaled: Scaled): string[] {
  return scaled.ingredients.map((i) => {
    const amount = i.original && i.original !== i.scaled ? `${i.original} → ${i.scaled}` : i.scaled;
    return `${amount} ${i.name}${i.notes ? ` (${i.notes})` : ''}`.replace(/\s+/g, ' ').trim();
  });
}

//#region helpers
const PLACEHOLDER_PHOTOS = ['', 'chop1.jpg', 'default.png', 'default/default.png'];

function leanIngredient(i: Ingredient) {
  return {
    quantity: i.quantity,
    measure: i.measure,
    name: i.name,
    ...(i.notes && { notes: i.notes }),
    ...(i.group && { group: i.group }),
  };
}
//#endregion
