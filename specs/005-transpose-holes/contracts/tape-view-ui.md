# Contract: Tape view UI

## Selecting several Holes (research R6)

| Input | Effect |
|-------|--------|
| Click a Hole | Only that Hole is selected (spec 004) |
| Ctrl-click / Cmd-click (macOS) a Hole | Adds it to the selection or takes it out |
| Drag from an empty spot | Draws a frame (`data-testid="selection-frame"`); on release, the Holes on rows inside it that overlap its Columns are selected |
| Ctrl/Cmd + drag from an empty spot | Same, added to the selection |
| Arrow keys | Only the next Hole is selected (spec 004) |
| Ctrl/Cmd + Arrow | Adds the next Hole in that direction; it becomes active |
| Ctrl/Cmd + A (Tape drawing focused) | Selects every Hole that has a row |
| Escape | Clears the selection |

Every selected Hole is drawn selected (`rect.selected`). Edit keys, handles and drags of spec 004
act only when exactly one Hole is selected; a drag on a Hole of a multi-selection selects only it
first, as a plain press does today.

Side panel: with two or more selected, the Selected Hole section shows "n Holes selected"
(`data-testid="selection-count"`) instead of one Hole's details.

## Transpose dialog (research R7)

- Button `data-testid="transpose"` in the action bar, label "Transpose…", disabled when no Hole has
  a row.
- Dialog `data-testid="transpose-dialog"`:
  - Scope radios `transpose-scope-selected` ("Selected Holes (n)", disabled at n = 0, preselected
    when n > 0) and `transpose-scope-all` ("All Holes").
  - Number field `transpose-semitones`, range from `transposeRange`, initial 0.
  - Outcome `transpose-outcome`: `outcome-moved`, `outcome-moved-by-octaves`, `outcome-merged`,
    `outcome-removed` (each "label: count"), list `outcome-removed-holes` ("C#4 · Column 12"), and
    `outcome-left-out` when > 0, and `outcome-nothing-left` when every chosen Hole would be removed.
  - `transpose-cancel`, `transpose-apply` (disabled at 0 semitones).
- Apply: one edit in the history; the resulting Holes are selected; the Tape is saved.

## i18n keys

`TAPE.TRANSPOSE.{BUTTON, TITLE, SCOPE_SELECTED, SCOPE_ALL, SEMITONES, MOVED, MOVED_BY_OCTAVES, MERGED,
REMOVED, REMOVED_HOLE, LEFT_OUT, NOTHING_LEFT, APPLY, CANCEL}`, `TAPE.SELECTION.COUNT`, in en and de.
German: Transponieren, Ausgewählte Löcher, Alle Löcher, Halbtöne, verschoben, um Oktaven verschoben,
zusammengelegt, entfernt.
