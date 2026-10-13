# 3. In-memory state as source of truth, snapshots on disk

Date: 2026-10-13

## Status

Accepted

## Context

The prototype persisted organs to localStorage, and an earlier attempt persisted over IPC.
Neither was clearly the source of truth. A desktop app needs durable, portable files, but
the UI needs fast, synchronous state.

## Decision

While the app runs, the in-memory application state is the single source of truth. Files on
disk are snapshots of that state: they are written during the app lifecycle by the Electron
main process and loaded into memory on startup. Snapshot formats carry a version number so
older snapshots can be loaded or migrated. The domain never touches files.

## Consequences

- Persistence is an adapter (renderer state ⇄ IPC ⇄ main process ⇄ file system).
- Snapshot location and write timing (e.g. debounced on change, on quit) are decided per slice
  and may refine this ADR.
- localStorage persistence in the prototype is replaced.
