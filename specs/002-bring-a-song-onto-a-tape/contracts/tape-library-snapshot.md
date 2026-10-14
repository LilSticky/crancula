# Contract: Tape library snapshot

The file format of `<userData>/snapshots/tapes.json`, format version 1 (research R7, data model
"Snapshot"). It is also the payload of `tapes:save` and of the `loaded` reply of `tapes:load`
([tape-library-ipc.md](tape-library-ipc.md)).

## What changes on disk

| File | Change |
|------|--------|
| `organs.json` | **none**: still version 1, same shape (001). Organs hold no reference to Tapes. |
| `tapes.json` | **new**, version 1. Absent until the first Tape is created; absence means "no Tapes" (`empty`). |
| `tapes.unreadable-<timestamp>.json` | new: where an unreadable `tapes.json` is moved (ADR 8 pattern). |

Because `organs.json` keeps its format and `tapes.json` starts at version 1, this slice needs **no
migration**. A later format change bumps `version` and adds a migration in the parser
(constitution IV).

## Format, version 1

```ts
interface TapeLibrarySnapshot {
  version: 1;
  songs: SongSnapshot[];   // exactly the Songs referenced by at least one Tape
  tapes: TapeSnapshot[];   // array order = creation order (used for the prefilled Column length, FR-010)
}

interface SongSnapshot {
  id: string;              // UUID
  name: string;            // trimmed, non-empty
  ticksPerQuarter: number; // integer 1–32767
  parts: PartSnapshot[];   // non-empty; order = PartIndex
}

interface PartSnapshot {
  name?: string;           // trimmed, non-empty when present
  percussion: boolean;
  notes: [noteNumber: number, start: number, duration: number][]; // non-empty; Ticks; sorted by start, then noteNumber
}

interface TapeSnapshot {
  id: string;              // UUID
  name: string;            // trimmed, non-empty; not unique
  organId: string;         // UUID; the Organ may be unknown (FR-023)
  songId?: string;         // a Song in this file; always set in this slice
  selectedParts?: number[]; // PartIndex values of that Song; sorted, unique, non-empty; set exactly when songId is
  transposition: number;   // integer −127 to +127
  columnLength: number;    // mm, finite, > 0
  length: number;          // length in Columns, integer ≥ 1
  holes: [pipe: number, start: number, length: number][]; // sorted by pipe, then start; may be empty (FR-021)
}
```

Example: see research R7.

## Parser rules (`parseTapeLibrarySnapshot`)

Rejects the whole snapshot (load: file moved aside; save: `rejected`) when any of these fails:

- `version === 1`; `songs` and `tapes` are lists.
- Song: id is a UUID and unique among Songs; name non-empty after trimming; `ticksPerQuarter` an
  integer 1–32767; at least one Part; every Part has at least one Note; every Note has a
  `noteNumber` 0–127, a `start` and `duration` that are integers ≥ 0 with `start + duration`
  < 2³¹, and the Notes are sorted.
- Tape: id is a UUID and unique among Tapes; name non-empty after trimming; `organId` a UUID;
  `songId` names a Song in the file and `selectedParts` are valid, sorted, unique Parts of it (both
  present or both absent); `transposition` an integer in −127…+127; `columnLength` finite and
  > 0; `length` an integer ≥ 1.
- Holes: `pipe` 0–127; `start` an integer ≥ 0; `length` an integer ≥ 1; `start + length` ≤ the
  Tape's `length`; sorted by `pipe`, then `start`; no overlap within a row.
- Every Song is referenced by at least one Tape.

Not checked (they depend on the Organ, which may have changed or be unreadable): that each Hole's
`pipe` is a Pipe of the Organ, the Minimum Hole Length and the Minimum Gap, that `organId` names a
known Organ.

`toTapeLibrarySnapshot(tapes, songs)` writes Tapes in their order, only the Songs they reference,
Holes sorted, and omits absent optional fields, so the same library always gives the same file.
Round trip: `parse(toTapeLibrarySnapshot(x))` gives `x` back.
