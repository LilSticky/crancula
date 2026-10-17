import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';

test.describe('Reloading the window keeps me on the page', () => {
  test('shows the Tapes page again after View > Reload on it', async () => {
    const {app, window} = await launchApp();
    await window.getByRole('link', {name: 'Tapes'}).click();
    await expect(window.getByRole('heading', {name: 'Tapes', level: 1})).toBeVisible();

    await window.reload();

    await expect(window.getByRole('heading', {name: 'Tapes', level: 1})).toBeVisible();
    await app.close();
  });

  test('shows the Organ editor again after reloading a new Organ', async () => {
    const {app, window} = await launchApp();
    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('new-organ').click();
    await expect(window.getByTestId('name')).toBeVisible();

    await window.reload();

    await expect(window.getByTestId('name')).toBeVisible();
    await app.close();
  });
});
