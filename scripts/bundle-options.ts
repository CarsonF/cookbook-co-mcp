import { fileURLToPath } from 'node:url';
import type { BuildOptions } from 'esbuild';

export const bundleOptions: BuildOptions = {
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'esm',
  banner: {
    js: [
      // firebase's gRPC dependency is CommonJS and calls require("process")
      "import { createRequire } from 'node:module';",
      "import { fileURLToPath } from 'node:url';",
      'const require = createRequire(import.meta.url);',
      // pdfmake is CommonJS and reads __dirname
      'const __filename = fileURLToPath(import.meta.url);',
      "const __dirname = require('node:path').dirname(__filename);",
    ].join(' '),
  },
  loader: { '.ttf': 'base64' },
};
