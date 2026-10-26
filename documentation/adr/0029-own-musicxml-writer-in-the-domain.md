# 29. Own MusicXML writer in the domain, saved by the main process

Date: 2026-10-26

## Status

Accepted

## Context

"Read a tape as Scores" ([#169](https://github.com/LilSticky/crancula/issues/169),
[spec](../../specs/012-read-a-tape-as-scores/spec.md)) exports a Tape as Scores, one uncompressed
MusicXML file that MuseScore and similar programs open for reading and printing. The Scores are not a
printout of the Tape: gaps up to the Minimum Gap are closed, lengths become the fewest note values,
Bars follow a Time signature, Holes are spread over staves and voices, and notes are spelled in the
Key (FR-005 to FR-014). These are domain rules that must be tested in isolation.

[ADR 27](0027-own-musicxml-reader-in-the-domain.md) already reads MusicXML with an own XML reader in
`api/song/musicxml/`. [ADR 21](0021-plotter-export-built-in-the-domain.md) builds the Plotter file in
the domain and lets the main process only show the save dialog and write the text.

The options were a MusicXML library (none maintained for writing in TypeScript; the notation
renderers such as OpenSheetMusicDisplay read only and need a DOM), building a DOM document in the
renderer (not available in the Node domain tests, ADR 7), or an own writer that emits the XML text
([research R1, R2](../../specs/012-read-a-tape-as-scores/research.md)).

## Decision

We will write the Scores with an own MusicXML writer in the domain and let the main process only save
them.

- A new domain folder `api/scores/` holds every rule from the Tape to the Scores as pure functions:
  gap closing, Bars, staves and clefs, voices, note values, spelling, the tempo mark, and
  `scoresMusicXml`, which emits MusicXML 4.0 `score-partwise` text by string building with XML
  escaping. The output is deterministic (no date, no version), so tests compare it exactly.
- The tests prove the output by reading it back with the reader of ADR 27 (`readScoreSong`) and
  comparing its Notes, Time signatures and Key with the expected Scores, and by summing every Bar.
  No XML Schema validator is added; MuseScore is checked by hand (quickstart).
- One new channel, `scores:save`, takes the suggested file name, the MusicXML text and the save
  dialog's translated texts, validated with `parseScoresSaveRequest` from `api/`. The main process
  shows the native save dialog and writes the text where the user chose, as `plotter:save-svg` does.
  The renderer never sends a path.

## Consequences

- No new dependency. The writer covers only what a Tape needs: one part, several staves, up to four
  voices per staff, ties, chords, rests, dots, clefs, keys, Time signatures and one tempo mark; no
  beams, tuplets, lyrics or layout. Notation programs beam and lay out on their own.
- Reading and writing share the XML vocabulary but not code: the writer does not use the reader's
  tree types.
- A round trip through the reader makes the reader part of the writer's test oracle; a bug shared by
  both would go unnoticed. The hand check in MuseScore and the Bar sums guard against that.
- The main process gains a second "save one text file" channel; it never sees a Tape, so the checks
  run in the renderer before the dialog opens.
