---

description: "Tasks for 003 Punch a tape"
---

# Tasks: Punch a tape

**Input**: Design documents from `/specs/003-punch-a-tape/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/domain-api.md](contracts/domain-api.md),
[contracts/plotter-ipc.md](contracts/plotter-ipc.md), [quickstart.md](quickstart.md),
[ADR 21](../../documentation/adr/0021-plotter-export-built-in-the-domain.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task comes after a
test task that names its spec file, and that test must fail for the expected reason before you
implement. Follow the `tdd` skill: `test-first` writes the red test, `implementer` makes it green.
Test pyramid (research R9): Node Vitest for the geometry, the check, the SVG, the file name, the
payload parser and the IPC handler; `ng test` for the Tape view, `PlotterExport` and the problems
dialog; Playwright e2e only for the real save dialog, the channel and the file on disk.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested
on its own. Stories follow the spec's priority order (US1, US2 P1; US3 P2; US4 P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: Which user story this task belongs to (US1–US4); only in story phases
- **Commits**: one small conventional commit per test+implementation pair, on `003-punch-a-tape`.
  Update `documentation/STATUS.md` at each checkpoint.

## Path conventions

- **`api/tape/`, `api/app/`**: pure TypeScript domain. Relative imports only; no Angular, Electron
  or Node imports (ADR 2, constitution III). The SVG is a string; no DOM. Specs here must not import
  from `src/` (build test Organs with `validateOrgan`, like `anOrgan` in
  `api/tape/create-tape.spec.ts`). Tested with Node Vitest (`vitest.node.config.ts`).
- **`app/`**: Electron main process and preload. Node Vitest with fakes and temporary directories.
- **`src/app/`**: Angular renderer. `ng test` (Vitest, jsdom, ADR 9). Standalone, OnPush, signals,
  Angular Material (`MatDialog`, `MatSnackBar`), minimal SCSS.
- **`e2e/`**: Playwright Electron tests, started through `e2e/support/launch-app.ts`; Organs and
  Tapes are created through the UI with `e2e/support/organ-editor.ts` and
  `e2e/support/tape-creation.ts`.
- **Reference Organ** (scenarios 1.3/1.4, quickstart): tape width 100 mm, hole diameter 3 mm,
  spacing between rows 4 mm, 10 Pipes, Minimum Gap 2 mm, Lead-in 50 mm; a Tape with Column length
  3 mm and 200 Columns. Border = (100 − 9 × 4 − 3) / 2 = 30.5 mm.
- **Words**: dictionary terms only (Tape, Hole, Column, Tape Outline, Lead-in, Border, Tape Bed,
  Plotter, Punch, Minimum Hole Length, Minimum Gap, Pipe, Organ). Code-only names allowed by the
  plan: `TapeGeometry`, `Slot`, `TapeOutline`, `Point`, `ExportProblem`, `PlotterExport`,
  `SvgSaveRequest`, `SvgSaveResult`, `PlotterEffects`.
- **i18n**: every new key goes into both `src/assets/i18n/en.json` and `de.json` in the same task;
  `src/app/i18n-parity.spec.ts` and `npm run i18n:check` must stay green.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A green baseline, so that the geometry move in Phase 2 is a refactor under green.

- [x] T001 On `003-punch-a-tape`, run `npm run test`, `npm run lint`, `npm run i18n:check` and
  `npm run build`; all green before any change. No file changes. If anything is red, record it in
  `documentation/STATUS.md` and fix it first.

**Checkpoint**: baseline green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: One Tape geometry in `api/tape/`, measured from the Lead-in's tip, with the end gap and
the Tape Outline, drawn by the Tape view (FR-006, FR-008, FR-010, research R1, ADR 21); and the
hole limits shared by `createTape` and the export check (research R4). Every story needs them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Move the geometry (refactor under green)

- [x] T002 Move `src/app/features/tape/tape-view/tape-geometry.ts` to `api/tape/tape-geometry.ts`
  and `src/app/features/tape/tape-view/tape-geometry.spec.ts` to `api/tape/tape-geometry.spec.ts`
  **without changing behaviour** (research R1, contracts/domain-api.md). In the moved spec replace
  `testOrgan` from `src/testing/organs` with a local Organ builder over `validateOrgan` (the Street
  organ: 120 mm wide, 31 rows at 3.5 mm, hole 2.5 mm, Lead-in 20 mm) and use relative imports only.
  Export `tapeGeometry`, `type TapeGeometry` and `type Slot` from `api/index.ts`. Switch the imports
  in `src/app/features/tape/tape-view/tape-view.component.ts`, `pointer-at.ts`,
  `visible-columns.ts`, `pointer-at.spec.ts` and `tape-view.component.spec.ts` to `@api/index`;
  delete the old files. `npm run test` and `npm run lint` are green before and after. Commit as
  `refactor(tape): move the Tape geometry to api/tape`.

### Tip frame and end gap

- [x] T003 Write the failing tests in `api/tape/tape-geometry.spec.ts` for the tip frame and the
  end gap (data-model.md "TapeGeometry", "Slot"):
  - `leadIn`: "`organ.leadIn`; also the x of Column 1".
  - `length`: "the Columns only: `tape.length × columnLength` (unchanged meaning)".
  - `endGap`: "`organ.minimumGap`: from the end of the last Column to the end cut".
  - `totalLength`: "`leadIn + length + endGap`: the document width (FR-006)".
  - `width`: "`organ.tapeBed.tapeWidth`: the document height"; `border`: "`border(organ)`";
    `rowCentres`: "y of each row's centre, row 1 first".
  - Slot `row`: "the Pipe's position on the Organ, from 1"; `start`: "the Hole's start Column
    (from 0, as stored)"; `x`: "`leadIn + start × columnLength`"; `y`: "`border + (row − 1) ×
    rowSpacing` (top of the slot)"; `width`: "`hole.length × columnLength`"; `height`:
    "`holeDiameter`"; `radius`: "`holeDiameter / 2`: the half-circle ends lie inside `width`".
  - Scenario 1.3 on the reference Organ: row 1, start 0, 4 Columns → "`x = 50`, `width = 12`,
    `y = 30.5`, centre line at 32"; scenario 1.4: 200 Columns → `length` 600, `endGap` 2,
    `totalLength` 652, `width` 100.
  - Edge cases: Lead-in 0 → `x = start × columnLength`; "Border 0 puts Slots on the long edges
    (valid)"; "empty Columns at the end still count in `length`"; "a Minimum Gap of 0 puts the end
    cut at the end of the last Column" (`totalLength = leadIn + length`); a Hole whose Pipe is not
    on the Organ gets no Slot.
  - Adjust the view's existing specs to the tip frame: the hand-built `TapeGeometry` in
    `src/app/features/tape/tape-view/pointer-at.spec.ts` gains `endGap` and `totalLength` and its
    Slot `x` values include the Lead-in; in
    `src/app/features/tape/tape-view/tape-view.component.spec.ts` replace
    `(geometry.leadIn + slot.x) * SCALE` by `slot.x * SCALE` (the pixel expectations stay the same).
    Depends on T002.
- [x] T004 Implement the tip frame, `endGap` and `totalLength` in `api/tape/tape-geometry.ts` until
  T003 is green, and make the view follow without moving anything on screen: drop the added
  `leadIn` from Slot positions in `tape-view.component.ts` (`drawing.holes`, `overview.holesPath`);
  `pointer-at.ts` and `visible-columns.ts` keep counting Columns from Column 1 (subtract
  `geometry.leadIn` once). Every existing `tape-view.component.spec.ts`, `pointer-at.spec.ts` and
  `visible-columns.spec.ts` test stays green. Depends on T003.

### Tape Outline

- [x] T005 Write the failing tests in `api/tape/tape-geometry.spec.ts` for `outline: TapeOutline`
  (data-model.md "TapeOutline", FR-010):
  - `tip`: "`(0, 0)`: the Lead-in's tip on the top edge"; `topEnd`: "`(totalLength, 0)`";
    `bottomEnd`: "`(totalLength, width)`"; `columnOneBottom`: "`(leadIn, width)`: where the
    diagonal meets the bottom edge"; `Point = {readonly x: number; readonly y: number}`.
  - Scenario 1.4: "tip (0, 0), top end (652, 0), bottom end (652, 100), Column 1 bottom (50, 100)".
  - "With `leadIn = 0`, `columnOneBottom` is `(0, width)`" (the square cut at Column 1).
  - "a Tape without Holes has no Slots and the same Outline".
  - `type TapeOutline` and `type Point` are exported from `api/index.ts`.
  Depends on T004.
- [x] T006 Implement `outline` (and the `TapeOutline` and `Point` types) in
  `api/tape/tape-geometry.ts` and export them from `api/index.ts` until T005 is green.
  Depends on T005.

### The Tape view draws the Tape Outline (FR-008)

- [x] T007 Write the failing tests in `src/app/features/tape/tape-view/tape-view.component.spec.ts`
  for drawing the Tape Outline from the shared geometry (research R1 "Consequence for the Tape
  view", quickstart scenario 20):
  - The Lead-in (`data-testid="lead-in"`) is the straight diagonal over the **whole** Lead-in: from
    `outline.columnOneBottom` to `outline.tip`, both times the scale; with a Lead-in of 30 mm it
    spans 30 mm, not the 10 mm of today's `LEAD_IN_SLANT_MM`. Rewrite the existing Lead-in test
    that reads `slant, end, start` from the path's `d` accordingly.
  - The Tape body ends at `totalLength × scale`, one Minimum Gap after the end of the last Column,
    on the stage and in the overview strip; the scroll container covers `totalLength`;
    `pixelsPerMillimetre('whole', …)` is given `totalLength`.
  - With a Lead-in of 0 there is no diagonal and the Tape starts square at Column 1.
  - Unchanged: the ruler, the Border lines, the row guides and the Column numbers still start at
    Column 1; the Selected Hole inspector's "gap to the Tape's end" stays in Columns up to the end
    of the last Column (research R1).
  Depends on T006.
- [x] T008 Draw the Tape Outline from `geometry.outline` and `geometry.totalLength` in
  `src/app/features/tape/tape-view/tape-view.component.ts` (and `.html`, `.scss` only if needed);
  remove `LEAD_IN_SLANT_MM`; until T007 is green. `e2e/tape-layout.spec.ts` (its Lead-in box is
  still the Lead-in's length wide) must stay green under `npm run e2e`; adjust it only if the drawn
  elements change, never its tolerance. Depends on T007.

### Shared hole limits

- [x] T009 [P] Write the failing test in `api/tape/hole-fixes.spec.ts` for `holeLimitsOf(organ,
  columnLength): HoleLimits`, now exported from `api/tape/hole-fixes.ts` (internal, **not** in
  `api/index.ts`; contracts/domain-api.md "Changed"): `minimumHoleLength` and `minimumGap` are
  `columnsFor` of the Organ's Minimum Hole Length and Minimum Gap, at least one Column each, as in
  `createTape` today; 1.1 mm Columns against a Minimum Hole Length of 3.3 mm give 3 (no
  floating-point error). Depends on T001.
- [x] T010 Move `holeLimitsOf` (and its helper `atLeastOneColumn`) from `api/tape/create-tape.ts`
  to `api/tape/hole-fixes.ts` until T009 is green; `createTape` imports it from there;
  `api/tape/create-tape.spec.ts` stays green **unchanged**. Depends on T009.

**Checkpoint**: `npm run test` green; the Tape view draws the full Lead-in diagonal and ends one
Minimum Gap after the last Column, from the same `TapeGeometry` the file will use.

---

## Phase 3: User Story 1 - Export my tape for the Plotter (Priority: P1) 🎯 MVP

**Goal**: "Export for the Plotter" opens a save dialog suggesting `<Tape name>.svg` and writes one
true-size SVG with every Hole as a slot and the Tape Outline; the user is told where it was saved;
the Tape doesn't change.

**Independent Test**: Export a reference Tape on the reference Organ and compare the file with the
expected geometry: each Hole's position, length and width in mm, the Tape Outline's corners, and
the document size in mm.

### Tests for User Story 1 ⚠️ (write first, must fail)

- [x] T011 [P] [US1] Write the failing test `api/tape/plotter-file-name.spec.ts` for
  `plotterFileName(tapeName: string): string` (research R7, data-model.md: "`<safe name>.svg`
  (research R7); never empty, never a path"):
  - "`< > : " / \ | ? *` and control characters (U+0000–U+001F, U+007F) become `_`";
  - "leading and trailing spaces and trailing dots are removed";
  - "a name that is a Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`,
    `LPT1`–`LPT9`, any case, also before a dot) gets a `_` in front";
  - "cut to 200 UTF-16 code units before `.svg`, without splitting a surrogate pair";
  - "a name with nothing left becomes `Tape.svg`";
  - `Test: 1/2` → `Test_ 1_2.svg` (quickstart); `Waltz` → `Waltz.svg`; the input is not changed.
