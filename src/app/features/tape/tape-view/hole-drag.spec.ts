import {midiNoteNumber, type MidiNoteNumber, type Organ} from '@api/index';
import type {Column, ColumnCount} from '../../../../../api/tape/tape';
import {testOrgan} from '../../../../testing/organs';
import {dragTarget, gripRects, isDrag, type HoleDrag} from './hole-drag';

function note(value: number): MidiNoteNumber {
  const result = midiNoteNumber(value);
  if (result === undefined) throw new Error('not a note');
  return result;
}

// Rows 1 to 3 are the Pipes 60, 62 and 64.
const organ: Organ = testOrgan('Street organ', 3);

function drag(part: HoleDrag['part'], start: number, length: number, row = 2): HoleDrag {
  return {
    part,
    hole: {pipe: note(60 + 2 * (row - 1)), start: start as Column, length: length as ColumnCount, row},
    from: {column: start, row},
  };
}

describe('gripRects', () => {
  /** A Hole in SVG units, one row high; `width` is its length in SVG units. */
  const hole = (width: number) => ({x: 100, y: 40, width, height: 10});
  /** The Hole of 3 Columns and the Hole of 1 Column at 1:1 (2.5 mm Columns, about 9.45 px each). */
  const widths = [3 * 9.45, 1 * 9.45];
  const scales = [0.5, 1, 2];

  it.each(scales)('gives each grip a hit area of at least 44 × 44 screen px at scale %s', (scale) => {
    for (const width of widths) {
      const {start, end} = gripRects(hole(width), scale);
      expect(start.width * scale).toBeGreaterThanOrEqual(44);
      expect(start.height * scale).toBeGreaterThanOrEqual(44);
      expect(end.width * scale).toBeGreaterThanOrEqual(44);
      expect(end.height * scale).toBeGreaterThanOrEqual(44);
    }
  });

  it.each(scales)('puts the grips outside the Hole, beside its start and its end, at scale %s', (scale) => {
    for (const width of widths) {
      const outline = hole(width);
      const {start, end} = gripRects(outline, scale);
      expect(start.x + start.width).toBeLessThanOrEqual(outline.x);
      expect(end.x).toBeGreaterThanOrEqual(outline.x + outline.width);
    }
  });

  it.each(scales)('keeps the grips level with the Hole, so the row is reachable at scale %s', (scale) => {
    const outline = hole(widths[0] ?? 0);
    const {start, end} = gripRects(outline, scale);
    const middle = outline.y + outline.height / 2;
    for (const grip of [start, end]) {
      expect(grip.y).toBeLessThanOrEqual(middle);
      expect(grip.y + grip.height).toBeGreaterThanOrEqual(middle);
    }
  });

  it.each(scales)('does not let the two grips overlap, also on a 1-Column Hole, at scale %s', (scale) => {
    for (const width of widths) {
      const {start, end} = gripRects(hole(width), scale);
      expect(start.x + start.width).toBeLessThanOrEqual(end.x);
    }
  });
});

describe('isDrag', () => {
  it('starts a drag once the pointer is 4 px from the press point', () => {
    expect(isDrag({x: 10, y: 10}, {x: 13, y: 10})).toBe(false);
    expect(isDrag({x: 10, y: 10}, {x: 10, y: 13.9})).toBe(false);
    expect(isDrag({x: 10, y: 10}, {x: 14, y: 10})).toBe(true);
    expect(isDrag({x: 10, y: 10}, {x: 10, y: 6})).toBe(true);
  });
});

describe('dragTarget', () => {
  it('moves the body by the Columns and rows the pointer moved', () => {
    expect(dragTarget(drag('body', 10, 3), {column: 12, row: 3}, organ)).toEqual({part: 'body', pipe: 64, start: 12});
    expect(dragTarget(drag('body', 10, 3), {column: 9, row: 1}, organ)).toEqual({part: 'body', pipe: 60, start: 9});
  });

  it('keeps the body at Column 0 at the earliest', () => {
    expect(dragTarget(drag('body', 2, 3), {column: -5, row: 2}, organ)).toMatchObject({part: 'body', start: 0});
  });

  it("clamps the row to the Organ's rows", () => {
    expect(dragTarget(drag('body', 10, 3), {column: 10, row: 9}, organ)).toMatchObject({pipe: 64});
    expect(dragTarget(drag('body', 10, 3), {column: 10, row: -4}, organ)).toMatchObject({pipe: 60});
  });

  it('lengthens or shortens at the end and keeps the start', () => {
    expect(dragTarget(drag('end', 10, 3), {column: 14, row: 2}, organ)).toEqual({part: 'end', start: 10, length: 7});
    expect(dragTarget(drag('end', 10, 3), {column: 8, row: 2}, organ)).toEqual({part: 'end', start: 10, length: 1});
  });

  it('keeps a 1-Column Hole 1 Column long when dragging its end earlier', () => {
    expect(dragTarget(drag('end', 10, 1), {column: 5, row: 2}, organ)).toEqual({part: 'end', start: 10, length: 1});
  });

  it('moves the start and keeps the end', () => {
    expect(dragTarget(drag('start', 10, 5), {column: 8, row: 2}, organ)).toEqual({part: 'start', start: 8, length: 7});
    expect(dragTarget(drag('start', 10, 5), {column: 12, row: 2}, organ)).toEqual({part: 'start', start: 12, length: 3});
  });

  it('stops the start one Column before the end', () => {
    expect(dragTarget(drag('start', 10, 5), {column: 40, row: 2}, organ)).toEqual({part: 'start', start: 14, length: 1});
  });

  it('keeps the start at Column 0 at the earliest', () => {
    expect(dragTarget(drag('start', 1, 4), {column: -9, row: 2}, organ)).toEqual({part: 'start', start: 0, length: 5});
  });
});
