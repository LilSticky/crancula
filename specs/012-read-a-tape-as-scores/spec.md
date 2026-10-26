# Feature Specification: Read a tape as Scores

**Feature Branch**: `012-read-a-tape-as-scores`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Read a tape as Scores (#169, later; depends on #167 Bring Scores onto a
tape, which makes the Song keep its Time signature changes, the upbeat and the Key): the organ owner
exports a Tape as Scores (MusicXML) to read or print it in MuseScore or a similar program. Holes become
note values on the 1/32 grid; bars come from the Song's Time signature, or one asked at export. One
staff per range of Pipes the user picks at export. A tempo mark from the Tape's Crank speed; the key
from the Song, else C major. Exporting does not change the Tape."

## Clarifications

### Decisions before specifying (user, 2026-10-23)

From [the discovery](../../documentation/discovery/later.md), section 4, decisions 13–14:

- Q: What is exported as Scores, the Song or the Tape? → A: The Tape, since it is what gets edited
  and what the Organ plays. It is written as MusicXML and opened in MuseScore and similar programs
  for reading and printing. Crancula engraves no PDF.
- Q: Where does the Time signature come from? → A: The Song keeps it from its Song Source; a Tape
  composed from scratch asks for it at export.

### Session 2026-10-25

Decisions 25–28 on the domain-modeler's discovery questions (section C), with its "Rules to confirm":

- Q: How do Holes become note values? → A: First the gap before the next Hole in the same row is
  closed when it is no longer than the Organ's Minimum Gap (rounded up to whole Columns); then each
  length is written as the fewest standard note values down to 1/32, dotted values allowed, tied over
  bar lines (FR-008, FR-009).
- Q: How are the Holes laid out on staves, given that a Tape knows Pipes, not Parts? → A: One staff
  per range of Pipes the user picks at export (FR-005). Not a fixed grand staff.
- Q: Which Time signature has a Tape without a Song, or with a Song that keeps none? → A: It is asked
  at every export, prefilled with the Song's Time signature or with 4/4 and no upbeat. It is not
  stored (FR-004).
- Q: Tempo and key? → A: A tempo mark from the Tape's Crank speed (with the Column length and the
  Organ's Tape per Crank turn); the key from the Song if it keeps one, else C major (FR-013, FR-014).
- Q: Tuplets? → A: None. The 1/32 grid gives only binary note values; triplets quantised at import
  stay as the grid wrote them (FR-009).
- Q: Rests? → A: Written explicitly so every Bar is full; a Bar with no Hole on a staff is a
  whole-bar rest (FR-010).
- Q: Which Holes are exported? → A: Every Hole, also Holes whose Pipe is not on the Organ and Holes
  with other Cutting Problems. The Scores show the Tape, not what can be cut (FR-007).
- Q: Where do the bar lines start? → A: At Column 0 (Column 0 is Tick 0 at import), shifted by the
  upbeat if there is one (FR-011).
- Q: What does exporting change? → A: Nothing (ExportTapeAsScores; TapeExportedAsScores) (FR-017).
- Terms approved: Time signature (Taktart), Bar (Takt) and Key (Tonart), which arrive with #167;
  the Tape "can be exported as Scores (MusicXML) to read or print; exporting does not change the
  Tape". Scores is "Noten" in German. Note values, rests, staves, clefs and voices are Scores words,
  not terms.

### Session 2026-10-25/26 (clarify scan, [open-questions.md](open-questions.md))

- Q: How does the user pick the Pipe ranges of the staves? → A: By pitch, with split notes: each
  staff holds every pitch from its split note up to the next one; the lowest staff reaches all the
  way down, the highest all the way up. Prefilled with one split at C4 when the Organ has Pipes on
  both sides of it, else one staff (FR-005).
- Q: Are the picked staves remembered? → A: Per Organ, as a UI preference (ADR 11): the next export
  of any Tape of that Organ is prefilled with the split notes last used for it. Not stored on the
  Organ or the Tape (FR-005).
- Q: Which clef does each staff get? → A: Chosen by Crancula: treble clef if the middle of the
  staff's Pipes' range is at or above C4, else bass clef; an octave clef (treble 8va or bass 8vb)
  when that saves more than two ledger lines for most of its notes (FR-006).
