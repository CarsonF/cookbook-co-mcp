import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { Recipe } from '../api/index.js';
import { LAYOUTS } from './layouts/index.js';
import { MAX_SIDE_PHOTOS, sidePhotoPaths } from './photos.js';
import { render } from './render.js';
import { FONT_SCALE, scaledStyles } from './styles.js';
import type { Page, PdfLayout, PdfOptions, PdfSection } from './types.js';

/** A4 recipe page in one of the CookBook app's own PDF layouts, built with the same pdfmake. */
export async function recipePdf(
  recipe: Recipe,
  tags: string[],
  options: PdfOptions = {},
): Promise<Uint8Array> {
  const page: Page = {
    recipe,
    tags,
    scaled: options.scaled,
    skip: new Set(options.exclude ?? []),
    scale: FONT_SCALE[options.fontSize ?? 'regular'],
    photos: options.photos ?? new Map(),
    images: {},
  };
  const content = LAYOUTS[options.layout ?? 'side_by_side_full'](page);

  const definition: TDocumentDefinitions = {
    pageSize: { width: 595, height: 842 },
    pageMargins: [40, 20],
    footer: (current: number, pages: number) => ({
      text: `Page ${current} of ${pages}`,
      alignment: 'center',
      style: 'footer',
    }),
    defaultStyle: { font: 'body', fontSize: 9 * page.scale },
    styles: scaledStyles(page.scale),
    images: page.images,
    content,
  };
  return render(definition);
}

/** Storage paths of the images a layout draws, so they can be fetched first. */
export function photoPaths(
  recipe: Recipe,
  options: { layout?: PdfLayout; exclude?: PdfSection[] } = {},
): string[] {
  const layout = options.layout ?? 'side_by_side_full';
  const paths: string[] = [];
  if (layout !== 'minimalistic' && recipe.displayphoto) paths.push(recipe.displayphoto);
  if (layout === 'detailed_step_by_step') {
    paths.push(...sidePhotoPaths(recipe, new Set(options.exclude ?? [])).slice(0, MAX_SIDE_PHOTOS));
  }
  return [...new Set(paths)];
}
