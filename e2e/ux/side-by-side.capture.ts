import {expect, test, type Page} from '@playwright/test';
import {join} from 'node:path';
import {encodeSmf, type SmfTimedEvent} from '../../api/song/midi/smf-test-helper';
import {launchApp} from '../support/launch-app';
import {type MidiFilePayload} from '../support/midi-file';
import {saveOrgan} from '../support/organ-editor';
import {createTapeFromSong, songRepeatingC4} from '../support/tape-creation';

/** Where the `ux-review` skill expects the screens of the running app. */
const SCREENS = process.env['UX_SCREENS_DIR'] ?? join(__dirname, '../../documentation/design/screens/current');

const TICKS_PER_QUARTER = 480;

async function capture(window: Page, name: string): Promise<void> {
  await expect(window.locator('.mat-mdc-snack-bar-container')).toHaveCount(0);
  await window.waitForLoadState('networkidle');
  // Endless animations never finish, so they are ignored.
  await window.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.effect?.getComputedTiming().endTime === Infinity),
  );
  await window.mouse.move(640, 400);
  await window.screenshot({path: join(SCREENS, `${name}.png`), fullPage: true});
}

async function setScheme(window: Page, scheme: 'dark' | 'system'): Promise<void> {
  await window.getByTestId('scheme-switch').locator(`[data-scheme="${scheme}"]`).click();
  if (scheme === 'dark') await expect(window.locator('html')).toHaveClass(/\bcr-dark\b/);
}

/** Captures the current screen in light, then in dark. */
async function captureLightAndDark(window: Page, name: string): Promise<void> {
  await capture(window, name);
  await setScheme(window, 'dark');
  await capture(window, `${name}-dark`);
  await setScheme(window, 'system');
}

/** A Song of C4 held for 12.5 quarters and a quarter of C4 at quarter 24: a long Tape of 200 Columns. */
function longSong(): MidiFilePayload {
  const events: SmfTimedEvent[] = [
    {delta: 0, event: {type: 'trackName', text: 'Notes'}},
    {delta: 0, event: {type: 'noteOn', channel: 0, note: 60, velocity: 80}},
    {delta: 12.5 * TICKS_PER_QUARTER, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
    {delta: 11.5 * TICKS_PER_QUARTER, event: {type: 'noteOn', channel: 0, note: 60, velocity: 80}},
    {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
  ];
  const bytes = encodeSmf({format: 1, division: {ticksPerQuarterNote: TICKS_PER_QUARTER}, tracks: [{events}]});
  return {name: 'long.mid', mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

async function defineOrgan(
  window: Page,
  organ: {name: string; tapeWidth: string; minimumGap: string; rowSpacing: string; leadIn: string; pipes: number},
): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();
  await window.getByTestId('name').fill(organ.name);
  await window.getByTestId('tape-width').fill(organ.tapeWidth);
  await window.getByTestId('hole-diameter').fill('3');
  await window.getByTestId('row-spacing').fill(organ.rowSpacing);
  await window.getByTestId('minimum-gap').fill(organ.minimumGap);
  await window.getByTestId('lead-in').fill(organ.leadIn);
  for (let row = 0; row < organ.pipes; row++) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(String(60 + row));
  }
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

/** Ticks the Tapes Reference and Waltz in the Tape list, in this order. */
async function tickBoth(window: Page): Promise<void> {
  for (const name of ['Reference', 'Waltz']) {
    await window.getByTestId('tape').filter({hasText: name}).getByTestId('tick-tape').click();
  }
}

async function savePlotter(window: Page): Promise<void> {
  await window.getByTestId('save-plotter').click();
  await expect(window).toHaveURL(/#?\/plotters$/);
}

test('captures the screens of Cut several Tapes side by side', async () => {
  const {app, window} = await launchApp();
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 800));
  await defineOrgan(window, {name: 'Street organ', tapeWidth: '100', minimumGap: '2', rowSpacing: '4', leadIn: '50', pipes: 10});
  await defineOrgan(window, {name: 'Strict organ', tapeWidth: '60', minimumGap: '2', rowSpacing: '15', leadIn: '20', pipes: 3});
  await createTapeFromSong(window, 'Reference', longSong(), {columnLength: '3', organName: 'Street organ'});
  await createTapeFromSong(window, 'Waltz', songRepeatingC4('waltz.mid', 3), {columnLength: '1.5', organName: 'Strict organ'});

  // A hole diameter of 14 mm for the Strict organ, which is its Minimum Hole Length: every Hole of the Waltz is now too short.
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('organ').filter({hasText: 'Strict organ'}).click();
  await window.getByTestId('hole-diameter').fill('14');
  await window.getByTestId('save-organ').click();
  const confirm = window.getByRole('button', {name: 'Confirm'});
  if (await confirm.isVisible({timeout: 2000}).catch(() => false)) await confirm.click();
  await expect(window.getByTestId('save-organ')).toBeDisabled();
  await expect(window.getByTestId('discard-changes')).toHaveCount(0);
  // The Tape list with both Tapes ticked.
  await window.getByRole('link', {name: 'Tapes', exact: true}).click();
  await tickBoth(window);
  await captureLightAndDark(window, '31-tape-list-ticked');

  // No roll Plotter yet.
  await window.getByTestId('cut-side-by-side').click();
  await expect(window.getByTestId('side-by-side-no-plotter')).toBeVisible();
  await captureLightAndDark(window, '32-side-by-side-no-roll-plotter');

  // The editor of a new roll Plotter, with the Tape spacing.
  await window.getByRole('link', {name: 'Plotters'}).click();
  await window.getByTestId('new-plotter').click();
  await window.getByTestId('plotter-name').fill('Vinyl cutter');
  await window.getByTestId('plotter-roll').getByRole('switch').click();
  await window.getByTestId('plotter-working-width').fill('300');
  await expect(window.getByTestId('plotter-tape-spacing')).toBeVisible();
  await captureLightAndDark(window, '33-plotter-editor-roll-tape-spacing');
  await savePlotter(window);

  // Two Lanes with free width; the Waltz has Cutting Problems.
  await window.getByRole('link', {name: 'Tapes', exact: true}).click();
  await tickBoth(window);
  await window.getByTestId('cut-side-by-side').click();
  await expect(window.getByTestId('lane')).toHaveCount(2);
  await expect(window.getByTestId('lane-problems')).toBeVisible();
  await captureLightAndDark(window, '34-side-by-side-free-width');

  // A roll of 150 mm: the second Lane reaches past the working width.
  await window.getByRole('link', {name: 'Plotters'}).click();
  await window.getByTestId('plotter-row').filter({hasText: 'Vinyl cutter'}).click();
  await window.getByTestId('plotter-working-width').fill('150');
  await savePlotter(window);
  await window.getByRole('link', {name: 'Tapes', exact: true}).click();
  await tickBoth(window);
  await window.getByTestId('cut-side-by-side').click();
  await expect(window.getByTestId('lane-does-not-fit')).toBeVisible();
  await captureLightAndDark(window, '35-side-by-side-overflow');
  // The Lane list sits below the drawing, which is shown at 1:1.
  await window.getByTestId('lane').first().scrollIntoViewIfNeeded();
  await captureLightAndDark(window, '35c-side-by-side-overflow-lanes');

  // German.
  await window.getByTestId('language-switch').locator('[data-language="de"]').click();
  await capture(window, '35b-side-by-side-overflow-german');
  await window.getByTestId('language-switch').locator('[data-language="en"]').click();

  await app.close();
});
