# Feature Specification: Bring a song onto a tape

**Feature Branch**: `002-bring-a-song-onto-a-tape`

**Created**: 2026-10-14

**Status**: Clarified

**Input**: User description: "Bring a song onto a tape (#2): import a MIDI Song Source onto a Tape for an Organ, with automatic Transposition to fit the Pipes. The Tape belongs to exactly one Organ, holds no tempo, and defines the physical length of one Column (a 1/32 note) in mm. Tapes survive an app restart (ADR 3) through the strict Electron boundary (ADR 4). UI in English and German. Out of scope: editing a Tape, cranking a Tape, exporting a Tape, other Song Sources."

## Clarifications

### Session 2026-10-14

- Q: What happens to Notes that match no Pipe after the best Transposition? → A: Each is first
  moved by whole octaves onto a Pipe with the same note name, where one exists. Only the rest are
  left off the Tape and listed as Unplayable Notes (FR-009).
- Q: Are Holes that are shorter than the Minimum Hole Length, or closer than the Minimum Gap,
  fixed or only reported? → A: Fixed automatically, and every fix is reported in the Import
  Summary (FR-012).
- Q: Is a read-only view of the Tape part of this slice? → A: Yes (Story 4, FR-018).
- Q: What happens when I remove a Pipe from an Organ whose Tapes have Holes for that Pipe? → A:
  Before saving, the Organ editor says how many Tapes and Holes are affected. After I confirm,
  those Holes are removed and the Tapes keep everything else, including their length in Columns.
  A Tape left without Holes stays; I can remove it myself (FR-021, Story 2 scenario 5).
- Q: Which terms does this slice add to the dictionary? → A: Tick, Fit and Import Summary. The
  Parts chosen for a Tape are "the selected Parts", not a term of their own.
- Q: Where does a new Tape start, and which Column is Column 1 in the Import Summary? → A: The Tape
  starts at the first Note of the selected Parts, an Unplayable Note included. Silence before it
  is cut, silence between Notes is kept, and the Tape ends with the end of its last Hole. Columns
  in the Import Summary are counted from 1 at the Tape's start, so none is negative; inside the
  program Columns still count from 0 (FR-013, FR-015).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bring a MIDI song onto a tape for my organ (Priority: P1)

As the owner of a barrel organ, I pick one of my Organs and a MIDI file. Crancula reads the Song,
finds the Transposition that lets the most Notes play on my Pipes, moves the remaining Notes by
whole octaves where that helps, puts every Note onto the 1/32 Column grid and turns it into a
Hole in the row of its Pipe. It makes sure every Hole respects the Minimum Hole Length and the
Minimum Gap. I give the Tape a name and the length of one Column in mm, and Crancula creates the
Tape. Its Import Summary tells me which Transposition it used, what it changed, and what it could
not bring onto the Tape.

**Why this priority**: This is the core of Crancula: without a Tape there is nothing to punch.
The next slice ("Punch a tape") needs a Tape to export.

**Independent Test**: With one stored Organ, import a small reference MIDI file whose Notes all
fit the Pipes after a known Transposition, and check the created Tape: its Organ, Column length,
Transposition, and every Hole's Pipe, start Column and length.

**Acceptance Scenarios**:

1. **Given** a stored Organ with Pipes C4–C6 and a MIDI file whose melody spans C3–C5, **When** I
   bring it onto a Tape for that Organ, **Then** the Transposition is +12 semitones and every Note
   becomes a Hole in the row of its transposed Pipe.
2. **Given** a Song whose Notes already all match Pipes, **When** I bring it onto a Tape, **Then**
   the Transposition is 0.
3. **Given** a Song that starts with a quarter Note on the first beat, followed by a quarter Note
   on the second beat, **When** it is brought onto the Tape, **Then** the second Note's Hole starts
   at Column 8 (counted from 0) and is 8 Columns long, before the Minimum Hole Length and Minimum
   Gap fixes (FR-012) apply.
4. **Given** a Note that starts or ends between two Column boundaries, **Then** its start and end
   are moved to the nearest Column boundary.
5. **Given** an Organ with Pipes C4–C6 and, after the best Transposition, a Note B6 that matches no
   Pipe, **When** the Tape is created, **Then** that Note becomes a Hole in the row of B5, and the
   Import Summary lists it as moved down one octave.
6. **Given** an Organ without a Pipe named F#, and a Song with an F#4 that matches no Pipe after the
   best Transposition, **When** the Tape is created, **Then** that Note is not on the Tape, and the
   Import Summary lists it as an Unplayable Note with its note name, Part and Column.
