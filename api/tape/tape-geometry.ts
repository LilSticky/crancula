import {border, type Organ} from '../organ/organ';
import type {Tape} from './tape';

/** A drawn Hole, in mm from the tip of the Tape (x, so it includes the Lead-in) and the top edge of the Tape (y). */
export interface Slot {
  /** The row, counted from 1. */
  readonly row: number;
  /** The Column the Hole starts at. */
  readonly start: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The corners of the cut outline, in mm from the tip on the top edge. */
export interface TapeOutline {
  readonly tip: Point;
  readonly topEnd: Point;
  readonly bottomEnd: Point;
  /** Where the Lead-in diagonal meets the bottom edge: Column 1. */
  readonly columnOneBottom: Point;
}

export interface TapeGeometry {
  readonly leadIn: number;
  readonly columnLength: number;
  /** From Column 1, without the Lead-in. */
  readonly length: number;
  /** The Minimum Gap left after the last Column. */
  readonly endGap: number;
  /** Lead-in, Columns and end gap. */
  readonly totalLength: number;
  readonly width: number;
  readonly border: number;
  /** The distance of each row's centre from the top edge; row 1 first. */
  readonly rowCentres: readonly number[];
  readonly slots: readonly Slot[];
  readonly outline: TapeOutline;
}

/** Where everything on the Tape sits, in mm: what gets cut. */
export function tapeGeometry(tape: Tape, organ: Organ): TapeGeometry {
  const {holeDiameter, rowSpacing, tapeWidth} = organ.tapeBed;
  const edge = border(organ);
  const rowTop = (index: number): number => edge + index * rowSpacing;
  const rowOf = new Map(organ.pipes.map((pipe, index) => [pipe.note, index]));

  const drawn = tape.holes.flatMap((hole): readonly Slot[] => {
    const index = rowOf.get(hole.pipe);
    if (index === undefined) return [];
    return [
      {
        row: index + 1,
        start: hole.start,
        x: organ.leadIn + hole.start * tape.columnLength,
        y: rowTop(index),
        width: hole.length * tape.columnLength,
        height: holeDiameter,
        radius: holeDiameter / 2,
      },
    ];
  });

  /** Cut order: along the Tape, then by row. */
  const slots = [...drawn].sort((a, b) => a.start - b.start || a.row - b.row);

  const length = tape.length *tape.columnLength;
  const endGap = organ.minimumGap;
  const totalLength = organ.leadIn + length + endGap;

  return {
    leadIn: organ.leadIn,
    columnLength: tape.columnLength,
    length,
    endGap,
    totalLength,
    width: tapeWidth,
    border: edge,
    rowCentres: organ.pipes.map((_, index) => rowTop(index) + holeDiameter / 2),
    slots,
    outline: {
      tip: {x: 0, y: 0},
      topEnd: {x: totalLength, y: 0},
      bottomEnd: {x: totalLength, y: tapeWidth},
      columnOneBottom: {x: organ.leadIn, y: tapeWidth},
    },
  };
}
