import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {melodyC3ToC5, notAMidiFile} from './support/midi-file';
import {defineOctaveOrgan} from './support/tape-creation';

test.describe('I can bring a Song onto a Tape in German', () => {
  test('shows German texts and messages without translation keys', async () => {
    const {app, window} = await launchApp();
    await defineOctaveOrgan(window, 'Drehorgel');
    await window.getByTestId('language-switch').locator('[data-language="de"]').click();

    const seen: string[] = [];
    const collect = async (): Promise<void> => {
      seen.push(await window.locator('body').innerText());
    };

    await window.getByRole('link', {name: 'Bänder'}).click();
    await window.getByRole('link', {name: 'Ein Lied auf ein Band bringen'}).click();
    await expect(window.getByTestId('import-form')).toBeVisible();
    await collect();

    await window.getByTestId('song-file').setInputFiles(notAMidiFile());
    await expect(window.getByTestId('song-rejection')).toHaveAttribute('data-code', 'not-a-midi-file');
    const rejection = (await window.getByTestId('song-rejection').innerText()).trim();
    expect(rejection).toContain('keine MIDI-Datei');
    await collect();

    await window.getByTestId('song-file').setInputFiles(melodyC3ToC5());
    await expect(window.getByTestId('song-rejection')).toHaveCount(0);
    await expect(window.getByTestId('name')).not.toHaveValue('');
    await window.getByTestId('name').fill('');
    await window.getByTestId('name').blur(); // Create Tape stays disabled; the Violation shows once the field was touched.
    await expect(window.getByTestId('violation').first()).toBeVisible();
    const violation = (await window.getByTestId('violation').first().innerText()).trim();
    expect(violation).toContain('Namen');
    await collect();

    await window.getByTestId('name').fill('Tonleiter');
    await window.getByTestId('create-tape').click();
    await expect(window.getByTestId('tape-name')).toHaveText('Tonleiter');
    await expect(window.getByTestId('import-summary')).toBeVisible();
    await collect();

    await window.getByRole('link', {name: 'Bänder'}).click();
    await expect(window.getByTestId('tape')).toHaveCount(1);
    await collect();

    await window.getByTestId('open-tape').click();
    await expect(window.getByTestId('tape-name')).toHaveText('Tonleiter');
    await collect();

    const visible = seen.join('\n') + rejection + violation;
    expect(visible).not.toMatch(/\bTAPE\.[A-Z_.]+/);
    expect(visible).not.toMatch(/\bORGAN\.[A-Z_.]+/);
    expect(visible).not.toMatch(/\bPAGES\.[A-Z_.]+/);
    await app.close();
  });
});
