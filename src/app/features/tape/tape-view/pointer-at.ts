import type {TapeGeometry} from '@api/index';

/** What lies under the pointer on the Tape. */
export interface PointerPosition {
  /** The Column, counted from 1 at the end of the Lead-in. */
  readonly column: number;
  /** Where the Column starts, in mm after the start of Column 1. */
  readonly mm: number;
  /** The row, counted from 1; `undefined` when the pointer is not near a row centre. */
  readonly row: number | undefined;
}

/**
 * The Column and row under a pointer. `x` is in px from the left edge of the drawing (Lead-in included),
 * `y` in px from the top edge of the Tape. `undefined` outside the Tape and over the Lead-in.
 */
export function pointerAt(x: number, y: number, scale: number, geometry: TapeGeometry): PointerPosition | undefined {
  const xMm = x / scale - geometry.leadIn;
  const yMm = y / scale;
  if (xMm < 0 || xMm > geometry.length || yMm < 0 || yMm > geometry.width) return undefined;

  const index = Math.min(Math.floor(xMm / geometry.columnLength), Math.ceil(geometry.length / geometry.columnLength) - 1);
  const [first, second] = geometry.rowCentres;
  // With one row there is no neighbour to share the Tape with: that row takes every y on the Tape.
  const halfSpacing = first === undefined || second === undefined ? geometry.width : (second - first) / 2;
  let row: number | undefined;
  let nearest = Infinity;
  geometry.rowCentres.forEach((centre, rowIndex) => {
    const distance = Math.abs(centre - yMm);
    if (distance <= halfSpacing && distance < nearest) {
      nearest = distance;
      row = rowIndex + 1;
    }
  });
  return {column: index + 1, mm: index * geometry.columnLength, row};
}
