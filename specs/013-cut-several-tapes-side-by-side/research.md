# Research: Cut several tapes side by side

Phase 0 of [plan.md](plan.md), 2026-10-27. Each item: decision, rationale, alternatives. Worked numbers from
the spec: reference Tape 100 mm wide, `totalLength` 652 mm (Lead-in 50 + 200 × 3 + end gap 2); "Waltz" 60 mm
wide, 400 mm long; roll plotter "Vinyl cutter", working width 300 mm, Tape spacing 3 mm.

## R1. A pure cut function over `TapeGeometry`

**Decision**: `sideBySideCut(tapes, plotter)` in `api/tape/side-by-side-cut.ts` takes the Tapes in Lane order
(each with its Organ) and a `RollPlotter`, builds each Tape's `tapeGeometry(tape, organ)` and places Lane `i`
at `top_i = top_{i−1} + width_{i−1} + tapeSpacing` (`top_1 = 0`). It returns the Lanes, `usedWidth` (far edge
of the last Lane, 0 without Lanes), `freeWidth = workingWidth − usedWidth` and `length` (the longest
`totalLength`). `laneRoom(cut, tapeWidth)` answers whether one more Tape fits: needed = `tapeWidth` plus the
spacing when a Lane exists; fits when `needed ≤ freeWidth + 1e-9`.

Checks: reference alone → used 100, free 200; + Waltz → used 163, free 137, Waltz top 103; + reference again
→ needed 103, fits, free 34; a fourth 100 mm Tape → needed 103 > 34, refused. Spacing 5 → Waltz 105–165.

**Rationale**: the same `TapeGeometry` as the Tape view and spec 003 (FR-012); each Lane is that geometry
moved, so SC-002 holds by construction. Pure and fast enough to recompute on every change (SC-005).

**Alternatives**: computing positions in the component (rules outside the domain, constitution III); a
packing algorithm (out of scope, decision 30).

## R2. Lanes that no longer fit

**Decision**: every Lane carries `fits`: true while its far edge `top + width ≤ workingWidth + 1e-9`. Since
Lanes only grow downwards, the first non-fitting Lane and all after it are marked. The page marks them and
saving is refused naming each (FR-008, FR-013, Story 5 scenario 3).

**Rationale**: a simple monotone rule the user can fix by removing or reordering Lanes.

**Alternatives**: marking only the first overflowing Lane (later Lanes would look fine but are not cut).

## R3. The SVG for several Lanes

**Decision**: `plotter-svg.ts` keeps `plotterSvg(geometry: CutGeometry)` and gains
`sideBySideSvg(cut: SideBySideCut)`. Both use one internal writer `svgDocument(length, width, parts)` and the
existing `holePath` plus an extracted `outlinePath(outline)`. Each Lane's part is `laneGeometry(lane)`: the
Tape's `CutGeometry` with every Slot's `y` and every Outline corner's `y` moved by `lane.top`. Order: Lane 1's
Holes (spec 003 cut order), its Tape Outline, then Lane 2 … (FR-011). Document size: `length` × `usedWidth`
mm. A one-Lane cut is byte-identical to `plotterSvg(tapeGeometry(...))` (Story 2 scenario 5), checked against
the existing reference fixture `plotter-svg.reference.svg`.

The outline path `M tip H topEnd V bottomEnd.y H columnOneBottom.x Z` already reads absolute `y`, so moving
the corners is enough.

**Rationale**: one place for path syntax and number format; single-Tape output provably unchanged.

**Alternatives**: a second writer (two places to keep alike); SVG `<g transform="translate(...)">` per Lane
(cutter software handles transforms unevenly, and SC-002 asks for absolute positions within 0.01 mm).

## R4. Widths and lengths shown

