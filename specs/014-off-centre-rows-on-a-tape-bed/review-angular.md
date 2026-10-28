# Review: slice 014, Angular and terms

From `angular-reviewer` and `domain-modeler`, 2026-10-28. No must-fix findings.

## Angular

1. Should fix: `organ-editor.component.ts` holds domain rules (`fits()`, `rowSpan > tapeWidth`, the row-centre
   formula). Move them to `api/organ/organ.ts` (`tapeBedFits`, `rowCentres`) and reuse them in
   `tape-bed-miniature.ts` and `tape-geometry.ts` (ADR 2).
2. Should fix: `translate.instant('ORGAN.EDITOR.BORDER_SIDES')` inside a `computed`; pass the numbers to the
   sheet and translate there with the pipe.
3. Should fix: `far?` and `bottomBorder?` in `tape-bed-sheet.component.ts` are always set; make them required.
4. Nit: derive `guided` in the sheet from the form instead of an input.
5. Nit: "x mm guide side · y mm far side" in one readonly field may be cut off (German is longer); show two
   readonly fields, Border guide side and Border far side, each with the mm suffix.
6. Nit: round both `bottomBorderTop` and the far-side strip, or neither.

## Terms

7. `organ-preset.ts`: "off-side margin" → far side.
8. `de.json`: "Die Führungsseite ist der Rand von Reihe 1" uses Rand for the Tape's edge; say Bandkante.
9. `de.json`: "Führungskante" is not in the dictionary; rephrase without it (Bandkante an Reihe 1).
10. "far edge" where far side is meant: `organ.ts`, spec.md.
11. `border`/`bottomBorder`/`bottomBorderTop` in the editor's drawing model and the `{{border}}` parameter mean
    the guide side; rename to guide/far.
12. Open, not changed: UI prose writes "border" in lower case, as before this slice.

## Outcome

All of 1–11 are fixed in the follow-up commit.
