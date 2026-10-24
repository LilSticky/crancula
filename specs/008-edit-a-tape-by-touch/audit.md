# Audit: Edit a tape by touch

Reviews of 2026-10-24: angular-reviewer ([review.md](review.md)), ux-review ([ux-review.md](ux-review.md)) and
spec-auditor (below). Follow-ups left open: [#156](https://github.com/LilSticky/crancula/issues/156).

## What was fixed

- Earlier review round: changed Organ fields named in reading order; a slider press without a move saves nothing and
  the thumb sits on whole turns; room for the end grip of a Hole at the last Column; a lost pointer capture ends a
  playhead drag.
- angular-reviewer should-fix 1: a still tap on a grip is no tap on its Hole (tap on a Hole, then on its grip, no
  longer removes it).
- spec-auditor: two fingers at once edit nothing (a second touch ends the gesture; touches change nothing until all
  are up); specs added for a touch drag taken over as a scroll (`pointercancel`) and for a pen frame.
- ux-review 1–2: Tape per Crank turn and the Crank speed range fields get a full row each in the Tape Bed card; the
  German unit is "U/min". Labels are no longer cut off and Lead-in is no longer stretched (screen 10 retaken).

## Not fixed, and why

- ux-review 3–4 (grips "6 px"): the screenshot shows only the 6 px bar; the hit area is 44 px (`MIN_GRIP_PX` in
  `hole-drag.ts`, tested in `hole-drag.spec.ts`). No change.
- angular-reviewer should-fix 2 (`holeAt` derives the length from the slot width) and the three nits: #156.
- A touch whose `pointerup` never reaches the drawing would keep its id in the touch set; touch pointers are captured
  implicitly by their target, so this needs an unusual path. #156.
- ux-review later items (dark-mode grip contrast, zoom segment at 1024 px, toast text, screens for Spot, slider and
  playing): #156.

## spec-auditor (2026-10-24)

| Requirement / scenario | Covering tests | Status |
|---|---|---|
| US1.1–US1.6, FR-001–FR-004, FR-007 Spot, tap–tap, keyboard, Add a Hole | `tape-view.component.spec.ts` (US1, Spot), `spot.spec.ts`, `double-tap.spec.ts`, `add-hole.component.spec.ts`; e2e `tape-touch` | covered |
| US2.1–US2.4, FR-005–FR-007 grips (44 px), resize, move, double-tap removes | `hole-drag.spec.ts`, component grip and double-tap specs; e2e `tape-touch` | covered |
| US2.5 very short Hole | `hole-drag.spec.ts` (1-Column Hole, separate grips); no component drag of a 1-Column Hole by touch | partial |
| US3.1–US3.3, FR-008 finger scrolls, Holes and grips don't, mouse and pen frame | component US3 specs incl. pen; e2e `tape-touch` scroll | covered |
| Edge: touch drag taken over as scroll | component spec (`pointercancel` after a touch drag) | covered |
| Edge: two fingers at once | component specs (empty Tape; first finger on a Hole) | covered |
| Edge: Lead-in tap, Preview playing, Spot after the last Column, two different Holes | component, `spot.spec.ts`, `double-tap.spec.ts` | covered |
| US4.1–US4.3, FR-009 playhead drag | component US4 specs incl. lost capture; e2e `tape-preview` | covered |
| US5.1–US5.6, FR-010–FR-013 Crank speed range, slider, outside range | domain, Organ editor, preview section and Tape view specs; e2e Organ restart and v4 migration, slider then Undo | covered |
| Edge: range change leaves the Tape's Crank speed alone | `change-crank-speed.spec.ts`; no test of an open Tape | partial |
| FR-014 keyboard and en/de texts | keyboard specs; `npm run i18n:check` (317 keys) | covered |
| SC-001–SC-003 timing | e2e covers the gestures; timing not measured | partial |
| SC-004, SC-005 | per-gesture undo specs; spec 004 suite green | covered |

No tests cover nothing in the spec.
