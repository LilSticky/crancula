import {DEFAULT_CRANK_SPEED_RANGE} from '../organ/crank-speed-range';
import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {asValidOrgan, millimetres, organId, type Organ} from '../organ/organ';
import {partIndex, songId} from '../song/song';
import type {HoleRef} from './hole-edits';
import {tapeOf} from './tape-fixture';
import {column, columnCount, tapeId, transposition, validTape, type Hole, type Tape, type Transposition} from './tape';
import {transposeHoles, transposeRange, transpositionWithin, type HolesToTranspose} from './transpose-holes';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function note(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), 'pipe');
}

function anOrgan(pipeNotes: readonly number[]): Organ {
  const one = defined(millimetres(1), 'millimetres');
  return asValidOrgan({
    id: defined(organId('3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f'), 'organ id'),
    name: 'Organ',
    tapeBed: {tapeWidth: one, holeDiameter: one, rowSpacing: one},
    minimumGap: one,
    leadIn: one,
    crankSpeedRange: DEFAULT_CRANK_SPEED_RANGE,
    pipes: pipeNotes.map((each) => ({note: note(each)})),
  });
}

function semitones(value: number): Transposition {
  return defined(transposition(value), 'transposition');
}

/** A Hole by Pipe note, start Column and length in Columns. */
function hole(pipe: number, start: number, length: number): Hole {
  return {
    pipe: note(pipe),
    start: defined(column(start), 'column'),
    length: defined(columnCount(length), 'length'),
  };
}

function ref(pipe: number, start: number): HoleRef {
  return {pipe: note(pipe), start: defined(column(start), 'column')};
}

function aTape(holes: readonly Hole[], length = 100): Tape {
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-000000000001'), 'tape id'),
    name: 'Melody',
    organId: defined(organId('00000000-0000-4000-8000-000000000002'), 'organ id'),
    songId: defined(songId('00000000-0000-4000-8000-000000000003'), 'song id'),
    selectedParts: [defined(partIndex(1, 3), 'part')],
    transposition: semitones(2),
    columnLength: defined(millimetres(2.5), 'column length'),
    length: defined(columnCount(length), 'length'),
    holes,
  });
}

const all: HolesToTranspose = {kind: 'all'};

function these(...holes: readonly HoleRef[]): HolesToTranspose {
  return {kind: 'these', holes};
}

