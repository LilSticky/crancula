import {type Millimetres, type Organ, type Tape, midiNoteNumber, tapeGeometry} from '@api/index';
import {type Column, type ColumnCount} from '../../../../../api/tape/tape';
import {tapeOf} from '../../../../../api/tape/tape-fixture';
import {testOrgan} from '../../../../testing/organs';
import {columnMarks, holeMarks, holeRects, outline, rowLabels, sectionView, RULER_HEIGHT} from './tape-drawing';

const organ: Organ = testOrgan('Street organ', 31, {pipes: Array.from({length: 31}, (_, row) => ({note: 58 + 2 * (row + 1)}))});

function tapeWith(holeStarts: readonly number[], length = 100): Tape {
  const note = midiNoteNumber(60);
  if (note === undefined) throw new Error('not a note');
  return tapeOf({
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
    const scale = 12.5 / ((geometry.rowCentres[1] ?? 0) - (geometry.rowCentres[0] ?? 0));
    const {labels, rows} = rowLabels(organ, geometry, scale);

    expect(labels).toHaveLength(31);
    expect(rows.map((row) => row.row).slice(0, 2)).toEqual([1, 2]);
    expect(labels[0]?.y).toBe((geometry.rowCentres[0] ?? 0) * scale + RULER_HEIGHT);
    expect(rows[0]?.y).toBe((geometry.rowCentres[0] ?? 0) * scale);
    expect(labels.every((label) => label.sharp === label.name.includes('#'))).toBe(true);
    expect(rows.every((row, index) => row.natural === !(labels[index]?.name ?? '').includes('#'))).toBe(true);
  });
});

