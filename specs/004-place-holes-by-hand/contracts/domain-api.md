# Contract: domain API (`@api/index`)

New, renamed and removed exports of `api/` for this slice. All functions are pure and framework-
free (ADR 2); none changes its arguments. Types are described in [data-model.md](../data-model.md).
No IPC channel, preload method or snapshot field changes (research R9).

## `api/tape/tape.ts`

```ts
export type TapeRuleViolationCode =
  | 'name-blank'
  | 'song-reference-incomplete'
  | 'selected-parts-invalid'
  | 'hole-beyond-end'
  | 'holes-not-sorted'
  | 'holes-overlap';

export interface TapeRuleViolation {
  readonly code: TapeRuleViolationCode;
  /** The first Hole that breaks a Hole rule. */
  readonly hole?: Hole;
}

/** The only way to get a Tape: checks every rule that doesn't need the Organ. */
export function validTape(fields: TapeFields): Result<Tape, TapeRuleViolation>;

/** Unchanged signature; now built through validTape. */
export function removeHolesOfPipes(tape: Tape, pipes: ReadonlySet<MidiNoteNumber>): Tape;
```

Removed: `asValidTape` (was internal, not exported from `api/index.ts`).

## `api/tape/hole-edits.ts` (new)

```ts
export type HoleRef = Pick<Hole, 'pipe' | 'start'>;

export interface HoleEdit {
  readonly tape: Tape;
  /** The added, moved or changed Hole as it is now. */
  readonly hole: Hole;
}

export type HoleEditRefusal =
  | {readonly code: 'no-such-hole'}
  | {readonly code: 'not-on-the-organ'; readonly pipe: MidiNoteNumber}
  | {readonly code: 'overlaps'; readonly other: Hole};

/** A Hole of `pipe` at `start`, the Minimum Hole Length long, cut back to end before the next Hole of `pipe`. */
export function addHole(tape: Tape, organ: Organ, pipe: MidiNoteNumber, start: Column): Result<HoleEdit, HoleEditRefusal>;

/** Moves the Hole along its row and/or to another Pipe of the Organ; keeps its length. */
export function moveHole(
  tape: Tape,
  organ: Organ,
  hole: HoleRef,
  to: {readonly pipe: MidiNoteNumber; readonly start: Column},
): Result<HoleEdit, HoleEditRefusal>;

/** Gives the Hole a new start and length on its Pipe: moves either end, or both. */
export function changeHoleLength(
  tape: Tape,
  hole: HoleRef,
  to: {readonly start: Column; readonly length: ColumnCount},
): Result<HoleEdit, HoleEditRefusal>;

/** Removes the Hole; the Tape keeps its length. */
export function removeHole(tape: Tape, hole: HoleRef): Result<Tape, HoleEditRefusal>;
```

Behaviour (each line is a Node test, numbers from the spec):

| Call | Result |
|------|--------|
| `moveHole` C4 10–13 → start 12 (spec 1.1) | C4 12–15 |
| `moveHole` C4 10–13 → D4 (1.2) | D4 10–13; no C4 Hole at 10 |
| `changeHoleLength` end +3 then start +2 (1.3) | 10–16, then 12–16 |
| `removeHole` (1.5) | Hole gone; `length` unchanged |
| `moveHole`/`changeHoleLength` onto C4 16–19 (1.7) | `err({code: 'overlaps', other: C4 16–19})`; input Tape unchanged |
| `moveHole` to a Pipe whose Hole covers the Columns (edge case) | `err overlaps` |
| `addHole` E4 at 19 (2.1), Minimum Hole Length 2.6 Columns | E4 19–21 (3 Columns) |
| `addHole` with the next E4 Hole 2 Columns later (2.2) | 2 Columns long, touching it (R4) |
| `addHole` on a covered Column (2.3) | `err overlaps` |
| `addHole`/`moveHole` to a Pipe not on the Organ | `err not-on-the-organ` |
| change end to Column 104 on a 100-Column Tape (5.1) | `length` 104 |
| add/move to end at Column 110 (5.2) | `length` 110 |
| any success | `songId`, `selectedParts`, `organId`, `transposition`, `columnLength`, `name`, `id` unchanged (FR-017) |
| any success | other Holes, including Holes whose Pipe is not on the Organ, unchanged (FR-019) |

## `api/tape/cutting-problems.ts` (renamed from `export-problems.ts`)

```ts
export type CuttingProblemCode = 'no-pipe' | 'too-short' | 'too-close';
export type CuttingProblem = /* same union as ExportProblem today */;

/** Everything that keeps `tape` from being cut on `organ`, as the export checks it. */
export function cuttingProblems(tape: Tape, organ: Organ): readonly CuttingProblem[];

export type HoleProblem =
  | CuttingProblem
  | {readonly code: 'too-close-previous'; readonly pipe: MidiNoteNumber; readonly start: Column;
     readonly previousStart: Column; readonly gapMm: number; readonly minimumGapMm: Millimetres};

export interface HoleCuttingProblems {
  readonly hole: HoleRef;
  readonly problems: readonly HoleProblem[];
}

/** One entry per Hole with a Cutting Problem; both Holes of a too-close pair get one. */
export function holesWithCuttingProblems(problems: readonly CuttingProblem[]): readonly HoleCuttingProblems[];
```

Removed: `exportProblems`, `ExportProblem`, `ExportProblemCode`. The export (`PlotterExport`) calls
`cuttingProblems` and refuses on a non-empty list, exactly as before (SC-004).

## `api/index.ts`

Adds `validTape`, `TapeRuleViolation`, `TapeRuleViolationCode`, `addHole`, `moveHole`,
`changeHoleLength`, `removeHole`, `HoleRef`, `HoleEdit`, `HoleEditRefusal`, `cuttingProblems`,
`holesWithCuttingProblems`, `CuttingProblem`, `CuttingProblemCode`, `HoleProblem`,
`HoleCuttingProblems`, `column`, `columnCount`. Removes the `exportProblems` exports.
