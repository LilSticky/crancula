import {describe, expect, it} from 'vitest';
import {parseSvgPiecesSaveRequest} from './svg-pieces-save-request';

const PIECE_SVG = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const MAXIMUM_SVG_LENGTH_SUM = 64 * 2 ** 20;

const valid = {
  pieces: [
    {fileName: 'Waltz 1 of 2.svg', svg: PIECE_SVG},
    {fileName: 'Waltz 2 of 2.svg', svg: PIECE_SVG},
  ],
  dialogTitle: 'Export for the Plotter',
  dialogButton: 'Save here',
  replaceMessage: 'Some of these files already exist. Replace them?',
  replaceMoreLine: '… and {count} more',
  replaceButton: 'Replace',
  cancelButton: 'Cancel',
};

const TEXT_FIELDS = [
  'dialogTitle',
  'dialogButton',
  'replaceMessage',
  'replaceMoreLine',
  'replaceButton',
  'cancelButton',
] as const;

const MORE_COUNT_PLACEHOLDER = '{count}';

/** A text of `length` characters that is valid for `field`: the more line must hold the placeholder once. */
function textOfLength(field: (typeof TEXT_FIELDS)[number], length: number): string {
  if (field !== 'replaceMoreLine') return 'a'.repeat(length);
  return `${MORE_COUNT_PLACEHOLDER}${'a'.repeat(length - MORE_COUNT_PLACEHOLDER.length)}`;
}

function errorOf(input: unknown): string {
  const result = parseSvgPiecesSaveRequest(input);
  if (result.ok) throw new Error('expected the request to be rejected');
  return result.error;
}

/** Two pieces, the first one `firstName`, the second one `secondName`. */
function withNames(firstName: string, secondName: string): unknown {
  return {...valid, pieces: [{fileName: firstName, svg: PIECE_SVG}, {fileName: secondName, svg: PIECE_SVG}]};
}

