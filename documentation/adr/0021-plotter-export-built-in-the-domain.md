# 21. Plotter export built in the domain, saved by the main process

Date: 2026-10-17

## Status

Accepted

## Context

"Punch a tape" ([#3](https://github.com/LilSticky/crancula/issues/3),
[spec](../../specs/003-punch-a-tape/spec.md)) exports a Tape as an SVG file for the Plotter. The
file must use the same geometry as the Tape view (FR-008): what the user sees is what gets cut.
That geometry lived in the Angular app (`src/app/features/tape/tape-view/tape-geometry.ts`),
measured from Column 1, while the view added the Lead-in itself and drew a shortened Lead-in
diagonal and no end cut.

ADR 5 made SVG the first export format, as an adapter around the Tape domain. ADR 4 allows the
renderer to reach the main process only through allow-listed channels with validated payloads.
Until now the main process wrote files only into `userData` and never showed a native dialog, and
no file path reached the renderer.

The options for where the SVG is built were the renderer's Angular code, the main process (from a
Tape and an Organ sent over IPC), or the domain. The options for saving were a renderer download,
a "pick a path" channel plus a "write this path" channel, or one channel that does both in the
main process ([research R1, R2, R6](../../specs/003-punch-a-tape/research.md)).

## Decision

We will build the Plotter file in the domain and let the main process only save it.

- The Tape geometry moves to `api/tape/tape-geometry.ts` and is the single source for the Tape
  view and every export format. It measures x from the Lead-in's tip and includes the Tape
  Outline and the end cut one Minimum Gap after the last Column. The Tape view draws from it.
- The export check (`exportProblems`), the SVG writer (`plotterSvg`) and the suggested file name
  (`plotterFileName`) are pure functions in `api/tape/`. The renderer runs them on the Tape and
  Organ it holds in memory.
- One new channel, `plotter:save-svg`, takes the suggested file name, the SVG text and the save
  dialog's translated texts, validated with `parseSvgSaveRequest` from `api/`. The main process
  shows the native save dialog and writes the text to the path the user chose. It returns the
  saved path, `cancelled`, `rejected` or `failed`. The renderer never sends a path to write to.

## Consequences

- The geometry, the check and the SVG are proven in Node Vitest without Angular or Electron.
  Later formats (DXF, HPGL) are further writers over the same `TapeGeometry`.
- The Tape view's Lead-in and end are redrawn to match the dictionary; its tests that compute
  positions from Slots change frame once.
- The main process gains its first write outside `userData` and its first native dialog. It
  still never sees a Tape or an Organ, so it can't check what it writes; the check runs in the
  renderer before the dialog opens.
- A file path reaches the renderer for the first time: the one the user just chose, for display.
- The SVG text crosses IPC as one string (about 1 MB for a 10-minute Song); the request is capped
  at 64 × 2²⁰ characters.
- e2e tests replace `dialog.showSaveDialog` in the main process through Playwright, so `main.ts`
  must look it up at call time.
