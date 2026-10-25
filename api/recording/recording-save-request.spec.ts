import {describe, expect, it} from 'vitest';
import {
  MAXIMUM_RECORDING_BYTES,
  parseRecordingChooseRequest,
  parseRecordingWriteRequest,
} from './recording-save-request';

const TARGET = '00000000-0000-4000-8000-000000000001';

const validChoose = {
  suggestedFileName: 'Waltz',
  dialogTitle: 'Record a tape',
  wavFilterName: 'WAV audio',
  mp3FilterName: 'MP3 audio',
};

const validWrite = {target: TARGET, bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46])};

function chooseErrorOf(input: unknown): string {
  const result = parseRecordingChooseRequest(input);
  if (result.ok) throw new Error('expected the request to be rejected');
  return result.error;
}

function writeErrorOf(input: unknown): string {
  const result = parseRecordingWriteRequest(input);
  if (result.ok) throw new Error('expected the request to be rejected');
  return result.error;
}

describe('parseRecordingChooseRequest', () => {
  it('accepts a valid request', () => {
    expect(parseRecordingChooseRequest(validChoose)).toEqual({ok: true, value: validChoose});
  });

  it.each<unknown>([null, undefined, 'x', 42])('rejects a payload that is not an object (%j)', (input) => {
    expect(parseRecordingChooseRequest(input).ok).toBe(false);
  });

  it('rejects an array', () => {
    expect(parseRecordingChooseRequest([validChoose]).ok).toBe(false);
  });

  it('rejects an extra field', () => {
    expect(parseRecordingChooseRequest({...validChoose, filePath: 'C:\\x.wav'}).ok).toBe(false);
  });

  it.each(['suggestedFileName', 'dialogTitle', 'wavFilterName', 'mp3FilterName'] as const)(
    'rejects a missing %s',
    (field) => {
      const {[field]: _omitted, ...rest} = validChoose;
      expect(chooseErrorOf(rest)).toContain(field);
    },
  );

  it.each(['suggestedFileName', 'dialogTitle', 'wavFilterName', 'mp3FilterName'] as const)(
    'rejects a non-string %s',
    (field) => {
      expect(chooseErrorOf({...validChoose, [field]: 5})).toContain(field);
    },
  );

  describe.each(['suggestedFileName', 'dialogTitle', 'wavFilterName', 'mp3FilterName'] as const)('%s', (field) => {
    it('rejects empty, over 200 characters and control characters', () => {
      expect(chooseErrorOf({...validChoose, [field]: ''})).toContain(field);
      expect(chooseErrorOf({...validChoose, [field]: 'a'.repeat(201)})).toContain(field);
      expect(chooseErrorOf({...validChoose, [field]: 'a\u0000b'})).toContain(field);
      expect(chooseErrorOf({...validChoose, [field]: 'a\nb'})).toContain(field);
    });

    it('accepts 1 and 200 characters', () => {
      expect(parseRecordingChooseRequest({...validChoose, [field]: 'a'}).ok).toBe(true);
      expect(parseRecordingChooseRequest({...validChoose, [field]: 'a'.repeat(200)}).ok).toBe(true);
    });
  });

  describe('suggestedFileName', () => {
    it.each(['../evil', 'a/b', 'C:\\x', 'a\\b', '.', '..', '...'])('rejects %j', (name) => {
      expect(chooseErrorOf({...validChoose, suggestedFileName: name})).toContain('suggestedFileName');
    });

    it('accepts dots inside the name', () => {
      expect(parseRecordingChooseRequest({...validChoose, suggestedFileName: 'a.b'}).ok).toBe(true);
    });
  });
});

describe('parseRecordingWriteRequest', () => {
  it('accepts a valid request', () => {
    expect(parseRecordingWriteRequest(validWrite)).toEqual({ok: true, value: validWrite});
  });

  it.each<unknown>([null, undefined, 'x', 42])('rejects a payload that is not an object (%j)', (input) => {
    expect(parseRecordingWriteRequest(input).ok).toBe(false);
  });

  it('rejects an array', () => {
    expect(parseRecordingWriteRequest([validWrite]).ok).toBe(false);
  });

  it('rejects an extra field', () => {
    expect(parseRecordingWriteRequest({...validWrite, filePath: 'C:\\x.wav'}).ok).toBe(false);
  });

  it('rejects a missing field', () => {
    expect(writeErrorOf({target: TARGET})).toContain('bytes');
    expect(writeErrorOf({bytes: validWrite.bytes})).toContain('target');
  });

  it.each(['', 'not-a-uuid', 42, null])('rejects a target that is not a UUID (%j)', (target) => {
    expect(writeErrorOf({...validWrite, target})).toContain('target');
  });

  it.each<unknown>(['RIFF', null, 42])('rejects bytes that are not a Uint8Array (%j)', (bytes) => {
    expect(writeErrorOf({...validWrite, bytes})).toContain('bytes');
  });

  it('rejects a plain array of bytes', () => {
    expect(writeErrorOf({...validWrite, bytes: [0x52, 0x49]})).toContain('bytes');
  });

  it('rejects empty bytes', () => {
    expect(writeErrorOf({...validWrite, bytes: new Uint8Array(0)})).toContain('bytes');
  });

  it('accepts the maximum of 128 MiB and rejects one byte more', () => {
    expect(MAXIMUM_RECORDING_BYTES).toBe(128 * 2 ** 20);
    expect(parseRecordingWriteRequest({...validWrite, bytes: new Uint8Array(MAXIMUM_RECORDING_BYTES)}).ok).toBe(true);
    expect(writeErrorOf({...validWrite, bytes: new Uint8Array(MAXIMUM_RECORDING_BYTES + 1)})).toContain('bytes');
  });

  it('accepts one byte', () => {
    expect(parseRecordingWriteRequest({...validWrite, bytes: new Uint8Array([0])}).ok).toBe(true);
  });
});
