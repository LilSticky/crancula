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
- [ ] **E11** Compact rack below 1180 px, component. Spec with a faked `BreakpointObserver` (as the
  shell spec does): 2 rack columns and 30 px rows (class `compact`); 3 columns above. Then the
  breakpoint signal.
- [ ] **E12** Changed fields, unit. A pure helper in `organ-form.ts`: `changedFields(saved, draft)`
  returns the changed paths in reading order (`name`, the Tape Bed fields, `minimumGap`, and
  `pipes` once for any Pipe change); nothing for equal drafts. Spec first.
- [ ] **E13** Action bar, component. Spec: Save sits in `cranc-action-bar` (label "Organ
  actions"), not in the page body; the state reads "Unsaved changes: Hole diameter" (oxblood dot
  plus text) after editing the hole diameter, "No unsaved changes" with Save disabled when nothing changed,
  "Saving…" with Save disabled while writing; Save is enabled on an untouched new Organ. Rewrite
  the "the Save button" specs that expect Save disabled for new or invalid Organs. Then adopt the
  bar.
- [ ] **E14** Discard changes, component. Spec: the button shows only with unsaved changes;
  pressing it restores the last saved version (empty fields for a new Organ), `unsavedChanges()`
  becomes `null`, nothing is written. Then the button.
- [ ] **E15** Error summary content, unit. A pure helper in `organ-form.ts`: from `organProblems`
  the distinct fields with problems in reading order, each with its label ("Tape width", "Row 3" for
  `pipes.2.note`, "Pipes" for `pipes`) and the path to focus. Spec first.
- [ ] **E16** Error summary behaviour, component. Spec: pressing Save on an invalid Organ writes
  nothing, shows every field message (also untouched missing values), and shows
  `data-testid="error-summary"` at the top of the form ("3 problems prevent saving: Tape width,
  Hole diameter, Row 3") with the focus on it; each entry is a link that focuses its field (`pipes`
  focuses Add Pipe); the action bar shows "3 problems prevent saving"; the summary goes once all
  are fixed. Then the summary (oxblood with icon, `role="alert"`) and a "save attempted" signal
  that `shownMessages` and `ShownViolationMatcher` honour.
- [ ] **E17** Delete in the page head, component. Spec: a stored Organ has Delete Organ as an
  oxblood text button in the page head (`data-testid="delete-organ"`), not in the action bar; a new
  Organ has no Delete. The deleting specs keep passing. Then move the button.
- [ ] **E18** Subtitle, component. Spec: a new Organ's page head says "Not saved yet"; the Street
  organ's says "31 Pipes, F3–B5"; after the first save the subtitle switches. Then the subtitle.
- [ ] **E19** "Organ saved", component. Spec: a successful save opens a `MatSnackBar` "Organ
  saved"; a failed write does not. Then the snackbar.
- [ ] **E20** Leave dialog, component. Spec: Keep editing is the filled button with initial focus,
  Discard changes a text button. Then the template and the keys.
- [ ] **E21** e2e, existing tests. Update `e2e/support/organ-editor.ts`, `organ-edit`,
  `organ-leave` (Save is no longer disabled for a duplicate Pipe: press it and assert the error
  summary instead), `organ-german` and the Tape specs that move or remove Pipes, to the row menu,
  the page-head Delete and the new dialog labels. Run them.
- [ ] **E22** e2e, German decimals. Extend `organ-german.spec.ts`: typing `2,5` and `3,5` saves the
  Organ; after a restart the fields show `2,5` and `3,5`, Minimum Hole Length `2,5`, Border `6,25`,
  and the fit check uses commas. Real Electron, because the language goes through the main process.
- [ ] **E23** e2e, one screen. New `organ-layout.spec.ts` with the Street organ: at 1280×800 the
  document does not scroll, the rack has 3 columns and the action bar is in view; at 1024×700 the
  document does not scroll, the rack has 2 columns, only the Pipes sheet scrolls, and the Tape Bed
  sheet and the action bar stay in view; no two Tape Bed field boxes overlap. Needs real layout.
- [ ] **E24** Full `npm run e2e`, `npm run test`, `npm run lint`, `npm run i18n:check`. Then
  `npm run ux:screens` (03 shows the error summary after pressing Save; add the editor with
  unsaved changes and the editor at 1024×700), `ux-review`; score into STATUS.

### Decided (2026-10-15)

1. **Fit check:** no new term for the check itself. Its lengths are the new dictionary terms Row Span and Border (#74); code uses `rowSpan` and `border` from `api/organ/`. A Border of 0 is valid; the derived Border is shown read-only.
2. **Border is derived:** border = (tape width − row span) / 2 on each side, so the rows are always
   centred and border + rows + border = tape width; the check fails when the derived border would
   be negative. Row 1 is nearest the top edge, as the Tape is drawn. Removing the Border input,
   deriving it, the snapshot migration and the dictionary are #74, merged
   before #64 (see the top of this section).
