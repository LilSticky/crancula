# Research: Cut a tape in pieces

Phase 0 of [plan.md](plan.md), 2026-10-25. Each item: decision, rationale, alternatives. The worked numbers
use the reference of the spec: Lead-in 50 mm, Column length 3 mm, 200 Columns, Minimum Gap 2 mm (end gap),
whole Tape 652 mm; Plotter with working length 300 mm, Overlap 20 mm.

## R1. Where Plotters live

**Decision**: a Plotter is an aggregate of its own: domain types and rules in `api/plotter/`, a snapshot file
`<userData>/snapshots/plotters.json` (version 1) built from `createSnapshotFile` with two allow-listed channels
`plotters:load` and `plotters:save`, and a `PlotterLibrary` signal store in the renderer, loaded on startup like
`OrganLibrary`. It is flushed before quit with the other two files. No cascade: removing a Plotter touches no
Organ or Tape (FR-004).

**Rationale**: ADR 18 already says later aggregates add a configuration of `snapshot-file.ts`, not a copy; one
file per aggregate keeps a damaged `plotters.json` from blocking Organs or Tapes. Plotters are described data
the owner would lose with cleared browser storage, so `localStorage` (ADR 11) is wrong for them.

**Alternatives**: inside `organs.json` (version bump, unrelated data coupled); `localStorage` (domain state,
breaks ADR 11); a generic settings snapshot (nothing else needs it yet).

## R2. Plotter shape and rules

**Decision**: `Plotter` is a discriminated union on `roll`: a roll plotter has `workingWidth` only; a sheet
Plotter also has `workingLength` and `overlap`. `format` is the literal `'svg'`. The editor holds a
`PlotterDraft` with all fields (numbers or `null`) so switching the roll toggle off brings the last entered
working length and Overlap back (Story 1, scenario 3). `validatePlotter(draft)` is the only place of the rules
(FR-001, FR-002): name not blank after trimming; each length present, finite and > 0; Overlap < working
length (strictly). Violations carry a path (`name`, `workingWidth`, `workingLength`, `overlap`) and a code, as
`validateOrgan`, so the form maps them to fields the same way (`organ-form.ts`). A new draft has Overlap 20.

**Rationale**: the union makes "a roll plotter with an Overlap" unrepresentable (constitution III). Reusing the
Organ editor's validation pattern and decimal input keeps one way of doing forms (comma or point, FR-002).

**Alternatives**: one flat type with optional fields (invalid states representable); rules in the form (two
places for rules).

## R3. Where a Join can be

**Decision**: work on `TapeGeometry` in mm from the Lead-in's tip. The Join candidates are the Column
boundaries `x_k = leadIn + k · columnLength` for `k = 1 … length − 1`. Each drawn Slot `[a, b]` blocks the open
interval `(a − g, b + g)` with `g` = Minimum Gap (`geometry.endGap`). A candidate is a **possible Join** when
neither `x_k` nor `x_k + overlap` lies in a blocked interval (FR-008); touching at exactly `g` is allowed
(tolerance 1e-9 mm). Slots without a Pipe are not in the geometry, so they never block (spec edge case).
Blocked intervals are sorted and merged once; the candidates are swept in order with two pointers.

For a Join at a Column boundary the mm test equals the Column test of `holeLimitsOf` (a gap of `ceil(g / c)`
Columns), so the rule matches the Minimum Gap of `cuttingProblems`; the Overlap's end is generally not on a
Column boundary, which is why the test is in mm.

**Rationale**: one representation for both ends of the Overlap; the same Slots the Tape view draws and the SVG
cuts (FR-014). The sweep is linear after sorting (SC-005).

**Alternatives**: testing in Columns only (the Overlap end is not on a boundary); per-candidate scan of all
Holes (O(Columns · Holes), too slow for a 10-minute Tape).

## R4. Fewest Tape pieces and the new Cutting Problem

