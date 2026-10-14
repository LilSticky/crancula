import { describe, expect, it } from 'vitest';
import { encodeSmf, encodeVariableLengthQuantity } from './smf-test-helper';

const END_OF_TRACK = [0x00, 0xff, 0x2f, 0x00];

function bytes(smf: Uint8Array): number[] {
  return Array.from(smf);
}

function trackChunk(body: number[]): number[] {
  return [0x4d, 0x54, 0x72, 0x6b, 0, 0, (body.length >> 8) & 0xff, body.length & 0xff, ...body];
}

describe('encodeVariableLengthQuantity', () => {
  it.each([
    [0, [0x00]],
    [127, [0x7f]],
    [128, [0x81, 0x00]],
    [16383, [0xff, 0x7f]],
    [0x0fffffff, [0xff, 0xff, 0xff, 0x7f]],
  ])('encodes %i', (value, expected) => {
    expect(encodeVariableLengthQuantity(value)).toEqual(expected);
  });
});

describe('encodeSmf header', () => {
  it.each([0, 1, 2] as const)('writes an MThd for format %i with Ticks per quarter note', (format) => {
    const smf = encodeSmf({ format, division: { ticksPerQuarterNote: 480 }, tracks: [] });

    expect(bytes(smf)).toEqual([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, 0, 0, 0x01, 0xe0]);
  });

  it('counts the tracks in the header', () => {
    const smf = encodeSmf({
      format: 1,
      division: { ticksPerQuarterNote: 96 },
      tracks: [{ events: [] }, { events: [] }],
    });

    expect(bytes(smf).slice(10, 14)).toEqual([0, 2, 0, 96]);
  });

  it('writes a time-code division with the top bit set', () => {
    const smf = encodeSmf({
      format: 0,
      division: { framesPerSecond: 25, ticksPerFrame: 40 },
      tracks: [],
    });

    expect(bytes(smf).slice(12, 14)).toEqual([0xe7, 40]);
  });
});

describe('encodeSmf tracks', () => {
  const division = { ticksPerQuarterNote: 480 };

  it('writes an MTrk with an End of Track appended', () => {
    const smf = encodeSmf({ format: 0, division, tracks: [{ events: [] }] });

    expect(bytes(smf).slice(14)).toEqual(trackChunk(END_OF_TRACK));
  });

  it('writes note-on and note-off with variable-length delta times', () => {
    const smf = encodeSmf({
      format: 0,
      division,
      tracks: [
        {
          events: [
            { delta: 0, event: { type: 'noteOn', channel: 0, note: 60, velocity: 100 } },
            { delta: 480, event: { type: 'noteOff', channel: 0, note: 60, velocity: 64 } },
          ],
        },
      ],
    });

    expect(bytes(smf).slice(14)).toEqual(
      trackChunk([0x00, 0x90, 60, 100, 0x83, 0x60, 0x80, 60, 64, ...END_OF_TRACK]),
    );
  });

  it('writes Sequence/Track Name, tempo, controller, program change and SysEx events', () => {
    const smf = encodeSmf({
      format: 1,
      division,
      tracks: [
        {
          events: [
            { delta: 0, event: { type: 'trackName', text: 'Lead' } },
            { delta: 0, event: { type: 'tempo', microsecondsPerQuarterNote: 500000 } },
            { delta: 0, event: { type: 'controller', channel: 2, controller: 7, value: 100 } },
            { delta: 0, event: { type: 'programChange', channel: 9, program: 5 } },
            { delta: 128, event: { type: 'sysEx', data: [0x7e, 0x09] } },
          ],
        },
      ],
    });

    expect(bytes(smf).slice(14)).toEqual(
      trackChunk([
        ...[0x00, 0xff, 0x03, 4, 0x4c, 0x65, 0x61, 0x64],
        ...[0x00, 0xff, 0x51, 3, 0x07, 0xa1, 0x20],
        ...[0x00, 0xb2, 7, 100],
        ...[0x00, 0xc9, 5],
        ...[0x81, 0x00, 0xf0, 3, 0x7e, 0x09, 0xf7],
        ...END_OF_TRACK,
      ]),
    );
  });

  it('omits repeated status bytes with running status', () => {
    const smf = encodeSmf({
      format: 0,
      division,
      tracks: [
        {
          runningStatus: true,
          events: [
            { delta: 0, event: { type: 'noteOn', channel: 0, note: 60, velocity: 100 } },
            { delta: 10, event: { type: 'noteOn', channel: 0, note: 62, velocity: 100 } },
            { delta: 10, event: { type: 'noteOn', channel: 1, note: 64, velocity: 100 } },
          ],
        },
      ],
    });

    expect(bytes(smf).slice(14)).toEqual(
      trackChunk([0x00, 0x90, 60, 100, 10, 62, 100, 10, 0x91, 64, 100, ...END_OF_TRACK]),
    );
  });

  it('can leave out the End of Track', () => {
    const smf = encodeSmf({
      format: 0,
      division,
      tracks: [
        {
          endOfTrack: false,
          events: [{ delta: 0, event: { type: 'noteOn', channel: 0, note: 60, velocity: 100 } }],
        },
      ],
    });

    expect(bytes(smf).slice(14)).toEqual(trackChunk([0x00, 0x90, 60, 100]));
  });
});

describe('encodeSmf malformed files', () => {
  const division = { ticksPerQuarterNote: 480 };

  it('appends raw bytes after the last chunk', () => {
    const smf = encodeSmf({ format: 0, division, tracks: [], appendBytes: [0xde, 0xad] });

    expect(bytes(smf).slice(14)).toEqual([0xde, 0xad]);
  });

  it('cuts off the last bytes of the file', () => {
    const smf = encodeSmf({ format: 0, division, tracks: [{ events: [] }], cutOffBytes: 3 });

    expect(bytes(smf)).toHaveLength(14 + 8 + END_OF_TRACK.length - 3);
  });
});
