---

description: "Tasks for 004 Place holes by hand"
---

# Tasks: Place holes by hand

**Input**: Design documents from `/specs/004-place-holes-by-hand/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/domain-api.md](contracts/domain-api.md),
[contracts/tape-view-ui.md](contracts/tape-view-ui.md), [quickstart.md](quickstart.md),
[ADR 22](../../documentation/adr/0022-tape-edits-as-domain-commands.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task comes after a
test task that names its spec file, and that test must fail for the expected reason before you
implement. Follow the `tdd` skill: `test-first` writes the red test, `implementer` makes it green.
Test pyramid (plan "Testing", research R10, R12): Node Vitest (`vitest.node.config.ts`) for
`api/` (factory, commands, Cutting Problems, timing); `ng test` (jsdom) for everything in `src/`,
including the pure view helpers `edit-history`, `grid-at`, `hole-drag`, `edit-keys` (they live in
`src/`, so they run under `ng test`, not the Node project); Playwright e2e only for what needs
real Electron (pointer gestures on the real stage, restart, the OS shortcuts, the snapshot on disk,
the 100 ms timing).

**Refactors under green** (T004–T006): the factory switch and the rename keep every existing test
green; they change no behaviour and need no new red test (plan "Constitution Check", II). The
renamed i18n keys get a red test first (T007).

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested
on its own. Stories follow the spec's priority order (US1, US2, US3 P1; US4, US5 P2; US6 P3).
Keyboard edits and pointer drags are both built in US1 (they are the gestures of US1, plan "Order
of work" 5–6); US6 adds the key help, proves the keyboard-only flow end to end and the German
texts.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: Which user story this task belongs to (US1–US6); only in story phases
- **Commits**: one small conventional commit per test+implementation pair, on
  `004-place-holes-by-hand`. Update `documentation/STATUS.md` at each checkpoint.

## Path conventions

- **`api/tape/`**: pure TypeScript domain. Relative imports only; no Angular, Electron or Node
  imports (ADR 2, constitution III). Specs here must not import from `src/` (build test Organs with
  `validateOrgan`, like `anOrgan` in `api/tape/create-tape.spec.ts`).
- **`src/app/features/tape/`**: Angular renderer. Standalone, OnPush, signals, Angular Material
  (`MatIconButton`, `MatTooltip`, `MatSnackBar`, `MatSelect`, `MatFormField`), minimal SCSS. New
  view logic goes into small pure files and two new components, not into
  `tape-view.component.ts` (research R12, refs #80).
- **`app/`**: not changed (plan). No new IPC channel, no preload change, snapshot stays version 1.
- **`e2e/`**: Playwright Electron tests, started through `e2e/support/launch-app.ts`; Organs and
  Tapes are created through the UI with `e2e/support/organ-editor.ts` and
  `e2e/support/tape-creation.ts`; new drag/press helpers in `e2e/support/tape-edit.ts`.
- **Column numbers**: the domain counts from 0 (`Column`); the spec, the UI and every message
  count from 1 and show `start + 1` (spec "Column numbers"). Ranges below are the spec's, inclusive
  and counted from 1: C4 10–13 is `{start: 9, length: 4}`, C4 16–19 is `{start: 15, length: 4}`
  (quickstart "Prerequisites"); the refusal names "Column 16"; scenario 1.8 "Column 1" is
  `start === 0`; scenario 2.1 "Column 20" is `start` 19; "ends at Column 104" is
  `start + length === 104`.
- **Reference Organ** (quickstart): Pipes C4, D4, E4 in rack order; Minimum Hole Length and
  Minimum Gap chosen per scenario (e.g. a Minimum Hole Length of 2.6 Columns for scenario 2.1,
  "needs 2 Columns" for 3.1).
- **Words**: dictionary terms only (Tape, Hole, Pipe, Column, Organ, Lead-in, Minimum Hole Length,
  Minimum Gap, **Cutting Problem**; a Hole is moved, lengthened or shortened at either end,
  removed). Code-only names allowed by the plan: `validTape`, `TapeRuleViolation`, `HoleRef`,
  `HoleEdit`, `HoleEditRefusal`, `HoleProblem`, `HoleCuttingProblems`, `TapeEditor`,
  `EditHistory`, `HoleDrag`.
- **i18n**: every new key goes into both `src/assets/i18n/en.json` and `de.json` in the same task;
  `src/app/i18n-parity.spec.ts` and `npm run i18n:check` must stay green.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A green baseline, so that the factory and the rename in Phase 2 are refactors under
green.

- [x] T001 On `004-place-holes-by-hand`, run `npm run test`, `npm run lint`, `npm run i18n:check`
  and `npm run build`; all green before any change. No file changes. If anything is red, record it
  in `documentation/STATUS.md` and fix it first.

**Checkpoint**: baseline green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: One validating Tape factory (research R1), the Cutting Problem rule under its
dictionary name with grouping per Hole (R2), and the undo history, store update and editor service
every edit goes through (R8, R9). Every story needs them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### One validating Tape factory (R1)

- [x] T002 Write the failing tests in `api/tape/tape.spec.ts` for
  `validTape(fields: TapeFields): Result<Tape, TapeRuleViolation>` (data-model.md "Tape",
  contracts/domain-api.md), one test per rule, each naming the code:
  - "`name.trim()` is not empty (stored trimmed)" → `name-blank`; a valid name comes back trimmed;
  - "`songId` and `selectedParts` both set or both absent" → `song-reference-incomplete`;
  - "`selectedParts` sorted ascending, unique, non-empty" → `selected-parts-invalid`;
  - "every Hole ends within the Tape: `start + length ≤ length`" → `hole-beyond-end`, with `hole`
    the first offending Hole;
  - "Holes sorted by Pipe, then start" → `holes-not-sorted`;
  - "no two Holes of one Pipe overlap (`next.start ≥ start + length`; touching allowed)" →
    `holes-overlap` (touching Holes are `ok`);
  - a Tape without Holes and a Tape with valid Holes give `ok` with every field carried over;
  - `TapeRuleViolationCode` is exactly the six codes above; `TapeRuleViolation = {code; hole?}`.
  Depends on T001.
- [x] T003 Implement `validTape`, `TapeRuleViolation` and `TapeRuleViolationCode` in
  `api/tape/tape.ts` (the `validTapeBrand` stays) and export them from `api/index.ts` until T002 is
  green. Depends on T002.
- [x] T004 Refactor under green: `parseTapeLibrarySnapshot` in `api/tape/tape-library-snapshot.ts`
  builds `TapeFields` and calls `validTape`; it maps a `TapeRuleViolation` to its existing English
  reasons (`'a Hole ends beyond the end of the Tape'`, `'Holes are not sorted by pipe then start,
  or overlap within a row'`, `'name is blank'`); `parseHoles` loses its own sort/overlap/end checks
  but keeps parsing raw JSON (types, UUIDs, ranges). `api/tape/tape-library-snapshot.spec.ts`
  stays green **unchanged**. Commit as `refactor(tape): parse stored Tapes through validTape`.
  Depends on T003.
