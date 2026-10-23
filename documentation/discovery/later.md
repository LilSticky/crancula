# Discovery: Later

Domain-modeler proposal of 2026-10-23 for the four "Later" items in ROADMAP.md, with the user's decisions of the
same day. Sources: DICTIONARY.md, ROADMAP.md, constitution 1.1.3, ADR 5, 17, 18, 21, specs/002, 003, 006,
api/song, api/tape, api/organ.

## Decisions (user, 2026-10-23)

| # | Item | Question | Decision |
|---|------|----------|----------|
| 1 | Cross-cutting | Which item comes next? | Crank a tape |
| 2 | Cross-cutting | How do the items map to versions? | One capability per minor version: v0.2 Crank a tape, v0.3 Scores import, v0.4 another Plotter |
| 3 | Crank a tape | How is the Crank speed set? | Crank turns per minute; the Organ gains "Tape per Crank turn" in mm |
| 4 | Crank a tape | What does the preview sound like? | One simple synthesised organ-like tone per Pipe; no sound files |
| 5 | Crank a tape | What can the user do while it plays? | A playhead runs through the Tape view; start from any Column, speed adjustable while playing, editing paused |
| 6 | Audio export | Where does exporting audio belong? | The Tape at the chosen Crank speed, as its own small slice after Crank a tape |
| 7 | Song Sources | How do PDF and printed Scores get in? | Through an outside optical music recognition tool (e.g. Audiveris) that produces MusicXML; Crancula reads only MusicXML |
| 8 | Song Sources | What becomes a Part in MusicXML? | Each staff (piano right and left hand separately) |
| 9 | Song Sources | Repeats, voltas and da capo? | Played out into one straight Song at import |
| 10 | Plotter formats | When do DXF and HPGL come? | Only when a concrete device needs one |
| 11 | Splitting | Where may a Tape be split into pieces? | Only between Columns no Hole crosses, as close as possible before the piece-length limit, plus an overlap strip for gluing |
| 12 | Splitting | Is the Plotter described in Crancula? | Yes: a Plotter is described once (name, format, working area), like an Organ |
| 13 | Scores export | What is exported as Scores? | The Tape as MusicXML (opened in MuseScore and similar for printing) |
| 14 | Scores export | Where does the time signature come from? | The Song keeps it from its Song Source; a Tape composed from scratch asks for it at export |

Order that follows: Crank a tape (v0.2) → Record a tape → Bring Scores onto a tape (v0.3) → Cut a tape in pieces
with a described Plotter (v0.4) → Read a tape as Scores. DXF/HPGL wait for a device.

Open: the rule for minor versus patch releases (Edit a tape shipped as 0.1.1) is not written down yet; it belongs
in the `release` skill or ADR 19. The proposed terms below are not approved; each goes to the user with its
slice's spec.

## 1. Crank a tape

### What exists today (facts)
- The Tape holds no tempo (dictionary, Tape; spec 002). MIDI tempo is read past and ignored
  (`api/song/midi/read-midi-song.ts`).
- A Column is a 1/32 note with a physical length in mm (`Tape.columnLength`). Spec 006 says a changed Column length
  "plays slower or faster at the same crank speed".
- The dictionary's Crank entry says "in Crancula's preview the crank speed is adjustable". No code plays anything,
  and there is no Crank or speed type in `api/`.
- `tapeGeometry` (`api/tape/tape-geometry.ts`) gives every Hole in mm from the Lead-in's tip. Holes whose Pipe is
  not on the Organ are not drawn.

### User capability
Hear a Tape the way the Organ would play it, at a Crank speed I choose, before cutting it.

### Slices
1. **Crank a tape** (v0.2): play the Tape at an adjustable Crank speed (turns per minute), with a playhead in the
   Tape view; start from any Column; editing paused while it plays. A synthesised tone per Pipe (Web Audio in the
   renderer). The Organ gains "Tape per Crank turn" in mm, so the Organ editor and the Organ snapshot change too.
2. **Record a tape** (proposal name): save what Crank a tape plays as an audio file. Adapters: an audio file
   writer, a save dialog over IPC (like `plotter:save-svg`).

### Domain events and commands (proposed)
- Mostly a read model: a pure `performance(tape, organ, crankSpeed)` gives the Pipe on/off times. Nothing about it
  is stored on the Tape.
- Commands: StartCranking(from Column), ChangeCrankSpeed, StopCranking.
- Events: CrankingStarted, CrankSpeedChanged, CrankingStopped, OrganTapePerTurnChanged.
- Proposed rule: Holes without a Pipe on the Organ are silent. Holes with a Cutting Problem play as drawn and stay
  marked.

### Terms (proposals, not approved)
- **Crank speed**: Crank turns per minute. German: Kurbelgeschwindigkeit.
- **Tape per Crank turn**: an Organ value in mm. German: Bandvorschub pro Umdrehung.
- **Preview**: used in the Crank entry, not defined. Proposal: "playing a Tape in Crancula at a Crank speed;
  changes nothing".
- **Playhead**: UI phrase only, not a term.

## 2. More Song Sources (MusicXML, PDF, printed Scores)

### What exists today (facts)
- MIDI is the only Song Source. Its reader is a domain function, `api/song/midi/read-midi-song.ts` (ADR 17). It
  makes one Part per channel that has Notes, named after the track, and channel 10 is percussion.
- A Song (`api/song/song.ts`) is Parts of Notes in Ticks, with `ticksPerQuarter`. It keeps no tempo, loudness,
  instrument, time signature or key.
- Songs are stored only while a Tape references them (ADR 18, spec 002).
- The dictionary already says Scores are a Song Source (printed, PDF, MusicXML) and that MIDI is not Scores.

