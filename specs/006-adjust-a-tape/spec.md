# Feature Specification: Adjust a tape

**Feature Branch**: `006-adjust-a-tape`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Adjust a tape (#107, part of Edit a tape #103): as an organ owner I can
change a Tape's Column length in the Tape view; the Holes keep their Columns, so the Tape gets longer
or shorter in mm, and Cutting Problems (Minimum Hole Length, Minimum Gap) are re-checked. One undo
step."

## Clarifications

### Decisions before specifying (user, 2026-10-19 and 2026-10-22)

From [the discovery](../../documentation/discovery/edit-a-tape.md) and this session:

- Q: An edit breaks Minimum Hole Length or Minimum Gap? → A: Allow it and mark the Hole that can't
  be cut at once; the export stays the gate (discovery decision 1).
- Q: When the Column length changes, what stays the same? → A: Every Hole keeps its Pipe and its
  Columns. The rhythm and all hand edits stay; the Tape gets longer or shorter in mm, so the Song
  plays slower or faster at the same crank speed. The Song is not laid out again.
- Q: Holes that become too short or too close? → A: They are only marked as Cutting Problems, as
  with hand edits; nothing is fixed automatically.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Change the Column length (Priority: P1)

The organ owner finds that a Tape plays too fast (or too slow) on their Organ, or is longer than
the vinyl they have. In the Tape view they change the Tape's Column length. Every Hole keeps its
Pipe and Columns; the drawing, the ruler, the Tape's length in mm and the Holes' lengths in mm follow
the new Column length at once, and the change is kept like any other edit.

**Why this priority**: it is the whole slice; without it the Column length chosen at import is final.

**Independent Test**: open a Tape, change its Column length from 5 mm to 10 mm, and see the Tape
twice as long in mm with the same Holes on the same Columns; restart the app and see the new Column
length kept.

**Acceptance Scenarios**:

1. **Given** a Tape with Column length 5 mm and 100 Columns, **When** the owner sets the Column
   length to 10 mm, **Then** the Tape shows 100 Columns of 10 mm, 1000 mm of Tape after the
   Lead-in, and every Hole is on the same Pipe and Columns as before.
2. **Given** the Column length was changed, **When** the app restarts, **Then** the Tape opens with
   the new Column length.
3. **Given** the Column length field, **When** the owner enters 0, a negative number or text that
   is not a number, **Then** the change is refused with a message saying the Column length must be
   above 0, and the Tape is unchanged.
4. **Given** the Column length field, **When** the owner enters the value it already has, **Then**
   nothing changes and no undo step is added.
5. **Given** the language is German, **When** the owner enters a decimal Column length with a
   comma, **Then** it is read like the Organ editor reads decimals (comma or point).

---

### User Story 2 - See what the new Column length breaks (Priority: P1)

Before and after the change, the owner sees which Holes the new Column length makes impossible to
cut: shorter than the Minimum Hole Length or closer than the Minimum Gap in mm.

**Why this priority**: a shorter Column length silently turning a cuttable Tape into one that can't be
cut would only show up at export.

**Independent Test**: on a Tape without Cutting Problems, halve the Column length so some Holes drop
below the Minimum Hole Length; see them marked at once and listed under Cutting Problems; export
refuses the Tape.

**Acceptance Scenarios**:

1. **Given** a Tape without Cutting Problems, **When** the owner enters a smaller Column length,
   **Then** before it is applied the owner is told how many Holes would become Cutting Problems
   (0 is said too).
2. **Given** the change is applied, **When** Holes are now too short or too close, **Then** they are
   marked as Cutting Problems at once, as for hand edits, and no Hole is changed to fix them.
3. **Given** a Tape with Cutting Problems, **When** a larger Column length clears some of them,
   **Then** those marks disappear at once.

---

### User Story 3 - Undo the change (Priority: P2)

The owner can take a Column length change back and redo it, like any other edit on the Tape.

**Why this priority**: trying out a Column length is only safe when it can be undone.

**Independent Test**: change the Column length, undo it, see the old Column length and marks; redo
it, see the new one.

**Acceptance Scenarios**:

1. **Given** the Column length was changed, **When** the owner undoes (button, shortcut or the
   application menu's Undo), **Then** the old Column length and its Cutting Problems are back in one
   step.
2. **Given** a Column length change was undone, **When** the owner redoes, **Then** the new Column
   length is back.
3. **Given** Hole edits before and after a Column length change, **When** the owner undoes several
   times, **Then** the steps come back in reverse order, the Column length change being one of them.

### Edge Cases

- A Column length so small that every Hole becomes too short: allowed; all are marked; export refuses.
- A very large Column length makes a very long Tape: allowed; the Tape view's zoom and the export
  handle any length already.
- Holes whose Pipe is no longer on the Organ stay as they are and keep their "no Pipe" mark.
- The Lead-in is part of the Organ, not of the Column length, and does not change.
- The Minimum Hole Length and Minimum Gap in Columns are derived from mm and the Column length, so
  the same Hole can become cuttable or not with no Hole changing.
- The Tape list and the import screen show the new Column length (the import screen's prefill uses
  the last Tape's Column length, which may now be the changed one).
- Changing the Column length while a Hole is being dragged or a dialog is open is not possible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The owner MUST be able to change a Tape's Column length in the Tape view.
- **FR-002**: A Column length MUST be a finite number of mm above 0; anything else is refused with a
  message and leaves the Tape unchanged.
- **FR-003**: Changing the Column length MUST keep every Hole on its Pipe and Columns, the Tape's
  number of Columns, its Organ, Song, Parts and Transposition.
- **FR-004**: After the change, everything shown in mm (drawing, ruler, Tape length, Hole lengths
  and gaps, status line) MUST use the new Column length.
- **FR-005**: Cutting Problems MUST be re-checked against the new Column length at once; no Hole is
  changed to fix them.
- **FR-006**: Before the change is applied, the owner MUST be told how many Holes would be Cutting
  Problems with the new Column length, compared to now.
- **FR-007**: The change MUST be one undo step, undone and redone like the edits of specs 004 and 005,
  including from the application menu.
- **FR-008**: Entering the current Column length MUST change nothing and add no undo step.
- **FR-009**: The new Column length MUST be kept like the Tape's other edits and survive a restart.
- **FR-010**: Decimal input MUST accept a comma or a point, as in the Organ editor; numbers show in
  the language's notation.
- **FR-011**: All new texts MUST exist in English and German.

### Key Entities

- **Tape**: gets a new edit, *change Column length*, that replaces its Column length and keeps its
  Holes; the result is a valid Tape or the reasons it was refused.
- **Column length**: mm per Column of one Tape (dictionary: Column); above 0.
- **Cutting Problem**: a Hole that can't be cut against the Organ as it is now; depends on the Column
  length through Minimum Hole Length and Minimum Gap in Columns.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner changes a Tape's Column length in under 30 seconds from opening the Tape.
- **SC-002**: After any Column length change, 100% of Holes keep their Pipe and Columns.
- **SC-003**: The number of Cutting Problems announced before applying equals the number marked after.
- **SC-004**: One undo returns the Tape exactly to its state before the change.
- **SC-005**: The changed Column length is there after a restart in 100% of cases.

## Assumptions

- Where in the Tape view the Column length is changed (e.g. the Tape section of the side panel, which
  already shows it) and how the count of Cutting Problems is shown before applying (inline under the
  field or in a small dialog) are chosen in the plan, following the design guide.
- The stored Tape format does not change: it already stores the Column length.
- Changing the Column length does not touch the Song or re-run Quantisation (user decision).
- Scaling to a target Tape length in mm, or to a crank speed, is out of scope; the owner enters a
  Column length.
