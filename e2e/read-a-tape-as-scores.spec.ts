import {mkdtemp, readdir, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {type MidiFilePayload} from './support/midi-file';
import {saveOrgan} from './support/organ-editor';
import {stubSaveDialog, type SaveDialogStub} from './support/save-dialog';
import {createTapeFromSong} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';
import type {TapeLibrarySnapshot} from '../api/tape/tape-library-snapshot';
import {exportAsScores} from './support/tape-export-menu';

/**
 * Defines the Organ of spec 012: 25 Pipes from C4 (MIDI 60) to C6 (MIDI 84), and a Tape per Crank turn of 10 mm, so the
 * Preview of a short Tape runs for several seconds.
 */
async function defineScoresOrgan(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();
  await window.getByTestId('name').fill('Scores organ');
  await window.getByTestId('tape-width').fill('120');
  await window.getByTestId('hole-diameter').fill('2.5');
  await window.getByTestId('row-spacing').fill('3.5');
  await window.getByTestId('minimum-gap').fill('1.5');
  await window.getByTestId('lead-in').fill('20');
  for (let row = 0; row < 25; row++) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(String(60 + row));
  }
  await window.getByTestId('tape-per-crank-turn').fill('10');
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

/** The waltz of the fixture: 3/4 in G major with an upbeat of one quarter, brought onto a Tape as a MusicXML Song. */
async function waltzSong(): Promise<MidiFilePayload> {
  const buffer = await readFile(join(__dirname, 'support', 'waltz-upbeat.musicxml'));
  return {name: 'waltz-upbeat.musicxml', mimeType: 'application/vnd.recordare.musicxml+xml', buffer};
}

/** The Scores export dialog: the dialog of the page, with its content and actions. */
function scoresDialog(window: Page) {
  return window.getByRole('dialog');
}

test.describe('Read a Tape as Scores', () => {
  test.describe.configure({mode: 'serial'});
  let launched: LaunchedApp;
  let saves: SaveDialogStub;
  let folder: string;

  test.beforeAll(async () => {
    launched = await launchApp();
    await resizeWindowOrSkip(launched, 1280, 800);
    saves = await stubSaveDialog(launched.app);
    folder = await mkdtemp(join(tmpdir(), 'crancula-scores-'));
    await defineScoresOrgan(launched.window);
    await createTapeFromSong(launched.window, 'Waltz', await waltzSong());
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('exports the Tape as MusicXML with the Song prefilled: 3/4, the upbeat Bar 0, G major and a tempo mark', async () => {
    const {window} = launched;
    const target = join(folder, 'Waltz.musicxml');
    await saves.answerWith(target);

    await exportAsScores(window);
    await expect(scoresDialog(window).getByTestId('scores-export-dialog')).toBeVisible();
    await expect(scoresDialog(window).getByTestId('scores-time-song').getByRole('radio')).toBeChecked();
    await expect(scoresDialog(window).getByTestId('scores-upbeat-count')).toHaveValue('1');
    await scoresDialog(window).getByTestId('scores-confirm').click();

    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: target})).toBeVisible();
    const xml = await readFile(target, 'utf8');
    expect(xml).toContain('<time><beats>3</beats><beat-type>4</beat-type></time>');
    expect(xml).toContain('<measure number="0" implicit="yes">');
    expect(xml).toContain('<fifths>1</fifths>');
    expect(xml).toMatch(/<sound tempo="\d+"\/>/);
  });

  test('exports again while the Preview plays, and the Preview keeps playing', async () => {
    const {window} = launched;
    const target = join(folder, 'Waltz again.musicxml');
    await saves.answerWith(target);
    await window.getByTestId('preview-toggle').click();
    await expect(window.getByTestId('preview-toggle')).toHaveAccessibleName('Stop preview');

    await exportAsScores(window);
    await scoresDialog(window).getByTestId('scores-confirm').click();

    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: target})).toBeVisible();
    expect(await readFile(target, 'utf8')).toContain('<measure number="0" implicit="yes">');
    await expect(window.getByTestId('preview-toggle')).toHaveAccessibleName('Stop preview');
  });

  test('cancelling the export dialog writes no file and opens no save dialog', async () => {
    const {window} = launched;
    const savesBefore = (await saves.calls()).length;
    const filesBefore = (await readdir(folder)).sort();

    await exportAsScores(window);
    await scoresDialog(window).getByTestId('scores-cancel').click();

    await expect(window.getByRole('dialog')).toHaveCount(0);
    expect(await saves.calls()).toHaveLength(savesBefore);
    expect((await readdir(folder)).sort()).toEqual(filesBefore);
  });
});

