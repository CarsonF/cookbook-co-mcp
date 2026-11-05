import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { PdfFontSize } from './types.js';

export const ACCENT = '#1d9fbb';

export const FONT_SCALE: Record<PdfFontSize, number> = {
  small: 0.75,
  medium: 0.88,
  regular: 1,
  large: 1.25,
  xlarge: 1.5,
};

/** Font sizes and margins scale together, as in the app. */
export function scaledStyles(scale: number): TDocumentDefinitions['styles'] {
  return Object.fromEntries(
    Object.entries(STYLES).map(([name, style]) => [
      name,
      {
        ...style,
        ...(style.fontSize ? { fontSize: style.fontSize * scale } : {}),
        ...(style.margin ? { margin: style.margin.map((m) => m * scale) as Margin } : {}),
      },
    ]),
  );
}

//#region helpers
type Margin = [number, number, number, number] | [number, number];

const STYLES: Record<string, { fontSize?: number; margin?: Margin } & Record<string, unknown>> = {
  h1: {
    font: 'title',
    fontSize: 18,
    bold: true,
    margin: [0, 5, 0, 5],
    alignment: 'left',
    lineHeight: 1,
  },
  h4: {
    font: 'title',
    fontSize: 11,
    bold: true,
    margin: [0, 5, 0, 5],
    alignment: 'left',
    lineHeight: 1,
  },
  h5: {
    font: 'title',
    fontSize: 9,
    bold: true,
    margin: [0, 5, 0, 5],
    alignment: 'left',
    lineHeight: 1,
  },
  bold: { bold: true },
  mt10: { margin: [0, 10, 0, 0] },
  mbt10: { margin: [0, 10] },
  mb5: { margin: [0, 0, 0, 5] },
  footer: { font: 'title', fontSize: 8, color: 'grey', alignment: 'center', margin: [0, 5, 0, 5] },
};
//#endregion
