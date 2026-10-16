# Feature Specification: Describe my organ

**Feature Branch**: `001-describe-my-organ`

**Created**: 2026-10-13

**Status**: Clarified

**Input**: User description: "Describe my organ: as the owner of a barrel organ I can define an Organ in Crancula so that Tapes can later be made for it. An Organ has a name, an ordered set of Pipes (each identified by the MIDI note number of the note it plays, shown as a note name like C4; one Pipe per row of the Tape), a Tape Bed (tape width, hole diameter, spacing between rows, all in mm; the Border is derived, not entered), and the hard limits Minimum Hole Length and Minimum Gap (mm). I can create, view, edit (including adding, removing and reordering Pipes) and delete Organs. Invalid Organs cannot be saved (e.g. duplicate Pipes, Pipes that don't fit the Tape Bed width, non-positive measurements). Organs survive an app restart: the in-memory state is the source of truth and is kept as a snapshot on disk that is loaded on startup (ADR 3) through the strict Electron boundary (ADR 4). UI in English and German. Out of scope: Air Demand, Tapes, Songs."

## Clarifications

### Session 2026-10-13

- Q: How do Minimum Hole Length and hole diameter relate? → A: Minimum Hole Length equals the
  Tape Bed's hole diameter and is not entered separately (FR-010).
- Q: How are changes to an Organ saved? → A: Automatically whenever the Organ is valid, with no
  Save button (FR-012).
- Q: Are the fit rules right (FR-008, FR-009)? → A: Yes, both.

### Session 2026-10-14 (review of the MVP)

- Q: Saving automatically wasn't visible to the user. How are changes saved now? → A: Only with
  a Save button. It is disabled while there are no unsaved changes or the Organ is invalid. This
  replaces the 2026-10-13 answer (FR-012).
- Q: What happens when I leave the editor with unsaved changes? → A: I'm warned. If the changes
  are invalid, the warning lists each broken rule with its field, so I know what to fix; I can
  stay and fix them (the default) or discard them (FR-012a).
- Q: Does the language switch apply to the application menu too? → A: Yes (FR-016).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Define my organ (Priority: P1)

As the owner of a barrel organ, I create an Organ in Crancula: I give it a name, enter the
measurements of its Tape Bed and its Minimum Gap, and add one Pipe per row
in the order the rows run across the Tape, each with the note it plays. Crancula then knows
everything about my organ that a Tape needs.

**Why this priority**: Every later slice (bringing a song onto a tape, punching a tape) needs an
Organ. Without it nothing else can be built or tried.

**Independent Test**: Start the app with no Organs, create an Organ with a name, Tape Bed
measurements, Minimum Gap and a few Pipes, and see it in the Organ list with its details.

**Acceptance Scenarios**:

1. **Given** no Organs exist, **When** I create an Organ named "Street organ" with valid Tape Bed
   measurements, Minimum Gap and 31 Pipes and press Save, **Then** it is stored and appears in the
   Organ list.
2. **Given** I am adding a Pipe, **When** I enter MIDI note number 60, **Then** the Pipe is shown
   as "C4".
3. **Given** I am creating an Organ, **When** I add Pipes, **Then** each new Pipe is added as the
   last row, and the row order is shown.
4. **Given** I am creating an Organ that is not valid yet, **When** I leave the form and confirm
   that my unfinished input will be lost, **Then** no Organ is created.
5. **Given** I opened an Organ and changed nothing, or my changes are invalid, **Then** the Save
   button is disabled. **When** I make a valid change, **Then** it is enabled; after saving it is
   disabled again.
6. **Given** I made valid changes that I haven't saved, **When** I leave the editor, **Then** I'm
   warned that they aren't saved; I can stay, or discard them and leave.

---

### User Story 2 - Only valid Organs are stored (Priority: P1)

Crancula never stores an Organ that couldn't work physically, and tells me what's wrong, in my
language, next to the value that causes the problem.

**Why this priority**: Later slices rely on the Organ being consistent (for example, every row of
a Tape must fit on the physical tape). Catching mistakes here keeps them from showing up later as
an unusable punched tape.

**Independent Test**: Enter Organs that each break exactly one rule and check that nothing is
stored and a message names the problem; then fix the value and see it stored.

**Acceptance Scenarios**:

