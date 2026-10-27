import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {millimetres} from '../organ/organ';
import {referenceOrgan, tapeOf} from '../tape/tape-fixture';
import {columnCount, tapeId, transposition, type Tape} from '../tape/tape';
import {
  note,
  part,
  partIndex,
  song,
  songId,
  tick,
  ticksPerQuarter,
  type BeatType,
  type Fifths,
  type Key,
  type Mode,
  type Part,
  type Song,
  type TimeSignature,
} from '../song/song';
import {scoresBars, songKeepsBarsOnColumns} from './scores-bars';
import type {ScoresChoices} from './scores-choices';

const QUARTER = 480;
const SONG_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

/** A Tape of the given length with no Holes, on the reference Organ; with the given Song when there is one. */
function tapeOfLength(length: number, of?: Song): Tape {
  const organ = referenceOrgan();
  return tapeOf({
    id: defined(tapeId('00000000-0000-4000-8000-0000000000bb'), 'tape id'),
    name: 'Bars',
    organId: organ.id,
    songId: of?.id,
    selectedParts: of === undefined ? undefined : [defined(partIndex(0, 1), 'part index')],
    transposition: defined(transposition(0), 'transposition'),
    columnLength: defined(millimetres(3), 'column length'),
    length: defined(columnCount(length), `length ${length}`),
    holes: [],
  });
}

function at(ticks: number) {
  return defined(tick(ticks), `tick ${ticks}`);
}

function aPart(): Part {
  const aNote = defined(
    note({
      noteNumber: defined(midiNoteNumber(60), 'note number'),
      start: at(0),
      duration: at(QUARTER),
    }),
    'note',
  );
  return defined(part({name: 'Melody', percussion: false, notes: [aNote]}), 'part');
}

/** A Song of one Part at 480 Ticks per quarter (60 Ticks per Column), with the given metre and Keys. */
function songWith(fields: {
  readonly timeSignatures?: readonly TimeSignature[];
  readonly upbeat?: number;
  readonly keys?: readonly Key[];
}): Song {
  return defined(
    song({
      id: defined(songId(SONG_ID), 'song id'),
      name: 'Fugue',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
      parts: [aPart()],
      timeSignatures: fields.timeSignatures,
      upbeat: fields.upbeat === undefined ? undefined : at(fields.upbeat),
      keys: fields.keys,
    }),
    'song',
  );
}

function timeAt(start: number, beats: number, beatType: BeatType): TimeSignature {
  return {start: at(start), beats, beatType};
}

function keyAt(start: number, fifths: Fifths, mode: Mode = 'major'): Key {
  return {start: at(start), fifths, mode};
}

const SONG_CHOICES: ScoresChoices = {timeSignature: 'song', upbeat: 0, splitNotes: []};

describe('scoresBars with one chosen Time signature', () => {
  it('lays 4/4 Bars of 32 Columns from Column 0 over 70 Columns, the last one full', () => {
    const choices: ScoresChoices = {timeSignature: {beats: 4, beatType: 4}, upbeat: 0, splitNotes: []};

    const bars = scoresBars(tapeOfLength(70), undefined, choices).map(({start, length}) => ({start, length}));

    expect(bars).toEqual([
      {start: 0, length: 32},
      {start: 32, length: 32},
      {start: 64, length: 32},
    ]);
  });

  it('starts with an upbeat of 4 Columns in 6/8, then Bars of 24 Columns numbered 0, 1, 2 and 3', () => {
    const choices: ScoresChoices = {timeSignature: {beats: 6, beatType: 8}, upbeat: 4, splitNotes: []};

    const bars = scoresBars(tapeOfLength(60), undefined, choices).map(({number, start, length}) => ({number, start, length}));

    expect(bars).toEqual([
      {number: 0, start: 0, length: 4},
      {number: 1, start: 4, length: 24},
      {number: 2, start: 28, length: 24},
      {number: 3, start: 52, length: 24},
    ]);
  });

  it('numbers the first Bar 1 when there is no upbeat (only the upbeat is Bar 0)', () => {
    const choices: ScoresChoices = {timeSignature: {beats: 4, beatType: 4}, upbeat: 0, splitNotes: []};

    const numbers = scoresBars(tapeOfLength(70), undefined, choices).map(({number}) => number);

    expect(numbers).toEqual([1, 2, 3]);
  });
});

