# Audit: Record a tape

## spec-auditor (2026-10-25)

Test run: `npm run test` 1431 passed (72 files); `npm run test:node` 1009 passed; `npm run lint -- --quiet` clean.
e2e not run by the auditor (Electron, minutes); `e2e/record-a-tape.spec.ts` and `e2e/boundary.spec.ts` exist.

### Coverage

| Criterion | Covering tests | Status |
|-----------|----------------|--------|
| US1.1 Record writes the whole Tape, owner told where | `tape-recorder.spec.ts` (renders whole Tape, writes WAV, saved snackbar 6 s); e2e WAV | covered |
| US1.2 name proposed, WAV and MP3 offered, format by extension | `tape-recorder.spec.ts` (dialog request); `app/recording-ipc.spec.ts` (filters, default path, `x.ogg` to wav); `recording-format.spec.ts`; e2e | covered |
| US1.3 Preview's tone, silent Holes without Pipe | `preview-voices.spec.ts` (shared voice graph); `tape-recorder.spec.ts` (notes passed); no test of the sounding result | partial (sound by hand) |
| US1.4 length = Preview length | `recording-renderer.spec.ts` (context sized to Tape plus release); e2e (duration within 1 %) | covered |
| US1.5 cancel writes nothing, no error | `tape-recorder.spec.ts` (cancelled); `recording-ipc.spec.ts` (`cancelled`) | covered |
| US1.6 Tape, Holes, speed, undo unchanged | `tape-recorder.spec.ts` (unchanged); e2e (file and undo unchanged) | covered |
| US2.1 unavailable without Tape per Crank turn, with reason | `tape-view.component.spec.ts` (disabled and tooltip); `tape-recorder.spec.ts` (refuses). Link to the Organ editor is the existing Preview notice | covered |
| US2.2 failed write reported, Tape unchanged | `tape-recorder.spec.ts` (failed, rejected, thrown: snackbar with Retry); `recording-ipc.spec.ts` (`failed`) | covered |
| US2.3 Preview and Record exclusive | `tape-view.component.spec.ts` (Record disabled while Preview plays, Preview disabled and no Space while recording) | covered |
| FR-001 Record in the Tape view | `tape-view.component.spec.ts` (button left of Export, calls recorder) | covered |
| FR-002 whole Tape, Column time, no Lead-in | `tape-recorder.spec.ts` (Columns and Column time); `recording-renderer.spec.ts` | covered |
| FR-003 same sound, no clipping | `preview-voices.spec.ts` (compressor graph shared with the Preview) | partial |
| FR-004 system save dialog, name proposed | `recording-ipc.spec.ts`, `tape-recorder.spec.ts`, e2e (stubbed dialog) | covered |
| FR-005 valid WAV and MP3 | `wav-file.spec.ts`, `pcm.spec.ts`, `mp3-encode.spec.ts`, `mp3-encoder.spec.ts`; e2e header and ID3/sync check | covered |
| FR-006 cancel silent, failure reported | see US1.5, US2.2 | covered |
| FR-007 changes nothing | see US1.6 | covered |
| FR-008 unavailable without Tape per Crank turn | see US2.1 | covered |
| FR-009 no sound aloud, faster than playing, progress shown, responsive | offline context (`recording-renderer.spec.ts`, window by window, progress); `tape-view.component.spec.ts` (percent); MP3 in a Worker (`mp3-encoder.spec.ts`); speed not measured | partial |
| FR-010 never at the same time | see US2.3 | covered |
| FR-011 en and de | `npm run i18n:check` (T001) | covered |
| Edge: no Holes gives silence | `recording-renderer.spec.ts` (Tape without notes) | covered |
| Edge: file exists asks before replacing | `recording-ipc.spec.ts` (`showOverwriteConfirmation`) | covered |
| Edge: Cutting Problems recordable, no sound output | no test (not blocked by any code path; offline context needs no output) | missing, accepted |

### Tasks

- T001-T028 ticked, and their code and specs exist in the diff.
- T029 (ux:screens and ux-review), T031 (full gate, quickstart by hand) and T032 (STATUS, ROADMAP, CHANGELOG, README, PR) are not ticked.
- T030 is this audit plus the angular and electron reviews (commits `223b572`, `1848911` fixed the angular findings); tick it once this file is committed.

### Tests without a criterion

None found. `mp3-encoder-message` / worker plumbing and `plotter-file-name` / safe-file-name refactor tests serve FR-005 and FR-004 (shared file-name cleaning).

### Accepted gaps (by hand, quickstart)

- The sound itself (US1.3, FR-003): that it sounds like the Preview is checked by ear; tests prove the shared voice graph only.
- SC-001: not measured (owner's time).
- SC-003: 5-minute Tape in under 30 s, not measured; the e2e records a short fixture only.
- SC-005: WAV and MP3 in the default player on Windows, macOS and Linux, by hand per OS.
- Edge: a 20-minute Tape stays responsive: not tested.

### Result

Slice meets the spec in tests; open before merge: T029, T031, T032 and the by-hand items above.
