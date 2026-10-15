# UX review: variant d-fairground mockup (2026-10-15)

Screens: `screens/organ-list.png`, `organ-editor.png`, `organ-editor-error.png` (German),
`tape-import.png`, `tape-view.png` at 1280×800; `organ-editor-1024.png`, `tape-import-1024.png`,
`tape-view-1024.png` at 1024×700. Before this review, one round of my own fixes went in:
fields overflowing their grid, the Tape view running past 800 px, an error message that stretched
every Pipe row, and overflow at 1024 px.

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 4  | 4  | 4  | 4  | 4  | 4  | 4  | 5  | 4   | 41/50 |

## Findings
1. **[sev 2] H6/H8 · tape-view**: at Fit (3,6 px/mm) the row pitch is 12,6 px, so the 12 px
   note labels in the gutter nearly touch. They stay legible because naturals and sharps differ
   in weight and colour, but it is the tightest spot in the app. Fix: never go below 3,6 px/mm
   (scroll horizontally instead), and highlight the row label of the hovered or selected Hole.
2. **[sev 2] H6 · tape-view**: the selected Hole is shown by a red outline on a navy slot, which is
   low contrast. Only the label makes the selection clear. Fix: a gold 2 px ring plus a faint
   row highlight across the Tape.
3. **[sev 2] H8 · tape-view**: the Tape is an SVG picture, with no text alternative for the Holes.
   Fix: an "As table" toggle (Holes per row: Column, length in mm) for screen readers and for
   checking before cutting.
4. **[sev 2] H2 · all**: the Tape list (the Tapes tab) is not designed. The mockup links the
   Tapes tab to a Tape. Fix: reuse the Organ card pattern (Tape name, Organ, length in mm,
   a mini Tape preview, Open and Delete).
5. **[sev 2] H9/H8 · all**: dark is the default. In a bright workshop next to the Plotter, a
   light scheme may read better. Fix: follow the system setting, and ship the ivory light scheme
   with the same red and gold roles.
6. **[sev 2] H4 · tape-import**: Transposition is a free text field ("+5"). Fix: a number field
   with − / + steppers, and "Use proposal" shown only when the value differs from the proposal.
7. **[sev 2] H5 · organ-editor-error**: Save stays enabled and jumps to the first problem. That
   is good, but the jump has to be built and announced (`aria-live`). Fix: specify it in the slice.
8. **[sev 1] H7 · organ-list**: the Tape names on an Organ card are bold text, not links, and the
   "Next" hint repeats the card's own "Bring a Song onto a Tape". Fix: make Tape names links, and
   show the hint only while no Tape exists.
9. **[sev 1] H8 · tape-view**: "Drums, dropped" is struck through, which makes it harder to read.
   Fix: drop the strike-through and keep the block icon and the dashed outline.
10. **[sev 1] H10 · all**: Abril Fatface and Rubik have to be bundled (OFL, about 60 kB in
    total). The screenshots use Bodoni MT Black as a stand-in, so letter widths will shift a little.

## Strengths
- The Tape is unmistakably the hero: a warm manila strip true to mm, with a ruler, Column
  numbers, bar lines and Holes cut through to the navy background. The paper metaphor carries meaning.
- The Organ editor fits 31 Pipes plus the Tape Bed on one 1280×800 screen (3 columns × 11 rows).
  The cross-section confirms that 31 rows fit between the borders.
- There is one red action per screen. Delete is moved away from Save. The sticky action bar shows
  unsaved changes or a linked problem list.
- Errors use salmon with an icon and never the brand red. German text ("Noch nicht speicherbar,
  2 Probleme", "Änderungen verwerfen") fits without truncation.
- Import is a true three-step sequence with a live Fit panel and a preview.
- The character is strong and specific (the facade trim, the poster face for names, the gilt
  corners), yet it is confined to three ornaments, so the work areas stay calm.
