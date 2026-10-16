import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import * as nodeFs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {OrganLibrarySnapshot} from '../api';
import {createOrganLibraryFile, type FileSystem} from './organ-library-file';

const ID = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';

function snapshot(name: string, leadIn = 20): OrganLibrarySnapshot {
  return {
    version: 3,
    organs: [
      {
        id: ID,
        name,
        tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
        minimumGap: 1.5,
        leadIn,
        pipes: [{note: 60}, {note: 62}],
      },
    ],
  };
}

let dir: string;
const organsFile = () => join(dir, 'organs.json');
const readSnapshot = async () => JSON.parse(await readFile(organsFile(), 'utf8')) as unknown;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'crancula-organs-'));
});

afterEach(async () => {
  await rm(dir, {recursive: true, force: true});
});

describe('load', () => {
  it('is empty when there is no snapshot yet', async () => {
    expect(await createOrganLibraryFile(dir).load()).toEqual({status: 'empty'});
  });

  it('is empty when the folder does not exist yet', async () => {
    expect(await createOrganLibraryFile(join(dir, 'missing')).load()).toEqual({status: 'empty'});
  });

  it('reads a valid snapshot', async () => {
    await writeFile(organsFile(), JSON.stringify(snapshot('Street organ')));
    expect(await createOrganLibraryFile(dir).load()).toEqual({status: 'loaded', snapshot: snapshot('Street organ')});
  });

  it('loads a version 1 snapshot with a Border as Organs without a Border and leaves the file untouched', async () => {
    const legacy = JSON.stringify({
      version: 1,
      organs: [
        {
          id: ID,
          name: 'Street organ',
          tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5, border: 4},
          minimumGap: 1.5,
          pipes: [{note: 60}, {note: 62}],
        },
      ],
    });
    await writeFile(organsFile(), legacy);

    const result = await createOrganLibraryFile(dir).load();

    expect(result).toEqual({status: 'loaded', snapshot: snapshot('Street organ', 0)});
    expect(await readFile(organsFile(), 'utf8')).toBe(legacy);
    expect(await readdir(dir)).toEqual(['organs.json']);
  });

  it.each([
    ['broken JSON', '{oops'],
    ['an unknown version', JSON.stringify({version: 4, organs: []})],
    ['an invalid Organ', JSON.stringify({version: 3, organs: [{id: ID}]})],
  ])('moves a snapshot with %s aside untouched', async (_, content) => {
    await writeFile(organsFile(), content);
    const now = () => new Date('2026-10-14T12:34:56.789Z');

    const result = await createOrganLibraryFile(dir, {now}).load();

    const backupPath = join(dir, 'organs.unreadable-2026-10-14T12-34-56-789Z.json');
    expect(result).toEqual({status: 'unreadable', backupPath, reason: expect.any(String)});
    expect(await readFile(backupPath, 'utf8')).toBe(content);
    expect(await readdir(dir)).toEqual(['organs.unreadable-2026-10-14T12-34-56-789Z.json']);
  });
});

describe('save', () => {
  it('writes a snapshot that load reads back', async () => {
    const file = createOrganLibraryFile(dir, {debounceMs: 5});

    expect(await file.save(snapshot('Street organ'))).toEqual({status: 'saved'});

    expect(await readSnapshot()).toEqual(snapshot('Street organ'));
    expect(await createOrganLibraryFile(dir).load()).toEqual({status: 'loaded', snapshot: snapshot('Street organ')});
  });

  it('creates the folder if needed', async () => {
    const nested = join(dir, 'snapshots');
    await createOrganLibraryFile(nested, {debounceMs: 5}).save(snapshot('Street organ'));
    expect(await readdir(nested)).toEqual(['organs.json']);
  });

  it('rejects an invalid payload without writing', async () => {
    const result = await createOrganLibraryFile(dir, {debounceMs: 5}).save({version: 3, organs: [{id: 'x'}]});

    expect(result).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(await readdir(dir)).toEqual([]);
  });

  it('coalesces quick saves into one write of the latest snapshot', async () => {
    const fs: FileSystem = {...nodeFs, writeFile: vi.fn(nodeFs.writeFile)};
    const file = createOrganLibraryFile(dir, {debounceMs: 20, fs});

    const results = await Promise.all([file.save(snapshot('A')), file.save(snapshot('B')), file.save(snapshot('C'))]);

    expect(results).toEqual([{status: 'saved'}, {status: 'saved'}, {status: 'saved'}]);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(await readSnapshot()).toEqual(snapshot('C'));
  });

  it('writes atomically through a temporary file', async () => {
    const fs: FileSystem = {...nodeFs, rename: vi.fn(nodeFs.rename)};

    await createOrganLibraryFile(dir, {debounceMs: 5, fs}).save(snapshot('Street organ'));

    expect(fs.rename).toHaveBeenCalledWith(join(dir, 'organs.json.tmp'), organsFile());
    expect(await readdir(dir)).toEqual(['organs.json']);
  });

  it('reports a failed write and keeps the previous snapshot', async () => {
    await writeFile(organsFile(), JSON.stringify(snapshot('Old')));
    const fs: FileSystem = {...nodeFs, writeFile: vi.fn().mockRejectedValue(new Error('disk full'))};

    const result = await createOrganLibraryFile(dir, {debounceMs: 5, fs}).save(snapshot('New'));

    expect(result).toEqual({status: 'failed', reason: expect.stringContaining('disk full')});
    expect(await readSnapshot()).toEqual(snapshot('Old'));
  });
});

describe('flush', () => {
  it('writes a pending snapshot right away', async () => {
    const file = createOrganLibraryFile(dir, {debounceMs: 60_000});
    const saved = file.save(snapshot('Street organ'));

    await file.flush();

    expect(await readSnapshot()).toEqual(snapshot('Street organ'));
    expect(await saved).toEqual({status: 'saved'});
  });

  it('does nothing without pending snapshots', async () => {
    await createOrganLibraryFile(dir).flush();
    expect(await readdir(dir)).toEqual([]);
  });
});
