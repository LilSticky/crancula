# Quickstart: Crank a tape

## Automated

- `npm run test:node`: `api/tape/crank-speed`, `change-crank-speed`, `api/preview/performance`, organ and
  tape snapshot migration specs.
- `npm run test`: `TapePreview` (fake sound and clock: start, stop, end, speed change re-anchors, start
  Column), Preview section, Organ editor field, Tape view guards while playing.
- `npm run e2e -- tape-preview organ-tape-per-crank-turn`: play/stop, playhead moves and stops at the
  end, editing paused, Crank speed kept after restart and undoable, version 3 `organs.json` loads
  without Tape per Crank turn and shows the unavailable notice.

## By hand (`npm start`)

1. Organ editor: set Tape per Crank turn to 100 mm, save.
2. Import a MIDI Song onto a Tape (Column length 5 mm). The Preview section shows Crank speed 60 and
   the Tape's length in m:ss (Columns × 0.05 s).
3. Press Space: notes sound, the playhead moves, "Editing is paused" shows; dragging a Hole does nothing.
4. Change the Crank speed to 120 and press Enter while playing: the tempo doubles without a gap.
5. Click the ruler mid-Tape while stopped, press Space: playback starts there.
6. Restart: the Tape opens with Crank speed 120; Undo brings back 60.
