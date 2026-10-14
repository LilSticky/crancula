# Data Model: Bring a song onto a tape

These are draft domain types, written in pure TypeScript (ADR 2). Names follow
`documentation/DICTIONARY.md`, including Tick, Fit and Import Summary, added on 2026-10-14 (see
[research.md, Missing dictionary terms](research.md#missing-dictionary-terms)). The Parts chosen
for a Tape are "the selected Parts" (`selectedParts`), not a term of their own. Like `Organ` in
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
| `Tick` | branded `number` | integer ≥ 0, < 2³¹ (research R2) |
| `TicksPerQuarter` | branded `number` | integer 1–32767 (the SMF header's 15 bits) |
| `Column` | branded `number` | integer ≥ 0; a position on the Tape, counted from 0 at the Tape's start, the first Note of the selected Parts (FR-013) |
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
| `start` | `Tick` | from the Song's start (a Tape's Columns are counted from its first Note, FR-013) |
| `duration` | `Tick` | ≥ 0; 0 is allowed (a note-on and note-off at the same Tick, research R2) |

Invariant: `start + duration` < 2³¹. Loudness, instrument and tempo are not part of a Note
(FR-003).

## Reading a Song

`readMidiSong(bytes: Uint8Array, fileName: string): Result<Song, SongRejection>` (research R1).

| `SongRejection` | Meaning | Requirement |
|-----------------|---------|-------------|
| `not-a-midi-file` | not a readable MIDI file: no `MThd`, truncated, malformed or too large | FR-002 |
| `format-2` | a MIDI file of format 2 (several independent sequences, research Spec question 1) | FR-002 |
| `not-timed-in-beats` | time-code (SMPTE) division | FR-002 |
| `no-notes` | no Part with a Note | FR-002 |

The UI shows each with an i18n key in en and de (FR-025); key names are decided in /speckit-plan
after #13.

## Bringing a Song onto a Tape (pure functions, no state)

These run before the Tape exists, whenever the selected Parts or the Transposition change
(Stories 3 and 5). `selectedParts` is a `ReadonlySet<PartIndex>`.

- `allowedTranspositions(song, selectedParts): {lowest: Transposition; highest: Transposition}`:
  the range that keeps every selected Note within 0–127 (research R4). The user's own
  Transposition is limited to it (FR-007, spec Assumptions).
- `proposeTransposition(song, selectedParts, organ): Transposition` (FR-006, research R4).
- `fitOf(song, selectedParts, organ, transposition): Fit` (FR-007, research R5):

  | `Fit` field | Type |
  |-------------|------|
  | `matchingAPipe` | `number`: Notes whose transposed note number is a Pipe |
  | `movedByOctaves` | `number`: Notes moved by whole octaves onto a Pipe (FR-009) |
  | `unplayable` | `number`: Unplayable Notes |

  The three counts add up to the number of selected Notes.
- `createTape(input): Result<{tape: Tape; importSummary: ImportSummary}, TapeViolation[]>` with
  input:

  | Field | Type | Rule |
  |-------|------|------|
  | `song` | `Song` | |
  | `selectedParts` | `ReadonlySet<PartIndex>` | non-empty (FR-004) |
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
  | `transposition-out-of-range` | FR-007, spec Assumptions |
  | `no-note-on-a-pipe` (every selected Note is an Unplayable Note) | edge case "not a single Note" |

- Prefilled Column length (FR-010): the Column length of the last Tape created for the Organ,
  else `minimumHoleLength(organ.tapeBed)`. "Last created" needs creation order; the Tape list
  keeps insertion order, so no timestamp is stored.

## Import Summary

Shown once after `createTape`, not stored (spec Assumptions).

| Field | Type |
|-------|------|
| `transposition` | `Transposition` |
| `notesOnTape` | `number`: Notes matching a Pipe + Notes moved by octaves |
| `movedByOctaves` | list of `{part: PartIndex; noteNumber: MidiNoteNumber; pipe: MidiNoteNumber; octaves: number (≠ 0, signed); column: Column}` |
| `unplayableNotes` | list of `{part: PartIndex; noteNumber: MidiNoteNumber; column: Column}` |
| `holeChanges` | list of the variants below, in the order they were applied |

`holeChanges` variants (a discriminated union on `kind`):

| `kind` | Fields | Requirement |
|--------|--------|-------------|
| `overlap-merged` | `pipe`, `column` (the Hole's start) | FR-008 |
| `lengthened` | `pipe`, `column`, `from: ColumnCount`, `to: ColumnCount` | FR-012 rule 1 |
| `shortened` | `pipe`, `column`, `from: ColumnCount`, `to: ColumnCount` | FR-012 rule 2 |
| `repetition-merged` | `pipe`, `column`, `lostColumn: Column` (start of the removed Hole) | FR-012 rule 3 |

`noteNumber` is the number after the Transposition; the UI shows it with `noteName`. Every
`column` is counted from 0 at the Tape's start (the first Note of the selected Parts, FR-013), so
none is negative, also for an Unplayable Note before the first Hole. The UI shows it plus one:
Column 1 is the Tape's first Column (FR-015).
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
| `selectedParts` | `readonly PartIndex[] \| undefined` | the selected Parts it was created with (FR-016); sorted ascending, unique, non-empty, each a Part of the Song. Set exactly when `songId` is set |
| `transposition` | `Transposition` | the one it was created with (FR-016) |
| `columnLength` | `Millimetres` | > 0 (FR-010) |
| `length` | `ColumnCount` | its length in Columns from the Tape's start, the first Note of the selected Parts (FR-013); stored, because removing Holes must not change it (FR-021) |
| `holes` | `readonly Hole[]` | see invariants; may be empty after Pipes were removed (FR-021) |

**Invariants** (checked by `createTape` and the snapshot parser; the type is branded like
`Organ`, so other code can't build one):
- Holes are sorted by `pipe`, then `start`.
- In each row (same `pipe`), Holes don't overlap: `next.start ≥ previous.end`.
- Every Hole lies within the Tape: `end ≤ length`.

**Invariants at creation only** (they depend on the Organ, which can change later; Tapes are not
re-checked, spec Assumptions):
- every `pipe` is a Pipe of the Organ;
- every Hole is at least `L` Columns long and the gap to the next Hole in its row is at least `G`
  Columns (research R6);
- there is at least one Hole, and `length` is the largest `end` of all Holes (FR-013).

**Derived values:**
- `length` in mm = `length × columnLength` (FR-017).
- The Tape view (FR-018) shows one row per Pipe of the Organ in the Organ's row order, and the
  names of the selected Parts from the Song; Holes are grouped by `pipe`, so reordering Pipes
  needs no change to the Tape (FR-021).

**Operations:**
- `removeHolesOfPipes(tape, pipes)`: for FR-021 when the user removes Pipes from the Organ. Keeps
  everything else, including `length`; the result may have no Hole.
- Tapes are otherwise not changed in this slice ("Edit a tape" is out of scope).

## Tape library (renderer state)

Holds all Tapes and the Songs they reference, keyed by id. It is the in-memory source of truth
(ADR 3) and a snapshot adapter, not a domain aggregate. Its store technology is decided in
/speckit-plan after #13.

- `tapesOf(organId)`: for the FR-020 confirmation.
- `affectedByRemovingPipes(organId, pipes): {tapes: number; holes: number}`: for the FR-021
  question before the Organ is saved.
- Removing an Organ removes its Tapes; removing a Tape drops its Song when no other Tape
  references it.
- Whether the stored Tapes could be read: while they can't (FR-023), deleting an Organ is refused
  (FR-020).
- Tapes whose `organId` names no known Organ (the Organs couldn't be read) stay in the library
  and in the snapshot, are listed, and can't be opened (FR-023).

## Snapshot (research R7)

`<userData>/snapshots/tapes.json`, format version 1:

```text
TapeLibrarySnapshot = {
  version: 1,
  songs: { id, name, ticksPerQuarter, parts: { name?, percussion, notes: [noteNumber, start, duration][] }[] }[],
  tapes: { id, name, organId, songId?, selectedParts?, transposition, columnLength, length, holes: [pipe, start, length][] }[]
}
```

`parseTapeLibrarySnapshot(input: unknown): Result<{songs: Song[]; tapes: Tape[]}, string>` checks
all invariants above that don't need the Organ, that ids are unique, that every `songId` names a
Song in the file, that `selectedParts` are Parts of that Song, and that every Song is referenced
by a Tape. `toTapeLibrarySnapshot` writes only referenced Songs and sorts Holes as above, so the
file is deterministic.

## Lifecycle

```text
MIDI bytes --readMidiSong--> Song --selected Parts, Transposition--> Fit
                               |                                      |
                          rejected (FR-002)                 createTape (name, Column length)
                                                                      |
                                                Tape + Song stored, Import Summary shown once
                                                                      |
                remove Tape --confirm--> gone (Song dropped if unreferenced)
                delete Organ --confirm--> gone with all its Tapes
                delete Organ while the Tapes are unreadable --> refused
                remove Pipe of the Organ --tell Tapes and Holes, confirm--> Holes of that Pipe
                                                                  removed, length kept
```
