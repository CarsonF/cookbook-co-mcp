import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';

export async function render(definition: TDocumentDefinitions): Promise<Uint8Array> {
  const [{ default: pdfMake }, { FONT_FILES }] = await Promise.all([
    import('pdfmake/build/pdfmake.min.js'),
    import('./fonts/index.js'),
  ]);
  const regular = 'NotoSans-Regular.ttf';
  const bold = 'NotoSans-Bold.ttf';
  // the app's "title" family has no bold file, so headings stay regular weight
  const fonts = {
    body: { normal: regular, bold, italics: regular, bolditalics: bold },
    title: { normal: regular, bold: regular, italics: regular, bolditalics: regular },
  };
  return new Promise((resolve) =>
    pdfMake.createPdf(definition, undefined, fonts, FONT_FILES).getBuffer((buffer: Uint8Array) => {
      resolve(buffer);
    }),
  );
}
