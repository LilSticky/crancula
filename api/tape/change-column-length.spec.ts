import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {partIndex, songId} from '../song/song';
import {changeColumnLength} from './change-column-length';
import {cuttingProblems} from './cutting-problems';
import {column, columnCount, transposition, type Hole, type Tape, type TapeId} from './tape';
import {tapeOf} from './tape-fixture';

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
    tapePerCrankTurn: null,
    pipes: [{note: 60}, {note: 62}],
  });
  if (!result.ok) throw new Error(`invalid test Organ: ${JSON.stringify(result.error)}`);
  return result.value;
}

const first: MidiNoteNumber = defined(midiNoteNumber(60), 'first Pipe');
const second: MidiNoteNumber = defined(midiNoteNumber(62), 'second Pipe');

function hole(pipe: MidiNoteNumber, start: number, length: number): Hole {
  return {pipe, start: defined(column(start), 'start'), length: defined(columnCount(length), 'length')};
}

/** A Tape at 5 mm, 100 Columns, with a Song, selected Parts and a Transposition, so every carried-over field is set. */
function aTape(holes: readonly Hole[]): Tape {
  return tapeOf({
    id: TAPE_ID,
    name: 'Melody',
    organId: defined(organId('bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'), 'organ id'),
    songId: defined(songId('7a1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'), 'song id'),
    selectedParts: [defined(partIndex(0, 2), 'part')],
    transposition: defined(transposition(3), 'transposition'),
    columnLength: defined(millimetres(5), 'column length'),
    length: defined(columnCount(100), 'length'),
    holes,
  });
}

describe('changeColumnLength', () => {
  const holes = [hole(first, 0, 10), hole(first, 20, 5), hole(second, 3, 40)];

  it('gives the Tape the new Column length, the same length in Columns and the same Holes', () => {
    const tape = aTape(holes);

    const result = changeColumnLength(tape, 10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.columnLength).toBe(10);
    expect(result.value.length).toBe(100);
    expect(result.value.holes).toEqual(holes);
  });

  it('keeps the id, name, Organ, Song, selected Parts and Transposition', () => {
    const tape = aTape(holes);

    const result = changeColumnLength(tape, 10);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(tape.id);
    expect(result.value.name).toBe(tape.name);
    expect(result.value.organId).toBe(tape.organId);
    expect(result.value.songId).toBe(tape.songId);
    expect(result.value.selectedParts).toEqual(tape.selectedParts);
    expect(result.value.transposition).toBe(tape.transposition);
  });

  it('returns the same Tape object for the current Column length', () => {
    const tape = aTape(holes);

    const result = changeColumnLength(tape, tape.columnLength);

    expect(result).toEqual({ok: true, value: tape});
    expect(result.ok && result.value).toBe(tape);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses the Column length %d with column-length-must-be-positive',
    (value) => {
      expect(changeColumnLength(aTape(holes), value)).toEqual({
        ok: false,
        error: 'column-length-must-be-positive',
      });
    },
  );

  it('accepts a Tape whose Holes become too short at the new value, reports them as Cutting Problems and keeps the Holes', () => {
    const organ = organWith(5); // Minimum Hole Length 5 mm: a 2-Column Hole is 5 mm at 2.5 mm, 4 mm at 2 mm
    const tape = aTape([hole(first, 10, 2)]);

    const result = changeColumnLength(tape, 2);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.holes).toEqual([hole(first, 10, 2)]);
    expect(cuttingProblems(result.value, organ)).toEqual([
      {code: 'too-short', pipe: first, start: 10, lengthMm: 4, minimumHoleLengthMm: 5},
    ]);
  });
});
