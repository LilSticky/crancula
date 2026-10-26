---

description: "Tasks for 011 Cut a tape in pieces"
---

# Tasks: Cut a tape in pieces

**Input**: Design documents from `/specs/011-cut-a-tape-in-pieces/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/plotter-library-ipc.md](contracts/plotter-library-ipc.md),
[contracts/tape-pieces-ipc.md](contracts/tape-pieces-ipc.md), [contracts/plotter-ui.md](contracts/plotter-ui.md),
[quickstart.md](quickstart.md), [ADR 28](../../documentation/adr/0028-tape-pieces-saved-into-one-folder-by-main.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task follows a test
task that must fail for the expected reason first (`tdd` skill: `test-first` red, `implementer`
green). Test pyramid: Node Vitest (`npm run test:node`) for everything in `api/` and `app/`; `ng test`
(jsdom) for `src/`; Playwright e2e only for what needs real Electron (native dialogs, files written to a
folder, restart).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US6 from spec.md; only in story phases
- **Red / Green**: a Red task writes only the failing test; its Green task makes it pass and refactors
- **Commits**: one small conventional commit per Red+Green pair on `011-cut-a-tape-in-pieces`.
  Update `documentation/STATUS.md` at each checkpoint.
- **Reference Tape** (spec): Organ tape width 100 mm, hole diameter 3 mm, row spacing 4 mm, 10 Pipes,
  Minimum Gap 2 mm, Lead-in 50 mm; Tape with Column length 3 mm, 200 Columns (652 mm). Reference Plotter
  "Cutting mat": working length 300 mm, working width 120 mm, Overlap 20 mm. Build both with
  `api/tape/tape-fixture.ts`.
- **Rebase**: slice 010 also changes `src/app/features/tape/`; rebase onto `main` once 010 is merged, before
  the Tape view tasks of US2/US3 (plan, "Coordination with slice 010").

## Phase 1: Setup

- [x] T001 Add the keys of [contracts/plotter-ui.md](contracts/plotter-ui.md) and [contracts/tape-pieces-ipc.md](contracts/tape-pieces-ipc.md) with en and de texts to `src/assets/i18n/en.json` and `de.json`: `PLOTTER.NAV` ("Plotters"), `PLOTTER.LIST.*` (`TITLE`, `SUBTITLE`, `EMPTY`, `NEW` "Describe a Plotter", Working area and roll texts), `PLOTTER.EDITOR.*` (field labels: name, format, working width, working length, Overlap, roll toggle "Roll plotter (cuts any length)"), `PLOTTER.ERROR.NAME_REQUIRED`, `VALUE_REQUIRED`, `MUST_BE_POSITIVE`, `OVERLAP_NOT_BELOW_WORKING_LENGTH`, `PLOTTER.REMOVE.*`, `TAPE.PLOTTER.NONE`, `DESCRIBE` ("Describe a Plotter…"), `PIECES`, `PIECES_ONE`, `ROLL`, `NO_JOIN`, `TOO_WIDE`, `TAPE.CUTTING_PROBLEM.NO_JOIN`, `TAPE.EXPORT.TOO_WIDE`, `PIECES_DIALOG_TITLE`, `PIECES_DIALOG_BUTTON`, `PIECES_REPLACE_MESSAGE`, `PIECES_REPLACE`, `PIECES_CANCEL`, `PIECES_SAVED`, `PIECES_FAILED`, `PIECE_LABEL` ("{{number}} of {{count}}" / "{{number}} von {{count}}"). German uses Plotter, Arbeitsbereich, Bandstück, Klebestelle, Klebezugabe, Schnittproblem. `npm run i18n:check` green.
- [x] T002 Refactor (existing tests stay green, no behaviour change): move `src/app/features/organ/leave-unsaved.guard.ts`, its spec and `leave-unsaved-dialog/` to `src/app/features/shared/leave-unsaved/`; update the imports in `src/app/features/organ/routes.ts` and the Organ editor; `npm run test` green (research R10).

## Phase 2: Foundational

Blocks US2–US4: the SVG writer reads only what a Tape piece has.

- [x] T003 Red: `api/tape/plotter-svg.spec.ts`: `plotterSvg` accepts a `CutGeometry` (`Pick<TapeGeometry, 'totalLength' | 'width' | 'slots' | 'outline'>`) built by hand, and for `tapeGeometry(referenceTape, referenceOrgan)` its output is byte-identical to a fixture string recorded from today's writer (SC-007).
- [x] T004 Green: `CutGeometry` type in `api/tape/tape-piece-geometry.ts`, `plotterSvg(geometry: CutGeometry)` in `api/tape/plotter-svg.ts`; export from `api/index.ts`.

**Checkpoint**: `npm run test:node` green; export unchanged; commit; STATUS.

## Phase 3: User Story 1 - Describe my plotter (P1) 🎯 MVP

**Goal**: Plotters are described on their own screen, like Organs, and kept across restarts.

**Independent Test**: start with no Plotters, describe one with working length 300 mm, working width 120 mm
and the default Overlap, restart, see it again with the same values.

### Domain

- [x] T005 [P] [US1] Red: `api/plotter/plotter.spec.ts`: `plotterId` accepts a UUID and returns `undefined` otherwise; `newPlotterId()` is a UUID; `DEFAULT_OVERLAP` is 20.
- [x] T006 [US1] Green: `api/plotter/plotter.ts` with `PlotterId`, `Plotter` as a union on `roll` (a roll plotter has only `workingWidth`; a sheet Plotter also `workingLength` and `overlap`), `format: 'svg'`, branded valid like `Organ` (data-model.md).
- [x] T007 [P] [US1] Red: `api/plotter/validate-plotter.spec.ts`: every violation at once with code and path — `name-required` at `name` when blank after trimming; `value-required` at `workingWidth`, `workingLength`, `overlap` when `null` or not finite; `must-be-positive` when ≤ 0; `overlap-not-below-working-length` at `overlap` when `overlap ≥ workingLength` with params `{workingLength}` (Story 1 scenarios 4, 5); `workingLength` and `overlap` not checked when `roll` is true and the valid roll plotter has neither; names need not be unique. `api/plotter/plotter-draft.spec.ts`: `emptyPlotterDraft()` has `roll: false`, `overlap: 20`, the rest empty; `draftOf(plotter)` round-trips through `validatePlotter`; a draft with `roll` toggled on and off keeps `workingLength` and `overlap` (Story 1 scenario 3).
- [x] T008 [US1] Green: `api/plotter/plotter-draft.ts`, `api/plotter/validate-plotter.ts`; export from `api/index.ts`.
- [x] T009 [P] [US1] Red: `api/plotter/plotter-library-snapshot.spec.ts`: `toPlotterSnapshot` writes `version: 1` and the fields of [contracts/plotter-library-ipc.md](contracts/plotter-library-ipc.md) (no `workingLength`/`overlap` for a roll plotter); round-trip; `parsePlotterLibrarySnapshot` refuses an unknown version, a non-list, a duplicate id, a non-UUID id, a Plotter `validatePlotter` refuses, a format other than `'svg'`, and a roll plotter with `workingLength` or `overlap` stored.
- [x] T010 [US1] Green: `api/plotter/plotter-library-snapshot.ts`; `PlotterLibraryLoadResult`, `PlotterLibrarySaveResult` and `plotters` in `CranculaApi` in `api/app/crancula-api.ts`.

### Main process and boundary

- [x] T011 [P] [US1] Red: `app/plotter-library-file.spec.ts` (fake file system, as `organ-library-file.spec.ts`): loads `plotters.json`, `empty` when missing, an unreadable file moved to `plotters.unreadable-<timestamp>.json`; `app/plotter-library-ipc.spec.ts`: registers exactly `plotters:load` and `plotters:save` and validates the payload.
- [x] T012 [US1] Green: `app/plotter-library-file.ts`, `app/plotter-library-ipc.ts` (`PLOTTER_LIBRARY_CHANNELS`), wiring in `app/main.ts` including the flush in `before-quit`; `plotters` in `app/preload.ts`.
- [ ] T013 [US1] Red→Green: `e2e/boundary.spec.ts` expects the keys `app`, `edit`, `organs`, `plotter`, `plotters`, `recording`, `tapes`; in-memory `plotters.load/save` in `src/app/core/crancula-api.token.ts` (validated with `parsePlotterLibrarySnapshot`, initial snapshot as an options field).

### UI

- [ ] T014 [US1] Red: `src/app/features/plotter/plotter-library.store.spec.ts`: loads on startup, `put` and `remove` write all Plotters, load and save problems as in `organ-library.store.spec.ts`.
- [ ] T015 [US1] Green: `src/app/features/plotter/plotter-library.store.ts`, provided at startup next to the Organ library.
- [ ] T016 [US1] Red: `src/app/features/plotter/plotter-list/plotter-list.component.spec.ts`: empty state `plotter-list-empty` with `new-plotter`; rows `plotter-row` by name with Working area ("300 × 120 mm" or roll with width) and Overlap; load problem `plotter-load-problem`; the rail lists "Plotters" (`src/app/features/rail/rail.component.spec.ts`).
- [ ] T017 [US1] Green: `src/app/features/plotter/routes.ts` (`plotters`, `plotters/new`, `plotters/:id`, rail icon `content_cut`, leave guard on the editor routes), `plotter-list.component.ts`, `src/app.routes.ts`.
- [ ] T018 [US1] Red: `src/app/features/plotter/plotter-editor/plotter-form.spec.ts` and `plotter-editor.component.spec.ts`: fields `plotter-name`, `plotter-format` (only SVG, chosen), `plotter-working-width`, `plotter-roll`, `plotter-working-length`, `plotter-overlap` (20 in a new Plotter); with the roll toggle on, working length and Overlap are hidden and not required, off again they come back with their values; each violation shows under its field (missing values only after editing, as the Organ form); German comma decimals read like points (scenario 7); `save-plotter` saves through the store and returns to the list.
- [ ] T019 [US1] Green: `plotter-form.ts` (signal form schema over `PlotterDraft`, `validatePlotter` as the only rule, like `organ-form.ts`), `plotter-editor.component.ts` / `.html` (standalone, OnPush, Angular Material, shared decimal-input directive).
- [ ] T020 [US1] Red→Green: `e2e/plotter-library.spec.ts`: describe "Cutting mat" 300 × 120 mm with the default Overlap, see it listed, restart, open it with the same values (scenarios 1, 6).

**Checkpoint**: Plotters can be described and survive a restart; commit; STATUS.

## Phase 4: User Story 2 - Cut a long tape in pieces (P1)

**Goal**: with a sheet Plotter picked, a long Tape is exported as numbered SVGs, one per Tape piece, into one folder.

**Independent Test**: the reference Tape without Holes on the reference Plotter gives three files with the
expected geometry.

### Domain

- [ ] T021 [P] [US2] Red: `api/tape/tape-pieces.spec.ts` (`kind: 'pieces'`): reference Tape without Holes → Joins after Columns 76 (278 mm) and 169 (557 mm), pieces 0–298, 278–577, 557–652 (scenario 1); a Tape that fits the working length whole is one piece 0–`totalLength` (scenario 8); a piece exactly as long as the working length fits; a Hole in the 20 mm after a Join leaves the Join possible; no Join where a Slot is closer than the Minimum Gap to the Join or to Join + Overlap, touching at exactly the Minimum Gap allowed (scenario 5, FR-008); Join candidates only after Column 1 up to before the last Column; Holes without a Pipe don't block. Invariants on generated small Tapes: contiguous pieces, every piece ≤ working length, and the piece count equals a brute-force minimum (SC-003, SC-004).
- [ ] T022 [US2] Green: `api/tape/tape-pieces.ts` with `Join`, `TapePiece`, `TapePieces`, `tapePieces(geometry, plotter)`: blocked intervals sorted and merged, one sweep over the candidates, greedy furthest Join (research R3, R4); export from `api/index.ts`.
- [ ] T023 [P] [US2] Red: `api/tape/tape-piece-geometry.spec.ts`: for the scenario-1 pieces, `pieceGeometry` has `totalLength` 298, 299, 95 and `width` 100; Slots wholly inside a piece shifted by `−start`, in cut order; a Slot in an Overlap appears in both pieces at the same place relative to the Join (scenario 4, FR-012); outline of piece 1 keeps the Lead-in's diagonal (square for Lead-in 0), pieces 2 and 3 are square at x = 0, every end at `totalLength` (scenario 6, FR-013); all within 0.01 mm (SC-002). `plotter-svg.spec.ts`: a piece's SVG has `width="298mm"`, Holes first then the outline (scenarios 3, 7).
- [ ] T024 [US2] Green: `pieceGeometry` in `api/tape/tape-piece-geometry.ts`.
- [ ] T025 [P] [US2] Red: `api/tape/tape-piece-file-name.spec.ts`: `tapePieceFileNames('Waltz', 3, label)` → "Waltz 1 of 3.svg" … with `label = (n, c) => \`${n} of ${c}\``; 12 pieces pad to "01 of 12"; forbidden characters replaced in name and label; a 300-character name is shortened so the label stays whole and the stem stays within 200 characters.
- [ ] T026 [US2] Green: `api/tape/tape-piece-file-name.ts`.
- [ ] T027 [P] [US2] Red: `api/app/svg-pieces-save-request.spec.ts`: the validation table of [contracts/tape-pieces-ipc.md](contracts/tape-pieces-ipc.md) — exactly six fields; 2–999 pieces with exactly `fileName` and `svg`; each `fileName` by the spec-003 rule; names distinct ignoring case; each `svg` by the spec-003 rule and the sum ≤ 64 × 2²⁰ characters; texts 1–200 characters without control characters.
- [ ] T028 [US2] Green: `api/app/svg-pieces-save-request.ts` with `SvgPiecesSaveRequest`, `SvgPiecesSaveResult`, `parseSvgPiecesSaveRequest`; `plotter.savePieces` in `CranculaApi`.