- [x] T005 Refactor under green: `createTape` (`api/tape/create-tape.ts`, throws on an impossible
  `err` as its `valid()` does today), `renameTape` (`api/tape/rename-tape.ts`, maps `name-blank`
  to its existing `'name-required'`) and `removeHolesOfPipes` (`api/tape/tape.ts`, throws on an
  impossible `err`) build their Tapes through `validTape`; delete `asValidTape` and switch its
  remaining uses in `api/tape/tape.spec.ts` to `validTape`. `create-tape.spec.ts`,
  `rename-tape.spec.ts`, `tape.spec.ts` and `src/app/features/tape/tape-library.store.spec.ts`
  stay green. Commit as `refactor(tape): build every Tape through validTape`. Depends on T004.

### Cutting Problem: rename and group per Hole (R2)

- [x] T006 Refactor under green, domain rename (dictionary: Cutting Problem): `git mv`
  `api/tape/export-problems.ts` → `api/tape/cutting-problems.ts` and
  `api/tape/export-problems.spec.ts` → `api/tape/cutting-problems.spec.ts`; rename
  `exportProblems` → `cuttingProblems`, `ExportProblem` → `CuttingProblem`, `ExportProblemCode` →
  `CuttingProblemCode` (same union, same rule, same order); update the exports in `api/index.ts`
  and every user: `api/tape/create-tape.ts`, `api/tape/tape.ts`, `api/tape/tape-library-snapshot.ts`,
  `api/tape/create-tape.spec.ts`, `api/tape/tape.spec.ts`, `api/tape/tape-geometry.spec.ts`,
  `api/tape/plotter-svg.spec.ts`, `src/app/features/tape/tape-view/plotter-export.ts` (+ spec),
  `inspect-hole.ts` (+ spec), `tape-drawing.spec.ts`, `visible-columns.spec.ts`,
  `tape-view.component.spec.ts`, and the dialog's imports. Fix the doc comment of `gapMm`
  ("negative never happens on a valid Tape; 0 when touching", data-model.md). No behaviour change;
  `npm run test` and `npm run lint` green before and after. Commit as
  `refactor(tape): rename export problems to Cutting Problems`. Depends on T005.
- [x] T007 Write the failing tests for the UI rename (contracts/tape-view-ui.md "Messages"):
  - extend `src/app/features/tape/tape-i18n.spec.ts`: every `CuttingProblemCode` has a key
    `TAPE.CUTTING_PROBLEM.<CODE>` ("the code upper-cased, `-` as `_`": `NO_PIPE`, `TOO_SHORT`,
    `TOO_CLOSE`) in `en.json` and `de.json` with the texts of today's `TAPE.EXPORT.PROBLEM_*`; no
    `TAPE.EXPORT.PROBLEM_*` key exists in either file;
  - `git mv` the dialog spec to
    `src/app/features/tape/tape-view/cutting-problems-dialog/cutting-problems-dialog.component.spec.ts`
    and make it expect `CuttingProblemsDialogComponent` and the `TAPE.CUTTING_PROBLEM.*` keys
    (title and close button stay `TAPE.EXPORT.PROBLEMS_TITLE`, `TAPE.EXPORT.PROBLEMS_CLOSE`).
  Depends on T006.
- [x] T008 `git mv` `src/app/features/tape/tape-view/export-problems-dialog/` →
  `cutting-problems-dialog/`, rename the component to `CuttingProblemsDialogComponent`, move
  `TAPE.EXPORT.PROBLEM_NO_PIPE|_TOO_SHORT|_TOO_CLOSE` to `TAPE.CUTTING_PROBLEM.NO_PIPE|TOO_SHORT|TOO_CLOSE`
  in `src/assets/i18n/en.json` and `de.json` (same texts), and update
  `src/app/features/tape/tape-view/plotter-export.ts`, `e2e/tape-export.spec.ts`,
  `e2e/tape-german.spec.ts` and `e2e/ux/screens.capture.ts`, until T007 is green and
  `npm run i18n:check` passes. Depends on T007.
- [x] T009 [P] Write the failing tests in `api/tape/cutting-problems.spec.ts` for
  `holesWithCuttingProblems(problems): readonly HoleCuttingProblems[]` (data-model.md
  "HoleCuttingProblems", contracts/domain-api.md):
  - "one entry per Hole that has at least one Cutting Problem, in the order of the problems";
  - `HoleCuttingProblems = {hole: HoleRef; problems: readonly HoleProblem[]}`;
  - a `too-close` problem marks **both** Holes (spec 3.2): the earlier Hole gets `too-close`, the
    Hole at `nextStart` gets `{code: 'too-close-previous', pipe, start, previousStart, gapMm,
    minimumGapMm}`;
  - a Hole with `too-short` and `too-close` has one entry with both; a `no-pipe` Hole has one entry
    with only that; no problems → `[]`; the count of entries is the count shown (FR-011).
  Depends on T006.
