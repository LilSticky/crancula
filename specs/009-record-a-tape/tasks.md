---

description: "Tasks for 009 Record a tape"
---

# Tasks: Record a tape

**Input**: Design documents from `/specs/009-record-a-tape/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/recording-ipc.md](contracts/recording-ipc.md),
[contracts/recording-ui.md](contracts/recording-ui.md), [quickstart.md](quickstart.md),
[ADR 4](../../documentation/adr/README.md), [ADR 24](../../documentation/adr/0024-preview-synthesised-with-web-audio.md),
[ADR 26](../../documentation/adr/0026-recording-rendered-offline-saved-by-main.md)

**Tests**: TDD is mandatory (constitution, principle II). Every implementation task follows a test
task that must fail for the expected reason first (`tdd` skill: `test-first` red, `implementer`
green). Test pyramid: Node Vitest for `api/` and `app/`; `ng test` (jsdom, fake ports) for `src/`;
Playwright e2e only for what needs real Electron (offline rendering, LAME in a Worker, the dialog stub).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US2 from spec.md; only in story phases
- **Commits**: one small conventional commit per test+implementation pair on `009-record-a-tape`.
  Update `documentation/STATUS.md` at each checkpoint.

## Phase 1: Setup

- [x] T001 Add the keys of contracts/recording-ui.md with en and de texts to `src/assets/i18n/en.json` and `de.json`: `TAPE.RECORD.BUTTON` ("Record" / "Aufnehmen"), `PROGRESS` (with `{{percent}}`; "Recording… {{percent}} %" / "Aufnahme… {{percent}} %"), `SAVED` (with `{{name}}`), `FAILED` (with `{{reason}}`), `RETRY`, `DIALOG_TITLE`, `WAV_FILTER` ("WAV audio"), `MP3_FILTER` ("MP3 audio"), `NO_TAPE_PER_TURN`, `WHILE_PREVIEW`; `TAPE.PREVIEW.WHILE_RECORDING`; `npm run i18n:check` green.
- [x] T002 Add `@breezystack/lamejs` at exactly `1.2.7` to `dependencies` in `package.json` (`npm install --save-exact`); add its licence to the third-party notices (find where electron-builder/README lists them; create `THIRD-PARTY-NOTICES.md` if none) stating LGPL-3.0, unmodified, source link `https://github.com/shijinyu/lamejs`.

## Phase 2: Foundational (domain, pure)

- [x] T003 [P] Red: `api/recording/recording-format.spec.ts`: `RECORDING_SAMPLE_RATE` 44100, `RECORDING_CHANNELS` 1, `MP3_BIT_RATE` 128; `recordingFormatOf('a.wav')` → `'wav'`, `'A.MP3'` → `'mp3'`, `'a.ogg'`, `'a'`, `'wav'` → `undefined`.
- [x] T004 Green: `api/recording/recording-format.ts`, exported from `api/index.ts`.
- [x] T005 [P] Red: `api/recording/recording-file-name.spec.ts`: `recordingFileName` cleans like `plotterFileName` (forbidden characters → `_`, trailing dots/spaces removed, `CON` → `_CON`, empty → `Tape`, at most 200 characters without splitting a surrogate pair) and has no extension.
- [x] T006 Green: move the cleaning out of `api/tape/plotter-file-name.ts` into one shared helper (e.g. `api/app/safe-file-name.ts`) and build `recordingFileName` in `api/recording/recording-file-name.ts` on it; `plotter-file-name.spec.ts` stays green.
- [x] T007 [P] Red: `api/recording/pcm.spec.ts`: `pcm16(Float32Array)` maps 0 → 0, 1 → 32767, -1 → -32767, 0.5 → 16384 (rounded), 2 → 32767, -3 → -32767, NaN → 0; length kept.
- [x] T008 Green: `api/recording/pcm.ts`.
- [x] T009 [P] Red: `api/recording/wav-file.spec.ts`: `wavFile(new Int16Array([0, 1, -1]), 44100)` is 50 bytes: `RIFF`, size 42 (LE u32), `WAVE`, `fmt `, 16, format 1, channels 1, rate 44100, byte rate 88200, block align 2, bits 16, `data`, 6, then the samples little endian; an empty PCM gives a 44-byte header with data size 0.
- [x] T010 Green: `api/recording/wav-file.ts`.
- [x] T011 [P] Red: `api/preview/preview-note-windows.spec.ts`: `previewNoteWindows(notes, columnSeconds, windowSeconds)` turns PreviewNotes into `{pipe, startSeconds, stopSeconds}` (start = startColumn × columnSeconds, stop = endColumn × columnSeconds) grouped by `floor(startSeconds / windowSeconds)` in order, with empty windows present up to the last note's window; no notes → `[]`.
- [x] T012 Green: `api/preview/preview-note-windows.ts`, exported.
- [x] T013 [P] Red: `api/recording/recording-save-request.spec.ts`: `parseRecordingChooseRequest` accepts exactly `suggestedFileName`, `dialogTitle`, `wavFilterName`, `mp3FilterName` (strings, 1–200 characters, no control characters; file name without path separators and not only dots), rejects extra fields, non-objects, arrays; `parseRecordingWriteRequest` accepts exactly `target` (UUID string) and `bytes` (`Uint8Array`, 1 B to 128 MiB) and rejects other types, empty bytes, extra fields.
- [x] T014 Green: `api/recording/recording-save-request.ts` with the request/result types of data-model.md; `recording` methods `chooseFile` and `writeFile` added to `api/app/crancula-api.ts`.

