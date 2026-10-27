# Discovery: Later

Domain-modeler proposal of 2026-10-23 for the four "Later" items in ROADMAP.md, with the user's decisions of the
same day, and a second round of 2026-10-25 for sections 2-4 (decisions 15-28, terms approved). Sources:
DICTIONARY.md, ROADMAP.md, constitution 1.1.3, ADR 5, 17, 18, 20, 21, specs/002, 003, 006, api/song, api/tape,
api/organ.

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

## Decisions (user, 2026-10-25)

| # | Slice | Question | Decision |
|---|-------|----------|----------|
| 15 | Bring Scores onto a tape | Grace notes and ornaments | Left out; the Import Summary counts how many were left out |
| 16 | Bring Scores onto a tape | Ties when repeats are played out | Joined only when, in played-out order, the next same-pitch Note in the same staff starts exactly where the first ends |
| 17 | Bring Scores onto a tape | Written tempo and Crank speed | Not used, like MIDI: the new Tape starts at the default Crank speed; "Crank speed from tempo" may become its own issue |
| 18 | Bring Scores onto a tape | Time signature on the Song | Now, from MusicXML and MIDI: every Time signature change at its Tick, the upbeat, and the Key |
| 19 | Cut a tape in pieces | Overlap | Repeats the Holes it lies under (both layers cut through); its length is set on the Plotter, default 20 mm |
| 20 | Cut a tape in pieces | A stretch longer than the working area with no possible Join | A new kind of Cutting Problem, shown in the Tape view while editing |
| 21 | Cut a tape in pieces | Which Plotter that Cutting Problem is checked against | A Plotter picker in the Tape view (side panel); no Plotter picked = no such Cutting Problem |
| 22 | Cut a tape in pieces | What describes a Plotter | Name, format (only SVG), working length, working width, and a roll plotter toggle (vinyl cutters): a roll plotter cuts near-endless lengths, needs no working length and never splits a Tape. A Tape wider than the working width is refused. No Plotter described: export stays one file as today |
| 23 | Cut a tape in pieces | How Tape pieces leave Crancula | One SVG per Tape piece, numbered "<tape> 1 of 3.svg", saved together into one folder the user picks |
| 24 | Cut a tape in pieces | Several Tapes side by side on a roll plotter | Its own later slice, Cut several tapes side by side ([#170](https://github.com/LilSticky/crancula/issues/170)), not part of v0.4 |
| 25 | Read a tape as Scores | Holes to note values | Close a gap no longer than the Minimum Gap before the next Hole in the same row, then the fewest standard values down to 1/32, dotted allowed, tied over bar lines |
| 26 | Read a tape as Scores | Staves | One staff per range of Pipes the user picks at export |
| 27 | Read a tape as Scores | Time signature without a Song | Asked at every export, prefilled with the Song's Time signature or 4/4 and no upbeat; not stored (keeps decision 14) |
| 28 | Read a tape as Scores | Tempo and key | Tempo mark from the Tape's Crank speed (Column length, Tape per Crank turn); Key from the Song if it keeps one, else C major |

## Decisions (user, 2026-10-27)

| # | Slice | Question | Decision |
|---|-------|----------|----------|
| 29 | Cut several tapes side by side | Which Tapes may share a cut | Any Tapes, from any Organ and with mixed tape widths, as long as they fit the working width; the same Tape may be added more than once |
| 30 | Cut several tapes side by side | Arrangement across the working width | One Tape per Lane, in the order the user picks and can change; no automatic packing; the cut is as long as the longest Tape |
| 31 | Cut several tapes side by side | Space between neighbouring Tapes | A Tape spacing set on the roll plotter (default 3 mm), the same between all Lanes; no shared cut lines |
| 32 | Cut several tapes side by side | Tapes that don't fit, Tapes that can't be cut | A Tape that would exceed the working width cannot be added, and the remaining width is shown; a Tape with Cutting Problems blocks the export and is named |
| 33 | Cut several tapes side by side | Sheet plotters | Roll plotters only; sheet plotters keep one Tape or Tape piece per file; the result is one SVG |
| 34 | Cut several tapes side by side | Is the arrangement kept | No: chosen at export (Tapes picked in the Tape library, a roll plotter, the Lane order), nothing stored, no new aggregate |

Slice issues: Bring Scores onto a tape [#167](https://github.com/LilSticky/crancula/issues/167), Cut a tape in
pieces [#168](https://github.com/LilSticky/crancula/issues/168), Read a tape as Scores
[#169](https://github.com/LilSticky/crancula/issues/169), Cut several tapes side by side
[#170](https://github.com/LilSticky/crancula/issues/170).

Order that follows: Crank a tape (v0.2) → Record a tape → Bring Scores onto a tape (v0.3) → Cut a tape in pieces
with a described Plotter (v0.4) → Cut several tapes side by side (#170) → Read a tape as Scores. DXF/HPGL wait for
a device.

Open: the rule for minor versus patch releases (Edit a tape shipped as 0.1.1) is not written down yet; it belongs
in the `release` skill or ADR 19. The terms of sections 2-4 were approved by the user on 2026-10-25 and are in
DICTIONARY.md.

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
- Mostly a read model: a pure `performance(tape, organ, crankSpeed)` gives the Pipe on/off times. (Proposal of
  2026-10-23; the Tape now keeps its Crank speed, see the dictionary.)
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
   joined into one Note (decision 16). Grace notes and ornaments are left out and counted (decision 15). The Song
   keeps its Time signatures, upbeat and Key, from MusicXML and from MIDI (decision 18).
2. PDF and printed Scores are not a slice: the user runs an outside optical music recognition tool (e.g. Audiveris)
   to get MusicXML. A short how-to in the README or the import screen.

### Domain events and commands
No new events: SongImported and TapeCreated as for MIDI. The reader returns `Result<Song, reason>`, like the MIDI
reader.

### Rules (confirmed 2026-10-25)
- Grace notes and ornaments (trills, mordents, arpeggios, tremolo) are left out; the Import Summary counts them.
- A tie joins two Notes only when, in the played-out order, the next Note of the same pitch in the same staff
  starts exactly where the first ends; otherwise the first Note just ends.
- The written tempo is not used: the new Tape starts at the default Crank speed, as for MIDI. "Crank speed from
  the Song's tempo" may become its own issue for both Song Sources.
- The Song keeps every Time signature change at its Tick, the upbeat (a first Bar shorter than its Time
  signature) and the Key, from MusicXML and from MIDI meta events. The Song snapshot changes once (ADR 20).
- Notes no Pipe plays: the existing Unplayable Note and Fit rules apply unchanged; nothing downstream knows the
  Song Source.
- Several voices on one staff stay in that staff's Part; equal pitches overlapping are merged by the existing
  overlap merge.
- A percussion staff (MusicXML unpitched notes) becomes a percussion Part, not selected by default, as for MIDI
  channel 10.
- Part name: the MusicXML part name, with the staff number when the part has several staves (e.g. "Piano 1",
  "Piano 2").

### Terms (approved 2026-10-25, in DICTIONARY.md)
- **Song**: one straight sequence; repeats, voltas, da capo and dal segno are played out at import. Keeps its
  Time signatures, upbeat and Key. German: Stück.
- **Part**: from Scores, one Part per staff. German: Stimme.
- **Scores**: Crancula reads and writes them as MusicXML. German: Noten.
- **Time signature** (Taktart), **Bar** (Takt), **Key** (Tonart): new.
- **Song Source**: MIDI or MusicXML; PDF and printed Scores through MusicXML from an outside recognition tool.
- **Tick**: the unit of musical time in a Song and its Song Source (MIDI ticks, MusicXML divisions).
- **Import Summary**: also counts the grace notes and ornaments left out.
- Staff, voice, grace note, tie and volta are Scores words inside the MusicXML adapter, not terms. "MusicXML" is
  a format, not a term.

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
1. **Cut a tape in pieces** (v0.4, [#168](https://github.com/LilSticky/crancula/issues/168)): describe a Plotter
   once (name, format, Working area, or a roll plotter), like an Organ, and split the Tape at export into Tape
   pieces with an Overlap for gluing. Real domain work: a new aggregate with persistence and UI, and rules about
   where a Tape may be split.
2. **Cut several tapes side by side** (later, [#170](https://github.com/LilSticky/crancula/issues/170)): lay
   several Tapes across a roll plotter's working width in one cut (decision 24). Not part of v0.4.
3. **Punch a tape on another Plotter** (proposal): DXF or HPGL as a format adapter, only for a named device. HPGL
   is in plotter units (0.025 mm), so the writer rounds.

"DXF export" or "HPGL export" as a slice name would be a technology slice. Keep the format inside the slice.

### Domain events and commands (proposed)
- DescribePlotter, ChangePlotter, RemovePlotter; PlotterDescribed, PlotterChanged, PlotterRemoved, as for Organ.
- Pieces are derived at export by a pure `tapePieces(geometry, plotter)`, over `TapeGeometry`, not inside a format
  writer.
- The Plotter is independent of Organs and Tapes: removing one removes nothing else.
- Invariants and rules (confirmed 2026-10-25):
  - no Hole crosses a Join;
  - every piece, with its Overlap, fits the working length, including the Lead-in on the first piece and the end
    gap on the last; a Join lies as close as possible before the working length, pieces found greedily from the
    Lead-in's tip;
  - the Overlap repeats the Holes of the stretch it lies under, so both layers are cut through; its length is set
    on the Plotter, default 20 mm (decision 19);
  - a stretch longer than the working length with no possible Join is a new kind of Cutting Problem, shown in the
    Tape view while editing, checked against the Plotter picked in the Tape view's side panel; no Plotter picked,
    no such Cutting Problem (decisions 20, 21). This ties that kind of Cutting Problem to a Plotter, while the
    others depend only on the Organ;
  - a roll plotter has no working length and never splits a Tape (decision 22);
  - a Tape wider than the Plotter's working width is refused;
  - without a described Plotter, export stays one file as today;
  - Tape pieces leave Crancula as one SVG each, numbered "<tape> 1 of 3.svg", saved together into one folder the
    user picks (decision 23). This needs a new or widened allow-listed channel (ADR 4) next to
    `plotter:save-svg` and extends ADR 21.

### Terms (approved 2026-10-25, in DICTIONARY.md)
- **Plotter**: an aggregate described once by the user (name, format, Working area, roll plotter toggle, Overlap
  length). German: Plotter (Schneideplotter in prose).
- **Working area** (Arbeitsbereich): working length and working width.
- **Tape piece** (Bandstück), **Join** (Klebestelle), **Overlap** (Klebezugabe): new.
- **Tape Outline**: each Tape piece has its own outline, square at a Join.
- **Lead-in**: on the first Tape piece only.
- **Tape**: can be cut in Tape pieces for a Plotter.

## 4. Export a Song as audio or Scores

### What exists today (facts)
- Nothing exports audio or Scores. The dictionary's Song entry says "Converted to scores for human reading".
- Quantisation (`api/tape/quantisation.ts`) turns Ticks into Columns at import. A Tape keeps Columns but no bars,
  time signature or key. A Tape composed from scratch has no Song.

### User capability
Share or check what my Organ will play: listen to it away from the app (audio), or read it as notation (Scores).

### Slices
1. Audio export is **Record a tape**, after Crank a tape (section 1).
2. **Read a tape as Scores** (later, [#169](https://github.com/LilSticky/crancula/issues/169)): the Tape as
   MusicXML. Columns become note values with the 1/32 grid as the smallest; Bars come from the Song's Time
   signature, or one asked at export. No PDF engraving: MuseScore and similar programs render it.

The roadmap said "a Song" here; the decision is the Tape, since it is what gets edited and what the Organ plays.

### Domain events and commands (proposed)
- Commands: ExportTapeAsAudio(crankSpeed), ExportTapeAsScores(time signature).
- Events: TapeExportedAsAudio, TapeExportedAsScores. Neither changes the Tape, just as the Plotter export doesn't.

### Rules (confirmed 2026-10-25)
- Holes to note values: first close the gap before the next Hole in the same row when it is no longer than the
  Organ's Minimum Gap (rounded up to Columns), then write each length as the fewest standard values down to 1/32,
  dotted allowed, tied over bar lines (decision 25).
- One staff per range of Pipes the user picks at export (decision 26).
- The Time signature is asked at every export, prefilled with the Song's Time signature or 4/4 and no upbeat; it
  is not stored (decision 27).
- A tempo mark from the Tape's Crank speed (with its Column length and the Organ's Tape per Crank turn, as
  quarter notes per minute); the Key from the Song if it keeps one, else C major (decision 28).
- No tuplets: the 1/32 grid gives only binary values; triplets quantised at import stay as the grid wrote them.
- Rests are written explicitly so every Bar is full; a Bar with no Hole is a whole-bar rest.
- Every Hole is exported, also Holes whose Pipe is not on the Organ and Holes with Cutting Problems; the Scores
  show the Tape, not what can be cut.
- Bar lines count from Column 0 (Column 0 is Tick 0 at import), shifted by the upbeat if the Song keeps one.
- ExportTapeAsScores(Time signature, staff ranges) changes nothing.

### Terms (approved 2026-10-25, in DICTIONARY.md)
- **Tape**: can be exported as Scores (MusicXML) to read or print; exporting does not change the Tape.
- **Song**: "Converted to scores for human reading" is replaced: the Song is not exported, its Tape is.
- **Time signature**, **Bar**, **Key**: see section 2.

## 5. Cut several tapes side by side

Decisions 29–34 (user, 2026-10-27). Issue [#170](https://github.com/LilSticky/crancula/issues/170).

### What exists today (facts)
- A Plotter is a `SheetPlotter | RollPlotter` (`api/plotter/plotter.ts`). A roll plotter has only a working width and
  never splits a Tape; a Tape wider than the working width is refused (decision 22).
- The tape width belongs to the Organ (Tape Bed), so Tapes of different Organs can differ in width.
- `TapeGeometry` gives one Tape's Holes and Tape Outline in mm (ADR 21). The SVG writer draws one Tape, or one Tape
  piece, per file; cut order: the Holes along the Tape, then the Tape Outline.
- A Tape with Cutting Problems cannot be exported for the Plotter.

### User capability
Fill my vinyl cutter's width with several Tapes at once, so that one pass over the roll cuts them all and wastes less
material.

### Rules
- Only a roll plotter can be picked, and every Tape needs its Organ.
- Sum of tape widths + (number of Lanes − 1) × Tape spacing ≤ working width.
- Every Tape is free of Cutting Problems.
- Each Lane is the Tape's own `TapeGeometry`, moved across the width; Holes, Lead-in and Tape Outline are unchanged.
  Lanes are computed by a pure function over the geometries, not inside the SVG writer (ADR 21).
- Cut order Lane by Lane: all Holes of a Tape, then its Tape Outline, then the next Lane, keeping "outline after all
  Holes" per Tape.
- One SVG, as long as the longest Tape and as wide as the used width. The file name is chosen in the save dialog
  (proposed default "<first tape> and N more.svg"); probably the existing `plotter:save-svg` channel with a wider
  payload (ADR 4), to be settled in the plan.
- Exporting changes no Tape.

### Domain events and commands
- ExportTapesSideBySide(roll plotter, ordered Tapes) → TapesExportedSideBySide.
- The Tape spacing changes through ChangePlotter → PlotterChanged.

### Terms (approved 2026-10-27, in DICTIONARY.md)
- **Lane** (Bahn): the strip of the working width one Tape takes in a side-by-side cut.
- **Tape spacing** (Bandabstand): the blank strip between two Lanes, set on the roll plotter. Not "gap", which means
  Minimum Gap.
- Roll plotter and Tape Outline entries mention side-by-side cuts.

## Model observations (for later plans)

- The Tape keeps its Crank speed (dictionary, Tape and Crank speed); changing it is an edit like the Column length.
  "Tape per Crank turn" is an Organ value. Read a tape as Scores takes its tempo mark from the Tape's Crank speed
  (decision 28).
- `TapeGeometry` is the single source for the view, the SVG and any later writer (ADR 21). Tape pieces are computed
  over it, or the split rule ends up inside the SVG adapter.
- A MusicXML reader lives next to `read-midi-song.ts` in `api/song/` and returns the same `Song`. Nothing downstream
  of the Song knows which Song Source it came from.
