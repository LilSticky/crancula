# 4. Strict Electron process boundary

Date: 2026-10-13

## Status

Accepted

## Context

The prototype's `ElectronService` used `window.require` for `ipcRenderer`, `fs` and
`child_process`, while `app/main.ts` enabled neither `nodeIntegration` nor an existing preload
script, so it could not work as written. It would also give the renderer full Node access.

## Decision

`contextIsolation` is on and `nodeIntegration` is off. The renderer reaches the main process
only through a typed preload API that exposes an allow-list of channels. Every IPC payload is
validated on the receiving side against the shared `@api` types. `window.require` and direct
Node access in the renderer are removed.

## Consequences

- Each slice that needs the main process adds a typed channel and a test for it.
- Angular code depends on a typed API interface, which can be faked in tests and in the browser
  dev server.