**Checkpoint**: `npm run test:node` green; commit; STATUS.

## Phase 3: User Story 1 - Save the Tape as a Recording (P1) 🎯 MVP

**Goal**: Record a Tape as WAV or MP3 into a file the owner chooses.

**Independent Test**: record a Tape as WAV in real Electron (stubbed dialog); the file has the expected header, length and a non-silent peak; the Tape and undo history are unchanged.

### Main process

- [x] T015 [US1] Red: `app/recording-ipc.spec.ts` with fake effects (dialog, writeFile(path, bytes), documentsFolder, newTarget): choose shows the dialog with filters WAV then MP3, `showOverwriteConfirmation`, default path Documents + name + `.wav`; cancel → `cancelled`; `x.mp3` → `chosen`, format mp3, `fileName` basename only; `x.ogg` → path `x.ogg.wav`, format wav; invalid request → `rejected`, no dialog; write with the open target and WAV magic → file written, `saved` with the path; same target again → `rejected`; unknown target → `rejected`, nothing written; MP3 target with WAV bytes → `rejected`; write error → `failed` with the code; a second choose closes the first target; the next dialog opens in the last folder.
- [x] T016 [US1] Green: `app/recording-ipc.ts` (`RECORDING_CHANNELS = {chooseFile: 'recording:choose-file', writeFile: 'recording:write-file'}`, `registerRecordingHandlers`), registered in `app/main.ts` with real effects (`crypto.randomUUID`, `fs.promises.writeFile`), exposed in `app/preload.ts` as `recording.chooseFile/writeFile`; the fake API in `src/app/core/crancula-api.token.ts` gets `recording` (with `failures.recording` like `plotter`).

### Renderer adapters

- [x] T017 [US1] Red: extend `src/app/features/tape/preview/web-audio-preview-sound.spec.ts` (or a new `preview-voices.spec.ts`) so the voice graph is built through `previewVoices(context: BaseAudioContext, destination)`; existing Preview specs stay green.
- [x] T018 [US1] Green: extract `src/app/features/tape/preview/preview-voices.ts` (harmonics, attack, release, master gain, compressor) from `web-audio-preview-sound.ts`; the Preview uses it unchanged.
- [x] T019 [US1] Red: `src/app/features/tape/recording/tape-recorder.spec.ts` with fake `RecordingRenderer` (returns a Float32Array, reports progress), fake `Mp3Encoder` and the fake API: Record calls `chooseFile` with `recordingFileName(tape.name)` and the translated texts; cancelled → nothing rendered, no snackbar; chosen wav → renders the whole Tape (`performance`, `columnDuration`, sample rate 44100), `wavFile(pcm16(...))` written with the target, snackbar `TAPE.RECORD.SAVED` 6 s; chosen mp3 → encoder called with the samples, its bytes written; write `failed`/`rejected` or a thrown error → snackbar `TAPE.RECORD.FAILED` with Retry; `state()` goes idle → choosing → rendering(progress) → (encoding) → writing → idle; `recording()` true while not idle; a second Record while recording does nothing; the Tape store and undo history are untouched.
- [x] T020 [US1] Green: `src/app/features/tape/recording/tape-recorder.ts` (root service), ports `RecordingRenderer` and `Mp3Encoder` with injection tokens in `recording-renderer.ts` and `mp3-encoder.ts` (adapters stubbed until T021/T022).
- [x] T021 [US1] Green (proven in e2e T025): `OfflineAudioContext` adapter in `src/app/features/tape/recording/recording-renderer.ts`: 1 channel, 44100 Hz, length `ceil((previewLength + release) × 44100)`, voices from `previewNoteWindows` scheduled window by window (10 s) with `suspend`/`resume` through `previewVoices`, progress per window, returns channel 0.
- [x] T022 [US1] Green (proven in e2e T025): `src/app/features/tape/recording/mp3-encoder.worker.ts` (LAME `Mp3Encoder(1, 44100, 128)`, Int16 blocks of 1152, `flush`, progress messages) and the Worker adapter in `mp3-encoder.ts`; Angular worker config (`tsconfig.worker.json`, `webWorkerTsConfig` in `angular.json`); `npm run build` green.

