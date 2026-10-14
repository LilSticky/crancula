import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {_electron as electron, type ElectronApplication, type Page} from 'playwright';

export interface LaunchedApp {
  readonly app: ElectronApplication;
  readonly window: Page;
  /** The `userData` folder of this run; pass it to the next launch to simulate a restart. */
  readonly userDataDir: string;
}

/**
 * Starts the built Electron app with its own `userData` folder (`CRANCULA_USER_DATA`).
 * The window stays hidden (`CRANCULA_HEADLESS`) unless `HEADED=1` is set.
 */
export async function launchApp(userDataDir?: string): Promise<LaunchedApp> {
  const dir = userDataDir ?? (await mkdtemp(join(tmpdir(), 'crancula-e2e-')));
  const headless = process.env['HEADED'] === '1' ? {} : {CRANCULA_HEADLESS: '1'};
  const app = await electron.launch({
    args: [join(__dirname, '../../app/main.js')],
    env: {...process.env, CRANCULA_USER_DATA: dir, ...headless},
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return {app, window, userDataDir: dir};
}
