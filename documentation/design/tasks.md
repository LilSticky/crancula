# Applying the design guide: tasks

Issue [#59](https://github.com/LilSticky/crancula/issues/59). Spec: [DESIGN-GUIDE.md](../DESIGN-GUIDE.md)
and [theme.scss](theme.scss). Loop per task: failing test → implementation → review; cheapest test
level first (`tdd` skill, test pyramid). Tick a task once its tests are green.

## #62 Theme and fonts

- [x] **D1** Fonts as a node unit test, then the files. A Vitest node test (`scripts/styles.spec.ts`,
  add `scripts/**/*.spec.ts` to `vitest.node.config.ts`) proves: every `url()` in
  `src/styles/_fonts.scss` points to an existing file in `src/fonts/`; `@font-face` rules exist for
  `Libertinus Serif` (600) and `Noto Sans` (400–600, latin + latin-ext ranges like Roboto today) and
  `Material Icons`; no `Roboto` face is left; every bundled family has its licence text in
  `src/assets/fonts/` (`OFL-LibertinusSerif.txt`, `OFL-NotoSans.txt`, `LICENSE-MaterialIcons.txt`).
  Then bundle the woff2 files from the `@fontsource/libertinus-serif` and `@fontsource/noto-sans`
  packages (copy the files; do not add the packages as dependencies) and remove the Roboto files.
- [x] **D2** Theme as a node unit test, then `src/styles.scss`. The same spec compiles
  `src/styles.scss` with `sass` (load path `node_modules`, `src/`) and asserts: `color-scheme: light dark`
  on `html`; `--mat-sys-surface` and `--mat-sys-primary` use the `light-dark()` values of
  `documentation/design/theme.scss`; the typography tokens name `Noto Sans` (plain) and
  `Libertinus Serif` (brand); no `Roboto`. Then generate `src/styles/_theme-colors.scss` with
  the `theme-color` schematic command in `theme.scss`, and move `theme.scss` into `src/styles.scss`.
  Keep `.cranc-form-section` until #64 restyles the Organ editor. The scheme toggle is #63; the
  scheme follows the system until then.
- [x] **D3** e2e: update `e2e/fonts.spec.ts` to expect Noto Sans, Libertinus Serif and Material
  Icons loaded from the app (no Roboto). Run it once, then the full `npm run e2e` before the PR.
- [x] **D4** `npm run ux:screens`, `ux-review` of the result; record the score in STATUS.

## #63 Shell and navigation

Guide sections "Layout and navigation", "Component usage" and "Accessibility commitments"; reference
mockup `variants/a-workshop/mockup.html` (rail, page head, action bar). Design choices made here
(not domain): the scheme toggle has three states, System, Light and Dark, and is remembered in
`localStorage` (`crancula.scheme`) like the language (`crancula.language`).

- [x] **S1** Organs is the start page; the Overview page goes. Unit: `''` redirects to `organs`;
  no `home` route; the brand links to `/organs`. Remove `HomePage`, `PAGES.HOME.*` keys (en + de),
  and the e2e "shows the home page title" (replace it with "opens on the Organ list").
- [x] **S2** Scheme. A `SchemePreference` (`'system' | 'light' | 'dark'`) service in
  `src/app/features/shared/`: reads and writes `crancula.scheme`, sets class `cr-light` or `cr-dark`
  on `<html>` (none for System). Unit spec with jsdom.
- [x] **S3** Rail component `cranc-rail` replaces `cranc-navbar`: brand, `mat-nav-list` with Organs
  (icon `piano`) and Tapes (icon `receipt_long`), active item with `aria-current="page"`; at the
  bottom the language toggle (keeps `data-testid="language-switch"`, `data-language`, the existing
  persistence and `api.app.setLanguage`), the scheme toggle (`data-testid="scheme-switch"`, three
  icon toggles with labels), and "Saved on this computer". Class `cr-rail` (walnut tokens in
  `styles.scss`). Component spec.
- [x] **S4** `AppComponent` shell: `mat-sidenav-container`, `mat-sidenav` mode `side`, always open,
  196 px; below 1180 px an 84 px icon rail with tooltips (`BreakpointObserver`), labels hidden.
  Content area padding 32 px (24 px below 1180 px). Component spec for both widths.
- [x] **S5** Shared `cranc-page-head` (serif `h1` title, optional one-sentence subtitle, projected
  actions on the right) and `cranc-action-bar` (sticky bottom; projected state left, actions right).
  Component specs. Use the page head on every page now (Organ list, Organ editor, Tape list, Bring
  a Song onto a Tape, Tape view, not found); the action bar is adopted in #64.
- [x] **S6** e2e: update tests that used the top navbar; one e2e that the window starts on the
  Organ list with the rail and that the scheme choice survives a restart. Full `npm run e2e`.
- [x] **S7** `npm run ux:screens` (drop `01-home`; capture the dark scheme and the 1024×700 window), `ux-review`;
  score into STATUS.

## #64 Organ editor

**Depends on [#74](https://github.com/LilSticky/crancula/issues/74), merged first:** Border is no longer entered but
derived, border = (tape width − row span) / 2 on each side, so the rows are always centred; the
Organ is invalid when the derived border would be negative; snapshot migration and dictionary
there. The tasks below assume that change is on `main`.

Guide sections "Rules all variants agreed on", "Screens → Organ editor", "Spacing and density",
"Layout and navigation" (1024×700), "Component usage", "States" and "Accessibility commitments";
reference mockup `variants/a-workshop/mockup.html` (screens `organ-editor` and `organ-editor-error`;
where they differ, the guide wins: the error summary sits at the top of the form, not in the action
bar). Also fixes ux-review findings 2, 3, 4, 8 and 10 for the editor and the issue comment (German
Minimum Hole Length shows `2.5`). The fit check works from `rowSpan` and `border` (#74)
(`api/organ/organ.ts`), the derived border and the violation `validateOrgan` reports for a negative
border; no new rule and no new term (the UI uses a sentence only).

Design choices made here (not domain):
- **Decimal input:** mm fields are text inputs (`inputmode="decimal"`, `matTextSuffix` "mm"). Both
  `,` and `.` are read as the decimal separator in either language; no thousands separators.
  Values are shown with the language's separator (2.5 / 2,5) whenever the field is not focused;
  while typing, the text stays as typed. Pipe notes stay whole numbers (`inputmode="numeric"`).
- **Save** is enabled whenever there is something to save (a new Organ, or changes). It is
  disabled only with a visible reason in the action bar: "No unsaved changes" or "Saving…".
- **Pressing Save with problems** shows every message (also missing values never touched), opens
  the error summary at the top of the form and moves focus to it; the summary stays while problems
  remain and goes once there are none. The action bar then shows "N problems prevent saving".
- **Unsaved state** names the changed fields by label in reading order ("Unsaved changes: Hole
  diameter, Pipes"); any change to the Pipes counts as "Pipes".
- **Discard changes** (action bar, text button) shows only while there are unsaved changes; it
  returns to the last saved version (empty fields for a new Organ) without a dialog.
- **Tape width too small:** the message lives in the fit check line (icon and numbers); the Tape
  width field shows the error outline only, and the summary entry "Tape width" focuses it.
- **Subtitle:** a new Organ says "Not saved yet"; a stored one "31 Pipes, F3–B5" (lowest and
  highest note).
- **Leave dialog** keeps its rules; the buttons become Keep editing (filled, initial focus) and
  Discard changes (text); the test ids `stay` and `discard` stay.

Every task that adds or changes UI text adds the keys to `en.json` and `de.json`.

- [x] **E1** Decimal numbers per language, unit. A pure helper in `src/app/features/shared/`
  (`format-number.ts`): `formatNumber(2.5, 'de')` → `2,5`, `'en'` → `2.5`, no trailing zeros
  (`120`, `3,5`); `parseDecimal('2,5')` and `parseDecimal('2.5')` → 2.5, `''` → `null`; `'2,5,1'`,
  `'1.000,5'` and `'abc'` → not a number. Spec first, then the helper.
- [x] **E2** mm fields, component. Spec: Tape width, Hole diameter, Spacing between rows and Minimum
  Gap are text inputs (there is no Border input any more) with `inputmode="decimal"` and a visible "mm" suffix; the labels have
  no "(mm)"; a stored 2.5 shows `2,5` in German and `2.5` in English; typing `2,` keeps `2,` in the
  field; `2,5` stores 2.5; `abc` shows "Enter a number." as today. Then bind the fields through E1
  (check the signal-forms parser hook with the Angular MCP `search_documentation` first, else a
  small directive) and update the label keys.
- [x] **E3** Read-only Minimum Hole Length, component. Spec: shows the hole diameter with the
  language's separator (`2,5` in German: the issue comment), the "mm" suffix and the hint "Equals
  the hole diameter"; the input is `readonly` and carries class `cr-readonly`. Then the template
  and the class in `styles.scss` (dashed outline, Ink 2 text, transparent fill).
- [x] **E3b** Read-only Border, component. Spec: a read-only field Border (`data-testid="border"`,
  class `cr-readonly`, "mm" suffix, hint "On each side, the rows are centred") shows the derived
  border of #74: `6.25` for the Street organ (120 mm, 31 rows at 3.5 mm, hole 2.5 mm),
  `6,25` in German; empty while tape width, hole diameter, spacing or the Pipes are missing, or
  while the derived border is negative (the fit check, E5, says why). Then the field.
- [x] **E4** Two sheets, component. Spec: a Tape Bed sheet (`data-testid="tape-bed-sheet"`, serif
  sheet title "Tape Bed") holds Name (full width), then Tape width, Hole diameter, Spacing between rows,
  Minimum Gap and the read-only Border and Minimum Hole Length in two columns; a
  Pipes sheet (`data-testid="pipes-sheet"`) has a head with the title, the Pipe count and Add Pipe
  (text button). Then `mat-card appearance="outlined"` sheets in a grid (392 px + 1fr, gap 20 px;
  340 px below 1180 px) and the fields in a two-column grid with a 20 px row gap (fixes the clipped
  floating labels, ux-review 4). Remove `.cranc-form-section` if nothing uses it any more.
- [x] **E5** Fit check, component. Spec with the Street organ: under the Tape Bed fields a line
  `data-testid="fit-check"` reads "31 rows take 107.5 mm of the 120 mm tape width, a border of
  6.25 mm on each side" (German with commas); with tape width 100 the derived border would be
  negative and the line becomes an error (icon, oxblood, the 107.5 mm the rows take and the 100 mm
  tape width), the Tape width field gets the error outline but no second message; with a Tape Bed
  value missing or no Pipes the line is absent. The numbers come from `rowSpan` and `border` (#74) and the
  derived border, formatted with E1; a sentence only, no new names in code.
- [x] **E5b** Singular texts, component. Spec: one Pipe shows "1 Pipe" in the Pipes sheet head and the fit check says "1 row takes …" (German "1 Pfeife", "1 Reihe belegt …"). Then separate keys for one and many.
- [x] **E6** Tape Bed drawing, component. Spec: an SVG under the fields drawn from the values: the
  Tape to scale, the derived border on both edges, one line per row centred between them, row 1
  nearest the top edge (as the Tape is drawn); a text alternative names tape width, border and
  rows; absent while a value is missing or the border would be negative. No Holes.
- [x] **E7** Pipe rack order, unit. A pure helper `pipe-rack.ts` next to the editor:
  `rackColumns(pipeCount, columns)` gives the rows per column, read down then across: 31 in 3 →
  11, 11, 9; 31 in 2 → 16, 15; 0 → none. Spec first.
- [x] **E8** Pipe rack grid, component. Spec: with 31 Pipes the rack has 3 columns
  (`data-testid="rack-column"`) and row 12 is the first of column 2; each column has the header
  "Row", "MIDI note"; each Pipe row shows row number, note input, note name (naturals bold, sharps
  regular with class `sharp`) and a menu button; a drop still reorders (existing drag spec). Then
  one `cdkDropList` with `cdkDropListOrientation="mixed"` over a column-flow CSS grid (rows per
  column from E7), 34 px rows, sticky column headers.
  Done differently: one `cdkDropList` per `rack-column` inside a `cdkDropListGroup` (data = the column's first row,
  `dropPipe` maps to global rows), because the specs need each row inside its column element and `mixed` over one
  grid would not.
- [x] **E9** Pipe row menu, component. Spec: the menu button has the aria-label and `matTooltip`
  "Move or remove the Pipe in row N"; the menu holds Move up (disabled on row 1), Move down
  (disabled on the last row) and Remove Pipe, each doing what today's icon buttons do (rewrite
  those specs to go through the menu). Then replace the three icon buttons.
- [x] **E10** Moving Pipes by keyboard, component. Spec: Alt+↑ / Alt+↓ in a note input moves its
  Pipe one row and keeps the focus on that Pipe's input in its new row; nothing happens on the
  first / last row. Then the key handler.
- [x] **E11** Compact rack below 1180 px, component. Spec with a faked `BreakpointObserver` (as the
  shell spec does): 2 rack columns and 30 px rows (class `compact`); 3 columns above. Then the
  breakpoint signal.
- [x] **E12** Changed fields, unit. A pure helper in `organ-form.ts`: `changedFields(saved, draft)`
  returns the changed paths in reading order (`name`, the Tape Bed fields, `minimumGap`, and
  `pipes` once for any Pipe change); nothing for equal drafts. Spec first.
- [x] **E13** Action bar, component. Spec: Save sits in `cranc-action-bar` (label "Organ
  actions"), not in the page body; the state reads "Unsaved changes: Hole diameter" (oxblood dot
  plus text) after editing the hole diameter, "No unsaved changes" with Save disabled when nothing changed,
  "Saving…" with Save disabled while writing; Save is enabled on an untouched new Organ. Rewrite
  the "the Save button" specs that expect Save disabled for new or invalid Organs. Then adopt the
  bar.
- [x] **E14** Discard changes, component. Spec: the button shows only with unsaved changes;
  pressing it restores the last saved version (empty fields for a new Organ), `unsavedChanges()`
  becomes `null`, nothing is written. Then the button.
- [x] **E15** Error summary content, unit. A pure helper in `organ-form.ts`: from `organProblems`
  the distinct fields with problems in reading order, each with its label ("Tape width", "Row 3" for
  `pipes.2.note`, "Pipes" for `pipes`) and the path to focus. Spec first.
- [x] **E16** Error summary behaviour, component. Spec: pressing Save on an invalid Organ writes
  nothing, shows every field message (also untouched missing values), and shows
  `data-testid="error-summary"` at the top of the form ("3 problems prevent saving: Tape width,
  Hole diameter, Row 3") with the focus on it; each entry is a link that focuses its field (`pipes`
  focuses Add Pipe); the action bar shows "3 problems prevent saving"; the summary goes once all
  are fixed. Then the summary (oxblood with icon, `role="alert"`) and a "save attempted" signal
  that `shownMessages` and `ShownViolationMatcher` honour.
- [x] **E17** Delete in the page head, component. Spec: a stored Organ has Delete Organ as an
  oxblood text button in the page head (`data-testid="delete-organ"`), not in the action bar; a new
  Organ has no Delete. The deleting specs keep passing. Then move the button.
- [x] **E18** Subtitle, component. Spec: a new Organ's page head says "Not saved yet"; the Street
  organ's says "31 Pipes, F3–B5"; after the first save the subtitle switches. Then the subtitle.
- [x] **E19** "Organ saved", component. Spec: a successful save opens a `MatSnackBar` "Organ
  saved"; a failed write does not. Then the snackbar.
- [x] **E20** Leave dialog, component. Spec: Keep editing is the filled button with initial focus,
  Discard changes a text button. Then the template and the keys.
- [x] **E21** e2e, existing tests. Update `e2e/support/organ-editor.ts`, `organ-edit`,
  `organ-leave` (Save is no longer disabled for a duplicate Pipe: press it and assert the error
  summary instead), `organ-german` and the Tape specs that move or remove Pipes, to the row menu,
  the page-head Delete and the new dialog labels. Run them.
- [x] **E22** e2e, German decimals. Extend `organ-german.spec.ts`: typing `2,5` and `3,5` saves the
  Organ; after a restart the fields show `2,5` and `3,5`, Minimum Hole Length `2,5`, Border `6,25`,
  and the fit check uses commas. Real Electron, because the language goes through the main process.
- [x] **E23** e2e, one screen. New `organ-layout.spec.ts` with the Street organ: at 1280×800 the
  document does not scroll, the rack has 3 columns and the action bar is in view; at 1024×700 the
  document does not scroll, the rack has 2 columns, only the Pipes sheet scrolls, and the Tape Bed
  sheet and the action bar stay in view; no two Tape Bed field boxes overlap. Needs real layout.
- [x] **E24** Full `npm run e2e`, `npm run test`, `npm run lint`, `npm run i18n:check`. Then
  `npm run ux:screens` (03 shows the error summary after pressing Save; add the editor with
  unsaved changes and the editor at 1024×700), `ux-review`; score into STATUS.

### Decided (2026-10-15)

1. **Fit check:** no new term for the check itself. Its lengths are the new dictionary terms Row Span and Border (#74); code uses `rowSpan` and `border` from `api/organ/`. A Border of 0 is valid; the derived Border is shown read-only.
2. **Border is derived:** border = (tape width − row span) / 2 on each side, so the rows are always
   centred and border + rows + border = tape width; the check fails when the derived border would
   be negative. Row 1 is nearest the top edge, as the Tape is drawn. Removing the Border input,
   deriving it, the snapshot migration and the dictionary are #74, merged
   before #64 (see the top of this section).

## #65 Tape view

**Depends on [#78](https://github.com/LilSticky/crancula/issues/78), merged first:** the Lead-in
(dictionary, German Vorlauf) becomes an Organ setting in mm (`organ.leadIn`; 0 means none; Organs
saved before it load with 0), with its domain, snapshot migration and Organ editor field there. The
tasks below assume that change is on `main`.

Guide sections "Screens → Tape view", "The Tape visualisation", "Colour roles", "Layout and
navigation" (1024×700), "Component usage", "States" (Later release) and "Accessibility
commitments"; reference mockup `variants/a-workshop/mockup.html` (screen `tape-view`; where it
differs, the guide wins: Export is a disabled outlined button with a visible sentence, not a filled
one, and the side panel has three sections, not only the Import Summary). Fixes ux-review finding 1
(the Tape is small and sits under a text block, no scale, no Organ in the head). Uses the shared
`formatNumber`, `LanguagePreference` and `cranc-page-head` from #63/#64.

Hole placement follows the dictionary and #74, no new rule: rows are centred across the Tape, row 1
(the first Pipe of the Organ) nearest the top edge; the Border on each side is `border(organ)`; the
centre of row *r* (from 1) sits at Border + hole diameter / 2 + (*r* − 1) × spacing between rows
from the top edge. A Hole is the slot that gets cut (dictionary): from the start of its first
Column to the end of its last Column, `start × columnLength` to `(start + length) × columnLength`
mm after Column 1's start, one hole diameter wide, with half-circle ends inside that length; the
view draws exactly this shape. Before Column 1 lies the Lead-in, `organ.leadIn` mm of blank Tape
with an angled start; nothing when it is 0. Lengths along the Tape (ruler, pointer, inspector)
count from the start of Column 1; the ruler shows no numbers over the Lead-in. The Tape's width and rows come from its Organ as it
is now (a Tape stores no Tape Bed); Holes of Pipes no longer on the Organ stay undrawn, as today.

Design choices made here (not domain):
- **Zoom** is a `mat-button-toggle-group` Whole Tape, 1:1, 2:1 (the guide's labels; the issue's
  "Fit" is not used because Fit is a dictionary term). 1:1 is the default: 1 mm = 96 / 25,4 px
  (≈ 3,78). Whole Tape fits the Tape's length into the stage width. The zoom is not remembered.
- **Columns count from 1 in the UI**, as the Import Summary does today: a Hole with `start` 64 and
  `length` 15 reads "Columns 65–79". The pointer position names the Column under the pointer and
  where it starts: "Column 72 at 177,5 mm" (71 × 2,5).
- **Column lines** every 8 Columns, stronger every 32; **Column numbers** under the Tape at every
  8-Column line (1, 9, 17, …), only at the 32-Column lines when 8 Columns are narrower than 40 px.
- **Ruler** in brass: a tick every mm, longer every 5 mm, a number every 10 mm; ticks are drawn
  with an SVG `<pattern>` so a long Tape stays a small DOM.
- **Only visible Columns are rendered.** At 1:1 a long Tape is metres wide, so Holes, Column lines,
  Column numbers and ruler numbers are drawn only for the visible window of `tape-scroll` plus one
  window on each side; the SVG keeps the full width so scrolling and the overview work. SC-006
  (open within 2 s, scroll to the end) stays as it is and is not relaxed.
- **Selection** is read-only (the view still offers no control that changes the Tape). Click a Hole
  to select it; with the Tape focused, ← / → select the previous / next Hole in the same row,
  ↑ / ↓ the Hole in the row above / below whose start is nearest; Escape clears the selection. The
  selected Hole gets the Select ring and is scrolled into view.
- **Side panel** (300 px, `mat-card appearance="outlined"`), top to bottom: Selected Hole (empty:
  "Select a Hole to see where it is and how long it is."), Tape (Organ, Column length, Columns,
  length, Lead-in, Holes, Parts on the Tape: the selected-Parts list moves here from the page
  body), Import Summary (only with the navigation state, dismissed with a close button; not stored,
  so it is gone when the Tape is opened again). The Import Summary shows the Transposition, the
  Notes moved by octaves, the Unplayable Notes and the Holes fixed, nothing else (dictionary).
- **Status line** shows the store's save state: "Saved", or the save problem if the last write of
  the Tape library failed (the Tape view itself writes nothing).
- **Below 1180 px** the side panel collapses behind a toggle button in the page head ("Tape
  details"); stage, overview strip and status line stay visible.

Keep the test ids e2e uses: `tape-name`, `row-label`, `hole` with `data-row` / `data-start`,
`tape-scroll`, `import-summary`, `selected-part`. Every task that adds or changes UI text adds the
keys to `en.json` and `de.json` (German: Lochband).

- [x] **V1** Tape geometry, unit. A pure helper `tape-geometry.ts` next to the view:
  `tapeGeometry(tape, organ)` gives, in mm, the Lead-in, the Tape length (from Column 1) and width,
  the Border, the centre of each row and one slot per drawn Hole (`x`, `y`, `width`, `height`,
  `radius` = hole diameter / 2, plus `row`, `start`), with `x` counted from the start of Column 1.
  Spec with the Street organ (120 mm, 31 rows at 3,5 mm, hole 2,5 mm, Column 2,5 mm): Border 6,25;
  row 1 centre 7,5 mm from the top edge, row 31 at 112,5 mm, so both edges keep 6,25 mm; a Hole at
  `start` 64, `length` 15 in row 25 is `x` 160, `width` 37,5, `y` 90,25 (centre 91,5), `height` 2,5; Holes of a
  Pipe no longer on the Organ are left out; a reordered Organ moves the Hole with its Pipe. Uses
  `border` from `api/organ/`. Spec first.
- [x] **V2** Zoom scale, unit. `pixelsPerMillimetre(zoom, stageWidth, tapeLength)` in the same
  folder: `'1:1'` → 96 / 25,4, `'2:1'` → twice that, `'whole'` → stage width / Tape length. Spec
  first.
- [x] **V3** Ruler and Column marks, unit. Pure helpers: `columnLines(length)` (every 8th Column,
  `strong` every 32nd, none at or past the end), `columnNumbers(length, columnWidthPx)` (the
  1-based numbers of the design choice above) and `rulerNumbers(lengthMm)` (0, 10, 20, … up to the
  length). Spec first.
- [x] **V4** Note-name gutter, unit. `gutterLabels(pipes, rowPitchPx)`: one entry per row with the
  note name and `sharp`; below 14 px row pitch sharps keep their entry but no text. Spec first
  (Street organ at 1:1: 3,5 mm ≈ 13,2 px, so F#3 has no text, F3 has).
- [x] **V5** Tape at true millimetres, component. Rewrite the "drawing the Tape" specs (drop
  `TAPE_COLUMN_WIDTH` / `TAPE_ROW_HEIGHT`): at 1:1 the Tape body (class `tape`) is Tape length ×
  3,78 px wide and tape width × 3,78 px high (with a Lead-in of 0); each `hole` rect sits at V1's
  slot × scale, with `data-row` and `data-start` as today, `rx` = `ry` = height / 2, so a Hole of
  one Column at Column length = hole diameter is a circle; the body is manila with a 1 px darker
  edge; two faint Border lines (`data-testid="border-line"`) at the Border from each edge; row
  guides faint, stronger for naturals. Then the template, and the tokens `--cr-manila`,
  `--cr-hole`, `--cr-select`, `--cr-brass` in `styles.scss` (`light-dark()`; manila and Hole the
  same in both schemes).
- [x] **V5b** Lead-in, component. Spec: with `organ.leadIn` 30 the body starts 30 × 3,78 px before
  Column 1 with an angled start (`data-testid="lead-in"`, a path whose top edge is shorter than its
  bottom), carries no Holes and no Column lines, and every Hole moves right by the Lead-in; with
  `leadIn` 0 there is no `lead-in` element and the body starts square at Column 1. Then the path.
- [x] **V6** Column lines, numbers and ruler, component. Spec: `column-mark` lines from V3 (strong
  ones with class `strong`), `column-number` texts under the Tape (1, 9, 17, …), a brass ruler on
  top with `ruler-number` texts every 10 mm from Column 1 (0 at Column 1's start) and a tick
  pattern. Then the template.
- [x] **V6b** Visible window, unit then component. A pure helper `visibleColumns(scrollLeft,
  clientWidth, scale, geometry)` → the first and last Column to render (the visible window plus one
  window on each side, clamped to the Tape). Spec first. Then a component spec with a 5-minute
  Tape (thousands of Holes): only Holes, `column-mark`, `column-number` and `ruler-number` inside
  that range are in the DOM; the SVG keeps the full width; scrolling `tape-scroll` to the end
  renders the last Holes. Then the windowing (a `scrollLeft` signal, no change to the Tape).
- [x] **V7** Sticky note-name gutter, component. Spec: one `row-label` per row from V4, each at its
  row's centre (V1 × scale), naturals bold and sharps with class `sharp`; the gutter stays put while
  `tape-scroll` scrolls sideways. Then the gutter.
- [x] **V8** Zoom, component. Spec: a toggle group (`data-testid="zoom"`, `aria-label` "Zoom") with
  Whole Tape, 1:1 (pressed by default) and 2:1; 2:1 doubles the Tape body's width; Whole Tape makes
  it the stage width (faked `ResizeObserver` width); hole rectangles follow. Then the toggle and a
  `zoom` signal.
- [x] **V9** Overview frame, unit. Pure helpers: `overviewFrame(scrollLeft, clientWidth,
  scrollWidth, overviewWidth)` → the framed `x` and `width`; `scrollLeftFor(clickX, overviewWidth,
  scrollWidth, clientWidth)` centres the clicked point, clamped to 0 and the end. Spec first.
- [x] **V10** Overview strip, component. Spec: an SVG `data-testid="overview"` under the stage at
  stage width draws the whole Tape (body and Holes, no ruler) with a brass frame
  (`overview-frame`) from V9; scrolling the stage moves the frame; a click sets `tape-scroll`'s
  `scrollLeft` from V9; its `aria-label` says "Whole Tape, the framed part is shown above". Then the
  strip.
- [x] **V11** Page head, component. Spec: title the Tape name (`tape-name`); subtitle "For the
  Street organ. 192 Columns of 2.5 mm, 480 mm of Tape." (German with commas via `formatNumber` and
  `LanguagePreference`; one Column in the singular); actions: the zoom (V8) and Export for the
  Plotter as a disabled outlined button (`data-testid="export"`, icon `content_cut`) with the
  visible text "Export comes in a later release" beside it (`data-testid="export-later"`). The
  "offers no control that changes the Tape" spec keeps passing. Then the head.
- [x] **V12** Layout, component. Spec: stage (ruler, Tape, numbers), overview strip and status line
  sit left, the side panel (`data-testid="side-panel"`) right; the parts list no longer sits in the
  page body. Then a grid (1fr + 300 px, gap 20 px) that fills the content height, with only
  `tape-scroll` scrolling sideways.
- [x] **V13** Tape section, component. Spec: the side panel's Tape section
  (`data-testid="tape-section"`) lists Organ (a link to the Organ editor), Column length "2.5 mm",
  Columns "192", length "480 mm", Lead-in "30 mm" (or "None" for 0), Holes "64" and Parts on the
  Tape (`selected-part` entries, names or "Part N" as today). Then the section as a `dl`.
- [x] **V14a** "Holes fixed" in code, unit. Rename what names the Import Summary's fixed Holes
  (Decided 2): `ImportSummary.holeChanges` → `holesFixed`, type `HoleChange` → `HoleFix` (in
  `api/tape/import-summary.ts`, `hole-fixes.ts`, `create-tape.ts`, `api/index.ts`, `tape-i18n.spec.ts`
  and the view's `isImportSummary`); update the specs first (`create-tape.spec.ts`), then the code.
  A pure rename, no change in behaviour. The Import Summary is not stored, so no snapshot change.
- [x] **V14** Import Summary in the side panel, component. Spec (import-summary and view specs):
  the summary is the panel's third section, titled "Import Summary" (German from the dictionary),
  with a close button (`aria-label` "Dismiss"); it lists exactly Transposition, Notes moved by
  octaves, Unplayable Notes and Holes fixed (Decided 2): no `notes-on-tape` entry any more, the
  heading "Changed Holes" becomes "Holes fixed" and the test id `hole-change` becomes `hole-fixed`;
  pressing close removes the section; opened without the navigation state there is no section.
  Then the template as a `dl` and the keys (`TAPE.SUMMARY.TITLE`, `HOLE_CHANGES` → `HOLES_FIXED`,
  `HOLE_CHANGE.*` → `HOLE_FIX.*`, `NOTES_ON_TAPE` removed) in en and de. `notesOnTape` stays in
  the domain while the Tape import uses it; it is only no longer shown here.
- [x] **V15** Hole navigation, unit. A pure helper `hole-selection.ts`: `nextHole(holes, current,
  direction)` for `left` / `right` (previous / next Hole by start in the same row) and `up` / `down`
  (the Hole in the nearest row above / below that has Holes, nearest start; ties to the earlier
  start); `undefined` at the ends; with nothing selected any arrow picks the first Hole of the
  topmost row with Holes. Spec first.
- [x] **V16** Selecting a Hole, component. Spec: clicking a `hole` gives it class `selected` and
  `aria-selected="true"` (one at a time); the Tape SVG has `tabindex="0"` and the arrow keys move
  the selection by V15; Escape clears it; the selected Hole is scrolled into view. Then the
  handlers and a `selectedHole` signal (no change to the Tape).
- [x] **V17** Inspector content, unit. A pure helper `inspectHole(tape, organ, hole)`: row (from 1)
  and note name, Columns from–to (from 1), length in Columns and mm; the gap to the next Hole in
  the same row in Columns and mm, or for the last Hole of its row the space to the Tape's end
  (marked as such); and two warnings (Decided 3): `tooShort` when the Hole's length in mm is below
  the Minimum Hole Length (`minimumHoleLength(organ.tapeBed)`), `gapTooSmall` when the gap to the
  next Hole, or from the previous Hole in the row, is below the Minimum Gap. Street organ: `start`
  64, `length` 15 → Columns 65–79, 15 Columns, 37,5 mm; a one-Column Hole at Column length 2 mm is
  too short (2 < 2,5); the space to the end is not checked against the Minimum Gap. Spec first.
- [x] **V18** Selected Hole section, component. Spec: without a selection the section
  (`data-testid="selected-hole"`) shows the empty sentence; with one it shows "Row 25, F5",
  "Columns 65–79", "15 Columns, 37.5 mm" (German "37,5 mm"), "Gap to the next Hole: 4 Columns,
  10 mm" or, for the last Hole of its row, "To the end of the Tape: …"; one Column in the singular;
  each warning as oxblood text with an icon that says the numbers ("Shorter than the Minimum Hole
  Length: 2 mm of 2.5 mm", "Gap below the Minimum Gap: 1 mm of 1.5 mm",
  `data-testid="hole-warning"`); no warning element for a Hole within the limits. Then the section.
- [x] **V19** Pointer position, unit. `pointerAt(x, y, scale, geometry)` (stage pixels) → the
  Column (from 1) and the mm where it starts, and the row (from 1) with its note name when the
  pointer is within half a row spacing of a row centre; nothing outside the Tape or over the
  Lead-in. Spec first.
- [x] **V20** Status line, component. Spec: a 26 px line (`data-testid="status-line"`) under the
  overview strip shows "Column 72 at 177.5 mm" and "Row 25, F5" while the pointer is over the Tape
  (nothing otherwise), the zoom ("1:1") and the save state ("Saved"; the save problem when the Tape
  library has one); only the save state has `aria-live="polite"`. Then the line.
- [x] **V21** Text alternative, component. Spec: the Tape SVG's `aria-label` reads "Tape
  Kirmes-Walzer: 31 rows, 192 Columns, 64 Holes" (German "Lochband …"); ruler and numbers are
  `aria-hidden`. Then the label.
- [x] **V22** Compact side panel, component. Spec with a faked `BreakpointObserver` (as the shell
  spec): below 1180 px the side panel is closed behind a "Tape details" toggle button in the page
  head (`aria-expanded`); Escape closes it; above 1180 px it is always shown and the toggle is
  absent. Then the breakpoint signal.
- [x] **V23** e2e, existing tests. Update `tape-import.spec.ts` (row labels and `data-row` /
  `data-start` stay; the Import Summary is in the side panel; `hole-change` is `hole-fixed`),
  `tape-german`, `tape-restart` and the SC-006 test: the 5-minute Song now opens at 1:1 true mm,
  metres wide; it must still show its first Hole within 2 s and scroll to its end, with the
  test unchanged in its limits. If it is slow, the fix is V6b's windowing (render only the visible
  Columns), never a relaxed test. Run them.
- [x] **V24** e2e, true millimetres and one screen. New `tape-layout.spec.ts` with the Street organ
  and a short Song: at 1:1 a Hole's box is hole diameter × 3,78 px high (± 1 px) and row 1's Holes
  sit above row 2's; the gaps between the Tape edges and the outermost rows' Holes are equal (rows
  centred, the Border); with a Lead-in of 30 mm the first Column starts 30 × 3,78 px (± 1 px) after
  the Tape body's start; at 1280×800 the document does not scroll and stage, overview strip, status
  line and side panel are in view; a click at the overview's end scrolls the stage to its end;
  selecting a Hole by click and → updates the inspector; at 1024×700 the document does not scroll,
  the side panel is collapsed and overview strip and status line stay in view. Needs real layout.
- [x] **V25** Full `npm run e2e`, `npm run test`, `npm run lint`, `npm run i18n:check`. Then
  `npm run ux:screens` (08 with a selected Hole and the Import Summary, 11 dark, a new Tape view at
  1024×700), `ux-review`; score into STATUS.

### Decided (2026-10-16)

1. **Hole shape:** a Hole is cut as a slot from the start of its first Column to the end of its
   last Column, one hole diameter wide, with half-circle ends inside that length (dictionary,
   Hole). The view draws exactly what gets cut (V1, V5); binding for the export slice.
2. **Import Summary:** the panel is the dictionary's Import Summary and shows the Transposition,
   the Notes moved by octaves, the Unplayable Notes and the Holes fixed, nothing else. "Changed
   Holes" becomes "Holes fixed" in UI and code where it names this (V14a, V14).
3. **Inspector gap:** the gap to the next Hole in the same row, in Columns and mm; the last Hole of
   a row shows the space to the Tape's end. The inspector warns when the Hole is shorter than the
   Minimum Hole Length or a gap is below the Minimum Gap (V17, V18).
4. **Lead-in:** blank Tape before Column 1 with an angled start (dictionary, Lead-in; German
   Vorlauf). Its length is an Organ setting (0 = none; Organs saved before it load with 0); the
   domain and the editor field are #78, merged before #65. The view draws it from `organ.leadIn`,
   nothing when it is 0 (V5b).
5. **Zoom labels:** Whole Tape, 1:1, 2:1; not "Fit", which is a dictionary term.
6. **SC-006 stays:** the 1:1 view must open the 5-minute Song within 2 s; if needed, only the
   visible Columns are rendered (V6b). The test is not relaxed.

## #66 Organ and Tape lists

Guide sections "Screens → Organ list" and "Screens → Tape list", "Layout and navigation" (lists are
ruled ledgers, page head), "Component usage" (`mat-table`, row menu `mat-menu`, `mat-chip` for the
Organ filter), "States" (Empty) and "Accessibility commitments"; reference mockup
`variants/a-workshop/mockup.html` (screen `organ-list`: ledger rows with miniature, facts, "3 Tapes",
row menu, dashed next-step strip; where it differs, the guide wins). Fixes ux-review findings 5
(empty states are one grey line) and 6 (plain rows, bare icons, unlabelled facts). Uses the shared
`cranc-page-head`, `formatNumber`, `LanguagePreference` and `noteName`; the Pipe range is the one the
Organ editor's subtitle shows (E18). No new domain rule and no new term: the ledgers show only
values the domain already has (no created date; Decided 1).

Design choices made here (not domain):
- **Ledger:** one `mat-card appearance="outlined"` sheet per list holding a `mat-table`; rows ruled,
  44 px high (density -2), a hover tint, numbers right-aligned with `tabular-nums`; a shared class
  `cr-ledger` in `styles.scss` so both lists look alike. Column headers in Ink 2, 12 px, sentence case.
- **Rows open by their name:** the name is a real link (keyboard and screen readers); a click
  anywhere else on the row does the same; the row menu button stops the click.
- **Organ row:** miniature, name (serif) with the facts line under it, Tapes, menu. Facts: "31 Pipes,
  F3–B5. 120 mm Tape, hole diameter 2.5 mm" (German with commas; "1 Pipe, C4" for one Pipe).
- **Miniature** (132 × 60 px SVG, `aria-hidden`): the Tape Bed drawn horizontally as on the Tape,
  manila body, one faint line per row, rows centred with `border(organ)`; common scale: the widest
  tape width of the listed Organs fills 56 px, so a 70 mm Tape looks narrower than a 120 mm one.
  No Holes.
- **Tapes per Organ:** "3 Tapes", "1 Tape" as a link to the Tape list filtered by this Organ
  (`/tapes?organ=<id>`); "No Tapes" as plain text; absent while the Tape library could not be read.
- **Row menus:** a `more_vert` icon button (`aria-label` and `matTooltip` "More actions for Street
  organ") with the destructive item in oxblood: Delete Organ (the existing `OrganDeletion` flow) and
  Delete Tape (the existing confirm dialog). The Tape list's "Remove" wording becomes "Delete Tape",
  as in the guide and the confirm dialog.
- **Organ filter:** the query parameter `organ` filters the Tape list; it shows as a removable
  `mat-chip` "Street organ" above the ledger (remove `aria-label` "Show all Tapes"); an unknown id
  shows all Tapes and no chip. The import keeps its own Organ choice (#69 owns that page).
- **One primary per screen:** while a list is empty its primary button moves from the page head
  into the empty state, so it is never shown twice. Test ids `new-organ` and `new-tape` stay on the
  one button.
- **Empty states** (a paper sheet with an icon, one sentence and the button):
  Organs: "No Organs yet. Describe your Organ: its Tape Bed and Pipes." + New Organ.
  Tapes with an Organ: "No Tapes yet. Bring a Song onto a Tape." + Bring a Song onto a Tape.
  Tapes without an Organ: "No Tapes yet. A Tape is punched for one Organ: describe your Organ
  first.", "describe your Organ" a link to New Organ, + Bring a Song onto a Tape (its page explains
  the missing Organ, as today).
  Filtered without a match: "No Tapes for the Street organ yet." + the chip and the button.
- **Next-step strip** (dashed, under the Organ ledger): shown while there is at least one Organ and
  no Tape: "Your Organ is ready. Bring a MIDI Song onto a Tape for it." + Bring a Song onto a Tape
  (outlined). Hidden once a Tape exists, so it does not nag.
- **Subtitles:** Organs "Each Organ knows its Tape Bed and its Pipes. Tapes are punched for one
  Organ."; Tapes "Each Tape is punched for one Organ and holds a Song as Holes."
- **Button label** "Bring a song onto a tape" becomes "Bring a Song onto a Tape" (dictionary casing,
  as the guide writes it).
- **Order** by name, locale-aware (Decided 3): Organs by name; Tapes grouped by their Organ's name,
  then by Tape name; Tapes whose Organ is not available last. The Tape row menu holds Delete Tape
  only; Rename is a separate issue (Decided 2).

Keep the test ids e2e uses: `organ` (now on the name link), `new-organ`, `delete-organ` (now the
menu item), `tape`, `tape-name`, `tape-organ`, `tape-length-columns`, `tape-length-mm`, `open-tape`
(now the name link, `aria-disabled="true"` when the Organ is not available), `new-tape`;
`remove-tape` becomes `delete-tape`. Every task that adds or changes UI text adds the keys to
`en.json` and `de.json`.

- [x] **G1** Pipe range, unit. A pure helper `pipe-range.ts` in `src/app/features/organ/`:
  `pipeRange(organ)` gives the Pipe count and the lowest and highest note name (by MIDI note, not
  by row): Street organ → 31, F3, B5; one Pipe → 1, C4, C4. Lowest–highest only, no marker for
  skipped notes (Decided 4). Spec first, then the helper; the Organ editor's subtitle (E18) switches
  to it with its specs still green, and the list reuses its keys (`ORGAN.EDITOR.PIPES_RANGE`,
  `PIPES_RANGE_ONE`, moved to a shared key if both use them).
- [x] **G1b** Ledger order, unit. A pure helper `ledger-order.ts` in `src/app/features/shared/`:
  `byName(items, language)` sorts with `Intl.Collator(language)`; `tapesByOrgan(rows, language)`
  sorts by Organ name, then Tape name, rows without an Organ last. Spec: "Ärger" sorts with "Anton"
  before "Bach" in German; equal names keep a stable order; "Street organ"'s Tapes "B" and "a" come
  out "a", "B". Spec first.
- [x] **G2** Miniature geometry, unit. A pure helper `tape-bed-miniature.ts` next to the Organ list:
  `tapeBedMiniature(organ, widestTapeWidth, heightPx)` → the body height in px and the y of each
  row centre, rows centred with `border(organ)`, row 1 on top. Spec: the Street organ alone at
  56 px → body 56 px, row 1 at (6,25 + 1,25) × 56 / 120 = 3,5 px; next to a 140 mm Organ its body
  is 48 px. Spec first.
- [x] **G3** Organ ledger, component. Rewrite "lists the Organs by name with their Pipe count": a
  `mat-table` (class `cr-ledger`) inside an outlined `mat-card`, one row per Organ with the
  miniature (`data-testid="organ-miniature"`, `aria-hidden`, one `line` per row from G2), the name
  link (`organ`, serif, to `/organs/:id`) and the facts (`data-testid="organ-facts"`: "31 Pipes,
  F3–B5. 120 mm Tape, hole diameter 2.5 mm"; German "2,5 mm"; singular for one Pipe); a click on
  the row outside the link and the menu opens the editor; rows in G1b's order by name (and again
  after a language switch). Then the template and `cr-ledger` in
  `styles.scss`.
- [x] **G4** Tapes per Organ, component. Spec: with two Tapes of the Street organ the row shows
  "2 Tapes" (`data-testid="organ-tapes"`) as a link to `/tapes` with `organ=<id>`; one Tape
  "1 Tape"; none "No Tapes" without a link (German "2 Lochbänder", "1 Lochband", "Keine
  Lochbänder"); absent while the Tape library has a load problem. Then the cell.
- [x] **G5** Organ row menu, component. Rewrite the `delete` and `delete with Tapes` specs to go
  through the menu: the `more_vert` button has the `aria-label` and `matTooltip` "More actions for
  Street organ"; its menu holds Delete Organ (`delete-organ`, oxblood); every existing deletion
  behaviour (Tape count in the dialog, blocked while Tapes are unreadable) keeps passing. Then the
  menu, replacing the bare delete icon.
- [x] **G6** Organ page head and empty state, component. Spec: the page head has the subtitle;
  with no Organs there is no ledger, `data-testid="empty-state"` says "No Organs yet. Describe your
  Organ: its Tape Bed and Pipes." and holds the only New Organ button (`new-organ`, filled, to
  `/organs/new`); with Organs, New Organ is in the page head and there is no empty state. Then the
  template.
- [x] **G7** Next-step strip, component. Spec: with one Organ and no Tapes,
  `data-testid="next-step"` reads "Your Organ is ready. Bring a MIDI Song onto a Tape for it." with
  an outlined link to `/tapes/new`; absent with no Organ and absent once a Tape exists. Then the
  strip (dashed border, `music_note` icon).
- [x] **G8** Tape ledger, component. Rewrite "lists each Tape …" and "links the open action …": a
  `mat-table` (`cr-ledger`) with the headers Name, Organ, Columns, Length; per row (`tape`) the name
  link (`open-tape` holding `tape-name`, to `/tapes/:id`), the Organ as a link to its editor
  (`tape-organ`), the Columns "192" (`tape-length-columns`) and the length "480 mm"
  (`tape-length-mm`, decimals per language via `formatNumber`: "187.5 mm" / "187,5 mm"); a row
  click opens the Tape view; rows in G1b's order (by Organ name, then Tape name). With an unknown Organ: "Organ not available" as plain text, the name
  link `aria-disabled="true"` without a target, and a row click does nothing (rewrite the existing
  spec). Then the template.
- [x] **G9** Tape row menu, component. Rewrite the `remove` specs: a `more_vert` button ("More
  actions for Kirmes-Walzer") with Delete Tape (`delete-tape`, oxblood) opening the existing confirm
  dialog; cancel changes nothing, confirm removes the Tape; the menu has no Rename (Decided 2).
  Then the menu; the key
  `TAPE.LIST.REMOVE` becomes `TAPE.LIST.DELETE` ("Delete Tape {{name}}").
- [x] **G10** Organ filter, component. Spec with a faked `ActivatedRoute` query parameter: `organ`
  of the Street organ lists only its Tapes and shows a chip (`data-testid="organ-filter"`) "Street
  organ"; removing the chip (`aria-label` "Show all Tapes") navigates to `/tapes` without the
  parameter and lists all; an unknown id lists all and shows no chip. Then the filter (`toSignal`
  of the query parameter map).
- [x] **G11** Tape page head and empty states, component. Spec: the subtitle; with no Tapes and an
  Organ, `empty-state` says "No Tapes yet. Bring a Song onto a Tape." and holds the only `new-tape`
  (filled); with no Organ the sentence is "No Tapes yet. A Tape is punched for one Organ: describe
  your Organ first." with a link (`data-testid="empty-new-organ"`) to `/organs/new`, and `new-tape`
  is still there; filtered without a match: "No Tapes for the Street organ yet.", the chip and
  `new-tape`; with Tapes, `new-tape` is in the page head. The button reads "Bring a Song onto a
  Tape". Then the template and the keys.
- [x] **G12** e2e, existing tests. Update `organ-define` (the facts are in `organ-facts`),
  `tape-restart` (`remove-tape` → the row menu and `delete-tape`; "Organ not available" and the
  disabled name link), `tape-import`, `tape-german` and `e2e/ux/screens.capture.ts` where they click
  `organ` or `open-tape`. Run them.
- [x] **G13** e2e, lists in Electron. New `lists.spec.ts`: a fresh app shows the Organ empty state;
  after saving the Street organ the list shows its row and the next-step strip; after bringing a
  Song onto a Tape the strip is gone and "1 Tape" opens the Tape list filtered by the Street organ
  with its chip; removing the chip shows all Tapes; on a fresh app the Tape list's empty sentence
  links to New Organ. In German at 1024×700 (`resizeWindowOrSkip`) neither ledger scrolls sideways
  and no facts line overflows its cell. Needs the real stores, routing and layout.
- [x] **G14** Full `npm run e2e`, `npm run test`, `npm run lint`, `npm run i18n:check`. Then
  `npm run ux:screens` (02 and 06 empty states, 06b the Tape list empty without an Organ, 05 with
  the next-step strip, 09 the Tape ledger and 09b filtered by an Organ, both lists in German at
  1024×700), `ux-review`; score into STATUS.

### Decided (2026-10-16)

1. **No created date:** the Tape list has no created-date column; a Tape stores no date (G8).
2. **Rename a Tape** is left out of the Tape row menu here; it is a separate issue,
   [#82](https://github.com/LilSticky/crancula/issues/82) (G9).
3. **Order by name, locale-aware** (`Intl.Collator` for the current language, so ä sorts with a):
   Organs by name; Tapes grouped by Organ (Organ name), then by Tape name (G1b, G3, G8).
4. **Pipe range** shows lowest–highest only ("31 Pipes, F3–B5"), with the editor's subtitle logic
   and keys and no marker for skipped notes (G1).

## #69 Tape import

Guide sections "Screens → Bring a Song onto a Tape", "Principles" (4, one screen; 5, check before
you cut), "Layout and navigation" (page head, action bar, 1024×700), "Component usage"
(`mat-chip` for the file, `mat-checkbox` with Note count, Transposition as −/+ around the value,
`mat-card appearance="outlined"` sheets, one filled primary), "States" (Empty, Error) and
"Accessibility commitments"; reference mockup `variants/a-workshop/mockup.html` (screen
`tape-import`: Song sheet with the file, Organ, Parts, Transposition stepper with the proposal
sentence, name and Column length; a Fit sheet beside it; Create Tape in the action bar; where it
differs, the guide wins). Fixes ux-review finding 7 (after #66; finding 9 after #62): the chosen
file is not shown as a file (the Song name beside the button reads like one), "Use proposal" is
unexplained, the Fit is a plain bullet list without a warning, the Parts fieldset touches the next
field. Uses the shared `cranc-page-head`, `cranc-action-bar`, `formatNumber`, `crancDecimalInput`,
`LanguagePreference` and `pipeRange` (G1). No new domain rule and no new term: the page shows only
what the domain already computes (`fitOf`, `proposeTransposition`, `allowedTranspositions`,
`createTapeFromDraft`, `tapeLengthInMillimetres`), plus the Notes behind two Fit counts, taken out
of `createTape`'s own loop (I8a; Decided 2). The guide's live Tape preview is a separate issue,
[#84](https://github.com/LilSticky/crancula/issues/84) (Decided 1).

Design choices made here (not domain):
- **Two sheets:** left the Song sheet (outlined `mat-card`) with the group titles Song, Organ,
  Parts, Transposition, then name and Column length side by side (~170 px for the Column length);
  right the Fit sheet. Groups are 20 px apart, so none touches the next. Below 1180 px the sheets
  stay side by side (two columns of ~430 px at 1024 px).
- **File as a chip:** before a file is chosen the Song group holds only the tonal button "Choose a
  MIDI file". Afterwards a `mat-chip` (icon `music_note`) shows the file name as chosen
  ("three-parts.mid", not the Song name, which can come from the first track), the facts "3 Parts,
  116 Notes" beside it, and the button becomes the text button "Choose another file" (same test id
  `choose-song`). A rejected file shows the rejection (oxblood, `error` icon, a plain sentence)
  and no chip; the previous Song and its chip go, as the Song does today.
- **Organ:** the native select stays (its options stay the Organ names; e2e selects by them);
  under it a `mat-hint` with the chosen Organ's range, "31 Pipes, F3–B5" (G1's keys).
- **Parts** as a ruled list, not a fieldset: one 40 px row per Part, checkbox with the name, the
  Note count right-aligned with `tabular-nums` ("24 Notes", "1 Note"); a percussion Part has a
  second line in Ink 2, "Percussion: no Pipe plays it" (mockup wording). Over 6 Parts the list
  scrolls inside the sheet (max height 6 rows), so 16 Parts never push the page.
- **Transposition stepper:** the number field (`transposition`) between a `mat-icon-button` "One
  semitone down" (`remove`) and "One semitone up" (`add`), both with `aria-label` and
  `matTooltip`, each disabled at its bound of `allowedTranspositions`; suffix "semitones".
- **Proposal explained** (`data-testid="proposal"`, beside the stepper, Ink 2): while the chosen
  Transposition is the proposal, "This is the proposal: it puts the most Notes directly on a
  Pipe." (the rule of `proposeTransposition`) and no button; otherwise "The proposal is +5
  semitones: it puts the most Notes directly on a Pipe." and the outlined button "Use proposal"
  (`use-proposal`). Signed numbers: "+5", "−3", "0".
- **Column length** uses `crancDecimalInput` with the suffix "mm" (label "Column length", no
  "(mm)"): "2,5" in German.
- **Fit sheet** (`data-testid="fit"`, keeps `data-matching-a-pipe`, `data-moved-by-octaves`,
  `data-unplayable`): sheet title "Fit of the selected Parts"; three ruled rows of icon, label and
  a bold right-aligned count: `check_circle` Notes matching a Pipe, `swap_vert` Notes moved by
  octaves, `block` Unplayable Notes. Before Song and Organ are chosen, or while the Transposition
  is not a valid one, the sheet holds one sentence instead: "Choose a MIDI file and an Organ to see
  how the Song fits its Pipes." The sheet has `aria-live="polite"`.
- **Expandable counts:** the rows Notes moved by octaves and Unplayable Notes are disclosures
  while their count is above 0: the whole row is a `button` with `aria-expanded` and
  `aria-controls`, an `expand_more` / `expand_less` icon, Enter and Space toggle it; expanded, a
  list of its Notes follows the row, each "F#6 (Part Lead, Column 65)" or "G2 moved by 1 octaves to
  Pipe G3 (Part Bass, Column 9)", in the Import Summary's wording and keys (`MOVED_NOTE`,
  `UNPLAYABLE_NOTE`, moved to a shared key if both use them), Columns from 1, ordered by Column,
  then Part. A count of 0 is plain text, not a button; Notes matching a Pipe does not expand. Both
  start collapsed; a long list scrolls inside the Fit sheet (max height ~8 rows), never the page.
- **Warning** when Unplayable Notes > 0 (`data-testid="fit-warning"`): the Unplayable row turns
  oxblood with the `warning` icon, and under the rows: "3 Unplayable Notes: no Pipe plays them, not
  even moved by octaves, so they are left off the Tape. Another Transposition may fit better."
  (singular for one). Oxblood because it asks for care; it does not block Create Tape (today's
  behaviour stays). No warning for Notes moved by octaves.
- **Action bar** (`cranc-action-bar`, label "Create the Tape"): Create Tape (filled,
  `create-tape`), the only primary, on the right; on the left the state, so the button is never
  silently disabled: "Choose a MIDI file", "Choose an Organ", "Select at least one Part", "1
  problem prevents creating the Tape" / "2 problems …" (the messages stay at their fields), the
  load problem sentence, or when ready "192 Columns, 480 mm of Tape" (from `createTapeFromDraft`
  and `tapeLengthInMillimetres`, decimals per language). No Cancel: the mockup's Cancel is left
  out, the rail leads away and the import has no unsaved state to protect.
- **Page head subtitle:** "Choose a MIDI file, the Organ and the Parts. The Fit shows how the Song
  meets the Pipes before the Tape is created."
- **No Organ:** the hint becomes an empty state like #66's (paper sheet, icon, sentence, the
  filled "Describe an Organ" link), keeping `no-organ-hint`.

Keep the test ids e2e and specs use: `import-form`, `organ`, `song-file`, `choose-song`,
`song-rejection` (with `data-code`), `parts`, `part` (with `data-index`), `part-name`,
`part-note-count` (the number only), `name`, `column-length`, `transposition`, `use-proposal`,
`fit`, `tape-load-problem`, `create-tape`, `no-organ-hint`, `violation`; `song-name` goes (the chip
is `song-file-name`). Every task that adds or changes UI text adds the keys to `en.json` and
`de.json`.

- [x] **I1** Two sheets and spacing, component. Spec: the form holds a Song sheet and a Fit sheet
  (`data-testid="song-sheet"`, `fit-sheet`, both outlined `mat-card`); the Song sheet has the group
  titles Song, Organ, Parts, Transposition in this order; the page head has the subtitle. Then the
  template and the minimal SCSS (two-column grid, 20 px gaps, group margins).
- [x] **I2** File chip, component. Spec: before a file, only `choose-song` "Choose a MIDI file"
  and no `song-file-name`; after `three-parts.mid` the chip `song-file-name` shows that file name
  (also when the Song is named after its first track), `song-facts` "3 Parts, 11 Notes" (singular
  "1 Part, 1 Note"), and `choose-song` reads "Choose another file"; a rejected file shows
  `song-rejection` with an icon and no chip; `song-name` is gone. Then a `fileName` signal set in
  `readSong`, the chip and the keys.
- [x] **I3** Organ range hint, component. Spec: with the Street organ chosen, `organ-range` under
  the select reads "31 Pipes, F3–B5"; none while no Organ is chosen. Then the hint with
  `pipeRange`.
- [x] **I4** Parts list, component. Rewrite "shows each Part with its name and its number of
  Notes": rows in a list (no `fieldset`), `part-note-count` still the number, followed by "Notes" /
  "Note"; the percussion Part has `part-percussion` "Percussion: no Pipe plays it", the others
  none. Then the template and keys.
- [x] **I5** Transposition stepper, component. Spec: "One semitone up" raises the Transposition by
  1 and the Fit follows; "One semitone down" lowers it; both have `aria-label` and tooltip; at the
  highest allowed Transposition (highest selected Note G9) "up" is disabled, at the lowest "down"
  is. Then the buttons (they update the draft as `useProposal` does).
- [x] **I6** Proposal sentence, component. Spec: with the proposal chosen, `proposal` reads "This
  is the proposal: it puts the most Notes directly on a Pipe." and there is no `use-proposal`;
  after "up" it reads "The proposal is +12 semitones: …" (signed; "−3" and "0" in two more cases)
  and `use-proposal` restores it (keep "restores the proposal with "use proposal""); German texts.
  Then the sentence and the keys (`TAPE.TRANSPOSITION.*`).
- [ ] **I7** Column length in mm, component. Spec: the Column length field is a
  `crancDecimalInput` with the suffix "mm" and the label "Column length"; in German it shows "2,5"
  and accepts "3,5"; the "not positive" rule spec still passes. Then the field.
- [ ] **I8** Fit sheet, component. Rewrite the Fit specs to read the rows `fit-matching`,
  `fit-moved`, `fit-unplayable`, each with its label, icon and count (`fit-count`); the data
  attributes stay; before a Song is chosen the sheet shows `fit-empty` "Choose a MIDI file and an
  Organ to see how the Song fits its Pipes."; the sheet has `aria-live="polite"`. Then the sheet
  and the keys (`TAPE.FIT.*` without `{{count}}` in the labels).
- [x] **I8a** Fit Notes, domain unit. A pure `fitNotesOf(song, selectedParts, organ,
  transposition)` in `api/tape/fit.ts`, exported via `@api/index`: the `NoteMovedByOctaves[]` and
  `UnplayableNote[]` (the Import Summary's types) for the selected Parts. Spec first in
  `fit.spec.ts`: a Note moved up an octave gives its Part, transposed note number, Pipe, octaves 1
  and Column; an unplayable Note gives Part, note number and Column; the Columns are those after
  Quantisation, counted from the first selected Note's Column, as `createTape` gives them (a Column
  is a 1/32 note, so the Column length does not change them; it only matters for the Hole fixes,
  which are not part of the Fit); unselected Parts give nothing; for every Song in the spec the
  list lengths equal `fitOf`'s `movedByOctaves` and `unplayable`, and equal `createTape`'s
  `importSummary.movedByOctaves` and `unplayableNotes`. Then one shared walk over the selected
  Notes (`octaveMoveTable`, `quantiseNote`, `columnOfTick`) that `createTape` and `fitNotesOf` both
  use, so the rule lives once; `createTape`'s specs stay green unchanged. `fitOf` may count from it
  if that stays as fast (the Fit follows every stepper click).
- [ ] **I8b** Expandable Fit counts, component. Spec: with 2 Notes moved by octaves and 1
  Unplayable Note, `fit-moved` and `fit-unplayable` are buttons with `aria-expanded="false"` and
  `aria-controls` naming their list; a click (and Enter, and Space, on the focused button) shows
  `fit-notes` with one `fit-note` per Note in the Import Summary's wording ("F#6 (Part Lead,
  Column 65)", Columns from 1, the Part's name or "Part 2"), ordered by Column, then Part, and sets
  `aria-expanded="true"`; a second press collapses it; a count of 0 and Notes matching a Pipe are
  not buttons; German texts; after a stepper click the open list shows the Notes of the new
  Transposition. Then a `fitNotes` computed from I8a, the disclosure and the shared keys.
- [ ] **I9** Unplayable warning, component. Spec: with a Song whose Note no Pipe plays, not even
  moved by octaves, at the chosen Transposition, `fit-warning` reads "1 Unplayable Note: …"
  (plural for 3), `fit-unplayable` has the warning class and icon, and Create Tape stays enabled;
  with 0 Unplayable Notes there is no `fit-warning`, also when Notes were moved by octaves. Then
  the warning and keys.
- [ ] **I10** Action bar, component. Spec: Create Tape is inside `cranc-action-bar`; its
  `action-bar-state` reads "Choose a MIDI file" without a Song, "Choose an Organ" between several
  Organs, "Select at least one Part" with none selected, "1 problem prevents creating the Tape"
  with an empty touched name, the load problem sentence while the Tape library could not be read,
  and when ready "N Columns, L mm of Tape" for the melody (`formatNumber`, German decimal comma).
  The existing Create specs keep passing. Then a `readiness` computed and the template.
- [ ] **I11** No-Organ empty state, component. Rewrite "shows a hint with a link to the new Organ
  page and no form": `no-organ-hint` is a paper sheet with an icon, the sentence and the filled
  "Describe an Organ" link to `/organs/new`. Then the template.
- [ ] **I12** e2e, existing tests. Update `tape-import.spec.ts`, `tape-german.spec.ts`,
  `tape-restart.spec.ts`, `lists.spec.ts`, `e2e/support/tape-creation.ts` and
  `e2e/ux/screens.capture.ts` where they read `song-name`, the Fit texts, the Column length (now a
  decimal text input) or rely on Create Tape's place. Run them.
- [ ] **I13** e2e, one screen in Electron. New `tape-import-layout.spec.ts`: at exactly 1024×700
  (`resizeWindowOrSkip`), in English and in German, with `threePartsWithPercussion` and then
  `longSongWithSixteenParts`: the document does not scroll (`scrollHeight <= innerHeight`, no
  horizontal scroll), both sheets and the action bar with Create Tape are in view, the 16 Parts
  scroll inside their list, the chip shows the file name, and no group's box overlaps the next
  (Parts and Transposition at least 16 px apart); with the Unplayable Notes of
  `longSongWithSixteenParts` expanded (a Transposition away from the proposal, or a Song helper in
  `e2e/support/midi-file.ts` with Notes no Pipe plays), the list scrolls inside the Fit sheet and
  the document still does not scroll. At 1280×800 the same, and 3 Parts need no inner scroll.
  Needs real layout.
- [ ] **I14** Full `npm run e2e`, `npm run test`, `npm run lint`, `npm run i18n:check`. Then
  `npm run ux:screens` (07 with the chip, the proposal sentence and the Fit sheet; a new 07b with
  the Unplayable warning and its Notes expanded after a Transposition away from the proposal; 07c in German at
  1024×700), `ux-review`; score into STATUS.

### Decided (2026-10-17)

1. **Live Tape preview** (the guide's "a live Tape preview", the mockup's first 72 Columns under
   the Fit) is a separate issue, [#84](https://github.com/LilSticky/crancula/issues/84); not in
   #69.
2. **Expandable Fit counts:** Notes moved by octaves and Unplayable Notes each expand to their
   Notes (Part, note name, Column) before Create. A pure domain function next to `fitOf` returns
   them, with the Columns `createTape` would give, from the same quantisation and octave-move
   logic, not a copy of it (I8a); the page shows them as keyboard-accessible disclosures (I8b).
3. **Wording:** "it puts the most Notes directly on a Pipe" for the proposal and "left off the
   Tape" for Unplayable Notes, as proposed. No new dictionary term for the proposed Transposition.
