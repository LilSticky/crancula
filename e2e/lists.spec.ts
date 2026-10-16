import {expect, test, type Locator, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {melodyC3ToC5} from './support/midi-file';
import {defineStreetOrgan} from './support/organ-editor';
import {createTapeFromSong} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';

const overflowsSideways = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element.scrollWidth > element.clientWidth + 1);

const documentScrollsSideways = (window: Page): Promise<boolean> =>
  window.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

test.describe('The Organ and Tape lists in Electron', () => {
  test('a fresh app shows the Organ empty state, and the Tape list empty sentence links to New Organ', async () => {
    const {app, window} = await launchApp();

    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByTestId('empty-state')).toContainText('No Organs yet. Describe your Organ: its Tape Bed and Pipes.');
    await expect(window.getByTestId('new-organ')).toHaveCount(1);
    await expect(window.getByTestId('next-step')).toHaveCount(0);

    await window.getByRole('link', {name: 'Tapes'}).click();
    await expect(window.getByTestId('empty-state')).toContainText('A Tape is punched for one Organ: describe your Organ first.');
    await window.getByTestId('empty-new-organ').click();
    await expect(window).toHaveURL(/#?\/organs\/new$/);
    await app.close();
  });

  test('guides from the first Organ to the first Tape and filters the Tape list by Organ', async () => {
    const {app, window} = await launchApp();
    await defineStreetOrgan(window);

    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByTestId('organ')).toHaveText('Street organ');
    await expect(window.getByTestId('next-step')).toContainText('Your Organ is ready. Bring a MIDI Song onto a Tape for it.');
    await expect(window.getByTestId('organ-tapes')).toHaveText('No Tapes');

    await createTapeFromSong(window, 'Scale', melodyC3ToC5());
    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByTestId('next-step')).toHaveCount(0);
    await expect(window.getByTestId('organ-tapes')).toHaveText('1 Tape');

    await window.getByTestId('organ-tapes').click();
    await expect(window).toHaveURL(/#?\/tapes\?organ=[0-9a-f-]{36}$/);
    await expect(window.getByTestId('organ-filter')).toContainText('Street organ');
    await expect(window.getByTestId('tape')).toHaveCount(1);

    await window.getByRole('button', {name: 'Show all Tapes'}).click();
    await expect(window.getByTestId('organ-filter')).toHaveCount(0);
    await expect(window).toHaveURL(/#?\/tapes$/);
    await expect(window.getByTestId('tape')).toHaveCount(1);
    await app.close();
  });

  test('ledger name and Organ cells use the ink colour, the name in the serif brand face, without underline', async () => {
    const {app, window} = await launchApp();
    await defineStreetOrgan(window);
    await createTapeFromSong(window, 'Scale', melodyC3ToC5());
    const ink = await window.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--mat-sys-on-surface)';
      document.body.appendChild(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    const style = (locator: Locator) =>
      locator.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {color: computed.color, decoration: computed.textDecorationLine, family: computed.fontFamily};
      });

    await window.getByRole('link', {name: 'Organs'}).click();
    const organ = await style(window.getByTestId('organ'));
    expect(organ.color).toBe(ink);
    expect(organ.decoration).toBe('none');
    expect(organ.family).toMatch(/serif/i);

    await window.getByRole('link', {name: 'Tapes'}).click();
    const tapeName = await style(window.getByTestId('open-tape'));
    const tapeOrgan = await style(window.getByTestId('tape-organ'));
    expect(tapeName.color).toBe(ink);
    expect(tapeName.decoration).toBe('none');
    expect(tapeName.family).toMatch(/serif/i);
    expect(tapeOrgan.color).toBe(ink);
    expect(tapeOrgan.decoration).toBe('none');
    await app.close();
  });

  test('in German at 1024 x 700 neither ledger scrolls sideways and no facts line overflows', async () => {
    const launched = await launchApp();
    const {app, window} = launched;
    await defineStreetOrgan(window);
    await createTapeFromSong(window, 'Tonleiter', melodyC3ToC5());
    await window.getByTestId('language-switch').locator('[data-language="de"]').click();
    await resizeWindowOrSkip(launched, 1024, 700, true);

    await window.getByRole('link', {name: 'Orgeln'}).click();
    await expect(window.getByTestId('organ-facts')).toBeVisible();
    expect(await documentScrollsSideways(window), 'Organ list document').toBe(false);
    expect(await overflowsSideways(window.locator('table.cr-ledger')), 'Organ ledger').toBe(false);
    expect(await overflowsSideways(window.getByTestId('organ-facts')), 'facts line').toBe(false);
    expect(await overflowsSideways(window.getByTestId('organ-facts').locator('xpath=..')), 'facts cell').toBe(false);

    await window.getByRole('link', {name: 'Lochbänder'}).click();
    await expect(window.getByTestId('tape')).toHaveCount(1);
    expect(await documentScrollsSideways(window), 'Tape list document').toBe(false);
    expect(await overflowsSideways(window.locator('table.cr-ledger')), 'Tape ledger').toBe(false);
    await app.close();
  });
});
