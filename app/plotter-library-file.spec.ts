import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import * as nodeFs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {PlotterLibrarySnapshot} from '../api';
import {createPlotterLibraryFile} from './plotter-library-file';
import type {FileSystem} from './snapshot-file';

const SHEET = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const ROLL = '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f';

function snapshot(name: string): PlotterLibrarySnapshot {
  return {
    version: 1,
    plotters: [
      {id: SHEET, name, format: 'svg', workingWidth: 120, roll: false, workingLength: 300, overlap: 20},
      {id: ROLL, name: 'Vinyl cutter', format: 'svg', workingWidth: 120, roll: true},
    ],
  };
}

let dir: string;
const plottersFile = () => join(dir, 'plotters.json');
const readSnapshot = async () => JSON.parse(await readFile(plottersFile(), 'utf8')) as unknown;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'crancula-plotters-'));
});

afterEach(async () => {
  await rm(dir, {recursive: true, force: true});
});

describe('load', () => {
  it('is empty when there is no snapshot yet', async () => {
    expect(await createPlotterLibraryFile(dir).load()).toEqual({status: 'empty'});
  });

  it('is empty when the folder does not exist yet', async () => {
    expect(await createPlotterLibraryFile(join(dir, 'missing')).load()).toEqual({status: 'empty'});
  });

  it('reads a valid snapshot, sheet and roll Plotters alike', async () => {
    await writeFile(plottersFile(), JSON.stringify(snapshot('Cutting mat')));
    expect(await createPlotterLibraryFile(dir).load()).toEqual({status: 'loaded', snapshot: snapshot('Cutting mat')});
  });

  it.each([
    ['broken JSON', '{oops'],
    ['an unknown version', JSON.stringify({version: 2, plotters: []})],
    ['an invalid Plotter', JSON.stringify({version: 1, plotters: [{id: SHEET}]})],
    [
      'a roll Plotter with a working length',
      JSON.stringify({
        version: 1,
        plotters: [{id: ROLL, name: 'Vinyl cutter', format: 'svg', workingWidth: 120, roll: true, workingLength: 300}],
      }),
    ],
  ])('moves a snapshot with %s aside untouched', async (_, content) => {
    await writeFile(plottersFile(), content);
    const now = () => new Date('2026-10-14T12:34:56.789Z');

    const result = await createPlotterLibraryFile(dir, {now}).load();

    const backupPath = join(dir, 'plotters.unreadable-2026-10-14T12-34-56-789Z.json');
    expect(result).toEqual({status: 'unreadable', backupPath, reason: expect.any(String)});
    expect(await readFile(backupPath, 'utf8')).toBe(content);
    expect(await readdir(dir)).toEqual(['plotters.unreadable-2026-10-14T12-34-56-789Z.json']);
  });

  it('leaves Organs and Tapes alone when plotters.json is unreadable', async () => {
    await writeFile(join(dir, 'organs.json'), '{"version":1,"organs":[]}');
    await writeFile(plottersFile(), '{oops');

    await createPlotterLibraryFile(dir).load();

    expect(await readFile(join(dir, 'organs.json'), 'utf8')).toBe('{"version":1,"organs":[]}');
  });
});

describe('save', () => {
  it('writes a snapshot that load reads back', async () => {
    const file = createPlotterLibraryFile(dir, {debounceMs: 5});

    expect(await file.save(snapshot('Cutting mat'))).toEqual({status: 'saved'});

    expect(await readSnapshot()).toEqual(snapshot('Cutting mat'));
    expect(await createPlotterLibraryFile(dir).load()).toEqual({status: 'loaded', snapshot: snapshot('Cutting mat')});
  });

  it('writes a roll Plotter without a working length or Overlap', async () => {
    await createPlotterLibraryFile(dir, {debounceMs: 5}).save(snapshot('Cutting mat'));

    const written = (await readSnapshot()) as {plotters: Record<string, unknown>[]};
    expect(written.plotters[1]).toEqual({id: ROLL, name: 'Vinyl cutter', format: 'svg', workingWidth: 120, roll: true});
  });

  it('creates the folder if needed', async () => {
    const nested = join(dir, 'snapshots');
    await createPlotterLibraryFile(nested, {debounceMs: 5}).save(snapshot('Cutting mat'));
    expect(await readdir(nested)).toEqual(['plotters.json']);
  });

  it('rejects an invalid payload without writing', async () => {
    const result = await createPlotterLibraryFile(dir, {debounceMs: 5}).save({version: 1, plotters: [{id: 'x'}]});

    expect(result).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(await readdir(dir)).toEqual([]);
  });

  it('coalesces quick saves into one write of the latest snapshot', async () => {
    const fs: FileSystem = {...nodeFs, writeFile: vi.fn(nodeFs.writeFile)};
    const file = createPlotterLibraryFile(dir, {debounceMs: 20, fs});

    const results = await Promise.all([file.save(snapshot('A')), file.save(snapshot('B')), file.save(snapshot('C'))]);

    expect(results).toEqual([{status: 'saved'}, {status: 'saved'}, {status: 'saved'}]);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(await readSnapshot()).toEqual(snapshot('C'));
  });

  it('writes atomically through a temporary file', async () => {
    const fs: FileSystem = {...nodeFs, rename: vi.fn(nodeFs.rename)};

    await createPlotterLibraryFile(dir, {debounceMs: 5, fs}).save(snapshot('Cutting mat'));

    expect(fs.rename).toHaveBeenCalledWith(join(dir, 'plotters.json.tmp'), plottersFile());
    expect(await readdir(dir)).toEqual(['plotters.json']);
  });

  it('reports a failed write and keeps the previous snapshot', async () => {
    await writeFile(plottersFile(), JSON.stringify(snapshot('Old')));
    const fs: FileSystem = {...nodeFs, writeFile: vi.fn().mockRejectedValue(new Error('disk full'))};

    const result = await createPlotterLibraryFile(dir, {debounceMs: 5, fs}).save(snapshot('New'));

    expect(result).toEqual({status: 'failed', reason: expect.stringContaining('disk full')});
    expect(await readSnapshot()).toEqual(snapshot('Old'));
  });
});

describe('flush', () => {
  it('writes a pending snapshot right away', async () => {
    const file = createPlotterLibraryFile(dir, {debounceMs: 60_000});
    const saved = file.save(snapshot('Cutting mat'));

    await file.flush();

    expect(await readSnapshot()).toEqual(snapshot('Cutting mat'));
    expect(await saved).toEqual({status: 'saved'});
  });

  it('does nothing without pending snapshots', async () => {
    await createPlotterLibraryFile(dir).flush();
    expect(await readdir(dir)).toEqual([]);
  });
});
