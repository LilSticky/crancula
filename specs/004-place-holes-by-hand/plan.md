# Implementation Plan: Place holes by hand

**Branch**: `004-place-holes-by-hand` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-place-holes-by-hand/spec.md`

## Summary

In the Tape view the organ owner adds, moves, lengthens or shortens (at either end) and removes
Holes by pointer and keyboard; everything snaps to whole Columns. Overlaps within a Pipe are
refused with a reason; Cutting Problems are allowed and marked at once, counted and listed in the
side panel; the Tape grows when a Hole passes its end. Undo and redo last while the view is open.
Every edit is saved like other Tape changes.

- **Domain** (`api/tape/`): one validating factory `validTape` replaces `asValidTape` and the
  duplicated checks (create, snapshot parser, rename, `removeHolesOfPipes`). Four pure commands
  `addHole`, `moveHole`, `changeHoleLength`, `removeHole` return `Result` with the new Tape and
  Hole, or the reason for refusing. `exportProblems` becomes `cuttingProblems` (dictionary: Cutting
  Problem), plus `holesWithCuttingProblems` for marks and list. Research R1–R5.
- **Renderer** (`src/`): a `TapeEditor` service provided by the Tape view holds an
  `EditHistory` of Tape values and writes through a new `TapeLibrary.update`. Pure helpers for
  pointer snapping, drag targets and the key map; two new side-panel sections (Add a Hole, Cutting
  Problems); undo/redo buttons; marks on the drawing. Research R6–R12.
- **Main process**: no change. Same `tapes:save` channel, same snapshot (version 1), ADR 8
  coalescing. Research R9.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 24, Electron 44, Angular 22

**Primary Dependencies**: Angular Material 22 (`MatIconButton`, `MatTooltip`, `MatSnackBar`,
`MatSelect`, `MatFormField`), `@ngrx/signals` 22 (`TapeLibrary`), `@ngx-translate` 18. **No new
dependency** (no CDK drag-drop, research R6).

**Storage**: unchanged. `tapes.json` stays version 1 (Holes `[pipe, start, length]`, `length`
stored); the undo history is not stored (spec, Assumptions). No migration (ADR 20).

**Testing**:
- Vitest in Node (`vitest.node.config.ts`, ADR 7) for `api/`: `validTape`, the four commands with
  every acceptance scenario, `cuttingProblems`/`holesWithCuttingProblems`, snapshot parser
  through the factory, a timing test for 2,000 Columns.
- `ng test` (Vitest, jsdom, ADR 9) for `src/`: pure `edit-history`, `hole-drag`, `grid-at`,
  `edit-keys`; `TapeEditor`; `TapeLibrary.update`; the Tape view with keyboard edits, drag via
  pointer events, double-click add, undo/redo, marks, the two new side-panel sections.
- Playwright Electron e2e: `e2e/tape-edit.spec.ts` (drag, handles, double-click, keyboard, undo,
  restart, refusal, growth, timing), plus German in `tape-german.spec.ts`.

**Target Platform**: Electron desktop on Windows, macOS and Linux

**Project Type**: desktop app (Electron main process + Angular renderer + shared domain)

**Performance Goals** (SC-002): edit + Cutting Problems + geometry for a 2,000-Column Tape with
6,000 Holes under 20 ms in Node; key press to updated drawing under 100 ms (research R10).

**Constraints**: offline; Holes snap to whole Columns; Column numbers: the domain counts from 0
(`Column`), the spec, the UI and every message from 1 (`start + 1`), so spec Column *n* is
`start === n − 1`; no Hole before Column 1 (Lead-in); one undo
step per gesture or key press; the main process and the snapshot format stay unchanged; the Hole
selection and arrow-key navigation of slice 003 keep working (spec, Assumptions).

**Scale/Scope**: four domain commands, one factory refactor, one rename; one store method; one
view service; two side-panel sections; two buttons; ~20 i18n keys; one new e2e file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Domain-driven slicing | Named after a user capability ("Place holes by hand"), part of "Edit a tape" (#103). Terms from the dictionary: Tape, Hole, Pipe, Column, Organ, Lead-in, Minimum Hole Length, Minimum Gap, and **Cutting Problem** (approved 2026-10-19); `exportProblems` is renamed to follow it. Hole verbs as in the dictionary: moved, lengthened, shortened at either end, removed. Code-only names (`validTape`, `HoleRef`, `HoleEdit`, `TapeEditor`, `EditHistory`) are not domain terms. | ✅ |
| II. TDD | Every task starts red: Node Vitest for `api/`, `ng test` for `src/`, Playwright for the Electron flows. The factory refactor and the rename are done under the existing green tests first, then red tests for the new commands. | ✅ |
| III. Framework-free domain | `tape.ts`, `hole-edits.ts`, `cutting-problems.ts` import only `api/`. Invalid states unrepresentable: positions are `Column`/`ColumnCount`, the brand comes only from `validTape`, refusals are a discriminated union. | ✅ |
| IV. Memory first, snapshots | The `TapeLibrary` stays the source of truth; every edit replaces the Tape there and sends the full snapshot (ADR 3, ADR 8). The undo history is in-memory view state, not stored (spec). Snapshot version unchanged. | ✅ |
| V. Strict Electron boundary | No new channel, no preload change; `tapes:save` keeps validating with `parseTapeLibrarySnapshot`, which now goes through `validTape`. Undo shortcuts are handled in the renderer (no menu IPC). | ✅ |
| VI. Context never lost | STATUS/ROADMAP per task group; ADR 22 written; DESIGN-GUIDE "The Tape visualisation" and "Accessibility commitments" get the editing gestures, keys and marks. | ✅ |
| VII. Small vertical slices | Usable end to end: open a Tape → edit → restart → still there, in Electron. Stories 1–3 (P1) alone are shippable; undo (P2), growth (P2) and keyboard/German polish (P3) follow. Transposing (#106), Column length (#107) and renaming (#82) stay out. | ✅ |
| UI / i18n | Material buttons, select, form field and snackbar; minimal SCSS (marks, handles, cursors). Every new key in en and de (`npm run i18n:check`); `TAPE.EXPORT.PROBLEM_*` moved to `TAPE.CUTTING_PROBLEM.*`. | ✅ |

**Post-design re-check** (after research, data model and contracts): still passes. No new
dependency, process, channel or stored state. The factory removes two unchecked paths
(`removeHolesOfPipes`, `renameTape`) instead of adding more. The rename is required by the
dictionary. The one deviation risk, a renderer-side save debounce, was rejected to stay with ADR 8
(research R9). No violation needs justification.

## ADR written

| # | Decision | Source |
|---|----------|--------|
| 22 | Tape edits are pure domain commands over a single validating Tape factory (`validTape`), returning `Result`; undo/redo is a history of immutable Tape values held by the Tape view (not stored, not in the root store); edits are saved through the existing whole-snapshot path (ADR 8). Sets the pattern for Transpose holes (#106) and Adjust a tape (#107). | research R1, R3, R8, R9 |

Not an ADR: the key map and gestures (DESIGN-GUIDE update), the rename to Cutting Problem
(dictionary), the added Hole's length (spec).

## Open questions

None. The spec settles the added Hole's length (FR-005, scenario 2.2: it fills the Columns up to
the next Hole, touching it; research R4). Plan-level choices (keys, gestures, handles, marks, the
Add a Hole form, selection after removal and undo) are recorded in research.md.

## Project Structure

### Documentation (this feature)

```text
specs/004-place-holes-by-hand/
├── spec.md
├── plan.md                  # this file
├── research.md              # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── domain-api.md        # validTape, the four commands, cuttingProblems
│   └── tape-view-ui.md      # gestures, keys, controls, messages
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
api/
├── index.ts                         # + validTape, hole edits, cuttingProblems, column, columnCount; − exportProblems
└── tape/
    ├── tape.ts                      # + validTape, TapeRuleViolation; − asValidTape; removeHolesOfPipes through validTape
    ├── tape.spec.ts                 # + factory rules
    ├── create-tape.ts               # uses validTape
    ├── rename-tape.ts               # uses validTape
    ├── tape-library-snapshot.ts     # parseTape/parseHoles use validTape; messages unchanged
    ├── hole-edits.ts                # NEW: addHole, moveHole, changeHoleLength, removeHole
    ├── hole-edits.spec.ts           # NEW: every scenario + 2,000-Column timing
    ├── cutting-problems.ts          # RENAMED from export-problems.ts; + holesWithCuttingProblems
    └── cutting-problems.spec.ts     # RENAMED from export-problems.spec.ts; + grouping

