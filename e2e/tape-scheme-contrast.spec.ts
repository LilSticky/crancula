import {expect, test, type Page} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {drawnHoles, holeAt} from './support/tape-edit';
import {createTapeFromSong, defineOctaveOrgan, songRepeatingC4} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';

/** WCAG 1.4.3 for the playhead on the Tape. */
const MIN_TAPE_CONTRAST = 4.5;
/** WCAG 1.4.11: the playhead grip is non-text UI, drawn on the page background of the ruler band. */
const MIN_NON_TEXT_CONTRAST = 3;

type Scheme = 'light' | 'dark';

interface Rgb {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

function parseRgb(text: string): Rgb {
  const [red, green, blue] = (text.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  if (red === undefined || green === undefined || blue === undefined) throw new Error(`not an rgb colour: ${text}`);
  return {red, green, blue};
}

function luminance({red, green, blue}: Rgb): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  if (r === undefined || g === undefined || b === undefined) throw new Error('unreachable');
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG 2.x contrast ratio of two colours, each as the rgb() text that getComputedStyle returns. */
function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(parseRgb(first)), luminance(parseRgb(second))].sort((a, b) => b - a);
  if (light === undefined || dark === undefined) throw new Error('unreachable');
  return (light + 0.05) / (dark + 0.05);
}

interface PaintedColours {
  /** The manila of the Tape. */
  readonly tape: string;
  /** The visible triangle of the playhead grip, on the ruler band. */
  readonly playheadGrip: string;
  /** The playhead line, across the Tape. */
  readonly playhead: string;
  /** The page background behind the ruler band, which is transparent in the drawing. */
  readonly pageBackground: string;
}

/** The painted colours of the Tape drawing, as the browser computes them. */
async function paintedColours(window: Page): Promise<PaintedColours> {
  return window.evaluate(() => {
    const drawing = document.querySelector('[data-testid="tape-scroll"] svg');
    const tape = drawing?.querySelector('rect.tape');
    const playheadGrip = drawing?.querySelector('.playhead-grip-mark');
    const playhead = drawing?.querySelector('[data-testid="playhead"]');
    if (!tape || !playheadGrip || !playhead) throw new Error('the Tape, the playhead grip or the playhead is not drawn');
    return {
      tape: getComputedStyle(tape).fill,
      playheadGrip: getComputedStyle(playheadGrip).fill,
      playhead: getComputedStyle(playhead).fill,
      pageBackground: getComputedStyle(document.body).backgroundColor,
    };
  });
}

/** Defines an Organ and a Tape in the given scheme, selects a Hole and shows the playhead. */
async function openTapeInScheme(scheme: Scheme): Promise<LaunchedApp> {
  const launched = await launchApp();
  const {window} = launched;
  await resizeWindowOrSkip(launched, 1280, 800);
  await window.getByTestId('scheme-switch').locator(`[data-scheme="${scheme}"]`).click();
  await expect(window.locator('html')).toHaveClass(new RegExp(`\\bcr-${scheme}\\b`));
  await defineOctaveOrgan(window, 'Octave organ');
  await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4), {columnLength: '1.25'});
  const [first] = [...(await drawnHoles(window))].sort((a, b) => a.row - b.row || a.start - b.start);
  if (!first) throw new Error('expected Holes');
  await holeAt(window, first.row, first.start).click();
  await expect(holeAt(window, first.row, first.start)).toHaveClass(/selected/);
  await expect(window.locator('[data-testid="tape-scroll"] svg [data-testid="playhead"]')).toHaveCount(1);
  return launched;
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`The ${scheme} scheme`, () => {
    test('the playhead has at least 4.5:1 against the Tape', async () => {
      const launched = await openTapeInScheme(scheme);
      try {
        const colours = await paintedColours(launched.window);
        expect(contrastRatio(colours.playhead, colours.tape)).toBeGreaterThanOrEqual(MIN_TAPE_CONTRAST);
      } finally {
        await launched.app.close();
      }
    });

    test('the playhead grip has at least 3:1 against the page background (non-text)', async () => {
      const launched = await openTapeInScheme(scheme);
      try {
        const colours = await paintedColours(launched.window);
        expect(contrastRatio(colours.playheadGrip, colours.pageBackground)).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
      } finally {
        await launched.app.close();
      }
    });
  });
}