- Q: How are overlapping notes of different lengths written on one staff? → A: In further voices:
  notes with the same start and length are a chord in one voice; a note that overlaps them with
  another length goes into a second voice (stems up and down), a third or fourth if needed (FR-012).
- Q: How does a Hole whose Pipe is not on the Organ appear? → A: As an ordinary note on the staff
  whose range holds its pitch, with no mark (FR-007).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export my tape as Scores (Priority: P1)

As the owner of a barrel organ, I have a Tape I brought from a Song and then edited. I open it in the
Tape view and choose "Export as Scores". A short dialog shows the Time signature and the staves it
will use; I confirm, and a save dialog suggests "<Tape name>.musicxml". I save, open the file in
MuseScore, and see my Tape as notation: the notes my Organ's Pipes will play, in Bars of the Song's
Time signature, in the Song's key, with a tempo mark that matches the Preview. My Tape stays as it
was.

**Why this priority**: it is the capability. Without it, the owner can only check a Tape by ear
(Preview) or by reading Holes, and can't share it with a musician who reads notation.

**Independent Test**: export a reference Tape brought from a reference Song in 3/4 with a known Key,
open the file in a MusicXML program, and compare Bars, notes and their pitches, the key and the tempo
mark with the expected Scores.

**Acceptance Scenarios**:

1. **Given** a Tape opened in the Tape view, **When** I look at its commands, **Then** "Export as
   Scores" is available, also when the Tape has Cutting Problems.
2. **Given** I choose "Export as Scores", **Then** a dialog shows the Time signature, the upbeat and
   the staves, prefilled (FR-004, FR-005). **When** I confirm, **Then** a save dialog opens with
   "<Tape name>.musicxml" suggested. **When** I save, **Then** one file is written there and I'm told
   where it was saved.
3. **Given** a Tape brought from a Song that keeps the Time signature 3/4, an upbeat of one quarter
   note and the Key G major, **When** I export it without changing the dialog, **Then** the Scores
   are in 3/4 with a first Bar of one quarter note (Columns 0–7), the following Bars 24 Columns
   each, and a key signature of one sharp.
4. **Given** a Song that keeps 4/4 at Tick 0 and 3/4 at Tick 3840 with 480 Ticks per quarter note,
   **When** I export its Tape, **Then** the Scores have two Bars of 4/4 (Columns 0–63) and then Bars
   of 3/4 from Column 64.
5. **Given** an Organ with Tape per Crank turn 100 mm and a Tape with Column length 5 mm and Crank
   speed 60 turns per minute, **When** I export it, **Then** the Scores carry the tempo mark "quarter
   note = 150".
6. **Given** a Hole whose Pipe plays MIDI note 67, **Then** the Scores show the note G4 at that
   Hole's place, whatever the Song's notes were before the Tape's Transposition.
7. **Given** I exported a Tape, **When** I look at it in Crancula, **Then** nothing about the Tape
   has changed, there is no new undo step, and I can export it again.

---

### User Story 2 - The Scores read like music, not like a Tape (Priority: P1)

Holes brought from a Song were shortened to keep the Minimum Gap, and a Tape is a grid of 1/32
notes. Written as they are, every quarter note would read as a dotted eighth plus a 1/32 rest. The
Scores close those small gaps and write each length with as few note values as possible, so a
musician can read them at sight.

**Why this priority**: Scores nobody can read don't serve the capability; this is what separates the
export from a printout of the Tape.

**Independent Test**: export a reference Tape on a reference Organ and compare the note values and
rests of each Bar with the expected ones.

**Acceptance Scenarios**:

Given an Organ with a Minimum Gap of 2 mm and a Tape with Column length 3 mm (the Minimum Gap rounds
up to 1 Column), in 4/4 (32 Columns per Bar):

1. **Given** a Hole of 7 Columns followed 1 Column later by the next Hole in its row, **When** I
   export, **Then** it is written as a quarter note with no rest after it.
2. **Given** a Hole of 7 Columns followed 2 Columns later by the next Hole in its row, **When** I
   export, **Then** it is written as two tied values of 7 Columns together (e.g. a dotted eighth
   tied to a 1/32) followed by a sixteenth rest; the gap is not closed.
