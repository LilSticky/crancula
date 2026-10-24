# UX review: Tape view and Organ editor, slice 008 (2026-10-24)

Screens: `documentation/design/screens/current/` 08b, 08d, 08e, 08g, 04, 10, 14 (from `npm run ux:screens`).
Gap: no screen shows the Spot, the Crank speed slider or the playing playhead (Preview is disabled in every
capture). Their review rests on 08b/08d (grips, playhead grip) and on the Organ editor fields only.
The `ux:screens` script should capture them (follow-up).

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 4  | 3  | 2  | 4  | 4  | 4  | 3  | 4  | 5   | 37/50 |

## Findings
1. **[sev 3] H4 · 10-organ-editor-german** — The Crank speed range fields break in German: labels cut off
   ("Langsamste Kurbelges…"), the unit "Umdrehungen pro Minute" wraps onto two lines and touches the value
   ("30Umdrehungen"; "12Umdrehungen" hides that the value is 120). Also in EN (04): "Tape per Crank turn"
   label collides with the unit ("mm..") and the field looks empty. Fix in this slice: shorter unit suffix
   ("U/min", "turns/min"), let labels wrap or shorten them ("Langsamste Drehzahl"), and give the field a
   fixed unit-suffix width.
2. **[sev 2] H3 · 04, 10** — The Tape Bed card grows tall: Lead-in is stretched to the height of the
   neighbouring "Tape per Crank turn" hint (four-line hint in a narrow column), and the German summary line
   ("31 Reihen belegen ...") is clipped under the card. Fix in this slice: put the hint below the row (full
   width) or shorten it; align the row to the top (`align-items: start`).
3. **[sev 3] H8 · 08b, 08d** — The grips outside the selected Hole are about 6 px blue dots, far under the
   24 px target minimum, and sit on top of the Hole when it is short (08d: a 2.5 mm Hole is covered by two
   grips and the Spot). Hard to hit by mouse, impossible by touch ("edit by touch" is the slice goal). Fix in
   this slice: invisible hit area of at least 24 px around each grip, with the dot drawn small; push the
   grips outward past the Hole end.
4. **[sev 2] H8 · 08b** — The playhead grip is a tiny triangle above the ruler (about 8 px). Same fix:
   a 24 px hit area, plus a grab cursor and a `focus-visible` ring.
5. **[sev 2] H5 · 08d, 08g** — The "Organ saved" toast stays in front of unrelated Tape edits (it is the
   leftover of the earlier Crank speed save) and no feedback shows that a changed Crank speed was saved on
   the Organ while the user is on the Tape view. Fix later: toast text naming the Crank speed ("Crank speed
   saved on the Organ").
6. **[sev 2] H1 · 08b, 08d** — The side panel scrolls inside itself with a horizontal scrollbar, and the
   Selected Hole text scrolls out of view as soon as a Cutting Problem appears (08d starts mid-hint). Fix
   later: drop the horizontal overflow (long hint line "To the end of the Tape: 16 Columns, 40 mm" is
   clipped), pin Selected Hole to the top.
7. **[sev 2] H3 · 14-tape-view-compact** — At 1024 px the segmented control "Whole Tape / 1:1 / 2:1" is
   clipped ("2:" cut off) and the title block wraps to three lines. Fix later: allow the toolbar to wrap or
   collapse the zoom levels into a menu.
8. **[sev 1] H7 · 08b** — Selected Hole hints are set in a very small font next to normal text; the Tape
   panel mixes a serif heading with sans labels at three sizes. Fix later: one caption size.
9. **[sev 1] H9 · 08e** — Dark mode keeps the paper tape tan, which is good, but the blue grips and playhead
   have low contrast on it in dark mode (about 3:1 at best). Fix later: use a lighter blue in the dark theme.

## Strengths
- The Tape stays the visual centre, with true proportions, a 1 mm ruler, Column numbers and note labels (H6).
- Selection, edit, undo and redo read as one coherent set (08b, 08d, 08f); keyboard hints are shown where
  needed.
- The Cutting Problems list names Pipe, Column and the exact numbers (2.5 mm vs. 4 mm minimum) with a
  locate button.
- The Column length hint ("1 now, 1 with 3 mm") previews the effect before Apply (08g).
- The Organ editor keeps one calm, paper-craft look in light and dark and uses Material fields consistently.

## Fix in this slice vs. later
- This slice: 1, 2 (Organ editor field layout, German), 3, 4 (touch-sized grips).
- Later: 5 to 9, and capture Spot, slider and playing state in `ux:screens`.
