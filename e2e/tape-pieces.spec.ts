import {mkdtemp, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {expect, type Locator, type Page, test} from '@playwright/test';
import {encodeSmf, type SmfTimedEvent} from '../api/song/midi/smf-test-helper';
import {
  stubFolderDialog,
  stubMessageBox,
  type DialogStub,
  type FolderDialogAnswer,
  type FolderDialogCall,
  type MessageBoxAnswer,
  type MessageBoxCall,
} from './support/dialog-stubs';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {type MidiFilePayload} from './support/midi-file';
import {saveOrgan} from './support/organ-editor';
import {stubSaveDialog, type SaveDialogStub} from './support/save-dialog';
import {createTapeFromSong} from './support/tape-creation';
import {drawnHoles, holeAt, pressOnDrawing} from './support/tape-edit';
import {resizeWindowOrSkip} from './support/window-size';

const TICKS_PER_QUARTER = 480;

/** The Column length of the reference Tape: 200 Columns of 3 mm, so 600 mm between the Lead-in and the end gap. */
const COLUMN_LENGTH = '3';

/** The lengths of the three Tape pieces of the reference Tape on the Cutting mat, from the Lead-in's tip (spec 011, Story 2). */
const LONG_TAPE_PIECE_LENGTHS = [298, 299, 95] as const;

/** Defines the reference Organ of spec 011: tape width 100 mm, 10 Pipes from C4 (MIDI 60 to 69), Lead-in 50 mm. */
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

/** Describes the reference Plotter "Cutting mat": working length 300 mm, working width 120 mm, the default Overlap of 20 mm. */
async function describeCuttingMat(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Plotters'}).click();
  await window.getByTestId('new-plotter').click();
  await window.getByTestId('plotter-name').fill('Cutting mat');
  await window.getByTestId('plotter-working-length').fill('300');
  await window.getByTestId('plotter-working-width').fill('120');
  await expect(window.getByTestId('plotter-overlap')).toHaveValue('20');
  await window.getByTestId('save-plotter').click();
  await expect(window).toHaveURL(/#?\/plotters$/);
}

/** Picks the Plotter in the picker of the Tape view's side panel. */
async function pickPlotter(window: Page, name: string): Promise<void> {
  await window.getByTestId('plotter-picker').click();
  await window.getByRole('option', {name}).click();
  await expect(window.getByTestId('plotter-picker')).toContainText(name);
}

/** Opens a stored Tape from the Tape list by its name. */
async function openTape(window: Page, name: string): Promise<void> {
  await window.getByRole('link', {name: 'Tapes', exact: true}).click();
  await window.getByTestId('open-tape').filter({hasText: name}).click();
  await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText(name);
}

/** The width in mm of a Plotter SVG's document, from its root element. */
function documentWidth(svg: string): number {
  return Number(/<svg [^>]*width="([\d.]+)mm"/.exec(svg)?.[1]);
}

/**
 * A Song of one Part with a C4 of one quarter at each of the quarters `starts`, so the Tape runs from the
 * first note to the end of the last one. Two notes 24 quarters apart make a Tape of 200 Columns (8 per quarter).
 */
function notesAtQuarters(fileName: string, starts: readonly number[]): MidiFilePayload {
  const events: SmfTimedEvent[] = [];
  let previousEnd = 0;
  for (const quarter of starts) {
    const start = quarter * TICKS_PER_QUARTER;
    events.push(
      {delta: start - previousEnd, event: {type: 'noteOn', channel: 0, note: 60, velocity: 80}},
      {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
    );
    previousEnd = start + TICKS_PER_QUARTER;
  }
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [{events: [{delta: 0, event: {type: 'trackName', text: 'Notes'}}, ...events]}],
  });
  return {name: fileName, mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

/**
 * A Song of C4 held for 12.5 quarters from the start (a Hole of 100 Columns from Column 1, at 8 Columns per
 * quarter) and a quarter of C4 at quarter 24, so the Tape runs 200 Columns like the reference Tape.
 */
function heldNote(fileName: string): MidiFilePayload {
  const notes = [
    {start: 0, ticks: 12.5 * TICKS_PER_QUARTER},
    {start: 24 * TICKS_PER_QUARTER, ticks: TICKS_PER_QUARTER},
  ];
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'trackName', text: 'Notes'}}];
  let previousEnd = 0;
  for (const {start, ticks} of notes) {
    events.push(
      {delta: start - previousEnd, event: {type: 'noteOn', channel: 0, note: 60, velocity: 80}},
      {delta: ticks, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
    );
    previousEnd = start + ticks;
  }
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [{events}],
  });
  return {name: fileName, mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

/** The Tape drawing of the Tape view (not the overview strip). */
function tapeDrawing(window: Page): Locator {
  return window.locator('[data-testid="tape-scroll"] svg');
}

test.describe('Cut a long Tape in pieces on the picked Plotter', () => {
  test.describe.configure({mode: 'serial'});
  let launched: LaunchedApp;
  let folders: DialogStub<FolderDialogCall, FolderDialogAnswer>;
  let messageBox: DialogStub<MessageBoxCall, MessageBoxAnswer>;
  let saves: SaveDialogStub;
  let folder: string;

  test.beforeAll(async () => {
    launched = await launchApp();
    await resizeWindowOrSkip(launched, 1280, 800);
    folders = await stubFolderDialog(launched.app);
    messageBox = await stubMessageBox(launched.app);
    saves = await stubSaveDialog(launched.app);
    folder = await mkdtemp(join(tmpdir(), 'crancula-pieces-'));
    await defineReferenceOrgan(launched.window);
    await describeCuttingMat(launched.window);
    await createTapeFromSong(launched.window, 'Short', notesAtQuarters('short.mid', [0]), {columnLength: COLUMN_LENGTH});
    await createTapeFromSong(launched.window, 'Waltz', notesAtQuarters('long.mid', [0, 24]), {columnLength: COLUMN_LENGTH});
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('cuts the long Tape into three Tape pieces in the folder I pick, each as long as its piece', async () => {
    const {window} = launched;
    await pickPlotter(window, 'Cutting mat');
    await expect(window.getByTestId('plotter-pieces')).toContainText('3 Tape pieces');
    await folders.answerWith({canceled: false, filePaths: [folder]});

    await window.getByTestId('export').click();

    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: folder})).toBeVisible();
    const [call] = await folders.calls();
    expect(call?.properties).toContain('openDirectory');
    expect(await messageBox.calls()).toHaveLength(0);
    expect((await readdir(folder)).sort()).toEqual(['Waltz 1 of 3.svg', 'Waltz 2 of 3.svg', 'Waltz 3 of 3.svg']);
    for (const [index, length] of LONG_TAPE_PIECE_LENGTHS.entries()) {
      const svg = await readFile(join(folder, `Waltz ${index + 1} of 3.svg`), 'utf8');
      expect(documentWidth(svg)).toBeCloseTo(length, 2);
    }
  });

  test('asks before replacing existing pieces and writes nothing when I answer Cancel', async () => {
    const {window} = launched;
    await rm(join(folder, 'Waltz 2 of 3.svg'));
    const before = (await readdir(folder)).sort();
    await folders.answerWith({canceled: false, filePaths: [folder]});
    await messageBox.answerWith({response: 1});

    await window.getByTestId('export').click();

    await expect.poll(async () => (await messageBox.calls()).length).toBe(1);
    await expect(window.getByTestId('export')).toBeEnabled();
    const [question] = await messageBox.calls();
    expect(question?.detail).toBe('Waltz 1 of 3.svg\nWaltz 3 of 3.svg');
    expect((await readdir(folder)).sort()).toEqual(before);
    expect(before).toEqual(['Waltz 1 of 3.svg', 'Waltz 3 of 3.svg']);
  });

  test('exports a Tape that fits the picked Plotter as one file through the save dialog, named after the Tape', async () => {
    const {window} = launched;
    await openTape(window, 'Short');
    await expect(window.getByTestId('plotter-picker')).toContainText('Cutting mat');
    await expect(window.getByTestId('plotter-pieces')).toContainText('Fits in one Tape piece');
    const target = join(folder, 'Short.svg');
    await saves.answerWith(target);
    const folderCallsBefore = (await folders.calls()).length;

    await window.getByTestId('export').click();

    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: target})).toBeVisible();
    expect(await folders.calls()).toHaveLength(folderCallsBefore);
    const [call] = (await saves.calls()).slice(-1);
    expect(basename(call?.defaultPath ?? '')).toBe('Short.svg');
    expect(await readdir(folder)).toContain('Short.svg');
  });

  test('still has the Plotter picked after a restart, and cuts the long Tape in pieces with it', async () => {
    const {userDataDir} = launched;
    await launched.app.close();
    launched = await launchApp(userDataDir);
    await resizeWindowOrSkip(launched, 1280, 800);
    folders = await stubFolderDialog(launched.app);
    const restartFolder = await mkdtemp(join(tmpdir(), 'crancula-pieces-restart-'));
    await folders.answerWith({canceled: false, filePaths: [restartFolder]});
    const {window} = launched;

    await openTape(window, 'Waltz');
    await expect(window.getByTestId('plotter-picker')).toContainText('Cutting mat');
    await window.getByTestId('export').click();

    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: restartFolder})).toBeVisible();
    expect((await readdir(restartFolder)).sort()).toEqual(['Waltz 1 of 3.svg', 'Waltz 2 of 3.svg', 'Waltz 3 of 3.svg']);
  });

  test('lists a stretch with no place for a Join as a Cutting Problem, marks it on the Tape, and refuses the export with no file written', async () => {
    const {window} = launched;
    saves = await stubSaveDialog(launched.app); // The restart above relaunched the app, so the stub is on the new one.
    await createTapeFromSong(window, 'Held', heldNote('held.mid'), {columnLength: COLUMN_LENGTH});
    await pickPlotter(window, 'Cutting mat');

    await expect(window.getByTestId('cutting-problems-count')).toHaveText(/^\s*1 Cutting Problem\s*$/);
    await expect(window.getByTestId('cutting-problem-stretch')).toHaveCount(1);
    await expect(window.getByTestId('cutting-problem-stretch')).toContainText('Columns 1–101');
    const marks = await tapeDrawing(window)
      .locator('[data-testid="stretch-mark"]')
      .evaluateAll((rects) => rects.map((rect) => [rect.getAttribute('data-first'), rect.getAttribute('data-last')]));
    expect(marks).toEqual([['1', '101']]);

    const savesBefore = (await saves.calls()).length;
    const foldersBefore = (await folders.calls()).length;
    await window.getByTestId('export').click();
    await expect(window.getByRole('dialog').getByTestId('export-problem')).toHaveCount(1);
    await expect(window.getByRole('dialog').getByTestId('export-problem')).toContainText('Columns 1–101');
    expect(await saves.calls()).toHaveLength(savesBefore);
    expect(await folders.calls()).toHaveLength(foldersBefore);
    expect((await readdir(folder)).filter((name) => name.startsWith('Held'))).toEqual([]);
    await window.getByRole('dialog').getByRole('button', {name: 'Close'}).click();
  });

  test('shortens the Hole to 70 Columns, the Cutting Problem is gone, and the Tape is exported in pieces', async () => {
    const {window} = launched;
    const hole = (await drawnHoles(window)).find((drawn) => drawn.start === 0);
    if (!hole) throw new Error('the Held Tape shows no Hole at Column 1');
    await holeAt(window, hole.row, hole.start).click();
    for (let times = 0; times < 30; times++) await pressOnDrawing(window, 'Shift+ArrowLeft');

    await expect(window.getByTestId('selected-hole')).toContainText('Columns 1–70');
    await expect(window.getByTestId('cutting-problems-count')).toHaveText('None');
    await expect(window.getByTestId('cutting-problem-stretch')).toHaveCount(0);
    await expect(tapeDrawing(window).locator('[data-testid="stretch-mark"]')).toHaveCount(0);

    const foldersBefore = (await folders.calls()).length;
    await folders.answerWith({canceled: false, filePaths: [folder]});
    await window.getByTestId('export').click();
    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: folder})).toBeVisible();
    expect(await folders.calls()).toHaveLength(foldersBefore + 1);
    const pieces = (await readdir(folder)).filter((name) => /^Held \d+ of \d+\.svg$/.test(name));
    expect(pieces.length).toBeGreaterThan(1);
  });

  test('draws each Join and its Overlap in the Tape view of the Tape in pieces', async () => {
    const {window} = launched;
    await openTape(window, 'Waltz');
    await pickPlotter(window, 'Cutting mat');

    await expect(tapeDrawing(window).locator('[data-testid="join"]')).toHaveCount(2);
    await expect(tapeDrawing(window).locator('[data-testid="overlap"]')).toHaveCount(2);
    const afters = await tapeDrawing(window)
      .locator('[data-testid="join"]')
      .evaluateAll((lines) => lines.map((line) => Number(line.getAttribute('data-after'))));
    expect(afters).toEqual([76, 169]);
  });
});
