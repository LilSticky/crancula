# Research: Punch a tape

Each entry gives the decision, the reason for it, and the alternatives considered. Names follow
`documentation/DICTIONARY.md`; the slice adds no domain term (spec, Assumptions). Code-only names
(`TapeGeometry`, `Slot`, `ExportProblem`, `plotterFileName`, `SvgSaveRequest`) are not domain
terms, like `TapeLibrary` in slice 002. Facts about Electron were checked against the Electron 44
`dialog` documentation on 2026-10-17.

The decision with the widest reach (R1 to R3 together) is recorded as
[ADR 21](../../documentation/adr/0021-plotter-export-built-in-the-domain.md).

## R1 One geometry for the Tape view and the export, in `api/tape/`

- **Decision**: Move `tapeGeometry(tape, organ)` from
  `src/app/features/tape/tape-view/tape-geometry.ts` to `api/tape/tape-geometry.ts` and export it
  through `@api/index`. It becomes the single source of every position and size that gets cut:
  - **One frame of reference**: x in mm from the Lead-in's tip (the Tape's left end), y in mm from
    the top edge. Until now Slots were measured from the start of Column 1 and the view added the
    Lead-in in eight places; the shared frame is the file's frame, so the SVG writer copies
    numbers and the view only multiplies by its scale.
  - **New: the Tape Outline** (`outline`): the four corners of the closed cut, in cut order
    (data model). The Lead-in's diagonal runs from the bottom edge at Column 1 to the tip at
    (0, 0) on the top edge, over the whole Lead-in (dictionary, Lead-in). With a Lead-in of 0 the
    same four points give a square cut, because the tip and Column 1 coincide (FR-010).
  - **New: the end cut** one Minimum Gap after the end of the last Column, so the Tape's total
    length is `leadIn + length × columnLength + minimumGap` (FR-006, scenario 1.4: 50 + 600 + 2 =
    652 mm).
  - Slots keep their shape (FR-009): a rectangle one hole diameter high with corner radius
    `holeDiameter / 2`, from the start of the first to the end of the last Column; a Hole whose
    Pipe is not on the Organ gets no Slot (as today).
- **Consequence for the Tape view** (FR-008): the view draws the Tape Outline from the shared
  geometry. Two things it draws today change:
  - the Lead-in's diagonal: today it is capped at 10 mm (`LEAD_IN_SLANT_MM`) and runs from the
    bottom-left corner up to the top edge. The dictionary's diagonal (added for this slice) runs
    over the whole Lead-in from the bottom edge at Column 1 to the tip on the top edge;
  - the end: the Tape body ends one Minimum Gap after the last Column, not at it.

  The ruler and the Column numbers still count from Column 1. The Selected Hole inspector's "gap
  to the Tape's end" stays in Columns up to the end of the last Column, as in slice 002 (the
  Minimum Gap before the end cut is always kept, so the inspector can't warn about it).
- **Rationale**: FR-008 and SC-002 ask for the same geometry in the view and in the file. Only
  `api/` is reachable from both the renderer and a pure test of the SVG writer, and the geometry
  is pure arithmetic over `Tape` and `Organ` (ADR 2).
- **Alternatives considered**:
  - **Keep the geometry in `src/` and build the SVG there**: the SVG writer would be an Angular-
    side file without Angular, testable only through the `src/` test project, and invisible to
    the domain's Node tests. A future DXF or HPGL writer would have to live in `src/` too.
  - **Two frames** (Slots from Column 1, the Outline from the tip): fewer edits in the view, but
    every consumer must remember which frame a number is in; this is how "what you see" and "what
    gets cut" drift apart.
  - **The SVG writer re-derives positions from `Tape` and `Organ`**: duplicates the geometry,
    against FR-008.

## R2 The SVG is built in the domain, in the renderer

- **Decision**: A pure function `plotterSvg(geometry: TapeGeometry): string` in
  `api/tape/plotter-svg.ts` turns the geometry into the file's text. The renderer calls it after
  the export check (R4) passes and sends the text to the main process (R6). The main process
  never sees a Tape or an Organ.
