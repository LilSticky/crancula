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

  test('exposes the typed Tape library API', async () => {
    const result = await launched.window.evaluate(async () => {
      const tapes = (window as {crancula?: {tapes?: {load?: unknown; save?: unknown}}}).crancula?.tapes;
      if (typeof tapes?.load !== 'function' || typeof tapes.save !== 'function') return 'missing';
      return (tapes.load as () => Promise<unknown>)();
    });
    expect(result).toEqual({status: 'empty'});
  });

  test('exposes no members beyond app, organs, plotter and tapes', async () => {
    const keys = await launched.window.evaluate(() =>
      Object.keys((window as {crancula?: object}).crancula ?? {}).sort(),
    );
    expect(keys).toEqual(['app', 'organs', 'plotter', 'tapes']);
  });

  test('exposes saveSvg and rejects a forged request without opening a dialog', async () => {
    await launched.app.evaluate(({dialog}) => {
      const counter = globalThis as {dialogCalls?: number};
      counter.dialogCalls = 0;
      dialog.showSaveDialog = () => {
        counter.dialogCalls = (counter.dialogCalls ?? 0) + 1;
        return Promise.resolve({canceled: true, filePath: ''});
      };
    });

    const result = await launched.window.evaluate(async () => {
      const plotter = (window as {crancula?: {plotter?: {saveSvg?: unknown}}}).crancula?.plotter;
      if (typeof plotter?.saveSvg !== 'function') return 'missing';
      return (plotter.saveSvg as (request: unknown) => Promise<unknown>)({
        suggestedFileName: '../evil.svg',
        svg: '<?xml version="1.0"?><svg ></svg>',
        dialogTitle: 'Export',
        filterName: 'SVG file',
      });
    });

    expect(result).toEqual({status: 'rejected', reason: expect.any(String)});
    const calls = await launched.app.evaluate(() => (globalThis as {dialogCalls?: number}).dialogCalls);
    expect(calls).toBe(0);
  });
});