- [x] T010 Implement `holesWithCuttingProblems`, `HoleProblem` and `HoleCuttingProblems` in
  `api/tape/cutting-problems.ts` (`HoleRef` as a local `Pick<Hole, 'pipe' | 'start'>` until
  `hole-edits.ts` exists, then imported from there) and export them from `api/index.ts` until T009
  is green. Depends on T009.

### Undo history, store update, editor (R8, R9)

- [x] T011 [P] Write the failing test `src/app/features/tape/tape-view/edit-history.spec.ts` for
  the pure, generic `EditHistory<T>` (data-model.md "EditHistory"): `past` "entries before the
  present, oldest first", `present` "what is shown and stored", `future` "undone entries, next redo
  first"; "`apply(next)` → past + present, future cleared"; "`undo()` / `redo()` move one entry";
  "`canUndo = past.length > 0`, `canRedo = future.length > 0`"; "Immutable: each call returns a
  new history"; undo/redo at the ends return the same history; spec 4.2, 4.3; SC-006: n applies
  followed by n undos give the opening `present`. Depends on T001.
- [x] T012 Implement `src/app/features/tape/tape-view/edit-history.ts` until T011 is green.
  Depends on T011.
- [x] T013 [P] Write the failing tests in `src/app/features/tape/tape-library.store.spec.ts` for
  `update(tape: Tape): Promise<boolean>` (data-model.md "TapeLibrary", research R9): "`false`
  without change while `loadProblem` is set or for an unknown id; else replace the Tape and save
  the whole library (ADR 8)" through `tapes:save` once per call; a failed save sets `saveProblem`
  and keeps the new Tape in memory, the next successful save clears it (FR-013, quickstart 28);
  `rename` and `removeHolesOfPipes` keep their behaviour. Depends on T005.
- [x] T014 Implement `update` in `src/app/features/tape/tape-library.store.ts` until T013 is green.
  Depends on T013.
- [ ] T015 Write the failing test `src/app/features/tape/tape-view/tape-editor.spec.ts` for the
  `TapeEditor` service (research R8, data-model.md "TapeEditor entry"), with the in-memory
  `TapeLibrary`: an entry is `{tape: Tape; selection: SelectableHole | undefined}`; the history
  starts with the Tape as opened; `apply(entry)` pushes, clears redo and calls
  `TapeLibrary.update(tape)` exactly once; `undo()`/`redo()` move one entry, restore the entry's
  selection and call `update` once each; `canUndo`/`canRedo` are signals; if the Tape in the
  `TapeLibrary` is no longer the history's present, the history resets to it; it is
  `@Injectable()` without `providedIn` (provided by the view). Depends on T012, T014.
- [ ] T016 Implement `src/app/features/tape/tape-view/tape-editor.ts` and add it to the
  `providers` of `TapeViewComponent` (`tape-view.component.ts`) until T015 is green; every existing
  Tape view test stays green. Depends on T015.

**Checkpoint**: `npm run test` green; every Tape comes from `validTape`; export and the Selected
Hole use `cuttingProblems`; the Tape view has an editor that saves through `TapeLibrary.update`.

---

## Phase 3: User Story 1 - Change and remove holes (Priority: P1) 🎯 MVP

**Goal**: In the Tape view the user moves a Hole along its row and to another Pipe, moves its start
or its end, or removes it, by keyboard and by pointer; overlaps are refused with a reason; every
edit is saved.

**Independent Test**: Open a stored reference Tape, move one Hole by 2 Columns, shorten another at
its start, remove a third, reopen the Tape after restarting Crancula and check the three Holes.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T017 [US1] Write the failing tests in the new `api/tape/hole-edits.spec.ts` for
  `removeHole(tape, hole: HoleRef): Result<Tape, HoleEditRefusal>` (contracts/domain-api.md):
  scenario 1.5 "Hole gone; `length` unchanged"; an unknown `HoleRef` → `err({code:
  'no-such-hole'})`; the input Tape is unchanged; FR-017 (`songId`, `selectedParts`, `organId`,
  `transposition`, `columnLength`, `name`, `id` unchanged) and FR-019 (other Holes, including Holes
  whose Pipe is not on the Organ, unchanged). Depends on T016.
- [ ] T018 [US1] Extend `api/tape/hole-edits.spec.ts` for `moveHole(tape, organ, hole, to:
  {pipe, start: Column}): Result<HoleEdit, HoleEditRefusal>`: 1.1 C4 10–13 → `start` 11 → C4
  12–15; 1.2 C4 10–13 → D4 → D4 10–13, no C4 Hole at `start` 9; both in one call; 1.7 moving C4 10–13
  so it covers Column 16 → `err({code: 'overlaps', other: C4 16–19})`, input unchanged; a target Pipe
  whose Hole covers the Columns → `err overlaps` (edge case); "Overlap is checked against the Holes
  of the target Pipe without the edited Hole itself" (moving a Hole by one Column onto its own old
  Columns is fine); a Pipe not on the Organ → `err({code: 'not-on-the-organ', pipe})`; unknown ref
  → `no-such-hole`; `HoleEdit.hole` is the moved Hole; Holes come back sorted by Pipe, then start;
  Cutting Problems are not refused (FR-009) and Hole fixes are not applied; FR-017, FR-019.
  Depends on T017.
- [ ] T019 [US1] Extend `api/tape/hole-edits.spec.ts` for `changeHoleLength(tape, hole, to:
  {start: Column, length: ColumnCount}): Result<HoleEdit, HoleEditRefusal>`: 1.3 end +3 then
  start +2 → 10–16 (`{start: 9, length: 7}`), then 12–16 (`{start: 11, length: 5}`) (end moved: `s' = s`; start moved: `s' + l' = s + l`); 1.7
  lengthening C4 10–13 to Column 16 or beyond → `err overlaps` naming C4 16–19; shortening to 1 Column is
  allowed (FR-009); unknown ref → `no-such-hole`; FR-017, FR-019. Depends on T018.
- [ ] T020 [P] [US1] Write the failing test `src/app/features/tape/tape-view/grid-at.spec.ts` for
  the pure `gridAt(x, y, scale, geometry)` (research R6): px → Column "floor, ≥ 0, not clamped at
  the Tape's end" and "the nearest row (clamped to the Organ's rows)"; x inside the Lead-in gives
  Column 0. Depends on T016.
