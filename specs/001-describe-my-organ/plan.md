# Implementation Plan: Describe my organ

**Branch**: `001-describe-my-organ` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-describe-my-organ/spec.md`

## Summary

The user can define Organs: their Pipes, Tape Bed and Minimum Gap. Invalid Organs are never
stored, valid ones are stored when the user presses Save, and they survive a restart.

> Changed 2026-10-14 (MVP review): storing is explicit. The autosave effect was removed. Leaving
> with unsaved changes warns (FR-012a), and a change counts as saved only after the write succeeded.

- **Domain:** a pure TypeScript domain in `api/organ/` holds the rules (`validateOrgan`, note
  names, snapshot parser).
- **Renderer:** a signal store keeps the library in memory. A signal-form editor shows the
  domain violations next to each field.
- **Persistence:** the main process writes versioned, atomic, coalesced snapshots to `userData`
  over a typed preload API.
- **Cleanup:** the prototype organ feature, its localStorage persistence and `ElectronService`
  are replaced. This also fixes the current broken build.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node 22, Electron 42, Angular 21

**Primary Dependencies**: Angular Material 21, `@angular/forms/signals`, `@ngrx/signals` 21
(entities), `@ngx-translate` 17. No new runtime dependencies.

**Storage**: JSON snapshot `<userData>/snapshots/organs.json` (format version 1), written by the
main process (research R3)

**Testing**:
- Vitest 4 in a Node environment for `api/` and `app/` (new `vitest.node.config.ts`, R2).
- `ng test` (Vitest, Chromium) for `src/`.
- Playwright Electron e2e.

**Target Platform**: Electron desktop on Windows, macOS and Linux

**Project Type**: desktop app (Electron main process + Angular renderer + shared domain)

**Performance Goals**: editing an Organ with 100+ Pipes stays responsive. Validation runs on
every change in well under one frame for that size.

**Constraints**: offline. Never lose the last valid change: writes are coalesced and flushed on
quit. A damaged snapshot is never overwritten.

**Scale/Scope**: one user, a handful of Organs, about 100 Pipes each; 4 screens/dialogs (list,
editor, confirm-delete, confirm-leave).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Domain-driven slicing | The slice is named after a user capability. Persistence, IPC and UI are adapters inside it. All terms come from DICTIONARY (Organ, Pipe, Tape Bed, Minimum Gap, Minimum Hole Length); `rowSpacing` and `OrganDraft` are code names for "spacing between rows" and the editor state. | ✅ |
| II. TDD | Every task starts with a failing test: domain (Node Vitest), main process (Node Vitest with a temp folder), components (ng test), flows (Playwright). | ✅ |
| III. Framework-free domain | `api/organ/` has no Angular, Electron or Node imports and uses relative paths internally (R1). Types are branded, and invalid Organs can't be constructed. | ✅ |
| IV. Memory first, snapshots | The store is the in-memory truth. The snapshot is versioned, atomic, flushed on quit, and an unreadable file is moved aside (R3). | ✅ |
| V. Strict Electron boundary | `contextIsolation`, `sandbox`, no `nodeIntegration`; two allow-listed channels; payloads parsed in main; `window.require` removed (R4). | ✅ |
| VI. Context never lost | STATUS and ROADMAP are updated per task group. ADR 7 (test setup) and ADR 8 (snapshot write strategy) are recorded. | ✅ |
| VII. Small vertical slices | Usable end to end in Electron; the prototype is treated as a quarry (R10). | ✅ |
| UI / i18n | Angular Material, minimal SCSS; every key in en and de, checked by a parity test. | ✅ |

**Post-design re-check**: still passes. The design adds a second Vitest config. That is
tooling inside the existing test framework, not a new framework (see Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/001-describe-my-organ/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/organ-library-ipc.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
api/
├── index.ts                     # re-exports organ domain + IPC types
└── organ/                       # pure TS domain (relative imports only)
    ├── midi-note-number.ts      # brand, range check, noteName()
    ├── organ.ts                 # Organ, Pipe, TapeBed, OrganId, derived values
    ├── organ-draft.ts           # draft type + pure edit operations
    ├── validate-organ.ts        # validateOrgan → Result<Organ, OrganViolation[]>
    ├── organ-library-snapshot.ts# snapshot v1 types + parseOrganLibrarySnapshot
    ├── crancula-api.ts          # CranculaApi + load/save result types (IPC contract)
    └── *.spec.ts                # Node Vitest

app/
├── main.ts                      # window (contextIsolation, sandbox), userData override, handlers
├── preload.ts                   # contextBridge → window.crancula (type-only domain imports)
├── organ-library-file.ts        # load / coalesced atomic save / quarantine
└── *.spec.ts                    # Node Vitest (temp dirs)

src/app/
├── core/crancula-api.token.ts   # InjectionToken<CranculaApi> + in-memory fake for browser/tests
└── features/organ/
    ├── organ-library.store.ts   # signalStore: load/put/remove → save
    ├── organ-list/              # list page with delete
    ├── organ-editor/            # signal-form editor, violations → i18n, Save button (no autosave)
    ├── leave-invalid.guard.ts   # CanDeactivate confirm
    └── routes.ts

src/assets/i18n/{en,de}.json     # ORGAN.* keys; parity test in src/
e2e/organ.spec.ts                # Electron flows (CRANCULA_USER_DATA temp dir)
vitest.node.config.ts            # Node test project for api/ + app/
```

**Structure Decision**: Three layers, matching ADR 2 to 4:
- the shared domain in `api/`;
- the Electron adapter in `app/`;
- the Angular adapter in `src/`.

Removed: `api/model/*`, `src/app/core/services/electron/*`,
`src/app/features/shared/store-features/*`, and the prototype `src/app/features/organ/**`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| A second Vitest config (Node) next to `ng test` | Main-process file code and the domain need a Node environment | `ng test` runs only in the browser, so the snapshot file logic would stay untested |
