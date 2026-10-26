# Contract: Recording IPC (ADR 4)

Channels, allow-listed in `app/recording-ipc.ts` and `app/preload.ts`, exposed as
`window.crancula.recording` (`api/app/crancula-api.ts`). Types in [data-model.md](../data-model.md).

| Channel | Preload method | Payload | Answer |
|---------|----------------|---------|--------|
| `recording:choose-file` | `chooseFile(request)` | `RecordingChooseRequest` | `RecordingChooseResult` |
| `recording:write-file` | `writeFile(request)` | `RecordingWriteRequest` | `RecordingWriteResult` |

## choose-file

- Parsed with `parseRecordingChooseRequest`; invalid → `rejected`, no dialog.
- Dialog: title `dialogTitle`; default path = last folder (or Documents) + `suggestedFileName` + `.wav`;
  filters `[{name: wavFilterName, extensions: ['wav']}, {name: mp3FilterName, extensions: ['mp3']}]`;
  `showOverwriteConfirmation`, `createDirectory`.
- Cancelled → `cancelled`. Otherwise the format from the extension; unknown → `.wav` appended.
- A new random target replaces any open one; answer `chosen` with the basename only.

## write-file

- Parsed with `parseRecordingWriteRequest`; unknown or used target → `rejected`.
- Bytes must match the target's format: `RIFF` + 4 bytes + `WAVE`, or `ID3` / `0xFF 0xE?` frame sync.
- Size 1 B to 128 MiB (`MAXIMUM_RECORDING_BYTES`); a file name whose `.wav` was appended is written
  exclusively, so an existing file is never replaced (EEXIST → `failed`).
- Write; the target is closed in every case. OS error → `failed` with the error code; success →
  `saved` with the full path, and the folder is remembered for the next dialog.

## Proven by

- Node unit tests of the parsers and handlers with fake effects (dialog, write, uuid).
- `e2e/boundary.spec.ts`: both methods exist; a forged write with an unknown target is rejected
  without writing.
