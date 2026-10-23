# Audit: 006 Adjust a tape

Tests: 1147 passed (60 files). Lint --quiet: clean. e2e not run here (CI gate).

## Coverage
- US1 AC1 (5 -> 10 mm, same Holes): change-column-length.spec, tape-view spec (T008), e2e: covered
- US1 AC2 (restart): e2e: covered
- US1 AC3 (0, negative, text refused): tape.spec, change-column-length.spec, section spec column-length-error: covered
- US1 AC4 (same value, no undo step): section spec (Apply disabled for "5"/"5,0"), domain spec: covered
- US1 AC5 / FR-010 (German comma): section spec T017 `de` tests: covered (field, input, hint)
- US2 AC1 / FR-006 / SC-003 (counts before apply): column-length-change.spec, section hint tests: covered
- US2 AC2-3 (marks follow): tape-view spec "lists and marks the Cutting Problems": covered
- US3 AC1-3 / FR-007 (undo, redo, order, menu): tape-view spec T015, e2e T016 menu Undo: covered
- FR-003 (Organ, Song, Parts, Transposition kept): change-column-length.spec: covered
- FR-004 (everything in mm follows): drawing, length text, status line tested; ruler, Hole lengths/gaps not asserted explicitly: partial
- FR-011 (en/de): i18n:check not run by me; T001/T017 done

## Gaps
- Task boxes: T017 is not ticked although its tests exist; T018-T020 open (reviewer, ux:screens, docs).
- No e2e check of the Tape list / import prefill after a change (edge case): missing, low risk.
- No scope creep seen.

## UX review: Column length field and hint (T019, 2026-10-23)
Capture: `documentation/design/screens/current/08g-tape-view-column-length-hint.png` (new, `e2e/ux/screens.capture.ts`; Blip Tape, 1280x800, English, typed "3" not applied). Scope: only the Column length field and hint, no full rubric.

- H5/H8, severity 3: the side panel scrolls horizontally (a horizontal scrollbar sits under it). In the Tape section the "mm" unit, the Apply button ("App...") and the hint ("Cutting Problems: 1 now, 1 w...") are cut off at the panel edge; the Organ name ("White ke...") and the Length and Lead-in values too. The user cannot read the "after" count nor press Apply without scrolling sideways. German text (~30 % longer) will be worse. Likely the field's row has a fixed width wider than the panel; the hint should wrap.
- H4, severity 2: label "Column length" wraps to two lines in the left column, while the field takes the width; the field is wider than the panel. A stacked layout (label above, field, Apply below) would fit.
- H5, severity 2: the hint sits right-aligned under the field, away from the field's left edge, and is easily mistaken for static text; no icon or color marks it as a preview of what Apply will do. Clear when readable, weak otherwise.
- H1, severity 1: the Tape section sits below Cutting Problems and Add a Hole, so the field is off-screen until scrolled to; fine for a rare action.
- Positive: the field keeps its focus ring and the typed value, Apply is not yet pressed, and the hint appears next to the cause (H5).

Blocks merging? The clipping (severity 3) makes the hint unreadable at 1280x800 and should be fixed or filed as an issue before merge; no finding blocks a task outright (severity 4 none).
