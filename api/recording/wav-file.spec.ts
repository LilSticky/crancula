import {describe, expect, it} from 'vitest';
import {wavFile} from './wav-file';

const HEADER_LENGTH = 44;

function asciiAt(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** The fields of a canonical 44-byte WAV header, read little endian. */
function headerOf(bytes: Uint8Array) {
  const view = viewOf(bytes);
  return {
    riff: asciiAt(view, 0),
    riffSize: view.getUint32(4, true),
    wave: asciiAt(view, 8),
    fmt: asciiAt(view, 12),
    fmtSize: view.getUint32(16, true),
    format: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    data: asciiAt(view, 36),
    dataSize: view.getUint32(40, true),
  };
}

describe('wavFile', () => {
  it('writes a 16-bit mono PCM header with the sample rate', () => {
    const bytes = wavFile(new Int16Array([0, 1, -1]), 44100);

    expect(headerOf(bytes)).toEqual({
      riff: 'RIFF',
      riffSize: 42,
      wave: 'WAVE',
      fmt: 'fmt ',
      fmtSize: 16,
      format: 1,
      channels: 1,
      sampleRate: 44100,
      byteRate: 88200,
      blockAlign: 2,
      bitsPerSample: 16,
      data: 'data',
      dataSize: 6,
    });
  });

  it('is 44 bytes of header plus two bytes per sample', () => {
    expect(wavFile(new Int16Array([0, 1, -1]), 44100)).toHaveLength(50);
  });

  it('writes the samples little endian after the header', () => {
    const bytes = wavFile(new Int16Array([0, 1, -1]), 44100);
    const view = viewOf(bytes);

    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)]).toEqual([0, 1, -1]);
    expect(Array.from(bytes.subarray(44))).toEqual([0x00, 0x00, 0x01, 0x00, 0xff, 0xff]);
  });

  it('writes a 44-byte header and no samples for an empty PCM', () => {
    const bytes = wavFile(new Int16Array(0), 44100);

    expect(bytes).toHaveLength(HEADER_LENGTH);
    expect(headerOf(bytes)).toMatchObject({riffSize: 36, dataSize: 0});
  });

  it('writes the byte rate of the given sample rate', () => {
    expect(headerOf(wavFile(new Int16Array(0), 22050))).toMatchObject({sampleRate: 22050, byteRate: 44100});
  });
});
