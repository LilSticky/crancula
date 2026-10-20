# Feature Specification: Transpose holes

**Feature Branch**: `005-transpose-holes`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Transpose holes (#106, part of #103 Edit a tape). The organ owner
transposes the selected Holes or all Holes of a Tape by a number of semitones in the Tape view. Each
Hole moves to the Pipe that many semitones away; a Hole whose target note has no Pipe is moved by
whole octaves as at import, else removed; a Hole landing on another Hole of its Pipe is merged. The
outcome (moved, moved by octaves, merged, removed) is shown before applying. Manual edits stay, the
Song is untouched, Tape.transposition stays the one it was created with. Undoable like the edits of
004."

## Clarifications

### Decisions before specifying (user, 2026-10-19)

From [the discovery](../../documentation/discovery/edit-a-tape.md):

- Q: Transposing an edited Tape? → A: The Holes move to other Pipes; manual edits stay, the Song is
  untouched.
- Q: A transposed Hole lands on another Hole of its Pipe? → A: They are merged, and this is reported.
- Q: A transposed Hole without a Pipe? → A: Moved by whole octaves as at import, else removed and
  listed; the outcome is shown before applying.
- Dictionary (approved 2026-10-19): "Transposing Holes moves each of them by a number of semitones
  to another Pipe (all Holes of a Tape or the selected ones). The Tape's Transposition is the one it
  was created with."

### Session 2026-10-20

- Q: The Tape view selects one Hole at a time. How do "the selected Holes" work? → A: Selecting
  several Holes is part of this slice: by pointer, by area and by keyboard.
- Q: A Hole whose Pipe is no longer on the Organ, when all Holes are transposed? → A: Left unchanged,
  as in 004; the outcome says how many were left out.

## User Scenarios & Testing *(mandatory)*

Column numbers are the ones the Tape view shows: Column 1 is the first Column after the Lead-in.
"Moved by octaves" means the same rule as at import (spec 002 FR-009): the Pipe of the same note
name nearest by whole octaves, upward on a tie.

### User Story 1 - Transpose the whole tape (Priority: P1)

As the owner of a barrel organ, I find that my Tape sounds better a few semitones higher, or I've
edited it by hand and now want it in another key. I choose to transpose all Holes, enter the number
of semitones, see what will happen to the Holes, and apply it. My manual edits stay where they are,
just on other Pipes.

**Why this priority**: Changing the key of a finished Tape without importing the Song again (and
losing the edits) is the core of this slice.

**Independent Test**: Open a stored reference Tape with manual edits, transpose all Holes by +2,
check every Hole's Pipe and Columns, restart Crancula and check again.

**Acceptance Scenarios**:

1. **Given** an Organ with Pipes C4, D4 and E4 and a Tape with Holes of C4 at Columns 10–13 and of
   D4 at Columns 20–21, **When** I transpose all Holes by +2 semitones, **Then** the Holes are of D4
   at Columns 10–13 and of E4 at Columns 20–21.
2. **Given** I enter a number of semitones, **Then** before anything changes I see how many Holes
   will be moved, moved by octaves, merged and removed, and which Holes will be removed (Pipe,
   start Column).
3. **Given** the outcome is shown, **When** I change the number of semitones, **Then** the outcome
   follows at once; **When** I cancel, **Then** the Tape is unchanged.
4. **Given** I apply a transposition, **When** I close Crancula and open the Tape again, **Then**
   the transposed Holes are there.
5. **Given** any transposition, **Then** the Tape's Song, selected Parts, Organ, Transposition (the
   one it was created with), Column length, length and name are unchanged.

---

### User Story 2 - Holes without a Pipe after transposing (Priority: P1)

Some Holes would land on a note my Organ has no Pipe for. As at import, they are moved by whole
octaves onto a Pipe of the same note name; when there is none, they are removed. I see this before I
apply.

**Why this priority**: Organs rarely have every semitone. Without this rule, most transpositions
couldn't be applied at all.

**Independent Test**: On an Organ without C#4 and D#4 but with D#5, transpose a Tape with Holes of
C4 and C#4 by +1 and check the outcome before and the Holes after applying.

**Acceptance Scenarios**:

1. **Given** an Organ with Pipes C4, D4 and D#5 and no D#4, **When** I transpose a Hole of D4 by +1,
   **Then** it becomes a Hole of D#5 at the same Columns, counted as moved by octaves.
2. **Given** an Organ with no Pipe of the note name C#, **When** I transpose a Hole of C4 by +1,
   **Then** it is removed and listed as removed in the outcome.
