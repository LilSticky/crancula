import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join} from 'node:path';
import {expect, type Page, test} from '@playwright/test';
import {encodeSmf, type SmfTimedEvent} from '../api/song/midi/smf-test-helper';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {type MidiFilePayload} from './support/midi-file';
import {saveOrgan} from './support/organ-editor';
import {stubSaveDialog, type SaveDialogStub} from './support/save-dialog';
import {createTapeFromSong, songRepeatingC4} from './support/tape-creation';

const TICKS_PER_QUARTER = 480;

/** The Tape width of the Organ "Street organ" (Organ A), in mm. */
const REFERENCE_TAPE_WIDTH = '100';
/** The Lead-in of Organ A, in mm; the Lead-in tip of the reference Tape is at this x in the file. */
const REFERENCE_LEAD_IN = '50';
/** The Tape width of the Organ "Fairground organ" (Organ B), in mm. */
const WALTZ_TAPE_WIDTH = '60';
/** The Lead-in of Organ B, in mm. */
const WALTZ_LEAD_IN = '20';
/** The Tape spacing of a new roll Plotter, in mm. */
const TAPE_SPACING = 3;
/** The working width of the roll Plotter "Vinyl cutter", in mm. */
const WORKING_WIDTH = '300';

/** The width of the two Lanes together: 100 mm, the Tape spacing, then 60 mm. */
const USED_WIDTH = 100 + TAPE_SPACING + 60;

/** The Column length of the reference Tape: 200 Columns of 3 mm, so 600 mm between the Lead-in and the end gap. */
const COLUMN_LENGTH = '3';

/** Defines Organ A "Street organ": tape width 100 mm, 10 Pipes from C4 (MIDI 60 to 69), Lead-in 50 mm. */
async function defineStreetOrgan(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();
  await window.getByTestId('name').fill('Street organ');
  await window.getByTestId('tape-width').fill(REFERENCE_TAPE_WIDTH);
  await window.getByTestId('hole-diameter').fill('3');
  await window.getByTestId('row-spacing').fill('4');
  await window.getByTestId('minimum-gap').fill('2');
  await window.getByTestId('lead-in').fill(REFERENCE_LEAD_IN);
  for (let row = 0; row < 10; row++) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(String(60 + row));
  }
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

/** Defines Organ B "Fairground organ": tape width 60 mm, 5 Pipes from C4 (MIDI 60 to 64), Lead-in 20 mm. */
async function defineFairgroundOrgan(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();
  await window.getByTestId('name').fill('Fairground organ');
  await window.getByTestId('tape-width').fill(WALTZ_TAPE_WIDTH);
  await window.getByTestId('hole-diameter').fill('2.5');
  await window.getByTestId('row-spacing').fill('3.5');
  await window.getByTestId('minimum-gap').fill('1.5');
  await window.getByTestId('lead-in').fill(WALTZ_LEAD_IN);
  for (let row = 0; row < 5; row++) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(String(60 + row));
  }
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

