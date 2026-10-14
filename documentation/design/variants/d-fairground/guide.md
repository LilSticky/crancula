# Design guide draft: d-fairground ("Fairground heritage, modernised")

Crancula looks like the front of a street organ at night: navy case, carousel red, gilt trim,
a manila Tape running through it. The colour is confident and the ornament is rare. Every screen
still has to pass the density and accessibility checks. Mockup: `mockup.html`. Theme: `theme.scss`.

## Principles
1. **The Tape is the show.** It is the only light, warm surface in a dark app, drawn true to
   millimetres. Holes are cut-outs: the navy background shows through them.
2. **One red per screen.** Carousel red marks the single filled action (New Organ, Save, Create
   Tape, Export SVG). Everything else is gold text, tonal or outlined.
3. **Gilt is for orientation, not decoration.** Gold marks where you are (active nav, focus,
   ruler, step numbers). There are three ornaments: the trim under the toolbar, the frame
   corners round the Tape, and the logo medallion. Nothing else is ornamented.
4. **Poster type for names, plain type for work.** The display face is used only for page
   titles, Organ names and the large Import Summary figures. Forms and data use Rubik.
5. **Millimetres everywhere.** Every length has a unit suffix and a locale decimal (2,5 mm in German).

## Colour roles (dark scheme is the default)
| Role | Hex | Use |
|------|-----|-----|
| surface | `#151A2E` | page; also the colour of a Hole |
| surface-container-lowest | `#0F1324` | toolbar, action bar, tooltips |
| surface-container | `#1D2440` | panels and cards |
| surface-container-high | `#273052` | tonal buttons, chips |
| on-surface | `#F4EBD6` | text (14:1) |
| on-surface-variant | `#BDB6A6` | secondary text, sharps' note names (8:1) |
| outline / outline-variant | `#8790B4` / `#48527A` | field borders (3,9:1) / dividers only |
| primary (gilt) | `#E2B651` | focus, active, text buttons, checkboxes (9:1) |
| primary-container (red) | `#B3203A` + `#FFF6E6` | the one filled action (5,9:1) |
| error | `#FFB4AB` | error text and 2 px field border, always with an icon |
| success | `#8FD6AE` | "fits" messages, always with a check icon |
| Tape | `#EBDCB5`, bands `#E0CEA0`, ink `#7A6538` | the Tape only |

Red is never used for errors (errors are salmon text with an icon), so "primary" and "problem"
cannot be confused. A light scheme is a later option (ivory surface, same red and gold).

## Typography
| Token | Face | Size/line | Use |
|-------|------|-----------|-----|
| display | Abril Fatface 400 | 36/38 | page title |
| display-s | Abril Fatface 400 | 28/31 | Organ name on a card, summary figures |
| title | Rubik 500 | 17/20 | panel titles (Tape Bed, Pipes) |
| body | Rubik 400 | 14/20 | everything else |
| label | Rubik 400 | 12/14 | field labels, hints, Tape labels; never smaller |

Both fonts are OFL and must be bundled in `src/fonts/` (#24). The mockup uses Bodoni MT Black as
a stand-in for Abril Fatface. Numbers use `tabular-nums`. No all-caps labels.

## Spacing and density
- 4 px grid; panel padding 18–20 px; 20 px between panels; 24 px page margin.
- Density -2: outlined fields are 44 px high, Pipe rows 36 px, buttons 40 px, icon buttons 30–32 px.
- Fields are as wide as their values: mm fields about 150 px, two per row.

## Layout and navigation
- Toolbar (56 px) with the logo and wordmark, **Organs** and **Tapes** as tabs (active = gold text
  plus a 3 px gold underline), EN/DE toggle on the right. The trim sits under it.
- The empty Overview page is dropped: the app opens on Organs, or Tapes once one exists.
- Page header: back link, display title, one-line purpose, actions on the right.
- Editors have a sticky action bar at the bottom: state on the left (unsaved, or the problem
  list), then Discard as a text button and Save as the red button. Delete sits in the page header,
  away from Save, as an outlined error button, and is hidden for a New Organ.
- At 1024 px or less, side panels move under the main content and the Pipe columns get narrower.

## Components (Angular Material)
| Need | Component |
|------|-----------|
| Organ on the list | `mat-card` with Tape Bed preview, Edit (tonal), Bring a Song onto a Tape (text), delete icon with tooltip |
| Tape Bed values | `mat-form-field appearance="outline"` + `matTextSuffix` "mm" |
| Pipes | CSS grid of 3 columns × 11 rows, each row: drag handle (`cdkDrag`), number, small input, note name, `mat-menu` (Move up, Move down, Remove Pipe) |
| Parts | `mat-checkbox` in an outlined option tile with its Note count |
| Organ choice | `mat-select` |
| Import steps | numbered sections in one panel (a real sequence: Song, Organ and Parts, Tape) |
| Zoom | `mat-button-toggle-group` (Fit, 1:1) |
| Hole details | `matTooltip`-style overlay; later a side panel |
| Leave with changes | `mat-dialog`: Stay filled, Discard text |

## Tape visualisation rules
- Drawn in SVG from mm values: px/mm is one number (Fit = 3,6; 1:1 = 96 dpi / 25,4).
  Row spacing, hole diameter, borders and Column length come from the Organ, never from styling.
- Rows run across the Tape (row 1 at the top edge), Columns run along it, left to right.
- Note-name gutter left of the Tape, 12 px; naturals in ivory 500, sharps in muted 400.
  Rows of sharps get a faint band on the paper, as on a keyboard, as a scanning aid only.
- A gold mm ruler sits above, Column numbers below (every 8), bar lines every 16 Columns.
- Borders are dashed ink lines. Holes are rounded slots in the surface colour.
- A selected Hole gets a 3 px red outline plus a label (note, Columns, length in mm).
- The Tape stage has gilt frame corners; the Import Summary sits beside it (below, when narrow).

## States
- **Empty**: a dashed tile with a sentence and the one red action ("Describe your first Organ").
- **Error**: 2 px salmon border, error icon, message under the field in plain words; Pipe errors
  mark the cell and repeat the message under the Pipe grid with the row and the fix. The action bar
  lists the problems as links ("Noch nicht speicherbar, 2 Probleme: Bandbreite und Reihe 14").
  Save stays enabled and jumps to the first problem.
- **Unsaved**: a gold dot plus "Unsaved changes" in the action bar.
- **Success**: green check icon plus text ("Every Note has a Pipe").

## Accessibility commitments
- Text ≥ 4.5:1, UI parts ≥ 3:1 (values in the colour table); checked on panels as well as on the page.
- 2 px gold focus ring on everything focusable; visible on red and on the Tape.
- Targets ≥ 24 px (icon buttons 30–32 px).
- Meaning never by colour alone: errors, success and dropped Parts carry an icon or strike-through.
- German text expansion: buttons and labels sized for DE (see `#organ-editor-error`).
- Every icon button has an `aria-label` and a tooltip. The Tape SVG has a label and, later, a
  table alternative (Holes per row).
- Motion: none by default; respect `prefers-reduced-motion`.

## Changes compared with today
- Light cyan Material becomes dark navy with red and gold; Roboto becomes Rubik plus Abril Fatface.
- The Organ editor uses one screen instead of 3200 px: Tape Bed and Pipes side by side, 3 Pipe columns.
- The Tape is large, true to mm, with a ruler, Column numbers and note gutter; the summary moves aside.
- Import becomes three numbered steps with a live Fit panel and preview.
- Overview is removed; the Organ list gets cards with a Tape Bed preview and a next-step hint.
