import {expect, test, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan, pickPipeMenuItem, saveOrgan, STREET_ORGAN} from './support/organ-editor';

const pipeNotes = (window: Page) =>
  window.getByTestId('pipe-note').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

test.describe('I can rearrange and delete my organs', () => {
  test('keeps the reordered and reduced Pipes after a restart', async () => {
    const first = await launchApp();
    await defineStreetOrgan(first.window);
    const last = STREET_ORGAN.notes.length - 1;
    await pickPipeMenuItem(first.window, last, 'move-up');
    await pickPipeMenuItem(first.window, 0, 'remove-pipe');
    const expected = await pipeNotes(first.window);
    expect(expected).toHaveLength(STREET_ORGAN.notes.length - 1);
    expect(expected.slice(-2)).toEqual([STREET_ORGAN.notes[last], STREET_ORGAN.notes[last - 1]]);
    await saveOrgan(first.window);
    await first.app.close();

    const {app, window} = await launchApp(first.userDataDir);
    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('organ').click();

    expect(await pipeNotes(window)).toEqual(expected);
    await app.close();
  });

  test('keeps what I type in a number field while I am typing', async () => {
    const {app, window} = await launchApp();
    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('new-organ').click();
    const spacing = window.getByTestId('row-spacing');

    await spacing.pressSequentially('3.50');
    await expect(spacing).toHaveValue('3.50');
    await spacing.clear();
    await spacing.pressSequentially('0.05');
    await expect(spacing).toHaveValue('0.05');
    await app.close();
  });

  test('undoes the text I typed in an Organ field with the Edit menu item, without a Tape open (#122)', async () => {
    const launched = await launchApp();
    const {window, app} = launched;
    try {
      await window.getByRole('link', {name: 'Organs'}).click();
      await window.getByTestId('new-organ').click();
      const name = window.getByTestId('name');
      await expect(name).toHaveValue('');
      // One insertion, so that one undo step takes all of it back (Chromium groups typed text differently).
      await name.fill('Street');
      await expect(name).toHaveValue('Street');

      await app.evaluate(
        ({BrowserWindow, Menu}, itemId) => {
          Menu.getApplicationMenu()?.getMenuItemById(itemId)?.click(undefined, BrowserWindow.getAllWindows()[0]);
        },
        'undo',
      );

      await expect(name).toHaveValue('');
    } finally {
      await app.close();
    }
  });

  test('tells me when the text of a number field is not a number', async () => {
    const {app, window} = await launchApp();
    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('new-organ').click();

    await window.getByTestId('tape-width').pressSequentially('1e');

    const message = window.locator('[data-testid="violation"][data-path="tapeBed.tapeWidth"]');
    await expect(message).toHaveText('Enter a number.');
    await window.getByTestId('tape-width').fill('120');
    await expect(message).toHaveCount(0);
    await app.close();
  });

  test('deletes an Organ from the list for good', async () => {
    const first = await launchApp();
    await defineStreetOrgan(first.window);
    await first.window.getByRole('link', {name: 'Organs'}).click();
    await first.window.getByRole('button', {name: 'More actions for Street organ'}).click();
    await first.window.getByTestId('delete-organ').click();
    await first.window.getByRole('button', {name: 'Confirm'}).click();
    await expect(first.window.getByText('No Organs yet.')).toBeVisible();
    await first.app.close();

    const {app, window} = await launchApp(first.userDataDir);
    await window.getByRole('link', {name: 'Organs'}).click();
    await expect(window.getByText('No Organs yet.')).toBeVisible();
    await app.close();
  });

  test('deletes an Organ from its editor and returns to the list', async () => {
    const {app, window} = await launchApp();
    await defineStreetOrgan(window);

    await window.getByTestId('delete-organ').click();
    await window.getByRole('button', {name: 'Confirm'}).click();

    await expect(window).toHaveURL(/#?\/organs$/);
    await expect(window.getByText('No Organs yet.')).toBeVisible();
    await app.close();
  });
});
