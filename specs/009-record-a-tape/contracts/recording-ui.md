# Contract: Record in the Tape view

- **Record button** in the page head, left of Export: icon and text `TAPE.RECORD.BUTTON`
  ("Record" / "Aufnehmen").
- **Disabled** with a tooltip when: the Organ has no Tape per Crank turn (`TAPE.RECORD.NO_TAPE_PER_TURN`,
  same wording as the Preview's hint), the Preview plays (`TAPE.RECORD.WHILE_PREVIEW`). The button stays
  focusable (`disabledInteractive`) so the tooltip shows; the Tape view refuses a click while it is blocked.
  The recorder itself does not know the Preview: the guard lives in the Tape view.
- **While recording**: the button shows a spinner whenever a Recording runs (choosing, rendering, encoding,
  writing). Its text is `TAPE.RECORD.PROGRESS` ("Recording… {percent} %") only while a percent is known
  (rendering, encoding); otherwise `TAPE.RECORD.BUTTON`. It is disabled, and the Preview button is disabled
  (focusable, with its tooltip) with `TAPE.PREVIEW.WHILE_RECORDING`; the Tape view refuses a Preview click then.
- **Saved**: snackbar `TAPE.RECORD.SAVED` with the file path, 6 s.
- **Failed**: snackbar `TAPE.RECORD.FAILED` with the reason and a Retry action, as Export.
- **Too large** (bytes above 128 MiB, a WAV of about 25 minutes): snackbar `TAPE.RECORD.TOO_LARGE`; MP3 still works.
- **Cancelled**: nothing shown.
- Dialog texts: `TAPE.RECORD.DIALOG_TITLE`, `TAPE.RECORD.WAV_FILTER`, `TAPE.RECORD.MP3_FILTER`.
- Leaving the Tape view while recording lets the Recording finish and save (it changes nothing).