describe('transposeHoles', () => {
  describe('target Pipe on the Organ', () => {
    it('moves the Hole to the Pipe with the same Columns', () => {
      const organ = anOrgan([60, 62, 64]);
      const tape = aTape([hole(60, 10, 4)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, all, semitones(2));

      expect(result.holes).toEqual([hole(62, 10, 4)]);
      expect(outcome.fates).toEqual([{kind: 'moved', from: hole(60, 10, 4), to: hole(62, 10, 4)}]);
    });

    it('moves down with negative semitones', () => {
      const organ = anOrgan([60, 62, 64]);

      const {outcome} = transposeHoles(aTape([hole(64, 10, 4)]), organ, all, semitones(-2));

      expect(outcome.fates).toEqual([{kind: 'moved', from: hole(64, 10, 4), to: hole(62, 10, 4)}]);
    });
  });

  describe('target Pipe not on the Organ', () => {
    it('moves by octaves to the nearest Pipe of the note name', () => {
      const organ = anOrgan([60, 96]);

      const {tape, outcome} = transposeHoles(aTape([hole(60, 10, 4)]), organ, all, semitones(12));

      expect(outcome.fates).toEqual([{kind: 'moved-by-octaves', from: hole(60, 10, 4), to: hole(60, 10, 4)}]);
      expect(tape.holes).toEqual([hole(60, 10, 4)]);
    });

    it('moves upward on a tie between octaves', () => {
      const organ = anOrgan([60, 84]);

      const {tape, outcome} = transposeHoles(aTape([hole(60, 10, 4)]), organ, all, semitones(12));

      expect(outcome.fates).toEqual([{kind: 'moved-by-octaves', from: hole(60, 10, 4), to: hole(84, 10, 4)}]);
      expect(tape.holes).toEqual([hole(84, 10, 4)]);
    });

    it('removes the Hole when no Pipe has its note name', () => {
      const organ = anOrgan([60, 62]);

      const {tape, outcome} = transposeHoles(aTape([hole(60, 10, 4)]), organ, all, semitones(1));

      expect(outcome.fates).toEqual([{kind: 'removed', from: hole(60, 10, 4)}]);
      expect(tape.holes).toEqual([]);
      expect(outcome.resulting).toEqual([]);
    });

    it('removes the Hole when the target is above 127', () => {
      const organ = anOrgan([60, 127]);

      const {tape, outcome} = transposeHoles(aTape([hole(127, 10, 4)]), organ, all, semitones(1));

      expect(outcome.fates).toEqual([{kind: 'removed', from: hole(127, 10, 4)}]);
      expect(tape.holes).toEqual([]);
    });

    it('removes the Hole when the target is below 0', () => {
      const organ = anOrgan([0, 60]);

      const {outcome} = transposeHoles(aTape([hole(0, 10, 4)]), organ, all, semitones(-1));

      expect(outcome.fates).toEqual([{kind: 'removed', from: hole(0, 10, 4)}]);
    });
  });

  describe('which Holes', () => {
    it('leaves Holes that were not chosen unchanged', () => {
      const organ = anOrgan([60, 62, 64]);
      const tape = aTape([hole(60, 10, 4), hole(60, 30, 4), hole(64, 5, 2)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, these(ref(60, 30)), semitones(2));

      expect(result.holes).toEqual([hole(62, 30, 4), hole(60, 10, 4), hole(64, 5, 2)].sort(byPipeThenStart));
      expect(outcome.fates).toEqual([{kind: 'moved', from: hole(60, 30, 4), to: hole(62, 30, 4)}]);
    });

    it('ignores references to Holes that do not exist', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 10, 4)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, these(ref(60, 11), ref(62, 10)), semitones(2));

      expect(result.holes).toEqual(tape.holes);
      expect(outcome.fates).toEqual([]);
      expect(outcome.merges).toEqual([]);
      expect(outcome.resulting).toEqual([]);
    });

    it('lists the fates in Tape order', () => {
      const organ = anOrgan([60, 62, 64]);
      const tape = aTape([hole(60, 30, 2), hole(60, 10, 2), hole(62, 5, 2)]);

      const {outcome} = transposeHoles(tape, organ, all, semitones(2));

      expect(outcome.fates.map((fate) => fate.from)).toEqual(tape.holes);
    });
  });

  describe('merging', () => {
    it('joins overlapping Holes on one Pipe from the earliest start to the latest end', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 9, 4), hole(62, 11, 4)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, these(ref(62, 11)), semitones(-2));

      expect(result.holes).toEqual([hole(60, 9, 6)]);
      expect(outcome.merges).toEqual([{hole: hole(60, 9, 6), from: [hole(60, 9, 4), hole(60, 11, 4)]}]);
      expect(outcome.fates).toEqual([{kind: 'moved', from: hole(62, 11, 4), to: hole(60, 11, 4)}]);
      expect(outcome.resulting).toEqual([ref(60, 9)]);
    });

    it('joins a run of three Holes into one', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 10, 7), hole(62, 12, 2), hole(62, 15, 4)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, these(ref(62, 12), ref(62, 15)), semitones(-2));

      expect(result.holes).toEqual([hole(60, 10, 9)]);
      expect(outcome.merges).toEqual([
        {hole: hole(60, 10, 9), from: [hole(60, 10, 7), hole(60, 12, 2), hole(60, 15, 4)]},
      ]);
    });

    it('does not join touching Holes', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 9, 4), hole(62, 13, 4)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, these(ref(62, 13)), semitones(-2));

      expect(result.holes).toEqual([hole(60, 9, 4), hole(60, 13, 4)]);
      expect(outcome.merges).toEqual([]);
      expect(outcome.resulting).toEqual([ref(60, 13)]);
    });

    it('keeps the moved fate of a Hole that was merged', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 9, 4), hole(62, 11, 4)]);

      const {outcome} = transposeHoles(tape, organ, these(ref(62, 11)), semitones(-2));

      expect(outcome.fates).toHaveLength(1);
      expect(outcome.fates[0].kind).toBe('moved');
    });
  });

  describe('Holes without a Pipe on the Organ', () => {
    it('leaves them unchanged and counts them as left out for all Holes', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 10, 4), hole(65, 20, 4)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, all, semitones(2));

      expect(result.holes).toEqual([hole(62, 10, 4), hole(65, 20, 4)]);
      expect(outcome.leftOut).toBe(1);
      expect(outcome.fates).toHaveLength(1);
    });

    it('does not count them for named Holes and leaves a named one unchanged', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 10, 4), hole(65, 20, 4)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, these(ref(65, 20)), semitones(2));

      expect(result.holes).toEqual(tape.holes);
      expect(outcome.leftOut).toBe(0);
      expect(outcome.fates).toEqual([]);
    });
  });

  describe('the new Tape', () => {
    it('keeps every field but the Holes and passes validTape', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 10, 4)]);

      const {tape: result} = transposeHoles(tape, organ, all, semitones(2));

      expect({...result, holes: tape.holes}).toEqual(tape);
      expect(validTape({...result}).ok).toBe(true);
    });

    it('returns the Tape unchanged for 0 semitones, every fate moved to itself', () => {
      const organ = anOrgan([60, 62]);
      const tape = aTape([hole(60, 10, 4), hole(62, 20, 4)]);

      const {tape: result, outcome} = transposeHoles(tape, organ, all, semitones(0));

      expect(result).toEqual(tape);
      expect(outcome.fates).toEqual(tape.holes.map((each) => ({kind: 'moved', from: each, to: each})));
      expect(outcome.merges).toEqual([]);
    });

    it('names every resulting Hole of a transposed Hole, and only those', () => {
      const organ = anOrgan([60, 62, 64]);
      const tape = aTape([hole(60, 10, 4), hole(64, 5, 2)]);

      const {outcome} = transposeHoles(tape, organ, these(ref(60, 10)), semitones(2));

      expect(outcome.resulting).toEqual([ref(62, 10)]);
    });
  });

  it('transposes 1,000 Holes in under 50 ms', () => {
    const notes = Array.from({length: 40}, (_, index) => 40 + index);
    const organ = anOrgan(notes);
    const holes = notes.flatMap((pipe) => Array.from({length: 25}, (_, index) => hole(pipe, index * 8, 4)));
    const tape = aTape(holes, 300);

    const started = performance.now();
    const {tape: result} = transposeHoles(tape, organ, all, semitones(1));
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(50);
    expect(validTape({...result}).ok).toBe(true);
  });
});

