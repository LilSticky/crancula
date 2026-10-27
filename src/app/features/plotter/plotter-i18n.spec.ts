import type {PlotterViolationCode} from '@api/index';
import de from '../../../assets/i18n/de.json';
import en from '../../../assets/i18n/en.json';

type TranslationTree = { readonly [key: string]: string | TranslationTree };

function textAt(tree: TranslationTree, path: string): string | undefined {
  let node: string | TranslationTree | undefined = tree;
  for (const segment of path.split('.')) {
    node = typeof node === 'string' || node === undefined ? undefined : node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function keyOf(kind: string): string {
  return kind.toUpperCase().replaceAll('-', '_');
}

/** Every text key under `path` (dotted, relative to the root), with its full dotted path. */
function leavesUnder(tree: TranslationTree, path: string): readonly string[] {
  const collect = (node: string | TranslationTree, prefix: string): string[] =>
    typeof node === 'string' ? [prefix] : Object.entries(node).flatMap(([name, child]) => collect(child, `${prefix}.${name}`));
  let node: string | TranslationTree | undefined = tree;
  for (const segment of path.split('.')) {
    node = typeof node === 'string' || node === undefined ? undefined : node[segment];
  }
  return node === undefined ? [] : collect(node, path);
}

/** Every text key under `TAPE.EXPORT` that belongs to the pieces of a Tape or the too-wide reason. */
function pieceExportKeys(tree: TranslationTree): readonly string[] {
  return leavesUnder(tree, 'TAPE.EXPORT').filter((key) => /^TAPE\.EXPORT\.(PIECES_|PIECE_LABEL$|TOO_WIDE$)/.test(key));
}

// Records make the list exhaustive: a new code fails to compile until it is listed here.
const plotterViolationCodes: Record<PlotterViolationCode, true> = {
  'name-required': true,
  'value-required': true,
  'must-be-positive': true,
  'overlap-not-below-working-length': true,
};

const englishTree = en as TranslationTree;
const germanTree = de as TranslationTree;

const plotterKeys = leavesUnder(englishTree, 'PLOTTER');
const tapePlotterKeys = leavesUnder(englishTree, 'TAPE.PLOTTER');
const noJoinKey = 'TAPE.CUTTING_PROBLEM.NO_JOIN';
const pieceKeys = pieceExportKeys(englishTree);

describe('Plotter texts', () => {
  for (const key of plotterKeys) {
    it(`${key} exists in English and German and is not empty`, () => {
      expect(textAt(englishTree, key)?.trim() ?? '').not.toBe('');
      expect(textAt(germanTree, key)?.trim() ?? '').not.toBe('');
    });
  }
});

describe('Tape piece texts', () => {
  for (const key of [...tapePlotterKeys, noJoinKey, ...pieceKeys]) {
    it(`${key} exists in English and German and is not empty`, () => {
      expect(textAt(englishTree, key)?.trim() ?? '').not.toBe('');
      expect(textAt(germanTree, key)?.trim() ?? '').not.toBe('');
    });
  }

  it('the piece export keys (PIECES_*, PIECE_LABEL, TOO_WIDE) are all listed', () => {
    expect(pieceKeys.map((key) => key.replace('TAPE.EXPORT.', '')).sort()).toEqual(
      [
        'PIECES_CANCEL',
        'PIECES_DIALOG_BUTTON',
        'PIECES_DIALOG_TITLE',
        'PIECES_FAILED',
        'PIECES_REPLACE',
        'PIECES_REPLACE_MESSAGE',
        'PIECES_REPLACE_MORE',
        'PIECES_SAVED',
        'PIECE_LABEL',
        'TOO_WIDE',
      ].sort(),
    );
  });
});

describe('Plotter violation texts', () => {
  for (const code of Object.keys(plotterViolationCodes)) {
    const key = `PLOTTER.ERROR.${keyOf(code)}`;

    it(`${code} has an English and a German text at ${key}`, () => {
      expect(textAt(englishTree, key)?.trim() ?? '').not.toBe('');
      expect(textAt(germanTree, key)?.trim() ?? '').not.toBe('');
    });
  }
});

describe('Plotter German wording', () => {
  const germanTexts = (paths: readonly string[]): string => paths.map((key) => textAt(germanTree, key) ?? '').join(' ');

  it('names the Working area with Arbeitsbereich', () => {
    expect(germanTexts(['PLOTTER.LIST.WORKING_AREA', 'PLOTTER.EDITOR.WORKING_WIDTH'])).toContain('Arbeitsbereich');
  });

  it('names a Tape piece with Bandstück', () => {
    expect(germanTexts(pieceKeys)).toContain('Bandstück');
  });

  it('names a Join with Klebestelle', () => {
    expect(germanTexts([noJoinKey])).toContain('Klebestelle');
  });

  it('names the Overlap with Klebezugabe', () => {
    expect(germanTexts(['PLOTTER.LIST.OVERLAP', 'PLOTTER.EDITOR.OVERLAP'])).toContain('Klebezugabe');
  });

  it('has its own Cancel text for the Plotter editor, Abbrechen', () => {
    expect(germanTexts(['PLOTTER.EDITOR.CANCEL'])).toBe('Abbrechen');
  });
});
