# Contract: Record in the Tape view

- **Record button** in the page head, left of Export: icon and text `TAPE.RECORD.BUTTON`
  ("Record" / "Aufnehmen").
- **Disabled** with a tooltip when: the Organ has no Tape per Crank turn (`TAPE.RECORD.NO_TAPE_PER_TURN`,
  same wording as the Preview's hint), the Preview plays (`TAPE.RECORD.WHILE_PREVIEW`).
- **While recording**: the button shows a spinner and `TAPE.RECORD.PROGRESS` ("Recording… {percent} %"),
  is disabled, and the Preview button is disabled with `TAPE.PREVIEW.WHILE_RECORDING`.
- **Saved**: snackbar `TAPE.RECORD.SAVED` with the file path, 6 s.
- **Failed**: snackbar `TAPE.RECORD.FAILED` with the reason and a Retry action, as Export.
- **Cancelled**: nothing shown.
- Dialog texts: `TAPE.RECORD.DIALOG_TITLE`, `TAPE.RECORD.WAV_FILTER`, `TAPE.RECORD.MP3_FILTER`.
- Leaving the Tape view while recording lets the Recording finish and save (it changes nothing).
