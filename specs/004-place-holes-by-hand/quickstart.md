# Quickstart: validate "Place holes by hand"

How to prove the slice works end to end. It refers to the [spec](spec.md),
[data model](data-model.md), [research](research.md) and the contracts:
[domain API](contracts/domain-api.md), [Tape view UI](contracts/tape-view-ui.md).

## Prerequisites

- Node 24 (`.node-version`), then `npm ci`.
- No fixture files: the Node tests build reference Tapes in code (an Organ with C4, D4, E4 and
  Minimum Hole Length/Minimum Gap chosen per scenario; a 100-Column Tape with C4 Holes at Columns
  10–13 and 16–19). The e2e tests create Organ and Tape through the UI with the helpers in
  `e2e/support/` (`organ-editor.ts`, `tape-creation.ts`, `midi-file.ts`).

## Automated checks (the Definition of Done gate)

| Command | Expected |
|---------|----------|
| `npm run lint` | no errors |
| `npm run i18n:check` | every `TAPE.EDIT.*`, `TAPE.ADD_HOLE.*`, `TAPE.CUTTING_PROBLEMS.*`, `TAPE.CUTTING_PROBLEM.*` key in `en.json` and `de.json`; `TAPE.EXPORT.PROBLEM_*` gone |
| `npm run test` | Node tests (`api/tape`: `tape`, `hole-edits`, `cutting-problems`, `create-tape`, `tape-library-snapshot`, `rename-tape`) and Angular tests (`src/`) green, including every 001–003 test |
| `npm run build` | build succeeds |
| `npm run e2e` | Electron flows green, including `e2e/tape-edit.spec.ts`, `tape-restart.spec.ts`, `tape-export.spec.ts`, `tape-german.spec.ts` |

The e2e suite in CI on Linux, Windows and macOS is the proof that the slice runs in Electron
(ADR 13).

## Scenarios the tests cover

"Node" is the Node Vitest project, "Angular" is `ng test` (jsdom), "e2e" is Playwright in Electron.

| # | Scenario | Expected | Proven in |
|---|----------|----------|-----------|
| 1 | Move C4 10–13 two Columns later (1.1) | 12–15 on C4 | Node, Angular (Alt+→ ×2), e2e (drag) |
| 2 | Move to D4 (1.2) | D4 10–13, C4 has none | Node, Angular (Alt+↓) |
| 3 | End +3, then start +2 (1.3) | 10–16, then 12–16 | Node, Angular (Shift+→, Alt+Shift+→), e2e (handle drag) |
| 4 | Shorten a 1-Column Hole (1.4) | stays 1 Column | Angular (key does nothing), Node (`hole-drag` clamp) |
| 5 | Remove (1.5) | gone; length unchanged | Node, Angular (Delete), e2e |
| 6 | Restart (1.6, SC-003) | edits still there | e2e (`tape-edit.spec.ts`, relaunch as in `tape-restart.spec.ts`) |
| 7 | Overlap with C4 16–19 (1.7, FR-007) | refused, unchanged, snackbar names Column 17 | Node, Angular, e2e |
| 8 | Before Column 1 (1.8, FR-006) | stays at Column 1 | Node (`hole-drag`), Angular |
| 9 | Add E4 at Column 20 (2.1) | Minimum Hole Length in Columns, at least 1 | Node, Angular (form), e2e (double-click) |
| 10 | Add before a close next Hole (2.2) | cut back, touching, marked | Node, Angular |
| 11 | Add on a covered Column (2.3) | nothing added | Node, Angular (form error) |
| 12 | New Hole selected (2.4) | selection ring on it, Selected Hole section shows it | Angular, e2e |
| 13 | Shorten below the Minimum Hole Length (3.1) | applied, marked, Selected Hole names the problem in mm | Node, Angular, e2e |
| 14 | Gap below the Minimum Gap (3.2) | both Holes marked | Node (`holesWithCuttingProblems`), Angular |
| 15 | Fix a problem (3.3) | mark gone | Angular |
| 16 | Count and list; choose an entry (3.4, FR-011) | count; entry selects and scrolls | Angular, e2e |
| 17 | Export with problems (3.5, SC-004) | refused as in spec 003 | Angular (`PlotterExport`), e2e (`tape-export.spec.ts`) |
| 18 | Undo after growth (4.1) | Tape as before, shorter length, saved | Angular, e2e |
| 19 | Redo; new edit clears redo (4.2, 4.3) | as specified | Node (`EditHistory`), Angular |
| 20 | Nothing to undo/redo (4.4, FR-015) | buttons disabled | Angular |
| 21 | Refused edit (4.5) | no undo entry | Angular |
| 22 | n edits + n undos (SC-006) | Tape equals the opened one | Node (`EditHistory`), Angular |
| 23 | Growth to 104 and 110 Columns; stays after remove (5.1–5.3) | length, ruler, subtitle follow | Node, Angular, e2e |
| 24 | Keyboard only (6.1, 6.2, SC-005) | every edit, add (form), undo, redo | Angular, e2e |
| 25 | OS shortcuts (6.3, FR-016) | Ctrl+Z / ⌘Z, Ctrl+Y / Ctrl+Shift+Z / ⌘⇧Z | Angular (both platforms by faked platform), e2e (`ControlOrMeta+Z`) |
| 26 | German (6.4, FR-018) | every new text German | `i18n:check`, e2e (`tape-german.spec.ts`) |
| 27 | Hole without a Pipe (edge, FR-019) | not drawn, counted and listed as text, unchanged by edits | Node, Angular |
| 28 | Save fails (edge, FR-013) | edit stays, status line reports | Angular (store with failing fake API) |
| 29 | Leave the view (FR-014) | undo history gone on return | Angular |
| 30 | 2,000 Columns (SC-002) | domain path < 20 ms (Node), key → DOM < 100 ms (e2e) | Node, e2e |
| 31 | Snapshot unchanged (R9) | `tapes.json` version 1, Holes as triples | Node (`tape-library-snapshot`), e2e (file read back) |

## Manual check (once, on macOS and Windows)

1. `npm run electron:local`, open a Tape.
2. Select a Hole, press ⌘Z / Ctrl+Z after an edit: the Tape's edit is undone and the Edit menu's
   text undo does nothing visible (research R7).
3. On Windows, press Alt+Shift+→ on a selected Hole: the start moves and the keyboard layout
   doesn't switch.
4. Drag a Hole past the right edge of the stage: the stage scrolls; release past the Tape's end:
   the Tape grows.
5. `npm run ux:screens`, then the `ux-review` skill on the Tape view (marks, handles, side panel
   sections) in both schemes.
