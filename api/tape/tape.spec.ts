import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId, type Millimetres} from '../organ/organ';
import {
  column,
  columnCount,
  removeHolesOfPipes,
  tapeId,
  tapeLengthInMillimetres,
  transposition,
  validTape,
  type Hole,
  type Tape,
  type TapeFields,
  type TapeRuleViolationCode,
} from './tape';
import {tapeOf} from './tape-fixture';
import {partIndex, songId} from '../song/song';

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
  return tapeOf({
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

describe('validTape', () => {
  const SONG = '7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';
  const part = (n: number) => defined(partIndex(n, 10), 'part');

  function fields(overrides: Partial<TapeFields> = {}): TapeFields {
    const {holes: _holes, ...rest} = aTape([], 10, 2);
    void _holes;
    return {...rest, holes: [], ...overrides};
  }

  function violationOf(input: TapeFields) {
    const result = validTape(input);
    if (result.ok) throw new Error('expected a rule violation');
    return result.error;
  }

  it('accepts a Tape without Holes and carries every field over', () => {
    const input = fields();
    const result = validTape(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(input);
  });

  it('accepts valid Holes and carries them over', () => {
    const holes = [aHole(60, 0, 2), aHole(60, 5, 2), aHole(62, 1, 3)];
    const result = validTape(fields({holes}));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.holes).toEqual(holes);
  });

  it('stores the name trimmed', () => {
    const result = validTape(fields({name: '  Fugue \n'}));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('Fugue');
  });

  it('rejects a blank name with name-blank', () => {
    expect(violationOf(fields({name: '  \t '})).code).toBe('name-blank');
  });

  it('rejects a song without selected parts with song-reference-incomplete', () => {
    expect(violationOf(fields({songId: defined(songId(SONG), 'song id')})).code).toBe(
      'song-reference-incomplete',
    );
  });

  it('rejects selected parts without a song with song-reference-incomplete', () => {
    expect(violationOf(fields({selectedParts: [part(0)]})).code).toBe('song-reference-incomplete');
  });

  it('accepts a song with selected parts', () => {
    const result = validTape(fields({songId: defined(songId(SONG), 'song id'), selectedParts: [part(0), part(2)]}));
    expect(result.ok).toBe(true);
  });

  it.each([
    ['empty', []],
    ['unsorted', [2, 1]],
    ['duplicated', [1, 1]],
  ])('rejects %s selected parts with selected-parts-invalid', (_name, parts) => {
    const input = fields({songId: defined(songId(SONG), 'song id'), selectedParts: parts.map(part)});
    expect(violationOf(input).code).toBe('selected-parts-invalid');
  });

  it('rejects a Hole beyond the end with hole-beyond-end naming the first offending Hole', () => {
    const first = aHole(62, 8, 3);
    const violation = violationOf(fields({holes: [aHole(60, 0, 2), first, aHole(64, 9, 5)]}));
    expect(violation).toEqual({code: 'hole-beyond-end', hole: first});
  });

  it('accepts a Hole that ends exactly at the end of the Tape', () => {
    expect(validTape(fields({holes: [aHole(60, 8, 2)]})).ok).toBe(true);
  });

  it('rejects Holes not sorted by Pipe with holes-not-sorted', () => {
    expect(violationOf(fields({holes: [aHole(62, 0, 1), aHole(60, 0, 1)]})).code).toBe('holes-not-sorted');
  });

  it('rejects Holes of one Pipe not sorted by start with holes-not-sorted', () => {
    expect(violationOf(fields({holes: [aHole(60, 5, 1), aHole(60, 0, 1)]})).code).toBe('holes-not-sorted');
  });

  it('rejects overlapping Holes of one Pipe with holes-overlap', () => {
    expect(violationOf(fields({holes: [aHole(60, 0, 3), aHole(60, 2, 2)]})).code).toBe('holes-overlap');
  });

  it('accepts touching Holes of one Pipe', () => {
    expect(validTape(fields({holes: [aHole(60, 0, 3), aHole(60, 3, 2)]})).ok).toBe(true);
  });

  // The brand cannot hold what millimetres() refuses; validTape must refuse these values anyway.
  const unchecked = (value: number): Millimetres => value as Millimetres;

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the Column length %d with column-length-not-positive',
    (value) => {
      expect(violationOf(fields({columnLength: unchecked(value)}))).toEqual({code: 'column-length-not-positive'});
    },
  );

  it('names exactly the seven rule codes', () => {
    const codes: Record<TapeRuleViolationCode, true> = {
      'name-blank': true,
      'song-reference-incomplete': true,
      'selected-parts-invalid': true,
      'hole-beyond-end': true,
      'holes-not-sorted': true,
      'holes-overlap': true,
      'column-length-not-positive': true,
    };
    expect(Object.keys(codes)).toHaveLength(7);
  });
});
