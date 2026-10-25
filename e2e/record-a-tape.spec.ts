import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {defineStreetOrgan, saveOrgan} from './support/organ-editor';
import {createTapeFromSong, songRepeatingC4} from './support/tape-creation';
import {stubSaveDialog, type SaveDialogStub} from './support/save-dialog';

/** Bytes per second of 16 bit mono at 44.1 kHz, the WAV the Recording is. */
const WAV_BYTES_PER_SECOND = 44100 * 2;
/** The release the Preview voices add after the last Column, in seconds. */
const RELEASE_SECONDS = 0.03;
/** Allowed relative error of the WAV length. */
const LENGTH_TOLERANCE = 0.01;

interface StoredTape {
  readonly length: number;
  readonly columnLength: number;
  readonly crankSpeed: number;
}

interface StoredOrgan {
  readonly tapePerCrankTurn?: number;
}

interface Chunk {
  /** Where the chunk's data starts. */
  readonly offset: number;
  readonly size: number;
}

/** The RIFF chunk `id` of a WAV file; fails the test when the file has none. */
function chunkOf(bytes: Buffer, id: string): Chunk {
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const size = bytes.readUInt32LE(offset + 4);
    if (bytes.toString('ascii', offset, offset + 4) === id) return {offset: offset + 8, size};
    offset += 8 + size + (size % 2);
  }
  throw new Error(`the WAV has no ${id} chunk`);
}

async function readSnapshot<T>(userDataDir: string, file: 'tapes.json' | 'organs.json'): Promise<T> {
  return JSON.parse(await readFile(join(userDataDir, 'snapshots', file), 'utf8')) as T;
}

/** The one Tape and Organ of the run, as stored. */
async function storedTapeAndOrgan(userDataDir: string): Promise<{tape: StoredTape; organ: StoredOrgan}> {
  const tapes = await readSnapshot<{tapes: readonly StoredTape[]}>(userDataDir, 'tapes.json');
  const organs = await readSnapshot<{organs: readonly StoredOrgan[]}>(userDataDir, 'organs.json');
  const tape = tapes.tapes[0];
  const organ = organs.organs[0];
  if (!tape || !organ) throw new Error('expected one stored Tape and one stored Organ');
  return {tape, organ};
}

/** The seconds a Recording of the Tape lasts: its Columns at the Column time, plus the release. */
function expectedSeconds({tape, organ}: {tape: StoredTape; organ: StoredOrgan}): number {
  if (organ.tapePerCrankTurn === undefined) throw new Error('the Organ has no Tape per Crank turn');
  const secondsPerTurn = 60 / tape.crankSpeed;
  const columnSeconds = (tape.columnLength / organ.tapePerCrankTurn) * secondsPerTurn;
  return tape.length * columnSeconds + RELEASE_SECONDS;
}

/** The English text of `TAPE.RECORD.<key>`. */
async function englishText(key: string): Promise<string> {
  const en = JSON.parse(await readFile(join(__dirname, '../src/assets/i18n/en.json'), 'utf8')) as {
    TAPE: {RECORD?: Record<string, string>};
  };
  return en.TAPE.RECORD?.[key] ?? '';
}

/** Presses Record and answers the save dialog with `path`. */
async function recordTo(window: Page, dialog: SaveDialogStub, path: string): Promise<void> {
  await dialog.answerWith(path);
  await window.getByTestId('record').click();
  await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: path})).toBeVisible();
}

test.describe('Record a Tape to a file', () => {
  test.describe.configure({mode: 'serial'});
  let launched: LaunchedApp;
  let dialog: SaveDialogStub;
  let folder: string;

  test.beforeAll(async () => {
    launched = await launchApp();
    folder = await mkdtemp(join(tmpdir(), 'crancula-record-'));
    dialog = await stubSaveDialog(launched.app);
    await defineStreetOrgan(launched.window);
    await launched.window.getByTestId('tape-per-crank-turn').fill('120');
    await saveOrgan(launched.window);
    await createTapeFromSong(launched.window, 'Scale', songRepeatingC4('scale.mid', 4));
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('asks for a file with the WAV and MP3 filters, and writes the Tape as mono 44.1 kHz 16 bit WAV of its length with a sound', async () => {
    const target = join(folder, 'Scale.wav');

    await recordTo(launched.window, dialog, target);

    const [call] = await dialog.calls();
    expect(call?.title).toBe(await englishText('DIALOG_TITLE'));
    expect(basename(call?.defaultPath ?? '')).toBe('Scale.wav');
    expect(call?.filters?.map((filter) => filter.extensions)).toEqual([['wav'], ['mp3']]);

    const wav = await readFile(target);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    const format = chunkOf(wav, 'fmt ');
    expect(wav.readUInt16LE(format.offset)).toBe(1); // PCM
    expect(wav.readUInt16LE(format.offset + 2)).toBe(1); // mono
    expect(wav.readUInt32LE(format.offset + 4)).toBe(44100);
    expect(wav.readUInt16LE(format.offset + 14)).toBe(16);

    const data = chunkOf(wav, 'data');
    const seconds = data.size / WAV_BYTES_PER_SECOND;
    const expected = expectedSeconds(await storedTapeAndOrgan(launched.userDataDir));
    expect(Math.abs(seconds - expected) / expected).toBeLessThan(LENGTH_TOLERANCE);

    let peak = 0;
    for (let offset = data.offset; offset < data.offset + data.size; offset += 2) {
      peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)));
    }
    expect(peak).toBeGreaterThan(0.01 * 32767);
  });

  test('writes the Tape as an MP3 file that starts with a frame sync or an ID3 tag and is not empty', async () => {
    const target = join(folder, 'Scale.mp3');

    await recordTo(launched.window, dialog, target);

    const mp3 = await readFile(target);
    const startsWithId3 = mp3.toString('ascii', 0, 3) === 'ID3';
    const startsWithFrameSync = mp3[0] === 0xff && ((mp3[1] ?? 0) & 0xe0) === 0xe0;
    expect(startsWithId3 || startsWithFrameSync).toBe(true);
    expect(mp3.length).toBeGreaterThan(1000);
  });

  test('leaves the Tape file and the undo history unchanged by a Recording', async () => {
    const undo = launched.window.getByTestId('undo');
    await expect(undo).toBeDisabled();
    const tapesFile = join(launched.userDataDir, 'snapshots', 'tapes.json');
    const before = await readFile(tapesFile, 'utf8');

    await recordTo(launched.window, dialog, join(folder, 'Scale again.wav'));

    expect(await readFile(tapesFile, 'utf8')).toBe(before);
    await expect(undo).toBeDisabled();
  });
});
