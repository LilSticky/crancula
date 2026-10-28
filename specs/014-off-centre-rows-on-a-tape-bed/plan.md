# Implementation Plan: Off-centre rows on a Tape Bed

**Branch**: `014-off-centre-rows-on-a-tape-bed` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md) | **Issue**: [#163](https://github.com/LilSticky/crancula/issues/163)

**Input**: Feature specification from `specs/014-off-centre-rows-on-a-tape-bed/spec.md`

## Summary

The Tape Bed gains an optional `guideMargin` (absent = centred, like `tapePerCrankTurn` on the Organ). The Border
becomes a pair, `Borders {guide, far}`, computed in one place (`tapeBedFit`), and `TapeGeometry` carries it
instead of a single `border`. Every row position already flows through `tapeGeometry` (`rowCentres`, `slots`)
or the Tape Bed miniature, so the Tape view, import preview, plotter SVG, Tape pieces, side-by-side cuts and
Cutting Problems follow without their own changes; only the code that draws the two Border strips (Tape view,
Organ editor drawing) and the one-row hit fallback read the pair. `validateOrgan` checks the Guide margin
against both Borders. The Organ library snapshot goes to version 6 (ADR 20) and reads versions 1–5 as
centred. The Organ editor gets an optional Guide margin field and shows both Borders; the 20er and 31er
Drehorgel Presets fill 10 mm and 11 mm. Details in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript (strict), Angular 22, Electron (current major, ADR 14)

**Primary Dependencies**: none new

**Storage**: `<userData>/snapshots/organs.json` goes from version 5 to 6 (`tapeBed.guideMargin`, optional),
migrated on read (ADR 20). No new file or channel.

**Testing**: Vitest in node (`tapeBedFit`/`borders`, `validateOrgan` Guide margin rules, snapshot v5→v6 and
round trip, `tapeGeometry` row centres and borders, `plotterSvg` positions for the 20er example and byte identity
for a centred Organ, Presets, miniature); Vitest in jsdom (Organ editor field, both Borders, fit text, drawing,
error messages, i18n); Playwright e2e `e2e/organ-guide-margin.spec.ts` (enter, save, restart, Tape view Border
strips).

**Target Platform**: Electron desktop on Windows, macOS, Linux

**Project Type**: desktop app (Angular renderer, Electron main, shared `api/`)

**Performance Goals**: none new; the fit recomputes per keystroke as today

**Constraints**: positions within 0.01 mm (SC-001); a centred Organ's SVG byte-identical to before (SC-002);
lengths compared with the existing 1e-9 mm tolerance

**Scale/Scope**: one optional number per Organ

## Constitution Check

| Principle | Check | Result |
|-----------|-------|--------|
| I. Domain-Driven Slicing | Capability "Off-centre rows on a Tape Bed"; Guide margin, Border (guide side, far side) in DICTIONARY.md, approved 2026-10-28 | Pass |
| II. TDD | Each task starts red; the 20er/31er numbers in the spec drive the domain tests | Pass |
| III. Framework-Free Domain | Fit, Borders, validation, snapshot, geometry and Presets in `api/organ` and `api/tape`; the editor only shows them; a negative Border stays unrepresentable in a valid Organ | Pass |
| IV. Memory First | Organ library store stays the truth; `organs.json` v6 written by main, v1–5 migrated on read (ADR 20) | Pass |
| V. Strict Electron Boundary | No new channel; the existing snapshot parser validates `guideMargin` (FR-009) | Pass |
| VI. Context Never Gets Lost | STATUS, ROADMAP, CHANGELOG (snapshot bump) at the end; no ADR needed | Pass |
| VII. Small Vertical Slices | US1+US2 the value; US3 migration; US4 Presets on top | Pass |

**ADR**: none needed. The snapshot bump follows ADR 20; nothing crosses the IPC boundary that didn't before.
Post-design re-check: unchanged, pass.

## Project Structure

### Documentation (this feature)

```text
specs/014-off-centre-rows-on-a-tape-bed/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/organ-snapshot-v6.md, contracts/organ-editor-ui.md
└── tasks.md (next: /speckit-tasks)
```

### Source Code (repository root)

```text
api/organ/
├── organ.ts                    # TapeBed.guideMargin?; Borders; tapeBedFit → {rowSpan, borders}; borders(organ) (R1, R2)
├── organ-draft.ts              # tapeBed.guideMargin: number | null
├── validate-organ.ts           # guide-margin-below-half-hole, guide-margin-too-large (R3)
├── organ-library-snapshot.ts   # version 6; v1–5 read centred (R4)
└── organ-preset.ts             # 20er: 10 mm, 31er: 11 mm (R7)
api/tape/tape-geometry.ts       # borders instead of border; rowTop from borders.guide
api/index.ts                    # exports Borders, borders
app/organ-library-file.spec.ts  # fixtures to version 6 (test only)
src/app/features/organ/
├── organ-editor/organ-form.ts            # guideMargin field label, change detection
├── organ-editor/organ-editor.component.ts# fit text and drawing from Borders (R5)
├── organ-editor/tape-bed-sheet/          # Guide margin field; Border per side; drawing strips
└── tape-bed-miniature.ts                 # first row from borders.guide
src/app/features/tape/tape-view/
├── tape-drawing.ts             # outline().borders from Borders
└── pointer-at.ts               # one-row fallback (R6)
src/assets/i18n/{en,de}.json    # ORGAN.EDITOR.GUIDE_MARGIN(_HINT), BORDER_*, FIT_OFF_CENTRE*, TAPE_BED_DRAWING_OFF_CENTRE*, ORGAN.ERROR.GUIDE_MARGIN_*
e2e/organ-guide-margin.spec.ts  # Stories 1–3 in real Electron
```

**Structure Decision**: the Guide margin is part of the Tape Bed value in the Organ aggregate; the geometry
reads it through `tapeBedFit`, so no Tape or Plotter code learns about it.

## Decisions left open by the spec

- **Wording of the Border field**: centred Organs keep today's one field and "on each side" texts; off-centre
  Organs show "8.5 mm guide side · 25.35 mm far side" in the same read-only field (R5).
- **One-row hit test**: with one row the Border fallback becomes "the whole Tape width hits row 1" (R6).
- **Preset values**: 20er 10 mm and 31er 11 mm from the gamma files; Organs already made from them stay as they
  are (R7).

## Complexity Tracking

None.
