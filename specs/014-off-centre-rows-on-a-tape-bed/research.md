# Research: Off-centre rows on a Tape Bed

## R1 Where the Guide margin lives

- **Decision**: `TapeBed.guideMargin?: Millimetres`, absent when centred; `OrganDraft.tapeBed.guideMargin:
  number | null`. A valid Organ never stores `undefined` explicitly (spread only when present), as with
  `tapePerCrankTurn`.
- **Rationale**: the dictionary puts it on the Tape Bed; optional matches decision 37 and keeps centred Organs'
  values and snapshots unchanged.
- **Alternatives**: a `{kind: 'centred'} | {kind: 'guided', guideMargin}` union. Rejected: one optional number
  says the same and matches the existing optional Organ fields.

## R2 One place for the Borders

- **Decision**: `interface Borders {readonly guide: number; readonly far: number}`. `tapeBedFit(tapeBed,
  pipeCount)` returns `{rowSpan, borders}`: centred → both `(tapeWidth − rowSpan) / 2`; guided → `guide =
  guideMargin − holeDiameter / 2`, `far = tapeWidth − rowSpan − guide`. `border(organ)` becomes
  `borders(organ)`. `TapeGeometry.border` becomes `borders: Borders`; `rowTop(i) = borders.guide + i ×
  rowSpacing`.
- **Rationale**: every row position already derives from `tapeGeometry` or the miniature; replacing the single
  number with a pair makes every consumer that assumed symmetry fail to compile, so none is missed.
- **Consumers found**: `tape-geometry.ts`, `tape-bed-miniature.ts`, `organ-editor.component.ts` (fit, drawing),
  `tape-drawing.ts` (`outline().borders`), `pointer-at.ts` (one-row fallback). SVG, Tape pieces, side-by-side,
  Cutting Problems and export refusals use `slots`/`rowCentres` only.

## R3 Validation

- **Decision**: when `guideMargin` is not null: not finite or ≤ 0 → `must-be-positive`; below `holeDiameter / 2`
  → `guide-margin-below-half-hole` `{min}`; above `tapeWidth − (rowSpan − holeDiameter / 2)` → `guide-margin-too-large`
  `{max}`. All on path `tapeBed.guideMargin`, with the 1e-9 mm tolerance. When the rows exceed the tape width
  at all, only the existing `pipes-exceed-tape-width` is reported. The max check runs only when Tape Bed and
  Pipes are valid.
- **Rationale**: FR-004 asks which side and why; the message names the limit to type. Adding Pipes raises the far
  side's demand, so `guide-margin-too-large` also appears after adding Pipes (spec US1 scenario 5).

## R4 Snapshot version 6

- **Decision**: `version: 6`; `tapeBed.guideMargin` present only when set. Versions 1–5 read without it (any
  `guideMargin` key there is ignored); version 6 reads it when present and refuses a non-number. Validation
  through `validateOrgan` as today.
- **Rationale**: ADR 20, as earlier bumps. Writes stay byte-identical for centred Organs apart from the version.

## R5 Organ editor

- **Decision**: an optional "Guide margin" field after "Spacing between rows", suffix mm, hint "Guide edge to
  the centre of row 1; empty: rows centred". The read-only Border field shows one value with the hint "On each
  side, the rows are centred" when centred, and "8.5 mm guide side · 25.35 mm far side" with the hint "Guide
  side is row 1's edge" otherwise. Fit and drawing texts gain `_OFF_CENTRE` variants naming both Borders. The
  drawing's strips use `borders.guide` (top) and `borders.far` (bottom).
- **Rationale**: keeps centred Organs exactly as today (no visual change for existing users).

## R6 One-row hit test

- **Decision**: `pointer-at.ts` uses half the row spacing between two rows; with one row it falls back to the
  whole Tape width (every y on the Tape hits row 1), instead of the single Border.
- **Rationale**: with one row there is nothing else to hit; a symmetric Border no longer exists.

## R7 Presets

- **Decision**: 20er-Drehorgel `guideMargin: 10` (far side 25.35 mm); 31er-Drehorgel `guideMargin: 11` (far side
  11.95 mm); the 20er doc comment drops "until the Tape Bed can be off-centre (#163)".
- **Rationale**: issue #163 needs; both values from the gamma files named in `organ-preset.ts`.
