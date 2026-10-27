# Data Model: Cut several tapes side by side

Phase 1 of [plan.md](plan.md). Domain types live in `api/` (pure TypeScript, ADR 2); names follow
[DICTIONARY.md](../../documentation/DICTIONARY.md). Lengths are `Millimetres`. Across the width, `y` grows
from the file's top edge (Lane 1) downwards; along the Tape, `x` from the Lead-in's tip, as in `TapeGeometry`.

## Plotter (changed, `api/plotter/plotter.ts`)

| Field | Type | Rule |
|-------|------|------|
| `tapeSpacing` (roll plotter only) | `Millimetres` | finite, ≥ 0; 3 unless changed |

```ts
export const DEFAULT_TAPE_SPACING = 3; // mm
export interface RollPlotter extends PlotterBase {
  readonly roll: true;
  /** The blank strip between two Lanes in a side-by-side cut. */
  readonly tapeSpacing: Millimetres;
}
```

`SheetPlotter` is unchanged and has no Tape spacing.

### PlotterDraft (`api/plotter/plotter-draft.ts`)

Gains `tapeSpacing: number | null`. `emptyPlotterDraft()` sets 3. `draftOf(roll)` copies it; `draftOf(sheet)`
sets 3. Switching `roll` changes only `roll`, so the value comes back.

### validatePlotter (`api/plotter/validate-plotter.ts`)

`PlotterField` gains `'tapeSpacing'`; `PlotterViolationCode` gains `'must-not-be-negative'`.

| Code | Path | When |
|------|------|------|
| `value-required` | `tapeSpacing` | roll, and `null` or not finite |
| `must-not-be-negative` | `tapeSpacing` | roll, and `< 0` |

Not checked for a sheet Plotter. 0 is valid (Tapes touch, each with its own Tape Outline).

## Plotter library snapshot (changed, `api/plotter/plotter-library-snapshot.ts`)

```ts
interface PlotterSnapshot {
  readonly id: string; readonly name: string; readonly format: 'svg';
  readonly workingWidth: number; readonly roll: boolean;
  /** Sheet Plotter only. */
  readonly workingLength?: number; readonly overlap?: number;
  /** Roll plotter only (version 2). */
  readonly tapeSpacing?: number;
}
interface PlotterLibrarySnapshot { readonly version: 2; readonly plotters: readonly PlotterSnapshot[] }
```

| Version read | Rule |
|--------------|------|
| 1 | as before; a roll plotter gets `tapeSpacing` 3 |
| 2 | a roll plotter needs a valid `tapeSpacing`; a sheet Plotter with `tapeSpacing` is refused |
| other | unreadable (moved aside, ADR 8) |

`toPlotterSnapshot` always writes version 2 (ADR 20).

## Lane, side-by-side cut (new, `api/tape/side-by-side-cut.ts`, derived, never stored)

```ts
/** A Tape as it goes into a Lane: the Tape and the Organ it is punched for. */
interface LaneTape { readonly tape: Tape; readonly organ: Organ }

interface Lane {
  /** From 1, Lane 1 at the top edge of the file. */
  readonly number: number;
  readonly tape: Tape;
  readonly organ: Organ;
  /** The Tape's own geometry (spec 003), unmoved. */
  readonly geometry: TapeGeometry;
  /** Distance of the Lane's top edge from the file's top edge, in mm. */
  readonly top: Millimetres;
  /** False when the Lane's far edge passes the working width. */
  readonly fits: boolean;
}

interface SideBySideCut {
  readonly plotter: RollPlotter;
  readonly lanes: readonly Lane[];
  /** Far edge of the last Lane; 0 without Lanes. */
  readonly usedWidth: Millimetres;
  /** workingWidth − usedWidth; negative when Lanes don't fit. */
  readonly freeWidth: number;
  /** The longest Lane's totalLength; 0 without Lanes. */
  readonly length: Millimetres;
}

/** Whether one more Tape of `tapeWidth` fits after the last Lane. */
interface LaneRoom { readonly fits: boolean; readonly needed: Millimetres; readonly free: number }

function sideBySideCut(tapes: readonly LaneTape[], plotter: RollPlotter): SideBySideCut;
function laneRoom(cut: SideBySideCut, tapeWidth: Millimetres): LaneRoom;
/** The Lane's Tape as it is cut: its CutGeometry with every Slot and Outline corner moved down by `top`. */
function laneGeometry(lane: Lane): CutGeometry;
```

