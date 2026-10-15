import {existsSync, readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

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
  return new RegExp(`${property}\s*:\s*([^;]+);`).exec(block)?.[1]?.trim() ?? '';
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
