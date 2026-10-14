import type {IpcHandlerRegistry} from './organ-library-ipc';
import type {TapeLibraryFile} from './tape-library-file';

/** Allow-list of the Tape library IPC channels (ADR 4). The preload script uses the same names. */
export const TAPE_LIBRARY_CHANNELS = {load: 'tapes:load', save: 'tapes:save'} as const;

export function registerTapeLibraryHandlers(ipcMain: IpcHandlerRegistry, file: TapeLibraryFile): void {
  ipcMain.handle(TAPE_LIBRARY_CHANNELS.load, () => file.load());
  ipcMain.handle(TAPE_LIBRARY_CHANNELS.save, (_event, payload) => file.save(payload));
}
