import type {TapeGeometry} from './tape-geometry';

export interface ColumnRange {
  readonly first: number;
  readonly last: number;
}

/** The first and last Column to render: the visible window plus one window on each side, clamped to the Tape. */
export function visibleColumns(
  scrollLeft: number,
  clientWidth: number,
  pixelsPerMm: number,
  geometry: TapeGeometry,
): ColumnRange {
  const columnWidth = geometry.columnLength * pixelsPerMm;
  const leadIn = geometry.leadIn * pixelsPerMm;
  const lastColumn = Math.max(0, Math.round(geometry.length / geometry.columnLength) - 1);
  const columnAt = (x: number): number => Math.floor((x - leadIn) / columnWidth);
  return {
    first: Math.min(lastColumn, Math.max(0, columnAt(scrollLeft - clientWidth))),
    last: Math.min(lastColumn, Math.max(0, columnAt(scrollLeft + 2 * clientWidth))),
  };
}
