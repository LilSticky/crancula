import type {Organ} from '../organ/organ';
import type {HoleRef} from './hole-edits';
import {transposition, type Hole, type Tape, type Transposition} from './tape';

/** Which Holes to transpose: every Hole, or the named ones (unknown refs are ignored). */
export type HolesToTranspose =
  | {readonly kind: 'all'}
  | {readonly kind: 'these'; readonly holes: readonly HoleRef[]};

/** What became of one transposed Hole. */
export type HoleFate =
  | {readonly kind: 'moved' | 'moved-by-octaves'; readonly from: Hole; readonly to: Hole}
  | {readonly kind: 'removed'; readonly from: Hole};

/** Holes that overlapped on one Pipe after moving and became one Hole. */
export interface Merge {
  /** The Hole on the new Tape. */
  readonly hole: Hole;
  /** At least two Holes as they would be after moving, by start. */
  readonly from: readonly Hole[];
}

export interface TranspositionOutcome {
  /** One per transposed Hole, in Tape order. */
  readonly fates: readonly HoleFate[];
  readonly merges: readonly Merge[];
  /** Holes without a Pipe on the Organ, only for `all`. */
  readonly leftOut: number;
  /** The Holes on the new Tape that came from a transposed Hole (moved, octave-moved or merged). */
  readonly resulting: readonly HoleRef[];
}

export interface Transposed {
  readonly tape: Tape;
  readonly outcome: TranspositionOutcome;
}

/** Moves the chosen Holes by `semitones` to other Pipes; octave moves, removals and merges as in spec 005. */
export function transposeHoles(
  _tape: Tape,
  _organ: Organ,
  _which: HolesToTranspose,
  _semitones: Transposition,
): Transposed {
  throw new Error('not implemented');
}

function reach(value: number): Transposition {
  const result = transposition(value);
  if (result === undefined) throw new Error(`Pipe note span out of range: ${value}`);
  return result;
}

/** The semitones that reach every Pipe from every other: ±(highest − lowest Pipe note), at most ±127. */
export function transposeRange(organ: Organ): {readonly lowest: Transposition; readonly highest: Transposition} {
  const notes = organ.pipes.map((pipe) => pipe.note as number);
  const span = notes.length === 0 ? 0 : Math.max(...notes) - Math.min(...notes);
  return {lowest: reach(0 - span), highest: reach(span)};
}
