import {mkdtemp, readdir, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {melodyC3ToC5} from './support/midi-file';
import {createTapeFromSong, defineOctaveOrgan} from './support/tape-creation';
import {stubSaveDialog, type SaveDialogStub} from './support/save-dialog';

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

    await launched.window.getByTestId('export').click();

    await expect.poll(async () => (await dialog.calls()).length).toBe(1);
    const documents = await launched.app.evaluate(({app}) => app.getPath('documents'));
    const [call] = await dialog.calls();
    expect(call?.defaultPath).toBe(join(documents, 'Waltz.svg'));
    expect(call?.title).toBe(await englishText('DIALOG_TITLE'));
    await expect(launched.window.getByTestId('export')).toBeEnabled();
  });

  test('writes one SVG in mm with a path per Hole and the Tape Outline last, names the path, and leaves the Tape library alone', async () => {
    const target = join(folder, 'Waltz.svg');
    const tapesBefore = await readTapesFile(launched.userDataDir);
    await dialog.answerWith(target);

    await launched.window.getByTestId('export').click();

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

    await launched.window.getByTestId('export').click();

    await expect.poll(async () => (await readdir(folder)).sort()).toEqual(['Waltz again.svg', 'Waltz.svg']);
  });

  test('shows the failure in a snackbar for a missing folder, writes nothing, and then saves to a valid path', async () => {
    const before = (await readdir(folder)).sort();
    await dialog.answerWith(join(folder, 'missing', 'Waltz.svg'));

    await launched.window.getByTestId('export').click();

    await expect(launched.window.locator('.mat-mdc-snack-bar-container').filter({hasText: 'ENOENT'})).toBeVisible();
    expect((await readdir(folder)).sort()).toEqual(before);

    const retry = join(folder, 'Retry.svg');
    await dialog.answerWith(retry);
    await launched.window.getByTestId('export').click();
    await expect.poll(async () => (await readdir(folder)).includes('Retry.svg')).toBe(true);
  });
});
