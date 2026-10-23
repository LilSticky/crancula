import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, type Page, test} from '@playwright/test';
import {type ElectronApplication} from 'playwright';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {saveOrgan} from './support/organ-editor';
import {melodyC3ToC5, type MidiFilePayload} from './support/midi-file';
import {createTapeFromSong, defineOctaveOrgan, songRepeatingC4} from './support/tape-creation';
import {dragHole, drawnHoles, holeAt, openOnlyTape, type DrawnHole} from './support/tape-edit';
import {resizeWindowOrSkip} from './support/window-size';

/** Tape per Crank turn of 1000 mm with a Column length of 5 mm: 5 ms per Column at 60 turns per minute. */
const SHORT_PREVIEW_TAPE_PER_CRANK_TURN = '1000';
/** Tape per Crank turn of 100 mm: 50 ms per Column, so a Preview lasts long enough to stop it in the middle. */
const LONG_PREVIEW_TAPE_PER_CRANK_TURN = '100';

/** Defines an Organ with a Tape per Crank turn, then brings a Song (the melody by default) onto a 5 mm Column Tape and opens it. */
async function openTapeOfOrganWithTapePerCrankTurn(tapePerCrankTurn: string, song: MidiFilePayload = melodyC3ToC5()): Promise<LaunchedApp> {
  const launched = await launchApp();
  await resizeWindowOrSkip(launched, 1280, 800);
  const {window} = launched;
  await defineOctaveOrgan(window, 'Octave organ');
  await window.getByTestId('tape-per-crank-turn').fill(tapePerCrankTurn);
  await saveOrgan(window);
  await createTapeFromSong(window, 'Scale', song, {columnLength: '5'});
  return launched;
}

/** The Hole that is last in its row of four: the last C4 of `songRepeatingC4`, which has a free Column after it. */
function lastOfFourHole(holes: readonly DrawnHole[]): DrawnHole {
  const inFours = holes.filter((hole) => holes.filter((other) => other.row === hole.row).length === 4);
  const last = inFours.at(-1);
  if (!last) throw new Error('expected four C4 Holes');
  return last;
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
    await expect(window.getByTestId('preview-toggle')).toContainText('Preview');

    await focusTapeView(window);
    await window.keyboard.press(' ');

    await expect(window.getByTestId('preview-toggle')).toContainText('Stop preview');
    await expect.poll(() => playheadColumn(window)).toBeGreaterThan(0);
    await app.close();
  });

  test('the playhead reaches the end of the Tape, and the toggle is no longer pressed', async () => {
    const {app, window} = await openTapeOfOrganWithTapePerCrankTurn(SHORT_PREVIEW_TAPE_PER_CRANK_TURN);
    const length = await tapeLength(window);
    expect(length).toBeGreaterThan(0);

    await window.getByTestId('preview-toggle').click();

    await expect(window.getByTestId('preview-toggle')).toContainText('Preview');
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

    await expect(window.getByTestId('preview-toggle')).toContainText('Preview');
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

test.describe('Changing the Crank speed of a Tape', () => {
  test('a Crank speed of 120 is kept after a restart; Undo brings 60 back and Redo 120', async () => {
    const first = await openTapeOfOrganWithTapePerCrankTurn(SHORT_PREVIEW_TAPE_PER_CRANK_TURN);
    const {window} = first;
    const crankSpeed = window.getByTestId('crank-speed-input');
    await expect(crankSpeed).toHaveValue('60');

    await crankSpeed.fill('120');
    await crankSpeed.press('Enter');
    await expect(crankSpeed).toHaveValue('120');

    await window.getByTestId('undo').click();
    await expect(crankSpeed).toHaveValue('60');
    await window.getByTestId('redo').click();
    await expect(crankSpeed).toHaveValue('120');

    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await openOnlyTape(second.window);
    await expect(second.window.getByTestId('crank-speed-input')).toHaveValue('120');
    await second.app.close();
  });

  test('a Crank speed typed with a German comma is kept after a restart', async () => {
    const first = await openTapeOfOrganWithTapePerCrankTurn(SHORT_PREVIEW_TAPE_PER_CRANK_TURN);
    await first.window.getByTestId('language-switch').locator('[data-language="de"]').click();
    const crankSpeed = first.window.getByTestId('crank-speed-input');
    await crankSpeed.fill('72,5');
    await crankSpeed.press('Enter');
    await expect(crankSpeed).toHaveValue('72,5');
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await second.window.getByRole('link', {name: 'Lochbänder'}).click();
    await second.window.getByTestId('open-tape').click();
    await expect(second.window.getByTestId('crank-speed-input')).toHaveValue('72,5');
    await second.app.close();
  });
});

test.describe('Editing a Tape while its Preview plays', () => {
  test('a Hole drag and the menu Undo change nothing while the Preview plays; a drag works after it stops', async () => {
    const {app, window, userDataDir} = await openTapeOfOrganWithTapePerCrankTurn(LONG_PREVIEW_TAPE_PER_CRANK_TURN, songRepeatingC4('c4s.mid', 4));
    const tapesFile = join(userDataDir, 'snapshots', 'tapes.json');
    const preview = window.getByTestId('preview-toggle');
    const originalHole = lastOfFourHole([...(await drawnHoles(window))]);
    const movedStart = originalHole.start + 2;

    // An edit before the Preview, so that the menu Undo has something to take back.
    const storedOriginal = await readFile(tapesFile, 'utf8');
    await dragHole(window, holeAt(window, originalHole.row, originalHole.start), 2);
    await expect(holeAt(window, originalHole.row, movedStart)).toHaveCount(1);
    const edited = [...(await drawnHoles(window))];
    // The edit is stored once the drawing shows it; wait for the file before taking it as the reference.
    await expect.poll(() => readFile(tapesFile, 'utf8')).not.toBe(storedOriginal);
    const storedEdited = await readFile(tapesFile, 'utf8');

    await preview.click();
    await expect(preview).toContainText('Stop preview');
    await expect(window.getByTestId('editing-paused')).toBeVisible();

    await dragHole(window, holeAt(window, originalHole.row, movedStart), -2);
    await clickMenuItem(app, 'undo');

    await expect(preview).toContainText('Stop preview');
    expect([...(await drawnHoles(window))]).toEqual(edited);
    expect(await readFile(tapesFile, 'utf8')).toBe(storedEdited);

    await preview.click();
    await expect(preview).toContainText('Preview');
    await expect(window.getByTestId('editing-paused')).toHaveCount(0);

    await dragHole(window, holeAt(window, originalHole.row, movedStart), -2);
    await expect(holeAt(window, originalHole.row, originalHole.start)).toHaveCount(1);
    await expect(holeAt(window, originalHole.row, movedStart)).toHaveCount(0);
    await expect.poll(() => readFile(tapesFile, 'utf8')).not.toBe(storedEdited);
    await app.close();
  });
});

/** Clicks an Edit menu item of the application menu, sent to the window it is clicked in. */
async function clickMenuItem(app: ElectronApplication, id: 'undo' | 'redo'): Promise<void> {
  await app.evaluate(
    ({BrowserWindow, Menu}, itemId) => {
      Menu.getApplicationMenu()?.getMenuItemById(itemId)?.click(undefined, BrowserWindow.getAllWindows()[0]);
    },
    id,
  );
}
