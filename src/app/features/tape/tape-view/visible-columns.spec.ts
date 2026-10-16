import {type Millimetres, type Tape} from '@api/index';
import {asValidTape, type ColumnCount} from '../../../../../api/tape/tape';
import {testOrgan} from '../../../../testing/organs';
import {tapeGeometry} from './tape-geometry';
import {visibleColumns} from './visible-columns';

// 100 Columns of 2,5 mm (250 mm) behind a Lead-in of 20 mm. At a scale of 1 px per mm a Column is 2,5 px wide
// and Column 1 starts 20 px into the drawing.
const organ = testOrgan('Street organ', 3, {leadIn: 20});
const tape: Tape = asValidTape({
  id: '00000000-0000-4000-8000-000000000001' as Tape['id'],
  name: 'Melody',
  organId: organ.id,
  songId: undefined,
  selectedParts: undefined,
  transposition: 0 as Tape['transposition'],
  columnLength: 2.5 as Millimetres,
  length: 100 as ColumnCount,
  holes: [],
});
const geometry = tapeGeometry(tape, organ);

describe('visibleColumns', () => {
  it('gives the visible window plus one window on each side, as the first and last Column to render', () => {
    // Visible: 101 to 151 px. Rendered: 51 to 201 px, that is Columns 12.4 to 72.4 after the Lead-in.
    expect(visibleColumns(101, 50, 1, geometry)).toEqual({first: 12, last: 72});
  });

  it('starts at Column 0 when the window reaches before the Tape', () => {
    expect(visibleColumns(0, 50, 1, geometry)).toEqual({first: 0, last: 32});
  });

  it('ends at the last Column of the Tape when the window reaches past it', () => {
    expect(visibleColumns(240, 50, 1, geometry)).toEqual({first: 68, last: 99});
  });

  it('covers the whole Tape when the window is wider than the Tape', () => {
    expect(visibleColumns(0, 1000, 1, geometry)).toEqual({first: 0, last: 99});
  });

  it('counts the scale: at 2 px per mm the same scroll position is half as many Columns in', () => {
    // A Column is 5 px, the Lead-in 40 px. Rendered: 102 to 402 px, that is Columns 12.4 to 72.4 after the Lead-in.
    expect(visibleColumns(202, 100, 2, geometry)).toEqual({first: 12, last: 72});
  });
});
