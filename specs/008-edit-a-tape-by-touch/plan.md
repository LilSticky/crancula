# Implementation Plan: Edit a tape by touch

**Branch**: `008-edit-a-tape-by-touch` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/008-edit-a-tape-by-touch/spec.md`, issue
[#152](https://github.com/LilSticky/crancula/issues/152)

## Summary

Make the Tape view editable by finger with one gesture model for every pointer type (ADR 25): a tap
selects a Spot and a second tap adds a Hole; grips outside the selected Hole resize it; a double-tap
removes it; a finger drag on empty Tape scrolls. The playhead becomes draggable. The Organ gains a
Crank speed range (snapshot v5) that bounds a new Crank speed slider beside the number field.
Decisions: [research.md](research.md); UI contract: [contracts/tape-view-ui.md](contracts/tape-view-ui.md);
types: [data-model.md](data-model.md).

## Technical Context

**Language/Version**: TypeScript 6, Node 24 (Electron 44)
**Primary Dependencies**: Angular 22 (signals, signal forms, OnPush), Angular Material 22 (`mat-slider`), @ngx-translate 18
**Storage**: Organ library snapshot in `userData` (v4 → v5, ADR 20); Tape snapshot unchanged
**Testing**: Vitest (node domain, jsdom Angular, ADR 9); Playwright e2e in Electron with `hasTouch`
**Target Platform**: Electron desktop on Windows (touch screens), macOS, Linux
**Project Type**: desktop app
**Performance Goals**: drags and slider stay at display rate on a 400-Column Tape; no re-render of off-screen Columns
**Constraints**: touch targets ≥ 44 × 44 px; spec 004 mouse and keyboard behaviour unchanged except the documented gesture model
**Scale/Scope**: one Tape view, one side-panel section, one Organ editor sheet; ~10 files changed, 3 new helpers

## Constitution Check

| Principle | Check |
|-----------|-------|
| I. Domain-driven slicing | Slice named after the capability; Spot and Crank speed range approved for DICTIONARY.md (2026-10-24) |
| II. TDD | Every task starts with a failing test (`test-first` → `implementer`) |
| III. Framework-free domain | `crank-speed-range.ts`, Organ, draft, validation and snapshot stay pure in `api/`; Spot, TapeSelection and TapMemory are view helpers, pure TS in `src/` |
| IV. Memory first, snapshots | Organ snapshot v5, older versions migrated on read |
| V. Strict Electron boundary | No IPC change; the Organ payload is validated by the existing `validateOrgan` path |
| VI. Context never gets lost | STATUS, ROADMAP, CHANGELOG `[Unreleased]`, ADR 25, DESIGN-GUIDE updated |
| VII. Small vertical slice | Five stories; P1 (US1, US2) alone is usable; size L |

Gate passes; no violations. Re-checked after Phase 1: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/008-edit-a-tape-by-touch/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
├── contracts/tape-view-ui.md
└── tasks.md   (/speckit-tasks)
```

### Source Code

```text
api/organ/
├── crank-speed-range.ts (+ spec)        new: CrankSpeedRange, DEFAULT_CRANK_SPEED_RANGE, nearestInRange
├── organ.ts, organ-draft.ts             crankSpeedRange; draft fields with defaults
├── validate-organ.ts (+ spec)           new codes
└── organ-library-snapshot.ts (+ spec)   version 5, v1–v4 read with 30–120
src/app/features/organ/organ-editor/
├── organ-form.ts                        labels/paths for the two fields
└── tape-bed-sheet/                      two decimal fields after Tape per Crank turn
src/app/features/tape/tape-view/
├── spot.ts (+ spec)                     new: Spot, TapeSelection, sameSpot, spotAt, moveSpot
├── double-tap.ts (+ spec)               new: TapMemory, nextTap, DOUBLE_TAP_MS
├── hole-drag.ts (+ spec)                holePartAt / HANDLE_PX removed; body = move
├── tape-view.component.{ts,html,scss}   tap handling, Spot drawing, grips outside, touch-action, playhead grip
├── add-hole/                            prefill from a Spot
└── crank-speed-change.ts                unchanged (commit path for the slider)
src/app/features/tape/preview/preview-section/   mat-slider, trial output, outside-range hint
src/assets/i18n/{en,de}.json             new keys
e2e/tape-touch.spec.ts                   new: touch flows in Electron
e2e/tape-crank*.spec.ts, e2e/organ*.spec.ts       slider, playhead drag, range fields
documentation/adr/0025-one-gesture-model-for-all-pointer-types.md
```

**Structure Decision**: existing layout; domain in `api/organ`, view helpers next to the Tape view.

## Phases

1. **Foundational, domain**: Crank speed range, Organ/draft/validation, snapshot v5.
2. **US1 (P1)** Spot and tap-to-add: TapeSelection, spotAt, tap on empty Tape, Spot drawing, keyboard, Add a Hole prefill, no `dblclick`.
3. **US2 (P1)** grips outside, double-tap remove.
4. **US3 (P2)** touch-action and no frame for touch.
5. **US4 (P2)** playhead grip and drag.
6. **US5 (P2)** Organ editor fields, slider, trial tempo, hint.
7. **Polish**: e2e touch suite, ADR 25, DESIGN-GUIDE (Tape visualisation, accessibility), ux-review, spec-auditor, docs.

## Risks

- Electron/Playwright touch emulation: `hasTouch` + `touchscreen.tap` work; touch drags need CDP
  `Input.dispatchTouchEvent`. If panning can't be proven in e2e, a component test checks
  `touch-action` and the no-frame rule, and the hand check in [quickstart.md](quickstart.md) covers the rest.
- Removing `dblclick` changes spec 004 tests that double-click to add; they must still pass as two
  clicks on one Spot (a mouse `dblclick` sends two `pointerdown`/`pointerup` pairs first).

## Complexity Tracking

None.
