import {describe, expect, it} from 'vitest';
import {MAXIMUM_MIDI_FILE_SIZE, readMidiSong} from './read-midi-song';
import {encodeSmf, type SmfSpec, type SmfTrack} from './smf-test-helper';

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
