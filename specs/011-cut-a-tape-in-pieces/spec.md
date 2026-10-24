# Feature Specification: Cut a tape in pieces

**Feature Branch**: `011-cut-a-tape-in-pieces`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Cut a tape in pieces (#168, v0.4): describe a Plotter once, like an
Organ (name, format SVG, working length and working width, and a toggle for roll plotters), and
export a Tape longer than the working length as Tape pieces with an Overlap for gluing. A Join lies
only between Columns no Hole crosses, as close as possible before the working length. The Overlap
repeats the Holes it lies under; its length is set on the Plotter (default 20 mm). A stretch longer
than the working area with no possible Join is a new Cutting Problem, shown in the Tape view against
a Plotter picked there. Roll plotters need no working length and never split a Tape. A Tape wider
than the working width is refused. One SVG per Tape piece, numbered '<tape> 1 of 3.svg', saved
together into one folder. Without a Plotter, export stays one file as today. Several Tapes side by
side is out of scope (#170)."

## Clarifications

### Decisions before specifying (user, 2026-10-23)

From [the discovery](../../documentation/discovery/later.md), section 3, decisions 11–12:

- Q: Where may a Tape be split into Tape pieces? → A: Only between Columns no Hole crosses, as close
  as possible before the piece-length limit, plus an Overlap for gluing.
- Q: Is the Plotter described in Crancula? → A: Yes. A Plotter is described once (name, format,
  working area), like an Organ.

### Decisions before specifying (user, 2026-10-25)

Decisions 19–24 on the domain-modeler's discovery questions (section B):

- Q: What is on the Overlap, and where is its length set? → A: It repeats the Holes of the stretch it
  lies under, so both layers are cut through and the Holes guide the gluing. Its length is set on the
  Plotter, default 20 mm (decision 19).
- Q: A stretch longer than the working area has no Join no Hole crosses: what then? → A: It is a new
  kind of Cutting Problem, shown in the Tape view while editing (decision 20).
- Q: Which Plotter is that Cutting Problem checked against? → A: A Plotter picked in the Tape view's
  side panel. With no Plotter picked there is no such Cutting Problem (decision 21). This replaces
  the proposal "the last used Plotter, remembered as a UI preference".
- Q: What describes a Plotter? → A: Name, format (only SVG to choose), working length, working width,
  and a toggle for roll plotters (vinyl cutters): a roll plotter cuts near-endless lengths, needs no
  working length and never splits a Tape. A Tape wider than the working width is refused. Without a
  described Plotter, export stays one file as today (decision 22).
- Q: How do the Tape pieces leave Crancula? → A: One SVG file per Tape piece, numbered in order
  ("<Tape name> 1 of 3.svg"), saved together into one folder the user picks (decision 23).
- Q: Several Tapes side by side on a roll plotter? → A: Its own later slice (#170), not part of this
  one (decision 24).
- Rules confirmed as proposed: a Join lies as close as possible before the working length, counting
  the Lead-in on the first Tape piece, the Overlap on every piece but the last and the end gap on the
  last; Tape pieces are found one after another from the Lead-in's tip. A Plotter is independent of
  Organs and Tapes: removing one removes nothing else.
- Terms approved for DICTIONARY.md: Working area (Arbeitsbereich), Tape piece (Bandstück), Join
  (Klebestelle), Overlap (Klebezugabe); Plotter becomes described by the user and gains the roll
  toggle (German: Plotter, Schneideplotter in prose). Changed entries: Plotter, Tape Outline, Lead-in,
  Tape, Cutting Problem.

### Open questions

Five questions remain; they are in [open-questions.md](open-questions.md) and marked below as
`[NEEDS CLARIFICATION: Qn]`. Each has a recommended answer, which this spec assumes until the user
decides.

## User Scenarios & Testing *(mandatory)*

Column numbers in this spec are the ones the Tape view shows: Column 1 is the first Column after
the Lead-in. Lengths along the Tape are counted from the Lead-in's tip, as in spec 003.

The worked examples use the reference of spec 003: an Organ with tape width 100 mm, hole diameter
3 mm, spacing between rows 4 mm, 10 Pipes, a Minimum Gap of 2 mm and a Lead-in of 50 mm, and a Tape
on it with a Column length of 3 mm and 200 Columns. The whole Tape is 652 mm long (Lead-in 50 mm,
200 × 3 mm, end gap 2 mm).

### User Story 1 - Describe my plotter (Priority: P1)

As the owner of a barrel organ, I describe the Plotter I cut with once: its name, the format it reads
(SVG), how long and how wide a piece it cuts in one go (its Working area), and how long the Overlap
for gluing should be. If it is a roll plotter that cuts near-endless lengths, I switch on the roll
toggle and only give its working width. Crancula keeps it, like my Organs.

**Why this priority**: every other story needs a Plotter. Without one, export stays as in spec 003.

**Independent Test**: start with no Plotters, describe one with a name, working length 300 mm,
working width 120 mm and the default Overlap, restart the app and see it again with the same values.

**Acceptance Scenarios**:

1. **Given** no Plotters exist, **When** I describe a Plotter named "Cutting mat" with working length
   300 mm and working width 120 mm and save it, **Then** it is stored, listed, and its Overlap is
   20 mm unless I changed it.
2. **Given** I describe a Plotter, **Then** the format offers only SVG, already chosen.
3. **Given** I switch on the roll toggle, **Then** I'm not asked for a working length or an Overlap,
   only for the working width; **When** I switch it off again, **Then** both are asked for again.
4. **Given** a Plotter without a name, or a working width, working length or Overlap that is 0,
   negative or not a number, **Then** it can't be saved and the message names the field to fix, as in
   the Organ editor.
5. **Given** an Overlap as long as or longer than the working length, **Then** the Plotter can't be
   saved and I'm told the Overlap must be shorter than the working length.
6. **Given** I saved a Plotter, **When** the app restarts, **Then** it is there with the same values.
7. **Given** the language is German, **When** I enter a decimal with a comma, **Then** it is read like
   other decimals (comma or point).

---

### User Story 2 - Cut a long tape in pieces (Priority: P1)

My Tape is longer than my Plotter cuts in one go. I pick my Plotter in the Tape view and choose
"Export for the Plotter". Crancula cuts the Tape in as few Tape pieces as fit the Working area, each
ending at a Join where no Hole crosses, each but the last with an Overlap that repeats the Holes it
lies under. I pick a folder; Crancula writes one SVG per Tape piece, numbered in order, and I glue
them together, lining up the repeated Holes.

**Why this priority**: it is the capability; a Tape that doesn't fit the Plotter can't be cut today
without splitting it by hand in other software.

**Independent Test**: export the reference Tape with no Holes on a Plotter with working length
300 mm, working width 120 mm and Overlap 20 mm, and compare the three files with the expected
geometry.

**Acceptance Scenarios**:

1. **Given** the reference Tape with no Holes and that Plotter picked, **When** I export, **Then** it
   is cut in 3 Tape pieces: piece 1 from the Lead-in's tip to 298 mm (Join after Column 76 at 278 mm,
   plus 20 mm Overlap), piece 2 from 278 mm to 577 mm (Join after Column 169 at 557 mm, plus the
   Overlap), piece 3 from 557 mm to the end cut at 652 mm.
2. **Given** I export a Tape that needs several Tape pieces, **Then** a folder dialog opens instead of
   a save dialog; **When** I pick a folder, **Then** the files "<Tape name> 1 of 3.svg",
   "<Tape name> 2 of 3.svg" and "<Tape name> 3 of 3.svg" are written there and I'm told where.
3. **Given** a Tape piece file, **Then** it holds that piece in true size in mm, its left end at the
   file's left edge, horizontal with row 1 at the top as in the Tape view; its document size is the
   piece's length by the tape width.
4. **Given** a Hole lies in the 20 mm after a Join, **Then** it is cut in both Tape pieces at the same
   place relative to the Join: in the earlier piece's Overlap and at the start of the later piece.
5. **Given** a Join, **Then** no Hole crosses it nor the end of its Overlap
   [NEEDS CLARIFICATION: Q3 – may a Hole touch them, or must it keep the Minimum Gap?].
6. **Given** the Tape pieces, **Then** only the first starts with the Lead-in; the others start with
   a square cut at their Join; every piece but the last ends with a square cut at the end of its
   Overlap, and the last ends with the end cut of spec 003.
7. **Given** a Tape piece file, **Then** it holds only cuts, the Holes ordered from its left end and
   by row, then that piece's Tape Outline last, as in spec 003.
8. **Given** a Tape that fits the working length in one piece, **When** I export with that Plotter
   picked, **Then** it is exported as one file as today
   [NEEDS CLARIFICATION: Q5 – save dialog with "<Tape name>.svg", or the folder with "1 of 1"?].
9. **Given** no Plotter is picked (or none is described), **When** I export, **Then** it works exactly
   as in spec 003: one file, whatever the length.
10. **Given** I exported in pieces, **Then** the Tape has not changed and I can export it again.

---

### User Story 3 - See where a tape can't be cut in pieces (Priority: P1)

While I edit a Tape with my Plotter picked, Crancula tells me at once when a stretch of it is longer
than the working length and has no place for a Join, for example a long held note in one row with
other notes around it. It shows as a Cutting Problem, so I can shorten a Hole or make a gap before I
try to export.

**Why this priority**: punching is irreversible and export would refuse such a Tape; knowing early
saves a round trip, and it is the only way the user learns where to change the Tape.

**Independent Test**: on the reference Tape add a Hole in row 1 from Column 1, 100 Columns long
(300 mm), pick the 300 mm Plotter, and see a Cutting Problem for Columns 1–100; shorten the Hole to
70 Columns and see it gone.

**Acceptance Scenarios**:

1. **Given** the Tape view of a Tape, **Then** the side panel has a Plotter picker listing every
   described Plotter and "No Plotter"; the picked Plotter is kept
   [NEEDS CLARIFICATION: Q1 – per Tape, or one choice for all Tapes?].
2. **Given** the reference Tape with a Hole in row 1 from Column 1 that is 100 Columns long, and the
   300 mm Plotter picked, **Then** the Tape has a Cutting Problem naming Columns 1–100 and the
   Plotter: longer than its working length, with no place for a Join.
3. **Given** such a Cutting Problem, **Then** it is in the side panel's list of Cutting Problems, the
   stretch is marked in the Tape view, and choosing the entry scrolls the stretch into view.
4. **Given** that Cutting Problem, **When** an edit makes a Join possible (shorter Hole, a Hole moved,
   a smaller Column length), **Then** it is gone at once; **When** an edit removes the last possible
   Join of a long stretch, **Then** it appears at once.
5. **Given** several such stretches, **Then** each is listed on its own.
6. **Given** no Plotter is picked, or a roll plotter is picked, **Then** there is no such Cutting
   Problem.
7. **Given** a Tape with such a Cutting Problem, **When** I choose "Export for the Plotter", **Then**
   it is refused as for the other Cutting Problems (spec 003), naming the stretch, and no file is
   written.
8. **Given** the picked Plotter's working width is less than the Organ's tape width, **Then** the
   Tape view says the Tape is too wide for that Plotter, and export is refused with that reason.
9. **Given** a Plotter is picked, **Then** the side panel says how many Tape pieces the Tape is cut
   in [NEEDS CLARIFICATION: Q4 – are the Joins also drawn in the Tape view?].

---

### User Story 4 - Cut on a roll plotter (Priority: P2)

My vinyl cutter takes a roll and cuts as long as I like. I describe it as a roll plotter with its
working width; Crancula never splits a Tape for it and only checks that the Tape is not too wide.

**Why this priority**: the first target Plotter is a vinyl cutter (dictionary), which export already
serves; the roll toggle keeps it working once Plotters are described, but adds little new.

**Independent Test**: describe a roll plotter 120 mm wide, pick it for the reference Tape and export:
one 652 mm file as in spec 003; change its width to 90 mm and see export refused.

**Acceptance Scenarios**:

1. **Given** a roll plotter is picked, **When** I export a Tape of any length, **Then** it is
   exported as one file, as in spec 003.
2. **Given** a roll plotter narrower than the Organ's tape width is picked, **Then** the Tape view
   says the Tape is too wide for it and export is refused.

---

### User Story 5 - Change or remove a plotter (Priority: P2)

I adjust a Plotter after measuring its Working area again, change its Overlap, or remove one I no
longer have. Tapes and Organs stay as they are.

**Why this priority**: needed to keep the list right, but cutting works without it.

**Independent Test**: change a Plotter's working length and see the Tape pieces of a Tape that uses
it change; remove the Plotter and see the Tape view's picker fall back to "No Plotter".

**Acceptance Scenarios**:

1. **Given** a stored Plotter, **When** I change its name, working length, working width, Overlap or
   roll toggle and save, **Then** the change is kept across restarts, and every Tape view with it
   picked uses the new values at once (Tape pieces and Cutting Problems).
2. **Given** I leave the Plotter editor with unsaved changes, **Then** I'm warned, as in the Organ
   editor.
3. **Given** a stored Plotter, **When** I remove it and confirm, **Then** it is gone; no Tape or
   Organ changes, and where it was picked the picker shows "No Plotter".
4. **Given** two Plotters with the same name, **Then** they are still two Plotters.
5. **Given** where Plotters are listed and edited
   [NEEDS CLARIFICATION: Q2 – their own screen like Organs, or only from the Tape view?], **Then** I
   can reach them in one step from the Tape view's Plotter picker.

---

### User Story 6 - Use it in German or English (Priority: P3)

All texts of this feature, including the Plotter editor, the picker, the new Cutting Problem, the
folder dialog's title and the messages about a failed save, are available in German and English.

**Why this priority**: required by the constitution, but it doesn't change what the feature does.

**Independent Test**: switch the language to German, describe a Plotter, trigger each validation
message and the new Cutting Problem, export in pieces; no text is shown untranslated.

**Acceptance Scenarios**:

1. **Given** the app is set to German, **When** I walk through Stories 1–3, **Then** all labels and
   messages are German. The file names use the Tape's name, and their numbering is in the app's
   language ("1 of 3" / "1 von 3").

---

### Edge Cases

- **The Lead-in plus the Overlap is as long as the working length or longer**: no first Tape piece
  fits; the stretch from Column 1 to the first possible Join is a Cutting Problem.
- **A Tape shorter than the working length**: one piece, no Join (Story 2, scenario 8).
- **The last piece**: needs no Overlap; it ends with the end cut one Minimum Gap after the last
  Column. A Join is placed so that the last piece, with its end gap, fits too.
- **Exactly fitting**: a piece whose length (with Lead-in, Overlap or end gap) equals the working
  length fits.
- **A Tape with no Holes**: every Column boundary is a possible Join; only a Column length longer
  than the working length minus the Overlap makes it uncuttable.
- **Very dense music**: few Column boundaries are free in every row; the Tape may need more pieces or
  have stretches that can't be cut. Crancula never cuts through a Hole to avoid that.
- **The Organ changes** (tape width, Lead-in, Minimum Gap, Pipes) **or the Tape's Column length
  changes**: Tape pieces and the new Cutting Problem follow at once, as the Tape view does today.
- **The Organ is too wide for the picked Plotter**: no Tape pieces are computed; only the width
  message is shown.
- **Holes whose Pipe is not on the Organ**: they are not drawn or cut (spec 003); they don't prevent
  a Join, but they still block export as before.
- **The picked Plotter is removed**: the picker falls back to "No Plotter" and its Cutting Problems
  disappear.
- **A Tape name with characters not allowed in file names**: they are replaced in every piece's file
  name, as in spec 003.
- **Files with these names already exist in the folder**: I'm asked once whether to replace them;
  if I don't, nothing is written.
- **Cancelling the folder dialog**: nothing is written, no message is shown.
- **Writing one of the files fails**: I'm told which file could not be saved and why, as far as
  known; files already written stay, the Tape is unchanged and I can try again.
- **More than 9 pieces**: numbering stays in order in a file list (e.g. "01 of 12").
- **The Preview plays**: picking a Plotter does not change the Tape, so it is allowed while the
  Preview plays.

## Requirements *(mandatory)*

### Functional Requirements

#### Plotter

- **FR-001**: Users MUST be able to describe a Plotter with a name (not blank, not necessarily
  unique), a format (only SVG offered), a working width in mm, a roll toggle, and, unless it is a
  roll plotter, a working length and an Overlap length in mm. The Overlap starts at 20 mm.
- **FR-002**: Every length of a Plotter MUST be a finite number above 0, and the Overlap MUST be
  shorter than the working length; otherwise the Plotter can't be saved and the message names the
  field. Decimals accept a comma or a point.
- **FR-003**: Users MUST be able to change a Plotter and to remove one after confirming, with a Save
  button and a warning on leaving with unsaved changes, as in the Organ editor (spec 001).
- **FR-004**: Plotters MUST be kept across restarts. A Plotter is independent of Organs and Tapes:
  removing it changes no Tape or Organ.
- **FR-005**: The Plotter list and editor MUST be reachable from the Tape view's Plotter picker
  [NEEDS CLARIFICATION: Q2].

#### Picking a Plotter

- **FR-006**: The Tape view's side panel MUST offer a Plotter picker with every described Plotter and
  "No Plotter". Picking one MUST NOT change the Tape or its undo history
  [NEEDS CLARIFICATION: Q1 – where the pick is kept].
- **FR-007**: With a sheet Plotter picked (roll toggle off) and the Tape not too wide, the side panel
  MUST show how many Tape pieces the Tape is cut in [NEEDS CLARIFICATION: Q4].

#### Tape pieces

- **FR-008**: A Join MUST lie on a Column boundary that no Hole crosses, and the end of its Overlap
  (the Join plus the Overlap length) MUST also cross no Hole
  [NEEDS CLARIFICATION: Q3 – touching allowed, or the Minimum Gap kept]. Holes whose Pipe is not on
  the Organ are not counted.
- **FR-009**: Every Tape piece MUST fit the working length: the first counted from the Lead-in's tip,
  every piece but the last including its Overlap, and the last including the end gap of spec 003.
- **FR-010**: Tape pieces MUST be found one after another from the Lead-in's tip: each Join is the
  last possible Join that keeps its piece within the working length. This gives the fewest pieces.
- **FR-011**: A Tape that fits the working length whole, and every Tape with a roll plotter picked,
  MUST be one piece with no Join.
- **FR-012**: The Overlap MUST repeat the Holes it lies under: every Hole between a Join and the end
  of its Overlap is cut in both Tape pieces at the same place relative to the Join.
- **FR-013**: Each Tape piece MUST have its own Tape Outline: both long edges; the Lead-in's diagonal
  (or the square cut of a Lead-in of 0) on the first piece only, a square cut at its Join on every
  other piece; a square cut at the end of its Overlap on every piece but the last, and the end cut of
  spec 003 on the last.
- **FR-014**: Tape pieces MUST be computed from the same geometry as the Tape view and the export of
  spec 003, so a Hole has the same size in a piece as in the Tape view, shifted only by the piece's
  start.

#### Cutting Problems

- **FR-015**: With a sheet Plotter picked, every stretch between two neighbouring possible Joins (or
  the Lead-in's tip, or the end cut) that can't be made into a Tape piece within the working length
  MUST be a Cutting Problem of the Tape. It names its first and last Column and the Plotter, and is
  updated at once after every edit, as the Cutting Problems of spec 004.
- **FR-016**: The new Cutting Problems MUST be listed in the side panel with the others, marked over
  their Columns in the Tape view, and choosing one MUST scroll it into view.
- **FR-017**: With a Plotter picked whose working width is less than the Organ's tape width, the Tape
  view MUST say so; no Tape pieces are computed.
- **FR-018**: With no Plotter picked, or a roll plotter picked, there MUST be no Cutting Problem of
  FR-015.

#### Export

- **FR-019**: "Export for the Plotter" MUST be refused, with every reason listed and no dialog
  opened, when the Tape has any Cutting Problem (spec 003 or FR-015) or is too wide for the picked
  Plotter (FR-017).
- **FR-020**: With no Plotter picked, export MUST work exactly as in spec 003.
- **FR-021**: When the Tape is cut in more than one Tape piece, export MUST ask for one folder and
  write one SVG file per piece into it, named "<Tape name> <n> of <count>.svg" in the app's language
  with the characters the file system doesn't allow replaced, numbered so the files sort in order.
  If any of these files exists, the user MUST be asked once whether to replace them. The user MUST
  be told where the files were saved.
- **FR-022**: A Tape that is one piece MUST be exported as one file [NEEDS CLARIFICATION: Q5].
- **FR-023**: Every Tape piece file MUST be in true size, 1:1 in millimetres, its document size the
  piece's length by the tape width, the piece's start at the left edge, and MUST hold only cuts in the
  order of spec 003 FR-012: that piece's Holes, then its Tape Outline. It MUST hold no Plotter
  adjustment (blade offset, kerf) and no marks of the Join or the Overlap other than the cuts.
- **FR-024**: Cancelling the folder dialog or the replace question MUST write nothing. If writing a
  file fails, the user MUST be told which file and why, as far as known.
- **FR-025**: Exporting MUST NOT change the Tape, the Plotter or anything stored.

#### Language

- **FR-026**: All new texts MUST exist in English and German.

### Key Entities

- **Plotter**: described by the user. Name, format (SVG), Working area (working width; working length
  unless it is a roll plotter), Overlap length (default 20 mm, not for a roll plotter), roll toggle.
  Independent of Organs and Tapes; kept across restarts.
- **Working area**: the largest length and width a Plotter cuts in one go; a roll plotter has only a
  width.
- **Tape piece**: a part of a Tape cut on its own, from the Lead-in's tip or a Join to the end of its
  Overlap or the end cut; computed for a Tape, its Organ and a Plotter, never stored.
- **Join**: where two Tape pieces meet, on a Column boundary no Hole crosses.
- **Overlap**: the strip after a Join where a Tape piece lies under the next one for gluing; it
  repeats the Holes it lies under.
- **Cutting Problem** (new kind): a stretch of Columns that, for the picked Plotter, can't be made a
  Tape piece because it is longer than the working length with no place for a Join.
- **Tape**: unchanged by this slice, apart from the picked Plotter if Q1 keeps it per Tape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An organ owner describes a Plotter in under 2 minutes and exports a Tape in pieces in
  under 30 seconds, from choosing "Export for the Plotter" to the saved files.
- **SC-002**: For reference Tapes, 100% of Holes and every corner of every Tape piece's Tape Outline
  are within 0.01 mm of their expected position and size.
- **SC-003**: For reference Tapes, no Hole crosses a Join or the end of an Overlap, and every Tape
  piece fits the working length, in 100% of cases.
- **SC-004**: For reference Tapes, the number of Tape pieces is the fewest the rules allow.
- **SC-005**: The new Cutting Problem appears or disappears within 0.2 s of an edit on a Tape of a
  10-minute Song.
- **SC-006**: 0 files are written for Tapes with a Cutting Problem or too wide for the picked
  Plotter, and 100% of the reasons are named.
- **SC-007**: With no Plotter picked, the exported file is identical to the export of spec 003.
- **SC-008**: Every text of the feature is shown in the selected language, with no untranslated keys.

## Assumptions

- **Dictionary**: new entries Working area, Tape piece, Join and Overlap; Plotter becomes described
  by the user (name, format, Working area, Overlap, roll toggle; blade offset and kerf stay with the
  cutter's software; other formats only for a concrete device); Tape Outline gains "each Tape piece
  has its own, square at a Join"; Lead-in gains "on the first Tape piece only"; Tape's export line
  gains the Tape pieces; Cutting Problem gains the stretch with no place for a Join. "Working length",
  "working width", "roll plotter" and "sheet Plotter" are plain phrases inside the Plotter entry.
  New entries are not placed directly after Preview.
- **Overlap on a roll plotter**: a roll plotter never splits a Tape, so it has no Overlap and no
  working length; switching the toggle off asks for both again.
- **Too wide**: a Tape wider than the working width is not a Cutting Problem of a Hole or stretch;
  it is a message in the Tape view and a reason export is refused. Turning the Tape across the
  Plotter is not offered.
- **What blocks a Join**: only Holes that are drawn and cut (their Pipe is on the Organ).
- **Piece order and numbering**: pieces are numbered from the Lead-in; the number is only in the
  file name, never cut into the Tape.
- **No Plotter Presets**: Crancula ships no ready-made Plotters.
- **Spec 003 changes**: "always one file" and "no split for a working area" (FR-005, FR-013) now hold
  only with no Plotter or a roll plotter picked.
- **Out of scope**: several Tapes side by side on one roll (#170), DXF and HPGL, blade offset and
  kerf, nesting pieces across the working width, cutting through a Hole, marks or numbers cut on the
  Tape, and exporting from the Tape list.
- **Prototype code**: existing code is a quarry; this slice may replace it.
