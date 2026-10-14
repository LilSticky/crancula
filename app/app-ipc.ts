import {isLanguage, type Language} from '../api';
import type {IpcHandlerRegistry} from './organ-library-ipc';

/** Allow-list of the application IPC channels (ADR 4). The preload script uses the same names. */
export const APP_CHANNELS = {setLanguage: 'app:set-language'} as const;

/** Installs the application menu in the given language. */
export type ApplyMenu = (language: Language) => void;

export function registerAppHandlers(ipcMain: IpcHandlerRegistry, applyMenu: ApplyMenu): void {
  ipcMain.handle(APP_CHANNELS.setLanguage, (_event, payload) => {
    if (!isLanguage(payload)) throw new Error('app:set-language expects a supported language');
    applyMenu(payload);
  });
}
