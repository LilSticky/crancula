# Data Model: Cut a tape in pieces

Phase 1 of [plan.md](plan.md). Domain types live in `api/` (pure TypeScript, ADR 2); names follow
[DICTIONARY.md](../../documentation/DICTIONARY.md). Lengths are `Millimetres` (finite, ≥ 0); positions along
the Tape are in mm from the Lead-in's tip, as in `TapeGeometry`. Columns are counted from 0 in code and shown
from 1.

## Plotter (new, `api/plotter/plotter.ts`)

| Field | Type | Rule |
|-------|------|------|
| `id` | `PlotterId` (branded UUID) | `plotterId(value)`, `newPlotterId()` like `OrganId` |
| `name` | `string` | trimmed, not empty; not unique (Story 5, scenario 4) |
| `format` | `'svg'` | the only format (FR-001) |
| `workingWidth` | `Millimetres` | > 0 |
| `roll` | `true` | a roll plotter: no other fields |
| `roll` | `false` | a sheet Plotter, with: |
| `workingLength` | `Millimetres` | > 0 |
| `overlap` | `Millimetres` | > 0 and < `workingLength` |

```ts
type Plotter = RollPlotter | SheetPlotter; // discriminated by `roll`, branded valid like Organ
const DEFAULT_OVERLAP = 20; // mm
```

Obtained only through `validatePlotter` or the snapshot parser. Independent of Organs and Tapes.

### PlotterDraft (`api/plotter/plotter-draft.ts`)

What the editor holds: `{id?: PlotterId; name: string; workingWidth: number | null; roll: boolean;
workingLength: number | null; overlap: number | null}`. `emptyPlotterDraft()` has `roll: false`, `overlap: 20`,
the rest empty. `draftOf(plotter)` fills it from a Plotter (a roll plotter's draft keeps `workingLength` empty
and `overlap` 20). Switching `roll` changes only `roll`, so the other values come back.

### validatePlotter (`api/plotter/validate-plotter.ts`)

`validatePlotter(draft): Result<Plotter, PlotterViolation[]>`, every violation at once.

| Code | Path | When |
|------|------|------|
| `name-required` | `name` | blank after trimming |
| `value-required` | `workingWidth`, `workingLength`, `overlap` | `null` or not finite |
| `must-be-positive` | same | ≤ 0 |
| `overlap-not-below-working-length` | `overlap` | `overlap ≥ workingLength` (both valid), params `{workingLength}` |

`workingLength` and `overlap` are checked only when `roll` is false.

## Plotter library snapshot (new, `api/plotter/plotter-library-snapshot.ts`)

```ts
interface PlotterSnapshot {
  readonly id: string;
  readonly name: string;
  readonly format: 'svg';
  readonly workingWidth: number;
  readonly roll: boolean;
  /** Only when roll is false. */
  readonly workingLength?: number;
  readonly overlap?: number;
}
/** <userData>/snapshots/plotters.json */
interface PlotterLibrarySnapshot { readonly version: 1; readonly plotters: readonly PlotterSnapshot[] }
```

`toPlotterSnapshot(plotters)` and `parsePlotterLibrarySnapshot(input): Result<Plotter[], string>`: unknown
version, a non-list, a duplicate id or any Plotter `validatePlotter` refuses makes the whole file unreadable
(moved aside by `snapshot-file.ts`, ADR 8). A roll plotter with `workingLength` or `overlap` stored is refused.

## Possible Join, Join, Tape piece (new, `api/tape/tape-pieces.ts`, derived, never stored)

```ts
interface Join {
  /** mm from the tip; a Column boundary. */
  readonly at: number;
  /** The Column boundary: the Join lies after Column `after` (counted from 1). */
  readonly after: number;
  /** at + the Plotter's Overlap. */
  readonly overlapEnd: number;
}

interface TapePiece {
  /** From 1, in order from the Lead-in. */
  readonly number: number;
  /** mm from the tip: 0 for the first piece, else the Join before it. */
  readonly start: number;
  /** mm from the tip: the end of its Overlap, or the end cut on the last piece. */
  readonly end: number;
  /** The Join it ends at; absent on the last piece. */
  readonly join?: Join;
}

type TapePieces =
  /** The Organ's tape width exceeds the working width; nothing else is computed (FR-017). */
  | {readonly kind: 'too-wide'; readonly tapeWidth: number; readonly workingWidth: number}
  /** At least one stretch has no possible Join (FR-015); no pieces. */
  | {readonly kind: 'no-join'; readonly stretches: readonly JoinlessStretch[]}
  /** One or more pieces; exactly one for a roll plotter or a Tape that fits whole (FR-011). */
  | {readonly kind: 'pieces'; readonly pieces: readonly TapePiece[]};

interface JoinlessStretch {
  /** First and last Column of the stretch, counted from 0. */
  readonly first: Column;
  readonly last: Column;
}

function tapePieces(geometry: TapeGeometry, plotter: Plotter): TapePieces;
```

