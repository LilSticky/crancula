import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {column, columnCount, type Column, type ColumnCount, type Hole} from './tape';
import {millimetres, type Millimetres, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {columnsFor, fixHoles, holeLimitsOf, mergeOverlaps} from './hole-fixes';

function mm(value: number): Millimetres {
  return defined(millimetres(value), 'millimetres');
}

function organWith(holeDiameter: number, minimumGap: number): Organ {
  const result = validateOrgan({
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter, rowSpacing: holeDiameter + 1},
    minimumGap,
    leadIn: 20,
    pipes: [{note: 60}, {note: 62}],
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

const pipe: MidiNoteNumber = defined(midiNoteNumber(60), 'pipe');
const otherPipe: MidiNoteNumber = defined(midiNoteNumber(62), 'other pipe');

/** A Hole as [start, end) in Columns. */
function hole(start: number, end: number, onPipe: MidiNoteNumber = pipe): Hole {
  return {
    pipe: onPipe,
    start: defined(column(start), 'start'),
    length: defined(columnCount(end - start), 'length'),
  };
}

function count(value: number): ColumnCount {
  return defined(columnCount(value), 'column count');
}

function col(value: number): Column {
  return defined(column(value), 'column');
}

function limits(minimumHoleLength: number, minimumGap: number) {
  return {minimumHoleLength: count(minimumHoleLength), minimumGap: count(minimumGap)};
}

describe('columnsFor', () => {
  it('is the smallest whole number of Columns that covers the millimetres', () => {
    expect(columnsFor(3, 2)).toBe(2);
    expect(columnsFor(2.5, 2)).toBe(2);
    expect(columnsFor(4, 2)).toBe(2);
    expect(columnsFor(4.5, 2)).toBe(3);
  });

  it('is not thrown off by floating-point error: 1.1 mm in Columns of 0.1 mm is 11', () => {
    expect(columnsFor(1.1, 0.1)).toBe(11);
  });
});

describe('mergeOverlaps', () => {
  it('merges Notes on the same Pipe that overlap into one Hole and reports it', () => {
    const result = mergeOverlaps([hole(0, 8), hole(4, 12)]);
    expect(result.holes).toEqual([hole(0, 12)]);
    expect(result.changes).toEqual([{kind: 'overlap-merged', pipe, column: col(0)}]);
  });

  it('reports an absorbed Note at the start of the resulting Hole, not at its own start', () => {
    const result = mergeOverlaps([hole(0, 12), hole(2, 4)]);
    expect(result.changes).toEqual([{kind: 'overlap-merged', pipe, column: col(0)}]);
  });

  it('keeps the later end when a Note lies inside another', () => {
    expect(mergeOverlaps([hole(0, 12), hole(2, 4)]).holes).toEqual([hole(0, 12)]);
  });

  it('keeps touching Notes as two Holes', () => {
    const result = mergeOverlaps([hole(0, 8), hole(8, 16)]);
    expect(result.holes).toEqual([hole(0, 8), hole(8, 16)]);
    expect(result.changes).toEqual([]);
  });

  it('does not merge Holes of different Pipes and sorts by Pipe, then start', () => {
    const result = mergeOverlaps([hole(4, 12, otherPipe), hole(6, 10), hole(0, 8, otherPipe)]);
    expect(result.holes).toEqual([hole(6, 10), hole(0, 12, otherPipe)]);
  });
});

describe('fixHoles (Minimum Hole Length 2, Minimum Gap 2 Columns)', () => {
  const fix = (holes: readonly Hole[], l = 2, g = 2) => fixHoles(holes, limits(l, g));

  it('lengthens a Hole that is too short at its end', () => {
    const result = fix([hole(0, 1)]);
    expect(result.holes).toEqual([hole(0, 2)]);
    expect(result.changes).toEqual([
      {kind: 'lengthened', pipe, column: col(0), from: count(1), to: count(2)},
    ]);
  });

  it('shortens a Hole at its end when it is too close to the next one', () => {
    const result = fix([hole(0, 8), hole(8, 16)]);
    expect(result.holes).toEqual([hole(0, 6), hole(8, 16)]);
    expect(result.changes).toEqual([
      {kind: 'shortened', pipe, column: col(0), from: count(8), to: count(6)},
    ]);
  });

  it('merges three back-to-back 1/32 Notes into one Hole with two repetition reports', () => {
    const result = fix([hole(0, 1), hole(1, 2), hole(2, 3)]);
    expect(result.holes).toEqual([hole(0, 3)]);
    expect(result.changes).toEqual([
      {kind: 'lengthened', pipe, column: col(0), from: count(1), to: count(2)},
      {kind: 'repetition-merged', pipe, column: col(0), lostColumn: col(1)},
      {kind: 'repetition-merged', pipe, column: col(0), lostColumn: col(2)},
    ]);
  });

  it('merges when lengthening runs into the next Hole (L = 3, G = 2)', () => {
    const result = fix([hole(0, 1), hole(3, 10)], 3, 2);
    expect(result.holes).toEqual([hole(0, 10)]);
    expect(result.changes).toEqual([
      {kind: 'lengthened', pipe, column: col(0), from: count(1), to: count(3)},
      {kind: 'repetition-merged', pipe, column: col(0), lostColumn: col(3)},
    ]);
  });

  it('never lengthens when L = 1', () => {
    const result = fix([hole(0, 1)], 1, 2);
    expect(result.holes).toEqual([hole(0, 1)]);
    expect(result.changes).toEqual([]);
  });

  it('leaves Holes that already respect both limits unchanged', () => {
    const holes = [hole(0, 4), hole(6, 10)];
    const result = fix(holes);
    expect(result.holes).toEqual(holes);
    expect(result.changes).toEqual([]);
  });

  it('fixes each row on its own', () => {
    const result = fix([hole(0, 8), hole(8, 16, otherPipe)]);
    expect(result.holes).toEqual([hole(0, 8), hole(8, 16, otherPipe)]);
    expect(result.changes).toEqual([]);
  });

  it('never moves the start of a Hole, and leaves no Hole shorter than L or gap below G', () => {
    const input = [hole(0, 1), hole(1, 2), hole(3, 4), hole(4, 12), hole(12, 13), hole(20, 21)];
    const starts = new Set<number>(input.map((each) => each.start));
    const result = fix(input, 3, 2);
    for (const each of result.holes) {
      expect(starts.has(each.start)).toBe(true);
      expect(each.length).toBeGreaterThanOrEqual(3);
    }
    result.holes.slice(1).forEach((after, index) => {
      const before = result.holes[index];
      if (before === undefined) throw new Error('missing hole');
      expect(after.start - (before.start + before.length)).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('holeLimitsOf', () => {
  it('is the Minimum Hole Length and the Minimum Gap of the Organ in Columns', () => {
    expect(holeLimitsOf(organWith(3, 1.5), mm(1))).toEqual(limits(3, 2));
  });

  it('is not thrown off by floating-point error: 3.3 mm in Columns of 1.1 mm is 3', () => {
    expect(holeLimitsOf(organWith(3.3, 2.2), mm(1.1))).toEqual(limits(3, 2));
  });

  it('is at least one Column each, however long the Columns are', () => {
    expect(holeLimitsOf(organWith(2.5, 1.5), mm(10))).toEqual(limits(1, 1));
  });
});
