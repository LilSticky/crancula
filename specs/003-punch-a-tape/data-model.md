# Data Model: Punch a tape

Draft domain types in pure TypeScript (ADR 2). Names follow `documentation/DICTIONARY.md`; this
slice adds no domain term. The slice **stores nothing new**: `organs.json` and `tapes.json` keep
their versions (3 and 1), so no migration is needed (ADR 20). `Tape`, `Hole`, `Organ`,
`Millimetres`, `noteName`, `minimumHoleLength`, `border` and `columnsFor` are reused from `api/`.

All functions here are pure and total: they read a `Tape` and its `Organ` and never change them
(FR-014).

## Tape geometry (moved to `api/tape/tape-geometry.ts`, research R1)

`tapeGeometry(tape: Tape, organ: Organ): TapeGeometry`. Every length is in mm; **x is measured
from the Lead-in's tip** (the Tape's left end), **y from the top edge**.

### TapeGeometry

| Field | Type | Value |
|-------|------|-------|
| `leadIn` | `number` | `organ.leadIn`; also the x of Column 1 |
| `columnLength` | `number` | `tape.columnLength` |
| `length` | `number` | the Columns only: `tape.length × columnLength` (unchanged meaning) |
| `endGap` | `number` | `organ.minimumGap`: from the end of the last Column to the end cut |
| `totalLength` | `number` | `leadIn + length + endGap`: the document width (FR-006) |
| `width` | `number` | `organ.tapeBed.tapeWidth`: the document height |
| `border` | `number` | `border(organ)` |
| `rowCentres` | `readonly number[]` | y of each row's centre, row 1 first |
| `slots` | `readonly Slot[]` | one per Hole whose Pipe is on the Organ, **in cut order** (research R5) |
| `outline` | `TapeOutline` | the Tape Outline (below) |

### Slot (a Hole as cut, FR-009)

| Field | Type | Value |
|-------|------|-------|
| `row` | `number` | the Pipe's position on the Organ, from 1 |
| `start` | `Column` | the Hole's start Column (from 0, as stored) |
| `x` | `number` | `leadIn + start × columnLength` |
| `y` | `number` | `border + (row − 1) × rowSpacing` (top of the slot) |
| `width` | `number` | `hole.length × columnLength` |
| `height` | `number` | `holeDiameter` |
| `radius` | `number` | `holeDiameter / 2`: the half-circle ends lie inside `width` |

Order: by `start`, then by `row` (FR-012). Scenario 1.3 (Border 30.5, hole diameter 3, Lead-in 50,
Column length 3, row 1, start 0, 4 Columns): `x = 50`, `width = 12`, `y = 30.5`, centre line at
32.

### TapeOutline (FR-010)

| Field | Type | Value |
|-------|------|-------|
| `tip` | `Point` | `(0, 0)`: the Lead-in's tip on the top edge |
| `topEnd` | `Point` | `(totalLength, 0)` |
| `bottomEnd` | `Point` | `(totalLength, width)` |
| `columnOneBottom` | `Point` | `(leadIn, width)`: where the diagonal meets the bottom edge |

`Point = {readonly x: number; readonly y: number}`. Cut in this order and closed: tip → top edge →
end cut → bottom edge → Lead-in's diagonal back to the tip. With `leadIn = 0`, `columnOneBottom`
is `(0, width)` and the last segment is the square cut at Column 1. Scenario 1.4: tip (0, 0),
top end (652, 0), bottom end (652, 100), Column 1 bottom (50, 100).

Edge cases: a Tape without Holes has no Slots and the same Outline; Border 0 puts Slots on the
long edges (valid); empty Columns at the end still count in `length`; a Minimum Gap of 0 puts the
end cut at the end of the last Column.

## Export check (`api/tape/export-problems.ts`, research R4)

`exportProblems(tape: Tape, organ: Organ): readonly ExportProblem[]`; empty means exportable.

