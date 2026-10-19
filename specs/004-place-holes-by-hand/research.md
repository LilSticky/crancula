# Research: Place holes by hand

Each entry gives the decision, the reason for it, and the alternatives considered. Names follow
`documentation/DICTIONARY.md`. The slice uses one term added for it (Cutting Problem, approved
2026-10-19) and adds no other. Code-only names (`validTape`, `HoleRef`, `HoleEdit`,
`HoleEditRefusal`, `TapeEditor`, `EditHistory`, `HoleDrag`) are not domain terms, like
`TapeLibrary` in slice 002 and `TapeGeometry` in slice 003.

Facts about the existing code were read on 2026-10-19 from `api/tape/*`, `app/snapshot-file.ts`,
`app/application-menu.ts`, `src/app/features/tape/tape-library.store.ts` and
`src/app/features/tape/tape-view/**`. Columns are counted from 0 in the domain (`Column`) and from
1 in the UI and in every message (`start + 1`). The spec counts Columns as the Tape view shows
them, so spec Column *n* is `start === n − 1` in code (spec "Column 1" is `start === 0`).

The decisions with the widest reach (R1, R3, R5) are recorded as **ADR 22** (plan.md, "ADR
written").

## R1 One validating Tape factory

- **Decision**: `validTape(fields: TapeFields): Result<Tape, TapeRuleViolation>` in
  `api/tape/tape.ts` is the only way to get a `Tape` (the `validTapeBrand` stays). It checks every
  rule that does not need the Organ (discovery, invariants 1–3, 5, 6):
  - the name is not blank (it is trimmed);
  - `songId` and `selectedParts` are both set or both absent; `selectedParts` sorted, unique,
    non-empty;
  - every Hole starts at a `Column` (integer ≥ 0) and is a `ColumnCount` (integer ≥ 1) long;
  - every Hole ends within `length` (`start + length ≤ tape.length`);
  - Holes are sorted by Pipe, then start, and no two Holes of one Pipe overlap (touching is
    allowed).

  `asValidTape` is deleted. `createTape`, `parseTapeLibrarySnapshot`, `renameTape`,
  `removeHolesOfPipes` and every edit command (R3) build `TapeFields` and call `validTape`.
  - The snapshot parser keeps parsing raw JSON values itself (types, UUIDs, ranges) and maps a
    `TapeRuleViolation` to its existing English reason (`'a Hole ends beyond the end of the
    Tape'`, `'Holes are not sorted by pipe then start, or overlap within a row'`, `'name is
    blank'`), so its tests and the `unreadable` reasons stay as they are. `parseHoles` loses its
    own sort/overlap/end checks.
  - `createTape`, `renameTape` and `removeHolesOfPipes` can't produce a violation from valid
    input; `createTape` and `removeHolesOfPipes` throw on an impossible `err` (as `valid()` in
    `create-tape.ts` already does), `renameTape` maps `name-blank` to its existing
    `'name-required'`.
- **Rationale**: the rules are written twice today (create-tape.ts implicitly, the snapshot
  parser explicitly), and `removeHolesOfPipes` and `renameTape` spread a branded Tape without
  any check (discovery, model observations). Four new commands would make that six unchecked
  paths. One factory makes "a `Tape` value is valid" true by construction (constitution III),
  and the edit commands only have to decide what they want, not re-check it.
- **Alternatives considered**:
  - **Keep `asValidTape` and add checks to each command**: the duplication the discovery
    flagged, now in six places.
  - **A Tape class with private constructor and methods**: the rest of `api/` is plain
    interfaces with branded types and free functions (Organ, Song); a class would be the only
    one and breaks structural cloning over IPC.
  - **The factory sorts the Holes itself**: hides wrong order in a snapshot, which is a format
    rule today; the commands sort before calling it instead (R3).

## R2 One `cuttingProblems(tape, organ)`, replacing `exportProblems`

- **Decision**: rename `api/tape/export-problems.ts` to `api/tape/cutting-problems.ts`:
  `cuttingProblems(tape, organ): readonly CuttingProblem[]`, `CuttingProblem`,
  `CuttingProblemCode`. The rule is unchanged (`no-pipe`, `too-short`, `too-close`, compared in
  whole Columns through `holeLimitsOf`, ordered by start, row, code), so export keeps refusing
  exactly the Tapes it refuses today. New next to it:
  `holesWithCuttingProblems(problems): readonly HoleCuttingProblems[]` groups the problems per
  Hole for the marks and the side-panel list: a `too-close` problem marks **both** Holes (the
  earlier one and the one at `nextStart`, spec 3.2), so the later Hole gets an entry too.
  Users:
  - `PlotterExport` (export gate, spec 003) — unchanged behaviour;
  - the export problems dialog (renamed `CuttingProblemsDialogComponent`);
  - `inspectHole` (Selected Hole warnings) — already built on it;
  - the new marks and the Cutting Problems list in the Tape view (FR-010, FR-011).

  The UI texts move from `TAPE.EXPORT.PROBLEM_*` to `TAPE.CUTTING_PROBLEM.*`, shared by the dialog
  and the list (plus `TOO_CLOSE_PREVIOUS` for the later Hole of a pair).
- **Rationale**: FR-012 and SC-004 ask for the same rule in editing and export, "no drift". The
  dictionary now calls it Cutting Problem; the code must follow (constitution I). Grouping per
  Hole is a pure function of the problems and belongs next to them, so the marks and the count
  are tested in Node.
- **Not merged with `fixHoles`**: `hole-fixes.ts` *changes* Holes at import and shares only
  `holeLimitsOf`/`columnsFor` with the check (already shared since slice 003). The discovery's
  "rule written twice" is the inspector's old mm comparison, which slice 003 already switched to
  `exportProblems`. Nothing else is duplicated.
- **Alternatives considered**:
  - **Keep `exportProblems` and add an alias**: two names for one concept, against the
    dictionary.
  - **One problem per Hole pair** (only the earlier Hole marked, as export reports today):
    contradicts spec 3.2 ("both are marked").

## R3 Edit commands are pure domain functions returning `Result`

- **Decision**: `api/tape/hole-edits.ts` exports four commands. A Hole is named by a `HoleRef`
  (`{pipe, start}`), because Holes of one Pipe never overlap (spec, Key Entities). Positions are
  domain types (`Column` ≥ 0, `ColumnCount` ≥ 1), so "before Column 1" and "shorter than 1
  Column" can't be asked for; the UI clamps first (R6, R7, spec 1.4, 1.8, FR-006).

  | Command | Does | Refused when |
  |---------|------|--------------|
  | `addHole(tape, organ, pipe, start)` | adds a Hole of `pipe` at `start`, as long as the Minimum Hole Length in whole Columns (`holeLimitsOf`, at least 1), cut back to end at the last Column before the next Hole of that Pipe (R4) | `pipe` is not on the Organ; a Hole of `pipe` covers `start` |
  | `moveHole(tape, organ, ref, {pipe, start})` | moves the Hole to another Column and/or Pipe; keeps its length | no such Hole; `pipe` not on the Organ; it would overlap a Hole of the target Pipe |
  | `changeHoleLength(tape, ref, {start, length})` | gives the Hole a new extent on its Pipe (either end, or both) | no such Hole; it would overlap another Hole of its Pipe |
  | `removeHole(tape, ref)` | removes it; the Tape keeps its length | no such Hole |

  Add, move and change return `Result<HoleEdit, HoleEditRefusal>` where `HoleEdit` is
  `{tape, hole}` (the Hole after the edit, so the UI can select it, spec 2.4); remove returns
  `Result<Tape, HoleEditRefusal>`. A refusal names the Hole in the way (`{code: 'overlaps',
  other}`), so the UI can say "it would overlap the next Hole of its Pipe at Column 16" (FR-007; C4 at Columns 16–19, `start` 15).
  Each command builds the new Holes (replace or insert, then sort by Pipe and start), grows the
  length if needed (R5) and returns `validTape(...)` (R1); everything else is carried over
  unchanged (FR-017). Cutting Problems are **not** refused (FR-009) and Hole fixes are not applied
  (spec, Assumptions).
- **Rationale**: edits are Tape rules (overlap, growth, the Organ's Pipes), so they belong in the
  framework-free domain (constitution III) with fast Node tests for every acceptance scenario.
  `Result` is the house style (`createTape`, `renameTape`). Returning a whole new Tape fits
  immutable values, signals and the undo history (R8).
- **Alternatives considered**:
  - **Command objects with `apply`/`revert`**: inverse operations are more code and more ways to
    get undo wrong (growth, re-sorting); value snapshots make undo trivial (R8).
  - **Domain events** (HoleMoved, …): the discovery listed them as language; nothing consumes
    them yet. The command names carry the same words.
  - **Commands clamp positions themselves** (accept plain numbers): the types would allow
    invalid input; clamping is an input-device concern (drag past the Lead-in, key repeat).
  - **A Hole id in the Tape**: changes the snapshot format and the Hole type for no gain while
    Holes of one Pipe can't overlap (spec, Assumptions).

## R4 Length of an added Hole

- **Decision**: `length = min(minimumHoleLengthColumns, next.start − start)` where `next` is the
  next Hole of that Pipe; without a next Hole, the Minimum Hole Length in Columns. Because
  `start` is not covered (else refused), there is always at least 1 Column, so the command is
  total. A Hole cut back this way touches the next Hole and is marked *too close* (and *too
  short* if it is shorter than the Minimum Hole Length).
- **Settled by the spec** (FR-005, scenario 2.2): the new Hole fills the Columns up to the next
  Hole; its last Column is the one right before the next Hole's first Column (they touch).
- **Alternatives considered**: leaving a full Minimum Gap before the next Hole (the new Hole
  would often be shorter than needed and still marked); refusing when the Minimum Hole Length
  doesn't fit (contradicts 2.2).

## R5 Tape growth

- **Decision**: after building the new Holes, `length = max(tape.length, end of the edited
  Hole)`. Only add, move and change can grow it; remove and shrinking edits never change
  `length` (FR-008, decision 3). Undo restores the earlier Tape value, which brings back the
  shorter length (spec 4.1, 5.3). The geometry, ruler, Column numbers, subtitle and length in mm
  follow because they are computed from the Tape (spec 5.1).
- **Rationale**: `Tape.length` is stored precisely so that removing Holes doesn't change it
  (tape.ts). Growth is the only implicit change and is visible in the result.
- **Alternatives considered**: a separate "lengthen Tape" command (an extra step the user didn't
  ask for); shrinking to the last Hole (rejected by the user, decision 3).

## R6 Pointer gestures

- **Decision** (Tape stage, `svg` with pointer events and pointer capture):

  | Gesture | Where | Result |
  |---------|-------|--------|
  | Click | a Hole | selects it (as today) |
  | Drag (pointer moves ≥ 4 px after press) | a Hole's body | moves it; Columns follow the pointer along the row, rows follow it across; the Hole is selected first |
  | Drag | a handle at the start or end of the **selected** Hole | moves that end; the other end stays |
  | Double-click | an empty spot of a row | adds a Hole of that row's Pipe at that Column (`addHole`) and selects it |
  | Escape during a drag | — | cancels the drag; nothing changes |

  - **Snapping**: a pure `gridAt(x, y, scale, geometry)` turns px into a Column (floor, ≥ 0, not
    clamped at the Tape's end so a drag can grow the Tape) and the nearest row (clamped to the
    Organ's rows). A drag works in **deltas** from the press point: body `start + Δcolumns`,
    `row + Δrows`; end handle `end + Δcolumns` with at least 1 Column; start handle
    `start + Δcolumns`, clamped to `0 … end − 1`. Clamping gives spec 1.4 and 1.8.
  - **Handles**: drawn only on the selected Hole, one at each end, each `min(8 px, width / 3)`
    wide inside the Hole, with `cursor: ew-resize`; the body has `cursor: grab`. Only the
    selected Hole has handles, so a short Hole can still be grabbed by its body at "Whole Tape"
    zoom.
  - **Preview**: while dragging, the drawing shows the Tape the command would produce (only
    recomputed when the snapped Column or row changes, at most once per animation frame). A
    refused position shows the Hole at the pointer with an oxblood outline and no change to the
    Tape. **One drag is one Edit**, applied on release (spec 4: one undo step).
  - **Refusal**: on release over a refused position nothing changes and a snackbar says why
    (FR-007, "The Hole would overlap the Hole of C4 at Column 16."). No undo entry (spec 4.5).
  - **Auto-scroll**: while dragging within 24 px of the stage's left or right edge, the stage
    scrolls, so a Hole can be dragged past the visible part and past the Tape's end.
- **Rationale**: dragging is what the user expects of a drawing; a double-click on empty Tape
  doesn't conflict with click-to-select. Handles only on the selected Hole keep the hit areas
  large enough at 1:1 (a Column of 2.5 mm is 9.5 px). Applying on release keeps the undo history
  and the saves to one per gesture.
- **Alternatives considered**:
  - **Handles on every Hole**: a 1-Column Hole would be all handle and couldn't be moved.
  - **Click on an empty spot adds**: too easy to add by accident while trying to deselect.
  - **Angular CDK drag-drop**: built for lists and free positioning of HTML elements, not for
    snapping SVG rects to a Column grid with per-end handles; plain pointer events are smaller.
  - **Apply on every snapped step**: one undo step and one save per Column dragged.

## R7 Keyboard map

- **Decision** (while the Tape drawing has focus; arrows keep selecting, modifiers edit):

  | Keys | Action | Spec |
  |------|--------|------|
  | ← → ↑ ↓ | select the neighbouring Hole (unchanged) | 003 |
  | Enter / Space | select the first Hole (unchanged) | 003 |
  | Escape | clear the selection (unchanged); cancel a drag | |
  | Alt + ← / → | move the selected Hole one Column earlier / later | FR-001 |
  | Alt + ↑ / ↓ | move it to the row above / below (the neighbouring Pipe in rack order) | FR-002 |
  | Shift + ← / → | move its **end** one Column (shorten / lengthen at the end) | FR-003 |
  | Alt + Shift + ← / → | move its **start** one Column (lengthen / shorten at the start) | FR-003 |
  | Delete or Backspace | remove it; the selection goes to the next Hole of its row, else the previous, else none | FR-004 |
  | Ctrl + Z (⌘ Z on macOS) | undo | FR-014, FR-016 |
  | Ctrl + Y, Ctrl + Shift + Z (⌘ Shift Z on macOS) | redo | FR-014, FR-016 |

  - **Adding by keyboard** (spec 6.2): an **Add a Hole** section in the side panel with a Pipe
    select (the Organ's Pipes by note name, in rack order) and a Column field (from 1), prefilled
    with the selected Hole's Pipe and the first free Column after it (or the pointer's last row
    and Column), and an "Add Hole" button. It also serves an empty Tape. After adding, focus
    returns to the drawing with the new Hole selected.
  - Every key repeat is one Edit (one undo step, one save). A refused key (overlap) changes
    nothing and shows the snackbar; a clamped key at Column 1 or 1 Column long does nothing.
  - Undo and redo are handled on the Tape view's host element, so they work wherever focus is in
    the Tape view (drawing, side panel, buttons) **except in a text field**, where the field's own
    undo stays. `event.preventDefault()` stops the Edit menu's `role: 'undo'`/`'redo'`
    accelerators: Chromium sends key events to the page first and only unhandled ones reach the
    application menu, on macOS too (as web apps that handle ⌘Z rely on). Mod key: `metaKey` on
    macOS, `ctrlKey` elsewhere (`navigator.userAgentData?.platform`/`navigator.platform`).
  - **Undo / Redo buttons** in the page head (`mat-icon-button`, `undo`/`redo` icons,
    `aria-label` and tooltip with the shortcut), disabled when there is nothing to undo or redo
    (FR-015).
  - The Selected Hole section gets a one-line key help ("Alt+arrows move, Shift+arrows change the
    end, Alt+Shift+arrows the start, Delete removes"), so the shortcuts can be found.
  - **Known limit**: choosing *Edit → Undo* in the application menu with the mouse runs
    Chromium's text undo, not the Tape's. The spec asks for the shortcuts and visible controls
    only; routing the menu would need a new IPC channel (ADR 4). Filed as a follow-up if wanted.
- **Rationale**: arrows already move the selection (design guide, Accessibility); Alt+arrows
  already *move* things in Crancula (Pipes in the rack, design guide), so Alt+arrows moving a
  Hole is consistent. Shift+arrows resizing is the common convention in editors; Alt+Shift for
  the other end keeps one hand on the arrows. None of these combinations is a browser or OS
  shortcut inside a focused SVG (Windows' Alt+Shift layout switch fires only when no other key is
  pressed in between; VS Code uses Shift+Alt+→ the same way).
- **Alternatives considered**:
  - **Arrows move, Tab selects**: breaks the existing arrow selection (spec, Assumptions: extend,
    don't replace) and Tab's reading order.
  - **Ctrl + arrows**: Ctrl+← / → switch Spaces on macOS.
  - **A keyboard cursor (row, Column) on the drawing for adding**: a second, invisible "focus"
    inside the drawing; the form is plain, accessible and also explains the Column numbering.
  - **`[` / `]` to choose the end to change**: hidden mode state.

## R8 Undo and redo: a history of Tape values in the Tape view

- **Decision**: a pure, generic `EditHistory<T>` (`past`, `present`, `future`; `apply`, `undo`,
  `redo`, `canUndo`, `canRedo`) in `src/app/features/tape/tape-view/edit-history.ts`, wrapped by
  a `TapeEditor` service **provided by `TapeViewComponent`** (so it lives exactly as long as the
  Tape view and is dropped on leaving it or opening another Tape — FR-014, spec clarification).
  An entry is `{tape: Tape, selection: SelectableHole | undefined}`: undo brings back the Tape
  *and* selects what was selected before the edit, so the user sees what changed.
  - `apply(edit)` pushes the present onto `past`, clears `future` (spec 4.3), writes the new Tape
    through `TapeLibrary.update` (R9).
  - `undo`/`redo` move one entry and write that Tape the same way (saved like edits, FR-014).
  - The history starts with the Tape as it was when opened. If the Tape in the `TapeLibrary`
    is no longer the history's present (changed elsewhere, e.g. Pipes removed in the Organ editor
    — not reachable while the view is open, but cheap to guard), the history resets to it.
  - No limit on the number of entries: Tapes are immutable values that share their Hole objects,
    so an entry costs one array of references (about 50 KB for 6,000 Holes; 1,000 edits ≈
    50 MB at worst). Spec 4 asks to go back to the opened state.
  - Refused edits never reach the history (spec 4.5). SC-006 (n edits + n undos = opened Tape) is
    a Node test on `EditHistory` and a component test with the real commands.
- **Rationale**: the history is UI state of one open view, not domain state and not stored
  (spec, Assumptions); value snapshots make undo of growth and re-sorting exact for free.
- **Alternatives considered**:
  - **History in `TapeLibrary` (root store)**: outlives the view, against the clarification.
  - **Inverse commands**: see R3.
  - **NgRx Signals `withUndoRedo`-style plugin**: not in `@ngrx/signals` core; a 40-line pure
    class is easier to test.

## R9 Persistence: the same path as other Tape changes

- **Decision**: `TapeLibrary.update(tape: Tape): Promise<boolean>`: refuses (`false`) while the
  stored Tapes couldn't be loaded (as `rename` does) or for an unknown id; else `upsertEntity` and
  the existing `save()`, which sends the whole `TapeLibrarySnapshot` over `tapes:save`. Every
  applied edit, undo and redo calls it once.
  - **Ordering and debouncing are the main process's job, as ADR 8 says**: `createSnapshotFile`
    coalesces quick saves (latest snapshot wins, trailing debounce 250 ms, one write in flight,
    flush on `before-quit`). `ipcRenderer.invoke` messages arrive in order, so the last edit is
    always the one written. The renderer adds no debounce of its own.
  - A failed save sets `saveProblem`, shown by the status line as today (FR-013, edge case "a
    save fails"); the edit stays in memory and in the history; the next successful save clears
    it.
  - **No snapshot format change**: Holes stay `[pipe, start, length]` triples, `length` is
    already stored, nothing is added. `tapes.json` stays at version 1; no migration (ADR 20).
- **Rationale**: one save path for all Tape changes (FR-013 "like other Tape changes"); ADR 8
  already solves write storms and order.
- **Alternatives considered**:
  - **A renderer-side debounce or single-flight**: the main process already coalesces; a second
    layer would add a window where the in-memory state and the disk disagree without telling the
    user. Re-evaluate only if the performance test (R10) shows the snapshot build is slow.
  - **A new `tapes:update` channel sending one Tape**: a second write path and payload validator
    for a gain only at very large libraries (ADR 4 surface).
  - **Save on leaving the view**: loses edits on a crash; contradicts SC-003.

## R10 Performance for 2,000 Columns (SC-002)

- **Decision**: budget per edit on a 2,000-Column Tape with 31 rows and 6,000 Holes: command
  (copy, sort, `validTape`) + `cuttingProblems` + `holesWithCuttingProblems` + `tapeGeometry`
  under **20 ms** in Node (all O(H log H)); the view then renders only the visible Columns
  (`visibleColumns`, existing). Checks:
  - a Node timing test in `api/tape/hole-edits.spec.ts` (median of 20 runs < 20 ms, generous
    for CI);
  - an e2e check in `e2e/tape-edit.spec.ts`: from `Alt+→` to the moved `rect` in the DOM under
    100 ms on the reference Tape (measured with `performance.now()` in the page).
  - Marks are looked up by a `Set` of `"pipe:start"` keys, not by scanning problems per Hole.
  - During a drag the preview is recomputed only when the snapped Column or row changes (R6).
  - `toTapeLibrarySnapshot` runs once per edit (ADR 8); its cost grows with the stored Songs and
    is part of the e2e measurement.
- **Rationale**: SC-002's 100 ms includes rendering; the pure part must stay a small fraction.
- **Alternatives considered**: incremental problem updates for the edited row only (faster, but
  a second code path that could drift from export, SC-004); Web Worker (not needed at this
  size).

## R11 Marks and the Cutting Problems list in the Tape view

- **Decision**:
  - **Mark**: every Hole with a Cutting Problem gets a dashed oxblood ring 2 px outside its slot
    (the Hole itself stays ink: what you see is what gets cut). The selection ring stays solid
    blue, so a selected marked Hole shows both. Never colour alone (design guide): the ring is
    dashed, and the list and the Selected Hole section say it in words.
  - **Side panel section "Cutting Problems"** (new component), after Selected Hole: the count of
    Holes with a Cutting Problem in the heading ("3 Holes can't be cut"), "None" when 0, then one
    button per marked Hole in cut order: "C4 at Column 12: shorter than the Minimum Hole Length
    (2 mm of 5 mm)". Choosing one selects the Hole and scrolls it into view (FR-011). A Hole
    without a Pipe is listed as plain text (it is on no row and can't be selected, spec edge
    case) and counted.
  - The Selected Hole warnings stay as they are (already from the shared rule, FR-010).
  - Marks and list are `computed` from `cuttingProblems(tape, organ)` of the Tape in the
    `TapeLibrary` (or the drag preview), so they follow every edit, undo and redo at once.
- **Rationale**: FR-010, FR-011 and spec 3.1–3.4 with the design guide's colour roles (oxblood
  for errors).
- **Alternatives considered**: oxblood fill (would misrepresent what is cut); the list only in
  the export dialog (the user would find problems only at export, spec 3 "Why").

## R12 Where the code goes in the Tape view

- **Decision**: the Tape view component already has 292 lines and a 1,600-line spec (#80
  proposes splitting it). New behaviour goes into small units it composes:
  `tape-editor.ts` (service, R8/R9), `edit-history.ts` (pure, R8), `hole-drag.ts` (pure: hit
  part, deltas, clamping, R6), `grid-at.ts` (pure, R6), `edit-keys.ts` (pure: key event → edit
  intent, R7), `cutting-problems/` (side-panel section), `add-hole/` (side-panel form). The
  component only wires events to them. Pure units get plain Vitest tests; components get `ng test`
  tests; the full flows get e2e.
- **Rationale**: keeps the component from growing by the size of the slice, and the most
  logic-heavy parts testable without a DOM. Refs #80 (does not close it).
- **Alternatives considered**: everything in the component (the spec file would pass 2,500
  lines); a separate edit route (spec: edit directly in the Tape view, no edit mode).
