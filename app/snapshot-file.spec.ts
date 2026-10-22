import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import * as nodeFs from 'node:fs/promises';
import type {PathLike} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Result} from '../api';
import {createSnapshotFile, type FileSystem} from './snapshot-file';

/** A toy aggregate: a version 1 snapshot holding a list of words. */
interface ToySnapshot {
  readonly version: 1;
  readonly words: string[];
}

function parseToy(input: unknown): Result<readonly string[], string> {
  if (typeof input !== 'object' || input === null || !('version' in input) || input.version !== 1) {
    return {ok: false, error: 'unknown version'};
  }
  if (!('words' in input) || !Array.isArray(input.words) || !input.words.every((w) => typeof w === 'string')) {
    return {ok: false, error: 'words must be a list of strings'};
  }
  return {ok: true, value: input.words as string[]};
}

const config = {
  fileName: 'toys.json',
  parse: parseToy,
  normalise: (words: readonly string[]): ToySnapshot => ({version: 1, words: [...words]}),
};

const create = (dir: string, options = {}) => createSnapshotFile<ToySnapshot, readonly string[]>(dir, config, options);

function snapshot(...words: string[]): ToySnapshot {
  return {version: 1, words};
}

let dir: string;
const toysFile = () => join(dir, 'toys.json');
const readSnapshot = async () => JSON.parse(await readFile(toysFile(), 'utf8')) as unknown;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'crancula-snapshot-'));
});

afterEach(async () => {
  await rm(dir, {recursive: true, force: true});
});

describe('load', () => {
  it('is empty when there is no snapshot yet', async () => {
    expect(await create(dir).load()).toEqual({status: 'empty'});
  });

  it('is empty when the folder does not exist yet', async () => {
    expect(await create(join(dir, 'missing')).load()).toEqual({status: 'empty'});
  });

  it('reads a valid snapshot', async () => {
    await writeFile(toysFile(), JSON.stringify(snapshot('a', 'b')));
    expect(await create(dir).load()).toEqual({status: 'loaded', snapshot: snapshot('a', 'b')});
  });

  it.each([
    ['broken JSON', '{oops'],
    ['an unknown version', JSON.stringify({version: 2, words: []})],
    ['a failing parse', JSON.stringify({version: 1, words: [1]})],
  ])('moves a snapshot with %s aside untouched', async (_, content) => {
    await writeFile(toysFile(), content);
    const now = () => new Date('2026-10-14T12:34:56.789Z');

    const result = await create(dir, {now}).load();

    const backupPath = join(dir, 'toys.unreadable-2026-10-14T12-34-56-789Z.json');
    expect(result).toEqual({status: 'unreadable', backupPath, reason: expect.any(String)});
    expect(await readFile(backupPath, 'utf8')).toBe(content);
    expect(await readdir(dir)).toEqual(['toys.unreadable-2026-10-14T12-34-56-789Z.json']);
  });
});

/** An fs error carrying a Node error code, e.g. EACCES. */
function fsError(code: string): Error {
  return Object.assign(new Error(`${code}: simulated`), {code});
}

