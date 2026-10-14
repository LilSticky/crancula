// TEMPORARY diagnostic for PR #31: does the hidden window slow down while a second app runs? Remove after.
import {test} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';
import {cpus, loadavg, tmpdir} from 'node:os';
import {join} from 'node:path';
import {_electron as electron, type ElectronApplication} from 'playwright';

interface Probe {
  readonly app: ElectronApplication;
  readonly name: string;
}

async function launch(name: string, args: string[], headless: boolean): Promise<Probe> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  env['CRANCULA_USER_DATA'] = await mkdtemp(join(tmpdir(), 'crancula-probe-'));
  if (headless) env['CRANCULA_HEADLESS'] = '1';
  const app = await electron.launch({args: [...args, join(__dirname, '../app/main.js')], env});
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return {app, name};
}

async function fps(probe: Probe): Promise<string> {
  const frames = await (await probe.app.firstWindow()).evaluate(
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
  return `${probe.name}=${frames}fps`;
}

test('frame rate probe: one app versus two apps at once', async () => {
  test.setTimeout(120000);
  const log = [`[probe ${process.platform}] cpus=${cpus().length} load=${loadavg().join(',')}`];
  for (const [label, args, headless] of [
    ['default', [], true],
    ['x11', ['--ozone-platform=x11'], true],
    ['shown', [], false],
  ] as const) {
    const a = await launch(`${label}-A`, [...args], headless);
    log.push(`  ${label} alone: ${await fps(a)}`);
    const b = await launch(`${label}-B`, [...args], headless);
    log.push(`  ${label} two at once: ${await fps(a)} ${await fps(b)}`);
    await b.app.close();
    log.push(`  ${label} after closing B: ${await fps(a)}`);
    await a.app.close();
  }
  console.log(log.join('\n'));
});
