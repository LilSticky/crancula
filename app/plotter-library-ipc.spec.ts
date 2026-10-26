import {describe, expect, it, vi} from 'vitest';
import type {PlotterLibraryFile} from './plotter-library-file';
import {registerPlotterLibraryHandlers, PLOTTER_LIBRARY_CHANNELS} from './plotter-library-ipc';
import type {IpcHandlerRegistry} from './organ-library-ipc';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpcMain() {
  const handlers = new Map<string, Handler>();
  const ipcMain: IpcHandlerRegistry = {handle: (channel, handler) => void handlers.set(channel, handler)};
  return {ipcMain, handlers};
}

function fakeFile(): PlotterLibraryFile {
  return {
    load: vi.fn().mockResolvedValue({status: 'empty'}),
    save: vi.fn().mockResolvedValue({status: 'saved'}),
    flush: vi.fn().mockResolvedValue(undefined),
  };
}

describe('registerPlotterLibraryHandlers', () => {
  it('handles exactly the allow-listed channels', () => {
    const {ipcMain, handlers} = fakeIpcMain();

    registerPlotterLibraryHandlers(ipcMain, fakeFile());

    expect([...handlers.keys()]).toEqual(['plotters:load', 'plotters:save']);
    expect(PLOTTER_LIBRARY_CHANNELS).toEqual({load: 'plotters:load', save: 'plotters:save'});
  });

  it('loads through the file', async () => {
    const {ipcMain, handlers} = fakeIpcMain();
    registerPlotterLibraryHandlers(ipcMain, fakeFile());

    expect(await handlers.get('plotters:load')?.({})).toEqual({status: 'empty'});
  });

  it('passes the untrusted payload to the validating save', async () => {
    const {ipcMain, handlers} = fakeIpcMain();
    const file = fakeFile();
    registerPlotterLibraryHandlers(ipcMain, file);

    const payload = {version: 1, plotters: []};
    expect(await handlers.get('plotters:save')?.({}, payload)).toEqual({status: 'saved'});
    expect(file.save).toHaveBeenCalledWith(payload);
  });

  it('returns the rejection of an invalid payload from the file', async () => {
    const {ipcMain, handlers} = fakeIpcMain();
    const file = fakeFile();
    vi.mocked(file.save).mockResolvedValue({status: 'rejected', reason: 'plotters is not a list'});
    registerPlotterLibraryHandlers(ipcMain, file);

    const payload = {version: 1, plotters: 'nope'};
    expect(await handlers.get('plotters:save')?.({}, payload)).toEqual({status: 'rejected', reason: 'plotters is not a list'});
    expect(file.save).toHaveBeenCalledWith(payload);
  });
});
