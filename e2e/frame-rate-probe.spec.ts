// TEMPORARY diagnostic for PR #31: which part of the hidden window makes it render slowly on Linux? Remove after.
import {test} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {_electron as electron, type ElectronApplication, type Page} from 'playwright';

async function launch(args: string[]): Promise<ElectronApplication> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  env['CRANCULA_USER_DATA'] = await mkdtemp(join(tmpdir(), 'crancula-probe-'));
  env['CRANCULA_HEADLESS'] = '1';
  const app = await electron.launch({args: [...args, join(__dirname, '../app/main.js')], env});
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return app;
}

async function fps(window: Page): Promise<number> {
  return window.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        let count = 0;
        const tick = (): void => {
          count++;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(count);
        };
        requestAnimationFrame(tick);
      }),
  );
}

const windowVariants: Record<string, {x: number; y: number; opacity: number; focusable: boolean; skipTaskbar: boolean}> = {
  'as headless': {x: -32000, y: -32000, opacity: 0, focusable: false, skipTaskbar: true},
  'on screen, rest headless': {x: 0, y: 0, opacity: 0, focusable: false, skipTaskbar: true},
  'opaque, rest headless': {x: -32000, y: -32000, opacity: 1, focusable: false, skipTaskbar: true},
  'focusable, rest headless': {x: -32000, y: -32000, opacity: 0, focusable: true, skipTaskbar: true},
  'partly on screen, rest headless': {x: -799, y: -599, opacity: 0, focusable: false, skipTaskbar: true},
  'plain window on screen': {x: 0, y: 0, opacity: 1, focusable: true, skipTaskbar: false},
};

test('frame rate probe: launch flags, runtime changes and window options', async () => {
  test.setTimeout(180000);
  const log = [`[probe ${process.platform}]`];

  for (const flags of [[], ['--disable-gpu-vsync'], ['--disable-frame-rate-limit'], ['--use-gl=angle', '--use-angle=swiftshader']]) {
    const app = await launch(flags);
    log.push(`  launched alone with [${flags.join(' ')}]: ${await fps(await app.firstWindow())} fps`);
    await app.close();
  }

  const app = await launch([]);
  const main = await app.firstWindow();
  log.push(`  main window alone: ${await fps(main)} fps`);
  const changes: Record<string, string> = {
    'setOpacity(1)': 'win.setOpacity(1)',
    'setFocusable(true) + focus()': 'win.setFocusable(true); win.focus()',
    'setPosition(0, 0)': 'win.setPosition(0, 0)',
    'hide() + show()': 'win.hide(); win.show()',
  };
  for (const [name, code] of Object.entries(changes)) {
    await app.evaluate(({BrowserWindow}, source) => {
      const win = BrowserWindow.getAllWindows()[0];
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function('win', source)(win);
    }, code);
    await main.waitForTimeout(300);
    log.push(`  main window after ${name}: ${await fps(main)} fps`);
  }

  for (const [name, options] of Object.entries(windowVariants)) {
    const pagePromise = app.waitForEvent('window');
    const id = await app.evaluate(({BrowserWindow}, opts) => {
      const [first] = BrowserWindow.getAllWindows();
      const win = new BrowserWindow({...opts, width: 800, height: 600, webPreferences: {sandbox: true, contextIsolation: true}});
      win.loadURL(first.webContents.getURL()).catch(() => undefined);
      return win.id;
    }, options);
    const page = await pagePromise;
    await page.waitForLoadState('domcontentloaded');
    log.push(`  second window ${name}: ${await fps(page)} fps`);
    await app.evaluate(({BrowserWindow}, windowId) => BrowserWindow.fromId(windowId)?.destroy(), id);
  }
  await app.close();
  console.log(log.join('\n'));
});
