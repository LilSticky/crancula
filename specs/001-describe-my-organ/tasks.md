---

description: "Tasks for 001 Describe my organ"
---

# Tasks: Describe my organ

**Input**: Design documents from `/specs/001-describe-my-organ/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/organ-library-ipc.md](contracts/organ-library-ipc.md),
[quickstart.md](quickstart.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task has a test
task before it, and that test must fail before you implement. Follow the `tdd` skill.

**Organization**: Tasks are grouped by user story so that each story can be implemented and tested
on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- **Commits**: one small conventional commit per task (or per test+implementation pair), pushed
  to `001-describe-my-organ`. Update `documentation/STATUS.md` at each checkpoint.

## Path conventions

- **`api/organ/`**: pure TypeScript domain. Relative imports only; no Angular, Electron or Node
  imports (ADR 2, 7).
- **`app/`**: Electron main process and preload. Tested with Node Vitest
  (`vitest.node.config.ts`).
- **`src/app/`**: Angular renderer. Tested with `ng test`.
- **`e2e/`**: Playwright Electron tests.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Get a compiling baseline and a test setup that can actually run tests.

- [X] T001 Delete the prototype code that the plan replaces (research R10), and remove its
  references from `src/app.routes.ts`, `src/app/core/core.module.ts`,
  `src/app/core/services/index.ts` and `src/app/shared/shared.module.ts`. Delete:
  - `api/model/` and the matching exports in `api/index.ts`;
  - `src/app/features/organ/`;
  - `src/app/features/shared/store-features/`;
  - `src/app/core/services/electron/`.

  Keep `src/app/features/shared/components/confirm-dialog/`. Then `npm run build` and
  `npm run lint` must pass. Commit as `refactor: remove prototype organ feature`.
- [X] T002 Add `vitest.node.config.ts` at the repository root:
  - `environment: 'node'`;
  - `include: ['api/**/*.spec.ts', 'app/**/*.spec.ts']`.

  In `package.json`:
  - add the script `test:node` (`vitest run -c vitest.node.config.ts`);
  - change `test` to run `test:node` and then `ng test --watch=false`, failing if either fails;
  - add `test:node:watch`.

  Exclude `api/**/*.spec.ts` and `app/**/*.spec.ts` from `src/tsconfig.spec.json` and
  `tsconfig.serve.json` (ADR 7).
- [X] T003 [P] Write the i18n parity test in `src/app/i18n-parity.spec.ts`. It asserts that
  `src/assets/i18n/en.json` and `src/assets/i18n/de.json` have identical sets of nested keys,
  and fix any keys that differ. This gives `ng test` its first test, so the "No tests found" error
  goes away.
- [X] T004 [P] Add `app/preload.ts` to the `files` of `tsconfig.serve.json`. Remove
  `experimentalDecorators` and `emitDecoratorMetadata`, which the main process doesn't need.

**Checkpoint**: `npm run lint`, `npm run build` and `npm run test` all run. Each test command may
report zero tests, but none of them errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The domain, the snapshot file, the IPC boundary and the renderer store. All user
stories need them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Domain (`api/organ/`, Node Vitest)

- [X] T005 [P] Write the failing test `api/organ/midi-note-number.spec.ts`, then implement
  `api/organ/midi-note-number.ts`:
  - **Type:** branded `MidiNoteNumber`, an "integer 0–127".
  - **Constructor:** `midiNoteNumber(n): MidiNoteNumber | undefined`.
  - **Note names:** `noteName(note)` uses sharps: 60 → `C4`, 61 → `C#4`, 0 → `C-1`,
    127 → `G9` (R7).
- [X] T006 [P] Write the failing test `api/organ/organ.spec.ts`, then implement
  `api/organ/organ.ts`:
  - **Types:**
    - `OrganId`: branded non-empty UUID string.
    - `Millimetres`: branded, "finite, ≥ 0".
    - `TapeBed`: `{ tapeWidth, border, holeDiameter, rowSpacing }`.
    - `Pipe`: `{ note: MidiNoteNumber }`.
    - `Organ`: `{ id, name, tapeBed, minimumGap, pipes: readonly Pipe[] }`.
  - **Derived functions:**
    - `minimumHoleLength(organ) = tapeBed.holeDiameter` (FR-010).
    - `requiredTapeWidth(tapeBed, pipeCount) = 2 × border + (pipeCount − 1) × rowSpacing +
      holeDiameter` (FR-008).

  Valid `Organ`s must only be obtainable through `validateOrgan` or the snapshot parser. Use
  the brands and a non-exported constructor.
