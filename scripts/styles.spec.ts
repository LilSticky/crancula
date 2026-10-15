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
    // [^}]* cannot see nested rules, so only flat compiled `html { ... }` blocks match; html.cr-dark etc.
    // and rules inside @media are compiled to their own blocks and are read separately.
    htmlRules = [...css.matchAll(/(?:^|\})\s*html\s*\{([^}]*)\}/g)].map(([, block = '']) => block).join('\n');
  }, 60_000);

  /** The declarations of the flat compiled block(s) with exactly this selector (same [^}]* limit as above). */
  function block(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...css.matchAll(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g'))]
      .map(([, body = '']) => body)
      .join('\n');
  }

  /** The value that wins in the cascade: the last declaration of the property on html. */
  function htmlToken(name: string): string {
    const values = [...htmlRules.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, 'g'))].map((match) => match[1] ?? '');
    return values.at(-1)?.replace(/\s+/g, ' ').trim() ?? '';
  }

  it('follows the system colour scheme on html', () => {
    expect(htmlToken('color-scheme')).toBe('light dark');
  });

  it.each([
    ['html.cr-light', 'light'],
    ['html.cr-dark', 'dark'],
  ])('%s forces color-scheme %s', (selector, scheme) => {
    expect(declaration(block(selector), 'color-scheme')).toBe(scheme);
  });

  it('overrides a --mat-sys token on html under prefers-contrast: more', () => {
    const media = /@media\s*\(prefers-contrast:\s*more\)\s*\{\s*html\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(media).toMatch(/--mat-sys-[\w-]+\s*:/);
  });

  // Expected values: the theme-overrides block in documentation/design/theme.scss.
  it('sets --mat-sys-surface to the bench colours', () => {
    expect(htmlToken('--mat-sys-surface')).toBe('light-dark(#d6d0c4, #1c1916)');
  });

  it('sets --mat-sys-primary to the ink colours', () => {
    expect(htmlToken('--mat-sys-primary')).toBe('light-dark(#1e1a16, #ede6d8)');
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

  /** The hex colours a token resolves to: both values of `light-dark(a, b)`, or the one plain colour. */
  function colours(name: string): readonly string[] {
    return htmlToken(name).match(/#[0-9a-f]{6}\b/gi) ?? [];
  }

  /** WCAG 2.x relative luminance of a #rrggbb colour. */
  function luminance(hex: string): number {
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
      const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
  }

  it.each([
    ['--cr-walnut-edge', 3],
    ['--cr-walnut-muted', 4.5],
  ])('keeps %s at a contrast of at least %s:1 on both values of --cr-walnut', (token, minimum) => {
    const walnut = colours('--cr-walnut');
    const foreground = colours(token);
    expect(walnut).toHaveLength(2);
    expect(foreground.length).toBeGreaterThan(0);
    const ratios = walnut.flatMap((background) =>
      foreground.map((colour) => ({background, colour, ratio: Math.round(contrast(colour, background) * 100) / 100})),
    );
    expect(ratios.filter(({ratio}) => ratio < minimum)).toEqual([]);
  });
});
