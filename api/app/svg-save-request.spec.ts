import {describe, expect, it} from 'vitest';
import {plotterFileName} from '../tape/plotter-file-name';
import {plotterSvg} from '../tape/plotter-svg';
import {parseSvgSaveRequest} from './svg-save-request';

const valid = {
  suggestedFileName: 'Waltz.svg',
  svg: '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  dialogTitle: 'Export for the Plotter',
  filterName: 'SVG file',
};

function errorOf(input: unknown): string {
  const result = parseSvgSaveRequest(input);
  if (result.ok) throw new Error('expected the request to be rejected');
  return result.error;
}

describe('parseSvgSaveRequest', () => {
  it('accepts a valid request', () => {
    expect(parseSvgSaveRequest(valid)).toEqual({ok: true, value: valid});
  });

  it('accepts what plotterFileName and plotterSvg produce', () => {
    const svg = plotterSvg({
      totalLength: 652,
      width: 100,
      slots: [],
      outline: {
        tip: {x: 0, y: 0},
        topEnd: {x: 652, y: 0},
        bottomEnd: {x: 652, y: 100},
        columnOneBottom: {x: 50, y: 100},
      },
    });
    for (const name of ['Waltz', 'Test: 1/2', 'CON.txt', 'a'.repeat(300), '', '../../etc/passwd', '\u{1D11E}'.repeat(300)]) {
      expect(parseSvgSaveRequest({...valid, suggestedFileName: plotterFileName(name), svg}).ok).toBe(true);
    }
  });

  it.each([null, undefined, 'x', 42, [], [valid]])('rejects a payload that is not a plain object (%j)', (input) => {
    expect(parseSvgSaveRequest(input).ok).toBe(false);
  });

  it('rejects an extra field', () => {
    expect(parseSvgSaveRequest({...valid, filePath: 'C:\\x.svg'}).ok).toBe(false);
  });

  it.each(['suggestedFileName', 'svg', 'dialogTitle', 'filterName'] as const)('rejects a missing %s', (field) => {
    const {[field]: _omitted, ...rest} = valid;
    expect(errorOf(rest)).toContain(field);
  });

  it.each(['suggestedFileName', 'svg', 'dialogTitle', 'filterName'] as const)('rejects a non-string %s', (field) => {
    expect(errorOf({...valid, [field]: 5})).toContain(field);
  });

  describe('suggestedFileName', () => {
    it.each(['../evil.svg', 'a/b.svg', 'C:\\x.svg', 'a\\b.svg', 'C:x.svg', '...svg', '.svg', 'a.txt', 'abc', 'a\u0000b.svg', 'a\nb.svg', 'a\u007fb.svg', 'a?b.svg', 'CON.svg', 'nul.SVG', 'a<b>.svg', 'a|b.svg'])(
      'rejects %j',
      (name) => {
        expect(errorOf({...valid, suggestedFileName: name})).toContain('suggestedFileName');
      },
    );

    it('rejects fewer than 5 characters', () => {
      expect(errorOf({...valid, suggestedFileName: 'a.svg'.slice(1)})).toContain('suggestedFileName');
    });

    it('accepts 5 characters and 255 characters', () => {
      expect(parseSvgSaveRequest({...valid, suggestedFileName: 'a.svg'}).ok).toBe(true);
      expect(parseSvgSaveRequest({...valid, suggestedFileName: `${'a'.repeat(251)}.svg`}).ok).toBe(true);
    });

    it('rejects more than 255 characters', () => {
      expect(errorOf({...valid, suggestedFileName: `${'a'.repeat(252)}.svg`})).toContain('suggestedFileName');
    });

    it('accepts the extension in any case', () => {
      expect(parseSvgSaveRequest({...valid, suggestedFileName: 'Waltz.SVG'}).ok).toBe(true);
    });

    it('accepts dots inside the name', () => {
      expect(parseSvgSaveRequest({...valid, suggestedFileName: 'a.b.svg'}).ok).toBe(true);
    });
  });

  describe('svg', () => {
    it.each(['', 'plain text', '<svg xmlns="x"></svg>', '<?xml version="1.0"?><g></g>', '<?xml?><svg></svg>'])(
      'rejects %j',
      (svg) => {
        expect(errorOf({...valid, svg})).toContain('svg');
      },
    );

    it('accepts text of exactly 64 x 2^20 characters and rejects one more', () => {
      const prefix = '<?xml?><svg ';
      const limit = 64 * 2 ** 20;
      const atLimit = prefix + 'a'.repeat(limit - prefix.length);
      expect(parseSvgSaveRequest({...valid, svg: atLimit}).ok).toBe(true);
      expect(errorOf({...valid, svg: `${atLimit}a`})).toContain('svg');
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
      expect(parseSvgSaveRequest({...valid, [field]: 'a'}).ok).toBe(true);
      expect(parseSvgSaveRequest({...valid, [field]: 'a'.repeat(200)}).ok).toBe(true);
    });
  });
});