- [ ] T021 [P] [US1] Write the failing test `src/app/features/tape/tape-view/hole-drag.spec.ts`
  for the pure `HoleDrag` (`part: 'body' | 'start' | 'end'`, `hole`, `from: {column, row}`), the
  hit part of a press (handles only on the selected Hole, each "`min(8 px, width / 3)` wide inside
  the Hole"; else body), the 4 px drag threshold, and `dragTarget(drag, now)` (data-model.md
  "HoleDrag"): body "`{pipe of row + Δrow, start: max(0, start + Δcolumn)}`"; end "`{start,
  length: max(1, length + Δcolumn)}`"; start "`start' = clamp(start + Δcolumn, 0, end − 1)`,
  `length = end − start'`"; "Rows are clamped to the Organ's rows". Spec 1.4 (a 1-Column Hole stays
  1 Column) and 1.8 (stays at Column 1). Depends on T016.
- [ ] T022 [P] [US1] Write the failing test `src/app/features/tape/tape-view/edit-keys.spec.ts`
  for the pure key map `editIntent(event)` (research R7, contracts/tape-view-ui.md "Keyboard"):
  Alt+←/→ → move one Column earlier/later; Alt+↑/↓ → row above/below; Shift+←/→ → end one Column;
  Alt+Shift+←/→ → start one Column; Delete and Backspace → remove; plain arrows, Enter, Space,
  Escape → no edit intent (selection as today); Ctrl/Meta combinations → no edit intent.
  Depends on T016.
- [ ] T023 [P] [US1] Extend `src/app/features/tape/tape-view/tape-drawing.spec.ts`: `holeRects`
  gives handles (`start`, `end`) only for the selected Hole, each "`min(8 px, width / 3)` wide
  inside the Hole" (research R6). Depends on T016.
- [ ] T024 [US1] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts` with keyboard
  edits on the focused drawing (quickstart 1–5, 7, 8): Alt+→ ×2 moves C4 10–13 to 12–15; Alt+↓
  moves it to D4; Shift+→ ×3 then Alt+Shift+→ ×2 gives 12–16; Shift+← on a 1-Column Hole and
  Alt+← / Alt+Shift+← at Column 1 do nothing (no save); Delete removes and selects "the next Hole
  of its row, else the previous, else none"; without a selection edit keys do nothing; all with
  `preventDefault()`; every applied key calls `TapeLibrary.update` once and keeps the moved Hole
  selected; a refused key (1.7) changes nothing, saves nothing and shows a snackbar
  `TAPE.EDIT.REFUSED_OVERLAP` "The Hole would overlap the Hole of C4 at Column 16."; arrows still
  select neighbours. Depends on T016.
- [ ] T025 [US1] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts` with pointer
  edits through pointer events (contracts/tape-view-ui.md "Pointer"): press + move ≥ 4 px +
  release on a Hole body moves it to the snapped Column and row (one `update`, Hole selected); a
  move under 4 px is a click (selects, no edit); dragging a `data-testid="hole-handle"`
  (`data-end="start"|"end"`) of the selected Hole moves that end only; Escape during a drag
  cancels it (no `update`); while dragging the drawing shows the would-be Tape, a refused position
  shows the Hole with the `refused` class and release there shows the snackbar and changes
  nothing; cursor classes `grab` / `grabbing` / `ew-resize`. Depends on T024.
- [ ] T026 [P] [US1] Write `e2e/support/tape-edit.ts` (drag a Hole or a handle by Columns/rows on
  the real stage, press keys on the drawing, read Holes from `data-testid="hole"`) and the failing
  e2e test `e2e/tape-edit.spec.ts`, part 1: drag a Hole body 2 Columns later, drag the start
  handle of another Hole 1 Column later, remove a third with Delete; a drag onto the next Hole of
  its Pipe is refused with the snackbar; after relaunching (as in `e2e/tape-restart.spec.ts`) the
  three edits are still there (spec 1.6, SC-003); `snapshots/tapes.json` is still version 1 with
  Holes as `[pipe, start, length]` triples (quickstart 31). Depends on T016.

### Implementation for User Story 1

- [ ] T027 [US1] Implement `removeHole`, `HoleRef`, `HoleEdit` and `HoleEditRefusal` in
  `api/tape/hole-edits.ts` (through `validTape`), export them and `column`, `columnCount` from
  `api/index.ts`, and import `HoleRef` from here in `api/tape/cutting-problems.ts`; until T017 is
  green. Depends on T017.
- [ ] T028 [US1] Implement `moveHole` in `api/tape/hole-edits.ts` (replace, sort by Pipe then start,
  `validTape`) and export it until T018 is green. Depends on T018, T027.
- [ ] T029 [US1] Implement `changeHoleLength` in `api/tape/hole-edits.ts` and export it until T019
  is green. Depends on T019, T028.
- [ ] T030 [P] [US1] Implement `src/app/features/tape/tape-view/grid-at.ts` until T020 is green.
  Depends on T020.
- [ ] T031 [P] [US1] Implement `src/app/features/tape/tape-view/hole-drag.ts` until T021 is green.
  Depends on T021.
- [ ] T032 [P] [US1] Implement `src/app/features/tape/tape-view/edit-keys.ts` until T022 is green.
  Depends on T022.
- [ ] T033 [P] [US1] Add the handles of the selected Hole to `holeRects` in
  `src/app/features/tape/tape-view/tape-drawing.ts` until T023 is green. Depends on T023.
