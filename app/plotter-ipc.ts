import {basename, dirname, join} from 'node:path';
import type {BrowserWindow, IpcMainInvokeEvent, SaveDialogOptions, SaveDialogReturnValue} from 'electron';
import {parseSvgSaveRequest, type SvgSaveResult} from '../api/app/svg-save-request';
import type {IpcHandlerRegistry} from './organ-library-ipc';

/** Allow-list of the Plotter IPC channels (ADR 4). The preload script uses the same names. */
export const PLOTTER_CHANNELS = {saveSvg: 'plotter:save-svg'} as const;

/** The side effects of saving the Plotter file; Electron and Node in `main.ts`, fakes in tests. */
export interface PlotterEffects {
  showSaveDialog(window: BrowserWindow, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
  writeFile(filePath: string, text: string): Promise<void>;
  documentsFolder(): string;
}

/** The OS error code such as ENOENT or EACCES; it tells the reason without naming the path. */
function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code;
  return 'UNKNOWN';
}

export function registerPlotterHandlers(
  ipcMain: IpcHandlerRegistry,
  effects: PlotterEffects,
  windowOf: (event: IpcMainInvokeEvent) => BrowserWindow | null,
): void {
  let lastFolder: string | undefined;

  ipcMain.handle(PLOTTER_CHANNELS.saveSvg, async (event, payload): Promise<SvgSaveResult> => {
    const parsed = parseSvgSaveRequest(payload);
    if (!parsed.ok) return {status: 'rejected', reason: parsed.error};
    const request = parsed.value;
    const window = windowOf(event as IpcMainInvokeEvent);
    if (!window) return {status: 'rejected', reason: 'no window to show the save dialog for'};

    const answer = await effects.showSaveDialog(window, {
      title: request.dialogTitle,
      defaultPath: join(lastFolder ?? effects.documentsFolder(), basename(request.suggestedFileName)),
      filters: [{name: request.filterName, extensions: ['svg']}],
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    });
    if (answer.canceled || !answer.filePath) return {status: 'cancelled'};

    try {
      await effects.writeFile(answer.filePath, request.svg);
    } catch (error: unknown) {
      console.error('Could not write the Plotter file', error);
      return {status: 'failed', reason: errorCode(error)};
    }
    lastFolder = dirname(answer.filePath);
    return {status: 'saved', filePath: answer.filePath};
  });
}