### Main process

- [ ] T029 [US2] Red: `app/plotter-ipc.spec.ts` (fake effects) for `plotter:save-svg-pieces`: invalid → `rejected`, no dialog; folder dialog with `dialogTitle`, `dialogButton`, `openDirectory`, `createDirectory`, default the last export folder (shared with `saveSvg`) or Documents; cancelled → `cancelled`; existing names → one message box with them in `detail`, answer Cancel → `cancelled`, nothing written; Replace or none existing → all written in order → `saved` with folder and names; a failing write → `failed` with that file, the OS error code and the names written before (FR-024); nothing in `userData` touched.
- [ ] T030 [US2] Green: `savePieces` handler in `app/plotter-ipc.ts` (`PLOTTER_CHANNELS.savePieces`), new effects `showOpenDialog`, `showMessageBox`, `exists`; wiring in `app/main.ts` with the dialogs looked up at call time; `savePieces` in `app/preload.ts`; in-memory `savePieces` with `failures.plotter.savePieces` in `src/app/core/crancula-api.token.ts`.

### UI

- [ ] T031 [US2] Red: `src/app/features/plotter/plotter-preference.spec.ts`: no stored id → `picked()` undefined; `pick(id)` stores `crancula.plotter` in `localStorage`; a stored id not in the library reads as undefined; `pick(undefined)` removes the key.
- [ ] T032 [US2] Green: `src/app/features/plotter/plotter-preference.ts`.
- [ ] T033 [US2] Red: `src/app/features/tape/tape-view/plotter-section/plotter-section.component.spec.ts`: `plotter-picker` lists "No Plotter" and every Plotter by name, shows the picked one, picking calls the preference and changes no Tape or undo history (FR-006); `plotter-pieces` says "Cut in 3 Tape pieces" / "Fits in one Tape piece"; `tape-view.component.spec.ts` places the section below the Tape section and keeps it usable while the Preview plays.
- [ ] T034 [US2] Green: `plotter-section.component.ts` (standalone, OnPush), its use in `tape-view.component.html` / `.ts` with `tapePieces` computed from Tape, Organ and picked Plotter.
- [ ] T035 [US2] Red: `src/app/features/tape/tape-view/plotter-export.spec.ts`: no Plotter → `saveSvg` as today (FR-020); one piece with a sheet Plotter → `saveSvg` with "<Tape name>.svg" (FR-022); several pieces → `savePieces` with `tapePieceFileNames` and `plotterSvg(pieceGeometry(...))` per piece and the translated texts; `saved` → `TAPE.EXPORT.PIECES_SAVED` with count and folder; `cancelled` → nothing; `failed` → `PIECES_FAILED` naming the file, with Retry; the Tape is unchanged (scenario 10).
- [ ] T036 [US2] Green: plotter-aware `export(tape, organ, plotter)` in `plotter-export.ts`; the Tape view passes the picked Plotter.
- [ ] T037 [US2] Red→Green: `e2e/tape-pieces.spec.ts`: describe the reference Plotter, open a long Tape, pick it, export with `dialog.showOpenDialog` replaced to return a temporary folder: files "<Tape> 1 of 3.svg" … exist, each `width` the piece's length; a second export answers the replaced `dialog.showMessageBox` with Cancel and writes nothing; a short Tape exports through the save dialog as "<Tape>.svg" (scenarios 2, 8); after a restart the Plotter is still picked (Story 3 scenario 1, FR-006).

