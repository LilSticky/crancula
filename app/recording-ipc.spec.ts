import {dirname, join} from 'node:path';
import type {BrowserWindow, SaveDialogOptions, SaveDialogReturnValue} from 'electron';
import {beforeEach, describe, expect, it} from 'vitest';
import {wavFile} from '../api/recording/wav-file';
import type {
  RecordingChooseRequest,
  RecordingChooseResult,
  RecordingWriteResult,
} from '../api/recording/recording-save-request';
import type {IpcHandlerRegistry} from './organ-library-ipc';
import {RECORDING_CHANNELS, registerRecordingHandlers, type RecordingEffects} from './recording-ipc';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const chooseRequest: RecordingChooseRequest = {
  suggestedFileName: 'Waltz',
  dialogTitle: 'Record a Tape',
  wavFilterName: 'WAV audio',
  mp3FilterName: 'MP3 audio',
};

const WAV_BYTES = wavFile(new Int16Array([0, 1000, -1000]), 44100);
const MP3_BYTES = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00]);

/** A UUID for the n-th target the main process issues. */
function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

let documents: string;
let dialogAnswers: SaveDialogReturnValue[];
let dialogCalls: SaveDialogOptions[];
let written: {filePath: string; bytes: Uint8Array}[];
let failWritesWith: string | undefined;
let targetCount: number;
let handlers: Map<string, Handler>;
const window = {} as BrowserWindow;

const effects: RecordingEffects = {
  showSaveDialog: (_window, options) => {
    dialogCalls.push(options);
    return Promise.resolve(dialogAnswers.shift() ?? {canceled: true, filePath: ''});
  },
  writeFile: (filePath, bytes) => {
    if (failWritesWith !== undefined) {
      return Promise.reject(Object.assign(new Error('denied'), {code: failWritesWith}));
    }
    written.push({filePath, bytes});
    return Promise.resolve();
  },
  documentsFolder: () => documents,
  newTarget: () => {
    targetCount += 1;
    return uuid(targetCount);
  },
};

function choose(payload: unknown): Promise<RecordingChooseResult> {
  return Promise.resolve(handlers.get(RECORDING_CHANNELS.chooseFile)?.({}, payload)) as Promise<RecordingChooseResult>;
}

function write(payload: unknown): Promise<RecordingWriteResult> {
  return Promise.resolve(handlers.get(RECORDING_CHANNELS.writeFile)?.({}, payload)) as Promise<RecordingWriteResult>;
}

/** Chooses a file the dialog answers with `filePath` and returns the target the main process issued. */
async function chooseFile(filePath: string): Promise<string> {
  dialogAnswers.push({canceled: false, filePath});
  const reply = await choose(chooseRequest);
  if (reply.status !== 'chosen') throw new Error(`expected a chosen file, got ${reply.status}`);
  return reply.target;
}

beforeEach(() => {
  documents = join('C:', 'Users', 'owner', 'Documents');
  dialogAnswers = [];
  dialogCalls = [];
  written = [];
  failWritesWith = undefined;
  targetCount = 0;
  handlers = new Map<string, Handler>();
  const ipcMain: IpcHandlerRegistry = {handle: (channel, handler) => void handlers.set(channel, handler)};
  registerRecordingHandlers(ipcMain, effects, () => window);
});

