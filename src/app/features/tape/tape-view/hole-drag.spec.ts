import {midiNoteNumber, type MidiNoteNumber, type Organ} from '@api/index';
import type {Column, ColumnCount} from '../../../../../api/tape/tape';
import {testOrgan} from '../../../../testing/organs';
import {dragTarget, holePartAt, isDrag, type HoleDrag} from './hole-drag';

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

describe('holePartAt', () => {
  const rect = {x: 100, width: 60};

  it('grabs the start handle at the first 8 px of the selected Hole', () => {
    expect(holePartAt(100, rect, true)).toBe('start');
    expect(holePartAt(107.9, rect, true)).toBe('start');
  });

  it('grabs the end handle at the last 8 px of the selected Hole', () => {
    expect(holePartAt(152.1, rect, true)).toBe('end');
    expect(holePartAt(159.9, rect, true)).toBe('end');
  });

  it('grabs the body between the handles', () => {
    expect(holePartAt(130, rect, true)).toBe('body');
  });

  it('makes each handle only a third of the width wide in a short Hole', () => {
    const short = {x: 100, width: 12};
    expect(holePartAt(103.9, short, true)).toBe('start');
    expect(holePartAt(104.1, short, true)).toBe('body');
    expect(holePartAt(107.9, short, true)).toBe('body');
    expect(holePartAt(108.1, short, true)).toBe('end');
  });

  it('grabs the body everywhere on a Hole that is not selected', () => {
    expect(holePartAt(101, rect, false)).toBe('body');
    expect(holePartAt(159, rect, false)).toBe('body');
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
