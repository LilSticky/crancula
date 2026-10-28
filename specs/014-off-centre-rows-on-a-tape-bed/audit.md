# Audit 014 Off-centre rows on a Tape Bed

Audited 2026-10-28 against `origin/main...HEAD`.

## Coverage

| Requirement / scenario | Covering tests | Status |
|---|---|---|
| US1.1 empty field, equal Borders, centred hint | organ-editor.component.spec, tape-bed-sheet spec | covered |
| US1.2 enter 10 mm, Borders derived | organ.spec, validate-organ.spec, editor spec | covered |
| US1.3 clear field centres again | editor spec, organ-form.spec | covered |
| US1.4 negative Border refused, field shows why | validate-organ.spec, editor spec | covered |
| US1.5 Pipes change only the far side | validate-organ.spec, organ.spec | covered |
| US1.6 survives restart | e2e/organ-guide-margin.spec, organ-library-snapshot.spec | covered |
| US2.1 Tape view draws the Borders | tape-geometry.spec, e2e (strips of different heights) | covered |
| US2.2 SVG, pieces, side by side, 0.01 mm | plotter-svg.spec, tape-pieces.spec, side-by-side-cut.spec | covered |
| US2.3 no Guide margin means unchanged | plotter-svg.spec | covered |
| US2.4 pointer hits the drawn row | pointer-at.spec | covered |
| US3.1 / US3.2 v5 loads centred, saved as v6 | organ-library-snapshot.spec, e2e v5 seed | covered |
| US4.1 / US4.2 Presets 10 mm / 11 mm | organ-preset.spec, organ-editor-presets.spec | covered |
| US4.3 older Preset Organs stay centred | generic v5 load tests | partial |
| FR-001 to FR-003, FR-004, FR-005, FR-007 | organ, validate-organ, geometry, editor specs | covered |
| FR-006 Tape view, miniature, SVG, pieces, side by side | respective specs | covered |
| FR-006 import preview, Cutting Problems, export refusals | no guided case found | partial |
| FR-008, FR-009 | organ-library-snapshot.spec | covered |
| FR-010a, FR-010 | preset specs, editor spec (German); i18n:check not run | covered |
| SC-001, SC-002 | plotter-svg.spec | covered |
| SC-003 | none (UX) | n/a |
| SC-004 | none (T021, needs the user) | missing, expected |

## Tasks

- Done but not ticked: T002, T004, T006, T008, T010 (Red tasks, specs exist and are green), T016 (e2e exists, 3 tests).
- Ticked but not done: none found.
- Open as expected: T017 to T021.

## Scope creep

None found. The many one-line fixture edits are the `border` to `borders` rename.

## Results

- `npm run test`: 92 files, 2056 tests, all pass.
- `npm run lint -- --quiet`: clean (crancula, crancula-e2e).
- Not run: i18n:check, build, e2e.