- [ ] T034 [US1] Wire keyboard edits in `src/app/features/tape/tape-view/tape-view.component.ts`
  (and `.html`): `editIntent` → the command (`moveHole`/`changeHoleLength`/`removeHole`) →
  `TapeEditor.apply` with the new selection, or the snackbar on a refusal; add
  `TAPE.EDIT.REFUSED_OVERLAP` ("The Hole would overlap the Hole of {{note}} at Column
  {{column}}.") to `en.json` and `de.json`; until T024 is green. Depends on T024, T029, T032.
- [ ] T035 [US1] Wire pointer edits in `src/app/features/tape/tape-view/tape-view.component.ts`,
  `.html` and `.scss` (pointer capture, `gridAt`, `HoleDrag`, preview recomputed only when the
  snapped Column or row changes and at most once per animation frame, `refused` class with an
  oxblood outline, cursors, handles drawn from T033; one drag = one `TapeEditor.apply` on
  release) until T025 and T026 are green. Depends on T025, T026, T030, T031, T033, T034.

**Checkpoint**: US1 works in Electron: open a Tape → move, change ends, remove by keyboard and
pointer → restart → still there; overlaps are refused with a reason.

---

## Phase 4: User Story 2 - Add a hole (Priority: P1)

**Goal**: The user adds a Hole on a Pipe's row at a Column, by double-click or through the "Add a
Hole" side-panel form; it gets the Minimum Hole Length in whole Columns, cut back before the next
Hole, and is selected.

**Independent Test**: Open a reference Tape, add a Hole on an empty part of a row, and check its
Pipe, start, length and that it is saved.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [ ] T036 [US2] Extend `api/tape/hole-edits.spec.ts` for `addHole(tape, organ, pipe, start:
  Column): Result<HoleEdit, HoleEditRefusal>` (data-model.md "Added Hole's length": "`min(L,
  next.start − start)` where `L` is the Minimum Hole Length in whole Columns
  (`holeLimitsOf(organ, tape.columnLength).minimumHoleLength`, ≥ 1) and `next` the next Hole of
  that Pipe after `start`; `L` when there is none"): 2.1 E4 at Column 20 (`start` 19) with a
  Minimum Hole Length of 2.6 Columns → E4 20–22 (`start` 19, 3 Columns); 2.2 next E4 Hole 2 Columns later → 2 Columns,
  touching it, and `cuttingProblems` reports it `too-close`; 2.3 a covered Column →
  `err({code: 'overlaps', other})`; a Pipe not on the Organ → `err not-on-the-organ`; a Tape
  without Holes; `HoleEdit.hole` is the new Hole (2.4); FR-017, FR-019. Depends on T029.
- [ ] T037 [P] [US2] Write the failing component test
  `src/app/features/tape/tape-view/add-hole/add-hole.component.spec.ts` (contracts/tape-view-ui.md
  "Controls", research R7): section `data-testid="add-hole"` titled `TAPE.ADD_HOLE.TITLE`; a Pipe
  select `add-hole-pipe` with the Organ's Pipes by note name in rack order; a Column field
  `add-hole-column` counted from 1; button `add-hole-submit` (`TAPE.ADD_HOLE.SUBMIT`); prefilled
  "with the selected Hole's Pipe and the first free Column after it"; error text
  `TAPE.ADD_HOLE.COVERED` ("A Hole of {{note}} already covers Column {{column}}.") when the Column
  is covered and `TAPE.ADD_HOLE.COLUMN_INVALID` ("Enter a whole Column number from 1.") when it is
  not a whole number ≥ 1; submitting emits the Pipe and the 0-based Column. Depends on T016.
- [ ] T038 [US2] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts`: a
  double-click on an empty spot of a row adds a Hole of that row's Pipe at that Column and selects
  it (2.1, 2.4, one `update`); a double-click on a Hole adds nothing; the "Add a Hole" section is in
  the side panel, adding through it selects the new Hole and returns focus to the drawing; on an
  empty Tape (no Holes) the form adds the first Hole. Depends on T025, T037.
- [ ] T039 [P] [US2] Extend `e2e/tape-edit.spec.ts`, part 2: double-click an empty spot of the E4
  row adds a Hole there, selected and shown in the Selected Hole section; add one through the form;
  both survive a relaunch. Depends on T026.

### Implementation for User Story 2

- [ ] T040 [US2] Implement `addHole` in `api/tape/hole-edits.ts` and export it from `api/index.ts`
  until T036 is green. Depends on T036.
- [ ] T041 [US2] Implement `src/app/features/tape/tape-view/add-hole/add-hole.component.ts` (signal
  form, `MatSelect`, `MatFormField`, minimal SCSS) and add `TAPE.ADD_HOLE.TITLE`, `PIPE`, `COLUMN`,
  `SUBMIT`, `COVERED`, `COLUMN_INVALID` to `en.json` and `de.json` until T037 is green.
  Depends on T037.
- [ ] T042 [US2] Wire double-click add and the "Add a Hole" section in
  `src/app/features/tape/tape-view/tape-view.component.ts` and `.html` (through `addHole` and
  `TapeEditor.apply`) until T038 and T039 are green. Depends on T038, T039, T040, T041.

**Checkpoint**: US1 and US2 green: any single note can be fixed by hand.

---

## Phase 5: User Story 3 - See cutting problems as they happen (Priority: P1)

**Goal**: Every Hole with a Cutting Problem is marked at once with a dashed oxblood ring; the side
panel counts and lists them; choosing an entry selects and scrolls to the Hole; export still
refuses such a Tape (same rule).

**Independent Test**: Shorten a Hole below the Minimum Hole Length and check that it is marked and
that the selected Hole says why; lengthen it again and check that the mark is gone.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [ ] T043 [P] [US3] Extend `src/app/features/tape/tape-view/tape-drawing.spec.ts`: every Hole of
  `holesWithCuttingProblems` in the visible range gets a mark ring (class `cutting-problem`,
  `data-testid="hole-mark"`) "2 px outside its slot"; the Hole itself stays ink; marks are looked
  up by a `Set` of `"pipe:start"` keys (research R10, R11). Depends on T010.
- [ ] T044 [P] [US3] Write the failing component test
  `src/app/features/tape/tape-view/cutting-problems/cutting-problems.component.spec.ts`
  (contracts/tape-view-ui.md "Controls", research R11): section `data-testid="cutting-problems"`
  titled `TAPE.CUTTING_PROBLEMS.TITLE`; count `cutting-problems-count` with
  `TAPE.CUTTING_PROBLEMS.COUNT` ("{{count}} Holes can't be cut"), `COUNT_ONE` ("1 Hole can't be
  cut"), `NONE` ("None") when 0; one `cutting-problem` button per marked Hole in cut order with
  note name, Column (from 1) and the `TAPE.CUTTING_PROBLEM.*` text (including
  `TOO_CLOSE_PREVIOUS`: "{{note}} at Column {{column}}: the gap to the previous Hole at Column
  {{previous}} is {{gap}} mm, the Minimum Gap is {{minimum}} mm."), mm values in the language's
  notation; choosing a button emits the `HoleRef`; a `no-pipe` Hole is plain text, counted, not a
  button. Depends on T010.
- [ ] T045 [US3] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts` (quickstart
  13–17, 27): with a Minimum Hole Length of 2 Columns, Shift+← to 1 Column applies, marks the Hole
  and the Selected Hole names the problem in mm (3.1); a move below the Minimum Gap marks both
  Holes (3.2); fixing it removes the marks at once (3.3); the Cutting Problems section counts and
  lists them, choosing an entry selects the Hole and scrolls it into view (3.4, FR-011); "Export
  for the Plotter" then opens the cutting problems dialog (3.5, SC-004); a Hole whose Pipe is not
  on the Organ is counted and listed as text and stays unchanged by edits (FR-019). Marks and list
  follow the drag preview. Depends on T042, T043, T044.
- [ ] T046 [P] [US3] Extend `api/tape/hole-edits.spec.ts` with the timing test (SC-002, research
  R10): on a 2,000-Column Tape with 31 rows and 6,000 Holes, command + `cuttingProblems` +
  `holesWithCuttingProblems` + `tapeGeometry` take a median of 20 runs < 20 ms. If it is green at
  once, record that in the commit; no implementation task needed. Depends on T040.
- [ ] T047 [P] [US3] Extend `e2e/tape-edit.spec.ts`, part 3: shorten a Hole below the Minimum Hole
  Length → `hole-mark` around it and one entry in `cutting-problems`; choose the entry → the Hole
  is selected; export → the cutting problems dialog, no save dialog; from `Alt+→` to the moved
  `rect` in the DOM under 100 ms on the reference Tape (`performance.now()` in the page, SC-002).
  Depends on T039.

### Implementation for User Story 3

- [ ] T048 [US3] Draw the marks in `src/app/features/tape/tape-view/tape-drawing.ts` and
  `tape-view.component.scss` (dashed oxblood ring, selection ring stays solid blue) until T043 is
  green. Depends on T043.
- [ ] T049 [US3] Implement
  `src/app/features/tape/tape-view/cutting-problems/cutting-problems.component.ts` and add
  `TAPE.CUTTING_PROBLEMS.TITLE`, `COUNT`, `COUNT_ONE`, `NONE` and
  `TAPE.CUTTING_PROBLEM.TOO_CLOSE_PREVIOUS` to `en.json` and `de.json` until T044 is green.
  Depends on T044.
- [ ] T050 [US3] Wire marks and the Cutting Problems section in
  `src/app/features/tape/tape-view/tape-view.component.ts` and `.html` (`computed` from
  `cuttingProblems(tape, organ)` of the editor's present Tape or the drag preview; choosing selects
  and scrolls into view) until T045 and T047 are green. Depends on T045, T047, T048, T049.
- [ ] T051 [US3] Only if T046 is red: make the domain path faster without a second rule path (no
  incremental per-row check, research R10) until it is green. Depends on T046.

**Checkpoint**: The P1 stories are complete. This is the MVP of the slice: Holes can be changed,
removed and added by hand; Cutting Problems are marked, counted and listed as they happen; export
stays the gate.

---

## Phase 6: User Story 4 - Undo and redo (Priority: P2)

**Goal**: Undo and redo of edits, one at a time, by buttons in the page head and the OS
shortcuts; saved like edits; the history ends when the Tape view is left.

**Independent Test**: Make three edits, undo three times and compare the Tape with the stored one
before the edits; redo once and check the first edit is back.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [ ] T052 [P] [US4] Extend `src/app/features/tape/tape-view/edit-keys.spec.ts` with
  `historyIntent(event, platform)` (research R7): Ctrl+Z → undo, Ctrl+Y and Ctrl+Shift+Z → redo on
  Windows/Linux; ⌘Z → undo, ⌘⇧Z → redo on macOS (`metaKey`); the other modifier does nothing;
  events from `input`/`textarea` give no intent. Depends on T032.
- [ ] T053 [US4] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts` (quickstart
  18–22, 25, 29): Undo (`data-testid="undo"`, icon `undo`) and Redo (`redo`) `mat-icon-button`s
  in the page head with `aria-label` and tooltip `TAPE.EDIT.UNDO_TOOLTIP` / `REDO_TOOLTIP`
  ("Undo ({{shortcut}})"), disabled when there is nothing to undo/redo (4.4, FR-015); undo brings
  back the Tape and the earlier selection and calls `update` once (4.1); redo applies it again
  (4.2); a new edit after undo disables redo (4.3); a refused edit adds no undo step (4.5); the
  shortcuts work on the host element wherever focus is in the Tape view, with `preventDefault()`,
  except in a text field (the Add a Hole Column field keeps its own undo), on both platforms by a
  faked platform; three edits then three undos give the opened Tape (SC-006, real commands);
  leaving the view and opening the Tape again starts with nothing to undo (FR-014).
  Depends on T050.
- [ ] T054 [P] [US4] Extend `e2e/tape-edit.spec.ts`, part 4: three edits, `ControlOrMeta+Z` three
  times → the Holes are as opened; `ControlOrMeta+Shift+Z` → the first edit is back; the undo
  button is disabled after undoing everything; after a relaunch the Tape is as last undone/redone
  (undo is saved, FR-014). Depends on T047.

### Implementation for User Story 4

- [ ] T055 [US4] Implement `historyIntent` in `src/app/features/tape/tape-view/edit-keys.ts` until
  T052 is green. Depends on T052.
- [ ] T056 [US4] Add the Undo/Redo buttons and the host `keydown` handling in
  `src/app/features/tape/tape-view/tape-view.component.ts` and `.html` (through `TapeEditor`), and
  add `TAPE.EDIT.UNDO`, `REDO`, `UNDO_TOOLTIP`, `REDO_TOOLTIP` to `en.json` and `de.json` ("Undo
  (Ctrl+Z)" / "Rückgängig (Strg+Z)"), until T053 and T054 are green. Depends on T053–T055.

**Checkpoint**: US1–US4 green; trying things is safe.

---

## Phase 7: User Story 5 - The tape grows when I need more room (Priority: P2)

**Goal**: Adding, moving or lengthening a Hole past the last Column makes the Tape exactly long
enough; removing or shortening never shrinks it; only undo does.

**Independent Test**: On a 100-Column Tape, lengthen the last Hole to end at Column 104, check the
Tape is 104 Columns long, then remove the Hole and check it stays 104 Columns long.

### Tests for User Story 5 ⚠️ (write first, must fail)

- [ ] T057 [US5] Extend `api/tape/hole-edits.spec.ts` (data-model.md "Growth (FR-008): `length' =
  max(length, hole.start + hole.length)` for add, move and change; remove keeps `length`"): 5.1
  change the end to Column 104 (`start + length` 104) on a 100-Column Tape → `length` 104; 5.2 add
  and move to end at Column 110 → `length` 110; 5.3 then remove or shorten → `length` stays; an edit inside the Tape
  keeps `length`. Depends on T040.
- [ ] T058 [US5] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts` (quickstart
  23): Shift+→ past the end grows the Tape, and the drawing, ruler, Column numbers, subtitle and
  length in mm follow (5.1); a drag released past the Tape's end grows it (`gridAt` is not clamped
  at the end); removing the Hole keeps the length; undo shrinks it back (4.1, 5.3); during a drag
  within 24 px of the stage's left or right edge the stage scrolls (research R6). Depends on T056.
- [ ] T059 [P] [US5] Extend `e2e/tape-edit.spec.ts`, part 5: drag the last Hole past the right edge
  of the stage → the stage scrolls; release past the end → the subtitle shows the longer Tape;
  remove it → still that long; undo twice → the opened length; relaunch → as last saved.
  Depends on T054.

### Implementation for User Story 5

- [ ] T060 [US5] Implement growth in `addHole`, `moveHole` and `changeHoleLength` in
  `api/tape/hole-edits.ts` until T057 is green. Depends on T057.
- [ ] T061 [US5] Implement auto-scroll during a drag and whatever else the view needs in
  `src/app/features/tape/tape-view/tape-view.component.ts` until T058 and T059 are green.
  Depends on T058, T059, T060.

**Checkpoint**: US1–US5 green.

---

## Phase 8: User Story 6 - Edit with the keyboard and in German or English (Priority: P3)

**Goal**: Every edit, undo and redo works without a pointer and the keys can be found; every new
text is German and English.

**Independent Test**: With the keyboard only, select a Hole, move it, change both ends, remove it,
add a Hole, undo and redo; switch to German and check every new text.

### Tests for User Story 6 ⚠️ (write first, must fail)

- [ ] T062 [P] [US6] Extend
  `src/app/features/tape/tape-view/selected-hole/selected-hole.component.spec.ts`: a key help line
  `data-testid="hole-keys"` with `TAPE.EDIT.KEYS` ("Alt+arrows move it, Shift+arrows move its
  end, Alt+Shift+arrows its start, Delete removes it."). Depends on T016.
- [ ] T063 [P] [US6] Extend `src/app/features/tape/tape-i18n.spec.ts` (FR-018): every
  `TAPE.EDIT.*`, `TAPE.ADD_HOLE.*`, `TAPE.CUTTING_PROBLEMS.*` and `TAPE.CUTTING_PROBLEM.*` key has
  a German text that differs from the English one; every `HoleProblem` code has a
  `TAPE.CUTTING_PROBLEM.<CODE>` key; German uses the dictionary (Loch, Pfeife, Spalte,
  Schnittproblem, Mindestlochlänge, Mindestabstand). Depends on T056.
- [ ] T064 [P] [US6] Extend `e2e/tape-edit.spec.ts`, part 6 (SC-005, quickstart 24): keyboard only —
  Tab to the drawing, select a Hole, Alt+→, Alt+↓, Shift+→, Alt+Shift+→, Delete, add a Hole through
  the Add a Hole form, `ControlOrMeta+Z`, redo; no pointer event is used. Depends on T059.
- [ ] T065 [P] [US6] Extend `e2e/tape-german.spec.ts` (6.4): with the app set to German, the undo
  and redo tooltips, the refusal snackbar, the Add a Hole section, the Cutting Problems section and
  the key help are German, and no visible text matches a `TAPE.` key pattern. Depends on T059.

### Implementation for User Story 6

- [ ] T066 [US6] Add the key help line to
  `src/app/features/tape/tape-view/selected-hole/selected-hole.component.ts` and `TAPE.EDIT.KEYS`
  to `en.json` and `de.json` until T062 is green. Depends on T062.
- [ ] T067 [US6] Fill every missing or untranslated text in `src/assets/i18n/de.json` (and
  `en.json`) and fix any keyboard gap in the Tape view until T063, T064 and T065 are green.
  Depends on T063–T066.

**Checkpoint**: all user stories green.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T068 [P] Check the changed files: `api/tape/tape.ts`, `hole-edits.ts`, `cutting-problems.ts`
  import nothing from Angular, Electron or Node; no `any`, no non-null assertions, no `console.*`;
  `app/` is unchanged (`git diff main -- app/` empty); no i18n key is left unused
  (`npm run i18n:check` warnings).
- [ ] T069 [P] Update `documentation/DESIGN-GUIDE.md`: "The Tape visualisation" (Cutting Problem
  marks, handles of the selected Hole, cursors, drag preview and the `refused` outline),
  "Accessibility commitments" (the edit keys, undo/redo shortcuts, keyboard add), "Screens" →
  Tape view (Undo/Redo in the page head, the Add a Hole and Cutting Problems side-panel sections).
- [ ] T070 [P] Update `specs/004-place-holes-by-hand/data-model.md`, `quickstart.md` and the
  contracts only where the implementation settled a detail (final i18n key names, drawn elements).
- [ ] T071 Add Tape view captures with an edited Tape (selected Hole with handles, Cutting Problem
  marks, the Add a Hole and Cutting Problems sections, Undo/Redo) to `e2e/ux/screens.capture.ts`,
  run `npm run ux:screens` and the `ux-review` skill on them in both schemes; turn every finding
  into a test+implementation task pair appended to this file.
- [ ] T072 Run `npm run lint`, `npm run i18n:check`, `npm run test` and `npm run build`; all green.
- [ ] T073 Run `npm run e2e`; the whole suite, including the 001–003 tests (`tape-restart`,
  `tape-export`, `tape-german`, `tape-layout`), is green.
- [ ] T074 Run the `spec-auditor` agent on the slice against `spec.md` and this file; fix every gap
  through a new test+implementation task pair appended to this file.
- [ ] T075 Through the `housekeeper` agent: update `documentation/STATUS.md` (slice done, next
  step), set "Place holes by hand" to `done` in `documentation/ROADMAP.md`, add the editing under
  `[Unreleased]` in `CHANGELOG.md`, and file a follow-up issue for routing the application menu's
  Edit → Undo/Redo to the Tape (research R7 "Known limit").
- [ ] T076 Open a pull request (ADR 10) with `gh pr create`; the body has `Closes #105` and
  `Refs #103`, `Refs #80`. Squash-merge it with `gh pr merge --squash --delete-branch` once CI
  (e2e on Linux, Windows and macOS, ADR 13) is green.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: first.
- **Foundational (Phase 2)** depends on Setup and blocks every story:
  - Factory: T002 → T003 → T004 → T005.
  - Rename: T005 → T006 → T007 → T008; T006 → T009 → T010.
  - Editor: T011 → T012 (from T001); T005 → T013 → T014; T012 + T014 → T015 → T016.
- **US1 (Phase 3)** depends on Phase 2.
  - Domain: T017 → T018 → T019 (one spec file); T017 → T027 → T028 → T029.
  - View helpers: T020 → T030, T021 → T031, T022 → T032, T023 → T033.
  - View: T024 → T034 (needs T029, T032); T025, T026 → T035 (needs T030, T031, T033, T034).
- **US2 (Phase 4)** depends on US1's commands and pointer wiring (T029, T035): T036 → T040;
  T037 → T041; T038, T039 → T042.
- **US3 (Phase 5)** depends on Phase 2 (T010) for T043/T044 and on US2 (T042) for T045/T047:
  T043 → T048, T044 → T049, T045 + T047 → T050; T046 → T051 (only if red).
- **US4 (Phase 6)** depends on Phase 2 (`TapeEditor`) and US3's view (T050): T052 → T055;
  T053, T054 → T056.
- **US5 (Phase 7)** depends on the commands (T040) and the undo UI (T056): T057 → T060;
  T058, T059 → T061.
- **US6 (Phase 8)** depends on all earlier stories (every key exists): T062 → T066;
  T063–T065 → T067.
- **Polish** comes last.

### Within each story

Tests first, and they must fail for the expected reason. Implementation follows; each
test+implementation pair is one commit. The `angular-reviewer` runs after each implementation in
`src/`; `app/` is not touched, so no `electron-reviewer` run is needed unless that changes.

### Parallel opportunities

- **Foundational:** the editor chain T011–T016 alongside the factory and rename chain T002–T010
  (`T013` waits for T005); T009 alongside T007–T008.
- **US1:** the view-helper tests T020–T023 and the e2e test T026 alongside the domain tests
  T017–T019; the helper implementations T030–T033 together.
- **US2:** T037 and T039 alongside T036.
- **US3:** T043, T044, T046, T047 together.
- **US4:** T052 and T054 alongside T053.
- **US6:** T062–T065 together.
- Editing agents of one session run sequentially in the same working tree (AGENTS.md); [P] marks
  what may run in parallel across worktrees or for read-only reviewers.

## Parallel Example: User Story 1

```text
Task: "T020 gridAt unit test"
Task: "T021 HoleDrag unit test"
Task: "T022 editIntent unit test"
Task: "T023 handles in holeRects"
Task: "T026 e2e drag, handle, remove, restart"
```

## Parallel Example: User Story 2

```text
Task: "T036 addHole unit test"
Task: "T037 Add a Hole component test"
Task: "T039 e2e double-click and form add"
```

## Parallel Example: User Story 3

```text
Task: "T043 marks in the drawing"
Task: "T044 Cutting Problems section component test"
Task: "T046 2,000-Column timing test"
Task: "T047 e2e marks, list, export refused, 100 ms"
```

## Parallel Example: User Story 4

```text
Task: "T052 undo/redo key intents per platform"
Task: "T054 e2e undo/redo and restart"
```

## Parallel Example: User Story 6

```text
Task: "T062 key help line"
Task: "T063 German key coverage"
Task: "T064 e2e keyboard only"
Task: "T065 e2e German editing texts"
```

## Implementation Strategy

1. **Foundation first:** Phases 1–2. Every Tape comes from `validTape`, the export rule is called
   Cutting Problem everywhere and groups per Hole, and the Tape view has an editor with an undo
   history that saves through `TapeLibrary.update`. The app keeps working after every task.
2. **MVP:** Phases 3–5 (US1, US2, US3, all P1): change, remove and add Holes by keyboard and
   pointer, with Cutting Problems marked and listed as they happen. Stop and validate in Electron
   (`npm run e2e`) and update STATUS.
3. **Then P2:** US4 (undo and redo), US5 (the Tape grows).
4. **Then P3:** US6 (key help, keyboard-only proof, German throughout).
5. **Finish:** Polish, the Definition of Done gate, the `spec-auditor` run, then the pull request
   with `Closes #105` and the squash-merge.