- [x] T012 [P] [US1] Write the failing test `api/tape/plotter-svg.spec.ts` for
  `plotterSvg(geometry: TapeGeometry): string` (research R3, data-model.md "Plotter file": "root
  size and `viewBox` in mm from `totalLength` × `width`; one closed `path` per Slot in `slots`
  order; the Outline's `path` last"):
  - first line `<?xml version="1.0" encoding="UTF-8"?>`; root
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="652mm" height="100mm" viewBox="0 0 652 100">`
    for scenario 1.4 (FR-006, SC-003);
  - scenario 1.3's Hole is exactly
    `<path d="M51.5,30.5 H60.5 A1.5,1.5 0 0 1 60.5,33.5 H51.5 A1.5,1.5 0 0 1 51.5,30.5 Z" fill="none" stroke="#000000" stroke-width="0.1"/>`
    (FR-009, SC-002);
  - the Outline is the last element, `M0,0 H652 V100 H50 Z` (FR-010); with a Lead-in of 0 it is
    `M0,0 H… V… H0 Z`;
  - a Hole exactly one hole diameter long is a circle of two arcs; the radius is clamped to half
    the length, so the writer is total;
  - numbers: "plain decimals with a `.`, rounded to 0.001 mm and printed without trailing zeros or
    exponent (`12`, `30.5`, `0.333`)";
  - "UTF-8 without BOM, `\n` line endings, one element per line";
  - only cuts (FR-011, FR-013): only `path` elements besides the root, each `fill="none"`; no
    `rect`, `text`, `g`, `id`, metadata, `<title>`, `style` or `transform`; the Tape's name never
    appears in the file;
  - a Tape without Holes gives only the Outline's path; one path per Slot, in `slots` order;
  - SC-005: `tapeGeometry` plus `plotterSvg` for a generated 10-minute Tape (about 20 000 Columns,
    a few thousand Holes) finishes in under 5 s (expected well under 1 s) and gives one string.
- [x] T013 [P] [US1] Write the failing test `api/app/svg-save-request.spec.ts` for
  `parseSvgSaveRequest(input: unknown): Result<SvgSaveRequest, string>`
  (contracts/plotter-ipc.md "Validation"; the reason names the field). It rejects:
  - the payload unless "a plain object with exactly these four string fields"
    (`suggestedFileName`, `svg`, `dialogTitle`, `filterName`);
  - `suggestedFileName` unless "5–255 characters, ends in `.svg` (any case), no `/`, `\`, `:` or
    control character, not only dots before `.svg`" (`../evil.svg`, `C:\x.svg`, `...svg`, `a.txt`);
  - `svg` unless "non-empty, at most 64 × 2²⁰ characters (a 10-minute Tape is about 1 MB), starts
    with `<?xml` and contains `<svg `";
  - `dialogTitle`, `filterName` unless "1–200 characters, no control character".
  It accepts every `plotterFileName` result of T011's cases and every `plotterSvg` result of
  T012's cases.
- [x] T014 [P] [US1] Write the failing test `app/plotter-ipc.spec.ts` for
  `registerPlotterHandlers(ipcMain, effects: PlotterEffects)` with a fake `ipcMain`, a fake
  `showSaveDialog` that records its options, and a real temporary folder for `writeFile`
  (contracts/plotter-ipc.md "Behaviour"):
  - `PLOTTER_CHANNELS = {saveSvg: 'plotter:save-svg'} as const`; exactly that channel is handled;
  - "Invalid request → `rejected`; no dialog";
  - the dialog is modal to the sender's window, with `title`: `dialogTitle`; `defaultPath`:
    "`join(lastFolder ?? documentsFolder(), basename(suggestedFileName))`"; `filters`:
    "`[{name: filterName, extensions: ['svg']}]`"; `properties`:
    "`['showOverwriteConfirmation', 'createDirectory']`";
  - "`canceled` or no `filePath` → `cancelled`", nothing written;
  - "`writeFile(filePath, svg)` as UTF-8, replacing an existing file the user confirmed"; success
    → `saved` with `filePath`, and the next dialog's `defaultPath` starts in that file's folder;
  - a write into a missing folder → `failed` with the error's message; "`lastFolder` unchanged";
  - "Nothing in `userData` is read or written; no snapshot changes (FR-014)".
- [x] T015 [P] [US1] Extend `api/app/crancula-api.spec.ts` with `expectTypeOf` checks:
  `CranculaApi.plotter` has `saveSvg(request: SvgSaveRequest): Promise<SvgSaveResult>`, with
  `SvgSaveResult` = "`{status: 'saved'; filePath: string}` | `{status: 'cancelled'}` |
  `{status: 'rejected'; reason: string}` | `{status: 'failed'; reason: string}`", re-exported by
  `api/app/crancula-api.ts` (contracts/domain-api.md).
- [x] T016 [P] [US1] Extend `src/app/core/crancula-api.token.spec.ts`: the `plotter` part of
  `createInMemoryCranculaApi` "validates with `parseSvgSaveRequest`, records the last request, and
  answers `saved` with `filePath: 'in-memory/<suggestedFileName>'`"; a forged request gives
  `rejected`; "The existing `failures` option gains `plotter?: {saveSvg?: 'cancelled' | 'failed'}`"
  (contracts/plotter-ipc.md "In-memory stand-in").
- [x] T017 [P] [US1] Extend the e2e test `e2e/boundary.spec.ts`: `window.crancula` has exactly the
  keys `app`, `organs`, `plotter`, `tapes`; `window.crancula.plotter.saveSvg` is a function; a
  forged request (`suggestedFileName: '../evil.svg'`) answers `{status: 'rejected', …}` and no
  dialog opens.
- [x] T018 [P] [US1] Write the failing test
  `src/app/features/tape/tape-view/plotter-export.spec.ts` for the injectable `PlotterExport`
  (research R8, data-model.md "State"), with the in-memory stand-in:
  - the request is "`suggestedFileName: plotterFileName(tape.name)`", "`svg:
    plotterSvg(tapeGeometry(tape, organ))`", and `dialogTitle`/`filterName` translated from
    `TAPE.EXPORT.DIALOG_TITLE` and `TAPE.EXPORT.FILTER_NAME`;
  - `saved` → a snackbar `TAPE.EXPORT.SAVED` naming the path (FR-005);
  - `cancelled` → no snackbar, nothing else changes;
  - `failed` or `rejected` → a snackbar `TAPE.EXPORT.FAILED` with the reason that "stays until
    dismissed" (FR-015); a later export works (retry);
  - "The renderer keeps a `saving` signal while a save is running, so the command can't open a
    second dialog": a second call while saving does nothing;
  - the Tape library's Tapes are unchanged and nothing is saved to `tapes.json` (FR-014, SC-006);
    exporting twice works (scenario 1.5).
- [x] T019 [P] [US1] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts`
  (FR-001, scenario 1.1): "Export for the Plotter" (`TAPE.VIEW.EXPORT`) is enabled for every
  opened Tape; there is no `data-testid="export-later"` text; clicking it calls `PlotterExport`
  with the shown Tape and its Organ; the button is disabled while `saving` is true.
- [x] T020 [P] [US1] Write `e2e/support/save-dialog.ts` and the failing e2e test
  `e2e/tape-export.spec.ts`, part 1 (research R9). The helper replaces `dialog.showSaveDialog` in
  the main process through `electronApp.evaluate(({dialog}) => …)`, answers a given path or
  `canceled`, and records every call's options. The test creates the reference Organ and a Tape
  named `Waltz` through the UI, exports it and checks:
  - the dialog's `defaultPath` is `Waltz.svg` in the Documents folder (`app.getPath('documents')`)
    and its title is the English `TAPE.EXPORT.DIALOG_TITLE` (scenario 1.2);
  - exactly one file is written at the chosen path; read with `fs`, it starts with `<?xml`, its
    root is `width="…mm" height="100mm"` with the matching `viewBox`, it has one `path` per Hole
    plus the Outline last (scenarios 1.3, 1.4);
  - the snackbar names the path; `snapshots/tapes.json` is byte-for-byte unchanged; a second
    export works (scenario 1.5, SC-006);
  - a chosen path in a missing folder shows the failure snackbar, nothing is written, and saving
    again to a valid path succeeds (FR-015).

### Implementation for User Story 1

- [x] T021 [P] [US1] Implement `api/tape/plotter-file-name.ts` and export `plotterFileName` from
  `api/index.ts` until T011 is green.
- [x] T022 [US1] Implement `api/tape/plotter-svg.ts` and export `plotterSvg` from `api/index.ts`
  until T012 is green. String output only; rounding once, in the writer. Depends on T006, T012.
- [x] T023 [US1] Implement `api/app/svg-save-request.ts` (`SvgSaveRequest`, `SvgSaveResult`,
  `parseSvgSaveRequest`) and export them from `api/index.ts` until T013 is green. Depends on T013,
  T021, T022.
- [x] T024 [US1] Implement `app/plotter-ipc.ts` (`PLOTTER_CHANNELS`, `PlotterEffects`,
  `registerPlotterHandlers`, the remembered folder in memory only) until T014 is green.
  Depends on T014, T023.
- [x] T025 [US1] Add `plotter.saveSvg` to `CranculaApi` in `api/app/crancula-api.ts` (re-exporting
  `SvgSaveRequest`, `SvgSaveResult`), the `plotter` part of the stand-in in
  `src/app/core/crancula-api.token.ts`, `window.crancula.plotter` in `app/preload.ts` (through
  `ipcRenderer.invoke(PLOTTER_CHANNELS.saveSvg, …)`, type-only imports), and the wiring in
  `app/main.ts`: "`showSaveDialog` calls `dialog.showSaveDialog(...)` looked up **at call time**",
  "`writeFile` is `fs.promises.writeFile(path, text, 'utf8')`", "`documentsFolder` is
  `app.getPath('documents')`"; until T015, T016 and T017 are green. One commit, since the type,
  the preload and the stand-in must change together. Depends on T015–T017, T024.
- [x] T026 [US1] Implement `src/app/features/tape/tape-view/plotter-export.ts` (injectable,
  `MatSnackBar`, `TranslateService`, the `saving` signal) and add `TAPE.EXPORT.DIALOG_TITLE`,
  `TAPE.EXPORT.FILTER_NAME` ("SVG file"), `TAPE.EXPORT.SAVED` and `TAPE.EXPORT.FAILED` to
  `src/assets/i18n/en.json` and `de.json`, until T018 is green. Depends on T018, T025.
- [x] T027 [US1] Enable "Export for the Plotter" in
  `src/app/features/tape/tape-view/tape-view.component.ts` and `.html`: call `PlotterExport`,
  disable while saving, remove the `export-later` span and its styles, and remove
  `TAPE.VIEW.EXPORT_LATER` from `en.json` and `de.json`; until T019 and T020 are green.
  Depends on T019, T020, T026.

**Checkpoint**: US1 works in Electron: open a Tape → Export → one true-size SVG on disk; T011–T020
green.

---

## Phase 4: User Story 2 - I'm told when a tape can't be cut (Priority: P1)

**Goal**: Export checks every Hole against the Organ; if any Hole has no Pipe, is shorter than the
Minimum Hole Length or keeps less than the Minimum Gap, a dialog lists every such Hole and why, and
no save dialog opens.

**Independent Test**: Raise a reference Organ's hole diameter so that one Hole of a stored Tape is
shorter than the Minimum Hole Length, try to export, and check the message and that no file is
written.

### Tests for User Story 2 ⚠️ (write first, must fail)

- [x] T028 [P] [US2] Write the failing test `api/tape/export-problems.spec.ts` for
  `exportProblems(tape: Tape, organ: Organ): readonly ExportProblem[]` ("empty means exportable";
  data-model.md "Export check", research R4):
  - the union, verbatim: `{readonly code: 'no-pipe'; readonly pipe: MidiNoteNumber; readonly
    start: Column}` | `{readonly code: 'too-short'; readonly pipe: MidiNoteNumber; readonly start:
    Column; readonly lengthMm: number; readonly minimumHoleLengthMm: Millimetres}` |
    `{readonly code: 'too-close'; readonly pipe: MidiNoteNumber; readonly start: Column; readonly
    nextStart: Column; readonly gapMm: number; readonly minimumGapMm: Millimetres}`, `gapMm`
    "Negative when the two Holes overlap"; `type ExportProblemCode` = `'no-pipe' | 'too-short' |
    'too-close'`;
  - `no-pipe`: "no Pipe of the Organ has `hole.pipe`" (Story 2.3);
  - `too-short`: "`hole.length < minimumHoleLength` in Columns" (Story 2.1), with `lengthMm` =
    `hole.length × columnLength` and `minimumHoleLengthMm` = the Organ's Minimum Hole Length;
  - `too-close`: "`next.start − (hole.start + hole.length) < minimumGap` in Columns, `next` the
    following Hole of the same Pipe" (Story 2.2), reported once, on the earlier Hole, naming
    `nextStart`;
  - limits "via `columnsFor`, as `createTape`" (`holeLimitsOf`): `1.1 mm × 3 Columns` against
    `3.3 mm` is not refused;
  - "Every problem of every Hole is listed (Story 2.4); a Hole can have `too-short` and
    `too-close`. A Hole with `no-pipe` gets only that problem (it has no row)";
  - "Order: by `start`, then by row (Holes without a Pipe after those with one at the same start),
    then by code in the order of the table";
  - a Tape without Holes gives `[]`; a Tape just made by `createTape` (from SMF bytes built with
    `api/song/midi/smf-test-helper.ts`) gives `[]`.
- [x] T029 [P] [US2] Extend `src/app/features/tape/tape-view/inspect-hole.spec.ts`: the warnings
  follow the export check's Column-based rules (research R4 "Reuse"): a Hole of 3 Columns of
  1.1 mm against a Minimum Hole Length of 3.3 mm gives no `tooShort` warning; a Hole the check
  reports as `too-short` gives `tooShort`; a Hole reported as `too-close`, and the next Hole of its
  row, give `gapTooSmall`; `HoleWarning` and the "gap to the Tape's end" stay as they are.
- [x] T030 [P] [US2] Write the failing component test
  `src/app/features/tape/tape-view/export-problems-dialog/export-problems-dialog.component.spec.ts`
  (FR-003, research R8): given a list of `ExportProblem`s as dialog data it shows the title
  `TAPE.EXPORT.PROBLEMS_TITLE` ("This Tape can't be cut yet") and one entry per problem, each with
  `noteName(pipe)`, the start Column "`start + 1` (counted from 1, as in the Import Summary)" and
  its reason from `TAPE.EXPORT.PROBLEM.NO_PIPE`, `TAPE.EXPORT.PROBLEM.TOO_SHORT` (with the Minimum
  Hole Length and the Hole's length) or `TAPE.EXPORT.PROBLEM.TOO_CLOSE` (with the Minimum Gap, the
  gap and the next Hole's Column `nextStart + 1`), the mm values "in the language's notation"
  (`3,3` in German); every problem is listed (Story 2.4); the list scrolls inside
  `mat-dialog-content`; one close button.
- [x] T031 [P] [US2] Extend `src/app/features/tape/tape-view/plotter-export.spec.ts`: when
  `exportProblems(tape, organ)` is not empty, `PlotterExport` opens the problems dialog with
  exactly those problems, never calls `plotter.saveSvg`, shows no snackbar, and leaves the Tape
  library unchanged (FR-003, Story 2.5, SC-004).
- [x] T032 [P] [US2] Extend `src/app/features/tape/tape-view/tape-view.component.spec.ts`: for a
  Tape that can't be cut (its Organ's hole diameter raised after the Tape was made), "Export for
  the Plotter" stays enabled and choosing it opens the problems dialog (FR-001, spec Session
  2026-10-17).