3. **Given** a Hole of 12 Columns with nothing after it in its row, **Then** it is a dotted quarter
   note; a Hole of 3 Columns is a dotted sixteenth; a Hole of 5 Columns is an eighth tied to a 1/32.
4. **Given** a Hole that starts at Column 24 and is 16 Columns long, **Then** it is a quarter note at
   the end of Bar 1 tied to a quarter note at the start of Bar 2.
5. **Given** a Bar of a staff with no Hole in it, **Then** that staff has a whole-bar rest there;
   every other Bar is filled with rests so its note values add up to the Time signature.
6. **Given** two Holes in different rows of one staff that start on the same Column with the same
   length after gap closing, **Then** they are written as one chord.
7. **Given** two Holes on one staff that overlap with different lengths, **Then** both are written
   with their own lengths: the note that overlaps another chord or note with a different length goes
   into a further voice of that staff, with stems up in voice 1 and down in voice 2.
8. **Given** a Tape exported this way, **When** I look at it in Crancula, **Then** no Hole has been
   lengthened: gap closing happens only in the Scores.

---

### User Story 3 - Choose the staves (Priority: P2)

A Tape knows Pipes, not Parts. At export I decide how the Organ's Pipes are spread over staves, for
example melody Pipes on one staff and bass Pipes on another, so the Scores look like music for my
Organ rather than one staff full of ledger lines.

**Why this priority**: the export works with the prefilled staves (Story 1); choosing them makes the
Scores of a particular Organ readable.

**Independent Test**: export the same Tape once with the prefilled staves and once with three
staves picked by hand, and check which notes each staff holds and its clef.

**Acceptance Scenarios**:

1. **Given** the export dialog for an Organ with Pipes below and at or above C4, **When** I look at
   the staves, **Then** there are two, split at C4; for an Organ with Pipes on one side of C4 only,
   there is one staff. Every pitch belongs to exactly one staff.
2. **Given** the export dialog, **When** I add a split note, remove one or move one, **Then** the
   Scores have one staff per range between split notes, from the highest at the top to the lowest at
   the bottom, and each Hole is on the staff whose range holds its Pipe's pitch.
3. **Given** a staff whose Pipes' range has its middle at or above C4, **Then** it gets a treble
   clef, else a bass clef; an octave clef (treble 8va or bass 8vb) when that saves more than two
   ledger lines for most of its notes.
4. **Given** I picked split notes for a Tape and export another Tape of the same Organ later,
   **Then** the dialog is prefilled with those split notes. For another Organ it is prefilled as in
   scenario 1.
5. **Given** a Hole whose Pipe is not on the Organ, **When** I export, **Then** it is an ordinary
   note, with no mark, on the staff whose range holds its pitch.

---

### User Story 4 - Give a Tape without a Time signature its Bars (Priority: P2)

I composed a Tape from scratch, or brought it from a Song that keeps no Time signature (for example a
MIDI file without one, or a Song brought onto a Tape before #167). At export I say which Time
signature and upbeat the Bars should follow, for this export only.

**Why this priority**: without it such Tapes export in 4/4 only, which is wrong for waltzes, which
barrel organs play a lot. With a Song that keeps a Time signature, Story 1 works without it.

**Independent Test**: export a Tape composed from scratch in 3/4 with an upbeat of one quarter note,
check the Bars, then open the export dialog again and see 4/4 and no upbeat prefilled.

**Acceptance Scenarios**:

1. **Given** a Tape without a Song, or with a Song that keeps no Time signature, **When** I open the
   export dialog, **Then** it is prefilled with 4/4 and no upbeat.
2. **Given** the dialog, **When** I enter 6/8 and an upbeat of one eighth note and export, **Then**
   the first Bar is 4 Columns long and every following Bar 24 Columns.
3. **Given** the dialog, **When** I enter a Time signature that isn't valid (a beat count of 0 or
   not a whole number, a note value other than 1, 2, 4, 8, 16 or 32) or an upbeat not shorter than
   one Bar, **Then** it is refused with a message and nothing is exported.
