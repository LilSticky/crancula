import type {PlotterLibraryFile} from './plotter-library-file';
import type {IpcHandlerRegistry} from './organ-library-ipc';

/** Allow-list of the Plotter library IPC channels (ADR 4). The preload script uses the same names. */
export const PLOTTER_LIBRARY_CHANNELS = {load: 'plotters:load', save: 'plotters:save'} as const;

export function registerPlotterLibraryHandlers(ipcMain: IpcHandlerRegistry, file: PlotterLibraryFile): void {
  ipcMain.handle(PLOTTER_LIBRARY_CHANNELS.load, () => file.load());
  ipcMain.handle(PLOTTER_LIBRARY_CHANNELS.save, (_event, payload) => file.save(payload));
}
