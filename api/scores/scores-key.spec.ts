import {describe, expect, it} from 'vitest';
import {midiNoteNumber} from '../organ/midi-note-number';
import {note, part, song, songId, tick, ticksPerQuarter, type Fifths, type Key, type Mode, type Song} from '../song/song';
import {scoresKeyAt} from './scores-key';

const QUARTER = 480;
const SONG_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function at(ticks: number) {
  return defined(tick(ticks), `tick ${ticks}`);
}

function keyAt(start: number, fifths: Fifths, mode: Mode = 'major'): Key {
  return {start: at(start), fifths, mode};
}

/** A Song at 480 Ticks per quarter (60 Ticks per Column) with the given Keys. */
function songWithKeys(keys: readonly Key[] = []): Song {
  const aNote = defined(
    note({noteNumber: defined(midiNoteNumber(60), 'note number'), start: at(0), duration: at(QUARTER)}),
    'note',
  );
  const melody = defined(part({name: 'Melody', percussion: false, notes: [aNote]}), 'part');
  return defined(
    song({
      id: defined(songId(SONG_ID), 'song id'),
      name: 'Fugue',
      ticksPerQuarter: defined(ticksPerQuarter(QUARTER), 'ticks per quarter'),
      parts: [melody],
      keys,
    }),
    'song',
  );
}

describe('scoresKeyAt gives the Key the Scores carry at a Column (research R4)', () => {
  it('gives C major for a Song without Keys', () => {
    expect(scoresKeyAt(songWithKeys(), 0)).toEqual({fifths: 0, mode: 'major'});
    expect(scoresKeyAt(songWithKeys(), 40)).toEqual({fifths: 0, mode: 'major'});
  });

  it('gives C major for a Tape without a Song', () => {
    expect(scoresKeyAt(undefined, 40)).toEqual({fifths: 0, mode: 'major'});
  });

  it('gives the Key in force at the Column, and a Key applies from its own Column', () => {
    // Tick 2400 is Column 40: G major from there on, D minor from Tick 0 before it.
    const of = songWithKeys([keyAt(0, 2, 'minor'), keyAt(2400, 1)]);

    expect(scoresKeyAt(of, 39)).toEqual({fifths: 2, mode: 'minor'});
    expect(scoresKeyAt(of, 40)).toEqual({fifths: 1, mode: 'major'});
  });
});
