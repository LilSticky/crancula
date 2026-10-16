# Crancula design guide

Binding for every screen. Direction: **the organ builder's workshop** (variant A), with B's
Selected-Hole inspector and status line and C's dark scheme and error summary. Choice and
reasoning: [`design/COMPARISON.md`](design/COMPARISON.md). Reference mockup:
[`design/variants/a-workshop/mockup.html`](design/variants/a-workshop/mockup.html) (where it
contradicts this guide, the guide wins). Theme: [`design/theme.scss`](design/theme.scss).
UI text uses the terms of [`DICTIONARY.md`](DICTIONARY.md).

Crancula should feel like a well-kept bench: paper you write on, a strip of manila Tape, ink-black
Holes, a brass rule for measuring. Craft, not costume: no wood grain, scrolls or fake leather.

## Principles
1. **The Tape is the object on the bench.** Tape screens give the Tape most of the window, drawn
   to true millimetres in its own manila colour. Everything else is paper or bench.
2. **Measure, don't guess.** Every length shows its unit; drawings come from the user's values.
   Brass marks measurement and nothing else.
3. **Ink means act, oxblood means careful.** Ink is for Holes and the one primary action. Oxblood
   is for errors, unsaved changes and destructive actions only.
4. **One screen, one job.** The Organ editor, the import and the Tape view fit a 1280×800 window
   without page scrolling; long lists become dense, ruled tables.
5. **Check before you cut.** Physical checks (do the rows fit across the tape?) sit next to
   the values they check, and say the numbers.

## Rules all variants agreed on
- **Organ editor on one screen:** Tape Bed form left, Pipes right, a live fit check, and a sticky
  action bar with "Unsaved changes", Discard changes and Save. No Delete on a new Organ. Save is
  never silently disabled.
- **The Tape as the hero:** true millimetres on a paper-coloured strip, mm ruler, Column numbers,
  note names per row, zoom, an overview strip, the Import Summary in a side panel.
- **Units inside the fields** (`mm` suffix), decimal comma in German, tabular figures.
- **Navigation is Organs and Tapes.** The empty Overview page is dropped; Organs is the start page.

## Colour roles
| Role | Light | Dark | Use |
|------|-------|------|-----|
| Bench | `#d6d0c4` | `#1c1916` | Page background (`surface`) |
| Paper | `#fbf9f4` | `#2b2622` | Sheets: forms, lists, panels (`--cr-paper`) |
| Ink | `#1e1a16` | `#ede6d8` | Text, the filled button, checkboxes, selected toggles (`primary`) |
| Ink 2 | `#4a433b` | `#c2b8a8` | Secondary text, hints, labels (`on-surface-variant`) |
| Walnut | `#2e2722` / `#463c35` | `#14110f` / `#2e2722` | Navigation rail / its active item |
| Brass | `#8c6a23` | `#c9a45a` | Rulers, dimension lines, focus ring, overview frame |
| Oxblood | `#7a2a24` | `#e3a49b` | Errors, unsaved dot, Delete (`error`) |
| Manila | `#e8d6a4` | `#d8c593` | The Tape only (and the logo) |
| Hole | `#1e1a16` | `#1e1a16` | Holes, in both schemes: the Tape is a physical object |
| Select | `#1d4f91` | `#1d4f91` | Ring around the selected Hole (on manila, 5.6:1) |

No other hues. Never colour alone: errors carry an icon and text, unsaved carries a label, the
selected Hole has a ring and an inspector entry.

**Schemes.** Light is the default. The app follows the system (`prefers-color-scheme`); a
Settings toggle (System / Light / Dark, stored with the app settings) overrides it. One
`mat.theme` with `theme-type: color-scheme` emits both; custom tokens use `light-dark()`.
`prefers-contrast: more` uses the generated high-contrast overrides.

## Typography
| Use | Face | Size/line |
|-----|------|-----------|
| Page title, Organ and Tape names | Libertinus Serif Semibold | 30/33 |
| Sheet title | Libertinus Serif Semibold | 19/23 (side panel 17/21) |
| Group title | Libertinus Serif Semibold | 16/19 |
| Body | Noto Sans 400 | 14/20 |
| Labels, hints, ruler, note names on the Tape | Noto Sans 400/600 | 12/16, never smaller |