### User capability
Bring a Song I only have as sheet music onto a Tape.

### Slices
New Song Sources are adapters of the existing "Bring a song onto a tape", so the slice is named after the material
the user starts from, not the file format.
1. **Bring Scores onto a tape** (v0.3): MusicXML (`.musicxml`/`.mxl`) read into the existing Song model. One Part
   per staff; repeats, voltas and da capo played out. MusicXML `divisions` maps onto `ticksPerQuarter`. Ties are
   joined into one Note. Grace notes are a question for the spec. The Song keeps the time signature (for Read a
   tape as Scores).
2. PDF and printed Scores are not a slice: the user runs an outside optical music recognition tool (e.g. Audiveris)
   to get MusicXML. A short how-to in the README or the import screen.

### Domain events and commands
No new events: SongImported and TapeCreated as for MIDI. The reader returns `Result<Song, reason>`, like the MIDI
reader.

### Terms (proposals, not approved)
- **Repeat**: a sentence in Song: "Repeats in a Song Source are played out; a Song is one straight sequence".
- **Staff and voice**: Scores words, not terms. The Part entry gets: "From Scores: one Part per staff".
- **Time signature**: kept on the Song from its Song Source. German: Taktart.
- **Song Source**: "MusicXML; PDF and printed Scores through MusicXML from an outside recognition tool".

## 3. More Plotter formats (DXF, HPGL, splitting the Tape)

### What exists today (facts)
- The only writer is SVG, `api/tape/plotter-svg.ts`, over `TapeGeometry` (ADR 21). ADR 21 says further formats are
  more writers over the same geometry.
- Export is always one file, whatever the length (spec 003). Working area, blade offset and kerf are out of scope
  and left to the cutter's software (dictionary, Plotter).
- There is no Plotter type in `api/`. The Plotter is a dictionary word only. The cut order is along the Tape, then
  by row.

### User capability
- Cut a Tape longer than my Plotter's working area, in pieces I can glue together.
- Cut a Tape on a Plotter that doesn't read SVG (only when such a device is at hand).

### Slices
1. **Cut a tape in pieces** (v0.4, proposal name): describe a Plotter once (name, format, working area), like an
   Organ, and split the Tape at export into Tape pieces with an overlap strip for gluing. Real domain work: a new
   aggregate with persistence and UI, and rules about where a Tape may be split.
2. **Punch a tape on another Plotter** (proposal): DXF or HPGL as a format adapter, only for a named device. HPGL
   is in plotter units (0.025 mm), so the writer rounds.

"DXF export" or "HPGL export" as a slice name would be a technology slice. Keep the format inside the slice.

### Domain events and commands (proposed)
- DescribePlotter, ChangePlotter, RemovePlotter; PlotterDescribed, PlotterChanged, PlotterRemoved, as for Organ.
- Pieces are derived at export by a pure `tapePieces(geometry, plotter)`, over `TapeGeometry`, not inside a format
  writer.
- Proposed invariants:
  - no Hole crosses a Join;
  - every piece, with its overlap strip, fits the working area, including the Lead-in on the first piece and the
    end gap on the last;
  - if a single span with no Hole-free Join is longer than the working area, export is refused with a reason.
- For the spec: the overlap strip's length, and whether it may hold Holes of the next piece (as a guide) or stays
  blank.

### Terms (proposals, not approved)
- **Tape piece**: a part of a Tape cut as its own file. German: Bandstück.
- **Join**: where two Tape pieces are glued together. German: Klebestelle.
- **Overlap**: the strip at a Join where two Tape pieces lie on each other for gluing. German: Klebezugabe.
- **Working area**: the length a Plotter can cut in one go. German: Arbeitsbereich.
- **Plotter**: becomes an aggregate (name, format, working area).

## 4. Export a Song as audio or Scores

### What exists today (facts)
- Nothing exports audio or Scores. The dictionary's Song entry says "Converted to scores for human reading".
- Quantisation (`api/tape/quantisation.ts`) turns Ticks into Columns at import. A Tape keeps Columns but no bars,
  time signature or key. A Tape composed from scratch has no Song.

### User capability
Share or check what my Organ will play: listen to it away from the app (audio), or read it as notation (Scores).

### Slices
1. Audio export is **Record a tape**, after Crank a tape (section 1).
2. **Read a tape as Scores** (proposal name): the Tape as MusicXML. Columns become note values with the 1/32 grid as
   the smallest; bars come from the Song's time signature, or one asked at export for a Tape without one. No PDF
   engraving: MuseScore and similar programs render it.

The roadmap said "a Song" here; the decision is the Tape, since it is what gets edited and what the Organ plays.

### Domain events and commands (proposed)
- Commands: ExportTapeAsAudio(crankSpeed), ExportTapeAsScores(time signature).
- Events: TapeExportedAsAudio, TapeExportedAsScores. Neither changes the Tape, just as the Plotter export doesn't.

### Terms (proposals, not approved)
- Song entry: change "Converted to scores for human reading" to "A Tape can be exported as Scores".
- **Time signature**: see section 2.

## Model observations (for later plans)

- The Crank speed stays off the Tape: it is a preview setting, and "Tape per Crank turn" is an Organ value. Then the
  rule "playing speed is set by the Crank" keeps holding.
- `TapeGeometry` is the single source for the view, the SVG and any later writer (ADR 21). Tape pieces are computed
  over it, or the split rule ends up inside the SVG adapter.
- A MusicXML reader lives next to `read-midi-song.ts` in `api/song/` and returns the same `Song`. Nothing downstream
  of the Song knows which Song Source it came from.
