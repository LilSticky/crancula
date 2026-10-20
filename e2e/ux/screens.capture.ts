import {expect, test, type Page} from '@playwright/test';
import {join} from 'node:path';
import {encodeSmf} from '../../api/song/midi/smf-test-helper';
import {launchApp, type LaunchedApp} from '../support/launch-app';
import {longSongWithSixteenParts, threePartsWithPercussion} from '../support/midi-file';
import {defineStreetOrgan, saveOrgan} from '../support/organ-editor';
import {stubSaveDialog} from '../support/save-dialog';
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

    await window.getByRole('link', {name: 'Tapes'}).click();
    await expect(window.getByTestId('empty-new-organ')).toBeVisible();
    await capture(window, '06b-tape-list-empty-without-organ');
    await window.getByRole('link', {name: 'Organs'}).click();

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

    await window.getByTestId('new-tape').click();
    await window.getByTestId('song-file').setInputFiles(threePartsWithPercussion());
    await expect(window.getByTestId('name')).not.toHaveValue('');
    await expect(window.getByTestId('song-file-name')).toHaveText('three-parts-percussion.mid');
    await capture(window, '07-tape-import');

    await createTapeFromSong(window, 'Three parts', threePartsWithPercussion());
    await capture(window, '08-tape-view');

    await window.getByTestId('tape-scroll').locator('[data-testid="hole"]').first().click();
    await expect(window.getByTestId('tape-scroll').locator('rect.hole.selected')).toHaveCount(1);
    await window.mouse.move(640, 400);
    await capture(window, '08b-tape-view-selected-hole');

    await window.getByRole('link', {name: 'Tapes'}).click();
    await capture(window, '09-tape-list');

    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('organ-tapes').click();
    await expect(window.getByTestId('organ-filter')).toBeVisible();
    await window.mouse.move(640, 400);
    await capture(window, '09b-tape-list-filtered-by-organ');

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

    await resizeWindow(launched, 1024, 700);
    await window.getByRole('link', {name: 'Orgeln'}).click();
    await expect(window.getByTestId('organ-facts')).toBeVisible();
    await window.mouse.move(640, 400);
    await capture(window, '16-organ-list-german-compact');
    await window.getByRole('link', {name: 'Lochbänder'}).click();
    await expect(window.getByTestId('tape').first()).toBeVisible();
    await window.mouse.move(640, 400);
    await capture(window, '17-tape-list-german-compact');
    // Last, so the extra Organ does not show in the other screens: an Organ with the white keys C4 to B4 only.
    await window.getByTestId('language-switch').locator('[data-language="en"]').click();
    await resizeWindow(launched, 1280, 800);
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
    await expect(window).toHaveURL(/\/organs\/[0-9a-f-]{36}$/);
    await expect(window.getByTestId('unsaved-dot')).toBeHidden();

    const song = longSongWithSixteenParts();
    const importWithWhiteKeys = async (): Promise<void> => {
      await window.getByRole('link', {name: 'Tapes'}).click();
      await expect(window.getByRole('dialog')).toBeHidden();
      await expect(window).toHaveURL(/\/tapes$/);
      await window.getByTestId('new-tape').click();
      await window.getByTestId('song-file').setInputFiles(song);
      await expect(window.getByTestId('song-file-name')).toHaveText(song.name);
      await window.getByTestId('organ').selectOption({label: 'White keys'});
      await window.getByTestId('transposition').fill('12');
      await expect(window.locator('button[data-testid="fit-unplayable"]')).toBeVisible();
    };
    await importWithWhiteKeys();
    await window.getByTestId('fit-unplayable').click();
    await expect(window.getByTestId('fit-unplayable')).toHaveAttribute('aria-expanded', 'true');
    await window.mouse.move(640, 400);
    await capture(window, '07b-tape-import-unplayable');

    await resizeWindow(launched, 1024, 700);
    await window.getByTestId('language-switch').locator('[data-language="de"]').click();
    await window.mouse.move(640, 400);
    await capture(window, '07c-tape-import-german-compact');
    await window.getByTestId('language-switch').locator('[data-language="en"]').click();

    // Very last, as it changes the Organ: a Tape whose Hole became too short for the raised hole diameter.
    // Export never opens a save dialog here, because the problems dialog stops it first; stub it anyway.
    await stubSaveDialog(launched.app);
    await resizeWindow(launched, 1280, 800);
    const blip = encodeSmf({
      format: 1,
      division: {ticksPerQuarterNote: 480},
      tracks: [
        {
          events: [
            {delta: 0, event: {type: 'trackName', text: 'Blip'}},
            {delta: 0, event: {type: 'noteOn', channel: 0, note: 60, velocity: 80}},
            {delta: 60, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
          ],
        },
      ],
    });
    await window.getByRole('link', {name: 'Tapes'}).click();
    await expect(window.getByRole('dialog')).toBeHidden();
    await expect(window).toHaveURL(/\/tapes$/);
    await window.getByTestId('new-tape').click();
    await window.getByTestId('song-file').setInputFiles({name: 'blip.mid', mimeType: 'audio/midi', buffer: Buffer.from(blip)});
    await expect(window.getByTestId('song-file-name')).toHaveText('blip.mid');
    await window.getByTestId('organ').selectOption({label: 'White keys'});
    await window.getByTestId('name').fill('Blip');
    await window.getByTestId('create-tape').click();
    await expect(window).toHaveURL(/\/tapes\/[0-9a-f-]{36}$/);

    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('organ').filter({hasText: 'White keys'}).click();
    await window.getByTestId('hole-diameter').fill('4');
    await window.getByTestId('row-spacing').fill('4');
    await saveOrgan(window);
    await window.getByRole('link', {name: 'Tapes'}).click();
    await window.getByTestId('tape').filter({hasText: 'Blip'}).click();
    await expect(window.getByTestId('export')).toBeEnabled();
    await window.getByTestId('export').click();
    await expect(window.getByTestId('export-problem')).toHaveCount(1);
    // The dialog fades and scales in; settle it before the screenshot.
    await window.waitForFunction(() => {
      const panel = document.querySelector('.mat-mdc-dialog-surface');
      return panel !== null && getComputedStyle(panel).opacity === '1';
    });
    await window.mouse.move(640, 400);
    await capture(window, '08c-tape-view-export-problems');

    // The Blip Tape now has a Cutting Problem. Edit it by hand: select its Hole, add a Hole through the form.
    await window.getByRole('dialog').getByRole('button', {name: 'Close'}).click();
    await expect(window.getByRole('dialog')).toBeHidden();
    await expect(window.getByTestId('hole-mark')).toHaveCount(1);
    await window.getByTestId('tape-scroll').locator('[data-testid="hole"]').first().click();
    await window.getByTestId('add-hole-pipe').click();
    await window.getByRole('option').nth(2).click();
    await window.getByTestId('add-hole-column').fill('8');
    await window.getByTestId('add-hole-submit').click();
    await expect(window.getByTestId('undo')).toBeEnabled();
    await window.getByTestId('tape-scroll').locator('[data-testid="hole"]').first().click();
    await expect(window.getByTestId('tape-scroll').locator('rect.hole.selected')).toHaveCount(1);
    await window.mouse.move(640, 400);
    await capture(window, '08d-tape-view-edited');

    const schemeToggle = window.getByTestId('scheme-switch');
    await schemeToggle.locator('[data-scheme="dark"]').click();
    await expect(window.locator('html')).toHaveClass(/\bcr-dark\b/);
    await window.mouse.move(640, 400);
    await capture(window, '08e-tape-view-edited-dark');
    await schemeToggle.locator('[data-scheme="system"]').click();

    // Undo the added Hole: Redo is enabled too.
    await window.getByTestId('undo').click();
    await expect(window.getByTestId('redo')).toBeEnabled();
    await window.mouse.move(640, 400);
    await capture(window, '08f-tape-view-edited-undone');
  });
});
