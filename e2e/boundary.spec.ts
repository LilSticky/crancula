import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';

test.describe('Electron boundary', () => {
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('gives the renderer no Node access', async () => {
    expect(await launched.window.evaluate(() => typeof (window as {require?: unknown}).require)).toBe('undefined');
    expect(await launched.window.evaluate(() => typeof (window as {process?: unknown}).process)).toBe('undefined');
  });

  test('exposes the typed Organ library API', async () => {
    const result = await launched.window.evaluate(async () => {
      const crancula = (window as {crancula?: {organs?: {load?: () => Promise<unknown>}}}).crancula;
      return typeof crancula?.organs?.load === 'function' ? crancula.organs.load() : 'missing';
    });
    expect(result).toEqual({status: 'empty'});
  });
});
