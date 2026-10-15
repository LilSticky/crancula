import {expect, test, type Page} from '@playwright/test';
import {join} from 'node:path';
import {launchApp, type LaunchedApp} from '../support/launch-app';
import {threePartsWithPercussion} from '../support/midi-file';
import {defineStreetOrgan} from '../support/organ-editor';
import {createTapeFromSong} from '../support/tape-creation';

/** Where the `ux-review` skill expects the screens of the running app. */
const SCREENS = process.env['UX_SCREENS_DIR'] ?? join(__dirname, '../../documentation/design/screens/current');

async function capture(window: Page, name: string): Promise<void> {
  await window.waitForLoadState('networkidle');
  // CSS transitions, CSS animations and Web Animations all show up in getAnimations(); loop in case one starts another.
  await window.evaluate(async () => {
    while (document.getAnimations().length > 0) {
      await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
    }
  });
  await window.screenshot({path: join(SCREENS, `${name}.png`), fullPage: true});
}

test.describe('UX screens', () => {
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
    await launched.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 800));
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('captures every screen', async () => {
    const {window} = launched;

    await capture(window, '01-home');

    await window.getByRole('link', {name: 'Organs'}).click();
    await capture(window, '02-organ-list-empty');

    await window.getByTestId('new-organ').click();
    await window.getByTestId('name').fill('Street organ');
    await window.getByTestId('tape-width').fill('20');
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('name').click();
    await capture(window, '03-organ-editor-invalid');

    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByRole('dialog')).toBeVisible();
    await expect(window.getByRole('button', {name: 'Discard changes'})).toBeVisible();
    await capture(window, '03b-leave-unsaved-dialog');
    await window.getByRole('button', {name: 'Discard changes'}).click();
    await defineStreetOrgan(window);
    await capture(window, '04-organ-editor-filled');

    await window.getByRole('link', {name: 'Organs'}).click();
    await capture(window, '05-organ-list');

    await window.getByRole('link', {name: 'Tapes'}).click();
    await capture(window, '06-tape-list-empty');

    await window.getByRole('link', {name: 'Bring a song onto a tape'}).click();
    await window.getByTestId('song-file').setInputFiles(threePartsWithPercussion());
    await expect(window.getByTestId('name')).not.toHaveValue('');
    await capture(window, '07-tape-import');

    await createTapeFromSong(window, 'Three parts', threePartsWithPercussion());
    await capture(window, '08-tape-view');

    await window.getByRole('link', {name: 'Tapes'}).click();
    await capture(window, '09-tape-list');

    await window.getByTestId('language-switch').locator('[data-language="de"]').click();
    await window.getByRole('link', {name: 'Orgeln'}).click();
    await window.getByTestId('organ').first().click();
    await capture(window, '10-organ-editor-german');
  });
});
