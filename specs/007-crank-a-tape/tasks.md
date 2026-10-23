---

description: "Tasks for 007 Crank a tape"
---

# Tasks: Crank a tape

**Input**: Design documents from `/specs/007-crank-a-tape/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/domain-api.md](contracts/domain-api.md),
[contracts/preview-ui.md](contracts/preview-ui.md), [quickstart.md](quickstart.md),
[ADR 20](../../documentation/adr/0020-snapshots-migrated-on-read.md),
[ADR 22](../../documentation/adr/0022-tape-edits-as-domain-commands.md),
[ADR 24](../../documentation/adr/0024-preview-synthesised-with-web-audio.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task follows a test
task that must fail for the expected reason first (`tdd` skill: `test-first` red, `implementer`
green). Test pyramid: Node Vitest for `api/`; `ng test` (jsdom, fake `PreviewSound` and clock) for
`src/`; Playwright e2e only for restart, migration from old snapshots and the real window.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US5 from spec.md; only in story phases
- **Commits**: one small conventional commit per test+implementation pair on `007-crank-a-tape`.
  Update `documentation/STATUS.md` at each checkpoint.

## Phase 1: Setup

- [ ] T001 Add the keys of contracts/preview-ui.md with en and de texts to `src/assets/i18n/en.json` and `de.json`: `ORGAN.EDITOR.TAPE_PER_CRANK_TURN`, `_HINT`, `_INVALID`; `TAPE.PREVIEW.PLAY`, `STOP`, `SECTION_TITLE`, `CRANK_SPEED`, `CRANK_SPEED_APPLY`, `CRANK_SPEED_INVALID` (with `{{min}}`, `{{max}}`), `START_COLUMN`, `LENGTH` (with `{{time}}`), `EDITING_PAUSED`, `UNAVAILABLE`, `OPEN_ORGAN`; `npm run i18n:check` green (unused keys are fine until used).

## Phase 2: Foundational (domain and snapshots)

- [ ] T002 [P] Red: `api/tape/crank-speed.spec.ts`: `crankSpeed(v)` returns a `CrankSpeed` for finite `1 ≤ v ≤ 300` (1, 60, 300, 72.5) and `undefined` for 0, 0.99, 300.01, -5, NaN, Infinity; `DEFAULT_CRANK_SPEED` is 60.
- [x] T003 Green: `api/tape/crank-speed.ts` (`CrankSpeed` brand, `MIN_CRANK_SPEED`, `MAX_CRANK_SPEED`, `DEFAULT_CRANK_SPEED`, `crankSpeed`), exported from `api/index.ts`.
- [ ] T004 Red: `api/tape/tape.spec.ts`: `validTape` requires `crankSpeed` and refuses values outside "finite, `1 ≤ v ≤ 300`" with `{code: 'crank-speed-out-of-range'}`; `api/tape/tape-fixture.ts` and every Tape builder in `api/` give 60 by default.
- [x] T005 Green: `Tape.crankSpeed: CrankSpeed` in `api/tape/tape.ts`; every Tape creation in `api/` (import/`createTape`, commands) passes or keeps it; all node tests green (`npm run test:node`).
- [ ] T006 [P] Red: `api/tape/change-crank-speed.spec.ts`: changes only `crankSpeed`, keeps Holes, Columns, Column length, name; same object back when unchanged; `crank-speed-out-of-range` for 0, 301, NaN.
- [x] T007 Green: `changeCrankSpeed` in `api/tape/change-crank-speed.ts` through `validTape`, exported.
- [ ] T008 [P] Red: `api/tape/tape-library-snapshot.spec.ts`: writes version 2 with `crankSpeed`; reads version 2; reads version 1 with every Tape at 60; rejects a version 2 entry with `crankSpeed` 0 or missing.
- [ ] T009 Green: version 2 in `api/tape/tape-library-snapshot.ts` (migrated on read, ADR 20).
- [ ] T010 [P] Red: `api/organ/validate-organ.spec.ts` and `organ-draft.spec.ts`: `tapePerCrankTurn` `null` is valid (absent on the Organ); a given value must be finite and above 0, else `tape-per-crank-turn-not-positive` at path `tapePerCrankTurn`; `emptyOrganDraft` has `null`; `toDraft` copies it.
- [ ] T011 Green: `Organ.tapePerCrankTurn?: Millimetres` in `api/organ/organ.ts`, `organ-draft.ts`, `validate-organ.ts`.
- [ ] T012 [P] Red: `api/organ/organ-library-snapshot.spec.ts`: writes version 4 with `tapePerCrankTurn` when present and without it when absent; reads versions 1–3 without it; rejects a version 4 value ≤ 0.
- [ ] T013 Green: version 4 in `api/organ/organ-library-snapshot.ts`.
- [ ] T014 [P] Red: `api/preview/performance.spec.ts`: `performance` leaves out Holes whose Pipe is not on the Organ, keeps Holes with other Cutting Problems, joins touching Holes of one row (end = next start), keeps a 1-Column gap as two notes, sorts by `startColumn` then `pipe`; `columnDuration` = `columnLength / (tapePerCrankTurn × crankSpeed / 60)` (100 mm, 5 mm, 60/min → 0.05 s) and `undefined` without `tapePerCrankTurn`; `previewLength` = Columns × that; `noteFrequency(69)` = 440, `noteFrequency(81)` = 880.
- [ ] T015 Green: `api/preview/performance.ts`, exported from `api/index.ts`.
- [ ] T016 Fix the `src/` and `e2e/` compile after T005/T011 (`src/testing/organs.ts`, Tape fixtures get `tapePerCrankTurn: 100` where the test needs a Preview, `crankSpeed: 60`); `npm run test` and `npm run build` green.

**Checkpoint**: domain and snapshots ready; nothing visible changed. Commit, STATUS.

## Phase 3: User Story 3 — Describe how far a Crank turn draws the Tape (P1)

**Goal**: the Organ editor edits and keeps Tape per Crank turn. **Independent test**: set 120 mm, restart, see 120 mm.

- [ ] T017 [US3] Red: `src/app/features/organ/organ-editor/tape-bed-sheet/tape-bed-sheet.component.spec.ts` and `organ-editor.component.spec.ts`: field `tape-per-crank-turn` (decimal, comma or point, optional), error under `data-path="tapePerCrankTurn"` for 0 and -1, label and hint from T001, value saved with the Organ; `organ-form.ts` maps the field (label key, problem order, changed fields).
- [ ] T018 [US3] Green: the field in `tape-bed-sheet.component.html/.ts`, `organ-form.ts`, `organ-editor.component.ts` (test-id map).
- [ ] T019 [US3] Red: `e2e/organ-tape-per-crank-turn.spec.ts`: set 120 mm, save, restart, see 120 (comma in German); a seeded version 3 `organs.json` loads, the field is empty, and saving writes version 4.
- [ ] T020 [US3] Green: whatever T019 still needs.

## Phase 4: User Story 1 — Hear the Tape (P1) 🎯 MVP

**Goal**: play/stop the open Tape with a playhead. **Independent test**: start, see the playhead run to the end and stop.

- [ ] T021 [US1] Red: `src/app/features/tape/preview/tape-preview.spec.ts` with a fake `PreviewSound` (records `start(pipe, at)`/`stop(voice, at)`, controllable `now()`): `play(from)` schedules notes in a 100 ms window per 25 ms tick at `at = anchorTime + (startColumn − anchorColumn) × columnDuration`; a note already under the start Column starts at once; `stop()` stops every voice now and keeps the playhead; reaching the last Column stops by itself with the playhead at the end; `playhead()` follows the clock; `playing()`; no call into `TapeEditor` or `TapeLibrary`.
- [ ] T022 [US1] Green: `src/app/features/tape/preview/preview-sound.ts` (port, `PREVIEW_SOUND` token) and `tape-preview.ts` (component-scoped injectable).
- [ ] T023 [P] [US1] `src/app/features/tape/preview/web-audio-preview-sound.ts`: Web Audio adapter per research R5 (three sine harmonics 1/0.5/0.25, 15 ms attack, 30 ms release, master gain 0.2, compressor; `now()` = `currentTime`; fallback clock when no `AudioContext` can be made). Spec with a minimal fake `AudioContext` for the fallback and the node graph; registered as the token's default.
- [ ] T024 [US1] Red: `tape-view.component.spec.ts`: toolbar `preview-toggle` (`aria-pressed`, labels), Space toggles when focus is in the view and not in a text field or button, `playhead` line at `x = (leadIn + column × columnLength) × scale` with `data-column`; `preview-unavailable` with `preview-open-organ` when the Organ has no Tape per Crank turn (toggle disabled); leaving the view (destroy) stops the Preview.
- [ ] T025 [US1] Green: `tape-view.component.ts/.html` (provide `TapePreview`, playhead in the tape body group, toolbar button, notice).
- [ ] T026 [US1] Red: `e2e/tape-preview.spec.ts`: Organ with 100 mm, a short Tape; Space starts, the playhead's `data-column` grows, reaches the end and the toggle is no longer pressed; stop in the middle keeps the playhead; Tape file unchanged after a Preview.
- [ ] T027 [US1] Green: whatever T026 still needs (e.g. the sound adapter in real Electron).

**Checkpoint**: MVP — a Tape can be heard. Commit, STATUS.

## Phase 5: User Story 2 — Choose the Crank speed (P1)

**Goal**: change the Tape's Crank speed, also while playing. **Independent test**: 30 → 60 halves the Preview length.

- [ ] T028 [US2] Red: `src/app/features/tape/tape-view/crank-speed-change.spec.ts`: like `column-length-change.ts`: typed text → `unchanged` / `invalid` (outside 1–300, not a number) / `ready` with the Tape from `changeCrankSpeed`; comma or point.
- [ ] T029 [US2] Green: `crank-speed-change.ts`.
- [ ] T030 [US2] Red: `src/app/features/tape/preview/preview-section/preview-section.component.spec.ts`: `crank-speed-input`, `crank-speed-apply` (disabled when unchanged or invalid), Enter applies, `crank-speed-error` with min and max, `preview-length` "m:ss" from `previewLength`, emits `crankSpeedChange(tape)`; stays enabled while playing.
- [ ] T031 [US2] Green: `preview-section.component.ts` in the side panel of `tape-view.component.html`, wired to `commit({kind: 'applied', …})` (one undo step through `TapeEditor.apply`).
- [ ] T032 [US2] Red: `tape-preview.spec.ts`: a Crank speed change while playing re-anchors at `now()` and the current Column; later notes use the new rate; sounding voices get their stop re-scheduled; no voice restarts, no gap.
- [ ] T033 [US2] Green: re-anchoring in `tape-preview.ts` (the view passes the new Tape's `columnDuration`).
- [ ] T034 [US2] Red: `e2e/tape-preview.spec.ts`: change 60 → 120, restart, Tape opens with 120; Undo brings 60 back, Redo 120; German comma input.
- [ ] T035 [US2] Green: whatever T034 still needs.

## Phase 6: User Story 4 — Start from any Column (P2)

**Goal**: start the Preview at a chosen Column. **Independent test**: start at Column 200, the playhead starts there.

- [ ] T036 [US4] Red: `tape-view.component.spec.ts` and `preview-section.component.spec.ts`: a ruler click (stopped) sets the start Column (rounded down from the x position) and moves the playhead; `preview-start-column` (1-based, 1..columns) does the same; Play at the end starts at Column 1; while playing a ruler click does nothing.
- [ ] T037 [US4] Green: ruler click and start field in `tape-view.component.ts/.html` and the Preview section.
- [ ] T038 [US4] Red: `tape-view.component.spec.ts`: while playing the view scrolls to keep the playhead visible unless the owner scrolled in the last 2 seconds.
- [ ] T039 [US4] Green: follow-the-playhead in `tape-view.component.ts`.

## Phase 7: User Story 5 — Editing is paused while it plays (P2)

**Goal**: no Tape edit while playing except the Crank speed. **Independent test**: start, try to drag, Delete, Undo, Transpose; nothing changes.

- [ ] T040 [US5] Red: `tape-view.component.spec.ts`: while `TapePreview.playing()`: pointer drag, resize, add and remove do nothing; Delete, Ctrl+Z/Y, Ctrl+A-and-arrow moves do nothing; Undo, Redo, Transpose, Add a Hole, Column length Apply are disabled; the `EditCommandRouter` handler ignores menu Undo/Redo; `editing-paused` shows; the Crank speed field still applies; after stop all of it works again.
- [ ] T041 [US5] Green: `editingPaused` computed and the guards in `tape-view.component.ts/.html`, the hole-editing handlers and the Tape and side panel sections.
- [ ] T042 [US5] Red: `e2e/tape-preview.spec.ts`: while playing a Hole drag and the menu Undo change nothing; after stop they work.
- [ ] T043 [US5] Green: whatever T042 still needs.

## Phase 8: Polish

- [ ] T044 [P] `ux-review` of the Tape view with the Preview (capture 09a) and the Organ editor field; fix findings or record them in an issue.
- [ ] T045 [P] `angular-reviewer` over `src/` changes; `electron-reviewer` only if `app/` changed; fixes via `implementer`.
- [ ] T046 `spec-auditor` against spec.md; write `specs/007-crank-a-tape/audit.md`.
- [ ] T047 STATUS, ROADMAP (Crank a tape → done), CHANGELOG `[Unreleased]`, README if it lists capabilities; quickstart by hand on Windows.
- [ ] T048 Gate: `npm run lint`, `npm run test:node`, `npm run test`, `npm run i18n:check`, `npm run build`, full e2e in CI; open the pull request (`Closes #149`).

## Dependencies

- Phase 2 blocks everything. US3 (Phase 3) before US1's e2e (T026 needs the field to set 100 mm). US2, US4 and US5 need US1's `TapePreview`; they are independent of each other but edit `tape-view.component.*`, so run them one after the other.
- [P] tasks inside Phase 2 touch different files (T002, T006, T008, T010, T012, T014 in parallel after T005 where they build Tapes).

## Parallel examples

- Phase 2: T010+T011 (Organ) and T014+T015 (performance) beside T008+T009 (Tape snapshot).
- Phase 4: T023 (Web Audio adapter) beside T024/T025 (view).

## Implementation strategy

MVP = Phase 2 + US3 + US1: an Organ with Tape per Crank turn and a Tape playing at 60 turns per minute
with a playhead. Then US2 (speed), US4 (start Column), US5 (paused editing), Polish.
