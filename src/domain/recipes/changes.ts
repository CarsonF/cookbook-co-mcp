import type { Ingredient, Recipe } from '../../api/index.js';

/** Only what differs between two versions of a recipe, e.g. `- 1 tbsp olive oil` / `+ 2 tbsp olive oil`. */
export function describeChanges(before: Recipe, after: Recipe) {
  const out: Record<string, unknown> = {};
  const scalars = [
    'preptime',
    'cooktime',
    'othertime',
    'othertimetype',
    'serving',
    'servingtype',
    'desc',
    'source',
  ] as const;
  for (const key of scalars) {
    if (before[key] !== after[key])
      out[key] = `${before[key] || '(none)'} → ${after[key] || '(none)'}`;
  }
  const ingredients = diffLines(
    before.ingredients.map(ingredientText),
    after.ingredients.map(ingredientText),
  );
  if (ingredients.lines.length > 0) out.ingredients = ingredients;
  const steps = diffLines(
    before.instructions.map((s) => s.text),
    after.instructions.map((s) => s.text),
  );
  if (steps.lines.length > 0) out.instructions = steps;
  const notes = diffLines(before.notes.split('\n'), after.notes.split('\n'));
  if (notes.lines.length > 0) out.notes = notes;
  return out;
}

export function ingredientText(i: Ingredient): string {
  const qty = [i.quantity || '', i.measure, i.name].filter((part) => part !== '');
  return `${qty.join(' ')}${i.notes ? ` (${i.notes})` : ''}${i.group ? ` [${i.group}]` : ''}`;
}

/** Longest-common-subsequence diff: removed (`- `) and added (`+ `) lines, unchanged ones counted. */
function diffLines(before: string[], after: string[]): { lines: string[]; unchanged: number } {
  const n = before.length;
  const m = after.length;
  const common = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      common[i][j] =
        before[i] === after[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const lines: string[] = [];
  let unchanged = 0;
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && before[i] === after[j]) {
      unchanged++;
      i++;
      j++;
    } else if (j < m && (i === n || common[i][j + 1] >= common[i + 1][j])) {
      lines.push(`+ ${after[j++]}`);
    } else {
      lines.push(`- ${before[i++]}`);
    }
  }
  return { lines, unchanged };
}
