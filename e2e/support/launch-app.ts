import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron, type ElectronApplication, type Page} from 'playwright';

export interface LaunchedApp {
  readonly app: ElectronApplication;
  readonly window: Page;
  /** The `userData` folder of this run; pass it to the next launch to simulate a restart. */
  readonly userDataDir: string;
}

type LaunchOptions = NonNullable<Parameters<typeof electron.launch>[0]>;

/** Waits before each retry; the launch is attempted once more than this list has entries. */
const RETRY_WAITS_MS: readonly number[] = [500, 1000];
const MISSING_DISPLAY = 'Missing X server or $DISPLAY';

/**
 * Launches Electron, retrying only the transient Linux/Xvfb failure where the X connection is
 * refused (#145). Any other launch error, and the error of the last attempt, is rethrown unchanged.
 */
async function launchElectron(options: LaunchOptions): Promise<ElectronApplication> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await electron.launch(options);
    } catch (error) {
      const retriable =
        error instanceof Error && error.message.includes(MISSING_DISPLAY);
      const wait = RETRY_WAITS_MS[attempt];
      if (!retriable || wait === undefined) throw error;
      await delay(wait);
    }
  }
}

/**
 * Starts the built Electron app with its own `userData` folder (`CRANCULA_USER_DATA`).
 * The window stays hidden (`CRANCULA_HEADLESS`) unless `HEADED=1` is set.
 */
export async function launchApp(userDataDir?: string): Promise<LaunchedApp> {
  const dir = userDataDir ?? (await mkdtemp(join(tmpdir(), 'crancula-e2e-')));
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  env['CRANCULA_USER_DATA'] = dir;
  if (process.env['HEADED'] !== '1') env['CRANCULA_HEADLESS'] = '1';
  const app = await launchElectron({
    args: [join(__dirname, '../../app/main.mjs')],
    env,
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return {app, window, userDataDir: dir};
}
