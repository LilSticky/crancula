# Implementation Plan: Adjust a tape

**Branch**: `006-adjust-a-tape` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-adjust-a-tape/spec.md`

## Summary

The owner changes a Tape's Column length in the Tape section of the Tape view's side panel. A new
domain command `changeColumnLength(tape, columnLength)` replaces the Column length and keeps every
Hole; `validTape` gains the rule that a Column length is above 0, so no Tape can hold another one.
While the owner types, the section shows how many Cutting Problems the Tape has now and would have
(`cuttingProblems` on the changed Tape). Applying goes through `TapeEditor.apply`: one undo step, saved
through `TapeLibrary.update`, as in specs 004 and 005 (ADR 22). No new channel or snapshot format.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Angular 22, Electron 44, Node 24

**Primary Dependencies**: Angular Material 22, signal forms, @ngx-translate 18, NgRx Signals

**Storage**: Tape library snapshot in `userData` (unchanged format, already stores `columnLength`)

**Testing**: Vitest (node for `api/`, jsdom for `src/`), Playwright e2e in Electron

**Target Platform**: Windows, macOS, Linux desktop

**Project Type**: desktop app (Electron + Angular)

**Performance Goals**: marks and the problem count update within one frame of typing on Tapes of a few
thousand Holes (`cuttingProblems` is linear)

**Constraints**: domain in `api/` free of Angular/Electron/Node; en/de parity

**Scale/Scope**: one domain function, one rule in `validTape`, one editable field with a hint, e2e

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Domain-driven slicing | Named after the capability ("Adjust a tape", #107, last part of #103). Terms: Tape, Column, Column length (in the Column entry), Hole, Pipe, Cutting Problem, Minimum Hole Length, Minimum Gap. No new term. | ✅ |
| II. TDD | Every task starts red: node Vitest for `api/`, jsdom specs for the section and the view, Playwright for change → restart and undo. | ✅ |
| III. Framework-free domain | `change-column-length.ts` imports only `api/`; the result is a `Result`; the new Tape comes only from `validTape`. | ✅ |
| IV. Memory first, snapshots | `TapeLibrary` stays the truth; one `TapeEditor.apply` per change. The typed value and the hint are view state. | ✅ |
| V. Strict Electron boundary | No new channel, no preload change. | ✅ |
| VI. Context never lost | STATUS/ROADMAP per task group; no ADR needed (follows ADR 22). | ✅ |
| VII. Small vertical slices | Story 1 (change and keep) ships alone; the count before applying (Story 2) and undo checks (Story 3) follow. | ✅ |
| UI / i18n | Material form field with `crancDecimalInput`; minimal SCSS. Every key in en and de. | ✅ |

**Post-design re-check**: still passes. No new dependency, channel or stored state.

## ADR written

None. One more domain command in the ADR 22 pattern.

## Open questions

None. Plan-level choices are in [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/006-adjust-a-tape/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── domain-api.md
│   └── tape-view-ui.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
api/tape/
├── tape.ts                         # validTape: new rule column-length-not-positive
├── change-column-length.ts         # new: changeColumnLength
└── change-column-length.spec.ts    # new
api/index.ts                        # export changeColumnLength

src/app/features/tape/tape-view/
├── tape-section/tape-section.component.ts   # Column length field, problem-count hint, Apply
├── tape-section/tape-section.component.spec.ts
├── column-length-change.ts         # new: view model (typed value → parsed, problems now/then)
├── column-length-change.spec.ts    # new
├── tape-view.component.ts/.html    # wires the section's apply to TapeEditor.apply
└── tape-view.component.spec.ts

src/assets/i18n/en.json, de.json    # TAPE.SECTION.COLUMN_LENGTH_* keys
e2e/tape-column-length.spec.ts      # new
```

**Structure Decision**: the existing layout; the domain command next to `rename-tape.ts` and
`transpose-holes.ts`, the UI inside the existing Tape section.

## Complexity Tracking

No violations.
