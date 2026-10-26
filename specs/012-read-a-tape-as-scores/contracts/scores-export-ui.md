# Contract: Export as Scores in the Tape view

The UI of Stories 1, 3, 4 and 5 (research R11, R12, R14). Translation keys live in `src/assets/i18n/en.json`
and `de.json` under `TAPE.SCORES.*` (FR-019); German wording uses "Noten" for Scores, "Taktart", "Takt",
"Tonart" (DICTIONARY).

## Command

| Where | What | `data-testid` |
|-------|------|---------------|
| Tape view page head, after "Export for the Plotter" | "Export as Scores" (`TAPE.VIEW.EXPORT_SCORES`, icon `queue_music`); icon-only with the label as accessible name and tooltip when `compactActions()` | `export-scores` |

Enabled for every opened Tape: with Cutting Problems, while the Preview plays, while recording (FR-001,
FR-017). Disabled only while `ScoresExport.saving()`. It does not stop the Preview and adds no undo step.

## Export dialog (`ScoresExportDialogComponent`, `data-testid="scores-export-dialog"`)

Data in: `{tape, organ, song: Song | undefined, rememberedSplitNotes}`. Result: `ScoresChoices` or
`undefined` (cancelled).

| Group | Controls | `data-testid` | Prefill |
|-------|----------|---------------|---------|
| Time signature | radio "As in the Song: {metre}" / "Another one" (only when the Song keeps Time signatures on Columns); beats number input; beat type select 1, 2, 4, 8, 16, 32 | `scores-time-song`, `scores-time-other`, `scores-beats`, `scores-beat-type` | Song's, else 4/4 |
| Upbeat | count number input; note value select (whole … 1/32) | `scores-upbeat-count`, `scores-upbeat-value` | Song's upbeat (e.g. 1 × 1/4), else 0 × the beat type |
| Staves | per split note: note-name select and remove button; "Add a split note"; a read-only line per staff with its range and clef | `scores-split-note`, `scores-split-remove`, `scores-split-add`, `scores-staff` | remembered for the Organ, else C4 when the Organ has Pipes on both sides, else none |
| Actions | Cancel; Export (disabled while a violation is shown) | `scores-cancel`, `scores-confirm` | |

Hint when the Song keeps a Time signature that cannot lie on Columns: `TAPE.SCORES.SONG_METRE_NOT_ON_COLUMNS`.
Violations show as `mat-error` under their field: `TAPE.SCORES.ERROR.BEATS`, `.BEAT_TYPE`, `.UPBEAT`,
`.UPBEAT_TOO_LONG`, `.SPLIT_NOTES` (Story 4 scenario 3).

## Flow (`ScoresExport.export(tape, organ, song)`)

1. Open the dialog. Cancel → nothing, no message.
2. Confirm → `ScoresStavesPreference.remember(organ.id, splitNotes)`; build `scoresMusicXml`.
3. `api.scores.save({suggestedFileName: scoresFileName(tape.name), musicXml, dialogTitle, filterName})`.
4. `saved` → snackbar `TAPE.SCORES.SAVED` with the path (6 s, as the Plotter export). `cancelled` → nothing.
   `failed` / `rejected` / a thrown error → snackbar `TAPE.SCORES.FAILED` with the reason and a "Try again"
   action (FR-018), as `PlotterExport.showFailure` does.

## Keys (en / de, wording settled in implementation)

`TAPE.VIEW.EXPORT_SCORES` (Export as Scores / Als Noten exportieren), `TAPE.SCORES.TITLE`,
`TAPE.SCORES.TIME_SIGNATURE`, `TAPE.SCORES.TIME_SONG`, `TAPE.SCORES.TIME_OTHER`, `TAPE.SCORES.BEATS`,
`TAPE.SCORES.BEAT_TYPE`, `TAPE.SCORES.UPBEAT`, `TAPE.SCORES.UPBEAT_COUNT`, `TAPE.SCORES.UPBEAT_VALUE`,
`TAPE.SCORES.NOTE_VALUE.{1,2,4,8,16,32}`, `TAPE.SCORES.STAVES`, `TAPE.SCORES.SPLIT_NOTE`,
`TAPE.SCORES.SPLIT_ADD`, `TAPE.SCORES.SPLIT_REMOVE`, `TAPE.SCORES.STAFF` (with range and clef),
`TAPE.SCORES.CLEF.{TREBLE,TREBLE_8VA,BASS,BASS_8VB}`, `TAPE.SCORES.SONG_METRE_NOT_ON_COLUMNS`,
`TAPE.SCORES.ERROR.*`, `TAPE.SCORES.CONFIRM`, `TAPE.SCORES.CANCEL`, `TAPE.SCORES.DIALOG_TITLE`,
`TAPE.SCORES.FILTER_NAME`, `TAPE.SCORES.SAVED`, `TAPE.SCORES.FAILED`, `TAPE.SCORES.RETRY`.

## Layout

The page head must still fit in one row at the `tape-layout` e2e widths: labelled at 1180 px in English and
1440 px in German, icon-only below. If not, both breakpoints in `tape-view.component.ts` move up (R14).