**Checkpoint**: a long Tape can be cut on a sheet Plotter; commit; STATUS.

## Phase 5: User Story 3 - See where a tape can't be cut in pieces (P1)

**Goal**: stretches without a place for a Join are Cutting Problems while editing; Joins and Overlaps are drawn.

**Independent Test**: on the reference Tape a Hole in row 1 from Column 1, 100 Columns long, with the
reference Plotter picked, gives a Cutting Problem for Columns 1–101; shortened to 70 Columns it is gone.

### Domain

- [ ] T038 [P] [US3] Red: `api/tape/tape-pieces.spec.ts` (`kind: 'no-join'` and `'too-wide'`): the 100-Column Hole gives one stretch, first Column 0, last 100 (Columns 1–101), and none at 70 Columns with the first Join after Column 71 (scenario 2, 4); two separate long stretches are listed each on their own (scenario 5); Lead-in + Overlap ≥ working length makes the stretch from Column 1 to the first possible Join a problem; a Column longer than working length − Overlap makes a Tape without Holes uncuttable (edge cases); a working width below the tape width gives `too-wide` with both widths and nothing else; equal widths fit (FR-017).
- [ ] T039 [US3] Green: `no-join` and `too-wide` in `api/tape/tape-pieces.ts`, stretches from neighbouring possible Joins (research R4).
- [ ] T040 [P] [US3] Red: `api/tape/cutting-problems.spec.ts`: `cuttingProblems(tape, organ, plotter)` adds `no-join` problems with `start`, `last`, `plotterName`, `workingLengthMm`, sorted with the Hole problems (`no-join` after Hole codes at the same start); without a Plotter, with a roll plotter or too wide, the result equals `cuttingProblems(tape, organ)` (FR-018); `holesWithCuttingProblems` ignores `no-join`; a node performance test on a generated 10-minute Tape (~10 000 Columns, a few thousand Holes) stays well under 0.2 s (SC-005).
- [ ] T041 [US3] Green: `HoleCuttingProblem` and the `no-join` kind in `api/tape/cutting-problems.ts`; `stretchesOf(problems)`; every exhaustive `switch` over codes updated.

