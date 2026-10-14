import de from '../assets/i18n/de.json';
import en from '../assets/i18n/en.json';

type TranslationTree = { readonly [key: string]: string | TranslationTree };

function keysOf(tree: TranslationTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keysOf(value, `${prefix}${key}.`),
  );
}

describe('translations', () => {
  it('have the same keys in English and German', () => {
    expect(keysOf(de as TranslationTree).sort()).toEqual(keysOf(en as TranslationTree).sort());
  });
});
