import type {OrganLibraryFile} from './organ-library-file';

/** Allow-list of the Organ library IPC channels (ADR 4). The preload script uses the same names. */
export const ORGAN_LIBRARY_CHANNELS = {load: 'organs:load', save: 'organs:save'} as const;

/** The part of Electron's `ipcMain` used here. */
export interface IpcHandlerRegistry {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
}

export function registerOrganLibraryHandlers(ipcMain: IpcHandlerRegistry, file: OrganLibraryFile): void {
  ipcMain.handle(ORGAN_LIBRARY_CHANNELS.load, () => file.load());
  ipcMain.handle(ORGAN_LIBRARY_CHANNELS.save, (_event, payload) => file.save(payload));
}
