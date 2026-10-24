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
  - **Undo and Redo** sit in the page head as icon buttons (`undo`, `redo`) next to the zoom toggle
    and Export, disabled when there is nothing to undo or redo; tooltip and accessible name name the
    shortcut: "Undo (Ctrl+Z)", "Redo (Ctrl+Y)" (Ctrl+Shift+Z on Linux, ⌘Z and ⇧⌘Z on macOS).
  - **Side panel**, in this order: *Tape* (Organ, Column length, Columns, length, Holes), *Selected
    Hole* (Pipe and row, Columns 65–79, length "15 Columns, 37,5 mm", gap to the next Hole or to the
    end of the Tape, warnings for a Hole below the Minimum Hole Length or a gap below the Minimum
    Gap; with a selection also the line of edit keys), *Cutting Problems*, *Import Summary* (only
    right after the import, dismissible, not stored) and *Add a Hole*.
  - **Cutting Problems:** heading, then "None" or "3 Holes can't be cut"; one full-width text button
    per marked Hole with the problems in words and mm ("C4 at Column 16: the gap to the previous
    Hole at Column 10 is 1 mm, the Minimum Gap is 2 mm."). The button selects the Hole and scrolls it
    into view. A Hole whose Pipe the Organ lacks is listed as plain text, as there is nothing to
    select.
  - **Add a Hole:** a form with a Pipe select (the Organ's Pipes by note name), a Column field
    (numbered from 1) and the filled button "Add". It is prefilled from the selected Hole. A Column
    already covered by a Hole of that Pipe, or not a whole number from 1, shows a sentence under
    the fields (`role="alert"`). After adding, the focus returns to the Tape drawing.
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
- **Selecting several Holes:** a plain click selects one Hole; Ctrl/Cmd-click toggles a Hole in or
  out of the selection. Dragging a frame from an empty spot selects the Holes it touches; with
  Ctrl/Cmd it adds to the selection, and a press without travel clears it. Ctrl/Cmd+Arrow extends
  the selection, Ctrl/Cmd+A selects all Holes, Escape clears it. Handles show only with exactly one
  Hole selected. The status line reads "n Holes selected".
- **Transpose dialog:** opened from the page head. Scope is all Holes or the selected ones; the
  semitones field accepts only values within the allowed range, and the outcome (moved, merged,
  removed Holes) is shown before applying. Apply is one undo step.
- **Grips** (slice 008, ADR 25): only the selected Hole has two grips, one beside each end and
  outside the Hole: a visible 6 px bar in the accent colour, with a hit area of at least 44 × 44 px
  that never covers the Hole body, so even a 1-Column Hole can be moved and resized by finger. The
  cursor is `ew-resize` over a grip, `grab` over a Hole body and `grabbing` during a drag.
- **Spot:** a tap or click on empty Tape selects a Spot, drawn as the outline of the Hole that would
  be added (Minimum Hole Length long); a second tap there adds it. Spot and Hole selection exclude
  each other.
- **Touch:** a finger drag on empty Tape scrolls; mouse and pen draw the selection frame. Two taps
  on a Hole within 400 ms remove it. The playhead has a grip in the ruler (44 px wide, ruler high)
  that can be dragged, also while the Preview plays.
- **Cutting Problem marks:** every Hole that cannot be cut (no Pipe on the Organ, shorter than the
  Minimum Hole Length, or closer than the Minimum Gap to its neighbour, both Holes of a pair) gets a
  dashed oxblood ring, 2 px outside the Hole, drawn only for the visible Columns and ignoring the
  pointer. Colour is never the only cue: the ring is dashed, and the side panel names each problem.
- **Drag preview:** while a Hole or one of its ends is dragged, the drawing shows the would-be
  result live, snapped to Columns and rows; the stage scrolls when the pointer is within 24 px of
  its left or right edge. Escape cancels. A refused position (the result would overlap a Hole of
  the same Pipe) draws a ghost with an oxblood outline (class `refused`) at the would-be position under the
  pointer, while the Hole being dragged stays unchanged where it was, for as long as the pointer is on the refused cell. Releasing
  there changes nothing and opens a snackbar that names the Hole in the way: "The Hole would
  overlap the Hole of C4 at Column 16."
- Double-clicking an empty place of a row is two taps on one Spot, so it adds a Hole of that row's
  Pipe at that Column.

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
- **Editing a Hole by keyboard** (focus on the Tape drawing, `role="application"`; without a
  selection the edit keys do nothing). Alt+←/→ moves the Hole one Column, Alt+↑/↓ one row, Shift+←/→
  moves its end, Alt+Shift+←/→ its start, Delete or Backspace removes it (the next Hole of the row
  is selected, else the previous one). A key that would overlap another Hole changes nothing and
  shows the snackbar. The Selected Hole section lists these keys as text, and the drawing refers to
  it with `aria-describedby` while a Hole is selected, so the keys are spoken, not only shown.
- **Undo and redo:** Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z (⌘Z and ⇧⌘Z on macOS), anywhere in the Tape
  view except text fields, which keep their own undo. The page head buttons do the same.
- **Adding without a pointer:** the Add a Hole form does what two taps do, prefilled from the Spot;
  with a Spot selected, arrow keys move it, Enter adds there and Escape clears it. The Spot is
  announced in a visually hidden live region.
- **Touch targets:** grips and the playhead grip are at least 44 × 44 px (24 px tall in the ruler).
- The Selected Hole section is `aria-live="polite"`, so a changed position or length is announced;
  the edit keys line is outside that live region. The snackbar of a refused edit announces itself.
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