src/app/features/tape/
├── tape-library.store.ts (+ spec)   # + update(tape)
└── tape-view/
    ├── tape-view.component.{ts,html,scss} (+ spec)  # wires edits, drag, double-click, undo/redo buttons and shortcuts, marks, handles
    ├── tape-editor.ts (+ spec)      # NEW: service provided by the view; EditHistory + TapeLibrary.update + selection
    ├── edit-history.ts (+ spec)     # NEW: pure undo/redo of values
    ├── edit-keys.ts (+ spec)        # NEW: pure key event → edit intent (R7)
    ├── grid-at.ts (+ spec)          # NEW: pure px → Column/row, unclamped at the end (R6)
    ├── hole-drag.ts (+ spec)        # NEW: pure hit part, drag target, clamping (R6)
    ├── tape-drawing.ts (+ spec)     # holeRects: + marked, handles of the selected Hole
    ├── inspect-hole.ts              # uses cuttingProblems
    ├── plotter-export.ts (+ spec)   # uses cuttingProblems and the renamed dialog
    ├── cutting-problems-dialog/     # RENAMED from export-problems-dialog/; TAPE.CUTTING_PROBLEM.* keys
    ├── cutting-problems/            # NEW: side-panel section (count, list, choose)
    ├── add-hole/                    # NEW: side-panel form (Pipe, Column, Add Hole)
    └── selected-hole/selected-hole.component.ts  # + key help line

