import {column, type Column, type TapeGeometry} from '@api/index';
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

/** The Hole covering the cell, as its row and start; `undefined` on an empty cell. */
export function holeAt(cell: GridCell, geometry: TapeGeometry): SelectableHole | undefined {
  const slot = geometry.slots.find(
    (candidate) =>
      candidate.row === cell.row && cell.column >= candidate.start && cell.column < candidate.start + Math.round(candidate.width / geometry.columnLength),
  );
  return slot === undefined ? undefined : {row: slot.row, start: slot.start};
}

/** The Spot of an empty cell; `undefined` where a Hole covers the cell. The Spot may lie after the Tape's last Column. */
export function spotAt(cell: GridCell, geometry: TapeGeometry): Spot | undefined {
  const start = column(cell.column);
  if (start === undefined || holeAt(cell, geometry) !== undefined) return undefined;
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
 * on a Hole; the Spot stays put when no free cell is left before Column 0 or rows 1 to `rows`.
 */
export function moveSpot(spot: Spot, direction: Direction, rows: number, geometry: TapeGeometry): Spot {
  const step = STEPS[direction];
  let row = spot.row + step.row;
  let start = spot.start + step.column;
  while (row >= 1 && row <= rows && start >= 0) {
    const free = column(start);
    if (free !== undefined && holeAt({row, column: start}, geometry) === undefined) return {row, start: free};
    row += step.row;
    start += step.column;
  }
  return spot;
}
