import {mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, dirname, join} from 'node:path';
import type {
  BrowserWindow,
  MessageBoxOptions,
  MessageBoxReturnValue,
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {entryExists} from './entry-exists';
import type {IpcHandlerRegistry} from './organ-library-ipc';
import {PLOTTER_CHANNELS, registerPlotterHandlers, type PlotterEffects} from './plotter-ipc';

type Handler = (event: unknown, ...args: unknown[]) => unknown;

const request = {
  suggestedFileName: 'Waltz.svg',
  svg: '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1mm">ä♪</svg>\n',
  dialogTitle: 'Export for the Plotter',
  filterName: 'SVG file',
};

function svgOf(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="298mm">${text}</svg>\n`;
}

const piecesRequest = {
  pieces: [
    {fileName: 'Waltz 1 of 3.svg', svg: svgOf('piece 1 ä♪')},
    {fileName: 'Waltz 2 of 3.svg', svg: svgOf('piece 2 ä♪')},
    {fileName: 'Waltz 3 of 3.svg', svg: svgOf('piece 3 ä♪')},
  ],
  dialogTitle: 'Choose the folder for the Tape pieces',
  dialogButton: 'Save here',
  replaceMessage: 'Some of these files already exist. Replace them?',
  replaceMoreLine: '… and {count} more',
  replaceButton: 'Replace',
  cancelButton: 'Cancel',
};

/** Whether this machine lets a process create a symlink, probed once in a temporary folder. */
async function symlinksAllowed(): Promise<boolean> {
  const probeDir = await mkdtemp(join(tmpdir(), 'crancula-symlink-probe-'));
  try {
    await symlink(probeDir, join(probeDir, 'link'));
    return true;
  } catch {
    return false;
  } finally {
    await rm(probeDir, {recursive: true, force: true});
  }
}

const SYMLINKS_ALLOWED = await symlinksAllowed();

let dir: string;
let documents: string;
let folder: string;
let dialogAnswers: SaveDialogReturnValue[];
let dialogCalls: SaveDialogOptions[];
let folderAnswers: OpenDialogReturnValue[];
let folderDialogCalls: OpenDialogOptions[];
let messageAnswers: MessageBoxReturnValue[];
let messageBoxCalls: MessageBoxOptions[];
let handlers: Map<string, Handler>;
let senderWindow: BrowserWindow | null;
const window = {} as BrowserWindow;

const effects: PlotterEffects = {
  showSaveDialog: (_window, options) => {
    dialogCalls.push(options);
    return Promise.resolve(dialogAnswers.shift() ?? {canceled: true, filePath: ''});
  },
  showOpenDialog: (_window, options) => {
    folderDialogCalls.push(options);
    return Promise.resolve(folderAnswers.shift() ?? {canceled: true, filePaths: []});
  },
  showMessageBox: (_window, options) => {
    messageBoxCalls.push(options);
    return Promise.resolve(messageAnswers.shift() ?? {response: 1, checkboxChecked: false});
  },
  exists: entryExists,
  writeFile: (filePath, text) => writeFile(filePath, text, 'utf8'),
  documentsFolder: () => documents,
};

function saveSvg(payload: unknown): Promise<unknown> {
  return Promise.resolve(handlers.get(PLOTTER_CHANNELS.saveSvg)?.({}, payload));
}

function savePieces(payload: unknown): Promise<unknown> {
  return Promise.resolve(handlers.get(PLOTTER_CHANNELS.savePieces)?.({}, payload));
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'crancula-plotter-ipc-'));
  documents = join(dir, 'Documents');
  folder = join(dir, 'Tapes');
  await mkdir(folder);
  dialogAnswers = [];
  dialogCalls = [];
  folderAnswers = [];
  folderDialogCalls = [];
  messageAnswers = [];
  messageBoxCalls = [];
  handlers = new Map<string, Handler>();
  senderWindow = window;
  const ipcMain: IpcHandlerRegistry = {handle: (channel, handler) => void handlers.set(channel, handler)};
  registerPlotterHandlers(ipcMain, effects, () => senderWindow);
});

afterEach(async () => {
  await rm(dir, {recursive: true, force: true});
});

describe('registerPlotterHandlers', () => {
  it('handles exactly the allow-listed channels', () => {
    expect([...handlers.keys()].sort()).toEqual(['plotter:save-svg', 'plotter:save-svg-pieces']);
    expect(PLOTTER_CHANNELS).toEqual({saveSvg: 'plotter:save-svg', savePieces: 'plotter:save-svg-pieces'});
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

describe('registerPlotterHandlers: savePieces', () => {
  it('rejects an invalid request without opening a dialog', async () => {
    const reply = await savePieces({
      ...piecesRequest,
      pieces: [{fileName: '../evil.svg', svg: svgOf('x')}, piecesRequest.pieces[1]],
    });

    expect(reply).toEqual({status: 'rejected', reason: expect.stringContaining('fileName')});
    expect(folderDialogCalls).toEqual([]);
    expect(messageBoxCalls).toEqual([]);
  });

  it('rejects a single piece, which goes through saveSvg instead', async () => {
    const reply = await savePieces({...piecesRequest, pieces: [piecesRequest.pieces[0]]});

    expect(reply).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(folderDialogCalls).toEqual([]);
  });

  it('rejects the request without a dialog when the sender has no window', async () => {
    senderWindow = null;

    expect(await savePieces(piecesRequest)).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(folderDialogCalls).toEqual([]);
  });

  it('shows the folder dialog modal to the window of the sender', async () => {
    let shownFor: BrowserWindow | null = null;
    const original = effects.showOpenDialog;
    effects.showOpenDialog = (parent, options) => {
      shownFor = parent;
      return original(parent, options);
    };
    try {
      await savePieces(piecesRequest);
    } finally {
      effects.showOpenDialog = original;
    }

    expect(shownFor).toBe(window);
  });

  it('shows the folder dialog with the translated title and button, Documents as default folder and folder properties', async () => {
    await savePieces(piecesRequest);

    expect(folderDialogCalls).toHaveLength(1);
    expect(folderDialogCalls[0]).toMatchObject({
      title: 'Choose the folder for the Tape pieces',
      buttonLabel: 'Save here',
      defaultPath: documents,
      properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
    });
  });

  it('answers cancelled and writes nothing when the folder dialog is cancelled', async () => {
    folderAnswers.push({canceled: true, filePaths: []});

    expect(await savePieces(piecesRequest)).toEqual({status: 'cancelled'});
    expect(await readdir(folder)).toEqual([]);
  });

  it('writes every piece as UTF-8 in order into the chosen folder and answers saved with the names', async () => {
    folderAnswers.push({canceled: false, filePaths: [folder]});

    expect(await savePieces(piecesRequest)).toEqual({
      status: 'saved',
      folderPath: folder,
      fileNames: ['Waltz 1 of 3.svg', 'Waltz 2 of 3.svg', 'Waltz 3 of 3.svg'],
    });
    for (const piece of piecesRequest.pieces) {
      expect(await readFile(join(folder, piece.fileName), 'utf8')).toBe(piece.svg);
    }
  });

  it('asks no replace question when no piece name exists in the folder yet', async () => {
    folderAnswers.push({canceled: false, filePaths: [folder]});

    expect(await savePieces(piecesRequest)).toMatchObject({status: 'saved'});
    expect(messageBoxCalls).toEqual([]);
  });

  // Creating a symlink needs Developer Mode or elevation on Windows; without it this one case is skipped.
  it.skipIf(!SYMLINKS_ALLOWED)('counts a dangling symlink as existing and asks the replace question', async () => {
    await symlink(join(dir, 'missing-target.svg'), join(folder, 'Waltz 2 of 3.svg'));
    folderAnswers.push({canceled: false, filePaths: [folder]});
    messageAnswers.push({response: 1, checkboxChecked: false});

    expect(await savePieces(piecesRequest)).toEqual({status: 'cancelled'});
    expect(messageBoxCalls).toHaveLength(1);
    expect(messageBoxCalls[0]).toMatchObject({detail: 'Waltz 2 of 3.svg'});
  });

  it('asks once before replacing, naming the existing files one per line', async () => {
    await writeFile(join(folder, 'Waltz 1 of 3.svg'), 'old', 'utf8');
    await writeFile(join(folder, 'Waltz 3 of 3.svg'), 'old', 'utf8');
    folderAnswers.push({canceled: false, filePaths: [folder]});
    messageAnswers.push({response: 1, checkboxChecked: false});

    await savePieces(piecesRequest);

    expect(messageBoxCalls).toHaveLength(1);
    expect(messageBoxCalls[0]).toMatchObject({
      type: 'question',
      message: 'Some of these files already exist. Replace them?',
      detail: 'Waltz 1 of 3.svg\nWaltz 3 of 3.svg',
      buttons: ['Replace', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    });
  });

  it('lists the first 10 existing names and a more line with the count of the rest when more than 10 exist', async () => {
    const fileNames = Array.from({length: 11}, (_, index) => `Waltz ${index + 1} of 11.svg`);
    for (const fileName of fileNames) await writeFile(join(folder, fileName), 'old', 'utf8');
    folderAnswers.push({canceled: false, filePaths: [folder]});
    messageAnswers.push({response: 1, checkboxChecked: false});

    await savePieces({...piecesRequest, pieces: fileNames.map((fileName) => ({fileName, svg: svgOf(fileName)}))});

    expect(messageBoxCalls[0]?.detail).toBe([...fileNames.slice(0, 10), '… and 1 more'].join('\n'));
  });

  it('lists every existing name and no more line when 10 or fewer exist', async () => {
    const fileNames = Array.from({length: 10}, (_, index) => `Waltz ${index + 1} of 10.svg`);
    for (const fileName of fileNames) await writeFile(join(folder, fileName), 'old', 'utf8');
    folderAnswers.push({canceled: false, filePaths: [folder]});
    messageAnswers.push({response: 1, checkboxChecked: false});

    await savePieces({...piecesRequest, pieces: fileNames.map((fileName) => ({fileName, svg: svgOf(fileName)}))});

    expect(messageBoxCalls[0]?.detail).toBe(fileNames.join('\n'));
  });

  it('answers cancelled and keeps every existing file unchanged when the replace question is answered Cancel', async () => {
    await writeFile(join(folder, 'Waltz 2 of 3.svg'), 'old', 'utf8');
    folderAnswers.push({canceled: false, filePaths: [folder]});
    messageAnswers.push({response: 1, checkboxChecked: false});

    expect(await savePieces(piecesRequest)).toEqual({status: 'cancelled'});
    expect(await readdir(folder)).toEqual(['Waltz 2 of 3.svg']);
    expect(await readFile(join(folder, 'Waltz 2 of 3.svg'), 'utf8')).toBe('old');
  });

  it('replaces the existing files and writes every piece when the replace question is answered Replace', async () => {
    await writeFile(join(folder, 'Waltz 2 of 3.svg'), 'old', 'utf8');
    folderAnswers.push({canceled: false, filePaths: [folder]});
    messageAnswers.push({response: 0, checkboxChecked: false});

    expect(await savePieces(piecesRequest)).toMatchObject({status: 'saved', folderPath: folder});
    for (const piece of piecesRequest.pieces) {
      expect(await readFile(join(folder, piece.fileName), 'utf8')).toBe(piece.svg);
    }
  });

  it('answers failed with the piece that failed, its OS error code and the names written before, and writes no later piece', async () => {
    const original = effects.writeFile;
    effects.writeFile = (filePath, text) =>
      basename(filePath) === 'Waltz 2 of 3.svg'
        ? Promise.reject(Object.assign(new Error('access denied'), {code: 'EACCES'}))
        : original(filePath, text);
    folderAnswers.push({canceled: false, filePaths: [folder]});
    try {
      expect(await savePieces(piecesRequest)).toEqual({
        status: 'failed',
        fileName: 'Waltz 2 of 3.svg',
        reason: 'EACCES',
        written: ['Waltz 1 of 3.svg'],
      });
    } finally {
      effects.writeFile = original;
    }

    await expect(stat(join(folder, 'Waltz 3 of 3.svg'))).rejects.toThrow();
  });

  it('starts the folder dialog in the folder of the last single-file export, shared with saveSvg', async () => {
    const single = join(dir, 'Single');
    await mkdir(single);
    dialogAnswers.push({canceled: false, filePath: join(single, 'out.svg')});
    await saveSvg(request);
    folderAnswers.push({canceled: true, filePaths: []});

    await savePieces(piecesRequest);

    expect(folderDialogCalls[0]?.defaultPath).toBe(single);
  });
});
