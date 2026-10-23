import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {millimetres, organId} from '../organ/organ';
import {partIndex, songId} from '../song/song';
import {changeCrankSpeed} from './change-crank-speed';
import {crankSpeed} from './crank-speed';
import {column, columnCount, transposition, type Hole, type Tape, type TapeId} from './tape';
import {tapeOf} from './tape-fixture';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

const TAPE_ID = '00000000-0000-4000-8000-000000000002' as TapeId;
const first: MidiNoteNumber = defined(midiNoteNumber(60), 'first Pipe');
const second: MidiNoteNumber = defined(midiNoteNumber(62), 'second Pipe');

function hole(pipe: MidiNoteNumber, start: number, length: number): Hole {
  return {pipe, start: defined(column(start), 'start'), length: defined(columnCount(length), 'length')};
}

/** A Tape at 5 mm and 60 turns per minute, with a Song, selected Parts and a Transposition. */
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
    crankSpeed: defined(crankSpeed(60), 'crank speed'),
    holes,
  });
}

describe('changeCrankSpeed', () => {
  const holes = [hole(first, 0, 10), hole(first, 20, 5), hole(second, 3, 40)];

  it('gives the Tape the new Crank speed and keeps the Holes, the Columns and the Column length', () => {
    const tape = aTape(holes);

    const result = changeCrankSpeed(tape, 120);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.crankSpeed).toBe(120);
    expect(result.value.holes).toEqual(holes);
    expect(result.value.length).toBe(100);
    expect(result.value.columnLength).toBe(5);
  });

  it('keeps the id, name, Organ, Song, selected Parts and Transposition', () => {
    const tape = aTape(holes);

    const result = changeCrankSpeed(tape, 120);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(tape.id);
    expect(result.value.name).toBe(tape.name);
    expect(result.value.organId).toBe(tape.organId);
    expect(result.value.songId).toBe(tape.songId);
    expect(result.value.selectedParts).toEqual(tape.selectedParts);
    expect(result.value.transposition).toBe(tape.transposition);
  });

  it('returns the same Tape object for the current Crank speed', () => {
    const tape = aTape(holes);

    const result = changeCrankSpeed(tape, tape.crankSpeed);

    expect(result).toEqual({ok: true, value: tape});
    expect(result.ok && result.value).toBe(tape);
  });

  it.each([0, 301, Number.NaN])(
    'refuses the Crank speed %d with crank-speed-out-of-range',
    (value) => {
      expect(changeCrankSpeed(aTape(holes), value)).toEqual({ok: false, error: 'crank-speed-out-of-range'});
    },
  );
});
