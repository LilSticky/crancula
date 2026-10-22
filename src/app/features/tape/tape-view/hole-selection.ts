/** A Hole as the selection sees it: its row (counted from 1) and the Column it starts at. */
export interface SelectableHole {
  readonly row: number;
  readonly start: number;
}

/** The selected Holes in the order they were added; the last is the active one, and `[]` selects nothing. */
export type HoleSelection = readonly SelectableHole[];

/** The Hole the selection comes down to when exactly one is selected, else `undefined`. */
export function soleOf(selection: HoleSelection): SelectableHole | undefined {
  return selection.length === 1 ? selection[0] : undefined;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/**
 * The Hole an arrow key moves the selection to. Left and right go to the previous and next Hole of the row;
 * up and down to the Hole of the nearest row above or below that has Holes, with the nearest start (a tie goes
 * to the earlier start). With nothing selected, any arrow picks the first Hole of the topmost row with Holes.
 *
 * @returns the Hole, or `undefined` when there is none in that direction
 */
export function nextHole<T extends SelectableHole>(holes: readonly T[], current: T | undefined, direction: Direction): T | undefined {
  if (current === undefined) return [...holes].sort(byRowThenStart)[0];
  if (direction === 'left' || direction === 'right') {
    const sameRow = holes.filter(({row}) => row === current.row).sort(byRowThenStart);
    const index = sameRow.indexOf(current);
    return sameRow[direction === 'left' ? index - 1 : index + 1];
  }
  const step = direction === 'up' ? -1 : 1;
  const rows = holes.map(({row}) => row).filter((row) => (row - current.row) * step > 0);
  if (rows.length === 0) return undefined;
  const nearestRow = rows.reduce((nearest, row) => (Math.abs(row - current.row) < Math.abs(nearest - current.row) ? row : nearest));
  return holes
    .filter(({row}) => row === nearestRow)
    .sort((a, b) => Math.abs(a.start - current.start) - Math.abs(b.start - current.start) || a.start - b.start)[0];
}

function byRowThenStart(a: SelectableHole, b: SelectableHole): number {
  return a.row - b.row || a.start - b.start;
}
