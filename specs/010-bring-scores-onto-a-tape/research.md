# Research: Bring Scores onto a tape

Phase 0 of [plan.md](plan.md), 2026-10-25. Each item: decision, rationale, alternatives.

## R1. Where the MusicXML is read

**Decision**: in the renderer, by pure functions in `api/song/musicxml/`, on the bytes of the file the owner
picked through the existing HTML file input. Same place and shape as the MIDI reader (ADR 17):
`readScoreSong(bytes, fileName): Result<SongReading, SongRejection>`. No IPC channel, no main-process file
access.

**Rationale**: ADR 2 and ADR 17 put Song Source readers in the domain as adapters on bytes; the file input
already delivers bytes; ADR 4 stays untouched. Domain tests run in node (ADR 7), so the reader must not
depend on a browser-only API.

**Alternatives**: reading in the main process (a new channel and a payload of a whole Song for no gain);
`DOMParser` in a renderer adapter that hands a tree to the domain (not available in node Vitest, splits the
reader across two layers, and the domain would still need a tree type of its own).

## R2. How the XML is parsed

**Decision**: our own small, non-validating XML reader in `api/song/musicxml/xml.ts`: UTF-8 (with or without
BOM) and UTF-16 by BOM, elements, attributes, text, CDATA; comments, processing instructions and the
`<!DOCTYPE …>` are skipped; only the five predefined and numeric character references are decoded. It
builds a plain element tree (`XmlElement`: name, attributes, children, text) and never throws to the caller
(malformed input → `not-a-score`). Every MusicXML element the reader uses is looked up by name on that tree.

**Rationale**: MusicXML files carry a DOCTYPE with an external DTD; never resolving it rules out external
entity and entity-expansion attacks by construction. The subset needed is small and well-defined, runs the
same in node and Chromium, and adds no dependency. A 16 MiB file is a few hundred thousand elements; a
single-pass reader handles that well within SC-005.

**Alternatives**: `fast-xml-parser` (works everywhere, but a large option surface, a history of
prototype-pollution and entity advisories, and we would still map its output); `DOMParser` (R1);
`sax`/`saxes` (streaming, more code on our side for the same tree).

## R3. How `.mxl` is unzipped

**Decision**: `fflate` **0.8.3** (MIT, pure JS, no dependencies, ~8 kB for `unzipSync`), used only in
`api/song/musicxml/mxl.ts`. Read `META-INF/container.xml`, take the first `<rootfile full-path>`; without a
container, take the first `.musicxml`/`.xml` entry outside `META-INF/`. Only that entry is inflated, through
`unzipSync`'s filter, and only if its declared size is ≤ 16 MiB; otherwise `too-large`. A zip that fflate
can't read is `damaged-archive`; a zip without a Score in it is `no-score-in-archive`.

**Rationale**: synchronous (keeps the reader a plain function, like MIDI), small, maintained, licence-clean,
and runs in node tests and the renderer alike. The filter plus the declared-size check keeps a zip bomb from
being inflated. It goes into `dependencies` with an exact version (ADR 14).

**Alternatives**: `DecompressionStream('deflate-raw')` with our own zip directory reader (no dependency, but
async and another ~80 lines of binary parsing to own); `jszip` (async, ~100 kB, larger than needed).

## R4. Recognising the Song Source by content (FR-002, FR-003)

**Decision**: `readSongSource(bytes, fileName)` in `api/song/read-song-source.ts` looks at the first bytes:
`MThd` → MIDI reader; `PK\x03\x04` → `.mxl`; `%PDF-` → `pdf` rejection; otherwise, after an optional BOM and
whitespace, `<` → MusicXML; anything else → `not-a-song-source`. Files over 16 MiB are `too-large` before
any byte is read (the MIDI limit, kept for both). The file input accepts `.mid,.midi,.musicxml,.xml,.mxl,.pdf`
so that a PDF can be chosen and explained (Story 5, scenario 2).

**Rationale**: the file name is only a hint (FR-002); magic bytes are unambiguous for MIDI, zip and PDF.

## R5. Partwise and timewise

**Decision**: read `score-partwise`; a `score-timewise` file is turned into the same per-part measure lists
on the tree (the nesting is only swapped). An `opus` root or any other root is `not-a-score`.

**Rationale**: MuseScore and Audiveris write partwise; timewise costs a few lines once the tree exists.

## R6. Musical time: Ticks per quarter (FR-014)

**Decision**: the Song's Ticks per quarter is the least common multiple of every `<divisions>` value in the
file, if that is ≤ 32767; otherwise 960 and every start and duration is rounded to the nearest Tick. Each
part keeps a cursor per measure (`<backup>`, `<forward>`, `<chord/>`); a measure's length is the furthest
position any voice reached in it (MusicXML does not state measure length).

**Rationale**: with the LCM every written duration, tuplets included, is an exact integer number of Ticks,
so a Score and the same music from MIDI give the same Holes (SC-001). Files from notation programs use one
or two divisions values; the fallback only protects the Tick type's limit and loses less than a 1/32 Column.

## R7. Playing out repeats (FR-007)

**Decision**: a pure function `playOut(marks: readonly MeasureMarks[]): readonly number[]` in
`api/song/musicxml/play-out.ts` returns the indices of the measures in the order they are played. The marks
come from the first part (all parts share measure numbering in MusicXML):

- forward/backward repeat barlines (`<repeat direction times>`), endings (`<ending number type>`, numbers
  like `1, 2`);
- segno, coda, fine, to coda, da capo, dal segno, from `<sound segno coda tocoda fine dacapo dalsegno>`
  (written by MuseScore), and, when no `<sound>` says so, from `<segno/>`, `<coda/>` and the words
  "D.C.", "Da Capo", "D.S.", "Dal Segno", "Fine", "To Coda" (case-insensitive) in `<direction>` (Audiveris).

