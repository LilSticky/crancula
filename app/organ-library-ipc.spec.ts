import {describe, expect, it, vi} from 'vitest';
import type {OrganLibraryFile} from './organ-library-file';
import {ORGAN_LIBRARY_CHANNELS, registerOrganLibraryHandlers, type IpcHandlerRegistry} from './organ-library-ipc';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpcMain() {
  const handlers = new Map<string, Handler>();
  const ipcMain: IpcHandlerRegistry = {handle: (channel, handler) => void handlers.set(channel, handler)};
  return {ipcMain, handlers};
}

function fakeFile(): OrganLibraryFile {
  return {
    load: vi.fn().mockResolvedValue({status: 'empty'}),
    save: vi.fn().mockResolvedValue({status: 'saved'}),
    flush: vi.fn().mockResolvedValue(undefined),
  };
}

describe('registerOrganLibraryHandlers', () => {
  it('handles exactly the allow-listed channels', () => {
    const {ipcMain, handlers} = fakeIpcMain();

    registerOrganLibraryHandlers(ipcMain, fakeFile());

    expect([...handlers.keys()]).toEqual(['organs:load', 'organs:save']);
    expect(ORGAN_LIBRARY_CHANNELS).toEqual({load: 'organs:load', save: 'organs:save'});
  });

  it('loads through the file', async () => {
    const {ipcMain, handlers} = fakeIpcMain();
    const file = fakeFile();
    registerOrganLibraryHandlers(ipcMain, file);

    expect(await handlers.get('organs:load')?.({})).toEqual({status: 'empty'});
  });

  it('passes the untrusted payload to the validating save', async () => {
    const {ipcMain, handlers} = fakeIpcMain();
    const file = fakeFile();
    registerOrganLibraryHandlers(ipcMain, file);

    const payload = {version: 1, organs: []};
    expect(await handlers.get('organs:save')?.({}, payload)).toEqual({status: 'saved'});
    expect(file.save).toHaveBeenCalledWith(payload);
  });
});
