# UX review: Bring Scores onto a Tape (2026-10-26)

Screens (`documentation/design/screens/current/`, 1280x800, English and German): `20-tape-import-score`, `21-tape-view-metre`, `22-tape-import-pdf-rejected`, `23-score-how-to-dialog`, each also `-german`. Captured by `e2e/ux/scores.capture.ts`.

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 4  | 4  | 4  | 4  | 4  | 3  | 4  | 4  | 5   | 40/50 |

## Findings
1. **[sev 2] H7 · 21-tape-view-metre(-german)** — The Tape details label is "Metre" in English but "Takt und Tonart" in German, while the value also carries the upbeat. The row is also tight against the "Column length" row below it. Fixed: the label difference is intended (dictionary term "Metre"). The row gap already matches the other details rows (measured: 5 px between the text of every pair of rows, Metre to Column length included), so no change.
2. **[sev 2] H8 · 22-tape-import-pdf-rejected** — "How to get MusicXML" is plain dark text with no button outline or icon, so it does not read as a link or button next to the red message; in German it drops to its own line. Fixed: a text button with a `help` icon, in the hint and in the rejection.
3. **[sev 2] H5 · 22-tape-import-pdf-rejected** — The rejection message sits above the unchanged Organ/Parts/Transposition form, which stays visible but empty (large blank Parts area). → #178
4. **[sev 3] H3 · 21-tape-view-metre-german** — At 1280 px in German the header text of the Tape squeezes into a narrow column and the toolbar overflows: "Export für den Plotter" is clipped and a horizontal scrollbar appears. Not caused by this slice (Record button from #165), but the Metre row adds nothing to it. → #177
5. **[sev 1] H7 · 22-tape-import-pdf-rejected** — The error icon sits above the first text line instead of centred on it. Fixed: the error icon is centred on the first line.
6. **[sev 1] H1 · 20-tape-import-score** — The Song facts line ("2 Parts, 8 Notes  3/4, G major, upbeat 1/4") has no separator between Notes count and Metre. Fixed: a middle dot separates the Notes count from the metre.

## Strengths
- The import screen shows Parts with checkboxes and Note counts and the Metre in one line, in both languages, without overflow.
- The how-to dialog is short: five numbered steps, one Close button, readable at German text length.
- The PDF rejection is specific, plain, and names the next step.
- The Tape details keep the Metre next to the Organ, where the owner looks for facts of the Tape.

## Fixed in this review
1, 2, 5 and 6 (see the findings). 3 and 4 are filed: #178 and #177.
