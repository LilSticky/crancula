import {column, holeCovering, type Column, type Organ, type Tape} from '@api/index';
import type {Direction, GridCell, HoleSelection, SelectableHole} from './hole-selection';

/** A place on the Tape where a tap would add a Hole: a row (counted from 1) and the Column it starts at. */
export interface Spot {
  readonly row: number;
  readonly start: Column;
}

/** What the Tape view has selected: Holes, or one Spot; never both. */
export type TapeSelection = {readonly holes: HoleSelection} | {readonly spot: Spot};

export function sameSpot(a: Spot, b: Spot): boolean {
  return a.row === b.row && a.start === b.start;
}

/**
 * The Hole covering the cell, as its row and start; `undefined` on an empty cell. The row is the Pipe's position in
 * `organ.pipes` plus 1, the row the geometry draws it on.
 */
export function holeAt(cell: GridCell, tape: Tape, organ: Organ): SelectableHole | undefined {
  const pipe = organ.pipes[cell.row - 1];
  const at = column(cell.column);
  if (pipe === undefined || at === undefined) return undefined;
  const hole = holeCovering(tape, pipe.note, at);
  return hole === undefined ? undefined : {row: cell.row, start: hole.start};
}

/** The Spot of an empty cell; `undefined` where a Hole covers the cell. The Spot may lie after the Tape's last Column. */
export function spotAt(cell: GridCell, tape: Tape, organ: Organ): Spot | undefined {
  const start = column(cell.column);
  if (start === undefined || holeAt(cell, tape, organ) !== undefined) return undefined;
  return {row: cell.row, start};
}

/** The step of each arrow in rows and Columns. */
const STEPS: Record<Direction, {readonly row: number; readonly column: number}> = {
  up: {row: -1, column: 0},
  down: {row: 1, column: 0},
  left: {row: 0, column: -1},
  right: {row: 0, column: 1},
};

/**
 * The Spot one Column or row away in `direction`. Cells a Hole covers are skipped in that direction, so a Spot never lands
 * on a Hole; the Spot stays put when no free cell is left before Column 0 or rows 1 to `rows` (the Organ's Pipes).
 */
export function moveSpot(spot: Spot, direction: Direction, rows: number, tape: Tape, organ: Organ): Spot {
  const step = STEPS[direction];
  let row = spot.row + step.row;
  let start = spot.start + step.column;
  while (row >= 1 && row <= rows && start >= 0) {
    const free = column(start);
    if (free !== undefined && holeAt({row, column: start}, tape, organ) === undefined) return {row, start: free};
    row += step.row;
    start += step.column;
  }
  return spot;
}
