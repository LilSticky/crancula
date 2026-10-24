# Research: Crank a tape

## R1. Starting Crank speed and limits

- **Decision**: 60 turns per minute for new Tapes and for Tapes from a version 1 snapshot; the field
  accepts 1 to 300 (decimals allowed).
- **Rationale**: one turn per second is a common, comfortable cranking pace for hand-cranked organs;
  1–300 covers anything a hand can turn and keeps the scheduler away from zero or absurd rates.
- **Alternatives**: a value derived from the MIDI tempo at import (the spec keeps the Song's tempo out;
  the Tape holds only its Crank speed); no limits (0.001/min Previews last days).

## R2. Tape per Crank turn for old and new Organs

- **Decision**: `Organ.tapePerCrankTurn` is optional (`Millimetres` above 0 or absent). Snapshots ≤ 3
  load without it; version 4 writes it when present. The editor field may be left empty; then the
  Preview is unavailable and says why.
- **Rationale**: user decision (spec, Session 2026-10-23): no made-up value. Making it required for new
  Organs would need two Organ shapes; one optional field keeps the type simple and the rule in one place
  (`previewAvailability`).
- **Alternatives**: required for new Organs only; a default of 100 mm (rejected by the user).

## R3. Read model in Columns, time applied by the player

- **Decision**: `performance(tape, organ)` returns notes `{pipe, startColumn, endColumn}` sorted by
  start; Holes whose Pipe is not on the Organ are left out; Holes in the same row that touch are joined
  into one note. `columnDuration(tape, organ)` = `columnLength / (tapePerCrankTurn × crankSpeed / 60)`
  seconds, or `undefined` when the Organ has no Tape per Crank turn.
- **Rationale**: Columns don't change with the speed, so a speed change while playing needs no new
  performance, only a new rate from the playhead on. Pure, cheap to test in node.
- **Alternatives**: a performance in seconds (must be rebuilt and re-anchored on every speed change).

## R4. Scheduling and the clock

- **Decision**: a look-ahead scheduler (tick every 25 ms, schedules notes starting within the next
  100 ms) anchored to the audio clock: `column(t) = anchorColumn + (t − anchorTime) / columnDuration`.
  A speed change re-anchors at the current time and column; notes already sounding get their release
  re-scheduled at the new rate. The playhead reads the same clock each animation frame. If no audio
  output can be created, a `performance.now()` clock drives the playhead and nothing sounds.
- **Rationale**: the standard Web Audio pattern ("A tale of two clocks"); keeps sound and playhead on
  one clock (SC-002) and makes speed changes audible within one window (SC-005).
- **Alternatives**: scheduling every note up front (cannot change speed without a gap); `setTimeout`
  per note (drifts, janky when the window is in the background).

## R5. The tone

- **Decision**: per note, three sine oscillators (fundamental, 2nd at 0.5, 3rd at 0.25 gain) into a
  gain envelope (15 ms attack, 30 ms release); all voices into a master gain of 0.2 and a
  `DynamicsCompressorNode` to avoid clipping when many Pipes sound. Pitch: equal temperament,
  A4 (MIDI 69) = 440 Hz.
- **Rationale**: a flue-pipe-like tone with no sound files (user decision 4); the compressor covers the
  "every Pipe at once" edge case.
- **Alternatives**: `PeriodicWave` (fine too, less readable), sampled pipes (rejected: no sound files).

## R6. Port and adapter

- **Decision**: `PreviewSound` port in `src/` (`now()`, `start(pipe, at)`, `stop(voice, at)`,
  `resume()`, `close()`), provided by a `PREVIEW_SOUND` factory token; `WebAudioPreviewSound` is the
  default; specs provide a fake that records calls and a controllable clock.
- **Rationale**: jsdom has no Web Audio; the player's logic is tested without it. Same pattern as the
  platform token.
- **Alternatives**: audio in the main process (needs IPC and a native module; no benefit).

## R7. Paused editing

- **Decision**: the Tape view exposes `editingPaused = preview.playing()`. While true: pointer and
  keyboard edit handlers return early, the edit buttons (Undo, Redo, Transpose, Add a Hole, Remove,
  Column length Apply) are disabled, the `EditCommandRouter` handler ignores menu Undo/Redo, and a
  status text says editing is paused. The Crank speed field stays enabled; its change goes through
  `TapeEditor.apply` (one undo step, saved). Export stays possible.
- **Rationale**: one signal guards every path; the Crank speed is the only Tape value allowed to change
  while playing (spec FR-014).

## R8. Start Column and the playhead

- **Decision**: clicking the ruler (or the overview) sets the start Column (rounded down) and moves
  the playhead there when stopped; the Preview section has a "Start at Column" number field (1-based in
  the UI, 0-based in code). Play starts from the playhead; at the end the playhead stays; Play at the
  end starts again from Column 1. The view scrolls to keep the playhead visible unless the owner
  scrolled in the last 2 seconds.
- **Rationale**: matches the spec's scenarios and keeps keyboard access (field) beside pointer access
  (ruler).

## R9. Controls placement and shortcut

- **Decision**: a Play/Stop icon button in the Tape view toolbar (before Undo) and a "Preview" section
  in the side panel (Crank speed with Apply/Enter, start Column, "plays for m:ss"). Space toggles the
  Preview when focus is in the Tape view and not in a text field or button.
- **Rationale**: the toolbar holds the view's actions; the side panel holds editable values, like the
  Column length (spec 006). Space is the common play shortcut and unused in the Tape view.
