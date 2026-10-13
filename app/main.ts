import {app, BrowserWindow, ipcMain, screen} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {createOrganLibraryFile} from './organ-library-file';
import {registerOrganLibraryHandlers} from './organ-library-ipc';

let win: BrowserWindow | null = null;
const args = process.argv.slice(1);
const serve = args.some((val) => val === '--serve');

// Tests run with their own userData folder (ADR 8).
if (process.env['CRANCULA_USER_DATA']) {
  app.setPath('userData', process.env['CRANCULA_USER_DATA']);
}

const organLibraryFile = createOrganLibraryFile(path.join(app.getPath('userData'), 'snapshots'));
registerOrganLibraryHandlers(ipcMain, organLibraryFile);

function createWindow(): BrowserWindow {
  const size = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

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
  void organLibraryFile.flush().finally(() => {
    flushedBeforeQuit = true;
    app.quit();
  });
});

void app.whenReady().then(() => {
  // A short delay avoids a black background with transparent windows:
  // https://github.com/electron/electron/issues/15947
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
