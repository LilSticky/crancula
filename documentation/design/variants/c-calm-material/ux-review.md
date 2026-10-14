# UX review: variant c-calm-material, mockup.html (2026-10-15)

Screens: `screens/01`–`11` (1280×800, plus 1024×700 for the Organ editor, Tape view and Bring a Song onto a Tape; dark scheme for the Organ list and Tape view).
Round 1 found two layout defects (Tape Bed fields clipped by the card, floating labels struck through by the outline) and cramped 1024 px layouts; all fixed before this score. No severity 3 or 4 findings remain.

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 4  | 4  | 4  | 4  | 4  | 5  | 4  | 3  | 5   | 41/50 |

## Findings
1. **[sev 2] H3 · 02-organ-editor, 08-organ-editor-1024x700** — The Pipe table still scrolls: 11 of 31 rows visible at 1280×800, 8 at 1024×700, while the right half of each row is empty. Fix: at ≥ 1200 px wide, flow the table into two column groups (rows 1–16, 17–31), or let the range strip jump to a row on click.
2. **[sev 2] H6 · 09-tape-view-1024x700** — At 1024×700 the true-size Tape (480 px high) is cut off below row 28 and needs vertical scrolling. Fix: open the Tape view in "Fit to window" when the Tape does not fit vertically, and remember the user's choice.
3. **[sev 2] H3 · 02-organ-editor** — The 31-cell range strip shows naturals and sharps but has no labels except hover titles, so gaps in the Pipe set cannot be read without hovering. Fix: label every C (C4, C5) under the strip and mark missing semitones with a hatched cell.
4. **[sev 2] H2 · 04-tape-import** — The Organ is chosen in step 2, after the Parts, although the Fit card already depends on it. Fix: move the Organ select into step 1, above the Parts table, preselected with the last used Organ (the Fit card title already names it).
5. **[sev 2] H9 · all screens** — Apart from the paper-tape glyphs, the Tape Bed check and the Tape itself, this is a well-made but generic Material app. Fix (within the brief): keep the tape-paper motif consistent, for example the Tape list rows with a small Tape thumbnail; accept the rest as the cost of the calm direction.
6. **[sev 2] H4 · 02-organ-editor** — A MIDI note can only be entered as a number; organ owners often think in note names. Fix: accept "F#4" or "65" in the field and show the other form next to it (the Note column already does half of this).
7. **[sev 1] H5 · 05-tape-view** — "Export for the Plotter" is disabled; the explanation is a small sentence beside it, which is clear but takes header space. Fix: drop the button until the export slice ships, or keep it and move the sentence into the tooltip plus the overflow menu.
8. **[sev 1] H8 · 01-organ-list** — The status chips ("2 Tapes", "No Tapes yet") are 12 px medium on outline; contrast is fine but they read as buttons. Fix: render them as plain `body-small` text or make "2 Tapes" a link to the filtered Tape list.
9. **[sev 1] H7 · 06-tape-view-dark** — In the dark scheme the light paper Tape is by far the brightest area; intended (the Tape is physical) but heavy after long sessions. Fix: dim the paper one step more in dark (`#cfc6b0`) and check the Hole contrast stays ≥ 7:1.
10. **[sev 1] H1 · 07-organ-editor-leave** — The dialog is good (Keep editing is the filled default, Discard is red text) but the body could name the changed fields like the save bar does. Fix: "Your changes to Name are not saved yet."

## Strengths
- One window per task: the Organ editor fits Tape Bed, Pipes and Save into 1280×800 instead of a 3200 px page; the sticky save bar shows what is unsaved.
- Every mm value has a suffix, a decimal comma and a narrow right-aligned field; Minimum Hole Length is visibly derived (dashed, with a hint).
- The Tape Bed check ("31 rows fit on the Tape, 117,5 mm of 120 mm") turns six numbers into one answer and a cross-section picture.
- Errors are specific and placed at the cause, with a linked summary; Save stays enabled; no Delete on a New Organ. The German screen (03) shows ~30 % longer labels fitting without truncation.
- The Fit card explains the proposal with range bars (as written, after +5, the Organ's Pipes), so "+5" is no longer a magic number.
- The Tape is the hero: true size, bar and beat lines, ruler, row labels, selection with a status line, overview strip; it keeps its paper look in the dark scheme.
- Entirely stock Material 3: one generated palette, outlined cards and fields, `mat-table`, `mat-button-toggle`, a rail; the only custom tokens are the Tape colours.
