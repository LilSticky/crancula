# Feature Specification: Edit a tape by touch

**Feature Branch**: `008-edit-a-tape-by-touch`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: "Edit a tape by touch (slice 008, [#152](https://github.com/LilSticky/crancula/issues/152)):
tap selects a Spot, tapping the selected Spot adds a Hole of Minimum Hole Length, visible handles
outside the selected Hole, drag moves, double-tap removes, finger drag on empty Tape scrolls
(frame-select stays for mouse and pen), draggable playhead, Crank speed range per Organ (30–120 to
begin with, hard limits 1–300), slider plus number field with one undo step per finished slider
change."

## Clarifications

### Decisions before specifying (user, 2026-10-24, issue #152)

- Q: What does a tap on empty Tape do? → A: Selects a Spot (Pipe row + Column), drawn as the outline
  of the Hole that would be added; Add a Hole is prefilled from it.
- Q: Tapping the selected Spot again? → A: Adds a Hole there, Minimum Hole Length long, and selects it.
- Q: How is a selected Hole lengthened or shortened? → A: Visible handles outside the Hole, left and right.
- Q: Moving a Hole? → A: Drag it, as today.
- Q: Removing a Hole? → A: Double-tap it (one undo step).
- Q: Finger drag on empty Tape? → A: Scrolls the Tape; frame-select stays for mouse and pen.
- Q: Playhead? → A: Can be dragged; while playing, the sound pauses during the drag and goes on from the drop.
- Q: Crank speed range? → A: Per Organ, slowest and fastest; 30–120 turns per minute for new and older
  Organs; the hard limits stay 1–300.
- Q: A Tape's Crank speed outside the range? → A: Kept and played; the slider sits at the nearest end
  with a hint.
- Q: Speed control? → A: A slider plus the existing number field; each finished slider change is one
  undo step.
- Q: Scope? → A: Its own slice with Spec Kit.
- Terms approved for DICTIONARY.md: **Spot** (de *Stelle*); **Crank speed range** (de *Kurbelbereich*)
  with **Slowest / Fastest Crank speed** (de *langsamste / schnellste Kurbelgeschwindigkeit*).
- Language: "add a Hole" and "remove a Hole", never "punch" (Punch means cutting the physical Tape).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a Hole by tapping (Priority: P1)

The organ owner edits a Tape on a touch screen. They tap an empty place on the Tape; it becomes the
selected Spot and shows the outline of the Hole that would go there. They tap it again and the Hole is
there. A mouse works the same way: one click selects the Spot, a second click (or a double-click) adds.

**Why this priority**: without a way to add Holes by finger the Tape can't be edited by touch at all.

**Independent Test**: on a Tape, tap an empty Column of a Pipe's row, see the outline; tap again; a
Hole of Minimum Hole Length is there, selected, and survives a restart.

**Acceptance Scenarios**:

1. **Given** a Tape in the Tape view, **When** the owner taps an empty place, **Then** that Pipe's row
   and Column become the selected Spot, drawn as the outline of a Hole of Minimum Hole Length, and any
   Hole selection is cleared.
2. **Given** a selected Spot, **When** the owner taps it again, **Then** a Hole of Minimum Hole Length
   is added there as one undo step and is selected; the Spot is gone.
3. **Given** a selected Spot, **When** the owner taps another empty place, **Then** that becomes the
   selected Spot and nothing is added.
4. **Given** a selected Spot, **When** the owner opens Add a Hole, **Then** its Pipe and Column are
   filled in from the Spot.
5. **Given** a selected Spot and no selected Hole, **When** the owner uses the arrow keys, **Then** the
   Spot moves by one Column or one row; **When** they press Enter, **Then** a Hole is added at the Spot.
6. **Given** a Hole was just added by a tap, **When** the owner taps it once more quickly, **Then** it
   stays (a tap that added a Hole never counts as the first tap of a double-tap).

---

### User Story 2 - Change a Hole by touch (Priority: P1)

The owner selects a Hole with a tap. Grips appear beside its two ends, outside the Hole, big enough
for a finger. Dragging a grip lengthens or shortens the Hole at that end; dragging the Hole moves it;
a double-tap removes it.

**Why this priority**: moving, resizing and removing are the rest of Edit a tape; today the handles sit
inside the Hole and are too small for a finger, and removing needs the Delete key.

**Independent Test**: select a Hole by tap, drag its right grip two Columns to the right (the Hole is
two Columns longer), drag the Hole one row down (it moves to the next Pipe), double-tap it (it is gone);
three undo steps bring it back.