Sentence case. No all-caps, no letter-spaced eyebrows, no monospace. Numbers use `tabular-nums`.
Note names: naturals bold, sharps regular (F#3), so a 31-row list scans like a keyboard.

**Fonts to bundle** (all SIL OFL 1.1, offline in `src/fonts/` per #24, `@font-face` in
`src/styles/_fonts.scss`): Libertinus Serif Semibold (`libertinus-serif-semibold.woff2`), Noto Sans
variable 400–600 (`noto-sans-latin.woff2`, `noto-sans-latin-ext.woff2`). Material Icons stays;
Roboto goes once nothing uses it. Add each licence text next to the font files.

## Spacing and density
- 4 px grid. Page padding 32 px (24 px below 1180 px). Gap between sheets 20 px.
- Material density **-2** app-wide: 44 px outlined fields, 40 px buttons, 34 px Pipe rows.
- Targets ≥ 28 px for icon buttons in dense rows, ≥ 40 px elsewhere.
- Corners: 3 px sheets, 4 px fields, 6 px buttons and toggles. No pills.

## Layout and navigation
- **Shell:** `mat-sidenav` (mode `side`) on walnut, 196 px, items Organs and Tapes with icons;
  at the bottom the language toggle, the scheme toggle and "Saved on this computer". Below
  1180 px it collapses to an 84 px icon rail with tooltips.
- **Page head:** serif title, one sentence of purpose, actions right. The primary action sits here
  or in the action bar, never both. Delete is a text button in the page head, away from Save.
- **Action bar** (forms): sticky at the bottom; state on the left, Discard changes and Save right.
- **Lists** are ruled ledgers (`mat-table`) on one paper sheet, not a stack of cards.
- **1024×700, the smallest window:** the page never scrolls as a whole on the core screens. The
  Pipe rack drops to 2 columns of 16 at 30 px rows; if that is still too tall, only the Pipes
  sheet scrolls, with a sticky column header, while Tape Bed and action bar stay put. The Tape
  view keeps overview strip and status line visible; its side panel becomes collapsible.

## Screens
- **Organ list** (start page): one ledger row per Organ: name (serif), tape width, Pipe count and
  range (31 Pipes, F3–B5), a miniature of its Tape Bed to a common scale (width and row positions
  only, no invented Holes) and "3 Tapes" as a link to the Tape list filtered by this Organ.
  Primary: New Organ. A dashed next-step strip points to "Bring a Song onto a Tape".
- **Organ editor:** left the Tape Bed sheet (name; tape width, hole diameter, spacing
  between rows, Minimum Gap, Lead-in in two columns of ~170 px; Minimum Hole Length read-only with a dashed
  outline and "Equals the hole diameter") with a Tape Bed drawing from the values. Right the Pipe
  rack: 3 columns of 11 rows (row, note, handle, menu), read down then across. Under the drawing
  the **fit check**: the Row Span is (Pipes − 1) × spacing + hole diameter, and the Border is
  derived, never entered: (tape width − Row Span) / 2, shown read-only. Street organ: "31 rows take
  107,5 mm of 120 mm; 6,25 mm Border on each side" (30 × 3,5 + 2,5 = 107,5; (120 − 107,5) / 2 =
  6,25). If the Border would be negative it becomes an error with icon and numbers.
- **Tape list:** a ledger of all Tapes: name, Organ (link), Columns, length in mm, created date;
  row click opens the Tape view, a row menu holds Rename and Delete Tape. Filter by Organ as a
  chip. Primary: Bring a Song onto a Tape. Empty: "No Tapes yet. Bring a Song onto a Tape." plus
  the button; if there is no Organ yet, the sentence links to New Organ first.
- **Bring a Song onto a Tape:** file as a chip (three-parts.mid), Organ select, Parts as checkboxes
  with Note counts (Drums off, "percussion has no pitch for a Pipe"), Transposition stepper with the
  proposal named (+5 semitones), a Fit sheet with the three counts (each count expandable to its
  Notes) and a live Tape preview. Primary: Create Tape.
