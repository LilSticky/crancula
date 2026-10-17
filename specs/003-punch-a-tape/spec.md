# Feature Specification: Punch a tape

**Feature Branch**: `003-punch-a-tape`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "Punch a tape (#3): the organ owner exports a Tape as a file for the
Plotter (a roll-fed vinyl cutter) so it can be punched. The file is exact 1:1 geometry in mm, built
from the same geometry as the Tape view; it cuts every Hole and the Tape Outline, the Holes from the
Lead-in towards the end and the Tape Outline last. The Tape lies as in the Tape view, always in one
file. Crancula does not describe the Plotter. Export is blocked with an explanation when a Hole has
no Pipe on the Organ or breaks the Minimum Hole Length or Minimum Gap. The command is 'Export for
the Plotter'; the Tape does not change; a save dialog suggests '<Tape name>.svg'. SVG is the first
file format."

## Clarifications

### Decisions before specifying (user, 2026-10-17)

- Q: What does the file contain? → A: Exact 1:1 geometry in mm, built from the same geometry as the
  Tape view (what you see is what gets cut): every Hole and the Tape Outline, nothing else.
- Q: What does the Tape Outline consist of? → A: Both long edges, the Lead-in's straight diagonal
  over its whole length from the full tape width at Column 1 to a point on the top edge, and a
  square end cut after the last Column. There is no blank tail. The Tape is cut out of a wider sheet
  or roll.
- Q: How does the Tape lie in the file? → A: As in the Tape view: horizontal, Lead-in on the left,
  row 1 at the top.
- Q: Is a long Tape split into several files? → A: No. Always one file, whatever the length.
- Q: Does Crancula know the Plotter (blade offset, kerf, working area)? → A: No. These are left to
  the cutter's own software; Crancula checks none of them.
- Q: In which order is cut? → A: The Holes from the Lead-in towards the end, the Tape Outline last.
- Q: When is export refused? → A: When a Hole has no Pipe on the Organ, or breaks the Minimum Hole
  Length or the Minimum Gap. The user is told which Holes and why.
- Q: What does exporting do to the Tape? → A: Nothing. Crancula does not track punching.
- Q: Which file format? → A: SVG first, opened by the cutter's software. DXF and HPGL come later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export my tape for the Plotter (Priority: P1)

As the owner of a barrel organ, I open one of my Tapes in the Tape view and choose "Export for the
Plotter". A save dialog suggests "<Tape name>.svg"; I pick a place and save. Crancula writes one
SVG file that my vinyl cutter's software opens at true size: every Hole as a slot, exactly where
and as large as the Tape view draws it, and the Tape Outline around it, so the cutter cuts the
finished Tape out of a wider sheet or roll. My Tape stays as it was.

**Why this priority**: This is the reason Crancula exists: a Tape I can't punch can't be played.
With this story, v0.1 works end to end from a MIDI Song to a cut Tape.

**Independent Test**: Export a reference Tape on a reference Organ and compare the file with the
expected geometry: each Hole's position, length and width in mm, the Tape Outline's corners, and
the document size in mm.

**Acceptance Scenarios**:

1. **Given** a stored Tape whose Holes all have a Pipe and respect the Minimum Hole Length and
   Minimum Gap, **When** I open it in the Tape view, **Then** "Export for the Plotter" is
   available.
2. **Given** I choose "Export for the Plotter", **Then** a save dialog opens with the file name
   "<Tape name>.svg" suggested. **When** I save, **Then** one SVG file is written there and I'm
   told where it was saved.
3. **Given** an Organ with tape width 100 mm, hole diameter 3 mm, spacing between rows 4 mm,
   10 Pipes and a Lead-in of 50 mm, and a Tape on it with a Column length of 3 mm, **When** I
   export a Hole of row 1 that starts at Column 1 and is 4 Columns long, **Then** the file has a
   slot 12 mm long and 3 mm wide with half-circle ends, from 50 mm to 62 mm from the Tape's left
   end, its centre line 32 mm below the top edge (Border 30.5 mm plus half the hole diameter).
4. **Given** the same Tape is 200 Columns long, **Then** the Tape Outline runs along the top edge
   from the Lead-in's tip (0 mm) to 650 mm, along the bottom edge from 50 mm to 650 mm, the
   Lead-in's diagonal from the tip on the top edge to the bottom edge at 50 mm, and a square end
   cut at 650 mm; the document is 650 mm × 100 mm.
