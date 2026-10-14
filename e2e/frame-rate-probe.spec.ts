// TEMPORARY diagnostic for PR #31: frame rate of the hidden window under several launch variants. Remove after.
import {test} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {_electron as electron, type ElectronApplication, type Page} from 'playwright';

async function framesPerSecond(window: Page): Promise<string> {
  return window.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const start = performance.now();
        let frames = 0;
        const count = (): void => {
          frames++;
          if (performance.now() - start < 1000) requestAnimationFrame(count);
          else resolve(`fps=${frames} visibility=${document.visibilityState} hasFocus=${document.hasFocus()}`);
        };
        requestAnimationFrame(count);
      }),
  );
}

async function windowState(app: ElectronApplication): Promise<string> {
  return app.evaluate(({BrowserWindow, app: electronApp}) => {
    const win = BrowserWindow.getAllWindows()[0];
    const gpu = electronApp.getGPUFeatureStatus();
    return JSON.stringify({
      bounds: win.getBounds(),
      visible: win.isVisible(),
      gpu: gpu.gpu_compositing,
      raster: gpu.rasterization,
      ozone: process.argv.filter((a) => a.includes('ozone')),
      xdg: process.env['XDG_SESSION_TYPE'],
      wayland: process.env['WAYLAND_DISPLAY'],
    });
  });
}

const variants: Record<string, {args: string[]; headless: boolean}> = {
  'headless': {args: [], headless: true},
  'headless --disable-gpu': {args: ['--disable-gpu'], headless: true},
  'headless no-backgrounding flags': {
    args: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'],
    headless: true,
  },
  'headless --ozone-platform=x11': {args: ['--ozone-platform=x11'], headless: true},
  'not headless': {args: [], headless: false},
};

for (const [name, variant] of Object.entries(variants)) {
  test(`frame rate probe: ${name}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crancula-probe-'));
    const app = await electron.launch({
      args: [...variant.args, join(__dirname, '../app/main.js')],
      env: {...process.env, CRANCULA_USER_DATA: dir, ...(variant.headless ? {CRANCULA_HEADLESS: '1'} : {})},
    });
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    const lines = [`[probe ${process.platform}] ${name}: ${await windowState(app)}`];
    lines.push(`  as launched: ${await framesPerSecond(window)}`);
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    lines.push(`  backgroundThrottling off: ${await framesPerSecond(window)}`);
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setPosition(0, 0));
    lines.push(`  moved on screen: ${await framesPerSecond(window)} ${await windowState(app)}`);
    console.log(lines.join('\n'));
    await app.close();
  });
}
