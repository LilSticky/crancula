import {describe, expect, it} from 'vitest';
import {MP3_BIT_RATE, RECORDING_CHANNELS, RECORDING_SAMPLE_RATE, recordingFormatOf} from './recording-format';

describe('recording format constants', () => {
  it('records 44.1 kHz mono audio', () => {
    expect(RECORDING_SAMPLE_RATE).toBe(44100);
    expect(RECORDING_CHANNELS).toBe(1);
  });

  it('encodes MP3 at 128 kbit/s', () => {
    expect(MP3_BIT_RATE).toBe(128);
  });
});

describe('recordingFormatOf', () => {
  it('is wav for a .wav file name', () => {
    expect(recordingFormatOf('a.wav')).toBe('wav');
  });

  it('is mp3 for a .mp3 file name in any case', () => {
    expect(recordingFormatOf('A.MP3')).toBe('mp3');
    expect(recordingFormatOf('waltz.Mp3')).toBe('mp3');
  });

  it('is undefined for any other extension', () => {
    expect(recordingFormatOf('a.ogg')).toBeUndefined();
  });

  it('is undefined for a file name without an extension', () => {
    expect(recordingFormatOf('a')).toBeUndefined();
  });

  it('is undefined for a bare format name without a dot', () => {
    expect(recordingFormatOf('wav')).toBeUndefined();
  });
});
