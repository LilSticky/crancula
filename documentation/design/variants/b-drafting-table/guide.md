# Design guide draft: variant b, the precision drafting table

Crancula as a technical drawing tool: panes on a gridded table, exact figures in millimetres,
everything that has a physical size drawn to scale with a ruler. Mockup: `mockup.html`, theme:
`theme.scss`.

## Principles

1. **Measure, don't decorate.** Every number has a unit. Anything with a physical size (Tape Bed,
   Tape, Hole) is drawn to scale, and the scale is stated (for example "4 px per mm").
2. **One signal colour.** Cobalt `#1450C8` marks the primary action, the selection, focus and
   dimension lines. Nothing else is coloured, except red for errors.
3. **List, detail, inspector.** You select something on the left, work on it in the middle and
   read its properties on the right. Nothing important hides in a dialog.
4. **Dense but calm.** Small type, 26 px rows and a 16 px grid. Space separates groups, not
   individual fields.
5. **Check before you cut.** The app computes physical checks (do the Pipes fit the tape width?
   is every Hole long enough?) and shows them next to the values.

## Colour roles

| Role | Hex | Use |
|------|-----|-----|
| Ink | `#1A2127` | Text, Holes, the logo |
| Ink 2 / Ink 3 | `#525E69` / `#66727D` | Secondary text, labels, units, rulers |
| Signal | `#1450C8` | Primary button, selection bar, focus ring, dimension lines, active tab |
| Signal weak | `#E7EEFC` | Selected row, "Unsaved changes" chip |
| Panel / Panel 2 | `#FFFFFF` / `#F4F6F7` | Panes, toolbars, status bar |
| Sheet | `#E6EAED` with a `#DCE1E5` 16 px grid | The drafting table behind the panes |
| Rule / Rule strong | `#D5DBE0` / `#A9B3BC` | Dividers, field outlines |
| Paper | `#FBFBF8`, edge `#8F9AA4` | The Tape |
| Error | `#B3261E` on `#FCEEEC` | Validation, Unplayable Notes |
| OK | `#2F6B3A` | The check icon only, always with text |

Contrast: Ink 2 on white is 6.6:1, Ink 3 is 4.9:1, Signal is 7.0:1, Error is 6.5:1.

## Typography

- **Barlow** (OFL, to bundle) for UI text: a narrow grotesk in the DIN tradition, so German labels
  fit. The mockup falls back to Bahnschrift.
- **JetBrains Mono** (OFL, to bundle) for every number a user enters or compares: field values,
  table figures, rulers, MIDI notes. The mockup falls back to Consolas. All other text uses
  `tabular-nums`.

| Token | Size / weight | Use |
|-------|---------------|-----|
| Title | 19 / 600 | Page title in the page bar |
| Section | 14 / 600 | Pane and sheet headings |
| Body | 13 / 400 | Default |
| Data | 12.5 mono | Figures in tables and fields |
| Label | 11.5–12 / 400–500 | Field labels, units, rulers, captions (never below 11.5) |

Sentence case everywhere. No all-caps labels.

## Spacing and density

- 4 px base unit; 16 px gaps between sheets; 14 px padding inside sheets.
- Material density −3; form fields −4 (34 px high); table rows 26 px; buttons 32 px.
- A 1280×800 window shows all 31 Pipes and the whole Tape Bed without scrolling; 1024×700 too.

## Layout and navigation

- **Top bar** (44 px): logo, `mat-tab-nav-bar` with Organs and Tapes (with counts), EN/DE toggle
  on the right. The empty Overview page is dropped.
- **Page bar** (56 px): breadcrumb, title, state chip (Unsaved changes / n problems), actions on
  the right. Primary action is the only filled button; destructive actions go in the `more_vert`
  menu.
- **Body**: list pane (296 px) | workspace | inspector pane (300 px), on the gridded sheet.
- **Status bar** (26 px): save state, counts, cursor position and scale on the Tape, units.

## Component usage

| Need | Material component |
|------|--------------------|
| Main navigation | `mat-tab-nav-bar` |
| Organ list, Tape list | `mat-selection-list` (single) or `mat-nav-list`, selected row with signal bar |
| Numeric values | `mat-form-field` outline, `floatLabel="always"`, `matTextSuffix` "mm", `inputmode="decimal"` |
| Pipes | `mat-table` with `cdkDrag` rows, input per row, selection plus one toolbar for move/remove |
| Parts | `mat-checkbox` rows in a small table with Note counts |
| Transposition | stepper (two `mat-icon-button` around a value) plus Fit table, clickable rows |
| Zoom, language | `mat-button-toggle-group` |
| Primary / secondary / quiet | `mat-flat-button` / `mat-stroked-button` / `mat-button` |
| Row and toolbar icons | `mat-icon-button` with `matTooltip` and `aria-label` |
| Errors list | inline banner below the page bar, links focus the field |
| Saved, exported | `MatSnackBar` |

## Tape visualisation rules

- The Tape is drawn at a stated scale (default 4 px per mm; Fit and 8 px per mm in the zoom
  toggle). Width runs top to bottom, the Tape runs left to right, row 1 at the top.
- Rulers: top shows mm (ticks every 1 mm, numbers every 10 mm) and Column numbers every 16 Columns;
  left shows mm across the width plus the Pipe note names (12 px, the selected row in signal).
- Paper in `--cr-paper` with its real edge; the border is a dashed line at 5 mm from each edge.
- Rows of sharp notes are tinted, like the black keys of a piano.
- Lines every 8 Columns (a quarter note) and stronger ones every 32 (a whole note).
- Holes are ink slots with rounded ends, diameter and length to scale.
- The selected Hole has a signal outline and a dimension line with its length in mm.
- A minimap of the whole Tape under the canvas shows the visible part.
- The Tape Bed cross-section (Organ list and editor) shows width, border, row spacing and diameter
  as dimension lines, and the first and last Pipe.

## States

- **Empty**: a list pane with one sentence and the filled "New Organ" / "Bring a Song onto a Tape"
  button; an empty drawing shows which values it still needs.
- **Error**: field outline 2 px red, message under the field in plain words, banner with linked
  problems, "n problems" chip and the same count in the status bar. Save stays enabled and
  explains itself on click.
- **Unsaved**: signal "Unsaved changes" chip in the page bar and the status bar; leaving asks with
  Stay (filled) and Discard changes (text).
- **Saved**: status bar shows "All changes saved" with a check icon.

## Accessibility commitments

- Text ≥ 4.5:1, UI parts ≥ 3:1; nothing by colour alone (errors have icon and text, selection has
  a bar, the proposal has a label, sharp rows have note names).
- Visible 2 px signal focus ring; targets ≥ 32 px (table inputs 26 px rows, ≥ 24 px).
- Keyboard: Tab through fields in reading order; Alt+↑/↓ moves a Pipe; Enter in the last row adds
  a Pipe; arrow keys move the Hole selection on the Tape.
- Narrow Barlow keeps German labels on one line in two-column field grids.
- Numbers follow the locale: `2.5` in English, `2,5` in German.

## What changes versus today

- Teal/orange M3 and Roboto become cool neutrals, cobalt and Barlow/JetBrains Mono.
- Pills and filled fields become 4 px rectangles and outlined fields with units.
- Stacked full-width forms become list | workspace | inspector panes.
- The Organ editor fits on one screen: Tape Bed in a 2×3 grid with a live cross-section, 31 Pipes
  in two 16-row tables with one selection toolbar.
- The Tape is drawn to scale with rulers, minimap and an inspector instead of small bars under text.
- The import is a numbered four-step form with a live Tape preview and a Fit table.
