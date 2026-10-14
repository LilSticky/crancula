# UX review: variant b-drafting-table, mockup.html (2026-10-15)

Screens: `screens/organ-list.png`, `organ-editor.png`, `organ-editor-error.png` (German),
`tape-import.png`, `tape-view.png` at 1280×800; `organ-editor-1024.png`, `tape-view-1024.png` at 1024×700.
Round 1 had one severity 3 finding: in tape-import, the "Tape" step (name, Column length) was below the fold, and the
preview's note labels overlapped at 2.5 px/mm. Fixed by merging Song and Organ into one step and
drawing the preview at 3.4 px/mm. This is round 2.

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 4  | 4  | 4  | 4  | 5  | 4  | 4  | 3  | 4   | 40/50 |

## Findings
1. **[sev 2] H2 · tape-view**: the Tapes tab opens a Tape directly. The mockup has no Tape list pane, and no empty states are shown. Fix: give the Tapes tab the same list | workspace layout as Organs (list of Tapes with Organ, Columns and mm), and collapse the list to a rail while a Tape is open.
2. **[sev 2] H6 · tape-view-1024**: at 1024 px the selected Hole (Column 65) is outside the visible canvas, and the minimap frame keeps the 1280 px width. Fix: scroll the selection into view on open, and compute the minimap frame from the canvas width.
3. **[sev 2] H8 · organ-editor**: MIDI note inputs in the Pipe table are 21 px high, below the 24 px target. Fix: make the whole 26 px cell the hit area (a borderless input that fills the cell, with an outline only on hover or focus).
4. **[sev 2] H10 · organ-editor**: splitting the 31 Pipes into two tables (1–16, 17–31) needs connected `cdkDropList`s, and row order across the split must stay obvious. Fix: use one CSS-columned list with `cdkDropListGroup`, or a single table that wraps into two columns only above 1200 px.
5. **[sev 2] H9 · all screens**: it reads as precise CAD software. Apart from the paper Tape and the cross-section, nothing says barrel organ. Fix: use a Tape-strip logo and the paper colour in the empty states. Optionally, a small Organ silhouette in the Tape Bed drawing.
6. **[sev 2] H5 · organ-editor-error**: the error banner and the inline errors repeat the same four messages, which costs 115 px of height. Fix: collapse the banner to one line ("4 Probleme", with links on expand) once the user has seen the fields.
7. **[sev 1] H3 · organ-list**: the detail pane leaves about 40 % of the height empty. Fix: show recent Tapes larger, or let the Tape Bed drawing grow with the pane.
8. **[sev 1] H4 · tape-import**: the Fit table shows only Transpositions from +3 to +7. Fix: add a "Show all" link (−12 to +12), and keep the stepper in sync with the clicked row.
9. **[sev 1] H7 · tape-import**: the import uses a pane header in place of the page bar the other screens have. Fix: use the same page bar with the breadcrumb and title across the full width.
10. **[sev 1] H10 · all**: Barlow and JetBrains Mono must be bundled in `src/fonts/` (both OFL). The screenshots show the Bahnschrift and Consolas stand-ins.

## Strengths
- All 31 Pipes, the six Tape Bed values and the Save action fit on one screen at 1280×800 and 1024×700.
- The Tape is the hero, drawn at a stated scale with mm and Column rulers. It has note names, a dashed border, tinted sharp rows, a minimap, and a dimension line on the selected Hole.
- A live cross-section of the Tape Bed, plus the check "31 Pipes need 107.5 mm of the 110.0 mm between the borders", turns the numbers into something you can check by eye.
- The import is a real four-step sequence with a Fit table across Transpositions and a live preview. The proposal is labelled, and dropped Drums are explained.
- One signal colour is used consistently: primary button, selection, focus, dimension lines.
- German labels (Lochdurchmesser, Mindestlochlänge, Änderungen verwerfen) fit in the two-column grid, with decimal commas.
