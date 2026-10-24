# Feature Specification: Bring Scores onto a tape

**Feature Branch**: `010-bring-scores-onto-a-tape`

**Created**: 2026-10-25

**Status**: Draft (5 open questions in [open-questions.md](open-questions.md))

**Input**: User description: "Bring Scores onto a tape (#167, v0.3): import a Song from Scores. MusicXML
(.musicxml/.mxl) is read into the existing Song model, one Part per staff, repeats, voltas and da capo played
out. PDF and printed Scores reach Crancula as MusicXML from an outside recognition tool (e.g. Audiveris); a
short how-to, no reader of its own. Grace notes and ornaments are left out and counted in the Import Summary;
ties are joined only when contiguous in played-out order; the written tempo does not set the Crank speed; the
Song keeps Time signature changes, the upbeat and the Key from MusicXML and MIDI."

## Clarifications

### Decisions before specifying (user, 2026-10-23)

From [the discovery](../../documentation/discovery/later.md), section 2, decisions 7–9:

- Q: How do PDF and printed Scores get in? → A: Through an outside optical music recognition tool (e.g.
  Audiveris) that produces MusicXML. Crancula reads only MusicXML; PDF and printed Scores are not read by
  Crancula itself.
- Q: What becomes a Part in MusicXML? → A: Each staff; a piano's right and left hand are two Parts.
- Q: Repeats, voltas and da capo? → A: Played out into one straight Song at import.
- New Song Sources are adapters of "Bring a song onto a tape": nothing downstream of the Song knows which
  Song Source it came from. No new commands or events: SongImported and TapeCreated, as for MIDI.

### Session 2026-10-25

