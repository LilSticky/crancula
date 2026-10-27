# Data model: Read a tape as Scores

Phase 1 of [plan.md](plan.md). Everything here is pure TypeScript in `api/scores/` (ADR 2), exported through
`api/index.ts`, except the preference, which is a renderer service. Nothing is stored in a snapshot: the Tape,
Song and Organ snapshots are unchanged (FR-004, FR-017). Words like staff, clef, voice, chord, rest, tie and
note value are Scores words (spec Assumptions), used in code as plain names, not as dictionary terms.

## Read, never changed

| Entity | What the export reads |
|--------|-----------------------|
| `Tape` (`api/tape/tape.ts`) | `name`, `holes` (`pipe`, `start`, `length`), `length`, `columnLength`, `crankSpeed`, `songId` |
| `Organ` (`api/organ/organ.ts`) | `pipes` (notes, for prefill and clefs), `minimumGap`, `tapePerCrankTurn` (optional) |
| `Song` (`api/song/song.ts`) | `ticksPerQuarter`, `timeSignatures`, `upbeat`, `keys` |

## Export choices

```ts
/** The beat types the export dialog offers (FR-004); the Song model also allows 64. */
type ScoresBeatType = 1 | 2 | 4 | 8 | 16 | 32;

interface ChosenTimeSignature {
  readonly beats: number;          // whole, 1–99
  readonly beatType: ScoresBeatType;
}

/** What one export uses; prefilled, never stored on the Tape (spec: "Export choices"). */
interface ScoresChoices {
  /** 'song': the Song's Time signatures at their Columns; else one for the whole Tape. */
  readonly timeSignature: 'song' | ChosenTimeSignature;
  /** In Columns; 0 is no upbeat. */
  readonly upbeat: number;
  /** Sorted ascending, distinct, each 0–127; empty is one staff. */
  readonly splitNotes: readonly MidiNoteNumber[];
}

type ScoresChoicesViolation =
  | {readonly field: 'beats'; readonly code: 'not-whole' | 'out-of-range'}
  | {readonly field: 'beatType'; readonly code: 'not-offered'}
  | {readonly field: 'timeSignature'; readonly code: 'not-on-columns'}
  | {readonly field: 'upbeat'; readonly code: 'not-whole' | 'negative' | 'not-shorter-than-bar' | 'not-on-columns'}
  | {readonly field: 'splitNotes'; readonly code: 'not-distinct' | 'out-of-range'};

function validateScoresChoices(input: ScoresChoicesInput, song: Song | undefined): readonly ScoresChoicesViolation[];
```

`ScoresChoicesInput` is what the dialog holds (numbers or `null`, the upbeat as count and note value); it
becomes `ScoresChoices` only when `validateScoresChoices` returns no violation (invalid states are not
representable in `ScoresChoices`). `'song'` is valid only when `songKeepsBarsOnColumns(song)` (research R3).
"Not shorter than the first Bar" compares with the first Bar of the chosen Time signature, or of the Song's
first one. `timeSignature` `not-on-columns` is the `'song'` choice without a Song whose Bars lie on whole
Columns (a 3/64 Song: its Bar is 1.5 Columns); the dialog then does not offer `'song'`. A count of 0 is no upbeat
and has no violation whatever its note value. Violations are returned in the order: Time signature, upbeat,
split notes.

### Prefill

```ts
function prefilledScoresChoices(
  organ: Organ,
  song: Song | undefined,
  rememberedSplitNotes: readonly MidiNoteNumber[] | undefined,
): ScoresChoicesInput;
```

- Time signature: `'song'` when the Song keeps Time signatures on Columns; else 4/4 (FR-004).
- Upbeat: the Song's upbeat as count × note value in lowest terms (`columnOfTick` of its Ticks), else 0.
- Split notes: `rememberedSplitNotes`; else `[60]` when the Organ has Pipes below 60 and at or above it; else
  `[]` (FR-005).

## Scores notes

```ts
/** A Hole as it is written: its Pipe's pitch, its start, and its length after gap closing (FR-008). */
interface ScoresNote {
  readonly pitch: MidiNoteNumber;
  readonly start: Column;
  readonly length: ColumnCount;
}

function minimumGapColumns(organ: Organ, columnLength: Millimetres): number; // ceil(gap ÷ length − 1e-9)
function closeGaps(holes: readonly Hole[], minimumGapColumns: number): readonly ScoresNote[];
```

Rules: one `ScoresNote` per Hole, also for Holes whose Pipe is not on the Organ (FR-007). Lengthened to the
next Hole of the same Pipe only when `0 < gap ≤ minimumGapColumns`; the last Hole of a Pipe keeps its length.

## Bars