/** Describes the roll Plotter "Vinyl cutter": a roll of 300 mm working width, Tape spacing left at its default. */
async function describeVinylCutter(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Plotters'}).click();
  await window.getByTestId('new-plotter').click();
  await window.getByTestId('plotter-name').fill('Vinyl cutter');
  await window.getByTestId('plotter-roll').getByRole('switch').click();
  await window.getByTestId('plotter-working-width').fill(WORKING_WIDTH);
  await window.getByTestId('save-plotter').click();
  await expect(window).toHaveURL(/#?\/plotters$/);
}

/** A Song with one note per entry, each given by its MIDI note, its start and its length in ticks. */
function notesSong(
  fileName: string,
  notes: readonly {readonly note: number; readonly start: number; readonly ticks: number}[],
): MidiFilePayload {
  const events: SmfTimedEvent[] = [{delta: 0, event: {type: 'trackName', text: 'Notes'}}];
  let previousEnd = 0;
  for (const {note, start, ticks} of notes) {
    events.push(
      {delta: start - previousEnd, event: {type: 'noteOn', channel: 0, note, velocity: 80}},
      {delta: ticks, event: {type: 'noteOff', channel: 0, note, velocity: 0}},
    );
    previousEnd = start + ticks;
  }
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: TICKS_PER_QUARTER},
    tracks: [{events}],
  });
  return {name: fileName, mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

/**
 * A Song of C4 held for 12.5 quarters from the start and a quarter of C4 at quarter 24: at 8 Columns per
 * quarter, a Tape of 200 Columns, which is 652 mm with the Lead-in of Organ A and a Column length of 3 mm.
 */
function referenceSong(): MidiFilePayload {
  return notesSong('reference.mid', [
    {note: 60, start: 0, ticks: 12.5 * TICKS_PER_QUARTER},
    {note: 60, start: 24 * TICKS_PER_QUARTER, ticks: TICKS_PER_QUARTER},
  ]);
}

/** Ticks the Tape named `name` in the Tape list, for a side-by-side cut. */
async function tickTape(window: Page, name: string): Promise<void> {
  await window.getByTestId('tape').filter({hasText: name}).getByTestId('tick-tape').click();
}

test.describe('Cut several Tapes side by side on the picked roll Plotter', () => {
  test.describe.configure({mode: 'serial'});
  let launched: LaunchedApp;
  let saves: SaveDialogStub;
  let folder: string;

  test.beforeAll(async () => {
    launched = await launchApp();
    saves = await stubSaveDialog(launched.app);
    folder = await mkdtemp(join(tmpdir(), 'crancula-side-by-side-'));
    await defineStreetOrgan(launched.window);
    await defineFairgroundOrgan(launched.window);
    await createTapeFromSong(launched.window, 'Reference', referenceSong(), {
      columnLength: COLUMN_LENGTH,
      organName: 'Street organ',
    });
    await createTapeFromSong(launched.window, 'Waltz', songRepeatingC4('waltz.mid', 3), {
      organName: 'Fairground organ',
    });
    await describeVinylCutter(launched.window);
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('lists the ticked Tapes as Lanes in the order I ticked them, on the Vinyl cutter', async () => {
    const {window} = launched;
    await window.getByRole('link', {name: 'Tapes', exact: true}).click();
    await tickTape(window, 'Reference');
    await tickTape(window, 'Waltz');

    await window.getByTestId('cut-side-by-side').click();

    await expect(window).toHaveURL(/\/tapes\/side-by-side\?/);
    await expect(window.getByTestId('side-by-side-plotter')).toContainText('Vinyl cutter');
    const lanes = window.getByTestId('lane');
    await expect(lanes).toHaveCount(2);
    await expect(lanes.nth(0)).toHaveAttribute('data-lane', '1');
    await expect(lanes.nth(0).getByTestId('lane-tape')).toHaveText('Reference');
    await expect(lanes.nth(1)).toHaveAttribute('data-lane', '2');
    await expect(lanes.nth(1).getByTestId('lane-tape')).toHaveText('Waltz');
  });

  test('saves both Tapes as one SVG, one Lane under the other, and names the file after the first Tape', async () => {
    const {window} = launched;
    const target = join(folder, 'Reference and 1 more.svg');
    await saves.answerWith(target);

    await window.getByTestId('save-side-by-side').click();

    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: target})).toBeVisible();
    const [call] = (await saves.calls()).slice(-1);
    expect(basename(call?.defaultPath ?? '')).toBe('Reference and 1 more.svg');
    const svg = await readFile(target, 'utf8');
    expect(svg).toContain(`width="652mm" height="${USED_WIDTH}mm" viewBox="0 0 652 ${USED_WIDTH}"`);
    const outlines = (svg.match(/<path d="[^"]*"/g) ?? []).filter((path) => !path.includes('A'));
    expect(outlines).toHaveLength(2);
    expect(outlines[0]).toBe(`<path d="M0,0 H652 V${REFERENCE_TAPE_WIDTH} H${REFERENCE_LEAD_IN} Z"`);
    expect(outlines[1]).toMatch(
      new RegExp(`^<path d="M0,${100 + TAPE_SPACING} H[\\d.]+ V${USED_WIDTH} H${WALTZ_LEAD_IN} Z"$`),
    );
  });
});
