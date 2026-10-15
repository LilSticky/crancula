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
- [ ] **D4** `npm run ux:screens`, `ux-review` of the result; record the score in STATUS.
