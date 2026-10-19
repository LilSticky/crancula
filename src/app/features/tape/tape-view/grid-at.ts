import type {TapeGeometry} from '@api/index';

/**
 * The Column and row under a point of the drawing, in px: `x` from the left edge (Lead-in included), `y` from the top
 * edge of the Tape. The Column counts from 0 and is not clamped at the Tape's end; the row counts from 1 and is clamped.
 */
export function gridAt(x: number, y: number, scale: number, geometry: TapeGeometry): {column: number; row: number} {
  const column = Math.max(0, Math.floor((x / scale - geometry.leadIn) / geometry.columnLength));
  const millimetres = y / scale;
  let nearest = 0;
  geometry.rowCentres.forEach((centre, index) => {
    const best = geometry.rowCentres[nearest] ?? centre;
    if (Math.abs(centre - millimetres) < Math.abs(best - millimetres)) nearest = index;
  });
  return {column, row: nearest + 1};
}