- [X] T007 [P] Write the failing test `api/organ/organ-draft.spec.ts`, then implement
  `api/organ/organ-draft.ts`.
  - **`OrganDraft`:**
    - numbers are `number | null`;
    - the name is a raw string;
    - `id?`;
    - `pipes: { note: number | null }[]`.
  - **Functions:** `emptyOrganDraft()`, `toDraft(organ)` and the pure operations
    `addPipe(draft)`, `removePipe(draft, row)` and `movePipe(draft, fromRow, toRow)`.
  - **Rules:**
    - `addPipe` adds an empty Pipe as the last row.
    - `movePipe` throws `RangeError` if a row is out of bounds.
    - Rows are always contiguous.
- [X] T008 Write the failing test `api/organ/validate-organ.spec.ts`, then implement
  `api/organ/validate-organ.ts` with `validateOrgan(draft): Result<Organ, OrganViolation[]>`.
  - It returns **all** violations, never stopping at the first one.
  - It trims the name and assigns a new `OrganId` with `crypto.randomUUID()` if `draft.id` is
    absent.
  - It must cover every code in the data-model table, each with its field path and parameters:
    - `name-required`
    - `pipes-required`
    - `pipe-note-required`
    - `pipe-note-out-of-range`
    - `duplicate-pipe`: one violation per affected Pipe
    - `value-required`
    - `must-be-positive`: tapeWidth, holeDiameter, rowSpacing, minimumGap
    - `must-not-be-negative`: border
    - `row-spacing-below-hole-diameter`
    - `pipes-exceed-tape-width`: params `requiredWidth`, `availableWidth`

  Depends on T005 to T007.
- [X] T009 Write the failing test `api/organ/organ-library-snapshot.spec.ts`, then implement
  `api/organ/organ-library-snapshot.ts` (contract):
  - `OrganLibrarySnapshot` is `{ version: 1, organs: OrganSnapshot[] }`.
  - `toSnapshot(organs)`.
  - `parseOrganLibrarySnapshot(unknown): Result<Organ[], string>`. It rejects:
    - a wrong shape;
    - `version !== 1`;
    - duplicate ids;
    - any Organ that fails `validateOrgan`.

  Depends on T008.
- [X] T010 [P] Create `api/organ/crancula-api.ts` with `CranculaApi`, `OrganLibraryLoadResult`
  (`loaded | empty | unreadable{backupPath, reason}`) and `OrganLibrarySaveResult`
  (`saved | rejected{reason} | failed{reason}`), exactly as in the contract. Re-export the organ
  domain and the API types from `api/index.ts`. Add a type-level spec in
  `api/organ/crancula-api.spec.ts` with `expectTypeOf`.

### Electron main process and preload (`app/`, Node Vitest + e2e)

- [X] T011 Write the failing test `app/organ-library-file.spec.ts` (temporary directories), then
  implement `app/organ-library-file.ts` with `createOrganLibraryFile(dir, { debounceMs })`, which
  offers `load()`, `save(snapshot)` and `flush()`:
  - **No file:** `load` returns `empty`.
  - **Valid file:** `load` returns `loaded`.
  - **Invalid file** (bad JSON, failed validation or unknown version): the file is renamed to
    `organs.unreadable-<ISO timestamp>.json`, its bytes stay unchanged, and `load` returns
    `unreadable`.
  - **Saving:**
    - `save` validates the payload with `parseOrganLibrarySnapshot` and returns `rejected`
      without writing if it fails;
    - writes are coalesced: the latest snapshot wins, one write runs at a time, with a trailing
      ~250 ms debounce;
    - each write goes to `organs.json.tmp` and is then renamed over the real file;
    - an I/O error returns `failed` and leaves the old file intact;
    - `flush` awaits any pending write.

  Depends on T009 (ADR 8).
