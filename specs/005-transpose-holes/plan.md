# Implementation Plan: Transpose holes

**Branch**: `005-transpose-holes` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-transpose-holes/spec.md`

## Summary

The owner transposes all Holes of a Tape, or the selected ones, by a number of semitones, sees the
outcome before applying, and can undo it in one step. Two parts:

1. **Domain** (`api/tape/transpose-holes.ts`): one pure command `transposeHoles(tape, organ, which,
   semitones)` that returns the new Tape and the outcome per Hole (moved, moved by octaves, removed,
   left out) plus the merges. It reuses `octaveMoveTable` (spec 002) and `validTape` (ADR 22). The
   preview and the apply call the same function, so what is shown is what is applied (SC-003).
2. **Tape view**: the selection becomes a set of Holes (Ctrl/Cmd-click, drag a frame over an empty
   spot, Ctrl/Cmd+Arrow, Ctrl/Cmd+A, Escape), the side panel counts several selected Holes, and a
   **Transpose** dialog (scope, semitones, outcome, Apply/Cancel) commits one `TapeEditor.apply`
   with the resulting Holes selected.

No new IPC, no change to the stored Tape format.

## Technical Context

**Language/Version**: TypeScript 6.0 (strict), Node 24, Electron 44, Angular 22

**Primary Dependencies**: Angular Material 22 (`MatDialog`, `MatRadioGroup`, `MatFormField` with a
number input, `MatButton`), @ngx-translate 18. No new dependency.

**Storage**: unchanged. `tapes.json` stays version 1; an applied transposition is saved through
`TapeLibrary.update` like every edit of spec 004 (ADR 8, ADR 22).

**Testing**: Vitest (node) for `api/tape/transpose-holes.ts` and the pure selection functions;
`ng test` (jsdom) for the dialog, the side panel and the view's selection wiring; Playwright e2e for
transpose → restart → still there, and for undo in one step.

**Target Platform**: Electron desktop on Windows, macOS and Linux

**Project Type**: desktop app (Electron main process + Angular renderer + shared domain)

**Performance Goals** (SC-002): `transposeHoles` for 1,000 Holes in well under 100 ms; it is
O(n log n) (one sort per Pipe for merging) and runs on every change of the semitones.

**Constraints**: offline; Columns never change, so the Tape never grows; `Tape.transposition`
stays as created (FR-009).

**Scale/Scope**: one domain command, a multi-Hole selection in the Tape view, one dialog, one side
panel state, about 15 i18n keys.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Domain-driven slicing | Named after a user capability ("Transpose holes"), part of "Edit a tape" (#103). Dictionary terms: Tape, Hole, Pipe, Column, Organ, Transposition (entry already says "Transposing Holes moves each of them…"), Cutting Problem, moved by octaves. "The selected Holes" is a phrase (discovery, term 5). Code-only names (`TranspositionOutcome`, `HoleSelection`) are not domain terms. | ✅ |
| II. TDD | Every task starts red: node Vitest for `api/`, `ng test` for `src/`, Playwright for transpose → restart and undo. | ✅ |
| III. Framework-free domain | `transpose-holes.ts` imports only `api/`. The outcome is a discriminated union; semitones are a `Transposition`; the new Tape comes only from `validTape`. | ✅ |
| IV. Memory first, snapshots | The `TapeLibrary` stays the truth; one `TapeEditor.apply` per transposition. The selection and the dialog state are view state, not stored. | ✅ |
| V. Strict Electron boundary | No new channel, no preload change. | ✅ |
| VI. Context never lost | STATUS/ROADMAP per task group; DESIGN-GUIDE gets the selection gestures and keys; no ADR needed (follows ADR 22). | ✅ |
| VII. Small vertical slices | Stories 1–3 (P1, transpose all Holes) are shippable alone; multi-select (P2), undo check (P2) and keyboard/German (P3) follow. | ✅ |
| UI / i18n | Material dialog, radio group, form field; minimal SCSS (selection frame). Every key in en and de. | ✅ |

**Post-design re-check**: still passes. No new dependency, process, channel or stored state; the
command follows the ADR 22 pattern. No violation needs justification.

## ADR written

None. Transposing is one more domain command in the ADR 22 pattern. The selection gestures and the
dialog go into DESIGN-GUIDE.

## Open questions

None. Plan-level choices (merge counting, semitone range, gestures, keys, dialog, selection after
undo) are in [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/005-transpose-holes/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R9
├── data-model.md        # TranspositionOutcome, HoleSelection
├── quickstart.md        # manual and automated validation
├── contracts/
│   ├── domain-api.md    # transposeHoles, transposeRange
│   └── tape-view-ui.md  # selection gestures, keys, Transpose dialog, test ids
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
api/tape/
├── transpose-holes.ts            # NEW: transposeHoles, transposeRange, TranspositionOutcome
├── transpose-holes.spec.ts       # NEW
└── octave-moves.ts               # reused unchanged
api/index.ts                      # exports the new command and types

src/app/features/tape/tape-view/
├── hole-selection.ts             # + toggled, framed, extended, allOf, activeOf (pure, with specs)
├── hole-edit-commands.ts         # EditOutcome selection becomes a HoleSelection
├── tape-editor.ts                # TapeEdit.selection becomes a HoleSelection
├── tape-view.component.*         # selection set, frame drag, keys, Transpose button
├── tape-drawing.ts               # selected state for several Holes, the frame
├── transpose-dialog/             # NEW: scope, semitones, outcome, Apply/Cancel
└── selected-hole/                # "n Holes selected" state

src/assets/i18n/{en,de}.json      # TAPE.TRANSPOSE.*, TAPE.SELECTION.*
e2e/tape-transpose.spec.ts        # NEW
documentation/DESIGN-GUIDE.md     # selection gestures and keys
```

**Structure Decision**: the same three layers as slices 001–004 (ADR 2 to 4). The domain command
sits next to `hole-edits.ts`; the view logic stays in pure helpers beside the component, which is
already large (557 lines), so new logic goes into `hole-selection.ts` and the dialog, not into the
component.

## Order of work (for /speckit-tasks)

1. Domain `transposeHoles`: moved → octave moves → removed → left out → merges → outcome counts
   (Stories 1–3).
2. Transpose dialog for all Holes, wired to `TapeEditor.apply`; e2e transpose → restart (Story 1,
   MVP).
3. Selection as a set: pure functions, then the view (Ctrl/Cmd-click, frame, keys), the side panel
   count, 004 edits only with one Hole selected (Story 4).
4. Dialog scope "selected Holes"; resulting Holes selected; undo in one step (Stories 4, 5).
5. Keyboard and German (Story 6), DESIGN-GUIDE, STATUS/ROADMAP.

## Complexity Tracking

No violations.
