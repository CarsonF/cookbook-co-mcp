import type { Content } from 'pdfmake/interfaces.js';
import type { Recipe } from '../api/index.js';
import type { Page, PdfPhoto, PdfSection } from './types.js';

/** Fetches each path once; ones that are missing or not JPEG or PNG are left out. */
export async function fetchPhotos(
  download: (path: string) => Promise<Uint8Array | undefined>,
  paths: string[],
): Promise<Map<string, PdfPhoto>> {
  const found = await Promise.all(
    paths.map(async (path) => [path, await fetchPhoto(download, path)] as const),
  );
  return new Map(found.flatMap(([path, photo]) => (photo ? [[path, photo] as const] : [])));
}

export const MAX_SIDE_PHOTOS = 12;

/** The photo cropped to fill `size`, or nothing when it was not fetched. */
export function photoNode(
  page: Page,
  path: string,
  size: { width: number; height: number },
): Content | undefined {
  if (!page.photos.has(path)) return undefined;
  return {
    style: ['mt10'],
    image: imageId(page, path),
    ...size,
    cover: { ...size, align: 'center', valign: 'center' },
  };
}

export function imageId(page: Page, path: string): string {
  const photo = page.photos.get(path)!;
  const id = `img:${path}`;
  page.images[id] = `data:${photo.mime};base64,${photo.data.toString('base64')}`;
  return id;
}

/** Extra photos, then step photos: the ones the detailed layout shows beside the steps. */
export function sidePhotoPaths(recipe: Recipe, skip: Set<PdfSection>): string[] {
  const extra = skip.has('info')
    ? []
    : recipe.photos.filter((p): p is string => typeof p === 'string');
  const steps = skip.has('step_photos') ? [] : recipe.instructions.map((s) => s.photo);
  return [...extra, ...steps].filter(Boolean);
}

/** The image at `path` if it is a JPEG or PNG, the only formats PDFs embed directly. */
export async function fetchPhoto(
  download: (path: string) => Promise<Uint8Array | undefined>,
  path: string,
): Promise<PdfPhoto | undefined> {
  if (!/^\d+\/[A-Za-z0-9_-]+\.(jpe?g|png)$/i.test(path)) return undefined;
  const data = await download(path);
  if (data?.subarray(0, 3).every((b, i) => b === [0xff, 0xd8, 0xff][i])) {
    return { data: Buffer.from(data), mime: 'image/jpeg' };
  }
  if (data?.subarray(0, 4).every((b, i) => b === [0x89, 0x50, 0x4e, 0x47][i])) {
    return { data: Buffer.from(data), mime: 'image/png' };
  }
  return undefined;
}