3. **Given** a transposition would remove every Hole, **Then** the outcome says so and I can still
   cancel.

---

### User Story 3 - Holes that land on each other are merged (Priority: P1)

A transposed Hole may land on a Pipe where another Hole already covers some of the same Columns (an
untouched Hole, or another transposed one). Instead of refusing, Crancula merges them into one Hole
and tells me.

**Why this priority**: Overlapping Holes of one Pipe can't exist on a Tape; refusing the whole
transposition for one overlap would make it useless on dense Tapes.

**Independent Test**: Select a Hole of C4 at Columns 10–13 while D4 has a Hole at Columns 12–16,
transpose the selection by +2 and check a single Hole of D4 at Columns 10–16.

**Acceptance Scenarios**:

1. **Given** a Hole of C4 at Columns 10–13 and a Hole of D4 at Columns 12–16, **When** I transpose
   only the C4 Hole by +2, **Then** D4 has one Hole at Columns 10–16, and the outcome counts one
   merge.
2. **Given** Holes of C4 and C5 at overlapping Columns and an Organ without the target of C4 but with
   the target of C5, **When** the C4 Hole is moved by octaves onto the same Pipe as the C5 Hole,
   **Then** they are merged into one Hole covering both.
3. **Given** a transposed Hole that only touches or comes close to another Hole of its new Pipe,
   **Then** they are not merged; the Holes are marked with their Cutting Problem as in spec 004.

---

### User Story 4 - Select several holes and transpose them (Priority: P2)

Only one voice or passage is in the wrong key. I select the Holes I want — one by one, or all
Holes in an area of the Tape — and transpose just those. The other Holes stay where they are.

**Why this priority**: Transposing part of a Tape is the finer tool; the whole-Tape transposition
(Story 1) already covers the common case.

**Independent Test**: Select three Holes on different rows by pointer, add two more by area,
transpose the selection by −12 and check that only those five moved.

**Acceptance Scenarios**:

1. **Given** one selected Hole, **When** I add another Hole to the selection, **Then** both are
   selected; **When** I take one out again, **Then** only the other stays selected.
2. **Given** an area of the Tape, **When** I select by that area, **Then** every Hole on a row of
   the area that lies at least partly inside it is selected.
3. **Given** several selected Holes, **When** I transpose them, **Then** only they move, and the
   outcome counts only them (plus merges with untouched Holes).
4. **Given** I apply a transposition, **Then** the resulting Holes are selected, so I can transpose
   them again or undo.
5. **Given** several selected Holes, **Then** the side panel shows how many are selected instead of
   the details of one Hole.
6. **Given** a plain click on a Hole or an empty spot, **Then** the selection works as in spec 004
   (one Hole or none).

---

### User Story 5 - Undo a transposition (Priority: P2)

I transposed and don't like the result. One undo brings back every Hole as it was, including the
merged and removed ones; redo applies it again.

**Why this priority**: Merges and removals lose Holes; undo makes trying a key safe. Undo itself
exists since spec 004.

**Independent Test**: Transpose a Tape so that Holes are merged and removed, undo once and compare
with the Tape before; redo and compare with the transposed one.

**Acceptance Scenarios**:

1. **Given** I applied a transposition, **When** I undo once, **Then** the Tape is as before,
   including merged and removed Holes, and it is saved like this.
2. **Given** I undid a transposition, **When** I redo, **Then** it is applied again with the same
   outcome.

---

### User Story 6 - Keyboard and German or English (Priority: P3)

I can select several Holes, choose the number of semitones, see the outcome and apply or cancel
without a pointer, in German and English.

**Why this priority**: The Tape view is keyboard-operable since spec 004; the constitution requires
both languages.

**Independent Test**: With the keyboard only, select two Holes, transpose them by +3, undo; switch
to German and check every new text.

**Acceptance Scenarios**:

1. **Given** a selected Hole, **When** I use the keyboard, **Then** I can add the next Hole in a
   direction to the selection, select all Holes, and clear the selection.
2. **Given** the keyboard only, **Then** I can start a transposition, enter the semitones, apply or
   cancel.
3. **Given** German is chosen, **Then** every new label, outcome and message is German.

### Edge Cases

- 0 semitones: nothing to apply; applying is unavailable.
- A target note outside the notes a Pipe can have counts as a note without a Pipe (moved by octaves
  or removed).
- A Hole whose Pipe is not on the Organ is never transposed; with "all Holes" it is left out and the
  outcome says how many were left out. Its Cutting Problem stays.