describe('rowLabels when rows are crowded', () => {
  const pitch = (geometry.rowCentres[1] ?? 0) - (geometry.rowCentres[0] ?? 0);

  it('keeps every label when the row pitch is at least 12 px', () => {
    expect(rowLabels(organ, geometry, 12.5 / pitch).labels).toHaveLength(31);
  });

  it('labels every 2nd row, starting at row 1, when the pitch is 6 px', () => {
    const scale = 6 / pitch;
    const {labels, rows} = rowLabels(organ, geometry, scale);
    const all = rowLabels(organ, geometry, 12.5 / pitch).labels;

    expect(labels.map((label) => label.name)).toEqual(all.filter((_, index) => index % 2 === 0).map((label) => label.name));
    expect(labels[1]?.y).toBeCloseTo((geometry.rowCentres[2] ?? 0) * scale + RULER_HEIGHT);
    expect(rows).toHaveLength(31);
  });

  it('labels every 3rd row when the pitch is 5 px', () => {
    const {labels, rows} = rowLabels(organ, geometry, 5 / pitch);

    expect(labels).toHaveLength(11);
    expect(rows).toHaveLength(31);
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

  it('gives handles at both ends of the selected Hole only', () => {
    const slot = geometry.slots[0];
    const rects = holeRects(tape, geometry, 2, {first: 0, last: 60}, slot && {row: slot.row, start: slot.start});

    expect(rects[1]?.handles).toBeUndefined();
    expect(rects[0]?.handles).toBeDefined();
  });

  it('makes each handle 8 px wide inside the Hole', () => {
    const slot = geometry.slots[0];
    const [rect] = holeRects(tape, geometry, 20, {first: 0, last: 10}, slot && {row: slot.row, start: slot.start});

    expect(rect?.width).toBeGreaterThan(24);
    expect(rect?.handles).toMatchObject({
      start: {x: rect?.x, width: 8},
      end: {x: (rect?.x ?? 0) + (rect?.width ?? 0) - 8, width: 8},
    });
  });

  it('makes each handle a third of the Hole wide when the Hole is narrow', () => {
    const slot = geometry.slots[0];
    const [rect] = holeRects(tape, geometry, 2, {first: 0, last: 10}, slot && {row: slot.row, start: slot.start});
    const width = (rect?.width ?? 0) / 3;

    expect(width).toBeLessThan(8);
    expect(rect?.handles?.start.width).toBeCloseTo(width);
    expect(rect?.handles?.end.width).toBeCloseTo(width);
    expect(rect?.handles?.end.x).toBeCloseTo((rect?.x ?? 0) + (rect?.width ?? 0) - width);
  });
});

describe('holeRects handle hit areas', () => {
  it('gives each handle a hit area of at least 24 px by 24 px around the handle', () => {
    const slot = geometry.slots[0];
    const [rect] = holeRects(tape, geometry, 2, {first: 0, last: 10}, slot && {row: slot.row, start: slot.start});
    const handles = rect?.handles;

    for (const handle of [handles?.start, handles?.end]) {
      expect(handle?.hit.width).toBeGreaterThanOrEqual(24);
      expect(handle?.hit.height).toBeGreaterThanOrEqual(24);
      expect(handle?.hit.x).toBeLessThanOrEqual(handle?.x ?? -Infinity);
      expect(handle?.hit.x ?? 0).toBeCloseTo((handle?.x ?? 0) + (handle?.width ?? 0) / 2 - (handle?.hit.width ?? 0) / 2);
      expect(handle?.hit.y ?? 0).toBeCloseTo((rect?.y ?? 0) + (rect?.height ?? 0) / 2 - (handle?.hit.height ?? 0) / 2);
    }
  });
});

describe('holeMarks', () => {
  const range = {first: 0, last: 60};

  it('rings only the Holes whose "pipe:start" key has a Cutting Problem', () => {
    const marks = holeMarks(tape, organ, geometry, 2, range, new Set(['60:0']));

    expect(marks.map((mark) => mark.start)).toEqual([0]);
  });

  it('puts the ring 2 px outside the slot on every side', () => {
    const [mark] = holeMarks(tape, organ, geometry, 2, range, new Set(['60:0']));
    const [rect] = holeRects(tape, geometry, 2, range, undefined);

    expect(mark).toMatchObject({
      x: (rect?.x ?? 0) - 2,
      y: (rect?.y ?? 0) - 2,
      width: (rect?.width ?? 0) + 4,
      height: (rect?.height ?? 0) + 4,
      radius: (rect?.radius ?? 0) + 2,
    });
  });

  it('gives each ring a glyph inside it, so the problem is not shown by colour alone', () => {
    const [mark] = holeMarks(tape, organ, geometry, 2, range, new Set(['60:0']));

    expect(mark?.glyph.x).toBeGreaterThanOrEqual(mark?.x ?? Infinity);
    expect(mark?.glyph.x).toBeLessThanOrEqual((mark?.x ?? 0) + (mark?.width ?? 0));
    expect(mark?.glyph.y).toBeGreaterThanOrEqual(mark?.y ?? Infinity);
    expect(mark?.glyph.y).toBeLessThanOrEqual((mark?.y ?? 0) + (mark?.height ?? 0));
  });

  it('still draws the ring, flagged selected, when the Hole is selected', () => {
    const slot = geometry.slots[0];
    const selected = slot && {row: slot.row, start: slot.start};
    const marks = holeMarks(tape, organ, geometry, 2, range, new Set(['60:0']), selected);

    expect(marks).toHaveLength(1);
    expect(marks[0]?.selected).toBe(true);
    expect(holeMarks(tape, organ, geometry, 2, range, new Set(['60:0']))[0]?.selected).toBe(false);
  });

  it('draws no ring for a marked Hole outside the visible range', () => {
    expect(holeMarks(tape, organ, geometry, 2, {first: 0, last: 10}, new Set(['60:50']))).toEqual([]);
  });

  it('draws no ring when no Hole has a Cutting Problem', () => {
    expect(holeMarks(tape, organ, geometry, 2, range, new Set())).toEqual([]);
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
