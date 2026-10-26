# Contract: Plotter screens and the Tape view

Existing test ids stay; new ones are listed here. Texts in English and German (FR-026); keys under
`PLOTTER.*` and `TAPE.PLOTTER.*`. German: Plotter (Schneideplotter in prose), Arbeitsbereich, Bandstück,
Klebestelle, Klebezugabe, Schnittproblem.

## Rail and routes

| Route | Screen | Rail |
|-------|--------|------|
| `/plotters` | Plotter list | yes, icon `content_cut`, `PLOTTER.NAV` "Plotters" |
| `/plotters/new` | Plotter editor, new | no; leave guard |
| `/plotters/:id` | Plotter editor | no; leave guard |

## Plotter list (`plotter-list`)

- Page head `PLOTTER.LIST.TITLE`, subtitle `PLOTTER.LIST.SUBTITLE`; button `new-plotter` ("Describe a Plotter").
- Empty: `plotter-list-empty` with `PLOTTER.LIST.EMPTY` and the same button.
- Rows `plotter-row`, ordered by name: name, Working area ("300 × 120 mm", or "roll, 120 mm wide"), Overlap
  ("20 mm", none for a roll plotter); a row opens the editor; menu with `remove-plotter`, which asks through
  the shared confirm dialog (`PLOTTER.REMOVE.*`).
- Load problem `plotter-load-problem` as on the Organ list.

## Plotter editor (`plotter-editor`)

- Fields `plotter-name`, `plotter-format` (select with only "SVG", chosen, FR-001), `plotter-working-width`,
  `plotter-roll` (slide toggle "Roll plotter (cuts any length)"), and unless roll: `plotter-working-length`,
  `plotter-overlap` (20 mm in a new Plotter). Decimal inputs use the shared decimal-input directive (comma or
  point).
- Errors under the field the violation's path names: `PLOTTER.ERROR.NAME_REQUIRED`, `VALUE_REQUIRED`,
  `MUST_BE_POSITIVE`, `OVERLAP_NOT_BELOW_WORKING_LENGTH` ("The Overlap must be shorter than the working length").
- `save-plotter` (disabled while invalid); after saving, back to the list. Leaving with changes asks through
  the shared leave-unsaved dialog, naming the fields with problems.

## Tape view side panel: Plotter section (`plotter-section`)

Below the Tape section.

- `plotter-picker` (select): "No Plotter" (`TAPE.PLOTTER.NONE`) and every Plotter by name. Picking writes the
  preference; allowed while the Preview plays and while editing is paused.
- `plotter-describe` link "Describe a Plotter…" (`TAPE.PLOTTER.DESCRIBE`), always to `/plotters/new` (FR-005).
- `plotter-pieces` text:
  - sheet Plotter, fits: "Cut in 3 Tape pieces" / "Fits in one Tape piece" (`TAPE.PLOTTER.PIECES`, `PIECES_ONE`);
  - roll plotter: "Roll plotter: one Tape piece" (`TAPE.PLOTTER.ROLL`);
  - no possible cut: "Can't be cut in pieces: see Cutting Problems" (`TAPE.PLOTTER.NO_JOIN`);
- `plotter-too-wide` (role `status`): "The Tape is 140 mm wide, the Plotter's working width is 120 mm"
  (`TAPE.PLOTTER.TOO_WIDE`), instead of the piece text.

## Tape drawing

- `join` per Join: a line across the Tape at the Join, `data-after` = the Column (from 1) it follows.
- `overlap` per Join: a band from the Join to the end of its Overlap, behind the Holes.
- `stretch-mark` per `no-join` Cutting Problem: a band over its Columns, `data-first`, `data-last` (from 1).
- All `aria-hidden`; the drawing's accessible name is unchanged.

## Cutting Problems list

- A `no-join` entry `cutting-problem-stretch` with `TAPE.CUTTING_PROBLEM.NO_JOIN`: "Columns {{first}}–{{last}}
  are longer than the working length of {{plotter}} ({{length}} mm) with no place for a Join". Choosing it
  scrolls the stretch's first Column into view and selects nothing.
- The count line counts Holes with problems plus stretches (`TAPE.CUTTING_PROBLEMS.COUNT`).

## Export

- Refusal: the existing `export-problem` items, plus `TAPE.EXPORT.TOO_WIDE` first when too wide.
- Several pieces: snackbar `TAPE.EXPORT.PIECES_SAVED` "Saved {{count}} files in {{folder}}"; failure
  `TAPE.EXPORT.PIECES_FAILED` "Couldn't save {{file}}: {{reason}}" with Retry.
- File label `TAPE.EXPORT.PIECE_LABEL` "{{number}} of {{count}}" / "{{number}} von {{count}}".
