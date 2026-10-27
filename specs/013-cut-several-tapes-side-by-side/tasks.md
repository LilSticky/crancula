---

description: "Tasks for 013 Cut several tapes side by side"
---

# Tasks: Cut several tapes side by side

**Input**: Design documents from `/specs/013-cut-several-tapes-side-by-side/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/side-by-side-ui.md](contracts/side-by-side-ui.md),
[contracts/side-by-side-svg.md](contracts/side-by-side-svg.md),
[contracts/plotter-save-ipc.md](contracts/plotter-save-ipc.md), [quickstart.md](quickstart.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task follows a test
task that must fail for the expected reason first (`tdd` skill: `test-first` red, `implementer`
green). Test pyramid: Node Vitest (`npm run test:node`) for everything in `api/`; `ng test` (jsdom) for
`src/`; Playwright e2e only for what needs real Electron (the save dialog writing a file, restart).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US6 from spec.md; only in story phases
- **Red / Green**: a Red task writes only the failing test; its Green task makes it pass and refactors
- **Commits**: one small conventional commit per Red+Green pair on `013-cut-several-tapes-side-by-side`.
  Update `documentation/STATUS.md` at each checkpoint.
- **Reference** (spec): Organ A tape width 100 mm, Lead-in 50 mm, Minimum Gap 2 mm with the reference Tape
  (Column length 3 mm, 200 Columns, `totalLength` 652 mm); Organ B tape width 60 mm with "Waltz" (400 mm);
  roll plotter "Vinyl cutter", working width 300 mm, Tape spacing 3 mm. Build them with
  `api/tape/tape-fixture.ts`.
- **No new IPC channel**: saving reuses `plotter:save-svg` (ADR 21); `app/` code stays unchanged, only the
  Plotter snapshot fixtures in `app/plotter-library-file.spec.ts` move to version 2.

## Phase 1: Setup

- [x] T001 Add the keys of [contracts/side-by-side-ui.md](contracts/side-by-side-ui.md) with en and de texts to `src/assets/i18n/en.json` and `de.json`: `TAPE.LIST.TICK` ("Pick {{name}} for a side-by-side cut"), `TAPE.LIST.CUT_SIDE_BY_SIDE` ("Cut side by side ({{count}})"), `TAPE.SIDE_BY_SIDE.TITLE`, `SUBTITLE`, `SAVE`, `NO_ROLL_PLOTTER`, `DESCRIBE_PLOTTER` ("Describe a Plotter…"), `FREE` ("{{free}} mm of {{working}} mm free"), `OVER` ("{{over}} mm too wide"), `DRAWING` ("{{lanes}} Lanes, {{used}} mm used, {{free}} mm free"), `LANE_WIDTH`, `LANE_LENGTH`, `LANE_PROBLEMS`, `LANE_DOES_NOT_FIT`, `LANE_UP`, `LANE_DOWN`, `LANE_REMOVE` (aria-labels naming Lane and Tape), `EMPTY`, `ADD` ("Add a Tape"), `NO_ORGAN` ("has no Organ"), `DOES_NOT_FIT` ("needs {{needed}} mm, only {{free}} mm free"), `REFUSAL.NO_PLOTTER`, `REFUSAL.NO_LANE`, `REFUSAL.NO_ORGAN` ("Lane {{lane}}: {{tape}} has no Organ"), `REFUSAL.DOES_NOT_FIT` ("Lane {{lane}}: {{tape}} needs {{needed}} mm, only {{free}} mm free"), `TAPE_PROBLEM` ("{{tape}}: {{problem}}"), `FILE_NAME_MORE` ("and {{count}} more" / "und {{count}} weitere"); `PLOTTER.EDITOR.TAPE_SPACING` ("Tape spacing"), `TAPE_SPACING_HINT` ("Blank strip between Tapes cut side by side"), `PLOTTER.ERROR.MUST_NOT_BE_NEGATIVE`, and the roll text of the Plotter list naming the Tape spacing. German uses Bahn, Bandabstand, Rollenplotter (in prose), Arbeitsbreite, Schnittproblem. `npm run i18n:check` green.

## Phase 2: Foundational

Blocks every story: a roll plotter must carry its Tape spacing before a cut can be placed, the SVG writer
must be shared, and the Cutting Problems dialog must take translated entries.

- [x] T002 (Done inside T012: the TDD guard allows no refactor-only edit without a spec change.) Refactor (existing tests stay green, no behaviour change): in `api/tape/plotter-svg.ts` extract an internal `svgDocument(length, width, parts)` and `outlinePath(outline)` next to `holePath`; `plotterSvg(geometry: CutGeometry)` still byte-identical to `api/tape/plotter-svg.reference.svg` (research R3); `npm run test:node` green.
- [x] T003 Red: `src/app/features/tape/tape-view/cutting-problems-dialog/cutting-problems-dialog.component.spec.ts`: the dialog data is `ProblemText[]` (`{key, params}`), each rendered as an `export-problem` item through `translate`; `src/app/features/tape/tape-view/plotter-export.spec.ts`: a refused export opens the dialog with the existing refusals mapped to entries (too wide first, then each Cutting Problem through `cuttingProblemText`), texts unchanged (research R7).
- [x] T004 Green: `ProblemText` data in `cutting-problems-dialog.component.ts`; the mapping in `plotter-export.ts`; `e2e/tape-export.spec.ts` and `e2e/tape-pieces.spec.ts` still pass unchanged.
- [x] T005 [P] Red: `api/plotter/plotter.spec.ts`: `DEFAULT_TAPE_SPACING` is 3; `api/plotter/plotter-draft.spec.ts`: `emptyPlotterDraft()` has `tapeSpacing: 3`; `draftOf(roll)` copies it, `draftOf(sheet)` sets 3; toggling `roll` off and on keeps it; `api/plotter/validate-plotter.spec.ts`: for a roll plotter `value-required` at `tapeSpacing` when `null` or not finite, `must-not-be-negative` at `tapeSpacing` when `< 0`, 0 valid (Story 4 scenario 2); a sheet Plotter's `tapeSpacing` is never checked and the valid sheet Plotter has none (Story 4 scenario 3).
- [x] T006 Green: `RollPlotter.tapeSpacing: Millimetres` and `DEFAULT_TAPE_SPACING` in `api/plotter/plotter.ts`; `tapeSpacing: number | null` in `api/plotter/plotter-draft.ts`; `'tapeSpacing'` in `PlotterField` and `'must-not-be-negative'` in `PlotterViolationCode` in `api/plotter/validate-plotter.ts`; every exhaustive `switch` over codes (e.g. the error key mapping in `src/app/features/plotter/plotter-editor/plotter-form.ts`) updated; export from `api/index.ts`.
- [x] T007 [P] Red: `api/plotter/plotter-library-snapshot.spec.ts`: `toPlotterSnapshot` writes `version: 2` with `tapeSpacing` on roll plotters only; round-trip; version 1 is read with every roll plotter at `tapeSpacing` 3 and nothing else changed (FR-002, Story 4 scenario 4), a v1 `tapeSpacing` ignored as unknown data (ADR 20); version 2 refuses a roll plotter without a valid `tapeSpacing` (missing, negative, not finite) and a sheet Plotter with one; any other version unreadable.
- [x] T008 Green: version 2 in `api/plotter/plotter-library-snapshot.ts`; fixtures moved to version 2 in `app/plotter-library-file.spec.ts` (test only) and wherever a `RollPlotter` is built in specs or in the in-memory API of `src/app/core/crancula-api.token.ts`.

**Checkpoint**: `npm run test:node` and `npm run test` green; single-Tape export unchanged; commit; STATUS.

## Phase 3: User Story 1 - Cut several tapes in one pass (P1) 🎯 MVP

**Goal**: Tapes ticked in the Tape list are saved as one SVG, one Tape per Lane, Tape spacing apart.

**Independent Test**: tick the reference Tape and "Waltz", cut side by side on the Vinyl cutter, save, and
read a 652 × 163 mm file with two Tape Outlines.

### Domain

- [x] T009 [P] [US1] Red: `api/tape/side-by-side-cut.spec.ts`: `sideBySideCut([reference, waltz], vinylCutter)` gives Lanes numbered 1, 2 with `top` 0 and 103, `usedWidth` 163, `freeWidth` 137, `length` 652 (Story 1 scenario 1); no Lanes → `usedWidth` 0, `length` 0; Tape spacing 5 → Waltz from 105 to 165 (Story 4 independent test), 0 → Lanes touch; the same Tape twice gives two Lanes (Story 2 scenario 3); `laneGeometry(lane)` equals `tapeGeometry(tape, organ)` with every Slot's and Outline corner's `y + top` within 1e-9, Lead-in tip at x = 0 (FR-010, SC-002); neighbouring Outlines exactly one Tape spacing apart (SC-003).
- [x] T010 [US1] Green: `api/tape/side-by-side-cut.ts` with `LaneTape`, `Lane`, `SideBySideCut`, `sideBySideCut`, `laneGeometry` (`top_1 = 0`, `top_i = top_{i−1} + width_{i−1} + plotter.tapeSpacing`, data-model.md); export from `api/index.ts`.
- [x] T011 [P] [US1] Red: `api/tape/plotter-svg.spec.ts` for `sideBySideSvg(cut)`: the two-Lane cut has `width="652mm" height="163mm" viewBox="0 0 652 163"`, Lane 1 Outline `M0,0 H652 V100 H50 Z`, Lane 2 Outline from y 103 to 163 ending at x 400 (contracts/side-by-side-svg.md); paths Lane by Lane: Lane 1 Holes in spec 003 cut order, Lane 1 Outline, Lane 2 Holes, Lane 2 Outline (Story 1 scenario 3, FR-011); a one-Lane cut is byte-identical to `plotterSvg(tapeGeometry(...))` and the fixture `plotter-svg.reference.svg` (Story 2 scenario 5).
- [x] T012 [US1] Green: `sideBySideSvg` in `api/tape/plotter-svg.ts` on the shared writer of T002; export from `api/index.ts`.
- [x] T013 [P] [US1] Red: `api/tape/side-by-side-file-name.spec.ts`: `sideBySideFileName('Reference', 2, c => \`and ${c} more\`)` → "Reference and 1 more.svg"; one Lane → `plotterFileName('Reference')`; "a/b" → "a_b and 1 more.svg"; a 300-character name is shortened so "and 2 more" stays whole and the stem stays within 200 characters; every result passes `isSafeFileName(…, 'svg')` (FR-014, research R8).
- [x] T014 [US1] Green: `api/tape/side-by-side-file-name.ts`; export from `api/index.ts`.

### UI

- [x] T015 [US1] Red: `src/app/features/tape/tape-list/tape-list.component.spec.ts`: a first column `tick` with `tick-tape` checkboxes, aria-label `TAPE.LIST.TICK` with the name; clicking a tick doesn't open the Tape; the ticked ids keep tick order and unticking removes; `cut-side-by-side` ("Cut side by side (2)") shows with one or more ticks and navigates to `/tapes/side-by-side?tape=<id>&tape=<id>` in tick order (FR-003, research R6).
- [x] T016 [US1] Green: ticks and the button in `src/app/features/tape/tape-list/tape-list.component.ts` (signal list of ids, Angular Material checkbox).
- [x] T017 [P] [US1] Red: `src/app/features/tape/side-by-side/lane-query.spec.ts`: tape ids read from repeated `tape` query parameters in order, duplicates kept, invalid ids dropped, none → empty; and back to query parameters; the Tape routes spec (`src/app/features/tape/routes.spec.ts`, create if missing) resolves `tapes/side-by-side` to the side-by-side page before `tapes/:id`, title `TAPE.SIDE_BY_SIDE.TITLE`, not in the rail.
- [x] T018 [US1] Green: `src/app/features/tape/side-by-side/lane-query.ts`; the route in `src/app/features/tape/routes.ts`; an empty standalone OnPush `side-by-side.component.ts` to route to.
- [x] T019 [P] [US1] Red: `src/app/features/tape/side-by-side/side-by-side-export.spec.ts` (in-memory API): a savable cut calls `plotter.saveSvg` with `suggestedFileName` from `sideBySideFileName` with the translated `FILE_NAME_MORE`, `svg` = `sideBySideSvg(cut)`, `TAPE.EXPORT.DIALOG_TITLE` and `FILTER_NAME` (contracts/plotter-save-ipc.md); `saved` → snackbar `TAPE.EXPORT.SAVED` with the path (Story 1 scenario 4); `cancelled` → nothing; `failed` and `rejected` → `TAPE.EXPORT.FAILED` with the reason and Retry saving the same cut; `saving` true while running; no Tape, Organ or Plotter store write (Story 1 scenario 5, FR-015).
- [x] T020 [US1] Green: `src/app/features/tape/side-by-side/side-by-side-export.ts` (`SideBySideExport`, as `PlotterExport`). Deviation: the `saved` snackbar uses `duration: 0` (stays until dismissed) instead of `PlotterExport`'s 6 s; a dismiss timer kept the zone unstable so the page spec's `whenStable` timed out.
- [x] T021 [US1] Red: `src/app/features/tape/side-by-side/side-by-side.component.spec.ts`: opened with `?tape=<reference>&tape=<waltz>` it lists rows `lane` with `data-lane` 1, 2, `lane-number`, `lane-tape`, `lane-organ`; `side-by-side-plotter` lists only roll plotters by name and starts with the only roll plotter; `save-side-by-side` saves through `SideBySideExport` with the Lanes in order and is disabled while saving; nothing is written to `localStorage` (FR-015); the Preview playing doesn't block the page (edge case). Preview sub-case: no test and no code needed, the page doesn't touch the Preview.
- [x] T022 [US1] Green: `side-by-side.component.ts` / `.html` / `.scss` (standalone, OnPush, Angular Material; `entries`, `pickedId`, `plotter`, `laneTapes`, `cut` signals as in data-model.md "Page state"; minimal SCSS).
- [x] T023 [US1] Red→Green: `e2e/side-by-side.spec.ts`: describe both Organs and the Vinyl cutter, create the reference Tape and "Waltz", tick the reference Tape then "Waltz", choose "Cut side by side", stub the save dialog with `e2e/support/save-dialog.ts` to a temporary path, Save, read the file: `width="652mm" height="163mm"`, two Tape Outlines; the snackbar names the path (Story 1 scenarios 1, 4).

**Checkpoint**: two Tapes can be cut side by side; commit; STATUS.

## Phase 4: User Story 2 - Arrange the lanes (P1)

**Goal**: the roll is drawn to scale, the free width is shown, and Lanes can be added, copied, moved and removed.

**Independent Test**: start with the reference Tape, add "Waltz", add the reference Tape again, see a fourth
refused with "needs 103 mm, only 34 mm free", move "Waltz" to Lane 1.

### Domain

- [x] T024 [P] [US2] Red: `api/tape/side-by-side-cut.spec.ts` (`laneRoom` and `fits`): reference alone → `freeWidth` 200 (Story 2 scenario 1); + Waltz → 137; `laneRoom(cut, 100)` → `{fits: true, needed: 103, free: 137}`, after adding it free 34, then `{fits: false, needed: 103, free: 34}` (scenario 2); no Lanes → needed equals the tape width; Lanes plus spacings exactly 300 mm fit within 1e-9 (edge case); a 320 mm Tape alone → `{fits: false, needed: 320, free: 300}` (Story 3 scenario 4); on a 150 mm roll plotter the reference Tape fits and Waltz and every later Lane have `fits: false`, `freeWidth` negative (research R2); moving Waltz to Lane 1 gives Waltz top 0, reference top 63, free 137 (quickstart 7).
- [x] T025 [US2] Green: `LaneRoom`, `laneRoom` and `Lane.fits` in `api/tape/side-by-side-cut.ts` (`fits = top + width ≤ workingWidth + 1e-9`, `needed = tapeWidth + (lanes > 0 ? tapeSpacing : 0)`).
- [x] T026 [P] [US2] Red: `src/app/features/tape/side-by-side/side-by-side-drawing.spec.ts`: `rollDrawing(cut)` has a `viewBox` in mm `0 0 length max(workingWidth, usedWidth)`; per Lane its number, an Outline path from the moved corners and one Holes path (like `overviewOf.holesPath`); a free band from `usedWidth` to `workingWidth` (none when full or over); the working-width line at `workingWidth`; Lanes past it flagged `overflow` (FR-008a, research R9).
- [x] T027 [US2] Green: `src/app/features/tape/side-by-side/side-by-side-drawing.ts`.

### UI

- [x] T028 [US2] Red: `side-by-side.component.spec.ts`: `side-by-side-free` (role `status`) reads "200 mm of 300 mm free", then "137 …" after adding Waltz through `add-lane` / `add-lane-tape`, or "N mm too wide" (`OVER`) when over; `side-by-side-drawing` (`role="img"`, name `TAPE.SIDE_BY_SIDE.DRAWING`) renders `lane-outline` and `lane-holes` with `data-lane`, `free-band`, `working-width-line`, inner marks `aria-hidden`; rows show `lane-width` "100 mm wide" and `lane-length` "652 mm long" in the app's number format (FR-008, research R4); the add menu lists every Tape grouped by Organ, adding a Tape already in a Lane gives a new Lane (scenario 3), one that doesn't fit is disabled with "needs 103 mm, only 34 mm free" (FR-007); `lane-up`, `lane-down` (disabled at the ends) and `lane-remove` renumber and update free width and drawing at once (scenario 4); with one Lane Save is allowed (scenario 5); no Lanes → `side-by-side-empty`; a renamed Tape or a changed Organ shows at once and a removed Tape's Lanes disappear (edge case).
- [x] T029 [US2] Green: free width, drawing, Lane row details, move and remove buttons with aria-labels naming Lane and Tape, and the add menu in `side-by-side.component.ts` / `.html` / `.scss` (drawing colours from existing tokens, `--cr-problem` for overflow).

**Checkpoint**: Lanes can be arranged with the drawing to scale; commit; STATUS.

## Phase 5: User Story 3 - Know why the tapes can't be cut together (P1)

**Goal**: every reason not to save is named, per Tape, before anything is written.

**Independent Test**: give "Waltz" a Cutting Problem, pick it with the reference Tape, try to save, see the
refusal naming "Waltz" and its problem; fix it and save.

- [x] T030 [P] [US3] Red: `api/tape/side-by-side-refusals.spec.ts`: `sideBySideRefusals(lanes, plotter)` returns `no-plotter` without a plotter; `no-lane` without Lanes; `no-organ` with Lane and Tape name for a Lane whose Organ is missing; `lane-does-not-fit` with Lane, Tape name, `needed` (width plus the spacing before it) and `free` (width left before it) for each Lane past the working width; `cutting-problems` with Tape name and `cuttingProblems(tape, organ)` once per distinct Tape even when copied (quickstart 9); order `no-plotter`, `no-lane`, `no-organ` and `lane-does-not-fit` by Lane, then `cutting-problems` by first Lane; empty for a savable cut; a roll plotter never adds `no-join` (FR-013, SC-004).
- [x] T031 [US3] Green: `api/tape/side-by-side-refusals.ts` with `SideBySideRefusal`, `sideBySideRefusals`; export from `api/index.ts`.
- [x] T032 [US3] Red: `side-by-side-export.spec.ts`: with refusals Save opens the Cutting Problems dialog with one entry per reason (`REFUSAL.*`, and per Cutting Problem `TAPE_PROBLEM` "Waltz: …" around `cuttingProblemText`) and `plotter.saveSvg` is never called (Story 3 scenario 1, SC-004); `side-by-side.component.spec.ts`: a Lane whose Tape has Cutting Problems shows `lane-problems` with the count, a Lane that doesn't fit shows `lane-does-not-fit` (scenario 2, FR-008); a Tape without an Organ is disabled in the add menu with "has no Organ" (scenario 3); `tape-list.component.spec.ts`: its `tick-tape` is disabled (scenario 3).
- [x] T033 [US3] Green: refusal mapping in `side-by-side-export.ts`; `refusals` and per-Tape memoised `cuttingProblems` in `side-by-side.component.ts` with the marks in `.html`; disabled tick in `tape-list.component.ts`.

**Checkpoint**: no file is written when a Lane can't be cut; commit; STATUS.

## Phase 6: User Story 4 - Set the tape spacing (P2)

**Goal**: a roll plotter's Tape spacing is set in the Plotter editor and kept.

**Independent Test**: set the Vinyl cutter's Tape spacing to 5 mm, restart, see 5; cut side by side and see
"Waltz" from 105 to 165 mm.

- [ ] T034 [P] [US4] Red: `src/app/features/plotter/plotter-editor/plotter-form.spec.ts` and `plotter-editor.component.spec.ts`: `plotter-tape-spacing` (hint `TAPE_SPACING_HINT`) shown only while `plotter-roll` is on, 3 in a new Plotter (Story 4 scenario 1), hidden for a sheet Plotter (scenario 3); "2,5" reads as 2.5; −1 shows `PLOTTER.ERROR.MUST_NOT_BE_NEGATIVE` and empty shows `VALUE_REQUIRED` under the field with `data-path="tapeSpacing"`, Save blocked; 0 saves (scenario 2); `plotter-list.component.spec.ts`: a roll plotter row reads "roll, 300 mm wide, Tape spacing 3 mm".
- [ ] T035 [US4] Green: the field in `plotter-form.ts` and `plotter-editor.component.ts` / `.html` (shared decimal-input directive); the roll text in `src/app/features/plotter/plotter-list/plotter-list.component.ts`.
- [ ] T036 [US4] Red→Green: extend `e2e/side-by-side.spec.ts` (or `e2e/plotter-library.spec.ts`): set the Vinyl cutter's Tape spacing to 5 mm, restart, the field shows 5 (scenario 5).

**Checkpoint**: commit; STATUS.

## Phase 7: User Story 5 - Pick only a roll plotter (P2)

**Goal**: only roll plotters are offered; without one the user is guided to the Plotter editor.

**Independent Test**: with only a sheet Plotter, the page says there is no roll plotter and links to
"Describe a Plotter…"; describe one and it is picked.

- [ ] T037 [US5] Red: `side-by-side.component.spec.ts`: the picker starts with `PlotterPreference.picked()` when it is a roll plotter (scenario 1), ignores a picked sheet Plotter, starts with none when several roll plotters and no roll preference; picking doesn't call `PlotterPreference.pick` (research R5); no roll plotter → `side-by-side-no-plotter` (role `status`) and `side-by-side-describe-plotter` linking to `/plotters/new`, Lanes still listed, no drawing and no free width (scenario 2); switching to a 150 mm roll plotter recomputes the free width and marks Waltz's Lane, Save refused naming it (scenario 3); the picked roll plotter removed or turned into a sheet Plotter reads as none and Save is refused with `NO_PLOTTER` (edge case).
- [ ] T038 [US5] Green: the start pick, the no-roll-plotter state and the describe link in `side-by-side.component.ts` / `.html`.

**Checkpoint**: commit; STATUS.

## Phase 8: User Story 6 - Use it in German or English (P3)

**Goal**: every new text is translated, and the proposed file name follows the language.

**Independent Test**: in German, walk through Stories 1–5; no text is untranslated.

- [ ] T039 [US6] Red→Green: `src/app/features/tape/side-by-side/side-by-side-i18n.spec.ts` (like `tape-i18n.spec.ts` and `plotter-i18n.spec.ts`): every `TAPE.SIDE_BY_SIDE.*`, `TAPE.LIST.TICK`, `TAPE.LIST.CUT_SIDE_BY_SIDE`, `PLOTTER.EDITOR.TAPE_SPACING*` and `PLOTTER.ERROR.MUST_NOT_BE_NEGATIVE` key exists in en and de and is non-empty; every `SideBySideRefusal` code and `PlotterViolationCode` has a text; German uses Bahn, Bandabstand, Arbeitsbreite, Schnittproblem; `side-by-side-export.spec.ts` in German proposes "Reference und 1 weitere.svg" (Story 6, FR-016, SC-006).

**Checkpoint**: commit; STATUS.

## Phase 9: Polish & Cross-Cutting

- [ ] T040 [P] Extend `npm run ux:screens` (`e2e/ux/`) with the Tape list with ticks, the side-by-side page (two Lanes with free width; an overflowing Lane and a Lane with Cutting Problems; no roll plotter) and the Plotter editor of a roll plotter with the Tape spacing; run the `ux-review` skill on them; fix findings (drawing contrast in light and dark, overflow colour, readable widths).
- [ ] T041 [P] Reviews, read-only and in parallel: `angular-reviewer` (`src/`: Tape list, side-by-side page, Plotter editor, dialog refactor); `electron-reviewer` only if anything in `app/` changed beyond the snapshot fixtures of `app/plotter-library-file.spec.ts` (expected: nothing, no new channel); `spec-auditor` (spec vs. tests and tasks) → `specs/013-cut-several-tapes-side-by-side/audit.md`; `domain-modeler` checks the terms (Lane, Tape spacing, roll plotter, working width, Tape Outline, Cutting Problem) in code, tests and UI texts; fix findings via `implementer`.
- [ ] T042 Gate: `npm run test`, `npm run lint`, `npm run i18n:check`, `npm run build` green; `e2e/side-by-side.spec.ts`, `e2e/plotter-library.spec.ts`, `e2e/tape-export.spec.ts`, `e2e/tape-pieces.spec.ts`, `e2e/boundary.spec.ts` green locally; full e2e green in CI on Linux, Windows and macOS (ADR 13).
- [ ] T043 Quickstart by hand ([quickstart.md](quickstart.md) "By hand"): open the side-by-side file in Inkscape, check true size, Lanes 3 mm apart, each Lead-in tip at the left edge, and the German walk-through; record the result in STATUS; if not possible, say so in STATUS and the pull request.
- [ ] T044 `documentation/STATUS.md`, `documentation/ROADMAP.md` (Cut several tapes side by side done), `CHANGELOG.md` `[Unreleased]` (side-by-side cut, Tape spacing, and that `plotters.json` moves to version 2 so an older app can't read it, ADR 20), README feature list; pull request with `Closes #170`.

## Dependencies

- Phase 1 → Phase 2 → US1 → US2 → US3 → (US4, US5 in any order) → US6 → Polish.
- T001 before every UI Green task.
- T002 before T012; T004 before T033; T006 before T008, T010, T035; T008 before T022 (roll plotters in the in-memory API need `tapeSpacing`).
- T010 before T012, T020, T025, T027, T031; T012 and T014 before T020; T018 before T022; T020 before T022.
- T025 before T029, T031; T027 before T029; T031 before T033, T038.
- e2e tasks T023 and T036 need their story's Green tasks.

## Parallel examples

- Phase 2: T003 (UI dialog), T005 (Plotter rules) and T007 (snapshot) in different files.
- US1 domain Red tasks T009, T011, T013 together; then T017 and T019 (one `test-first` run each; edits stay sequential in one tree).
- US2: T024 (domain) and T026 (drawing view model) in different files.
- US4 T034 and US5 T037 touch different files and can be written in parallel once US3 is in.
- Reviews in T041 in parallel (read-only).

## Implementation strategy

MVP is US1 (Phases 1–3): ticked Tapes saved as one side-by-side SVG on a roll plotter with the default Tape
spacing. Then US2 (the drawing, free width and Lane arranging, so the user can steer the cut), US3 (refusals
naming each Tape, so no vinyl is spoiled), US4 (setting the Tape spacing in the editor), US5 (roll plotters
only, with guidance), US6 (translations), then polish. Each checkpoint leaves the app usable and committed.
