// Bundles the Electron main process and the preload script (ADR 4) into app/main.js and app/preload.js.
// The packaged app uses `app/` as its asar root, so `../api` would resolve outside the package;
// bundling pulls the shared domain code (api/) into the two files instead.
import {build} from 'esbuild';

await build({
  entryPoints: ['app/main.ts', 'app/preload.ts'],
  outdir: 'app',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  // Provided by Electron, or only used by `electron . --serve` (dev dependencies).
  external: ['electron', 'electron-debug', 'electron-reloader'],
});
