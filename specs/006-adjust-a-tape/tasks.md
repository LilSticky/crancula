---

description: "Tasks for 006 Adjust a tape"
---

# Tasks: Adjust a tape

**Input**: Design documents from `/specs/006-adjust-a-tape/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/domain-api.md](contracts/domain-api.md),
[contracts/tape-view-ui.md](contracts/tape-view-ui.md), [quickstart.md](quickstart.md),
[ADR 22](../../documentation/adr/0022-tape-edits-as-domain-commands.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task follows a test
task that must fail for the expected reason first (`tdd` skill: `test-first` red, `implementer`
green). Test pyramid: Node Vitest for `api/`; `ng test` (jsdom) for `src/`; Playwright e2e only for
restart and the real menu.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US3 from spec.md; only in story phases
- **Commits**: one small conventional commit per test+implementation pair on `006-adjust-a-tape`.
  Update `documentation/STATUS.md` at each checkpoint.

## Phase 1: Setup

- [x] T001 Add the keys of contracts/tape-view-ui.md (`TAPE.SECTION.COLUMN_LENGTH_APPLY`, `_HINT` with `{{now}}`, `{{then}}`, `{{value}}`, `_INVALID`) with en and de texts to `src/assets/i18n/en.json` and `de.json`; `npm run i18n:check` green (unused keys are fine until T007).

## Phase 2: Foundational (domain)

- [x] T002 Red: in `api/tape/tape.spec.ts` (or the existing `validTape` spec), `validTape` refuses `columnLength` 0, -1, NaN and Infinity with `{code: 'column-length-not-positive'}`.
- [x] T003 Green: add the rule and the code to `TapeRuleViolationCode` in `api/tape/tape.ts`; every existing test green.
- [x] T004 Red: `api/tape/change-column-length.spec.ts`, every row of contracts/domain-api.md.
- [x] T005 Green: `changeColumnLength` in `api/tape/change-column-length.ts`, exported from `api/index.ts`, building the Tape only through `validTape`.

**Checkpoint**: domain command exported; nothing visible changed.

## Phase 3: User Story 1 — Change the Column length (P1) 🎯 MVP

**Independent test**: e2e — change 5 → 10 mm, restart, Tape at 10 mm with the same Holes.

- [x] T006 [US1] Red: `src/app/features/tape/tape-view/tape-section/tape-section.component.spec.ts` — the Column length row is a field (`column-length-input`) showing the current value in the language's notation; typing a valid different value and pressing Enter or `column-length-apply` emits `columnLengthChange` with the changed Tape; the same value (also "5,0" for 5) or invalid text keeps Apply disabled and emits nothing; invalid shows `column-length-error`; Escape and blur put the current value back.
- [x] T007 [US1] Green: the field in `tape-section.component.ts` (Material outlined field, `crancDecimalInput`, "mm" suffix), the section gets the Tape as input (or the current `columnLength` plus a change callback) as the contract says; minimal SCSS.
- [x] T008 [US1] Red: `tape-view.component.spec.ts` — a `columnLengthChange` from the section is one `TapeEditor.apply` with the current selection; drawing width, Tape length text and status line follow the new Column length.
- [x] T009 [US1] Green: wire it in `tape-view.component.ts`/`.html`.
- [ ] T010 [US1] Red→green: `e2e/tape-column-length.spec.ts` — change the Column length 5 → 10 mm in the Tape section, restart Crancula, the Tape shows 10 mm, the same number of Columns and Holes, Tape length doubled.

**Checkpoint**: MVP — STATUS updated.

## Phase 4: User Story 2 — See what the new Column length breaks (P1)

- [ ] T011 [P] [US2] Red: `src/app/features/tape/tape-view/column-length-change.spec.ts` — states `unchanged`, `invalid`, `ready` of data-model.md from (typed value, Tape, Organ); `ready` carries `problemsNow` and `problemsThen` from `cuttingProblems`.
- [ ] T012 [US2] Green: `column-length-change.ts` (pure, no Angular).
- [ ] T013 [US2] Red: section spec — in `ready` the hint `column-length-hint` shows now/then counts (also when equal or 0); after applying, the Cutting Problems list and marks follow (view spec).
- [ ] T014 [US2] Green: use `column-length-change.ts` in the section; the section needs the Organ (input).

## Phase 5: User Story 3 — Undo the change (P2)

- [ ] T015 [US3] Red→green: `tape-view.component.spec.ts` — undo after a Column length change restores the old Column length and marks in one step; redo brings the new one back; mixed with a Hole move, undo order is reverse.
- [ ] T016 [US3] Red→green: extend `e2e/tape-column-length.spec.ts` — the application menu's Edit > Undo takes the change back when the field has no focus.

## Phase 6: Polish

- [ ] T017 [P] German pass: comma input and the language's notation in the field and hint (section spec in `de`).
- [ ] T018 [P] `angular-reviewer` on `src/` changes; fix findings via `implementer`.
- [ ] T019 `spec-auditor` against spec.md; `npm run ux:screens` capture of the Tape section with a hint, short `ux-review` note in STATUS.
- [ ] T020 Docs: STATUS, ROADMAP (Adjust a tape done; #103 closes), DESIGN-GUIDE line for editable side-panel values if it adds a pattern; gate: lint, i18n, unit, e2e in CI.
