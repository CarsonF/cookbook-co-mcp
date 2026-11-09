import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const root = new URL('..', import.meta.url).pathname;

it('uploads with an explicit Content-Length and no chunked encoding', async () => {
  const { outputFiles } = await build({
    stdin: {
      contents: `export { http } from './src/api/core/http.js'; export { ImagesApi } from './src/api/recipes/images.js';`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    packages: 'external',
  });
  const file = join(mkdtempSync(join(root, 'node_modules', '.images-test-')), 'bundle.mjs');
  writeFileSync(file, outputFiles[0].text);
  const { http, ImagesApi } = await import(file);
  let headers: Record<string, unknown> = {};
  const server = createServer((req, res) => {
    headers = req.headers;
    req.resume();
    req.on('end', () => res.writeHead(201).end('<Key>user/abc.png</Key>'));
  });
  server.listen(0);
  await once(server, 'listening');
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    const rest = { request: async () => ({ url, data: { key: 'user/abc' } }) };
    const key = await new ImagesApi(rest, http).upload(new Uint8Array(1000), 'png');
    assert.equal(key, 'user/abc.png');
    assert.ok(Number(headers['content-length']) > 1000);
    assert.equal(headers['transfer-encoding'], undefined);
    assert.match(String(headers['content-type']), /^multipart\/form-data; boundary=/);
  } finally {
    server.close();
  }
});
