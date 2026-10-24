import {type CDPSession, type Page} from '@playwright/test';

/** A point of the viewport, in CSS px. */
export interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A CDP session that sends touch input to the window. The `hasTouch` option of a browser context cannot be set
 * for the Electron window (`touchscreen.tap` refuses), so the touches go through `Input.dispatchTouchEvent`, which
 * Chromium delivers as pointer events of pointerType `touch`.
 */
export async function touchInput(window: Page): Promise<CDPSession> {
  const session = await window.context().newCDPSession(window);
  await session.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 1});
  return session;
}

/** One finger touches down and lifts at the same point. */
export async function tapAt(session: CDPSession, at: TouchPoint): Promise<void> {
  await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: at.x, y: at.y}]});
  await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}

/** One finger touches down at `from`, moves by (`dx`, `dy`) in steps, and lifts. */
export async function touchDragBy(session: CDPSession, from: TouchPoint, dx: number, dy: number, steps = 8): Promise<void> {
  await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: from.x, y: from.y}]});
  for (let step = 1; step <= steps; step++) {
    const x = from.x + (dx * step) / steps;
    const y = from.y + (dy * step) / steps;
    await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x, y}]});
  }
  await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}
