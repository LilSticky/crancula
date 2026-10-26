# Audit: 011 Cut a tape in pieces (spec-auditor, 2026-10-26)

Scope: T001-T058 ticked, T059-T063 open. Tests: `npm run test` green (node 1482 in 71 files, ng 1721 in 83 files). `npm run lint -- --quiet` green. e2e, build and i18n:check were not run.

## Coverage

| Requirement / scenario | Covering tests | Status |
|---|---|---|
| US1 1, 6 (describe, list, restart) | `e2e/plotter-library.spec.ts`, plotter-library snapshot/file/ipc specs, store spec | covered |
| US1 2-5, 7 (SVG only, roll toggle, validation, Overlap < length, comma) | `plotter-editor.component.spec.ts`, `plotter-form.spec.ts`, `validate-plotter.spec.ts` | covered |
| US2 1, 4, 5, 6 (geometry, repeated Holes, Joins, outlines) | `tape-pieces.spec.ts`, `tape-piece-geometry.spec.ts` | covered |
| US2 2 (folder dialog, files, told where) | `e2e/tape-pieces.spec.ts`, `app/plotter-ipc.spec.ts` (savePieces), `plotter-export.spec.ts` | covered |
| US2 3, 7 (true size, cuts only, order) | `plotter-svg.spec.ts` | covered |
| US2 8, 9, 10 (one piece, no Plotter, re-export) | `plotter-export.spec.ts`, e2e | covered |
| US3 1, 9 (picker, count, Joins drawn) | `plotter-section.component.spec.ts`, `tape-view.component.spec.ts`, `tape-drawing.spec.ts`, e2e | covered |
| US3 2-5 (Cutting Problem named, listed, scroll, live update, several) | `tape-pieces.spec.ts`, `cutting-problems.spec.ts`, `cutting-problems.component.spec.ts`, `tape-view.component.spec.ts`, e2e (100 -> 70 Columns) | covered |
| US3 6, 7, 8 (none without or with roll, export refused, too wide) | `cutting-problems.spec.ts`, `plotter-export.spec.ts`, e2e | covered |
| US4 (roll plotter) | `tape-pieces.spec.ts`, `plotter-section.component.spec.ts`, e2e 120 and 90 mm | covered |
| US5 1-5 (change, unsaved warning, remove, same name, link) | editor and list specs, `tape-view.component.spec.ts`, `e2e/plotter-library.spec.ts` | covered |
| US6 / FR-026 / SC-008 | `plotter-i18n.spec.ts`, e2e German | covered |
| FR-006 (picking changes no Tape or undo; usable during Preview) | `tape-view.component.spec.ts` | covered |
| FR-008, FR-009, FR-010, FR-011 | `tape-pieces.spec.ts`, including the generated minimum-count property | covered |
| FR-014 (same geometry as the Tape view) | `tape-piece-geometry.spec.ts`; no test compares a piece Hole directly with the Tape view | partial |
| FR-019 (every reason listed, no dialog) | `plotter-export.spec.ts` | covered |
| FR-021 (replace question, folder, naming) | `plotter-ipc.spec.ts`, `tape-piece-file-name.spec.ts`, e2e | covered |
| FR-023 (no Plotter adjustment or marks) | `plotter-svg.spec.ts` "only cuts"; not repeated per piece | partial |
| FR-024 (cancel, failed write names the file) | `plotter-ipc.spec.ts`, `plotter-export.spec.ts` | covered |
| FR-025 (export changes nothing) | `plotter-export.spec.ts` | covered |
| SC-002, SC-003, SC-004 | geometry and pieces specs, generated Tapes | covered |
| SC-005 (0.2 s) | `cutting-problems.spec.ts`, performance test | covered |
| SC-006 (0 files, reasons named) | `plotter-export.spec.ts`, e2e | covered |
| SC-007 (byte-identical without a Plotter) | `plotter-svg.reference.svg` fixture test | covered |
| SC-001 (2 min and 30 s) | none; manual | missing, unmeasurable |
| Edge: Organ changes recompute | Lead-in and Column length tested; tape width, Minimum Gap and Pipes not tested in `tape-view.component.spec.ts` | partial |
| Edge: Hole with no Pipe does not block a Join | `tape-pieces.spec.ts` | covered |
| Edge: Lead-in + Overlap >= working length, Column too long | `tape-pieces.spec.ts` | covered |
| Edge: more than 9 pieces, numbering | `tape-piece-file-name.spec.ts` | covered |

## Tasks

- No task is ticked without a matching change: every file named in T001-T058 exists and has a spec.
- T059-T063 are open and are the only unticked tasks. Nothing was skipped silently.
- Not yet run: the full e2e suite, `npm run build` and `npm run i18n:check`. T061 requires them, and no result is recorded.

## Tests without a criterion

- No scope creep found.
- Only minor extras: the leave-dialog field naming, the "roll change counts as unsaved" case and the save-failure editor cases (Edit/Retry) all stem from the Organ editor parity in FR-003.

## Verdict

Slice 011 is spec-complete for T001-T058. The partials above are small: no per-piece FR-023 check, Organ-change edge cases only partly tested, and no direct FR-014 test. Open items are T059-T063: ux screens, reviews, gate, quickstart by hand, docs and PR.
