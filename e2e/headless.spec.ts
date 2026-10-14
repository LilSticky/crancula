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

  // Playwright waits for animation frames before every click; at one frame per second each click takes 2 s.
  test('renders frames at full speed, so that clicks are not slowed down', async () => {
    const framesInHalfASecond = await launched.window.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const start = performance.now();
          let frames = 0;
          const count = (): void => {
            frames++;
            if (performance.now() - start < 500) requestAnimationFrame(count);
            else resolve(frames);
          };
          requestAnimationFrame(count);
        }),
    );
    expect(framesInHalfASecond).toBeGreaterThan(10);
  });
});