- [x] T033 [P] [US2] Extend `e2e/tape-export.spec.ts`, part 2 (quickstart scenario 7): after
  creating the Tape, raise the Organ's hole diameter in the Organ editor so that a Hole is shorter
  than the Minimum Hole Length, open the Tape and export: the problems dialog names the Hole's note
  and start Column and the Minimum Hole Length; the replaced save dialog was never called; no file
  is written; `snapshots/tapes.json` is unchanged.

### Implementation for User Story 2

- [x] T034 [US2] Implement `api/tape/export-problems.ts` on `holeLimitsOf` from
  `api/tape/hole-fixes.ts` and export `exportProblems`, `ExportProblem` and `ExportProblemCode`
  from `api/index.ts` until T028 is green. Depends on T010, T028.
- [x] T035 [US2] Derive the warnings in `src/app/features/tape/tape-view/inspect-hole.ts` from
  `exportProblems(tape, organ)` (this Hole's `too-short` and `too-close`, and the previous Hole of
  its row's `too-close`) until T029 is green; every existing `inspect-hole.spec.ts` and Tape view
  test stays green. Depends on T029, T034.
- [x] T036 [US2] Implement
  `src/app/features/tape/tape-view/export-problems-dialog/export-problems-dialog.component.ts`
  (and `.html`, minimal `.scss` for the scrolling list), add `TAPE.EXPORT.PROBLEMS_TITLE`,
  `TAPE.EXPORT.PROBLEM.NO_PIPE`, `TAPE.EXPORT.PROBLEM.TOO_SHORT`, `TAPE.EXPORT.PROBLEM.TOO_CLOSE`
  and `TAPE.EXPORT.CLOSE` to `en.json` and `de.json`, and add `'TAPE.EXPORT.PROBLEM.'` to
  `DYNAMIC_PREFIXES` in `scripts/check-i18n.mjs`, until T030 is green. Depends on T030, T034.
  *Done with flat keys* (`TAPE.EXPORT.PROBLEM_NO_PIPE`, `…_TOO_SHORT`, `…_TOO_CLOSE`,
  `TAPE.EXPORT.PROBLEMS_CLOSE`), each named literally in code, so no `DYNAMIC_PREFIXES` entry.
- [x] T037 [US2] Run `exportProblems` first in `src/app/features/tape/tape-view/plotter-export.ts`
  and open the problems dialog instead of saving, until T031, T032 and T033 are green.
  Depends on T031–T033, T036.

**Checkpoint**: The P1 stories are complete. This is the MVP of the slice: a Tape that can be cut
is exported as one true-size SVG; one that can't is explained Hole by Hole, and nothing is written.

---

## Phase 5: User Story 3 - The cutter cuts the holes first and the outline last (Priority: P2)

**Goal**: The Holes appear in the file from the Lead-in towards the end, row 1 first at the same
start, and the Tape Outline last (FR-012).

**Independent Test**: Export a reference Tape and check the order of the cuts in the file: Holes by
their start along the Tape, then the Tape Outline.

### Tests for User Story 3 ⚠️ (write first, must fail)

- [x] T038 [P] [US3] Extend `api/tape/tape-geometry.spec.ts` (data-model.md "Slot", research R5):
  `slots` holds "one per Hole whose Pipe is on the Organ, **in cut order**": "Order: by `start`,
  then by `row` (FR-012)". A Tape whose Holes are stored by Pipe, then start (rows 3, 1, 2 at
  mixed starts) gives Slots sorted by start; two Holes with the same start in rows 2 and 1 give
  row 1 first (Story 3.2); the row is the Pipe's position on the Organ, not its note number (a
  reordered Organ).
