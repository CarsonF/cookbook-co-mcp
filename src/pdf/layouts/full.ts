import type { Content } from 'pdfmake/interfaces.js';
import {
  descriptionNode,
  heading,
  ingredientBlock,
  noteNode,
  nutritionBlock,
  sideBySide,
  stepBlock,
  title,
} from '../blocks.js';
import { photoNode } from '../photos.js';
import { factRuns, factStrings } from '../recipe-content.js';
import type { Page } from '../types.js';

/** Title, facts, wide photo, then ingredients and nutrition beside steps and notes. */
export function fullLayout(page: Page): Content[] {
  const content: Content[] = [title(page, 'center')];
  const facts = factStrings(page);
  if (facts.length > 0)
    content.push({ text: factRuns(facts), alignment: 'center', style: ['mt10'] });
  const photo = photoNode(page, page.recipe.displayphoto, { width: 500, height: 275 });
  if (photo) content.push(photo);
  const description = descriptionNode(page);
  if (description) content.push(description);

  const left: Content[] = [];
  const right: Content[] = [];
  const ingredients = ingredientBlock(page);
  if (ingredients.length > 0) left.push(heading('Ingredients', 5), ...ingredients);
  const nutrition = nutritionBlock(page, 100);
  if (nutrition.length > 0) left.push(heading('Nutrition', 5), ...nutrition);
  const steps = stepBlock(page);
  if (steps.length > 0) right.push(heading('Instructions', 5), ...steps);
  const notes = noteNode(page, 'notes');
  if (notes) right.push(heading('Notes', 5), notes);
  const custom = noteNode(page, 'custom');
  if (custom) right.push(heading('Custom', 5), custom);
  return [...content, sideBySide(left, right)];
}
