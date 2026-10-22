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

/** A Hole that also knows its length in Columns. */
export interface SpanningHole extends SelectableHole {
  readonly length: number;
}

/** A rectangle dragged over the Tape: rows `firstRow` to `lastRow` (both inclusive), Columns from `fromColumn` up to, not including, `toColumn`. */
export interface SelectionFrame {
  readonly firstRow: number;
  readonly lastRow: number;
  readonly fromColumn: number;
  readonly toColumn: number;
}

/** The Hole the selection ends on: the one added last, or `undefined` when nothing is selected. */
export function activeOf(selection: HoleSelection): SelectableHole | undefined {
  return selection[selection.length - 1];
}

/** The selection with the Hole added as the active one, or taken out when it is already selected (matched by row and start). */
export function toggled(selection: HoleSelection, hole: SelectableHole): HoleSelection {
  return isIn(selection, hole) ? selection.filter((selected) => !sameHole(selected, hole)) : [...selection, hole];
}

/** A Column (from 0) and a row (from 1) of the Tape. */
export interface GridCell {
  readonly column: number;
  readonly row: number;
}

/** The frame that spans both cells, each included. */
export function frameBetween(a: GridCell, b: GridCell): SelectionFrame {
  return {
    firstRow: Math.min(a.row, b.row),
    lastRow: Math.max(a.row, b.row),
    fromColumn: Math.min(a.column, b.column),
    toColumn: Math.max(a.column, b.column) + 1,
  };
}

/** The Holes on rows inside the frame that lie at least partly inside its Columns. */
export function framed<T extends SpanningHole>(holes: readonly T[], frame: SelectionFrame): readonly T[] {
  return holes.filter(
    ({row, start, length}) =>
      row >= frame.firstRow && row <= frame.lastRow && start < frame.toColumn && start + length > frame.fromColumn,
  );
}

/** The selection plus the next Hole in the direction as the active one; unchanged when there is none or it is already selected. */
export function extended<T extends SelectableHole>(selection: HoleSelection, holes: readonly T[], direction: Direction): HoleSelection {
  const active = activeOf(selection);
  const current = active === undefined ? undefined : holes.find((hole) => sameHole(hole, active));
  const next = nextHole(holes, current, direction);
  return next === undefined || isIn(selection, next) ? selection : [...selection, next];
}

/** The selection plus those of the Holes that are not selected yet. */
export function united(selection: HoleSelection, holes: readonly SelectableHole[]): HoleSelection {
  return [...selection, ...holes.filter((hole) => !isIn(selection, hole))];
}

/** Every Hole of the Tape. */
export function allOf<T extends SelectableHole>(holes: readonly T[]): readonly T[] {
  return [...holes];
}

function sameHole(a: SelectableHole, b: SelectableHole): boolean {
  return a.row === b.row && a.start === b.start;
}

function isIn(selection: HoleSelection, hole: SelectableHole): boolean {
  return selection.some((selected) => sameHole(selected, hole));
}
