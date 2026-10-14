# 17. Tape snapshot of its own, written before the Organs

Date: 2026-10-14

## Status

Accepted

## Context

[ADR 3](0003-memory-first-snapshots.md) and [ADR 8](0008-snapshot-write-strategy.md) store each
aggregate as a versioned snapshot `<userData>/snapshots/<aggregate>.json`. They write it
atomically and coalesce writes, and move an unreadable file aside. ADR 8 expects later aggregates
such as Tapes to follow the same pattern, with shared file logic.

Slice 002 adds Tapes and the Songs they come from. Its spec requires that:
- the Organs stay usable when the stored Tapes can't be read (FR-023);
- a Tape and the Song it references are kept together (FR-016);
- deleting an Organ removes its Tapes (FR-020);
- removing a Pipe removes its Holes from the Tapes (FR-021).

Organs and Tapes therefore change together in some operations, but must not fail together when
one file is damaged.

## Decision

- Tapes and the Songs they reference live in one snapshot file of their own,
  `<userData>/snapshots/tapes.json` (format version 1), separate from `organs.json`. The file
  holds exactly the Songs that at least one Tape references. `organs.json` is unchanged.
- Main exposes the file over two allow-listed channels, `tapes:load` and `tapes:save`, as for
  the Organs. Main validates every payload with `parseTapeLibrarySnapshot`, which checks no
  Organ-relative rule.
- When a change affects both aggregates, the renderer writes **Tapes before Organs**. The Organ
  change is saved only after the Tape write succeeded. While the Tapes can't be read, the
  renderer refuses to delete an Organ or to save one with removed Pipes.
- The load, coalesce, atomic-write and quarantine logic of `app/organ-library-file.ts` moves to a
  generic `app/snapshot-file.ts`. The Organ file and the Tape file are thin configurations of it,
  and both are flushed before quit.

## Consequences

- A damaged `tapes.json` is moved aside to `tapes.unreadable-<timestamp>.json` and the Organs keep
  working. A Tape and its Song are always written in one atomic write.
- No migration is needed: `organs.json` keeps version 1.
- The two files are not written atomically together. If the app crashes between the Tape write
  and the Organ write, the Tapes or Holes are already gone but the Organ is unchanged. The user
  asked for that removal anyway. The reverse order could leave Tapes without their Organ, so we
  don't use it.
- Some Organ edits depend on the Tapes being readable. This is a small restriction, explained to
  the user in a message.
- One copy of the snapshot-file logic serves every aggregate. Later aggregates add a
  configuration, not a copy.
- The whole Tape snapshot (a few MB at most) crosses IPC on every change. That is acceptable
  because Tapes change only on create, remove and the cascades.
