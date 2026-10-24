import {basename, dirname, join} from 'node:path';
import type {BrowserWindow, IpcMainInvokeEvent, SaveDialogOptions, SaveDialogReturnValue} from 'electron';
import {recordingFormatOf, type RecordingFormat} from '../api/recording/recording-format';
import {
  parseRecordingChooseRequest,
  parseRecordingWriteRequest,
  type RecordingChooseResult,
  type RecordingWriteResult,
} from '../api/recording/recording-save-request';
import type {IpcHandlerRegistry} from './organ-library-ipc';

/** Allow-list of the Recording IPC channels (ADR 4). The preload script uses the same names. */
export const RECORDING_CHANNELS = {chooseFile: 'recording:choose-file', writeFile: 'recording:write-file'} as const;

/** The side effects of saving a Recording; Electron and Node in `main.ts`, fakes in tests. */
export interface RecordingEffects {
  showSaveDialog(window: BrowserWindow, options: SaveDialogOptions): Promise<SaveDialogReturnValue>;
  writeFile(filePath: string, bytes: Uint8Array): Promise<void>;
  documentsFolder(): string;
  /** A random token the renderer must present to write to the file the owner chose. */
  newTarget(): string;
}

/** The file the owner chose; its token is the only way to write the Recording's bytes. */
interface OpenTarget {
  readonly id: string;
  readonly filePath: string;
  readonly format: RecordingFormat;
}

/** The OS error code such as ENOENT or EACCES; it tells the reason without naming the path. */
function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code;
  return 'UNKNOWN';
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let index = 0; index < text.length; index++) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

/** RIFF, four size bytes, then WAVE. */
function isWav(bytes: Uint8Array): boolean {
  return asciiAt(bytes, 0, 'RIFF') && asciiAt(bytes, 8, 'WAVE');
}

/** An ID3 tag, or an MPEG audio frame sync (eleven set bits). */
function isMp3(bytes: Uint8Array): boolean {
  if (asciiAt(bytes, 0, 'ID3')) return true;
  return bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
}

function matchesFormat(bytes: Uint8Array, format: RecordingFormat): boolean {
  return format === 'wav' ? isWav(bytes) : isMp3(bytes);
}

export function registerRecordingHandlers(
  ipcMain: IpcHandlerRegistry,
  effects: RecordingEffects,
  windowOf: (event: IpcMainInvokeEvent) => BrowserWindow | null,
): void {
  let lastFolder: string | undefined;
  let openTarget: OpenTarget | undefined;

  ipcMain.handle(RECORDING_CHANNELS.chooseFile, async (event, payload): Promise<RecordingChooseResult> => {
    const parsed = parseRecordingChooseRequest(payload);
    if (!parsed.ok) return {status: 'rejected', reason: parsed.error};
    const request = parsed.value;
    const window = windowOf(event as IpcMainInvokeEvent);
    if (!window) return {status: 'rejected', reason: 'no window to show the save dialog for'};

    const answer = await effects.showSaveDialog(window, {
      title: request.dialogTitle,
      defaultPath: join(lastFolder ?? effects.documentsFolder(), `${request.suggestedFileName}.wav`),
      filters: [
        {name: request.wavFilterName, extensions: ['wav']},
        {name: request.mp3FilterName, extensions: ['mp3']},
      ],
      properties: ['showOverwriteConfirmation', 'createDirectory'],
    });
    // The target chosen before is closed by any answer: a cancelled dialog leaves nothing pending.
    openTarget = undefined;
    if (answer.canceled || !answer.filePath) return {status: 'cancelled'};

    // A file name without a known extension gets .wav appended, as the dialog's default does.
    const knownFormat = recordingFormatOf(basename(answer.filePath));
    const filePath = knownFormat ? answer.filePath : `${answer.filePath}.wav`;
    const format = knownFormat ?? 'wav';
    const target: OpenTarget = {id: effects.newTarget(), filePath, format};
    openTarget = target;
    return {status: 'chosen', target: target.id, format, fileName: basename(filePath)};
  });

  ipcMain.handle(RECORDING_CHANNELS.writeFile, async (_event, payload): Promise<RecordingWriteResult> => {
    const parsed = parseRecordingWriteRequest(payload);
    if (!parsed.ok) return {status: 'rejected', reason: parsed.error};
    const request = parsed.value;
    const target = openTarget;
    if (!target || target.id !== request.target) return {status: 'rejected', reason: 'unknown or used target'};
    if (!matchesFormat(request.bytes, target.format)) {
      return {status: 'rejected', reason: `the bytes are not a ${target.format} file`};
    }

    // Closed before the write, so that no second write can use the same target.
    openTarget = undefined;
    try {
      await effects.writeFile(target.filePath, request.bytes);
    } catch (error: unknown) {
      console.error('Could not write the Recording', error);
      return {status: 'failed', reason: errorCode(error)};
    }
    lastFolder = dirname(target.filePath);
    return {status: 'saved', filePath: target.filePath};
  });
}