**Decision**: the Lane list shows the Organ's tape width (`geometry.width`) and the cut length
`geometry.totalLength` (652 mm for the reference Tape, as the spec's file length). The free width is shown as
"N mm free"; when negative, as "N mm too wide". Numbers via `formatNumber` in the app's language.

**Rationale**: the spec's worked numbers are cut lengths; what the user plans on the roll is the cut.

**Alternatives**: `tapeLengthInMillimetres` (600 mm, Columns only; doesn't match the drawing or the file).

## R5. Route, page state and the Plotter pick

**Decision**: route `tapes/side-by-side` (declared before `tapes/:id`, not in the rail, title
`TAPE.SIDE_BY_SIDE.TITLE`) with the ticked Tapes as a repeated query parameter `tape` in ticked order.
`lane-query.ts` reads them once on entry; the page keeps the Lanes in a signal of entries
`{key: number, tapeId}` (a running key, since the same Tape may be in several Lanes), resolved against the
`TapeLibrary` and `OrganLibrary` in a `computed`, so a changed Tape or Organ shows at once and a removed
Tape's Lanes disappear (edge cases). Unknown ids in the URL are dropped.

The roll plotter pick is a page signal: it starts with `PlotterPreference.picked()` when that is a roll
plotter, else the only roll plotter if there is exactly one, else none; it is resolved against the library, so
a removed Plotter or one turned into a sheet Plotter reads as none (edge case). Picking here does not write
the preference.

**Rationale**: the page is its own route (clarified); query parameters make the entry testable and keep the
Tape list decoupled; nothing is stored (FR-015). Not writing the preference keeps the Tape view's piece count
from changing behind the user's back.

**Alternatives**: a shared selection service (hidden state between pages); keeping Lanes in the URL on every
change (no gain: leaving the page ends the arrangement anyway); writing the preference (side effect on the
Tape view); auto-picking the first roll plotter of several (a silent choice the user may not notice).

## R6. Ticking Tapes in the Tape list

**Decision**: a first column `tick` with a `mat-checkbox` per row (`data-testid="tick-tape"`, aria-label
"Pick <name> for a side-by-side cut"); its click stops the row's open. A Tape without an Organ can't be
ticked (disabled, its existing "Organ not available" text says why; Story 3 scenario 3). The ticked ids are a
signal list in tick order (unticking removes). A page-head button `cut-side-by-side` ("Cut side by side (2)")
appears with at least one tick and navigates with the ids in that order. Ticks are not kept when leaving the
list.

**Rationale**: FR-003 asks for the ticked order; a list keeps it, a `SelectionModel` doesn't.

**Alternatives**: multi-select via row click (conflicts with opening a Tape); `SelectionModel` (unordered).

## R7. Cutting Problems and refusals

**Decision**: `sideBySideRefusals(lanes, plotter)` in `api/tape/side-by-side-refusals.ts` returns every
reason in this order: `no-plotter`; `no-lane`; per Lane without an Organ `no-organ` (Lane, Tape name); per Lane
that doesn't fit `lane-does-not-fit` (Lane, Tape name, needed, free); per distinct Tape with problems
`cutting-problems` (Tape name, `cuttingProblems(tape, organ)`), once even if the Tape is in several Lanes. A
roll plotter never adds `no-join` and never splits, so the hole-only overload is exact. The page memoises
`cuttingProblems` per Tape and marks each Lane with a count (FR-008, Story 3 scenario 2).

On Save with refusals, the existing `CuttingProblemsDialogComponent` opens; its data changes from
`ExportRefusal[]` to translated entries (`ProblemText[]`, key + params) so both exports feed it. Side-by-side
entries prefix the Tape name ("Waltz: Hole of C4 at Column 12 is shorter than …") through
`TAPE.SIDE_BY_SIDE.TAPE_PROBLEM`, reusing `cuttingProblemText` for the problem itself.

**Rationale**: one place for the rules; the existing problem texts and dialog stay the single wording.

**Alternatives**: a second dialog (two lists to keep alike); per-Lane problem repetition for copies (noise).

## R8. The suggested file name

**Decision**: `sideBySideFileName(firstTapeName, laneCount, more)` in `api/tape/`. One Lane →
`plotterFileName(name)`. Otherwise `"<name> <more(count)>.svg"` with `count = laneCount − 1` and
`more` = the translated `TAPE.SIDE_BY_SIDE.FILE_NAME_MORE` ("and {{count}} more" / "und {{count}} weitere").
The name is made safe and shortened first so the suffix is never cut, as `tapePieceFileNames` does (spec 011
R7). The result passes `isSafeFileName(…, 'svg')`.

**Rationale**: domain free of translations; the suffix survives long names; same safety rules as spec 003.

**Alternatives**: the renderer concatenates (a long name would cut off "and 2 more" in `safeFileName`).

## R9. The to-scale drawing

**Decision**: a pure view model `rollDrawing(cut)` in `side-by-side-drawing.ts`, rendered as inline SVG whose
`viewBox` is in mm: `0 0 length workingWidth` (or `usedWidth` when larger), so the scale is exact by
construction. Per Lane: its Tape Outline as a path from the moved corners, its Holes as one path (like
`overviewOf.holesPath` in `tape-drawing.ts`), and its number; the Tape spacings appear as gaps; the free width
is a hatched band from `usedWidth` to `workingWidth`; a line marks the working width, and Lanes past it use
the Cutting Problem colour (`--cr-problem`). The drawing has a fixed height (the working width fills it) and
scrolls along the length, as the Tape view does. `role="img"` with an accessible name stating Lanes, used and
free width; inner marks `aria-hidden`.

**Rationale**: FR-008a asks for a to-scale drawing across the working width; long Tapes would make a
fit-to-width drawing a hairline, so the width axis sets the scale. The existing `outline()` helper is px-based
for the Tape view's stage (Lead-in path, borders, ruler) and doesn't fit; the corner data it draws from does.

**Alternatives**: reuse the Tape view's stage (one Tape, rulers, editing); canvas (no DOM for tests);
fit-to-width scale (unreadable for long Tapes).

## R10. Saving: reuse `plotter:save-svg`

**Decision**: `SideBySideExport.save(...)` refuses as R7, else calls `api.plotter.saveSvg` with
`suggestedFileName` from R8, `svg` from R3, and the existing `TAPE.EXPORT.DIALOG_TITLE` and `FILTER_NAME`.
Results as in `PlotterExport`: `saved` → snackbar "Saved in <path>"; `cancelled` → nothing; `failed` or
`rejected` → snackbar with the reason and Retry. A `saving` signal disables Save while running.

`parseSvgSaveRequest` accepts any safe `.svg` name and any `<?xml … <svg ` document up to 64 × 2²⁰ characters;
a few Lanes of 10-minute Tapes stay far below (~1 MB each). Main writes UTF-8 to the chosen path and never
reads the content, so nothing in `app/` changes.

**Rationale**: the payload is exactly one file name and one SVG text (ADR 21); no new channel, no new ADR.

**Alternatives**: a new channel `plotter:save-side-by-side` (duplicate of the existing one).

## R11. Tape spacing on the Plotter and snapshot version 2

**Decision**: `RollPlotter` gains `tapeSpacing: Millimetres`; `SheetPlotter` has none. `DEFAULT_TAPE_SPACING
= 3`. `PlotterDraft.tapeSpacing: number | null`, 3 in `emptyPlotterDraft()` and in `draftOf(sheet)`, kept
while roll is off (like the working length while roll is on). `validatePlotter` checks it only when `roll`:
`value-required` when null or not finite, new code `must-not-be-negative` when `< 0`; 0 is valid (Story 4).
The editor shows `plotter-tape-spacing` (decimal input, comma or point) only for a roll plotter.

Snapshot: `PlotterLibrarySnapshot` version 2, `PlotterSnapshot.tapeSpacing?: number` on roll plotters. The
parser reads version 1 (roll plotters get 3 mm; a v1 entry with `tapeSpacing` is ignored as unknown data, per
ADR 20) and version 2 (a roll plotter needs `tapeSpacing`; a sheet Plotter with one is refused); it writes
version 2. The CHANGELOG notes that an older app can't read the upgraded file (ADR 20 consequence).

**Rationale**: unrepresentable invalid states (constitution III); ADR 20 already covers migration on read.

**Alternatives**: an optional field defaulting at use (every caller must remember the default); keeping
version 1 with an optional field (an old app would then drop the value silently on save; ADR 20 wants a
version per format change).

## R12. Terms

All names come from DICTIONARY.md: Lane (Bahn), Tape spacing (Bandabstand), roll plotter, working width, Tape
Outline, Cutting Problem. "Side-by-side cut" is used by the dictionary's Lane and Tape spacing entries and
names the derived type `SideBySideCut`; "free width" and "used width" are the spec's plain words for parts of
the working width, used only as field names. "Tick" is the spec's UI verb. No new term needed.

## R13. Test strategy (tdd skill pyramid)

- **Node unit (seconds)**: Plotter rules and draft (Tape spacing 3, 0 ok, −1 and NaN refused, sheet ignores
  it); snapshot v1 → 3 mm, v2 round trip, v2 sheet with spacing refused; `sideBySideCut` and `laneRoom` with
  the spec's numbers (200/137/34, third Tape refused, exact fit, spacing 0 and 5); `fits` marks after a
  Plotter change; `laneGeometry` (every Slot and corner moved by `top`, SC-002); `sideBySideSvg` (size
  652 × 163 mm, order Lane by Lane, one Lane byte-identical to the fixture, SC-003 spacing between outlines);
  `sideBySideFileName` (one Lane, "and 2 more", forbidden characters, long names); `sideBySideRefusals` (each
  kind, order, a copied Tape named once).
- **jsdom component (seconds)**: Tape list ticks and button (order, untick, no Organ disabled, navigation);
  page with the in-memory API: picker lists only roll plotters and starts with the preference, no roll plotter
  → "Describe a Plotter…"; Lane list rows, move/remove renumbers, add menu disables with the needed/free text;
  drawing view model; Save refused → dialog entries name Tapes; Save → `saveSvg` request with the expected
  name and SVG; Plotter editor Tape spacing field and error; en/de parity.
- **Playwright e2e (minutes), only what needs real Electron**: `e2e/side-by-side.spec.ts`: describe the
  Vinyl cutter, create the two Tapes, tick both, cut side by side, save through the stubbed save dialog
  (`e2e/support/save-dialog.ts`) and read the file from disk (`width="652mm" height="163mm"`); set the Tape
  spacing to 5 mm and see it after a restart. Everything else stays below.
