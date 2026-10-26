import {describe, expect, it} from 'vitest';
import {MAXIMUM_MIDI_FILE_SIZE, readMidiSong} from './read-midi-song';
import type {Song} from '../song';
import {encodeSmf, type SmfEvent, type SmfSpec, type SmfTimedEvent, type SmfTrack} from './smf-test-helper';

const FILE_NAME = 'tune.mid';

const conductorTrack: SmfTrack = {
  events: [{delta: 0, event: {type: 'tempo', microsecondsPerQuarterNote: 500_000}}],
};

const melodyTrack: SmfTrack = {
  events: [
    {delta: 0, event: {type: 'noteOn', channel: 0, note: 60, velocity: 64}},
    {delta: 96, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
  ],
};

const validSpec: SmfSpec = {
  format: 1,
  division: {ticksPerQuarterNote: 96},
  tracks: [conductorTrack, melodyTrack],
};

function ascii(text: string): number[] {
  return Array.from(text, (character) => character.charCodeAt(0));
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, body: readonly number[]): number[] {
  return [...ascii(type), ...uint32(body.length), ...body];
}

/** A format 0 file with one hand-written track body, to reach malformed encodings. */
function rawFile(trackBody: readonly number[], ...before: readonly number[][]): Uint8Array {
  return Uint8Array.from([
    ...chunk('MThd', [0, 0, 0, 1, 0, 96]),
    ...before.flat(),
    ...chunk('MTrk', [...trackBody, 0x00, 0xff, 0x2f, 0x00]),
  ]);
}

const NOTE_ON_AND_OFF = [0x00, 0x90, 60, 64, 0x60, 0x80, 60, 0];

function expectRejection(bytes: Uint8Array, error: string): void {
  expect(readMidiSong(bytes, FILE_NAME)).toEqual({ok: false, error});
}

describe('readMidiSong: file level', () => {
  it('limits a MIDI file to 16 MiB', () => {
    expect(MAXIMUM_MIDI_FILE_SIZE).toBe(16 * 1024 * 1024);
  });

  describe('not-a-midi-file', () => {
    it('rejects bytes without MThd', () => {
      expectRejection(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14), 'not-a-midi-file');
    });

    it('rejects an empty file', () => {
      expectRejection(new Uint8Array(0), 'not-a-midi-file');
    });

    it('rejects a chunk length beyond the end of the file', () => {
      expectRejection(encodeSmf({...validSpec, cutOffBytes: 6}), 'not-a-midi-file');
    });

    it('rejects a status byte where a data byte is expected', () => {
      expectRejection(rawFile([0x00, 0x90, 60, 0x90]), 'not-a-midi-file');
    });

    it('rejects running status before any status byte', () => {
      expectRejection(rawFile([0x00, 60, 64]), 'not-a-midi-file');
    });

    it('rejects a variable-length quantity longer than 4 bytes', () => {
      expectRejection(rawFile([0x80, 0x80, 0x80, 0x80, 0x00, 0x90, 60, 64]), 'not-a-midi-file');
    });

    it('rejects an absolute Tick above 2^31', () => {
      const longestDelta = 0x0fffffff;
      const filler = Array.from({length: 9}, () => ({
        delta: longestDelta,
        event: {type: 'controller', channel: 0, controller: 7, value: 100} as const,
      }));
      const track: SmfTrack = {
        events: [
          ...filler,
          {delta: 0, event: {type: 'noteOn', channel: 0, note: 60, velocity: 64}},
          {delta: 0, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
        ],
      };
      expectRejection(encodeSmf({...validSpec, tracks: [track]}), 'not-a-midi-file');
    });

    it('rejects a file over MAXIMUM_MIDI_FILE_SIZE', () => {
      const bytes = new Uint8Array(MAXIMUM_MIDI_FILE_SIZE + 1);
      bytes.set(encodeSmf(validSpec));
      expectRejection(bytes, 'not-a-midi-file');
    });
  });

  it('rejects a MIDI file of format 2 as format-2', () => {
    expectRejection(encodeSmf({...validSpec, format: 2}), 'format-2');
  });

  it('rejects a time-code (SMPTE) division as not-timed-in-beats', () => {
    expectRejection(
      encodeSmf({...validSpec, division: {framesPerSecond: 25, ticksPerFrame: 40}}),
      'not-timed-in-beats',
    );
  });

  it('rejects a file with only a conductor track as no-notes', () => {
    expectRejection(encodeSmf({...validSpec, tracks: [conductorTrack]}), 'no-notes');
  });

  describe('accepted files', () => {
    it('reads a format 1 file', () => {
      const result = readMidiSong(encodeSmf(validSpec), FILE_NAME);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.ticksPerQuarter).toBe(96);
        expect(result.value.parts).toHaveLength(1);
        expect(result.value.parts[0]?.notes).toHaveLength(1);
      }
    });

    it('reads a format 0 file', () => {
      const result = readMidiSong(encodeSmf({...validSpec, format: 0, tracks: [melodyTrack]}), FILE_NAME);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.parts[0]?.notes).toHaveLength(1);
    });

    it('skips an unknown chunk type by its length', () => {
      const result = readMidiSong(rawFile(NOTE_ON_AND_OFF, chunk('XFIH', [0x90, 1, 2, 3, 4])), FILE_NAME);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.parts[0]?.notes).toHaveLength(1);
    });

    it('tolerates a missing End of Track at the end of the file', () => {
      const result = readMidiSong(encodeSmf({...validSpec, tracks: [{...melodyTrack, endOfTrack: false}]}), FILE_NAME);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.parts[0]?.notes).toHaveLength(1);
    });
  });

  describe('never throws', () => {
    it('returns a Result for every prefix of a valid file', () => {
      const bytes = encodeSmf(validSpec);
      for (let length = 0; length <= bytes.length; length++) {
        const result = readMidiSong(bytes.slice(0, length), FILE_NAME);
        expect(typeof result.ok).toBe('boolean');
      }
    });

    it('returns a Result for seeded pseudo-random bytes', () => {
      let state = 0x2545f491;
      const next = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state >>> 24;
      };
      const header = encodeSmf(validSpec).slice(0, 14);
      for (let round = 0; round < 300; round++) {
        const body = Uint8Array.from({length: next() % 64}, next);
        const bytes = round % 2 === 0 ? body : Uint8Array.from([...header, ...ascii('MTrk'), 0, 0, 0, body.length, ...body]);
        const result = readMidiSong(bytes, FILE_NAME);
        expect(typeof result.ok).toBe('boolean');
      }
    });
  });
});

