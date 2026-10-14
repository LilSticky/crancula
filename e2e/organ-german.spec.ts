import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';

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
    await window.getByTestId('tape-width').fill('20');
    await window.getByTestId('border').fill('5');
    await window.getByTestId('hole-diameter').fill('2.5');
    await window.getByTestId('row-spacing').fill('3.5');
    await window.getByTestId('minimum-gap').fill('1.5');
    for (const note of ['60', '60', '62', '64', '65']) {
      await window.getByTestId('add-pipe').click();
      await window.getByTestId('pipe-note').last().fill(note);
    }

    const messages = await window.getByTestId('violation').allTextContents();
    const text = messages.join('\n');
    expect(text).toContain('Die Pfeifen brauchen');
    expect(text).toContain('breit');
    expect(text).toContain('Eine andere Pfeife spielt bereits');
    expect(text).toContain(german.ORGAN.VIOLATION['DUPLICATE_PIPE']?.split('{{')[0]?.trim());

    const visible = (await window.locator('body').innerText()) + text;
    expect(visible).not.toMatch(/\bORGAN\.[A-Z_.]+/);
    expect(visible).not.toMatch(/\bPAGES\.[A-Z_.]+/);
    await app.close();
  });
});