7. **Given** an Organ whose Minimum Hole Length is longer than one Column and a Song with a 1/32
   Note, **When** the Tape is created, **Then** that Hole is lengthened to the shortest whole number
   of Columns that reaches the Minimum Hole Length, and the Import Summary lists the change.
8. **Given** the same Note played twice in a row without a pause, **When** the Tape is created,
   **Then** the first Hole is shortened so that the Minimum Gap is kept, and the Import Summary
   lists the change.
9. **Given** no Organ is stored yet, **When** I want to bring a Song onto a Tape, **Then** I'm told
   to describe an Organ first and can go there.
10. **Given** I chose a file that is not a readable MIDI file, or one without Notes, **Then** I'm
    told why and no Tape is created.

---

### User Story 2 - My tapes are kept (Priority: P1)

I see all my Tapes in a list, each with its name, its Organ and its length. They are still there
after I restart Crancula. I can remove a Tape I no longer need.

**Why this priority**: A Tape that disappears at the next start is useless for a desktop tool
used across sessions, and the next slice exports stored Tapes.

**Independent Test**: Create a Tape, restart the app, compare the Tape's Holes, Column length and
Organ to before; then remove it and restart again.

**Acceptance Scenarios**:

1. **Given** I created a Tape, **When** I restart the app, **Then** the Tape is listed and all its
   Holes, its Column length and its Organ are unchanged.
2. **Given** a stored Tape, **When** I remove it and confirm, **Then** it is gone, also after a
   restart. **When** I cancel instead, **Then** nothing changes.
3. **Given** the stored Tapes can't be read at startup (damaged or from an unknown newer version),
   **When** the app starts, **Then** I'm told so, the app still starts, my Organs are available,
   and the unreadable data is kept untouched.
4. **Given** an Organ that has Tapes, **When** I delete the Organ, **Then** the confirmation tells me
   how many Tapes are removed with it; after confirming, the Organ and its Tapes are gone.
5. **Given** an Organ with a Pipe that has 5 Holes on 2 of its Tapes, **When** I remove that Pipe in
   the Organ editor and save, **Then** I'm told before saving that 2 Tapes and 5 Holes are
   affected. **When** I confirm, **Then** those Holes are gone, also after a restart, and both
   Tapes keep their name, their other Holes and their length in Columns. **When** I cancel
   instead, **Then** neither the Organ nor its Tapes change.

---

### User Story 3 - Choose which parts go onto the tape (Priority: P2)

A MIDI file often holds several Parts (melody, accompaniment, bass, drums). Before the Tape is
created I see the Parts of the Song and choose which of them go onto the Tape. The Transposition
is chosen again for the selected Parts.

**Why this priority**: Many MIDI files contain Parts that would crowd the Tape or don't belong on
a barrel organ. Bringing all non-percussion Parts onto the Tape is an acceptable default at first.

**Independent Test**: Import a MIDI file with a melody Part, a bass Part and a percussion Part;
deselect the bass and check that only melody Notes become Holes.

**Acceptance Scenarios**:

1. **Given** a Song with three Parts, one of them percussion, **When** I start the import, **Then**
   I see each Part with its name (if the Song Source has one) and its number of Notes; all
   non-percussion Parts are selected and the percussion Part is not.
2. **Given** I deselect a Part, **Then** the proposed Transposition and its Fit are updated for the
   remaining selected Parts.
3. **Given** I deselect every Part, **Then** I can't create the Tape.

---

### User Story 4 - Look at my tape (Priority: P2)

After the Tape is created, and later from the Tape list, I can look at it: one row per Pipe in
the Organ's order, labelled with its note name, the Columns along the Tape, and the Holes on them.
I also see which Parts of the Song are on the Tape. I can't change the Tape here; that is "Edit a
tape".

**Why this priority**: Seeing the Holes lets me judge the result before I punch it. The Import
Summary and the Tape list (Stories 1 and 2) already make the slice usable end to end.

**Independent Test**: Create a Tape from a reference MIDI file and compare the shown Holes with
the expected rows, start Columns and lengths.

**Acceptance Scenarios**:

1. **Given** a stored Tape, **When** I open it, **Then** I see one row per Pipe of its Organ, in row
   order, with its note name, and every Hole at its start Column with its length.
