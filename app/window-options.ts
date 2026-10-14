import type {BrowserWindowConstructorOptions} from 'electron';

/** Far outside any display, so a headless window can never be seen or clicked. */
const OFF_SCREEN = -32000;

/**
 * The main window fills the work area.
 *
 * When `CRANCULA_HEADLESS` is `1` (e2e runs) it is invisible to the user but still shown: a window that was
 * never shown does not paint, and Playwright's clicks wait for it forever. So it asks for a position off screen,
 * zero opacity, no taskbar entry and no focus. These are best effort per platform: macOS or a window manager may
 * clamp the position back onto a display. On Linux the window stays opaque: there a transparent window renders
 * only about one frame per second, and Playwright waits for frames before every click. Background throttling is
 * off on every platform, because a hidden or occluded window on macOS otherwise gets its animation frames
 * throttled (observed as 1 frame per 500 ms in CI).
 */
export function windowOptions(
  env: NodeJS.ProcessEnv,
  workArea: {width: number; height: number},
  preloadPath: string,
  platform: NodeJS.Platform,
): BrowserWindowConstructorOptions {
  const headless = env['CRANCULA_HEADLESS'] === '1';
  return {
    x: headless ? OFF_SCREEN : 0,
    y: headless ? OFF_SCREEN : 0,
    width: workArea.width,
    height: workArea.height,
    ...(headless ? {skipTaskbar: true, focusable: false} : {}),
    ...(headless && platform !== 'linux' ? {opacity: 0} : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      ...(headless ? {backgroundThrottling: false} : {}),
    },
  };
}
