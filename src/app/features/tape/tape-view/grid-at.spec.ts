import type {TapeGeometry} from '@api/index';
import {gridAt} from './grid-at';

// Lead-in 20 mm, then 100 Columns of 2.5 mm; a Tape 40 mm wide with three rows 10 mm apart. Scale 2 px per mm.
const geometry: TapeGeometry = {
  leadIn: 20,
  columnLength: 2.5,
  length: 250,
  width: 40,
  borders: {guide: 5, far: 5},
  rowCentres: [10, 20, 30],
  endGap: 2,
  totalLength: 272,
  slots: [],
  outline: {tip: {x: 0, y: 0}, topEnd: {x: 272, y: 0}, bottomEnd: {x: 272, y: 40}, columnOneBottom: {x: 20, y: 40}},
};
const SCALE = 2;

// x is measured from the left edge of the drawing (the Lead-in included), y from the top edge of the Tape.
describe('gridAt', () => {
  it('gives the Column as a 0-based floor, right after the Lead-in', () => {
    expect(gridAt(40, 40, SCALE, geometry).column).toBe(0);
    expect(gridAt(40 + 4.9, 40, SCALE, geometry).column).toBe(0);
    expect(gridAt(40 + 5, 40, SCALE, geometry).column).toBe(1);
    expect(gridAt((20 + 177.5) * SCALE + 1, 40, SCALE, geometry).column).toBe(71);
  });

  it('gives Column 0 for x inside the Lead-in or left of the drawing', () => {
    expect(gridAt(10, 40, SCALE, geometry).column).toBe(0);
    expect(gridAt(-30, 40, SCALE, geometry).column).toBe(0);
  });

  it('does not clamp the Column at the Tape end, so a drag can grow the Tape', () => {
    expect(gridAt((20 + 250 + 5) * SCALE + 1, 40, SCALE, geometry).column).toBe(102);
  });

  it('gives the nearest row, counted from 1', () => {
    expect(gridAt(100, 20, SCALE, geometry).row).toBe(1);
    expect(gridAt(100, 41, SCALE, geometry).row).toBe(2);
    expect(gridAt(100, 55, SCALE, geometry).row).toBe(3);
  });

  it("clamps the row to the Organ's rows", () => {
    expect(gridAt(100, -50, SCALE, geometry).row).toBe(1);
    expect(gridAt(100, 500, SCALE, geometry).row).toBe(3);
  });
});
