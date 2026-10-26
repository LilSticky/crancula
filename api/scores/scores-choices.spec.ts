/*
 * Expected API of api/scores/scores-choices.ts (T015, data-model.md "Prefill"), as these tests use it:
 *
 *   prefilledScoresChoices(organ: Organ, song: Song | undefined, rememberedSplitNotes: readonly MidiNoteNumber[] | undefined): ScoresChoicesInput
 *
 *   ScoresChoicesInput: what the export dialog holds before it is valid (numbers or null, never stored):
 *     timeSignature: 'song' | {beats: number | null; beatType: number | null}
 *     upbeat: {count: number | null; noteValue: number | null}   // noteValue is the denominator: 4 is a quarter
 *     splitNotes: readonly MidiNoteNumber[]
 *   An upbeat of none is count 0. The shape of the input is the implementer's to refine (T015); these tests
 *   read only the three fields above.
 */
import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {organId, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {note, part, song, songId, tick, ticksPerQuarter, type BeatType, type Part, type Song, type TimeSignature} from '../song/song';
import {referenceOrgan} from '../tape/tape-fixture';
import {prefilledScoresChoices} from './scores-choices';

const QUARTER = 480;
const SONG_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const ORGAN_ID = '7d1f3a52-6c4e-4b8a-9f01-2e3d4c5b6a79';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function midi(values: readonly number[]): MidiNoteNumber[] {
  return values.map((value) => defined(midiNoteNumber(value), `note ${value}`));
}

/** An Organ with one Pipe for each of the notes given, on a 100 mm Tape Bed. */
function organWithPipes(notes: readonly number[]): Organ {
  const result = validateOrgan({
    id: defined(organId(ORGAN_ID), 'organ id'),
    name: 'Test organ',
    tapeBed: {tapeWidth: 100, holeDiameter: 3, rowSpacing: 4},
    minimumGap: 2,
    leadIn: 50,
    slowestCrankSpeed: 30,
    fastestCrankSpeed: 120,
    tapePerCrankTurn: null,
    pipes: notes.map((value) => ({note: value})),
  });
  if (!result.ok) throw new Error(`invalid Organ fixture: ${JSON.stringify(result.error)}`);
  return result.value;
}

function aPart(): Part {
  const aNote = defined(
    note({
      noteNumber: defined(midiNoteNumber(60), 'note number'),
      start: defined(tick(0), 'start'),
      duration: defined(tick(QUARTER), 'duration'),
    }),
    'note',
  );
  return defined(part({name: 'Melody', percussion: false, notes: [aNote]}), 'part');
}

function songWith(fields: { readonly timeSignatures?: readonly TimeSignature[]; readonly upbeat?: number }): Song {
  return defined(
    song({
      id: defined(songId(SONG_ID), 'song id'),
      name: 'Fugue',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
      parts: [aPart()],
      timeSignatures: fields.timeSignatures,
      upbeat: fields.upbeat === undefined ? undefined : defined(tick(fields.upbeat), 'upbeat'),
    }),
    'song',
  );
}

function timeAt(beats: number, beatType: BeatType): TimeSignature {
  return {start: defined(tick(0), 'start'), beats, beatType};
}

const FOUR_FOUR = {beats: 4, beatType: 4};

describe('prefilledScoresChoices takes the Time signature and upbeat from the Song (FR-004)', () => {
  it("gives 'song' and the upbeat of a quarter as 1 × 1/4 for a Song in 3/4 with that upbeat", () => {
    const of = songWith({timeSignatures: [timeAt(3, 4)], upbeat: QUARTER});

    const choices = prefilledScoresChoices(referenceOrgan(), of, undefined);

    expect(choices.timeSignature).toBe('song');
    expect(choices.upbeat).toEqual({count: 1, noteValue: 4});
  });

  it('gives 4/4 and no upbeat for a Song without Time signatures', () => {
    const choices = prefilledScoresChoices(referenceOrgan(), songWith({}), undefined);

    expect(choices.timeSignature).toEqual(FOUR_FOUR);
    expect(choices.upbeat.count).toBe(0);
  });

  it('gives 4/4 and no upbeat for a Song whose Bars are not whole Columns (3/64)', () => {
    const of = songWith({timeSignatures: [timeAt(3, 64)]});

    const choices = prefilledScoresChoices(referenceOrgan(), of, undefined);

    expect(choices.timeSignature).toEqual(FOUR_FOUR);
    expect(choices.upbeat.count).toBe(0);
  });

  it('gives 4/4 and no upbeat without a Song', () => {
    const choices = prefilledScoresChoices(referenceOrgan(), undefined, undefined);

    expect(choices.timeSignature).toEqual(FOUR_FOUR);
    expect(choices.upbeat.count).toBe(0);
  });
});

describe('prefilledScoresChoices prefills the split notes (FR-005)', () => {
  it('splits at C4 when the Organ has Pipes below 60 and at or above it', () => {
    const choices = prefilledScoresChoices(organWithPipes([48, 60]), undefined, undefined);

    expect(choices.splitNotes).toEqual(midi([60]));
  });

  it('splits nowhere when every Pipe is at or above 60', () => {
    const choices = prefilledScoresChoices(organWithPipes([60, 62]), undefined, undefined);

    expect(choices.splitNotes).toEqual([]);
  });

  it('splits nowhere when every Pipe is below 60', () => {
    const choices = prefilledScoresChoices(organWithPipes([48, 50]), undefined, undefined);

    expect(choices.splitNotes).toEqual([]);
  });

  it('keeps the split notes remembered for the Organ instead of C4', () => {
    const choices = prefilledScoresChoices(organWithPipes([48, 60]), undefined, midi([55, 70]));

    expect(choices.splitNotes).toEqual(midi([55, 70]));
  });

  it('keeps no split note when none was remembered, even with Pipes on both sides of 60', () => {
    const choices = prefilledScoresChoices(organWithPipes([48, 60]), undefined, []);

    expect(choices.splitNotes).toEqual([]);
  });
});
