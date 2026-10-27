# UX review: Cut a tape in pieces (2026-10-26)

Screens from `e2e/ux/plotters.capture.ts` (`npm run ux:screens`), 1280×800, in
`documentation/design/screens/current/`: `24-plotter-list-empty`, `24b-plotter-list` (+ `-dark`),
`25-plotter-editor-sheet` (+ `-dark`), `25b-plotter-editor-roll`, `26-tape-view-joins` (Whole Tape, + `-dark`),
`26b-tape-view-joins-german`, `26c-tape-view-join-one-to-one` (+ `-dark`), `27-tape-view-no-join-stretch`
(Whole Tape, + `-dark`), `28-tape-view-too-wide` (+ `-dark`). Contrast measured on the PNG pixels (WCAG
relative luminance).

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 3  | 3  | 4  | 3  | 2  | 3  | 3  | 2  | 4  | 5   | 32/50 |

## Measured contrast (non-text UI parts need 3:1)

| Mark | Light | Dark |
|------|-------|------|
| Overlap band fill vs. paper | **1.24:1** | **1.22:1** |
| Join line (blue dashed) vs. paper | 5.65:1 | 4.78:1 |
| Stretch mark fill vs. paper | **1.21:1** | **1.20:1** |
| Stretch mark outline (red-brown, ~1 px) vs. paper | 4.89:1 | 4.32:1 |

The paper stays tan in dark mode, so both schemes behave alike: the fills fail, the lines pass.

## Findings

1. **[sev 3] H8/H6 · 26, 26c (light and dark)**: the Overlap band is a grey-brown fill at 1.24:1 (light) and
   1.22:1 (dark) against the paper; at Whole Tape it is a faint 2-mm smudge, and it carries its meaning by a
   slight colour shift only. Fix (`src/app/features/tape/…` tape drawing styles): give the Overlap a ≥3:1
   treatment, e.g. a diagonal hatch (SVG `<pattern>`) in the Join colour at ~35 % opacity plus 1 px edges at
   both ends, using one theme token for light and dark.
2. **[sev 3] H8/H6 · 27 (light and dark)**: the no-join stretch fill is 1.21:1 / 1.20:1; only its ~1 px
   red-brown outline (4.9 / 4.3:1) sets it apart, and on the Whole Tape the outline merges with the Column
   grid. Fix: a stronger fill (warning/error container token with hatch) and a 2 px outline, plus a small
   warning glyph or "No Join" label at the stretch's start, so it reads without colour.
