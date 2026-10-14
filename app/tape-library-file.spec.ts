import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import * as nodeFs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TapeLibrarySnapshot} from '../api';
import type {FileSystem} from './snapshot-file';
import {createTapeLibraryFile} from './tape-library-file';

const SONG = '3f2b8c1e-9d4a-4f6b-8e2c-1a2b3c4d5e6f';
const TAPE = '11111111-2222-4333-8444-555555555555';
const ORGAN = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

function snapshot(name: string): TapeLibrarySnapshot {
  return {
    version: 1,
    songs: [{id: SONG, name: 'Fur Elise', ticksPerQuarter: 480, parts: [{percussion: false, notes: [[64, 0, 240]]}]}],
    tapes: [
      {
        id: TAPE,
        name,
        organId: ORGAN,
        songId: SONG,
        selectedParts: [0],
        transposition: 0,
        columnLength: 2.5,
        length: 10,
        holes: [[64, 0, 2]],
      },
    ],
  };
}

const INVALID = {version: 1, songs: [], tapes: [{id: TAPE}]};

let dir: string;
const tapesFile = () => join(dir, 'tapes.json');
const readSnapshot = async () => JSON.parse(await readFile(tapesFile(), 'utf8')) as unknown;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'crancula-tapes-'));
});

afterEach(async () => {
  await rm(dir, {recursive: true, force: true});
});

describe('load', () => {
  it('is empty when there is no snapshot yet', async () => {
    expect(await createTapeLibraryFile(dir).load()).toEqual({status: 'empty'});
  });

  it('reads a valid snapshot', async () => {
    await writeFile(tapesFile(), JSON.stringify(snapshot('Street organ')));
    expect(await createTapeLibraryFile(dir).load()).toEqual({status: 'loaded', snapshot: snapshot('Street organ')});
  });

  it.each([
    ['broken JSON', '{oops'],
    ['an unknown version', JSON.stringify({version: 2, songs: [], tapes: []})],
    ['an invalid Tape', JSON.stringify(INVALID)],
  ])('moves a snapshot with %s aside untouched', async (_, content) => {
    await writeFile(tapesFile(), content);
    const now = () => new Date('2026-10-14T12:34:56.789Z');

    const result = await createTapeLibraryFile(dir, {now}).load();

    const backupPath = join(dir, 'tapes.unreadable-2026-10-14T12-34-56-789Z.json');
    expect(result).toEqual({status: 'unreadable', backupPath, reason: expect.any(String)});
    expect(await readFile(backupPath, 'utf8')).toBe(content);
    expect(await readdir(dir)).toEqual(['tapes.unreadable-2026-10-14T12-34-56-789Z.json']);
  });
});

describe('save', () => {
  it('writes a snapshot that load reads back', async () => {
    const file = createTapeLibraryFile(dir, {debounceMs: 5});

    expect(await file.save(snapshot('Street organ'))).toEqual({status: 'saved'});

    expect(await readSnapshot()).toEqual(snapshot('Street organ'));
    expect(await createTapeLibraryFile(dir).load()).toEqual({status: 'loaded', snapshot: snapshot('Street organ')});
  });

  it('rejects an invalid payload without writing', async () => {
    const result = await createTapeLibraryFile(dir, {debounceMs: 5}).save(INVALID);

    expect(result).toEqual({status: 'rejected', reason: expect.any(String)});
    expect(await readdir(dir)).toEqual([]);
  });

  it('reports a failed write and keeps the previous snapshot', async () => {
    await writeFile(tapesFile(), JSON.stringify(snapshot('Old')));
    const fs: FileSystem = {...nodeFs, writeFile: vi.fn().mockRejectedValue(new Error('disk full'))};

    const result = await createTapeLibraryFile(dir, {debounceMs: 5, fs}).save(snapshot('New'));

    expect(result).toEqual({status: 'failed', reason: expect.stringContaining('disk full')});
    expect(await readSnapshot()).toEqual(snapshot('Old'));
  });
});

describe('next to the Organ library', () => {
  it('never touches organs.json', async () => {
    await writeFile(join(dir, 'organs.json'), 'organ bytes');
    await writeFile(tapesFile(), '{oops');

    await createTapeLibraryFile(dir, {debounceMs: 5}).load();
    await createTapeLibraryFile(dir, {debounceMs: 5}).save(snapshot('Street organ'));

    expect(await readFile(join(dir, 'organs.json'), 'utf8')).toBe('organ bytes');
  });
});