### UI

- [ ] T042 [P] [US3] Red: `src/app/features/tape/tape-view/cutting-problems/cutting-problems.component.spec.ts`: a `cutting-problem-stretch` entry with `TAPE.CUTTING_PROBLEM.NO_JOIN` naming Columns from 1, the Plotter and its working length; the count counts Holes plus stretches; choosing it emits the stretch (scenario 3); `cutting-problem-text` spec for the new text.
- [ ] T043 [US3] Green: stretch entries in `cutting-problems.component.ts`, `NO_JOIN` in `cutting-problem-text.ts`; in `tape-view.component.ts` choosing a stretch scrolls its first Column into view and selects nothing.
- [ ] T044 [P] [US3] Red: `src/app/features/tape/tape-view/tape-drawing.spec.ts`: `joinMarks` gives per Join a line at the Join (`data-after` = Column from 1) and an Overlap band to Join + Overlap, in px for the zoom; stretch marks over the Columns of each `no-join` problem (`data-first`, `data-last`); `tape-view.component.spec.ts` renders `join`, `overlap` and `stretch-mark`, all `aria-hidden`, and none with no Plotter, a roll plotter or too wide (scenario 9, FR-007).
- [ ] T045 [US3] Green: `joinMarks` and stretch marks in `tape-drawing.ts`, the SVG elements in `tape-view.component.html`, styles from the existing tokens (`--cr-problem`, select colours) in `tape-view.component.scss`.
- [ ] T046 [US3] Red: `plotter-section.component.spec.ts`: with `too-wide` the section shows `plotter-too-wide` (role `status`) with both widths instead of the piece count; with `no-join` it shows `TAPE.PLOTTER.NO_JOIN`; `plotter-export.spec.ts`: export with a `no-join` problem or too wide opens the Cutting Problems dialog with every reason (too wide first), and no IPC call is made (scenarios 7, 8, FR-019, SC-006).
- [ ] T047 [US3] Green: too-wide and no-join states in `plotter-section.component.ts`; refusal in `plotter-export.ts` and `cutting-problems-dialog.component.ts` with `TAPE.EXPORT.TOO_WIDE`.
- [ ] T048 [US3] Red→Green: extend `e2e/tape-pieces.spec.ts`: add the 100-Column Hole, see the stretch in the list and marked on the Tape, export refused with no file written; shorten the Hole to 70 Columns (Selected Hole form) and the problem is gone; the Joins are drawn (scenarios 2, 4, 7, 9).

