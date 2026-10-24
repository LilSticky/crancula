# Feature Specification: Record a tape

**Feature Branch**: `009-record-a-tape`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Record a tape (#165, v0.2): save what Crank a tape plays as an audio file.
The whole Tape (first to last Column) at the Tape's Crank speed, using the same synthesised tone per Pipe
as the Preview (ADR 24; Holes without a Pipe on the Organ are silent). Formats WAV and MP3, chosen in a
save dialog. Only Organs with a Tape per Crank turn can record (as with Preview). Term: Record /
Aufnehmen; the file is a Recording / Aufnahme."

## Clarifications

### Decisions before specifying (user, 2026-10-25)

From [the discovery](../../documentation/discovery/later.md), section 1, decision 6, and the prompts of
2026-10-25:

- Q: Which audio formats? → A: WAV and MP3.
- Q: Which part of the Tape is recorded? → A: The whole Tape, first to last Column.
- Q: What are the action and the file called? → A: Record (German: Aufnehmen); the file is a Recording
  (German: Aufnahme). Dictionary entry proposed with this spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save the Tape as a Recording (Priority: P1)

The organ owner has a Tape that sounds right in the Preview and wants to keep or share how it sounds,
without the app: send it to a friend, listen on the phone, compare with the real Organ later. They
choose Record, pick where to save and the format, and get an audio file of the whole Tape at its Crank
speed, sounding as the Preview does.

**Why this priority**: it is the capability.

**Independent Test**: open a Tape with a few Holes, Record it as WAV, open the file in any audio
player; the notes play in the order and tempo of the Preview, and the file lasts as long as the
Preview of the whole Tape.

**Acceptance Scenarios**:

1. **Given** a Tape whose Organ has a Tape per Crank turn, **When** the owner chooses Record and a
   place and name in the save dialog, **Then** a Recording of the whole Tape at the Tape's Crank speed
   is written there, and the owner is told where it was saved.
2. **Given** the save dialog, **When** it opens, **Then** it proposes the Tape's name as the file name
   and offers WAV and MP3; the chosen format decides the file's type.
3. **Given** a Recording, **When** it is played, **Then** each Hole whose Pipe is on the Organ sounds
   that Pipe's note from its first to the end of its last Column, with the Preview's tone, and Holes
   without a Pipe on the Organ are silent.
4. **Given** a Tape at Crank speed S, **When** it is recorded, **Then** the Recording lasts as long as
   the Preview of the whole Tape at S (plus at most the tone's release at the end).
5. **Given** the owner cancels the save dialog, **When** it closes, **Then** nothing is written and
   nothing is reported as an error.
6. **Given** a Recording was saved, **When** the owner looks at the Tape, **Then** the Tape, its Holes,
   its Crank speed and the undo history are exactly as before.

---

### User Story 2 - Know when recording is not possible (Priority: P2)

The owner can't record a Tape whose Organ has no Tape per Crank turn, and is told why, the same way
the Preview tells them.

**Why this priority**: prevents a meaningless file; small once the Preview's rule exists.

**Independent Test**: open a Tape of an Organ without a Tape per Crank turn; Record is unavailable and
the reason with the way to the Organ editor is shown.

**Acceptance Scenarios**:

1. **Given** a Tape whose Organ has no Tape per Crank turn, **When** the owner looks for Record,
   **Then** it is unavailable and the Tape view says why and leads to the Organ editor, as for the
   Preview.
2. **Given** writing the file fails (no permission, disk full), **When** the save ends, **Then** the
   owner is told that the Recording could not be saved, and the Tape is unchanged.
3. **Given** the Preview plays, **When** the owner chooses Record, **Then** the Preview stops first
   (or Record is unavailable while it plays, chosen in the plan); a Recording never mixes with the
   Preview's sound.

### Edge Cases

- A Tape with no Holes, or only silent Holes: the Recording is silence of the Tape's length.
- The Lead-in is not recorded; the Recording starts at the first Column, as the Preview does.
- A Tape with Cutting Problems can be recorded: it plays as drawn, as in the Preview. (Only exporting
  for the Plotter needs a Tape without Cutting Problems.)
- Many Pipes at once: the Recording does not clip, as the Preview.
- A long Tape at a low Crank speed (e.g. 20 minutes): recording takes clearly less time than playing
  it would, and the owner sees that it is working; the app stays responsive.
- The computer has no sound output: recording works anyway; nothing is played aloud while recording.
- The chosen file already exists: the save dialog asks before replacing it, as for the SVG export.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The owner MUST be able to Record the open Tape from the Tape view.
- **FR-002**: A Recording MUST contain the whole Tape, from its first to its last Column, at the Tape's
  Crank speed, with the Column time of spec 007 FR-004; the Lead-in is not recorded.
- **FR-003**: A Recording MUST sound like the Preview: the same tone and pitch per Pipe, the same rule
  that Holes without a Pipe on the Organ are silent, and no clipping.
- **FR-004**: The owner MUST choose the place, name and format (WAV or MP3) in the system save dialog;
  the Tape's name is proposed as the file name.
- **FR-005**: A WAV Recording MUST be an uncompressed WAV file and an MP3 Recording an MP3 file that
  common players (system player, browsers, phones) open.
- **FR-006**: Cancelling the save dialog MUST write nothing and report nothing as an error; a failed
  write MUST be reported to the owner.
- **FR-007**: Recording MUST change nothing: no Hole, not the Crank speed, not the Organ, not the undo
  history.
- **FR-008**: Record MUST be unavailable for a Tape whose Organ has no Tape per Crank turn, with the
  same explanation and way to the Organ editor as the Preview.
- **FR-009**: Recording MUST NOT play sound aloud, and MUST take clearly less time than the Tape plays;
  while it runs the owner sees that it is working and the app stays responsive.
- **FR-010**: A Recording and the Preview MUST NOT run at the same time.
- **FR-011**: All new texts MUST exist in English and German.

### Key Entities

- **Recording** (proposed term): an audio file of a Tape played through at its Crank speed, as the
  Preview sounds; German: Aufnahme. Written once, never read back by Crancula.
- **Record** (proposed term): the action of saving a Recording; changes nothing; German: Aufnehmen.
- **Performance** (read model from spec 007): which Pipe sounds from when to when; the Recording is
  the performance of the whole Tape rendered to sound.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An owner saves a Recording of an open Tape in under 15 seconds of their own time
  (choose Record, confirm the dialog).
- **SC-002**: A Recording lasts the Tape's Columns × the Column time, within 1% (plus the final
  release).
- **SC-003**: A 5-minute Tape is recorded in under 30 seconds on the owner's computer.
- **SC-004**: 100% of Tapes and their undo histories are unchanged after recording.
- **SC-005**: WAV and MP3 Recordings open in the system's default player on Windows, macOS and Linux.

## Assumptions

- WAV is 16-bit PCM; sample rate, channels (mono is enough) and MP3 bit rate are chosen in the plan.
- The MP3 encoder is a library chosen in the plan (licence fitting the project); WAV needs none.
- Where Record sits (beside Export in the Tape view's page head, or in a menu) follows the design
  guide and is chosen in the plan.
- No metadata (title, artist tags) beyond what the format needs; tags may come later.
- Recording a part of the Tape, other formats, and choosing a Crank speed only for the Recording are
  out of scope.
