# UX review: slice 013, Cut several Tapes side by side (2026-10-28)

Screens (`npm run ux:screens`, `e2e/ux/side-by-side.capture.ts`, in `documentation/design/screens/current/`): 31 Tape list
with ticks, 32 side-by-side page without a roll plotter, 33 roll Plotter editor with Tape spacing, 34 two Lanes with free
width, 35 / 35c overflowing Lane (and its Lane list, scrolled) with a Lane with Cutting Problems, 35b the same in German.
All except 35b in light and `-dark`.

| H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | Total |
|----|----|----|----|----|----|----|----|----|-----|-------|
| 4  | 4  | 4  | 4  | 3  | 3  | 4  | 3  | 4  | 5   | 38/50 |

## Findings
1. **[sev 3] H6 · 34, 35 (fixed: fit to width is the default, max 40vh; the 1:1 choice is still open)** — The drawing is at 1:1 (`--cr-mm`), so one 100 mm Lane fills the window, the second Lane and the Lane list start below the fold, and the overflow message sits far from the drawing. Follow-up: a "fit to width" zoom (default) with 1:1 as the other choice, as on the Tape view.
2. **[sev 3] H8 · 35c-dark (fixed)** — Lane marks ("4 Cutting Problems", "Does not fit") used oxblood `--cr-problem` on the dark sheet, about 1.6:1. Now `--mat-sys-error`, which follows the scheme.
3. **[sev 2] H6 · 35-dark (partly fixed)** — The oxblood overflow outline barely shows where it lies on the dark bench. No single colour has 3:1 against both manila and the dark paper, so the outline is now 3 px; the text marks carry the meaning too. Follow-up: a second, light inner stroke, or a hatched fill for the part past the working width.
4. **[sev 2] H5 · 32** — Without a roll plotter, Save stays enabled. Follow-up: disable it, and say why.
5. **[sev 2] H2 · 31** — "Cut side by side (2)" is an outlined button next to the filled "Bring a Song onto a Tape": the new capability is the quieter action, and the tick column has no header or select-all. Follow-up: a header checkbox (all / none) with a label.
6. **[sev 2] H5 · 31, 34** — Cutting Problems show on the Lane list only; the Tape list does not hint at them before ticking. Follow-up: the count of Cutting Problems per Tape in the list.
7. **[sev 2] H3 · 34, 35c** — The Lane row is a flat run of text (number, Tape, Organ, marks, width, length) without columns, so rows with and without marks do not line up. Follow-up: a table-like grid with fixed measure columns.
8. **[sev 1] H4 · 33** — The Tape spacing hint sits under the field only on one side of the row, making the two fields uneven in height. Follow-up: hint under both fields or in the card subtitle.
9. **[sev 1] H1 · 32** — The empty plotter select shows only the label "Plotter"; the message below is the real cue. Follow-up: place the message and "Describe a Plotter..." button before the select.
10. **[sev 1] H7 · 35b** — The German title and subtitle fit; the working-width dashed line and Lane number are tiny (4 px at 1:1) and inherit the drawing scale. Follow-up with finding 1.

## Strengths
- Tape-hero consistency: manila Tape, ink-black Holes, brass working-width line, same look as the Tape view in light and dark.
- Free width and overflow are stated in words ("137 mm of 300 mm free", "13 mm too wide"), not only by colour.
- Dark scheme works: the Tape stays manila on a dark bench; only the oxblood parts needed fixing.
- German strings fit without wrapping at 1280 px.
- Plotter editor: one extra field, unit shown, decimal default (3 mm) filled in; fits the existing editor pattern.
