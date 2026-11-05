import got from 'got';
import ms from 'ms';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { CookbookClient } from '../api/index.js';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** Uploads a local image path or public URL; returns its `<user>/<key>.<ext>` path. */
export async function uploadImage(client: CookbookClient, source: string) {
  const { bytes, ext } = await readImage(source);
  return client.images.upload(bytes, ext);
}

/** Local absolute path or public http(s) URL; the type comes from the file's magic bytes. */
export async function readImage(source: string) {
  let bytes: Uint8Array;
  if (/^https?:\/\//i.test(source)) {
    bytes = await download(new URL(source));
  } else {
    if (!isAbsolute(source)) throw new Error('Image path must be absolute');
    if ((await stat(source)).size > MAX_IMAGE_BYTES) throw new Error('Image is larger than 15 MB');
    bytes = await readFile(source);
  }
  const ext = sniffImage(bytes);
  if (!ext) throw new Error('Not a jpg, png or webp image');
  return { bytes, ext };
}

//#region helpers
async function download(url: URL) {
  assertPublicHost(url);
  const abort = new AbortController();
  let tooLarge = false;
  const stop = () => {
    tooLarge = true;
    abort.abort();
  };
  const request = got(url, {
    responseType: 'buffer',
    maxRedirects: MAX_REDIRECTS,
    timeout: { request: ms('90s') },
    signal: abort.signal,
    hooks: { beforeRedirect: [(options) => assertPublicHost(options.url as URL)] },
  });
  request.on('response', (res) => {
    if (Number(res.headers['content-length']) > MAX_IMAGE_BYTES) stop();
  });
  request.on('downloadProgress', ({ transferred }) => {
    if (transferred > MAX_IMAGE_BYTES) stop();
  });
  try {
    return (await request).body;
  } catch (err) {
    if (tooLarge) throw new Error('Image is larger than 15 MB');
    throw new Error(`Could not download image: ${err instanceof Error ? err.message : err}`);
  }
}

function sniffImage(bytes: Uint8Array): 'jpg' | 'png' | 'webp' | undefined {
  const at = (i: number) => bytes[i];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'png';
  const riff = Buffer.from(bytes.subarray(0, 12)).toString('latin1');
  return riff.startsWith('RIFF') && riff.endsWith('WEBP') ? 'webp' : undefined;
}

/** Refuses loopback, link-local and private-network hosts so a URL cannot reach the LAN. */
function assertPublicHost(url: URL): void {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateV4 = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  const privateV6 = /^(::1?$|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/;
  const local = host === 'localhost' || /\.(local|localhost|internal|lan)$/.test(host);
  if (local || privateV4.test(host) || privateV6.test(host)) {
    throw new Error(`Refusing to fetch an image from a local or private address: ${host}`);
  }
}
//#endregion
