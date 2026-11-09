import ms from 'ms';
import { randomBytes } from 'node:crypto';
import { type Http, retryPost } from '../core/http.js';
import type { RestClient } from '../core/rest.js';

const MEDIA_ROOT = 'https://media.cookbookmanager.com';
const TRANSFER_TIMEOUT_MS = ms('90s');

export class ImagesApi {
  constructor(
    private readonly rest: RestClient,
    private readonly http: Http,
  ) {}

  /** Uploads image bytes; returns the `<user>/<key>.<ext>` path recipes refer to it by. */
  async upload(bytes: Uint8Array, ext: string) {
    // the server signs an S3 form for a client-chosen filename
    const { url, data } = await this.rest.request<{ url: string; data: Record<string, string> }>(
      'GET',
      'user/recipe/recipe/image',
      { query: { image: `${randomBytes(16).toString('hex')}.${ext}` } },
    );

    // the signed key is a prefix: the app appends the extension itself
    data.key = `${data.key}.${ext}`;
    const form = new FormData();
    for (const [name, value] of Object.entries(data)) form.append(name, String(value));
    // S3 requires the file to be the last field
    form.append('file', new Blob([new Uint8Array(bytes)]), `upload.${ext}`);
    // S3 rejects chunked bodies (HTTP 411), so buffer the form to send an explicit Content-Length
    const encoded = new Response(form);
    const body = Buffer.from(await encoded.arrayBuffer());
    const res = await this.http.post(url, {
      body,
      headers: { 'content-type': encoded.headers.get('content-type') ?? '' },
      responseType: 'text',
      timeout: { request: TRANSFER_TIMEOUT_MS },
      ...retryPost,
    });
    const key = /<Key>([^<]+)<\/Key>/.exec(res.body)?.[1];
    if (res.statusCode !== 201 || !key) {
      throw new Error(`Image upload failed: HTTP ${res.statusCode}`);
    }
    return key;
  }

  /** The bytes of an uploaded image by its `<user>/<key>.<ext>` path, or undefined if missing. */
  async download(path: string) {
    try {
      const res = await this.http(`${MEDIA_ROOT}/${path}`, {
        responseType: 'buffer',
        timeout: { request: ms('15s') },
      });
      return res.ok ? res.body : undefined;
    } catch {
      return undefined;
    }
  }
}
