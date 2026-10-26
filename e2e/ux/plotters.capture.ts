import {expect, test, type Page} from '@playwright/test';
import {join} from 'node:path';
import {encodeSmf, type SmfTimedEvent} from '../../api/song/midi/smf-test-helper';
import {launchApp} from '../support/launch-app';
import {type MidiFilePayload} from '../support/midi-file';
import {saveOrgan} from '../support/organ-editor';
import {createTapeFromSong} from '../support/tape-creation';

/** Where the `ux-review` skill expects the screens of the running app. */
const SCREENS = process.env['UX_SCREENS_DIR'] ?? join(__dirname, '../../documentation/design/screens/current');

const TICKS_PER_QUARTER = 480;

async function capture(window: Page, name: string): Promise<void> {
  await expect(window.locator('.mat-mdc-snack-bar-container')).toHaveCount(0);
  await window.waitForLoadState('networkidle');
  // Settle fades and scales (dialog, backdrop, select panel); endless animations never finish, so they are ignored.
  await window.waitForFunction(() => {
    const panel = document.querySelector('.mat-mdc-dialog-surface');
    const panelSettled = panel === null || getComputedStyle(panel).opacity === '1';
    return panelSettled && document.getAnimations().every((animation) => animation.effect?.getComputedTiming().endTime === Infinity);
  });
  await window.mouse.move(640, 400);
  await window.screenshot({path: join(SCREENS, `${name}.png`), fullPage: true});
}

/** A Song of one Part with C4 notes `{start, quarters}` long, in quarters from the start. */
function song(fileName: string, notes: readonly {start: number; quarters: number}[]): MidiFilePayload {
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'trackName', text: 'Notes'}}];
  let previousEnd = 0;
  for (const {start, quarters} of notes) {
    const startTicks = start * TICKS_PER_QUARTER;
    const ticks = quarters * TICKS_PER_QUARTER;
    events.push(
      {delta: startTicks - previousEnd, event: {type: 'noteOn', channel: 0, note: 60, velocity: 80}},
      {delta: ticks, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
    );
    previousEnd = startTicks + ticks;
  }
  const bytes = encodeSmf({format: 1, division: {ticksPerQuarterNote: TICKS_PER_QUARTER}, tracks: [{events}]});
  return {name: fileName, mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

/** The reference Organ of spec 011: tape width 100 mm, 10 Pipes from C4, Lead-in 50 mm. */
async function defineReferenceOrgan(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();
  await window.getByTestId('name').fill('Reference organ');
  await window.getByTestId('tape-width').fill('100');
  await window.getByTestId('hole-diameter').fill('3');
  await window.getByTestId('row-spacing').fill('4');
  await window.getByTestId('minimum-gap').fill('2');
  await window.getByTestId('lead-in').fill('50');
  for (let row = 0; row < 10; row++) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(String(60 + row));
  }
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

async function pickPlotter(window: Page, name: string): Promise<void> {
  await window.getByTestId('plotter-picker').click();
  await window.getByRole('option', {name}).click();
  await expect(window.getByTestId('plotter-picker')).toContainText(name);
}

async function openTape(window: Page, name: string): Promise<void> {
  await window.getByRole('link', {name: 'Tapes', exact: true}).click();
  await window.getByTestId('open-tape').filter({hasText: name}).click();
  await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText(name);
}

/** Shows the whole Tape, so every Join, Overlap and stretch mark is in view. */
async function showWholeTape(window: Page): Promise<void> {
  await window.getByTestId('zoom').getByRole('radio', {name: 'Whole Tape'}).click();
}

/** Back to 1:1 with the first Join scrolled into the middle of the Tape drawing. */
async function showFirstJoinAtOneToOne(window: Page): Promise<void> {
  await window.getByTestId('zoom').getByRole('radio', {name: '1:1'}).click();
  await window.locator('[data-testid="tape-scroll"] svg [data-testid="overlap"]').first().evaluate((overlap) => overlap.scrollIntoView({inline: 'center', block: 'nearest'}));
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

test('captures the screens of Cut a tape in pieces', async () => {
  const {app, window} = await launchApp();
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 800));
  await defineReferenceOrgan(window);

  // The Plotter list, empty, and the editor of a sheet plotter and a roll plotter.
  await window.getByRole('link', {name: 'Plotters'}).click();
  await expect(window.getByTestId('new-plotter')).toBeVisible();
  await capture(window, '24-plotter-list-empty');

  await window.getByTestId('new-plotter').click();
  await window.getByTestId('plotter-name').fill('Cutting mat');
  await window.getByTestId('plotter-working-length').fill('300');
  await window.getByTestId('plotter-working-width').fill('120');
  await captureLightAndDark(window, '25-plotter-editor-sheet');
  await window.getByTestId('save-plotter').click();
  await expect(window).toHaveURL(/#?\/plotters$/);

  await window.getByTestId('new-plotter').click();
  await window.getByTestId('plotter-name').fill('Vinyl cutter');
  await window.getByTestId('plotter-roll').getByRole('switch').click();
  await window.getByTestId('plotter-working-width').fill('90');
  await expect(window.getByTestId('plotter-working-length')).toHaveCount(0);
  await capture(window, '25b-plotter-editor-roll');
  await window.getByTestId('save-plotter').click();
  await expect(window).toHaveURL(/#?\/plotters$/);
  await expect(window.getByTestId('plotter-row')).toHaveCount(2);
  await captureLightAndDark(window, '24b-plotter-list');

  // 200 Columns of 3 mm: three Tape pieces on the Cutting mat, with two Joins and their Overlaps.
  await createTapeFromSong(window, 'Waltz', song('waltz.mid', [{start: 0, quarters: 1}, {start: 24, quarters: 1}]), {columnLength: '3'});
  await pickPlotter(window, 'Cutting mat');
  await expect(window.locator('[data-testid="tape-scroll"] svg [data-testid="join"]')).toHaveCount(2);
  await showWholeTape(window);
  await captureLightAndDark(window, '26-tape-view-joins');
  await showFirstJoinAtOneToOne(window);
  await captureLightAndDark(window, '26c-tape-view-join-one-to-one');

  // A Hole of 100 Columns: a stretch with no place for a Join.
  await createTapeFromSong(window, 'Held', song('held.mid', [{start: 0, quarters: 12.5}, {start: 24, quarters: 1}]), {columnLength: '3'});
  await pickPlotter(window, 'Cutting mat');
  await expect(window.getByTestId('cutting-problem-stretch')).toHaveCount(1);
  await showWholeTape(window);
  await captureLightAndDark(window, '27-tape-view-no-join-stretch');

  // The 100 mm Tape on the 90 mm roll: too wide.
  await openTape(window, 'Waltz');
  await pickPlotter(window, 'Vinyl cutter');
  await expect(window.getByTestId('plotter-too-wide')).toBeVisible();
  await captureLightAndDark(window, '28-tape-view-too-wide');

  // German, Tape in pieces.
  await window.getByTestId('language-switch').locator('[data-language="de"]').click();
  await pickPlotter(window, 'Cutting mat');
  await window.getByTestId('zoom').getByRole('radio', {name: 'Ganzes Lochband'}).click();
  await capture(window, '26b-tape-view-joins-german');
  await window.getByTestId('language-switch').locator('[data-language="en"]').click();

  await app.close();
});