describe('registerRecordingHandlers', () => {
  it('handles exactly the allow-listed channels', () => {
    expect([...handlers.keys()].sort()).toEqual(['recording:choose-file', 'recording:write-file']);
    expect(RECORDING_CHANNELS).toEqual({chooseFile: 'recording:choose-file', writeFile: 'recording:write-file'});
  });

  it('shows the dialog with the WAV filter first, then MP3, overwrite confirmation and a default .wav in Documents', async () => {
    dialogAnswers.push({canceled: true, filePath: ''});

    await choose(chooseRequest);

    expect(dialogCalls).toEqual([
      {
        title: 'Record a Tape',
        defaultPath: join(documents, 'Waltz.wav'),
        filters: [
          {name: 'WAV audio', extensions: ['wav']},
          {name: 'MP3 audio', extensions: ['mp3']},
        ],
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      },
    ]);
  });

  it('rejects an invalid request without opening a dialog', async () => {
    const reply = await choose({...chooseRequest, suggestedFileName: '../evil'});

    expect(reply).toEqual({status: 'rejected', reason: expect.stringContaining('suggestedFileName')});
    expect(dialogCalls).toEqual([]);
  });

  it('answers cancelled when the dialog is cancelled', async () => {
    dialogAnswers.push({canceled: true, filePath: join(documents, 'Waltz.wav')});

    expect(await choose(chooseRequest)).toEqual({status: 'cancelled'});
  });

  it('answers chosen with an MP3 format and the basename when the file name ends in .mp3', async () => {
    const filePath = join(documents, 'out', 'x.mp3');
    dialogAnswers.push({canceled: false, filePath});

    const reply = await choose(chooseRequest);

    expect(reply).toEqual({status: 'chosen', target: uuid(1), format: 'mp3', fileName: 'x.mp3'});
  });

  it('appends .wav to a file name with another extension and answers the WAV format', async () => {
    dialogAnswers.push({canceled: false, filePath: join(documents, 'x.ogg')});

    const reply = await choose(chooseRequest);

    expect(reply).toEqual({status: 'chosen', target: uuid(1), format: 'wav', fileName: 'x.ogg.wav'});
  });

  it('writes the bytes of a WAV target to the chosen path and answers saved', async () => {
    const filePath = join(documents, 'x.wav');
    const target = await chooseFile(filePath);

    const reply = await write({target, bytes: WAV_BYTES});

    expect(reply).toEqual({status: 'saved', filePath});
    expect(written).toEqual([{filePath, bytes: WAV_BYTES}]);
  });

  it('answers rejected and writes nothing when the same target is written again', async () => {
    const target = await chooseFile(join(documents, 'x.wav'));
    await write({target, bytes: WAV_BYTES});

    const reply = await write({target, bytes: WAV_BYTES});

    expect(reply).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(written).toHaveLength(1);
  });

  it('answers rejected and writes nothing for a target the main process never issued', async () => {
    await chooseFile(join(documents, 'x.wav'));

    const reply = await write({target: uuid(99), bytes: WAV_BYTES});

    expect(reply).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(written).toEqual([]);
  });

  it('answers rejected and writes nothing when MP3 bytes are written to a WAV target', async () => {
    const target = await chooseFile(join(documents, 'x.wav'));

    const reply = await write({target, bytes: MP3_BYTES});

    expect(reply).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(written).toEqual([]);
  });

  it('answers rejected and writes nothing when WAV bytes are written to an MP3 target', async () => {
    const target = await chooseFile(join(documents, 'x.mp3'));

    const reply = await write({target, bytes: WAV_BYTES});

    expect(reply).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(written).toEqual([]);
  });

  it('answers failed with the error code when the write fails', async () => {
    const target = await chooseFile(join(documents, 'x.wav'));
    failWritesWith = 'EACCES';

    const reply = await write({target, bytes: WAV_BYTES});

    expect(reply).toEqual({status: 'failed', reason: 'EACCES'});
  });

  it('closes a second chosen target when a second choose replaces the first', async () => {
    const first = await chooseFile(join(documents, 'first.wav'));
    const second = await chooseFile(join(documents, 'second.wav'));

    expect(await write({target: first, bytes: WAV_BYTES})).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(await write({target: second, bytes: WAV_BYTES})).toEqual({
      status: 'saved',
      filePath: join(documents, 'second.wav'),
    });
  });

  it('starts the next dialog in the folder of the last saved file', async () => {
    const saved = join(documents, 'Recordings', 'x.wav');
    const target = await chooseFile(saved);
    await write({target, bytes: WAV_BYTES});
    dialogAnswers.push({canceled: true, filePath: ''});

    await choose(chooseRequest);

    expect(dialogCalls[1]?.defaultPath).toBe(join(dirname(saved), 'Waltz.wav'));
  });
});
