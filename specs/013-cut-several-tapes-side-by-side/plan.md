# Implementation Plan: Cut several tapes side by side

**Branch**: `013-cut-several-tapes-side-by-side` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md) | **Issue**: [#170](https://github.com/LilSticky/crancula/issues/170)

**Input**: Feature specification from `specs/013-cut-several-tapes-side-by-side/spec.md`

## Summary

A roll plotter gains a Tape spacing (3 mm unless changed); the Plotter snapshot goes to version 2 and reads
version 1 roll plotters with 3 mm (ADR 20). The Tape list gets a tick per Tape and a "Cut side by side"
button that opens a new page, `/tapes/side-by-side?tape=<id>&tape=<id>…`, holding the Lanes in the ticked
order. The page picks a roll plotter (the one picked in the Tape view first), draws the roll to scale, lists
the Lanes with move up/down/remove, adds Tapes from a menu that disables what doesn't fit (naming the width it
needs and the free width), and saves. All rules are pure functions over the existing `TapeGeometry` in
`api/tape/`: `sideBySideCut(tapes, plotter)` places each Lane one Tape spacing below the previous one,
`laneGeometry(lane)` moves a Tape's `CutGeometry` down by its Lane's top, `sideBySideSvg(cut)` writes the
Lanes with the same path code as `plotterSvg` (one Lane is byte-identical to the single-Tape file), and
`sideBySideRefusals(...)` lists every reason not to save. Saving reuses the unchanged `plotter:save-svg`
channel (ADR 21): its payload is just a file name and SVG text. Nothing about the arrangement is stored.
Details in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (strict), Angular 22, Electron (current major, ADR 14)

**Primary Dependencies**: none new; Angular Material (checkbox, select, menu, list, buttons)

**Storage**: `<userData>/snapshots/plotters.json` goes from version 1 to 2 (`tapeSpacing` on roll plotters),
migrated on read (ADR 20). No new file, no new `localStorage` key; the Lanes live only in the page's signals.

**Testing**: Vitest in node (Plotter rules and draft with Tape spacing, snapshot v1→v2, `sideBySideCut`,
`laneGeometry`, `sideBySideSvg` incl. one-Lane byte identity, file name, refusals); Vitest in jsdom (Tape list
ticking, side-by-side page: picker, Lanes, add menu, drawing view model, save flow with the in-memory API,
Plotter editor field, i18n); one Playwright e2e `e2e/side-by-side.spec.ts` (tick, arrange, save through the
stubbed save dialog and read the file back; Tape spacing kept across a restart)

**Target Platform**: Electron desktop on Windows, macOS, Linux

**Project Type**: desktop app (Angular renderer, Electron main, shared `api/`)

**Performance Goals**: free width within 0.2 s of a change (SC-005): `sideBySideCut` is O(Lanes) on
geometries memoised per Tape; Cutting Problems memoised per Tape

**Constraints**: positions within 0.01 mm of the single-Tape export (SC-002), comparisons with 1e-9 mm
tolerance; the SVG ≤ 64 × 2²⁰ characters (existing `parseSvgSaveRequest` limit); no path from the renderer
(ADR 4)

**Scale/Scope**: a handful of Lanes (a 300 mm roll holds at most ~10 narrow Tapes); Tapes up to 10 minutes

## Constitution Check

| Principle | Check | Result |
|-----------|-------|--------|
| I. Domain-Driven Slicing | Capability "Cut several tapes side by side"; Lane and Tape spacing are in DICTIONARY.md (approved, decision 29–34); "side-by-side cut" is the dictionary's own phrase (Tape spacing, Lane entries); no new term needed (see research R12) | Pass |
| II. TDD | Every task starts with a failing test; the spec's worked examples (652 × 163 mm, free 200/137/34 mm, third Tape refused, 105–165 mm at 5 mm) drive the domain tests | Pass |
| III. Framework-Free Domain | Tape spacing rule, snapshot, cut, Lane geometry, SVG, file name and refusals in `api/`; the page only shows and asks; a roll plotter without `tapeSpacing` is unrepresentable | Pass |
| IV. Memory First | Plotter library store stays the truth; `plotters.json` v2 written by main, v1 migrated on read (ADR 20); Lanes are transient UI state, never stored (FR-015) | Pass |
| V. Strict Electron Boundary | No new channel; `plotter:save-svg` and its parser unchanged; main still never sees a Tape or Plotter | Pass |
| VI. Context Never Gets Lost | STATUS and ROADMAP at the end of the slice; CHANGELOG notes the snapshot bump (ADR 20 consequence); no ADR needed (below) | Pass |
| VII. Small Vertical Slices | US4 (Tape spacing) usable alone; US1+US2 the page and save; US3, US5, US6 small on top | Pass |