2. **Given** a long Tape, **When** I open it, **Then** I can move along the whole Tape.
3. **Given** a stored Tape, **Then** it can't be changed in this view.
4. **Given** a Tape created from two of a Song's three Parts, **When** I open it, **Then** I see
   which two Parts are on it.

---

### User Story 5 - Try another transposition (Priority: P3)

Before the Tape is created, I can replace the proposed Transposition with another number of
semitones, for example an octave higher because it sounds better, and see its Fit.

**Why this priority**: The automatic Transposition fits the most Notes, but not always the best
sounding key. Changing the Transposition of an existing Tape belongs to "Edit a tape".

**Independent Test**: Import a Song, change the proposed Transposition by +12 semitones, create the
Tape and check that its Holes are shifted by one octave compared to the proposal.

**Acceptance Scenarios**:

1. **Given** the proposed Transposition is −5 semitones, **When** I choose +7 instead, **Then** I see
   the Fit for +7 (how many Notes match a Pipe, how many are moved by octaves and how many are
   Unplayable Notes), and the created Tape uses +7.
2. **Given** I changed the Transposition, **When** I ask for the proposal again, **Then** the
   automatic Transposition is restored.
3. **Given** the highest selected Note is G9 (MIDI note number 127), **When** I try a
   Transposition of +1, **Then** I can't choose it.

---

### User Story 6 - Use it in German or English (Priority: P3)

All texts of this feature, including the Import Summary and error messages, are available in
German and English.

**Why this priority**: Required by the constitution, but it doesn't change what the feature does.

**Independent Test**: Switch the language and walk through Stories 1 and 2; no text is shown
untranslated.

**Acceptance Scenarios**:

1. **Given** the app is set to German, **When** I bring a Song onto a Tape and trigger each error
   message, **Then** all labels and messages are German.

---

### Edge Cases

- A Note shorter than half a Column would vanish on the grid; it becomes one Column long instead.
- Triplets and swung rhythms don't fall on the 1/32 grid; their starts and ends are rounded to the
  nearest Column. Crancula doesn't report this rounding.
- Two Notes on the same Pipe that overlap after rounding (for example the same note in two Parts,
  or brought together by the Transposition or an octave move) become one Hole covering both.
- A Note repeated right after itself on the same Pipe leaves no gap; the first Hole is shortened
  (FR-012). If the first Hole is already as short as the Minimum Hole Length allows, both become
  one Hole and the repetition is lost; the Import Summary says so.
- A lengthened Hole that now comes too close to the next Hole in its row is handled by the
  Minimum Gap fix in the same way.
- A Note matches no Pipe, and two Pipes with its note name are equally many octaves away: the
  upward one is used.
- Tempo and tempo changes in the Song don't change the Tape: Columns are musical time, and the
  Tape holds no tempo.
- The Tape starts at the first Note of the selected Parts, even if that Note is an Unplayable
  Note, so silence before it is cut. Silence between Notes is kept. The Tape ends with the end of
  its last Hole.
- An Unplayable Note before the first Hole is listed with its Column counted from 1 at the Tape's
  start, like every other Column in the Import Summary; no Column is negative. If it is the very
  first Note, it is in Column 1, and the first Hole starts after it.
- Several Transpositions fit the same number of Notes: the one with the fewest semitones wins; if
  two are equally far (for example −6 and +6), the upward one wins.
- Not a single Note of the selected Parts can be placed, not even by moving it by octaves: no Tape
  can be created, and I'm told why.
- A MIDI file that only contains percussion Parts: nothing is selected by default, so no Tape can
  be created until I select a Part (Story 3).
- MIDI files whose timing is not counted in beats (rare, time-code based files) and MIDI files of
  format 2 (several independent sequences in one file) are rejected with a message naming the
  reason.
- A long Song (for example 10 minutes, thousands of Columns) can still be brought onto a Tape,
  stored and looked at.
- Two Tapes may have the same name; they are still distinct Tapes.
- The same MIDI file can be brought onto several Tapes, also for different Organs.
- An Organ is changed after it has Tapes: Holes follow their Pipe when Pipes are reordered.
  Removing a Pipe that has Holes on a Tape tells me before saving how many Tapes and Holes are
  affected; after I confirm, those Holes are removed and the Tapes keep everything else,
  including their length in Columns. Changed Tape Bed measurements or Minimum Gap are not
  re-applied to existing Tapes in this slice.
- Removing a Pipe leaves a Tape without any Hole: the Tape stays, with its length in Columns, until
  I remove it.