4. **Given** I exported with a Time signature of my choice, **When** I export the same Tape again,
   **Then** the dialog is prefilled as at first (the Song's or 4/4); nothing was stored, and the
   Tape and its Song have not changed.
5. **Given** a Tape whose Song keeps several Time signature changes, **When** I replace them with
   one Time signature in the dialog, **Then** that one applies to the whole Tape for this export.

---

### User Story 5 - Use it in German or English (Priority: P3)

All texts of this feature, the command, the export dialog with its Time signature, upbeat and staves,
the save dialog's title and the messages, are available in German and English.

**Why this priority**: required by the constitution, but it doesn't change what the feature does.

**Independent Test**: switch the language to German, export a Tape, trigger each message, and check
that no text is shown untranslated.

**Acceptance Scenarios**:

1. **Given** the app is set to German, **When** I export a Tape and trigger each message, **Then**
   all labels and messages are German. The suggested file name is the Tape's name in either
   language, and the Scores' content (note names, tempo mark) follows notation, not the UI language.

---

### Edge Cases

- **Tape with no Holes**: it can be exported; every Bar of every staff is a whole-bar rest.
- **The Tape's length is not a whole number of Bars**: the Scores cover all Columns of the Tape (not
  only up to its last Hole), and the last Bar is filled with rests to its full length.
- **A Hole crosses a Time signature change or the end of the upbeat**: it is tied over that bar line
  like over any other.
- **A Time signature change of the Song falls inside a Bar of the previous one** (possible from a
  badly written Song Source): the change starts a new Bar at its Column, and the Bar before it is
  written short.
- **A Time signature change at a Tick between Columns**: it lies on the Column that Quantisation
  gives that Tick, like a Note's start.
- **Gap closing meets the Tape's end**: a Hole is never lengthened past the Tape's last Column.
- **Two Holes in one row that touch** (no gap): they are two notes, not one tied note, as the Tape
  keeps two Holes.
- **A gap to the next Hole in the row that equals the Minimum Gap in Columns**: it is closed; one
  Column longer is not.
- **A Hole whose Pipe is not on the Organ**: exported as its pitch (FR-007). Its Cutting Problem is
  not shown in the Scores: it is an ordinary note with no mark.
- **The Organ has no Tape per Crank turn** (saved before Crank a tape and never completed): the
  Scores have no tempo mark; everything else is exported.
- **A very slow or fast Crank speed**: the tempo mark is the computed value, rounded to a whole number
  of quarter notes per minute, and at least 1.
- **The Song keeps a Key with flats** (e.g. F major): notes off the key are spelled to suit it (B
  flat, not A sharp). With no Key, C major and sharps.
- **Very low or high Pipes** (e.g. a bass far below the staff): written at their true pitch on their
  staff; the clef or octave clef follows FR-006.
- **Exporting while the Preview plays**: allowed, as exporting is not an edit; the Preview keeps
  playing.
- **Cancelling the export dialog or the save dialog**: nothing is written, no message is shown, and
  the Tape view stays as it was.
- **Writing the file fails** (read-only folder, disk full): I'm told the file could not be saved and
  why, as far as known; the Tape is unchanged and I can try again.
- **The chosen file already exists**: the save dialog asks whether to replace it, as usual on the
  operating system.
- **A Tape name with characters not allowed in file names**: the suggested file name replaces them;
  the Tape's name does not change (as for "Export for the Plotter").
- **The Organ changed after the Tape was created** (Pipes removed, Minimum Gap changed): the export
  uses the Organ as it is now, like the Tape view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Tape view MUST offer "Export as Scores" for every opened Tape, also for one with
  Cutting Problems.
- **FR-002**: Choosing it MUST open an export dialog with the Time signature, the upbeat and the
  staves. Confirming it MUST open a save dialog that suggests "<Tape name>.musicxml", with characters
  the file system doesn't allow in file names replaced. Cancelling either dialog MUST write nothing.
- **FR-003**: When the user saves, the system MUST write exactly one MusicXML file that common
  notation programs (MuseScore first) open without errors, and MUST tell the user where it was saved.
