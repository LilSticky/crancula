# UX review: running app, screens/current (2026-10-17, after #69)

Previous: 38/50 (after #66), 36/50 (after #65), 36/50 (after #64), 33/50 (after #63), 30/50 (after #62), 29/50 (before #62)

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 5  | 4  | 4  | 4  | 3  | 3  | 3  | 4  | 5   | 39/50 |

After #69 (import screen in two sheets: file chip, Organ range, Parts list, Transposition stepper with a proposal sentence and Use proposal, Fit as a result card with expandable Note lists and an Unplayable warning; fits one screen). H2 gains one: the import reads top to bottom and the Fit warns and offers the way back. New screens: 07b (Unplayable warning, Notes expanded) and 07c (German at 1024x700). Capture quirks seen: in 07 the Column length label overlaps its value mid-animation; the Organ saved snackbar lingers on 07/07b/07c (finding 4).

After #66 (Organ and Tape lists as ledgers: Tape Bed miniature and facts line, Tapes count link, row menu, next-step strip, Organ filter chip, guiding empty states, both lists fit German at 1024x700). H2 gains one: the empty states give a first step (02, 06, 06b) and the Organ list says what comes next (05). H4 gains one: both ledgers share one structure, and the filter and "Show all Tapes" are consistent. H7 stays: names and Organ cells are default-blue underlined links. New screens: 06b (Tape list without an Organ), 09b (filtered by Organ), 16 and 17 (German at 1024x700). The capture script's selected-Hole check (08b) had a stale selector and is fixed.

## Findings
1. **[sev 3] H6 - 08, 08b, 11, 14, 15** - The Tape drawing fills about a third of the stage at 1280 px (and a quarter at 1024 px); the rest is empty beige, and the last ruler number is clipped ("6" for 60). Whole Tape does not scale to the stage. Fix: fit the Tape to the stage width at "Whole Tape", never clip the end ruler number. Tag: new (follow-up to #65).
2. **[sev 2] H7 - 08, 14, 15** - The zoom group (Whole Tape, 1:1, 2:1) uses unstyled default buttons and the Organ link is default blue; the Import Summary and Tape section headings differ (serif h2 vs. small bold). At 1024 px the head buttons wrap to two lines ("Whole Tape", "Export for the Plotter"). Fix: Material segmented buttons, themed link colour, one heading style. Tag: new (follow-up to #65) / #69 for the Import Summary.
3. **[sev 2] H6 - 14** - Row labels are clipped on the left at 1024 px ("#3", "#4" without the note letter) and in 08 ("G#3" touches the edge). Fix: widen the label gutter or hide sharps below 1180 px. Tag: new (follow-up to #65).
4. **[sev 2] H5 - 08, 08b, 15** - The "Organ saved" snackbar from the Organ editor still floats on the Tape view, in English in the German UI (15). Fix: dismiss on navigation, translate. Tag: new (known from #64).
5. **[sev 2] H7 - 05, 09, 09b, 16, 17** - Ledger names and the Organ cells are default browser-blue underlined links, clashing with the walnut theme and the serif names. Fix: themed link colour, underline on hover only. Tag: new (follow-up to #66).
6. **[sev 2] H2 - 06b** - With no Organ the primary button "Bring a Song onto a Tape" is still shown and enabled next to "describe your Organ first"; two competing steps. Fix: make New Organ the primary action there. Tag: new (follow-up to #66).
7. **[sev 2] H3 - 07b, 07c** - At 1024x700 in German the Parts list shows one Part before it scrolls, so the Part choice is hard to scan; Note list entries read "Part Part 2" (label doubled) when a Part has no name. Fix: give the Parts list a minimum of three rows or collapse the Transposition group; drop the duplicated word. Tag: new (follow-up to #69).
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