3. **[sev 3] H5 · 28 (light and dark)**: the too-wide reason ("The Tape is 100 mm wide, the Plotter's working
   width is 90 mm") is plain body text under the picker, with no warning icon or colour, nothing on the Tape,
   and Export for the Plotter still looks ready. Fix (side panel Plotter section): show it as an error-styled
   message with an icon (same pattern as the Cutting Problems count), add what to do ("pick a wider Plotter or
   change its working width") with a link to the Plotter, and show the export button's problem state.
4. **[sev 3] H5/H2 · 27**: the side panel says "Can't be cut in pieces: see Cutting Problems", but the
   Cutting Problems section is scrolled out of view above. Fix: make "Cutting Problems" a link/button that
   scrolls to and focuses that section (or selects the stretch on the Tape).
5. **[sev 2] H6 · 26, 26b**: the overview strip under the drawing shows no Joins/Overlaps, and Joins are
   unlabelled; at 1:1 (26c) nothing says which pieces meet. Fix: draw Join ticks in the overview strip and a
   small "1 | 2" piece label (or tooltip) at each Join on the ruler.
6. **[sev 2] H4/H7 · 25, 25b (light and dark)**: the Plotter editor stacks fields edge to edge with no gap;
   each outlined field's floating label overlaps the border of the field above, and the card has no inner
   padding, unlike the Organ editor. Fix (plotter editor template/SCSS): reuse the Organ editor's form grid
   and section spacing (`gap` between fields, card padding), and keep Working length beside Working width with
   the Roll plotter switch above both, so the roll layout (25b) just hides one field instead of reflowing.
7. **[sev 2] H7 · 26, 27, 28**: the side panel heading "Plotters" and the picker label "Plotters" repeat
   each other, and the label is plural for a single choice. Fix (i18n en/de): heading "Plotter" / label
   "Cut with" (or drop the label and use `aria-label`).
8. **[sev 2] H2 · 26, 27, 28**: with a Plotter picked, the Plotter section sits at the bottom of a long side
   panel (picker, piece count and problems scrolled far down); after a pick the side panel jumps. Fix: move
   the Plotter section next to Cutting Problems near the top, or show "Cut in 3 Tape pieces" in the page
   head beside Export for the Plotter.
9. **[sev 1] H7 · 24b**: the roll plotter row leaves the Overlap cell empty. Fix: show "—" (or "none, roll")
   so the column does not look broken.
10. **[sev 1] H1 · 25, 25b**: the editor has no subtitle explaining Working area and Overlap, and no Cancel or
    back affordance beside Save. Fix: a one-line hint under the title, as the Plotter list has, and a text
    Cancel button.

## Strengths

- The Join line itself is clear in both schemes (≥4.7:1), and the dashed style reads as "cut here".
- The empty Plotter list guides onward with one primary action and a scissors icon that matches the rail.
- The Plotter list's "300 × 120 mm" / "roll, 90 mm wide" summary is compact and in millimetres.
- German texts fit; the compact page-head icons keep the Tape the visual centre in 26b.

## Contrast measured (#190)

Measured on the rendered pixels of `npm run ux:screens` at 1×, Whole Tape: `26-tape-view-joins` (+ `-dark`) for the Overlap
band, `27-tape-view-no-join-stretch` (+ `-dark`) for the stretch. Ink is the hatch: the Overlap pixels with blue over red
(b − r > −15), the stretch pixels with r − g > 40 (drops the label, Holes and row guides). Neighbour is the Tape next to the
mark (mode). Ratio is WCAG 2 on sRGB relative luminance. Criterion: the **p10** ink pixel (the darkest 10 %, so one
anti-aliased peak does not decide it) at ≥ 3:1 against the Tape.

| Mark (light / dark) | Before: p10 ink | After: p10 ink | Before: darkest / mean | After: darkest / mean |
|---------------------|-----------------|----------------|------------------------|-----------------------|
| Overlap hatch | 2.15:1 (#8f948b) / 2.01:1 (#878c85) | **3.40:1** (#627382) / **3.05:1** (#526f90) | 2.99 / 1.81 ; 2.71 / 1.74 | 4.31 / 2.43 ; 3.81 / 2.28 |
| Stretch hatch | 2.80:1 (#a67359) / 2.59:1 (#9a6f51) | **4.23:1** (#925041) / **3.77:1** (#8f4c3d) | 4.55 / 2.33 ; 4.00 / 2.18 | 6.30 / 2.92 ; 5.57 / 2.68 |
| Stretch ground (tint, 0.2) | 1.38:1 (#d2b38a) / 1.35:1 (#c5a67d) | unchanged | – | – |

Tape neighbour: #e8d6a4 (light), #d8c593 (dark). The fix is the hatch stroke opacity, not a colour token: `.overlap-hatch`
0.5 → 1 and `.stretch-hatch` 0.6 → 1 in `tape-view.component.scss`. Both schemes use the same token, so both move.

Remaining, by design: the mean over the band stays at 2.3–2.9:1 because the hatch has gaps; the lines carry the 3:1.
The Overlap edges are 1 px solid Join colour (5.6:1 as a solid colour), and the stretch outline is 2 px oxblood (4.9:1 in
the review above). The stretch ground tint stays at 1.4:1: it is a hint, and the hatch and the outline mark the stretch.
Not re-measured: the 1:1 captures (`26c-…`, `26b-…`), which use the same tokens at a different scale.
