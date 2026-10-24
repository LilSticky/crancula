# T037 Angular review: slice 008 (`git diff origin/main...HEAD -- src/ api/`)

Second round, after the four `fix(...)` commits. Checked: standalone/OnPush/`inject()`, signals and
`input()`/`output()`, native control flow, strict typing, Material, i18n parity (`npm run i18n:check`:
317 keys, 0 errors), ADR 2 domain placement, DICTIONARY terms (Spot, Crank speed range), ADR 4, colocated specs.

## Must fix

None.

## Should fix

1. `src/app/features/tape/tape-view/tape-view.component.ts:851-855`: a still press on a **grip** counts as
   a tap on its Hole, so tapping a Hole (selects it, grips appear) and then tapping one of its grips
   within 400 ms (`DOUBLE_TAP_MS`) removes the Hole instead of starting a resize. Fix: expose the
   grabbed part from `HoleDragSession` (for example `get grabbedPart(): HolePart | undefined`) and call
   `tapHole` only when the part is `'body'`. For a grip press, clear `tapMemory`. Add a component spec:
   tap Hole, then a still press/release on `[data-testid=hole-handle]` keeps the Hole.
2. `src/app/features/tape/tape-view/spot.ts:21`: `holeAt` works out a Hole's length from
   `Math.round(slot.width / geometry.columnLength)`. That reverses the drawing geometry instead of using
   the domain. Fix: look the Hole up in `tape.holes` (row to Pipe via `organ.pipes`) with
   `start <= column < start + length`, or add a small `holeCovering(tape, pipe, column)` to
   `api/tape/hole-edits.ts` next to `firstFreeColumnAfter`, which already does the same scan.

## Nit

3. `tape-view.component.ts:225-228`: `holeSelection` returns a new `[]` on every recompute while a Spot is
   selected, so its dependants recompute for nothing. Fix: return a module constant `NO_HOLES: HoleSelection = []`.
4. `tape-view.component.html:111`: the Spot `<rect>` has no `aria-hidden="true"`, unlike the ghost and
   the marks. The `spot-live` region already announces it. Fix: add `aria-hidden="true"`.
5. `tape-view.component.ts:716`: `NonNullable<typeof this.framing>` repeats an inline type. Fix: name
   the type (`interface Framing`) and use it for the field and the parameter.