**Checkpoint**: commit; STATUS.

## Phase 6: User Story 4 - Cut on a roll plotter (P2)

**Goal**: a roll plotter never splits a Tape and only checks the width.

**Independent Test**: a 120 mm roll plotter exports the reference Tape as one 652 mm file; at 90 mm export is refused.

- [ ] T049 [P] [US4] Red: `api/tape/tape-pieces.spec.ts`: a roll plotter gives one piece of any length (FR-011) and `too-wide` when narrower than the tape width (scenario 2); `plotter-section.component.spec.ts` shows `TAPE.PLOTTER.ROLL`; `plotter-list.component.spec.ts` shows a roll plotter's Working area as roll with width and no Overlap.
- [ ] T050 [US4] Green: roll branches in `tape-pieces.ts`, `plotter-section.component.ts` and `plotter-list.component.ts` (whatever is still missing after US1–US3).
- [ ] T051 [US4] Red→Green: extend `e2e/tape-pieces.spec.ts`: a 120 mm roll plotter exports one file through the save dialog (scenario 1); changed to 90 mm, export is refused with the too-wide reason (scenario 2).

**Checkpoint**: commit; STATUS.

## Phase 7: User Story 5 - Change or remove a plotter (P2)

**Goal**: Plotters can be changed and removed without touching Tapes or Organs.

