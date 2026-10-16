import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {melodyC3ToC5} from './support/midi-file';
import {createTapeFromSong, defineOctaveOrgan} from './support/tape-creation';

interface StoredTape {
  readonly name: string;
  readonly transposition: number;
  readonly holes: readonly unknown[];
  readonly selectedParts: readonly number[];
  readonly songId: string;
}

interface StoredSong {
  readonly id: string;
}

async function readTapesFile(userDataDir: string): Promise<string> {
  return readFile(join(userDataDir, 'snapshots', 'tapes.json'), 'utf8');
}

test.describe('My tapes are still there after a restart', () => {
  test('keeps the Tape unchanged, and forgets a removed Tape', async () => {
    const first = await launchApp();
    await defineOctaveOrgan(first.window, 'Octave organ');
    await createTapeFromSong(first.window, 'Scale', melodyC3ToC5());
    await first.app.close();
    const stored = await readTapesFile(first.userDataDir);
    const [tape] = (JSON.parse(stored) as {tapes: readonly StoredTape[]}).tapes;
    expect(tape?.name).toBe('Scale');
    expect(tape?.holes.length).toBeGreaterThan(0);
    expect(tape?.transposition).toBe(12);
    expect(tape?.selectedParts).toEqual([0]);
    const songs = (JSON.parse(stored) as {songs: readonly StoredSong[]}).songs;
    expect(songs).toHaveLength(1);
    expect(tape?.songId).toBe(songs[0]?.id);

    const second = await launchApp(first.userDataDir);
    await second.window.getByRole('link', {name: 'Tapes'}).click();
    await expect(second.window.getByTestId('tape')).toHaveCount(1);
    await expect(second.window.getByTestId('tape-name')).toHaveText('Scale');
    await expect(second.window.getByTestId('tape-organ')).toHaveText('Octave organ');
    await second.window.getByRole('button', {name: 'More actions for Scale'}).click();
    await second.window.getByTestId('delete-tape').click();
    await second.window.getByRole('button', {name: 'Cancel'}).click();
    await expect(second.window.getByTestId('tape')).toHaveCount(1);
    await second.app.close();
    expect(await readTapesFile(first.userDataDir)).toBe(stored);

    const third = await launchApp(first.userDataDir);
    await third.window.getByRole('link', {name: 'Tapes'}).click();
    await third.window.getByRole('button', {name: 'More actions for Scale'}).click();
    await third.window.getByTestId('delete-tape').click();
    await third.window.getByRole('button', {name: 'Confirm'}).click();
    await expect(third.window.getByTestId('tape')).toHaveCount(0);
    await third.app.close();

    const fourth = await launchApp(first.userDataDir);
    await fourth.window.getByRole('link', {name: 'Tapes'}).click();
    await expect(fourth.window.getByText('No Tapes yet.')).toBeVisible();
    await fourth.app.close();
  });

  test('reports an unreadable Tape snapshot, keeps it untouched, and the Organs still work', async () => {
    const seeded = await launchApp();
    await defineOctaveOrgan(seeded.window, 'Octave organ');
    await seeded.app.close();
    const snapshots = join(seeded.userDataDir, 'snapshots');
    await mkdir(snapshots, {recursive: true});
    await writeFile(join(snapshots, 'tapes.json'), '{oops');

    const {app, window} = await launchApp(seeded.userDataDir);

    await expect(window.getByText(/Your Tapes couldn't be loaded/)).toBeVisible();
    const backups = (await readdir(snapshots)).filter((file) => file.startsWith('tapes.unreadable-'));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(snapshots, backups[0]), 'utf8')).toBe('{oops');
    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByTestId('organ')).toHaveCount(1);
    await expect(window.getByTestId('organ')).toContainText('Octave organ');
    await app.close();
  });

  test('lists Tapes whose Organs are unreadable, cannot open them, and leaves tapes.json unchanged', async () => {
    const seeded = await launchApp();
    await defineOctaveOrgan(seeded.window, 'Octave organ');
    await createTapeFromSong(seeded.window, 'Scale', melodyC3ToC5());
    await seeded.app.close();
    const stored = await readTapesFile(seeded.userDataDir);
    await writeFile(join(seeded.userDataDir, 'snapshots', 'organs.json'), '{oops');

    const {app, window} = await launchApp(seeded.userDataDir);
    await window.getByRole('link', {name: 'Tapes'}).click();

    await expect(window.getByTestId('tape')).toHaveCount(1);
    await expect(window.getByTestId('tape-name')).toHaveText('Scale');
    await expect(window.getByTestId('tape-organ')).toHaveText('Organ not available');
    await expect(window.getByTestId('open-tape')).toHaveAttribute('aria-disabled', 'true');
    await app.close();
    expect(await readTapesFile(seeded.userDataDir)).toBe(stored);
  });
});
