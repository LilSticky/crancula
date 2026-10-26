import type {CuttingProblemCode, HoleFix, HoleProblem, SongRejection, TapeViolationCode} from '@api/index';
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
  'too-large': true,
  'not-a-song-source': true,
  pdf: true,
  'not-a-score': true,
  'damaged-archive': true,
  'no-score-in-archive': true,
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
  'no-join': true,
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
    const key = `TAPE.CUTTING_PROBLEM.${keyOf(code)}`;

    it(`${code} has an English and a German text at ${key}`, () => {
      expect(textAt(en as TranslationTree, key)).toBeTruthy();
      expect(textAt(de, key)).toBeTruthy();
    });
  }

  for (const [language, tree] of [['English', en], ['German', de]] as const) {
    it(`has no TAPE.EXPORT.PROBLEM_* key in ${language}`, () => {
      expect(keysUnder(tree as TranslationTree, 'TAPE.EXPORT').filter((name) => name.startsWith('PROBLEM_'))).toEqual([]);
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

const holeProblemCodes: Record<HoleProblem['code'], true> = {
  'no-pipe': true,
  'too-short': true,
  'too-close': true,
  'too-close-previous': true,
};

function leavesUnder(tree: TranslationTree, path: string): readonly string[] {
  const collect = (node: string | TranslationTree, prefix: string): string[] =>
    typeof node === 'string' ? [prefix] : Object.entries(node).flatMap(([name, child]) => collect(child, `${prefix}.${name}`));
  let node: string | TranslationTree | undefined = tree;
  for (const segment of path.split('.')) {
    node = typeof node === 'string' || node === undefined ? undefined : node[segment];
  }
  return node === undefined ? [] : collect(node, path);
}

const englishTerms = /\b(Holes?|Pipes?|Columns?|Cutting Problems?|Minimum Gap|Minimum Hole Length)\b/;

describe('Tape editing texts (FR-018)', () => {
  for (const code of Object.keys(holeProblemCodes)) {
    const key = `TAPE.CUTTING_PROBLEM.${keyOf(code)}`;

    it(`HoleProblem ${code} has an English and a German text at ${key}`, () => {
      expect(textAt(en as TranslationTree, key)).toBeTruthy();
      expect(textAt(de, key)).toBeTruthy();
    });
  }

  it('has the key help TAPE.EDIT.KEYS in English and German', () => {
    expect(textAt(en as TranslationTree, 'TAPE.EDIT.KEYS')).toBe(
      'Alt+arrows move it, Shift+arrows move its end, Alt+Shift+arrows its start, Delete removes it.',
    );
    expect(textAt(de, 'TAPE.EDIT.KEYS')).toBeTruthy();
  });

  for (const group of ['TAPE.EDIT', 'TAPE.ADD_HOLE', 'TAPE.CUTTING_PROBLEMS', 'TAPE.CUTTING_PROBLEM']) {
    for (const key of leavesUnder(en, group)) {
      it(`${key} has a German text that differs from the English one`, () => {
        const german = textAt(de, key);
        expect(german).toBeTruthy();
        expect(german).not.toBe(textAt(en as TranslationTree, key));
      });

      it(`${key} uses the dictionary words in German`, () => {
        expect(textAt(de, key) ?? '').not.toMatch(englishTerms);
      });
    }
  }

  it('German names the Hole, Pipe, Column, Cutting Problem, Minimum Hole Length and Minimum Gap with the dictionary words', () => {
    const german = [
      ...leavesUnder(de, 'TAPE.ADD_HOLE'),
      ...leavesUnder(de, 'TAPE.CUTTING_PROBLEMS'),
      ...leavesUnder(de, 'TAPE.CUTTING_PROBLEM'),
      ...leavesUnder(de, 'TAPE.EDIT'),
    ]
      .map((key) => textAt(de, key) ?? '')
      .join(' ');

    for (const word of ['Loch', 'Pfeife', 'Spalte', 'Schnittproblem', 'Mindestlochlänge', 'Mindestabstand']) {
      expect(german).toContain(word);
    }
  });
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

const scoreHowToKeys = ['TITLE', 'STEP_1', 'STEP_2', 'STEP_3', 'STEP_4', 'STEP_5', 'CLOSE'] as const;
const summaryRowKeys = ['GRACE_NOTES_LEFT_OUT', 'ORNAMENTS_LEFT_OUT'] as const;
const metreModes = ['MAJOR', 'MINOR'] as const;
const metreTonics = ['0', '1', '2', '3', '4', '5', '6', '7', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7'] as const;

describe('Song wording in German', () => {
  it('no German TAPE text calls a Song Lied, as the dictionary calls it Stück', () => {
    const german = [...leavesUnder(de, 'TAPE'), 'ORGAN.LIST.NEXT_STEP'].map((key) => ({key, text: textAt(de, key) ?? ''}));

    expect(german.filter(({text}) => /\bLied(er)?\b/.test(text)).map(({key}) => key)).toEqual([]);
  });
});

describe('Song Source rejection texts (U6, U7)', () => {
  const notAMidiFile = 'TAPE.SONG_REJECTION.NOT_A_MIDI_FILE';

  for (const [language, tree] of [['English', en], ['German', de]] as const) {
    it(`${language} NOT_A_MIDI_FILE does not mention a size or 16 MiB, since too-large says that`, () => {
      expect(textAt(tree as TranslationTree, notAMidiFile)).toBeTruthy();
      expect(textAt(tree as TranslationTree, notAMidiFile)).not.toMatch(/MiB|larger|größer/i);
    });
  }

  it('the German texts under TAPE.SONG_REJECTION say "Notendatei" nowhere', () => {
    const german = leavesUnder(de, 'TAPE.SONG_REJECTION').map((key) => textAt(de, key) ?? '');

    expect(german.filter((text) => /Notendatei/.test(text))).toEqual([]);
  });
});

describe('Score import texts (US6)', () => {
  for (const key of scoreHowToKeys) {
    const path = `TAPE.SCORE_HOW_TO.${key}`;

    it(`${path} has an English and a German text`, () => {
      expect(textAt(en as TranslationTree, path)).toBeTruthy();
      expect(textAt(de, path)).toBeTruthy();
    });
  }

  for (const row of summaryRowKeys) {
    const path = `TAPE.SUMMARY.${row}`;

    it(`${path} has an English and a German text`, () => {
      expect(textAt(en as TranslationTree, path)).toBeTruthy();
      expect(textAt(de, path)).toBeTruthy();
    });
  }

  for (const mode of metreModes) {
    for (const tonic of metreTonics) {
      const path = `TAPE.METRE.TONIC.${mode}.${tonic}`;

      it(`${path} has an English and a German text`, () => {
        expect(textAt(en as TranslationTree, path)).toBeTruthy();
        expect(textAt(de, path)).toBeTruthy();
      });
    }
  }

  for (const section of ['TAPE.SONG_REJECTION', 'TAPE.SCORE_HOW_TO', 'TAPE.SUMMARY', 'TAPE.METRE', 'TAPE.IMPORT']) {
    it(`the German texts under ${section} use no Song, Part or Scores`, () => {
      const german = leavesUnder(de, section).map((key) => textAt(de, key) ?? '');
      for (const text of german) {
        expect(text).not.toMatch(/\b(Songs?|Parts?|Scores?)\b/);
      }
    });
  }

  it('the German Score texts use Stimme, Noten and Notenquelle', () => {
    const german = [...leavesUnder(de, 'TAPE.SUMMARY'), ...leavesUnder(de, 'TAPE.SCORE_HOW_TO'), ...leavesUnder(de, 'TAPE.IMPORT')]
      .map((key) => textAt(de, key) ?? '')
      .join(' ');

    for (const word of ['Stimme', 'Noten', 'Notenquelle']) {
      expect(german).toContain(word);
    }
  });
});