1. **Given** an Organ with two Pipes that have the same MIDI note number, **Then** it is not
   stored and both Pipes are marked as duplicates.
2. **Given** an Organ whose Pipes don't fit across its tape width (see FR-008), **Then** it is not
   stored and a message states how much width is needed and how much is available.
3. **Given** an Organ with a measurement of 0 or less, **Then** it is not stored and that field is
   marked.
4. **Given** an Organ without a name or without any Pipes, **Then** it is not stored and the
   missing information is marked.
5. **Given** a stored Organ that I edit into an invalid state, **When** I fix the problem,
   **Then** I can save the corrected Organ; the invalid intermediate state was never stored.

---

### User Story 3 - My organs are still there after a restart (Priority: P1)

I close Crancula and open it again later; all my Organs are still there, exactly as last stored.

**Why this priority**: Without this, defining an Organ is pointless for a desktop tool used across
many sessions.

**Independent Test**: Create an Organ, quit the app, start it again, and compare the Organ's
details to what was entered.

**Acceptance Scenarios**:

1. **Given** I created a valid Organ, **When** I restart the app, **Then** the Organ with all its
   values and Pipe order is shown unchanged.
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

**Independent Test**: Open a stored Organ, move a Pipe from the last row to the first, remove one
Pipe, change the tape width, and verify the list and details reflect it, also after a restart;
then delete the Organ.

**Acceptance Scenarios**:

1. **Given** a stored Organ, **When** I move a Pipe to another row, **Then** the new row order is
   stored after I save.
2. **Given** a stored Organ, **When** I remove a Pipe, **Then** the remaining Pipes keep their
   relative order with no gaps in row numbers.
3. **Given** I edited a stored Organ into an invalid state, **When** I leave it, **Then** I'm
   told that my changes can't be saved, with each broken rule and its field listed. I can stay and
   fix them, or discard them; on discarding, the last saved version remains.
4. **Given** a stored Organ, **When** I delete it and confirm, **Then** it is removed from the list.
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
2. **Given** I switch the language, **Then** the application menu uses that language too, also
   after a restart.

---

### Edge Cases

- An Organ with exactly one Pipe is valid if it fits the Tape Bed.
- A MIDI note number outside 0–127 is rejected.
- Two Organs may have the same name; they are still distinct Organs. Each is identified internally,
  not by its name.
- Moving the first Pipe up or the last Pipe down is not possible.
- Removing all Pipes makes the Organ invalid, so it isn't stored (see Story 2).
- Measurements accept decimals (e.g. 0.5 mm).
- Very large Organs (e.g. 100+ Pipes) can still be edited and stored.
- Saving many times in a row must not slow down editing or lose the last change.
- If writing to disk fails (e.g. disk full, no permission), I'm told so, and my input stays in the
  app so that nothing is lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to create an Organ with a name, a Tape Bed, a Minimum Gap and an
  ordered list of Pipes.
