import {describe, expect, it, vi} from 'vitest';
import {APP_CHANNELS, registerAppHandlers} from './app-ipc';
import type {IpcHandlerRegistry} from './organ-library-ipc';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

function fakeIpcMain() {
  const handlers = new Map<string, Handler>();
  const ipcMain: IpcHandlerRegistry = {handle: (channel, handler) => void handlers.set(channel, handler)};
  return {ipcMain, handlers};
}

function setup() {
  const {ipcMain, handlers} = fakeIpcMain();
  const applyMenu = vi.fn();
  registerAppHandlers(ipcMain, applyMenu);
  const setLanguage = async (payload: unknown) => {
    const handler = handlers.get('app:set-language');
    if (!handler) throw new Error('app:set-language is not handled');
    return handler({}, payload);
  };
  return {handlers, applyMenu, setLanguage};
}

describe('registerAppHandlers', () => {
  it('handles exactly the allow-listed channel', () => {
    const {handlers} = setup();

    expect([...handlers.keys()]).toEqual(['app:set-language']);
    expect(APP_CHANNELS).toEqual({setLanguage: 'app:set-language'});
  });

  it.each(['en', 'de'] as const)('applies the application menu in %s', async (language) => {
    const {applyMenu, setLanguage} = setup();

    await setLanguage(language);

    expect(applyMenu).toHaveBeenCalledExactlyOnceWith(language);
  });

  it.each([['fr'], ['EN'], [null], [undefined], [42], [{language: 'de'}]])(
    'rejects %j without touching the menu',
    async (payload) => {
      const {applyMenu, setLanguage} = setup();

      await expect(setLanguage(payload)).rejects.toThrow();

      expect(applyMenu).not.toHaveBeenCalled();
    },
  );
});