- [X] T012 Write the failing test `app/organ-library-ipc.spec.ts` (fake `ipcMain`), then implement
  `app/organ-library-ipc.ts` with `registerOrganLibraryHandlers(ipcMain, file)`. It handles
  exactly the channels `organs:load` and `organs:save` (the allow-list constant
  `ORGAN_LIBRARY_CHANNELS`). Depends on T011.
- [X] T013 Write the failing e2e test `e2e/boundary.spec.ts`. In the window:
  - `typeof window.require === 'undefined'`;
  - `window.crancula.organs.load` is a function;
  - calling it with a fresh `CRANCULA_USER_DATA` returns `{ status: 'empty' }`.

  Then implement:
  - **`app/preload.ts`:** `contextBridge.exposeInMainWorld('crancula', …)` using
    `ipcRenderer.invoke` for the two channels. Only type imports from `../api`.
  - **`app/main.ts`:**
    - `webPreferences: { preload, contextIsolation: true, nodeIntegration: false, sandbox: true }`;
    - `app.setPath('userData', process.env.CRANCULA_USER_DATA)` when that is set;
    - create the file store in `<userData>/snapshots`;
    - register the handlers;
    - on `before-quit`, call `preventDefault`, then flush and quit.

  Create `e2e/support/launch-app.ts` (a helper that starts Electron with a temporary
  `CRANCULA_USER_DATA` and returns the app, the window and the folder), and migrate
  `e2e/main.spec.ts` to it. Depends on T012.

### Renderer adapter (`src/app/`, ng test)

- [X] T014 [P] Write the failing test `src/app/core/crancula-api.token.spec.ts`, then implement
  `src/app/core/crancula-api.token.ts`:
  - `CRANCULA_API: InjectionToken<CranculaApi>`, whose factory returns `window.crancula` if it
    exists and `createInMemoryCranculaApi()` otherwise;
  - `createInMemoryCranculaApi(initial?)`, an in-memory fake implementing the contract for tests
    and the browser dev server.

  Declare `window.crancula` in `src/model/window.d.ts`.
- [X] T015 Write the failing test `src/app/features/organ/organ-library.store.spec.ts`, then
  implement `src/app/features/organ/organ-library.store.ts`:
  - It's a `signalStore` with `withEntities<Organ>()` that holds only valid Organs.
  - `load()` calls `CRANCULA_API.organs.load`, fills the entities, and sets a `loadProblem` signal
    to `{ backupPath }` on `unreadable`.
  - `put(organ)` and `remove(id)` update the state and then call `organs.save(toSnapshot(all))`;
    on `failed` or `rejected`, a `saveProblem` signal is set.
  - It provides `provideAppInitializer(() => inject(OrganLibrary).load())`.

  Depends on T009, T014.

**Checkpoint**: domain, file store, IPC and store are green under `npm run test`; `e2e/boundary`
is green under `npm run e2e`.

---

## Phase 3: User Story 1 - Define my organ (Priority: P1) 🎯 MVP

**Goal**: Create an Organ with a name, Tape Bed, Minimum Gap and Pipes. It is stored
automatically once valid and appears in the Organ list.

**Independent Test**: Start with no Organs, create "Street organ" (31 Pipes) and see it in the
list with its details. Pipe 60 shows "C4".

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T016 [P] [US1] Write the component test `src/app/features/organ/organ-list/organ-list.component.spec.ts`:
  - it shows an empty-state text when there are no Organs;
  - it lists Organs by name with their Pipe count;
  - the "New Organ" action navigates to `/organs/new`.
- [X] T017 [P] [US1] Write the component test `src/app/features/organ/organ-editor/organ-editor.component.spec.ts`:
  - **Fields:** name, tape width, border, hole diameter, row spacing and Minimum Gap.
  - **Minimum Hole Length:** shown, read-only, equal to the hole diameter.
  - **Pipes:** "add Pipe" appends a row; each row shows its note name (60 → C4).
  - **Autosave:** once the draft is valid, `OrganLibrary.put` is called and the route changes to
    `/organs/<id>`. While it is invalid, `put` is not called.
