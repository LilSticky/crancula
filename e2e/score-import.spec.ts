import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, test, type Page} from '@playwright/test';
import {strToU8, zipSync} from 'fflate';
import {
  scoreXml,
  type MeasureEntry,
  type NoteSpec,
  type PitchSpec,
  type ScoreSpec,
} from '../api/song/musicxml/score-test-helper';
import {launchApp} from './support/launch-app';
import {defineOctaveOrgan} from './support/tape-creation';

const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0"><rootfiles><rootfile full-path="piano.musicxml"/></rootfiles></container>`;

function quarter(step: PitchSpec['step'], octave: number, staff: number, voice: number): NoteSpec {
  return {kind: 'note', pitch: {step, octave}, duration: 1, staff, voice};
}

/**
 * A piano with a treble and a bass staff: one Part of the Score with two staves, so two Parts on the
 * Tape, "Piano 1" and "Piano 2". Both staves play four quarters, all within the Pipes C4 to C6.
 */
const PIANO: ScoreSpec = {
  workTitle: 'Piano pieces',
  parts: [
    {
      name: 'Piano',
      staves: 2,
      measures: [
        {
          entries: [
            {kind: 'attributes', divisions: 1, time: {beats: 4, beatType: 4}, clef: {sign: 'G', line: 2, staff: 1}},
            quarter('C', 5, 1, 1),
            quarter('D', 5, 1, 1),
            quarter('E', 5, 1, 1),
            quarter('F', 5, 1, 1),
            {kind: 'backup', duration: 4},
            quarter('C', 4, 2, 2),
            quarter('D', 4, 2, 2),
            quarter('E', 4, 2, 2),
            quarter('F', 4, 2, 2),
          ] satisfies MeasureEntry[],
        },
      ],
    },
  ],
};

async function importScore(window: Page, path: string, tapeName: string): Promise<void> {
  await window.getByTestId('rail-nav').getByRole('link', {name: 'Tapes'}).click();
  await window.getByTestId('new-tape').click();
  await window.getByTestId('song-file').setInputFiles(path);
  await expect(window.getByTestId('part')).toHaveCount(2);
  await expect(window.getByTestId('part').nth(0).getByTestId('part-name')).toHaveText('Piano 1');
  await expect(window.getByTestId('part').nth(1).getByTestId('part-name')).toHaveText('Piano 2');
  await expect(window.getByTestId('part').nth(0).getByTestId('part-note-count')).toHaveText('4');
  await expect(window.getByTestId('part').nth(1).getByTestId('part-note-count')).toHaveText('4');
  await expect(window.getByTestId('part').nth(0).getByRole('checkbox')).toBeChecked();
  await expect(window.getByTestId('part').nth(1).getByRole('checkbox')).toBeChecked();
  await window.getByTestId('name').fill(tapeName);
  await window.getByTestId('create-tape').click();
  await expect(window).toHaveURL(/#?\/tapes\/[0-9a-f-]{36}$/);
  await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText(tapeName);
}

/** Opens the Tape from the Tapes list and reads its Holes per row and start Column. */
async function holesOfTape(window: Page, tapeName: string): Promise<{row: number; start: number}[]> {
  await window.getByTestId('rail-nav').getByRole('link', {name: 'Tapes'}).click();
  await window.getByTestId('tape').filter({hasText: tapeName}).getByTestId('open-tape').click();
  await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText(tapeName);
  const holes = window.getByTestId('tape-scroll').getByTestId('hole');
  // Eight Holes: four Notes of each staff, no two on the same Pipe at the same time.
  await expect(holes).toHaveCount(8);
  return holes.evaluateAll((rects) =>
    rects.map((rect) => ({row: Number(rect.getAttribute('data-row')), start: Number(rect.getAttribute('data-start'))})),
  );
}

test.describe('A Score brought onto a Tape is still there after a restart', () => {
  test('keeps both Tapes, from .musicxml and from .mxl, with their Holes unchanged', async () => {
    test.setTimeout(120_000);
    const folder = await mkdtemp(join(tmpdir(), 'crancula-score-'));
    const musicXmlPath = join(folder, 'piano.musicxml');
    const mxlPath = join(folder, 'piano.mxl');
    const xml = scoreXml(PIANO);
    await writeFile(musicXmlPath, xml);
    await writeFile(
      mxlPath,
      Buffer.from(zipSync({'META-INF/container.xml': strToU8(CONTAINER), 'piano.musicxml': strToU8(xml)})),
    );

    const first = await launchApp();
    await defineOctaveOrgan(first.window, 'Octave organ');
    await importScore(first.window, musicXmlPath, 'Piano from score');
    await importScore(first.window, mxlPath, 'Piano from archive');
    const holesBefore = {
      score: await holesOfTape(first.window, 'Piano from score'),
      archive: await holesOfTape(first.window, 'Piano from archive'),
    };
    await first.app.close();
    const stored = await readFile(join(first.userDataDir, 'snapshots', 'tapes.json'), 'utf8');

    const second = await launchApp(first.userDataDir);
    await second.window.getByTestId('rail-nav').getByRole('link', {name: 'Tapes'}).click();
    await expect(second.window.getByTestId('tape')).toHaveCount(2);
    expect(await holesOfTape(second.window, 'Piano from score')).toEqual(holesBefore.score);
    expect(await holesOfTape(second.window, 'Piano from archive')).toEqual(holesBefore.archive);
    await second.app.close();

    expect(await readFile(join(first.userDataDir, 'snapshots', 'tapes.json'), 'utf8')).toBe(stored);
    await rm(folder, {recursive: true, force: true});
  });
});
