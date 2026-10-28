# Feature Specification: Off-centre rows on a Tape Bed

**Feature Branch**: `014-off-centre-rows-on-a-tape-bed`

**Created**: 2026-10-28

**Status**: Draft

**Input**: User description: "Slice 014 Off-centre rows on a Tape Bed (#163). Let a Tape Bed place its rows
off-centre via an optional Guide margin (guide edge to the centre of row 1, as gamma files give it, e.g. Raffin
20er: 10 mm). Row 1's edge is the guide edge (top edge in the Tape view); nothing flips, no choice per Tape Bed.
Empty Guide margin = centred rows; existing Organs migrate unchanged; the field is optional in the Organ editor.
The far-side Border stays derived; Border is per side."

## Clarifications

### Decisions before specifying (user, 2026-10-28)

From [the discovery](../../documentation/discovery/later.md), decisions 35–38:

- Q: What does the organ owner enter? → A: The Guide margin: the distance from the guide edge to the centre of
  row 1, as gamma files give it (Raffin 20er: 10 mm). The far-side Border stays derived (decision 35).
- Q: Which edge is the guide edge? → A: Row 1's edge, the Tape's top edge in the Tape view. Nothing in the view
  flips, and there is no choice per Tape Bed (decision 36).
- Q: What if it is left empty? → A: The rows are centred, as today. Existing Organs migrate unchanged; the field
  is optional in the Organ editor (decision 37).
- Terms: Guide margin (Führungsrand), approved 2026-10-28; Border is now per side (decision 38).

### Session 2026-10-28

- Q: How does the UI name the two Borders? → A: Guide side and far side (German: Führungsseite, Gegenseite),
  added to the Border entry in DICTIONARY.md.
- Q: Are the Presets in scope? → A: Yes. #162 is closed and both Drehorgel Presets exist; they gain the Guide
  margin of their gamma files (20er: 10 mm, 31er: 11 mm).

## Why

Real tracker bars do not always centre their rows. The Raffin/Carl Frei 20er gamma file gives 10 mm from the
guide edge and 26.9 mm from the far edge to the row centres on a 110 mm Tape. A Tape cut with centred rows sits
about 8.5 mm off the real rows and plays wrong notes or none.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enter a Guide margin for my Organ (Priority: P1)

The organ owner opens their Organ in the Organ editor and types the Guide margin from their gamma file into an
optional field on the Tape Bed. The Border shown read-only next to the Tape Bed now lists both sides: the guide
side and the far side. The Tape Bed drawing shows the rows shifted towards the guide edge.

**Why this priority**: Without the value stored on the Organ, no Tape can be placed correctly. It is the whole
capability.

**Independent Test**: Create an Organ with tape width 110 mm, 20 Pipes, a spacing between rows that gives a Row
Span ending 26.9 mm from the far edge, and a Guide margin of 10 mm; save, restart the app, and the Organ shows the
Guide margin and both Borders.

**Acceptance Scenarios**:

1. **Given** an Organ with an empty Guide margin, **When** the organ owner opens it in the Organ editor, **Then**
   the Guide margin field is empty, and the Border reads the same on both sides with the hint that the rows are
   centred.
2. **Given** an Organ in the Organ editor, **When** the organ owner enters a Guide margin of 10 mm and saves,
   **Then** the Organ keeps the Guide margin, and the Border reads Guide margin − hole diameter / 2 on the guide
   side and tape width − Row Span − guide-side Border on the far side.
3. **Given** an Organ with a Guide margin, **When** the organ owner clears the field and saves, **Then** the rows
   are centred again.
4. **Given** the Organ editor, **When** the organ owner enters a Guide margin that would make either Border
   negative (less than half the hole diameter, or more than tape width − (Row Span − hole diameter / 2)), **Then**
   the field shows why and the Organ can't be saved.
5. **Given** an Organ with a Guide margin, **When** the organ owner adds or removes Pipes, **Then** only the
   far-side Border changes, and if it would become negative the Organ shows that its rows don't fit.
6. **Given** an Organ with a Guide margin, **When** the app restarts, **Then** the Guide margin is still there.

---

### User Story 2 - My Tape is punched where my tracker bar reads it (Priority: P1)

Every place that draws or cuts the Tape puts row 1's centre at the Guide margin from the Tape's top edge: the
Tape view, the import preview, the Organ list's Tape Bed miniature, the plotter SVG, Tape pieces and side-by-side
cuts.

**Why this priority**: The value only matters if the cut Tape follows it; together with story 1 this is the MVP.

**Independent Test**: For an Organ with a 110 mm tape width and a 10 mm Guide margin, export a Tape as SVG and
measure that row 1's Hole centres lie 10 mm from the Tape's top edge, and the last row's centres 26.9 mm from the
bottom edge.

**Acceptance Scenarios**:

1. **Given** an Organ with a Guide margin, **When** the organ owner opens one of its Tapes in the Tape view,
   **Then** row 1 is at the top, its centre the Guide margin from the top edge, and the Borders drawn match the
   Organ editor.
2. **Given** that Tape, **When** it is exported for a Plotter (whole, in Tape pieces or side by side), **Then**
   each Hole's centre lies the Guide margin plus (row − 1) × spacing between rows from the Tape's top edge, within
   0.01 mm.
3. **Given** an Organ without a Guide margin, **When** any of its Tapes is drawn or exported, **Then** the result
   is the same as before this slice.
4. **Given** an Organ with a Guide margin, **When** the organ owner clicks, drags or places Holes in the Tape
   view, **Then** the pointer hits the row drawn under it.

---

### User Story 3 - Existing Organs and Tapes keep working (Priority: P2)

Organs saved before this slice load with an empty Guide margin and look and cut exactly as before.

