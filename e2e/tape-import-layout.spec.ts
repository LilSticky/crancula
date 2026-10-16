import {expect, test, type Locator, type Page} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {longSongWithSixteenParts, threePartsWithPercussion, type MidiFilePayload} from './support/midi-file';
import {saveOrgan} from './support/organ-editor';
import {defineOctaveOrgan} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((element) => {
    const {left, top, right, bottom} = element.getBoundingClientRect();
    return {left, top, right, bottom};
  });

const documentScrolls = (window: Page): Promise<{vertical: boolean; horizontal: boolean}> =>
  window.evaluate(() => {
    const root = document.documentElement;
    return {vertical: root.scrollHeight > window.innerHeight, horizontal: root.scrollWidth > window.innerWidth};
  });

async function expectInViewport(page: Page, locator: Locator): Promise<void> {
  const viewport = await page.evaluate(() => ({width: window.innerWidth, height: window.innerHeight}));
  await expect(locator).toBeVisible();
  const box = await boxOf(locator);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.bottom, JSON.stringify({box, viewport})).toBeLessThanOrEqual(viewport.height + 0.5);
  expect(box.right).toBeLessThanOrEqual(viewport.width + 0.5);
}

const scrollsInside = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element.scrollHeight > element.clientHeight + 1);

/** An Organ with the seven white-key Pipes C4 to B4 only, so the black-key Notes of a Song are Unplayable. */
async function defineWhiteKeyOrgan(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();
  await window.getByTestId('name').fill('White keys');
  await window.getByTestId('tape-width').fill('120');
  await window.getByTestId('hole-diameter').fill('2.5');
  await window.getByTestId('row-spacing').fill('3.5');
  await window.getByTestId('minimum-gap').fill('1.5');
  await window.getByTestId('lead-in').fill('20');
  for (const [row, note] of [60, 62, 64, 65, 67, 69, 71].entries()) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(String(note));
  }
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

/** Opens the import screen in English with the Song, then switches the language. */
async function openImport(launched: LaunchedApp, song: MidiFilePayload, language: 'en' | 'de' = 'en'): Promise<void> {
  const {window} = launched;
  await window.getByRole('link', {name: 'Tapes'}).click();
  await window.getByTestId('new-tape').click();
  await window.getByTestId('song-file').setInputFiles(song);
  await expect(window.getByTestId('song-file-name')).toHaveText(song.name);
  await expect(window.getByTestId('name')).not.toHaveValue('');
  if (language === 'de') await window.getByTestId('language-switch').locator('[data-language="de"]').click();
}

/** A Transposition of +12 moves the Notes of the white-key Organ's range and leaves black keys Unplayable. */
async function transposeAwayFromProposal(window: Page): Promise<void> {
  await window.getByTestId('transposition').fill('12');
  await expect(window.getByTestId('fit-unplayable')).toBeVisible();
}

const SIZES = [
  {width: 1024, height: 700},
  {width: 1280, height: 800},
] as const;

