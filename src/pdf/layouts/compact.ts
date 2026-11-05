import type { Content } from 'pdfmake/interfaces.js';
import {
  bar,
  descriptionNode,
  ingredientBlock,
  noteNode,
  nutritionBlock,
  ruled,
  sideBySide,
  stepBlock,
  title,
} from '../blocks.js';
import { photoNode } from '../photos.js';
import { factRuns, factStrings } from '../recipe-content.js';
import type { Page } from '../types.js';

/** Facts in a bar, then ingredients under rules beside a small photo and the steps. */
export function compactLayout(page: Page): Content[] {
  const content: Content[] = [title(page, 'center')];
  const facts = factStrings(page);
  if (facts.length > 0) {
    content.push(bar(factRuns(facts), { alignment: 'center', padding: 5, style: [] }));
  }

  const left: Content[] = [];
  const right: Content[] = [];
  const description = descriptionNode(page);
  if (description) left.push(description);
  const ingredients = ingredientBlock(page);
  if (ingredients.length > 0) left.push(...ruled('Ingredients', 0.2, page), ...ingredients);
  const notes = noteNode(page, 'notes');
  if (notes) left.push(...ruled('Notes', 0.2, page), notes);
  const custom = noteNode(page, 'custom');
  if (custom) left.push(...ruled('Custom', 0.2, page), custom);
  const nutrition = nutritionBlock(page, 100);
  if (nutrition.length > 0) left.push(...ruled('Nutrition', 0.2, page), ...nutrition);

  const photo = photoNode(page, page.recipe.displayphoto, {
    width: 305,
    height: (305 * 450) / 650,
  });
  if (photo) right.push(photo);
  const steps = stepBlock(page);
  if (steps.length > 0) right.push(...ruled('Instructions', 0.3, page), ...steps);
  return [...content, sideBySide(left, right)];
}
