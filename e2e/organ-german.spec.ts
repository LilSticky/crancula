import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {STREET_ORGAN} from './support/organ-editor';

interface GermanViolations {
  readonly ORGAN: {readonly VIOLATION: Record<string, string>};
}

const german: GermanViolations = JSON.parse(readFileSync(join(__dirname, '../src/assets/i18n/de.json'), 'utf8'));

test.describe('I can use the Organ editor in German', () => {
  test('shows German texts and Violations without translation keys', async () => {
    const {app, window} = await launchApp();

    await window.getByTestId('language-switch').locator('[data-language="de"]').click();
    await window.getByRole('link', {name: 'Drehorgeln'}).click();
    await window.getByTestId('new-organ').click();

    await window.getByTestId('name').fill('Drehorgel');
    await window.getByTestId('tape-width').fill('10');
    await window.getByTestId('hole-diameter').fill('2.5');
    await window.getByTestId('row-spacing').fill('3.5');
    await window.getByTestId('minimum-gap').fill('1.5');
    await window.getByTestId('lead-in').fill('20');
    for (const note of ['60', '60', '62', '64', '65']) {
      await window.getByTestId('add-pipe').click();
      await window.getByTestId('pipe-note').last().fill(note);
    }

    const messages = await window.getByTestId('violation').allTextContents();
    const text = messages.join('\n');
    const fit = await window.getByTestId('fit-check').innerText();
    expect(fit).toContain('mehr als die Bandbreite');
    expect(text).toContain('Eine andere Pfeife spielt bereits');
    expect(text).toContain(german.ORGAN.VIOLATION['DUPLICATE_PIPE']?.split('{{')[0]?.trim());

    const visible = (await window.locator('body').innerText()) + text + fit;
    expect(visible).not.toMatch(/\bORGAN\.[A-Z_.]+/);
    expect(visible).not.toMatch(/\bPAGES\.[A-Z_.]+/);
    await app.close();
  });
  test('saves decimals typed with a comma and shows them with a comma after a restart', async () => {
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
    for (const note of STREET_ORGAN.notes) {
      await first.window.getByTestId('add-pipe').click();
      await first.window.getByTestId('pipe-note').last().fill(note);
    }
    await first.window.getByTestId('save-organ').click();
    await expect(first.window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
    await expect(first.window.getByTestId('save-organ')).toBeDisabled();
    await first.app.close();

    const {app, window} = await launchApp(first.userDataDir);
    await window.getByRole('link', {name: 'Drehorgeln'}).click();
    await window.getByTestId('organ').click();

    await expect(window.getByTestId('hole-diameter')).toHaveValue('2,5');
    await expect(window.getByTestId('row-spacing')).toHaveValue('3,5');
    await expect(window.getByTestId('minimum-hole-length')).toHaveValue('2,5');
    await expect(window.getByTestId('border')).toHaveValue('6,25');
    const fit = await window.getByTestId('fit-check').innerText();
    expect(fit).toContain('107,5');
    expect(fit).toContain('6,25');
    expect(fit).not.toMatch(/\d\.\d/);
    await app.close();
  });
});
