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
- [ ] **S3** Rail component `cranc-rail` replaces `cranc-navbar`: brand, `mat-nav-list` with Organs
  (icon `piano`) and Tapes (icon `receipt_long`), active item with `aria-current="page"`; at the
  bottom the language toggle (keeps `data-testid="language-switch"`, `data-language`, the existing
  persistence and `api.app.setLanguage`), the scheme toggle (`data-testid="scheme-switch"`, three
  icon toggles with labels), and "Saved on this computer". Class `cr-rail` (walnut tokens in
  `styles.scss`). Component spec.
- [ ] **S4** `AppComponent` shell: `mat-sidenav-container`, `mat-sidenav` mode `side`, always open,
  196 px; below 1180 px an 84 px icon rail with tooltips (`BreakpointObserver`), labels hidden.
  Content area padding 32 px (24 px below 1180 px). Component spec for both widths.
- [ ] **S5** Shared `cranc-page-head` (serif `h1` title, optional one-sentence subtitle, projected
  actions on the right) and `cranc-action-bar` (sticky bottom; projected state left, actions right).
  Component specs. Use the page head on every page now (Organ list, Organ editor, Tape list, Bring
  a Song onto a Tape, Tape view, not found); the action bar is adopted in #64.
- [ ] **S6** e2e: update tests that used the top navbar; one e2e that the window starts on the
  Organ list with the rail and that the scheme choice survives a restart. Full `npm run e2e`.
- [ ] **S7** `npm run ux:screens` (rename `01-home`; capture the dark scheme once), `ux-review`;
  score into STATUS.
