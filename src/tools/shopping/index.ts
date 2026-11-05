import type { Tool } from '../define.js';
import { addPlannedMealsToShoppingList } from './add-planned-meals-to-shopping-list.js';
import { addRecipeToShoppingList } from './add-recipe-to-shopping-list.js';
import { addToShoppingList } from './add-to-shopping-list.js';
import { checkItems } from './check-items.js';
import { clearCompleted } from './clear-completed.js';
import { createShoppingList } from './create-shopping-list.js';
import { deleteShoppingList } from './delete-shopping-list.js';
import { forgetAisle } from './forget-aisle.js';
import { getShoppingList } from './get-shopping-list.js';
import { listLearnedAisles } from './list-learned-aisles.js';
import { listShoppingLists } from './list-shopping-lists.js';
import { removeItems } from './remove-items.js';
import { setItemAisle } from './set-item-aisle.js';
import { teachAisle } from './teach-aisle.js';
import { uncheckItems } from './uncheck-items.js';

export const shoppingTools: Tool[] = [
  listShoppingLists,
  getShoppingList,
  addToShoppingList,
  addRecipeToShoppingList,
  addPlannedMealsToShoppingList,
  checkItems,
  uncheckItems,
  removeItems,
  setItemAisle,
  teachAisle,
  listLearnedAisles,
  forgetAisle,
  clearCompleted,
  createShoppingList,
  deleteShoppingList,
];