- **FR-004**: The Time signature MUST be asked at every export. The dialog MUST be prefilled with
  the Song's Time signature(s) and upbeat when the Tape has a Song that keeps them, else with 4/4 and
  no upbeat. A Time signature MUST be a whole beat count of at least 1 over a note value of 1, 2, 4,
  8, 16 or 32; an upbeat MUST be a whole number of Columns from 0 up to less than one Bar. Anything
  else MUST be refused with a message. Kept unchanged, the Song's Time signature changes MUST be used
  at their Columns; replaced, the chosen Time signature MUST apply to the whole Tape. What the user
  enters MUST NOT be stored, on the Tape, its Song or elsewhere.
- **FR-005**: The Scores MUST have one staff per range of pitches the user picks in the export
  dialog by split notes: each staff holds every pitch from its split note up to the next one; the
  lowest staff reaches all the way down, the highest all the way up. Staves MUST be ordered from the
  highest range at the top to the lowest at the bottom. The dialog MUST be prefilled so that the user
  can export without picking: with the split notes last used for the Tape's Organ, kept per Organ as
  a UI preference (ADR 11) and not on the Organ or the Tape; else with one split at C4 when the Organ
  has Pipes below C4 and at or above it, else one staff.
- **FR-006**: Each staff MUST get a treble clef if the middle of its Pipes' range is at or above C4,
  else a bass clef; an octave clef (treble 8va or bass 8vb) when that saves more than two ledger lines
  for most of its notes. The user does not pick clefs.
- **FR-007**: Every Hole of the Tape MUST be in the Scores as a note of its Pipe's pitch (the MIDI
  note number of its Pipe), at its start Column, on the staff that holds its Pipe, including Holes
  whose Pipe is not on the Organ and Holes with other Cutting Problems. A Hole whose Pipe is not on
  the Organ MUST be an ordinary note, with no mark, on the staff whose range holds its pitch.
- **FR-008**: Before note values are written, each Hole MUST be lengthened in the Scores to the
  start of the next Hole in its row when the gap between them is no longer than the Organ's Minimum
  Gap, rounded up to whole Columns (Minimum Gap ÷ Column length). A Hole MUST NOT be lengthened past
  the Tape's last Column. The Tape's Holes MUST NOT change.
- **FR-009**: A Column MUST count as a 1/32 note. Each note's length (after FR-008) and each rest
  MUST be written as the fewest standard note values from whole note down to 1/32, single-dotted
  values allowed, tied where more than one is needed and wherever it crosses a bar line. There MUST be no
  tuplets.
- **FR-010**: Every Bar of every staff MUST be full: the gaps between notes MUST be written as
  rests, and a Bar with no note on a staff MUST be one whole-bar rest.
- **FR-011**: Bars MUST start at Column 0, with the first Bar as long as the upbeat when there is
  one, and follow the Time signature(s) of FR-004. The Scores MUST cover every Column of the Tape,
  its last Bar filled with rests.
- **FR-012**: Notes on one staff that start on the same Column with the same length (after FR-008)
  MUST be written as one chord in one voice. A note that overlaps them with another length MUST go
  into a further voice of that staff (voice 1 stems up, voice 2 stems down), up to four voices; which
  note goes into which voice is decided in the plan.
- **FR-013**: The Scores MUST carry a tempo mark in quarter notes per minute, computed from the
  Tape's Crank speed, the Organ's Tape per Crank turn and the Tape's Column length: Crank speed ×
  Tape per Crank turn ÷ (8 × Column length), rounded to a whole number, at least 1. If the Organ has
  no Tape per Crank turn, the Scores MUST have no tempo mark.
- **FR-014**: The Scores MUST have the Key the Tape's Song keeps, else C major. Notes off the key MUST
  be spelled with flats in a key with flats and with sharps otherwise.
- **FR-015**: The Scores MUST carry the Tape's name as their title.
- **FR-016**: The export MUST use the Organ as it is now (its Pipes, Minimum Gap and Tape per Crank
  turn), like the Tape view.
- **FR-017**: Exporting MUST NOT change the Tape, its Song, the Organ, the undo history or anything
  stored, and MAY be repeated any number of times. It MUST be allowed while the Preview plays and MUST
  NOT stop it.
- **FR-018**: If writing the file fails, the system MUST tell the user that the file could not be
  saved, with the reason where it is known; nothing else MUST change.
- **FR-019**: All new texts MUST exist in English and German.

### Key Entities

