# Data model: Adjust a tape

## Tape (changed rule)

`api/tape/tape.ts`: no field changes. `validTape` adds one rule:

| Rule | Code |
|------|------|
| `columnLength` is finite and > 0 | `column-length-not-positive` |

## Command: change Column length

`changeColumnLength(tape: Tape, columnLength: number): Result<Tape, 'column-length-must-be-positive'>`

- Same Tape object when `columnLength === tape.columnLength`.
- Else a new Tape from `validTape({...tape, columnLength})`: same id, name, Organ, Song, Parts,
  Transposition, `length` in Columns and Holes.
- Refused for 0, negative, NaN or infinite.

## View state (not stored)

`ColumnLengthChange` (`src/app/features/tape/tape-view/column-length-change.ts`), derived from the typed
value, the Tape and the Organ:

| State | Meaning |
|-------|---------|
| `unchanged` | empty field, or the current value |
| `invalid` | not a number > 0; Apply disabled, error shown |
| `ready` | `{tape, problemsNow, problemsThen}`; Apply enabled, hint shown |
