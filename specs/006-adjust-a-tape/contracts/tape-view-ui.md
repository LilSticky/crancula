# Contract: Tape view UI

Tape section (`cranc-tape-section`), Column length row:

| Element | `data-testid` | Behaviour |
|---------|---------------|-----------|
| Field (outlined, `crancDecimalInput`, suffix "mm", label "Column length") | `column-length-input` | shows the current value in the language's notation |
| Apply button | `column-length-apply` | enabled only in state `ready`; Enter in the field does the same |
| Hint | `column-length-hint` | `ready`: "Cutting Problems: {now} now, {then} with {value} mm" |
| Error | `column-length-error` | `invalid`: "The Column length must be greater than 0." |

- Escape, or blur without applying, puts the current value back.
- After applying: the field shows the new value, drawing, ruler, Tape length, marks and Cutting
  Problems list follow; one undo step; the selection stays.
- Output from the section: `columnLengthChange: Tape` (the changed Tape); the Tape view calls
  `TapeEditor.apply({tape, selection})`.
- Keys (en/de): `TAPE.SECTION.COLUMN_LENGTH_APPLY`, `TAPE.SECTION.COLUMN_LENGTH_HINT`,
  `TAPE.SECTION.COLUMN_LENGTH_INVALID`.
