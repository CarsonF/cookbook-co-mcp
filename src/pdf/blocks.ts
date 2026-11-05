import type { Content, ContentText } from 'pdfmake/interfaces.js';
import { nutritionTable } from './nutrition.js';
import { ingredientGroups, linkify, renderIngredients, stepGroups } from './recipe-content.js';
import { ACCENT } from './styles.js';
import type { Page } from './types.js';

export function title(page: Page, alignment: 'left' | 'center'): ContentText {
  return { text: page.recipe.name, alignment, style: ['h1'] };
}

export function sideBySide(left: Content[], right: Content[]): Content {
  return right.length === 0
    ? { stack: left }
    : {
        columns: [
          { width: '35%', stack: left },
          { width: '5%', stack: [{ text: '' }] },
          { width: '60%', stack: right },
        ],
      };
}

export function descriptionNode(page: Page): Content | undefined {
  const { desc } = page.recipe;
  return desc && !page.skip.has('description')
    ? { text: linkify(desc), alignment: 'left', style: ['mt10'] }
    : undefined;
}

export function noteNode(page: Page, which: 'notes' | 'custom'): Content | undefined {
  const text = which === 'notes' ? page.recipe.notes : page.recipe.pairings;
  return text.trim() && !page.skip.has(which) ? { text: linkify(text) } : undefined;
}

export function ingredientBlock(page: Page): Content[] {
  return renderIngredients(ingredientGroups(page), page.scale);
}

export function stepBlock(page: Page): Content[] {
  return page.skip.has('directions') ? [] : stepGroups(page.recipe, page.scale);
}

export function nutritionBlock(page: Page, width: number): Content[] {
  return page.skip.has('nutrition') ? [] : nutritionTable(page.recipe.nutrition, width);
}

/** A section title over a thin rule, `fraction` of the page width long. */
export function ruled(title: string, fraction: number, page: Page): Content[] {
  return [
    {
      text: title,
      alignment: 'left',
      style: ['h4'],
      margin: [0, 10 * page.scale, 0, 0],
    },
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 1,
          x2: 595 * fraction,
          y2: 1,
          lineWidth: page.scale,
          lineColor: '#323232',
        },
      ],
      style: ['mb5'],
    },
  ];
}

/** Splits groups into two columns of about equal length, like the app. */
export function splitColumns<T extends { group: string }>(groups: T[][], target: number): T[][][] {
  const total = groups.reduce((n, g) => n + g.length, 0);
  const size = Math.min(Math.max(target, 1), Math.ceil(total / 2));
  if (groups.length === 1) {
    const [only] = groups;
    const rest = only.slice(size).map((item) => ({ ...item, group: '' }));
    return [[only.slice(0, size)], ...(rest.length > 0 ? [[rest]] : [])];
  }
  let seen = 0;
  let best = Number.MAX_VALUE;
  for (let i = 0; i < groups.length; i++) {
    seen += groups[i].length;
    const distance = Math.abs(seen - size);
    if (distance < best) best = distance;
    else return [groups.slice(0, i), groups.slice(i)];
  }
  return [groups];
}

/** A filled bar holding `text`, the app's section header. */
export function bar(
  text: Content[],
  options: { alignment: 'left' | 'center'; padding: number; style?: string[] },
): Content {
  const { padding } = options;
  return {
    table: {
      widths: '*',
      body: [
        [
          {
            unbreakable: true,
            border: [] as unknown as [boolean, boolean, boolean, boolean],
            fillColor: ACCENT,
            color: '#ffffff',
            text,
          },
        ],
      ],
    },
    layout: {
      paddingLeft: () => padding,
      paddingRight: () => padding,
      paddingTop: () => padding,
      paddingBottom: () => padding,
    },
    alignment: options.alignment,
    style: options.style ?? [],
  };
}

export function heading(title: string, padding: number): Content {
  return bar([{ text: title, alignment: 'left', style: ['h4'] }], {
    alignment: 'left',
    padding,
    style: ['mbt10'],
  });
}
