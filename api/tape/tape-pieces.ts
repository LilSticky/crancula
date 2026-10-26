import type {Plotter} from '../plotter/plotter';
import type {TapeGeometry} from './tape-geometry';

/** Floating point slack for lengths in mm. */
const EPSILON = 1e-9;

/** A place where the Tape may be cut: after a Column boundary, with the Overlap of the Plotter behind it. */
export interface Join {
  /** mm from the tip; a Column boundary. */
  readonly at: number;
  /** The Join lies after this Column, counted from 1. */
  readonly after: number;
  /** `at` plus the Overlap of the Plotter. */
  readonly overlapEnd: number;
}

/** One Tape piece: the stretch of the Tape one Plotter file is cut from, in mm from the tip. */
export interface TapePiece {
  /** From 1, in order from the Lead-in. */
  readonly number: number;
  /** 0 for the first piece, else the Join before it. */
  readonly start: number;
  /** The end of its Overlap, or the end cut on the last piece. */
  readonly end: number;
  /** The Join the piece ends at; absent on the last piece. */
  readonly join?: Join;
}

/** The Tape is cut into these Tape pieces, the fewest the Joins allow. */
interface PiecesCut {
  readonly kind: 'pieces';
  readonly pieces: readonly TapePiece[];
}

/** Some stretch of the Tape is longer than the working length between two possible Joins: no cut exists yet. */
interface NoJoin {
  readonly kind: 'no-join';
}

/** How a Tape is cut for a Plotter. */
export type TapePieces = PiecesCut | NoJoin;

/** An open interval in mm that a Slot and its Minimum Gap block for a Join, shrunk by the slack. */
interface BlockedInterval {
  readonly from: number;
  readonly to: number;
}

/** Sorted, disjoint blocked intervals: the Slots widened by the Minimum Gap, overlapping ones merged. */
function blockedIntervals(geometry: TapeGeometry): readonly BlockedInterval[] {
  const gap = geometry.endGap;
  const sorted = geometry.slots
    .map((slot): BlockedInterval => ({from: slot.x - gap + EPSILON, to: slot.x + slot.width + gap - EPSILON}))
    .sort((a, b) => a.from - b.from);
  const merged: BlockedInterval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last !== undefined && interval.from < last.to) {
      merged[merged.length - 1] = {from: last.from, to: Math.max(last.to, interval.to)};
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

/**
 * Tests whether a point lies inside a blocked interval, for points asked in increasing order: the cursor only
 * moves forward, so one sweep over the intervals serves every point.
 */
function blockedTest(intervals: readonly BlockedInterval[]): (point: number) => boolean {
  let cursor = 0;
  return (point: number): boolean => {
    let interval = intervals[cursor];
    while (interval !== undefined && interval.to <= point) {
      cursor += 1;
      interval = intervals[cursor];
    }
    return interval !== undefined && interval.from < point;
  };
}

/** Every Column boundary after Column 1 and before the last Column where neither the Join nor its Overlap end is blocked. */
function possibleJoins(geometry: TapeGeometry, overlap: number): readonly Join[] {
  const intervals = blockedIntervals(geometry);
  const joinBlocked = blockedTest(intervals);
  const overlapEndBlocked = blockedTest(intervals);
  const columns = Math.round(geometry.length / geometry.columnLength);
  const joins: Join[] = [];
  for (let after = 1; after < columns; after += 1) {
    const at = geometry.leadIn + after * geometry.columnLength;
    const overlapEnd = at + overlap;
    if (joinBlocked(at) || overlapEndBlocked(overlapEnd)) continue;
    joins.push({at, after, overlapEnd});
  }
  return joins;
}

/**
 * Cuts `geometry` into Tape pieces for `plotter`. Each piece ends at the furthest possible Join that still fits
 * the working length, which gives the fewest Tape pieces.
 */
export function tapePieces(geometry: TapeGeometry, plotter: Plotter): TapePieces {
  if (plotter.roll) {
    return {kind: 'pieces', pieces: [{number: 1, start: 0, end: geometry.totalLength}]};
  }
  const {workingLength, overlap} = plotter;
  const fits = (overlapEnd: number, start: number): boolean => overlapEnd - start <= workingLength + EPSILON;
  const joins = possibleJoins(geometry, overlap);
  const pieces: TapePiece[] = [];
  let start = 0;
  // joins[0 .. reached) end their Overlap within a piece that starts at `start`; the start only moves forward.
  let reached = 0;
  while (geometry.totalLength - start > workingLength + EPSILON) {
    while (reached < joins.length && fits(joins[reached].overlapEnd, start)) reached += 1;
    const furthest = reached > 0 ? joins[reached - 1] : undefined;
    if (furthest === undefined || furthest.at <= start) return {kind: 'no-join'};
    pieces.push({number: pieces.length + 1, start, end: furthest.overlapEnd, join: furthest});
    start = furthest.at;
  }
  pieces.push({number: pieces.length + 1, start, end: geometry.totalLength});
  return {kind: 'pieces', pieces};
}
