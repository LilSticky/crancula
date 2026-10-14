import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId} from '../organ/organ';
import {
  asValidTape,
  column,
  columnCount,
  removeHolesOfPipes,
  tapeId,
  tapeLengthInMillimetres,
  transposition,
  type Hole,
  type Tape,
} from './tape';

const UUID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function aHole(pipe: number, start: number, length: number): Hole {
  return {
    pipe: defined(midiNoteNumber(pipe), 'pipe'),
    start: defined(column(start), 'start'),
    length: defined(columnCount(length), 'length'),
  };
}

function aTape(holes: readonly Hole[], length: number, columnLength: number): Tape {
  return asValidTape({
    id: defined(tapeId(UUID), 'id'),
    name: 'Fugue',
    organId: defined(organId(UUID), 'organ id'),
    songId: undefined,
    selectedParts: undefined,
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(columnLength), 'column length'),
    length: defined(columnCount(length), 'tape length'),
    holes,
  });
}

describe('tapeId', () => {
  it('accepts a UUID', () => {
    expect(tapeId(UUID)).toBe(UUID);
  });

  it.each(['', 'tape-1'])('rejects "%s"', (value) => {
    expect(tapeId(value)).toBeUndefined();
  });
});

describe('column', () => {
  it.each([0, 1, 4000])('accepts %d', (value) => {
    expect(column(value)).toBe(value);
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (value) => {
    expect(column(value)).toBeUndefined();
  });
});

describe('columnCount', () => {
  it.each([1, 2, 4000])('accepts %d', (value) => {
    expect(columnCount(value)).toBe(value);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %d', (value) => {
    expect(columnCount(value)).toBeUndefined();
  });
});

describe('transposition', () => {
  it.each([-127, -1, 0, 1, 127])('accepts %d', (value) => {
    expect(transposition(value)).toBe(value);
  });

  it.each([-128, 128, 0.5, Number.NaN])('rejects %d', (value) => {
    expect(transposition(value)).toBeUndefined();
  });
});

describe('tapeLengthInMillimetres', () => {
  it('is the length in Columns times the Column length', () => {
    expect(tapeLengthInMillimetres(aTape([aHole(60, 0, 4)], 10, 2.5))).toBe(25);
  });
});

describe('removeHolesOfPipes', () => {
  const holes = [aHole(60, 0, 2), aHole(60, 5, 2), aHole(62, 1, 3), aHole(64, 0, 1)];
  const tape = aTape(holes, 8, 2);
  const pipes = (...numbers: number[]) => new Set(numbers.map((n) => defined(midiNoteNumber(n), 'pipe')));

  it('removes exactly the Holes of the given Pipes', () => {
    expect(removeHolesOfPipes(tape, pipes(60, 64)).holes).toEqual([aHole(62, 1, 3)]);
  });

  it('keeps everything else, including the length', () => {
    const result = removeHolesOfPipes(tape, pipes(62));
    expect({...result, holes: []}).toEqual({...tape, holes: []});
    expect(result.length).toBe(8);
  });

  it('may leave the Tape without a Hole', () => {
    const result = removeHolesOfPipes(tape, pipes(60, 62, 64));
    expect(result.holes).toEqual([]);
    expect(result.length).toBe(8);
  });

  it('changes nothing for Pipes without Holes', () => {
    expect(removeHolesOfPipes(tape, pipes(70))).toEqual(tape);
  });
});