type NoteEvent = {readonly type: 'noteOn' | 'noteOff'; readonly channel: number; readonly note: number; readonly velocity: number};

function on(delta: number, note: number, channel = 0, velocity = 64): SmfTimedEvent {
  const event: NoteEvent = {type: 'noteOn', channel, note, velocity};
  return {delta, event};
}

function off(delta: number, note: number, channel = 0): SmfTimedEvent {
  const event: NoteEvent = {type: 'noteOff', channel, note, velocity: 0};
  return {delta, event};
}

function named(text: string): SmfTimedEvent {
  return {delta: 0, event: {type: 'trackName', text}};
}

function songOf(bytes: Uint8Array, fileName = FILE_NAME): Song {
  const result = readMidiSong(bytes, fileName);
  if (!result.ok) throw new Error(`expected a Song, got ${result.error}`);
  return result.value;
}

function songOfTracks(...tracks: readonly SmfTrack[]): Song {
  return songOf(encodeSmf({format: 1, division: {ticksPerQuarterNote: 96}, tracks}));
}

/** A format 0 file whose single track body is written by hand, including its own End of Track. */
function fileWithTrack(body: readonly number[]): Uint8Array {
  return Uint8Array.from([...chunk('MThd', [0, 0, 0, 1, 0, 96]), ...chunk('MTrk', body)]);
}

function summary(of: Song): {name: string | undefined; percussion: boolean; notes: (readonly [number, number, number])[]}[] {
  return of.parts.map((p) => ({
    name: p.name,
    percussion: p.percussion,
    notes: p.notes.map((n) => [n.noteNumber, n.start, n.duration] as const),
  }));
}

