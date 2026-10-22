# Research: Transpose holes

## R1 One command for preview and apply

- **Decision**: `transposeHoles(tape, organ, which, semitones)` returns `{tape, outcome}`. The dialog
  calls it on every change of the semitones and shows `outcome`; Apply commits the `tape` from the
  same call.
- **Rationale**: SC-003 (what is shown is what is applied) holds by construction. Pure and fast
  enough (R8).
- **Alternatives**: a separate `previewTransposition` — two code paths that can drift.

## R2 Which Pipe a transposed Hole goes to

- **Decision**: target note = Pipe note + semitones. If it is outside 0–127, or no Pipe has it and
  no Pipe has its note name, the Hole is removed. Otherwise the Pipe from `octaveMoveTable(organ)`
  (the Pipe itself, else nearest by whole octaves, upward on a tie): `moved` when it is the target,
  `moved-by-octaves` otherwise.
- **Rationale**: spec FR-002/FR-003 and spec 002 FR-009; reuses the import's table unchanged.

## R3 Merging

- **Decision**: after placing every transposed Hole, for each Pipe that received one, sort its Holes
  by start and join every run of overlapping Holes (a.start < b.end) into one Hole from the earliest
  start to the latest end. Touching Holes (a.end === b.start) are not merged. A merge involves at
  least one transposed Hole; untouched Holes never overlap each other (Tape rule).
- **Counting**: `merges` is the number of Holes that result from joining (Story 3: "counts one
  merge"); each lists the Holes it came from.
- **Alternatives**: refuse on overlap as in spec 004 — rejected by the discovery (decision 4).

## R4 Holes whose Pipe is not on the Organ

- **Decision**: never transposed (spec clarification); with "all Holes" they are counted as
  `leftOut`. They can't be selected (they have no row), so "selected Holes" never contains one.

## R5 Range of semitones

- **Decision**: from −(highest − lowest Pipe note) to +(highest − lowest), at most ±127 (the
  `Transposition` brand); default 0 (Apply disabled, FR-015). A number field with stepper buttons;
  values outside the range are clamped on blur.
- **Rationale**: the assumption "must reach every Pipe from every other Pipe"; anything further
  only removes or octave-moves Holes.

## R6 Selection model

- **Decision**: `HoleSelection = readonly SelectableHole[]` (row, start), ordered by when each Hole
  was added; the last one is the **active** Hole that the arrow keys move from and that the
  inspection shows when it is the only one. Empty array = nothing selected.
  - Plain click: select only that Hole (as today). Ctrl-click (Cmd on macOS): toggle it.
  - Drag starting on an empty spot (no Hole, no handle): draws a frame; on release, every Hole on a
    row inside the frame that overlaps its Columns is selected (replacing; with Ctrl/Cmd: added).
    A press without travel on an empty spot clears the selection as a click does today.
  - Arrow: select only the next Hole (as today). Ctrl/Cmd+Arrow: add the next Hole in that
    direction and make it active. Ctrl/Cmd+A: all Holes with a row. Escape: clear.
  - Edits of spec 004 (move, resize, remove, handles) act only when exactly one Hole is selected.
- **Rationale**: platform habits; Shift+Arrow and Alt+Arrow are already edit keys (spec 004), so
  multi-select keys use Ctrl/Cmd, which `editIntent` already ignores.
- **Alternatives**: Shift-click range selection — a "range" across rows is ambiguous on a Tape.

## R7 The Transpose dialog

- **Decision**: a **Transpose** button in the action bar (next to undo/redo), enabled when the Tape
  has Holes on rows. It opens a `MatDialog` with: scope radio ("Selected Holes (n)" — preselected
  when n > 0, disabled when n = 0 — and "All Holes"), the semitones field, the outcome (four counts,
  the removed Holes as "Pipe · Column", "n Holes without a Pipe left out"), and Cancel / Apply.
  Apply is disabled for 0 semitones. The dialog returns the outcome; the view commits it through
  the existing `commit` path with the resulting Holes selected.
- **Rationale**: the outcome must be visible before anything changes (FR-005) and needs room; a
  dialog is keyboard-operable by default (focus trap, Escape cancels, Enter in the field applies).
- **Alternatives**: a side panel section — the panel already holds the Selected Hole and Cutting
  Problems, and a live preview on the Tape would conflict with the selection.

## R8 Performance

- **Decision**: no memoisation; `octaveMoveTable` is built once per call (128 × Pipes), merging is
  one sort per touched Pipe. A unit test with 1,000 Holes guards SC-002 loosely (< 50 ms).

## R9 Undo restores the selection

- **Decision**: `TapeEdit.selection` becomes a `HoleSelection`; `remember` stores the selection
  before applying, so one undo brings back the Tape and the Holes selected before the
  transposition (Story 5).
