# Audit: Crank a tape

## angular-reviewer (2026-10-24)

**Must fix**
- `web-audio-preview-sound.ts:84-85`: `cancelScheduledValues(at)` then `linearRampToValueAtTime(0, end)` ramps from the end of the attack, so the gain falls early and clicks. Hold the value at `at` first.
- `tape-preview.ts:57`: `close()` is never called; each Tape view that played leaks an AudioContext.
- `add-hole.component.ts:44`: deprecated `disabled` signature; use `disabled(path, {when: …})`.

**Should fix**
- `resume()` is never called, so a suspended context plays nothing.
- Space toggles in a focused mat-select, link, option or contenteditable; also skip `defaultPrevented`.
- The toggle has both `aria-pressed` and a switching label (state announced twice).
- A disabled toggle doesn't say why (`disabledInteractive` + `aria-describedby`); the editing-paused notice needs `role="status"`.
- `previewAvailable` repeats a domain rule; use `columnDuration(…) !== undefined`.

**Nit**
- `tape-view.component.ts:529`: stale comment (undo/redo can't happen while playing); call `changeTape` from `onCrankSpeedChange` instead of an effect.
- `followPlayhead` reads and writes layout in `afterEveryRender`; use `afterRenderEffect` phases.

All Must fix and Should fix items fixed (tests first); both nits applied. One red test was wrong: its
listener sat on `document`, which the test fixture is not attached to.

## spec-auditor (2026-10-24)

T001–T043 have specs and code. Gaps, accepted:
- US3.4: no test plays at two Tape per Crank turn values; `columnDuration` (node spec) covers the rate.
- US1.4/1.5: the marks staying while the playhead passes are not tested in the view; the domain keeps
  those Holes (`performance.spec.ts`), and the Preview does not touch the marks.
- US5.2: leaving for another Tape is covered only by the destroy test.
- US5.3: scroll or zoom while playing is not tested beyond follow-the-playhead.
- SC-001, SC-002, SC-003, SC-005: not measured (timing); SC-003 follows from `previewLength`.
- Edge cases without a test: a Tape with no Holes; clipping (the compressor graph is checked).