src/assets/i18n/{en,de}.json         # + TAPE.EDIT.*, TAPE.ADD_HOLE.*, TAPE.CUTTING_PROBLEMS.*, TAPE.CUTTING_PROBLEM.*; − TAPE.EXPORT.PROBLEM_*
e2e/
├── tape-edit.spec.ts                # NEW: drag, handles, double-click, keys, undo/redo, refusal, growth, restart, timing
├── tape-german.spec.ts              # + editing texts in German
└── support/tape-edit.ts             # NEW: drag/press helpers on the Tape drawing

documentation/
├── DESIGN-GUIDE.md                  # gestures, keys, marks, handles, the two side-panel sections
├── adr/0022-…md + README.md         # ADR 22 (see above)
├── STATUS.md, ROADMAP.md            # per task group
```

`app/` (main process, preload) is not changed.

**Structure Decision**: the same three layers as slices 001–003 (ADR 2 to 4): the shared domain in
`api/`, the Electron adapter in `app/` (untouched here), the Angular adapter in `src/`. New view
logic goes into small pure files and two components instead of the Tape view component (refs
#80, research R12).

## Order of work (for /speckit-tasks)

Each step keeps the app working; steps 1–5 together are the first shippable point (Stories 1–3).

1. **Factory**: `validTape` with its rules → `createTape`, the snapshot parser, `renameTape`,
   `removeHolesOfPipes` switched to it under their green tests → `asValidTape` removed.
2. **Rename**: `exportProblems` → `cuttingProblems` (file, types, dialog, i18n keys) under green
   tests → `holesWithCuttingProblems`.
3. **Commands**: `removeHole` → `moveHole` (row, Pipe, overlap, growth) → `changeHoleLength` →
   `addHole` (length rule, R4) → timing test.
4. **Store and editor**: `TapeLibrary.update` → `EditHistory` → `TapeEditor` (apply, selection,
   save) provided by the Tape view.
5. **Keyboard edits and marks**: `edit-keys` → Alt/Shift/Delete in the view → refusal snackbar →
   marks on the drawing → Cutting Problems section (count, list, choose) (Stories 1, 3).
6. **Pointer**: `grid-at` → `hole-drag` → drag body → handles → double-click add → preview and
   refusal → auto-scroll (Stories 1, 2).
7. **Add a Hole form** (Story 2, 6.2).
8. **Undo/redo**: buttons and shortcuts on the host, text fields excluded (Story 4).
9. **Growth** checks in the view (Story 5) — mostly covered by the domain; ruler, subtitle.
10. **German texts, key help, e2e** `tape-edit.spec.ts`, DESIGN-GUIDE, ADR 22, ux-review,
    STATUS/ROADMAP.

## Complexity Tracking

No constitution violation needs justification.