describe('parseSvgPiecesSaveRequest', () => {
  it('accepts a valid request', () => {
    expect(parseSvgPiecesSaveRequest(valid)).toEqual({ok: true, value: valid});
  });

  it.each([null, undefined, 'x', 42, [], [valid]])('rejects a payload that is not a plain object (%j)', (input) => {
    expect(parseSvgPiecesSaveRequest(input).ok).toBe(false);
  });

  it('rejects an extra field', () => {
    expect(parseSvgPiecesSaveRequest({...valid, folderPath: 'C:\\Users'}).ok).toBe(false);
  });

  it.each(['pieces', ...TEXT_FIELDS] as const)('rejects a missing %s', (field) => {
    const {[field]: _omitted, ...rest} = valid;
    expect(errorOf(rest)).toContain(field);
  });

  describe('pieces', () => {
    it('rejects a list that is not an array', () => {
      expect(errorOf({...valid, pieces: valid.pieces[0]})).toContain('pieces');
    });

    it('rejects one piece: a Tape that fits one piece is saved with the save dialog instead', () => {
      expect(errorOf({...valid, pieces: [valid.pieces[0]]})).toContain('pieces');
    });

    it('accepts 2 and 999 pieces and rejects 1000', () => {
      const piece = (index: number): {fileName: string; svg: string} => ({
        fileName: `Waltz ${index} of 999.svg`,
        svg: PIECE_SVG,
      });
      const pieces = (count: number): {fileName: string; svg: string}[] =>
        Array.from({length: count}, (_, index) => piece(index + 1));

      expect(parseSvgPiecesSaveRequest({...valid, pieces: pieces(2)}).ok).toBe(true);
      expect(parseSvgPiecesSaveRequest({...valid, pieces: pieces(999)}).ok).toBe(true);
      expect(errorOf({...valid, pieces: pieces(1000)})).toContain('pieces');
    });

    it('rejects a piece that is not a plain object', () => {
      expect(errorOf({...valid, pieces: [valid.pieces[0], 'Waltz 2 of 2.svg']})).toContain('pieces');
    });

    it.each(['fileName', 'svg'] as const)('rejects a piece without %s', (field) => {
      const {[field]: _omitted, ...rest} = valid.pieces[0];
      expect(errorOf({...valid, pieces: [rest, valid.pieces[1]]})).toContain(field);
    });

    it('rejects a piece with an extra field', () => {
      const extra = {...valid.pieces[0], filePath: 'C:\\Users\\x.svg'};
      expect(parseSvgPiecesSaveRequest({...valid, pieces: [extra, valid.pieces[1]]}).ok).toBe(false);
    });
  });

  describe('fileName of each piece', () => {
    it.each(['../evil.svg', 'a/b.svg', 'C:\\x.svg', 'a\\b.svg', 'C:x.svg', '...svg', '.svg', 'a.txt', 'abc', 'a\u0000b.svg', 'a\nb.svg', 'a?b.svg', 'CON.svg', 'nul.SVG', 'a<b>.svg', 'a|b.svg'])(
      'rejects %j',
      (name) => {
        expect(errorOf(withNames(name, 'Waltz 2 of 2.svg'))).toContain('fileName');
      },
    );

    it('accepts 5 characters and rejects 256', () => {
      expect(parseSvgPiecesSaveRequest(withNames('a.svg', 'Waltz 2 of 2.svg')).ok).toBe(true);
      expect(errorOf(withNames(`${'a'.repeat(252)}.svg`, 'Waltz 2 of 2.svg'))).toContain('fileName');
    });

    it('rejects two names that differ only in case', () => {
      expect(errorOf(withNames('Waltz 1 of 2.svg', 'waltz 1 OF 2.svg'))).toContain('fileName');
    });

    it('accepts distinct names', () => {
      expect(parseSvgPiecesSaveRequest(withNames('Waltz 1 of 2.svg', 'Waltz 2 of 2.svg')).ok).toBe(true);
    });
  });

  describe('svg of each piece', () => {
    it.each(['', 'plain text', '<svg xmlns="x"></svg>', '<?xml version="1.0"?><g></g>', '<?xml?><svg></svg>'])(
      'rejects %j',
      (svg) => {
        expect(errorOf({...valid, pieces: [{fileName: 'Waltz 1 of 2.svg', svg}, valid.pieces[1]]})).toContain('svg');
      },
    );

    it('rejects a sum of the pieces above 64 x 2^20 characters, though each piece is within it', () => {
      const prefix = '<?xml?><svg ';
      const half = MAXIMUM_SVG_LENGTH_SUM / 2;
      const atHalf = prefix + 'a'.repeat(half - prefix.length);
      const first = {fileName: 'Waltz 1 of 2.svg', svg: atHalf};

      expect(parseSvgPiecesSaveRequest({...valid, pieces: [first, {fileName: 'Waltz 2 of 2.svg', svg: atHalf}]}).ok).toBe(
        true,
      );
      expect(
        errorOf({...valid, pieces: [first, {fileName: 'Waltz 2 of 2.svg', svg: `${atHalf}a`}]}),
      ).toContain('svg');
    });
  });

  describe.each(TEXT_FIELDS)('%s', (field) => {
    it('rejects empty, over 200 characters and control characters', () => {
      expect(errorOf({...valid, [field]: ''})).toContain(field);
      expect(errorOf({...valid, [field]: textOfLength(field, 201)})).toContain(field);
      expect(errorOf({...valid, [field]: 'a\u0000b'})).toContain(field);
      expect(errorOf({...valid, [field]: 'a\nb'})).toContain(field);
    });

    it('accepts the shortest and 200 characters', () => {
      const shortest = field === 'replaceMoreLine' ? MORE_COUNT_PLACEHOLDER : 'a';
      expect(parseSvgPiecesSaveRequest({...valid, [field]: shortest}).ok).toBe(true);
      expect(parseSvgPiecesSaveRequest({...valid, [field]: textOfLength(field, 200)}).ok).toBe(true);
    });
  });

  describe('replaceMoreLine', () => {
    it('rejects a line without the {count} placeholder', () => {
      expect(errorOf({...valid, replaceMoreLine: '… and more'})).toContain('replaceMoreLine');
    });

    it('rejects a line with the {count} placeholder more than once', () => {
      expect(errorOf({...valid, replaceMoreLine: '… {count} and {count} more'})).toContain('replaceMoreLine');
    });
  });
});
