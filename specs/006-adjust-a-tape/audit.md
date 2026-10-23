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
