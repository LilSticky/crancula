# Data model: Transpose holes

No stored data changes. `Tape` and `Hole` are as in [spec 004](../004-place-holes-by-hand/data-model.md).

## Which Holes (input)

```ts
type HolesToTranspose = {readonly kind: 'all'} | {readonly kind: 'these'; readonly holes: readonly HoleRef[]};
```

`these` names Holes by Pipe and start (`HoleRef`); unknown refs are ignored.

## TranspositionOutcome (domain, not stored)

```ts
type HoleFate =
  | {readonly kind: 'moved' | 'moved-by-octaves'; readonly from: Hole; readonly to: Hole}
  | {readonly kind: 'removed'; readonly from: Hole};

interface Merge {
  readonly hole: Hole;               // the Hole on the new Tape
  readonly from: readonly Hole[];    // ≥ 2 Holes as they would be after moving, by start
}

interface TranspositionOutcome {
  readonly fates: readonly HoleFate[]; // one per transposed Hole, in Tape order
  readonly merges: readonly Merge[];
  readonly leftOut: number;            // Holes without a Pipe on the Organ, only for 'all'
  /** The Holes on the new Tape that came from a transposed Hole (moved, octave-moved or merged). */
  readonly resulting: readonly HoleRef[];
}

interface Transposed {
  readonly tape: Tape;                 // from validTape; same id, name, Song, Transposition, length
  readonly outcome: TranspositionOutcome;
}
```

Counts shown (FR-005): `moved` and `moved-by-octaves` from `fates`, `merges.length`, `removed`
from `fates`, `leftOut`.

Invariants:

- `fates.length` = number of transposed Holes; a Hole that is merged still has its `moved`/
  `moved-by-octaves` fate.
- The new Tape's `length`, `transposition`, `songId`, `selectedParts`, `columnLength`, `name` equal
  the old ones (FR-009).
- 0 semitones: the Tape is returned unchanged, every fate is `moved` with `to` = `from`; the view
  disables Apply.

## HoleSelection (view, not stored)

```ts
type HoleSelection = readonly SelectableHole[]; // {row, start}; last = active; [] = none
```

Pure functions in `hole-selection.ts`: `toggled(selection, hole)`, `framed(holes, frame)`,
`extended(holes, selection, direction)`, `allOf(holes)`, `activeOf(selection)`.
`TapeEdit.selection` and `EditOutcome.selection` become `HoleSelection`.