/** contracts/tape-library-snapshot.md FR-023, SC-007; ADR 4: the main process must survive a damaged snapshot and never overwrite it. */
describe('load when the snapshot cannot be moved aside', () => {
  const backupPattern = /unreadable/;
  const failingBackupRename = (): FileSystem => ({
    ...nodeFs,
    rename: vi.fn((from: PathLike, to: PathLike) =>
      backupPattern.test(String(to)) ? Promise.reject(fsError('EPERM')) : nodeFs.rename(from, to)),
  });

  it('does not reject and reports the snapshot as unreadable with a reason', async () => {
    await writeFile(toysFile(), '{oops');

    const result = await create(dir, {fs: failingBackupRename()}).load();

    expect(result).toEqual({status: 'unreadable', backupPath: expect.any(String), reason: expect.stringContaining('EPERM')});
    expect(await readFile(toysFile(), 'utf8')).toBe('{oops');
  });

  it('does not overwrite the unreadable file on a later save', async () => {
    await writeFile(toysFile(), '{oops');
    const file = create(dir, {debounceMs: 5, fs: failingBackupRename()});
    await file.load();

    const result = await file.save(snapshot('new'));

    expect(result).toEqual({status: 'failed', reason: expect.any(String)});
    expect(await readFile(toysFile(), 'utf8')).toBe('{oops');
    expect((await readdir(dir)).filter((name) => backupPattern.test(name))).toEqual([]);
  });

  it('treats a read error other than a missing file like an unparseable file and moves it aside', async () => {
    await writeFile(toysFile(), JSON.stringify(snapshot('a')));
    const fs: FileSystem = {...nodeFs, readFile: vi.fn().mockRejectedValue(fsError('EACCES'))};
    const now = () => new Date('2026-10-14T12:34:56.789Z');

    const result = await create(dir, {fs, now}).load();

    const backupPath = join(dir, 'toys.unreadable-2026-10-14T12-34-56-789Z.json');
    expect(result).toEqual({status: 'unreadable', backupPath, reason: expect.stringContaining('EACCES')});
    expect(await readdir(dir)).toEqual(['toys.unreadable-2026-10-14T12-34-56-789Z.json']);
  });

  it('does not reject when the file behind a read error cannot be moved either, and a later save does not overwrite it', async () => {
    await writeFile(toysFile(), JSON.stringify(snapshot('a')));
    const fs: FileSystem = {
      ...nodeFs,
      readFile: vi.fn().mockRejectedValue(fsError('EBUSY')),
      rename: failingBackupRename().rename,
    };
    const file = create(dir, {debounceMs: 5, fs});

    expect(await file.load()).toEqual({status: 'unreadable', backupPath: expect.any(String), reason: expect.any(String)});
    expect(await file.save(snapshot('new'))).toEqual({status: 'failed', reason: expect.any(String)});
    expect(await readSnapshot()).toEqual(snapshot('a'));
  });
});

describe('save', () => {
  it('writes a snapshot that load reads back', async () => {
    const file = create(dir, {debounceMs: 5});

    expect(await file.save(snapshot('a', 'b'))).toEqual({status: 'saved'});

    expect(await readSnapshot()).toEqual(snapshot('a', 'b'));
    expect(await create(dir).load()).toEqual({status: 'loaded', snapshot: snapshot('a', 'b')});
  });

  it('creates the folder if needed', async () => {
    const nested = join(dir, 'snapshots');
    await create(nested, {debounceMs: 5}).save(snapshot('a', 'b'));
    expect(await readdir(nested)).toEqual(['toys.json']);
  });

  it('rejects an invalid payload without writing', async () => {
    const result = await create(dir, {debounceMs: 5}).save({version: 1, words: [1]});

    expect(result).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(await readdir(dir)).toEqual([]);
  });

  it('coalesces quick saves into one write of the latest snapshot', async () => {
    const fs: FileSystem = {...nodeFs, writeFile: vi.fn(nodeFs.writeFile)};
    const file = create(dir, {debounceMs: 20, fs});

    const results = await Promise.all([file.save(snapshot('A')), file.save(snapshot('B')), file.save(snapshot('C'))]);

    expect(results).toEqual([{status: 'saved'}, {status: 'saved'}, {status: 'saved'}]);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(await readSnapshot()).toEqual(snapshot('C'));
  });

  it('writes atomically through a temporary file', async () => {
    const fs: FileSystem = {...nodeFs, rename: vi.fn(nodeFs.rename)};

    await create(dir, {debounceMs: 5, fs}).save(snapshot('a', 'b'));

    expect(fs.rename).toHaveBeenCalledWith(join(dir, 'toys.json.tmp'), toysFile());
    expect(await readdir(dir)).toEqual(['toys.json']);
  });

  it('reports a failed write and keeps the previous snapshot', async () => {
    await writeFile(toysFile(), JSON.stringify(snapshot('old')));
    const fs: FileSystem = {...nodeFs, writeFile: vi.fn().mockRejectedValue(new Error('disk full'))};

    const result = await create(dir, {debounceMs: 5, fs}).save(snapshot('new'));

    expect(result).toEqual({status: 'failed', reason: expect.stringContaining('disk full')});
    expect(await readSnapshot()).toEqual(snapshot('old'));
  });
});

