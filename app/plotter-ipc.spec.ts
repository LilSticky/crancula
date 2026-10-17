import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import type {BrowserWindow, SaveDialogOptions, SaveDialogReturnValue} from 'electron';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {IpcHandlerRegistry} from './organ-library-ipc';
import {PLOTTER_CHANNELS, registerPlotterHandlers, type PlotterEffects} from './plotter-ipc';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const request = {
  suggestedFileName: 'Waltz.svg',
  svg: '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1mm">ä♪</svg>\n',
  dialogTitle: 'Export for the Plotter',
  filterName: 'SVG file',
};

let dir: string;
let documents: string;
let dialogAnswers: SaveDialogReturnValue[];
let dialogCalls: SaveDialogOptions[];
let handlers: Map<string, Handler>;
let senderWindow: BrowserWindow | null;
const window = {} as BrowserWindow;

const effects: PlotterEffects = {
  showSaveDialog: (_window, options) => {
    dialogCalls.push(options);
    return Promise.resolve(dialogAnswers.shift() ?? {canceled: true, filePath: ''});
  },
  writeFile: (filePath, text) => writeFile(filePath, text, 'utf8'),
  documentsFolder: () => documents,
};

function saveSvg(payload: unknown): Promise<unknown> {
  return Promise.resolve(handlers.get(PLOTTER_CHANNELS.saveSvg)?.({}, payload));
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'crancula-plotter-ipc-'));
  documents = join(dir, 'Documents');
  dialogAnswers = [];
  dialogCalls = [];
  handlers = new Map<string, Handler>();
  senderWindow = window;
  const ipcMain: IpcHandlerRegistry = {handle: (channel, handler) => void handlers.set(channel, handler)};
  registerPlotterHandlers(ipcMain, effects, () => senderWindow);
});

afterEach(async () => {
  await rm(dir, {recursive: true, force: true});
});

describe('registerPlotterHandlers', () => {
  it('handles exactly the allow-listed channel', () => {
    expect([...handlers.keys()]).toEqual(['plotter:save-svg']);
    expect(PLOTTER_CHANNELS).toEqual({saveSvg: 'plotter:save-svg'});
  });

  it('rejects an invalid request without opening a dialog', async () => {
    const reply = await saveSvg({...request, suggestedFileName: '../evil.svg'});

    expect(reply).toEqual({status: 'rejected', reason: expect.stringContaining('suggestedFileName')});
    expect(dialogCalls).toEqual([]);
  });

  it('rejects the request without a dialog when the sender has no window', async () => {
    senderWindow = null;

    const reply = await saveSvg(request);

    expect(reply).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(dialogCalls).toEqual([]);
  });

  it('shows the dialog modal to the window of the sender', async () => {
    let shownFor: BrowserWindow | null = null;
    const original = effects.showSaveDialog;
    effects.showSaveDialog = (parent, options) => {
      shownFor = parent;
      return original(parent, options);
    };
    try {
      await saveSvg(request);
    } finally {
      effects.showSaveDialog = original;
    }

    expect(shownFor).toBe(window);
  });

  it('shows the dialog with title, default path in the Documents folder, SVG filter and properties', async () => {
    await saveSvg(request);

    expect(dialogCalls).toEqual([
      {
        title: 'Export for the Plotter',
        defaultPath: join(documents, 'Waltz.svg'),
        filters: [{name: 'SVG file', extensions: ['svg']}],
        properties: ['showOverwriteConfirmation', 'createDirectory'],
      },
    ]);
  });

  it('answers cancelled and writes nothing when the dialog is cancelled', async () => {
    const target = join(dir, 'out.svg');
    dialogAnswers.push({canceled: true, filePath: target});

    expect(await saveSvg(request)).toEqual({status: 'cancelled'});
    await expect(stat(target)).rejects.toThrow();
  });

  it('answers cancelled when the dialog returns no file path', async () => {
    dialogAnswers.push({canceled: false, filePath: ''});

    expect(await saveSvg(request)).toEqual({status: 'cancelled'});
  });

  it('writes the SVG as UTF-8 to the chosen path and answers saved', async () => {
    const target = join(dir, 'out.svg');
    dialogAnswers.push({canceled: false, filePath: target});

    expect(await saveSvg(request)).toEqual({status: 'saved', filePath: target});
    expect(await readFile(target, 'utf8')).toBe(request.svg);
  });

  it('replaces an existing file the user confirmed', async () => {
    const target = join(dir, 'out.svg');
    await writeFile(target, 'old', 'utf8');
    dialogAnswers.push({canceled: false, filePath: target});

    expect(await saveSvg(request)).toEqual({status: 'saved', filePath: target});
    expect(await readFile(target, 'utf8')).toBe(request.svg);
  });

  it('starts the next dialog in the folder of the last saved file', async () => {
    const chosen = join(dir, 'renamed.svg');
    dialogAnswers.push({canceled: false, filePath: chosen});
    await saveSvg(request);

    await saveSvg(request);

    expect(dialogCalls[1]?.defaultPath).toBe(join(dirname(chosen), 'Waltz.svg'));
  });

  it('answers failed with the error code only, without the path, when the folder is missing, and keeps the last folder', async () => {
    dialogAnswers.push({canceled: false, filePath: join(dir, 'missing', 'out.svg')});

    const reply = await saveSvg(request);

    expect(reply).toEqual({status: 'failed', reason: 'ENOENT'});
    await saveSvg(request);
    expect(dialogCalls[1]?.defaultPath).toBe(join(documents, 'Waltz.svg'));
  });
});