```ts
interface Bar {
  readonly number: number;          // 0 for the upbeat, then 1, 2, …
  readonly start: Column;
  readonly length: ColumnCount;     // shorter than full only for the upbeat or before a change
  readonly timeSignature: ChosenTimeSignature | {readonly beats: number; readonly beatType: BeatType};
  readonly key: {readonly fifths: Fifths; readonly mode: Mode};
  /** True when the Time signature or Key differs from the Bar before (or it is the first Bar). */
  readonly showsTimeSignature: boolean;
  readonly showsKey: boolean;
}

function scoresBars(tape: Tape, song: Song | undefined, choices: ScoresChoices): readonly Bar[];
```

Rules (research R3, R4): starts at Column 0; consecutive, no gaps; the sum covers `tape.length` and the last
Bar is full; Keys from the Bar holding their Column, C major before the first.

## Staves and clefs

```ts
type Clef = 'treble' | 'treble-8va' | 'bass' | 'bass-8vb';

interface Staff {
  readonly number: number;            // 1 at the top
  /** Lowest pitch of the range, or undefined for the bottom staff (reaches all the way down). */
  readonly from: MidiNoteNumber | undefined;
  /** First pitch above the range, or undefined for the top staff. */
  readonly below: MidiNoteNumber | undefined;
  readonly clef: Clef;
}

function scoresStaves(splitNotes: readonly MidiNoteNumber[], organ: Organ, notes: readonly ScoresNote[]): readonly Staff[];
function staffOf(pitch: MidiNoteNumber, staves: readonly Staff[]): Staff;
```

Rules (research R9): `splitNotes.length + 1` staves; every pitch on exactly one staff; clef by the middle of
the staff's Pipes (else notes, else range bound) and the ledger line rule.

## Voices and chords

```ts
type VoiceNumber = 1 | 2 | 3 | 4;

interface Chord {
  readonly start: Column;
  readonly length: ColumnCount;
  readonly pitches: readonly MidiNoteNumber[];  // ascending, at least one
}

interface StaffVoices {
  readonly staff: Staff;
  readonly voices: ReadonlyMap<VoiceNumber, readonly Chord[]>;  // each list sorted, chords in a voice never overlap
}

function assignVoices(staff: Staff, notes: readonly ScoresNote[]): StaffVoices;
```

Rules (research R8): same start and length → one chord; highest chord first into the lowest free voice;
overflow into voice 4, which is then cut into tied pieces so its chords never overlap.

## Note values and spelling

```ts
type NoteType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd';

interface NoteValue {
  readonly type: NoteType;
  readonly dotted: boolean;
  readonly columns: 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16 | 24 | 32 | 48;
}

/** The fewest values adding up to `columns`, longest first (FR-009, research R7). */
function noteValues(columns: ColumnCount): readonly NoteValue[];

type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

interface Spelling {
  readonly step: Step;
  readonly alter: -1 | 0 | 1;
  readonly octave: number;  // 0–9
}

function spell(pitch: MidiNoteNumber, fifths: Fifths): Spelling;  // research R5
```

## Tempo and file name

```ts
/** Quarter notes per minute, or undefined when the Organ has no Tape per Crank turn (FR-013). */
function scoresTempo(tape: Tape, organ: Organ): number | undefined;
// round(crankSpeed × tapePerCrankTurn ÷ (8 × columnLength)), at least 1

function scoresFileName(tapeName: string): string;  // safeFileName(tapeName) + '.musicxml'
```

## The writer

```ts
interface ScoresInput {
  readonly tape: Tape;
  readonly organ: Organ;
  readonly song: Song | undefined;
  readonly choices: ScoresChoices;
}

/** The whole MusicXML 4.0 document (research R1, contracts/musicxml-output.md). */
function scoresMusicXml(input: ScoresInput): string;
```

Pure and deterministic; never changes its input (FR-017, SC-006).

## Renderer-only

| Name | Where | What |
|------|-------|------|
| `ScoresStavesPreference` | `src/app/features/tape/tape-view/scores-export/scores-staves-preference.ts` | `splitNotesFor(organId)`, `remember(organId, splitNotes)`; `localStorage` key `crancula.scoresSplitNotes`, JSON `{[organId]: number[]}` (ADR 11, research R12) |
| `ScoresExport` | `…/scores-export/scores-export.ts` | opens the dialog, builds the text, calls `api.scores.save`, shows the snackbar; `saving` signal |
| `ScoresExportDialogComponent` | `…/scores-export/scores-export-dialog.component.ts` | the dialog of [contracts/scores-export-ui.md](contracts/scores-export-ui.md) |

## Domain events

`ExportTapeAsScores` → `TapeExportedAsScores` (spec). Neither changes state; no event type in code, the
snackbar is the only trace.
