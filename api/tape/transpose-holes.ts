import type {Organ} from '../organ/organ';
import type {HoleRef} from './hole-edits';
import {octaveMoveTable} from './octave-moves';
import {columnCount, transposition, validTape, type ColumnCount, type Hole, type Tape, type Transposition} from './tape';

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

interface Placed {
  readonly hole: Hole;
  readonly transposed: boolean;
}

const HIGHEST_NOTE = 127;

function checkedColumnCount(value: number): ColumnCount {
  const result = columnCount(value);
  if (result === undefined) throw new Error(`invalid Hole length: ${value}`);
  return result;
}

function byPipeThenStart(a: Hole, b: Hole): number {
  return a.pipe - b.pipe || a.start - b.start;
}

/** Joins every run of overlapping Holes of one Pipe (touching Holes stay apart). Expects `placed` sorted. */
function joinOverlapping(placed: readonly Placed[]): {readonly holes: readonly Placed[]; readonly merges: readonly Merge[]} {
  const holes: Placed[] = [];
  const merges: Merge[] = [];
  let run: Placed[] = [];
  let end = 0;
  const flush = (): void => {
    if (run.length === 0) return;
    if (run.length === 1) {
      holes.push(run[0]);
    } else {
      const first = run[0].hole;
      const hole: Hole = {pipe: first.pipe, start: first.start, length: checkedColumnCount(end - first.start)};
      holes.push({hole, transposed: run.some((each) => each.transposed)});
      merges.push({hole, from: run.map((each) => each.hole)});
    }
    run = [];
  };
  for (const next of placed) {
    if (run.length > 0 && (next.hole.pipe !== run[0].hole.pipe || next.hole.start >= end)) flush();
    run.push(next);
    end = run.length === 1 ? next.hole.start + next.hole.length : Math.max(end, next.hole.start + next.hole.length);
  }
  flush();
  return {holes, merges};
}

/** Moves the chosen Holes by `semitones` to other Pipes; octave moves, removals and merges as in spec 005. */
export function transposeHoles(
  tape: Tape,
  organ: Organ,
  which: HolesToTranspose,
  semitones: Transposition,
): Transposed {
  const moveTable = octaveMoveTable(organ);
  const onOrgan = new Set<number>(organ.pipes.map((pipe) => pipe.note));
  const named = which.kind === 'these' ? which.holes : [];
  const chosen = (hole: Hole): boolean =>
    which.kind === 'all' || named.some((ref) => ref.pipe === hole.pipe && ref.start === hole.start);

  const fates: HoleFate[] = [];
  const placed: Placed[] = [];
  let leftOut = 0;
  for (const hole of tape.holes) {
    if (!onOrgan.has(hole.pipe)) {
      if (which.kind === 'all') leftOut++;
      placed.push({hole, transposed: false});
    } else if (!chosen(hole)) {
      placed.push({hole, transposed: false});
    } else {
      const target = hole.pipe + semitones;
      const pipe = target >= 0 && target <= HIGHEST_NOTE ? moveTable[target] : undefined;
      if (pipe === undefined) {
        fates.push({kind: 'removed', from: hole});
      } else {
        const to: Hole = {...hole, pipe};
        fates.push({kind: pipe === target ? 'moved' : 'moved-by-octaves', from: hole, to});
        placed.push({hole: to, transposed: true});
      }
    }
  }

  const {holes, merges} = joinOverlapping(placed.sort((a, b) => byPipeThenStart(a.hole, b.hole)));
  const result = validTape({...tape, holes: holes.map((each) => each.hole)});
  if (!result.ok) throw new Error(`transposing Holes broke a Tape rule: ${result.error.code}`);
  const resulting = holes
    .filter((each) => each.transposed)
    .map(({hole}): HoleRef => ({pipe: hole.pipe, start: hole.start}));
  return {tape: result.value, outcome: {fates, merges, leftOut, resulting}};
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

/** @returns the amount as a Transposition, or `undefined` if it is not a whole number inside `transposeRange(organ)` */
export function transpositionWithin(organ: Organ, value: number): Transposition | undefined {
  const {lowest, highest} = transposeRange(organ);
  return value >= lowest && value <= highest ? transposition(value) : undefined;
}
