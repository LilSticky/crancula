import {type Hole, type Millimetres, type Organ, type Tape, midiNoteNumber} from '@api/index';
import {type Column, type ColumnCount} from '../../../../../api/tape/tape';
import {tapeOf} from '../../../../../api/tape/tape-fixture';
import {testOrgan} from '../../../../testing/organs';
import {inspectHole} from './inspect-hole';

// Street organ: hole 2,5 mm (the Minimum Hole Length), Minimum Gap 1,5 mm, Column 2,5 mm.
// The Pipe of row r (from 1) is note 58 + 2r, so row 25 is note 108 (C8).
const organ: Organ = testOrgan('Street organ', 31, {pipes: Array.from({length: 31}, (_, row) => ({note: 58 + 2 * (row + 1)}))});

function hole(row: number, start: number, length: number): Hole {
  const note = midiNoteNumber(58 + 2 * row);
  if (note === undefined) throw new Error(`not a note for row ${row}`);
  return {pipe: note, start: start as Column, length: length as ColumnCount};
}

function tapeWith(holes: readonly Hole[], columnLength = 2.5, length = 100): Tape {
  return tapeOf({
    id: '00000000-0000-4000-8000-000000000001' as Tape['id'],
    name: 'Melody',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: 0 as Tape['transposition'],
    columnLength: columnLength as Millimetres,
    length: length as ColumnCount,
    holes,
  });
}

describe('inspectHole', () => {
  it('numbers the row from 1 and names its note', () => {
    const selected = hole(25, 64, 15);

    const inspection = inspectHole(tapeWith([selected]), organ, selected);

    expect(inspection.row).toBe(25);
    expect(inspection.noteName).toBe('C8');
  });

  it('gives Columns from 65 to 79, 15 Columns and 37.5 mm for start 64, length 15', () => {
    const selected = hole(25, 64, 15);

    const inspection = inspectHole(tapeWith([selected]), organ, selected);

    expect(inspection.fromColumn).toBe(65);
    expect(inspection.toColumn).toBe(79);
    expect(inspection.lengthColumns).toBe(15);
    expect(inspection.lengthMm).toBeCloseTo(37.5);
  });

  it('gives the gap to the next Hole in the same row in Columns and mm', () => {
    const selected = hole(25, 64, 15);
    const next = hole(25, 83, 5);
    const otherRow = hole(24, 80, 2);

    const inspection = inspectHole(tapeWith([otherRow, next, selected]), organ, selected);

    expect(inspection.gap).toEqual({to: 'nextHole', columns: 4, mm: 10});
  });

  it('gives the space to the end of the Tape, marked as such, for the last Hole of its row', () => {
    const selected = hole(25, 64, 15);
    const otherRow = hole(24, 90, 2);

    const inspection = inspectHole(tapeWith([selected, otherRow]), organ, selected);

    expect(inspection.gap).toEqual({to: 'tapeEnd', columns: 21, mm: 52.5});
  });

  it('warns of nothing for a Hole within the limits', () => {
    const before = hole(25, 40, 5);
    const selected = hole(25, 64, 15);
    const next = hole(25, 83, 5);

    expect(inspectHole(tapeWith([before, selected, next]), organ, selected).warnings).toEqual([]);
  });

  it('warns tooShort with the numbers when the Hole is shorter than the Minimum Hole Length', () => {
    const selected = hole(25, 64, 1);

    const inspection = inspectHole(tapeWith([selected], 2), organ, selected);

    expect(inspection.warnings).toEqual([{kind: 'tooShort', mm: 2, minimumMm: 2.5}]);
  });

  it('does not warn tooShort for a Hole exactly as long as the Minimum Hole Length', () => {
    const selected = hole(25, 64, 1);

    expect(inspectHole(tapeWith([selected], 2.5), organ, selected).warnings).toEqual([]);
  });

  it('warns gapTooSmall when the gap to the next Hole is below the Minimum Gap', () => {
    const selected = hole(25, 64, 15);
    const next = hole(25, 80, 5); // 1 Column of 1 mm = 1 mm < 1.5 mm
    const tape = tapeWith([selected, next], 1);

    const inspection = inspectHole(tape, organ, selected);

    expect(inspection.warnings).toEqual([{kind: 'gapTooSmall', mm: 1, minimumMm: 1.5}]);
  });

  it('warns gapTooSmall when the gap from the previous Hole in the row is below the Minimum Gap', () => {
    const previous = hole(25, 40, 5);
    const selected = hole(25, 46, 15); // 1 Column of 1 mm after the previous Hole
    const tape = tapeWith([previous, selected], 1);

    const inspection = inspectHole(tape, organ, selected);

    expect(inspection.warnings).toEqual([{kind: 'gapTooSmall', mm: 1, minimumMm: 1.5}]);
  });

  it('does not check the space to the end of the Tape against the Minimum Gap', () => {
    const selected = hole(25, 98, 2); // the Tape ends right after the Hole

    const inspection = inspectHole(tapeWith([selected]), organ, selected);

    expect(inspection.gap).toEqual({to: 'tapeEnd', columns: 0, mm: 0});
    expect(inspection.warnings).toEqual([]);
  });

  describe('with the Column-based rules of the export check', () => {
    // 0.7 mm Columns against 2.1 mm: 3 * 0.7 is 2.0999999999999996 in floating point, but exactly 3 Columns.
    const precise: Organ = testOrgan('Precise organ', 31, {
      pipes: Array.from({length: 31}, (_, row) => ({note: 58 + 2 * (row + 1)})),
      tapeBed: {tapeWidth: 120, holeDiameter: 2.1, rowSpacing: 3.5, guideMargin: null},
      minimumGap: 2.1,
    });

    it('warns of no tooShort for a Hole of 3 Columns of 0.7 mm against a Minimum Hole Length of 2.1 mm', () => {
      const selected = hole(25, 64, 3);

      expect(inspectHole(tapeWith([selected], 0.7), precise, selected).warnings).toEqual([]);
    });

    it('warns of no gapTooSmall for a gap of 3 Columns of 0.7 mm against a Minimum Gap of 2.1 mm', () => {
      const selected = hole(25, 64, 3);
      const next = hole(25, 70, 3);

      expect(inspectHole(tapeWith([selected, next], 0.7), precise, selected).warnings).toEqual([]);
      expect(inspectHole(tapeWith([selected, next], 0.7), precise, next).warnings).toEqual([]);
    });

    it('warns gapTooSmall on a Hole and on the next Hole of its row when they are too close', () => {
      const selected = hole(25, 64, 3);
      const next = hole(25, 69, 3); // 2 Columns apart = 1.4 mm < 2.1 mm
      const tape = tapeWith([selected, next], 0.7);

      expect(inspectHole(tape, precise, selected).warnings).toEqual([{kind: 'gapTooSmall', mm: expect.closeTo(1.4), minimumMm: 2.1}]);
      expect(inspectHole(tape, precise, next).warnings).toEqual([{kind: 'gapTooSmall', mm: expect.closeTo(1.4), minimumMm: 2.1}]);
    });
  });

  it('reports both warnings for a short Hole with a small gap', () => {
    const selected = hole(25, 64, 1);
    const next = hole(25, 66, 5);

    const inspection = inspectHole(tapeWith([selected, next], 1), organ, selected);

    expect(inspection.warnings.map(({kind}) => kind)).toEqual(['tooShort', 'gapTooSmall']);
  });
});
