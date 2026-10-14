import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {melodyC3ToC5, notAMidiFile, threePartsWithPercussion} from './support/midi-file';
import {saveOrgan} from './support/organ-editor';
import {defineOctaveOrgan} from './support/tape-creation';

test.describe('Bring a MIDI song onto a tape', () => {
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('guides from the missing Organ to the Import Summary of the new Tape', async () => {
    const {window} = launched;

    await window.getByRole('link', {name: 'Tapes'}).click();
    await window.getByRole('link', {name: 'Bring a song onto a tape'}).click();
    await expect(window.getByTestId('no-organ-hint')).toBeVisible();
    await expect(window.getByTestId('import-form')).toHaveCount(0);
    await window.getByTestId('no-organ-hint').getByRole('link').click();
    await expect(window.getByTestId('name')).toBeVisible();

    await window.getByTestId('name').fill('Octave organ');
    await window.getByTestId('tape-width').fill('120');
    await window.getByTestId('border').fill('5');
    await window.getByTestId('hole-diameter').fill('2.5');
    await window.getByTestId('row-spacing').fill('3.5');
    await window.getByTestId('minimum-gap').fill('1.5');
    // Pipes C4 to C6 (MIDI 60 to 84).
    for (const [row, note] of Array.from({length: 25}, (_, index) => String(60 + index)).entries()) {
      await window.getByTestId('add-pipe').click();
      await window.getByTestId('pipe-note').nth(row).fill(note);
    }
    await saveOrgan(window);
    await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);

    await window.getByRole('link', {name: 'Tapes'}).click();
    await window.getByRole('link', {name: 'Bring a song onto a tape'}).click();
    await expect(window.getByTestId('import-form')).toBeVisible();
    await window.getByTestId('song-file').setInputFiles(notAMidiFile());
    await expect(window.getByTestId('song-rejection')).toHaveAttribute('data-code', 'not-a-midi-file');

    await window.getByTestId('song-file').setInputFiles(melodyC3ToC5());
    await expect(window.getByTestId('song-rejection')).toHaveCount(0);
    await window.getByTestId('create-tape').click();

    await expect(window).toHaveURL(/#?\/tapes\/[0-9a-f-]{36}$/);
    await expect(window.getByTestId('import-summary')).toBeVisible();
    await expect(window.getByTestId('transposition')).toContainText('+12');
  });

  test('puts only the selected Parts onto the Tape', async () => {
    const {window, userDataDir} = launched;
    await defineOctaveOrgan(window, 'Parts organ');
    await window.getByRole('link', {name: 'Tapes'}).click();
    await window.getByRole('link', {name: 'Bring a song onto a tape'}).click();
    await window.getByTestId('organ').selectOption({label: 'Parts organ'});
    await window.getByTestId('song-file').setInputFiles(threePartsWithPercussion());
    await expect(window.getByTestId('part')).toHaveCount(3);
    const checkbox = (index: number) =>
      window.locator(`[data-testid="part"][data-index="${index}"] input[type="checkbox"]`);
    await expect(checkbox(0)).toBeChecked();
    await expect(checkbox(1)).toBeChecked();
    await expect(checkbox(2)).not.toBeChecked();

    await checkbox(1).uncheck();
    await expect(checkbox(1)).not.toBeChecked();
    await window.getByTestId('name').fill('Melody only');
    await window.getByTestId('create-tape').click();
    await expect(window.getByTestId('tape-name')).toHaveText('Melody only');

    const stored = JSON.parse(await readFile(join(userDataDir, 'snapshots', 'tapes.json'), 'utf8')) as {
      tapes: {name: string; selectedParts: number[]; holes: [number, number, number][]}[];
    };
    const tape = stored.tapes.find(({name}) => name === 'Melody only');
    expect(tape?.selectedParts).toEqual([0]);
    // The Lead plays three Notes; the Bass, an octave below, would add three more Holes.
    expect(tape?.holes.length).toBe(3);
  });
});
