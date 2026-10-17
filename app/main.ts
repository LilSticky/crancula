import {app, BrowserWindow, dialog, ipcMain, Menu, screen} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type {Language} from '../api';
import {registerAppHandlers} from './app-ipc';
import {menuTemplate, SOURCE_I18N_DIRECTORY} from './application-menu';
import {createOrganLibraryFile} from './organ-library-file';
import {registerOrganLibraryHandlers} from './organ-library-ipc';
import {registerPlotterHandlers} from './plotter-ipc';
import {createTapeLibraryFile} from './tape-library-file';
import {registerTapeLibraryHandlers} from './tape-library-ipc';
import {windowOptions} from './window-options';

let win: BrowserWindow | null = null;
const args = process.argv.slice(1);
const serve = args.some((val) => val === '--serve');

// Tests run with their own userData folder (ADR 8).
if (process.env['CRANCULA_USER_DATA']) {
  app.setPath('userData', process.env['CRANCULA_USER_DATA']);
}

const organLibraryFile = createOrganLibraryFile(path.join(app.getPath('userData'), 'snapshots'));
registerOrganLibraryHandlers(ipcMain, organLibraryFile);
const tapeLibraryFile = createTapeLibraryFile(path.join(app.getPath('userData'), 'snapshots'));
registerTapeLibraryHandlers(ipcMain, tapeLibraryFile);
registerPlotterHandlers(
  ipcMain,
  {
    // Looked up at call time, so e2e tests can replace dialog.showSaveDialog.
    showSaveDialog: (window, options) => dialog.showSaveDialog(window, options),
    writeFile: (filePath, text) => fs.promises.writeFile(filePath, text, 'utf8'),
    documentsFolder: () => app.getPath('documents'),
  },
  (event) => BrowserWindow.fromWebContents(event.sender),
);

/** The folder the renderer's translation files are loaded from: the sources when serving, else the built assets. */
function i18nDirectory(): string {
  if (serve) return SOURCE_I18N_DIRECTORY;
  const built = path.join(__dirname, '../dist/browser/assets/i18n');
  return fs.existsSync(built) ? built : path.join(__dirname, 'browser/assets/i18n');
}

function applyMenu(language: Language): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(language, process.platform, i18nDirectory())));
}

registerAppHandlers(ipcMain, applyMenu);

function createWindow(): BrowserWindow {
  // E2E runs set CRANCULA_HEADLESS=1 to keep the window hidden (see windowOptions).
  win = new BrowserWindow(
    windowOptions(
      process.env,
      screen.getPrimaryDisplay().workAreaSize,
      path.join(__dirname, 'preload.js'),
      process.platform,
    ),
  );

  if (serve) {
    void import('electron-debug').then((debug) => {
      debug.default({isEnabled: true, showDevTools: true});
    });
    void import('electron-reloader').then((reloader: {default?: (target: typeof module) => void}) => {
      reloader.default?.(module);
    });
    void win.loadURL('http://localhost:4200');
  } else {
    // Path when running the packaged executable
    let pathIndex = './browser/index.html';
    if (fs.existsSync(path.join(__dirname, '../dist/browser/index.html'))) {
      // Path when running electron in the local folder
      pathIndex = '../dist/browser/index.html';
    }
    const fullPath = path.join(__dirname, pathIndex);
    void win.loadURL(`file://${path.resolve(fullPath).replace(/\\/g, '/')}`);
  }

  win.on('closed', () => {
    win = null;
  });

  return win;
}

let flushedBeforeQuit = false;
app.on('before-quit', (event) => {
  if (flushedBeforeQuit) return;
  event.preventDefault();
  void Promise.all([organLibraryFile.flush(), tapeLibraryFile.flush()])
    .catch((error: unknown) => console.error('Could not write the snapshots before quitting', error))
    .finally(() => {
      flushedBeforeQuit = true;
      app.quit();
    });
});

void app.whenReady().then(() => {
  // A short delay avoids a black background with transparent windows:
  // https://github.com/electron/electron/issues/15947
  applyMenu('en'); // until the renderer reports its language
  setTimeout(createWindow, 400);

  app.on('activate', () => {
    // On macOS, re-create a window when the dock icon is clicked and no window is open.
    if (win === null) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps stay active until the user quits explicitly with Cmd + Q.
  if (process.platform !== 'darwin') app.quit();
});
