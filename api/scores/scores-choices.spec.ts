/*
 * Expected API of api/scores/scores-choices.ts (T015, data-model.md "Prefill"), as these tests use it:
 *
 *   prefilledScoresChoices(organ: Organ, song: Song | undefined, rememberedSplitNotes: readonly MidiNoteNumber[] | undefined): ScoresChoicesInput
 *
 *   ScoresChoicesInput: what the export dialog holds before it is valid (numbers or null, never stored):
 *     timeSignature: 'song' | {beats: number | null; beatType: number | null}
 *     upbeat: {count: number | null; noteValue: number | null}   // noteValue is the denominator: 4 is a quarter
 *     splitNotes: readonly number[]   // raw numbers as the dialog holds them; validateScoresChoices reports
 *                                      // the ones that are not MIDI notes (data-model.md "Choices")
 *   An upbeat of none is count 0. The shape of the input is the implementer's to refine (T015); these tests
 *   read only the three fields above.
 *
 *   validateScoresChoices(input: ScoresChoicesInput, song: Song | undefined): readonly ScoresChoicesViolation[]
 *     with {field: 'splitNotes', code: 'not-distinct' | 'out-of-range'} (T039, data-model.md)
 *   scoresChoicesOf(input: ScoresChoicesInput): ScoresChoices | undefined, its splitNotes sorted ascending
 *   SCORES_BEAT_TYPES: readonly ScoresBeatType[] = [1, 2, 4, 8, 16, 32] (T015, the beat types the dialog offers)
 */
import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {organId, type Organ} from '../organ/organ';
import {validateOrgan} from '../organ/validate-organ';
import {note, part, song, songId, tick, ticksPerQuarter, type BeatType, type Part, type Song, type TimeSignature} from '../song/song';
import {referenceOrgan} from '../tape/tape-fixture';
import {
  prefilledScoresChoices,
  SCORES_BEAT_TYPES,
  scoresChoicesOf,
  validateScoresChoices,
  type ScoresChoicesInput,
} from './scores-choices';

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

describe('SCORES_BEAT_TYPES lists the beat types the export dialog offers (FR-004)', () => {
  it('is 1, 2, 4, 8, 16 and 32', () => {
    expect(SCORES_BEAT_TYPES).toEqual([1, 2, 4, 8, 16, 32]);
  });
});

/** A dialog input in 4/4 without an upbeat, holding the split notes given as the dialog holds them: plain numbers. */
function inputWithSplits(splitNotes: readonly number[]): ScoresChoicesInput {
  return {timeSignature: {beats: 4, beatType: 4}, upbeat: {count: 0, noteValue: 4}, splitNotes};
}

describe('validateScoresChoices checks the split notes (FR-005, data-model.md)', () => {
  it('gives no violation for distinct split notes given in any order', () => {
    expect(validateScoresChoices(inputWithSplits([72, 48]), undefined)).toEqual([]);
  });

  it('reports two equal split notes as not-distinct', () => {
    expect(validateScoresChoices(inputWithSplits([60, 60]), undefined)).toEqual([
      {field: 'splitNotes', code: 'not-distinct'},
    ]);
  });

  it.each([128, -1])('reports the split note %d, outside 0 to 127, as out-of-range', (value) => {
    expect(validateScoresChoices(inputWithSplits([value]), undefined)).toEqual([
      {field: 'splitNotes', code: 'out-of-range'},
    ]);
  });
});

describe('scoresChoicesOf gives the split notes sorted ascending (data-model.md "ScoresChoices")', () => {
  it('gives the split notes 48 and 72 given as 72 and 48 in ascending order', () => {
    const choices = scoresChoicesOf(inputWithSplits([72, 48]));

    expect(choices?.splitNotes).toEqual(midi([48, 72]));
  });
});

/** A dialog input that is valid as it is: 4/4, no upbeat, no split note. Each test changes the field it is about. */
function choicesInput(fields: Partial<ScoresChoicesInput>): ScoresChoicesInput {
  return {timeSignature: {beats: 4, beatType: 4}, upbeat: {count: 0, noteValue: 4}, splitNotes: [], ...fields};
}

describe('validateScoresChoices checks the Time signature (FR-004, Story 4.3)', () => {
  it('refuses a beat count of 0 as out of range', () => {
    expect(validateScoresChoices(choicesInput({timeSignature: {beats: 0, beatType: 4}}), undefined)).toEqual([
      {field: 'beats', code: 'out-of-range'},
    ]);
  });

  it('refuses a beat count of 2.5 as not whole', () => {
    expect(validateScoresChoices(choicesInput({timeSignature: {beats: 2.5, beatType: 4}}), undefined)).toEqual([
      {field: 'beats', code: 'not-whole'},
    ]);
  });

  it('refuses a beat count of 100 as out of range', () => {
    expect(validateScoresChoices(choicesInput({timeSignature: {beats: 100, beatType: 4}}), undefined)).toEqual([
      {field: 'beats', code: 'out-of-range'},
    ]);
  });

  it.each([64, 3])('refuses the beat type %d, which the dialog does not offer', (beatType) => {
    expect(validateScoresChoices(choicesInput({timeSignature: {beats: 4, beatType}}), undefined)).toEqual([
      {field: 'beatType', code: 'not-offered'},
    ]);
  });

  it("refuses the Song's Time signatures when the Song does not keep its Bars on Columns (3/64)", () => {
    const of = songWith({timeSignatures: [timeAt(3, 64)]});

    expect(validateScoresChoices(choicesInput({timeSignature: 'song'}), of)).toHaveLength(1);
  });
});

describe('validateScoresChoices checks the upbeat (FR-004, Story 4.3)', () => {
  it('refuses a negative upbeat count as negative', () => {
    expect(validateScoresChoices(choicesInput({upbeat: {count: -1, noteValue: 4}}), undefined)).toEqual([
      {field: 'upbeat', code: 'negative'},
    ]);
  });

  it('refuses an upbeat count that is not whole as not whole', () => {
    expect(validateScoresChoices(choicesInput({upbeat: {count: 1.5, noteValue: 4}}), undefined)).toEqual([
      {field: 'upbeat', code: 'not-whole'},
    ]);
  });

  it('refuses an upbeat as long as the first Bar (1 whole note in 4/4) as not shorter than the Bar', () => {
    expect(validateScoresChoices(choicesInput({upbeat: {count: 1, noteValue: 1}}), undefined)).toEqual([
      {field: 'upbeat', code: 'not-shorter-than-bar'},
    ]);
  });

  it('refuses an upbeat as long as a 6/8 Bar (6 eighths) as not shorter than the Bar', () => {
    const input = choicesInput({timeSignature: {beats: 6, beatType: 8}, upbeat: {count: 6, noteValue: 8}});

    expect(validateScoresChoices(input, undefined)).toEqual([{field: 'upbeat', code: 'not-shorter-than-bar'}]);
  });

  it('accepts an upbeat of one eighth in 6/8 as 4 Columns', () => {
    const input = choicesInput({timeSignature: {beats: 6, beatType: 8}, upbeat: {count: 1, noteValue: 8}});

    expect(validateScoresChoices(input, undefined)).toEqual([]);
    expect(scoresChoicesOf(input)?.upbeat).toBe(4);
  });
});
