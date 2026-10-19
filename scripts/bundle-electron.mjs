// Bundles the Electron main process and the preload script (ADR 4, ADR 12): the main process as
// ESM into app/main.mjs, the preload as CommonJS into app/preload.js (a sandboxed preload cannot be ESM).
// The packaged app uses `app/` as its asar root, so `../api` would resolve outside the package;
// bundling pulls the shared domain code (api/) into the two files instead.
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

// Provided by Electron, or only used by `electron . --serve` (dev dependencies).
const external = ['electron', 'electron-debug', 'electron-reloader'];
const common = {bundle: true, platform: 'node', target: 'node22', sourcemap: true, logLevel: 'info', external};

/** Builds main.mjs and preload.js into `outdir`. */
export async function bundleElectron(outdir) {
  await Promise.all([
    build({...common, entryPoints: ['app/main.ts'], outdir, format: 'esm', outExtension: {'.js': '.mjs'}}),
    build({...common, entryPoints: ['app/preload.ts'], outdir, format: 'cjs'}),
  ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await bundleElectron('app');
}
