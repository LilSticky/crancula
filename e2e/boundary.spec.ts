import {expect, test} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {stubSaveDialog} from './support/save-dialog';

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

  test('exposes no members beyond app, edit, organs, plotter, plotters, recording and tapes', async () => {
    const keys = await launched.window.evaluate(() =>
      Object.keys((window as {crancula?: object}).crancula ?? {}).sort(),
    );
    expect(keys).toEqual(['app', 'edit', 'organs', 'plotter', 'plotters', 'recording', 'tapes']);
  });

  test('exposes the Recording methods and rejects a forged write without opening a dialog', async () => {
    const dialog = await stubSaveDialog(launched.app);

    const result = await launched.window.evaluate(async () => {
      const recording = (window as {crancula?: {recording?: {writeFile?: unknown}}}).crancula?.recording;
      if (typeof recording?.writeFile !== 'function') return 'missing';
      return (recording.writeFile as (request: unknown) => Promise<unknown>)({
        target: '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f',
        bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]),
      });
    });

    expect(result).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(await dialog.calls()).toHaveLength(0);
  });

  test('rejects a forged Recording file name with a path separator without opening a dialog', async () => {
    const dialog = await stubSaveDialog(launched.app);

    const result = await launched.window.evaluate(async () => {
      const recording = (window as {crancula?: {recording?: {chooseFile?: unknown}}}).crancula?.recording;
      if (typeof recording?.chooseFile !== 'function') return 'missing';
      return (recording.chooseFile as (request: unknown) => Promise<unknown>)({
        suggestedFileName: '../evil',
        dialogTitle: 'Record',
        wavFilterName: 'WAV audio',
        mp3FilterName: 'MP3 audio',
      });
    });

    expect(result).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(await dialog.calls()).toHaveLength(0);
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
