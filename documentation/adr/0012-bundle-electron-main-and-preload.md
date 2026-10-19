# 12. Bundle the Electron main process and preload

Date: 2026-10-14

## Status

Superseded by [23. ESM main process, CommonJS preload](0023-esm-main-process-commonjs-preload.md)

## Context

The main process uses the shared domain from `api/` at runtime, not only its types. For example,
`app/organ-library-file.ts` validates snapshots with `parseOrganLibrarySnapshot`, and
`app/app-ipc.ts` validates the language with `isLanguage` (ADR 4).

Until now, `tsc -p tsconfig.serve.json` compiled every file next to its source, so `app/main.js`
did `require('../api')`. That works with `npm start` and `npm run electron:local`. In the
packaged app it fails: electron-builder uses `app/` as the asar root, so `../api` points outside
the package. A packaged build crashed on start with "Cannot find module '../api'". Nothing
noticed, because packaging was never tested ([#11](https://github.com/LilSticky/crancula/issues/11)).

We considered three alternatives:
- **Copy `api/*.js` with electron-builder** (`extraResources` or `files`): the copy lands inside
  the asar or under `resources/`, never where `../api` resolves from `main.js`.
- **Change tsc's `rootDir`/`outDir`** to emit `api/` under `app/`: this restructures the output and
  the Node tests (ADR 7), and keeps a tree of loose `.js` files next to the sources.
- **Type-only imports in `app/`**: this would duplicate the validation that `api/` already owns,
  so the main process and the domain could drift apart.

## Decision

We will bundle `app/main.ts` and `app/preload.ts` with esbuild (`scripts/bundle-electron.mjs`)
into `app/main.js` and `app/preload.js`, in CommonJS for Node.

- The bundles inline `api/` and the other `app/` modules.
- `electron`, `electron-debug` and `electron-reloader` stay external.
- `tsc -p tsconfig.serve.json` is only a type check (`noEmit`).
- `npm run electron:bundle` runs both steps; `build` and `electron:serve` call it.

## Consequences

- The packaged app contains everything the main process and the preload need. A Playwright
  smoke launch of `release/win-unpacked/crancula.exe` showed the window, `window.crancula`, and no
  "Cannot find module" errors.
- The sandboxed preload stays a single file that requires only `electron` (ADR 4).
- esbuild is a pinned devDependency. Angular already brings it in, so nothing new is downloaded.
- The Node tests still import the TypeScript sources, so they don't cover the bundle. Only a
  packaged launch does. That launch belongs in CI with the release builds (#11).
- If a main-process dependency should stay outside the bundle, it must be added to `external`
  explicitly.
