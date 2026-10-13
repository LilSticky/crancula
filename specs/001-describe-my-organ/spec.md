# Feature Specification: Describe my organ

**Feature Branch**: `001-describe-my-organ`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: "Describe my organ: as the owner of a barrel organ I can define an Organ in Crancula so that Tapes can later be made for it. An Organ has a name, an ordered set of Pipes (each identified by the MIDI note number of the note it plays, shown as a note name like C4; one Pipe per row of the Tape), a Tape Bed (tape width, border, hole diameter, spacing between rows, all in mm), and the hard limits Minimum Hole Length and Minimum Gap (mm). I can create, view, edit (including adding, removing and reordering Pipes) and delete Organs. Invalid Organs cannot be saved (e.g. duplicate Pipes, Pipes that don't fit the Tape Bed width, non-positive measurements). Organs survive an app restart: the in-memory state is the source of truth and is kept as a snapshot on disk that is loaded on startup (ADR 3) through the strict Electron boundary (ADR 4). UI in English and German. Out of scope: Air Demand, Tapes, Songs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Define my organ (Priority: P1)

As the owner of a barrel organ, I create an Organ in Crancula: I give it a name, enter the
measurements of its Tape Bed, its Minimum Hole Length and Minimum Gap, and add one Pipe per row
in the order the rows run across the Tape, each with the note it plays. Crancula then knows
everything about my organ that a Tape needs.

**Why this priority**: Every later slice (bringing a song onto a tape, punching a tape) needs an
Organ. Without it nothing else can be built or tried.

**Independent Test**: Start the app with no Organs, create an Organ with a name, Tape Bed
measurements, limits and a few Pipes, save it, and see it in the Organ list with its details.

**Acceptance Scenarios**:

1. **Given** no Organs exist, **When** I create an Organ named "Street organ" with valid Tape Bed
   measurements, limits and 31 Pipes, and save, **Then** it appears in the Organ list.
2. **Given** I am adding a Pipe, **When** I enter MIDI note number 60, **Then** the Pipe is shown
   as "C4".
3. **Given** I am creating an Organ, **When** I add Pipes, **Then** each new Pipe is added as the
   last row, and the row order is shown.
4. **Given** I am creating an Organ, **When** I leave the form without saving after confirming that
   I want to discard my changes, **Then** no Organ is created.

---

### User Story 2 - Only valid Organs are saved (Priority: P1)

Crancula prevents me from saving an Organ that couldn't work physically, and tells me what's
wrong, in my language, next to the value that causes the problem.

**Why this priority**: Later slices rely on the Organ being consistent (for example, every row of
a Tape must fit on the physical tape). Catching mistakes here keeps them from showing up later as
an unusable punched tape.

**Independent Test**: Try to save Organs that each break exactly one rule and check that saving is
refused with a message naming the problem; then fix the value and save successfully.

**Acceptance Scenarios**:

1. **Given** an Organ with two Pipes that have the same MIDI note number, **When** I try to save,
   **Then** saving is refused and both Pipes are marked as duplicates.
2. **Given** an Organ whose Pipes don't fit across its tape width (see FR-008), **When** I try to
   save, **Then** saving is refused with a message stating how much width is needed and how
   much is available.
3. **Given** an Organ with a measurement of 0 or less, **When** I try to save, **Then** saving is
   refused and that field is marked.
4. **Given** an Organ without a name or without any Pipes, **When** I try to save, **Then** saving
   is refused and the missing information is marked.

---

### User Story 3 - My organs are still there after a restart (Priority: P1)

I close Crancula and open it again later; all my Organs are still there, exactly as I saved them.

**Why this priority**: Without this, defining an Organ is pointless for a desktop tool used across
many sessions.

**Independent Test**: Create and save an Organ, quit the app, start it again, and compare the
Organ's details to what was saved.

**Acceptance Scenarios**:

1. **Given** I saved an Organ, **When** I restart the app, **Then** the Organ with all its values
   and Pipe order is shown unchanged.
2. **Given** I deleted an Organ, **When** I restart the app, **Then** it is gone.
3. **Given** the stored Organs cannot be read on startup (damaged or from an unknown newer
   version), **When** the app starts, **Then** I'm told that my Organs couldn't be loaded, the
   app still starts, and the unreadable data is kept untouched rather than overwritten.

---

### User Story 4 - Change or remove an organ (Priority: P2)

I adjust an existing Organ after measuring again or rebuilding it: rename it, change
measurements, add, remove and reorder Pipes, or delete the whole Organ.

**Why this priority**: Measurements get corrected over time, but creating a new Organ is an
acceptable workaround at first.

**Independent Test**: Open a saved Organ, move a Pipe from the last row to the first, remove one
Pipe, change the tape width, save, and verify the list and details reflect it; then delete the
Organ.

**Acceptance Scenarios**:

1. **Given** a saved Organ, **When** I move a Pipe to another row and save, **Then** the new row
   order is kept.
2. **Given** a saved Organ, **When** I remove a Pipe and save, **Then** the remaining Pipes keep
   their relative order with no gaps in row numbers.
3. **Given** I edited an Organ without saving, **When** I try to leave, **Then** I'm asked whether
   to discard my changes.
4. **Given** a saved Organ, **When** I delete it and confirm, **Then** it is removed from the list.
   **When** I cancel instead, **Then** nothing changes.

---

### User Story 5 - Use Crancula in German or English (Priority: P3)

