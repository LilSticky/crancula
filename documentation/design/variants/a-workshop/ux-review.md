# UX review: variant a-workshop, mockup.html (2026-10-15)

Screens: `screens/organ-list.png`, `organ-editor.png`, `organ-editor-error.png` (German),
`tape-import.png`, `tape-view.png` at 1280×800; `organ-editor-1024.png`, `tape-view-1024.png` at
1024×700. One round of fixes before this review: the Tape view overflowed to 2400 px wide, the
Tape Bed diagram labels were clipped, the overview strip did not render, link buttons were
underlined. All fixed and re-captured.

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 4  | 4  | 4  | 4  | 5  | 4  | 4  | 5  | 4   | 42/50 |

## Findings
1. **[sev 2] H3 · organ-editor-1024** — At 1024×700 the two-column Pipe rack is 16 rows deep;
   rows 14–16 and 30–31 fall under the action bar and the page scrolls. Fix: 30 px rows at this
   width, or let only the Pipes sheet scroll with a sticky column header.
2. **[sev 2] H6/H8 · tape-view** — At 1:1 the note-name gutter has a 13 px row pitch for 12 px
   labels; readable but tight, and on a 4 mm-row Organ it would be fine, on a 3 mm-row Organ it
   would collide. Fix: below 14 px pitch show only naturals' names (sharps keep the band), or
   switch the default zoom to 2:1 for row spacings under 3.5 mm.
3. **[sev 2] H2 · tape-import** — The Fit sheet says "Notes moved by octaves 2" but names them
   only after Create Tape (in the Import Summary). Fix: make the count expandable to the same list.
4. **[sev 2] H2 · tape-view** — "Export for the Plotter" is the primary button, but Export is a
   later slice. Fix: until that slice ships, show no button (or a disabled one with a tooltip);
   the Tape itself stays the hero.
5. **[sev 2] H3 · organ-editor** — The Pipe rack reads down-then-across (rows 1–11, 12–22, 23–31).
   Row numbers make it unambiguous, but drag-and-drop across columns is fiddly. Fix: drag within
   the rack as one list (cdkDropList with a flowing grid), plus row menu and Alt+↑/↓.
6. **[sev 2] H6 · tape-view-1024** — At 1024×700 the overview strip is below the fold. Fix: put the
   overview strip above the Tape (under the page head) or shrink the side sheet into a collapsible
   panel at this width.
7. **[sev 1] H7 · tape-view** — The side-sheet title "What changed on import" wraps to two lines
   at 292 px. Fix: 19 px → 17 px for side-sheet titles, or a shorter label ("Import Summary").
8. **[sev 1] H5 · organ-editor-error** — In German, the duplicate-Pipe error wraps into a narrow
   column under the input. Fix: let the error span the full rack column width.
9. **[sev 1] H1 · organ-list** — The miniature Tapes in the Organ list use made-up Hole patterns;
   they could be read as real content. Fix: draw only the Tape width and row positions, or a
   real Tape of that Organ.
10. **[sev 1] H2 · organ-list** — "3 Tapes" is plain text. Fix: make it a link to the Tapes list
    filtered by this Organ.

## Strengths
- The Tape is unmistakably the hero: manila, true millimetres, brass ruler, Column numbers,
  natural/sharp banding, and an overview strip with the visible part framed.
- The Organ editor fits one 1280×800 screen: Tape Bed in two columns with "mm" suffixes, a live
  Tape Bed drawing from the entered values, and all 31 Pipes visible at once.
- Clear state language: oxblood only for errors, unsaved and Delete; ink only for the one
  primary action; the action bar names unsaved fields and links each blocking error.
- German text (Neue Drehorgel, Mindestlochlänge, Pfeife hinzufügen) fits without truncation;
  decimal comma in German, dot in English.
- Character comes from the subject (paper, Tape, Holes, brass rule), not from decoration; every
  surface still maps to a Material component and a few overrides (theme.scss).
- Feasibility costs: two OFL fonts to bundle (Libertinus Serif, Noto Sans) and a palette
  generated with the theme-color schematic; the Tape SVG is a custom component either way.
