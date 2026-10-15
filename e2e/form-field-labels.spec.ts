import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';

test.describe('Organ editor form field labels', () => {
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
    await launched.window.getByRole('link', {name: 'Organs'}).click();
    await launched.window.getByTestId('new-organ').click();
    await launched.window.getByTestId('add-pipe').click();
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('shows the label of the Tape width field', async () => {
    await expect(launched.window.locator('mat-label', {hasText: 'Tape width (mm)'})).toBeVisible();
  });

  test('shows the label of a Pipe MIDI note field', async () => {
    await expect(launched.window.locator('mat-label', {hasText: 'MIDI note'}).first()).toBeVisible();
  });
});
