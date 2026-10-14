import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {IpcHandlerRegistry} from './organ-library-ipc';
import {createTapeLibraryFile, type TapeLibraryFile} from './tape-library-file';
import {registerTapeLibraryHandlers, TAPE_LIBRARY_CHANNELS} from './tape-library-ipc';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpcMain() {
  const handlers = new Map<string, Handler>();
  const ipcMain: IpcHandlerRegistry = {handle: (channel, handler) => void handlers.set(channel, handler)};
  return {ipcMain, handlers};
}

function fakeFile(): TapeLibraryFile {
  return {
    load: vi.fn().mockResolvedValue({status: 'empty'}),
    save: vi.fn().mockResolvedValue({status: 'saved'}),
    flush: vi.fn().mockResolvedValue(undefined),
  };
}

let dir: string | undefined;
afterEach(async () => {
  if (dir) await rm(dir, {recursive: true, force: true});
  dir = undefined;
});

describe('registerTapeLibraryHandlers', () => {
  it('handles exactly the allow-listed channels', () => {
    const {ipcMain, handlers} = fakeIpcMain();

    registerTapeLibraryHandlers(ipcMain, fakeFile());

    expect([...handlers.keys()]).toEqual(['tapes:load', 'tapes:save']);
    expect(TAPE_LIBRARY_CHANNELS).toEqual({load: 'tapes:load', save: 'tapes:save'});
  });

  it('loads through the file', async () => {
    const {ipcMain, handlers} = fakeIpcMain();
    registerTapeLibraryHandlers(ipcMain, fakeFile());

    expect(await handlers.get('tapes:load')?.({})).toEqual({status: 'empty'});
  });

  it('passes the untrusted payload to the validating save', async () => {
    const {ipcMain, handlers} = fakeIpcMain();
    const file = fakeFile();
    registerTapeLibraryHandlers(ipcMain, file);

    const payload = {version: 1, songs: [], tapes: []};
    expect(await handlers.get('tapes:save')?.({}, payload)).toEqual({status: 'saved'});
    expect(file.save).toHaveBeenCalledWith(payload);
  });

  it('answers rejected for a payload that fails validation', async () => {
    dir = await mkdtemp(join(tmpdir(), 'crancula-tape-ipc-'));
    const {ipcMain, handlers} = fakeIpcMain();
    registerTapeLibraryHandlers(ipcMain, createTapeLibraryFile(dir));

    const reply = await handlers.get('tapes:save')?.({}, {version: 1, songs: [], tapes: [{id: 'x'}]});

    expect(reply).toMatchObject({status: 'rejected'});
  });
});
