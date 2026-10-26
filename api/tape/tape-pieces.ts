import type {Plotter} from '../plotter/plotter';
import {column, type Column} from './tape';
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

/** A stretch of Columns that no Tape piece can span: no possible Join lies near enough to end one (FR-015). */
export interface JoinlessStretch {
  /** First and last Column of the stretch, counted from 0. */
  readonly first: Column;
  readonly last: Column;
}

/** The Tape is cut into these Tape pieces, the fewest the Joins allow. */
interface PiecesCut {
  readonly kind: 'pieces';
  readonly pieces: readonly TapePiece[];
}

/** Some stretch of the Tape is longer than the working length between two possible Joins: no cut exists. */
interface NoJoin {
  readonly kind: 'no-join';
  readonly stretches: readonly JoinlessStretch[];
}

/** The Tape is wider than the working width of the Plotter; nothing else is computed (FR-017). */
interface TooWide {
  readonly kind: 'too-wide';
  readonly tapeWidth: number;
  readonly workingWidth: number;
}

/** How a Tape is cut for a Plotter. */
export type TapePieces = PiecesCut | NoJoin | TooWide;

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

/** @returns the Column for a value the cut computed itself, an integer ≥ 0; throws for anything else. */
function checkedColumn(value: number): Column {
  const result = column(value);
  if (result === undefined) throw new Error(`invalid Column: ${value}`);
  return result;
}

/**
 * The stretches no Tape piece can span. The neighbours are the tip, each possible Join in order and the end cut. A Tape
 * piece from one neighbour to the next fits when its end (the Overlap end of the Join, or the end of the Tape) lies
 * within the working length of its start. Each neighbouring pair that does not fit is a stretch: from the Column after the
 * earlier neighbour to the Column before the later one (research R4).
 */
function joinlessStretches(geometry: TapeGeometry, joins: readonly Join[], workingLength: number): readonly JoinlessStretch[] {
  const lastColumn = Math.round(geometry.length / geometry.columnLength) - 1;
  const stretches: JoinlessStretch[] = [];
  let from: Pick<Join, 'at' | 'after'> = {at: 0, after: 0};
  for (const to of [...joins, undefined]) {
    const end = to === undefined ? geometry.totalLength : Math.min(to.overlapEnd, geometry.totalLength);
    if (end - from.at > workingLength + EPSILON) {
      stretches.push({first: checkedColumn(from.after), last: checkedColumn(to === undefined ? lastColumn : to.after - 1)});
    }
    from = to ?? from;
  }
  return stretches;
}

/**
 * The Tape pieces when every neighbouring pair fits. Each piece ends at the furthest possible Join that still fits the
 * working length, which gives the fewest Tape pieces (research R4).
 */
function greedyPieces(geometry: TapeGeometry, joins: readonly Join[], workingLength: number): readonly TapePiece[] {
  const fits = (overlapEnd: number, start: number): boolean => overlapEnd - start <= workingLength + EPSILON;
  const pieces: TapePiece[] = [];
  let start = 0;
  // joins[0 .. reached) end their Overlap within a piece that starts at `start`; the start only moves forward.
  let reached = 0;
  while (geometry.totalLength - start > workingLength + EPSILON) {
    while (reached < joins.length && fits(joins[reached].overlapEnd, start)) reached += 1;
    const furthest = joins[reached - 1];
    // Unreachable once no stretch exists: the next possible Join always fits from every start.
    if (furthest === undefined || furthest.at <= start) throw new Error(`no Join fits after ${start} mm`);
    pieces.push({number: pieces.length + 1, start, end: furthest.overlapEnd, join: furthest});
    start = furthest.at;
  }
  pieces.push({number: pieces.length + 1, start, end: geometry.totalLength});
  return pieces;
}

/**
 * Cuts `geometry` into Tape pieces for `plotter`. A Tape wider than the working width is refused; a roll Plotter takes the
 * Tape whole; a sheet Plotter gets the stretches that no Join can cut, or else the fewest Tape pieces.
 */
export function tapePieces(geometry: TapeGeometry, plotter: Plotter): TapePieces {
  if (geometry.width > plotter.workingWidth + EPSILON) {
    return {kind: 'too-wide', tapeWidth: geometry.width, workingWidth: plotter.workingWidth};
  }
  if (plotter.roll) return {kind: 'pieces', pieces: [{number: 1, start: 0, end: geometry.totalLength}]};
  const joins = possibleJoins(geometry, plotter.overlap);
  const stretches = joinlessStretches(geometry, joins, plotter.workingLength);
  if (stretches.length > 0) return {kind: 'no-join', stretches};
  return {kind: 'pieces', pieces: greedyPieces(geometry, joins, plotter.workingLength)};
}
