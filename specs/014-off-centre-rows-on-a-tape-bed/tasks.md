---

description: "Tasks for 014 Off-centre rows on a Tape Bed"
---

# Tasks: Off-centre rows on a Tape Bed

**Input**: Design documents from `/specs/014-off-centre-rows-on-a-tape-bed/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/organ-snapshot-v6.md](contracts/organ-snapshot-v6.md),
[contracts/organ-editor-ui.md](contracts/organ-editor-ui.md), [quickstart.md](quickstart.md)

**Tests**: TDD is mandatory (constitution, principle II). Each Red task writes only the failing test
(`test-first`); its Green task makes it pass and refactors (`implementer`). Node Vitest for `api/`, `ng test`
(jsdom) for `src/`, Playwright only for restart and the real window.

## Format: `[ID] [P?] [Story] Description`

- **Commits**: one conventional commit per Red+Green pair on `014-off-centre-rows-on-a-tape-bed`.
- **Reference** ([data-model.md](data-model.md)): 20er 110 / 3 / 3.85 / 20 Pipes / Guide margin 10 → guide side
  8.5, far side 25.35; 31er 140 / 2.5 / 3.86 / 31 Pipes / 11 → 9.75, 11.95; centred 20er → 16.925 both sides.

## Phase 1: Setup

- [ ] T001 Add the keys of [contracts/organ-editor-ui.md](contracts/organ-editor-ui.md) to `src/assets/i18n/en.json` and `de.json`: `ORGAN.EDITOR.GUIDE_MARGIN` ("Guide margin" / "Führungsrand"), `GUIDE_MARGIN_HINT` ("Guide edge to the centre of row 1; empty: rows centred"), `BORDER_SIDES` ("{{guide}} mm guide side · {{far}} mm far side" / "{{guide}} mm Führungsseite · {{far}} mm Gegenseite"), `BORDER_SIDES_HINT` ("The guide side is row 1's edge"), `FIT_OFF_CENTRE`, `FIT_OFF_CENTRE_ONE`, `TAPE_BED_DRAWING_OFF_CENTRE`, `TAPE_BED_DRAWING_OFF_CENTRE_ONE` (as `FIT`/`TAPE_BED_DRAWING`, naming both Borders); `ORGAN.ERROR.GUIDE_MARGIN_BELOW_HALF_HOLE` ("At least {{min}} mm, half the hole diameter, or the holes run off the tape."), `GUIDE_MARGIN_TOO_LARGE` ("At most {{max}} mm, or the last row runs off the far side."). `npm run i18n:check` green.

## Phase 2: Foundational (Borders per side)

- [ ] T002 Red: `api/organ/organ.spec.ts`: `tapeBedFit` returns `{rowSpan, borders: {guide, far}}` for the centred 20er (16.925 both), the guided 20er (8.5 / 25.35) and 31er (9.75 / 11.95); `borders(organ)` likewise; a negative far side when the rows don't fit.
- [ ] T003 Green: `api/organ/organ.ts`: `TapeBed.guideMargin?: Millimetres`, `Borders`, `tapeBedFit`, `borders` (replaces `border`); `api/index.ts` exports; fix compile errors at every caller by reading `borders.guide` where the old code meant the top edge, without behaviour change yet (R2).
- [ ] T004 Red: `api/tape/tape-geometry.spec.ts`: a guided 20er Organ puts row 1's centre at 10 mm and row 20's at 83.15 mm; `geometry.borders` is `{guide: 8.5, far: 25.35}`; a centred Organ unchanged.
- [ ] T005 Green: `api/tape/tape-geometry.ts` uses `borders` (field `borders` replaces `border`); callers `tape-drawing.ts` `outline().borders` = `[guide × scale, (width − far) × scale]`.

## Phase 3: US1 Enter a Guide margin (P1)

- [ ] T006 Red: `api/organ/validate-organ.spec.ts`: Guide margin null → centred Organ without the field; 10 → kept; 0 or negative → `must-be-positive`; 1.4 with a 3 mm hole → `guide-margin-below-half-hole` {min: 1.5}; 1.5 → valid (Border 0); 35.36 on the 20er → `guide-margin-too-large` {max: 35.35}; 35.35 → valid; rows wider than the tape → only `pipes-exceed-tape-width`; adding a Pipe to a valid guided Organ can raise `guide-margin-too-large`. `organ-draft` spec: draft from a guided Organ carries `guideMargin`, empty draft has `null`.
- [ ] T007 Green: `api/organ/organ-draft.ts`, `api/organ/validate-organ.ts` (R3).
- [ ] T008 Red: `api/organ/organ-library-snapshot.spec.ts`: writes version 6 with `guideMargin` only when set; round trip keeps it; v5 file reads centred and ignores a stray `guideMargin`; v6 with a string `guideMargin` refused; v6 with a too-large one refused. `app/organ-library-file.spec.ts` fixtures to version 6.
- [ ] T009 Green: `api/organ/organ-library-snapshot.ts` (R4).
- [ ] T010 Red: `src/app/features/organ/organ-editor/*.spec.ts`: the `guide-margin` field after Spacing between rows, optional; `border` shows "16.93" and the centred hint for an empty field, "8.5 mm guide side · 25.35 mm far side" and the sides hint with 10; the fit line and drawing label use the `_OFF_CENTRE` keys; the drawing's top strip is 8.5 mm and the bottom one 25.35 mm high; errors shown at the field after a save attempt; clearing the field centres again; dirty tracking counts the field; German texts.
- [ ] T011 Green: `organ-form.ts`, `organ-editor.component.ts`, `tape-bed-sheet/*` (R5).

## Phase 4: US2 Tape follows the Guide margin (P1)

- [ ] T012 Red: `api/tape/plotter-svg.spec.ts` (or the existing SVG spec): a guided 20er Tape puts row 1's Hole centres 10 mm from the top edge (± 0.01); a centred Organ's SVG is byte-identical to a stored expectation; `tape-pieces` and `side-by-side-cut` specs: one guided case each. `src/app/features/organ/tape-bed-miniature.spec.ts`: guided row centres. `src/app/features/tape/tape-view/pointer-at.spec.ts`: guided rows hit where drawn; one-row Organ: every y on the Tape hits row 1 (R6).
- [ ] T013 Green: whatever T012 shows red: `tape-bed-miniature.ts`, `pointer-at.ts` (expected), others only if a test fails.

## Phase 5: US4 Presets (P3)

- [ ] T014 Red: `api/organ/organ-preset.spec.ts` and `organ-editor-presets.spec.ts`: 20er fills `guideMargin` 10 (far side 25.35), 31er 11 (far side 11.95).
- [ ] T015 Green: `api/organ/organ-preset.ts` values and doc comment (R7).

## Phase 6: US1–US3 in Electron

- [ ] T016 Red/Green: `e2e/organ-guide-margin.spec.ts`: enter a Guide margin, save, restart, the field and both Borders are kept; a Tape of that Organ shows Border strips of different heights in the Tape view; a version 5 `organs.json` seeded before start loads centred (US3).

## Phase 7: Polish and gate

- [ ] T017 [P] `npm run ux:screens` for the Organ editor (centred, guided, error) in en, dark and German; `ux-review` on them; fix findings.
- [ ] T018 [P] Reviews in parallel: `angular-reviewer` (`src/`), `electron-reviewer` only if `app/` code changed (expected: fixtures only), `spec-auditor` → `audit.md`, `domain-modeler` on Guide margin, Border, guide side, far side in code and texts; fix findings via `implementer`.
- [ ] T019 Gate: `npm run test`, `npm run lint`, `npm run i18n:check`, `npm run build` green; e2e green locally and in CI on three OSes (ADR 13).
- [ ] T020 `documentation/STATUS.md`, `ROADMAP.md`, `CHANGELOG.md` `[Unreleased]` (Guide margin, Presets, `organs.json` version 6 so an older app can't read it, ADR 20); pull request with `Closes #163`.
- [ ] T021 (Needs the user.) Cut and play a 20er Tape with the Guide margin (SC-004); record in STATUS.

## Dependencies

T001 → T010. T002 → T003 → T004 → T005 → everything else. T006/T007 before T008/T009 (snapshot validates
through `validateOrgan`) and T010/T011. T012 after T005 and T007. T014 after T007. T016 after T011.
Agents editing files run one at a time in this tree; reviews in T018 run in parallel.
