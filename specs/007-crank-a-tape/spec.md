# Feature Specification: Crank a tape

**Feature Branch**: `007-crank-a-tape`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Crank a tape (#149, v0.2): hear a Tape the way the Organ would play it,
at a Crank speed (Crank turns per minute) I choose, before cutting it. The Organ gains Tape per Crank
turn (mm). A synthesised organ-like tone per Pipe; a playhead runs through the Tape view; start from
any Column; Crank speed adjustable while playing; editing paused while it plays. Preview changes
nothing. Holes without a Pipe on the Organ are silent; Holes with a Cutting Problem play as drawn and
stay marked. Recording audio is out of scope (Record a tape)."

## Clarifications

### Decisions before specifying (user, 2026-10-23)

From [the discovery](../../documentation/discovery/later.md), section 1, decisions 3–6:

- Q: How is the Crank speed set? → A: In Crank turns per minute; the Organ gains "Tape per Crank
  turn" in mm.
- Q: What does the Preview sound like? → A: One simple synthesised organ-like tone per Pipe; no sound
  files.
- Q: What can the owner do while it plays? → A: A playhead runs through the Tape view; start from any
  Column; the Crank speed can be changed while playing; editing is paused.
- Q: Exporting audio? → A: Its own later slice, Record a tape.
- Terms Crank speed, Tape per Crank turn and Preview approved for DICTIONARY.md.

### Session 2026-10-23

- Q: Which Tape per Crank turn does an Organ saved before this slice get? → A: None; it stays empty
  until the owner enters one. Until then the Preview of that Organ's Tapes is unavailable and the
  Tape view says why, with a way to the Organ editor.
- Q: Is the Crank speed remembered? → A: Per Tape. It is a value of the Tape like the Column length;
  changing it is an edit and one undo step. The dictionary's Tape and Preview entries say so.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear the Tape (Priority: P1)

The organ owner has a Tape in the Tape view and wants to know how it will sound on their Organ before
cutting vinyl. They start the Preview; every Hole sounds its Pipe's note for as long as the Hole
passes, at the chosen Crank speed, and a playhead moves along the Tape in step with the sound. They
stop it whenever they like.

**Why this priority**: it is the capability; without it a mistake is only heard after cutting.

**Independent Test**: open a Tape with a few Holes, start the Preview, hear the notes in order and see
the playhead move from the first Column to the end, where the Preview stops by itself.

**Acceptance Scenarios**:

1. **Given** a Tape and its Organ, **When** the owner starts the Preview, **Then** each Hole sounds
   its Pipe's note from the moment its first Column reaches the playhead until its last Column has
   passed, and Holes on the same Column sound together.
2. **Given** the Preview plays, **When** it reaches the Tape's last Column, **Then** it stops by
   itself and the playhead stays visible at the end.
3. **Given** the Preview plays, **When** the owner stops it (button or Space), **Then** all sound
   stops at once and the playhead stays where it stopped.
4. **Given** a Hole whose Pipe is not on the Organ, **When** the playhead passes it, **Then** it is
   silent and keeps its Cutting Problem mark.
5. **Given** a Hole with another Cutting Problem (too short, too close), **When** the playhead passes
   it, **Then** it plays as drawn and stays marked.
6. **Given** the Preview played and stopped without a Crank speed change, **When** the owner looks
   at the Tape, **Then** the Tape, its Holes and the undo history are exactly as before.

---

### User Story 2 - Choose the Crank speed (Priority: P1)

The owner sets how fast the Crank is turned, in turns per minute, and hears the Tape at that tempo.
They can change it while the Preview plays and the tempo follows from the playhead's place on.

**Why this priority**: the same Tape sounds right or wrong only at a given Crank speed; the owner
needs to try the speed they will really turn.

**Independent Test**: play a Tape at 30 turns per minute, then at 60; the second plays in half the
time, and the playhead covers the same Tape in half the time.

**Acceptance Scenarios**:

1. **Given** an Organ with Tape per Crank turn 100 mm and a Tape with Column length 5 mm, **When** the
   Crank speed is 60 turns per minute, **Then** each Column plays for 50 ms (100 mm per second).
2. **Given** the Preview plays, **When** the owner changes the Crank speed, **Then** the tempo changes
   from the playhead's current place on, without starting over and without a gap.
3. **Given** the Crank speed field, **When** the owner enters 0, a negative number or text that is not
   a number, **Then** it is refused with a message and the previous Crank speed stays.
4. **Given** the language is German, **When** the owner enters a decimal Crank speed with a comma,
   **Then** it is read like other decimals (comma or point).
5. **Given** a Crank speed and a Tape, **When** the owner looks at the Preview controls, **Then** they
   see how long the Tape plays at that speed.
6. **Given** the owner changed a Tape's Crank speed, **When** the app restarts, **Then** the Tape opens
   with that Crank speed.
7. **Given** the Crank speed was changed, **When** the owner undoes, **Then** the old Crank speed is
   back in one step; redo brings the new one back.

---

### User Story 3 - Describe how far a Crank turn draws the Tape (Priority: P1)

In the Organ editor the owner enters the Organ's Tape per Crank turn in mm, so that turns per minute
mean the same in Crancula as on their Organ.

**Why this priority**: without it a Crank speed cannot be turned into a tempo.

**Independent Test**: set Tape per Crank turn to 120 mm in the Organ editor, restart the app, see
120 mm; play a Tape at a fixed Crank speed and hear it slower than with 240 mm.

**Acceptance Scenarios**:

1. **Given** the Organ editor, **When** the owner enters a Tape per Crank turn, **Then** it is kept
   with the Organ and survives a restart.
2. **Given** the field, **When** the owner enters 0, a negative number or text that is not a number,
   **Then** it is refused with a message, like the editor's other mm values.
3. **Given** an Organ saved before this slice, **When** the app starts, **Then** the Organ opens without a
   Tape per Crank turn, and the Preview of its Tapes is unavailable with a message that leads to the
   Organ editor until one is entered.
4. **Given** the Tape per Crank turn changes, **When** the owner previews a Tape on that Organ,
   **Then** the new value is used; no Tape changes.

---

### User Story 4 - Start from any Column (Priority: P2)

The owner wants to hear one passage again without waiting through the whole Tape. They pick a Column
and start the Preview from there.

**Why this priority**: useful for long Tapes and for checking an edit, but the Tape can be heard
without it.

**Independent Test**: set the start at Column 200 of a 400-Column Tape, start; the first sound is the
Holes that cover Column 200, and the playhead starts there.

**Acceptance Scenarios**:

1. **Given** a Tape, **When** the owner sets the start Column (by clicking the ruler or by entering a
   Column), **Then** the playhead moves there and the Preview starts there.
2. **Given** a Hole that started before the start Column and ends after it, **When** the Preview
   starts, **Then** that Hole sounds at once for its remaining Columns.
3. **Given** the Preview stopped in the middle, **When** the owner starts it again, **Then** it goes on
   from the playhead; at the end it starts again from the first Column.

---

### User Story 5 - Editing is paused while it plays (Priority: P2)

While the Preview plays, the Tape can't be changed, so what is heard is what is drawn.

**Why this priority**: keeps sound and drawing consistent; small once the Preview exists.

**Independent Test**: start the Preview, try to drag a Hole, press Delete, undo, open Transpose or
change the Column length; nothing changes; stop, and editing works again.

**Acceptance Scenarios**:

1. **Given** the Preview plays, **When** the owner tries any Tape edit (pointer, keyboard, side panel,
   dialogs, menu Undo and Redo), **Then** the edit is not made and the owner can see that editing is
   paused while the Preview plays.
2. **Given** the Preview plays, **When** the owner leaves the Tape view (another screen, another Tape),
   **Then** the Preview stops.
3. **Given** the Preview plays, **When** the owner scrolls or zooms the Tape view, **Then** the view
   moves but the Preview keeps playing; the view follows the playhead unless the owner moved it away.

### Edge Cases

- A Tape with no Holes, or only silent Holes: the Preview runs the playhead through and is silent.
- The Lead-in does not play; the Preview starts at the first Column (or the chosen one).
- Two Holes in the same row that touch (no gap) sound as one note held on; a gap shorter than the
  Minimum Gap still gives a short break, as drawn.
- Pipes whose notes are very low or high still sound at their pitch; the tone is the same for all
  Pipes, only the pitch differs.
- Many Pipes at once: the sound stays clean (no clipping) when every Pipe of the Organ plays.
- The computer has no sound output: the Preview still runs the playhead; nothing fails.
- The app window loses focus or is minimised: the Preview keeps time with the sound.
- A very low Crank speed makes a very long Preview; a very high one a very short one; both are
  allowed within the field's limits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: An Organ MUST have a Tape per Crank turn: a finite number of mm above 0, edited in the
  Organ editor and kept with the Organ across restarts.
- **FR-002**: The owner MUST be able to start and stop a Preview of the open Tape in the Tape view, by
  button and by keyboard.
- **FR-003**: A Crank speed MUST be a finite number of Crank turns per minute above 0; anything else
  is refused with a message and the previous Crank speed stays.
- **FR-004**: One Column MUST play for Column length ÷ (Tape per Crank turn × Crank speed ÷ 60)
  seconds.
- **FR-005**: Each Hole whose Pipe is on the Organ MUST sound that Pipe's note, from its first Column
  to the end of its last Column, with one synthesised tone shared by all Pipes and no sound files.
- **FR-006**: Holes whose Pipe is not on the Organ MUST be silent; all other Holes play as drawn,
  Cutting Problems included, and keep their marks.
- **FR-007**: A playhead MUST show in the Tape view where the Tape is, in step with the sound.
- **FR-008**: The owner MUST be able to change the Crank speed while the Preview plays; the tempo
  changes from the playhead's place on, without a restart or a gap.
- **FR-009**: The owner MUST be able to choose the Column the Preview starts from.
- **FR-010**: While the Preview plays, every Tape edit MUST be refused (pointer, keyboard, side panel,
  dialogs, menu Undo and Redo), and the Tape view MUST show that editing is paused.
- **FR-011**: The Preview MUST change nothing: no Hole, not the Organ, and nothing in the undo history
  apart from Crank speed changes the owner makes.
- **FR-012**: The Preview MUST stop when it reaches the end, when the owner stops it, and when the
  owner leaves the Tape view.
- **FR-013**: The Preview controls MUST show how long the Tape plays at the current Crank speed.
- **FR-014**: Each Tape MUST keep its Crank speed across restarts. Changing it is one undo step, undone
  and redone like the edits of specs 004–006; entering the current value changes nothing. It is the
  only Tape value that can change while the Preview plays. Tapes saved before this slice, and new
  Tapes, get a starting Crank speed chosen in the plan.
- **FR-015**: Decimal input MUST accept a comma or a point; numbers show in the language's notation.
- **FR-016**: All new texts MUST exist in English and German.
- **FR-017**: An Organ without a Tape per Crank turn (saved before this slice) MUST open without
  one; the Preview of its Tapes is unavailable and the Tape view says why and leads to the Organ
  editor.

### Key Entities

- **Organ**: gains Tape per Crank turn (mm, above 0).
- **Tape**: gains its Crank speed and a new edit, *change Crank speed*.
- **Crank speed**: Crank turns per minute, above 0; kept by each Tape.
- **Performance** (read model): from a Tape, its Organ and a Crank speed, which Pipe sounds from when
  to when; computed, never stored.
- **Preview**: playing that performance from a start Column; changes nothing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner starts hearing an open Tape in under 5 seconds.
- **SC-002**: The playhead and the sound stay within 50 ms of each other over a 5-minute Preview.
- **SC-003**: A Preview at Crank speed S lasts the Tape's Columns × the Column time of FR-004, within
  1%.
- **SC-004**: After any Preview without a Crank speed change, 100% of Tapes and their undo histories
  are unchanged.
- **SC-005**: A Crank speed change while playing is heard within 0.2 s.

## Assumptions

- The tone is synthesised in the app (organ-like, e.g. a few harmonics with a soft attack and
  release); its exact timbre is chosen in the plan.
- A Pipe's pitch comes from its MIDI note, in equal temperament with A4 = 440 Hz.
- Where the Preview controls sit (toolbar of the Tape view or side panel) and the keyboard shortcut
  (Space unless it clashes) follow the design guide and are chosen in the plan.
- The Crank speed field's limits (e.g. 1 to 300 turns per minute) are chosen in the plan.
- Recording the Preview as an audio file is out of scope (Record a tape).
- Swell, tremolo, register stops and air supply are not modelled.
