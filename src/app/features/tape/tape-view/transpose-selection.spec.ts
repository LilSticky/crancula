import {type Hole, type Millimetres, type Organ, type Tape, midiNoteNumber} from '@api/index';
import {type Column, type ColumnCount} from '../../../../../api/tape/tape';
import {tapeOf} from '../../../../../api/tape/tape-fixture';
import {testOrgan} from '../../../../testing/organs';
import {canTranspose, holeRefsOf, selectionOfRefs} from './transpose-selection';

// The Pipe of row r (from 1) is note 58 + 2r.
const organ: Organ = testOrgan('Street organ', 31, {pipes: Array.from({length: 31}, (_, row) => ({note: 58 + 2 * (row + 1)}))});

function note(row: number): Hole['pipe'] {
  const value = midiNoteNumber(58 + 2 * row);
  if (value === undefined) throw new Error(`not a note for row ${row}`);
  return value;
}

function hole(pipe: Hole['pipe'], start: number): Hole {
  return {pipe, start: start as Column, length: 2 as ColumnCount};
}

function tapeWith(holes: readonly Hole[]): Tape {
  return tapeOf({
    id: '00000000-0000-4000-8000-000000000001' as Tape['id'],
    name: 'Melody',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: 0 as Tape['transposition'],
    columnLength: 2.5 as Millimetres,
    length: 100 as ColumnCount,
    holes,
  });
}

describe('canTranspose', () => {
  it('is true when some Hole sits on a Pipe of the Organ', () => {
    const offOrgan = midiNoteNumber(1);
    if (offOrgan === undefined) throw new Error('not a note');
    expect(canTranspose(tapeWith([hole(offOrgan, 0), hole(note(3), 4)]), organ)).toBe(true);
  });

  it('is false for a Tape without Holes', () => {
    expect(canTranspose(tapeWith([]), organ)).toBe(false);
  });

  it('is false when no Hole sits on a Pipe of the Organ', () => {
    const offOrgan = midiNoteNumber(1);
    if (offOrgan === undefined) throw new Error('not a note');
    expect(canTranspose(tapeWith([hole(offOrgan, 0)]), organ)).toBe(false);
  });
});

describe('holeRefsOf', () => {
  it('names each selected Hole by the Pipe of its row and its start Column', () => {
    expect(holeRefsOf([{row: 3, start: 4}, {row: 1, start: 0}], organ)).toEqual([
      {pipe: note(3), start: 4},
      {pipe: note(1), start: 0},
    ]);
  });

  it('skips rows without a Pipe', () => {
    expect(holeRefsOf([{row: 99, start: 4}, {row: 2, start: 1}], organ)).toEqual([{pipe: note(2), start: 1}]);
  });
});

describe('selectionOfRefs', () => {
  it('selects the Holes by the row of their Pipe', () => {
    expect(selectionOfRefs([{pipe: note(3), start: 4 as Column}], organ)).toEqual([{row: 3, start: 4}]);
  });

  it('skips Pipes that are not on the Organ', () => {
    const offOrgan = midiNoteNumber(1);
    if (offOrgan === undefined) throw new Error('not a note');
    expect(selectionOfRefs([{pipe: offOrgan, start: 0 as Column}], organ)).toEqual([]);
  });
});
