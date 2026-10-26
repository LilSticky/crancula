# Implementation Plan: Record a tape

**Branch**: `009-record-a-tape` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md) | **Issue**: [#165](https://github.com/LilSticky/crancula/issues/165)

**Input**: Feature specification from `specs/009-record-a-tape/spec.md`

## Summary

Record saves the whole Tape at its Crank speed as a WAV or MP3 Recording. The owner chooses the file
first (system save dialog in the main process, WAV or MP3 by extension); then the renderer renders the
Preview's own voice graph in an `OfflineAudioContext` (same tone, same compressor, no sound aloud),
turns the samples into the chosen format (WAV by a pure writer in `api/`, MP3 by LAME in a Web
Worker), and hands the bytes to the main process, which writes them to the file it chose. Details in
[research.md](research.md); decision in [ADR 26](../../documentation/adr/0026-recording-rendered-offline-saved-by-main.md).

## Technical Context

**Language/Version**: TypeScript (strict), Angular 22, Electron (current major, ADR 14)

**Primary Dependencies**: Web Audio `OfflineAudioContext` (Chromium); `@breezystack/lamejs` 1.2.7
(LGPL-3.0, pure JS LAME port) for MP3, loaded lazily in a Web Worker as its own chunk (R3)

**Storage**: none new; the Recording is a file the owner chooses, never read back

**Testing**: Vitest in node (WAV writer, sample conversion, request parsing, IPC handlers with fakes),
Vitest in jsdom (Record button, `TapeRecorder` service with fake renderer/encoder ports), Playwright
e2e (real Electron: record a WAV and an MP3 with a stubbed dialog, check header and length)

**Target Platform**: Electron desktop on Windows, macOS, Linux

**Project Type**: desktop app (Angular renderer, Electron main, shared `api/`)

**Performance Goals**: a 5-minute Tape recorded in under 30 s (SC-003); UI stays responsive

**Constraints**: mono, 44.1 kHz, 16-bit WAV; MP3 mono 128 kbit/s (clarification 2026-10-25); no
sound aloud while recording; ADR 4 boundary (validated payloads, allow-listed channels)

**Scale/Scope**: Tapes up to ~20 minutes (≈ 106 MB WAV, ≈ 19 MB MP3); payload limit 128 MiB

## Constitution Check

| Principle | Check | Result |
|-----------|-------|--------|
| I. Domain-Driven Slicing | Slice named after the capability; Recording and Record approved for the dictionary (2026-10-25); formats are adapters | Pass |
| II. TDD | Every task starts with a failing test (tasks.md); sound itself checked by file header/length/peak in e2e | Pass |
| III. Framework-Free Domain | WAV writer, sample conversion, file name and save request types in `api/` are pure; Web Audio, LAME and the Worker live in `src/` | Pass |
| IV. Memory First | No new snapshot; nothing stored | Pass |
| V. Strict Electron Boundary | Two new allow-listed channels; main validates both payloads and writes only to the path its own dialog returned (single-use token, R4) | Pass |
| VI. Context Never Gets Lost | ADR 26, STATUS, ROADMAP, DICTIONARY (done) | Pass |
| VII. Small Vertical Slices | WAV first (US1 end to end), then MP3, then US2 | Pass |

Post-design re-check: unchanged, pass. One new dependency (LGPL-3.0) is justified in R3 and ADR 26.

## Project Structure

### Documentation (this feature)

```text
specs/009-record-a-tape/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/recording-ipc.md, contracts/recording-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
api/recording/
├── recording-format.ts        # 'wav' | 'mp3', format from extension, constants (44.1 kHz, mono, 128 kbit/s)
├── recording-file-name.ts     # Tape name → safe file name (shares the rules of plotter-file-name)
├── pcm.ts                     # Float32 samples → Int16 PCM, clamped
├── wav-file.ts                # Int16 PCM → WAV bytes (RIFF header + data)
└── recording-save-request.ts  # choose/write request + result types and parsers (ADR 4)
api/app/crancula-api.ts        # + recording: {chooseFile, writeFile}
app/recording-ipc.ts           # handlers: save dialog, single-use target, write bytes
app/preload.ts, app/main.ts    # expose and register the channels
src/app/features/tape/preview/
└── preview-voices.ts          # the voice graph of ADR 24, on any BaseAudioContext (extracted)
src/app/features/tape/recording/
├── recording-renderer.ts      # port + OfflineAudioContext adapter: performance → Float32 samples
├── mp3-encoder.ts             # port + Worker adapter
├── mp3-encoder.worker.ts      # LAME in a Web Worker, progress messages
└── tape-recorder.ts           # service: choose file → render → encode → write, state, snackbars
src/app/features/tape/tape-view/ # Record button beside Export
src/assets/i18n/{en,de}.json   # TAPE.RECORD.*
e2e/record-a-tape.spec.ts
```

**Structure Decision**: as above; the domain part is formats and validation, the rendering adapter
reuses the Preview's voices so that the Recording sounds like the Preview (FR-003).

## Decisions left open by the spec

- **Record while the Preview plays** (US2 scenario 3): Record is disabled while the Preview plays, and
  the Preview is disabled while recording; the tooltip says why. Consistent with paused editing and no
  hidden side effects.
- **Placement**: a Record button (icon `fiber_manual_record`, text "Record" / "Aufnehmen") in the Tape
  view's page head, left of Export. While recording it shows a progress spinner and "Recording… 40 %".
- **Unavailable without Tape per Crank turn**: the same hint as the Preview's (spec 007 FR-017).

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|------|------------|--------------------------------------|
| Two IPC calls (choose, then write) | The format must be known before encoding, and the renderer must not name a path | One call would mean encoding both formats or choosing the format outside the system dialog (FR-004) |
| LGPL dependency | No MP3 encoder without LAME/Shine exists; both are LGPL | Writing an MP3 encoder is out of proportion for a hobby app |
