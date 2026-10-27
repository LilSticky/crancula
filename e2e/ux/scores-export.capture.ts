import {expect, test, type Page} from '@playwright/test';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {TapeLibrarySnapshot} from '../../api/tape/tape-library-snapshot';
import {encodeSmf, type SmfTimedEvent} from '../../api/song/midi/smf-test-helper';
import {launchApp, type LaunchedApp} from '../support/launch-app';
import {type MidiFilePayload} from '../support/midi-file';
import {stubSaveDialog, type SaveDialogStub} from '../support/save-dialog';
import {createTapeFromSong, defineOctaveOrgan} from '../support/tape-creation';
import {exportAsScores, openExportMenu} from '../support/tape-export-menu';

/** Where the `ux-review` skill expects the screens of the running app. */
const SCREENS = process.env['UX_SCREENS_DIR'] ?? join(__dirname, '../../documentation/design/screens/current');

const TICKS_PER_QUARTER = 480;

const VARIANTS = [
  {language: 'en', scheme: 'system', suffix: ''},
  {language: 'en', scheme: 'dark', suffix: '-dark'},
  {language: 'de', scheme: 'system', suffix: '-german'},
] as const;

/** Captures the screen. With `snackBarShown`, a snackbar must be visible; otherwise none may be. */
async function capture(window: Page, name: string, snackBarShown = false): Promise<void> {
  const snackBars = window.locator('.mat-mdc-snack-bar-container');
  if (snackBarShown) await expect(snackBars).toBeVisible();
  else await expect(snackBars).toHaveCount(0);
  await window.waitForLoadState('networkidle');
  // Settle fades and scales (menu, dialog, backdrop); endless animations never finish, so they are ignored, and so are
  // finished ones, which a snackbar without a timeout keeps in the list.
  await window.waitForFunction(() => {
    const panel = document.querySelector('.mat-mdc-dialog-surface');
    const panelSettled = panel === null || getComputedStyle(panel).opacity === '1';
    return (
      panelSettled &&
      document.getAnimations().every((animation) => animation.playState === 'finished' || animation.effect?.getComputedTiming().endTime === Infinity)
    );
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

/** Opens the stored Tape `name` from the Tapes list and waits for its page. */
async function openTapeNamed(window: Page, name: string): Promise<void> {
  await window.getByTestId('rail-nav').getByRole('link').nth(1).click(); // The Tapes list: its name is translated.
  await window.getByTestId('open-tape').filter({hasText: name}).click();
  await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText(name);
}

/**
 * Makes the stored Tape `tapeName` one composed from scratch: its Holes stay, its Song goes, the other Songs stay.
 * The app is not running.
 */
async function composeFromScratch(userDataDir: string, tapeName: string): Promise<void> {
  const path = join(userDataDir, 'snapshots', 'tapes.json');
  const snapshot = JSON.parse(await readFile(path, 'utf8')) as TapeLibrarySnapshot;
  const songId = snapshot.tapes.find((tape) => tape.name === tapeName)?.songId;
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
  await writeFile(path, JSON.stringify({version: 3, songs: snapshot.songs.filter((song) => song.id !== songId), tapes}));
}

/**
 * A Song of 3/64 with three quarter notes: its Bars do not fall on whole Columns, so the Scores dialog cannot keep
 * that Time signature and says so.
 */
function sixtyFourthsSong(): MidiFilePayload {
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'timeSignature', beats: 3, beatType: 64}}];
  for (const note of [60, 62, 64]) {
    events.push(
      {delta: events.length === 1 ? 0 : TICKS_PER_QUARTER, event: {type: 'noteOn', channel: 0, note, velocity: 80}},
      {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel: 0, note, velocity: 0}},
    );
  }
  const bytes = encodeSmf({format: 1, division: {ticksPerQuarterNote: TICKS_PER_QUARTER}, tracks: [{events}]});
  return {name: 'sixty-fourths.mid', mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

test('captures the screens of Read a tape as Scores', async () => {
  const buffer = await readFile(join(__dirname, '..', 'support', 'waltz-upbeat.musicxml'));
  const waltz = {name: 'waltz-upbeat.musicxml', mimeType: 'application/vnd.recordare.musicxml+xml', buffer};
  const folder = await mkdtemp(join(tmpdir(), 'crancula-ux-scores-'));

  let launched: LaunchedApp = await launchApp();
  await launched.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 800));
  const saves: SaveDialogStub = await stubSaveDialog(launched.app);
  await defineOctaveOrgan(launched.window, 'Octave organ');
  await createTapeFromSong(launched.window, 'Sixty-fourths', sixtyFourthsSong());
  await createTapeFromSong(launched.window, 'Waltz', waltz);

  for (const {language, scheme, suffix} of VARIANTS) {
    const {window} = launched;
    const snackBars = window.locator('.mat-mdc-snack-bar-container');
    const dialog = window.getByRole('dialog');
    await chooseLanguage(window, language);
    await chooseScheme(window, scheme);
    await window.mouse.move(640, 400);

    await openExportMenu(window);
    await capture(window, `29-tape-view-export-menu${suffix}`);
    await window.keyboard.press('Escape');
    await expect(window.getByRole('menu')).toBeHidden();

    // With a Song: "As in the Song: 3/4" and the upbeat prefilled.
    await exportAsScores(window);
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

    // Equal split notes: Add gives C4 and then one octave below; the second split note is moved to C4 as well.
    await exportAsScores(window);
    await dialog.getByTestId('scores-split-add').click();
    await dialog.getByTestId('scores-split-add').click();
    await dialog.getByTestId('scores-split-note').nth(1).click();
    await window.getByRole('option', {name: 'C4', exact: true}).click();
    await expect(dialog.getByTestId('scores-confirm')).toBeDisabled();
    await expect(dialog.locator('mat-error').first()).toBeVisible();
    await capture(window, `30e-scores-export-equal-split-notes${suffix}`);
    await cancelScoresExport(window);

    // Saved: the Scores are written to the chosen file, and the snackbar names it.
    await saves.answerWith(join(folder, 'Waltz.musicxml'));
    await exportAsScores(window);
    await dialog.getByTestId('scores-confirm').click();
    await capture(window, `30g-scores-export-saved${suffix}`, true);
    await expect(snackBars).toHaveCount(0, {timeout: 15000});

    // Failed: the chosen folder does not exist, so the snackbar stays with Try again until it is answered.
    await saves.answerWith(join(folder, 'missing', 'Waltz.musicxml'));
    await exportAsScores(window);
    await dialog.getByTestId('scores-confirm').click();
    await capture(window, `30h-scores-export-failed${suffix}`, true);
    await saves.answerWith(join(folder, 'Waltz.musicxml'));
    await snackBars.getByRole('button').click();
    await expect(snackBars).toHaveCount(0, {timeout: 15000});

    // Metre not on Columns: the Tape of the 3/64 Song asks the Time signature, with the hint and no "As in the Song".
    await openTapeNamed(window, 'Sixty-fourths');
    await window.mouse.move(640, 400);
    await exportAsScores(window);
    await expect(dialog.getByTestId('scores-song-metre-hint')).toBeVisible();
    await expect(dialog.getByTestId('scores-time-song')).toHaveCount(0);
    await capture(window, `30f-scores-export-metre-not-on-columns${suffix}`);
    await cancelScoresExport(window);
    await openTapeNamed(window, 'Waltz');
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
  await rm(folder, {recursive: true, force: true});
});