- The Organs can't be read at startup, so the Tapes' Organs are missing: the Tapes stay stored and
  listed but can't be opened until their Organ is readable again. Nothing is deleted.
- I delete an Organ while the stored Tapes can't be read: the deletion is refused with a message,
  so no Tape is lost. Once the Tapes are readable, I can delete the Organ.
- If writing Tapes to disk fails (for example disk full), I'm told so and the Tape stays in the app
  so that nothing is lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to bring a Song from a MIDI Song Source onto a new Tape for one
  chosen stored Organ. If no Organ is stored, the system MUST say so and offer to describe one.
- **FR-002**: The system MUST reject a file that is not a readable MIDI file, is a MIDI file of
  format 2, is not timed in beats, or has no Notes in any selectable Part, with a message naming
  the reason. No Tape is created.
- **FR-003**: From the Song the system MUST use, for each Note: its MIDI note number, its start and
  its duration in musical time, and the Part it belongs to. Loudness, instruments, tempo, lyrics
  and other information MUST NOT affect the Tape.
- **FR-004**: The system MUST show the Song's Parts with their name (if any) and number of Notes.
  All non-percussion Parts MUST be selected by default and percussion Parts not. Users MUST be
  able to change which Parts are selected; a Tape needs at least one selected Part (Story 3).
- **FR-005**: The system MUST put every Note onto the Column grid (Quantisation): one Column is a
  1/32 note, and a Note's start and end move to the nearest Column boundary. A Note that would
  become shorter than one Column MUST be one Column long.
- **FR-006**: The system MUST propose the Transposition, in whole semitones, under which the most
  Notes of the selected Parts match a Pipe of the Organ. Ties MUST be decided by the fewest
  semitones, then by upward over downward.
- **FR-007**: Users MUST be able to replace the proposed Transposition with any other number of
  semitones that keeps every selected Note within MIDI note numbers 0–127, before the Tape is
  created, and see its Fit: how many Notes match a Pipe, how many are moved by octaves (FR-009)
  and how many are Unplayable Notes. Users MUST be able to return to the proposal (Story 5).
- **FR-008**: Each Note that matches a Pipe after the Transposition MUST become a Hole in that
  Pipe's row, starting at the Note's start Column and as many Columns long as the Note. Notes on
  the same Pipe that overlap MUST become one Hole covering both.
- **FR-009**: A Note that matches no Pipe after the Transposition MUST be moved by whole octaves
  onto the nearest Pipe with the same note name (the fewest octaves; if two are equally near, the
  upward one) and then placed as in FR-008. A Note for which the Organ has no Pipe with the same
  note name is an Unplayable Note: it MUST NOT be on the Tape and MUST be listed in the Import
  Summary with its note name, Part and Column.
- **FR-010**: Every Tape MUST have a Column length in mm greater than 0. Users MUST enter it when
  creating the Tape; it MUST be prefilled with the Column length of the last Tape created for the
  same Organ, or, for an Organ's first Tape, with the Organ's Minimum Hole Length.
- **FR-011**: A Hole's length in mm MUST be its number of Columns times the Tape's Column length;
  the gap between two Holes in a row is the number of Columns between them times the Column
  length.
- **FR-012**: A created Tape MUST NOT contain a Hole shorter than the Organ's Minimum Hole Length or
  closer than its Minimum Gap to the next Hole in its row. The system MUST fix such Holes
  automatically, row by row from the start of the Tape:
  1. a Hole shorter than the Minimum Hole Length is lengthened at its end to the shortest whole
     number of Columns that reaches it;
  2. a Hole closer than the Minimum Gap to the next Hole in its row is shortened at its end by the
     fewest whole Columns that keep the Minimum Gap;
  3. if that would make it shorter than the Minimum Hole Length, it and the next Hole become one
     Hole, and the next Note's repetition is lost.
  The start of a Hole MUST NOT be moved.
