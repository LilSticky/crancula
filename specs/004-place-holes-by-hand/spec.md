# Feature Specification: Place holes by hand

**Feature Branch**: `004-place-holes-by-hand`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Place holes by hand (#105, part of Edit a tape #103). The organ owner
edits an existing Tape in the Tape view: add a Hole on a Pipe's row at a Column, move a Hole along
its row and/or to another Pipe, lengthen or shorten it at either end, remove it; everything snaps to
whole Columns. Edits that would overlap another Hole of the same Pipe are refused. Holes with a
Cutting Problem are allowed and marked immediately; export stays the gate. A Hole added, moved or
lengthened past the Tape's end makes the Tape longer; it never shrinks by itself. Undo and redo of
edits. Edits are saved like other Tape changes."

## Clarifications

### Decisions before specifying (user, 2026-10-19)

From [the discovery](../../documentation/discovery/edit-a-tape.md):

- Q: An edit breaks the Minimum Hole Length or the Minimum Gap? → A: It is allowed; the Hole is
  marked with its Cutting Problem at once. Export stays the gate (spec 003).
- Q: A Hole added, moved or lengthened past the end of the Tape? → A: The Tape grows; it never
  shrinks by itself.
- Q: A Hole moved or lengthened onto another Hole of its Pipe? → A: Refused.
- Q: Scope? → A: Adding, moving, lengthening, shortening and removing Holes, plus undo and redo.
  Transposing Holes is the next slice (#106); changing the Column length is #107; renaming a Tape
  is #82.
- Q: Which ends, which grid? → A: Both ends of a Hole can be moved; everything snaps to whole
  Columns.
- Dictionary (approved 2026-10-19): Cutting Problem (Schnittproblem); a Hole is moved, lengthened
  or shortened at either end.

### Session 2026-10-19

- Q: Should Holes be edited directly in the Tape view, or only after switching on an edit mode? → A:
  Directly; undo catches mistakes.
- Q: How long does the undo history last? → A: Until the Tape view is left (another screen or
  another Tape).
- Q: How does the user find Holes with a Cutting Problem? → A: A count, plus a list of every such
  Hole in the side panel; choosing an entry selects that Hole (FR-011).

## User Scenarios & Testing *(mandatory)*

Column numbers in this spec are the ones the Tape view shows: Column 1 is the first Column after
the Lead-in.

### User Story 1 - Change and remove holes (Priority: P1)

As the owner of a barrel organ, I open one of my Tapes in the Tape view and see a Hole that is
wrong: it starts a Column too late, is too long, belongs to the neighbouring Pipe, or shouldn't be
there at all. I move it, lengthen or shorten it at its start or its end, or remove it. The Tape
view shows the change at once, and the Tape is saved.

**Why this priority**: Imported Tapes are rarely perfect. Correcting single Holes without going
back to the Song is the most common edit and the core of this slice.

**Independent Test**: Open a stored reference Tape, move one Hole by 2 Columns, shorten another
at its start, remove a third, reopen the Tape after restarting Crancula and check the three Holes.

**Acceptance Scenarios**:

1. **Given** a Hole of Pipe C4 at Columns 10–13, **When** I move it 2 Columns later, **Then** it
   covers Columns 12–15 on the same Pipe.
2. **Given** that Hole, **When** I move it to the row of Pipe D4, **Then** it belongs to D4 at the
   same Columns, and C4 no longer has it.
3. **Given** that Hole, **When** I move its end 3 Columns later, **Then** it covers Columns 10–16;
   **When** I then move its start 2 Columns later, **Then** it covers Columns 12–16.
4. **Given** a Hole 1 Column long, **When** I try to shorten it further, **Then** it stays 1 Column
   long.
5. **Given** a Hole, **When** I remove it, **Then** it is gone from the Tape and the Tape keeps its
   length.
6. **Given** any of these edits, **When** I close Crancula and open the Tape again, **Then** the
   edit is still there.
7. **Given** Holes of Pipe C4 at Columns 10–13 and 16–19, **When** I move the first one so it would
   cover Column 16, or lengthen it to Column 16 or beyond, **Then** the edit is refused, nothing
   changes, and I'm told the Hole would overlap the next Hole of its Pipe.
8. **Given** a Hole at Column 1, **When** I try to move it or its start before Column 1, **Then**
   it stays at Column 1 (the Lead-in carries no Holes).

---

### User Story 2 - Add a hole (Priority: P1)

A note is missing on my Tape. I add a Hole on the row of its Pipe at the Column where it should
start. It gets a sensible length, and I adjust it as in Story 1.

**Why this priority**: Without adding, a Tape can only lose notes. Together with Story 1, it lets
me fix any single note by hand.

**Independent Test**: Open a reference Tape, add a Hole on an empty part of a row, and check its
Pipe, start, length and that it is saved.

**Acceptance Scenarios**:

1. **Given** an empty part of the row of Pipe E4, **When** I add a Hole starting at Column 20,
   **Then** a Hole of E4 starts at Column 20 and is as many Columns long as the Minimum Hole Length
   needs (rounded up to whole Columns), but at least 1 Column.
2. **Given** the space up to the next Hole of that Pipe is shorter than that length, **When** I add
   a Hole there, **Then** the new Hole fills the Columns up to the next Hole (its last Column is the one
   right before the next Hole's first), and it is marked with
   a Cutting Problem if it is too short or too close.
3. **Given** a Column that is already covered by a Hole of that Pipe, **When** I try to add a Hole
   there, **Then** nothing is added.
4. **Given** I add a Hole, **Then** it is selected, so I can move or resize it straight away.

---

### User Story 3 - See cutting problems as they happen (Priority: P1)

When an edit makes a Hole shorter than the Minimum Hole Length, or brings two Holes of one Pipe
closer than the Minimum Gap, Crancula lets me do it but marks the Hole with its Cutting Problem at
once. I can keep working and fix it later; export tells me if I forgot (spec 003).

**Why this priority**: Blocking such edits would forbid reasonable steps in between (e.g. moving a
Hole past its neighbour's gap before shortening it). Not marking them would let me discover the
problem only at export.

**Independent Test**: Shorten a Hole below the Minimum Hole Length and check that it is marked and
that the selected Hole says why; lengthen it again and check that the mark is gone.

**Acceptance Scenarios**:

1. **Given** an Organ whose Minimum Hole Length needs 2 Columns, **When** I shorten a Hole to 1
   Column, **Then** the edit is applied and the Hole is marked as too short in the Tape view, and
   the selected Hole names the Cutting Problem with the length in mm and the Minimum Hole Length.
2. **Given** two Holes of one Pipe, **When** I move one so that the gap between them is below the
   Minimum Gap, **Then** both are marked as too close.
3. **Given** a marked Hole, **When** an edit removes its Cutting Problem, **Then** its mark is gone
   at once.
4. **Given** a Tape with Cutting Problems, **Then** I see how many Holes have one, and a list of
   them in the side panel (Pipe, start Column, Cutting Problem); **When** I choose an entry,
   **Then** that Hole is selected and scrolled into view.
5. **Given** a Tape with Cutting Problems, **When** I choose "Export for the Plotter", **Then** it
   is refused as in spec 003.

---

### User Story 4 - Undo and redo (Priority: P2)

I made a wrong edit, or several. I undo them one by one, and redo them if I undid too many.

**Why this priority**: Editing by pointer is quick and easy to get wrong; undo makes trying things
safe. The core edits (Stories 1–3) work without it.

**Independent Test**: Make three edits, undo three times and compare the Tape with the stored one
before the edits; redo once and check the first edit is back.

**Acceptance Scenarios**:

1. **Given** I made an edit, **When** I undo, **Then** the Tape is as it was before the edit,
   including its length if the edit made it grow, and it is saved like this.
2. **Given** I undid an edit, **When** I redo, **Then** the edit is applied again.
3. **Given** I undid an edit, **When** I make a new edit, **Then** redo is no longer possible.
4. **Given** nothing to undo or redo, **Then** undo or redo is shown as unavailable.
5. **Given** a refused edit (Story 1, scenario 7), **Then** there is nothing to undo for it.

---

### User Story 5 - The tape grows when I need more room (Priority: P2)

I add, move or lengthen a Hole beyond the last Column. The Tape becomes long enough for it. When I
remove or shorten Holes at the end again, the Tape keeps its length.

**Why this priority**: Without it I couldn't add notes after the end of the imported Song. It is
rare compared with editing inside the Tape.

**Independent Test**: On a 100-Column Tape, lengthen the last Hole to end at Column 104, check the
Tape is 104 Columns long, then remove the Hole and check it stays 104 Columns long.

**Acceptance Scenarios**:

1. **Given** a Tape of 100 Columns, **When** I lengthen a Hole so it ends at Column 104, **Then**
   the Tape is 104 Columns long and its drawing, ruler and length in mm follow.
2. **Given** a Tape of 100 Columns, **When** I add or move a Hole to end at Column 110, **Then** the
   Tape is 110 Columns long.
3. **Given** the Tape grew, **When** I remove or shorten the Hole again, **Then** the Tape keeps
   its length. Only undo shrinks it back.

---

### User Story 6 - Edit with the keyboard and in German or English (Priority: P3)

I can do every edit without a pointer, and every new text is in German and English.

**Why this priority**: The Tape view already lets me select Holes by keyboard; editing must not
break that. The constitution requires both languages.

**Independent Test**: With the keyboard only, select a Hole, move it, change both ends, remove it,
add a Hole, undo and redo; switch to German and check every new text.

**Acceptance Scenarios**:

1. **Given** a selected Hole, **When** I use the keyboard, **Then** I can move it along its row and
   to the neighbouring Pipe's row, move its start and its end, and remove it.
2. **Given** a selected Hole or an empty Tape, **When** I use the keyboard, **Then** I can add a
   Hole on a chosen row at a chosen Column.
3. **Given** the keyboard shortcuts for undo and redo of the operating system, **When** I press them
   in the Tape view, **Then** they undo and redo edits.
4. **Given** German is chosen, **Then** every new label, message and Cutting Problem text is German.

### Edge Cases

- A Hole whose Pipe is no longer on the Organ (the Organ changed after the Tape was made) is not on
  any row. It cannot be edited here; it stays on the Tape and keeps its Cutting Problem ("no Pipe"),
  which is counted (Story 3, scenario 4).
- Moving a Hole to another Pipe whose row has a Hole at those Columns is refused like an overlap
  in its own row.
- Moving a Hole onto a row puts it on that row's Pipe; there are no rows without a Pipe.
- Holes of one Pipe that touch (no gap) are allowed while editing and are marked as too close.
- A Tape without Holes: Holes can be added, starting the editing from scratch.
- Leaving the Tape view: the edits are already saved; the undo history is not kept.
- The Organ the Tape belongs to is changed later: the marks are worked out against the Organ as it
  is now, as export does.
- A save fails (e.g. the disk is full): the edit stays in the Tape view, and I'm told it isn't saved,
  as for other Tape changes.
- Very long Tapes (thousands of Columns): edits show without a noticeable delay.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to move a Hole along its row by whole Columns.
- **FR-002**: Users MUST be able to move a Hole to the row of another Pipe of the Organ, keeping its
  start and length, alone or together with a move along the row.
- **FR-003**: Users MUST be able to move the start and the end of a Hole by whole Columns; a Hole is
  always at least 1 Column long.
- **FR-004**: Users MUST be able to remove a Hole.
- **FR-005**: Users MUST be able to add a Hole on the row of a Pipe of the Organ, starting at a
  chosen Column that no Hole of that Pipe covers. Its length is the Minimum Hole Length rounded up
  to whole Columns (at least 1), limited so its last Column is the one right before the next Hole of that Pipe.
  The new Hole is selected.
- **FR-006**: No Hole may start before Column 1; the Lead-in carries no Holes.
- **FR-007**: An edit that would make two Holes of one Pipe overlap MUST be refused: the Tape does
  not change, and the user is told why.
- **FR-008**: An edit that makes a Hole end after the Tape's last Column MUST make the Tape exactly
  long enough for it. Removing, shortening or moving Holes MUST NOT shorten the Tape.
- **FR-009**: Edits that cause a Cutting Problem (shorter than the Minimum Hole Length, closer than
  the Minimum Gap to the next Hole of its Pipe) MUST be allowed.
- **FR-010**: Every Hole with a Cutting Problem MUST be marked in the Tape view, and the marks MUST
  follow every edit at once. The selected Hole MUST name its Cutting Problems with the values in
  mm, as it does today.
- **FR-011**: The Tape view MUST show how many Holes of the Tape have a Cutting Problem and list
  them in the side panel with their Pipe, start Column and Cutting Problem; choosing an entry MUST
  select that Hole and scroll it into view. The list follows every edit.
- **FR-012**: The Cutting Problems shown while editing MUST be the same ones that make "Export for
  the Plotter" refuse the Tape (spec 003), worked out against the Organ as it is now.
- **FR-013**: Every applied edit MUST be saved like other Tape changes, so it survives a restart.
  A failed save MUST be reported as for other Tape changes.
- **FR-014**: Users MUST be able to undo applied edits one at a time, back to the state when the
  Tape was opened, and redo undone edits until a new edit is made. Undo and redo are saved like
  edits. The history ends when the Tape view is left.
- **FR-015**: Undo and redo MUST be shown as unavailable when there is nothing to undo or redo.
- **FR-016**: Every edit, undo and redo MUST be possible with the keyboard alone; undo and redo MUST
  answer the operating system's usual shortcuts while the Tape view has focus.
- **FR-017**: Editing MUST NOT change the Tape's Song, selected Parts, Organ, Transposition, Column
  length or name.
- **FR-018**: Every new text MUST exist in German and English.
- **FR-019**: Holes whose Pipe is not on the Organ MUST stay on the Tape unchanged by editing.

### Key Entities

- **Tape**: the Holes, its length in Columns and its Column length. Editing changes the Holes and
  may make it longer (FR-008); nothing else (FR-017).
- **Hole**: belongs to a Pipe, starts at a Column and is a number of Columns long. Identified on a
  Tape by its Pipe and start Column, because Holes of one Pipe never overlap.
- **Cutting Problem**: why a Hole can't be cut — its Pipe is not on the Organ, it is shorter than
  the Minimum Hole Length, or it is closer than the Minimum Gap to the next Hole of its Pipe.
  Worked out from the Tape and the Organ; never stored.
- **Edit**: one applied change to a Tape (add, move, change length, remove) that can be undone and
  redone while the Tape view is open.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can correct a wrong Hole (move it, change its ends or remove it) in under
  10 seconds.
- **SC-002**: On a Tape of 2,000 Columns, an edit and its Cutting Problem marks show within 100 ms.
- **SC-003**: 100% of edits survive closing and reopening Crancula.
- **SC-004**: A Tape that shows no Cutting Problem while editing is never refused by export for a
  Cutting Problem, and a Tape that shows any is always refused (same rule, no drift).
- **SC-005**: Every edit, undo and redo can be done without a pointer.
- **SC-006**: After any number of edits followed by the same number of undos, the Tape is identical
  to the one opened.

## Assumptions

- Edits are made directly in the Tape view; there is no separate edit mode (clarified). Undo makes
  mistakes cheap.
- The pointer gestures (drag a Hole, drag its ends, add on an empty spot) and the keyboard
  shortcuts are chosen in the plan following the design guide; this spec only requires that both
  exist.
- Moving a Hole to another Pipe keeps its Columns; moving along the row and to another row can be
  one gesture.
- Holes are identified by Pipe and start Column; no Hole identifiers are introduced into stored
  Tapes. The stored Tape format changes only if the plan needs it, and older snapshots stay
  readable (ADR 20).
- The undo history lives as long as the Tape view is open; it is not stored.
- Changing the Column length, transposing Holes and renaming a Tape are out of scope (#107, #106,
  #82). Hole fixes (automatic lengthening or merging) are not applied while editing.
- The Hole selection, inspection panel and keyboard navigation of the Tape view (spec 003 and
  earlier) stay as they are and are extended, not replaced.
