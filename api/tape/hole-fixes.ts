import type {MidiNoteNumber} from '../organ/midi-note-number';
import {minimumHoleLength, type Millimetres, type Organ} from '../organ/organ';
import type {HoleFix} from './import-summary';
import {columnCount, type ColumnCount, type Hole} from './tape';

/** Tolerance for floating-point error in the division, e.g. 1.1 / 0.1. */
const EPSILON = 1e-9;

export interface HoleLimits {
  readonly minimumHoleLength: ColumnCount;
  readonly minimumGap: ColumnCount;
}

export interface HoleFixResult {
  readonly holes: readonly Hole[];
  readonly changes: readonly HoleFix[];
}

/** The smallest whole number of Columns that covers `millimetres`. */
export function columnsFor(millimetres: number, columnLength: number): number {
  return Math.ceil(millimetres / columnLength - EPSILON);
}

function validCount(value: number): ColumnCount {
  const result = columnCount(value);
  if (result === undefined) throw new Error(`invalid Column count ${value}`);
  return result;
}

function atLeastOneColumn(value: number): ColumnCount {
  return validCount(Math.max(value, 1));
}

/** The Minimum Hole Length and Minimum Gap of the Organ in whole Columns, at least one each. */
export function holeLimitsOf(organ: Organ, columnLength: Millimetres): HoleLimits {
  return {
    minimumHoleLength: atLeastOneColumn(columnsFor(minimumHoleLength(organ.tapeBed), columnLength)),
    minimumGap: atLeastOneColumn(columnsFor(organ.minimumGap, columnLength)),
  };
}

function endOf(hole: Hole): number {
  return hole.start + hole.length;
}

function holeUntil(hole: Hole, end: number): Hole {
  return {pipe: hole.pipe, start: hole.start, length: validCount(end - hole.start)};
}

function byPipeThenStart(a: Hole, b: Hole): number {
  return a.pipe - b.pipe || a.start - b.start;
}

function rowsOf(holes: readonly Hole[]): Hole[][] {
  const rows = new Map<MidiNoteNumber, Hole[]>();
  for (const hole of [...holes].sort(byPipeThenStart)) {
    const row = rows.get(hole.pipe);
    if (row === undefined) rows.set(hole.pipe, [hole]);
    else row.push(hole);
  }
  return [...rows.values()];
}

/** Merges overlapping Holes of the same Pipe; touching Holes stay apart. Sorted by Pipe, start. */
export function mergeOverlaps(holes: readonly Hole[]): HoleFixResult {
  const merged: Hole[] = [];
  const changes: HoleFix[] = [];
  for (const row of rowsOf(holes)) {
    let current: Hole | undefined;
    for (const hole of row) {
      if (current !== undefined && hole.start < endOf(current)) {
        changes.push({kind: 'overlap-merged', pipe: hole.pipe, column: current.start});
        current = holeUntil(current, Math.max(endOf(current), endOf(hole)));
        continue;
      }
      if (current !== undefined) merged.push(current);
      current = hole;
    }
    if (current !== undefined) merged.push(current);
  }
  return {holes: merged, changes};
}

function fixRow(row: readonly Hole[], limits: HoleLimits, changes: HoleFix[]): Hole[] {
  const holes = [...row];
  const {minimumHoleLength, minimumGap} = limits;
  let index = 0;
  for (let hole = holes[index]; hole !== undefined; hole = holes[index]) {
    if (hole.length < minimumHoleLength) {
      const lengthened = holeUntil(hole, hole.start + minimumHoleLength);
      changes.push({
        kind: 'lengthened',
        pipe: hole.pipe,
        column: hole.start,
        from: hole.length,
        to: lengthened.length,
      });
      hole = lengthened;
      holes[index] = hole;
    }
    const next = holes[index + 1];
    if (next === undefined || next.start - endOf(hole) >= minimumGap) {
      index++;
      continue;
    }
    const newEnd = next.start - minimumGap;
    if (newEnd - hole.start >= minimumHoleLength) {
      const shortened = holeUntil(hole, newEnd);
      changes.push({
        kind: 'shortened',
        pipe: hole.pipe,
        column: hole.start,
        from: hole.length,
        to: shortened.length,
      });
      holes[index] = shortened;
      index++;
    } else {
      changes.push({
        kind: 'repetition-merged',
        pipe: hole.pipe,
        column: hole.start,
        lostColumn: next.start,
      });
      holes[index] = holeUntil(hole, Math.max(endOf(hole), endOf(next)));
      holes.splice(index + 1, 1);
    }
  }
  return holes;
}

/**
 * Enforces the Minimum Hole Length and the Minimum Gap per row (FR-012) without moving a Hole's
 * start. Expects Holes that no longer overlap.
 */
export function fixHoles(holes: readonly Hole[], limits: HoleLimits): HoleFixResult {
  const changes: HoleFix[] = [];
  const fixed = rowsOf(holes).flatMap((row) => fixRow(row, limits, changes));
  return {holes: fixed, changes};
}