- [x] T039 [P] [US3] Extend `api/tape/plotter-svg.spec.ts` (Story 3.1, 3.2): for
  `plotterSvg(tapeGeometry(tape, organ))` of a Tape with Holes in several rows, the Hole paths
  appear by start from the Lead-in towards the end, row 1 first at the same start, and the
  Outline's path comes after the last Hole.
- [x] T040 [P] [US3] Extend `e2e/tape-export.spec.ts`: in the written file of a Tape with several
  rows, the Hole paths' x positions never decrease and the last path is the Outline
  (quickstart scenario 12).

### Implementation for User Story 3

- [x] T041 [US3] Sort the Slots in cut order in `api/tape/tape-geometry.ts` until T038, T039 and
  T040 are green; the Tape view iterates the same list and every view test stays green.
  Depends on T038–T040.

**Checkpoint**: US1–US3 green.

---

## Phase 6: User Story 4 - Use it in German or English (Priority: P3)

**Goal**: Every text of the slice, including the save dialog's title, the problems and the failed
save, is in German and English; the suggested file name is the Tape's name in either language.

**Independent Test**: Switch to German, export a Tape, try to export a Tape that can't be cut, and
check that no text is shown untranslated.

### Tests for User Story 4 ⚠️ (write first, must fail)

- [x] T042 [P] [US4] Extend `src/app/features/tape/tape-i18n.spec.ts`: every `ExportProblemCode`
  has a key `TAPE.EXPORT.PROBLEM.<CODE>` ("the code upper-cased, `-` as `_`") in `en.json` and
  `de.json`; every `TAPE.EXPORT.*` key has a German text that differs from the English one;
  `TAPE.VIEW.EXPORT_LATER` exists in neither file.