- Several transposed Holes and untouched Holes overlapping on one Pipe merge into one Hole for each
  run of overlapping Holes.
- A merged Hole keeps the earliest start and the latest end of the Holes it merges; the Tape never
  grows, since Columns don't change.
- A Tape without Holes, or nothing selected with "selected Holes": transposing is unavailable.
- Hole fixes (automatic lengthening or merging for the Minimum Hole Length and Minimum Gap) are not
  applied; resulting Cutting Problems are marked as in spec 004.
- A save fails: as for the edits of spec 004.
- Leaving the Tape view clears the selection and the undo history, as in spec 004.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to transpose all Holes of a Tape, or the selected Holes, by a whole
  number of semitones up or down.
- **FR-002**: Each transposed Hole MUST move to the Pipe whose note is that many semitones away,
  keeping its Columns.
- **FR-003**: When no Pipe has the target note, the Hole MUST be moved by whole octaves to the Pipe
  of the same note name nearest the target, upward on a tie (as at import); when there is none, the
  Hole MUST be removed.
- **FR-004**: When Holes of one Pipe overlap after transposing, they MUST be merged into one Hole
  from the earliest start to the latest end. Holes that only touch or are close MUST NOT be merged.
- **FR-005**: Before anything changes, the user MUST see the outcome: how many Holes will be moved,
  moved by octaves, merged and removed, which Holes will be removed (Pipe, start Column), and how
  many Holes without a Pipe on the Organ are left out. The outcome MUST follow every change of the
  semitones.
- **FR-006**: The user MUST be able to apply or cancel. Cancelling MUST leave the Tape unchanged.
- **FR-007**: Holes not being transposed MUST stay unchanged, except when merged with a transposed
  Hole.
- **FR-008**: Holes whose Pipe is not on the Organ MUST NOT be transposed.
- **FR-009**: Transposing MUST NOT change the Tape's Song, selected Parts, Organ, Transposition,
  Column length, length or name.
- **FR-010**: An applied transposition MUST be one edit: saved like the edits of spec 004, undone and
  redone in one step.
- **FR-011**: After applying, the resulting Holes MUST be selected, and Cutting Problems MUST be
  marked as in spec 004.
- **FR-012**: Users MUST be able to select several Holes: add a Hole to or take it out of the
  selection, select every Hole within an area of the Tape, select all Holes, and clear the
  selection. A plain selection still selects one Hole (spec 004).
- **FR-013**: With several Holes selected, the side panel MUST show how many are selected.
- **FR-014**: Selecting several Holes, transposing, applying and cancelling MUST be possible with the
  keyboard alone.
- **FR-015**: Transposing MUST be unavailable for 0 semitones and when there is nothing to transpose.
- **FR-016**: Every new text MUST exist in German and English.

### Key Entities

- **Tape**: its Holes change; nothing else (FR-009). Its Transposition stays the one it was created
  with.
- **Hole**: belongs to a Pipe, starts at a Column and is a number of Columns long; identified by Pipe
  and start Column.
- **The selected Holes**: the Holes the user has selected in the Tape view; a phrase, not a term.
  Not stored.
- **Transposition outcome**: for one number of semitones, what happens to each Hole: moved, moved by
  octaves, merged, removed, or left out. Shown before applying; not stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can transpose a whole Tape and apply it in under 15 seconds.
- **SC-002**: On a Tape of 2,000 Columns and 1,000 Holes, the outcome follows a change of semitones
  within 100 ms.
- **SC-003**: Applying shows exactly the outcome that was previewed: 100% of the counted moves,
  octave moves, merges and removals match the Tape afterwards.
- **SC-004**: One undo after any transposition gives a Tape identical to the one before.
- **SC-005**: 100% of applied transpositions survive closing and reopening Crancula.
- **SC-006**: Every step can be done without a pointer.

## Assumptions

- The pointer gestures and keys for selecting several Holes and for starting a transposition are
  chosen in the plan, following the design guide and the platform's habits (e.g. Ctrl- or Cmd-click
  to add, a drag on an empty spot with a modifier to select an area, Ctrl+A for all).
- The range of semitones offered is chosen in the plan; it must reach every Pipe from every other
  Pipe of the Organ.
- With several Holes selected, the edits of spec 004 (move, resize, remove) are not extended to the
  whole selection; that is later work.
- Notes are as at import: a Pipe's note is its pitch, and the octave rule of spec 002 FR-009 is
  reused unchanged.
- The stored Tape format does not change.
- Changing the Column length (#107) and renaming a Tape (#82) are out of scope.