5. **Given** I exported a Tape, **When** I look at it in Crancula, **Then** nothing about the Tape
   has changed, and I can export it again.
6. **Given** I open the exported file in the cutter's software, **Then** it shows the Tape at its
   true size in mm, horizontal, with the Lead-in on the left and row 1 at the top, as in the Tape
   view.

---

### User Story 2 - I'm told when a tape can't be cut (Priority: P1)

If a Tape has Holes that the Organ can't play reliably, cutting it would waste material and give a
Tape that doesn't play. Crancula refuses to export such a Tape and tells me which Holes are the
problem and why, so I can decide what to do (for example bring the Song onto a new Tape).

**Why this priority**: Punching is irreversible. A Tape can break the rules after it was created,
because Crancula does not re-check Tapes when the Organ changes (spec 002), so the check belongs at
the moment of export.

**Independent Test**: Change a reference Organ's hole diameter so that one Hole of a stored Tape is
shorter than the Minimum Hole Length, then try to export and check the message and that no file is
written.

**Acceptance Scenarios**:

1. **Given** a Tape with a Hole shorter than the Organ's Minimum Hole Length, **When** I choose
   "Export for the Plotter", **Then** no save dialog opens, no file is written, and I'm told which
   Hole (its Pipe's note name and its start Column) is too short, and what the Minimum Hole Length
   is.
2. **Given** a Tape with two Holes in one row closer than the Organ's Minimum Gap, **When** I try to
   export, **Then** I'm told which Holes are too close and what the Minimum Gap is.
3. **Given** a Tape with a Hole whose Pipe is not on the Organ, **When** I try to export, **Then**
   I'm told which Hole has no Pipe.
4. **Given** a Tape with several such Holes, **When** I try to export, **Then** every one of them is
   listed with its reason, not just the first.
5. **Given** I've been told a Tape can't be exported, **Then** the Tape has not changed.

---

### User Story 3 - The cutter cuts the holes first and the outline last (Priority: P2)

The cutter cuts the Holes while the Tape is still held by the surrounding sheet, from the Lead-in
towards the end, and cuts the Tape Outline last, so the Tape doesn't come loose or shift before
all Holes are cut.

**Why this priority**: Cutting the Tape Outline first would free the Tape on the cutter and spoil
later Holes. The export (Story 1) is usable without a guaranteed order on short Tapes, but not
reliable.

**Independent Test**: Export a reference Tape and check the order of the cuts in the file: Holes
by their start along the Tape, then the Tape Outline.

**Acceptance Scenarios**:

1. **Given** a Tape with Holes in several rows, **When** I export it, **Then** the Holes appear in
   the file ordered by their start from the Lead-in towards the end, and the Tape Outline comes
   after the last Hole.
2. **Given** two Holes that start at the same Column in different rows, **Then** the one in the
   lower-numbered row comes first.

---

### User Story 4 - Use it in German or English (Priority: P3)

All texts of this feature, including the save dialog's title, the messages about Holes that can't
be cut and about a failed save, are available in German and English.

**Why this priority**: Required by the constitution, but it doesn't change what the feature does.

**Independent Test**: Switch the language to German, export a Tape, try to export a Tape that
can't be cut, and check that no text is shown untranslated.

**Acceptance Scenarios**:

1. **Given** the app is set to German, **When** I export a Tape and trigger each message, **Then**
   all labels and messages are German. The suggested file name is the Tape's name in either
   language.

---

### Edge Cases

- **Lead-in 0**: there is no diagonal; the Tape Outline starts with a square cut at Column 1, so
  the Outline stays closed.
- **Tape with no Holes** (for example after its Pipes were removed): it can be exported; the file
  holds only the Tape Outline.
- **Border 0**: the Holes of the outermost rows touch the long edges. This is valid (dictionary,
  Border) and the file is written as is.
- **A Hole in the last Column**: since there is no blank tail, its half-circle end touches the
  square end cut. This is accepted, like Holes touching the edge with a Border of 0.
- **Empty Columns at the end** (Holes removed with their Pipe): the Tape keeps its length in
  Columns, and the end cut is after its last Column, not after its last Hole.
- **Very long Tape** (for example a 10-minute Song, several metres): still exactly one file, at full
  length; Crancula does not check whether it fits the Plotter's working area.
- **Cancelling the save dialog**: nothing is written, no message is shown, and the Tape view stays
  as it was.
- **Writing the file fails** (for example the folder is read-only or the disk is full): I'm told
  that the file could not be saved and why, as far as known; the Tape is unchanged and I can try
  again, for example in another place.
- **The chosen file already exists**: the save dialog asks whether to replace it, as usual on the
  operating system.
- **A Tape name with characters not allowed in file names** (for example "/" or ":"): the
  suggested file name replaces them so that it can be saved; the Tape's name does not change.
- **Two Tapes with the same name**: both suggest the same file name; the save dialog's usual
  replace question protects the earlier file.
- **The Organ changed after the Tape was created** (other hole diameter, spacing between rows,
  tape width or Lead-in): the file uses the Organ as it is now, like the Tape view. If that makes a
  Hole break the Minimum Hole Length or Minimum Gap, export is refused (Story 2).
- **German UI**: the suggested file name is the Tape's name plus ".svg" and is not translated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Tape view's "Export for the Plotter" command MUST be available for every opened
  Tape. (It was shown disabled until now.)
- **FR-002**: Before writing, the system MUST check every Hole of the Tape against the Organ: the
  Hole's Pipe is on the Organ, the Hole is at least the Minimum Hole Length long, and it keeps at
  least the Minimum Gap to the next Hole in its row. Lengths and gaps in mm follow spec 002 FR-011
  (number of Columns times the Column length).
- **FR-003**: If any Hole fails FR-002, the system MUST NOT open the save dialog or write a file,
  and MUST tell the user every failing Hole with its Pipe's note name, its start Column (counted
  from 1, as in the Import Summary) and its reason (no Pipe on the Organ; shorter than the Minimum
  Hole Length, with that length; closer than the Minimum Gap to the next Hole, with that gap).
