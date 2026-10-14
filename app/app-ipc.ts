import {isLanguage, type Language, type SetLanguageResult} from '../api';
import type {IpcHandlerRegistry} from './organ-library-ipc';

/** Allow-list of the application IPC channels (ADR 4). The preload script uses the same names. */
export const APP_CHANNELS = {setLanguage: 'app:set-language'} as const;

/** Installs the application menu in the given language. */
export type ApplyMenu = (language: Language) => void;

export function registerAppHandlers(ipcMain: IpcHandlerRegistry, applyMenu: ApplyMenu): void {
  ipcMain.handle(APP_CHANNELS.setLanguage, (_event, payload: unknown): SetLanguageResult => {
    if (!isLanguage(payload)) return {status: 'rejected', reason: 'app:set-language expects a supported language'};
    applyMenu(payload);
    return {status: 'set'};
  });
}
