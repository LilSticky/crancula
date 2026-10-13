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

/** Starts the built Electron app with its own `userData` folder (`CRANCULA_USER_DATA`). */
export async function launchApp(userDataDir?: string): Promise<LaunchedApp> {
  const dir = userDataDir ?? (await mkdtemp(join(tmpdir(), 'crancula-e2e-')));
  const app = await electron.launch({
    args: [join(__dirname, '../../app/main.js')],
    env: {...process.env, CRANCULA_USER_DATA: dir},
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return {app, window, userDataDir: dir};
}
