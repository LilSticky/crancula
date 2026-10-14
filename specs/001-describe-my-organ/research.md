# Research: Describe my organ

Each entry gives the decision, the reason for it, and the alternatives considered. All
"NEEDS CLARIFICATION" items from the technical context are resolved here.

## R1 Where the domain lives

- **Decision**: Put the Organ domain in `api/organ/` as pure TypeScript: `Organ`, `Pipe`,
  `TapeBed`, `MidiNoteNumber`, the validation rules, note names, and the snapshot format and
  parser. Files inside `api/` import each other with **relative paths**. The `@api/*` alias is
  only for consumers.
- **Rationale**:
  - ADR 2 requires a framework-free domain.
  - Both processes need it: the renderer for UI validation, the main process for validating
    snapshots and IPC payloads (ADR 4).
  - `app/` is compiled by plain `tsc` into CommonJS, which doesn't resolve path aliases, so
    domain files must not use `@api/...` internally.

  The existing `api/model/*` uses aliases internally, contradicts the dictionary, and is replaced.
- **Alternatives**:
  - `src/app/features/organ/domain`: the main process couldn't use it.
  - A separate npm workspace package: too heavy for now.

## R2 Running unit tests outside Angular

- **Decision**: Add a second Vitest configuration, `vitest.node.config.ts`, with `environment:
  'node'` for `api/**/*.spec.ts` and `app/**/*.spec.ts`. `npm run test` runs it and then
  `ng test`, and fails if either fails. `ng test` keeps covering `src/**/*.spec.ts` in Chromium.
- **Rationale**:
  - `ng test` (`@angular/build:unit-test`) runs in browser mode with `sourceRoot: src`. It can't
    test Node file-system code in the main process, and domain tests don't need a browser.
  - Plain Vitest 4 is already installed.
  - This also fixes the current "No tests found" failure as soon as the first domain spec
    exists.
- **Alternatives**:
  - Widen `ng test` to include `api/`: that still runs in a browser, so main-process code stays
    untestable.
  - Jest: a second test framework, which the constitution doesn't want.

## R3 Persistence: location, format, write timing (ADR 3)

- **Decision**:
  - **Location**: `<userData>/snapshots/organs.json` (location decided by the user on
    2026-10-13). An environment variable `CRANCULA_USER_DATA` overrides `userData`; the e2e tests
    use it.
  - **Format**: `{ "version": 1, "organs": [...] }`. `version` is the snapshot format version,
    and the parser rejects unknown versions.
  - **When it's written**: when the user presses Save on a valid Organ (only valid Organs ever
    get there; FR-012). The renderer then sends the full library snapshot over IPC.
    Changed 2026-10-14 (MVP review): this replaces writing on every change (autosave).
  - **How the main process writes**:
    - It coalesces writes: only the latest pending snapshot is written, at most one write runs at
      a time, and there is a short trailing debounce of about 250 ms.
    - It writes **atomically**: first to `organs.json.tmp`, then renames it over the real file.
    - On `before-quit` it flushes the pending write before quitting.
  - **Unreadable file on startup** (corrupt JSON, invalid content or unknown version): the main
    process renames it to `organs.unreadable-<timestamp>.json`, starts with an empty library, and
    returns the backup path so the UI can tell the user.
  - **Failed write**: the save reply is an error, and the UI shows a message. The in-memory state
    stays as it is. A change counts as saved only after the write succeeded (MVP review,
    2026-10-14).
- **Rationale**:
  - The library is small (a few organs with about 100 pipes), so writing the full snapshot is
    simple and robust.
  - Coalescing prevents write storms while typing (spec edge case), and the flush prevents losing
    the last change.
  - Atomic writes prevent half-written files.
  - Renaming the bad file keeps it untouched, as FR-014 and SC-004 require, and still lets the
    app run normally.
- **Alternatives**:
  - Write on quit only: changes are lost if the app crashes.
  - One file per organ: more files and more partial-failure cases, for no benefit at this size.
  - Read-only mode after a load failure: confusing, because the app would look as if it saves
    while nothing is persisted.

