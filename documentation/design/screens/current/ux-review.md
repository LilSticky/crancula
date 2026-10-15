# UX review: running app, screens/current (2026-10-15)

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 3  | 3  | 2  | 3  | 3  | 2  | 3  | 3  | 2  | 5   | 29/50 |

## Findings
1. **[sev 3] H6 · 08-tape-view** — The Tape is small (3 Columns, about 190 px wide) and sits under text lines. It has no millimetre scale, no Column numbers and no paper-tape look. Fix: make the Tape the visual centre, scaled to true mm with a ruler, and move "What changed on import" into a side panel.
2. **[sev 3] H3 · 04-organ-editor-filled, 10-organ-editor-german** — 31 Pipe rows plus six stacked Tape Bed fields make a page about 3200 px tall. Fix: put Tape Bed and Pipes side by side, use compact rows (density -2), show two or three Pipes per row, and keep a sticky Save bar.
3. **[sev 3] H5 · 03-organ-editor-invalid** — Save is disabled with no explanation. Empty fields show no inline error, and the Delete button is next to Save on a New Organ. Fix: show inline "Please enter a value" errors after touch, hide Delete for an unsaved Organ, and separate the destructive action from Save.
4. **[sev 2] H5 · 03b-leave-unsaved-dialog** — The dialog was captured mid-animation. Its error list is long and the Stay and Discard buttons look equal. Fix: make Stay the filled primary button and Discard a text button, and shorten the list.
5. **[sev 2] H1/H2 · 01-home** — Overview is an empty page with only a heading. Fix: turn it into a guided start (1. Describe an Organ, 2. Bring a Song onto a Tape) with the current counts, or drop it.
6. **[sev 2] H4 · 04-organ-editor-filled, 07-tape-import** — The Hole length shows "2.5" with a dot while the other fields use a decimal comma. Fields are 640 px wide for 2-3 digit values. Some values have no unit (Column length has one, Transposition says semitones). Fix: format every number with the locale, use narrow numeric fields in two columns, and show a unit suffix.
7. **[sev 2] H2 · 07-tape-import** — The chosen file name "Lead" sits loosely next to the button. The fit results are plain bullets, "Use proposal" is unexplained, and the Parts fieldset has no space around it. Fix: show a file chip, put the fit in a result card with a warning when Unplayable Notes is above 0, and say what the proposal is.
8. **[sev 2] H7 · all screens** — The page title sits right under the toolbar with no top spacing. The content is left-aligned at 130 px while the nav is centred. The Tape row is a plain text line, and the Organ list has no Edit affordance except clicking the row. Fix: use one page layout with an action bar, and show lists as cards with Open and Delete in the same pattern.
9. **[sev 2] H8 · 04-organ-editor-filled** — The up/down/delete icon buttons have no labels and the disabled arrows are low contrast. The note labels (F3) are about 11 px, and the Tape's row labels have no contrast aid. Fix: add tooltips and aria-labels, use at least 12 px labels, and check 4.5:1.
10. **[sev 1] H9 · all screens** — The look is a generic teal Material admin template, apart from the small logo. Fix: warm paper-tape neutrals, a serif or stencil heading font shipped with the app, and a tape-strip motif.

## Strengths
- The core flow is short: New Organ, Bring a Song onto a Tape, Create Tape, Open.
- The empty states have a clear primary button.
- The Parts checkboxes with Note counts and the "fit" summary give useful feedback before the Tape is created.
- The note labels on the Tape rows and the live MIDI-note labels in the Pipes list help orientation.
- The EN/DE toggle is always visible and the German text fits without breaking.
- It is plain Material, so building the redesign is fully feasible (H10).
