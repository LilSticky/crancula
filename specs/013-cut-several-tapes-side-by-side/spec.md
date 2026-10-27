# Feature Specification: Cut several tapes side by side

**Feature Branch**: `013-cut-several-tapes-side-by-side`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Cut several tapes side by side (#170). The organ owner picks several Tapes in
the Tape library (copies allowed, any Organs and tape widths), a roll plotter, orders the Lanes, and saves
one SVG with one Tape per Lane, Tape spacing (set on the roll plotter, default 3 mm) apart. A Tape that
would exceed the working width can't be added (remaining width shown); a Tape with Cutting Problems blocks
the export and is named. Roll plotters only. Nothing stored; no Tape changes."

## Clarifications

### Decisions before specifying (user, 2026-10-27)

From [the discovery](../../documentation/discovery/later.md), section 5, decisions 29–34:

- Q: Which Tapes may share a cut? → A: Any Tapes, from any Organ and with mixed tape widths, as long as
  they fit the working width. The same Tape may be added more than once (decision 29).
- Q: How are they arranged across the working width? → A: One Tape per Lane, in the order the user picks
  and can change; no automatic packing. The cut is as long as the longest Tape (decision 30).
- Q: What lies between neighbouring Tapes? → A: A Tape spacing set on the roll plotter, default 3 mm, the
  same between all Lanes; no shared cut lines (decision 31).
- Q: What if they don't fit, or a Tape can't be cut? → A: A Tape that would exceed the working width
  can't be added, and the remaining width is shown. A Tape with Cutting Problems blocks the export and is
  named (decision 32).
- Q: Sheet plotters too? → A: Roll plotters only; sheet plotters keep one Tape or Tape piece per file.
  The result is one SVG (decision 33).
- Q: Is the arrangement kept? → A: No. It is chosen at export (Tapes picked in the Tape library, a roll
  plotter, the Lane order); nothing is stored, no new aggregate (decision 34).
- Terms approved for DICTIONARY.md: Lane (Bahn), Tape spacing (Bandabstand); Plotter and Tape Outline
  mention side-by-side cuts.

## User Scenarios & Testing *(mandatory)*

The worked examples use the reference Organ of spec 003 (tape width 100 mm, Lead-in 50 mm, Minimum Gap
2 mm) with the reference Tape on it (Column length 3 mm, 200 Columns, 652 mm long), a second Organ with
tape width 60 mm and a Tape "Waltz" on it 400 mm long, and a roll plotter "Vinyl cutter" with working
width 300 mm and the default Tape spacing of 3 mm.

Across the working width, Lane 1 is at the top of the file, as row 1 is at the top of a Tape.

### User Story 1 - Cut several tapes in one pass (Priority: P1)

I have several Tapes to cut and a vinyl cutter wider than one Tape. In the Tape library I pick the Tapes,
choose "Cut side by side", pick my roll plotter and save one SVG. The cutter cuts all of them in one pass
over the roll, each in its own Lane, Tape spacing apart, and I peel them off separately.

**Why this priority**: it is the capability; today each Tape is its own file and its own pass, and the
roll's width beside a narrow Tape is wasted.

**Independent Test**: pick the reference Tape and "Waltz" with the Vinyl cutter, save, and compare the
file with the expected geometry.

**Acceptance Scenarios**:

1. **Given** the reference Tape and "Waltz" picked in that order with the Vinyl cutter, **When** I save,
   **Then** one SVG file is written, 652 mm long (the longest Tape) and 163 mm wide (100 + 3 + 60), with
   the reference Tape in Lane 1 from 0 to 100 mm across and "Waltz" in Lane 2 from 103 to 163 mm.
2. **Given** a Lane, **Then** its Tape is cut exactly as its single-Tape export (spec 003), only moved
   across the width: same Holes, same Lead-in, same Tape Outline, its Lead-in's tip at the file's left edge.
3. **Given** the file, **Then** it holds only cuts, Lane by Lane: all Holes of the Tape in Lane 1, then its
   Tape Outline, then the Holes and Tape Outline of Lane 2, and so on.
4. **Given** I save, **Then** the save dialog of spec 003 opens, proposing "<first Tape's name> and
   <N> more.svg"; **When** I confirm, **Then** I'm told where the file was saved.
5. **Given** I saved, **Then** no Tape, Organ or Plotter has changed and nothing about the arrangement is
   kept.

---

### User Story 2 - Arrange the lanes (Priority: P1)

Before I save, I see the Lanes in order with each Tape's name, its Organ, its width and length, and the
working width still free. I add Tapes, remove them, add the same Tape again for a spare copy, and move a
Lane up or down.

**Why this priority**: the user decides the order (decision 30) and needs to see what still fits; without
it, Story 1 can't be steered.

**Independent Test**: start with the reference Tape, add "Waltz", add the reference Tape again, see the
third refused with the free width shown, move "Waltz" to Lane 1.

**Acceptance Scenarios**:

1. **Given** the reference Tape in Lane 1 and the Vinyl cutter, **Then** 200 mm of the working width is
   shown as free (300 − 100).
2. **Given** the reference Tape and "Waltz", **Then** 137 mm is free (300 − 100 − 3 − 60); **When** I add
   the reference Tape again (it needs 103 mm more), **Then** it fits and 34 mm is free; **When**
   I try to add a third 100 mm Tape, **Then** it can't be added and I'm told it needs 103 mm with only
   34 mm free.
3. **Given** a Tape already in a Lane, **When** I add it again, **Then** it gets a Lane of its own and is
   cut twice.
4. **Given** several Lanes, **When** I move one up or down or remove it, **Then** the Lanes are
   renumbered and the free width is updated at once.
5. **Given** fewer than two Lanes, **Then** I can still save; one Lane is cut like a single-Tape export
   (spec 003).

---

### User Story 3 - Know why the tapes can't be cut together (Priority: P1)

If one of my Tapes can't be cut (for example a Hole too close to another), or a Tape's Organ is missing,
Crancula tells me which Tape and why before anything is written.

**Why this priority**: punching is irreversible; one bad Lane would spoil a whole pass of vinyl.

**Independent Test**: give "Waltz" a Cutting Problem, pick it with the reference Tape, try to save and see
the refusal naming "Waltz" and its Cutting Problem; fix it and save.

**Acceptance Scenarios**:

1. **Given** a Lane whose Tape has a Cutting Problem (spec 003 or 004), **When** I try to save, **Then**
   it is refused, no dialog opens, and every such Tape is named with its Cutting Problems.
2. **Given** such a Lane, **Then** it is marked in the Lane list before I try to save.
3. **Given** a Tape whose Organ no longer exists, **Then** it can't be added, and I'm told it has no
   Organ.
4. **Given** a single Tape wider than the working width, **Then** it can't be added, as in spec 011.

---

### User Story 4 - Set the tape spacing (Priority: P2)

My cutter's blade needs a little room between two Tapes. I set the Tape spacing on my roll plotter once,
and every side-by-side cut on it uses it.

**Why this priority**: the default works for most cutters; changing it is rare.

**Independent Test**: set the Vinyl cutter's Tape spacing to 5 mm, cut the reference Tape and "Waltz"
side by side and see "Waltz" from 105 to 165 mm.

**Acceptance Scenarios**:

1. **Given** I describe a roll plotter, **Then** it asks for a Tape spacing, 3 mm unless I change it.
2. **Given** a Tape spacing below 0 or not a number, **Then** the Plotter can't be saved and the message
   names the field; 0 is allowed (Tapes touch, each with its own Tape Outline).
3. **Given** a sheet plotter, **Then** no Tape spacing is asked for.
4. **Given** a Plotter saved before this slice, **When** the app starts, **Then** a roll plotter has the
   Tape spacing 3 mm and nothing else changes.
5. **Given** I change the Tape spacing, **Then** it is kept across restarts.

---

### User Story 5 - Pick only a roll plotter (Priority: P2)

Only roll plotters can cut side by side. If I have none, Crancula tells me and links to the Plotter
editor.

**Why this priority**: keeps sheet plotters out (decision 33) and guides the first-time user.

**Acceptance Scenarios**:

1. **Given** the Plotter picker of the side-by-side cut, **Then** it lists only roll plotters, and the
   roll plotter picked in the Tape view (spec 011) is chosen first if there is one.
2. **Given** no roll plotter is described, **Then** I'm told so and offered "Describe a Plotter…".
3. **Given** I pick another roll plotter, **Then** the free width is computed again, and Lanes that no
   longer fit are marked and block saving until I remove them.

---

### User Story 6 - Use it in German or English (Priority: P3)

All texts of this feature are available in German and English, and the proposed file name follows the
app's language ("and 2 more" / "und 2 weitere").

**Acceptance Scenarios**:

1. **Given** the app is set to German, **When** I walk through Stories 1–5, **Then** all labels and
   messages are German.

---

### Edge Cases

- **Tapes of different lengths**: each Lane ends at its own Tape's end cut; the file is as long as the
  longest Tape, and the rest of a shorter Lane is left uncut.
- **Exactly fitting**: Tapes plus spacings that equal the working width fit.
- **A Tape that would need Tape pieces on a sheet plotter**: irrelevant here; a roll plotter never splits
  a Tape (spec 011).
- **The same Tape twice**: two Lanes, identical cuts, each with its own Tape Outline.
- **A Tape or Organ changes, or a Tape is removed, while I arrange the Lanes**: the Lanes follow at once;
  a removed Tape's Lanes disappear.
- **The picked roll plotter is removed or becomes a sheet plotter**: no Plotter is picked; saving is
  blocked until I pick one.
- **Holes whose Pipe is not on the Organ**: not cut, and still a Cutting Problem, as in spec 003.
- **A Tape name with characters not allowed in file names**: replaced in the proposed name, as in
  spec 003.
- **Cancelling the save dialog**: nothing is written, no message is shown.
- **Writing fails**: I'm told why, as far as known; I can try again.
- **The Preview plays**: the side-by-side cut changes no Tape, so it is allowed.

## Requirements *(mandatory)*

### Functional Requirements

#### Tape spacing

- **FR-001**: A roll plotter MUST have a Tape spacing in mm, a finite number of 0 or more, 3 mm unless
  changed; a sheet plotter has none. Decimals accept a comma or a point; an invalid value names the field.
- **FR-002**: Roll plotters stored before this slice MUST get a Tape spacing of 3 mm when loaded; nothing
  else changes.

#### Choosing the Lanes

- **FR-003**: Users MUST be able to start a side-by-side cut from the Tape library with one or more Tapes
  picked, and add or remove Tapes there afterwards.
- **FR-004**: Each Lane MUST hold one Tape; the same Tape MAY be in several Lanes. Users MUST be able to
  move a Lane up or down and remove it.
- **FR-005**: Only roll plotters MUST be offered. The roll plotter picked in the Tape view (spec 011), if
  any, MUST be chosen first. Without a roll plotter, the user MUST be told so and offered "Describe a
  Plotter…".
- **FR-006**: The used width MUST be the sum of the Lanes' tape widths plus the Tape spacing between
  neighbouring Lanes; the free width is the working width minus the used width, shown at once after every
  change.
- **FR-007**: A Tape MUST NOT be added when the used width with it would exceed the working width; the
  user MUST be told the width it needs and the free width. A Tape without an Organ MUST NOT be added.
- **FR-008**: Each Lane MUST show its number, the Tape's name, its Organ, its tape width and its length,
  and be marked when its Tape has a Cutting Problem or no longer fits.

#### The cut

- **FR-009**: Lane 1 MUST lie at the top edge of the file; each next Lane MUST start one Tape spacing
  below the previous Lane's far edge.
- **FR-010**: Each Lane MUST be its Tape's own geometry (spec 003), moved across the width only: same
  Holes, Lead-in, end cut and Tape Outline, its Lead-in's tip at the file's left edge.
- **FR-011**: The file MUST be in true size, 1:1 in millimetres, its document size the longest Tape's
  length by the used width, and MUST hold only cuts, Lane by Lane: all Holes of a Lane in the order of
  spec 003, then its Tape Outline, then the next Lane.
- **FR-012**: Lane geometry MUST be computed from the same geometry as the Tape view and the export of
  spec 003, so every Hole has the same size as there.

#### Saving

- **FR-013**: Saving MUST be refused, with every reason listed and no dialog opened, when no roll plotter
  is picked, when no Lane exists, when a Lane no longer fits, or when any Lane's Tape has a Cutting
  Problem; each such Tape MUST be named with its Cutting Problems.
- **FR-014**: Saving MUST use the save dialog of spec 003, proposing "<first Tape's name> and <N>
  more.svg" in the app's language (just "<Tape name>.svg" for one Lane), with characters the file system
  doesn't allow replaced. The user MUST be told where the file was saved; cancelling writes nothing; a
  failed write is reported with its reason, as far as known.
- **FR-015**: Saving MUST NOT change any Tape, Organ or Plotter, and the Lanes MUST NOT be stored.

#### Language

- **FR-016**: All new texts MUST exist in English and German.

### Key Entities

- **Lane**: the strip of a roll plotter's working width one Tape takes in a side-by-side cut; derived at
  export, never stored. Holds a Tape and its position across the width.
- **Tape spacing**: the blank strip between two Lanes, a value of a roll plotter (default 3 mm).
- **Plotter**: a roll plotter gains the Tape spacing; otherwise unchanged.
- **Tape**, **Organ**: unchanged; a side-by-side cut only reads them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An organ owner picks three Tapes, arranges them and saves the file in under 1 minute.
- **SC-002**: For reference Tapes, 100% of Holes and every corner of every Lane's Tape Outline are within
  0.01 mm of the single-Tape export, moved by the Lane's offset.
- **SC-003**: In 100% of saved files, the used width does not exceed the working width and neighbouring
  Tape Outlines are exactly one Tape spacing apart.
- **SC-004**: 0 files are written when a Lane's Tape has a Cutting Problem or a Lane doesn't fit, and 100%
  of the reasons name the Tape.
- **SC-005**: The free width updates within 0.2 s of adding, removing or moving a Lane.
- **SC-006**: Every text of the feature is shown in the selected language, with no untranslated keys.

## Assumptions

- **Entry point**: the Tape library gets a way to pick several Tapes and start a side-by-side cut; the
  exact screen (dialog or page) is a plan decision, checked by `/speckit-clarify`.
- **Plotter snapshot**: adding the Tape spacing to roll plotters is a new Plotter snapshot version with a
  migration (ADR 20).
- **Lane order across the width**: Lane 1 at the top, matching row 1 at the top of the Tape view and the
  single-Tape export.
- **No alignment options**: every Lane starts at the file's left edge; no centring, staggering or
  rotating.
- **One file**: a side-by-side cut never makes several files; a selection that doesn't fit is refused
  rather than split (decision 32).
- **Out of scope**: sheet plotters (decision 33), automatic packing and several Tapes one after another in
  one Lane (decision 30), shared cut lines (decision 31), keeping an arrangement (decision 34), marks or
  names cut on the Tape, DXF and HPGL.
- **Prototype code**: existing code is a quarry; this slice may replace it.