for (const {width, height} of SIZES) {
  test.describe(`The Tape import screen at ${width} x ${height}`, () => {
    for (const language of ['en', 'de'] as const) {
      for (const [label, song, parts] of [
        ['three Parts', threePartsWithPercussion(), 3],
        ['sixteen Parts', longSongWithSixteenParts(), 16],
      ] as const) {
        test(`${language}, ${label}: one screen without document scroll`, async () => {
          const launched = await launchApp();
          const {app, window} = launched;
          try {
            await resizeWindowOrSkip(launched, width, height, true);
            await defineOctaveOrgan(window, 'Layout organ');
            await openImport(launched, song, language);
            await expect(window.getByTestId('part')).toHaveCount(parts);

            const scroll = await documentScrolls(window);
            expect(scroll.vertical, 'document scrolls vertically').toBe(false);
            expect(scroll.horizontal, 'document scrolls horizontally').toBe(false);
            await expectInViewport(window, window.getByTestId('song-sheet'));
            await expectInViewport(window, window.getByTestId('fit-sheet'));
            await expectInViewport(window, window.getByTestId('create-tape'));
            await expect(window.getByTestId('song-file-name')).toHaveText(song.name);

            const partsList = window.getByTestId('parts');
            const partsBox = await boxOf(partsList);
            const transposition = await boxOf(window.getByTestId('transposition'));
            expect(transposition.top - partsBox.bottom, 'gap Parts to Transposition').toBeGreaterThanOrEqual(16);
            if (parts === 16) {
              expect(await scrollsInside(partsList), 'the 16 Parts scroll inside their list').toBe(true);
            } else if (width === 1280) {
              expect(await scrollsInside(partsList), '3 Parts need no inner scroll').toBe(false);
            }
          } finally {
            await app.close();
          }
        });
      }
    }

    test('the expanded Unplayable Notes scroll inside the Fit sheet, not the document', async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      try {
        await resizeWindowOrSkip(launched, width, height, true);
        await defineWhiteKeyOrgan(window);
        await openImport(launched, longSongWithSixteenParts());
        await transposeAwayFromProposal(window);
        const unplayable = window.getByTestId('fit-unplayable');
        await expect(unplayable).toHaveAttribute('aria-expanded', 'false');
        await unplayable.click();
        await expect(unplayable).toHaveAttribute('aria-expanded', 'true');
        await expect(window.getByTestId('fit-note').first()).toBeVisible();

        const scroll = await documentScrolls(window);
        expect(scroll.vertical, 'document scrolls vertically').toBe(false);
        expect(scroll.horizontal, 'document scrolls horizontally').toBe(false);
        await expectInViewport(window, window.getByTestId('create-tape'));
        expect(await scrollsInside(window.getByTestId('fit-notes')), 'the list scrolls inside').toBe(true);
      } finally {
        await app.close();
      }
    });
  });
}

test.describe('The Fit disclosures with the real keyboard', () => {
  async function openWithUnplayableNotes(): Promise<LaunchedApp> {
    const launched = await launchApp();
    await defineWhiteKeyOrgan(launched.window);
    await openImport(launched, longSongWithSixteenParts());
    await transposeAwayFromProposal(launched.window);
    return launched;
  }

  for (const key of ['Enter', 'Space'] as const) {
    test(`${key} toggles fit-moved and fit-unplayable`, async () => {
      const launched = await openWithUnplayableNotes();
      const {app, window} = launched;
      try {
        for (const id of ['fit-moved', 'fit-unplayable'] as const) {
          const disclosure = window.getByTestId(id);
          await expect(disclosure, `${id} has Notes to list`).toHaveAttribute('aria-expanded', 'false');
          await disclosure.focus();
          await expect(disclosure).toBeFocused();
          await window.keyboard.press(key === 'Space' ? ' ' : key);
          await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
          await expect(window.getByTestId('fit-note').first()).toBeVisible();
          await window.keyboard.press(key === 'Space' ? ' ' : key);
          await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
          await expect(window.getByTestId('fit-note')).toHaveCount(0);
        }
      } finally {
        await app.close();
      }
    });
  }

  test('Tab reaches fit-moved and then fit-unplayable', async () => {
    const launched = await openWithUnplayableNotes();
    const {app, window} = launched;
    try {
      await window.getByRole('button', {name: 'One semitone up'}).focus();
      let reachedMoved = false;
      for (let presses = 0; presses < 60 && !reachedMoved; presses++) {
        await window.keyboard.press('Tab');
        reachedMoved = await window.getByTestId('fit-moved').evaluate((element) => element === document.activeElement);
      }
      expect(reachedMoved, 'Tab reaches fit-moved').toBe(true);
      await window.keyboard.press('Tab');
      await expect(window.getByTestId('fit-unplayable')).toBeFocused();
    } finally {
      await app.close();
    }
  });
});
