# Implementation Plan: Punch a tape

**Branch**: `003-punch-a-tape` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-punch-a-tape/spec.md`

## Summary

In the Tape view, "Export for the Plotter" checks the Tape against its Organ and either lists
every Hole that can't be cut (no Pipe, below the Minimum Hole Length, below the Minimum Gap) or
opens a save dialog suggesting `<Tape name>.svg` and writes one SVG file at true size in mm: every
Hole as a slot, from the Lead-in towards the end, row 1 first, and the Tape Outline last. The Tape
doesn't change.

- **Domain:** the Tape geometry moves from `src/` to `api/tape/` and becomes the single source
  for the view and the file, measured from the Lead-in's tip, with the Tape Outline and the end
  cut one Minimum Gap after the last Column. New pure functions: `exportProblems`, `plotterSvg`,
  `plotterFileName`. Research R1, R3–R5, R7.
- **Main process:** one new allow-listed channel `plotter:save-svg`: validate the request, show
  the native save dialog, write the text, report the path. Research R6.
- **Renderer:** the Export button is enabled; a small `PlotterExport` service runs the check,
  shows a problems dialog or saves, and reports with a snackbar. The Tape view draws the Lead-in
  diagonal and the end cut from the shared geometry. Research R1, R8.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 24, Electron 44, Angular 22

**Primary Dependencies**: Angular Material 22 (`MatDialog`, `MatSnackBar`), `@ngx-translate` 18,
Electron `dialog.showSaveDialog`. **No new dependency**: the SVG is written as text (research R3).

**Storage**: none new. The exported file is written where the user chooses and is not tracked
(FR-014). `organs.json` (version 3) and `tapes.json` (version 1) are unchanged; no migration.

**Testing**:
- Vitest 5 in Node (`vitest.node.config.ts`, ADR 7) for `api/` and `app/`: geometry, check, SVG,
  file name, payload parser, IPC handler with a fake dialog and a temp folder.
- `ng test` (Vitest, jsdom, ADR 9) for `src/`: Tape view, `PlotterExport`, problems dialog.
- Playwright Electron e2e: `dialog.showSaveDialog` replaced in the main process via
  `electronApp.evaluate`; the written file is read back with `fs` (research R9).

**Target Platform**: Electron desktop on Windows, macOS and Linux

**Project Type**: desktop app (Electron main process + Angular renderer + shared domain)

**Performance Goals** (SC-001, SC-005): check, geometry and SVG for a 10-minute Song (about
20 000 Columns, a few thousand Holes) in well under 1 s (all O(H log H)); the file about 1 MB;
whole export under 5 s including the write.

**Constraints**: offline; exact 1:1 mm geometry within 0.01 mm (SC-002; the writer rounds to
0.001 mm); only cuts in the file (FR-011); no Plotter adjustments (FR-013); the main process never
receives a Tape, an Organ or a path to write to (ADR 4, ADR 21).

**Scale/Scope**: one command, one dialog for problems, two snackbars, one new channel. Tapes up
to several metres, always one file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Domain-driven slicing | Named after a user capability ("Punch a tape"); SVG, the save dialog, IPC and UI are adapters inside it. All terms are from DICTIONARY (Tape, Hole, Column, Tape Outline, Lead-in, Border, Tape Bed, Plotter, Minimum Hole Length, Minimum Gap, Pipe, Organ). Code-only names (`TapeGeometry`, `Slot`, `ExportProblem`, `PlotterExport`, `SvgSaveRequest`) are not new domain terms. The problems dialog and messages use dictionary words only. | ✅ |
| II. TDD | Every task starts red: Node Vitest for `api/` and `app/`, `ng test` for the view and service, Playwright for the save flow. Moving the geometry is a refactor under the green view tests, then red tests for the new frame and the Outline. | ✅ |
| III. Framework-free domain | `api/tape/tape-geometry.ts`, `export-problems.ts`, `plotter-svg.ts`, `plotter-file-name.ts` and `api/app/svg-save-request.ts` import only `api/`. No DOM, Node or Electron APIs (the SVG is a string). `ExportProblem` is a discriminated union: a `too-close` problem can't lack its next Hole. | ✅ |
| IV. Memory first, snapshots | Exporting reads the in-memory Tape and Organ; nothing is stored, no snapshot is written (FR-014). The domain never touches files; the main process writes the export. The remembered export folder lives in main-process memory only. | ✅ |
| V. Strict Electron boundary | One new allow-listed channel `plotter:save-svg`, exposed through the typed preload with a type-only import; main validates every request with `parseSvgSaveRequest` from `@api` before showing a dialog. The renderer can't name a path to write to. `contextIsolation`/`nodeIntegration` unchanged. | ✅ |
| VI. Context never lost | ADR 21 records the decision (geometry in `api/`, SVG in the domain, the new channel). STATUS and ROADMAP updated per task group. | ✅ |
| VII. Small vertical slices | Usable end to end: open a Tape → Export → file on disk, in Electron. Story 1 and 2 (P1) alone are shippable; the cut order (P2) is one sort. The geometry move reuses the view's code rather than patching around it. | ✅ |
| UI / i18n | Angular Material dialog and snackbar, minimal SCSS (the problems list scrolls). Every `TAPE.EXPORT.*` key in en and de, checked by `npm run i18n:check`; `TAPE.VIEW.EXPORT_LATER` removed. | ✅ |

**Post-design re-check** (after research and the contracts): still passes. The design adds no
dependency, no process and no stored state. The one new channel is justified by FR-004/FR-005 and
recorded in ADR 21. The change to the Tape view's Lead-in and end is required by FR-008 and the
dictionary (Lead-in, Tape Outline), not a scope change. No violation needs justification.

## ADRs needed

Recorded on 2026-10-17 (status Accepted):

| # | Decision | Source |
|---|----------|--------|
| [21](../../documentation/adr/0021-plotter-export-built-in-the-domain.md) | The Tape geometry moves to `api/tape/` and is shared by the Tape view and every export format; the export check and the SVG writer are pure domain functions run in the renderer; one new channel `plotter:save-svg` lets the main process show the save dialog and write the text (extends ADR 4 and ADR 5). | research R1, R2, R6 |

## Open questions

None. The spec's domain questions were settled by the user on 2026-10-17 (spec, Clarifications).
The plan's own choices (stroke 0.1 mm black, Documents as the first folder, a dialog for the
problems, the inspector's "gap to the Tape's end" unchanged) are not domain or scope questions and
are recorded in research.md.

## Project Structure

### Documentation (this feature)

```text
specs/003-punch-a-tape/
├── spec.md
├── plan.md                  # this file
├── research.md              # R1–R9
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── domain-api.md        # new and changed @api exports
│   └── plotter-ipc.md       # plotter:save-svg, preload API, validation
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
api/
├── index.ts                         # + geometry, check, SVG, file name, SvgSave* exports
├── app/
│   ├── crancula-api.ts              # + plotter.saveSvg
│   └── svg-save-request.ts          # NEW: SvgSaveRequest, SvgSaveResult, parseSvgSaveRequest
└── tape/
    ├── tape-geometry.ts             # MOVED from src/…/tape-view/; tip frame, outline, end gap, cut order
    ├── export-problems.ts           # NEW: exportProblems, ExportProblem
    ├── plotter-svg.ts               # NEW: plotterSvg
    ├── plotter-file-name.ts         # NEW: plotterFileName
    ├── hole-fixes.ts                # + holeLimitsOf (moved from create-tape.ts)
    ├── create-tape.ts               # uses holeLimitsOf from hole-fixes
    └── *.spec.ts