- [X] T018 [P] [US1] Write the e2e test `e2e/organ-define.spec.ts`: with a fresh `userData`,
  create "Street organ" using the quickstart values (tape width 120, border 5, hole diameter 2.5,
  row spacing 3.5, Minimum Gap 1.5, 31 Pipes from note 53). It appears in the Organ list.

### Implementation for User Story 1

- [X] T019 [US1] Implement `src/app/features/organ/organ-list/organ-list.component.ts` (and
  `.html`): standalone, OnPush, Material list or table, reading `OrganLibrary`.
- [X] T020 [US1] Implement `src/app/features/organ/organ-editor/organ-editor.component.ts` (and
  `.html`):
  - **Form:** standalone, OnPush. A signal form (`form()` from `@angular/forms/signals`) over an
    `OrganDraft` signal. Material inputs, `type=number`, decimals allowed.
  - **Pipes:** each Pipe row has a note-number input with its note name next to it.
  - **Autosave:** an `effect` runs `validateOrgan` and calls `OrganLibrary.put` when the result is
    ok and differs from the stored Organ (FR-012). For a new draft it then navigates to
    `/organs/<id>`.
- [X] T021 [US1] Add `src/app/features/organ/routes.ts` (`/organs`, `/organs/new`,
  `/organs/:id`; an unknown id redirects to `/organs`) and register it in `src/app.routes.ts`,
  with a navbar entry through the existing `CranculaRoute` data.
- [X] T022 [P] [US1] Add the `ORGAN.*` labels used in US1 to `src/assets/i18n/en.json` and
  `src/assets/i18n/de.json`; the parity test from T003 must stay green.

**Checkpoint**: US1 works in Electron; T016–T018 are green.

---

## Phase 4: User Story 2 - Only valid Organs are stored (Priority: P1)

**Goal**: Each broken rule is shown next to its field in the user's language, and invalid
Organs are never stored.

**Independent Test**: Break exactly one rule at a time: nothing is stored and a message names the
problem. Fix it and the Organ is stored.

### Tests for User Story 2 ⚠️

- [X] T023 [P] [US2] Extend `src/app/features/organ/organ-editor/organ-editor.component.spec.ts`.
  For each violation code from the data-model table, the matching
  `ORGAN.VIOLATION.<CODE_IN_UPPER_SNAKE>` message is shown at its field. Also check:
  - a duplicate marks **both** Pipes;
  - `pipes-exceed-tape-width` shows the required and available width;
  - while the draft is invalid, `put` is not called;
  - editing a stored Organ into an invalid state and back stores only the fixed version.

### Implementation for User Story 2

- [X] T024 [US2] In the editor, map the domain violations to signal-form field errors with **one**
  custom validator that calls `validateOrgan` (R6, no duplicated rules), and render them with
  `mat-error` and `translate`, passing the parameters.
- [X] T025 [P] [US2] Add all `ORGAN.VIOLATION.*` keys, with parameters, to `en.json` and `de.json`.

**Checkpoint**: US1 and US2 green. SC-002 is covered by T023.

---

## Phase 5: User Story 3 - My organs are still there after a restart (Priority: P1)

**Goal**: Organs survive a restart. An unreadable snapshot is reported and never overwritten.

**Independent Test**: Create an Organ, restart, and compare. Corrupt the snapshot, start, and see
the message and the untouched backup.

### Tests for User Story 3 ⚠️

- [X] T026 [P] [US3] Write the e2e test `e2e/organ-restart.spec.ts`:
  - create an Organ, close the app, relaunch it with the same `CRANCULA_USER_DATA`, and check that
    all values and the Pipe order are identical (SC-003);
  - write `{oops` to `<userData>/snapshots/organs.json`, launch, and check that a "couldn't be
    loaded" message is visible, the app is usable, and `organs.unreadable-*.json` contains exactly
    `{oops` (SC-004).
- [X] T027 [P] [US3] Write the component test `src/app/app.component.spec.ts`: a load problem or
  save problem in `OrganLibrary` shows a Material snackbar with the translated message, including
  the backup path for load problems.

