# 23. ESM main process, CommonJS preload

Date: 2026-10-19

## Status

Accepted

## Context

[ADR 12](0012-bundle-electron-main-and-preload.md) bundles `app/main.ts` and `app/preload.ts` with
esbuild into CommonJS, so that the packaged app contains the shared domain from `api/`. Bundling
still fits. CommonJS for the main process no longer does: `electron-reloader` 2.x is pure ESM, needs
an ESM main process and takes `import.meta` instead of `module`. ADR 14 holds it on 1.x until the main
process loads ESM ([#47](https://github.com/LilSticky/crancula/issues/47)).

Electron 44 loads an ESM main process. A sandboxed preload (ADR 4, `sandbox: true`) can't be ESM:
Electron only runs CommonJS preloads in the sandbox.

## Decision

We will keep bundling as ADR 12 describes, with two output formats:

- The main process is bundled as ESM into `app/main.mjs`. Both `package.json` files name it as
  `main`. It uses `import.meta.dirname` instead of `__dirname`.
- The preload stays a single CommonJS file, `app/preload.js`, so the sandbox stays on.
- `scripts/bundle-electron.mjs` exports `bundleElectron(outdir)`. A Node test bundles into a temporary
  folder and checks both formats and the externals (`electron`, `electron-debug`, `electron-reloader`).
- `tsconfig.serve.json` type-checks with `module: esnext` and `moduleResolution: bundler`, because
  esbuild resolves the modules, not Node.
- `electron-reloader` moves to 2.x: `reloader(import.meta, {ignore: [/\.ts$/]})` in `--serve` mode.
  A failed import logs a warning instead of crashing. The Dependabot hold on its majors is removed.

This supersedes ADR 12.

## Consequences

- Packages that drop CommonJS can now be used in the main process. The hold mentioned in ADR 14's
  consequences is lifted.
- The bundle shape is tested in seconds (`scripts/bundle-electron.spec.ts`), not only by a packaged
  launch. A Playwright launch of the packaged `crancula.exe` showed the window and `window.crancula`.
- After a change to a main process file, the reloader restarts the app as a new process
  (`app.relaunch()`). The `electron` command exits on the first restart, so `npm start` reports
  `electron:serve` as finished while the app keeps running; quit the app itself.
- Two output formats from one script: if the preload ever needs ESM, the sandbox decision in ADR 4
  must be revisited first.
- A stale `app/main.js` from an older build may remain in a working tree. It is ignored by Git and no
  longer loaded.
