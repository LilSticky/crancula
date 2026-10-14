import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';

test.describe('Headless run', () => {
  test.skip(process.env['HEADED'] === '1', 'HEADED=1 shows the window on purpose');

  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('still renders frames, so that clicks can be performed', async () => {
    const painted = await launched.window.evaluate(
      () => new Promise<boolean>((resolve) => requestAnimationFrame(() => resolve(true))),
    );
    expect(painted).toBe(true);
  });
});
