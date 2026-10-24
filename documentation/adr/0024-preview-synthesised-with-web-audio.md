# 24. Preview synthesised with Web Audio in the renderer

Date: 2026-10-23

## Status

Accepted

## Context

Crank a tape (#149) lets the owner hear a Tape before it is cut: a Preview at a Crank speed they can
change while it plays, with a playhead in the Tape view that keeps step with the sound. The user decided
on one simple synthesised organ-like tone per Pipe and no sound files. The domain (ADR 2) may not touch
audio, and the renderer's unit tests run in jsdom, which has no Web Audio. The renderer talks to the
main process only through a typed preload API (ADR 4).

## Decision

We will split the Preview into a pure read model and a renderer adapter:

- `api/preview/performance.ts` gives the notes to play in Columns (`performance(tape, organ)`) and the
  seconds per Column (`columnDuration(tape, organ)`, from the Column length, the Organ's Tape per Crank
  turn and the Tape's Crank speed). Nothing is stored.
- The renderer plays it with the Web Audio API behind a `PreviewSound` port provided by an injection
  token. A look-ahead scheduler on the audio clock (25 ms tick, 100 ms window) starts and stops voices;
  a Crank speed change re-anchors the clock at the playhead, so the tempo changes without a restart.
  The playhead reads the same clock every animation frame.
- The tone is three sine harmonics with a short attack and release, through a master gain and a
  compressor so that many Pipes at once do not clip.
- No IPC, no audio in the main process, no new package.

## Consequences

- The scheduler and the playhead are tested in jsdom with a fake port and a controllable clock; the
  read model in node.
- E2e tests check the playhead and paused editing, not the sound itself.
- Record a tape can reuse the same voice graph with an `OfflineAudioContext` or a `MediaRecorder`.
- Without a sound device the Preview runs the playhead on a fallback clock and stays silent.
- Rejected: audio in the main process (a native module and IPC for no gain), sampled Pipes (no sound
  files, user decision), scheduling every note up front (no live Crank speed change).
- Details: [research R3–R6](../../specs/007-crank-a-tape/research.md).
