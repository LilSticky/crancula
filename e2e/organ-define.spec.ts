import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {defineStreetOrgan} from './support/organ-editor';

test.describe('Define my organ', () => {
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('creates an Organ that appears in the Organ list', async () => {
    const {window} = launched;

    await defineStreetOrgan(window);

    await expect(window.getByTestId('pipe-note-name').first()).toHaveText('F3');
    await expect(window.getByTestId('pipe-note-name').nth(7)).toHaveText('C4');
    await expect(window.getByTestId('minimum-hole-length')).toHaveValue('2.5');

    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByTestId('organ')).toHaveText(/Street organ\s*31 Pipes/);
  });
});
