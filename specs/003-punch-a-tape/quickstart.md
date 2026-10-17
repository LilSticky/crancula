# Quickstart: validate "Punch a tape"

How to prove the slice works end to end. It refers to the [spec](spec.md),
[data model](data-model.md), [research](research.md) and the contracts:
[IPC](contracts/plotter-ipc.md), [domain API](contracts/domain-api.md).

## Prerequisites

- Node 24 (`.node-version`), then `npm ci`.
- No fixture files are committed for this slice: the tests build reference Organs and Tapes in
  code (the scenario 1.3/1.4 Organ: tape width 100 mm, hole diameter 3 mm, spacing between rows
  4 mm, 10 Pipes, Minimum Gap 2 mm, Lead-in 50 mm; Column length 3 mm, 200 Columns). The e2e
  tests create them through the UI with the existing helpers in `e2e/support/`.

## Automated checks (the Definition of Done gate)

| Command | Expected |
|---------|----------|
| `npm run lint` | no errors |
| `npm run i18n:check` | every new `TAPE.EXPORT.*` key in `en.json` and `de.json`; `TAPE.VIEW.EXPORT_LATER` gone; `TAPE.EXPORT.PROBLEM.*` listed in `DYNAMIC_PREFIXES` in `scripts/check-i18n.mjs` |
| `npm run test` | Node tests (`api/tape`, `api/app`, `app/`) and Angular tests (`src/`) green, including the 001 and 002 tests |
| `npm run build` | build succeeds (bundles the new `app/plotter-ipc.ts`) |
| `npm run e2e` | Electron flows green, including `e2e/tape-export.spec.ts` |

The e2e suite in CI on Linux, Windows and macOS is the proof that the slice runs in Electron
(ADR 13).

## Scenarios the tests cover

"Node" is the Node Vitest project, "Angular" is `ng test` (jsdom), "e2e" is Playwright in Electron.

| # | Scenario | Expected | Proven in |
|---|----------|----------|-----------|
| 1 | Exportable Tape opened (1.1, FR-001) | "Export for the Plotter" enabled; no "later release" text | Angular, e2e |
| 2 | Export, save (1.2, FR-004, FR-005) | dialog's `defaultPath` ends in `<Tape name>.svg` in Documents; one file written; snackbar names the path | Node (`app/`), Angular, e2e |
| 3 | Hole of row 1 at Column 1, 4 Columns (1.3, FR-009) | slot 50–62 mm, 3 mm wide, half-circle ends, centre line 32 mm | Node (geometry, SVG), e2e (file) |
| 4 | Tape of 200 Columns (1.4, FR-006, FR-010) | document `652mm × 100mm`, `viewBox="0 0 652 100"`; Outline `M0,0 H652 V100 H50 Z` | Node, e2e |
| 5 | Export again (1.5, FR-014, SC-006) | Tape and `tapes.json` unchanged; second export works | Angular (store), e2e |
| 6 | File in cutter software (1.6, SC-003) | true size in mm, Lead-in left, row 1 on top | manual (below) |
| 7 | Hole shorter than the Minimum Hole Length (2.1) | no dialog, no file; problem names note, start Column, Minimum Hole Length | Node, Angular, e2e |
| 8 | Two Holes closer than the Minimum Gap (2.2) | both named, with the Minimum Gap | Node, Angular |
| 9 | Hole without a Pipe (2.3) | named as "no Pipe on the Organ" | Node, Angular |
| 10 | Several problems (2.4, SC-004) | every one listed | Node, Angular |
| 11 | After a refusal (2.5) | Tape unchanged | Angular |
| 12 | Cut order (3.1, 3.2, FR-012) | paths ordered by start, row 1 first at equal start; Outline last | Node, e2e |
| 13 | German (4.1, SC-007) | dialog title, problems, saved and failed messages in German; file name not translated | Angular, e2e |
| 14 | Lead-in 0 (FR-010) | Outline `M0,0 H… V… H0 Z` | Node |
| 15 | Tape without Holes | only the Outline | Node |
| 16 | Cancel the dialog | nothing written, no message | Node (`app/`), Angular |
| 17 | Write fails (FR-015) | "could not be saved" with the reason; Tape unchanged; can retry | Node (`app/`), Angular, e2e |
| 18 | Name with `/` or `:` | suggested name with `_`; Tape name unchanged | Node, Angular |
| 19 | Only cuts (FR-011, FR-013) | file has only `path` elements, `fill="none"`, no text, no transforms | Node |
| 20 | The view draws what is cut (FR-008, SC-002) | the view's Lead-in diagonal and end cut come from the same `TapeOutline`; Slots equal | Angular |
| 21 | 10-minute Song (SC-005) | geometry + SVG under 5 s, one file | Node |
| 22 | Forged request on the channel | `rejected`, no dialog | Node (`app/`) |

## Manual walkthrough (optional, `npm run electron:local`)

1. Describe the reference Organ above and bring a short MIDI Song onto a Tape named "Test: 1/2".
2. Open the Tape; the Lead-in is drawn as one diagonal from the bottom edge at Column 1 to the tip
   on the top edge, and the Tape ends 2 mm after the last Column.
3. Choose "Export for the Plotter"; the dialog suggests `Test_ 1_2.svg` in Documents. Save.
4. Open the file in Inkscape (Document Properties shows mm) or the cutter's software: the size is
   the Tape's length × 100 mm, the Holes are slots, the Outline closes. Measure one Hole.
5. In the Organ editor, raise the hole diameter so a Hole is too short (or the rows still fit and
   the Minimum Gap breaks). Open the Tape again and choose Export: a list of problems, no dialog.
6. Switch to German and repeat 3 and 5.
