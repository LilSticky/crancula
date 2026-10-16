# UX review: running app, screens/current (2026-10-16, after #65)

Previous: 36/50 (after #64), 33/50 (after #63), 30/50 (after #62), 29/50 (before #62)

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 3  | 4  | 3  | 4  | 3  | 3  | 3  | 4  | 5   | 36/50 |

After #65 (Tape view: page head with Organ and zoom, ruler in mm, Column numbers, row labels, overview strip, status line, side panel with Tape section, Selected Hole and Import Summary, one screen at 1024x700). H6 gains one: the Tape has a ruler, labels and a selectable Hole (08b), and the view fits one screen (14). H7 loses one: the zoom buttons and the Organ link are unstyled browser defaults, and the side panel headings mix serif and bold sans. Net score unchanged. New screens: 08b (selected Hole), 14 (1024x700), 15 (German).

## Findings
1. **[sev 3] H6 - 08, 08b, 11, 14, 15** - The Tape drawing fills about a third of the stage at 1280 px (and a quarter at 1024 px); the rest is empty beige, and the last ruler number is clipped ("6" for 60). Whole Tape does not scale to the stage. Fix: fit the Tape to the stage width at "Whole Tape", never clip the end ruler number. Tag: new (follow-up to #65).
2. **[sev 2] H7 - 08, 14, 15** - The zoom group (Whole Tape, 1:1, 2:1) uses unstyled default buttons and the Organ link is default blue; the Import Summary and Tape section headings differ (serif h2 vs. small bold). At 1024 px the head buttons wrap to two lines ("Whole Tape", "Export for the Plotter"). Fix: Material segmented buttons, themed link colour, one heading style. Tag: new (follow-up to #65) / #69 for the Import Summary.
3. **[sev 2] H6 - 14** - Row labels are clipped on the left at 1024 px ("#3", "#4" without the note letter) and in 08 ("G#3" touches the edge). Fix: widen the label gutter or hide sharps below 1180 px. Tag: new (follow-up to #65).
4. **[sev 2] H5 - 08, 08b, 15** - The "Organ saved" snackbar from the Organ editor still floats on the Tape view, in English in the German UI (15). Fix: dismiss on navigation, translate. Tag: new (known from #64).
5. **[sev 2] H2 - 02-organ-list-empty, 06-tape-list-empty** - Empty states are one grey line; no guided first step. Tag: #66.
6. **[sev 2] H7 - 05-organ-list, 09-tape-list** - Lists are plain rows with bare icons and unlabelled facts. Tag: #66.
7. **[sev 2] H2 - 07-tape-import** - The chosen file is not shown as a chip, "Use proposal" is unexplained and the fit result is a plain list without a warning state. Tag: #69.
8. **[sev 2] H4 - 03, 04, 13** - Floating labels of the MIDI note fields are cut and the Pipe rack header runs together in German (10). Tag: new (follow-up to #64).
9. **[sev 2] H8 - 12, 13, 14** - The compact rail has icon-only nav and stacked toggles without visible labels; disabled Save and the "Saved on this computer" note are low contrast. Tag: new.
10. **[sev 1] H3 - 13** - At 1024x700 the second Pipe rack column is clipped at the right edge. Tag: new.

## Strengths
- The editor fits one screen: Tape Bed (fields in a two-column grid, fit sentence, drawing) left, scrolling Pipe rack right, action bar always in view (H3).
- Error summary after Save (03) with one link per problem, matching inline errors and a bar that says how many problems block saving (H5, H9).
- Save state is honest: "No unsaved changes" with Save disabled, a dot and the changed field names when dirty (04b), Discard changes next to Save.
- The leave dialog (03b) has a clear primary (Keep editing), lists each problem with its field and now has the same wording as the summary.
- Note names (F3, F#3) with sharps dimmed make the rack scannable; German (10) shows locale decimals everywhere ("2,5", "6,25").
- The walnut rail, serif titles and dark scheme from #63 stay consistent (H1, H7, H9); plain Material with tokens keeps the rest feasible (H10).
- The Tape view (#65) has a mm ruler, Column numbers, note row labels, an overview strip and a status line; selecting a Hole (08b) outlines it and fills the Selected Hole panel; at 1024x700 it fits one screen with a Tape details toggle (14).
