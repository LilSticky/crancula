import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan, saveOrgan, STREET_ORGAN} from './support/organ-editor';

test.describe('My organs are still there after a restart', () => {
  test('keeps all values and the Pipe order', async () => {
    const first = await launchApp();
    await defineStreetOrgan(first.window);
    await first.app.close();

    const {app, window} = await launchApp(first.userDataDir);
    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('organ').click();

    await expect(window.getByTestId('name')).toHaveValue(STREET_ORGAN.name);
    await expect(window.getByTestId('tape-width')).toHaveValue(STREET_ORGAN.tapeWidth);
    await expect(window.getByTestId('hole-diameter')).toHaveValue(STREET_ORGAN.holeDiameter);
    await expect(window.getByTestId('row-spacing')).toHaveValue(STREET_ORGAN.rowSpacing);
    await expect(window.getByTestId('minimum-gap')).toHaveValue(STREET_ORGAN.minimumGap);
    const notes = await window.getByTestId('pipe-note').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect(notes).toEqual(STREET_ORGAN.notes);
    await app.close();
  });

  test('loads a version 1 snapshot with a Border and saves it again as version 3 without it', async () => {
    const seeded = await launchApp();
    await seeded.app.close();
    const snapshots = join(seeded.userDataDir, 'snapshots');
    await mkdir(snapshots, {recursive: true});
    const id = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
    await writeFile(
      join(snapshots, 'organs.json'),
      JSON.stringify({
        version: 1,
        organs: [
          {
            id,
            name: STREET_ORGAN.name,
            tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5, border: 6.25},
            minimumGap: 1.5,
            leadIn: 20,
            pipes: STREET_ORGAN.notes.map((note) => ({note: Number(note)})),
          },
        ],
      }),
    );

    const {app, window} = await launchApp(seeded.userDataDir);
    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('organ').click();

    await expect(window.getByTestId('name')).toHaveValue(STREET_ORGAN.name);
    await expect(window.getByTestId('border')).toHaveValue('6.25');
    await window.getByTestId('name').fill('Street organ 2');
    await saveOrgan(window);
    await app.close();

    const saved = JSON.parse(await readFile(join(snapshots, 'organs.json'), 'utf8')) as {
      version: number;
      organs: {name: string; tapeBed: Record<string, unknown>}[];
    };
    expect(saved.version).toBe(3);
    expect(saved.organs[0].name).toBe('Street organ 2');
    expect(saved.organs[0].tapeBed).not.toHaveProperty('border');
  });

  test('reports an unreadable snapshot and keeps it untouched', async () => {
    const seeded = await launchApp();
    await seeded.app.close();
    const snapshots = join(seeded.userDataDir, 'snapshots');
    await mkdir(snapshots, {recursive: true});
    await writeFile(join(snapshots, 'organs.json'), '{oops');

    const {app, window} = await launchApp(seeded.userDataDir);

    await expect(window.getByText(/Your Organs couldn't be loaded/)).toBeVisible();
    const backups = (await readdir(snapshots)).filter((file) => file.startsWith('organs.unreadable-'));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(snapshots, backups[0]), 'utf8')).toBe('{oops');
    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByText('No Organs yet.')).toBeVisible();
    await app.close();
  });
});
