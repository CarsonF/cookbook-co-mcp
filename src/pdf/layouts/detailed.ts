import type { Content } from 'pdfmake/interfaces.js';
import {
  descriptionNode,
  heading,
  noteNode,
  nutritionBlock,
  splitColumns,
  stepBlock,
  title,
} from '../blocks.js';
import { imageId, photoNode, sidePhotoPaths } from '../photos.js';
import { factStrings, ingredientGroups, linkify, renderIngredients } from '../recipe-content.js';
import type { Page } from '../types.js';

/** Facts one per line beside a photo, ingredients in two columns, steps with side photos. */
export function detailedLayout(page: Page): Content[] {
  const { recipe, scale } = page;
  const head: Content[] = [{ ...title(page, 'left') }];
  for (const fact of factStrings(page)) {
    const [label, ...rest] = fact.split(':');
    head.push({
      text: [
        { text: `${label}:`, bold: true, style: ['h5'] },
        { text: linkify(rest.join(':'), true) },
      ],
    });
  }
  const description = descriptionNode(page);
  if (description) head.push(description);
  const photo = photoNode(page, recipe.displayphoto, { width: 210, height: 157.5 });
  const content: Content[] = [
    photo
      ? {
          columns: [
            { width: '40%', stack: [photo] },
            { width: '5%', stack: [{ text: '' }] },
            { width: '55%', stack: head },
          ],
        }
      : { stack: head },
  ];

  const padding = 3 * scale;
  const groups = ingredientGroups(page);
  if (groups.length > 0) {
    const count = groups.reduce((n, g) => n + g.length, 0);
    content.push(heading('Ingredients', padding), {
      columns: splitColumns(groups, count / 2).map((column) => ({
        stack: renderIngredients(column, scale),
      })),
    });
  }

  const steps = stepBlock(page);
  if (steps.length > 0) {
    content.push(heading('Instructions', padding));
    const side = sidePhotoPaths(recipe, page.skip).filter((path) => page.photos.has(path));
    content.push(
      side.length === 0
        ? { stack: steps }
        : {
            columns: [
              { width: '70%', stack: steps },
              { width: '5%', stack: [{ text: '' }] },
              {
                width: '20%',
                stack: side.map((path): Content => ({
                  style: ['mt10'],
                  image: imageId(page, path),
                  fit: [125, 10_000],
                })),
              },
            ],
          },
    );
  }
  const notes = noteNode(page, 'notes');
  if (notes) content.push(heading('Notes', padding), notes);
  const custom = noteNode(page, 'custom');
  if (custom) content.push(heading('Custom', padding), custom);
  const nutrition = nutritionBlock(page, 50);
  if (nutrition.length > 0) content.push(heading('Nutrition', padding), ...nutrition);
  return content;
}