Rules: a backward repeat jumps to the latest forward repeat (or the start) until it has been played `times`
times (default 2); an ending is played on the passes its numbers name; after a D.C./D.S. jump, backward
repeats are not taken again, and of a group of endings only the last one is played; fine ends the Song only
after the jump; to coda jumps to the coda only after the jump. Each D.C./D.S. is taken once. Missing or
inconsistent marks are played as far as they make sense (a D.C. without fine plays to the end; a to coda
without a coda is ignored). A guard of 64 × the measure count stops any loop the rules didn't foresee.

**Rationale**: a table-driven function over marks is tested exhaustively in node with tiny inputs (SC-002)
and knows nothing of XML.

## R8. Laying the played-out measures onto Ticks

**Decision**: written measures are read once into `ScoreMeasure` records with everything in force there
(divisions, transpose, Time signature, Key, staves); then the played-out measures are laid one after
another from Tick 0. Per Note: sounding pitch = `step`/`alter`/`octave` as a MIDI note number plus
`<transpose>` chromatic and octave-change, rounded half up for quarter-tone alters; unpitched notes take the
`<midi-unpitched>` of their instrument, else their display pitch. Notes go to their `<staff>` (default 1)
of their part.

- **Out of range** (SC-003): a sounding pitch outside MIDI 0 to 127 is folded by whole octaves into that range
  and kept, never dropped (decided with the orchestrator, T022/T024); the Organ's own Unplayable Note report
  then shows it if no Pipe plays it.

- **Ties** (FR-008): per staff and note number, a Note with `<tie type="start">` waits; the next Note of the same
  note number in the same staff, in played-out order, joins it if it starts exactly where the first ends; another
  Note of that note number that does not join, a rest in between, or the end of the Song ends the waiting Note as
  written. The Notes of other pitches, and the other voices of the staff, leave it waiting.
- **Grace notes** (FR-009): a `<grace/>` Note is not kept and is counted for its staff.
- **Ornaments** (FR-010): a Note with anything in `<ornaments>` (trill, mordent, inverted mordent, turn,
  shake, wavy line, tremolo, …) is kept plainly and counted once; an `<arpeggiate>` chord is kept with all
  starts together and counted once per chord.
- Counts are taken in played-out order, like the Notes on the Tape: a grace note in a repeated Bar that is
  played twice is left out twice.
- A staff is a percussion Part when its clef is `percussion` or all its Notes are unpitched.
- Parts: one per staff, in part-list order; name = `<part-name>`, plus " n" when the part has several
  staves; empty name → unnamed. Staves without Notes give no Part.

## R9. Time signatures, upbeat and Key (FR-016 to FR-019)

**Decision**: kept on the Song as optional lists and a value, from the first part:

- a Time signature from `<time>` (`beats` may be a sum like `3+2`; `senza-misura` gives none), recorded at
  the start Tick of the Bar it is in;
- the upbeat: when the first played measure is shorter than its Time signature (or marked
  `implicit="yes"` and shorter), its length in Ticks;
- after a measure of irregular length later on, the Time signature in force is recorded again at the start
  of the next measure, so Bars derived from it don't shift (FR-017);
- after a jump of the played-out order, the Time signature and Key in force at the target are recorded if
  they differ from the last recorded ones (Story 4, scenario 3);
- a Key from `<key>` (`fifths` −7…7, `mode` `minor`/`aeolian` → minor, everything else → major; a key per
  staff → the first), recorded at its Tick; equal consecutive entries are dropped.

From MIDI, the reader additionally reads meta events `0x58` (time signature) and `0x59` (key signature) of
every track, at their Ticks, sorted, first track wins on the same Tick. No time signature event → none kept
(clarify Q4); no upbeat from MIDI.

## R10. Import Summary counts (FR-012)

**Decision**: the reader returns `SongReading = { song, leftOut? }`, where `leftOut` maps each PartIndex to
`{graceNotes, ornaments}`; it is present only for Scores. `CreateTapeInput` gets an optional `leftOut`, and
`ImportSummary` an optional `leftOut: {graceNotes, ornaments}` summed over the selected Parts. The counts are
not stored: the Import Summary is shown once after import (as today), and the Song stays the same kind of
Song from either Song Source (FR-011).

**Alternatives**: counts on `Part` (they would be persisted and differ after a restart for no use).

## R11. Snapshot version (FR-019, ADR 20)

**Decision**: the Tape snapshot goes from version 2 to **version 3**. `SongSnapshot` gains optional
`timeSignatures: [start, beats, beatType][]`, `upbeat: number` and `keys: [start, fifths, mode][]`. Versions 1
and 2 are read as before, their Songs keep none. The writer always writes version 3 (ADR 20). No ADR: the
policy is ADR 20's; the CHANGELOG notes the downgrade effect.

## R12. Showing Time signature, Key and upbeat (FR-020)

**Decision**: a pure `songMetre(song)` in `api/song/` gives the first Time signature, the first Key and the
upbeat as a whole-note fraction (e.g. `1/4`, `3/8`); the renderer formats it with translated key names
("G major" / "G-Dur", "E minor" / "e-Moll"). Shown read-only next to the Song on the import screen and in the
Tape view's Tape details; nothing shown when the Song keeps none.

## R13. The how-to (FR-021)

**Decision**: a one-line hint under the file chooser opens an Angular Material dialog with five short steps
(Audiveris → open the PDF or scan → check and correct in a notation program such as MuseScore → export
MusicXML → choose it here). The PDF rejection message links to the same dialog. English and German texts.
