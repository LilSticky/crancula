---

description: "Tasks for 008 Edit a tape by touch"
---

# Tasks: Edit a tape by touch

**Input**: Design documents from `/specs/008-edit-a-tape-by-touch/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/tape-view-ui.md](contracts/tape-view-ui.md),
[quickstart.md](quickstart.md), [ADR 20](../../documentation/adr/0020-snapshots-migrated-on-read.md),
[ADR 22](../../documentation/adr/0022-tape-edits-as-domain-commands.md),
[ADR 24](../../documentation/adr/0024-preview-synthesised-with-web-audio.md)

**Tests**: TDD is mandatory (constitution II). Each Red task writes failing tests (`test-first`),
each Green task makes them pass (`implementer`). Pyramid: Node Vitest for `api/`; `ng test` (jsdom)
for `src/`, dispatching `PointerEvent`s with `pointerType` `touch`/`mouse`; Playwright e2e only for
real Electron touch, restart and migration.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **Commits**: one small conventional commit per Red+Green pair; STATUS at each checkpoint.

## Phase 1: Setup

- [ ] T001 Add the keys of contracts/tape-view-ui.md "Messages" to `src/assets/i18n/en.json` and `de.json`, aligned with the existing namespaces and the existing German unit for turns per minute; `npm run i18n:check` green.

## Phase 2: Foundational (Crank speed range in the domain)

- [ ] T002 [P] Red: `api/organ/crank-speed-range.spec.ts`: `crankSpeedRange(30, 120)` is a range; `undefined` for slowest ≥ fastest (90/40, 60/60), values outside 1–300, NaN; `DEFAULT_CRANK_SPEED_RANGE` is 30–120; `nearestInRange` returns the value and `outside: false` inside, the nearest end and `outside: true` below/above.
- [ ] T003 Green: `api/organ/crank-speed-range.ts`, exported from `api/index.ts`.
- [ ] T004 Red: `api/organ/validate-organ.spec.ts` and `organ-draft.spec.ts`: `emptyOrganDraft()` has 30/120; `toDraft` copies the range; `validateOrgan` gives `crankSpeedRange`, and the violations of data-model.md (`value-required`, `crank-speed-out-of-range` with min/max, `slowest-not-below-fastest` on `fastestCrankSpeed`).
- [ ] T005 Green: `Organ.crankSpeedRange` (`api/organ/organ.ts`), draft fields (`organ-draft.ts`), validation (`validate-organ.ts`); every Organ fixture/builder in `api/` and `src/` gets the default range; `npm run test` green.
- [ ] T006 Red: `api/organ/organ-library-snapshot.spec.ts`: writes version 5 with `crankSpeedRange`; v1–v4 entries read with 30–120; a v5 entry with 90/40 is refused like other invalid entries.
- [ ] T007 Green: `api/organ/organ-library-snapshot.ts` version 5.

**Checkpoint**: domain ready; commit, STATUS.

## Phase 3: US1 Add a Hole by tapping (P1) MVP

- [ ] T008 [P] [US1] Red: `src/app/features/tape/tape-view/spot.spec.ts`: `sameSpot`; `spotAt(cell, tape)` is `undefined` on a cell covered by a Hole, a Spot otherwise (also after the last Column); `moveSpot` by direction, clamped to Column 0 and rows 1…n.
- [ ] T009 [US1] Green: `spot.ts` (`Spot`, `TapeSelection`, `sameSpot`, `spotAt`, `moveSpot`).
- [ ] T010 [US1] Red: `tape-view.component.spec.ts`: a tap (pointerdown+pointerup, < 4 px, mouse and touch) on empty Tape draws `spot` (outlined, Minimum Hole Length wide) and clears the Hole selection; a tap on the selected Spot adds a Hole of Minimum Hole Length, selected, one undo step; a tap on another empty place moves the Spot; a tap on the Lead-in clears; two mouse clicks on one empty place (as a `dblclick` delivers them) add exactly one Hole; while the Preview plays a second tap adds nothing and shows editing paused.
- [ ] T011 [US1] Green: Tape view `selection` as `TapeSelection` with a computed `holeSelection` (research R1); tap handling in `onPointerDown`/`onPointerUp`; remove `(dblclick)` and `onDoubleClick`; draw the Spot in `tape-view.component.html`/`.scss` with an `aria-live` label (`TAPE.EDIT.SPOT_LABEL`). Existing spec 004 tests stay green (adjust only those that dispatch a bare `dblclick` to dispatch the two clicks a real double-click sends).
- [ ] T012 [US1] Red: component spec: with a Spot, arrows move it, Enter adds a Hole there, Escape clears it; with a Hole selected, arrows behave as before.
- [ ] T013 [US1] Green: `onKeydown` in `tape-view.component.ts`.
- [ ] T014 [P] [US1] Red: `add-hole/add-hole.component.spec.ts`: a `spot` input fills Pipe (its row's Pipe) and Column (start + 1).
- [ ] T015 [US1] Green: `add-hole.component.ts` input and effect; the Tape view passes the Spot.

**Checkpoint**: tap-tap adds; commit, STATUS.

## Phase 4: US2 Change a Hole by touch (P1)

- [ ] T016 [P] [US2] Red: `hole-drag.spec.ts`: a press anywhere on a Hole body is a move (no inside handle); grip hit areas from a new `gripRects(holeRect, scale)` are outside the Hole beside each end and ≥ 44 × 44 screen px at scales 0.5, 1, 2, also for a 1-Column Hole, and don't overlap each other.
- [ ] T017 [US2] Green: `hole-drag.ts` (`holePartAt` and `HANDLE_PX` removed, `gripRects`); template draws visible grips (6 px accent bar) and the hit rects with `data-testid="hole-handle"` and `data-end`; component spec for dragging a grip still green.
- [ ] T018 [P] [US2] Red: `double-tap.spec.ts`: two taps on the same Hole within 400 ms are a double; 401 ms, another Hole, a modifier on the first tap, or a first tap that added the Hole are not.
- [ ] T019 [US2] Green: `double-tap.ts` (`TapMemory`, `nextTap`, `DOUBLE_TAP_MS`).
- [ ] T020 [US2] Red: component spec: double-tap (touch and mouse) on a Hole removes it, one undo step, next selection as Delete; tap-tap-tap on empty Tape adds one Hole and keeps it; refused while the Preview plays.
- [ ] T021 [US2] Green: Tape view uses `nextTap` in the Hole tap path and `keyEdit(…, 'remove')`.

**Checkpoint**: P1 done; commit, STATUS.

## Phase 5: US3 Scroll the Tape with a finger (P2)

- [ ] T022 [US3] Red: component spec: a touch `pointerdown` + move on empty Tape draws no frame and selects no Spot; `pointercancel` after it changes nothing; a mouse or pen drag still draws the frame; the drawing has `touch-action: pan-x pan-y`, Holes and grips `none` (computed from the stylesheet classes).
- [ ] T023 [US3] Green: `tape-view.component.ts` (`pointerType` check) and `.scss`.

## Phase 6: US4 Drag the playhead (P2)

- [ ] T024 [US4] Red: component spec with the fake `PreviewSound` and clock: dragging `playhead-grip` moves the playhead by Columns (clamped to the Tape); while playing, the press stops the sound and the release plays from the drop Column; the Tape and the undo history are unchanged.
- [ ] T025 [US4] Green: playhead grip in the ruler (44 px hit area, `touch-action: none`), pointer capture, `preview.stop()` / `preview.play()`.

## Phase 7: US5 A Crank speed range for each Organ (P2)

- [ ] T026 [P] [US5] Red: Organ editor specs (`tape-bed-sheet` / `organ-editor.component.spec.ts`): fields `slowest-crank-speed` and `fastest-crank-speed` after Tape per Crank turn, 30/120 for a new Organ, comma input in German, the two violations shown under the fields and in the error summary, saved with the Organ.
- [ ] T027 [US5] Green: `organ-form.ts`, `tape-bed-sheet.component.html`.
- [ ] T028 [P] [US5] Red: `preview-section.component.spec.ts`: `crank-speed-slider` spans the Organ's range, step 1; input emits `crankSpeedTrial` without `crankSpeedChange`; release emits one `crankSpeedChange`; a Tape speed outside the range shows the slider at the nearest end and `crank-speed-outside-range`; the field still accepts 1–300.
- [ ] T029 [US5] Green: `preview-section.component.ts`/`.html` with `mat-slider`.
- [ ] T030 [US5] Red: Tape view spec: `crankSpeedTrial` changes the playing tempo without a save or undo step; the release is one undo step (Ctrl+Z restores).
- [ ] T031 [US5] Green: Tape view wiring (`preview.changeTape` with an uncommitted Tape).

**Checkpoint**: all stories; commit, STATUS.

## Phase 8: Polish and e2e

- [ ] T032 Red/green: `e2e/tape-touch.spec.ts` in Electron with touch (`hasTouch`, `touchscreen.tap`, CDP touch drags): tap–tap adds a Minimum-Hole-Length Hole that survives a restart; grip drag lengthens; double-tap removes; a finger drag on empty Tape scrolls.
- [ ] T033 [P] Red/green: e2e for the playhead drag while playing and the slider (release, then Ctrl+Z) in the existing crank e2e file; Organ range fields across a restart and a v4 snapshot migration in the Organ e2e.
- [ ] T034 [P] ADR 25 "One gesture model for all pointer types" (`adr` skill) and the index.
- [ ] T035 [P] DESIGN-GUIDE "The Tape visualisation" and "Accessibility commitments" (grips, Spot, 44 px targets).
- [ ] T036 `npm run ux:screens` + `ux-review` of the Tape view and the Organ editor; fix or file findings.
- [ ] T037 `angular-reviewer` over the slice; fix findings.
- [ ] T038 `spec-auditor` against spec.md; write `audit.md`.
- [ ] T039 STATUS, ROADMAP, CHANGELOG `[Unreleased]`; full gate (`npm run test`, `lint`, `i18n:check`, `e2e`); PR "Closes #152".

## Dependencies

- Phase 2 before US5; US1 (T011 TapeSelection) before US2–US4 in the Tape view component.
- US2's T016–T019 can run beside US1's T008/T014 (different files).
- Polish after all stories.
