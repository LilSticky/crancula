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
    // Endless animations (spinners, pulses) never finish; waiting for them would hang.
    const finite = () => document.getAnimations().filter((animation) => animation.playState !== 'finished' && animation.effect?.getComputedTiming().endTime !== Infinity);
    const start = Date.now();
    while (finite().length > 0) {
      if (Date.now() - start > 5000) throw new Error('ANIMS ' + finite().map((a) => `${a.playState}:${(a.effect as KeyframeEffect | null)?.target?.className}:${(a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName}`).join('|'));
      await Promise.race([Promise.allSettled(finite().map((animation) => animation.finished)), new Promise((r) => setTimeout(r, 100))]);
    }
  });
  await window.screenshot({path: join(SCREENS, `${name}.png`), fullPage: true});
}

async function resizeWindow({app}: LaunchedApp, width: number, height: number): Promise<void> {
  await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height), {width, height});
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

    await capture(window, '02-organ-list-empty');

    await window.getByTestId('new-organ').click();
    await window.getByTestId('name').fill('Street organ');
    await window.getByTestId('tape-width').fill('20');
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('save-organ').click();
    await expect(window.getByTestId('error-summary')).toBeVisible();
    await capture(window, '03-organ-editor-invalid');

    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByRole('dialog')).toBeVisible();
    await expect(window.getByRole('dialog').getByRole('button', {name: 'Discard changes'})).toBeVisible();
    // The dialog fades and scales in; settle it (and its backdrop) before the screenshot (#72).
    await window.waitForFunction(() => {
      const panel = document.querySelector('.mat-mdc-dialog-surface');
      return panel !== null && getComputedStyle(panel).opacity === '1' && document.getAnimations().every((animation) => animation.effect?.getComputedTiming().endTime === Infinity);
    });
    await capture(window, '03b-leave-unsaved-dialog');
    await window.getByRole('dialog').getByRole('button', {name: 'Discard changes'}).click();
    await defineStreetOrgan(window);
    await capture(window, '04-organ-editor-filled');

    await window.getByTestId('minimum-gap').fill('2');
    await window.getByTestId('lead-in').fill('20');
    await expect(window.getByTestId('unsaved-dot')).toBeVisible();
    await capture(window, '04b-organ-editor-unsaved');
    await window.getByTestId('discard-changes').click();
    await expect(window.getByTestId('save-organ')).toBeDisabled();

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

    await window.getByTestId('tape-scroll').locator('[data-testid="hole"]').first().click();
    await expect(window.getByTestId('tape-scroll').locator('[data-testid="hole"][aria-selected="true"]')).toHaveCount(1);
    await window.mouse.move(640, 400);
    await capture(window, '08b-tape-view-selected-hole');

    await window.getByRole('link', {name: 'Tapes'}).click();
    await capture(window, '09-tape-list');

    await window.getByTestId('language-switch').locator('[data-language="de"]').click();
    await window.getByRole('link', {name: 'Orgeln'}).click();
    await window.getByTestId('organ').first().click();
    await capture(window, '10-organ-editor-german');

    await window.getByTestId('language-switch').locator('[data-language="en"]').click();
    const schemeSwitch = window.getByTestId('scheme-switch');

    await schemeSwitch.locator('[data-scheme="dark"]').click();
    await expect(window.locator('html')).toHaveClass(/\bcr-dark\b/);
    await window.getByRole('link', {name: 'Tapes'}).click();
    await window.getByTestId('open-tape').first().click();
    await expect(window.getByTestId('tape-name')).toBeVisible();
    await capture(window, '11-tape-view-dark');
    await schemeSwitch.locator('[data-scheme="system"]').click();

    await resizeWindow(launched, 1024, 700);
    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByTestId('new-organ')).toBeVisible();
    // Keep the pointer off the rail so no tooltip is open while capturing.
    await window.mouse.move(640, 400);
    await capture(window, '12-organ-list-compact');

    await window.getByTestId('organ').first().click();
    await expect(window.getByTestId('save-organ')).toBeVisible();
    await window.mouse.move(640, 400);
    await capture(window, '13-organ-editor-compact');

    await window.getByRole('link', {name: 'Tapes'}).click();
    await window.getByTestId('open-tape').first().click();
    await expect(window.getByTestId('tape-name')).toBeVisible();
    await window.mouse.move(640, 400);
    await capture(window, '14-tape-view-compact');

    await resizeWindow(launched, 1280, 800);
    await window.getByTestId('language-switch').locator('[data-language="de"]').click();
    await expect(window.getByTestId('tape-name')).toBeVisible();
    await window.mouse.move(640, 400);
    await capture(window, '15-tape-view-german');
    await window.getByTestId('language-switch').locator('[data-language="en"]').click();
  });
});
