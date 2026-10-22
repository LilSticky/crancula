---

description: "Tasks for 005 Transpose holes"
---

# Tasks: Transpose holes

**Input**: Design documents from `/specs/005-transpose-holes/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/domain-api.md](contracts/domain-api.md),
[contracts/tape-view-ui.md](contracts/tape-view-ui.md), [quickstart.md](quickstart.md),
[ADR 22](../../documentation/adr/0022-tape-edits-as-domain-commands.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task follows a test
task that must fail for the expected reason first (`tdd` skill: `test-first` red, `implementer`
green). Test pyramid: Node Vitest (`vitest.node.config.ts`) for `api/`; `ng test` (jsdom) for
everything in `src/`, including the pure helpers in `hole-selection.ts`; Playwright e2e only for
what needs real Electron (restart, real pointer gestures, OS modifier keys).

**Refactor under green** (T003): `HoleSelection` replaces the single selected Hole without
changing behaviour; every existing test stays green and is adapted only in types.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US6 from spec.md; only in story phases
- **Commits**: one small conventional commit per test+implementation pair on `005-transpose-holes`.
  Update `documentation/STATUS.md` at each checkpoint.

## Phase 1: Setup

- [x] T001 Read ADR 22, `api/tape/hole-edits.ts`, `api/tape/octave-moves.ts`, `src/app/features/tape/tape-view/tape-editor.ts` and `hole-edit-commands.ts`; no code change. Add the i18n keys of contracts/tape-view-ui.md ("i18n keys") with en and de texts to `src/assets/i18n/en.json` and `de.json`; `npm run i18n:check` green.

## Phase 2: Foundational

- [x] T002 Domain skeleton: export `HolesToTranspose`, `HoleFate`, `Merge`, `TranspositionOutcome`, `Transposed` (exactly as in data-model.md) and `transposeHoles`/`transposeRange` stubs from `api/tape/transpose-holes.ts` via `api/index.ts`; red test first in `api/tape/transpose-holes.spec.ts` for `transposeRange` ("±(highest − lowest Pipe note), at most ±127"), then implement `transposeRange`.
- [x] T003 Refactor under green: introduce `type HoleSelection = readonly SelectableHole[]` (last = active, `[]` = none) in `src/app/features/tape/tape-view/hole-selection.ts`; make `TapeEdit.selection` (`tape-editor.ts`), `EditOutcome.selection` (`hole-edit-commands.ts`) and the view's `selectedHole` signal (`tape-view.component.ts`) use it; the inspection, handles and 004 edits use the single selected Hole only when the selection has exactly one entry. All existing tests green.

**Checkpoint**: domain types exported, selection is a set; nothing visible changed.

## Phase 3: User Story 1 — Transpose the whole tape (P1) 🎯 MVP

**Goal**: transpose all Holes by n semitones with the outcome shown first; saved; Tape fields unchanged.
**Independent test**: e2e — transpose all by +2, restart, Holes on the new Pipes.

- [x] T004 [US1] Red: in `api/tape/transpose-holes.spec.ts` — contract lines 1, 4, 7, 8 for `{kind:'all'}` (Pipes C4, D4, E4; Holes C4 10–13, D4 20–21; +2 → D4 10–13, E4 20–21, both `moved`; length, transposition, songId, selectedParts, columnLength, name unchanged; `resulting` names both; 0 semitones returns the Tape unchanged).
- [x] T005 [US1] Green: implement `transposeHoles` for targets that have a Pipe in `api/tape/transpose-holes.ts`, building the Tape only through `validTape`.
- [x] T006 [P] [US1] Red: `src/app/features/tape/tape-view/transpose-dialog/transpose-dialog.component.spec.ts` — scope "All Holes", semitones field (range from `transposeRange`, initial 0), `transpose-outcome` counts follow every change, Apply disabled at 0, Cancel closes with nothing, Apply closes with the `Transposed` value (test ids as in contracts/tape-view-ui.md).
- [x] T007 [US1] Green: `TransposeDialogComponent` (standalone, OnPush, signals, Material dialog/radio/form field, minimal SCSS) in `src/app/features/tape/tape-view/transpose-dialog/`.
- [x] T008 [US1] Red: `tape-view.component.spec.ts` — `transpose` button in the action bar, disabled when no Hole has a row; a dialog result is committed as one `TapeEditor.apply` with `outcome.resulting` selected.
- [x] T009 [US1] Green: wire the button and the dialog result through the existing `commit` path in `tape-view.component.ts`/`.html`.
- [x] T010 [US1] Red→green: `e2e/tape-transpose.spec.ts` — transpose all by +2 through the dialog, restart Crancula, the Holes are on the new Pipes and the Tape's Transposition shown is unchanged.

**Checkpoint**: MVP — STATUS updated.

## Phase 4: User Story 2 — Holes without a Pipe after transposing (P1)

**Independent test**: unit — octave moves and removals on an Organ with gaps; dialog lists removed Holes.

- [x] T011 [US2] Red: `api/tape/transpose-holes.spec.ts` — contract lines 2, 3, 6 (Pipes C4, D4, D#5: D4 +1 → D#5 `moved-by-octaves`; no C# Pipe: C4 +1 → `removed`; target outside 0–127 → `removed`; tie goes upward; Hole whose Pipe is not on the Organ unchanged and counted in `leftOut` for `all`).
- [x] T012 [US2] Green: use `octaveMoveTable(organ)` in `transposeHoles`; removals and `leftOut`.
- [x] T013 [P] [US2] Red: `transpose-dialog.component.spec.ts` — `outcome-moved-by-octaves`, `outcome-removed`, `outcome-removed-holes` ("C#4 · Column 12", Columns counted from 1), `outcome-left-out` only when > 0, the "nothing left" note when every Hole would be removed.
- [x] T014 [US2] Green: those outcome parts in `transpose-dialog.component.*`.

## Phase 5: User Story 3 — Holes that land on each other are merged (P1)

- [x] T015 [US3] Red: `api/tape/transpose-holes.spec.ts` — contract line 5 (C4 10–13 transposed +2 onto D4 12–16 → one D4 10–16, one `Merge` with both `from`; octave move onto a Hole merges; touching Holes not merged; three overlapping in a run → one merge) and line 9 (1,000 Holes < 50 ms).
- [x] T016 [US3] Green: merging runs per Pipe in `transposeHoles`; `resulting` names merged Holes.
- [x] T017 [P] [US3] Red→green: `outcome-merged` count in `transpose-dialog.component.*`.

**Checkpoint**: whole-Tape transposition complete (P1). STATUS updated.

## Phase 6: User Story 4 — Select several holes and transpose them (P2)

**Independent test**: e2e — Ctrl-click three, frame two, transpose selected by −12, only those moved.

- [ ] T018 [P] [US4] Red: `hole-selection.spec.ts` — `toggled`, `framed` (Holes on rows inside the frame that overlap its Columns), `extended` (next Hole in a direction added and made active, uses `nextHole`), `allOf`, `activeOf`.
- [ ] T019 [US4] Green: those functions in `hole-selection.ts`.
- [ ] T020 [US4] Red: `tape-view.component.spec.ts` — Ctrl-click (Cmd on darwin via the platform token) toggles; plain click selects one; drag from an empty spot shows `selection-frame` and selects on release (Ctrl/Cmd adds); a press without travel clears; Ctrl/Cmd+Arrow extends; Ctrl/Cmd+A selects all with a row; Escape clears; every selected Hole drawn `rect.selected`; 004 edit keys and handles do nothing with several selected.
- [ ] T021 [US4] Green: the view and `tape-drawing.ts` (selected state per Hole, frame rect); keep logic in `hole-selection.ts`, not the component.
- [ ] T022 [P] [US4] Red→green: `selected-hole` shows "n Holes selected" (`selection-count`) for two or more.
- [ ] T023 [US4] Red→green: dialog scope `transpose-scope-selected` ("Selected Holes (n)", preselected when n > 0, disabled at 0) passes `{kind:'these', holes}`; `transposeHoles` red test for `these` (only those move; unknown refs ignored; merges with untouched Holes) first in `api/tape/transpose-holes.spec.ts`.
- [ ] T024 [US4] Red→green: `e2e/tape-transpose.spec.ts` — Ctrl-click three Holes, drag a frame over two more, transpose selected by −12, only those five moved and are selected.

## Phase 7: User Story 5 — Undo a transposition (P2)

- [ ] T025 [US5] Red→green: `tape-view.component.spec.ts` — after a transposition with merges and removals, one undo restores the Tape and the selection before it; redo applies it again (`remember` stores the `HoleSelection`).
- [ ] T026 [US5] Red→green: `e2e/tape-transpose.spec.ts` — Ctrl+Z once after transposing gives the stored Tape from before.

## Phase 8: User Story 6 — Keyboard and German or English (P3)

- [ ] T027 [US6] Red→green: `e2e/tape-transpose.spec.ts` — keyboard only: Ctrl+Arrow to extend, Tab to `transpose`, type semitones, Enter applies; Escape cancels.
- [ ] T028 [P] [US6] Red→green: `e2e/tape-german.spec.ts` — the dialog and "n Löcher ausgewählt" in German.

## Phase 9: Polish

- [ ] T029 [P] `documentation/DESIGN-GUIDE.md`: selection gestures and keys, the Transpose dialog.
- [ ] T030 [P] `angular-reviewer` on the `src/` diff; fix findings via `implementer`.
- [ ] T031 `spec-auditor` against spec.md; `npm run lint`, `npm run test`, `npm run i18n:check`, `npm run build`, `npm run e2e` green; `ux-review` of the Tape view with the dialog.
- [ ] T032 STATUS and ROADMAP (#106 done), `CHANGELOG.md` `[Unreleased]`: "Transpose all or the selected Holes of a Tape".

## Dependencies

- T002, T003 block every story. US1 (T004–T010) is the MVP. US2 and US3 extend the domain and the
  dialog of US1. US4 needs T003 and the dialog; US5 needs US1 and US4; US6 needs US4.
- Parallel: T006 with T004/T005 (dialog against the stub types); T013, T017, T018, T022, T028–T030.

## Implementation strategy

MVP = Phases 1–3 (transpose all Holes, saved). Then P1 completeness (US2, US3), then
multi-select (US4), undo check (US5), keyboard and German (US6), polish.
