import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test, type Locator, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan, saveOrgan, STREET_ORGAN} from './support/organ-editor';
import {createTapeFromSong, songRepeatingC4} from './support/tape-creation';

/**
 * The Street organ has a Row Span of 107.5 mm on its 120 mm tape. With a Guide margin of 10 mm the
 * guide side is 10 − 2.5 / 2 = 8.75 mm and the far side 120 − 107.5 − 8.75 = 3.75 mm.
 */
const GUIDE_MARGIN = '10';
const GUIDE_SIDE = '8.75';
const FAR_SIDE = '3.75';
const GUIDE_SIDE_MM = 8.75;
const FAR_SIDE_MM = 3.75;
const CENTRED_BORDER = '6.25';
const TAPE_WIDTH_MM = Number(STREET_ORGAN.tapeWidth);
const TOLERANCE_MM = 0.2;
const ORGAN_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';

/** Opens the first Organ of the list in its editor. */
async function openFirstOrgan(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('organ').click();
}

/** The top edge of an element in px, as laid out in the window. */
const topOf = (locator: Locator): Promise<number> => locator.evaluate((element) => element.getBoundingClientRect().top);

/** The bottom edge of an element in px, as laid out in the window. */
const bottomOf = (locator: Locator): Promise<number> => locator.evaluate((element) => element.getBoundingClientRect().bottom);

test.describe('I can set a Guide margin for my organs', () => {
  test('keeps the Guide margin and both Borders after a restart', async () => {
    const first = await launchApp();
    await defineStreetOrgan(first.window);
    await first.window.getByTestId('guide-margin').fill(GUIDE_MARGIN);
    await saveOrgan(first.window);
    await first.app.close();

    const {app, window} = await launchApp(first.userDataDir);
    await openFirstOrgan(window);

    await expect(window.getByTestId('name')).toHaveValue(STREET_ORGAN.name);
    await expect(window.getByTestId('guide-margin')).toHaveValue(GUIDE_MARGIN);
    await expect(window.getByTestId('border-guide-side')).toHaveValue(GUIDE_SIDE);
    await expect(window.getByTestId('border-far-side')).toHaveValue(FAR_SIDE);
    await app.close();
  });

  test('draws the guide side and the far side as Border strips of different heights on the Tape', async () => {
    const {app, window} = await launchApp();
    await defineStreetOrgan(window);
    await window.getByTestId('guide-margin').fill(GUIDE_MARGIN);
    await saveOrgan(window);
    await createTapeFromSong(window, 'Scale', songRepeatingC4('scale.mid', 4));

    const scroll = window.getByTestId('tape-scroll');
    const tape = scroll.locator('rect.tape');
    const guideLine = scroll.getByTestId('border-line').nth(0);
    const farLine = scroll.getByTestId('border-line').nth(1);
    await expect(guideLine).toBeAttached();
    await expect(farLine).toBeAttached();

    // The Tape is drawn TAPE_WIDTH_MM high, so its height in px gives the scale of this view.
    const tapeTop = await topOf(tape);
    const tapeBottom = await bottomOf(tape);
    const pixelsPerMillimetre = (tapeBottom - tapeTop) / TAPE_WIDTH_MM;

    const guideSideMm = ((await bottomOf(guideLine)) - tapeTop) / pixelsPerMillimetre;
    const farSideMm = (tapeBottom - (await topOf(farLine))) / pixelsPerMillimetre;

    expect(Math.abs(guideSideMm - GUIDE_SIDE_MM)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(farSideMm - FAR_SIDE_MM)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(guideSideMm).toBeGreaterThan(farSideMm);
    await app.close();
  });

  test('loads a version 5 snapshot with the rows centred', async () => {
    const seeded = await launchApp();
    await seeded.app.close();
    const snapshots = join(seeded.userDataDir, 'snapshots');
    await mkdir(snapshots, {recursive: true});
    await writeFile(
      join(snapshots, 'organs.json'),
      JSON.stringify({
        version: 5,
        organs: [
          {
            id: ORGAN_ID,
            name: STREET_ORGAN.name,
            tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
            minimumGap: 1.5,
            leadIn: 20,
            tapePerCrankTurn: 120,
            crankSpeedRange: {slowest: 30, fastest: 120},
            pipes: STREET_ORGAN.notes.map((note) => ({note: Number(note)})),
          },
        ],
      }),
    );

    const {app, window} = await launchApp(seeded.userDataDir);
    await openFirstOrgan(window);

    await expect(window.getByTestId('name')).toHaveValue(STREET_ORGAN.name);
    await expect(window.getByTestId('guide-margin')).toHaveValue('');
    await expect(window.getByTestId('border')).toHaveValue(CENTRED_BORDER);
    await app.close();
  });
});
