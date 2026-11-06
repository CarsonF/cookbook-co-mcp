import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { bundleOptions } from '../scripts/bundle-options.ts';
import type { Recipe } from '../src/api/index.js';
import type { PdfLayout, PdfPhoto } from '../src/pdf/index.js';

const LAYOUTS: PdfLayout[] = [
  'side_by_side_full',
  'side_by_side_compact',
  'detailed_step_by_step',
  'minimalistic',
];
const PHOTO_PATH = '1/photo.png';
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('recipe PDF', () => {
  let dir: string;
  let pdf: typeof import('../src/pdf/index.js');

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'cookbook-pdf-'));
    const outfile = join(dir, 'pdf.mjs');
    await build({
      ...bundleOptions,
      entryPoints: ['src/pdf/index.ts'],
      outfile,
      logLevel: 'silent',
    });
    pdf = await import(pathToFileURL(outfile).href);
  });
  after(() => rm(dir, { recursive: true, force: true }));

  for (const layout of LAYOUTS) {
    it(`renders ${layout}`, async () => {
      const photos = new Map<string, PdfPhoto>([
        [PHOTO_PATH, { data: Buffer.from(PIXEL_PNG, 'base64'), mime: 'image/png' }],
      ]);
      const bytes = await pdf.recipePdf(recipe(), ['Dessert'], { layout, photos });
      const text = Buffer.from(bytes).toString('latin1');
      assert.equal(text.slice(0, 5), '%PDF-');
      assert.match(text.trimEnd(), /%%EOF$/);
      assert.match(text, /\/Type \/Page\b/);
    });
  }

  it('renders concurrent documents', async () => {
    const all = await Promise.all([pdf.recipePdf(recipe(), []), pdf.recipePdf(recipe(), [])]);
    for (const bytes of all) assert.equal(Buffer.from(bytes).toString('latin1', 0, 5), '%PDF-');
  });
});

function recipe(): Recipe {
  return {
    id: 1,
    name: 'Crème brûlée',
    category: [],
    desc: 'A classic custard with a caramelised top.',
    preptime: 20,
    cooktime: 45,
    serving: 4,
    fave: false,
    rating: 4,
    cookcount: 2,
    lastcook: null,
    source: 'https://example.com/creme-brulee',
    notes: 'Chill overnight.',
    created: '2026-01-01T00:00:00.000Z',
    changed: '2026-01-01T00:00:00.000Z',
    video: '',
    nutrition: '',
    pairings: '',
    displayphoto: PHOTO_PATH,
    photos: [],
    links: [],
    ingredientstype: 0,
    othertime: 0,
    othertimetype: '',
    servingtype: 'servings',
    ingredients: [
      { id: 1, quantity: 2, measure: 'cups', name: 'heavy cream', notes: '', group: '' },
      { id: 2, quantity: 5, measure: '', name: 'egg yolks', notes: 'room temperature', group: '' },
    ],
    instructions: [
      { id: 1, item: 1, text: 'Warm the cream.', photo: '' },
      { id: 2, item: 2, text: 'Whisk in the yolks and bake in a water bath.', photo: PHOTO_PATH },
    ],
  };
}
