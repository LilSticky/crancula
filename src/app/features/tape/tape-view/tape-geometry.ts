import {border, type Organ, type Tape} from '@api/index';

/** A drawn Hole, in mm from the start of Column 1 (x) and the top edge of the Tape (y). */
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

export interface TapeGeometry {
  readonly leadIn: number;
  /** From Column 1, without the Lead-in. */
  readonly length: number;
  readonly width: number;
  readonly border: number;
  /** The distance of each row's centre from the top edge; row 1 first. */
  readonly rowCentres: readonly number[];
  readonly slots: readonly Slot[];
}

/** Where everything on the Tape sits, in mm: what gets cut. */
export function tapeGeometry(tape: Tape, organ: Organ): TapeGeometry {
  const {holeDiameter, rowSpacing, tapeWidth} = organ.tapeBed;
  const edge = border(organ);
  const rowTop = (index: number): number => edge + index * rowSpacing;
  const rowOf = new Map(organ.pipes.map((pipe, index) => [pipe.note, index]));

  const slots = tape.holes.flatMap((hole): readonly Slot[] => {
    const index = rowOf.get(hole.pipe);
    if (index === undefined) return [];
    return [
      {
        row: index + 1,
        start: hole.start,
        x: hole.start * tape.columnLength,
        y: rowTop(index),
        width: hole.length * tape.columnLength,
        height: holeDiameter,
        radius: holeDiameter / 2,
      },
    ];
  });

  return {
    leadIn: organ.leadIn,
    length: tape.length * tape.columnLength,
    width: tapeWidth,
    border: edge,
    rowCentres: organ.pipes.map((_, index) => rowTop(index) + holeDiameter / 2),
    slots,
  };
}
