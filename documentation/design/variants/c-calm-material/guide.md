# Design guide draft: c-calm-material

Calm, refined Material 3. Stock Angular Material and Roboto, one tonal palette, light and dark.
The app stays out of the way; the Tape and the Organ's numbers carry the screen.
Mockup: `mockup.html` (`#organ-list`, `#organ-editor`, `#organ-editor-error`, `#tape-import`,
`#tape-view`; append `-dark` for the dark scheme; `#organ-editor-leave` for the dialog).

## Principles
1. **The work is the hero.** The Tape and the Pipe list get the space; chrome is thin, quiet and the same everywhere.
2. **Millimetres are first-class.** Every length has a unit suffix, a locale number format and a narrow field.
3. **Say what happens next.** Never disable a button without saying why; empty states name the next step.
4. **Stock first.** If Angular Material has a component or token for it, use it. Custom SCSS is layout only.

## Colour roles
One seed, `#405F90` "organ blue", generated into a full M3 palette (`theme.scss`). Use system tokens only.

| Role | Token | Use |
|------|-------|-----|
| Primary | `--mat-sys-primary` | One filled button per screen (New Organ, Save, Create Tape), focus rings, links |
| Secondary container | `--mat-sys-secondary-container` | Active rail destination, tonal buttons (Add Pipe), selected segment |
| Primary container | `--mat-sys-primary-container` | Information chips (the proposal), range bars |
| Error / error container | `--mat-sys-error*` | Field errors and the error summary banner; Discard text button |
| Surface ladder | `surface`, `-container-low`, `-container-lowest` | Page, rail and save bar, cards |
| Outline variant | `--mat-sys-outline-variant` | Card outlines, table dividers |
| Tape paper, Hole | `--cranc-tape-paper`, `--cranc-hole` | The Tape only; same in both schemes, because it is a physical object |
| OK | `--cranc-ok*` | "Fits" icons and chips, always with an icon and words |

No other colours. Dark scheme comes from the same palette via `theme-type: color-scheme`.

## Typography (Roboto 300–500, shipped in `src/fonts/`)
| Style | M3 token | Size/line | Use |
|-------|----------|-----------|-----|
| Page title | `headline-small` | 24/32, 400 | One per screen, in the page head |
| Card title (Organ name) | `title-large` | 22/28, 400 | Organ cards |
| Section title | `title-medium` | 16/24, 500 | Card heads: Pipes, Fit, What changed on import |
| Group label | `title-small` | 14/20, 500, on-surface-variant | Tape Bed inside a card |
| Body | `body-medium` | 14/20 | Everything else |
| Field value | `body-large` | 16/24, tabular figures, right-aligned for numbers | |
| Label, hint, ruler | `body-small` / `label-small` | 12/16 | Never smaller than 12 px |

Sentence case everywhere. No all-caps labels.

## Spacing and density
- 4 px grid; 8, 12, 16, 24, 32 are the working steps. Page gutter 32 px, card padding 20 px, card gap 16 px.
- Density 0 for buttons and the rail. Form fields density -4 (40 px). Fields inside tables density -5 (36 px), rows 44 px.
- Number fields are as wide as their content needs (about 96 px for a MIDI note, half a card column for mm values).

## Layout and navigation
- **Navigation rail** (88 px, left): logo, Organs, Tapes; at the bottom the light/dark toggle and EN/DE. No Overview page: the Organ list is the start screen (it was empty before).
- **Page head** (72 px): back arrow on detail screens, title, one-line purpose or context, then the primary action on the right and an overflow menu (⋮) for rare and destructive actions (Delete Organ, Delete Tape, Rename).
- **Body**: one of three layouts. Card grid (lists), two panes (editor: 400 px form card + flexible list card), or hero plus side panel (Tape view: Tape + 300 px panel).
- **Save bar** (sticky bottom) on every editable screen: state on the left ("Unsaved changes: Name"), Discard changes (text), Save (filled).
- Works down to 1024×700: side panels shrink to 248–320 px and stack their facts; nothing scrolls the whole page except long forms.

