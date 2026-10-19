# Contract: Tape view editing (UI)

What the user can do in the Tape view and what the tests observe. Decisions and alternatives:
[research.md](../research.md) R6–R12. Test ids are the hooks for component and e2e tests.

## Pointer (Tape drawing)

| Gesture | Target | Outcome | Undo steps |
|---------|--------|---------|-----------|
| click | Hole (`data-testid="hole"`) | selects it (unchanged) | 0 |
| press + move ≥ 4 px + release | Hole body | `moveHole` to the snapped Column and row under the pointer (delta from the press point); Hole selected | 1 |
| press + move + release | handle at the start or end of the selected Hole (`data-testid="hole-handle"`, `data-end="start"\|"end"`) | `changeHoleLength`: that end follows the pointer; the other stays; ≥ 1 Column; start ≥ Column 1 | 1 |
| double-click | empty spot of a row | `addHole` for that row's Pipe at that Column; new Hole selected | 1 |
| Escape during a drag | — | drag cancelled; Tape unchanged | 0 |
| release on a refused position | — | Tape unchanged; snackbar names the Hole in the way | 0 |

- While dragging, the drawing shows the would-be result; a refused position shows the Hole with
  the `refused` class (oxblood outline) at the pointer.
- Near the stage's left or right edge (24 px) the stage scrolls during a drag.
- Cursor: `grab` over a Hole body, `grabbing` while dragging, `ew-resize` over a handle.

## Keyboard (focus on the Tape drawing, `role="application"`)

| Keys | Outcome | Edit |
|------|---------|------|
| ← → ↑ ↓, Enter, Space, Escape | selection as today | — |
| Alt + ← / → | selected Hole one Column earlier / later | `moveHole` |
| Alt + ↑ / ↓ | selected Hole to the row above / below | `moveHole` |
| Shift + ← / → | end one Column earlier / later | `changeHoleLength` |
| Alt + Shift + ← / → | start one Column earlier / later | `changeHoleLength` |
| Delete, Backspace | remove; select next Hole of the row, else previous, else none | `removeHole` |

All with `preventDefault()`. Without a selection, edit keys do nothing. A clamped key (start
already at Column 1, Hole already 1 Column long) does nothing; a refused key shows the snackbar.

## Keyboard (anywhere in the Tape view except text fields)

| Keys | Outcome |
|------|---------|
| Ctrl + Z (⌘ Z on macOS) | undo |
| Ctrl + Y, Ctrl + Shift + Z (⌘ Shift Z on macOS) | redo |

Handled on the Tape view's host element with `preventDefault()`, so the Edit menu's text undo
doesn't also run. In `input`/`textarea` the field keeps its own undo.

## Controls

| Control | Test id | Behaviour |
|---------|---------|-----------|
| Undo button (page head, `mat-icon-button`, icon `undo`) | `undo` | disabled when nothing to undo (FR-015); tooltip and `aria-label` "Undo (Ctrl+Z)" / "Rückgängig (Strg+Z)" |
| Redo button (icon `redo`) | `redo` | disabled when nothing to redo |
| Side panel "Add a Hole" | `add-hole` | Pipe select (`add-hole-pipe`, Organ's Pipes by note name), Column field (`add-hole-column`, from 1), button (`add-hole-submit`); prefilled from the selection; error text under the field when the Column is covered or not a whole number ≥ 1; after adding, focus returns to the drawing |
| Side panel "Cutting Problems" | `cutting-problems` | heading with the count (`cutting-problems-count`); "None" when 0; one entry per marked Hole (`cutting-problem`), a button that selects the Hole and scrolls it into view; Holes without a Pipe as plain text |
| Mark on a Hole | class `cutting-problem` on a ring (`data-testid="hole-mark"`) | dashed oxblood ring around every Hole with a Cutting Problem, in the visible range |
| Selected Hole | unchanged + key help line (`hole-keys`) | warnings name the Cutting Problems with mm values, as today |

## Messages (en / de, new keys)

| Key | English |
|-----|---------|
| `TAPE.EDIT.UNDO` / `REDO` | Undo / Redo |
| `TAPE.EDIT.UNDO_TOOLTIP` / `REDO_TOOLTIP` | Undo ({{shortcut}}) / Redo ({{shortcut}}) |
| `TAPE.EDIT.REFUSED_OVERLAP` | The Hole would overlap the Hole of {{note}} at Column {{column}}. |
| `TAPE.EDIT.KEYS` | Alt+arrows move it, Shift+arrows move its end, Alt+Shift+arrows its start, Delete removes it. |
| `TAPE.ADD_HOLE.TITLE` / `PIPE` / `COLUMN` / `SUBMIT` / `COVERED` / `COLUMN_INVALID` | Add a Hole / Pipe / Column / Add Hole / A Hole of {{note}} already covers Column {{column}}. / Enter a whole Column number from 1. |
| `TAPE.CUTTING_PROBLEMS.TITLE` / `COUNT` / `COUNT_ONE` / `NONE` | Cutting Problems / {{count}} Holes can't be cut / 1 Hole can't be cut / None |
| `TAPE.CUTTING_PROBLEM.NO_PIPE` / `TOO_SHORT` / `TOO_CLOSE` | moved from `TAPE.EXPORT.PROBLEM_*`, same texts |
| `TAPE.CUTTING_PROBLEM.TOO_CLOSE_PREVIOUS` | {{note}} at Column {{column}}: the gap to the previous Hole at Column {{previous}} is {{gap}} mm, the Minimum Gap is {{minimum}} mm. |

German follows the dictionary (Loch, Pfeife, Spalte, Schnittproblem, Mindestlochlänge,
Mindestabstand). `npm run i18n:check` proves parity.

## Persistence

Every applied edit, undo and redo calls `TapeLibrary.update(tape)` once, which saves through
`tapes:save` (unchanged channel and payload). A failed save shows in the status line as today.
