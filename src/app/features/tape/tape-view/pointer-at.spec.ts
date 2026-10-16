import type {TapeGeometry} from './tape-geometry';
import {pointerAt} from './pointer-at';

// Lead-in 20 mm, then 100 Columns of 2.5 mm; a Tape 40 mm wide with three rows 10 mm apart. Scale 2 px per mm.
const geometry: TapeGeometry = {
  leadIn: 20,
  columnLength: 2.5,
  length: 250,
  width: 40,
  border: 5,
  rowCentres: [10, 20, 30],
  slots: [],
};
const SCALE = 2;

// x is measured from the left edge of the drawing (the Lead-in included), y from the top edge of the Tape.
describe('pointerAt', () => {
  it('names the Column the pointer is over, counted from 1 at the end of the Lead-in, and the mm it starts at', () => {
    expect(pointerAt(40, 40, SCALE, geometry)).toMatchObject({column: 1, mm: 0});
    expect(pointerAt(40 + 4.9, 40, SCALE, geometry)).toMatchObject({column: 1, mm: 0});
    expect(pointerAt(40 + 5, 40, SCALE, geometry)).toMatchObject({column: 2, mm: 2.5});
    // (72 - 1) * 2.5 mm = 177.5 mm after Column 1, plus the Lead-in of 20 mm, at 2 px per mm
    expect(pointerAt((20 + 177.5) * SCALE + 1, 40, SCALE, geometry)).toMatchObject({column: 72, mm: 177.5});
  });

  it('names the row whose centre is within half a row spacing of the pointer, counted from 1', () => {
    expect(pointerAt(100, 20, SCALE, geometry)?.row).toBe(1);
    expect(pointerAt(100, 40 + 9, SCALE, geometry)?.row).toBe(2);
    expect(pointerAt(100, 60 - 9, SCALE, geometry)?.row).toBe(3);
  });

  it('names no row when the pointer is further than half a row spacing from every row centre', () => {
    // row 1 centre at 20 px, half a row spacing is 10 px
    expect(pointerAt(100, 2, SCALE, geometry)).toMatchObject({column: expect.any(Number), row: undefined});
    expect(pointerAt(100, 79, SCALE, geometry)?.row).toBeUndefined();
  });

  it('names nothing over the Lead-in', () => {
    expect(pointerAt(0, 40, SCALE, geometry)).toBeUndefined();
    expect(pointerAt(39.9, 40, SCALE, geometry)).toBeUndefined();
  });

  it('names nothing outside the Tape', () => {
    expect(pointerAt(100, -1, SCALE, geometry)).toBeUndefined();
    expect(pointerAt(100, 40 * SCALE + 1, SCALE, geometry)).toBeUndefined();
    expect(pointerAt((20 + 250) * SCALE + 1, 40, SCALE, geometry)).toBeUndefined();
  });
});
