# UX review: running app, screens/current (2026-10-15)

Previous: 29/50 (before #62)

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 3  | 3  | 2  | 3  | 3  | 2  | 3  | 3  | 3  | 5   | 30/50 |

After #62 (workshop theme, Noto Sans, Libertinus Serif) and the fix that makes form fields outlined app-wide (the first capture had no visible field labels). The shell (#63), Organ editor (#64), Tape view (#65) and lists (#66) are not restyled yet. Character improved (H9 +1) and the leave-unsaved dialog is clear (H5 3), but the editor still has no inline errors and its density is unchanged, so the total rises only to 30.

## Findings
1. **[sev 3] H6 · 08-tape-view** — The Tape is still small (3 drawn Columns, about 240 px wide) and sits under three text blocks and a bullet list. It has no millimetre scale, no Column numbers and no paper-tape look. The black Holes on beige are legible and the row labels are readable. Fix: make the Tape the visual centre, scaled to true mm with a ruler, and move "What changed on import" into a side panel. Tag: #65.
2. **[sev 3] H3 · 04-organ-editor-filled, 10-organ-editor-german** — 31 Pipe rows plus six stacked Tape Bed fields make a page about 2640 px tall. Each Tape Bed field is 800 px wide for 2-3 digit values. Fix: Tape Bed and Pipes side by side, narrow numeric fields, compact rows, two or three Pipes per row, a sticky Save bar. Tag: #64.
3. **[sev 3] H5 · 03-organ-editor-invalid** — Save is disabled with no explanation. Empty fields show only their label and no inline error, and Delete Organ sits next to Save on an unsaved Organ. Fix: inline "Please enter a value" errors after touch, hide Delete for a New Organ, separate the destructive action from Save. Tag: #64.
4. **[sev 2] H4/H7 · 03, 04, 07, 10** — The outlined fields now have visible labels with units, but stacked fields touch each other with no gap. The floating-label cut-out of each field overlaps the border of the field above (Tape Bed, the 31 MIDI-note fields, the import fields), which looks cramped and makes the labels hard to read. Empty fields in 03 look like placeholders rather than missing values. Fix: add a vertical gap between fields (or use a two-column grid with `subscriptSizing: dynamic`) and keep the label inside the notch. Tag: #64.
5. **[sev 1] H5 · 03b-leave-unsaved-dialog** — The dialog is clear: Stay is the filled primary, Discard changes an outlined button, and each problem is listed in plain words. The list repeats the field names without a link back to the field, and the Pipe message ("Enter the MIDI note of this Pipe.") is worded differently from the others ("Please enter a value."). Fix: use one wording for missing values and show the same message inline in the form. Tag: #64.
6. **[sev 2] H1/H2 · 01-home** — Overview is an empty page with only the heading. Fix: a guided start (1. Describe an Organ, 2. Bring a Song onto a Tape) with counts, or drop it. Tag: #63.
7. **[sev 2] H7 · all screens** — The page title sits directly under the toolbar with no top spacing. The nav items are spread over the full width and centred, while the content starts at x=162 and the logo at x=108, so the left edges do not align. In 06, 07 and 10 an inactive nav item keeps a grey hover/focus pill next to the active one. Lists are plain text rows (05, 09). Tape rows show bold name, Organ, "24 Columns" and "60 mm" with no labels, and Open is a bare text link. Fix: a nav rail or one aligned header, one page layout with an action bar, and cards with Open and Delete everywhere. Tag: #63 (shell, hover state) and #66 (lists).
8. **[sev 2] H4 · 04-organ-editor-filled, 10-organ-editor-german** — The Minimum Hole Length shows "2.5" with a dot while its neighbours show "2,5" (also in German). Fix: format every number with the locale. Tag: #64.
9. **[sev 2] H2 · 07-tape-import** — The chosen file is not shown as such: the word "Lead" next to the button is the Part name, not a file chip. "Use proposal" is unexplained, the fit result is a plain bullet list with no warning state for Unplayable Notes > 0, and the Parts fieldset touches the next field. Fix: show the file name as a chip, put the fit in a result card, explain the proposal and warn when Unplayable Notes is above 0. Tag: **new** (the import screen is in none of #63-#66).
10. **[sev 2] H8 · 04-organ-editor-filled, 08-tape-view** — The up, down and delete icon buttons have no visible label (check tooltips and aria-labels), and the disabled arrows and the disabled Save are low contrast. Hint text and the note labels in the Pipes list (F3) are about 12 px. Fix: tooltips and aria-labels, at least 12 px for all helper text, and check 4.5:1 for disabled-but-informative text. Tag: #64 (editor) and #65 (Tape).

## Strengths
- The new palette is warm and consistent: dark ink on beige gives high contrast for body text (well above 4.5:1), the dark primary buttons are strong and the active nav pill is unmistakable.
- Libertinus Serif headings with Noto Sans body text give the app a craft character it did not have before; it reads less like a generic admin template (H9 2 to 3).
- Outlined fields show their label and unit (mm, semitones) permanently, and German labels fit.
- The core flow is still short: New Organ, Bring a Song onto a Tape, Create Tape, Open. Empty states have a clear primary button.
- The Tape's black Holes on the light tape colour are legible and the row note labels and Column lines are clear.
- The EN/DE toggle is always visible and German text fits without breaking.
- Plain Material with tokens: the remaining restyle is fully feasible with minimal SCSS (H10).