All texts of this feature, including validation messages, are available in German and English.

**Why this priority**: Required by the constitution, but it doesn't change what the feature does.

**Independent Test**: Switch the app language and walk through Stories 1 and 2; no text is shown
untranslated.

**Acceptance Scenarios**:

1. **Given** the app is set to German, **When** I create an Organ and trigger each validation
   message, **Then** all labels and messages are German.

---

### Edge Cases

- An Organ with exactly one Pipe is valid if it fits the Tape Bed.
- A MIDI note number outside 0–127 is rejected.
- Two Organs may have the same name; they are still distinct Organs. Each is identified internally,
  not by its name.
- Moving the first Pipe up or the last Pipe down is not possible.
- Removing all Pipes leaves an unsaveable Organ (see Story 2).
- Measurements accept decimals (e.g. 0.5 mm).
- Very large Organs (e.g. 100+ Pipes) can still be edited and saved.
- If saving to disk fails (e.g. disk full, no permission), I'm told so. The Organ is not reported
  as saved, and my input stays in the form so that nothing is lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to create an Organ with a name, a Tape Bed, a Minimum Hole Length,
  a Minimum Gap and an ordered list of Pipes.
- **FR-002**: The Tape Bed MUST consist of tape width, border, hole diameter and spacing between
  rows, all in millimetres.
- **FR-003**: Each Pipe MUST be identified by a MIDI note number (0–127) and MUST be displayed with
  its note name (e.g. 60 → "C4", 61 → "C#4").
- **FR-004**: The order of Pipes MUST be the order of rows across the Tape. Users MUST be able to
  add a Pipe (as the last row), remove a Pipe, and move a Pipe to another row.
- **FR-005**: Users MUST be able to see a list of all Organs and open any Organ to view and edit it.
- **FR-006**: Users MUST be able to delete an Organ after confirming the deletion.
- **FR-007**: The system MUST refuse to save an Organ that has:
  - no name;
  - no Pipes;
  - two Pipes with the same MIDI note number;
  - a measurement (tape width, hole diameter, spacing between rows, Minimum Hole Length,
    Minimum Gap) that is 0 or less;
  - a negative border.
- **FR-008**: The system MUST refuse to save an Organ whose Pipes don't fit across the tape width,
  where the required width is
  `2 × border + (number of Pipes − 1) × spacing between rows + hole diameter`.
- **FR-009**: The system MUST refuse to save an Organ whose spacing between rows is smaller than its
  hole diameter, because neighbouring holes would overlap.
- **FR-010**: [NEEDS CLARIFICATION: Is Minimum Hole Length required to be at least the hole
  diameter, is it simply equal to the hole diameter (so it isn't entered separately), or are the
  two independent?]
- **FR-011**: Every refused save MUST show, next to the affected value, a message in the user's
  language explaining the problem.
- **FR-012**: Saved Organs MUST survive an app restart unchanged: all values and the Pipe order.
- **FR-013**: [NEEDS CLARIFICATION: Are changes to an Organ saved explicitly (Save button,
  with a "discard changes?" question when leaving with unsaved edits), or automatically as soon
  as the Organ is valid?]
- **FR-014**: If stored Organs can't be read at startup, the app MUST start anyway, inform the user,
  and MUST NOT overwrite the unreadable data.
- **FR-015**: If storing Organs fails, the app MUST inform the user and MUST NOT report the Organ
  as saved.
- **FR-016**: All texts of this feature MUST be available in English and German.

### Key Entities

- **Organ**: a barrel organ owned by the user. It has:
  - a name (not necessarily unique);
  - one Tape Bed;
  - a Minimum Hole Length and a Minimum Gap (mm);
  - an ordered, non-empty list of Pipes with unique MIDI note numbers.

  It is identified independently of its name, and Tapes will later reference it.
- **Pipe**: plays one note, identified by its MIDI note number. Its position in the Organ's list
  is its row on the Tape.
- **Tape Bed**: the surface in the Organ the Tape runs over. It has tape width, border, hole
  diameter and spacing between rows (mm). It determines how many Pipes physically fit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can define their own 31-Pipe organ from their measurements in under 10 minutes.
- **SC-002**: 100% of the invalid cases listed in FR-007 to FR-009 are refused with a message,
  and each message names the field to fix.
- **SC-003**: After a restart, 100% of saved Organs are shown with identical values and Pipe order.
- **SC-004**: No data loss when the stored Organs are unreadable: the original data is unchanged
  after the app has started.
- **SC-005**: Every text of the feature is shown in the selected language (English or German), with
  no untranslated keys.

## Assumptions

- **Single user:** Crancula runs on one computer for one user; no syncing or sharing in this slice.
- **Row layout:** rows are evenly spaced across the tape, and "spacing between rows" is the
  centre-to-centre distance. The outermost holes keep at least the border distance from the
  tape edge (FR-008).
- **Duplicate notes:** an Organ never has two Pipes for the same note. Organs with doubled Pipes
  are out of scope.
- **Defaults:** a new Organ starts with empty measurements and no Pipes; there are no presets.
- **Deleting Organs:** no Tapes exist yet, so deleting an Organ has no effect on other data. When
  Tapes are added, deleting an Organ that has Tapes will be revisited.
- **Out of scope:** Air Demand, Tapes, Songs, importing or exporting Organs as files, and
  presets of known organ types.
- **Prototype code:** the existing organ code is a quarry; this slice may replace it entirely.
