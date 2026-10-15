import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {asValidOrgan, millimetres, organId, type Organ} from '../organ/organ';
import {
  newSongId,
  note,
  part,
  partIndex,
  song,
  tick,
  ticksPerQuarter,
  type Part,
  type PartIndex,
  type Song,
} from '../song/song';
import {allowedTranspositions, proposeTransposition} from './transposition';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function aPart(noteNumbers: readonly number[]): Part {
  const notes = noteNumbers
    .map((noteNumber, index) =>
      defined(
        note({
          noteNumber: defined(midiNoteNumber(noteNumber), 'note number'),
          start: defined(tick(index * 480), 'start'),
          duration: defined(tick(480), 'duration'),
        }),
        'note',
      ),
    )
    .sort((a, b) => a.start - b.start || a.noteNumber - b.noteNumber);
  return defined(part({name: undefined, percussion: false, notes}), 'part');
}

function aSong(...parts: readonly Part[]): Song {
  return defined(
    song({
      id: newSongId(),
      name: 'Fugue',
      ticksPerQuarter: defined(ticksPerQuarter(480), 'ticks per quarter'),
      parts,
    }),
    'song',
  );
}

function anOrgan(pipeNotes: readonly number[]): Organ {
  const one = defined(millimetres(1), 'millimetres');
  return asValidOrgan({
    id: defined(organId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f'), 'organ id'),
    name: 'Organ',
    tapeBed: {tapeWidth: one, holeDiameter: one, rowSpacing: one},
    minimumGap: one,
    pipes: pipeNotes.map((each) => ({note: defined(midiNoteNumber(each), 'pipe')})),
  });
}

function range(from: number, to: number): number[] {
  return Array.from({length: to - from + 1}, (_, index) => from + index);
}

function parts(...indexes: readonly number[]): ReadonlySet<PartIndex> {
  return new Set(indexes.map((index) => defined(partIndex(index, 10), 'part index')));
}

describe('allowedTranspositions', () => {
  it('keeps every selected Note within 0 to 127', () => {
    expect(allowedTranspositions(aSong(aPart([10, 100])), parts(0))).toEqual({
      lowest: -10,
      highest: 27,
    });
  });

  it('allows only 0 upward when the highest selected Note is G9', () => {
    expect(allowedTranspositions(aSong(aPart([60, 127])), parts(0)).highest).toBe(0);
  });

  it('ignores unselected Parts', () => {
    const result = allowedTranspositions(aSong(aPart([60, 72]), aPart([0, 127])), parts(0));
    expect(result).toEqual({lowest: -60, highest: 55});
  });
});

describe('proposeTransposition', () => {
  it('proposes +12 for Pipes C4 to C6 and a melody from C3 to C5', () => {
    const melody = aSong(aPart([48, 55, 60, 67, 72]));
    expect(proposeTransposition(melody, parts(0), anOrgan(range(60, 84)))).toBe(12);
  });

  it('proposes 0 when every Note matches a Pipe', () => {
    const matching = aSong(aPart([60, 64, 67, 72]));
    expect(proposeTransposition(matching, parts(0), anOrgan(range(60, 84)))).toBe(0);
  });

  it('prefers upward on a tie of equal distance: -6 and +6 give +6', () => {
    expect(proposeTransposition(aSong(aPart([60])), parts(0), anOrgan([54, 66]))).toBe(6);
  });

  it('prefers fewer semitones on a tie: +2 over -5', () => {
    expect(proposeTransposition(aSong(aPart([60])), parts(0), anOrgan([55, 62]))).toBe(2);
  });

  it('counts only Notes that match a Pipe directly, not octave moves', () => {
    // At 0 both C5 would move to C4 by an octave, which would tie with -12 and win by order
    expect(proposeTransposition(aSong(aPart([72, 72, 61])), parts(0), anOrgan([60]))).toBe(-12);
  });

  it('counts only the selected Parts', () => {
    const twoParts = aSong(aPart([60]), aPart([72, 72, 72]));
    expect(proposeTransposition(twoParts, parts(0), anOrgan([72]))).toBe(12);
    expect(proposeTransposition(twoParts, parts(1), anOrgan([72]))).toBe(0);
  });
});
