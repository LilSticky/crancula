import {basename, dirname, join} from 'node:path';
import type {
  BrowserWindow,
  IpcMainInvokeEvent,
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron';
import {parseSvgPiecesSaveRequest, type SvgPiece, type SvgPiecesSaveResult} from '../api/app/svg-pieces-save-request';
import {parseSvgSaveRequest, type SvgSaveResult} from '../api/app/svg-save-request';
import type {IpcHandlerRegistry} from './organ-library-ipc';

/** Allow-list of the Plotter IPC channels (ADR 4). The preload script uses the same names. */
export const PLOTTER_CHANNELS = {saveSvg: 'plotter:save-svg', savePieces: 'plotter:save-svg-pieces'} as const;

/** The side effects of saving the Plotter files; Electron and Node in `main.ts`, fakes in tests. */
export interface PlotterEffects {
  showSaveDialog(window: BrowserWindow, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
  showOpenDialog(window: BrowserWindow, options: OpenDialogOptions): Promise<OpenDialogReturnValue>;
  showMessageBox(window: BrowserWindow, options: MessageBoxOptions): Promise<MessageBoxReturnValue>;
  exists(filePath: string): Promise<boolean>;
  writeFile(filePath: string, text: string): Promise<void>;
  documentsFolder(): string;
}

/** The OS error code such as ENOENT or EACCES; it tells the reason without naming the path. */
function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code;
  return 'UNKNOWN';
}

/** The most existing names the replace question lists; the rest are counted in the more line. */
const MAXIMUM_LISTED_NAMES = 10;

/** The detail of the replace question: the first names, then the more line with the count of the rest. */
function replaceDetail(existing: readonly string[], moreLine: string): string {
  const listed = existing.slice(0, MAXIMUM_LISTED_NAMES);
  const rest = existing.length - listed.length;
  if (rest > 0) listed.push(moreLine.replace('{count}', String(rest)));
  return listed.join('\n');
}

/** The path of a validated piece name inside `folder`; the base name keeps it inside the folder. */
function pathIn(folder: string, fileName: string): string {
  return join(folder, basename(fileName));
}

export function registerPlotterHandlers(
  ipcMain: IpcHandlerRegistry,
  effects: PlotterEffects,
  windowOf: (event: IpcMainInvokeEvent) => BrowserWindow | null,
): void {
  let lastFolder: string | undefined;

  /** The names of the pieces that already exist in `folder`, in piece order. */
  async function existingNames(folder: string, pieces: readonly SvgPiece[]): Promise<string[]> {
    const present = await Promise.all(pieces.map(({fileName}) => effects.exists(pathIn(folder, fileName))));
    return pieces.filter((_, index) => present[index]).map(({fileName}) => fileName);
  }

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

  ipcMain.handle(PLOTTER_CHANNELS.savePieces, async (event, payload): Promise<SvgPiecesSaveResult> => {
    const parsed = parseSvgPiecesSaveRequest(payload);
    if (!parsed.ok) return {status: 'rejected', reason: parsed.error};
    const request = parsed.value;
    const window = windowOf(event as IpcMainInvokeEvent);
    if (!window) return {status: 'rejected', reason: 'no window to show the folder dialog for'};

    const answer = await effects.showOpenDialog(window, {
      title: request.dialogTitle,
      buttonLabel: request.dialogButton,
      defaultPath: lastFolder ?? effects.documentsFolder(),
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
    const [folder] = answer.filePaths;
    if (answer.canceled || folder === undefined) return {status: 'cancelled'};

    const existing = await existingNames(folder, request.pieces);
    if (existing.length > 0) {
      const replace = await effects.showMessageBox(window, {
        type: 'question',
        message: request.replaceMessage,
        detail: replaceDetail(existing, request.replaceMoreLine),
        buttons: [request.replaceButton, request.cancelButton],
        defaultId: 1,
        cancelId: 1,
      });
      if (replace.response !== 0) return {status: 'cancelled'};
    }

    const written: string[] = [];
    for (const {fileName, svg} of request.pieces) {
      try {
        await effects.writeFile(pathIn(folder, fileName), svg);
      } catch (error: unknown) {
        console.error('Could not write a Tape piece', error);
        return {status: 'failed', fileName, reason: errorCode(error), written};
      }
      written.push(fileName);
    }
    lastFolder = folder;
    return {status: 'saved', folderPath: folder, fileNames: written};
  });
}
