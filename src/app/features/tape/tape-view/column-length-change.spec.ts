import {describe, expect, it} from 'vitest';
import {
  column,
  columnCount,
  cuttingProblems,
  midiNoteNumber,
  millimetres,
  organId,
  transposition,
  validateOrgan,
  type Hole,
  type MidiNoteNumber,
  type Organ,
  type Tape,
  type TapeId,
} from '@api/index';
import {partIndex, songId} from '@api/song/song';
import {tapeOf} from '@api/tape/tape-fixture';
import {columnLengthChange, columnLengthChangeTo} from './column-length-change';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

const TAPE_ID = '00000000-0000-4000-8000-000000000001' as TapeId;

/** An Organ with the Pipes 60 and 62 and a Minimum Hole Length of `holeDiameter` mm. */
function organWith(holeDiameter: number): Organ {
  const result = validateOrgan({
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter, rowSpacing: holeDiameter + 1},
    minimumGap: 1.5,
    leadIn: 20,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: [{note: 60}, {note: 62}],
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** The Cutting Problems of a Tape on the Organ. */
function problemsOf(tape: Tape, organ: Organ): number {
  return cuttingProblems(tape, organ).length;
}

const first: MidiNoteNumber = defined(midiNoteNumber(60), 'first Pipe');

function hole(pipe: MidiNoteNumber, start: number, length: number): Hole {
  return {pipe, start: defined(column(start), 'start'), length: defined(columnCount(length), 'length')};
}

/** A Tape of 100 Columns at the given Column length in mm. */
function aTape(columnLength: number, holes: readonly Hole[] = []): Tape {
  return tapeOf({
    id: TAPE_ID,
    name: 'Melody',
    organId: defined(organId('bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'), 'organ id'),
    songId: defined(songId('7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'), 'song id'),
    selectedParts: [defined(partIndex(0, 2), 'part')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(columnLength), 'column length'),
    length: defined(columnCount(100), 'length'),
    holes,
  });
}

describe('columnLengthChange', () => {
  it('is unchanged for an empty field', () => {
    const change = columnLengthChange(aTape(5), '');

    expect(change).toEqual({state: 'unchanged'});
  });

  it.each(['5', '5,0', ' 5 '])('is unchanged when the typed text "%s" is the current Column length of 5 mm', (typed) => {
    const change = columnLengthChange(aTape(5), typed);

    expect(change).toEqual({state: 'unchanged'});
  });

  it.each(['abc', '0', '-1', '5 mm'])('is invalid for the typed text "%s"', (typed) => {
    const change = columnLengthChange(aTape(5), typed);

    expect(change.state).toBe('invalid');
  });

  it('is ready with the changed Tape for a valid different value', () => {
    const change = columnLengthChange(aTape(5), '10');

    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(change.tape.columnLength).toBe(10);
  });

  it('reads a decimal comma as the decimal separator', () => {
    const change = columnLengthChange(aTape(5), '2,5');

    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(change.tape.columnLength).toBe(2.5);
  });

  it('is ready with a changed Tape from a number too, and unchanged for null', () => {
    expect(columnLengthChangeTo(aTape(5), null)).toEqual({state: 'unchanged'});

    const change = columnLengthChangeTo(aTape(5), 2);
    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(change.tape.columnLength).toBe(2);
  });

  it('changes a Tape with Holes to a Column length where the Cutting Problems can be counted before and after', () => {
    // Minimum Hole Length 5 mm: a 2-Column Hole is 10 mm at 5 mm, and 4 mm at 2 mm.
    const organ = organWith(5);
    const tape = aTape(5, [hole(first, 10, 2)]);
    const change = columnLengthChange(tape, '2');

    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(problemsOf(tape, organ)).toBe(0);
    expect(problemsOf(change.tape, organ)).toBe(1);
  });

  it('changes a Tape with Holes to a Column length that clears the Cutting Problems', () => {
    // The same Hole is 4 mm at 2 mm (a Cutting Problem) and 10 mm at 5 mm.
    const organ = organWith(5);
    const tape = aTape(2, [hole(first, 10, 2)]);
    const change = columnLengthChange(tape, '5');

    expect(change.state).toBe('ready');
    if (change.state !== 'ready') return;
    expect(problemsOf(tape, organ)).toBe(1);
    expect(problemsOf(change.tape, organ)).toBe(0);
  });
});