- **FR-013**: The Tape MUST start at the first Note of the selected Parts (its first Column is
  that Note's first Column), an Unplayable Note included. Silence before that Note MUST be cut and
  silence between Notes MUST be kept. When created, the Tape MUST end with the end of its last
  Hole, after the fixes of FR-012. Its length in Columns MUST NOT change when Holes are removed
  later (FR-021).
- **FR-014**: Each Tape MUST have a name, prefilled with the Song's name from the Song Source or,
  if it has none, the file name. A Tape MUST NOT be created without a name.
- **FR-015**: After a Tape is created, the system MUST show the Import Summary: the Transposition
  used, the number of Notes on the Tape, every Note moved by octaves (FR-009), the Unplayable
  Notes, and every Hole merged (FR-008), lengthened, shortened or merged (FR-012), each with its
  Pipe and Column. Columns in the Import Summary MUST be counted from the Tape's start, Column 1
  being the Tape's first Column; inside the program, Columns count from 0.
- **FR-016**: The Tape MUST belong to exactly one Organ and MUST keep the Transposition and the
  selected Parts it was created with. It MUST reference the Song it was created from, and that
  Song MUST be kept as long as a Tape references it.
- **FR-017**: Users MUST be able to see a list of all Tapes, each with its name, its Organ and its
  length in Columns and in mm.
- **FR-018**: Users MUST be able to look at a stored Tape, also right after creating it: one row
  per Pipe in the Organ's order, labelled with its note name, its Holes along the Columns, and
  which Parts of its Song are on it. The view MUST NOT allow changing the Tape.
- **FR-019**: Users MUST be able to remove a Tape after confirming the removal.
- **FR-020**: Deleting an Organ that has Tapes MUST name the number of its Tapes in the
  confirmation and remove those Tapes with the Organ. While the stored Tapes can't be read
  (FR-023), deleting an Organ MUST be refused with a message naming the reason.
- **FR-021**: Holes MUST stay with their Pipe when the Organ's Pipes are reordered. Removing a Pipe
  that has Holes on any Tape MUST, before saving the Organ, tell the user how many Tapes and Holes
  are affected. After the user confirms, saving MUST remove those Holes and keep everything else
  of the Tapes, including their length in Columns; a Tape left without Holes MUST stay. If the
  user cancels, neither the Organ nor its Tapes change.
- **FR-022**: Stored Tapes MUST survive an app restart unchanged.
- **FR-023**: If stored Tapes can't be read at startup, the app MUST start anyway, inform the user,
  keep the Organs usable, and MUST NOT overwrite the unreadable data. If the Organs can't be read,
  Tapes whose Organ is therefore missing MUST stay stored and listed, MUST NOT be deleted, and
  can't be opened until their Organ is readable.
- **FR-024**: If writing Tapes to disk fails, the app MUST inform the user and keep the Tape in the
  app.
- **FR-025**: All texts of this feature MUST be available in English and German.

### Key Entities

- **Song**: music imported from a Song Source. It has a name (from the Song Source or the file
  name) and Notes, each with a MIDI note number, a start and a duration in musical time (Ticks),
  and the Part it belongs to. It holds no Columns, Pipes or Holes.
- **Part**: one voice or instrument of a Song, such as melody, bass or drums. It
  has an optional name, its Notes, and whether it is percussion.
- **Tape**: a Song arranged for one Organ. It has an identity independent of its name, a name,
  its Organ (by id), optionally its Song (by id) and the selected Parts, the Transposition it was
  created with, a Column length in mm, a length in Columns, and its Holes. Every Hole lies in the
  row of one of the Organ's Pipes and within the Tape's Columns; no two Holes in the same row
  overlap; every Hole respects the Minimum Hole Length and the Minimum Gap.
- **Hole**: one Note played by one Pipe. It has its Pipe, a start Column and a length of at least
  one Column.
- **Transposition**: the number of semitones every Note of the selected Parts is shifted by when
  the Tape is created.
- **Fit**: for one Transposition, how many Notes of the selected Parts match a Pipe, how many are
  moved by octaves and how many are Unplayable Notes.
- **Unplayable Note**: a Note of the Song that no Pipe of the Organ can play,
  not even after the Transposition and a move by whole octaves, so it isn't on the Tape.
- **Import Summary**: what the user sees once after a Song is brought onto a Tape: the
  Transposition, the Notes moved by octaves, the Unplayable Notes and the Holes fixed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users bring a MIDI Song of up to 5 minutes onto a Tape for their Organ in under
  2 minutes, from choosing the file to seeing the Import Summary.
- **SC-002**: For reference Songs whose Notes all fit after a known Transposition, 100% of Notes
  become Holes at the expected Pipe, start Column and length, with the expected Transposition.
- **SC-003**: No Note of the selected Parts is lost silently: each is a Hole of its own, part of a
  merged Hole listed in the Import Summary, or listed as an Unplayable Note.
- **SC-004**: 0 Holes on a created Tape are shorter than the Minimum Hole Length or closer than the
  Minimum Gap to the next Hole in their row, and 100% of the fixes are listed in the Import
  Summary.
- **SC-005**: After a restart, 100% of stored Tapes are listed with identical Holes, Column length,
  Transposition and Organ.
- **SC-006**: Bringing a 5-minute Song with up to 16 Parts onto a Tape takes under 5 seconds, and
  opening that Tape to look at it takes under 2 seconds.
- **SC-007**: No data loss when the stored Tapes are unreadable: the original data is unchanged
  after the app has started.
- **SC-008**: Every text of the feature is shown in the selected language, with no untranslated
  keys.

## Assumptions

- **New terms:** "Part", "Unplayable Note" and "Quantisation" were added to the dictionary with
  the user's approval (2026-10-14). The dictionary now says a Hole belongs to its Pipe, not to a
  row number, so Holes follow their Pipe when Pipes are reordered (FR-021). In a second session
  the same day, the user approved "Tick", "Fit" and "Import Summary"; the Parts chosen for a Tape
  are "the selected Parts", not a term of their own.
- **Parts:** a Part is one MIDI track and channel; percussion Parts are those on MIDI channel 10.
  Percussion Notes are drum sounds, not pitches, so they are not selected by default.
- **MIDI format 2:** files with several independent sequences are rejected with a message naming
  the reason, like other unreadable files (FR-002). Playing their sequences at the same time
  would put unrelated patterns on top of each other.
- **Best Transposition:** "most Notes" counts Notes that match a Pipe directly, not their
  durations and not octave moves. Every shift that keeps Notes within MIDI note numbers 0–127 is
  considered.
- **Range of the Transposition:** the user's own Transposition is limited to the same range as
  the proposal: every selected Note stays within MIDI note numbers 0–127 (FR-007).
- **Order of steps:** Quantisation (FR-005), Transposition (FR-006), octave moves (FR-009), merging
  overlaps (FR-008), then the Minimum Hole Length and Minimum Gap fixes (FR-012).
- **Column length:** set once when the Tape is created and not changed in this slice; changing it
  would change every Hole's length in mm and belongs to "Edit a tape". The first default equals
  the Minimum Hole Length so a one-Column Hole is just long enough.
- **Columns in the Import Summary:** counted from 1 at the Tape's start; Column 1 is the Tape's
  first Column, the first Column of the first Note of the selected Parts. Since the Tape starts
  there (FR-013), no Column is negative, also for an Unplayable Note before the first Hole. Inside
  the program, Columns count from 0; the Song's Columns are shifted by the Tape's first Note.
- **Song kept:** the Song's Notes, Parts and name are stored with the Tapes that reference it, not
  the original file. There is no Song list in this slice; a Song no longer referenced by any Tape
  is removed.
- **Selected Parts kept:** a Tape remembers which Parts of its Song were selected and shows them
  when I look at it (FR-016, FR-018). They can't be changed in this slice.
- **Tempo:** the Tape holds no tempo; the Crank sets it. Tempo in the MIDI file is ignored.
- **Import Summary:** shown once after creating the Tape; it is not stored with the Tape.
- **Tape view:** read-only, without playback, bar lines or zoom levels beyond what is needed to
  move along the whole Tape.
- **No editing:** Holes, the Tape name, the Column length and the Transposition can't be changed
  after the Tape is created; that is "Edit a tape". To change them, the user brings the Song onto
  a new Tape. The only change in this slice is removing the Holes of a removed Pipe (FR-021).
- **Existing Tapes and Organ changes:** Tapes are not re-checked against a changed Tape Bed or
  Minimum Gap in this slice. A Tape whose Holes were removed with their Pipe keeps its length in
  Columns, even if it now ends or starts with empty Columns or has no Hole at all.
- **Tapes without a readable Organ:** if the Organs can't be read at startup, Tapes stay stored
  and listed but can't be opened until their Organ is readable; nothing is deleted (FR-023).
- **Organ deletion while the Tapes are unreadable:** refused with a message, because the
  confirmation couldn't name the Tapes removed with the Organ and their removal couldn't be
  saved. The user deletes the Organ once the Tapes are readable (FR-020).
- **Single user:** one computer, one user; no sharing or syncing.
- **Out of scope:** editing a Tape, cranking a Tape, exporting or punching a Tape, Air Demand,
  other Song Sources (MusicXML, PDF, Scores), exporting a Song, lead-in or lead-out tape for
  threading, and splitting a Tape into pieces.
- **Prototype code:** existing code is a quarry; this slice may replace it.