Decisions 15–18 (user, on the domain-modeler's proposal of 2026-10-25):

- Q: Grace notes and ornaments (trills, mordents, arpeggios, tremolo): what reaches the Tape? → A: They are
  left out; the Import Summary counts how many were left out (FR-012).
- Q: Ties when repeats are played out: which Notes are joined? → A: A tie joins two Notes only when, in the
  played-out order, the next Note of the same pitch in the same staff starts exactly where the first ends;
  otherwise the first Note just ends (FR-008).
- Q: Does the written tempo set the new Tape's Crank speed? → A: No, as for MIDI: the new Tape starts at the
  default Crank speed. "Crank speed from the Song's tempo" may become its own issue (FR-015).
- Q: What does the Song keep of the Time signature, and is it added now? → A: Now, from MusicXML and from MIDI:
  every Time signature change at its Tick, the upbeat (a first Bar shorter than its Time signature), and the
  Key (FR-016 to FR-019).
- Rules carried over, confirmed as proposed: Notes no Pipe plays follow the existing Unplayable Note and Fit
  rules unchanged; several voices on one staff stay in that staff's Part and equal pitches that overlap are
  merged by the existing overlap merge; a percussion staff becomes a percussion Part, not selected by default;
  a Part is named after the MusicXML part name, with the staff number when the part has several staves (e.g.
  "Piano 1", "Piano 2").
- Terms approved for DICTIONARY.md, entered on this slice's branch:
  - new: **Time signature** (Taktart), **Bar** (Takt; the first Bar may be shorter, an upbeat), **Key**
    (Tonart; the key signature a Song keeps from its Song Source);
  - changed: **Song** (one straight sequence, repeats played out; keeps its Time signatures and Key; German
    Stück), **Part** (from Scores one Part per staff; German Stimme), **Song Source** (MIDI or MusicXML; PDF and
    printed Scores through MusicXML from an outside recognition tool), **Scores** (Crancula reads Scores as
    MusicXML; German Noten), **Tick** (the unit of musical time in a Song and its Song Source: MIDI ticks,
    MusicXML divisions), **Import Summary** (also counts the grace notes and ornaments left out).
  - Not terms (Scores words used only inside the MusicXML reader): staff, voice, grace note, ornament, tie,
    volta, measure. "MusicXML" is a format, not a term.
  - New dictionary entries go elsewhere than directly after Preview (Recording and Record follow it).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bring a Score onto a tape for my organ (Priority: P1)

As the owner of a barrel organ, I have a piece only as sheet music, saved as a MusicXML file (for example
exported from MuseScore). I choose it on the same screen where I bring a MIDI Song onto a Tape. Crancula reads
the Song from the Scores, shows one Part per staff, and from there everything works as for MIDI: I choose the
Organ and the Parts, see the Fit, try another Transposition, name the Tape, set its Column length and create
it. The Import Summary tells me what was changed and what could not be brought onto the Tape.

**Why this priority**: this is the capability. Barrel organ music is mostly found as sheet music, not as MIDI.

**Independent Test**: with one stored Organ, import a small reference MusicXML file (two staves, no repeats,
all Notes on Pipes after a known Transposition) and check the created Tape: its Parts, Transposition, and
every Hole's Pipe, start Column and length.

**Acceptance Scenarios**:

1. **Given** a stored Organ and a MusicXML file of a piano piece with a treble and a bass staff, **When** I
   choose it, **Then** I see two Parts named "Piano 1" and "Piano 2" with their number of Notes, both
   selected.
2. **Given** a Score whose first staff begins with a quarter Note on the first beat, followed by a quarter
   Note on the second beat, **When** it is brought onto a Tape, **Then** the second Note's Hole starts 8
   Columns after the first one and is 8 Columns long, before the Minimum Hole Length and Minimum Gap fixes
   apply, exactly as for the same music read from MIDI.
3. **Given** a staff with a chord of three Notes, **When** it is brought onto a Tape, **Then** the three
   Holes start in the same Column.
4. **Given** a staff with two voices (for example a melody and a held lower note), **When** I choose the
   file, **Then** both voices are in that staff's one Part, and two equal Notes of the two voices that
   overlap become one Hole.
5. **Given** a compressed MusicXML file (`.mxl`), for example from Audiveris, **When** I choose it, **Then** it
   is read like an uncompressed one.
6. **Given** a Score with a title, **When** I choose it, **Then** the Tape's name is prefilled with that
   title; without a title, with the file name.
7. **Given** a Score with a percussion staff (unpitched notes), **When** I choose it, **Then** that staff is a
   percussion Part and is not selected.
8. **Given** a file that is neither a MIDI nor a readable MusicXML file, or a Score without Notes in any
   Part that can go onto a Tape, **Then** I'm told why and no Tape is created.
9. **Given** a Tape created from a Score, **When** I restart the app, **Then** the Tape and its Song are
   unchanged, as for a Tape from MIDI.

---

### User Story 2 - Repeats are played out (Priority: P2)

Barrel organ tunes are full of repeat signs, first and second endings and "da capo al fine". A Tape has no
repeats: the Organ plays it once, from start to end. So Crancula plays the Score out the way a musician would
read it, and the Tape holds every pass in order.

**Why this priority**: without it, most Scores give a Tape that is too short and wrong. Story 1 is still
usable with Scores that have no repeats.

**Independent Test**: import a reference Score of 8 Bars, Bars 1–4 under repeat signs with a first ending on
Bar 4 and a second ending on Bar 5, and check the order of the Holes on the Tape.

**Acceptance Scenarios**:

1. **Given** Bars A B under repeat signs followed by Bar C, **When** the Score is brought onto a Tape,
   **Then** the Tape holds A B A B C.
2. **Given** Bars A B, where B is a first ending, followed by a second ending C and Bar D, **When** it is
   brought onto a Tape, **Then** the Tape holds A B A C D.
3. **Given** a repeat marked to be played three times, **Then** the repeated Bars are on the Tape three times.
4. **Given** a Score with "da capo al fine" (or "dal segno al fine"), **Then** after the da capo (or dal segno)
   mark the Tape continues from the start (or the segno) and ends at "fine".
5. **Given** a Score with "da capo al coda" (or "dal segno al coda"), **Then** the second pass jumps from the
   "to coda" mark to the coda and the Tape ends with the coda.
6. **Given** a repeat after a da capo or dal segno jump, **Then** it is [NEEDS CLARIFICATION: Q1 in
   open-questions.md, taken again or skipped on the second pass].

---

### User Story 3 - Ties, grace notes and ornaments (Priority: P2)

A tied Note is one long Note on the Tape, not two struck again. Grace notes and ornaments are left out: a
grace note is shorter than most Minimum Hole Lengths, and a trill can't be played out on the 1/32 grid without
losing its sense. The Import Summary tells me how many were left out, so I can add them by hand in the Tape
view.

**Why this priority**: ties are common in Scores and a re-struck tied Note is audibly wrong; the Import
Summary keeps the "nothing lost silently" promise of the MIDI import.

**Independent Test**: import a reference Score with a tie over a bar line, two grace notes and a trill, and
check that the tied Notes are one Hole, that the grace notes have no Hole, that the trilled Note is a plain
Hole, and that the Import Summary counts 2 grace notes and 1 ornament left out.

**Acceptance Scenarios**:

1. **Given** a half Note tied over a bar line to a quarter Note of the same pitch, **When** it is brought onto
   a Tape, **Then** it is one Hole of 24 Columns.
2. **Given** a tie at the end of a repeat whose next Note in played-out order (back at the repeat start) has
   the same pitch and starts exactly where the tied Note ends, **Then** both are one Hole; **Given** the next
   Note there has another pitch, **Then** the tied Note just ends.
3. **Given** a Note with a grace note before it, **Then** the grace note has no Hole, the main Note starts
   where it is written, and the Import Summary counts one grace note left out.
4. **Given** a Note with a trill, mordent, turn or tremolo, **Then** it becomes one plain Hole as long as the
   written Note, and the Import Summary counts one ornament left out.
5. **Given** an arpeggiated chord, **Then** its Holes start together, and the Import Summary counts one
   ornament left out.
6. **Given** a Score with no grace notes and no ornaments, **Then** the Import Summary shows none left out.

---

### User Story 4 - The Song keeps its Time signature and Key (Priority: P2)

A Song brought in from Scores or MIDI keeps its Time signatures, where each one starts, a shorter first Bar
(an upbeat) and its Key, so that "Read a tape as Scores" can later write bar lines and the right sharps or
flats. [NEEDS CLARIFICATION: Q3 in open-questions.md, whether I see them in this slice.]

**Why this priority**: it doesn't change the Tape of this slice, but it is information that is lost for good
if it isn't kept at import: the Song Source file is not stored.

**Independent Test**: import a reference Score in 3/4 with an upbeat of one quarter, a change to 2/4 in Bar
9 and the key of G major, restart the app, and check that the Tape's Song still keeps 3/4 from the start, the
upbeat of one quarter, 2/4 from the start of Bar 9, and G major.

**Acceptance Scenarios**:

1. **Given** a Score in 3/4 that starts with an upbeat of one quarter, **When** it is brought onto a Tape,
   **Then** its Song keeps 3/4 from its first Tick and an upbeat of one quarter.
2. **Given** a Score that changes from 3/4 to 2/4 at Bar 9, **Then** its Song keeps both Time signatures,
   2/4 starting at the Tick where Bar 9 starts.
3. **Given** a repeated section that contains a Time signature change, **Then** the Song keeps the change on
   every pass, at the played-out Tick.
4. **Given** a Score in G major (or E minor), **Then** its Song keeps that Key.
5. **Given** a MIDI file with time signature and key signature events, **When** it is brought onto a Tape,
   **Then** its Song keeps every Time signature at its Tick and the Key, as a Song from Scores does.
6. **Given** a Tape whose Song was stored before this slice, **When** the app starts, **Then** the Tape and its
   Song load unchanged, and the Song keeps no Time signature, no upbeat and no Key.
7. **Given** the app is restarted, **Then** every Song keeps the same Time signatures, upbeat and Key as
   before.

---

### User Story 5 - Bring a printed or PDF Score onto a tape (Priority: P3)

I only have the tune printed, or as a PDF. Crancula tells me how to get MusicXML from it with an outside music
recognition program (for example Audiveris), and to check and correct the result in a notation program before
bringing it onto a Tape.

**Why this priority**: it reuses Story 1 completely; it only needs to be findable.

**Independent Test**: open the import screen and follow the hint to the how-to; it names a recognition
program and the steps from a PDF to a MusicXML file.

**Acceptance Scenarios**:

1. **Given** I am on the import screen, **Then** I see that MIDI and MusicXML files can be chosen and that
   PDF and printed Scores first go through a music recognition program, with a way to the how-to
   [NEEDS CLARIFICATION: Q5 in open-questions.md, where the how-to lives].
2. **Given** I choose a PDF file, **Then** I'm told that Crancula reads PDF Scores only through a music
   recognition program, with the same way to the how-to, and no Tape is created.

---

### User Story 6 - Use it in German or English (Priority: P3)

All new texts of this feature, including the rejections and the Import Summary's grace notes and ornaments,
are available in German and English.

**Why this priority**: required by the constitution, but it doesn't change what the feature does.

**Independent Test**: switch the language and walk through Stories 1, 3 and 5; no text is shown untranslated.

**Acceptance Scenarios**:

1. **Given** the app is set to German, **When** I bring a Score onto a Tape and trigger each rejection,
   **Then** all labels and messages are German and use Stück, Stimme and Noten for Song, Part and Scores.

---

### Edge Cases

- A Score with several parts (for example flute, violin and piano) gives one Part per staff of every part:
  four Parts here, the piano's with its staff number.
- A part with one staff is named after the part alone (e.g. "Flute"); a part without a name gives an unnamed
  Part, shown as "Part n" as for MIDI.
- A note written on one staff but drawn onto the other (cross-staff notation) belongs to the staff it is
  written in.
- A transposing instrument (for example a clarinet in B♭) is read at the pitch it sounds, not the pitch that
  is written.
- A pitch between two semitones (a quarter-tone accidental) is rounded to the nearest semitone; exactly half
  way, upward.
- Rests are silence; a Bar of rest stays silence on the Tape between Notes. Silence before the first Note of
  the selected Parts is cut, as for MIDI.
- Triplets and other tuplets don't fall on the 1/32 grid; their starts and ends are rounded to the nearest
  Column, as for MIDI, without a report.
- A tie whose next Note in played-out order has the same pitch but starts later (after a rest) or earlier
  does not join; the tied Note just ends where it is written.
- A tie to a Note that is the same pitch only through a different spelling (G♯ tied to A♭) is joined: pitch
  means the MIDI note number.
- A grace note in a staff where it is the only Note: the Part has no Notes and isn't shown; if no Part is
  left, the Score is rejected as having no Notes.
- Nested repeats, a repeat inside a first ending, or a da capo whose fine or coda mark is missing: played out
  as far as the marks are consistent; a da capo without "fine" plays to the end; a "to coda" without a coda
  is ignored. Crancula doesn't report this.
- A first Bar shorter than its Time signature is an upbeat. Another Bar of irregular length later (for example
  the closing Bar of a piece with an upbeat) does not shift the Bars after it: the Song keeps the Time
  signature again from the start of the next Bar.
- A Score whose parts have different Time signatures at the same time (polymetre): the Song keeps the Time
  signatures of the first part.
- A Key change in the middle of the Song: [NEEDS CLARIFICATION: Q2 in open-questions.md].
- A MIDI file without a time signature event: [NEEDS CLARIFICATION: Q4 in open-questions.md]. A MIDI file has
  no upbeat mark, so a Song from MIDI keeps no upbeat; a short first Bar written as its own Time signature is
  kept as a Time signature change.
- A Score in "free time" (no Time signature): the Song keeps no Time signature.
- The written tempo, tempo changes, dynamics, articulations (staccato, accents), fermatas, lyrics and chord
  symbols don't change the Tape. A staccato Note keeps its written length.
- A Score file larger than the size limit, a damaged compressed file, or a compressed file without a Score in
  it is rejected with a message naming the reason.
- A long Score (for example 10 minutes after repeats are played out, many staves) can still be brought onto a
  Tape, stored and looked at.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to bring a Song from a MusicXML Song Source, uncompressed or compressed, onto
  a new Tape for one chosen stored Organ, on the same import screen and with the same steps as from MIDI.
- **FR-002**: The import screen MUST let the user choose a MIDI or a MusicXML file in one place, and MUST
  recognise which Song Source a file is from its content, not only its file name.
- **FR-003**: The system MUST reject a file that is neither a readable MIDI nor a readable MusicXML file,
  is larger than the size limit, or has no Notes in any selectable Part, with a message naming the reason. A
  PDF file MUST be rejected with a message pointing to the how-to (FR-021). No Tape is created.
- **FR-004**: From a Score the system MUST make one Part per staff of each part, in the order of the parts
  and their staves. A Part MUST be named after its part, followed by the staff number when the part has
  several staves; a part without a name gives an unnamed Part.
- **FR-005**: All voices and chords of one staff MUST be in that staff's Part. A staff of unpitched
  (percussion) notes MUST be a percussion Part.
- **FR-006**: From a Score the system MUST use, for each Note: its sounding pitch as a MIDI note number, its
  start and duration in musical time, and its staff. Rests MUST be silence. The written tempo, dynamics,
  articulations, fermatas, lyrics, chord symbols, instruments and layout MUST NOT affect the Tape.
- **FR-007**: Before the Song is made, the system MUST play the Score out into one straight sequence: repeats
  (including how many times they are played), first, second and further endings, da capo, dal segno, fine and
  coda, in the order a musician plays them. [NEEDS CLARIFICATION: Q1 in open-questions.md, repeats after a da
  capo or dal segno jump.]
- **FR-008**: A tie MUST join two Notes into one only when, in the played-out order, the next Note of the same
  MIDI note number in the same staff starts exactly where the first one ends. Otherwise the first Note MUST end
  where it is written.
- **FR-009**: Grace notes MUST NOT become Notes of the Song; the Note they decorate MUST keep its written start
  and length.
- **FR-010**: A Note with an ornament (trill, mordent, turn, tremolo) MUST become one plain Note as long as the
  written Note; the Notes of an arpeggiated chord MUST start together.
- **FR-011**: The Song read from a Score MUST be the same kind of Song as from MIDI: from there, the existing
  rules of "Bring a song onto a tape" apply unchanged (Parts and their default selection, Quantisation,
  Transposition and Fit, octave moves, Unplayable Notes, overlap merge, the Minimum Hole Length and Minimum
  Gap fixes, where the Tape starts and ends, Column length, persistence).
- **FR-012**: The Import Summary MUST show the number of grace notes and the number of ornaments left out
  of the selected Parts (FR-009, FR-010), 0 included. For a Song from MIDI it MUST NOT show them.
- **FR-013**: A Tape's name MUST be prefilled with the Score's title (the work title, else the movement
  title) or, without one, the file name.
- **FR-014**: The Song's Ticks MUST keep the musical time of the Score exactly: a Note's start and duration
  in quarter notes MUST be the same as written, after the repeats are played out.
- **FR-015**: A Tape created from a Score MUST start at the default Crank speed, as from MIDI.
- **FR-016**: A Song brought in from a Score or from MIDI MUST keep every Time signature of its Song Source,
  each with the Tick where the Bar it starts in begins, in played-out order.
- **FR-017**: A Song MUST keep the length of its upbeat when its first Bar is shorter than its Time
  signature. A Bar of irregular length later in the Song MUST NOT shift the Bars after it.
- **FR-018**: A Song MUST keep its Key (number of sharps or flats, major or minor) from its Song Source.
  [NEEDS CLARIFICATION: Q2 in open-questions.md, Key changes.]
- **FR-019**: Time signatures, upbeat and Key MUST survive an app restart with the Song. Songs stored before
  this slice MUST load unchanged and keep none of them; no stored Tape or Song may be lost by the change.
- **FR-020**: Time signatures, upbeat and Key MUST NOT change the Tape: its Holes, length and Import Summary
  are the same as without them. [NEEDS CLARIFICATION: Q3 in open-questions.md, whether they are shown.]
- **FR-021**: The import screen MUST say that PDF and printed Scores reach Crancula as MusicXML through an
  outside music recognition program and MUST lead to a short how-to that names one such program (Audiveris)
  and the steps from a PDF to a MusicXML file. [NEEDS CLARIFICATION: Q5 in open-questions.md.]
- **FR-022**: All new texts of this feature MUST be available in English and German.

### Key Entities

- **Song**: music imported from a Song Source, now MIDI or MusicXML. One straight sequence: repeats are played
  out. Besides its name, Ticks per quarter and Parts it keeps its Time signatures (each from a Tick), the
  length of an upbeat, and its Key, each only if its Song Source gives one.
- **Part**: one voice or instrument of a Song. From Scores: one Part per staff, named after its part and staff
  number; may be percussion.
- **Time signature**: how a Song's beats are grouped into Bars (e.g. 3/4), kept from the Tick where it starts.
- **Bar**: one group of beats under a Time signature; the first Bar may be shorter (an upbeat). Derived from
  the Time signatures and the upbeat, not stored one by one.
- **Key**: the key signature a Song keeps from its Song Source: a number of sharps or flats, major or minor.
- **Import Summary**: as before, plus the number of grace notes and ornaments left out (Songs from Scores).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For reference Scores whose Notes all fit after a known Transposition, 100% of Notes become Holes
  at the expected Pipe, start Column and length, and the same music from MIDI and from MusicXML gives the
  same Holes.
- **SC-002**: For reference Scores with repeats, endings, da capo, dal segno, fine and coda, 100% of the
  played-out order matches the expected sequence of Bars.
- **SC-003**: No written note of the selected Parts is lost silently: each is a Hole of its own, part of a tied
  or merged Hole, listed as an Unplayable Note, or counted as a grace note or ornament left out.
- **SC-004**: MusicXML files exported from MuseScore and produced by Audiveris (both uncompressed and
  compressed) are read without a rejection.
- **SC-005**: Bringing a Score of 5 minutes (after repeats are played out) with up to 16 staves onto a Tape
  takes under 5 seconds from choosing the file to seeing the Parts.
- **SC-006**: After a restart, 100% of Songs keep the same Time signatures, upbeat and Key, and 100% of Tapes
  stored before this slice load unchanged.
- **SC-007**: An organ owner with a Score as MusicXML creates a Tape from it in under 2 minutes, from choosing
  the file to seeing the Import Summary.
- **SC-008**: Every new text of the feature is shown in the selected language, with no untranslated keys.

## Assumptions

- MusicXML files are accepted with the extensions `.musicxml`, `.xml` (older exports) and `.mxl`
  (compressed); the size limit is the MIDI one (16 MiB) unless the plan finds a reason to differ.
- How the MusicXML is read and unzipped, and where the reader lives, is decided in the plan (ADR candidate:
  MusicXML reader in the domain, like ADR 17).
- The snapshot of Tapes and their Songs gets a version step for Time signatures, upbeat and Key (ADR 20:
  migrate on read); the plan names it.
- Score layout (page breaks, system breaks, multi-Bar rests) has no effect beyond the musical time it stands
  for.
- Only the first movement of a file with several movements (an opus) is in scope; such files are rare.
- The positions of Bars on a Tape can later be derived from its Song (Column 0 is the start of the first Note
  of the selected Parts); "Read a tape as Scores" decides how.
- MIDI tempo stays ignored (spec 002); the MIDI reader additionally keeps time signature and key signature
  events.

## Out of Scope

- Reading PDF or images of printed Scores inside Crancula (no music recognition of its own).
- Setting the Crank speed from the written tempo (possible later issue, for MIDI and MusicXML together).
- Playing grace notes or ornaments onto the Tape.
- Exporting a Tape as Scores ("Read a tape as Scores", later), and showing bar lines in the Tape view.
- Other Song Sources (e.g. ABC notation, MuseScore's own file format).
- Re-reading the Song Source of an existing Tape; Songs stored before this slice don't gain Time signatures
  or a Key.
