import {test} from '@playwright/test';
import type {LaunchedApp} from './launch-app';

/**
 * Sizes the window so that its viewport (`innerWidth` x `innerHeight`) is exactly width x height: on some platforms
 * `setContentSize` leaves a different viewport (the window frame is counted twice), so it corrects by the difference.
 */
export async function resizeWindow({app, window}: LaunchedApp, width: number, height: number): Promise<boolean> {
  const setContentSize = (size: {width: number; height: number}) =>
    app.evaluate(({BrowserWindow}, wanted) => BrowserWindow.getAllWindows()[0]?.setContentSize(wanted.width, wanted.height), size);
  const viewport = () => window.evaluate(() => ({width: window.innerWidth, height: window.innerHeight}));
  await setContentSize({width, height});
  for (let attempt = 0; attempt < 6; attempt++) {
    await window.waitForTimeout(100); // The viewport follows the window asynchronously.
    const actual = await viewport();
    if (actual.width === width && actual.height === height) return true;
    await setContentSize({width: 2 * width - actual.width, height: 2 * height - actual.height});
  }
  await window.waitForTimeout(100);
  const last = await viewport();
  return last.width === width && last.height === height;
}

/**
 * Sizes the window like `resizeWindow`; when the screen cannot provide exactly that viewport, skips the running test
 * (closing the app first when `closeOnSkip` is set) instead of letting it assert on a size the machine cannot give.
 */
export async function resizeWindowOrSkip(launched: LaunchedApp, width: number, height: number, closeOnSkip = false): Promise<void> {
  if (await resizeWindow(launched, width, height)) return;
  const got = await launched.window.evaluate(() => ({width: window.innerWidth, height: window.innerHeight}));
  if (closeOnSkip) await launched.app.close();
  test.skip(true, `screen too small for ${width}×${height}: got ${got.width}×${got.height}`);
}