- **Tape view:** page head with the Tape name, Organ and length ("192 Columns of 2,5 mm, 480 mm"),
  zoom toggle, and **Export for the Plotter** as a disabled outlined button with the visible text
  "Export comes in a later release" beside it, until the export slice ships. Below: the Tape stage
  (ruler, Tape, Column numbers, overview strip), the side panel (300 px), the status line.
  - **Side panel**, three sections: *Selected Hole* (Pipe and row, Columns 65–79, length "15
    Columns, 37,5 mm", gap to the next Hole), *Tape* (Organ, Column length, Columns, length, Holes),
    *Import Summary* (only right after the import, dismissible, not stored).
  - **Status line** (26 px, under the stage): pointer position "Column 72 at 177,5 mm", "Row 25,
    F5", zoom, save state ("Saved"). Text, `aria-live="polite"` only for the save state.

## Component usage
| Need | Material component |
|------|--------------------|
| Paper sheet, side panel | `mat-card appearance="outlined"` |
| Text and number entry | `mat-form-field appearance="outline"`, `matTextSuffix` "mm", `inputmode="decimal"` |
| Ledgers (Organs, Tapes, Parts) | `mat-table`, row menu `mat-menu` |
| Pipe rack | one `cdkDropList` with `cdkDropListOrientation="mixed"`, row menu (Move up, Move down, Remove Pipe) |
| Parts | `mat-checkbox` with Note count |
| Transposition | two `mat-icon-button` (−/+) around the value |
| Zoom, scheme, language | `mat-button-toggle-group` (zoom: Whole Tape, 1:1, 2:1) |
| Organ filter, file | `mat-chip` |
| Primary action | `matButton="filled"` (ink), one per screen |
| Secondary / quiet | `matButton="outlined"` / `matButton="text"`; Delete is text in oxblood |
| Confirm leaving or deleting | `mat-dialog`: Keep editing (filled), Discard changes (text) |
| After an action | `MatSnackBar` ("Organ saved"), same verb as the button |
| Navigation | `mat-nav-list` in `mat-sidenav` |
| Icon buttons | `mat-icon-button` with `aria-label` and `matTooltip` |

## The Tape visualisation
- **Direction (decided by the user):** horizontal; time runs left to right; row 1, the first Pipe,
  is on top, in the order of the Pipe rack. Same in preview, view and (later) export.
- **1:1 is the default zoom:** 1 mm = 3.78 px (96 dpi). 2:1 for fine work, Whole Tape fits all.
- Tape body manila with a 1 px darker edge and an angled lead-in at the start; borders as faint
  lines at their distance from each edge.
- Holes: ink rounded rectangles, height = hole diameter, length = Hole length, positioned from
  the Tape Bed. Never decorative: what you see is what gets cut.
- Row guides faint, stronger for naturals. Column lines every 8 Columns, stronger every 32 (a whole
  note, since a Column is a 1/32 note).
- Brass mm ruler on top (tick every mm, number every 10 mm); Column numbers under the Tape.
- Note-name gutter on the left, sticky. Below 14 px row pitch only naturals are named (sharps keep
  their band), so a 3 mm spacing never collides.
- Overview strip under the Tape at stage width, visible part framed in brass; click to jump.
- Selection: click or arrow keys select a Hole; select ring plus the inspector entry.

## States
- **Empty:** one sentence of what to do plus the primary button ("No Organs yet. Describe your
  Organ: its Tape Bed and Pipes." + New Organ).
- **Error:** under the field after touch: oxblood outline, icon and a plain sentence. Save stays
  enabled; pressing it shows the **error summary** at the top of the form ("3 problems prevent
  saving: Tape width, Hole diameter, Row 3"), each a link that focuses its field; focus moves to the
  summary. The action bar shows the same count.
- **Unsaved:** oxblood dot + "Unsaved changes: Tape width" in the action bar; leaving asks first.
- **New, not saved:** no Delete; the subtitle says "Not saved yet".
- **Later release:** a feature not built yet is shown disabled with a visible sentence, never a
  tooltip alone, and never as if it worked.

## Accessibility commitments
- Text ≥ 4.5:1, UI parts ≥ 3:1, checked in both schemes. Brass on bench (3.2:1) only for ticks.
- 2 px brass focus ring with offset on every control (lighter brass inside the rail).
- Keyboard: reading order; Pipes move with the row menu or Alt+↑/↓; arrow keys move the Hole
  selection; Escape closes panels and dialogs.
- The Tape SVG has a text alternative (rows, Columns, Holes); the Import Summary is text.
- German expands ~30 %: labels in the outline, two field columns of ~170 px, the rail fits
  "Drehorgeln", the action bar fits "Ungespeicherte Änderungen: Mindestlochlänge".
- Numbers follow the language: 2.5 in English, 2,5 in German.
- `prefers-reduced-motion` and `prefers-contrast: more` respected.

## What changes versus today
- Cyan/orange and Roboto → bench, paper, manila, ink, brass, oxblood; Libertinus Serif + Noto
  Sans; light and dark.
- Top tabs → walnut rail; Overview dropped.
- Organ editor: a 3200 px page → one screen with fit check, 3-column rack, action bar, error summary.
- Tape view: a 190 px drawing → a 1:1 Tape with ruler, overview, inspector and status line.
- Density -2 and 6 px corners instead of pills.

## Open points
- German term for Tape: Lochband (dictionary, 2026-10-15); the mockups still say "Bänder".

## Implementation order (for a later issue)
1. **Theme and fonts:** generate the palette (`ng generate @angular/material:theme-color
   --primary-color=#3a2f28 --tertiary-color=#8c6a23 --neutral-color=#6e675c
   --error-color=#7a2a24 --include-high-contrast --directory=src/styles/`), bundle the fonts,
   move `design/theme.scss` into `src/styles.scss`, set outline form fields as default.
2. **Shell and navigation:** walnut rail, Organs as start page, Overview removed, scheme and
   language toggles, page head and action bar as shared components.
3. **Organ editor:** two-sheet layout, mm fields, fit check, Pipe rack, error summary, leave dialog.
4. **Tape view:** Tape stage at 1:1, ruler, overview strip, side panel with inspector, status line,
   disabled export.
5. **Lists:** Organ list and Tape list ledgers, empty states, next-step strip.
