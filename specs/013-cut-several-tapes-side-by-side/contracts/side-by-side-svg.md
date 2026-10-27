# Contract: The side-by-side SVG file

`sideBySideSvg(cut)` in `api/tape/plotter-svg.ts`. Same conventions as the single-Tape file of spec 003:
millimetres 1:1, numbers rounded to 0.001 without trailing zeros, stroke `#000000` 0.1, no fill, only cuts.

## Document

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="{length}mm" height="{usedWidth}mm" viewBox="0 0 {length} {usedWidth}">
  <!-- Lane 1: every Hole in spec 003 cut order (start, then row), y moved by top_1 = 0 -->
  <path d="…" …/>
  <!-- Lane 1: its Tape Outline -->
  <path d="M0,{top} H{totalLength} V{top + width} H{leadIn} Z" …/>
  <!-- Lane 2: Holes, then Tape Outline, y moved by top_2 -->
  …
</svg>
```

- `length` = the longest Lane's `totalLength`; `usedWidth` = far edge of the last Lane (FR-011).
- Every Lane's Lead-in tip at x = 0 (FR-010); a shorter Lane ends at its own end cut, the rest is uncut.
- Lane `i` lies from `top_i` to `top_i + width_i`; `top_{i+1} = top_i + width_i + tapeSpacing` (FR-009).
- Holes of a Pipe not on the Organ are not in the geometry, so not cut (as spec 003).

## Worked example (quickstart)

Reference Tape (100 mm, 652 mm) and "Waltz" (60 mm, 400 mm), spacing 3 mm:
`width="652mm" height="163mm" viewBox="0 0 652 163"`; Lane 1 Outline `M0,0 H652 V100 H50 Z`; Lane 2 Outline
`M0,103 H400 V163 H{Waltz's Lead-in} Z`.

## Identity

For one Lane, `sideBySideSvg(sideBySideCut([{tape, organ}], plotter))` ===
`plotterSvg(tapeGeometry(tape, organ))`, byte for byte (Story 2 scenario 5), checked against
`api/tape/plotter-svg.reference.svg`.
