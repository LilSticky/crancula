# Contract: Tape list ticks, the side-by-side page and the Tape spacing field

Existing test ids stay; new ones are listed here. Texts in English and German (FR-016). German: Bahn,
Bandabstand, Rollenplotter (in prose), Arbeitsbreite, Schnittproblem.

## Route

| Route | Screen | Rail |
|-------|--------|------|
| `/tapes/side-by-side?tape=<TapeId>&tape=<TapeId>…` | side-by-side page; Lanes in parameter order | no; title `TAPE.SIDE_BY_SIDE.TITLE` "Cut side by side" |

Declared in `src/app/features/tape/routes.ts` before `tapes/:id`. Unknown ids are dropped; no parameter →
the page opens with no Lanes.

## Tape list (`tape-list`)

- First column `tick`: `mat-checkbox` `tick-tape`, aria-label `TAPE.LIST.TICK` "Pick {{name}} for a
  side-by-side cut"; disabled for a Tape whose Organ is not available. Clicking it doesn't open the Tape.
- Page-head button `cut-side-by-side` (`TAPE.LIST.CUT_SIDE_BY_SIDE` "Cut side by side ({{count}})"), shown with
  one or more ticks; navigates to the route with the ids in tick order.

## Side-by-side page (`side-by-side`)

Top to bottom:

1. Page head with title and subtitle `TAPE.SIDE_BY_SIDE.SUBTITLE`; Save button `save-side-by-side`
   (`TAPE.SIDE_BY_SIDE.SAVE`), disabled while saving.
2. Roll plotter picker `side-by-side-plotter` (select): roll plotters by name only. Without any roll plotter:
   `side-by-side-no-plotter` (role `status`, `TAPE.SIDE_BY_SIDE.NO_ROLL_PLOTTER`) and link
   `side-by-side-describe-plotter` "Describe a Plotter…" to `/plotters/new` (FR-005).
3. Free width `side-by-side-free` (role `status`): "{{free}} mm of {{working}} mm free"
   (`TAPE.SIDE_BY_SIDE.FREE`), or "{{over}} mm too wide" (`TAPE.SIDE_BY_SIDE.OVER`); hidden without a plotter.
4. Drawing `side-by-side-drawing` (`role="img"`, name `TAPE.SIDE_BY_SIDE.DRAWING` "{{lanes}} Lanes, {{used}} mm
   used, {{free}} mm free"): per Lane `lane-outline` and `lane-holes` with `data-lane`, `free-band`,
   `working-width-line`; Lanes past the working width with class `overflow`. Hidden without a plotter.
5. Lane list: rows `lane` with `data-lane` = number, showing `lane-number`, `lane-tape` (name), `lane-organ`,
   `lane-width` "{{width}} mm wide", `lane-length` "{{length}} mm long"; marks `lane-problems` ("{{count}}
   Cutting Problems", `TAPE.SIDE_BY_SIDE.LANE_PROBLEMS`) and `lane-does-not-fit`
   (`TAPE.SIDE_BY_SIDE.LANE_DOES_NOT_FIT`); buttons `lane-up`, `lane-down` (disabled at the ends), `lane-remove`,
   each with an aria-label naming Lane and Tape. Empty: `side-by-side-empty` (`TAPE.SIDE_BY_SIDE.EMPTY`).
6. Add menu `add-lane` ("Add a Tape", `TAPE.SIDE_BY_SIDE.ADD`): every Tape, Organ-grouped as in the Tape list,
   as `add-lane-tape`. A Tape without an Organ is disabled with `TAPE.SIDE_BY_SIDE.NO_ORGAN` "has no Organ"; with
   a plotter, one that doesn't fit is disabled with `TAPE.SIDE_BY_SIDE.DOES_NOT_FIT` "needs {{needed}} mm, only
   {{free}} mm free" (FR-007).

All changes update drawing, free width and marks at once (computed signals).

## Save

- Refusals → the Cutting Problems dialog (`export-problem` items), no save dialog. Texts:
  `TAPE.SIDE_BY_SIDE.REFUSAL.NO_PLOTTER`, `.NO_LANE`, `.NO_ORGAN` ("Lane {{lane}}: {{tape}} has no Organ"),
  `.DOES_NOT_FIT` ("Lane {{lane}}: {{tape}} needs {{needed}} mm, only {{free}} mm free"), and per Cutting
  Problem `TAPE.SIDE_BY_SIDE.TAPE_PROBLEM` "{{tape}}: {{problem}}" around `cuttingProblemText`.
- Otherwise `plotter.saveSvg` as in [plotter-save-ipc.md](plotter-save-ipc.md); file name suffix
  `TAPE.SIDE_BY_SIDE.FILE_NAME_MORE` "and {{count}} more" / "und {{count}} weitere".

## Plotter editor and list

- `plotter-tape-spacing` (decimal input, mm, `PLOTTER.EDITOR.TAPE_SPACING` "Tape spacing"), only while
  `plotter-roll` is on; 3 in a new Plotter; hint `PLOTTER.EDITOR.TAPE_SPACING_HINT` "Blank strip between
  Tapes cut side by side". Errors `PLOTTER.ERROR.VALUE_REQUIRED`, `PLOTTER.ERROR.MUST_NOT_BE_NEGATIVE`
  with `data-path="tapeSpacing"`.
- Plotter list: a roll plotter's row also names its Tape spacing ("roll, 300 mm wide, Tape spacing 3 mm").
