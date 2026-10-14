import {describe, expect, it} from 'vitest';
import {windowOptions} from './window-options';

const workArea = {width: 1280, height: 720};
const preloadPath = '/app/preload.js';

describe('windowOptions', () => {
  // A window that was never shown does not paint, so Playwright's clicks wait forever.
  // Headless runs therefore show the window, but invisibly: off screen, transparent, unfocusable.
  it('keeps the window rendering but invisible when CRANCULA_HEADLESS is 1', () => {
    const options = windowOptions({CRANCULA_HEADLESS: '1'}, workArea, preloadPath, 'win32');

    expect(options.show).not.toBe(false);
    expect(options).toMatchObject({opacity: 0, skipTaskbar: true, focusable: false});
    expect(options.x).toBeLessThan(-workArea.width);
    expect(options.y).toBeLessThan(-workArea.height);
  });

  // On Linux a transparent window renders about one frame per second, and every click then waits about 2 s.
  it('keeps the headless window opaque on Linux, so that it renders at full speed', () => {
    const options = windowOptions({CRANCULA_HEADLESS: '1'}, workArea, preloadPath, 'linux');

    expect(options.opacity ?? 1).toBe(1);
    expect(options).toMatchObject({skipTaskbar: true, focusable: false});
    expect(options.x).toBeLessThan(-workArea.width);
    expect(options.y).toBeLessThan(-workArea.height);
  });

  it('shows the window on screen when CRANCULA_HEADLESS is not set', () => {
    const options = windowOptions({}, workArea, preloadPath, 'win32');

    expect(options.show ?? true).toBe(true);
    expect(options.opacity ?? 1).toBe(1);
    expect(options.skipTaskbar ?? false).toBe(false);
    expect(options.focusable ?? true).toBe(true);
  });

  it('shows the window on screen when CRANCULA_HEADLESS is anything but 1', () => {
    const options = windowOptions({CRANCULA_HEADLESS: '0'}, workArea, preloadPath, 'win32');

    expect(options.opacity ?? 1).toBe(1);
    expect(options).toMatchObject({x: 0, y: 0});
  });

  it('fills the work area from the top left corner', () => {
    expect(windowOptions({}, workArea, preloadPath, 'win32')).toMatchObject({x: 0, y: 0, width: 1280, height: 720});
  });

  it.each([{}, {CRANCULA_HEADLESS: '1'}])('always isolates the renderer from Node (%j)', (env) => {
    expect(windowOptions(env, workArea, preloadPath, 'win32').webPreferences).toMatchObject({
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  // An invisible window counts as hidden or occluded, and Chromium then throttles requestAnimationFrame
  // (seen on macOS CI: 1 frame in 500 ms). Headless runs must render at full speed on every platform.
  it.each<NodeJS.Platform>(['win32', 'linux', 'darwin'])(
    'keeps the headless window from throttling in the background on %s',
    (platform) => {
      const options = windowOptions({CRANCULA_HEADLESS: '1'}, workArea, preloadPath, platform);

      expect(options.webPreferences?.backgroundThrottling).toBe(false);
    },
  );

  it('leaves background throttling at its default when CRANCULA_HEADLESS is not set', () => {
    const options = windowOptions({}, workArea, preloadPath, 'darwin');

    expect(options.webPreferences?.backgroundThrottling ?? true).toBe(true);
  });
});
