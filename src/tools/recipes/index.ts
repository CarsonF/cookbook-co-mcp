import type { Tool } from '../define.js';
import { createRecipe } from './create-recipe.js';
import { deleteRecipe } from './delete-recipe.js';
import { exportRecipe } from './export-recipe.js';
import { getRecentRecipes } from './get-recent-recipes.js';
import { getRecipe } from './get-recipe.js';
import { getStepPhoto } from './get-step-photo.js';
import { importRecipeFile } from './import-recipe-file.js';
import { importRecipeFromUrl } from './import-recipe-from-url.js';
import { markCooked } from './mark-cooked.js';
import { rateRecipe } from './rate-recipe.js';
import { removeStepPhoto } from './remove-step-photo.js';
import { renameRecipe } from './rename-recipe.js';
import { scaleRecipeTool } from './scale-recipe.js';
import { searchRecipes } from './search-recipes.js';
import { setFavourite } from './set-favourite.js';
import { setRecipePhoto } from './set-recipe-photo.js';
import { setStepPhoto } from './set-step-photo.js';
import { shareRecipeLink } from './share-recipe-link.js';
import { updateRecipe } from './update-recipe.js';

export const recipeTools: Tool[] = [
  searchRecipes,
  getRecipe,
  getRecentRecipes,
  scaleRecipeTool,
  setRecipePhoto,
  getStepPhoto,
  setStepPhoto,
  removeStepPhoto,
  renameRecipe,
  deleteRecipe,
  shareRecipeLink,
  exportRecipe,
  importRecipeFile,
  importRecipeFromUrl,
  setFavourite,
  rateRecipe,
  createRecipe,
  markCooked,
  updateRecipe,
];