## Component usage
| Need | Material component |
|------|--------------------|
| Navigation | `mat-nav-list` styled as a rail (or `mat-sidenav` mode `side`, fixed) |
| Lists of Organs | `mat-card appearance="outlined"` in a grid, facts as a `<dl>`, actions in `mat-card-actions` |
| List of Tapes, Pipes, Parts | `mat-table`, compact; row click opens, ⋮ `mat-menu` for the rest |
| Numbers in mm | `mat-form-field appearance="outline"` + `matTextSuffix` "mm", `inputmode="decimal"` |
| Derived values (Minimum Hole Length) | read-only outlined field with a dashed outline and a hint saying where it comes from |
| Pipe reordering | `cdkDrag` handle + ⋮ menu (Move up, Move down, Delete Pipe) with tooltips |
| Primary action | `matButton="filled"`, one per screen; secondary `tonal`, tertiary `text` |
| Zoom | `mat-button-toggle-group` (Fit to window, True size, 200 %) |
| Status chips | `mat-chip` (non-interactive) with an icon |
| Confirm leave / delete | `MatDialog`; the safe action is filled, the destructive one is a red text button |
| Messages after an action | `MatSnackBar` ("Organ saved") |

## The Tape visualisation
- **Horizontal, true to size.** The Tape runs left to right as on the Plotter; 100 % = 4 px per mm (≈ true size at 96 dpi). Zoom: Fit to window, True size, 200 %.
- **Paper**: `--cranc-tape-paper` with a 1 px edge; the Tape Bed border shown as dashed lines 5 mm from each edge.
- **Rows**: one faint guide line per Pipe at the real row spacing; labels on a sticky left column: note name (bold for naturals, regular for sharps) and every second row number, 12 px.
- **Columns**: beat lines every 8 Columns (1/4 note), bar lines every 32 Columns, both on the paper; a ruler above with "Bar n" and Column numbers.
- **Holes**: rounded slots in `--cranc-hole`, Hole diameter high, real length, the Minimum Gap visible between neighbours. Selection: 2.5 px `--cranc-select` ring, plus the status line below (Row, note, Columns, length in mm and note value).
- **Overview strip** under the Tape: the whole Tape at small scale with the visible window outlined.
- Problems (later slices) are marked with an error ring and an icon in the status line, never by colour alone.

## States
- **Empty**: illustration-free. A sentence on what this list holds and the primary button ("No Organs yet. Describe your Organ first: New Organ").
- **Error**: fields show the reason under the field after touch or after Save; Save stays enabled and, when pressed, scrolls to an error summary banner at the top of the form card with links to each field.
- **Unsaved**: save bar says "Unsaved changes" and which fields; leaving opens "Leave without saving?" with **Keep editing** (filled) and Discard changes (red text).
- **New, not saved**: no Delete; the subtitle says "Not saved yet".
- **Coming soon**: a feature not built yet is shown disabled with a visible sentence ("Export comes in the next release"), not a tooltip alone.

## Accessibility commitments
- Contrast: text ≥ 4.5:1, UI parts ≥ 3:1, checked in both schemes; the Tape keeps its own contrast in dark mode.
- Visible focus: 2 px primary ring on every control; keyboard order follows reading order; Pipe table usable without drag (⋮ menu).
- Targets ≥ 32 px (icon buttons in tables), 40 px elsewhere.
- Every icon-only button has `aria-label` and a tooltip.
- No meaning by colour alone: errors have text, fit results have icons and numbers.
- German text is ~30 % longer: labels never truncate in the rail (80 px fits "Drehorgeln"), fields keep labels to one line, buttons may wrap their container but not their text.
- `prefers-reduced-motion` and `prefers-contrast: more` respected (high-contrast mixin from the palette generator).

## What changes versus today
- Top tab bar → navigation rail; Overview page dropped.
- Cyan/orange → one generated "organ blue" palette; outlined cards instead of grey-teal filled fields.
- Organ editor: Tape Bed in two columns of narrow mm fields, a Tape Bed check that shows the rows fit, and a compact scrolling Pipe table with a 31-cell range strip; sticky save bar. Page height 3200 px → one window.
- Validation: inline errors plus an error summary; Save no longer silently disabled; Delete only in the overflow menu and never on a New Organ.
- Bring a Song onto a Tape: two steps plus a live Fit card with range bars that explain the proposal.
- Tape view: Tape at true size as the hero with ruler, bar lines and overview; Import Summary in a side card.
- Every number in the locale format with a unit suffix.

## Open points
- German term for Tape is not in the dictionary yet; the mockup uses "Bänder" in the rail as a placeholder.
- "Organ blue" seed and tape-paper colour to be confirmed by the user.
