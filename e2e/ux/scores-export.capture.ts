import {expect, test, type Page} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {TapeLibrarySnapshot} from '../../api/tape/tape-library-snapshot';
import {launchApp, type LaunchedApp} from '../support/launch-app';
import {createTapeFromSong, defineOctaveOrgan} from '../support/tape-creation';
import {exportAsScores, openExportMenu} from '../support/tape-export-menu';

/** Where the `ux-review` skill expects the screens of the running app. */
const SCREENS = process.env['UX_SCREENS_DIR'] ?? join(__dirname, '../../documentation/design/screens/current');

const VARIANTS = [
  {language: 'en', scheme: 'system', suffix: ''},
  {language: 'en', scheme: 'dark', suffix: '-dark'},
  {language: 'de', scheme: 'system', suffix: '-german'},
] as const;

async function capture(window: Page, name: string): Promise<void> {
  await expect(window.locator('.mat-mdc-snack-bar-container')).toHaveCount(0);
  await window.waitForLoadState('networkidle');
  // Settle fades and scales (menu, dialog, backdrop); endless animations never finish, so they are ignored.
  await window.waitForFunction(() => {
    const panel = document.querySelector('.mat-mdc-dialog-surface');
    const panelSettled = panel === null || getComputedStyle(panel).opacity === '1';
    return panelSettled && document.getAnimations().every((animation) => animation.effect?.getComputedTiming().endTime === Infinity);
  });
  await window.screenshot({path: join(SCREENS, `${name}.png`), fullPage: true});
}

async function chooseLanguage(window: Page, language: 'en' | 'de'): Promise<void> {
  await window.getByTestId('language-switch').locator(`[data-language="${language}"]`).click();
}

/** Chosen while no dialog is open: a dialog's backdrop takes the click. */
async function chooseScheme(window: Page, scheme: 'dark' | 'system'): Promise<void> {
  await window.getByTestId('scheme-switch').locator(`[data-scheme="${scheme}"]`).click();
  if (scheme === 'dark') await expect(window.locator('html')).toHaveClass(/\bcr-dark\b/);
  else await expect(window.locator('html')).not.toHaveClass(/\bcr-dark\b/);
}

async function cancelScoresExport(window: Page): Promise<void> {
  await window.getByRole('dialog').getByTestId('scores-cancel').click();
  await expect(window.getByRole('dialog')).toHaveCount(0);
}

/** Makes the stored Tape `tapeName` one composed from scratch: its Holes stay, its Song goes. The app is not running. */
async function composeFromScratch(userDataDir: string, tapeName: string): Promise<void> {
  const path = join(userDataDir, 'snapshots', 'tapes.json');
  const snapshot = JSON.parse(await readFile(path, 'utf8')) as TapeLibrarySnapshot;
  const tapes = snapshot.tapes.map((tape) =>
    tape.name === tapeName
      ? {
          id: tape.id,
          name: tape.name,
          organId: tape.organId,
          transposition: tape.transposition,
          columnLength: tape.columnLength,
          crankSpeed: tape.crankSpeed,
          length: tape.length,
          holes: tape.holes,
        }
      : tape,
  );
  await writeFile(path, JSON.stringify({version: 3, songs: [], tapes}));
}

test('captures the screens of Read a tape as Scores', async () => {
  const buffer = await readFile(join(__dirname, '..', 'support', 'waltz-upbeat.musicxml'));
  const waltz = {name: 'waltz-upbeat.musicxml', mimeType: 'application/vnd.recordare.musicxml+xml', buffer};

  let launched: LaunchedApp = await launchApp();
  await launched.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 800));
  await defineOctaveOrgan(launched.window, 'Octave organ');
  await createTapeFromSong(launched.window, 'Waltz', waltz);

  for (const {language, scheme, suffix} of VARIANTS) {
    const {window} = launched;
    await chooseLanguage(window, language);
    await chooseScheme(window, scheme);
    await window.mouse.move(640, 400);

    await openExportMenu(window);
    await capture(window, `29-tape-view-export-menu${suffix}`);
    await window.keyboard.press('Escape');
    await expect(window.getByRole('menu')).toBeHidden();

    // With a Song: "As in the Song: 3/4" and the upbeat prefilled.
    await exportAsScores(window);
    const dialog = window.getByRole('dialog');
    await expect(dialog.getByTestId('scores-time-song')).toBeVisible();
    await capture(window, `30-scores-export-song${suffix}`);

    // Three staves: Add gives split notes until three staves are listed.
    while ((await dialog.getByTestId('scores-staff').count()) < 3) await dialog.getByTestId('scores-split-add').click();
    await capture(window, `30d-scores-export-three-staves${suffix}`);

    // Invalid entries: another Time signature with 0 beats and a negative upbeat.
    await dialog.getByTestId('scores-time-other').click();
    await dialog.getByTestId('scores-beats').fill('0');
    await dialog.getByTestId('scores-upbeat-count').fill('-1');
    await dialog.getByTestId('scores-upbeat-count').blur();
    await expect(dialog.getByTestId('scores-confirm')).toBeDisabled();
    await expect(dialog.locator('mat-error').first()).toBeVisible();
    await capture(window, `30c-scores-export-invalid${suffix}`);
    await cancelScoresExport(window);
  }
  await chooseLanguage(launched.window, 'en');
  await chooseScheme(launched.window, 'system');

  // Without a Song: the Tape composed from scratch; the dialog asks the Time signature.
  await launched.app.close();
  await composeFromScratch(launched.userDataDir, 'Waltz');
  launched = await launchApp(launched.userDataDir);
  await launched.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 800));
  const {window} = launched;
  for (const {language, scheme, suffix} of VARIANTS) {
    await chooseLanguage(window, language);
    await chooseScheme(window, scheme);
    await window.getByTestId('rail-nav').getByRole('link').nth(1).click();
    await window.getByTestId('open-tape').filter({hasText: 'Waltz'}).click();
    await expect(window.getByTestId('tape-name')).toBeVisible();
    await window.mouse.move(640, 400);
    await exportAsScores(window);
    await expect(window.getByRole('dialog').getByTestId('scores-beats')).toBeVisible();
    await capture(window, `30b-scores-export-without-song${suffix}`);
    await cancelScoresExport(window);
  }
  await launched.app.close();
});
