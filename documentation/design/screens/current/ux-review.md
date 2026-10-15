# UX review: running app, screens/current (2026-10-15, after #62 theme and fonts)

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 3  | 3  | 2  | 3  | 3  | 2  | 3  | 3  | 4  | 5   | 31/50 |

## Comparison with the previous review (29/50)

- H9 Character 2 -> 4: warm paper background, near-black ink buttons, Libertinus Serif headings and Noto Sans body, shipped with the app.
- H4 Data entry stays 3: the first capture after #62 hid every field label (filled fields at density -2, score 2, a regression). The fix was outlined fields app-wide. Labels and mm/semitone units are visible again, but the problems below keep it at 3.
- H7 stays 3: colours and fonts are one language now, but the layout is unchanged (content at 130 px left, nav centred, plain text rows).
- The layout findings from the previous review are still open and belong to #63-#66.

## Findings
1. **[sev 2] H4 · 03-organ-editor-invalid, 04-organ-editor-filled, 07-tape-import, 10-organ-editor-german** — Outlined fields are stacked with no gap, so each floating label is cut through by the border of the field above (visible on "Border", "Column length", "MIDI-Note" in every Pipe row). Fix: add 8-12 px vertical spacing between fields, or use a two-column grid; keep field width narrow for numbers. #64 and #65.
2. **[sev 2] ux:screens script · 03b-leave-unsaved-dialog** — The capture still shows the dialog mid fade-in (faded text, buttons barely visible), so the dialog cannot be reviewed. Fix: in the ux:screens script wait for the dialog's animation to end (for example wait for the `.mat-mdc-dialog-surface` to be visible and opacity 1, or disable animations in the capture) before the screenshot. Then review the dialog (Stay as filled button, Discard as text button, shorter error list). Script fix, then #64.
3. **[sev 3] H6 · 08-tape-view** — The Tape is still small (3 Columns, about 190 px wide) under text lines, with no mm scale, no Column numbers, and no paper-tape look despite the new paper theme. Fix: make the Tape the visual centre, true to scale with a ruler, with "What changed on import" in a side panel. #65.
4. **[sev 3] H3 · 04-organ-editor-filled, 10-organ-editor-german** — 31 Pipe rows and six stacked 640 px fields make a page about 2850 px tall. Fix: Tape Bed and Pipes side by side, compact rows, several Pipes per row, sticky Save bar. #64.
5. **[sev 3] H5 · 03-organ-editor-invalid** — Save is disabled with no explanation and no inline error on empty fields. Delete Organ sits next to Save on an unsaved Organ, and Add Pipe, Save and Delete are crammed together without spacing. Fix: inline errors after touch, hide Delete for a New Organ, separate the destructive action. #64.
6. **[sev 2] H1/H2 · 01-home** — Overview is still an empty page with only a heading. Fix: a guided start (1. Describe an Organ, 2. Bring a Song onto a Tape) with counts, or drop it. #63.
7. **[sev 2] H7 · all screens** — Page title directly under the toolbar, content left-aligned at 130 px while the nav is centred; the page layout differs from the toolbar's 85-1210 px frame. Lists are plain rows (Organ list has only a delete icon, Tape list has Open as unstyled text). Fix: one page layout with an action bar; cards with the same Open/Delete pattern. #63 and #66.
8. **[sev 2] H4 · 04-organ-editor-filled** — Hole length shows "2.5" with a dot while the other fields show a decimal comma. Fix: format every number with the locale. #64.
9. **[sev 2] H2 · 07-tape-import** — The file name "Lead" floats next to the button; the Parts fieldset has a thin grey border that touches the next field; the fit result is a plain bullet list; "Use proposal" is unexplained. Fix: file chip, result card with a warning when Unplayable Notes > 0, explain the proposal. #65.
10. **[sev 2] H8 · 04-organ-editor-filled** — Up/down/delete icon buttons have no visible labels and the disabled arrows are faint; note labels are small (about 11 px). Fix: tooltips and aria-labels, 12 px minimum, check 4.5:1. #64.

## Strengths
- The theme is a real step toward the craft look: the paper background and ink buttons look consistent and contrast well, and the serif headings add character without hurting legibility.
- The core flow is still short and the empty states have a clear primary button.
- The EN/DE toggle is always visible, and the German text fits without breaking.
- The Parts checkboxes with Note counts and the fit summary give useful feedback before the Tape is created.
- Material is themed through tokens, so the remaining redesign is fully feasible (H10).