- **FR-004**: If the Tape passes FR-002, the system MUST open a save dialog that suggests the file
  name "<Tape name>.svg", with characters that the file system doesn't allow in file names
  replaced.
- **FR-005**: When the user saves, the system MUST write exactly one SVG file, whatever the Tape's
  length, and MUST tell the user where it was saved. If the user cancels, nothing MUST be written
  and nothing else MUST change.
- **FR-006**: The file MUST describe the Tape in true size, 1:1 in millimetres: its document size
  MUST be the Tape's length (Lead-in plus its length in Columns times the Column length) by its
  tape width, and cutter software MUST be able to open it at that size without scaling.
- **FR-007**: The Tape MUST lie in the file as in the Tape view: horizontal, the Lead-in's tip at
  the left end, Column 1 starting at the Lead-in's length from the left end, row 1 nearest the top
  edge, rows centred across the Tape (dictionary, Tape Bed and Border).
- **FR-008**: The file MUST be built from the same geometry as the Tape view, so that every Hole
  and the Tape Outline in the file have the same positions and sizes as drawn there.
- **FR-009**: Every Hole MUST be one closed cut: a slot from the start of its first Column to the
  end of its last Column, one hole diameter wide, with half-circle ends inside that length, centred
  on its Pipe's row.
- **FR-010**: The Tape Outline MUST be one closed cut made of: the top edge from the Lead-in's tip
  to the end of the last Column; the square end cut across the tape width after the last Column;
  the bottom edge from the end back to Column 1; and the Lead-in's straight diagonal from the bottom
  edge at Column 1 to the tip on the top edge. With a Lead-in of 0 the diagonal MUST be replaced by
  a square cut at Column 1. There MUST be no blank tail after the last Column.
- **FR-011**: The file MUST contain only cuts: every Hole and the Tape Outline. It MUST NOT contain
  anything else that cutter software could cut or draw, such as rows, Borders, Column numbers,
  rulers, labels or fills.
- **FR-012**: The cuts MUST be in this order: the Holes ordered by their start from the Lead-in
  towards the end of the Tape, Holes with the same start ordered by row (row 1 first), and the Tape
  Outline last.
- **FR-013**: The file MUST NOT contain any Plotter-specific adjustment: no blade offset, no kerf
  compensation, no split for a working area, and no check against the Plotter's working area.
