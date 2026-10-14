import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {note, tick, ticksPerQuarter, type Note, type TicksPerQuarter} from '../song/song';
import {columnOfTick, quantiseNote} from './quantisation';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function aNote(start: number, duration: number): Note {
  return defined(
    note({
      noteNumber: defined(midiNoteNumber(60), 'note number'),
      start: defined(tick(start), 'start'),
      duration: defined(tick(duration), 'duration'),
    }),
    'note',
  );
}

function perQuarter(value: number): TicksPerQuarter {
  return defined(ticksPerQuarter(value), 'ticks per quarter');
}

describe('columnOfTick', () => {
  it.each([
    [29, 0],
    [30, 1],
    [31, 1],
  ])('puts Tick %i at Column %i with 480 Ticks per quarter note', (at, expected) => {
    expect(columnOfTick(defined(tick(at), 'tick'), perQuarter(480))).toBe(expected);
  });

  it('is exact for 25 Ticks per quarter note, where one Column is 3.125 Ticks', () => {
    // 1 / 3.125 = 0.32 rounds down; 1.5 / 3.125 = 0.48 rounds down; 1.6 / 3.125 is not an integer
    expect(columnOfTick(defined(tick(1), 'tick'), perQuarter(25))).toBe(0);
    expect(columnOfTick(defined(tick(2), 'tick'), perQuarter(25))).toBe(1);
    expect(columnOfTick(defined(tick(25), 'tick'), perQuarter(25))).toBe(8);
  });

  it('is exact for 100 Ticks per quarter note, where one Column is 12.5 Ticks', () => {
    expect(columnOfTick(defined(tick(6), 'tick'), perQuarter(100))).toBe(0);
    expect(columnOfTick(defined(tick(7), 'tick'), perQuarter(100))).toBe(1);
    expect(columnOfTick(defined(tick(100), 'tick'), perQuarter(100))).toBe(8);
  });
});

describe('quantiseNote', () => {
  const tpq = perQuarter(480);

  it('puts a quarter Note at Tick 480 on Column 8 with length 8', () => {
    expect(quantiseNote(aNote(480, 480), tpq)).toEqual({start: 8, length: 8});
  });

  it('rounds the start and the end separately', () => {
    expect(quantiseNote(aNote(29, 480), tpq)).toEqual({start: 0, length: 8});
    expect(quantiseNote(aNote(30, 480), tpq)).toEqual({start: 1, length: 8});
  });

  it('makes a 1/64 Note one Column long', () => {
    expect(quantiseNote(aNote(0, 30), tpq)).toEqual({start: 0, length: 1});
  });

  it('makes a grace Note of 10 Ticks one Column long', () => {
    expect(quantiseNote(aNote(0, 10), tpq)).toEqual({start: 0, length: 1});
  });

  it('makes a Note of duration 0 one Column long', () => {
    expect(quantiseNote(aNote(480, 0), tpq)).toEqual({start: 8, length: 1});
  });

  it('gives eighth-note triplets the lengths 3, 2, 3', () => {
    const triplets = [aNote(0, 160), aNote(160, 160), aNote(320, 160)];
    expect(triplets.map((each) => quantiseNote(each, tpq))).toEqual([
      {start: 0, length: 3},
      {start: 3, length: 2},
      {start: 5, length: 3},
    ]);
  });

  it('is exact for 25 and 100 Ticks per quarter note', () => {
    expect(quantiseNote(aNote(25, 25), perQuarter(25))).toEqual({start: 8, length: 8});
    expect(quantiseNote(aNote(100, 100), perQuarter(100))).toEqual({start: 8, length: 8});
  });
});