## R4 IPC boundary (ADR 4)

- **Decision**:
  - **Preload** (`app/preload.ts`) exposes `window.crancula` through `contextBridge` with two
    calls:
    - `organs.load(): Promise<OrganLibraryLoadResult>`
    - `organs.save(snapshot): Promise<OrganLibrarySaveResult>`
  - **Channels**: `organs:load` and `organs:save`. Each is registered with
    `ipcMain.handle`/`ipcRenderer.invoke` and is part of an allow-list.
  - **Validation**: the main process validates every incoming payload with the domain's snapshot
    parser before writing.
  - **Window settings**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  - **Preload imports**: the preload imports only `electron`. Domain imports there are
    type-only, so the sandboxed preload needs no bundling.
  - **Renderer side**: `ElectronService` and `window.require` are removed. Angular reaches the
    API through an `InjectionToken<CranculaApi>`. Its default factory uses `window.crancula`,
    and falls back to an in-memory fake when the app runs in the browser dev server or tests.
- **Rationale**: this is the smallest typed surface that fulfils ADR 4, it keeps tests free of
  Electron, and the dev server keeps working.
- **Alternatives**:
  - Generic `invoke(channel, payload)`: weaker typing, and the allow-list would be enforced only
    by convention.
  - Zod for validation: adds a dependency; hand-written parsers are enough for one aggregate.

## R5 State in the renderer

- **Decision**: An `OrganLibrary` store built with `signalStore` from `@ngrx/signals` and
  `withEntities<Organ>()`. It holds only **valid** domain `Organ`s.
  - Its methods (`load`, `put`, `remove`) update the state and then call `CranculaApi.save`.
  - `withStorageSync` (localStorage) and the generic CRUD/selected slices are dropped.
- **Rationale**:
  - The in-memory library is the truth (ADR 3), and Angular components react to its signals.
  - Keeping only valid Organs in it enforces FR-007 to FR-009 structurally.
  - Edits in progress live in the editor as an `OrganDraft`, so invalid states never reach the
    store.
- **Alternatives**:
  - A plain service with signals: also fine, but the entity helpers save code.
  - Keeping the old slices: they mix selection state into the library and don't fit the explicit
    Save model (changed 2026-10-14, MVP review).

## R6 Editor and validation

- **Decision**:
  - The editor works on an `OrganDraft`: every field can be empty or invalid, and Pipes are a
    list of MIDI note numbers or empty values.
  - The domain function `validateOrgan(draft): Result<Organ, OrganViolation[]>` is the **only**
    place where the rules live.
  - **Violations**: each one carries a code (e.g. `duplicate-pipe`, `pipes-exceed-tape-width`),
    the field path, and parameters such as needed and available mm. The UI maps the code to an
    i18n key `ORGAN.VIOLATION.<CODE>` and shows it next to the field.
  - **Signal forms**: Angular's signal forms (`@angular/forms/signals`) bind the draft. A single
    custom validator converts domain violations into field errors. Rules are not duplicated as
    built-in validators.
  - **Save** (changed 2026-10-14, MVP review; this replaces the former autosave effect): the editor
    has a Save button (`data-testid="save-organ"`). It is enabled only when the draft differs from
    the last saved Organ, is valid, and no write is running. A new Organ navigates to its page only
    after its first save. The saved draft becomes the new baseline.
  - **Leaving with unsaved changes** (FR-012a, changed 2026-10-14): a `CanDeactivate` guard warns.
    Valid unsaved changes show a dialog saying they aren't saved. Invalid unsaved changes list each
    broken rule with its field label; "Stay" is the default. "Discard changes" leaves and keeps the
    last saved version. The dialog reuses the confirm dialog from `@shared`.
- **Rationale**: one source of truth for the rules, which keeps them testable in plain Vitest and
  makes the UI and the main process agree.
- **Alternatives**: built-in signal-form validators for each rule. They would duplicate the
  domain logic, and cross-field rules (fit, overlap) are awkward to express with them.

