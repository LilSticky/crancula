# Angular review: side-by-side UX follow-ups (#198), 2026-10-28

Reviewer: `angular-reviewer`, diff `origin/main...198-side-by-side-ux`.

## Must fix
1. `side-by-side-drawing.ts:96-99`, `side-by-side.component.html:69`: the working-width dash is computed in mm, but
   `vector-effect: non-scaling-stroke` draws `stroke-dasharray` in screen px; at Whole Tape the dashes grow with the
   Tape length. Fix: a static `stroke-dasharray: 4 2` in the SCSS `.working-width` rule, drop `workingWidthDash` and
   its constants, and test that the dash is the same at both zooms. (fixed)

## Should fix
2. `side-by-side.component.html:9-11`: a disabled Save can't take focus, so its `aria-describedby` reason is
   unreachable. Use `[disabledInteractive]="true"` as the Tape view does, and return early in `save()` without a roll
   plotter. (fixed)
3. `tape-list.component.ts:102`: the header tick box needs an indeterminate state while some, not all, Tapes are ticked. (fixed)

## Nit
4. `tape-list.component.ts:122`: format the Cutting Problems count through `formatNumber`, like the Lane list. (fixed)
5. `side-by-side.component.html:52`: `hatchSize` is 0 until layout; fall back to the 1:1 scale while the stage width is 0. (fixed)

## Clean
OnPush, signals, `viewChild`, control flow, Material, i18n parity, domain `cuttingProblems` reused, no `any` or `!`.
