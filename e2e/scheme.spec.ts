import {expect, test, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';

/** The brightness (0 to 255) of the page background, read from the computed colour of the body. */
async function bodyBrightness(window: Page): Promise<number> {
  return window.evaluate(() => {
    const [red = 255, green = 255, blue = 255] = (getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    return (red + green + blue) / 3;
  });
}

test.describe('The shell and the colour scheme', () => {
  test('starts on the Organ list with the rail, and keeps the dark scheme after a restart', async () => {
    const first = await launchApp();
    await expect(first.window.getByTestId('rail')).toBeVisible();
    await expect(first.window.getByTestId('rail-nav').getByRole('link', {name: 'Organs'})).toBeVisible();
    await expect(first.window.getByTestId('rail-nav').getByRole('link', {name: 'Tapes'})).toBeVisible();
    await expect(first.window.getByRole('heading', {level: 1, name: 'Organs'})).toBeVisible();
    await expect(first.window.getByTestId('new-organ')).toBeVisible();

    await first.window.getByTestId('scheme-switch').locator('[data-scheme="dark"]').click();

    await expect(first.window.locator('html')).toHaveClass(/\bcr-dark\b/);
    await expect.poll(() => bodyBrightness(first.window)).toBeLessThan(60);
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await expect(second.window.locator('html')).toHaveClass(/\bcr-dark\b/);
    await expect.poll(() => bodyBrightness(second.window)).toBeLessThan(60);
    await second.app.close();
  });
});