- **FR-002**: The Tape Bed MUST consist of tape width, hole diameter and spacing between rows, all
  in millimetres. The Border is not entered; it is derived (FR-008). (amended 2026-10-15, #74)
- **FR-003**: Each Pipe MUST be identified by a MIDI note number (0–127) and MUST be displayed with
  its note name (e.g. 60 → "C4", 61 → "C#4").
- **FR-004**: The order of Pipes MUST be the order of rows across the Tape. Users MUST be able to
  add a Pipe (as the last row), remove a Pipe, and move a Pipe to another row.
- **FR-005**: Users MUST be able to see a list of all Organs and open any Organ to view and edit it.
- **FR-006**: Users MUST be able to delete an Organ after confirming the deletion.
- **FR-007**: The system MUST NOT store an Organ that has:
  - no name;
  - no Pipes;
  - two Pipes with the same MIDI note number;
  - a measurement (tape width, hole diameter, spacing between rows, Minimum Gap) that is 0 or less;
  - no Lead-in, or a negative one (0 is valid). (amended 2026-10-16, #78)
- **FR-008**: The Border MUST be derived as `(tape width − Row Span) / 2`, where the Row Span is
  `(number of Pipes − 1) × spacing between rows + hole diameter`. The rows are centred across the
  Tape, row 1 nearest the top edge. A Border of 0 is valid. The system MUST NOT store an Organ whose
  Border would be negative (its rows don't fit across the tape width). The editor MUST show the
  derived Border read-only, e.g. 6,25 mm for tape width 120, hole diameter 2.5, spacing 3.5 and 31
  Pipes. (amended 2026-10-15, #74)
- **FR-009**: The system MUST NOT store an Organ whose spacing between rows is smaller than its
  hole diameter, because neighbouring holes would overlap.
- **FR-010**: The Organ's Minimum Hole Length MUST equal its Tape Bed's hole diameter. It is shown
  to the user but not entered separately.
- **FR-011**: Every rule an Organ breaks MUST be shown next to the affected value, with a message in
  the user's language explaining the problem.
- **FR-012**: Changes MUST be stored only when the user presses Save. The Save button MUST be
  disabled while there are no unsaved changes or the Organ is invalid. Unsaved changes are kept
  only in the editor.
- **FR-012a**: Leaving the editor with unsaved changes MUST warn the user and let them stay or
  discard the changes. If the changes are invalid, the warning MUST list each broken rule with
  the field it belongs to.
- **FR-013**: Stored Organs MUST survive an app restart unchanged: all values and the Pipe order.
  Organs stored in snapshot version 1 (with a `border`) MUST still load; the `border` is ignored and
  the next save writes version 2 without it (ADR 20). (amended 2026-10-15, #74)
- **FR-017**: Every Organ MUST have a Lead-in: the length in millimetres of blank Tape before
  Column 1, with an angled start (German Vorlauf). 0 means none and is valid; a negative value is
  not. A new Organ starts with the field empty and required. Organs stored in snapshot version 1 or
  2 MUST still load with a Lead-in of 0; the next save writes version 3 (ADR 20). (amended
  2026-10-16, #78)
- **FR-014**: If stored Organs can't be read at startup, the app MUST start anyway, inform the user,
  and MUST NOT overwrite the unreadable data.
- **FR-015**: If writing Organs to disk fails, the app MUST inform the user.
- **FR-016**: All texts of this feature MUST be available in English and German. The language
  switch MUST also apply to the application menu.

### Key Entities

- **Organ**: a barrel organ owned by the user. It has:
  - a name (not necessarily unique);
  - one Tape Bed;
  - a Minimum Gap (mm); its Minimum Hole Length is the Tape Bed's hole diameter;
  - a Lead-in (mm, 0 or more): blank Tape before Column 1 (amended 2026-10-16, #78);
  - an ordered, non-empty list of Pipes with unique MIDI note numbers.

  It is identified independently of its name, and Tapes will later reference it.
- **Pipe**: plays one note, identified by its MIDI note number. Its position in the Organ's list
  is its row on the Tape.
- **Tape Bed**: the surface in the Organ the Tape runs over. It has tape width, hole diameter and
  spacing between rows (mm). Together with the number of Pipes it determines the Row Span and the
  derived Border, and so how many Pipes physically fit. (amended 2026-10-15, #74)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can define their own 31-Pipe organ from their measurements in under 10 minutes.
- **SC-002**: 100% of the invalid cases listed in FR-007 to FR-009 are not stored and show a message,
  and each message names the field to fix.
- **SC-003**: After a restart, 100% of stored Organs are shown with identical values and Pipe order.
- **SC-004**: No data loss when the stored Organs are unreadable: the original data is unchanged
  after the app has started.
- **SC-005**: Every text of the feature is shown in the selected language (English or German), with
  no untranslated keys.

## Assumptions

- **Single user:** Crancula runs on one computer for one user; no syncing or sharing in this slice.
- **Row layout:** rows are evenly spaced and centred across the tape, row 1 nearest the top edge,
  and "spacing between rows" is the centre-to-centre distance. The Border on each side follows
  from this and is never entered (FR-008). (amended 2026-10-15, #74)
- **Duplicate notes:** an Organ never has two Pipes for the same note. Organs with doubled Pipes
  are out of scope.
- **Defaults:** a new Organ starts with empty measurements and no Pipes; there are no presets.
- **Deleting Organs:** no Tapes exist yet, so deleting an Organ has no effect on other data. When
  Tapes are added, deleting an Organ that has Tapes will be revisited.
- **Out of scope:** Air Demand, Tapes, Songs, importing or exporting Organs as files, and
  presets of known organ types.
- **Prototype code:** the existing organ code is a quarry; this slice may replace it entirely.