**Independent Test**: changing a Plotter's working length changes the Tape pieces of a Tape with it picked;
removing it turns the picker to "No Plotter".

- [ ] T052 [P] [US5] Red: `plotter-editor.component.spec.ts`: opening `/plotters/:id` fills the form; saving keeps the id; leaving with unsaved changes asks through the shared leave-unsaved dialog naming the fields with problems (scenario 2); `plotter-list.component.spec.ts`: `remove-plotter` asks through the confirm dialog and removes only that Plotter, no Tape or Organ write (scenario 3, FR-004); two Plotters with the same name stay two rows (scenario 4).
- [ ] T053 [US5] Green: edit and remove in `plotter-editor.component.ts` and `plotter-list.component.ts`.
- [ ] T054 [P] [US5] Red: `tape-view.component.spec.ts`: a change of the picked Plotter in the store recomputes Tape pieces and Cutting Problems at once (scenario 1), and so does a change of the Organ (tape width, Lead-in, Minimum Gap, Pipes) or of the Tape's Column length (edge case); removing the picked Plotter shows "No Plotter" and its problems disappear (edge case); `plotter-section.component.spec.ts`: `plotter-describe` links to `/plotters/new` (scenario 5, FR-005).
- [ ] T055 [US5] Green: whatever the two specs still need in `plotter-section.component.ts` and `tape-view.component.ts`.
- [ ] T056 [US5] Red→Green: extend `e2e/plotter-library.spec.ts`: change the working length and restart (scenario 1); remove the Plotter, the Tape view shows "No Plotter" and the Tapes are unchanged (scenario 3); from the Tape view, "Describe a Plotter…" opens the editor (scenario 5).

**Checkpoint**: commit; STATUS.

## Phase 8: User Story 6 - Use it in German or English (P3)

**Goal**: every new text is translated, and file numbering follows the language.

