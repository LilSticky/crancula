import {column, type Column, type TapeGeometry} from '@api/index';
import type {Direction, GridCell, HoleSelection} from './hole-selection';

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

/** The Spot of an empty cell; `undefined` where a Hole covers the cell. The Spot may lie after the Tape's last Column. */
export function spotAt(cell: GridCell, geometry: TapeGeometry): Spot | undefined {
  const start = column(cell.column);
  if (start === undefined) return undefined;
  const covered = geometry.slots.some(
    (slot) => slot.row === cell.row && cell.column >= slot.start && cell.column < slot.start + Math.round(slot.width / geometry.columnLength),
  );
  return covered ? undefined : {row: cell.row, start};
}

/** The Spot one Column or row away in `direction`, clamped to Column 0 and to rows 1 to `rows`. */
export function moveSpot(spot: Spot, direction: Direction, rows: number): Spot {
  const row = direction === 'up' ? Math.max(1, spot.row - 1) : direction === 'down' ? Math.min(rows, spot.row + 1) : spot.row;
  const start = direction === 'left' ? Math.max(0, spot.start - 1) : direction === 'right' ? spot.start + 1 : spot.start;
  return {row, start: column(start) ?? spot.start};
}
