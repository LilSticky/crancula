import {expect, test, type Page} from '@playwright/test';
import {join} from 'node:path';
import {encodeSmf, type SmfTimedEvent} from '../../api/song/midi/smf-test-helper';
import {launchApp, type LaunchedApp} from '../support/launch-app';
import {defineStreetOrgan} from '../support/organ-editor';

// Screenshots for the README; run with `$env:README_SHOTS='1'; npm run ux:screens`.
const SHOTS = join(__dirname, '../../documentation/images/screenshots');
const QUARTER = 480;

/** A Part that plays each [MIDI note, quarters] in turn, each slightly detached so repeated notes stay apart. */
function part(name: string, notes: readonly (readonly [number, number])[]): {events: SmfTimedEvent[]} {
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'trackName', text: name}}];
  let rest = 0;
  for (const [note, quarters] of notes) {
    events.push({delta: rest, event: {type: 'noteOn', channel: 0, note, velocity: 80}});
    events.push({delta: quarters * QUARTER - QUARTER / 4, event: {type: 'noteOff', channel: 0, note, velocity: 0}});
    rest = QUARTER / 4;
  }
  return {events};
}

/** Twinkle, Twinkle, Little Star: melody and bass, two lines. */
function twinkle(): {name: string; mimeType: string; buffer: Buffer} {
  const line1: [number, number][] = [[72, 1], [72, 1], [79, 1], [79, 1], [81, 1], [81, 1], [79, 2], [77, 1], [77, 1], [76, 1], [76, 1], [74, 1], [74, 1], [72, 2]];
  const line2: [number, number][] = [[79, 1], [79, 1], [77, 1], [77, 1], [76, 1], [76, 1], [74, 2], [79, 1], [79, 1], [77, 1], [77, 1], [76, 1], [76, 1], [74, 2]];
  const bass: [number, number][] = [[60, 2], [64, 2], [65, 2], [64, 2], [62, 2], [60, 2], [55, 2], [60, 2], [64, 2], [62, 2], [60, 2], [55, 2], [64, 2], [60, 2], [62, 2], [55, 2]];
  const smf = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: QUARTER},
    tracks: [part('Melody', [...line1, ...line2]), part('Bass', bass)],
  });
  return {name: 'twinkle-twinkle.mid', mimeType: 'audio/midi', buffer: Buffer.from(smf)};
}

async function shoot(window: Page, name: string): Promise<void> {
  await window.mouse.move(5, 5);
  await window.evaluate(() => document.querySelectorAll('.mat-mdc-snack-bar-container').forEach((bar) => bar.remove()));
  await window.waitForTimeout(800);
  await window.screenshot({path: join(SHOTS, `${name}.png`)});
}

test.describe('README screenshots', () => {
  test.skip(!process.env['README_SHOTS'], 'Only on request: README_SHOTS=1');
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
    await launched.app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setContentSize(1440, 900));
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('captures the README screens', async () => {
    const {window} = launched;
    await defineStreetOrgan(window);
    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('organ').first().click();
    await expect(window.getByTestId('save-organ')).toBeVisible();
    await shoot(window, 'organ-editor');

    await window.getByRole('link', {name: 'Tapes'}).click();
    await window.getByTestId('new-tape').click();
    await window.getByTestId('song-file').setInputFiles(twinkle());
    await expect(window.getByTestId('song-file-name')).toHaveText('twinkle-twinkle.mid');
    await window.getByTestId('name').fill('Twinkle, Twinkle');
    await shoot(window, 'bring-a-song-onto-a-tape');

    await window.getByTestId('create-tape').click();
    await expect(window).toHaveURL(/\/tapes\/[0-9a-f-]{36}$/);
    await expect(window.getByTestId('tape-name')).toBeVisible();
    await shoot(window, 'tape');

    await window.getByTestId('scheme-switch').locator('[data-scheme="dark"]').click();
    await window.getByTestId('language-switch').locator('[data-language="de"]').click();
    await shoot(window, 'tape-dark-german');
  });
});
