import type { Recipe } from '../api/index.js';
import type { Scaled } from '../domain/recipes/scale.js';

export interface PdfPhoto {
  data: Buffer;
  mime: 'image/jpeg' | 'image/png';
}

/** The app's four full-page styles. */
export const PDF_LAYOUTS = [
  'side_by_side_full',
  'side_by_side_compact',
  'detailed_step_by_step',
  'minimalistic',
] as const;

export type PdfLayout = (typeof PDF_LAYOUTS)[number];

/** The app's "exclude" choices; `info` is yield, times, rating, source and tags. */
export const PDF_SECTIONS = [
  'info',
  'description',
  'notes',
  'nutrition',
  'step_photos',
  'ingredients',
  'directions',
  'custom',
  'tags',
] as const;

export type PdfSection = (typeof PDF_SECTIONS)[number];

export const PDF_FONT_SIZES = ['small', 'medium', 'regular', 'large', 'xlarge'] as const;

export type PdfFontSize = (typeof PDF_FONT_SIZES)[number];

export interface PdfOptions {
  /** Ingredient amounts and yield come from here when the recipe was scaled. */
  scaled?: Scaled;
  /** Fetched images by storage path; see `photoPaths`. */
  photos?: Map<string, PdfPhoto>;
  layout?: PdfLayout;
  exclude?: PdfSection[];
  fontSize?: PdfFontSize;
}

export interface Page {
  recipe: Recipe;
  tags: string[];
  scaled?: Scaled;
  skip: Set<PdfSection>;
  scale: number;
  photos: Map<string, PdfPhoto>;
  /** Image data URIs registered while building, by id. */
  images: Record<string, string>;
}
