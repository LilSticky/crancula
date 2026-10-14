import {describe, expect, it} from 'vitest';
import {windowOptions} from './window-options';

const workArea = {width: 1280, height: 720};
const preloadPath = '/app/preload.js';

describe('windowOptions', () => {
  // A window that was never shown does not paint, so Playwright's clicks wait forever.
  // Headless runs therefore show the window, but invisibly: off screen, transparent, unfocusable.
  it('keeps the window rendering but invisible when CRANCULA_HEADLESS is 1', () => {
    const options = windowOptions({CRANCULA_HEADLESS: '1'}, workArea, preloadPath);

    expect(options.show).not.toBe(false);
    expect(options).toMatchObject({opacity: 0, skipTaskbar: true, focusable: false});
    expect(options.x).toBeLessThan(-workArea.width);
    expect(options.y).toBeLessThan(-workArea.height);
  });

  it('shows the window on screen when CRANCULA_HEADLESS is not set', () => {
    const options = windowOptions({}, workArea, preloadPath);

    expect(options.show ?? true).toBe(true);
    expect(options.opacity ?? 1).toBe(1);
    expect(options.skipTaskbar ?? false).toBe(false);
    expect(options.focusable ?? true).toBe(true);
  });

  it('shows the window on screen when CRANCULA_HEADLESS is anything but 1', () => {
    const options = windowOptions({CRANCULA_HEADLESS: '0'}, workArea, preloadPath);

    expect(options.opacity ?? 1).toBe(1);
    expect(options).toMatchObject({x: 0, y: 0});
  });

  it('fills the work area from the top left corner', () => {
    expect(windowOptions({}, workArea, preloadPath)).toMatchObject({x: 0, y: 0, width: 1280, height: 720});
  });

  it.each([{}, {CRANCULA_HEADLESS: '1'}])('always isolates the renderer from Node (%j)', (env) => {
    expect(windowOptions(env, workArea, preloadPath).webPreferences).toEqual({
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });
});