function byPipeThenStart(a: Hole, b: Hole): number {
  return a.pipe - b.pipe || a.start - b.start;
}

describe('transposeRange', () => {
  it('reaches every Pipe from every other: plus and minus the span from lowest to highest Pipe note', () => {
    expect(transposeRange(anOrgan([60, 64, 76]))).toEqual({lowest: -16, highest: 16});
  });

  it('is zero for an Organ with one Pipe', () => {
    expect(transposeRange(anOrgan([60]))).toEqual({lowest: 0, highest: 0});
  });

  it('is at most plus and minus 127', () => {
    expect(transposeRange(anOrgan([0, 127]))).toEqual({lowest: -127, highest: 127});
  });
});

describe('transpositionWithin', () => {
  const organ = anOrgan([60, 64, 76]);

  it('gives the amount when it lies inside the range of the Organ, ends included', () => {
    expect(transpositionWithin(organ, -16)).toBe(-16);
    expect(transpositionWithin(organ, 0)).toBe(0);
    expect(transpositionWithin(organ, 16)).toBe(16);
  });

  it('gives nothing outside the range or for a fraction', () => {
    expect(transpositionWithin(organ, 17)).toBeUndefined();
    expect(transpositionWithin(organ, -17)).toBeUndefined();
    expect(transpositionWithin(organ, 1.5)).toBeUndefined();
  });
});
