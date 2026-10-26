# Implementation Plan: Cut a tape in pieces

**Branch**: `011-cut-a-tape-in-pieces` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md) | **Issue**: [#168](https://github.com/LilSticky/crancula/issues/168)

**Input**: Feature specification from `specs/011-cut-a-tape-in-pieces/spec.md`

## Summary

The owner describes Plotters on their own screen in the rail, like Organs (name, SVG, working width, roll
toggle, and for a sheet Plotter a working length and an Overlap, 20 mm to begin with). Plotters are kept in a
snapshot of their own, `plotters.json` (version 1). The Tape view's side panel gets a Plotter picker, one
choice for all Tapes, kept in `localStorage` (ADR 11). With a sheet Plotter picked, a pure domain function cuts
the Tape's geometry (the same `TapeGeometry` as the Tape view and the export of spec 003) into the fewest Tape
pieces: Joins on Column boundaries where no Hole comes closer than the Minimum Gap to the Join or to the end
of its Overlap, found greedily from the Lead-in's tip. Where no Join fits, the stretch is a new kind of Cutting
Problem. The Tape view draws the Joins and Overlaps and names the piece count. Export writes one SVG per Tape
piece into a folder through one new IPC channel, `plotter:save-svg-pieces`; the main process shows the folder
dialog, asks once before replacing, and writes. A one-piece Tape and "No Plotter" export exactly as in
spec 003. Details in [research.md](research.md); decision in
[ADR 28](../../documentation/adr/0028-tape-pieces-saved-into-one-folder-by-main.md).

## Technical Context

**Language/Version**: TypeScript (strict), Angular 22, Electron (current major, ADR 14)

**Primary Dependencies**: none new; Angular Material (select, slide toggle, form fields), `@ngrx/signals` for
the Plotter library store, as for Organs

**Storage**: new snapshot `<userData>/snapshots/plotters.json`, version 1, through `createSnapshotFile`
(ADR 3, 8, 18); the picked Plotter in `localStorage` key `crancula.plotter` (ADR 11). Organ and Tape snapshots
unchanged.

**Testing**: Vitest in node (Plotter rules, snapshot v1, Join search, Tape pieces, piece geometry, piece SVG,
file names, new Cutting Problem, piece-save request parser, `plotter:save-svg-pieces` handler with fake
effects, Plotter snapshot file), Vitest in jsdom (Plotter list, editor, form, store, preference, picker
section, Tape view drawing of Joins and Overlaps, Cutting Problems list, export flow), Playwright e2e
`e2e/plotter-library.spec.ts` (describe, restart, change, remove) and `e2e/tape-pieces.spec.ts` (pick, Cutting
Problem, export into a folder with the dialogs stubbed, replace question, too wide)

**Target Platform**: Electron desktop on Windows, macOS, Linux

**Project Type**: desktop app (Angular renderer, Electron main, shared `api/`)

**Performance Goals**: Tape pieces and the new Cutting Problem within 0.2 s of an edit on a 10-minute Tape
(SC-005): one sweep over sorted blocked intervals, O((Holes + Columns) · log Holes)

**Constraints**: positions within 0.01 mm (SC-002), compared with the 1e-9 mm tolerance of `validateOrgan`;
no path from the renderer (ADR 4); each piece ≤ 64 × 2²⁰ characters as in spec 003, at most 999 pieces and
64 × 2²⁰ characters per request

**Scale/Scope**: a few Plotters; a 10-minute Tape of ~10 000 Columns and a few thousand Holes; up to a few
dozen Tape pieces

## Constitution Check

| Principle | Check | Result |
|-----------|-------|--------|
| I. Domain-Driven Slicing | Capability "Cut a tape in pieces"; Plotter, Working area, Tape piece, Join, Overlap and the new Cutting Problem approved and in DICTIONARY.md (#171); "working length", "working width", "roll plotter", "sheet Plotter" are phrases inside the Plotter entry; "stretch" is the spec's plain word | Pass |
| II. TDD | Every task starts with a failing test; reference Tapes of spec 003 and Story 3 drive the domain tests | Pass |
| III. Framework-Free Domain | Plotter, rules, snapshot, Join search, piece geometry, SVG and file names in `api/`; UI only shows and asks | Pass |
| IV. Memory First | Plotter library store is the truth; `plotters.json` version 1 written by main, loaded on startup; the pick is a UI preference (ADR 11) | Pass |
| V. Strict Electron Boundary | Two allow-listed snapshot channels and one export channel, each payload parsed with an `api/` parser in main; the renderer never names a path | Pass |
| VI. Context Never Gets Lost | ADR 28; STATUS and ROADMAP at the end of the slice; DICTIONARY already done | Pass |
| VII. Small Vertical Slices | US1 (describe, restart) usable alone; US2 export; US3 Cutting Problem and drawing; US4, US5 small on top | Pass |

Post-design re-check: unchanged, pass. No new dependency.

## Project Structure

### Documentation (this feature)

```text
specs/011-cut-a-tape-in-pieces/
├── spec.md, open-questions.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/plotter-library-ipc.md, contracts/tape-pieces-ipc.md, contracts/plotter-ui.md
└── tasks.md (next: /speckit-tasks)
```

### Source Code (repository root)

```text
api/plotter/
├── plotter.ts                    # PlotterId, Plotter (roll | sheet), DEFAULT_OVERLAP 20 mm
├── plotter-draft.ts              # what the editor holds; emptyPlotterDraft, draftOf(plotter)
├── validate-plotter.ts           # PlotterViolation codes and paths (FR-002)
└── plotter-library-snapshot.ts   # version 1, toPlotterSnapshot, parsePlotterLibrarySnapshot
api/tape/
├── tape-pieces.ts                # tapePieces(geometry, plotter): too-wide | pieces | no-join (R3, R4)
├── tape-piece-geometry.ts        # pieceGeometry(geometry, piece): Slots shifted, own Tape Outline (R5)
├── tape-piece-file-name.ts       # tapePieceFileNames(tapeName, count, label) (R7)
├── cutting-problems.ts           # + 'no-join' kind; cuttingProblems(tape, organ, plotter?)
└── plotter-svg.ts                # parameter narrowed to what it reads; output unchanged (SC-007)
api/app/
├── svg-pieces-save-request.ts    # SvgPiecesSaveRequest/Result, parseSvgPiecesSaveRequest (R6)
└── crancula-api.ts               # + plotters.load/save, plotter.savePieces
api/index.ts                      # exports the above
app/
├── plotter-library-file.ts       # createSnapshotFile config for plotters.json
├── plotter-library-ipc.ts        # PLOTTER_LIBRARY_CHANNELS plotters:load, plotters:save
├── plotter-ipc.ts                # + plotter:save-svg-pieces; effects gain open dialog, message box, exists
├── preload.ts                    # + plotters, plotter.savePieces
└── main.ts                       # wires the file, the handlers and the flush before quit
src/app/core/crancula-api.token.ts # in-memory plotters and savePieces
src/app/features/shared/leave-unsaved/ # guard and dialog moved here from organ/ (used by both editors)
src/app/features/plotter/
├── routes.ts                     # plotters, plotters/new, plotters/:id (rail icon content_cut)
├── plotter-library.store.ts      # signalStore like OrganLibrary; put, remove
├── plotter-preference.ts         # the picked PlotterId in localStorage, falls back to none
├── plotter-list/                 # list with name, Working area, Overlap or "roll"; new, edit, remove
└── plotter-editor/               # form over PlotterDraft, validatePlotter as the only rule (like organ-form)
src/app/features/tape/tape-view/
├── plotter-section/              # picker, "Describe a Plotter…", piece count or too-wide message
├── tape-drawing.ts               # + joinMarks (Join line, Overlap band), stretch marks
├── cutting-problems/             # + stretch entries, chosen → scroll to the stretch
├── cutting-problem-text.ts       # + NO_JOIN text
└── plotter-export.ts             # plotter-aware: refuse, one file, or pieces into a folder
src/app.routes.ts                 # + plotterRoutes
src/assets/i18n/{en,de}.json      # PLOTTER.*, TAPE.PLOTTER.*, TAPE.CUTTING_PROBLEM.NO_JOIN, TAPE.EXPORT.PIECES_*
e2e/plotter-library.spec.ts, e2e/tape-pieces.spec.ts, e2e/boundary.spec.ts (+ plotters key)
```

**Structure Decision**: the Plotter is its own aggregate under `api/plotter/` and `src/app/features/plotter/`,
mirroring Organs. Cutting in pieces works on `TapeGeometry` in `api/tape/`, so the Tape view, the Cutting
Problem and every piece file share one geometry (FR-014).

## Decisions left open by the spec

- **Stretch Columns**: a no-join Cutting Problem names every Column between its two neighbouring possible
  Joins (R4). Under the Minimum Gap answer (Q3) the stretch of Story 3 is Columns 1–101, not 1–100; the spec
  is corrected on this branch.
- **Join candidates**: the Column boundaries after Column 1 up to before the last Column; never at Column 1's
  start or at the end cut (R3).
- **Overlap end and the end cut**: no extra rule needed; the greedy search only places a Join where more than
  the working length is left, so the next piece is always longer than the Overlap (R3).
- **Replace question**: asked by the main process after the folder is picked, naming the existing files; its
  texts are translated by the renderer and sent with the request (R6).
- **Write failure**: writing stops at the first failing file; files already written stay; the result names
  the file and the OS error code (R6, FR-024).
- **Number padding**: to the digit count of the piece count ("01 of 12", "001 of 100") (R7).
- **A removed or unknown picked Plotter** reads as "No Plotter"; the stored id is cleared on the next pick (R8).
- **Plotter list order**: by name, like the Organ list (`byName`).

## Coordination with slice 010

Slice 010 (Bring Scores onto a tape, branch `010-bring-scores-onto-a-tape`) also changes
`src/app/features/tape/` at implementation time. The Tape view side-panel (`plotter-section/`,
`cutting-problems/`) and drawing (`tape-drawing.ts`, `tape-view.component.*`) changes of this slice will need
a rebase onto 010 once it is merged into `main`. ADR 27 is 010's; this slice uses ADR 28.

## Open questions

None. The corrected Columns of Story 3 (1–101 under the Minimum Gap rule) were confirmed by the user
on 2026-10-25.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| New channel `plotter:save-svg-pieces` | One folder, several files, one replace question (FR-021) | Calling `plotter:save-svg` per piece shows a save dialog per file; a channel that writes to a path the renderer sends breaks ADR 4 |
| Plotter snapshot of its own | Plotters are independent of Organs and Tapes (FR-004) | Putting them in `organs.json` would bump its version and couple a damaged file to unrelated data; `localStorage` is for UI preferences only (ADR 11) |
| Moving the leave-unsaved guard to `shared/` | The Plotter editor warns like the Organ editor (FR-003) | A copy would drift |