- **Rationale**:
  - The domain owns the file format as an adapter (ADR 2, ADR 5: "both are adapters around the
    Tape domain"), with Node Vitest tests that compare numbers, not pixels.
  - The renderer already holds the Tape and its Organ in memory (ADR 3); sending them to the main
    process would need a validator for both and a second copy of the state.
  - The main process stays a thin file adapter: a save dialog and one write.
- **Alternatives considered**:
  - **Build the SVG in the main process from a Tape and an Organ sent over IPC**: needs
    `parseTapeLibrarySnapshot`-style validation of a Tape and an Organ on every export, and the
    main process would be a second place that knows the geometry.
  - **Build the SVG with the DOM** (`XMLSerializer` over an `SVGSVGElement`): not available in
    the domain or in Node tests; string output is simple for a file of only `path` elements.

## R3 The SVG file

- **Decision**:

  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="652mm" height="100mm" viewBox="0 0 652 100">
    <path d="M51.5,30.5 H60.5 A1.5,1.5 0 0 1 60.5,33.5 H51.5 A1.5,1.5 0 0 1 51.5,30.5 Z" fill="none" stroke="#000000" stroke-width="0.1"/>
    …one path per Hole, in cut order (R5)…
    <path d="M0,0 H652 V100 H50 Z" fill="none" stroke="#000000" stroke-width="0.1"/>
  </svg>
  ```

  - **Units**: `width` and `height` in `mm`, `viewBox` from 0 to the same numbers, so one user unit
    is one millimetre and the file opens at true size without scaling (FR-006, SC-003). Inkscape,
    Silhouette Studio, Cricut Design Space and the common sign-cutting programs all honour `mm` on
    the root `width`/`height`.
  - **Only cuts** (FR-011): one `path` per Hole and one for the Tape Outline, each a closed
    subpath (`Z`), `fill="none"`, a black stroke 0.1 mm wide (a hairline that is still visible
    on screen; the spec leaves line width and colour to the plan, they don't affect the cut). No
    `rect`, `text`, groups, ids, metadata, `<title>` or styles, so no user text reaches the file
    and nothing needs XML escaping.
  - **A Hole's path**: start at the top of the left half-circle's centre line, straight along the
    top edge, a half-circle arc (`A r,r 0 0 1`) down at the right end, straight back along the
    bottom edge, a half-circle up at the left end, close. A Hole exactly one hole diameter long is
    a circle made of two arcs. The export check (R4) guarantees that no Hole is shorter than the
    hole diameter (the Minimum Hole Length), so the arcs always fit; the writer still clamps the
    radius to half the length, as SVG does for `rect`, so it is total.
  - **The Tape Outline's path**: `M0,0 H<total> V<width> H<leadIn> Z` — top edge from the tip, end
    cut, bottom edge back to Column 1, and `Z` closes along the Lead-in's diagonal to the tip. With
    a Lead-in of 0, `H0 Z` is the square cut at Column 1 (FR-010).
  - **Numbers**: plain decimals with a `.`, rounded to 0.001 mm and printed without trailing zeros
    or exponent (`12`, `30.5`, `0.333`). 0.001 mm is ten times finer than SC-002's tolerance;
    rounding is done once, in the writer, on values from the geometry.
  - **Encoding**: UTF-8 without BOM, `\n` line endings, one element per line (diffable, and some
    cutter programs choke on very long lines).
- **Alternatives considered**:
  - **`rect` with `rx`/`ry`** (as the Tape view draws Holes): the same shape, but several cutter
    programs import `rect` as a plain rectangle or ignore `rx`; a `path` is understood everywhere.
  - **One `path` with all Holes as subpaths**: smaller, but cutter programs treat a path as one
    object and may reorder its subpaths; one element per cut keeps the order visible (R5).
  - **Hairline as `stroke-width="0.001"` or `vector-effect="non-scaling-stroke"`**: invisible in
    most viewers, and `vector-effect` is not supported by all cutter programs.
  - **Inches or `px` at 96 dpi**: needs the cutter program to agree on the dpi; `mm` doesn't.

## R4 The export check is a pure domain function

- **Decision**: `exportProblems(tape: Tape, organ: Organ): readonly ExportProblem[]` in
  `api/tape/export-problems.ts`. An empty list means the Tape can be cut. It returns **every**
  problem (Story 2.4), ordered like the cuts (R5):
  - `no-pipe`: the Hole's Pipe is not on the Organ;
  - `too-short`: the Hole is shorter than the Minimum Hole Length;
  - `too-close`: the Hole keeps less than the Minimum Gap to the next Hole in its row (also when
    the two overlap). Reported once, on the earlier Hole, naming the next Hole's start Column.

  A Hole can have both `too-short` and `too-close`. Lengths and gaps compare **in Columns**, with
  the limits converted by `columnsFor` exactly as `createTape` does (`holeLimitsOf` in
  `create-tape.ts` is moved next to `columnsFor` in `hole-fixes.ts` and exported from there). So a
  Tape that `createTape` just made always passes, and `1.1 mm × 3 Columns` against `3.3 mm` is not
  refused because of floating-point error. The problem still carries the lengths in mm for the
  message (FR-003; spec 002 FR-011).
- **Reuse**: the Selected Hole inspector (`inspect-hole.ts`) does the same length and gap
  comparisons in mm without the tolerance. It is switched to the domain function's per-Hole rules
  in the same slice, so the inspector warns about exactly the Holes the export refuses. Its
  output (`HoleWarning`) stays as it is.
- **Rationale**: the check is domain logic (Tape × Organ rules), runs in milliseconds, and must
  be tested exhaustively (SC-004), which is cheapest in Node Vitest.
- **Alternatives considered**:
  - **Re-run `fixHoles` and compare**: tells that something changed, not which Hole and why.
  - **Check in the main process before writing**: the main process doesn't have the Tape (R2), and
    the user must be told before a dialog opens (FR-003).
  - **Disable the button for a Tape that can't be cut**: rejected by the user (spec, Session
    2026-10-17; FR-001).

## R5 Cut order

- **Decision**: The writer emits the Holes sorted by their start Column, then by row (row 1
  first), then the Tape Outline (FR-012). The geometry keeps Slots in this order too, so the view
  and the file iterate the same list. Each Hole is one closed path; where on that path the blade
  starts is left to the cutter's software (spec, Assumptions).
- **Rationale**: Tape stores Holes by Pipe, then start (slice 002), which is not the order along
  the Tape; sorting once in the geometry makes FR-012 visible in one place.
- **Alternatives considered**: nearest-neighbour ordering to shorten blade travel: not asked for,
  and it breaks "from the Lead-in towards the end".

## R6 Saving the file: a new allow-listed channel, the main process shows the dialog

- **Decision**: One new channel `plotter:save-svg` (renderer → main, `invoke`), exposed as
  `window.crancula.plotter.saveSvg(request)` ([contract](contracts/plotter-ipc.md)).
  - The request carries the suggested file name (R7), the SVG text (R2) and the save dialog's
    translated title and filter name. The main process validates it with
    `parseSvgSaveRequest(unknown)` from `api/app/svg-save-request.ts` (ADR 4).
  - The main process shows `dialog.showSaveDialog(window, …)` with `defaultPath` = the remembered
    folder (below) joined with the suggested name, a filter for `*.svg`, and
    `properties: ['showOverwriteConfirmation', 'createDirectory']`. Windows and macOS ask before
    replacing by default; the property makes Linux ask as well (edge case "file already exists").
  - **Folder suggested first**: the user's Documents folder (`app.getPath('documents')`); after a
    successful save, that file's folder, remembered in memory until the app quits. Not stored:
    it is a convenience, not state (ADR 3).
  - Cancelled → `{status: 'cancelled'}`, nothing written. Chosen → `fs.promises.writeFile(path,
    svg, 'utf8')`; success → `{status: 'saved', filePath}`; an error → `{status: 'failed', reason}`
    with the error's message (FR-015). No atomic temp-file rename: this is an export, not a
    snapshot (ADR 8), and a temp file next to the user's file would surprise them.
  - The renderer gets the chosen path back to tell the user where the file was saved (FR-005).
    This is the first time a file path reaches the renderer; it is a path the user just chose,
    and the renderer can't use it for anything but display (no Node access, ADR 4).
  - The Tape and the snapshots are never touched (FR-014).
- **Testability**: the handler gets its effects as parameters (`showSaveDialog`, `writeFile`,
  `documentsFolder`), like `registerAppHandlers` gets `applyMenu`, so Node Vitest covers every
  branch with fakes and a temp folder. `main.ts` passes a function that reads
  `dialog.showSaveDialog` **at call time**, so the e2e suite can replace it through
  `electronApp.evaluate(({dialog}) => …)` (R9).
- **Alternatives considered**:
  - **A renderer download** (`<a download>` with a Blob URL): Electron shows its own save dialog
    through `will-download`, but the suggested folder, the result (saved where? cancelled?) and
    the write error are hard to get back to the page, and it needs a session hook in the main
    process anyway.
  - **Two channels** (`dialog:show-save` returning a path, then `files:write` with a path from the
    renderer): lets the renderer name any path to write to, which ADR 4's boundary is meant to
    prevent.
  - **The main process translates the dialog title itself** from `src/assets/i18n` (as it does
    for the menu): needs the main process to track the language; the renderer already has the
    texts, and two short strings are easy to validate.
  - **Write through the existing snapshot code** (`snapshot-file.ts`): built for coalesced writes
    into `userData`, not for one write to a user-chosen place.

## R7 Suggested file name

- **Decision**: `plotterFileName(tapeName: string): string` in `api/tape/plotter-file-name.ts`
  returns `<name>.svg` where the name is made safe on Windows, macOS and Linux:
  - `< > : " / \ | ? *` and control characters (U+0000–U+001F, U+007F) become `_`;
  - leading and trailing spaces and trailing dots are removed (Windows drops them);
  - a name that is a Windows device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`,
    `LPT1`–`LPT9`, any case, also before a dot) gets a `_` in front;
  - cut to 200 UTF-16 code units before `.svg`, without splitting a surrogate pair;
  - a name with nothing left becomes `Tape.svg`.

  The Tape's name is not changed (edge case). The suggested name is the same in German and
  English (Story 4.1). The main process uses only `path.basename` of the suggestion and rejects
  one that doesn't end in `.svg` (contract), so a forged request can't suggest another folder.
- **Rationale**: the strictest common rules are Windows'; using them everywhere gives the same
  name on every platform, which matters when Tapes are shared between machines.
- **Alternatives considered**: per-platform rules (`process.platform` in the main process): the
  same Tape would suggest different names; and the main process would own a domain rule.

## R8 The command in the Tape view

- **Decision**:
  - "Export for the Plotter" (`TAPE.VIEW.EXPORT`) is enabled whenever a Tape and its Organ are
    shown (FR-001). The text "Export comes in a later release" (`TAPE.VIEW.EXPORT_LATER`) is
    removed.
  - On click: `exportProblems` → if not empty, a Material dialog "This Tape can't be cut yet"
    lists every problem: the Pipe's note name, the start Column (from 1), and the reason with its
    numbers ("shorter than the Minimum Hole Length of 3 mm (2.5 mm)", "closer than the Minimum
    Gap of 2 mm to the Hole at Column 17 (1 mm)", "no Pipe on the Organ"). The list scrolls
    inside the dialog; one close button. No save dialog opens, nothing is written (FR-003).
  - Otherwise: build the geometry and SVG, call `plotter.saveSvg`; while it runs the button is
    disabled (no second dialog). `saved` → snackbar "Saved to {path}"; `cancelled` → nothing;
    `failed` or `rejected` → snackbar "The file could not be saved: {reason}" that stays until
    dismissed (FR-015).
  - The orchestration lives in a small injectable `PlotterExport` next to the Tape view, so the
    already large `TapeViewComponent` (split in #80) only gains a button handler.
- **Rationale**: dialogs and snackbars are the patterns the app already uses for confirmations and
  "Organ saved"; a dialog fits a list that can be long (Story 2.4).
- **Alternatives considered**: showing the problems in the side panel: it can be hidden below
  1180 px (Tape details toggle) and competes with the Import Summary and the Selected Hole.

## R9 Test strategy (test pyramid, constitution II, ADR 7, 9, 13)

| Level | What | Where |
|-------|------|-------|
| Node unit | `tapeGeometry`: Slots and Outline in the tip frame, scenario 1.3 and 1.4 numbers, Lead-in 0, Border 0, empty Columns at the end, Holes without a Pipe skipped, cut order | `api/tape/tape-geometry.spec.ts` (moved, extended) |
| Node unit | `plotterSvg`: root `width`/`height`/`viewBox` in mm, one path per Hole plus the Outline last, path data of scenario 1.3, a Hole one diameter long, number formatting, no other elements (FR-011), a 10-minute Tape under 5 s (SC-005) | `api/tape/plotter-svg.spec.ts` |
| Node unit | `exportProblems`: each code, several problems listed, overlap, both problems on one Hole, float tolerance, Tape without Holes passes, a fresh `createTape` result passes | `api/tape/export-problems.spec.ts` |
| Node unit | `plotterFileName`, `parseSvgSaveRequest` | `api/tape/…`, `api/app/…` |
| Node unit | `registerPlotterHandlers` with fake dialog and real temp folder: rejected payload, cancel, save, overwrite, write error, remembered folder, basename only | `app/plotter-ipc.spec.ts` |
| Angular component (jsdom) | Button enabled; problems dialog lists every problem in en and de; save path snackbar; cancel shows nothing; failure snackbar; button disabled while saving; Tape store unchanged; view draws the Outline from the shared geometry (diagonal, end cut) | `tape-view.component.spec.ts`, `plotter-export.spec.ts`, `export-problems-dialog` spec |
| e2e (Electron) | Real IPC and file on disk: stub `dialog.showSaveDialog` via `electronApp.evaluate`, capture its `defaultPath`, export, read the file with `fs` and check size and paths; a refused Tape writes nothing; a write into a missing folder shows the failure; German texts; `window.crancula` keys include `plotter` | `e2e/tape-export.spec.ts`, `e2e/boundary.spec.ts` |

The e2e suite stays small (four or five tests): only it proves the preload, the channel, the
native dialog call and the file on disk (ADR 13). Geometry and SVG details are proven in Node.