/**
 * Makes the stored Tape `tapeName` one composed from scratch: its Holes stay, its Song goes (Story 4). The app is
 * not running while the snapshot file is rewritten.
 */
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

/** The length in Columns of each Bar of the MusicXML: the sum of the note durations of each measure. */
function barLengths(xml: string): number[] {
  return [...xml.matchAll(/<measure number="\d+"[^>]*>([\s\S]*?)<\/measure>/g)].map(([, body]) =>
    [...(body ?? '').matchAll(/<duration>(\d+)<\/duration>/g)].reduce((sum, [, value]) => sum + Number(value), 0),
  );
}

/** Opens a stored Tape from the Tapes list by its name. */
async function openTape(window: Page, name: string): Promise<void> {
  await window.getByRole('link', {name: 'Tapes', exact: true}).click();
  await window.getByTestId('open-tape').filter({hasText: name}).click();
  await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText(name);
}

test.describe('A Tape composed from scratch takes the Time signature asked at export', () => {
  test.describe.configure({mode: 'serial'});
  let launched: LaunchedApp;
  let saves: SaveDialogStub;
  let folder: string;

  test.beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'crancula-scratch-'));
    const first = await launchApp();
    await defineScoresOrgan(first.window);
    await createTapeFromSong(first.window, 'Scratch', await waltzSong());
    await first.app.close();
    await composeFromScratch(first.userDataDir, 'Scratch');
    launched = await launchApp(first.userDataDir);
    await resizeWindowOrSkip(launched, 1280, 800);
    saves = await stubSaveDialog(launched.app);
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('exports 6/8 with an upbeat of one eighth: the first Bar 4 Columns long, every following Bar 24', async () => {
    const {window} = launched;
    await openTape(window, 'Scratch');
    const target = join(folder, 'Scratch.musicxml');
    await saves.answerWith(target);

    await exportAsScores(window);
    const dialog = window.getByRole('dialog');
    await expect(dialog.getByTestId('scores-time-song')).toHaveCount(0);
    await dialog.getByTestId('scores-beats').fill('6');
    await dialog.getByTestId('scores-beat-type').click();
    await window.getByRole('option', {name: 'Eighth'}).click();
    await dialog.getByTestId('scores-upbeat-count').fill('1');
    await dialog.getByTestId('scores-upbeat-value').click();
    await window.getByRole('option', {name: 'Eighth'}).click();
    await dialog.getByTestId('scores-confirm').click();

    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: target})).toBeVisible();
    const xml = await readFile(target, 'utf8');
    expect(xml).toContain('<time><beats>6</beats><beat-type>8</beat-type></time>');
    const bars = barLengths(xml);
    expect(bars[0]).toBe(4);
    expect(bars.slice(1).length).toBeGreaterThan(0);
    expect(bars.slice(1).every((length) => length === 24)).toBe(true);
  });

  test('reopens the export dialog with 4/4 and no upbeat, as nothing was stored', async () => {
    const {window} = launched;
    await exportAsScores(window);
    const dialog = window.getByRole('dialog');
    await expect(dialog.getByTestId('scores-beats')).toHaveValue('4');
    await expect(dialog.getByTestId('scores-beat-type')).toContainText('Quarter');
    await expect(dialog.getByTestId('scores-upbeat-count')).toHaveValue('0');
    await dialog.getByTestId('scores-cancel').click();
    await expect(window.getByRole('dialog')).toHaveCount(0);
  });
});
