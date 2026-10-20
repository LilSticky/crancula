import {column, columnCount, type Column, type ColumnCount, type Hole, type MidiNoteNumber, type Organ} from '@api/index';

/** Widest a handle gets, in px. */
const HANDLE_PX = 8;
/** The pointer travel that turns a press into a drag, in px. */
const DRAG_THRESHOLD_PX = 4;

export type HolePart = 'start' | 'end' | 'body';

/** A drag in progress: the grabbed part, the Hole as it was pressed (with its row) and where the pointer was pressed. */
export interface HoleDrag {
  readonly part: HolePart;
  readonly hole: Hole & {readonly row: number};
  readonly from: {readonly column: number; readonly row: number};
}

export type DragTarget =
  | {readonly part: 'body'; readonly pipe: MidiNoteNumber; readonly start: Column}
  | {readonly part: 'start'; readonly start: Column; readonly length: ColumnCount}
  | {readonly part: 'end'; readonly start: Column; readonly length: ColumnCount};

/** The part of a Hole under `x`; only the selected Hole has handles, each at most a third of its width. */
export function holePartAt(x: number, rect: {readonly x: number; readonly width: number}, selected: boolean): HolePart {
  if (!selected) return 'body';
  const handle = Math.min(HANDLE_PX, rect.width / 3);
  if (x < rect.x + handle) return 'start';
  if (x > rect.x + rect.width - handle) return 'end';
  return 'body';
}

/** Whether the pointer has travelled far enough from the press point to be a drag. */
export function isDrag(from: {readonly x: number; readonly y: number}, to: {readonly x: number; readonly y: number}): boolean {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) >= DRAG_THRESHOLD_PX;
}

/** Where the dragged part ends up with the pointer at `pointer`, or `undefined` if the Organ has no row for it. */
export function dragTarget(
  drag: HoleDrag,
  pointer: {readonly column: number; readonly row: number},
  organ: Organ,
): DragTarget | undefined {
  const {hole} = drag;
  const delta = pointer.column - drag.from.column;
  const end = hole.start + hole.length;
  if (drag.part === 'body') {
    const row = Math.min(organ.pipes.length, Math.max(1, hole.row + pointer.row - drag.from.row));
    const pipe = organ.pipes[row - 1]?.note;
    const start = column(Math.max(0, hole.start + delta));
    return pipe === undefined || start === undefined ? undefined : {part: 'body', pipe, start};
  }
  if (drag.part === 'end') {
    const length = columnCount(Math.max(1, hole.length + delta));
    return length === undefined ? undefined : {part: 'end', start: hole.start, length};
  }
  const startValue = Math.min(end - 1, Math.max(0, hole.start + delta));
  const start = column(startValue);
  const length = columnCount(end - startValue);
  return start === undefined || length === undefined ? undefined : {part: 'start', start, length};
}
