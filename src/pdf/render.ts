import type { TCreatedPdf, TDocumentDefinitions } from 'pdfmake/interfaces.js';

export async function render(definition: TDocumentDefinitions): Promise<Uint8Array> {
  const pdfMake = await configuredPdfMake();
  const pdf: TCreatedPdf = pdfMake.createPdf(definition);
  return pdf.getBuffer();
}

//#region setup

let configured: ReturnType<typeof configure> | undefined;

function configuredPdfMake() {
  return (configured ??= configure());
}

async function configure() {
  const [{ default: pdfMake }, { FONT_FILES }] = await Promise.all([
    import('pdfmake'),
    import('./fonts/index.js'),
  ]);
  const regular = 'NotoSans-Regular.ttf';
  const bold = 'NotoSans-Bold.ttf';
  // the Node entry only reads fonts by name, from disk or its in-memory file system
  const { virtualfs } = pdfMake as unknown as { virtualfs: VirtualFileSystem };
  for (const [name, base64] of Object.entries(FONT_FILES)) {
    virtualfs.writeFileSync(name, Buffer.from(base64, 'base64'));
  }
  // the app's "title" family has no bold file, so headings stay regular weight
  pdfMake.setFonts({
    body: { normal: regular, bold, italics: regular, bolditalics: bold },
    title: { normal: regular, bold: regular, italics: regular, bolditalics: regular },
  });
  // fonts are in memory and photos are inlined as data URIs, so nothing is read or downloaded
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.setLocalAccessPolicy(() => false);
  return pdfMake;
}

interface VirtualFileSystem {
  writeFileSync(name: string, content: Buffer): void;
}

//#endregion