/** Bug #58: on Windows another process (poll, antivirus, indexer) can briefly hold the target open. */
describe('save when the final rename is blocked', () => {
  const retryDelayMs = 1;
  const failingRename = (code: string, failures: number): FileSystem => {
    let remaining = failures;
    return {
      ...nodeFs,
      rename: vi.fn((from: PathLike, to: PathLike) =>
        remaining-- > 0 ? Promise.reject(fsError(code)) : nodeFs.rename(from, to)),
    };
  };

  it.each(['EPERM', 'EBUSY', 'EACCES'])('retries after %s and then saves', async (code) => {
    const fs = failingRename(code, 2);

    const result = await create(dir, {debounceMs: 5, fs, renameRetryDelayMs: retryDelayMs}).save(snapshot('new'));

    expect(result).toEqual({status: 'saved'});
    expect(fs.rename).toHaveBeenCalledTimes(3);
    expect(await readSnapshot()).toEqual(snapshot('new'));
  });

  it('saves when the rename stays blocked for longer than ten fixed retry delays', async () => {
    const delayMs = 5;
    let firstAttemptAt: number | undefined;
    const fs: FileSystem = {
      ...nodeFs,
      rename: vi.fn((from: PathLike, to: PathLike) => {
        const started = (firstAttemptAt ??= Date.now());
        return Date.now() - started < 60 * delayMs ? Promise.reject(fsError('EPERM')) : nodeFs.rename(from, to);
      }),
    };

    const result = await create(dir, {debounceMs: 5, fs, renameRetryDelayMs: delayMs}).save(snapshot('new'));

    expect(result).toEqual({status: 'saved'});
    expect(await readSnapshot()).toEqual(snapshot('new'));
  });

  it('fails after a bounded number of attempts when the rename stays blocked', async () => {
    await writeFile(toysFile(), JSON.stringify(snapshot('old')));
    const fs = failingRename('EPERM', Number.POSITIVE_INFINITY);

    const result = await create(dir, {debounceMs: 5, fs, renameRetryDelayMs: retryDelayMs}).save(snapshot('new'));

    expect(result).toEqual({status: 'failed', reason: expect.stringContaining('EPERM')});
    const attempts = vi.mocked(fs.rename).mock.calls.length;
    expect(attempts).toBeGreaterThan(2);
    expect(attempts).toBeLessThanOrEqual(50);
    expect(await readSnapshot()).toEqual(snapshot('old'));
  });

  it('fails at once on another error code, without retry', async () => {
    const fs = failingRename('ENOSPC', 1);

    const result = await create(dir, {debounceMs: 5, fs, renameRetryDelayMs: retryDelayMs}).save(snapshot('new'));

    expect(result).toEqual({status: 'failed', reason: expect.stringContaining('ENOSPC')});
    expect(fs.rename).toHaveBeenCalledTimes(1);
  });
});

describe('flush', () => {
  it('writes a pending snapshot right away', async () => {
    const file = create(dir, {debounceMs: 60_000});
    const saved = file.save(snapshot('a', 'b'));

    await file.flush();

    expect(await readSnapshot()).toEqual(snapshot('a', 'b'));
    expect(await saved).toEqual({status: 'saved'});
  });

  it('keeps a snapshot pending when its write fails, so a later flush retries it (SC-007)', async () => {
    const writeFileOnce = vi.fn(nodeFs.writeFile).mockRejectedValueOnce(new Error('disk full'));
    const fs: FileSystem = {...nodeFs, writeFile: writeFileOnce};
    const file = create(dir, {debounceMs: 60_000, fs});
    const saved = file.save(snapshot('a', 'b'));

    await file.flush();
    expect(await saved).toEqual({status: 'failed', reason: expect.stringContaining('disk full')});

    await file.flush();
    expect(await readSnapshot()).toEqual(snapshot('a', 'b'));
  });

  it('does nothing without pending snapshots', async () => {
    await create(dir).flush();
    expect(await readdir(dir)).toEqual([]);
  });
});