app/
├── main.ts                          # + registerPlotterHandlers with dialog / fs / documents
├── preload.ts                       # + window.crancula.plotter (type-only imports)
├── plotter-ipc.ts                   # NEW: PLOTTER_CHANNELS, registerPlotterHandlers, PlotterEffects
└── plotter-ipc.spec.ts

src/app/
├── core/crancula-api.token.ts       # in-memory stand-in gains plotter
└── features/tape/tape-view/
    ├── tape-geometry.ts (+ spec)    # REMOVED (moved to api/tape/)
    ├── tape-view.component.*        # Export enabled; Outline from the geometry; no EXPORT_LATER
    ├── inspect-hole.ts              # warnings from the shared Column-based rules
    ├── pointer-at.ts, visible-columns.ts  # adapt to the tip frame
    ├── plotter-export.ts (+ spec)   # NEW: check → problems dialog | saveSvg → snackbar
    └── export-problems-dialog/      # NEW: lists every ExportProblem

src/assets/i18n/{en,de}.json         # TAPE.EXPORT.* (dialog title, filter, problems, saved, failed); − TAPE.VIEW.EXPORT_LATER
scripts/check-i18n.mjs               # + TAPE.EXPORT.PROBLEM. in DYNAMIC_PREFIXES
e2e/
├── tape-export.spec.ts              # NEW: save (file on disk), refused Tape, write failure, German
├── boundary.spec.ts                 # + plotter key on window.crancula
└── support/save-dialog.ts           # NEW: replaces dialog.showSaveDialog and records its options
```

**Structure Decision**: the same three layers as slices 001 and 002 (ADR 2 to 4): the shared
domain in `api/`, the Electron adapter in `app/`, the Angular adapter in `src/`. One file moves
from `src/` to `api/` (ADR 21); one new main-process module; the Tape view gains a service and a
dialog instead of growing its component (#80).

## Order of work (for /speckit-tasks)

Each step keeps the app working; Story 1 and 2 together are the first shippable point.

1. **Geometry**: move `tapeGeometry` to `api/tape/` unchanged under the green view tests →
   switch to the tip frame (view and its helpers follow) → add the end gap and the Tape Outline →
   cut order → the view draws the Outline (Lead-in diagonal, end cut) from it (FR-008).
2. **Check**: move `holeLimitsOf` → `exportProblems` → `inspectHole` uses the same rules.
3. **File**: `plotterFileName` → `plotterSvg` (scenario 1.3/1.4 numbers, Lead-in 0, no Holes,
   only cuts, order, SC-005 timing).
4. **Boundary**: `SvgSaveRequest` and `parseSvgSaveRequest` → `registerPlotterHandlers` with
   fakes → `main.ts` wiring and preload → in-memory stand-in → `boundary.spec.ts`.
5. **Renderer**: Export enabled, `EXPORT_LATER` removed → `PlotterExport` save path and snackbars
   (Story 1) → problems dialog (Story 2) → failure and cancel → German texts (Story 4).
6. **e2e** `tape-export.spec.ts`, then STATUS/ROADMAP, ux-review of the dialog.

## Complexity Tracking

No constitution violation needs justification.
