import type { Content } from 'pdfmake/interfaces.js';
import { linkify } from './recipe-content.js';

/** The app's nutrition table: known nutrients as rows, any other line as a full-width row. */
export function nutritionTable(text: string, width: number): Content[] {
  const known: { key: string; value: number }[] = [];
  const other: string[] = [];
  for (const part of text.trim().split(/\n|;|,(?!\d)/)) {
    const line = part
      .replace(/[()]/g, ' ')
      .replace(/([0-9])([a-z])/gi, '$1 $2')
      .replace(/([a-z])([0-9])/gi, '$1 $2')
      .replace(/([0-9]),([0-9]{3})(\D|$)/g, '$1$2$3')
      .replace(/([0-9]),([0-9])/g, '$1.$2')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line) continue;
    const nutrient = parseNutrient(line);
    if (nutrient) known.push(nutrient);
    else other.push(part.trim());
  }
  if (known.length === 0 && other.length === 0) return [];

  const rank = (key: string) => FIRST_NUTRIENTS.indexOf(key);
  known.sort((a, b) =>
    rank(a.key) !== -1 && rank(b.key) !== -1
      ? rank(a.key) - rank(b.key)
      : rank(a.key) !== -1
        ? -1
        : rank(b.key) !== -1
          ? 1
          : a.key.localeCompare(b.key),
  );
  const cell = { margin: [0, 1, 0, 1] as [number, number, number, number] };
  const body = [
    ...known.map(({ key, value }) => [
      { text: NUTRIENTS[key].label, ...cell },
      {
        text: `${value.toFixed(NUTRIENTS[key].decimals)} ${NUTRIENTS[key].unit}`,
        alignment: 'right',
        ...cell,
      },
      { text: '', alignment: 'right', color: '#666', ...cell },
    ]),
    ...other.map((line) => [
      { text: linkify(line), colSpan: 3, margin: [0, 2, 0, 2] as [number, number, number, number] },
      {},
      {},
    ]),
  ];
  const table: Content = {
    table: { headerRows: 0, dontBreakRows: true, widths: ['*', 'auto', 'auto'], body },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === 0 || i === node.table.body.length ? 0 : 1,
      vLineWidth: () => 0,
      hLineColor: () => '#aaa',
      paddingLeft: (i: number) => (i === 0 ? 0 : 8),
      paddingRight: (i: number, node: { table: { widths: unknown[] } }) =>
        i === node.table.widths.length - 1 ? 0 : 8,
    },
  } as Content;
  return [
    width >= 100
      ? table
      : {
          columns: [
            { width: `${width}%`, stack: [table] },
            { width: `${100 - width}%`, text: '' },
          ],
        },
  ];
}

//#region helpers
interface Nutrient {
  label: string;
  unit: 'kcal' | 'g' | 'mg' | 'mcg';
  decimals: number;
  aliases: string[];
}

