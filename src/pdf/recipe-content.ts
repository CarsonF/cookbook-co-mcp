import type { Content, ContentText } from 'pdfmake/interfaces.js';
import type { Ingredient, Recipe } from '../api/index.js';
import { splitHeader, unitFor } from '../domain/recipes/edit.js';
import { amount } from '../domain/recipes/scale.js';
import type { Page } from './types.js';

/** `Yield: 6 serves`, `Cook: 30 min`, `Tags: Dinner`: one string per fact. */
export function factStrings(page: Page): string[] {
  const { recipe, scaled, skip } = page;
  if (skip.has('info')) return [];
  const servings = scaled ? scaled.toServings : recipe.serving;
  const type = recipe.servingtype || `serve${recipe.serving === 1 ? '' : 's'}`;
  const tags = skip.has('tags') ? [] : page.tags;
  return [
    servings ? `Yield: ${scaled ? amount(servings) : servings} ${type}` : '',
    recipe.rating ? `Rating: ${recipe.rating}/5` : '',
    recipe.preptime ? `Prep: ${hoursMinutes(recipe.preptime)}` : '',
    recipe.cooktime ? `Cook: ${hoursMinutes(recipe.cooktime)}` : '',
    recipe.othertime ? `${recipe.othertimetype || 'Other'}: ${hoursMinutes(recipe.othertime)}` : '',
    recipe.source ? `Source: ${recipe.source}` : '',
    tags.length > 0 ? `Tags: ${tags.join(', ')}` : '',
  ].filter(Boolean);
}

/** The facts on one line, `Yield: 6 serves | Cook: 30 min`, with the labels bold. */
export function factRuns(facts: string[]): Content[] {
  return facts.flatMap((fact, i): Content[] => {
    const [label, ...rest] = fact.split(':');
    return [
      { text: `${label}:`, bold: true },
      { text: linkify(rest.join(':'), true), bold: false },
      ...(i + 1 < facts.length ? [{ text: ' | ', bold: false }] : []),
    ];
  });
}

/** Ingredient lines clubbed by group, empty when ingredients are excluded. */
export function ingredientGroups(page: Page): IngredientLine[][] {
  const { recipe, scaled, skip } = page;
  if (skip.has('ingredients')) return [];
  const lines = recipe.ingredients.map((ing: Ingredient, i) => {
    const size = scaled
      ? scaled.ingredients[i].scaled
      : `${ing.quantity ? amount(ing.quantity) : ''} ${unitFor(ing.measure, false)}`;
    const text = `${size} ${ing.name}`.replace(/\s+/g, ' ').trim();
    return { group: groupName(ing.group), text: ing.notes ? `${text}, ${ing.notes}` : text };
  });
  return [...clubByGroup(lines).values()];
}

export function renderIngredients(groups: IngredientLine[][], scale: number): Content[] {
  return groups.flatMap((items): Content[] => [
    ...(items[0].group ? [groupHeading(items[0].group, scale)] : []),
    { ul: items.map((item) => ({ text: linkify(item.text) })) },
  ]);
}

/** Steps numbered from 1 under each `Header:` step, like the app's step groups. */
export function stepGroups(recipe: Recipe, scale: number): Content[] {
  const steps: { group: string; text: string }[] = [];
  let group = '';
  for (const step of recipe.instructions) {
    const { header, body } = splitHeader(step.text.replace(/(\*\*|__|~~)/g, ''));
    if (header) group = groupName(header);
    if (body) steps.push({ group, text: body });
  }
  return [...clubByGroup(steps)].flatMap(([name, items]): Content[] => [
    ...(name ? [groupHeading(name, scale)] : []),
    {
      stack: items.map((item, i): ContentText => ({
        text: [{ text: `${i + 1}. `, style: ['bold'] }, { text: linkify(item.text) }],
        margin: [0, (i === 0 ? 1 : 4) * scale, 0, 0],
      })),
    },
  ]);
}

/** Web addresses become blue links; with `shorten` they show only the host name. */
export function linkify(text: string, shorten = false): string | Content[] {
  const parts = text.split(URL_PATTERN);
  if (parts.length === 1) return text;
  return parts
    .map((part, i): Content => {
      if (i % 2 === 0) return part;
      const link = part.toLowerCase().startsWith('www.') ? `https://${part}` : part;
      const shown = shorten ? new URL(link).hostname.replace(/^www\./i, '') : part;
      return { text: shown, link, color: 'blue', decoration: 'underline' };
    })
    .filter((part) => part !== '');
}

//#region helpers
function hoursMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = Math.round(total - hours * 60);
  return `${hours ? `${hours} hr ` : ''}${minutes ? `${minutes} min` : ''}`.trim();
}

interface IngredientLine {
  group: string;
  text: string;
}

function groupName(raw: string): string {
  return raw.replace(/:+$/, '').trim();
}

function groupHeading(name: string, scale: number): Content {
  return { text: [{ text: name }, ': '], style: ['bold'], margin: [0, 4 * scale, 0, 0] };
}

/** Groups items by `group` in order of first appearance, even when a group recurs later. */
function clubByGroup<T extends { group: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return groups;
}

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"]*[^\s<>".,;:!?)'])/gi;
//#endregion
