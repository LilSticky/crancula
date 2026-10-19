import type {CuttingProblemCode, HoleFix, SongRejection, TapeViolationCode} from '@api/index';
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

// Records make the lists exhaustive: a new kind fails to compile until it is listed here.
const songRejections: Record<SongRejection, true> = {
  'not-a-midi-file': true,
  'format-2': true,
  'not-timed-in-beats': true,
  'no-notes': true,
};
const tapeViolationCodes: Record<TapeViolationCode, true> = {
  'name-required': true,
  'column-length-must-be-positive': true,
  'no-part-selected': true,
  'transposition-out-of-range': true,
  'no-note-on-a-pipe': true,
};
const holeFixKinds: Record<HoleFix['kind'], true> = {
  'overlap-merged': true,
  lengthened: true,
  shortened: true,
  'repetition-merged': true,
};

const groups: readonly {name: string; prefix: string; kinds: readonly string[]}[] = [
  {name: 'SongRejection', prefix: 'TAPE.SONG_REJECTION', kinds: Object.keys(songRejections)},
  {name: 'TapeViolationCode', prefix: 'TAPE.VIOLATION', kinds: Object.keys(tapeViolationCodes)},
  {name: 'HoleFix', prefix: 'TAPE.SUMMARY.HOLE_FIX', kinds: Object.keys(holeFixKinds)},
];

const cuttingProblemCodes: Record<CuttingProblemCode, true> = {
  'no-pipe': true,
  'too-short': true,
  'too-close': true,
};

function keysUnder(tree: TranslationTree, path: string): readonly string[] {
  let node: string | TranslationTree | undefined = tree;
  for (const segment of path.split('.')) {
    node = typeof node === 'string' || node === undefined ? undefined : node[segment];
  }
  return typeof node === 'object' ? Object.keys(node) : [];
}

describe('Tape export texts', () => {
  for (const code of Object.keys(cuttingProblemCodes)) {
    const key = `TAPE.EXPORT.PROBLEM_${keyOf(code)}`;

    it(`${code} has an English and a German text at ${key}`, () => {
      expect(textAt(en as TranslationTree, key)).toBeTruthy();
      expect(textAt(de, key)).toBeTruthy();
    });
  }

  for (const name of keysUnder(en, 'TAPE.EXPORT')) {
    const key = `TAPE.EXPORT.${name}`;

    it(`${key} has a German text that differs from the English one`, () => {
      const german = textAt(de, key);
      expect(german).toBeTruthy();
      expect(german).not.toBe(textAt(en as TranslationTree, key));
    });
  }

  it('has no TAPE.EXPORT key in German that English lacks', () => {
    expect([...keysUnder(de, 'TAPE.EXPORT')].sort()).toEqual([...keysUnder(en as TranslationTree, 'TAPE.EXPORT')].sort());
  });

  for (const [language, tree] of [['English', en], ['German', de]] as const) {
    it(`has no TAPE.VIEW.EXPORT_LATER in ${language}`, () => {
      expect(textAt(tree as TranslationTree, 'TAPE.VIEW.EXPORT_LATER')).toBeUndefined();
    });
  }
});

describe('Tape texts', () => {
  for (const {name, prefix, kinds} of groups) {
    describe(`for every ${name}`, () => {
      for (const kind of kinds) {
        const key = `${prefix}.${keyOf(kind)}`;

        it(`${kind} has an English text at ${key}`, () => {
          expect(textAt(en as TranslationTree, key)).toBeTruthy();
        });

        it(`${kind} has a German text at ${key} that differs from the English one`, () => {
          const german = textAt(de, key);
          expect(german).toBeTruthy();
          expect(german).not.toBe(textAt(en as TranslationTree, key));
        });
      }
    });
  }
});