- **Tape**: read, never changed: its Holes, its length in Columns, its Column length, its Crank speed
  and its Song, if any. Gains "can be exported as Scores".
- **Hole**: its Pipe (pitch), start Column and length in Columns; in the Scores one note, possibly
  lengthened by gap closing and split into tied note values.
- **Organ**: supplies the Minimum Gap (for gap closing), its Pipes (for the staves) and its Tape per
  Crank turn (for the tempo mark).
- **Song**: supplies the Time signature(s), the upbeat and the Key it keeps (from #167), as the
  dialog's prefill; never changed.
- **Time signature** and **Bar**: from the Song or the export dialog; set where the bar lines fall.
  Not stored by this slice.
- **Key**: from the Song, else C major; sets the key signature and the spelling of notes off it.
- **Export choices** (descriptive phrase, not a term): the Time signature, upbeat and staves of one
  export; prefilled, never stored on the Tape.
- **Exported Scores**: one MusicXML file, not stored by Crancula.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An organ owner exports an opened Tape as Scores in under 30 seconds with the prefilled
  dialog, from choosing "Export as Scores" to the saved file.
- **SC-002**: The exported file of every reference Tape opens in MuseScore without errors or
  warnings, and every Bar of every staff adds up to its Time signature.
- **SC-003**: For reference Tapes, 100% of Holes appear as notes of the right pitch, start and
  written length (after gap closing), and no note has more tied values than the fewest possible.
- **SC-004**: For a reference Tape brought from a Song in 3/4 with an upbeat and not edited since, a
  musician recognises the Song's melody, Bars and key from the printed Scores without reference to
  the Tape.
- **SC-005**: Exporting a Tape of a 10-minute Song takes under 5 seconds.
- **SC-006**: After any number of exports, the stored Tape, its Song and its Organ are identical to
  before.
- **SC-007**: Every text of the feature is shown in the selected language, with no untranslated
  keys.

## Assumptions

- **Depends on #167** (Bring Scores onto a tape): the Song keeps its Time signature changes, its
  upbeat and its Key. Until then, and for Songs brought onto a Tape before it, every Tape exports as
  if its Song kept none (4/4, no upbeat, C major).
- **Terms**: the dictionary's Tape entry gains "Can be exported as Scores (MusicXML) to read or
  print; exporting does not change the Tape", and the Song entry's "Converted to scores for human
  reading" is changed to match, on this slice's branch. Time signature, Bar and Key come with #167.
  "Staff", "clef", "voice", "chord", "rest", "tie" and "note value" are Scores words used in prose and
  UI texts, not terms.
- **MusicXML as the format**: named because the owner's notation program must open it, not as an
  implementation choice; uncompressed `.musicxml`. Crancula engraves no PDF (decision 13).
- **Where the command lives**: in the Tape view, next to "Export for the Plotter". Exporting from the
  Tape list can come later.
- **Pitch**: the Scores show the Pipes' pitches, which include the Tape's Transposition; they are not
  the Song's original pitches.
- **Time signature changes kept from the Song**: the dialog shows them read-only as the Song's; the
  user keeps them all or replaces them with one Time signature (FR-004). Editing single changes is
  out of scope.
- **Upbeat entry**: how the upbeat is entered (in beats or note values) is left to the plan; in the
  domain it is a whole number of Columns shorter than one Bar.
- **Dots**: "dotted allowed" (decision 25) means single dots; double dots are not used.
- **Tempo rounding**: to the nearest whole quarter note per minute; the tempo mark is in quarter
  notes whatever the Time signature.
- **Note spelling**: which of the fewest note values comes first when several are tied (e.g. eighth
  then 1/32, or the other way round), and beaming, stem directions and line breaks, are left to the
  plan and the notation program.
- **No other markings**: no dynamics, articulation, lyrics, instrument names or Part names; a Tape
  has none of them.
- **Single user, one computer**; the file is written where the user chooses, through the operating
  system's save dialog.
- **Out of scope**: printing or engraving in Crancula, other formats (PDF, MIDI export), storing
  export choices on the Tape, reading the Scores back (that is Bring Scores onto a tape), tuplets,
  grace notes, exporting several Tapes at once, and Parts on the Tape.
- **Prototype code**: existing code is a quarry; this slice may replace it.
