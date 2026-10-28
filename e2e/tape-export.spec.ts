import {mkdtemp, readdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {encodeSmf} from '../api/song/midi/smf-test-helper';
import {melodyC3ToC5, melodyC5ToC3, type MidiFilePayload} from './support/midi-file';
import {saveOrgan} from './support/organ-editor';
import {createTapeFromSong, defineOctaveOrgan} from './support/tape-creation';
import {stubSaveDialog, type SaveDialogStub} from './support/save-dialog';
import {exportForPlotter, expectExportItemEnabled} from './support/tape-export-menu';

/** The Tape width of the Organ `defineOctaveOrgan` makes, in mm. */
const TAPE_WIDTH = 120;

const readTapesFile = (userDataDir: string): Promise<string> =>
  readFile(join(userDataDir, 'snapshots', 'tapes.json'), 'utf8');

/** The English text of `TAPE.EXPORT.<key>`. */
async function englishText(key: string): Promise<string> {
  const en = JSON.parse(await readFile(join(__dirname, '../src/assets/i18n/en.json'), 'utf8')) as {
    TAPE: {EXPORT?: Record<string, string>};
  };
  return en.TAPE.EXPORT?.[key] ?? '';
}

/** A Song of one Part with a single note of one Column (60 of 480 ticks per quarter): a Hole of 1 Column. */
function shortNoteSong(): MidiFilePayload {
  const bytes = encodeSmf({
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
  return {name: 'blip.mid', mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

test.describe('Export a Tape that can not be cut (part 2)', () => {
  test('explains the Hole in a dialog, never opens the save dialog, writes no file and leaves the Tapes alone', async () => {
    const launched = await launchApp();
    try {
      const dialog = await stubSaveDialog(launched.app);
      const folder = await mkdtemp(join(tmpdir(), 'crancula-refused-'));
      await dialog.answerWith(join(folder, 'Blip.svg'));
      await defineOctaveOrgan(launched.window, 'Octave organ');
      await createTapeFromSong(launched.window, 'Blip', shortNoteSong());
      const tapesBefore = await readTapesFile(launched.userDataDir);

      // Raise the hole diameter: the Minimum Hole Length becomes 4 mm, 2 Columns, and the Hole has 1.
      await launched.window.getByRole('link', {name: 'Organs'}).click();
      await launched.window.getByTestId('organ').click();
      await launched.window.getByTestId('hole-diameter').fill('4');
      await launched.window.getByTestId('row-spacing').fill('4');
      await saveOrgan(launched.window);
      await launched.window.getByRole('link', {name: 'Tapes'}).click();
      await launched.window.getByTestId('open-tape').click();
      await expectExportItemEnabled(launched.window, 'export');

      await exportForPlotter(launched.window);

      const problems = launched.window.getByRole('dialog');
      await expect(problems).toContainText(await englishText('PROBLEMS_TITLE'));
      await expect(problems.getByTestId('export-problem')).toHaveCount(1);
      await expect(problems.getByTestId('export-problem')).toContainText('C4');
      await expect(problems.getByTestId('export-problem')).toContainText(/\b1\b/); // The start Column, counted from 1.
      await expect(problems.getByTestId('export-problem')).toContainText('4 mm');
      expect(await dialog.calls()).toHaveLength(0);
      expect(await readdir(folder)).toEqual([]);
      expect(await readTapesFile(launched.userDataDir)).toBe(tapesBefore);
    } finally {
      await launched.app.close();
    }
  });
});

test.describe('Export a Tape in cut order', () => {
  test('writes the Hole paths with x never decreasing, although the Holes are stored by Pipe, and the Outline last', async () => {
    const launched = await launchApp();
    try {
      const dialog = await stubSaveDialog(launched.app);
      const folder = await mkdtemp(join(tmpdir(), 'crancula-cut-order-'));
      const target = join(folder, 'Descent.svg');
      await dialog.answerWith(target);
      await defineOctaveOrgan(launched.window, 'Octave organ');
      await createTapeFromSong(launched.window, 'Descent', melodyC5ToC3());

      await exportForPlotter(launched.window);

      // The file exists before writeFile has finished; the snackbar appears only once it has.
      await expect(launched.window.locator('.mat-mdc-snack-bar-container').filter({hasText: target})).toBeVisible();
      const svg = await readFile(target, 'utf8');
      const paths = svg.match(/<path d="[^"]*"/g) ?? [];
      const holePaths = paths.slice(0, -1);
      expect(holePaths.length).toBeGreaterThan(1);
      const xs = holePaths.map((path) => Number(/^<path d="M([\d.]+),/.exec(path)?.[1]));
      xs.forEach((x, index) => {
        if (index > 0) expect(x).toBeGreaterThanOrEqual(xs[index - 1] ?? Infinity);
      });
      expect(paths.at(-1)).toMatch(/^<path d="M0,0 H/);
      expect(paths.at(-1)).not.toContain('A');
    } finally {
      await launched.app.close();
    }
  });
});

test.describe('Export a Tape for the Plotter', () => {
  test.describe.configure({mode: 'serial'});
  let launched: LaunchedApp;
  let dialog: SaveDialogStub;
  let folder: string;

  test.beforeAll(async () => {
    launched = await launchApp();
    folder = await mkdtemp(join(tmpdir(), 'crancula-export-'));
    dialog = await stubSaveDialog(launched.app);
    await defineOctaveOrgan(launched.window, 'Octave organ');
    await createTapeFromSong(launched.window, 'Waltz', melodyC3ToC5());
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('opens the dialog at Waltz.svg in the Documents folder with the English title', async () => {
    await dialog.answerWith('cancel');

    await exportForPlotter(launched.window);

    await expect.poll(async () => (await dialog.calls()).length).toBe(1);
    const documents = await launched.app.evaluate(({app}) => app.getPath('documents'));
    const [call] = await dialog.calls();
    expect(call?.defaultPath).toBe(join(documents, 'Waltz.svg'));
    expect(call?.title).toBe(await englishText('DIALOG_TITLE'));
    await expectExportItemEnabled(launched.window, 'export');
  });

  test('writes one SVG in mm with a path per Hole and the Tape Outline last, names the path, and leaves the Tape library alone', async () => {
    const target = join(folder, 'Waltz.svg');
    const tapesBefore = await readTapesFile(launched.userDataDir);
    await dialog.answerWith(target);

    await exportForPlotter(launched.window);

    await expect(launched.window.locator('.mat-mdc-snack-bar-container').filter({hasText: target})).toBeVisible();
    expect(await readdir(folder)).toEqual(['Waltz.svg']);
    const svg = await readFile(target, 'utf8');
    expect(svg.startsWith('<?xml')).toBe(true);
    const root = /<svg [^>]*width="([\d.]+)mm" height="([\d.]+)mm" viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    expect(root).not.toBeNull();
    expect(root?.[2]).toBe(String(TAPE_WIDTH));
    expect(root?.[3]).toBe(root?.[1]);
    expect(root?.[4]).toBe(root?.[2]);
    const holeCount = (JSON.parse(tapesBefore) as {tapes: readonly {holes: readonly unknown[]}[]}).tapes[0]?.holes.length ?? 0;
    expect(holeCount).toBeGreaterThan(0);
    const paths = svg.match(/<path /g) ?? [];
    expect(paths).toHaveLength(holeCount + 1);
    const lastPath = svg.slice(svg.lastIndexOf('<path '));
    expect(lastPath).toMatch(/^<path d="M[^"]*Z"/);
    expect(lastPath).not.toContain('A'); // The Tape Outline has no arcs; every Hole has.
    expect((await readTapesFile(launched.userDataDir))).toBe(tapesBefore);
  });

  test('exports a second time to another file', async () => {
    const target = join(folder, 'Waltz again.svg');
    await dialog.answerWith(target);

    await exportForPlotter(launched.window);

    await expect.poll(async () => (await readdir(folder)).sort()).toEqual(['Waltz again.svg', 'Waltz.svg']);
  });

  test('shows the failure in a snackbar for a missing folder, writes nothing, and then saves to a valid path', async () => {
    const before = (await readdir(folder)).sort();
    await dialog.answerWith(join(folder, 'missing', 'Waltz.svg'));

    await exportForPlotter(launched.window);

    await expect(launched.window.locator('.mat-mdc-snack-bar-container').filter({hasText: 'ENOENT'})).toBeVisible();
    expect((await readdir(folder)).sort()).toEqual(before);

    const retry = join(folder, 'Retry.svg');
    await dialog.answerWith(retry);
    await exportForPlotter(launched.window);
    await expect.poll(async () => (await readdir(folder)).includes('Retry.svg')).toBe(true);
  });
});
