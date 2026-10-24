// API: `Spot` = {row: number (from 1, a Pipe's row), start: Column}; `sameSpot(a, b): boolean`;
// `spotAt(cell: GridCell, geometry: TapeGeometry): Spot | undefined` (undefined where a Hole covers the cell; the Spot may
// lie after the Tape's last Column); `moveSpot(spot: Spot, direction: Direction, rows: number, geometry: TapeGeometry): Spot`
// (one Column or row, skipping the cells a Hole covers in that direction; stays put when no free cell is left, clamped to
// Column 0 and rows 1..rows).
import {column, columnCount, midiNoteNumber, millimetres, organId, tapeGeometry, tapeId, transposition, type Column, type Hole, type Tape, type TapeGeometry} from '@api/index';
import {tapeOf} from '../../../../../api/tape/tape-fixture';
import {partIndex, songId} from '../../../../../api/song/song';
import {testOrgan} from '../../../../testing/organs';
import type {Direction, GridCell} from './hole-selection';
import {moveSpot, sameSpot, spotAt, type Spot} from './spot';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

const col = (index: number): Column => defined(column(index), `column ${index}`);

/** Pipes at notes 60, 62, 64 on rows 1, 2, 3. */
const ORGAN = testOrgan('Street organ', 3);

function tapeWith(holes: readonly Hole[]): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
    songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
    selectedParts: [defined(partIndex(1, 3), 'part')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(2.5), 'column length'),
    length: defined(columnCount(100), 'length'),
    holes,
  });
}

/** A Hole on row 2 (the Pipe of note 62) over Columns 5, 6 and 7. */
const TAPE = tapeWith([{pipe: defined(midiNoteNumber(62), 'pipe'), start: col(5), length: defined(columnCount(3), 'length')}]);
const GEOMETRY: TapeGeometry = tapeGeometry(TAPE, ORGAN);

describe('sameSpot', () => {
  it('is true for the same row and Column', () => {
    expect(sameSpot({row: 2, start: col(4)}, {row: 2, start: col(4)})).toBe(true);
  });

  it('is false for another row or another Column', () => {
    expect(sameSpot({row: 2, start: col(4)}, {row: 3, start: col(4)})).toBe(false);
    expect(sameSpot({row: 2, start: col(4)}, {row: 2, start: col(5)})).toBe(false);
  });
});

describe('spotAt', () => {
  const at = (column: number, row: number): GridCell => ({column, row});

  it('gives the Spot of an empty cell, on its row and Column', () => {
    expect(spotAt(at(10, 2), GEOMETRY)).toEqual({row: 2, start: col(10)});
    expect(spotAt(at(4, 1), GEOMETRY)).toEqual({row: 1, start: col(4)});
  });

  it('gives no Spot on a cell covered by a Hole', () => {
    expect(spotAt(at(5, 2), GEOMETRY)).toBeUndefined();
    expect(spotAt(at(7, 2), GEOMETRY)).toBeUndefined();
  });

  it('gives a Spot on the first Column after a Hole of its row', () => {
    expect(spotAt(at(8, 2), GEOMETRY)).toEqual({row: 2, start: col(8)});
  });

  it('gives a Spot after the last Column of the Tape', () => {
    expect(spotAt(at(103, 2), GEOMETRY)).toEqual({row: 2, start: col(103)});
  });
});

describe('moveSpot', () => {
  const spot: Spot = {row: 2, start: col(4)};
  const move = (direction: Direction, from: Spot = spot, rows = 3, geometry: TapeGeometry = GEOMETRY): Spot =>
    moveSpot(from, direction, rows, geometry);

  it('moves one Column left or right', () => {
    expect(move('right', {row: 1, start: col(4)})).toEqual({row: 1, start: col(5)});
    expect(move('left')).toEqual({row: 2, start: col(3)});
  });

  it('moves one row up or down', () => {
    expect(move('up')).toEqual({row: 1, start: col(4)});
    expect(move('down')).toEqual({row: 3, start: col(4)});
  });

  it('stays on Column 0 and on the first row', () => {
    expect(move('left', {row: 2, start: col(0)})).toEqual({row: 2, start: col(0)});
    expect(move('up', {row: 1, start: col(4)})).toEqual({row: 1, start: col(4)});
  });

  it('stays on the last row', () => {
    expect(move('down', {row: 3, start: col(4)}, 3)).toEqual({row: 3, start: col(4)});
  });

  it('skips the Columns a Hole covers in the direction of travel', () => {
    expect(move('right')).toEqual({row: 2, start: col(8)});
    expect(move('left', {row: 2, start: col(8)})).toEqual({row: 2, start: col(4)});
  });

  it('skips the rows a Hole covers in its Column', () => {
    const above = tapeGeometry(tapeWith([{pipe: defined(midiNoteNumber(60), 'pipe'), start: col(4), length: defined(columnCount(3), 'length')}]), ORGAN);

    expect(move('up', spot, 3, above)).toEqual({row: 2, start: col(4)});
    expect(move('down', spot, 3, above)).toEqual({row: 3, start: col(4)});
  });

  it('stays put when every cell that way is covered', () => {
    const walled = tapeGeometry(tapeWith([{pipe: defined(midiNoteNumber(62), 'pipe'), start: col(0), length: defined(columnCount(4), 'length')}]), ORGAN);

    expect(move('left', spot, 3, walled)).toEqual(spot);
  });
});
