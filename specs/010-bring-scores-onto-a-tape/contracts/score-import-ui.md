# Contract: Scores on the import screen and in the Tape view

Existing test ids stay; new ones are listed here.

## Import screen (`tape-import`)

- **File input** `song-file` accepts `.mid,.midi,.musicxml,.xml,.mxl,.pdf`. The choose button's label and the
  hint below name MIDI and MusicXML (`TAPE.IMPORT.CHOOSE_SONG`, `TAPE.IMPORT.SONG_SOURCES`).
- **Score hint** `score-how-to-hint`: one line, "Only a PDF or printed Scores? How to get MusicXML" with a link
  button `score-how-to-open` that opens the how-to dialog (`TAPE.IMPORT.SCORE_HINT`, `TAPE.IMPORT.SCORE_HINT_LINK`).
- **How-to dialog** `score-how-to-dialog` (Angular Material dialog): title `TAPE.SCORE_HOW_TO.TITLE`, five
  numbered steps `TAPE.SCORE_HOW_TO.STEP_1` … `STEP_5` (Audiveris, open the PDF or scan, check and correct
  in a notation program such as MuseScore, export MusicXML, choose it here), a Close button.
- **Rejection** `song-rejection` with `data-code` = the `SongRejection` code; texts
  `TAPE.SONG_REJECTION.<CODE>` for every code in [data-model.md](../data-model.md#songrejection-changed).
  The `pdf` rejection holds the same `score-how-to-open` link.
- **Song facts** `song-facts` additionally shows `song-metre`, read-only, when the Song keeps any of them:
  "3/4, G major, upbeat 1/4" (`TAPE.METRE.*`); key names translated ("G-Dur", "e-Moll").
- The Tape name is prefilled with the Score's title, else the file name without its extension.

## Import Summary (`import-summary`)

- For a Song from Scores two more rows: `grace-notes-left-out-value` and `ornaments-left-out-value`
  (`TAPE.SUMMARY.GRACE_NOTES_LEFT_OUT`, `TAPE.SUMMARY.ORNAMENTS_LEFT_OUT`), 0 included. Absent for MIDI.

## Tape view

- The Tape details show `song-metre` the same way as the import screen, when the Tape's Song keeps any.