### UI

- [x] T023 [US1] Red: Tape view component spec (`src/app/features/tape/tape-view/tape-view.component.spec.ts` or the page-head component): a Record button with `TAPE.RECORD.BUTTON` left of Export calls `TapeRecorder.record(tape, organ)`; while recording it is disabled and shows the progress text with the percent.
- [x] T024 [US1] Green: the Record button in the Tape view's page head (Material button, icon `fiber_manual_record`, `white-space: nowrap` like Export).
- [x] T025 [US1] Red→Green: `e2e/record-a-tape.spec.ts`: stub `dialog.showSaveDialog` in main to a temp path; record the README fixture Tape as `.wav`: header mono/44100/16 bit, duration = Columns × Column time + release within 1 %, peak above 0.01; record as `.mp3`: file starts with `ID3` or `0xFF 0xE?` and is larger than 1 kB; the Tape and Undo state unchanged afterwards. Extend `e2e/boundary.spec.ts`: `recording.chooseFile/writeFile` exist; a forged write with an unknown target is rejected and writes nothing.

**Checkpoint**: US1 works end to end; commit; STATUS.

## Phase 4: User Story 2 - Know when recording is not possible (P2)

**Goal**: Record is unavailable without a Tape per Crank turn and while the Preview plays; failures are reported.

**Independent Test**: a Tape of an Organ without Tape per Crank turn shows Record disabled with the hint.

- [x] T026 [US2] Red: Tape view spec: Record disabled with tooltip `TAPE.RECORD.NO_TAPE_PER_TURN` when `organ.tapePerCrankTurn` is undefined; disabled with `TAPE.RECORD.WHILE_PREVIEW` while the Preview plays; the Preview's play button disabled with `TAPE.PREVIEW.WHILE_RECORDING` while `TapeRecorder.recording()`; Space does not start the Preview while recording.
- [x] T027 [US2] Green: wire the disabled states in the Tape view and `src/app/features/tape/preview/tape-preview.ts` (or its section component).
- [x] T028 [US2] Red→Green: `TapeRecorder` refuses `record` (no dialog) when the Organ has no Tape per Crank turn or the Preview plays (guard for keyboard/menu paths), in `tape-recorder.spec.ts` / `tape-recorder.ts`.

**Checkpoint**: commit; STATUS.

## Phase 5: Polish & Cross-Cutting

- [ ] T029 [P] `npm run ux:screens` captures the Tape view with the Record button and during a Recording; run `ux-review` on them; fix findings.
- [x] T030 [P] Reviews: `angular-reviewer` (src/), `electron-reviewer` (app/ and IPC), `spec-auditor` (spec vs. tests) → `specs/009-record-a-tape/audit.md`; fix findings.
- [ ] T031 `npm run test`, `npm run lint`, `npm run i18n:check`, `npm run build` green; quickstart by hand (play a WAV and an MP3); record the result in STATUS.
- [ ] T032 STATUS, ROADMAP (Record a tape done), CHANGELOG `[Unreleased]`, README feature list; PR with `Closes #165`.

## Dependencies

- Phase 1 → Phase 2 → US1 → US2 → Polish. T003–T014 are pairwise [P] across files.
- T016 needs T014; T019 needs T004–T012; T021 needs T018 and T012; T022 needs T002; T025 needs T016, T021, T022, T024.

## Parallel examples

- Red tasks T003, T005, T007, T009, T011, T013 together (one `test-first` run per file, sequential edits in one tree).
- Reviews in T030 run in parallel (read-only).

## Implementation strategy

MVP is US1 with WAV (T001, T003–T021, T023–T025 without the MP3 half); then MP3 (T002, T022 and the MP3 half of T025); then US2; then polish.