**Acceptance Scenarios**:

1. **Given** a selected Hole, **When** the owner looks at it, **Then** a grip shows beside each end,
   outside the Hole, and each grip can be hit by a finger (at least 44 × 44 px).
2. **Given** a selected Hole, **When** the owner drags a grip, **Then** the Hole gets longer or shorter
   at that end by whole Columns, as one undo step, with the same limits as resizing today.
3. **Given** a Hole, **When** the owner drags anywhere on it, **Then** it moves (Pipe and Column), as
   one undo step, as today.
4. **Given** a Hole, **When** the owner taps it twice in quick succession on the same Hole, **Then** it
   is removed as one undo step, and the selection moves as it does after Delete.
5. **Given** a very short Hole (narrower on screen than a finger), **When** it is selected, **Then** both
   grips are still separate and reachable, and dragging the Hole itself still moves it.

---

### User Story 3 - Scroll the Tape with a finger (Priority: P2)

On a touch screen, dragging a finger over empty Tape scrolls the Tape, as in any other touch app.
With a mouse or pen, the same drag still draws a selection frame.

**Why this priority**: a long Tape is unusable by touch if it can't be scrolled; small once tapping works.

**Independent Test**: on a Tape longer than the window, drag a finger left on empty Tape; the Tape
scrolls and no frame appears. Drag the mouse there; a frame selects the Holes inside.

**Acceptance Scenarios**:

1. **Given** a Tape longer than the view, **When** the owner drags a finger over empty Tape, **Then**
   the Tape scrolls, no selection frame is drawn and no Spot is selected.
2. **Given** a Hole or a grip, **When** the owner drags it with a finger, **Then** the Hole moves or
   resizes and the Tape does not scroll.
3. **Given** a mouse or a pen, **When** the owner drags over empty Tape, **Then** a selection frame
   selects the Holes inside, as today.

---

### User Story 4 - Drag the playhead (Priority: P2)

The owner wants to hear a passage again or skip ahead. They drag the playhead along the ruler to a
Column. If the Preview was playing, the sound pauses while they drag and goes on from where they let go.

**Why this priority**: the ruler tap already sets the start Column; dragging makes it usable by finger
and while playing.

**Independent Test**: start the Preview, drag the playhead to Column 100 and let go; the sound stops
during the drag and goes on with the Holes at Column 100.

**Acceptance Scenarios**:

1. **Given** the Preview is stopped, **When** the owner drags the playhead and lets go, **Then** the
   playhead snaps to the nearest Column and the next Preview starts there.
2. **Given** the Preview plays, **When** the owner starts dragging the playhead, **Then** the sound
   pauses; **When** they let go, **Then** the Preview goes on from that Column.
3. **Given** a drag of the playhead, **When** it is done, **Then** the Tape and the undo history are
   unchanged.

---

### User Story 5 - A Crank speed range for each Organ (Priority: P2)

The owner says how slow and how fast their Organ is meant to be cranked. In the Tape view a slider
from the slowest to the fastest Crank speed sits beside the Crank speed field, so the tempo can be
changed by finger.

**Why this priority**: the number field is awkward by touch; the range keeps the slider to speeds that
make sense for the Organ.

**Independent Test**: set an Organ's range to 40–90; in a Tape of that Organ the slider runs from 40
to 90; slide it to 70 and let go; the Crank speed is 70; Ctrl+Z brings back the old one.

**Acceptance Scenarios**:

1. **Given** the Organ editor, **When** the owner enters a Slowest and a Fastest Crank speed, **Then**
   they are kept with the Organ across restarts.
2. **Given** an Organ saved before this slice, or a new Organ, **When** it is opened, **Then** its
   Crank speed range is 30–120 turns per minute.
3. **Given** a Slowest Crank speed not below the Fastest, or either outside 1–300, **When** the owner
   saves, **Then** the Organ is not saved and the editor says why.
4. **Given** the Tape view, **When** the owner moves the slider, **Then** the tempo follows while
   dragging (also while the Preview plays), and letting go makes it one Crank speed change, one undo step.
5. **Given** a Tape whose Crank speed lies outside its Organ's range, **When** it is opened, **Then**
   the Crank speed is kept and played, the slider sits at the nearest end of the range and a hint says
   the Crank speed is outside the Organ's range.
6. **Given** the number field, **When** the owner enters any Crank speed from 1 to 300, **Then** it is
   accepted as today, inside the range or not.

