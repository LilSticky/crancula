import {strToU8, zipSync} from 'fflate';
import {describe, expect, it} from 'vitest';
import type {Result} from '../result';
import {readMidiSong} from './midi/read-midi-song';
import {encodeSmf, type SmfTimedEvent, type SmfTrack} from './midi/smf-test-helper';
import {scoreXml, type ScoreSpec} from './musicxml/score-test-helper';
import {readSongSource, type SongReading, type SongRejection} from './read-song-source';
import type {Song} from './song';

const SIXTEEN_MIB = 16 * 1024 * 1024;

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** A format 1 file with one track of one Note; the track is named when `trackName` is given. */
function aMidiFile(trackName?: string): Uint8Array {
  const notes: SmfTimedEvent[] = [
    {delta: 0, event: {type: 'noteOn', channel: 0, note: 60, velocity: 64}},
    {delta: 96, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
  ];
  const events: SmfTimedEvent[] =
    trackName === undefined ? notes : [{delta: 0, event: {type: 'trackName', text: trackName}}, ...notes];
  const tracks: SmfTrack[] = [{events}];
  return encodeSmf({format: 1, division: {ticksPerQuarterNote: 96}, tracks});
}

function readingOf(result: Result<SongReading, SongRejection>): SongReading {
  if (!result.ok) throw new Error(`expected a Song, got ${result.error}`);
  return result.value;
}

function rejectionOf(result: Result<SongReading, SongRejection>): SongRejection {
  if (result.ok) throw new Error('expected a rejection');
  return result.error;
}

describe('readSongSource, by the first bytes of the file', () => {
  it('reads a file starting with MThd as MIDI, with the same Song as readMidiSong', () => {
    const bytes = aMidiFile('Fugue');

    const reading = readingOf(readSongSource(bytes, 'fugue.mid'));
    const expected = readMidiSong(bytes, 'fugue.mid');
    if (!expected.ok) throw new Error('test file is not MIDI');
    const song: Song = reading.song;

    expect(song.name).toBe(expected.value.name);
    expect(song.ticksPerQuarter).toBe(expected.value.ticksPerQuarter);
    expect(song.parts).toEqual(expected.value.parts);
    expect(reading.leftOut).toBeUndefined();
  });

  it('gives the MIDI rejection of a file starting with MThd that is not valid MIDI', () => {
    const bytes = Uint8Array.from([...ascii('MThd'), 0, 0]);
    expect(rejectionOf(readSongSource(bytes, 'broken.mid'))).toBe('not-a-midi-file');
  });

  it('reads a file starting with PK 03 04 as an archive, so a broken archive is damaged-archive', () => {
    const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(rejectionOf(readSongSource(bytes, 'score.mxl'))).toBe('damaged-archive');
  });

  it('rejects a file starting with %PDF as pdf', () => {
    expect(rejectionOf(readSongSource(utf8('%PDF-1.7\n%âãÏÓ\n'), 'score.pdf'))).toBe('pdf');
  });

  it.each([
    ['a BOM and an XML declaration', '﻿<?xml version="1.0"?><score-partwise version="4.0">'],
    ['leading whitespace and no declaration', '  \r\n<score-partwise version="4.0">'],
    ['a bare root element', '<score-partwise'],
  ])('reads XML with %s as MusicXML, so malformed XML is not-a-score', (_, text) => {
    expect(rejectionOf(readSongSource(utf8(text), 'score.musicxml'))).toBe('not-a-score');
  });

  it.each([
    ['plain text', 'hello world'],
    ['a JSON object', '{}'],
    ['an empty file', ''],
  ])('rejects %s as not-a-song-source', (_, text) => {
    expect(rejectionOf(readSongSource(utf8(text), 'notes.txt'))).toBe('not-a-song-source');
  });
});

describe('readSongSource, the size limit', () => {
  it('rejects a file over 16 MiB as too-large before reading it, even when it starts with MThd', () => {
    const bytes = new Uint8Array(SIXTEEN_MIB + 1);
    bytes.set(ascii('MThd'));
    expect(rejectionOf(readSongSource(bytes, 'huge.mid'))).toBe('too-large');
  });

  it('does not reject a file of exactly 16 MiB as too-large', () => {
    expect(rejectionOf(readSongSource(new Uint8Array(SIXTEEN_MIB), 'big.txt'))).toBe('not-a-song-source');
  });
});

describe('readSongSource, the file name', () => {
  it('names a MIDI Song without a track name after the file name without its extension', () => {
    const reading = readingOf(readSongSource(aMidiFile(), 'Bach Invention.mid'));
    expect(reading.song.name).toBe('Bach Invention');
  });

  it('names a MIDI Song by its track name before the file name', () => {
    const reading = readingOf(readSongSource(aMidiFile('Fugue'), 'other.mid'));
    expect(reading.song.name).toBe('Fugue');
  });
});

describe('readSongSource, MusicXML and compressed MusicXML', () => {
  const flute: ScoreSpec = {
    parts: [
      {
        name: 'Flute',
        measures: [
          {
            entries: [
              {kind: 'attributes', divisions: 1},
              {kind: 'note', pitch: {step: 'C', octave: 4}, duration: 1},
            ],
          },
        ],
      },
    ],
  };

  it('reads an uncompressed MusicXML file as a Song, not as not-a-score', () => {
    const reading = readingOf(readSongSource(utf8(scoreXml(flute)), 'flute.musicxml'));
    expect(reading.song.parts.map((part) => part.name)).toEqual(['Flute']);
  });

  it('reads a compressed MusicXML file as the same Song as its uncompressed Score, not as damaged-archive', () => {
    const score = scoreXml(flute);
    const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0"><rootfiles><rootfile full-path="flute.musicxml"/></rootfiles></container>`;
    const archive = zipSync({
      'META-INF/container.xml': strToU8(container),
      'flute.musicxml': strToU8(score),
    });

    const reading = readingOf(readSongSource(archive, 'flute.mxl'));
    const uncompressed = readingOf(readSongSource(utf8(score), 'flute.musicxml'));

    expect(reading.song.name).toBe(uncompressed.song.name);
    expect(reading.song.parts).toEqual(uncompressed.song.parts);
  });
});
