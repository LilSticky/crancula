import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';

test.describe('The application menu follows the language', () => {
  test('shows German menu labels after switching to German and keeps them after a restart', async () => {
    const first = await launchApp();
    const labels = () => first.app.evaluate(({Menu}) => Menu.getApplicationMenu()?.items.map((item) => item.label) ?? []);
    await expect.poll(labels).toContain('Edit');

    await first.window.getByTestId('language-switch').locator('[data-language="de"]').click();

    await expect.poll(labels).toContain('Bearbeiten');
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await expect
      .poll(() => second.app.evaluate(({Menu}) => Menu.getApplicationMenu()?.items.map((item) => item.label) ?? []))
      .toContain('Bearbeiten');
    await second.app.close();
  });
});