- **FR-014**: Exporting MUST NOT change the Tape or anything stored. Crancula MUST NOT record that a
  Tape was exported or punched; the same Tape can be exported any number of times.
- **FR-015**: If writing the file fails, the system MUST tell the user that the file could not be
  saved, with the reason where it is known, and the Tape MUST stay unchanged.
- **FR-016**: All texts of this feature MUST be available in English and German.

### Key Entities

- **Tape**: as in spec 002: its Organ, Column length in mm, length in Columns and Holes. Exporting
  reads it and never changes it.
- **Hole**: its Pipe, start Column and length in Columns; in the file a slot one hole diameter wide
  with half-circle ends.
- **Organ**: supplies the Tape Bed (tape width, hole diameter, spacing between rows), its Pipes and
  their order, the Lead-in, the Minimum Hole Length and the Minimum Gap at the time of export.
- **Tape Outline**: the cut around the Tape: both long edges, the Lead-in's diagonal and the square
  end cut. Cut last.
- **Exported file**: one SVG file in true size (mm) that holds the cuts for the Plotter: the Holes
  in order, then the Tape Outline. Not stored by Crancula.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An organ owner exports an opened Tape in under 30 seconds, from choosing "Export for
  the Plotter" to the saved file.
- **SC-002**: For reference Tapes, 100% of Holes and every corner of the Tape Outline in the file
  are within 0.01 mm of their expected position and size, and of what the Tape view draws.
- **SC-003**: The exported file of a reference Tape opens in common vector and cutter software at
  its true size in mm, with no scaling by the user.
- **SC-004**: 0 files are written for Tapes with a Hole that has no Pipe or breaks the Minimum Hole
  Length or Minimum Gap, and 100% of such Holes are named in the message.
- **SC-005**: Exporting a Tape of a 10-minute Song takes under 5 seconds and gives one file.
- **SC-006**: After any number of exports, the stored Tape is identical to before.
- **SC-007**: Every text of the feature is shown in the selected language, with no untranslated
  keys.

## Assumptions

- **No new terms:** the slice uses the dictionary as it stands (Tape, Hole, Column, Tape Outline,
  Lead-in, Border, Row Span, Tape Bed, Plotter, Punch, Minimum Hole Length, Minimum Gap, Pipe,
  Organ). "Exported file" is a descriptive phrase, not a term.
- **SVG as the format:** named because the organ owner's cutter software must open the file, not as
  an implementation choice. DXF and HPGL are later formats (dictionary, Plotter).
- **Where the command lives:** only in the Tape view in this slice, where the Tape is checked by
  eye before it is cut. Exporting from the Tape list can come later.
- **When the check runs:** at the moment of export. The command stays available for every Tape;
  a Tape that can't be cut is explained when the user chooses it, instead of a save dialog.
- **Lead-in 0:** the Tape Outline starts with a square cut at Column 1; there is no diagonal.
- **Tape without Holes:** exportable; the file holds only the Tape Outline. The user may want it to
  test the cutter.
- **Touching cuts:** Holes in the last Column touch the end cut, and with a Border of 0 the
  outermost rows touch the long edges. Both are accepted as they follow from the user's decisions
  (no blank tail; Border 0 is valid).
- **The Organ as it is now:** the file, like the Tape view, uses the Organ's current Tape Bed and
  Lead-in. Tapes are not re-checked when the Organ changes (spec 002), so FR-002 is where a
  changed Organ is caught.
- **Cut order of a Hole and of the Outline:** each Hole is cut as one closed path; the Tape Outline
  is one closed path. Where on that path the blade starts is left to the cutter's software.
- **Lines only:** cuts are lines without fill; line width and colour don't matter to the cutter
  and are left to the plan.
- **Save dialog:** the operating system's own dialog, which asks before replacing an existing file.
  The folder suggested first is left to the plan.
- **Unreadable Organ:** a Tape whose Organ can't be read can't be opened (spec 002 FR-023), so it
  can't be exported either.
- **Single user:** one computer, one user; the file is written where the user chooses.
- **Out of scope:** DXF and HPGL export, describing the Plotter (blade offset, kerf, working area),
  splitting a Tape into several files, a blank tail, tracking whether a Tape was punched, exporting
  several Tapes at once, printing, and editing a Tape before export ("Edit a tape").
- **Prototype code:** existing code is a quarry; this slice may replace it.