- [x] T043 [P] [US4] Extend `e2e/tape-export.spec.ts` (or `e2e/tape-german.spec.ts`) (Story 4.1,
  SC-007): with the app set to German, the replaced save dialog receives the German title and
  filter name, the saved and the failed snackbars and the problems dialog are German, no visible
  text matches a `TAPE.` key pattern, and the suggested file name is still `<Tape name>.svg`.

### Implementation for User Story 4

- [x] T044 [US4] Fill every missing or untranslated `TAPE.EXPORT.*` text in
  `src/assets/i18n/de.json` (and `en.json`) until T042 and T043 are green.

**Checkpoint**: all user stories green.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T045 [P] Check the changed files: `api/tape/tape-geometry.ts`, `export-problems.ts`,
  `plotter-svg.ts`, `plotter-file-name.ts` and `api/app/svg-save-request.ts` import nothing from
  Angular, Electron or Node; no `any`, no non-null assertions, no `console.*`; no i18n key is left
  unused (`npm run i18n:check` warnings).
- [x] T046 [P] Update `specs/003-punch-a-tape/data-model.md`, `quickstart.md` and the contracts
  where the implementation settled a detail (final i18n key names, the Tape view's drawn elements).
- [ ] T047 Run `npm run ux:screens` and the `ux-review` skill on the Tape view (Lead-in diagonal,
  end cut, enabled Export) and the problems dialog; turn every finding into a test+implementation
  task pair appended to this file.
- [x] T048 Run `npm run lint`, `npm run i18n:check`, `npm run test` and `npm run build`; all green.
- [x] T049 Run `npm run e2e`; the whole suite, including the 001 and 002 tests and
  `e2e/tape-layout.spec.ts`, is green.
- [ ] T050 Run the `spec-auditor` agent on the slice against `spec.md` and this file; fix every gap
  through a new test+implementation task pair appended to this file.
- [ ] T051 Through the `housekeeper` agent: update `documentation/STATUS.md` (slice done, next
  step), set "Punch a tape" to `done` in `documentation/ROADMAP.md`, and add the export under
  `[Unreleased]` in `CHANGELOG.md`.
- [ ] T052 Open a pull request (ADR 10) with `gh pr create`; the body has `Closes #3` and refs for
  any other issue touched. Squash-merge it with `gh pr merge --squash --delete-branch` once CI
  (e2e on Linux, Windows and macOS, ADR 13) is green.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: first.
- **Foundational (Phase 2)** depends on Setup and blocks every story:
  - Geometry: T002 → T003 → T004 → T005 → T006 → T007 → T008.
  - Hole limits: T009 → T010, alongside the geometry chain.
- **US1 (Phase 3)** depends on Phase 2 (T006 for the SVG writer, T008 for the view).
  - Domain: T011 → T021; T012 → T022; T013 → T023 (needs T021, T022).
  - Boundary: T014 → T024 (needs T023); T015, T016, T017 → T025 (needs T024).
  - Renderer: T018 → T026 (needs T025); T019, T020 → T027 (needs T026).
- **US2 (Phase 4)** depends on Phase 2 (T010) and on US1's `PlotterExport` and Export button
  (T026, T027) for T031–T033 and T037. T028 → T034 → T035 and T036 need only Phase 2.
- **US3 (Phase 5)** depends on US1 (the SVG writer and the e2e export, T022, T020).
- **US4 (Phase 6)** depends on US1 and US2 (all `TAPE.EXPORT.*` keys exist).
- **Polish** comes last.

### Within each story

Tests first, and they must fail for the expected reason. Implementation follows; each
test+implementation pair is one commit. The matching reviewer runs after each implementation
(`angular-reviewer` for `src/`, `electron-reviewer` for `app/` and the preload).

### Parallel opportunities

- **Foundational:** T009 → T010 alongside the geometry chain T002–T008.
- **US1:** the test tasks T011–T020 are independent files; the domain implementations T021 and
  T022 can run together.
- **US2:** T028–T033 are independent files; T034 needs only Phase 2.
- **US3:** T038–T040 together.
- **US4:** T042 and T043 together.
- Editing agents of one session run sequentially in the same working tree (AGENTS.md); [P] marks
  what may run in parallel across worktrees or for read-only reviewers.

## Parallel Example: User Story 1

```text
Task: "T011 plotterFileName unit test"
Task: "T012 plotterSvg unit test"
Task: "T013 parseSvgSaveRequest unit test"
Task: "T014 registerPlotterHandlers unit test"
Task: "T018 PlotterExport service test"
Task: "T020 e2e export to disk"
```

## Parallel Example: User Story 2

```text
Task: "T028 exportProblems unit test"
Task: "T029 inspectHole shares the export rules"
Task: "T030 problems dialog component test"
Task: "T033 e2e refused Tape writes nothing"
```

## Parallel Example: User Story 3

```text
Task: "T038 Slots in cut order"
Task: "T039 SVG paths in cut order"
Task: "T040 e2e cut order in the file"
```

## Parallel Example: User Story 4

```text
Task: "T042 TAPE.EXPORT key coverage test"
Task: "T043 e2e German export"
```

## Implementation Strategy

1. **Foundation first:** Phases 1–2. The geometry moves to `api/tape/` under green, switches to the
   tip frame, gains the end gap and the Tape Outline, and the Tape view draws the full Lead-in
   diagonal and the end cut from it (FR-008). The app keeps working after every task.
2. **MVP:** Phases 3–4 (US1 and US2, both P1): export a Tape to one true-size SVG, or be told
   which Holes can't be cut. Stop and validate in Electron (`npm run e2e`) and update STATUS.
3. **Then P2:** US3 (cut order: one sort in the geometry).
4. **Then P3:** US4 (German throughout).
5. **Finish:** Polish, the Definition of Done gate, the `spec-auditor` run, then the pull request
   with `Closes #3` and the squash-merge.