**Why this priority**: No loss of data; required by the constitution, but carries no new value on its own.

**Independent Test**: Start the app with an Organ library snapshot from before this slice; every Organ loads,
shows an empty Guide margin and the same Border as before.

**Acceptance Scenarios**:

1. **Given** an Organ library saved by the previous version, **When** the app starts, **Then** every Organ loads
   with an empty Guide margin and centred rows.
2. **Given** that library, **When** the organ owner saves any change, **Then** it is written in the new version
   and reads back the same.

---

### User Story 4 - The Drehorgel Presets sit where the gamma files say (Priority: P3)

The 20er-Drehorgel Preset fills a Guide margin of 10 mm and the 31er-Drehorgel Preset 11 mm, as their gamma
files give them.

**Why this priority**: Owners who start from a Preset get correct Tapes without looking up their gamma file.

**Independent Test**: Use the 20er Preset in a new Organ; the Guide margin reads 10 mm and the far-side Border
25.35 mm (110 − 10 − 19 × 3.85 − 1.5).

**Acceptance Scenarios**:

1. **Given** a new Organ, **When** the organ owner uses the 20er-Drehorgel Preset, **Then** the Guide margin is
   10 mm, the guide-side Border 8.5 mm and the far-side Border 25.35 mm.
2. **Given** a new Organ, **When** the organ owner uses the 31er-Drehorgel Preset, **Then** the Guide margin is
   11 mm and the far-side Border 11.95 mm (140 − 11 − 30 × 3.86 − 1.25).
3. **Given** an Organ saved from a Preset before this slice, **When** the app starts, **Then** it stays centred:
   Presets fill new Organs only.

### Edge Cases

- A Guide margin of exactly half the hole diameter: the guide-side Border is 0, which is valid; the holes touch
  the top edge.
- A Guide margin whose far-side Border is exactly 0: valid; the last row's holes touch the bottom edge.
- A Guide margin that equals the centred position: the Organ behaves as centred, but keeps the entered value.
- Zero, negative or non-numeric input: refused like the other Tape Bed fields; an empty field means centred.
- Changing tape width, hole diameter or spacing between rows with a Guide margin set: the Borders and the
  validity are recomputed at once, as for Pipes.
- An Organ with a single Pipe: Row Span is the hole diameter; the same rules apply.
- A snapshot that carries an invalid Guide margin (from a newer or edited file): the snapshot is refused like
  any other invalid Organ value, as today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Tape Bed MUST have an optional Guide margin in millimetres: the distance from the guide edge
  (the Tape's top edge, row 1's edge) to the centre of row 1.
- **FR-002**: With no Guide margin, the rows MUST be centred across the Tape, exactly as before this slice.
- **FR-003**: The Border MUST be derived per side: with a Guide margin, guide side = Guide margin − hole
  diameter / 2 and far side = tape width − Row Span − guide-side Border; without one, both sides = (tape width −
  Row Span) / 2.
- **FR-004**: An Organ MUST be invalid when the Border on either side would be negative, and the Organ editor
  MUST say which side and why.
- **FR-005**: The Organ editor MUST offer the Guide margin as an optional field on the Tape Bed, and show both
  Borders read-only; the Tape Bed drawing MUST show the rows where they sit.
- **FR-006**: Every place that draws, hit-tests or cuts rows (Tape view, import preview, Tape Bed miniature,
  plotter SVG, Tape pieces, side-by-side cuts, Cutting Problems and export refusals) MUST place row r's centre at
  guide-side Border + hole diameter / 2 + (r − 1) × spacing between rows from the top edge.
- **FR-007**: Row 1 MUST stay at the top in every view and export; nothing flips.
- **FR-008**: Organs stored before this slice MUST load unchanged with an empty Guide margin; the stored Organ
  library gains a new version that carries the Guide margin.
- **FR-009**: The Guide margin MUST be validated wherever an Organ is read from untrusted data, like the other
  Tape Bed values.
- **FR-010a**: The 20er-Drehorgel Preset MUST fill a Guide margin of 10 mm and the 31er-Drehorgel Preset 11 mm.
- **FR-010**: All new texts MUST exist in English and German, using Guide margin / Führungsrand, Border / Rand, guide side / Führungsseite and far side / Gegenseite.

### Key Entities

- **Tape Bed**: gains an optional Guide margin; tape width, hole diameter and spacing between rows are unchanged.
- **Guide margin**: optional length on the Tape Bed, from the guide edge to the centre of row 1.
- **Border**: derived per side (guide side, far side) from the Tape Bed and the Organ's number of Pipes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a 110 mm Tape with a 10 mm Guide margin, row 1's Hole centres in the exported SVG lie 10 mm
  (± 0.01 mm) from the Tape's top edge.
- **SC-002**: Every Organ and Tape saved before this slice draws and exports byte-for-byte the same SVG as before.
- **SC-003**: The organ owner can copy a Guide margin from a gamma file into the Organ editor and save it in under
  one minute, with no other field changed.
- **SC-004**: A Tape cut for a 20er Organ with its real Guide margin plays on the organ without a row offset
  (hand check by the user).

## Assumptions

- The guide edge is always the top edge (decision 36); organs guided on the other edge are described by
  numbering their Pipes from that edge, not by a setting.
- The Guide margin is a plain length with the same precision and input rules as the other Tape Bed lengths.
- Tape pieces' angled cut keeps its point on the Tape's top edge; Joins and the Tape Outline do not depend on
  where the rows sit.
- Side-by-side cuts place each Lane's rows by its own Organ's Guide margin; Lane widths are the tape widths and
  do not change.
- Organs once made from a Preset are ordinary Organs; they are not updated (Presets fill new Organs only).
- MIDI import, Preview, Recording and Scores export do not depend on where rows sit across the Tape.
