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
import {fitOf} from './fit';
import {transposition} from './tape';

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

const noShift = defined(transposition(0), 'transposition');

describe('fitOf', () => {
  const organ = anOrgan(range(60, 84).filter((pipe) => pipe % 12 !== 6));

  it('counts Notes that match a Pipe, Notes moved by octaves and Unplayable Notes', () => {
    // C4 is a Pipe, B6 (95) moves to B5, F#4 (66) has no Pipe of its pitch class
    const fit = fitOf(aSong(aPart([60, 95, 66])), parts(0), organ, noShift);
    expect(fit).toEqual({matchingAPipe: 1, movedByOctaves: 1, unplayable: 1});
  });

  it('applies the Transposition before matching', () => {
    // C3 (48) shifted by +12 is C4 (60), a Pipe
    const shift = defined(transposition(12), 'transposition');
    expect(fitOf(aSong(aPart([48])), parts(0), organ, shift)).toEqual({
      matchingAPipe: 1,
      movedByOctaves: 0,
      unplayable: 0,
    });
  });

  it('adds up to the number of selected Notes', () => {
    const fit = fitOf(aSong(aPart([60, 95, 66, 66, 62])), parts(0), organ, noShift);
    expect(fit.matchingAPipe + fit.movedByOctaves + fit.unplayable).toBe(5);
  });

  it('counts a Note shifted outside 0 to 127 as unplayable', () => {
    const up = defined(transposition(20), 'transposition');
    const down = defined(transposition(-10), 'transposition');
    const expected = {matchingAPipe: 0, movedByOctaves: 0, unplayable: 1};
    expect(fitOf(aSong(aPart([120])), parts(0), organ, up)).toEqual(expected);
    expect(fitOf(aSong(aPart([5])), parts(0), organ, down)).toEqual(expected);
  });

  it('ignores Notes of unselected Parts', () => {
    const fit = fitOf(aSong(aPart([60]), aPart([66, 95])), parts(0), organ, noShift);
    expect(fit).toEqual({matchingAPipe: 1, movedByOctaves: 0, unplayable: 0});
  });
});
