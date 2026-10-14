# Data Model: Bring a song onto a tape

These are draft domain types, written in pure TypeScript (ADR 2). Names follow
`documentation/DICTIONARY.md`; names marked *(term pending)* wait for the user's approval (see
[research.md, Missing dictionary terms](research.md#missing-dictionary-terms)). Like `Organ` in
slice 001, valid domain objects are immutable and can only be created through the functions named
here or through the snapshot parser.

Folder layout, file names and the exact export list in `api/index.ts` are decided in
/speckit-plan after #13. Existing types are reused: `MidiNoteNumber`, `noteName`, `Millimetres`,
`Organ`, `OrganId`, `Pipe`, `minimumHoleLength` and `Result` from `api/`.

## Value types

| Type | Shape | Invariant |
|------|-------|-----------|
| `SongId` | branded `string` | UUID, like `OrganId` |
| `TapeId` | branded `string` | UUID |
| `Tick` *(term pending)* | branded `number` | integer ≥ 0, < 2³¹ (research R2) |
| `TicksPerQuarter` *(term pending)* | branded `number` | integer 1–32767 (the SMF header's 15 bits) |
| `Column` | branded `number` | integer ≥ 0; a position on the Tape, counted from 0 |
| `ColumnCount` | branded `number` | integer ≥ 1; a length in Columns |
| `Transposition` | branded `number` | integer −127 to +127, in semitones |
| `PartIndex` | branded `number` | integer ≥ 0, < the Song's number of Parts |

A positive length in mm (the Column length) uses the existing `Millimetres` with the rule "> 0",
as the Tape Bed fields do in 001.

## Song (aggregate, created by the MIDI reader)

| Field | Type | Rule |
|-------|------|------|
| `id` | `SongId` | assigned when the Song is read |
| `name` | `string` | trimmed, non-empty: the Song Source's name or the file name without extension (FR-014, research R2) |
| `ticksPerQuarter` | `TicksPerQuarter` | from the Song Source |
| `parts` | `readonly Part[]` | non-empty; order = track, then channel (research R2) |

The Song holds no Columns, Pipes or Holes (spec, Key Entities). It contains **all** its Parts,
also those not selected for a Tape.

### Part

| Field | Type | Rule |
|-------|------|------|
| `name` | `string \| undefined` | trimmed, non-empty when present |
| `percussion` | `boolean` | true for MIDI channel 10 (spec Assumptions) |
| `notes` | `readonly Note[]` | non-empty; sorted by `start`, then `noteNumber` |

A Part's identity within its Song is its position, a `PartIndex`. The MIDI track and channel are
not kept; they are details of the Song Source.

### Note

| Field | Type | Rule |
|-------|------|------|
| `noteNumber` | `MidiNoteNumber` | 0–127 |
| `start` | `Tick` | from the Song's start |
| `duration` | `Tick` | ≥ 0; 0 is allowed (a note-on and note-off at the same tick, research R2) |

Invariant: `start + duration` < 2³¹. Loudness, instrument and tempo are not part of a Note
(FR-003).

## Reading a Song

`readMidiSong(bytes: Uint8Array, fileName: string): Result<Song, SongRejection>` (research R1).

| `SongRejection` | Meaning | Requirement |
|-----------------|---------|-------------|
| `not-a-midi-file` | not a readable MIDI file: no `MThd`, truncated, malformed, too large, or format 2 (Spec question 1) | FR-002 |
| `not-timed-in-beats` | time-code (SMPTE) division | FR-002 |
| `no-notes` | no Part with a Note | FR-002 |

The UI shows each with an i18n key in en and de (FR-025); key names are decided in /speckit-plan
after #13.

## Bringing a Song onto a Tape (pure functions, no state)

These run before the Tape exists, on every change of the Part selection or Transposition
(Stories 3 and 5).

- `allowedTranspositions(song, selection): {lowest: Transposition; highest: Transposition}`:
  the range that keeps every selected Note within 0–127 (research R4).
- `proposeTransposition(song, selection, organ): Transposition` (FR-006, research R4).
- `countFit(song, selection, organ, transposition)` → the three counts FR-007 shows *(group name
  pending)*: Notes matching a Pipe, Notes moved by octaves, Unplayable Notes.
- `createTape(input): Result<{tape: Tape; summary: Summary}, TapeViolation[]>` with input:

  | Field | Type | Rule |
  |-------|------|------|
  | `song` | `Song` | |
  | `selection` | `ReadonlySet<PartIndex>` *(term pending: "Selection")* | non-empty (FR-004) |
  | `organ` | `Organ` | |
  | `transposition` | `Transposition` | within `allowedTranspositions` |
  | `name` | `string` | trimmed, non-empty (FR-014) |
  | `columnLength` | `Millimetres` | > 0 (FR-010) |

  It runs the pipeline of research R3 → R4/R5 → R6 and returns every violation found:

  | `TapeViolation` code | Requirement |
  |----------------------|-------------|
  | `name-required` | FR-014 |
  | `column-length-must-be-positive` | FR-010 |
  | `no-part-selected` | FR-004 |
  | `transposition-out-of-range` | FR-007, Spec question 3 |
  | `no-note-on-a-pipe` (every selected Note is an Unplayable Note) | edge case "not a single Note" |

- Prefilled Column length (FR-010): the Column length of the last Tape created for the Organ,
  else `minimumHoleLength(organ.tapeBed)`. "Last created" needs creation order; the Tape list
  keeps insertion order, so no timestamp is stored.

## Summary *(term pending)*

Shown once after `createTape`, not stored (spec Assumptions).

| Field | Type |
|-------|------|
| `transposition` | `Transposition` |
| `notesOnTape` | `number`: Notes matching a Pipe + Notes moved by octaves |
| `movedByOctaves` | list of `{part: PartIndex; noteNumber: MidiNoteNumber; pipe: MidiNoteNumber; octaves: number (≠ 0, signed); column: Column}` |
| `unplayableNotes` | list of `{part: PartIndex; noteNumber: MidiNoteNumber; column: Column}` (column frame: Spec question 2) |
| `holeChanges` | list of the variants below, in the order they were applied |

`holeChanges` variants (a discriminated union on `kind`):

| `kind` | Fields | Requirement |
|--------|--------|-------------|
| `overlap-merged` | `pipe`, `column` (the Hole's start) | FR-008 |
| `lengthened` | `pipe`, `column`, `from: ColumnCount`, `to: ColumnCount` | FR-012 rule 1 |
| `shortened` | `pipe`, `column`, `from: ColumnCount`, `to: ColumnCount` | FR-012 rule 2 |
| `repetition-merged` | `pipe`, `column`, `lostColumn: Column` (start of the removed Hole) | FR-012 rule 3 |

`noteNumber` is the number after the Transposition; the UI shows it with `noteName`.
Accounting (SC-003): number of selected Notes = Notes matching a Pipe + Notes moved by octaves +
Unplayable Notes, and every placed Note is in a Hole of its own or in one named by
`holeChanges`.

## Hole

| Field | Type | Rule |
|-------|------|------|
| `pipe` | `MidiNoteNumber` | the note number of its Pipe: a Hole belongs to its Pipe, not to a row (dictionary) |
| `start` | `Column` | ≥ 0 |
| `length` | `ColumnCount` | ≥ 1 |

`end = start + length` (exclusive). Length in mm = `length × columnLength` (FR-011).

## Tape (aggregate root)

| Field | Type | Rule |
|-------|------|------|
| `id` | `TapeId` | assigned by `createTape` |
| `name` | `string` | trimmed, non-empty; not unique (edge case) |
| `organId` | `OrganId` | exactly one Organ (FR-016) |
| `songId` | `SongId \| undefined` | the Song it was created from; always set in this slice. Optional because a later slice may compose a Tape from scratch (dictionary) |
| `transposition` | `Transposition` | the one it was created with (FR-016) |
| `columnLength` | `Millimetres` | > 0 (FR-010) |
| `holes` | `readonly Hole[]` | see invariants |

**Invariants** (checked by `createTape` and the snapshot parser; the type is branded like
`Organ`, so other code can't build one):
- Holes are sorted by `pipe`, then `start`.
- In each row (same `pipe`), Holes don't overlap: `next.start ≥ previous.end`.

**Invariants at creation only** (they depend on the Organ, which can change later; Tapes are not
re-checked, spec Assumptions):
- every `pipe` is a Pipe of the Organ;
- every Hole is at least `L` Columns long and the gap to the next Hole in its row is at least `G`
  Columns (research R6);
- the smallest `start` is 0 (FR-013) and there is at least one Hole.

**Derived values:**
- `length` in Columns = the largest `end` of all Holes (0 for a Tape without Holes, Spec
  question 4); `length` in mm = `length × columnLength` (FR-017).
- The Tape view (FR-018) shows one row per Pipe of the Organ in the Organ's row order; Holes are
  grouped by `pipe`, so reordering Pipes needs no change to the Tape (FR-021).

**Operations:**
- `removeHolesOfPipes(tape, pipes)`: for FR-021 when the user removes Pipes from the Organ.
- Tapes are otherwise not changed in this slice ("Edit a tape" is out of scope).

## Tape library (renderer state)

Holds all Tapes and the Songs they reference, keyed by id. It is the in-memory source of truth
(ADR 3) and a snapshot adapter, not a domain aggregate. Its store technology is decided in
/speckit-plan after #13.

- `tapesOf(organId)`: for the FR-020 confirmation and the FR-021 warning.
- Removing an Organ removes its Tapes; removing a Tape drops its Song when no other Tape
  references it.

## Snapshot (research R7)

`<userData>/snapshots/tapes.json`, format version 1:

```text
TapeLibrarySnapshot = {
  version: 1,
  songs: { id, name, ticksPerQuarter, parts: { name?, percussion, notes: [noteNumber, start, duration][] }[] }[],
  tapes: { id, name, organId, songId?, transposition, columnLength, holes: [pipe, start, length][] }[]
}
```

`parseTapeLibrarySnapshot(input: unknown): Result<{songs: Song[]; tapes: Tape[]}, string>` checks
all invariants above that don't need the Organ, that ids are unique, that every `songId` names a
Song in the file, and that every Song is referenced by a Tape. `toTapeLibrarySnapshot` writes only
referenced Songs and sorts Holes as above, so the file is deterministic.

## Lifecycle

```text
MIDI bytes --readMidiSong--> Song --select Parts, Transposition--> preview counts
                               |                                         |
                          rejected (FR-002)                    createTape (name, Column length)
                                                                         |
                                                       Tape + Song stored, Summary shown once
                                                                         |
                                        remove Tape --confirm--> gone (Song dropped if unreferenced)
                                        delete Organ --confirm--> gone with all its Tapes
                                        remove Pipe of the Organ --warn--> Holes of that Pipe removed
```
