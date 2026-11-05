import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import pkg from '../package.json' with { type: 'json' };

const root = fileURLToPath(new URL('..', import.meta.url));

await build({
  absWorkingDir: root,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/cookbook-mcp.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  // firebase's gRPC dependency is CommonJS and calls require("process")
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  loader: { '.ttf': 'base64' },
  define: { __VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'info',
});
