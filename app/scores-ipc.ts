import {basename, dirname, join} from 'node:path';
import type {BrowserWindow, IpcMainInvokeEvent, SaveDialogOptions, SaveDialogReturnValue} from 'electron';
import {parseScoresSaveRequest, type ScoresSaveResult} from '../api/app/scores-save-request';
import type {IpcHandlerRegistry} from './organ-library-ipc';

/** Allow-list of the Scores IPC channels (ADR 4). The preload script uses the same names. */
export const SCORES_CHANNELS = {save: 'scores:save'} as const;

/** The side effects of saving the Scores file; Electron and Node in `main.ts`, fakes in tests. */
export interface ScoresEffects {
  showSaveDialog(window: BrowserWindow, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
  writeFile(filePath: string, text: string): Promise<void>;
  documentsFolder(): string;
}

/** The OS error code such as ENOENT or EACCES; it tells the reason without naming the path. */
function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code;
  return 'UNKNOWN';
}

export function registerScoresHandlers(
  ipcMain: IpcHandlerRegistry,
  effects: ScoresEffects,
  windowOf: (event: IpcMainInvokeEvent) => BrowserWindow | null,
): void {
  let lastFolder: string | undefined;

  ipcMain.handle(SCORES_CHANNELS.save, async (event, payload): Promise<ScoresSaveResult> => {
    const parsed = parseScoresSaveRequest(payload);
    if (!parsed.ok) return {status: 'rejected', reason: parsed.error};
    const request = parsed.value;
    const window = windowOf(event as IpcMainInvokeEvent);
    if (!window) return {status: 'rejected', reason: 'no window to show the save dialog for'};

    const answer = await effects.showSaveDialog(window, {
      title: request.dialogTitle,
      defaultPath: join(lastFolder ?? effects.documentsFolder(), basename(request.suggestedFileName)),
      filters: [{name: request.filterName, extensions: ['musicxml']}],
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    });
    if (answer.canceled || !answer.filePath) return {status: 'cancelled'};

    try {
      await effects.writeFile(answer.filePath, request.musicXml);
    } catch (error: unknown) {
      console.error('Could not write the Scores file', error);
      return {status: 'failed', reason: errorCode(error)};
    }
    lastFolder = dirname(answer.filePath);
    return {status: 'saved', filePath: answer.filePath};
  });
}
