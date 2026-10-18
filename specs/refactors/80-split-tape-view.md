# Refactor 80: split the Tape view (no behaviour change)

Existing `tape-view.component.spec.ts` stays the safety net and must stay green untouched.
New input-only components live in subfolders of `src/app/features/tape/tape-view/`, are OnPush, render the
same markup and `data-testid`s as today (host element wraps the same `<section>`/`<div>`), take pre-formatted text.

## Components

- `cranc-tape-section` (`tape-section/tape-section.component.ts`): `TapeSectionComponent`.
  Input `view = input.required<TapeSectionView>()`;
  `TapeSectionView = {organId, organName, columnLengthText, lengthText, lengthMmText, leadInMm, leadInText, holesText, partNames: readonly {index, name: string | undefined}[]}`.
  Moves the `tape-section` `<section>` (dl, Organ routerLink, Parts list). Imports TranslatePipe, MatButton, RouterLink.
- `cranc-selected-hole` (`selected-hole/selected-hole.component.ts`): `SelectedHoleComponent`.
  Input `inspection = input.required<SelectedHoleView | undefined>()`;
  `SelectedHoleView = HoleInspection & {rowText, fromText, toText, lengthColumnsText, lengthMmText, gapColumnsText, gapMmText, warnings: {kind, mmText, minimumText}[]}` (the object `inspection` computed returns today).
  Moves the `selected-hole` `<section aria-live>` incl. warnings. Imports MatIcon, TranslatePipe.
  The formatting (the `inspection` computed's text part) moves to a pure function `selected-hole-view.ts`
  `selectedHoleView(inspection, language): SelectedHoleView` (own spec when extracted; covered by view spec until then).
  The hole `aria-label` in the SVG keeps reading `inspection()` in the parent.
- `cranc-tape-status-line` (`tape-status-line/tape-status-line.component.ts`): `TapeStatusLineComponent`.
  Inputs `pointer: PointerText | undefined` (`{column, mm, row: string | undefined, note}`, exported type; replaces the inline type of `pointerText`),
  `zoom: Zoom`, `saveProblem: {reason: string} | null`. Moves the `status-line` div.

TapeViewComponent keeps: route/library wiring, zoom, selection, keyboard, side panel, export, ruler/overview SVG, hole SVG.

## Helper for pointer, scroll, ResizeObserver

`tape-view/stage-metrics.ts` (not a component): `stageMetrics(scrollElement: Signal<ElementRef<HTMLElement> | undefined>)`
called in the TapeView injection context; owns the signals `stageWidth`, `stageClientWidth`, `stageScrollWidth`,
`scrollLeft`, `clientWidth`, the ResizeObserver effect, `onScroll(element)`, `readStage(element)` and `windowWidth`.
Pointer mapping (`onPointerMove` -> `pointerAt`) stays a pure call, wrapped in `pointerText` building.
Unit-test through the existing view spec; add a spec only if logic is extracted as pure functions.

## Splitting `drawing`

Replace the one computed with small computeds, `drawing` becomes a thin composition (same shape for the template):
`visibleRange` (visibleColumns), `sectionView` (feeds `cranc-tape-section`, replaces the text fields), `rowLabels` (labels, rows),
`holeRects` (holes incl. `selected`), `columnMarks` (marks, numbers, rulerNumbers), `outline` (leadIn, leadInPath, bodyWidth, borders,
width, height, totalHeight, numbersY). `drawing` stays the guard for "Tape and Organ available" (the redirect effect and the
afterEveryRender scroll logic read it).

## Order

1. Components + `TapeStatusLineComponent` / `SelectedHoleComponent` / `TapeSectionComponent` specs green.
2. Stage helper. 3. Split `drawing`. After each step the existing view spec stays green.