### Edge Cases

- A tap on a Spot whose Hole would overlap or come too close to the next Hole in its row: the Hole is
  added as with Add a Hole today, and any Cutting Problem is marked.
- A Spot after the Tape's last Column: the Hole is added and the Tape grows, as with Add a Hole today.
- A tap on the Lead-in or outside the rows: no Spot is selected; the Spot selection is cleared.
- While the Preview plays: a tap may select a Spot or a Hole, but adding, moving, resizing and removing
  are refused, as every edit is (spec 007, FR-010).
- A double-tap that lands on two different Holes is two single taps (selects the second).
- Two fingers at once (pinch): nothing is edited; zooming by pinch is out of scope.
- A touch drag that the system takes over as a scroll cancels any drag that had begun; nothing changes.
- Changing the Organ's range doesn't change any Tape's Crank speed.
- The Organ changes while its Tape is open in another view: the slider follows the new range on the
  next opening at the latest.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A tap or click on an empty place in a Pipe's row MUST select that Spot (Pipe and Column),
  clear the Hole selection and draw the outline of a Hole of Minimum Hole Length there.
- **FR-002**: A tap or click on the selected Spot, a double-click on an empty place, or Enter with a
  selected Spot MUST add a Hole of Minimum Hole Length there as one undo step and select it.
- **FR-003**: The Spot selection and the Hole selection MUST be exclusive; selecting one clears the other.
- **FR-004**: Add a Hole MUST be prefilled from the selected Spot; the arrow keys MUST move the Spot
  when no Hole is selected.
- **FR-005**: A selected Hole MUST show a grip beside each end, outside the Hole, with a hit area of at
  least 44 × 44 px; dragging a grip changes the Hole's length at that end as one undo step.
- **FR-006**: A drag anywhere on a Hole MUST move it as one undo step.
- **FR-007**: Two taps on the same Hole within a short time (about 400 ms) MUST remove it as one undo
  step; a tap that added a Hole MUST NOT count as the first of these.
- **FR-008**: A finger drag over empty Tape MUST scroll the Tape and draw no frame; a mouse or pen drag
  there MUST draw the selection frame as today.
- **FR-009**: The playhead MUST be draggable along the ruler by finger and mouse, snapping to Columns; a
  drag while the Preview plays MUST pause the sound and go on from the drop.
- **FR-010**: An Organ MUST have a Crank speed range: a Slowest and a Fastest Crank speed, each from 1
  to 300 turns per minute, Slowest below Fastest, edited in the Organ editor and kept across restarts.
- **FR-011**: Organs saved before this slice MUST load with the range 30–120; new Organs MUST start with it.
- **FR-012**: The Tape view MUST offer a Crank speed slider from the Organ's Slowest to its Fastest
  Crank speed beside the number field; the tempo follows while dragging, and each finished slider
  change MUST be one Crank speed change and one undo step.
- **FR-013**: The number field MUST keep accepting 1–300; a Crank speed outside the range MUST be kept
  and played, with the slider at the nearest end and a hint.
- **FR-014**: Every gesture MUST keep a keyboard equivalent (spec 004), and every new text MUST exist in
  English and German.

### Key Entities

- **Spot**: a Pipe and a Column without a Hole, selected in the Tape view; not stored, not part of the Tape.
- **Organ** (changed): gains a Crank speed range, its Slowest and Fastest Crank speed.
- **Tape** (unchanged): keeps its Crank speed; the range never changes it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a touch screen, with no keyboard or mouse, the owner can add, move, lengthen, shorten
  and remove a Hole, scroll the Tape and change the Crank speed.
- **SC-002**: Adding a Hole at an empty place takes two taps.
- **SC-003**: Every grip and Hole the owner needs to hit has a touch target of at least 44 × 44 px.
- **SC-004**: Each finished gesture that changes the Tape is exactly one undo step.
- **SC-005**: Existing mouse and keyboard editing (spec 004) keeps working; its tests stay green.

## Assumptions

- Touch screens on Windows are the target; macOS has no touch screens and uses the mouse paths.
- The double-tap time is a fixed constant (about 400 ms), since the system's double-click time can't
  be read from the app.
- Pen input behaves like the mouse.
- Pinch zoom and long-press menus are out of scope.
- The 30–120 default range is a reasonable span for hand-cranked barrel Organs; the owner can change it.
- The pointer rules of spec 004 (`contracts/tape-view-ui.md`) are superseded by this slice's contract.
