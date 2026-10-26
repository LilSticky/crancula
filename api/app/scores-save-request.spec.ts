import {describe, expect, it} from 'vitest';
import {scoresFileName} from '../scores/scores-file-name';
import {parseScoresSaveRequest} from './scores-save-request';

const valid = {
  suggestedFileName: 'Waltz.musicxml',
  musicXml: '<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><work><work-title>Waltz</work-title></work></score-partwise>\n',
  dialogTitle: 'Export as Scores',
  filterName: 'MusicXML file',
};

const MUSICXML_PREFIX = '<?xml?><score-partwise ';

function errorOf(input: unknown): string {
  const result = parseScoresSaveRequest(input);
  if (result.ok) throw new Error('expected the request to be rejected');
  return result.error;
}

describe('parseScoresSaveRequest', () => {
  it('accepts a valid request', () => {
    expect(parseScoresSaveRequest(valid)).toEqual({ok: true, value: valid});
  });

  it('accepts a suggested file name made by scoresFileName', () => {
    for (const name of ['Waltz', 'Test: 1/2', 'CON', 'a'.repeat(300), '', '../../etc/passwd', '\u{1D11E}'.repeat(300)]) {
      expect(parseScoresSaveRequest({...valid, suggestedFileName: scoresFileName(name)}).ok).toBe(true);
    }
  });

  it.each([null, undefined, 'x', 42, [], [valid]])('rejects a payload that is not a plain object (%j)', (input) => {
    expect(parseScoresSaveRequest(input).ok).toBe(false);
  });

  it('rejects an extra field', () => {
    expect(parseScoresSaveRequest({...valid, filePath: 'C:\\x.musicxml'}).ok).toBe(false);
  });

  it.each(['suggestedFileName', 'musicXml', 'dialogTitle', 'filterName'] as const)('rejects a missing %s', (field) => {
    const {[field]: _omitted, ...rest} = valid;
    expect(errorOf(rest)).toContain(field);
  });

  it.each(['suggestedFileName', 'musicXml', 'dialogTitle', 'filterName'] as const)('rejects a non-string %s', (field) => {
    expect(errorOf({...valid, [field]: 5})).toContain(field);
  });

  describe('suggestedFileName', () => {
    it.each([
      '../evil.musicxml',
      'a/b.musicxml',
      'C:\\x.musicxml',
      'a\\b.musicxml',
      'C:x.musicxml',
      '...musicxml',
      '.musicxml',
      'Waltz.svg',
      'Waltz.xml',
      'Waltz.musicxml.txt',
      'Waltz.mxl',
      'a\u0000b.musicxml',
      'a\nb.musicxml',
      'a\u007fb.musicxml',
      'a?b.musicxml',
      'CON.musicxml',
      'nul.MUSICXML',
      'a<b>.musicxml',
      'a|b.musicxml',
      'COM0.musicxml',
      'LPT0.musicxml',
      'COM¹.musicxml',
      'LPT³.musicxml',
      'CONIN$.musicxml',
      'conout$.MUSICXML',
    ])('rejects %j', (name) => {
      expect(errorOf({...valid, suggestedFileName: name})).toContain('suggestedFileName');
    });

    it('rejects a name longer than 255 characters', () => {
      expect(errorOf({...valid, suggestedFileName: `${'a'.repeat(247)}.musicxml`})).toContain('suggestedFileName');
    });

    it('accepts a one-character stem and a name of exactly 255 characters', () => {
      expect(parseScoresSaveRequest({...valid, suggestedFileName: 'a.musicxml'}).ok).toBe(true);
      expect(parseScoresSaveRequest({...valid, suggestedFileName: `${'a'.repeat(246)}.musicxml`}).ok).toBe(true);
    });

    it('accepts the extension in any case', () => {
      expect(parseScoresSaveRequest({...valid, suggestedFileName: 'Waltz.MusicXML'}).ok).toBe(true);
    });

    it('accepts dots inside the name', () => {
      expect(parseScoresSaveRequest({...valid, suggestedFileName: 'a.b.musicxml'}).ok).toBe(true);
    });
  });

  describe('musicXml', () => {
    it.each(['', 'plain text', '<score-partwise version="4.0"/>', '<?xml version="1.0"?><svg></svg>', '<?xml?><score-timewise/>'])(
      'rejects %j',
      (musicXml) => {
        expect(errorOf({...valid, musicXml})).toContain('musicXml');
      },
    );

    it('accepts text of exactly 64 x 2^20 characters and rejects one more', () => {
      const limit = 64 * 2 ** 20;
      const atLimit = MUSICXML_PREFIX + 'a'.repeat(limit - MUSICXML_PREFIX.length);
      expect(parseScoresSaveRequest({...valid, musicXml: atLimit}).ok).toBe(true);
      expect(errorOf({...valid, musicXml: `${atLimit}a`})).toContain('musicXml');
    });
  });

  describe.each(['dialogTitle', 'filterName'] as const)('%s', (field) => {
    it('rejects empty, over 200 characters and control characters', () => {
      expect(errorOf({...valid, [field]: ''})).toContain(field);
      expect(errorOf({...valid, [field]: 'a'.repeat(201)})).toContain(field);
      expect(errorOf({...valid, [field]: 'a\u0000b'})).toContain(field);
      expect(errorOf({...valid, [field]: 'a\nb'})).toContain(field);
    });

    it('accepts 1 and 200 characters', () => {
      expect(parseScoresSaveRequest({...valid, [field]: 'a'}).ok).toBe(true);
      expect(parseScoresSaveRequest({...valid, [field]: 'a'.repeat(200)}).ok).toBe(true);
    });
  });
});
