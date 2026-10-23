# Implementation Plan: Crank a tape

**Branch**: `007-crank-a-tape` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-crank-a-tape/spec.md`

## Summary

The Organ gains an optional `tapePerCrankTurn` (mm above 0), edited in the Organ editor's Tape Bed
sheet; the Organ snapshot goes to version 4 and older files load without it (ADR 20). The Tape gains a
required `crankSpeed` (turns per minute, 1–300); `validTape` checks it, a new command
`changeCrankSpeed` changes it as one undo step (ADR 22), and the Tape snapshot goes to version 2 with
60 turns per minute for version 1 files and for new Tapes.

A pure read model `performance(tape, organ)` gives the notes to play in Columns (silent Holes left
out, touching Holes in a row joined); `columnDuration(tape, organ)` gives seconds per Column. In the
renderer, a component-scoped `TapePreview` plays the performance from a start Column with a
look-ahead scheduler on the Web Audio clock, so a Crank speed change takes effect from the playhead
on within one scheduling window (≤ 0.1 s). Sound goes through a `PreviewSound` port (injection token):
the Web Audio adapter synthesises one organ-like voice per note; tests use a fake. The playhead is
drawn in the Tape view at `leadIn + column × columnLength`. While playing, every edit path in the
Tape view is refused except the Crank speed. No IPC change.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Angular 22, Electron 44, Node 24

**Primary Dependencies**: Angular Material 22, signal forms, @ngx-translate 18; Web Audio API
(Chromium, built in); no new package

**Storage**: Organ library snapshot v4 (`tapePerCrankTurn` optional), Tape library snapshot v2
(`crankSpeed`), both migrated on read (ADR 20)

**Testing**: Vitest (node for `api/`, jsdom for `src/` with a fake `PreviewSound` and a fake clock),
Playwright e2e in Electron (playhead moves, editing paused, restart keeps values; sound is not
asserted)

**Target Platform**: Windows, macOS, Linux desktop

**Project Type**: desktop app (Electron + Angular)

**Performance Goals**: playhead within 50 ms of the sound (one animation frame reads the audio clock);
a speed change heard within 0.2 s; scheduler work per tick linear in the notes in the window

**Constraints**: domain in `api/` free of Angular/Electron/Node; Web Audio only in a `src/` adapter;
en/de parity; jsdom has no Web Audio

**Scale/Scope**: two domain values, one command, one read model, two snapshot migrations, one audio
adapter, a Preview section and playhead in the Tape view, an Organ editor field, e2e

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. Domain-driven slicing | Named after the capability ("Crank a tape", #149). Terms: Crank, Crank speed, Tape per Crank turn, Preview (approved 2026-10-23), Tape, Column, Hole, Pipe, Organ, Cutting Problem. "Playhead" is a UI phrase. `performance` is a code name for the read model only. | ✅ |
| II. TDD | Every task starts red: node Vitest for `api/` and snapshots, jsdom specs for `TapePreview` (fake clock and sound), the Preview section and the view guards, Playwright for play/stop, playhead, paused editing and restart. | ✅ |
| III. Framework-free domain | `crank-speed.ts`, `change-crank-speed.ts`, `performance.ts` import only `api/`; invalid values are unrepresentable (branded `CrankSpeed`, optional branded `Millimetres` above 0). | ✅ |
| IV. Memory first, snapshots | `TapeLibrary`/`OrganLibrary` stay the truth; Crank speed changes go through `TapeEditor.apply`. The Preview state (playing, start Column, playhead) is view state, never stored. | ✅ |
| V. Strict Electron boundary | No new channel, no preload change; audio runs in the renderer. | ✅ |
| VI. Context never lost | STATUS/ROADMAP per task group; ADR 24 records the audio decision. | ✅ |
| VII. Small vertical slices | US1+US3 (hear a Tape on an Organ with Tape per Crank turn) ship first; Crank speed field, start Column and paused editing follow. | ✅ |
| UI / i18n | Material buttons and form fields, `crancDecimalInput`; minimal SCSS. Every key in en and de. | ✅ |

**Post-design re-check**: still passes. No new dependency or channel; two snapshot versions follow ADR 20.

## ADR written

[ADR 24: Preview synthesised with Web Audio in the renderer](../../documentation/adr/0024-preview-synthesised-with-web-audio.md).

## Open questions

None. Plan-level choices are in [research.md](research.md).

## Project Structure

### Documentation (this feature)

```text
specs/007-crank-a-tape/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── domain-api.md
│   └── preview-ui.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
api/organ/
├── organ.ts                        # Organ.tapePerCrankTurn?: Millimetres (> 0)
├── organ-draft.ts                  # draft field, empty, toDraft
├── validate-organ.ts               # optional, above 0 when given
└── organ-library-snapshot.ts       # version 4; ≤ 3 load without it
api/tape/
├── crank-speed.ts                  # new: CrankSpeed brand, crankSpeed(), limits, DEFAULT_CRANK_SPEED
├── tape.ts                         # Tape.crankSpeed; validTape rule
├── change-crank-speed.ts           # new: changeCrankSpeed
├── tape-library-snapshot.ts        # version 2; version 1 → 60/min
api/preview/
├── performance.ts                  # new: performance(tape, organ), columnDuration(tape, organ)
└── *.spec.ts
api/index.ts                        # exports

src/app/features/organ/organ-editor/
├── organ-form.ts, organ-editor.component.ts
└── tape-bed-sheet/                 # Tape per Crank turn field
src/app/features/tape/preview/       # new
├── preview-sound.ts                # PreviewSound port + token
├── web-audio-preview-sound.ts      # Web Audio adapter (organ-like voice)
├── tape-preview.ts                 # component-scoped player: state, scheduler, playhead
└── preview-section/                # side panel: Crank speed, start Column, duration, Play/Stop
src/app/features/tape/tape-view/
├── tape-view.component.ts/.html    # toolbar Play/Stop, Space, playhead, ruler click, edit guards
└── crank-speed-change.ts           # view model like column-length-change.ts
src/app/features/tape/tape-import/   # new Tapes get DEFAULT_CRANK_SPEED (via domain)
src/assets/i18n/en.json, de.json    # ORGAN.EDITOR.TAPE_PER_CRANK_TURN*, TAPE.PREVIEW.*
e2e/tape-preview.spec.ts            # new
e2e/organ-tape-per-crank-turn.spec.ts  # new (incl. v3 snapshot migration)
```

**Structure Decision**: the existing layout; the read model in its own `api/preview/` folder because it
reads Tape and Organ; the player and the audio adapter in a new `src/app/features/tape/preview/` folder
used by the Tape view.

## Complexity Tracking

No violations.