describe("scoresBars with the Song's Time signatures (Story 1.3, 1.4, research R3)", () => {
  it('lays the upbeat of a quarter as Bar 0 of 8 Columns, then 3/4 Bars of 24 Columns', () => {
    const of = songWith({timeSignatures: [timeAt(0, 3, 4)], upbeat: QUARTER});

    const bars = scoresBars(tapeOfLength(56, of), of, {...SONG_CHOICES, upbeat: 8}).map(({number, start, length}) => ({
      number,
      start,
      length,
    }));

    expect(bars).toEqual([
      {number: 0, start: 0, length: 8},
      {number: 1, start: 8, length: 24},
      {number: 2, start: 32, length: 24},
    ]);
  });

  it('lays two 4/4 Bars and then 3/4 from Column 64, the Column of Tick 3840', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4), timeAt(3840, 3, 4)]});

    const bars = scoresBars(tapeOfLength(88, of), of, SONG_CHOICES).map(({start, length, timeSignature}) => ({
      start,
      length,
      timeSignature,
    }));

    expect(bars).toEqual([
      {start: 0, length: 32, timeSignature: {beats: 4, beatType: 4}},
      {start: 32, length: 32, timeSignature: {beats: 4, beatType: 4}},
      {start: 64, length: 24, timeSignature: {beats: 3, beatType: 4}},
    ]);
  });

  it('ends a Bar short at a change inside it', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4), timeAt(1200, 3, 4)]});

    const bars = scoresBars(tapeOfLength(44, of), of, SONG_CHOICES).map(({start, length, timeSignature}) => ({
      start,
      length,
      timeSignature,
    }));

    expect(bars).toEqual([
      {start: 0, length: 20, timeSignature: {beats: 4, beatType: 4}},
      {start: 20, length: 24, timeSignature: {beats: 3, beatType: 4}},
    ]);
  });

  it('takes the later of two Time signatures on one Column', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4), timeAt(1920, 3, 4), timeAt(1930, 6, 8)]});

    const bars = scoresBars(tapeOfLength(60, of), of, SONG_CHOICES).map(({start, length, timeSignature}) => ({
      start,
      length,
      timeSignature,
    }));

    expect(bars).toEqual([
      {start: 0, length: 32, timeSignature: {beats: 4, beatType: 4}},
      {start: 32, length: 24, timeSignature: {beats: 6, beatType: 8}},
      {start: 56, length: 24, timeSignature: {beats: 6, beatType: 8}},
    ]);
  });

  it('lays 4/4 before a first Time signature after Tick 0', () => {
    const of = songWith({timeSignatures: [timeAt(960, 3, 4)]});

    const bars = scoresBars(tapeOfLength(40, of), of, SONG_CHOICES).map(({start, length, timeSignature}) => ({
      start,
      length,
      timeSignature,
    }));

    expect(bars).toEqual([
      {start: 0, length: 16, timeSignature: {beats: 4, beatType: 4}},
      {start: 16, length: 24, timeSignature: {beats: 3, beatType: 4}},
    ]);
  });

  it('puts a Tick between Columns on the Column columnOfTick gives (Tick 1000 is Column 17)', () => {
    const of = songWith({timeSignatures: [timeAt(1000, 3, 4)]});

    const bars = scoresBars(tapeOfLength(50, of), of, SONG_CHOICES).map(({start, length}) => ({start, length}));

    expect(bars).toEqual([
      {start: 0, length: 17},
      {start: 17, length: 24},
      {start: 41, length: 24},
    ]);
  });

  it('keeps the Song\'s Bars on Columns for 3/4', () => {
    expect(songKeepsBarsOnColumns(songWith({timeSignatures: [timeAt(0, 3, 4)]}))).toBe(true);
  });

  it('does not keep the Song\'s Bars on Columns for 3/64, whose Bar is 1.5 Columns', () => {
    expect(songKeepsBarsOnColumns(songWith({timeSignatures: [timeAt(0, 3, 64)]}))).toBe(false);
  });
});

describe('scoresBars gives every Bar its Key (FR-014, research R4)', () => {
  it('gives every Bar the Key G major of a Song that starts in G major', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4)], keys: [keyAt(0, 1)]});

    const bars = scoresBars(tapeOfLength(70, of), of, SONG_CHOICES).map(({key}) => key);

    expect(bars).toEqual([
      {fifths: 1, mode: 'major'},
      {fifths: 1, mode: 'major'},
      {fifths: 1, mode: 'major'},
    ]);
  });

  it('applies a Key change from the start of the Bar that holds its Column', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4)], keys: [keyAt(0, 0), keyAt(2400, 1)]});

    const bars = scoresBars(tapeOfLength(64, of), of, SONG_CHOICES).map(({key}) => key);

    expect(bars).toEqual([
      {fifths: 0, mode: 'major'},
      {fifths: 1, mode: 'major'},
    ]);
  });

  it('takes the later of two Keys in one Bar', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4)], keys: [keyAt(0, 0), keyAt(1980, 2), keyAt(2400, 1)]});

    const bars = scoresBars(tapeOfLength(64, of), of, SONG_CHOICES).map(({key}) => key);

    expect(bars).toEqual([
      {fifths: 0, mode: 'major'},
      {fifths: 1, mode: 'major'},
    ]);
  });

  it('is C major for a Tape without a Song', () => {
    const choices: ScoresChoices = {timeSignature: {beats: 4, beatType: 4}, upbeat: 0, splitNotes: []};

    const bars = scoresBars(tapeOfLength(70), undefined, choices).map(({key}) => key);

    expect(bars).toEqual([
      {fifths: 0, mode: 'major'},
      {fifths: 0, mode: 'major'},
      {fifths: 0, mode: 'major'},
    ]);
  });

  it('is C major for a Song without Keys', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4)]});

    const bars = scoresBars(tapeOfLength(70, of), of, SONG_CHOICES).map(({key}) => key);

    expect(bars).toEqual([
      {fifths: 0, mode: 'major'},
      {fifths: 0, mode: 'major'},
      {fifths: 0, mode: 'major'},
    ]);
  });

  it('shows the Time signature on the first Bar and on changes only', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4), timeAt(1920, 3, 4)]});

    const bars = scoresBars(tapeOfLength(80, of), of, SONG_CHOICES).map(({showsTimeSignature}) => showsTimeSignature);

    expect(bars).toEqual([true, true, false]);
  });

  it('shows the Key on the first Bar and on a change only', () => {
    const of = songWith({timeSignatures: [timeAt(0, 4, 4)], keys: [keyAt(0, 1), keyAt(3360, 3)]});

    const bars = scoresBars(tapeOfLength(96, of), of, SONG_CHOICES).map(({showsKey}) => showsKey);

    expect(bars).toEqual([true, true, false]);
  });
});