**Decision**: greedy from the Lead-in's tip (FR-010). With the current piece starting at `s` (0, then the last
Join): if `totalLength − s ≤ W` the rest is the last piece (with the end gap). Otherwise take the last possible
Join `J > s` with `J + overlap − s ≤ W`; that piece ends at `J + overlap`, the next starts at `J`. Greedy
furthest-reach is optimal here: at every step its Join is at least as far as that of any valid cut, so it
needs no more pieces (SC-004).

Cutting Problems: list the possible Joins `P`, add the tip `0` in front and the end cut at the back. For each
neighbouring pair `(p, q)` the piece from `p` to `q + overlap` (or to `totalLength` when `q` is the end cut)
must be ≤ `W`; each pair that is not is one Cutting Problem `no-join` (FR-015). This is exact: if every pair
fits, the greedy search always reaches the next possible Join, so it finishes; if one pair doesn't, no cut can
bridge it. Both the pieces and the problems come from one function, so they can never disagree.

The problem names every Column of its stretch: from the Column after `p` (Column 1 after the tip) to the
Column before `q` (the last Column when `q` is the end cut). Story 3's Hole from Column 1, 100 Columns long,
covers 50–350 mm and blocks up to 352 mm (one Minimum Gap more); the first possible Join is after Column 101 at 353 mm, and
353 + 20 > 300, so the stretch is Columns 1–101. The spec said 1–100, written before the Minimum Gap answer
(Q3); it is corrected. Shortened to 70 Columns (50–260 mm), the Join after Column 71 at 263 mm gives a first piece of
283 mm, and the problem is gone.

Checks against the spec: the reference Tape with no Holes gives Joins after Column 76 (278 mm) and 169
(557 mm), pieces 0–298, 278–577, 557–652 (Story 2, scenario 1). Lead-in + Overlap ≥ W: no `J` fits after the
tip, so the stretch from Column 1 to the first possible Join is a problem (edge case). A Column longer than
`W − overlap` makes neighbouring Joins too far apart (edge case "no Holes").

A Join is placed only when more than `W` is left, so the next piece is always longer than the Overlap; no
separate rule for "Overlap past the end cut" is needed.

**Rationale**: one rule set, provably fewest pieces, problems exactly where no cut exists.

**Alternatives**: dynamic programming over all candidates (same answer, more code); placing Joins evenly
(not "as close as possible before the working length", decision 11).

## R5. The geometry and SVG of a Tape piece

