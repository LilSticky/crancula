import type {LaunchedApp} from './launch-app';

/**
 * Sizes the window so that its viewport (`innerWidth` x `innerHeight`) is exactly width x height: on some platforms
 * `setContentSize` leaves a different viewport (the window frame is counted twice), so it corrects by the difference.
 */
export async function resizeWindow({app, window}: LaunchedApp, width: number, height: number): Promise<void> {
  const setContentSize = (size: {width: number; height: number}) =>
    app.evaluate(({BrowserWindow}, wanted) => BrowserWindow.getAllWindows()[0]?.setContentSize(wanted.width, wanted.height), size);
  const viewport = () => window.evaluate(() => ({width: window.innerWidth, height: window.innerHeight}));
  await setContentSize({width, height});
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = await viewport();
    if (actual.width === width && actual.height === height) return;
    await setContentSize({width: 2 * width - actual.width, height: 2 * height - actual.height});
  }
}
