import type {PlotterViolationCode, SideBySideRefusal} from '@api/index';
import de from '../../../../assets/i18n/de.json';
import en from '../../../../assets/i18n/en.json';

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

const englishTree = en as TranslationTree;
const germanTree = de as TranslationTree;

// Records make the lists exhaustive: a new code fails to compile until it is listed here with its text.
const sideBySideRefusalTexts: Record<SideBySideRefusal['code'], string> = {
  'no-plotter': 'TAPE.SIDE_BY_SIDE.REFUSAL.NO_PLOTTER',
  'no-lane': 'TAPE.SIDE_BY_SIDE.REFUSAL.NO_LANE',
  'no-organ': 'TAPE.SIDE_BY_SIDE.REFUSAL.NO_ORGAN',
  'lane-does-not-fit': 'TAPE.SIDE_BY_SIDE.REFUSAL.DOES_NOT_FIT',
  'cutting-problems': 'TAPE.SIDE_BY_SIDE.TAPE_PROBLEM',
};
const plotterViolationCodes: Record<PlotterViolationCode, true> = {
  'name-required': true,
  'value-required': true,
  'must-be-positive': true,
  'must-not-be-negative': true,
  'overlap-not-below-working-length': true,
};

const sideBySideKeys = leavesUnder(englishTree, 'TAPE.SIDE_BY_SIDE');
const cutSideBySideKeys = ['TAPE.LIST.TICK', 'TAPE.LIST.CUT_SIDE_BY_SIDE'] as const;
const tapeSpacingKeys = ['PLOTTER.EDITOR.TAPE_SPACING', 'PLOTTER.EDITOR.TAPE_SPACING_HINT'] as const;

describe('Side-by-side texts', () => {
  it('lists the TAPE.SIDE_BY_SIDE keys', () => {
    expect(sideBySideKeys.length).toBeGreaterThan(0);
  });

  for (const key of [...sideBySideKeys, ...cutSideBySideKeys, ...tapeSpacingKeys]) {
    it(`${key} exists in English and German and is not empty`, () => {
      expect(textAt(englishTree, key)?.trim() ?? '').not.toBe('');
      expect(textAt(germanTree, key)?.trim() ?? '').not.toBe('');
    });
  }

  it('MUST_NOT_BE_NEGATIVE exists in English and German and is not empty', () => {
    const key = 'PLOTTER.ERROR.MUST_NOT_BE_NEGATIVE';
    expect(textAt(englishTree, key)?.trim() ?? '').not.toBe('');
    expect(textAt(germanTree, key)?.trim() ?? '').not.toBe('');
  });
});

describe('Side-by-side refusal texts', () => {
  for (const [code, key] of Object.entries(sideBySideRefusalTexts)) {
    it(`${code} has an English and a German text at ${key}`, () => {
      expect(textAt(englishTree, key)?.trim() ?? '').not.toBe('');
      expect(textAt(germanTree, key)?.trim() ?? '').not.toBe('');
    });
  }
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

describe('Side-by-side German wording', () => {
  const germanTexts = (paths: readonly string[]): string => paths.map((key) => textAt(germanTree, key) ?? '').join(' ');

  it('names a Lane with Bahn', () => {
    expect(germanTexts(leavesUnder(germanTree, 'TAPE.SIDE_BY_SIDE'))).toContain('Bahn');
  });

  it('names the Tape spacing with Bandabstand', () => {
    expect(germanTexts(['PLOTTER.EDITOR.TAPE_SPACING', 'TAPE.SIDE_BY_SIDE.SUBTITLE'])).toContain('Bandabstand');
  });

  it('names the working width with Arbeitsbreite', () => {
    expect(germanTexts(['PLOTTER.EDITOR.WORKING_WIDTH'])).toContain('Arbeitsbreite');
  });

  it('names the Cutting Problems of a Lane with Schnittproblem', () => {
    expect(germanTexts(['TAPE.SIDE_BY_SIDE.LANE_PROBLEMS'])).toContain('Schnittproblem');
  });
});
