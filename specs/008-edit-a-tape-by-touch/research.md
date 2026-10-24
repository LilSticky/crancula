# Research: Edit a tape by touch

Decisions for [plan.md](plan.md). Facts about today's code were gathered on 2026-10-24.

## R1. One selection of Holes or a Spot

- **Decision**: the Tape view's `selection` signal becomes `TapeSelection = { holes: HoleSelection } |
  { spot: Spot }` (`src/app/features/tape/tape-view/spot.ts`). A `computed` `holeSelection` gives the
  existing readers their `HoleSelection` (`[]` while a Spot is selected).
- **Rationale**: FR-003 makes the two exclusive; one signal makes "Hole and Spot both selected"
  unrepresentable (constitution III). The computed keeps the many existing readers unchanged.
- **Alternatives**: two signals with an invariant kept by setters (both can drift); a Spot as a
  pseudo-Hole inside `HoleSelection` (mixes a Tape value with a view value).

## R2. A tap is a press without travel; no `dblclick`

- **Decision**: a tap is `pointerdown` → `pointerup` with `isDrag` false (`hole-drag.ts`, 4 px), for
  every pointer type. On empty Tape a tap selects the Spot under it (`gridAt`), or, on the selected
  Spot, adds a Hole there (`addEdit`). The `(dblclick)` binding and `onDoubleClick` go: a mouse
  double-click is two taps on one Spot and so still adds.
- **Rationale**: one gesture model for finger, pen and mouse (ADR 25); keeping `dblclick` would add a
  second Hole handler and race with the second tap.
- **Alternatives**: `click` events on the svg (a touch `click` comes late and after a pan is
  unreliable); keep `dblclick` for mouse only (two code paths for one outcome).

## R3. Double-tap on a Hole

- **Decision**: a pure `TapMemory` in `src/app/features/tape/tape-view/double-tap.ts`:
  `nextTap(memory, tap: { hole, at, added }) → { memory, double: boolean }`. Double when the same Hole
  was tapped within `DOUBLE_TAP_MS = 400` and the earlier tap neither added that Hole nor carried a
  modifier (Ctrl/Cmd/Shift-clicks never count). A double removes through `keyEdit(…, 'remove')`, so
  the next selection is the Delete rule (`neighbourOf`).
- **Rationale**: the renderer can't read the system double-click time; 400 ms is the common default.
  Keeping the timing pure makes it unit-testable with fake timestamps.
- **Alternatives**: `dblclick` on the Hole (fires for mouse only on some touch stacks, and the first
  click's selection change re-renders the target).

## R4. Grips outside the Hole

- **Decision**: the selected Hole's handles move outside its rect: the visible grip is a 6 px wide bar
  with rounded ends just beyond each end (accent colour from the theme), and its hit area is a
  transparent rect at least 44 × 44 screen px that starts at the Hole's end and reaches outward (centred vertically, never over the Hole body), converted to SVG units with the
  current scale. The whole Hole body is "move"; `holePartAt` and `HANDLE_PX` go. Grips draw above all
  Holes, so a hit area that overlaps a neighbour row wins there while a Hole is selected.
- **Rationale**: SC-003 (44 px, WCAG 2.5.5 target size); the inside handles of spec 004 (≤ 8 px, ≤ a
  third of the width) are unusable by finger and leave nothing to grab on short Holes.
- **Alternatives**: handles above/below the Hole (rows are tight and the meaning "end" is lost); a
  long-press resize mode (out of scope, slower).

## R5. Touch drag on empty Tape scrolls

- **Decision**: `.scroll svg` gets `touch-action: pan-x pan-y` (today `none`); Holes, grips and the
  playhead grip get `touch-action: none`. A touch press is still recorded, so a touch tap
  selects a Spot, but once it travels (`pointerType === 'touch'`) no frame is drawn. When the browser takes the gesture over for panning it fires `pointercancel`, which
  `onPointerCancel` already handles (no tap, no edit).
- **Rationale**: browsers decide panning at `pointerdown` from the target's effective `touch-action`
  (the intersection with its ancestors), so per-element values are enough; no JS scrolling needed.
- **Alternatives**: implementing pan in JS from pointer moves (jank, re-implements inertia).

## R6. Dragging the playhead

- **Decision**: a playhead grip (`data-testid="playhead-grip"`, triangle in the ruler, 44 px hit
  area) takes pointer capture. Moves set `preview.setPlayhead(column)` from `gridAt` (clamped to the
  Tape's Columns). If the Preview played at the press, the component calls `preview.stop()` at the
  press and `preview.play(tape, organ, column)` at the release. No new `TapePreview` API.
- **Rationale**: ADR 24's scheduler already starts from any Column; stop + play is exactly
  "pauses during the drag, goes on from the drop".
- **Alternatives**: a `seek` that keeps the audio context running (no audible gain; more state).

## R7. Crank speed range on the Organ

- **Decision**: `api/organ/crank-speed-range.ts`: `CrankSpeedRange = { slowest: CrankSpeed; fastest:
  CrankSpeed }` (branded), `crankSpeedRange(slowest, fastest)` returns `undefined` unless both are
  `CrankSpeed`s and `slowest < fastest`; `DEFAULT_CRANK_SPEED_RANGE` = 30–120. `Organ.crankSpeedRange`
  is required. `OrganDraft` gains `slowestCrankSpeed` and `fastestCrankSpeed` (`number | null`);
  `emptyOrganDraft()` fills 30 and 120. Violations: `value-required`,
  `crank-speed-out-of-range` (params min/max), `slowest-not-below-fastest` (on
  `fastestCrankSpeed`). It imports `crankSpeed` from `api/tape/crank-speed.ts`, which imports nothing
  from `api/organ` (no cycle).
- **Rationale**: decisions 8–9; required, because every Organ has a range from now on.
- **Alternatives**: optional like Tape per Crank turn (the user chose a default for older Organs).

## R8. Organ snapshot version 5

- **Decision**: `toSnapshot` writes version 5 with `crankSpeedRange: { slowest, fastest }`;
  `parseOrgan` gives v1–v4 entries the default range, then `validateOrgan` as today (ADR 20).
- **Rationale**: snapshots are migrated on read (ADR 20).

## R9. Slider in the preview section

- **Decision**: `mat-slider` with `min`/`max` from the Organ's range, `step` 1, beside the number
  field. `(input)` emits `crankSpeedTrial: number`: the Tape view hands an uncommitted Tape with that
  speed to `preview.changeTape` (no save, no undo step). `(change)` (release, or a keyboard step)
  emits `crankSpeedChange: Tape` through `crankSpeedChangeTo`, the existing commit path, one undo
  step. A Tape speed outside the range: the slider shows the nearest end, and a hint
  (`crank-speed-outside-range`) names the range.
- **Rationale**: decision 10; reuses the field's validated commit path.

## R10. ADR

- **Decision**: ADR 25 "One gesture model for all pointer types": tap = press without travel; touch
  drags on empty Tape pan; mouse and pen drags frame; no `dblclick` handlers. Supersedes the pointer
  table of spec 004's contract, not an ADR.