Rules (research R3, R4):

- Too wide when `geometry.width > plotter.workingWidth + 1e-9`.
- Roll plotter, or `geometry.totalLength ≤ workingLength`: one piece `{number: 1, start: 0, end: totalLength}`.
- Join candidates: `leadIn + k · columnLength`, `k = 1 … length − 1`. A candidate is possible when no Slot
  `[x, x + width]` lies closer than the Minimum Gap (`geometry.endGap`) to it or to it plus the Overlap.
- Pieces: greedy furthest Join with `join.overlapEnd − start ≤ workingLength`; the last piece's
  `end − start ≤ workingLength`.
- Stretches: each pair of neighbouring possible Joins (with the tip before and the end cut after) that a
  piece can't span; `first` is the Column after the earlier one, `last` the Column before the later one (the
  last Column at the end cut).

Invariants (tests, SC-003, SC-004): pieces are contiguous (`pieces[i + 1].start === pieces[i].join.at`), the
first starts at 0, the last ends at `totalLength`, every piece's length ≤ `workingLength`, no Slot within the
Minimum Gap of any `at` or `overlapEnd`, and no cut with fewer pieces exists (checked against brute force on
small Tapes).

## Tape piece geometry (new, `api/tape/tape-piece-geometry.ts`)

```ts
/** What a Plotter file is cut from: what plotterSvg reads. TapeGeometry satisfies it. */
type CutGeometry = Pick<TapeGeometry, 'totalLength' | 'width' | 'slots' | 'outline'>;

function pieceGeometry(geometry: TapeGeometry, piece: TapePiece): CutGeometry;
```

- `totalLength` = `piece.end − piece.start`; `width` = tape width.
- `slots`: the Slots with `x ≥ start − ε` and `x + width ≤ end + ε`, each `x` shifted by `−start`; order
  unchanged (start, then row). A Slot in an Overlap is in both pieces at the same place relative to the Join.
- `outline`: first piece = the Tape's outline with its ends moved to `totalLength`; every other piece: `tip`
  `(0, 0)`, `columnOneBottom` `(0, width)`, ends at `totalLength` (square at both ends).

`plotterSvg(geometry: CutGeometry)` (narrowed parameter); its output for `tapeGeometry(...)` is unchanged.

## Cutting Problem (changed, `api/tape/cutting-problems.ts`)

```ts
type HoleCuttingProblem = /* the existing 'no-pipe' | 'too-short' | 'too-close' */;
type CuttingProblem =
  | HoleCuttingProblem
  | {
      readonly code: 'no-join';
      /** First and last Column of the stretch, counted from 0. */
      readonly start: Column;
      readonly last: Column;
      readonly plotterName: string;
      readonly workingLengthMm: Millimetres;
    };

function cuttingProblems(tape: Tape, organ: Organ, plotter?: Plotter): readonly CuttingProblem[];
```

- Without `plotter`, with a roll plotter, or too wide: exactly today's result (FR-018).
- `no-join` problems come from `tapePieces(...).stretches`; all problems stay sorted by `start`, then row,
  then code (`no-join` after the Hole codes at the same start).
- `holesWithCuttingProblems` takes the Hole kinds only (`HoleCuttingProblem`); the Tape view gets the
  stretches separately (`stretchesOf(problems)`).

## Export refusal (renderer, `plotter-export.ts`)

Refused (no dialog) when `cuttingProblems(tape, organ, picked)` is not empty or `tapePieces` is `too-wide`;
the existing Cutting Problems dialog lists every reason, the too-wide reason first (FR-019).

## Tape piece file names (new, `api/tape/tape-piece-file-name.ts`)

```ts
function tapePieceFileNames(tapeName: string, count: number, label: (number: string, count: string) => string): readonly string[];
```

`count ≥ 2`; numbers padded with zeros to the digits of `count`; result `"<safeFileName(name)> <label>.svg"`,
the name shortened so the whole stem stays within `safeFileName`'s 200 characters; the label made safe too.

## Picked Plotter (renderer UI preference, `src/app/features/plotter/plotter-preference.ts`)

`localStorage['crancula.plotter']` = a `PlotterId`, or absent for "No Plotter". `picked(): Plotter | undefined`
resolves it against the `PlotterLibrary`; an id not in the library reads as `undefined`. Not part of any Tape.

## State transitions

- Plotter: none → described (Save) → changed (Save) → removed (confirm). Each step writes `plotters.json`.
- Picked Plotter: No Plotter ⇄ a Plotter; a removed Plotter turns it into No Plotter.
- Tape pieces and `no-join` problems: recomputed from Tape, Organ and picked Plotter on every change; never
  stored.