**Decision**: `pieceGeometry(geometry, piece)` returns what `plotterSvg` reads: `totalLength` = piece length,
`width`, `slots` and `outline`. Slots are those wholly inside `[start, end]` (with tolerance), shifted by
`−start`, in the cut order of spec 003 (start, then row); a Slot in an Overlap is in both pieces (FR-012).
The outline keeps the existing four-corner shape: on the first piece the tip and Column 1's bottom corner
(the Lead-in's diagonal, or square when the Lead-in is 0); on every other piece the tip and that corner are
both at x = 0, so the same path is a square cut at the Join. The end is at the piece's length: the end of its
Overlap, or the end cut on the last piece (FR-013). `plotterSvg`'s parameter is narrowed to these four fields;
its output for a whole Tape stays byte-identical (SC-007).

**Rationale**: one SVG writer for whole Tapes and pieces; the Tape Outline type doesn't change.

**Alternatives**: a second writer for pieces (two places to keep alike); clipping paths in the SVG (cutters
ignore clips; FR-023 wants only cuts).

## R6. Saving several files into one folder

**Decision**: one new channel `plotter:save-svg-pieces` (ADR 28). The renderer sends the pieces' file names and
SVG texts plus every translated text the main process shows: folder dialog title and button, replace question
message, detail, replace and cancel buttons. Main validates with `parseSvgPiecesSaveRequest` (each name as in
spec 003, names distinct ignoring case, 2–999 pieces, each SVG ≤ 64 × 2²⁰ characters, the sum too), shows
`dialog.showOpenDialog` with `openDirectory` and `createDirectory` (default: the last export folder, else
Documents), then checks which names already exist there. If any do, it shows one `dialog.showMessageBox`
naming them; anything but "Replace" ends with `cancelled`. Then it writes the files in order, stopping at the
first failure, and returns `saved` with the folder, or `failed` with the file name, the OS error code and the
names written so far. The folder of the last export (either channel) is remembered in memory.

**Rationale**: the SVGs exist before the dialog, so one round trip suffices (unlike a Recording, ADR 26); the
renderer never sends a path (ADR 4); main alone knows what exists in the folder, so it must ask the replace
question; main has no translations of its own outside the menu, so the renderer sends the texts.

**Alternatives**: `plotter:save-svg` per piece (a dialog per file, no common folder); choose-folder then write
with a token (two round trips for no gain); a zip file (spec 23 wants files in a folder).

## R7. File names of the pieces

**Decision**: `tapePieceFileNames(tapeName, count, label)` in `api/tape/` pads the numbers to the digits of
`count`, asks `label(number, count)` for the translated part (`TAPE.EXPORT.PIECE_LABEL`, "{{number}} of
{{count}}" / "{{number}} von {{count}}"), and returns `"<safe name> <safe label>.svg"` per piece. The Tape name
is made safe with `safeFileName` and shortened first, so the label is never cut. A one-piece Tape keeps
`plotterFileName` (FR-022).

**Rationale**: the domain stays free of translations; the label survives long names; the files sort in order
(FR-021, edge case "more than 9 pieces").

**Alternatives**: the renderer builds the whole name (a long name would cut off the number in `safeFileName`).

## R8. Picking a Plotter in the Tape view

**Decision**: `PlotterPreference` in `src/app/features/plotter/` keeps the picked `PlotterId` under
`localStorage` key `crancula.plotter` (ADR 11, like `crancula.language`). `picked()` is a computed signal: the
Plotter of the library with that id, or `undefined` ("No Plotter") when none is stored or it was removed
(Story 5, scenario 3). The Tape view computes `tapePieces` and `cuttingProblems(tape, organ, picked)` from it,
so every change of Tape, Organ or Plotter shows at once (FR-015, Story 5 scenario 1). Picking is allowed while
the Preview plays (spec edge case) and never touches the Tape or its undo history (FR-006).

**Rationale**: the user chose one choice for all Tapes as a UI preference (Session 2026-10-25, Q1); ADR 11
covers it, so no new ADR.

**Alternatives**: per Tape (rejected by the user).

## R9. Drawing in the Tape view

**Decision**: `tape-drawing.ts` gains `joinMarks(pieces, scale)`: per Join a vertical line across the Tape at
the Join and a translucent band from the Join to the end of its Overlap, behind the Holes, `aria-hidden`; the
side panel text carries the count for assistive technology. A no-join stretch is marked like the existing
Hole marks: a band over its Columns across the Tape in the Cutting Problem colour, and its entry in the
Cutting Problems list scrolls the stage to its first Column (FR-016). Colours come from the existing tokens
(`--cr-problem`, select colours); contrast checked in the UX review.

**Rationale**: "what you see is what gets cut" (spec 003); reuse of mark and scroll code.

**Alternatives**: count only (rejected by the user, Q4).

## R10. Moving the leave-unsaved guard

**Decision**: `leave-unsaved.guard.ts` and `leave-unsaved-dialog/` move from `features/organ/` to
`features/shared/leave-unsaved/` unchanged; the Organ routes import from there. The Plotter editor implements
`UnsavedChangesCheck`.

**Rationale**: the guard is already generic (`UnsavedChangesCheck`); a second copy would drift (FR-003).

## R11. Testing the dialogs in e2e

**Decision**: as in spec 003, `main.ts` looks up `dialog.showOpenDialog` and `dialog.showMessageBox` at call
time, so Playwright's `electronApp.evaluate` replaces them; the test answers with a temporary folder and reads
the files back from Node.

**Rationale**: native dialogs can't be driven by Playwright; the existing export e2e already works this way.
