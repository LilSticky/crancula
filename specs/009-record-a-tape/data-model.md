# Data Model: Record a tape

Nothing is stored. All types are in `api/recording/` unless noted.

## RecordingFormat

`'wav' | 'mp3'`. Constants: `RECORDING_SAMPLE_RATE = 44100`, `RECORDING_CHANNELS = 1`,
`MP3_BIT_RATE = 128` (kbit/s). `recordingFormatOf(fileName)`: `.wav` → wav, `.mp3` → mp3 (any case),
otherwise `undefined` (main then appends `.wav`).

## Recording file name

`recordingFileName(tapeName)`: the Tape's name made safe like `plotterFileName` (no path characters,
no device names, at most 200 characters, fallback "Tape"), without an extension; the dialog adds it.
The shared cleaning moves into one helper used by both.

## PCM and WAV

- `pcm16(samples: Float32Array): Int16Array`: each sample clamped to [-1, 1], × 32767, rounded.
- `wavFile(pcm: Int16Array, sampleRate: number): Uint8Array`: `RIFF`, size 36 + data, `WAVE`, `fmt `
  chunk (16 bytes: format 1, channels 1, sample rate, byte rate = rate × 2, block align 2, 16 bits),
  `data` chunk. Little endian.

## Preview note windows (renderer, pure, in `api/preview/`)

`previewNoteWindows(notes: readonly PreviewNote[], columnSeconds, windowSeconds)`: the PreviewNotes as
`{pipe, startSeconds, stopSeconds}` grouped by the window their start falls into, in order. Used by the
offline renderer to schedule window by window.

## Save request and result (IPC payloads)

```ts
interface RecordingChooseRequest { suggestedFileName: string; dialogTitle: string; wavFilterName: string; mp3FilterName: string }
type RecordingChooseResult =
  | {status: 'chosen'; target: string; format: RecordingFormat; fileName: string} // fileName: basename only
  | {status: 'cancelled'}
  | {status: 'rejected'; reason: string};

interface RecordingWriteRequest { target: string; bytes: Uint8Array }
type RecordingWriteResult =
  | {status: 'saved'; filePath: string}
  | {status: 'rejected'; reason: string}   // unknown/used target, wrong magic bytes, too large
  | {status: 'failed'; reason: string};    // OS error code
```

Validation as for `SvgSaveRequest` (exact fields, string limits, no control characters); `target` is a
UUID; `bytes` is a `Uint8Array` of 1 B to 128 MiB.

## TapeRecorder state (renderer, `src/`)

`idle` → `choosing` → `rendering(progress 0–1)` → `encoding(progress 0–1)` (mp3 only) → `writing` →
`idle`. Any failure → `idle` with a snackbar; cancel in the dialog → `idle` silently. `recording()`
signal is true in every state but `idle`; the Preview and Record disable each other on it.
