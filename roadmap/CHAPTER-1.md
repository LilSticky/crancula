# Chapter 1: Foundation & Organ Management

**Goal**: Solidify project foundation, complete Organ CRUD UI, establish patterns.

## Domain Model (api/model/)
- [x] `Organ` class (`api/model/organ.ts`) — has `id`, `name`, `pipes`
- [x] `Pipe` class (`api/model/pipe.ts`) — has `id`, `pitch`, `name`
- [ ] Add tape-physics properties to `Organ`: tapeWidthMm, holeDiameterMm, rowsPerInch, feedPerRevolutionMm, sprocketHoleSpacingMm
- [ ] Add display properties to `Organ`: color, notes
- [ ] Add `Hole` model — pipeIndex, startColumn, length
- [ ] Add `Tape` model — organId, songId, holes[], grid columns/rows metadata
- [ ] Add `Song` model — title, notes[] (pitch, startTime, duration), source format

## Store Pattern (src/app/features/shared/store-features/)
- [x] `withCrud` slice — `createEntity`, `updateEntity` (replace), `_deleteEntity`
- [x] `withKnownId` slice — `_isKnown(id)`
- [x] `withLoading` slice — `isLoading`, `setLoading`
- [x] `withSelected` slice — `selectedEntity`, `selectEntity`, `selectNewEntity`, `_isSelectable`, `_isSelected`
- [x] `withSelectedEntityModule` — composes all slices into one feature
- [x] `withStorageSync` (from `@angular-architects/ngrx-toolkit`) — auto-syncs to localStorage
- [ ] Add `withLocalStorage` wrapper that uses `DataStore` interface for consistency
- [ ] Add `withElectronStore` variant (IPC-based persistence) as future alternative

## Data Persistence (api/ + app/)
- [x] `DataStore<T>` interface (`api/index.ts`) — `get()`, `set()`
- [x] `OrganStorage` class (`src/app/core/services/storage/organ-storage.ts`) — implements `DataStore<Organ>` via localStorage (orphaned, not wired)
- [ ] Remove orphaned `OrganStorage` or wire it into the OrganStore
- [x] `ElectronService` (`src/app/core/services/electron/electron.service.ts`) — provides ipcRenderer, fs access
- [ ] Create preload script (`app/preload.ts`) with contextBridge API for organ CRUD
- [ ] Register `ipcMain.handle` channels in `app/main.ts` for organ CRUD (read/write JSON file)
- [ ] Wire up Electron IPC persistence as the primary store backend (fall back to localStorage in browser dev mode)
- [ ] Add `TapeStorage` implementing `DataStore<Tape>`
- [ ] Add `SongStorage` implementing `DataStore<Song>`

## Organ Feature — Pages & Routing
- [x] `routes.ts` — defines `/organ` (OrgansPage) and `/organ/:id` (OrganPage)
- [x] `OrgansPage` (organ/pages/organ/list/organs.page.ts) — list wrapper, handles add/select
- [x] `OrganPage` (organ/pages/organ/id/organ.page.ts) — detail wrapper, reads `:id`, renders form, handles save
- [ ] Add route for `/organ/new` as an alias for creating a new organ (currently uses `selectNewEntity` in code)
- [ ] Add route data for Organ pages (title translations, navbar hints)

## Organ Feature — List View
- [x] `OrganListComponent` (organ/components/organ-list/) — Material table: name, pipe count, edit button
- [x] `addNewOrgan` output — emits when footer "add" clicked
- [x] `selectOrgan` output — emits row organ id
- [ ] Add **delete button** per row (with confirmation dialog)
- [ ] Show Organ tape-physics summary in list (tape width, hole count summary)

## Organ Feature — Form / Editor
- [x] `OrganFormComponent` (organ/components/organ-form/) — form for name + pipes
- [x] `PipesFormComponent` (organ/components/organ-form/pipes-form/) — pipe list editor (name, pitch per pipe)
- [ ] Add tape-physics fields to `OrganFormComponent` (expandable "Tape Settings" section)
- [ ] Add validation: pipe pitch range, tape width limits, at least 1 pipe
- [ ] Add **unsaved changes guard** (prevent navigating away with dirty form)

## Reusable UI Components (src/app/features/shared/components/)
- [x] `TextFormFieldComponent` (`<cranc-text-form-field>`) — wraps MatInput for text
- [x] `NumberFormFieldComponent` (`<cranc-number-form-field>`) — wraps MatInput for numbers
- [ ] Add `SelectFormFieldComponent` (`<cranc-select-form-field>`) — wraps MatSelect for enums/lookups
- [ ] Add `ConfirmDialogComponent` — reusable confirmation dialog for delete actions

## Store Implementation (src/app/features/organ/store/)
- [x] `OrganStore` — uses `withSelectedEntityModule<Organ>()` + `withStorageSync('organs')`
- [ ] Expose `deleteEntity` publicly (currently `_deleteEntity` is private, not called from UI)
- [ ] Add loading/error state handling (withLoading already exists but not used by Organ store)
- [ ] Add undo support for destructive actions

## Testing
- [ ] Unit tests for `Organ` model construction and tape properties
- [ ] Unit tests for `OrganStore` (create, update, delete, select)
- [ ] Unit tests for `OrganFormComponent` (form validity, save emission)
- [ ] Unit tests for `PipesFormComponent` (add/remove pipes, field binding)
- [ ] Unit tests for `OrganListComponent` (rendering rows, emitting events)
- [ ] Unit tests for `OrganStorage` / DataStore implementations
- [ ] Unit tests for Electron persistence service (mocked IPC)
- [ ] E2E spec for organ CRUD flow

## Code Quality
- [x] ESLint configured (Angular ESLint presets in `angular.json`)
- [ ] Run `npm run lint` and fix any existing issues
- [ ] Run `npm run test` and ensure all tests pass (add baseline passing tests)
- [ ] Verify `npm start` loads the app correctly
- [ ] Verify `Organ` feature in running app (browser dev mode)
