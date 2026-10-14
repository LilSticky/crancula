# Contract: public domain API of the slice (`@api/index`)

What `api/index.ts` adds for this slice. Everything is pure TypeScript with relative imports and
no Angular, Electron or Node imports (ADR 2, constitution III). Types and rules are in the
[data model](../data-model.md); this file fixes the names the renderer and the main process may
use. Functions not listed here (for example the `asValid…` brand helpers, the Quantisation and
Hole-fix steps) stay internal to `api/` and are tested through their own spec files.

Existing exports are reused: `Result`, `MidiNoteNumber`, `midiNoteNumber`, `noteName`,
`Millimetres`, `millimetres`, `minimumHoleLength`, `Organ`, `OrganId`, `Pipe`.

## `api/song/`: the Song

```ts
// song.ts
type SongId;              // branded UUID
type Tick;                // branded integer ≥ 0, < 2^31
type TicksPerQuarter;     // branded integer 1–32767
type PartIndex;           // branded integer ≥ 0
interface Note { noteNumber: MidiNoteNumber; start: Tick; duration: Tick }
interface Part { name: string | undefined; percussion: boolean; notes: readonly Note[] }
interface Song { id: SongId; name: string; ticksPerQuarter: TicksPerQuarter; parts: readonly Part[] } // branded valid
function songId(value: string): SongId | undefined;
function defaultSelectedParts(song: Song): ReadonlySet<PartIndex>; // all non-percussion Parts (FR-004)

// midi/read-midi-song.ts (adapter for the MIDI Song Source)
type SongRejection = 'not-a-midi-file' | 'format-2' | 'not-timed-in-beats' | 'no-notes';
function readMidiSong(bytes: Uint8Array, fileName: string): Result<Song, SongRejection>;
const MAXIMUM_MIDI_FILE_SIZE: number; // 16 MiB; larger files are 'not-a-midi-file' (research R1)
```

`readMidiSong` never throws, for any input bytes, and assigns a new `SongId`.

## `api/tape/`: bringing a Song onto a Tape

```ts
// tape.ts
type TapeId;              // branded UUID
type Column;              // branded integer ≥ 0, counted from the Tape's start (FR-013)
type ColumnCount;         // branded integer ≥ 1
type Transposition;       // branded integer −127…+127
interface Hole { pipe: MidiNoteNumber; start: Column; length: ColumnCount }
interface Tape {          // branded valid; only from createTape or the snapshot parser
  id: TapeId; name: string; organId: OrganId;
  songId: SongId | undefined; selectedParts: readonly PartIndex[] | undefined;
  transposition: Transposition; columnLength: Millimetres; length: ColumnCount;
  holes: readonly Hole[];
}
function tapeId(value: string): TapeId | undefined;
function tapeLengthInMillimetres(tape: Tape): Millimetres;            // FR-011, FR-017
function removeHolesOfPipes(tape: Tape, pipes: ReadonlySet<MidiNoteNumber>): Tape; // FR-021; length kept

// transposition.ts
function allowedTranspositions(song: Song, selectedParts: ReadonlySet<PartIndex>):
  { lowest: Transposition; highest: Transposition };                 // FR-007
function proposeTransposition(song: Song, selectedParts: ReadonlySet<PartIndex>, organ: Organ): Transposition; // FR-006

// fit.ts
interface Fit { matchingAPipe: number; movedByOctaves: number; unplayable: number }
function fitOf(song: Song, selectedParts: ReadonlySet<PartIndex>, organ: Organ, transposition: Transposition): Fit; // FR-007

// create-tape.ts
interface CreateTapeInput {
  song: Song; selectedParts: ReadonlySet<PartIndex>; organ: Organ;
  transposition: Transposition; name: string; columnLength: number; // mm, checked here
}
type TapeViolationCode =
  | 'name-required' | 'column-length-must-be-positive' | 'no-part-selected'
  | 'transposition-out-of-range' | 'no-note-on-a-pipe';
interface TapeViolation { code: TapeViolationCode }
function createTape(input: CreateTapeInput):
  Result<{ tape: Tape; importSummary: ImportSummary }, readonly TapeViolation[]>;
function prefilledColumnLength(organ: Organ, tapes: readonly Tape[]): Millimetres;   // FR-010

// import-summary.ts
interface ImportSummary {
  transposition: Transposition;
  notesOnTape: number;
  movedByOctaves: readonly { part: PartIndex; noteNumber: MidiNoteNumber; pipe: MidiNoteNumber; octaves: number; column: Column }[];
  unplayableNotes: readonly { part: PartIndex; noteNumber: MidiNoteNumber; column: Column }[];
  holeChanges: readonly HoleChange[];
}
type HoleChange =
  | { kind: 'overlap-merged'; pipe: MidiNoteNumber; column: Column }
  | { kind: 'lengthened'; pipe: MidiNoteNumber; column: Column; from: ColumnCount; to: ColumnCount }
  | { kind: 'shortened'; pipe: MidiNoteNumber; column: Column; from: ColumnCount; to: ColumnCount }
  | { kind: 'repetition-merged'; pipe: MidiNoteNumber; column: Column; lostColumn: Column };

// tape-library-snapshot.ts (contract: tape-library-snapshot.md)
type TapeLibrarySnapshot; type SongSnapshot; type TapeSnapshot;
function parseTapeLibrarySnapshot(input: unknown): Result<{ songs: Song[]; tapes: Tape[] }, string>;
function toTapeLibrarySnapshot(tapes: readonly Tape[], songs: readonly Song[]): TapeLibrarySnapshot;
```

`createTape` reports all violations at once; the import form maps each `TapeViolationCode` to a
field and an i18n key, as the Organ editor does with `OrganViolationCode`. The `column` values in
the Import Summary count from 0; the UI shows them plus one (FR-015).

## `api/app/crancula-api.ts`

`CranculaApi` gains `tapes` with `TapeLibraryLoadResult` and `TapeLibrarySaveResult`
([tape-library-ipc.md](tape-library-ipc.md)). The file moves here from `api/organ/`.

## Guarantees the tests pin down

- Pure: same input, same output; no clock, no I/O. The only randomness is the new id in
  `readMidiSong` and `createTape` (`crypto.randomUUID`, as `newOrganId`).
- Accounting (SC-003): `fitOf(...).matchingAPipe + movedByOctaves + unplayable` = number of
  selected Notes; `importSummary.notesOnTape` = `matchingAPipe + movedByOctaves`.
- A created Tape satisfies every invariant of the data model, including the ones at creation only
  (Minimum Hole Length, Minimum Gap, at least one Hole, `length` = largest Hole end, SC-004).
- Performance (SC-006): `readMidiSong` plus `createTape` on a generated 5-minute Song with
  16 Parts runs well under 5 s in the Node test project.
