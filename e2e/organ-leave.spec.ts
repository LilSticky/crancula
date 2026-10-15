import {expect, test, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan, STREET_ORGAN} from './support/organ-editor';

const pipeNotes = (window: Page) =>
  window.getByTestId('pipe-note').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

test.describe('I am warned before losing unsaved changes', () => {
  test('lists the problems, lets me stay, and discards the invalid changes on request', async () => {
    const {app, window} = await launchApp();
    await defineStreetOrgan(window);

    // The second Pipe now plays the same note as the first: a duplicate Pipe that cannot be saved.
    await window.getByTestId('pipe-note').nth(1).fill(STREET_ORGAN.notes[0]);
    await window.getByTestId('save-organ').click();
    await expect(window.getByTestId('error-summary')).toBeVisible();
    await expect(window.getByTestId('error-summary-entry').first()).toBeVisible();

    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByTestId('leave-problem').first()).toBeVisible();
    await expect(window.getByTestId('leave-problem').first()).toContainText(/already/i);

    await window.getByTestId('stay').click();
    await expect(window.getByTestId('leave-problem')).toHaveCount(0);
    await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
    expect(await pipeNotes(window)).toEqual([STREET_ORGAN.notes[0], STREET_ORGAN.notes[0], ...STREET_ORGAN.notes.slice(2)]);

    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('discard').click();
    await expect(window).toHaveURL(/#?\/organs$/);

    await window.getByTestId('organ').click();
    expect(await pipeNotes(window)).toEqual(STREET_ORGAN.notes);
    await app.close();
  });
});
