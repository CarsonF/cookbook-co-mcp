import type { Content } from 'pdfmake/interfaces.js';
import type { Page, PdfLayout } from '../types.js';
import { compactLayout } from './compact.js';
import { detailedLayout } from './detailed.js';
import { fullLayout } from './full.js';
import { minimalLayout } from './minimal.js';

export const LAYOUTS: Record<PdfLayout, (page: Page) => Content[]> = {
  side_by_side_full: fullLayout,
  side_by_side_compact: compactLayout,
  detailed_step_by_step: detailedLayout,
  minimalistic: minimalLayout,
};