Rules (research R1, R2): `top_1 = 0`, `top_i = top_{i−1} + width_{i−1} + plotter.tapeSpacing`;
`usedWidth = top_n + width_n`; `fits = top + width ≤ workingWidth + 1e-9`; `laneRoom.needed = tapeWidth +
(lanes > 0 ? tapeSpacing : 0)`, `fits = needed ≤ freeWidth + 1e-9`.

Invariants (tests, SC-002, SC-003): neighbouring Lanes' Outlines are exactly `tapeSpacing` apart; every Slot
and corner of `laneGeometry(lane)` equals `tapeGeometry(...)` with `y + top` (within 1e-9); Lane numbers are
1…n in order.

`LaneTape` is a parameter shape, not a domain term; it is not exported under a new name in UI texts.

## SVG (`api/tape/plotter-svg.ts`)

```ts
function plotterSvg(geometry: CutGeometry): string;      // unchanged output
function sideBySideSvg(cut: SideBySideCut): string;       // see contracts/side-by-side-svg.md
```

## Refusal (new, `api/tape/side-by-side-refusals.ts`)

```ts
type SideBySideRefusal =
  | {readonly code: 'no-plotter'}
  | {readonly code: 'no-lane'}
  | {readonly code: 'no-organ'; readonly lane: number; readonly tapeName: string}
  | {readonly code: 'lane-does-not-fit'; readonly lane: number; readonly tapeName: string;
     readonly needed: Millimetres; readonly free: number}
  | {readonly code: 'cutting-problems'; readonly tapeName: string;
     readonly problems: readonly HoleCuttingProblem[]};

/** Lanes in order, each Tape with its Organ or undefined when the Organ is missing. */
function sideBySideRefusals(
  lanes: readonly {readonly tape: Tape; readonly organ: Organ | undefined}[],
  plotter: RollPlotter | undefined,
): readonly SideBySideRefusal[];
```

Order: `no-plotter`, `no-lane`, `no-organ` and `lane-does-not-fit` by Lane, then `cutting-problems` once per
distinct Tape (by first Lane). Empty means the cut can be saved. `lane-does-not-fit.needed` is the Lane's
width plus the spacing before it; `free` the width left before it.

## File name (new, `api/tape/side-by-side-file-name.ts`)

```ts
function sideBySideFileName(firstTapeName: string, laneCount: number, more: (count: string) => string): string;
```

`laneCount ≤ 1` → `plotterFileName(firstTapeName)`. Else `"<safe name> <safe more(laneCount − 1)>.svg"`, the
name shortened so the stem stays within `safeFileName`'s 200 characters.

## Page state (renderer, `src/app/features/tape/side-by-side/`)

| Signal | Type | Source |
|--------|------|--------|
| `entries` | `readonly {key: number; tapeId: TapeId}[]` | `tape` query parameters on entry; add, move, remove |
| `pickedId` | `PlotterId \| undefined` | preference if roll, else sole roll plotter, else none; the picker |
| `plotter` | `RollPlotter \| undefined` | `pickedId` resolved in `PlotterLibrary`, roll only |
| `laneTapes` | `readonly {tape, organ \| undefined}[]` | `entries` resolved; unknown Tapes dropped |
| `cut` | `SideBySideCut \| undefined` | `sideBySideCut` when a plotter is picked and every Lane has an Organ |
| `refusals` | `readonly SideBySideRefusal[]` | `sideBySideRefusals(laneTapes, plotter)` |

Nothing is written to `localStorage` or a snapshot.

## State transitions

- Plotter: Tape spacing changed in the editor → `plotters.json` written (v2).
- Lanes: ticked Tapes → Lanes; add / move up / move down / remove; leaving the page discards them.
- Picked roll plotter: none ⇄ a roll plotter; removed or turned into a sheet Plotter → none.
