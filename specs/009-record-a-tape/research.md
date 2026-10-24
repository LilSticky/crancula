# Research: Record a tape

## R1. How the Recording is rendered

- **Decision**: render the Preview's voice graph (ADR 24: three sine harmonics, 15 ms attack, 30 ms
  release, master gain 0.2, dynamics compressor) in an `OfflineAudioContext` of 1 channel at 44 100 Hz,
  `length = ceil((previewLength + release) × 44 100)`. The graph is extracted from
  `WebAudioPreviewSound` into `preview-voices.ts`, which takes any `BaseAudioContext`; the Preview and
  the Recording both use it. Voices are scheduled in windows of 10 s with `suspend(t)`/`resume()`, which
  keeps the node count small and gives progress.
- **Rationale**: one implementation of the tone means the Recording sounds like the Preview (FR-003)
  by construction; Chromium renders offline faster than real time and plays nothing aloud (FR-009).
- **Alternatives**: a pure sample renderer in `api/` (deterministic and node-testable, but a second
  implementation of the tone and the compressor to keep alike); `MediaRecorder` on the live Preview
  (real time, plays aloud, WebM/Opus only).
- **Testing**: jsdom has no Web Audio; the renderer sits behind a `RecordingRenderer` port. The
  scheduling (which voices start and stop when, in which window) is a pure function tested in node;
  the adapter is proven in e2e by the length and a non-silent peak of the WAV.

## R2. WAV

- **Decision**: pure `wavFile(pcm: Int16Array, sampleRate)` in `api/recording/`: 44-byte RIFF/WAVE
  header (PCM format 1, 1 channel, 16 bit, little endian) + data. `pcm16(samples: Float32Array)`
  clamps to [-1, 1] and scales to Int16.
- **Rationale**: trivial format, no dependency, fully unit-testable.

## R3. MP3 encoder

- **Decision**: `@breezystack/lamejs` 1.2.7 (LGPL-3.0; a maintained TypeScript/ESM fork of lamejs, the
  pure JS port of LAME). Mono, 44 100 Hz, 128 kbit/s, fed 1152-sample blocks in a Web Worker that posts
  progress. Loaded only when an MP3 is recorded, as its own unmodified chunk; its licence is listed in
  the app's third-party notices and the package stays replaceable (LGPL section 4 for a combined work).
- **Rationale**: every practical MP3 encoder is LAME or Shine, both LGPL. Pure JS needs no WASM build
  step and runs in a Worker as is. MP3 patents expired in 2017.
- **Alternatives**: `lamejs` 1.2.1 (unmaintained since 2022, CommonJS globals break under ESM);
  `wasm-media-encoders` 0.7.0 (MIT wrapper, LAME inside, WASM loading in Electron/Angular builder is more
  work); MediaRecorder (no MP3).
- **Risk**: if the fork misbehaves under the Angular builder, fall back to `wasm-media-encoders` behind
  the same `Mp3Encoder` port.

## R4. Saving: two calls, path stays in main

- **Decision**: `recording:choose-file` opens the save dialog with filters WAV and MP3 (WAV first) and
  `showOverwriteConfirmation`. The format comes from the chosen extension; any other extension gets
  `.wav` appended. Main keeps the path under a random single-use target id and returns
  `{status: 'chosen', target, format, fileName}`. `recording:write-file` takes `{target, bytes}`,
  checks the target is open and the bytes start with `RIFF....WAVE` (wav) or an ID3 tag or MPEG frame
  sync (mp3), size ≤ 512 MB, writes, and closes the target. A target expires when used or after the
  next choose.
- **Rationale**: the renderer never sends a path (ADR 4), the format is known before encoding, and the
  owner chooses the format in the system dialog (FR-004).
- **Alternatives**: one call with the bytes (needs the format beforehand); returning the path to the
  renderer and writing by path (renderer could write anywhere).

## R5. Responsiveness

- Offline rendering runs on Chromium's audio thread; scheduling windows of 10 s keep the main thread
  free between `suspend` points. MP3 encoding runs in the Worker. WAV writing of 100 MB is a single
  `ArrayBuffer` fill (fast). Bytes go to main by structured clone (one copy).