/** Display order is calories, protein, total fat, carbs, then alphabetical by key. */
const NUTRIENTS: Record<string, Nutrient> = {
  calories: {
    label: 'Calories',
    unit: 'kcal',
    decimals: 0,
    aliases: [
      'calories',
      'calorie',
      'cals',
      'cal',
      'kals',
      'kilojoules',
      'kilojoule',
      'kjs',
      'kj',
      'energy',
    ],
  },
  protein: { label: 'Protein', unit: 'g', decimals: 1, aliases: ['proteins', 'protein'] },
  'total-fat': { label: 'Total fat', unit: 'g', decimals: 1, aliases: ['fats', 'fat'] },
  'saturated-fat': {
    label: 'Saturated fat',
    unit: 'g',
    decimals: 1,
    aliases: ['saturated fats', 'saturated fat', 'saturated-fat', 'saturatedfat'],
  },
  'unsaturated-fat': {
    label: 'Unsaturated fat',
    unit: 'g',
    decimals: 1,
    aliases: ['unsaturated fats', 'unsaturated fat', 'unsaturated-fat', 'unsaturatedfat'],
  },
  'mono-fat': {
    label: 'Mono fat',
    unit: 'g',
    decimals: 1,
    aliases: [
      'mono-unsaturated fat',
      'monounsaturated fat',
      'mono fats',
      'mono fat',
      'mono-fat',
      'mufa',
    ],
  },
  'poly-fat': {
    label: 'Poly fat',
    unit: 'g',
    decimals: 1,
    aliases: [
      'poly-unsaturated fat',
      'polyunsaturated fat',
      'poly fats',
      'poly fat',
      'poly-fat',
      'pufa',
    ],
  },
  'trans-fat': {
    label: 'Trans fat',
    unit: 'g',
    decimals: 1,
    aliases: [
      'trans-unsaturated fat',
      'transunsaturated fat',
      'trans fats',
      'trans fat',
      'trans-fat',
      'tufa',
    ],
  },
  carbs: {
    label: 'Carbs',
    unit: 'g',
    decimals: 1,
    aliases: ['carbohydrates', 'carbohydrate', 'carbs', 'carb'],
  },
  sugars: {
    label: 'Sugars',
    unit: 'g',
    decimals: 1,
    aliases: ['sucroses', 'sucrose', 'sugars', 'sugar'],
  },
  fiber: {
    label: 'Fiber',
    unit: 'g',
    decimals: 1,
    aliases: ['fibers', 'fiber', 'fibres', 'fibre'],
  },
  cholesterol: {
    label: 'Cholesterol',
    unit: 'mg',
    decimals: 0,
    aliases: ['cholesterols', 'cholesterol'],
  },
  sodium: {
    label: 'Sodium',
    unit: 'mg',
    decimals: 0,
    aliases: ['sodiums', 'sodium', 'salts', 'salt'],
  },
  'vitamin-a': { label: 'Vitamin A', unit: 'mcg', decimals: 0, aliases: ['vitamin a', 'vit a'] },
  'vitamin-c': { label: 'Vitamin C', unit: 'mg', decimals: 0, aliases: ['vitamin c', 'vit c'] },
  'vitamin-d': { label: 'Vitamin D', unit: 'mcg', decimals: 0, aliases: ['vitamin d', 'vit d'] },
  'vitamin-e': { label: 'Vitamin E', unit: 'mg', decimals: 0, aliases: ['vitamin e', 'vit e'] },
  'vitamin-k': { label: 'Vitamin K', unit: 'mcg', decimals: 0, aliases: ['vitamin k', 'vit k'] },
  'vitamin-b6': {
    label: 'Vitamin B6',
    unit: 'mg',
    decimals: 1,
    aliases: ['vitamin b 6', 'vitamin b6', 'vit b 6', 'vit b6', 'b 6', 'b6'],
  },
  'vitamin-b12': {
    label: 'Vitamin B12',
    unit: 'mcg',
    decimals: 0,
    aliases: ['vitamin b 12', 'vitamin b12', 'vit b 12', 'vit b12', 'b 12', 'b12'],
  },
  'thiamin-b1': {
    label: 'Thiamin B1',
    unit: 'mg',
    decimals: 1,
    aliases: [
      'thiamine b 1',
      'thiamine b1',
      'thiamin b 1',
      'thiamin b1',
      'thiamine',
      'thiamin',
      'b 1',
      'b1',
    ],
  },
  'riboflavin-b2': {
    label: 'Riboflavin B2',
    unit: 'mg',
    decimals: 1,
    aliases: ['riboflavin b 2', 'riboflavin b2', 'riboflavin', 'b 2', 'b2'],
  },
  'niacin-b3': {
    label: 'Niacin B3',
    unit: 'mg',
    decimals: 1,
    aliases: ['niacin b 3', 'niacin b3', 'niacin', 'b 3', 'b3'],
  },
  'folic-acid-b9': {
    label: 'Folic acid B9',
    unit: 'mcg',
    decimals: 0,
    aliases: [
      'folic acid b 9',
      'folic acid b9',
      'folic acid',
      'folic b 9',
      'folic b9',
      'b 9',
      'b9',
    ],
  },
  calcium: { label: 'Calcium', unit: 'mg', decimals: 0, aliases: ['calciums', 'calcium'] },
  iron: { label: 'Iron', unit: 'mg', decimals: 1, aliases: ['irons', 'iron'] },
  magnesium: { label: 'Magnesium', unit: 'mg', decimals: 0, aliases: ['magnesiums', 'magnesium'] },
  potassium: { label: 'Potassium', unit: 'mg', decimals: 0, aliases: ['potassiums', 'potassium'] },
  zinc: { label: 'Zinc', unit: 'mg', decimals: 1, aliases: ['zincs', 'zinc'] },
  phosphorus: {
    label: 'Phosphorus',
    unit: 'mg',
    decimals: 0,
    aliases: ['phosphoruss', 'phosphorus'],
  },
};

const FIRST_NUTRIENTS = ['calories', 'protein', 'total-fat', 'carbs'];

const UNIT_ALIASES: Record<string, 'g' | 'mg' | 'mcg' | 'kcal' | 'kj' | 'iu'> = {
  g: 'g',
  gm: 'g',
  gram: 'g',
  grams: 'g',
  mg: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  mcg: 'mcg',
  ug: 'mcg',
  μg: 'mcg',
  µg: 'mcg',
  microgram: 'mcg',
  micrograms: 'mcg',
  kcal: 'kcal',
  cal: 'kcal',
  calorie: 'kcal',
  iu: 'iu',
  kj: 'kj',
};

/** Size of each unit in micrograms, to convert between g, mg and mcg. */
const MICROGRAMS = { g: 1e6, mg: 1e3, mcg: 1 };

/** Amount of the nutrient's own unit (mcg or mg) in one international unit. */
const PER_IU: Record<string, number> = { 'vitamin-a': 0.3, 'vitamin-d': 0.025, 'vitamin-e': 0.67 };

function parseNutrient(line: string): { key: string; value: number } | undefined {
  const words = Object.keys(UNIT_ALIASES).join('|');
  for (const [key, nutrient] of Object.entries(NUTRIENTS)) {
    const aliases = nutrient.aliases.map((a) => a.replace(/[-\s]/g, '[-\\s]?')).join('|');
    const match = new RegExp(
      `^(?:(?:total|all|dietary|artificial) )?(?:${aliases})(?: \\((${words})s?\\))?\\s*[-:]?\\s*` +
        `(\\d+\\.?\\d*|\\d*\\.\\d+)(?:\\s*(${words})s?)?\\s?(?:\\(?\\d+(?:\\.\\d+)?\\s?%?\\)?)?$`,
      'i',
    ).exec(line);
    if (!match) continue;
    const unit = UNIT_ALIASES[(match[1] ?? match[3] ?? '').toLowerCase()];
    const raw = parseFloat(match[2]);
    if (nutrient.unit === 'kcal') {
      if (unit && unit !== 'kcal' && unit !== 'kj') continue;
      return { key, value: unit === 'kj' ? raw / 4.184 : raw };
    }
    if (unit === 'kcal' || unit === 'kj') continue;
    if (unit === 'iu') {
      if (!PER_IU[key]) continue;
      return { key, value: raw * PER_IU[key] };
    }
    const from = MICROGRAMS[unit ?? nutrient.unit];
    return { key, value: (raw * from) / MICROGRAMS[nutrient.unit] };
  }
  return undefined;
}
//#endregion
