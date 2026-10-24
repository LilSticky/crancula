import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan, saveOrgan, STREET_ORGAN} from './support/organ-editor';

const ORGAN_ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';

interface StoredOrgan {
  readonly name: string;
  readonly tapePerCrankTurn?: number;
  readonly crankSpeedRange?: {readonly slowest: number; readonly fastest: number};
}

interface StoredSnapshot {
  readonly version: number;
  readonly organs: readonly StoredOrgan[];
}

async function readSnapshot(userDataDir: string): Promise<StoredSnapshot> {
  const text = await readFile(join(userDataDir, 'snapshots', 'organs.json'), 'utf8');
  return JSON.parse(text) as StoredSnapshot;
}

/** Opens the first Organ of the list in its editor. */
async function openFirstOrgan(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('organ').click();
}

test.describe('I can set the Tape per Crank turn of my organs', () => {
  test('keeps the Tape per Crank turn after a restart', async () => {
    const first = await launchApp();
    await defineStreetOrgan(first.window);
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await openFirstOrgan(second.window);
    await second.window.getByTestId('tape-per-crank-turn').fill('120');
    await saveOrgan(second.window);
    await second.app.close();

    const {app, window} = await launchApp(first.userDataDir);
    await openFirstOrgan(window);

    await expect(window.getByTestId('name')).toHaveValue(STREET_ORGAN.name);
    await expect(window.getByTestId('tape-per-crank-turn')).toHaveValue('120');
    await app.close();
  });

  test('keeps a decimal typed with a comma in German after a restart', async () => {
    const first = await launchApp();
    await first.window.getByTestId('language-switch').locator('[data-language="de"]').click();
    await first.window.getByRole('link', {name: 'Drehorgeln'}).click();
    await first.window.getByTestId('new-organ').click();

    await first.window.getByTestId('name').fill(STREET_ORGAN.name);
    await first.window.getByTestId('tape-width').fill(STREET_ORGAN.tapeWidth);
    await first.window.getByTestId('hole-diameter').fill('2,5');
    await first.window.getByTestId('row-spacing').fill('3,5');
    await first.window.getByTestId('lead-in').fill(STREET_ORGAN.leadIn);
    await first.window.getByTestId('minimum-gap').fill(STREET_ORGAN.minimumGap);
    await first.window.getByTestId('tape-per-crank-turn').fill('12,5');
    for (const note of STREET_ORGAN.notes) {
      await first.window.getByTestId('add-pipe').click();
      await first.window.getByTestId('pipe-note').last().fill(note);
    }
    await saveOrgan(first.window);
    await expect(first.window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
    await first.app.close();

    const {app, window} = await launchApp(first.userDataDir);
    await window.getByRole('link', {name: 'Drehorgeln'}).click();
    await window.getByTestId('organ').click();

    await expect(window.getByTestId('tape-per-crank-turn')).toHaveValue('12,5');
    await app.close();
  });

  test('loads a version 3 snapshot with the Tape per Crank turn empty and saves it as version 5 with the value set', async () => {
    const seeded = await launchApp();
    await seeded.app.close();
    const snapshots = join(seeded.userDataDir, 'snapshots');
    await mkdir(snapshots, {recursive: true});
    await writeFile(
      join(snapshots, 'organs.json'),
      JSON.stringify({
        version: 3,
        organs: [
          {
            id: ORGAN_ID,
            name: STREET_ORGAN.name,
            tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
            minimumGap: 1.5,
            leadIn: 20,
            pipes: STREET_ORGAN.notes.map((note) => ({note: Number(note)})),
          },
        ],
      }),
    );

    const {app, window} = await launchApp(seeded.userDataDir);
    await openFirstOrgan(window);

    await expect(window.getByTestId('name')).toHaveValue(STREET_ORGAN.name);
    await expect(window.getByTestId('tape-per-crank-turn')).toHaveValue('');
    await window.getByTestId('tape-per-crank-turn').fill('120');
    await saveOrgan(window);
    await app.close();

    const saved = await readSnapshot(seeded.userDataDir);
    expect(saved.version).toBe(5);
    expect(saved.organs[0]?.name).toBe(STREET_ORGAN.name);
    expect(saved.organs[0]?.tapePerCrankTurn).toBe(120);
  });

  test('saves a version 3 Organ without a Tape per Crank turn as version 5 without the property', async () => {
    const seeded = await launchApp();
    await seeded.app.close();
    const snapshots = join(seeded.userDataDir, 'snapshots');
    await mkdir(snapshots, {recursive: true});
    await writeFile(
      join(snapshots, 'organs.json'),
      JSON.stringify({
        version: 3,
        organs: [
          {
            id: ORGAN_ID,
            name: STREET_ORGAN.name,
            tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
            minimumGap: 1.5,
            leadIn: 20,
            pipes: STREET_ORGAN.notes.map((note) => ({note: Number(note)})),
          },
        ],
      }),
    );

    const {app, window} = await launchApp(seeded.userDataDir);
    await openFirstOrgan(window);
    await window.getByTestId('name').fill('Street organ 2');
    await saveOrgan(window);
    await app.close();

    const saved = await readSnapshot(seeded.userDataDir);
    expect(saved.version).toBe(5);
    expect(saved.organs[0]?.name).toBe('Street organ 2');
    expect(saved.organs[0]).not.toHaveProperty('tapePerCrankTurn');
  });

  test('keeps the Crank speed range fields after a restart', async () => {
    const first = await launchApp();
    await defineStreetOrgan(first.window);
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await openFirstOrgan(second.window);
    await expect(second.window.getByTestId('slowest-crank-speed')).toHaveValue('30');
    await expect(second.window.getByTestId('fastest-crank-speed')).toHaveValue('120');
    await second.window.getByTestId('slowest-crank-speed').fill('40');
    await second.window.getByTestId('fastest-crank-speed').fill('100');
    await saveOrgan(second.window);
    await second.app.close();

    const {app, window} = await launchApp(first.userDataDir);
    await openFirstOrgan(window);

    await expect(window.getByTestId('slowest-crank-speed')).toHaveValue('40');
    await expect(window.getByTestId('fastest-crank-speed')).toHaveValue('100');
    await app.close();
  });

  test('loads a version 4 snapshot with the Crank speed range at 30 to 120 and saves it as version 5 with the range', async () => {
    const seeded = await launchApp();
    await seeded.app.close();
    const snapshots = join(seeded.userDataDir, 'snapshots');
    await mkdir(snapshots, {recursive: true});
    await writeFile(
      join(snapshots, 'organs.json'),
      JSON.stringify({
        version: 4,
        organs: [
          {
            id: ORGAN_ID,
            name: STREET_ORGAN.name,
            tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
            minimumGap: 1.5,
            leadIn: 20,
            tapePerCrankTurn: 120,
            pipes: STREET_ORGAN.notes.map((note) => ({note: Number(note)})),
          },
        ],
      }),
    );

    const {app, window} = await launchApp(seeded.userDataDir);
    await openFirstOrgan(window);

    await expect(window.getByTestId('tape-per-crank-turn')).toHaveValue('120');
    await expect(window.getByTestId('slowest-crank-speed')).toHaveValue('30');
    await expect(window.getByTestId('fastest-crank-speed')).toHaveValue('120');
    await window.getByTestId('name').fill('Street organ 2');
    await saveOrgan(window);
    await app.close();

    const saved = await readSnapshot(seeded.userDataDir);
    expect(saved.version).toBe(5);
    expect(saved.organs[0]?.tapePerCrankTurn).toBe(120);
    expect(saved.organs[0]?.crankSpeedRange).toEqual({slowest: 30, fastest: 120});
  });
});