**ADR**: none needed. Saving reuses `plotter:save-svg` (ADR 21); the snapshot bump follows ADR 20; the Lanes
are page state like any form, not a preference (ADR 11 untouched). Post-design re-check: unchanged, pass.

## Project Structure

### Documentation (this feature)

```text
specs/013-cut-several-tapes-side-by-side/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/side-by-side-ui.md, contracts/side-by-side-svg.md, contracts/plotter-save-ipc.md
└── tasks.md (next: /speckit-tasks)
```

### Source Code (repository root)

```text
api/plotter/
├── plotter.ts                    # RollPlotter + tapeSpacing; DEFAULT_TAPE_SPACING = 3
├── plotter-draft.ts              # + tapeSpacing (3 in a new draft, kept while roll is off)
├── validate-plotter.ts           # + 'tapeSpacing' field, 'must-not-be-negative' code (roll only)
└── plotter-library-snapshot.ts   # version 2; reads v1 (roll → 3 mm); sheet with tapeSpacing refused
api/tape/
├── side-by-side-cut.ts           # Lane, SideBySideCut, sideBySideCut, laneRoom, laneGeometry (R1, R2)
├── side-by-side-refusals.ts      # SideBySideRefusal, sideBySideRefusals (R7)
├── side-by-side-file-name.ts     # sideBySideFileName(firstName, laneCount, more) (R8)
└── plotter-svg.ts                # + sideBySideSvg(cut); shared path helpers; plotterSvg unchanged (R3)
api/index.ts                      # exports the above
app/plotter-library-file.spec.ts  # fixtures to version 2 (test only; app code unchanged)
src/app/features/plotter/
├── plotter-editor/               # + plotter-tape-spacing field when roll is on
├── plotter-editor/plotter-form.ts# + label key for tapeSpacing
└── plotter-list/                 # roll text names the Tape spacing
src/app/features/tape/
├── routes.ts                     # + tapes/side-by-side before tapes/:id
├── tape-list/tape-list.component.ts # tick column, "Cut side by side" button (R6)
└── side-by-side/
    ├── side-by-side.component.{ts,html,scss}  # page: picker, drawing, Lane list, add menu, Save
    ├── side-by-side-drawing.ts   # pure view model of the to-scale roll (R9)
    ├── lane-query.ts             # tape ids from / to the `tape` query parameter (R5)
    └── side-by-side-export.ts    # refuse or save through plotter.saveSvg (R10)
src/app/features/tape/tape-view/cutting-problems-dialog/ # data becomes translated entries (R7)
src/app/features/tape/tape-view/plotter-export.ts        # maps its refusals to entries for the dialog
src/assets/i18n/{en,de}.json      # TAPE.LIST.TICK/CUT_SIDE_BY_SIDE, TAPE.SIDE_BY_SIDE.*, PLOTTER.EDITOR.TAPE_SPACING, PLOTTER.ERROR.MUST_NOT_BE_NEGATIVE
e2e/side-by-side.spec.ts          # Stories 1, 4 in real Electron
```

**Structure Decision**: the side-by-side cut is a Tape capability (it starts in the Tape list and reads Tapes),
so its domain lives in `api/tape/` next to `tape-pieces.ts`, and its page under
`src/app/features/tape/side-by-side/`. The Plotter aggregate only gains its Tape spacing.

## Decisions left open by the spec

- **Lane length shown**: the cut length from the Lead-in's tip to the end cut (`totalLength`, 652 mm for the
  reference Tape), as the spec's numbers use; the Tape list's 600 mm (Columns only) stays as it is (R4).
- **Free width when Lanes don't fit**: shown as "N mm too wide" instead of a negative free width (R4).
- **Lanes that don't fit**: from the first Lane whose far edge passes the working width onward, every Lane is
  marked; removing any of them recomputes (R2).
- **Plotter pick on the page**: local to the page, starting from the Tape view's pick when it is a roll
  plotter, else the only roll plotter when there is exactly one; it does not change the Tape view's
  preference (R5).
- **Without a roll plotter**: Lanes are listed (name, Organ, width, length, problems) but no drawing, free
  width or fit marks; Save is refused with "Pick a roll plotter" (R5, R7).
- **Cutting Problems dialog**: reused for the refusal, its data generalised to translated entries (R7).

## Open questions

None for the user. No new domain term is needed (research R12).

## Complexity Tracking

Not needed: no constitution violation.
