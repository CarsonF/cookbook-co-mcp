import type { Content } from 'pdfmake/interfaces.js';
import {
  descriptionNode,
  ingredientBlock,
  noteNode,
  nutritionBlock,
  ruled,
  stepBlock,
  title,
} from '../blocks.js';
import { factRuns, factStrings } from '../recipe-content.js';
import type { Page } from '../types.js';

/** Plain single column: sections under a rule, no photo. */
export function minimalLayout(page: Page): Content[] {
  const content: Content[] = [title(page, 'center')];
  const facts = factStrings(page);
  if (facts.length > 0)
    content.push({ text: factRuns(facts), alignment: 'center', style: ['mt10'] });
  const description = descriptionNode(page);
  if (description) content.push(description);

  const body: Content[] = [];
  const ingredients = ingredientBlock(page);
  if (ingredients.length > 0) body.push(...ruled('Ingredients', 0.45, page), ...ingredients);
  const steps = stepBlock(page);
  if (steps.length > 0) body.push(...ruled('Instructions', 0.45, page), ...steps);
  const nutrition = nutritionBlock(page, 50);
  if (nutrition.length > 0) body.push(...ruled('Nutrition', 0.45, page), ...nutrition);
  const notes = noteNode(page, 'notes');
  if (notes) body.push(...ruled('Notes', 0.45, page), notes);
  const custom = noteNode(page, 'custom');
  if (custom) body.push(...ruled('Custom', 0.45, page), custom);
  return [...content, { stack: body }];
}