describe('readMidiSong: Notes, Parts and names', () => {
  describe('Parts', () => {
    it('makes one Part per track and channel, ordered by track, then channel', () => {
      const song = songOfTracks(
        {events: [on(0, 60, 2), off(10, 60, 2), on(0, 62, 0), off(10, 62, 0)]},
        {events: [on(0, 64, 1), off(10, 64, 1)]},
      );
      expect(summary(song).map((p) => p.notes[0]?.[0])).toEqual([62, 60, 64]);
    });

    it('gives two Parts that share the name of their track', () => {
      const song = songOfTracks({events: [named('Piano'), on(0, 60, 0), off(10, 60, 0), on(0, 62, 1), off(10, 62, 1)]});
      expect(summary(song).map((p) => p.name)).toEqual(['Piano', 'Piano']);
    });

    it('makes no Part for a channel without Notes', () => {
      const song = songOfTracks({
        events: [{delta: 0, event: {type: 'programChange', channel: 3, program: 5}}, on(0, 60), off(10, 60)],
      });
      expect(song.parts).toHaveLength(1);
    });

    it('treats only channel 10 (index 9) as percussion', () => {
      const song = songOfTracks({
        events: [on(0, 36, 9), off(10, 36, 9), on(0, 60, 8), off(10, 60, 8), on(0, 61, 10), off(10, 61, 10)],
      });
      expect(summary(song).map((p) => [p.notes[0]?.[0], p.percussion])).toEqual([
        [60, false],
        [36, true],
        [61, false],
      ]);
    });
  });

  describe('names', () => {
    it('names a Part after the first track name of its track', () => {
      const song = songOfTracks({events: [named('Lead'), named('Other'), on(0, 60), off(10, 60)]});
      expect(song.parts[0]?.name).toBe('Lead');
    });

    it('leaves a Part without a track name unnamed', () => {
      expect(songOfTracks({events: [on(0, 60), off(10, 60)]}).parts[0]?.name).toBeUndefined();
    });

    it('leaves a Part unnamed when its track name is empty after trimming', () => {
      expect(songOfTracks({events: [named('  \t '), on(0, 60), off(10, 60)]}).parts[0]?.name).toBeUndefined();
    });

    it('trims the name of a Part', () => {
      expect(songOfTracks({events: [named('  Bass '), on(0, 60), off(10, 60)]}).parts[0]?.name).toBe('Bass');
    });

    it('decodes a track name as UTF-8 when it is valid UTF-8', () => {
      const name = [0x4d, 0xc3, 0xbc, 0x6c, 0x6c, 0x65, 0x72]; // "Müller"
      const song = songOf(fileWithTrack([0x00, 0xff, 0x03, name.length, ...name, ...NOTE_ON_AND_OFF, 0x00, 0xff, 0x2f, 0x00]));
      expect(song.parts[0]?.name).toBe('Müller');
    });

    it('decodes a track name as Latin-1 when it is not valid UTF-8', () => {
      const name = [0x4d, 0xfc, 0x6c, 0x6c, 0x65, 0x72]; // "Müller" in Latin-1
      const song = songOf(fileWithTrack([0x00, 0xff, 0x03, name.length, ...name, ...NOTE_ON_AND_OFF, 0x00, 0xff, 0x2f, 0x00]));
      expect(song.parts[0]?.name).toBe('Müller');
    });

    it('names the Song after the first track name of the first track', () => {
      const song = songOfTracks(
        {events: [named('My Tune'), named('Second')]},
        {events: [named('Not this'), on(0, 60), off(10, 60)]},
      );
      expect(song.name).toBe('My Tune');
    });

    it('names the Song after the file without .mid when the first track has no name', () => {
      const bytes = encodeSmf({format: 0, division: {ticksPerQuarterNote: 96}, tracks: [{events: [on(0, 60), off(10, 60)]}]});
      expect(songOf(bytes, 'waltz.mid').name).toBe('waltz');
    });

    it('names the Song after the file without .midi', () => {
      const bytes = encodeSmf({format: 0, division: {ticksPerQuarterNote: 96}, tracks: [{events: [on(0, 60), off(10, 60)]}]});
      expect(songOf(bytes, 'waltz.midi').name).toBe('waltz');
    });

    it('does not take the Song name from a later track', () => {
      const song = songOfTracks({events: [on(0, 60), off(10, 60)]}, {events: [named('Later'), on(0, 62), off(10, 62)]});
      expect(song.name).toBe('tune');
    });
  });

  describe('Notes', () => {
    it('ends a Note at its note-off', () => {
      expect(summary(songOfTracks({events: [on(5, 60), off(20, 60)]}))[0]?.notes).toEqual([[60, 5, 20]]);
    });

    it('ends a Note at a note-on with velocity 0', () => {
      expect(summary(songOfTracks({events: [on(0, 60), on(30, 60, 0, 0)]}))[0]?.notes).toEqual([[60, 0, 30]]);
    });

    it('reads running status, kept across meta and SysEx events', () => {
      const body = [
        0x00, 0x90, 60, 64,
        0x10, 62, 64, // running status note-on
        0x00, 0xff, 0x01, 0x01, 0x41, // meta event keeps running status
        0x00, 0xf0, 0x02, 0x7d, 0xf7, // SysEx keeps running status
        0x10, 64, 64,
        0x10, 60, 0, 0x00, 62, 0, 0x00, 64, 0,
        0x00, 0xff, 0x2f, 0x00,
      ];
      expect(summary(songOf(fileWithTrack(body)))[0]?.notes).toEqual([
        [60, 0, 48],
        [62, 16, 32],
        [64, 32, 16],
      ]);
    });

    it('reads running status written by the encoder', () => {
      const song = songOfTracks({runningStatus: true, events: [on(0, 60), on(0, 62), off(10, 60), off(0, 62)]});
      expect(summary(song)[0]?.notes).toEqual([
        [60, 0, 10],
        [62, 0, 10],
      ]);
    });

    it('re-triggers a sounding key: the first Note ends, a new one starts', () => {
      expect(summary(songOfTracks({events: [on(0, 60), on(10, 60), off(10, 60)]}))[0]?.notes).toEqual([
        [60, 0, 10],
        [60, 10, 10],
      ]);
    });

    it('ignores a note-off at the Tick of a re-trigger', () => {
      const retriggered = [on(0, 60), on(10, 60), off(0, 60), off(10, 60)];
      expect(summary(songOfTracks({events: retriggered}))[0]?.notes).toEqual([
        [60, 0, 10],
        [60, 10, 10],
      ]);
    });

    it('ignores a note-off with no sounding Note', () => {
      expect(summary(songOfTracks({events: [off(0, 61), on(0, 60), off(10, 60), off(5, 60)]}))[0]?.notes).toEqual([[60, 0, 10]]);
    });

    it('ends a Note never released at the End of Track Tick', () => {
      const body = [0x00, 0x90, 60, 64, 0x60, 0xff, 0x2f, 0x00];
      expect(summary(songOf(fileWithTrack(body)))[0]?.notes).toEqual([[60, 0, 96]]);
    });

    it('ends a Note never released at the last event of a track without End of Track', () => {
      const song = songOfTracks({endOfTrack: false, events: [on(0, 60), {delta: 40, event: {type: 'controller', channel: 0, controller: 7, value: 9}}]});
      expect(summary(song)[0]?.notes).toEqual([[60, 0, 40]]);
    });

    it('keeps a Note of duration 0', () => {
      expect(summary(songOfTracks({events: [on(7, 60), off(0, 60)]}))[0]?.notes).toEqual([[60, 7, 0]]);
    });

    it('ends a Note of duration 0 at its Tick even when the track goes on', () => {
      const song = songOfTracks({
        events: [on(7, 60), off(0, 60), {delta: 96, event: {type: 'controller', channel: 0, controller: 7, value: 9}}],
      });
      expect(summary(song)[0]?.notes).toEqual([[60, 7, 0]]);
    });

    it('sorts the Notes of a Part by start, then note number', () => {
      const song = songOfTracks({
        events: [on(0, 64), on(0, 60), off(10, 64), off(0, 60), on(0, 62), off(5, 62)],
      });
      expect(summary(song)[0]?.notes).toEqual([
        [60, 0, 10],
        [64, 0, 10],
        [62, 10, 5],
      ]);
    });
  });

  describe('what does not change the Song (FR-003)', () => {
    it('ignores tempo, programs, controllers, SysEx and velocity', () => {
      const plain = songOfTracks({events: [on(0, 60, 0, 64), off(96, 60)]});
      const noisy = songOfTracks(conductorTrack, {
        events: [
          {delta: 0, event: {type: 'programChange', channel: 0, program: 40}},
          {delta: 0, event: {type: 'controller', channel: 0, controller: 7, value: 3}},
          {delta: 0, event: {type: 'sysEx', data: [0x7e, 0x7f]}},
          on(0, 60, 0, 127),
          {delta: 96, event: {type: 'tempo', microsecondsPerQuarterNote: 250_000}},
          off(0, 60),
        ],
      });
      expect(summary(noisy)).toEqual(summary(plain));
    });

    it('takes ticksPerQuarter from the header', () => {
      const bytes = encodeSmf({format: 0, division: {ticksPerQuarterNote: 480}, tracks: [{events: [on(0, 60), off(10, 60)]}]});
      expect(songOf(bytes).ticksPerQuarter).toBe(480);
    });
  });

  it('gives every Song a new SongId', () => {
    const bytes = encodeSmf(validSpec);
    expect(songOf(bytes).id).not.toBe(songOf(bytes).id);
  });
});

