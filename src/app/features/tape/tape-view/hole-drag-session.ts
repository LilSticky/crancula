import {signal} from '@angular/core';
import type {Organ, Tape} from '@api/index';
import {dragEdit, type EditOutcome} from './hole-edit-commands';
import {dragTarget, isDrag, type HoleDrag, type HolePart} from './hole-drag';

interface Cell {
  readonly column: number;
  readonly row: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** What a drag works on; read when the pointer moves, so it is always the current Tape and Organ. */
export interface DragSubject {
  readonly tape: Tape;
  readonly organ: Organ;
}

/**
 * One pointer drag of a Hole or of one of its ends. The press becomes a drag after a few px; the preview is
 * recomputed only when the pointer enters another cell and at most once per animation frame.
 */
export class HoleDragSession {
  /** True once the press has travelled far enough to be a drag. */
  readonly dragging = signal(false);
  /** The would-be result while dragging; `undefined` when the Tape stays as it is. */
  readonly preview = signal<EditOutcome | undefined>(undefined);

  private drag: {readonly hole: HoleDrag; readonly press: Point; readonly subject: DragSubject} | undefined;
  private latest: Cell | undefined;
  private shown: Cell | undefined;
  private frame = 0;

  /** The Hole as it was pressed, while a press or drag is going on. */
  get grabbed(): HoleDrag['hole'] | undefined {
    return this.drag?.hole.hole;
  }

  /** The part of the Hole that was pressed, while a press or drag is going on. */
  get grabbedPart(): HolePart | undefined {
    return this.drag?.hole.part;
  }

  start(hole: HoleDrag, press: Point, subject: DragSubject): void {
    this.cancel();
    this.drag = {hole, press, subject};
  }

  /** @returns true when this move turned the press into a drag */
  move(point: Point, cell: Cell): boolean {
    if (this.drag === undefined) return false;
    const started = !this.dragging();
    if (started && !isDrag(this.drag.press, point)) return false;
    this.dragging.set(true);
    this.latest = cell;
    if (this.frame === 0) this.frame = requestAnimationFrame(() => this.refresh());
    return started;
  }

  /** Ends the drag at `cell`; the outcome to apply, or `undefined` if it was only a click. */
  finish(cell: Cell): EditOutcome | undefined {
    const drag = this.drag;
    const wasDragging = this.dragging();
    this.cancel();
    return drag === undefined || !wasDragging ? undefined : this.outcomeAt(drag, cell);
  }

  cancel(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.drag = undefined;
    this.latest = undefined;
    this.shown = undefined;
    this.dragging.set(false);
    this.preview.set(undefined);
  }

  private refresh(): void {
    this.frame = 0;
    const {drag, latest, shown} = this;
    if (drag === undefined || latest === undefined) return;
    if (shown?.column === latest.column && shown.row === latest.row) return;
    this.shown = latest;
    const outcome = this.outcomeAt(drag, latest);
    this.preview.set(outcome.kind === 'nothing' ? undefined : outcome);
  }

  private outcomeAt(drag: NonNullable<HoleDragSession['drag']>, cell: Cell): EditOutcome {
    const {tape, organ} = drag.subject;
    return dragEdit(tape, organ, drag.hole, dragTarget(drag.hole, cell, organ));
  }
}
