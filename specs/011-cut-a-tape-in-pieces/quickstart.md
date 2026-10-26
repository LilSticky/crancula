# Quickstart: Cut a tape in pieces

How to prove the slice works. Types and rules: [data-model.md](data-model.md); boundaries and UI:
[contracts/](contracts/).

## Automated

| What | Command | Shows |
|------|---------|-------|
| Plotter rules, snapshot v1, Join search, Tape pieces, piece geometry and SVG, file names, `no-join` Cutting Problem, piece-save parser, `plotter:save-svg-pieces` handler with fake effects, `plotters.json` file | `npm run test:node` | Stories 1–4 in the domain and main; SC-002, SC-003, SC-004, SC-006, SC-007 |
| Plotter list, editor and form, store, preference, Plotter section, Join and Overlap drawing, Cutting Problems list, export flow, en/de | `npm run test` (node, then Angular specs in jsdom), `npm run i18n:check` | Stories 1, 3, 5, 6 in the UI |
| Describe a Plotter, restart, change and remove it | `npm run e2e` (`e2e/plotter-library.spec.ts`) | Stories 1, 5 in real Electron |
| Pick a Plotter, see the Cutting Problem come and go, export in pieces into a folder, replace question, too wide, one-piece export | `npm run e2e` (`e2e/tape-pieces.spec.ts`) | Stories 2, 3, 4 in real Electron |
| Boundary keys | `npm run e2e` (`e2e/boundary.spec.ts`) | ADR 4 allow-list with `plotters` |
| Lint | `npm run lint` | |

Reference cases for the domain tests (from the spec):

- Reference Tape (Lead-in 50 mm, 200 Columns of 3 mm, Minimum Gap 2 mm, 652 mm), Plotter 300 × 120 mm,
  Overlap 20 mm, no Holes: Joins after Columns 76 and 169; pieces 0–298, 278–577, 557–652 mm.
- Same Tape, Hole in row 1 from Column 1, 100 Columns: one `no-join` problem, Columns 1–101 (research R4);
  70 Columns: none, first Join after Column 71.
- Roll plotter 120 mm: one piece of 652 mm; 90 mm: too wide.
- No Plotter: `plotterSvg(tapeGeometry(...))` byte-identical to today's fixture (SC-007).
- Brute force on small random Tapes: greedy piece count equals the minimum; no Slot within the Minimum Gap of
  a Join or an Overlap end.

Performance (SC-005): a node test builds a 10-minute Tape (~10 000 Columns, a few thousand Holes) and checks
`cuttingProblems(tape, organ, plotter)` well under 0.2 s.

The e2e tests replace `dialog.showOpenDialog` and `dialog.showMessageBox` through `electronApp.evaluate`, answer
with a temporary folder, and read the written files back with Node: names "<Tape> 1 of 3.svg" …, each
`width` attribute the piece's length in mm.

## By hand (once before merging)

1. `npm run electron:local`; describe a Plotter "Cutting mat", 300 × 120 mm, Overlap 20 mm; restart; it is there.
2. Open a long Tape on a 20er-Drehorgel Preset Organ, pick the Plotter: the side panel names the pieces, the
   Tape view draws the Joins and Overlaps.
3. Export into an empty folder; open the files in Inkscape: true size, Holes in the Overlap repeated at the
   start of the next piece, square ends at each Join.
4. Export again into the same folder: one replace question; cancel writes nothing.
5. Switch to German and repeat 2–3: texts and "1 von 3" in the file names.
