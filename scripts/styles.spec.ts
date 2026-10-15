import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from 'sass';
import {beforeAll, describe, expect, it} from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontsScss = resolve(root, 'src/styles/_fonts.scss');
const licenceDir = resolve(root, 'src/assets/fonts');

interface FontFace {
  readonly family: string;
  readonly weight: string;
  readonly urls: readonly string[];
  readonly unicodeRange: string;
}

function declaration(block: string, property: string): string {
  return new RegExp(`${property}\\s*:\\s*([^;]+);`).exec(block)?.[1]?.trim() ?? '';
}

function fontFaces(): readonly FontFace[] {
  const scss = readFileSync(fontsScss, 'utf8');
  return [...scss.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, block = '']) => ({
    family: declaration(block, 'font-family').replace(/['"]/g, ''),
    weight: declaration(block, 'font-weight'),
    urls: [...block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(([, url = '']) => url),
    unicodeRange: declaration(block, 'unicode-range'),
  }));
}

describe('bundled fonts (src/styles/_fonts.scss)', () => {
  it('points every url() to an existing file', () => {
    const urls = fontFaces().flatMap((face) => face.urls);
    expect(urls.length).toBeGreaterThan(0);
    const missing = urls.filter((url) => !existsSync(resolve(dirname(fontsScss), url)));
    expect(missing).toEqual([]);
  });

  it('declares Libertinus Serif at weight 600', () => {
    const faces = fontFaces().filter((face) => face.family === 'Libertinus Serif');
    expect(faces.map((face) => face.weight)).toContain('600');
  });

  it('declares Noto Sans for weights 400 to 600 in a latin and a latin-ext face', () => {
    const faces = fontFaces().filter((face) => face.family === 'Noto Sans');
    expect(faces.length).toBeGreaterThanOrEqual(2);
    expect(faces.every((face) => face.weight === '400 600')).toBe(true);
    expect(faces.some((face) => face.unicodeRange.includes('U+0000-00FF'))).toBe(true);
    expect(faces.some((face) => face.unicodeRange.includes('U+0100-'))).toBe(true);
  });

  it('declares Material Icons', () => {
    expect(fontFaces().map((face) => face.family)).toContain('Material Icons');
  });

  it('leaves no Roboto face', () => {
    expect(fontFaces().map((face) => face.family)).not.toContain('Roboto');
  });

  it.each(['OFL-LibertinusSerif.txt', 'OFL-NotoSans.txt', 'LICENSE-MaterialIcons.txt'])(
    'ships the licence text %s',
    (file) => {
      expect(existsSync(resolve(licenceDir, file))).toBe(true);
    },
  );
});

describe('theme (src/styles.scss)', () => {
  let css = '';
  let htmlRules = '';

  beforeAll(() => {
    css = compile(resolve(root, 'src/styles.scss'), {
      loadPaths: [resolve(root, 'node_modules'), resolve(root, 'src')],
      quietDeps: true,
    }).css;
    // `[^}]*` only sees flat rules: compiled CSS is flat apart from @media, whose nested html rules are not matched.
    htmlRules = [...css.matchAll(/(?:^|\})\s*html\s*\{([^}]*)\}/g)].map(([, block = '']) => block).join('\n');
  }, 60_000);

  /** The value that wins in the cascade: the last declaration of the property on html. */
  function htmlToken(name: string): string {
    const values = [...htmlRules.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, 'g'))].map((match) => match[1] ?? '');
    return values.at(-1)?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('follows the system colour scheme on html', () => {
    expect(htmlToken('color-scheme')).toBe('light dark');
  });

  // Expected values: the theme-overrides block in documentation/design/theme.scss.
  it('sets --mat-sys-surface to the bench colours', () => {
    expect(htmlToken('--mat-sys-surface')).toBe('light-dark(#d6d0c4, #1c1916)');
  });

  it('sets --mat-sys-primary to the ink colours', () => {
    expect(htmlToken('--mat-sys-primary')).toBe('light-dark(#1e1a16, #ede6d8)');
  });

  it('forces the light scheme on html.cr-light and the dark scheme on html.cr-dark', () => {
    expect(css).toMatch(/html\.cr-light\s*\{[^}]*color-scheme:\s*light\s*;/);
    expect(css).toMatch(/html\.cr-dark\s*\{[^}]*color-scheme:\s*dark\s*;/);
  });

  it('sets Material tokens on html for prefers-contrast: more', () => {
    expect(css).toMatch(/@media\s*\(prefers-contrast:\s*more\)\s*\{\s*html\s*\{[^}]*--mat-sys-/);
  });

  it('uses Noto Sans as the plain typeface', () => {
    expect(htmlToken('--mat-sys-body-medium-font')).toContain('Noto Sans');
  });

  it('uses Libertinus Serif as the brand typeface', () => {
    expect(htmlToken('--mat-sys-headline-small-font')).toContain('Libertinus Serif');
  });

  it('references no Roboto', () => {
    expect(css).not.toMatch(/roboto/i);
  });
});
