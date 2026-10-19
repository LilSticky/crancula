import {existsSync, readFileSync} from 'node:fs';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

type BundleElectron = (outdir: string) => Promise<void>;

describe('bundle-electron (ADR 12)', () => {
  let outdir = '';
  let main = '';
  let preload = '';

  beforeAll(async () => {
    // Expected API: scripts/bundle-electron.mjs exports `bundleElectron(outdir)` and only builds
    // into `app/` when run directly (not on import).
    const module = (await import('./bundle-electron.mjs')) as {bundleElectron: BundleElectron};
    outdir = await mkdtemp(join(tmpdir(), 'crancula-bundle-'));
    await module.bundleElectron(outdir);
    const mainPath = join(outdir, 'main.mjs');
    const preloadPath = join(outdir, 'preload.js');
    main = existsSync(mainPath) ? readFileSync(mainPath, 'utf8') : '';
    preload = existsSync(preloadPath) ? readFileSync(preloadPath, 'utf8') : '';
  }, 60_000);

  afterAll(async () => {
    if (outdir) await rm(outdir, {recursive: true, force: true});
  });

  it('emits the main process as ESM main.mjs', () => {
    expect(main).not.toBe('');
    expect(main).toMatch(/^import .* from ?"electron"/m);
    expect(main).not.toContain('require("electron")');
    expect(main).not.toContain('__dirname');
  });

  it('emits the preload as CommonJS preload.js', () => {
    expect(preload).not.toBe('');
    expect(preload).toContain('require("electron")');
    expect(preload).not.toMatch(/^import /m);
  });

  it('keeps electron-debug and electron-reloader external', () => {
    expect(main).toMatch(/["']electron-debug["']/);
    expect(main).toMatch(/["']electron-reloader["']/);
  });

  it('does not emit a CommonJS main.js', () => {
    expect(existsSync(join(outdir, 'main.js'))).toBe(false);
  });
});
