import {type Millimetres, type Organ, type Tape, midiNoteNumber, tapeGeometry} from '@api/index';
import {asValidTape, type Column, type ColumnCount} from '../../../../../api/tape/tape';
import {testOrgan} from '../../../../testing/organs';
import {columnMarks, holeRects, outline, rowLabels, sectionView, RULER_HEIGHT} from './tape-drawing';

const organ: Organ = testOrgan('Street organ', 31, {pipes: Array.from({length: 31}, (_, row) => ({note: 58 + 2 * (row + 1)}))});

function tapeWith(holeStarts: readonly number[], length = 100): Tape {
  const note = midiNoteNumber(60);
  if (note === undefined) throw new Error('not a note');
  return asValidTape({
    id: '00000000-0000-4000-8000-000000000001' as Tape['id'],
    name: 'Melody',
    organId: organ.id,
    songId: undefined,
    selectedParts: undefined,
    transposition: 0 as Tape['transposition'],
    columnLength: 2.5 as Millimetres,
    length: length as ColumnCount,
    holes: holeStarts.map((start) => ({pipe: note, start: start as Column, length: 2 as ColumnCount})),
  });
}

const tape = tapeWith([0, 50]);
const geometry = tapeGeometry(tape, organ);

describe('sectionView', () => {
  it('formats the numbers for the language and carries the Part names', () => {
    const view = sectionView(tape, organ, geometry, 'de', [{index: 0, name: 'Melodie'}]);

    expect(view.organName).toBe('Street organ');
    expect(view.organId).toBe(organ.id);
    expect(view.columnLengthText).toBe('2,5');
    expect(view.lengthText).toBe('100');
    expect(view.lengthMmText).toBe('250');
    expect(view.holesText).toBe('2');
    expect(view.partNames).toEqual([{index: 0, name: 'Melodie'}]);
  });
});

describe('rowLabels', () => {
  it('names every row, marks sharps and offsets the labels by the ruler', () => {
    const {labels, rows} = rowLabels(organ, geometry, 2);

    expect(labels).toHaveLength(31);
    expect(rows.map((row) => row.row).slice(0, 2)).toEqual([1, 2]);
    expect(labels[0]?.y).toBe((geometry.rowCentres[0] ?? 0) * 2 + RULER_HEIGHT);
    expect(rows[0]?.y).toBe((geometry.rowCentres[0] ?? 0) * 2);
    expect(labels.every((label) => label.sharp === label.name.includes('#'))).toBe(true);
    expect(rows.every((row, index) => row.natural === !(labels[index]?.name ?? '').includes('#'))).toBe(true);
  });
});

describe('holeRects', () => {
  it('draws only the Holes inside the range, in px, and flags the selected one', () => {
    const rects = holeRects(tape, geometry, 2, {first: 0, last: 10}, {row: 2, start: 0});

    expect(rects).toHaveLength(1);
    expect(rects[0]?.start).toBe(0);
    expect(rects[0]?.selected).toBe(false);
    expect(rects[0]?.width).toBe((geometry.slots[0]?.width ?? 0) * 2);
  });

  it('keeps a Hole that starts before the range but reaches into it', () => {
    const rects = holeRects(tape, geometry, 2, {first: 1, last: 10}, undefined);

    expect(rects.map((rect) => rect.start)).toEqual([0]);
  });

  it('flags the Hole at the selected row and start', () => {
    const slot = geometry.slots[0];
    const rects = holeRects(tape, geometry, 2, {first: 0, last: 10}, slot && {row: slot.row, start: slot.start});

    expect(rects[0]?.selected).toBe(true);
  });
});

describe('columnMarks', () => {
  it('keeps only the marks and numbers inside the range and places them after the Lead-in', () => {
    const {marks, numbers, rulerNumbers} = columnMarks(tape, geometry, 2, {first: 0, last: 9});

    const leadIn = geometry.leadIn * 2;
    expect(marks.every((mark) => mark.column <= 9)).toBe(true);
    expect(marks[0]?.x).toBe(leadIn);
    expect(numbers.every((entry) => entry.column <= 9)).toBe(true);
    expect(rulerNumbers.every((entry) => entry.mm <= 10 * 2.5)).toBe(true);
  });
});

describe('outline', () => {
  it('scales the Tape to px and adds the ruler and the Column numbers to the height', () => {
    const result = outline(geometry, 2);

    expect(result.width).toBe(geometry.totalLength * 2);
    expect(result.height).toBe(geometry.width * 2);
    expect(result.totalHeight).toBe(RULER_HEIGHT + geometry.width * 2 + 20);
    expect(result.leadIn).toBe(geometry.leadIn * 2);
    expect(result.borders).toEqual([geometry.border * 2, (geometry.width - geometry.border) * 2]);
  });
});
