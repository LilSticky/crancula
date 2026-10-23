import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, type Page, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {saveOrgan} from './support/organ-editor';
import {melodyC3ToC5} from './support/midi-file';
import {createTapeFromSong, defineOctaveOrgan} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';

/** Tape per Crank turn of 1000 mm with a Column length of 5 mm: 5 ms per Column at 60 turns per minute. */
const SHORT_PREVIEW_TAPE_PER_CRANK_TURN = '1000';
/** Tape per Crank turn of 100 mm: 50 ms per Column, so a Preview lasts long enough to stop it in the middle. */
const LONG_PREVIEW_TAPE_PER_CRANK_TURN = '100';

/** Defines an Organ with a Tape per Crank turn, then brings a melody onto a 5 mm Column Tape and opens it. */
async function openTapeOfOrganWithTapePerCrankTurn(tapePerCrankTurn: string): Promise<LaunchedApp> {
  const launched = await launchApp();
  await resizeWindowOrSkip(launched, 1280, 800);
  const {window} = launched;
  await defineOctaveOrgan(window, 'Octave organ');
  await window.getByTestId('tape-per-crank-turn').fill(tapePerCrankTurn);
  await saveOrgan(window);
  await createTapeFromSong(window, 'Scale', melodyC3ToC5(), {columnLength: '5'});
  return launched;
}

/** The value shown next to a label of the Tape section (`dt` followed by its `dd`). */
function sectionValue(window: Page, label: string) {
  return window.getByTestId('tape-section').getByText(label, {exact: true}).locator('xpath=following-sibling::dd[1]');
}

/** The Columns of the Tape, as the Tape section shows them. */
async function tapeLength(window: Page): Promise<number> {
  const text = (await sectionValue(window, 'Columns').textContent()) ?? '';
  return Number(text.replace(/[^0-9]/g, ''));
}

/** The Column the playhead stands on, as the drawing reports it. */
async function playheadColumn(window: Page): Promise<number> {
  const value = await window.getByTestId('playhead').getAttribute('data-column');
  return Number(value);
}

/** Focuses the Tape drawing, so that Space reaches the Tape view. */
async function focusTapeView(window: Page): Promise<void> {
  await window.locator('[data-testid="tape-scroll"] svg').focus();
}

test.describe('Preview a Tape on the Organ', () => {
  test('Space starts the Preview: the toggle is pressed and the playhead moves along the Tape', async () => {
    const {app, window} = await openTapeOfOrganWithTapePerCrankTurn(SHORT_PREVIEW_TAPE_PER_CRANK_TURN);
    await expect(window.getByTestId('preview-toggle')).toHaveAttribute('aria-pressed', 'false');

    await focusTapeView(window);
    await window.keyboard.press(' ');

    await expect(window.getByTestId('preview-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => playheadColumn(window)).toBeGreaterThan(0);
    await app.close();
  });

  test('the playhead reaches the end of the Tape, and the toggle is no longer pressed', async () => {
    const {app, window} = await openTapeOfOrganWithTapePerCrankTurn(SHORT_PREVIEW_TAPE_PER_CRANK_TURN);
    const length = await tapeLength(window);
    expect(length).toBeGreaterThan(0);

    await window.getByTestId('preview-toggle').click();

    await expect(window.getByTestId('preview-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => playheadColumn(window)).toBe(length);
    await app.close();
  });

  test('stopping in the middle keeps the playhead on its Column, before the end of the Tape', async () => {
    const {app, window} = await openTapeOfOrganWithTapePerCrankTurn(LONG_PREVIEW_TAPE_PER_CRANK_TURN);
    const length = await tapeLength(window);

    await focusTapeView(window);
    await window.keyboard.press(' ');
    await expect.poll(() => playheadColumn(window)).toBeGreaterThan(0);
    await window.keyboard.press(' ');

    await expect(window.getByTestId('preview-toggle')).toHaveAttribute('aria-pressed', 'false');
    const stoppedAt = await playheadColumn(window);
    expect(stoppedAt).toBeGreaterThan(0);
    expect(stoppedAt).toBeLessThan(length);
    await expect.poll(() => playheadColumn(window), {timeout: 1000}).toBe(stoppedAt);
    await app.close();
  });

  test('a Preview leaves the stored Tape file byte-identical', async () => {
    const {app, window, userDataDir} = await openTapeOfOrganWithTapePerCrankTurn(SHORT_PREVIEW_TAPE_PER_CRANK_TURN);
    const tapesFile = join(userDataDir, 'snapshots', 'tapes.json');
    const before = await readFile(tapesFile, 'utf8');
    const length = await tapeLength(window);

    await window.getByTestId('preview-toggle').click();
    await expect.poll(() => playheadColumn(window)).toBe(length);

    expect(await readFile(tapesFile, 'utf8')).toBe(before);
    await app.close();
  });
});