**Independent Test**: in German, describe a Plotter, trigger every validation message and the new Cutting
Problem, export in pieces; no text is untranslated.

- [ ] T057 [US6] Red→Green: `src/app/features/plotter/plotter-i18n.spec.ts` (like `tape-i18n.spec.ts`): every `PLOTTER.*`, `TAPE.PLOTTER.*`, `TAPE.CUTTING_PROBLEM.NO_JOIN` and `TAPE.EXPORT.PIECES_*` / `PIECE_LABEL` / `TOO_WIDE` key exists in en and de and is non-empty; every `PlotterViolationCode` has a `PLOTTER.ERROR.*` text; German uses Arbeitsbereich, Bandstück, Klebestelle, Klebezugabe.
- [ ] T058 [US6] Red→Green: extend `e2e/tape-pieces.spec.ts` (or `e2e/tape-german.spec.ts`): in German, export in pieces writes "<Tape> 1 von 3.svg" …, and the picker, the piece count and the Cutting Problem are German (scenario 1).

**Checkpoint**: commit; STATUS.

## Phase 9: Polish & Cross-Cutting

- [ ] T059 [P] Extend `npm run ux:screens` (`e2e/ux/`) with the Plotter list, the Plotter editor (sheet and roll), the Tape view with a Plotter picked showing Joins and Overlaps, a no-join stretch and the too-wide message; run the `ux-review` skill on them; fix findings (contrast of the Overlap band and stretch marks in light and dark).
- [ ] T060 [P] Reviews, read-only and in parallel: `angular-reviewer` (`src/`), `electron-reviewer` (`app/`, the new channels `plotters:load`, `plotters:save`, `plotter:save-svg-pieces`, ADR 4 and ADR 28), `spec-auditor` (spec vs. tests and tasks) → `specs/011-cut-a-tape-in-pieces/audit.md`; `domain-modeler` checks the terms (Plotter, Working area, Tape piece, Join, Overlap, Cutting Problem) in code, tests and UI texts; fix findings via `implementer`.
- [ ] T061 Gate: `npm run test`, `npm run lint`, `npm run i18n:check`, `npm run build` green; `e2e/plotter-library.spec.ts`, `e2e/tape-pieces.spec.ts`, `e2e/tape-export.spec.ts`, `e2e/boundary.spec.ts` green locally; full e2e green in CI on Linux, Windows and macOS (ADR 13).
- [ ] T062 Quickstart by hand ([quickstart.md](quickstart.md) "By hand"): open the piece files in Inkscape, check true size, repeated Holes in the Overlap and square ends; record the result in STATUS; if not possible, say so in STATUS and the pull request.
- [ ] T063 `documentation/STATUS.md`, `documentation/ROADMAP.md` (Cut a tape in pieces done), `CHANGELOG.md` `[Unreleased]`, README feature list (Plotters, Tape pieces); pull request with `Closes #168`.

## Dependencies

- Phase 1 → Phase 2 → US1 → US2 → US3 → (US4, US5 in any order) → US6 → Polish.
- T001 before every UI Green task; T002 before T017.
- T004 before T024; T006 and T008 before T010, T022; T010 before T012, T013, T015.
- T022 before T024, T034, T036, T039; T026 and T028 before T036; T030 before T037.
- T032 before T034; T039 before T041, T045, T047; T041 before T043.
- e2e tasks T020, T037, T048, T051, T056, T058 need their story's Green tasks.
- Rebase onto `main` after slice 010 is merged, before T033 (Tape view changes).

## Parallel examples

- US1 Red tasks T005, T007, T009, T011 together (one `test-first` run each; edits stay sequential in one tree).
- US2 domain Red tasks T021, T023, T025, T027 in different files.
- US3: T038 and T040 (domain) before T042 and T044 (UI), each pair in different files.
- Reviews in T060 in parallel (read-only).

## Implementation strategy

MVP is US1 (Phases 1–3): Plotters described and kept across a restart, with no change to export. Then US2
(the capability: a long Tape in pieces), US3 (Cutting Problems and the drawing, so the owner can fix a Tape
before exporting), US4 (roll plotters), US5 (change and remove), US6 (translations), then polish. Each
checkpoint leaves the app usable and committed.
