# 28. Tape pieces saved into one folder by the main process; Plotters in a snapshot of their own

Date: 2026-10-25

## Status

Accepted

## Context

"Cut a tape in pieces" ([#168](https://github.com/LilSticky/crancula/issues/168),
[spec](../../specs/011-cut-a-tape-in-pieces/spec.md)) lets the owner describe Plotters like Organs and export
a Tape longer than a Plotter's working length as one SVG file per Tape piece, saved together into one folder
the owner picks, asked once before replacing existing files (FR-021, FR-024).

ADR 21 builds the Plotter file in the domain and lets the main process only save it, through
`plotter:save-svg`, which shows a save dialog for one file. ADR 4 forbids the renderer to name a path. ADR 26
split a save in two calls only because the Recording's format is known after the dialog. ADR 18 keeps one
snapshot file per aggregate; ADR 11 keeps UI preferences in `localStorage`.

Options for the pieces were `plotter:save-svg` once per piece (a dialog per file, no common folder), a
choose-folder call returning a token plus a write call (two round trips, the SVGs are ready before the
dialog anyway), a zip file (not what the owner asked for), and one call that does it all in main
([research R6](../../specs/011-cut-a-tape-in-pieces/research.md)). Options for Plotters were `organs.json`,
`localStorage` and a file of their own (R1).

## Decision

- We will add one allow-listed channel, `plotter:save-svg-pieces`. The renderer sends every piece's file name
  and SVG text plus the translated texts of the folder dialog and the replace question. Main validates the
  request with `parseSvgPiecesSaveRequest` from `api/`, shows the folder dialog, checks which file names
  already exist there, asks once with a message box naming them, and writes the files in order. It returns
  the folder, `cancelled`, `rejected`, or `failed` with the file that failed and the files already written.
- A Tape that is one piece, or exported with no Plotter or a roll plotter, keeps `plotter:save-svg` unchanged.
- We will keep Plotters in `<userData>/snapshots/plotters.json` (version 1), a configuration of
  `snapshot-file.ts` with the channels `plotters:load` and `plotters:save`, independent of Organs and Tapes.
- The Plotter picked in the Tape view is a UI preference in `localStorage` (`crancula.plotter`), as ADR 11
  allows; it never becomes part of a Tape.

## Consequences

- One round trip and one dialog per export; the renderer still never sends a path, and main still never sees
  a Tape, Organ or Plotter.
- Main gains its first folder dialog and its first message box; both texts come from the renderer, as the
  save dialog's do. e2e tests replace `dialog.showOpenDialog` and `dialog.showMessageBox`, so `main.ts` must
  look them up at call time.
- A failed write can leave some pieces in the folder; the owner is told which file failed and can export
  again, answering the replace question.
- The request can carry many SVGs; it is capped at 999 pieces and 64 × 2²⁰ characters in total, like a
  single file.
- A damaged `plotters.json` is moved aside without touching Organs or Tapes; a third file is flushed before quit.
- If a later format (DXF, HPGL) is added, it reuses the same channel shape with another extension rule.