### Implementation for User Story 3

- [X] T028 [US3] Show `OrganLibrary.loadProblem` and `saveProblem` from `src/app/app.component.ts`
  with `MatSnackBar`. Add the `ORGAN.STORAGE.*` keys to `en.json` and `de.json`.

**Checkpoint**: The P1 stories are complete. This is the MVP of the slice.

---

## Phase 6: User Story 4 - Change or remove an organ (Priority: P2)

**Goal**: Reorder and remove Pipes, delete Organs with confirmation, and confirm before leaving
with invalid changes.

**Independent Test**: Move the last Pipe to the first row, remove a Pipe, change the tape width,
restart and check; then delete with cancel and with confirm.

### Tests for User Story 4 ⚠️

- [x] T029 [P] [US4] Extend the editor spec:
  - "move up" and "move down" buttons and drag-and-drop reorder the rows, with move-up disabled on
    the first row and move-down disabled on the last;
  - "remove" deletes a row and keeps the rest contiguous;
  - the result is stored.
- [x] T030 [P] [US4] Write the guard test `src/app/features/organ/leave-invalid.guard.spec.ts`:
  - leaving with a valid or unchanged draft is allowed without a dialog;
  - leaving with an invalid draft opens the confirm dialog;
  - **cancel** stays on the page;
  - **confirm** leaves, and the last stored version is unchanged.
- [x] T031 [P] [US4] Extend the list spec: "delete" opens the confirm dialog; cancel changes
  nothing; confirm calls `OrganLibrary.remove`.
- [x] T032 [P] [US4] Write the e2e test `e2e/organ-edit.spec.ts`:
  - reorder and remove Pipes, then restart, and the order is kept;
  - delete an Organ, then restart, and it is gone.

### Implementation for User Story 4

- [x] T033 [US4] Add reorder and remove controls to the editor: Material icon buttons plus
  `cdkDropList`, using `movePipe` and `removePipe` from `api/organ/organ-draft.ts`.
- [x] T034 [US4] Implement `src/app/features/organ/leave-invalid.guard.ts` (`CanDeactivateFn`),
  reusing `src/app/features/shared/components/confirm-dialog/`, and wire it into
  `src/app/features/organ/routes.ts`.
- [x] T035 [US4] Add delete with a confirm dialog to the Organ list and the editor, then navigate
  to `/organs`. Add the i18n keys to `en.json` and `de.json`.

**Checkpoint**: US1 to US4 green.

---

## Phase 7: User Story 5 - Use Crancula in German or English (Priority: P3)

**Goal**: Every text of the feature is available in German and English, and the user can switch
the language.

**Independent Test**: Switch to German and go through US1 and US2. No text shows a raw
translation key.

### Tests for User Story 5 ⚠️

- [x] T036 [P] [US5] Write the component test `src/app/features/navbar/navbar.component.spec.ts`:
  the language switch toggles `TranslateService` between `en` and `de`, and the choice is
  remembered across restarts.
- [x] T037 [P] [US5] Write the e2e test `e2e/organ-german.spec.ts`: switch to German, create an
  Organ, and trigger `pipes-exceed-tape-width` and `duplicate-pipe`. The visible texts contain no
  `ORGAN.` key patterns, and the messages are German (SC-005).

### Implementation for User Story 5

- [x] T038 [US5] Add a language switch (Material button toggle or menu) to
  `src/app/features/navbar/navbar.component.ts`. Remember the choice in a small snapshot, or in
  `localStorage` as a UI preference.

  If you store it as a snapshot, follow ADR 8 and add a `settings` channel. Otherwise, write an
  ADR explaining why a UI preference may use `localStorage`.

---

## Phase 8: Polish & Cross-Cutting Concerns

(Phase 9 comes from the MVP review and runs before T041/T042.)

- [x] T039 Remove i18n keys that nothing uses any more from both language files, and check that
  the parity test is green.
- [x] T040 Remove `withStorageSync`/`@angular-architects/ngrx-toolkit` from `package.json` if they
  are no longer used, and check for `any`, non-null assertions and `console.*` leftovers in the
  changed files.
