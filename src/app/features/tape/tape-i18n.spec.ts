import type {HoleChange, SongRejection, TapeViolationCode} from '@api/index';
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
const holeChangeKinds: Record<HoleChange['kind'], true> = {
  'overlap-merged': true,
  lengthened: true,
  shortened: true,
  'repetition-merged': true,
};

const groups: readonly {name: string; prefix: string; kinds: readonly string[]}[] = [
  {name: 'SongRejection', prefix: 'TAPE.SONG_REJECTION', kinds: Object.keys(songRejections)},
  {name: 'TapeViolationCode', prefix: 'TAPE.VIOLATION', kinds: Object.keys(tapeViolationCodes)},
  {name: 'HoleChange', prefix: 'TAPE.SUMMARY.HOLE_CHANGE', kinds: Object.keys(holeChangeKinds)},
];

describe('Tape texts', () => {
  for (const {name, prefix, kinds} of groups) {
    describe(`for every ${name}`, () => {
      for (const kind of kinds) {
        const key = `${prefix}.${keyOf(kind)}`;

        it(`${kind} has an English text at ${key}`, () => {
          expect(textAt(en as TranslationTree, key)).toBeTruthy();
        });

        it(`${kind} has a German text at ${key} that differs from the English one`, () => {
          const german = textAt(de as TranslationTree, key);
          expect(german).toBeTruthy();
          expect(german).not.toBe(textAt(en as TranslationTree, key));
        });
      }
    });
  }
});
