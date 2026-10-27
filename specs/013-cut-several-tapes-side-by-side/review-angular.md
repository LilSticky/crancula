# Angular review: slice 013

Reviewer: `angular-reviewer`, 2026-10-27, diff `origin/main...013-cut-several-tapes-side-by-side -- src/`.
0 must fix, 3 should fix, 3 nits. i18n parity green; terms match DICTIONARY.md.

## Should fix

1. `side-by-side-export.ts:64`: the saved snackbar has `duration: 0` and no action, so it can't be closed.
   Use PlotterExport's 6 s (shared constant) and fake timers in the spec.
2. `side-by-side-export.ts:128` (`savableCut`) and `side-by-side.component.ts:168` (`cut`) re-derive "plotter,
   every Lane has an Organ, at least one Lane" outside the domain (ADR 2), and can disagree (empty dialog). Add one
   `@api` function returning `{ok: true, cut} | {ok: false, refusals}` used by both.
3. `LANE_PROBLEMS` and `DRAWING` read "1 Cutting Problems" / "1 Lanes": add `_ONE` keys, pick by count as
   `cutting-problems.component.ts:85` does.

## Nits

4. `side-by-side.component.html:11`: `MatSelectChange` is `any`-typed; type it `MatSelectChange<PlotterId>`.
5. `tape-list.component.ts:213`: ticked ids keep filtered-out or deleted Tapes; count only ids of current rows.
6. `side-by-side.component.html:111`: `role="presentation"` Organ headings in the add menu aren't announced; use a
   group with `aria-label`.

## Fixed

See the commit after this file.
