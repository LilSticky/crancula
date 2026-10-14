# Design guide draft: a-workshop, "The organ builder's workshop"

Crancula should feel like a well-kept bench: paper you write on, a strip of manila Tape, ink-black
Holes, a brass rule for measuring. Craft, not costume: no wood grain, no scrolls, no fake leather.
Mockup: `mockup.html`. Theme: `theme.scss`. Screens: `screens/`.

## Principles
1. **The Tape is the object on the bench.** Every Tape screen gives the Tape most of the window,
   drawn to true millimetres, in its own manila colour. Everything else is paper or bench.
2. **Measure, don't guess.** Every length shows its unit; drawings come from the user's values
   (Tape Bed diagram, rulers). Brass marks measurement and nothing else.
3. **Ink means act, oxblood means careful.** Ink-black is for Holes and the one primary action.
   Oxblood is for errors, unsaved changes and destructive actions only.
4. **One screen, one job, no scrolling for the core.** The Organ editor, the import and the Tape
   view fit a 1280×800 window; long lists become dense, ruled tables.

## Colour roles
| Role | Hex | Use |
|------|-----|-----|
| Bench | `#d6d0c4` | Page background (`surface`) |
| Paper | `#fbf9f4` | Sheets with forms and lists (`surface-container-lowest`) |
| Manila | `#e8d6a4` / edge `#c4ad74` | The Tape, only the Tape (and the logo) |
| Ink | `#1e1a16` | Text, Holes, filled buttons, checkboxes, selected toggles (`primary`) |
| Ink 2 / 3 | `#4a433b` / `#6b6257` | Secondary text / hints (≥ 5.6:1 on paper) |
| Walnut | `#2e2722` / raised `#463c35` | Navigation rail |
| Brass | `#8c6a23` | Rulers, dimension lines, focus ring, overview frame (4.7:1 on paper) |
| Oxblood | `#7a2a24` | Errors, unsaved dot, Delete (`error`) |

No other hues. Never use colour alone: errors carry an icon and text, unsaved carries a label.

## Typography
- **Headings:** Libertinus Serif Semibold (OFL, to bundle). Page title 30/33, sheet title 19/23,
  group title 16/19. Sentence case. Organ and Tape names are set in it too: they are names on a label.
- **Body:** Noto Sans (OFL, to bundle), 14/20; labels 12/16; numbers always `tabular-nums`.
- No all-caps, no letter-spaced eyebrows, no monospace. Note names are bold for naturals, regular
  for sharps (F#3), which makes a 31-row list scannable like a keyboard.

## Spacing and density
- 4 px grid. Page padding 32 px (24 px below 1180 px width). Gap between sheets 20 px.
- Material density **-2** app-wide: 44 px outlined fields, 40 px buttons, 34 px Pipe rows.
- Targets stay ≥ 28 px (icon buttons in dense rows), ≥ 40 px elsewhere.

## Layout and navigation
- **Shell:** left navigation rail on walnut (`mat-sidenav`, mode `side`, 196 px; collapses to an
  84 px icon rail below 1180 px). Items: Organs, Tapes. Language toggle and "saved on this
  computer" at the bottom. The empty Overview page is dropped; Organs is the start page.
- **Page head:** title (serif) + one sentence of purpose; actions right-aligned. The primary action
  of the page sits here or in the action bar, never both.
- **Action bar:** forms get a sticky bottom bar with the state on the left (unsaved, or the error
  summary with links to each field) and Discard + Save on the right.
- **Lists** are ruled ledgers on one paper sheet, not a stack of cards. Each Organ row shows a
  miniature of its Tape to a common scale, so a 70 mm and a 120 mm Organ look different.

## Component usage
| Need | Material component |
|------|--------------------|
| Paper sheet | `mat-card appearance="outlined"` |
| Text and number entry | `mat-form-field appearance="outline"` with `matTextSuffix` "mm" |
| Derived, read-only value (Minimum Hole Length) | outlined field, dashed outline, hint "Equals the hole diameter" |
| Pipe rack | `cdkDropList` table, 3 columns of 11 rows (2 below 1180 px); row menu `mat-menu` (Move up, Move down, Remove Pipe) |
| Parts | `mat-checkbox` list with Note count; percussion explains why it is off |
| Transposition | `mat-button-toggle`-styled stepper (−/+), proposal named in text |
| Zoom | `mat-button-toggle-group`: Whole Tape, 1:1, 2:1 |
| Primary action | `matButton="filled"` (ink), one per screen |
| Secondary | `matButton="text"`; Delete is a text button in oxblood, in the page head, away from Save |
| Confirm leaving / deleting | `mat-dialog`; Stay filled, Discard text |
| Navigation | `mat-nav-list` in `mat-sidenav` |

## The Tape visualisation
- Horizontal, time runs left to right, row 1 at the top (same order as the Pipe rack).
- **1:1 is the default zoom:** 1 mm = 3.78 px (96 dpi). 2:1 for fine work, Whole Tape to see all.
- Tape body manila with a 1 px darker edge and an angled lead-in at the start.
- Holes: ink-black rounded rectangles, height = hole diameter, length = Hole length, positioned
  from the Tape Bed (border, row spacing). Never decorative; what you see is what gets cut.
- Faint row guides (stronger for naturals), Column lines every 8 Columns, stronger every 24.
- Brass mm ruler on top (tick every mm, number every 10 mm). Column numbers under the Tape.
- Note-name gutter on the left, sticky while scrolling, 12 px, naturals bold.
- Overview strip under the Tape, squeezed to the stage width, with the visible part framed in brass.
- The Import Summary sits in a side sheet, dismissible (it is shown once and not stored).

## States
- **Empty:** one sentence of what to do and the primary button, e.g. "No Organs yet. Describe
  your Organ: its Tape Bed and Pipes." + New Organ. Tapes empty links to the import.
- **Next step:** when a task is done, a dashed "next step" strip points onward (Organs to import).
- **Error:** inline under the field after touch, oxblood outline + icon + plain sentence from the
  existing i18n keys. Save stays enabled; pressing it focuses the first error. The action bar
  lists every blocking field as a link.
- **Unsaved:** oxblood dot + "Unsaved changes: <field names>" in the action bar.
- **Disabled** buttons are avoided; if unavoidable, a tooltip says why.

## Accessibility commitments
- Text ≥ 4.5:1, UI parts ≥ 3:1 (brass on bench is 3.2:1, used only for ticks).
- Brass 2 px focus ring with offset on every interactive element.
- Every icon button has an aria-label and tooltip ("Move or remove the Pipe in row 4").
- The Tape SVG has a text alternative (Holes and rows count) and the Import Summary as text.
- Pipe reordering works without drag: row menu and Alt+↑/↓.
- German text expansion fits: labels sit in the outline, fields are 2 columns of ~170 px.
- Numbers follow the language: 2.5 in English, 2,5 in German.

## What changes versus today
- Teal/orange Material default with Roboto → bench, paper, manila, ink, brass, oxblood with
  Libertinus Serif + Noto Sans (two fonts to bundle, Roboto can go).
- Top tabs → walnut navigation rail; Overview page dropped.
- Organ editor: 3200 px page → one screen. Tape Bed fields in two columns with "mm" suffix and a
  live Tape Bed drawing; 31 Pipes in a 3-column rack; sticky action bar; Delete moved away from Save.
- Tape view: a 190 px drawing → a 1:1 Tape with ruler, Column numbers, overview strip, and the
  Import Summary in a side sheet.
- Import: plain bullets → a Fit sheet with counts and a live Tape preview; file shown as a chip.
- Density -2 and 6 px button corners instead of pills.
