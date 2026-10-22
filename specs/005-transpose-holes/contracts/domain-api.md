# Contract: domain API (`@api`)

```ts
/** Moves the chosen Holes by `semitones` to other Pipes; octave moves, removals and merges as in spec 005. */
export function transposeHoles(
  tape: Tape,
  organ: Organ,
  which: HolesToTranspose,
  semitones: Transposition,
): Transposed;

/** The semitones that reach every Pipe from every other: ±(highest − lowest Pipe note), at most ±127. */
export function transposeRange(organ: Organ): {readonly lowest: Transposition; readonly highest: Transposition};
```

Exported from `api/index.ts` with `HolesToTranspose`, `HoleFate`, `Merge`, `TranspositionOutcome`,
`Transposed`. Types in [data-model.md](../data-model.md).

Behaviour (each line is at least one unit test):

1. Target Pipe on the Organ → `moved`, same Columns.
2. No Pipe at the target, one of its note name → `moved-by-octaves` to the nearest, upward on a tie.
3. No Pipe of its note name, or target outside 0–127 → `removed`.
4. Holes not chosen are unchanged unless merged.
5. Overlapping Holes on one Pipe after moving → one Hole, earliest start to latest end; listed in
   `merges`; touching Holes are not merged.
6. Holes whose Pipe is not on the Organ: unchanged; counted in `leftOut` for `all`.
7. Tape fields other than `holes` unchanged; the result passes `validTape`.
8. `resulting` names every Hole on the new Tape that came from a transposed Hole.
9. 1,000 Holes in under 50 ms.
