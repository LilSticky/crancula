# Tasks: side-by-side UX follow-ups (#198)

Open findings of [ux-review.md](ux-review.md). Decisions by the user on 2026-10-28 are in the
[issue comment](https://github.com/LilSticky/crancula/issues/198#issuecomment-6459558220).
TDD per task (`tdd` skill): a failing Vitest component test first, e2e only where real Electron is needed.

- [ ] F1 (findings 1, 10) Side-by-side drawing: a fit-to-width / 1:1 zoom choice like the Tape view's, fit-to-width
  by default. The Lane numbers and the working-width dashed line stay readable at both zooms (don't scale them with
  the drawing below a readable size).
- [ ] F2 (finding 3) The part of the roll past the working width gets a hatched fill, like the Overlap hatch on Tape
  pieces, visible on light and dark schemes. Keep the outline and the text marks.
- [x] F3 (findings 4, 9) Without a roll plotter: Save is disabled and says why (reason as its description, like the
  Export refusal icon in Tape pieces); the message and "Describe a Plotter…" button sit before the plotter select.
- [x] F4 (finding 5) Tape list: a header checkbox (all / none, with an accessible label) over the tick column.
  "Bring a Song onto a Tape" stays the filled button while nothing is ticked; once Tapes are ticked,
  "Cut side by side (n)" is the filled one and "Bring a Song onto a Tape" is outlined.
- [ ] F5 (finding 6) Tape list: the count of Cutting Problems per Tape, shown only when there are any, using the same
  domain function as the Lane list.
- [ ] F6 (finding 7) Lane list rows as a table-like grid with fixed measure columns (number, Tape, Organ, marks,
  width, length), so rows with and without marks line up.
- [ ] F7 (finding 8) Plotter editor: the Tape spacing hint no longer makes the field row uneven (hint in the card
  subtitle, or a hint line under both fields).
- [ ] F8 i18n parity, lint, tests; `npm run ux:screens` for the side-by-side, Tape list and Plotter editor screens.
