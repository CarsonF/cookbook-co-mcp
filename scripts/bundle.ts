import { build } from 'esbuild';
import pkg from '../package.json' with { type: 'json' };
import { bundleOptions } from './bundle-options.ts';

await build({
  ...bundleOptions,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/cookbook-mcp.js',
  define: { __VERSION__: JSON.stringify(pkg.version) },
  logLevel: 'info',
});
