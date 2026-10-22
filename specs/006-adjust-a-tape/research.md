# Research: Adjust a tape

## R1. Where the Column length is changed

- **Decision**: in the Tape section of the side panel, where it is already shown: the read-only value
  becomes an outlined Material field with `crancDecimalInput` and an "mm" suffix. Enter or an
  "Apply" button applies; Escape or leaving the field without applying puts the current value back.
- **Rationale**: the 004 UX review made the side panel's sections editable first (#121); the owner
  sees the value where it lives. No dialog is needed for one number.
- **Alternatives**: a dialog like Transpose (one more click and a modal for one field); the page head
  (crowded, kept for Export and Undo/Redo).

## R2. Telling the Cutting Problems before applying (FR-006)

- **Decision**: while the typed value is valid and differs from the current one, a hint under the
  field says "Cutting Problems: {now} now, {then} with {value} mm". With the same count it says so too.
  Computed with `cuttingProblems(changed, organ).length` on the would-be Tape.
- **Rationale**: the count is cheap and live; the owner can try values before applying.
- **Alternatives**: count only after applying (fails FR-006); listing the Holes (the Cutting Problems
  list already does that after applying).

## R3. Validity of a Column length

- **Decision**: `validTape` gains `column-length-not-positive` (finite and > 0). `changeColumnLength`
  returns `err('column-length-must-be-positive')` for anything else, the code `createTape` already uses.
  The field shows "The Column length must be greater than 0." under its own key
  `TAPE.SECTION.COLUMN_LENGTH_INVALID` (same wording as the import screen).
- **Rationale**: makes the invalid state unrepresentable (constitution III); createTape and the snapshot
  parser already refuse it, so no stored Tape breaks.

## R4. Same value

- **Decision**: `changeColumnLength` returns the same Tape object when the value equals the current one;
  the view does not call `TapeEditor.apply` then (no undo step, FR-008). Equality after parsing, so
  "5,0" equals 5.

## R5. Undo, menu and dialogs

- **Decision**: `TapeEditor.apply({tape, selection})` keeps the current selection (Holes keep their
  Pipe and start, so the selection stays valid). Undo/Redo by button, shortcut and menu work unchanged.
  While the Column length field has focus, the menu's Undo acts on the text field, as for every text
  field (#122).

## R6. Prefill at import

- **Decision**: unchanged. `prefilledColumnLength` takes the last Tape of the Organ, which now may carry
  a changed Column length; that is what the owner last chose.