- [x] T041 ~~Run the [quickstart](quickstart.md) walkthrough in Electron~~. Replaced by the e2e
  suite in CI on Linux, Windows and macOS (ADR 13, 2026-10-14).
- [x] T042 Run the Definition of Done gate: `npm run lint`, `npm run test`, `npm run build`,
  `npm run e2e`. Then:
  - update `documentation/STATUS.md`: clear the fixed "Known broken" items;
  - set "Describe my organ" to `done` in `documentation/ROADMAP.md`;
  - open a pull request (ADR 10) with `Closes #1` and `Closes #N` for each fixed "Known broken"
    issue (#4–#8), and squash-merge it once CI is green.

---

## Phase 9: Review changes (2026-10-14)

**Goal**: Save is explicit (FR-012), leaving with unsaved changes warns and lists what to fix
(FR-012a), and the application menu follows the language switch (FR-016).

### Explicit Save and the leave warning

- [x] T043 [US1] Extend `organ-editor.component.spec.ts`:
  - a valid change is **not** stored until `save` is pressed; then it is stored;
  - the Save button is disabled when unchanged, disabled when invalid, enabled when changed and
    valid, and disabled again after saving;
  - a new Organ navigates to `/organs/<id>` only after its first save;
  - replace the specs that relied on autosave so that they press Save.
- [x] T044 [US4] Rewrite `leave-invalid.guard.spec.ts` as `leave-unsaved.guard.spec.ts`:
  - no unsaved changes → leave without a dialog;
  - valid unsaved changes → dialog says they aren't saved; "stay" stays, "discard" leaves;
  - invalid unsaved changes → dialog lists each broken rule with its field label (e.g.
    "Row 3 · MIDI note: Another Pipe already plays C4."); "stay" is the default;
  - after discarding, the last saved version is unchanged.
- [x] T045 [US1] Implement: remove the autosave effect, add a Save button
  (`data-testid="save-organ"`, `matButton="filled"`), keep the saved draft as the new baseline,
  and expose `unsavedChanges(): {invalid: readonly ViolationMessage[]} | {invalid: []} | null`
  (or a similar typed result) for the guard.
- [x] T046 [US4] Implement `leave-unsaved.guard.ts` and a `LeaveUnsavedDialogComponent` (Material
  dialog, "Stay and fix"/"Stay" default focus, "Discard changes" warn). Wire it into
  `routes.ts`, and add the i18n keys to `en.json` and `de.json`.
- [x] T047 [US1] Update the e2e tests that create or edit Organs (`organ-define`, `organ-edit`,
  `organ-restart`, `organ-german`, `e2e/support/organ-editor.ts`) to press Save, and add a
  scenario: leaving with invalid changes shows the listed problems.

### The application menu follows the language

- [x] T048 [US5] Node test `app/application-menu.spec.ts`: `menuTemplate(language)` builds the
  menu from the en/de JSON files with translated labels (File, Edit, View, Window, Help and their
  items), and an unknown language falls back to English.
- [x] T049 [US5] Node test for a new allow-listed channel `app:set-language`: the handler accepts
  only `'en' | 'de'` and rebuilds the menu; anything else is rejected. Extend
  `api/organ/crancula-api.ts` (or a new `api/app/`) with `setLanguage(language)`.
- [x] T050 [US5] Implement `app/application-menu.ts`, the IPC handler and the preload method; the
  navbar calls `setLanguage` on start and on every switch. Add the `MENU.*` keys to both language
  files. Extend `e2e/organ-german.spec.ts`: after switching to German, the menu labels are German.
- [x] T051 Update `quickstart.md`, `plan.md` (no autosave) and research R6/R-autosave notes to the
  new save model.

**Checkpoint**: all user stories green with explicit Save; then T041 and T042.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** comes first. T001 is required for a compiling baseline.
- **Foundational (Phase 2)** depends on Setup:
  - T005–T007 can run in parallel, then T008 and T009 follow in that order;
  - T011 → T012 → T013 is the main-process chain;
  - T014 → T015 is the renderer chain.
- **US1** depends on Phase 2.
- **US2, US3 and US4** depend on US1, because they share the editor and the list.
- **US5** depends on US1 and US2 (texts and messages).
- **Polish** comes last.

### Within each story

The tests are written first and must fail. Implementation follows, and each test+implementation
pair is committed.

### Parallel opportunities

- **Setup:** T003 and T004.
- **Domain:** T005, T006, T007 and T010.
- **Renderer token:** T014, alongside the main-process chain.
- **Within a story:** all of its test tasks marked [P], for example T016–T018 or T029–T032.

## Parallel Example: User Story 1

```text
Task: "T016 organ-list component test"
Task: "T017 organ-editor component test"
Task: "T018 e2e organ-define test"
```

## Implementation Strategy

1. **MVP:** Phases 1–5 (US1 to US3, all P1). An Organ can be defined, it is valid, and it is
   persistent. Validate in Electron.
2. **Then:** US4 (editing and deleting) and US5 (language switch).
3. **Finish:** Polish and the DoD gate, then squash-merge through a pull request.

## Amendment: derived Border ([#74](https://github.com/LilSticky/crancula/issues/74), 2026-10-15)

User decisions: the Border is no longer entered. Rows are centred across the Tape, row 1 nearest the
top edge; Border = (tape width − Row Span) / 2, Row Span = (Pipes − 1) × spacing between rows + hole
diameter. A Border of 0 is valid, a negative one is not ("rows don't fit"). The editor shows the
derived Border read-only. Dictionary: Tape Bed, Border, Row Span. Every Organ valid before stays
valid (old rule 2·border + span ≤ width implies span ≤ width).

- [x] **A1** ADR 20 "Snapshots are migrated on read and written in the newest version" (`adr` skill):
  which old versions are read, the newest is written on the next save, a downgrade moves the file
  aside (ADR 8). Applies to Organ and Tape snapshots.
- [x] **A2** Domain (`api/organ/organ.ts`): unit tests first. `rowSpan(tapeBed, pipeCount)`;
  `border(organ)` (6.25 mm for the street organ 120 / 2.5 / 3.5, 31 Pipes; 0 when the rows fill the
  width); `TapeBed` without `border`; `requiredTapeWidth` goes. Export via `api/index.ts`.
- [x] **A3** Draft and validation (`organ-draft.ts`, `validate-organ.ts`): tests first. No `border`
  in the draft; "pipes exceed tape width" compares the Row Span with the tape width (boundary
  107.5 mm for the street organ, equal is valid); the non-negative bound and
  `ORGAN.VIOLATION.MUST_NOT_BE_NEGATIVE` (en + de) go if unused.
- [x] **A4** A domain value the editor can show for a draft (may be negative), e.g.
  `tapeBedFit(tapeBed, pipeCount) → {rowSpan, border}`; unit tests.
- [x] **A5** Organ snapshot version 2 (`organ-library-snapshot.ts`): tests first. Version 1 with a
  `border` (also one that no longer matches) reads, the border is ignored; version 2 has no
  `border`; `toSnapshot` writes version 2; other versions are rejected as before.
- [x] **A6** Fix the remaining fixtures that set `border` (`api/tape/*.spec.ts`,
  `app/organ-library-file.spec.ts`, `src/testing/organs.ts` and Angular specs). Tests stay green.
- [x] **A7** Organ editor: component tests first. No Border input; the derived Border shown
  read-only ("6,25 mm" in German, "6.25 mm" in English), absent while a value is missing; labels
  and violations without `tapeBed.border`. en/de parity.
- [ ] **A8** e2e: update helpers and tests that fill the Border (`e2e/support/*`, organ and tape
  specs); one e2e that an Organ saved in version 1 with a border loads after a restart and is
  saved again as version 2. Full `npm run e2e`.
- [ ] **A9** Docs: spec.md (FR-002, FR-007, FR-008, FR-013, Key Entities, row layout assumption),
  data-model.md, contracts/organ-library-ipc.md, quickstart.md, DESIGN-GUIDE fit check sentence
  and examples that name the Border, CHANGELOG `[Unreleased]` (Border derived; downgrade note),
  STATUS.