- **Revised during implementation (2026-10-14; superseded below)**: the editor uses plain signals with `(input)`
  handlers instead of signal forms. In Angular 21, signal forms (experimental) can't bind a
  `number | null` model to number inputs, and array fields iterate as entries. Making the domain's
  `OrganDraft` fit that API would have bent the domain to a UI library. `validateOrgan` is still the
  single source of the rules. Inputs show a `displayed` copy of the draft, which follows it only on
  structural changes, so a number is never rewritten while it is being typed.

- **Revised after the Angular 22 update (2026-10-14)**: the editor uses signal forms again
  (`@angular/forms/signals`; stable since 22.0, only the WebMCP options are `@experimental`).
  - **What changed**: Angular 22 binds `number | null` model fields to number inputs (an empty
    input is `null`) and iterates arrays of objects as field trees whose identity follows the item.
    The unchanged `OrganDraft` is the form model; nothing is translated at the form boundary.
  - **One rule**: `organFormSchema` has a single `validateTree` that runs `validateOrgan` and
    targets each `OrganViolation` at the field its path names (`organ-form.ts`). No built-in
    validators duplicate the rules. Save and the leave guard read the form's validity and
    `errorSummary()`.
  - **Display**: Angular Material 22 asks the error state matcher about signal-form fields, so a
    small `ShownViolationMatcher` replaces the `crancErrorState` directive. A message about a
    missing value shows once its field is `dirty()` (the old "touched" path set), other
    violations show right away; "add a Pipe" waits for any edit.
  - **Pipes**: `@for (pipe of organ.pipes; track pipe)`; a Pipe's field state (dirty) moves with
    its item on reorder and is dropped on removal, so the manual path remapping is gone, and so
    is the `displayed` copy of the draft. The DOM is written only when the parsed number changes,
    so typing `3.50` keeps the text (e2e guard).
  - **Unreadable number text**: text a number input cannot parse (Chromium reports `badInput`, e.g.
    "1e") is a `parse` error of the field: the model keeps its previous value and the form is
    invalid. The editor shows "Enter a number." (`ORGAN.EDITOR.NOT_A_NUMBER`) next to the field right
    away and lists it in the leave dialog with the field's label, so a disabled Save always has a
    visible reason.

## R7 Note names

- **Decision**: Use scientific pitch notation with sharps: 60 → `C4`, 61 → `C#4`, 0 → `C-1`,
  127 → `G9`.
- **Rationale**: this matches the spec example (60 → C4) and the convention most MIDI tools use.
- **Alternatives**: flats, or locale-specific names (German "H"). These can be a display setting
  later.

## R8 Identity

- **Decision**: An `OrganId` is a branded string, created with `crypto.randomUUID()` when a valid
  Organ is first stored.
- **Rationale**: Organs are identified independently of their names (spec, Key Entities), and
  `crypto.randomUUID` exists in both Node and Chromium.

## R9 End-to-end testing

- **Decision**: The Playwright Electron tests launch with a fresh temporary `CRANCULA_USER_DATA`
  directory. They cover:
  - creating an Organ, restarting, and checking the Organ is unchanged;
  - deleting an Organ and checking it stays gone after a restart;
  - a corrupt `organs.json`, where the app starts, shows a message and leaves a backup file;
  - the German UI.
- **Rationale**: these are the spec's P1 flows and the constitution requires that the slice runs
  in Electron.

## R10 Prototype code

- **Decision**: The prototype organ feature is deleted and rebuilt:
  - `api/model/*`;
  - `src/app/features/organ/**`;
  - the generic store slices under `@shared/store-features`;
  - `ElectronService`.

  What is reused:
  - the confirm dialog;
  - the form-field wrappers, but only if they still compile cleanly against signal forms;
    otherwise they are replaced by plain `mat-form-field`;
  - the navbar route model;
  - the existing i18n keys, where they fit.

  `Tape`, `Hole` and `Song` sketches in `api/model` are removed. Later slices recreate them from
  the dictionary.
- **Rationale**: the constitution treats this code as a quarry, and the broken build (see STATUS)
  comes entirely from it.