describe('readMidiSong keeps the Time signatures and Keys of its meta events (US4, scenario 5, R9)', () => {
  const at = (delta: number, event: SmfEvent): SmfTimedEvent => ({delta, event});
  const sixEight: SmfEvent = {type: 'timeSignature', beats: 6, beatType: 8};
  const threeFour: SmfEvent = {type: 'timeSignature', beats: 3, beatType: 4};

  it('keeps a time signature meta event at its Tick', () => {
    const song = songOfTracks({events: [on(0, 60), off(96, 60), at(0, sixEight)]});

    expect(song.timeSignatures).toEqual([{start: 96, beats: 6, beatType: 8}]);
  });

  it('reads the denominator of a time signature meta event as a power of two', () => {
    // Raw bytes, not the encoder: FF 58 04 06 03 18 08 is 6/8 (denominator 2^3 = 8) at Tick 96.
    const song = songOf(
      fileWithTrack([0x00, 0x90, 60, 64, 0x60, 0x80, 60, 0, 0x00, 0xff, 0x58, 0x04, 6, 3, 24, 8, 0x00, 0xff, 0x2f, 0x00]),
    );

    expect(song.timeSignatures).toEqual([{start: 96, beats: 6, beatType: 8}]);
  });

  it('keeps a key signature meta event at its Tick, with sf signed and mi 1 as minor', () => {
    const song = songOfTracks({
      events: [on(0, 60), off(96, 60), at(0, {type: 'keySignature', fifths: -3, mode: 'minor'})],
    });

    expect(song.keys).toEqual([{start: 96, fifths: -3, mode: 'minor'}]);
  });

  it('reads mi 0 as major', () => {
    const song = songOfTracks({events: [at(0, {type: 'keySignature', fifths: 1, mode: 'major'}), on(0, 60), off(96, 60)]});

    expect(song.keys).toEqual([{start: 0, fifths: 1, mode: 'major'}]);
  });

  it('keeps no Time signature for a MIDI file without a time signature event', () => {
    const song = songOfTracks({events: [on(0, 60), off(96, 60)]});

    expect(song.timeSignatures).toEqual([]);
  });

  it('never keeps an upbeat from MIDI, even when the first Notes are shorter than the first Bar', () => {
    const song = songOfTracks({events: [at(0, threeFour), on(0, 60), off(96, 60)]});

    expect(song.upbeat).toBeUndefined();
  });

  it('keeps a repeated equal time signature once', () => {
    const song = songOfTracks({events: [at(0, threeFour), on(0, 60), off(96, 60), at(0, threeFour)]});

    expect(song.timeSignatures).toEqual([{start: 0, beats: 3, beatType: 4}]);
  });

  it('takes the first track when two tracks give a time signature on the same Tick', () => {
    const song = songOfTracks(
      {events: [at(0, threeFour), on(0, 60), off(96, 60)]},
      {events: [at(0, sixEight), on(0, 62), off(96, 62)]},
    );

    expect(song.timeSignatures).toEqual([{start: 0, beats: 3, beatType: 4}]);
  });
});
