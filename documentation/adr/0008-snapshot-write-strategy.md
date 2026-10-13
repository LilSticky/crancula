# 8. Snapshot write strategy

Date: 2026-10-14

## Status

Accepted

## Context

ADR 3 makes files on disk snapshots of the in-memory state, but leaves open where and when they
are written. Organs are stored automatically whenever they are valid, so typing can produce many
valid states per second. The spec requires that the last change is never lost and that unreadable
snapshots are never overwritten.

## Decision

- Snapshots live in `<userData>/snapshots/<aggregate>.json` and carry a format `version`.
  `CRANCULA_USER_DATA` overrides `userData` for tests.
- The renderer sends the full snapshot on every change. The main process coalesces writes: only
  the latest pending snapshot is written, with at most one write in flight and a trailing debounce
  of about 250 ms.
- Writes are atomic: written to a temporary file, then renamed over the target.
- Pending writes are flushed on `before-quit`.
- A snapshot that can't be read on startup is renamed to
  `<aggregate>.unreadable-<timestamp>.json`, the app starts empty, and the user is told where the
  backup is.

## Consequences

- No write storms, no half-written files, and no data loss on normal quit.
- A crash can lose at most the last ~250 ms of changes.
- Every later aggregate (e.g. Tapes) follows the same pattern, and the file logic can be shared.
