/*
 * Expected API of api/song/song-metre.ts (T046, data-model.md "SongMetre"):
 *
 *   songMetre(song: Song): SongMetre
 *   SongMetre { timeSignature?: {beats: number; beatType: BeatType}; key?: {fifths: number; mode: Mode};
 *               upbeat?: {numerator: number; denominator: number} }
 *     timeSignature: the first Time signature of the Song, without its start; key: the first Key, without its
 *     start; upbeat: the upbeat as a fraction of a whole note in lowest terms (1 quarter → 1/4).
 *     A field is absent (not undefined) when the Song keeps none of that.
 */
import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {note, part, song, songId, tick, ticksPerQuarter, type Key, type Part, type Song, type TimeSignature} from './song';
import {songMetre} from './song-metre';

const UUID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const QUARTER = 480;

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
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

function songWith(fields: {
  readonly timeSignatures?: readonly TimeSignature[];
  readonly upbeat?: number;
  readonly keys?: readonly Key[];
}): Song {
  return defined(
    song({
      id: defined(songId(UUID), 'id'),
      name: 'Fugue',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
      parts: [aPart()],
      timeSignatures: fields.timeSignatures,
      upbeat: fields.upbeat === undefined ? undefined : defined(tick(fields.upbeat), 'upbeat'),
      keys: fields.keys,
    }),
    'song',
  );
}

const THREE_FOUR: TimeSignature = {start: defined(tick(0), 'start'), beats: 3, beatType: 4};
const TWO_FOUR: TimeSignature = {start: defined(tick(3 * QUARTER), 'start'), beats: 2, beatType: 4};

describe('songMetre gives the first Time signature, the first Key and the upbeat', () => {
  it('gives the first Time signature as its beats and beat type', () => {
    const metre = songMetre(songWith({timeSignatures: [THREE_FOUR, TWO_FOUR]}));

    expect(metre.timeSignature).toEqual({beats: 3, beatType: 4});
  });

  it('gives the first Key as its fifths and mode', () => {
    const metre = songMetre(
      songWith({
        keys: [
          {start: defined(tick(0), 'start'), fifths: 1, mode: 'major'},
          {start: defined(tick(960), 'start'), fifths: 1, mode: 'minor'},
        ],
      }),
    );

    expect(metre.key).toEqual({fifths: 1, mode: 'major'});
  });

  it('gives an upbeat of one quarter as 1/4', () => {
    const metre = songMetre(songWith({timeSignatures: [THREE_FOUR], upbeat: QUARTER}));

    expect(metre.upbeat).toEqual({numerator: 1, denominator: 4});
  });

  it('gives an upbeat of three eighths as 3/8', () => {
    const metre = songMetre(songWith({timeSignatures: [THREE_FOUR], upbeat: (3 * QUARTER) / 2}));

    expect(metre.upbeat).toEqual({numerator: 3, denominator: 8});
  });

  it('reduces the upbeat to its lowest terms: two quarters are 1/2', () => {
    const metre = songMetre(songWith({timeSignatures: [THREE_FOUR], upbeat: 2 * QUARTER}));

    expect(metre.upbeat).toEqual({numerator: 1, denominator: 2});
  });

  it('gives nothing for a Song that keeps no Time signature, upbeat or Key', () => {
    expect(songMetre(songWith({}))).toStrictEqual({});
  });

  it('gives only the parts the Song keeps', () => {
    const metre = songMetre(songWith({keys: [{start: defined(tick(0), 'start'), fifths: -3, mode: 'minor'}]}));

    expect(metre).toStrictEqual({key: {fifths: -3, mode: 'minor'}});
  });
});