```ts
type ExportProblem =
  | {readonly code: 'no-pipe'; readonly pipe: MidiNoteNumber; readonly start: Column}
  | {
      readonly code: 'too-short';
      readonly pipe: MidiNoteNumber;
      readonly start: Column;
      readonly lengthMm: number;
      readonly minimumHoleLengthMm: Millimetres;
    }
  | {
      readonly code: 'too-close';
      readonly pipe: MidiNoteNumber;
      readonly start: Column;
      readonly nextStart: Column;
      /** Negative when the two Holes overlap. */
      readonly gapMm: number;
      readonly minimumGapMm: Millimetres;
    };
```

| Code | When (in Columns, limits via `columnsFor`, as `createTape`) | Requirement |
|------|-------------------------------------------------------------|-------------|
| `no-pipe` | no Pipe of the Organ has `hole.pipe` | FR-002, Story 2.3 |
| `too-short` | `hole.length < minimumHoleLength` in Columns | FR-002, Story 2.1 |
| `too-close` | `next.start − (hole.start + hole.length) < minimumGap` in Columns, `next` the following Hole of the same Pipe | FR-002, Story 2.2 |

Rules:
- Every problem of every Hole is listed (Story 2.4); a Hole can have `too-short` and
  `too-close`. A Hole with `no-pipe` gets only that problem (it has no row).
- Order: by `start`, then by row (Holes without a Pipe after those with one at the same start),
  then by code in the order of the table.
- The UI shows `noteName(pipe)` and `start + 1` (counted from 1, as in the Import Summary, FR-003)
  and the mm values in the language's notation. i18n keys are flat, one per code, under `TAPE.EXPORT`:
  `TAPE.EXPORT.PROBLEM_NO_PIPE`, `TAPE.EXPORT.PROBLEM_TOO_SHORT`, `TAPE.EXPORT.PROBLEM_TOO_CLOSE`
  (the code upper-cased, `-` as `_`). The dialog (`export-problems-dialog`) names them as quoted
  literals, so they need no `DYNAMIC_PREFIXES` entry.
- `HoleLimits` and the function that computes them for an Organ and a Column length
  (`holeLimitsOf`, today private in `create-tape.ts`) move to `hole-fixes.ts`, so `createTape`
  and `exportProblems` share them.

## Plotter file (`api/tape/plotter-svg.ts`, `api/tape/plotter-file-name.ts`, research R3, R7)

| Function | Returns | Rule |
|----------|---------|------|
| `plotterSvg(geometry: TapeGeometry)` | `string` | the whole file (research R3): root size and `viewBox` in mm from `totalLength` × `width`; one closed `path` per Slot in `slots` order; the Outline's `path` last |
| `plotterFileName(tapeName: string)` | `string` | `<safe name>.svg` (research R7); never empty, never a path |

The SVG text is not a domain type and is not stored ("Exported file" is not stored by Crancula).

## IPC payloads (`api/app/svg-save-request.ts`, `api/app/crancula-api.ts`)

```ts
interface SvgSaveRequest {
  /** From plotterFileName; the main process uses its basename only. */
  readonly suggestedFileName: string;
  readonly svg: string;
  /** Translated in the renderer. */
  readonly dialogTitle: string;
  readonly filterName: string;
}

type SvgSaveResult =
  | {readonly status: 'saved'; readonly filePath: string}
  | {readonly status: 'cancelled'}
  /** The request failed validation; no dialog was shown. */
  | {readonly status: 'rejected'; readonly reason: string}
  /** Writing failed; the reason is the operating system's message. */
  | {readonly status: 'failed'; readonly reason: string};
```

`parseSvgSaveRequest(input: unknown): Result<SvgSaveRequest, string>` checks the rules in the
[contract](contracts/plotter-ipc.md#validation).

## State

No state transitions: exporting reads the in-memory Tape and Organ (ADR 3) and writes one file
outside `userData`. The only state the slice adds is the main process's remembered export folder,
in memory only (research R6). The renderer keeps a `saving` signal while a save is running, so the
command can't open a second dialog.
