import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/background.js'],
  outfile: 'dist/background.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  minify: true,
});

// Everything else ships as written
cpSync('static', 'dist', { recursive: true });
console.log('Built extension/dist: load it as an unpacked extension (chrome://extensions, Developer mode).');
