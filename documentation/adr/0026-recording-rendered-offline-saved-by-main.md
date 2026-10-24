# 26. Recording rendered offline in the renderer, saved by the main process

Date: 2026-10-25

## Status

Accepted

## Context

Record a tape (#165) saves the whole Tape at its Crank speed as a Recording, WAV or MP3 (user decisions
of 2026-10-25), and it must sound like the Preview, play nothing aloud and be faster than real time.
The Preview's tone lives in the renderer as a Web Audio voice graph (ADR 24). The domain may not touch
audio or files (ADR 2), and the renderer may not name paths or write files (ADR 4). Every practical MP3
encoder is LAME or Shine, both LGPL; the app is MIT. Details: `specs/009-record-a-tape/research.md`.

## Decision

- We will extract the Preview's voice graph into `preview-voices.ts`, usable on any `BaseAudioContext`,
  and render the Recording with it in a mono 44.1 kHz `OfflineAudioContext`, scheduling voices window by
  window with `suspend`/`resume`. The Preview and the Recording share one tone.
- We will write WAV (16-bit PCM) with a pure writer in `api/recording/`.
- We will encode MP3 (128 kbit/s) with `@breezystack/lamejs` (LGPL-3.0) in a Web Worker, loaded lazily
  as its own unmodified chunk and listed in the third-party notices.
- We will save in two IPC calls: `recording:choose-file` shows the save dialog in the main process and
  returns a single-use target id and the format from the chosen extension; `recording:write-file` takes
  the target and the bytes, checks the format's magic bytes and size, and writes. The path never leaves
  the main process.

## Consequences

- The Recording sounds like the Preview by construction; a tone change reaches both.
- The offline renderer can't run in jsdom: it sits behind a port; scheduling is a pure function tested
  in node, the adapter is proven in e2e by the WAV's length and peak.
- One LGPL dependency, which must stay a separate, replaceable chunk; if it fails under the Angular
  builder, `wasm-media-encoders` can replace it behind the same port.
- A 20-minute Recording holds about 200 MB of samples in memory while rendering; acceptable for now.
- Rejected: a pure sample renderer in `api/` (a second tone to keep alike), `MediaRecorder` (real time,
  plays aloud, no MP3), one IPC call with the bytes (format unknown before the dialog), writing by a
  path the renderer sends (breaks ADR 4).
