import {dirname, join} from 'node:path';
import type {BrowserWindow, IpcMainInvokeEvent, SaveDialogOptions, SaveDialogReturnValue} from 'electron';
import {beforeEach, describe, expect, it} from 'vitest';
import type {IpcHandlerRegistry} from './organ-library-ipc';
import {registerScoresHandlers, SCORES_CHANNELS, type ScoresEffects} from './scores-ipc';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const request = {
  suggestedFileName: 'Waltz.musicxml',
  musicXml: '<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><work><work-title>Waltz ä♪</work-title></work></score-partwise>\n',
  dialogTitle: 'Export as Scores',
  filterName: 'MusicXML file',
};

const documents = join('home', 'mathe', 'Documents');
const window = {} as BrowserWindow;

let handlers: Map<string, Handler>;
let senderWindow: BrowserWindow | null;
let shownFor: BrowserWindow | null;
let dialogAnswers: SaveDialogReturnValue[];
let dialogCalls: SaveDialogOptions[];
let writes: {readonly filePath: string; readonly text: string}[];
let writeFailure: unknown;

const effects: ScoresEffects = {
  showSaveDialog: (parent, options) => {
    shownFor = parent;
    dialogCalls.push(options);
    return Promise.resolve(dialogAnswers.shift() ?? {canceled: true, filePath: ''});
  },
  writeFile: async (filePath, text) => {
    if (writeFailure !== undefined) throw writeFailure;
    writes.push({filePath, text});
  },
  documentsFolder: () => documents,
};

function save(payload: unknown): Promise<unknown> {
  return Promise.resolve(handlers.get(SCORES_CHANNELS.save)?.({}, payload));
}

beforeEach(() => {
  handlers = new Map<string, Handler>();
  senderWindow = window;
  shownFor = null;
  dialogAnswers = [];
  dialogCalls = [];
  writes = [];
  writeFailure = undefined;
  const ipcMain: IpcHandlerRegistry = {handle: (channel, handler) => void handlers.set(channel, handler)};
  registerScoresHandlers(ipcMain, effects, (_event: IpcMainInvokeEvent) => senderWindow);
});

describe('registerScoresHandlers', () => {
  it('handles exactly the allow-listed scores channel', () => {
    expect([...handlers.keys()]).toEqual(['scores:save']);
    expect(SCORES_CHANNELS).toEqual({save: 'scores:save'});
  });

  it('rejects an invalid request without opening a dialog', async () => {
    const reply = await save({...request, suggestedFileName: '../evil.musicxml'});

    expect(reply).toEqual({status: 'rejected', reason: expect.stringContaining('suggestedFileName')});
    expect(dialogCalls).toEqual([]);
    expect(writes).toEqual([]);
  });

  it('rejects the request without a dialog when the sender has no window', async () => {
    senderWindow = null;

    expect(await save(request)).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(dialogCalls).toEqual([]);
  });

  it('shows the dialog modal to the window of the sender', async () => {
    await save(request);

    expect(shownFor).toBe(window);
  });

  it('shows the dialog with title, default path in the Documents folder, MusicXML filter and properties', async () => {
    await save(request);

    expect(dialogCalls).toEqual([
      {
        title: 'Export as Scores',
        defaultPath: join(documents, 'Waltz.musicxml'),
        filters: [{name: 'MusicXML file', extensions: ['musicxml']}],
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      },
    ]);
  });

  it('answers cancelled and writes nothing when the dialog is cancelled', async () => {
    dialogAnswers.push({canceled: true, filePath: join('home', 'out.musicxml')});

    expect(await save(request)).toEqual({status: 'cancelled'});
    expect(writes).toEqual([]);
  });

  it('answers cancelled when the dialog returns no file path', async () => {
    dialogAnswers.push({canceled: false, filePath: ''});

    expect(await save(request)).toEqual({status: 'cancelled'});
    expect(writes).toEqual([]);
  });

  it('writes the MusicXML text exactly to the chosen path and answers saved', async () => {
    const target = join('home', 'scores', 'out.musicxml');
    dialogAnswers.push({canceled: false, filePath: target});

    expect(await save(request)).toEqual({status: 'saved', filePath: target});
    expect(writes).toEqual([{filePath: target, text: request.musicXml}]);
  });

  it('answers failed with the error code only when the write fails, and writes nothing', async () => {
    const target = join('home', 'locked', 'out.musicxml');
    dialogAnswers.push({canceled: false, filePath: target});
    writeFailure = Object.assign(new Error(`EACCES: permission denied, open '${target}'`), {code: 'EACCES'});

    expect(await save(request)).toEqual({status: 'failed', reason: 'EACCES'});
    expect(writes).toEqual([]);
  });

  it('starts the next dialog in the folder of the last saved file', async () => {
    const chosen = join('home', 'scores', 'renamed.musicxml');
    dialogAnswers.push({canceled: false, filePath: chosen});
    await save(request);

    await save(request);

    expect(dialogCalls[1]?.defaultPath).toBe(join(dirname(chosen), 'Waltz.musicxml'));
  });

  it('keeps the last folder after a failed save', async () => {
    dialogAnswers.push({canceled: false, filePath: join('home', 'locked', 'out.musicxml')});
    writeFailure = Object.assign(new Error('denied'), {code: 'EACCES'});
    await save(request);

    await save(request);

    expect(dialogCalls[1]?.defaultPath).toBe(join(documents, 'Waltz.musicxml'));
  });
});
