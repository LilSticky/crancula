import {column, columnCount, type Column, type ColumnCount, type Hole, type MidiNoteNumber, type Organ} from '@api/index';

/** The pointer travel that turns a press into a drag, in px. */
const DRAG_THRESHOLD_PX = 4;
/** The smallest hit area of a grip on screen, in px (WCAG 2.5.5). */
export const MIN_GRIP_PX = 44;
/** The width of a grip's visible bar, in px. */
const GRIP_BAR_PX = 6;

export type HolePart = 'start' | 'end' | 'body';

/** A rectangle in px. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The transparent hit areas of the two grips of a Hole, in the units of `hole` (`scale` screen px per unit): squares of
 * at least 44 screen px, just outside each end and centred on the Hole's middle row, so they never overlap the Hole.
 */
export function gripRects(hole: Rect, scale: number): {readonly start: Rect; readonly end: Rect} {
  const size = MIN_GRIP_PX / scale;
  const y = hole.y + hole.height / 2 - size / 2;
  return {
    start: {x: hole.x - size, y, width: size, height: size},
    end: {x: hole.x + hole.width, y, width: size, height: size},
  };
}

/** The visible bars of the two grips: 6 px wide, flush with each end of the Hole, as tall as the Hole. */
export function gripBars(hole: Rect): {readonly start: Rect; readonly end: Rect} {
  return {
    start: {x: hole.x - GRIP_BAR_PX, y: hole.y, width: GRIP_BAR_PX, height: hole.height},
    end: {x: hole.x + hole.width, y: hole.y, width: GRIP_BAR_PX, height: hole.height},
  };
}

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
