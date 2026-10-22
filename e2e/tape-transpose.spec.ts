import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test, type Locator, type Page} from '@playwright/test';
import {encodeSmf, type SmfTimedEvent} from '../api/song/midi/smf-test-helper';
import {launchApp} from './support/launch-app';
import {type MidiFilePayload} from './support/midi-file';
import {drawnHoles, holeAt, openOnlyTape, pressOnDrawing, type DrawnHole} from './support/tape-edit';
import {createTapeFromSong, defineOctaveOrgan, songRepeatingC4} from './support/tape-creation';

/** A stored Hole: its Pipe (MIDI note number), start Column and length in Columns. */
type StoredHole = readonly [pipe: number, start: number, length: number];

interface StoredTape {
  readonly name: string;
  readonly transposition: number;
  readonly holes: readonly StoredHole[];
}

interface StoredTapes {
  readonly tapes: readonly StoredTape[];
}

/** What the Tape keeps of itself in `tapes.json`, apart from its Holes: name, Transposition and Holes. */
interface TapeSummary {
  readonly name: string;
  readonly transposition: number;
  readonly holes: readonly StoredHole[];
}

const byStartThenPipe = (a: StoredHole, b: StoredHole): number => a[1] - b[1] || a[0] - b[0];
const byPlace = (a: DrawnHole, b: DrawnHole): number => a.row - b.row || a.start - b.start;
const byStart = (a: DrawnHole, b: DrawnHole): number => a.start - b.start;

const TICKS_PER_QUARTER = 480;
/** The modifier that adds to a selection: Ctrl, or Cmd on macOS. */
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

/** A Song of one Part that plays each of `notes` for a quarter, with a quarter of rest after it. */
function songOfNotes(fileName: string, notes: readonly number[]): MidiFilePayload {
  const events: SmfTimedEvent[] = [];
  for (const note of notes) {
    events.push(
      {delta: events.length === 0 ? 0 : TICKS_PER_QUARTER, event: {type: 'noteOn', channel: 0, note, velocity: 80}},
      {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel: 0, note, velocity: 0}},
    );
  }
  const bytes = encodeSmf({format: 1, division: {ticksPerQuarterNote: TICKS_PER_QUARTER}, tracks: [{events}]});
  return {name: fileName, mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

/** The Holes the drawing shows as selected, by row (from 0), start Column and width in px. */
async function selectedHoles(window: Page): Promise<readonly DrawnHole[]> {
  return window
    .locator('[data-testid="tape-scroll"] svg [data-testid="hole"].selected')
    .evaluateAll((rects) =>
      rects.map((rect) => ({
        row: Number(rect.getAttribute('data-row')),
        start: Number(rect.getAttribute('data-start')),
        width: Number(rect.getAttribute('width')),
      })),
    );
}

interface Point {
  readonly x: number;
  readonly y: number;
}

async function boxOf(locator: Locator): Promise<{readonly x: number; readonly y: number; readonly width: number; readonly height: number}> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('the element is not shown');
  return box;
}

/** Waits until the Tape drawing has stopped scrolling, as it does to show a new selection. */
async function untilStageSettles(window: Page): Promise<void> {
  const stage = window.getByTestId('tape-scroll');
  const scrollLeft = (): Promise<number> => stage.evaluate((element) => element.scrollLeft);
  let previous = await scrollLeft();
  await expect
    .poll(async () => {
      await window.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      const current = await scrollLeft();
      const settled = current === previous;
      previous = current;
      return settled;
    })
    .toBe(true);
}

/** Scrolls the Tape drawing so that the left edge of the Hole is 20 px inside the stage. */
async function showFromLeft(window: Page, hole: Locator): Promise<void> {
  const stage = window.getByTestId('tape-scroll');
  const holeBox = await boxOf(hole);
  const stageBox = await boxOf(stage);
  await stage.evaluate((element, offset) => {
    element.scrollLeft += offset;
  }, holeBox.x - stageBox.x - 20);
}

/** Presses Tab until the element has the focus. */
async function tabTo(window: Page, target: Locator): Promise<void> {
  for (let tabs = 0; tabs < 60; tabs++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await window.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

/** Transposes all Holes through the dialog by `semitones` and applies it. */
async function transposeAllBy(window: Page, semitones: string): Promise<void> {
  await window.getByTestId('transpose').click();
  await window.getByTestId('transpose-scope-all').click();
  await window.getByTestId('transpose-semitones').fill(semitones);
  await window.getByTestId('transpose-apply').click();
  await expect(window.getByTestId('transpose-dialog')).toHaveCount(0);
}

async function storedSummary(userDataDir: string): Promise<TapeSummary> {
  const stored = JSON.parse(await readFile(join(userDataDir, 'snapshots', 'tapes.json'), 'utf8')) as StoredTapes;
  const [tape] = stored.tapes;
  if (!tape) throw new Error('no Tape is stored');
  return {name: tape.name, transposition: tape.transposition, holes: [...tape.holes].sort(byStartThenPipe)};
}

test.describe('Transposing a Tape', () => {
  test('transposes all Holes by +2 semitones through the dialog, and keeps the Holes on their new Pipes and the Transposition after a restart', async () => {
    const first = await launchApp();
    const {window} = first;
    await defineOctaveOrgan(window, 'Octave organ');
    await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4));
    const before = await storedSummary(first.userDataDir);
    const drawnBefore = [...(await drawnHoles(window))].sort(byPlace);
    expect(before.holes).toHaveLength(5);

    // Transpose all Holes by +2 semitones through the dialog; the outcome is shown before anything changes.
    await window.getByTestId('transpose').click();
    await window.getByTestId('transpose-scope-all').click();
    await window.getByTestId('transpose-semitones').fill('2');
    await expect(window.getByTestId('outcome-moved')).toHaveText(`Moved: ${before.holes.length}`);
    await expect(window.getByTestId('outcome-merged')).toHaveText('Merged: 0');
    await expect(window.getByTestId('outcome-removed')).toHaveText('Removed: 0');
    await window.getByTestId('transpose-apply').click();
    await expect(window.getByTestId('transpose-dialog')).toHaveCount(0);

    // Every Hole moved two semitones up on the same Columns; the name and the Transposition stay.
    const expected: TapeSummary = {
      name: before.name,
      transposition: before.transposition,
      holes: before.holes.map(([pipe, start, length]) => [pipe + 2, start, length] as const).sort(byStartThenPipe),
    };
    await expect.poll(() => storedSummary(first.userDataDir)).toEqual(expected);
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await openOnlyTape(second.window);
    await expect(second.window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText('Scale');
    const drawnAfter = [...(await drawnHoles(second.window))].sort(byPlace);
    // The Pipes are one row apart per semitone of the Organ, so every Hole moved the same number of rows.
    const offset = (drawnAfter[0]?.row ?? 0) - (drawnBefore[0]?.row ?? 0);
    expect(Math.abs(offset)).toBe(2);
    expect(drawnAfter).toEqual(drawnBefore.map((hole) => ({...hole, row: hole.row + offset})));
    await second.app.close();

    expect(await storedSummary(second.userDataDir)).toEqual(expected);
  });
});

test.describe('Selecting Holes and transposing the selection', () => {
  // Five C5 Holes (72) and one D5 Hole (74) a quarter apart: the Holes of the C5 row share one row.
  const notes = [72, 72, 72, 72, 72, 74];

  test('transposes only the selected Holes by -12: three Ctrl-clicked, two framed, and they are selected after', async () => {
    const {app, window, userDataDir} = await launchApp();
    await defineOctaveOrgan(window, 'Octave organ');
    await createTapeFromSong(window, 'Scale', songOfNotes('c5s.mid', notes));
    const before = await storedSummary(userDataDir);
    const drawn = [...(await drawnHoles(window))].sort(byStart);
    // The C5 Holes are the first five by start; they share one row, the D5 Hole is on another.
    const c5 = drawn.slice(0, 5);
    const c5Row = Math.min(...c5.map((hole) => hole.row));
    expect(c5.every((hole) => hole.row === c5Row)).toBe(true);
    expect(before.holes.filter(([pipe]) => pipe === 72)).toHaveLength(5);
    const c5Hole = (index: number): DrawnHole => {
      const hole = c5[index];
      if (!hole) throw new Error(`no C5 Hole ${index}`);
      return hole;
    };

    // Ctrl-click three C5 Holes.
    for (const hole of c5.slice(0, 3)) await holeAt(window, hole.row, hole.start).click({modifiers: [modifier]});
    await expect(window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"].selected')).toHaveCount(3);
    await untilStageSettles(window);

    // Drag a frame with Ctrl held over the fourth and fifth C5 Holes, from the gap before the fourth.
    // The stage is narrower than the five Holes: scroll it so that the third Hole starts at its left edge.
    await showFromLeft(window, holeAt(window, c5Hole(2).row, c5Hole(2).start));
    const third = await boxOf(holeAt(window, c5Hole(2).row, c5Hole(2).start));
    const fourth = await boxOf(holeAt(window, c5Hole(3).row, c5Hole(3).start));
    const fifth = await boxOf(holeAt(window, c5Hole(4).row, c5Hole(4).start));
    const rowCentre = fourth.y + fourth.height / 2;
    const from: Point = {x: (third.x + third.width + fourth.x) / 2, y: rowCentre - 4};
    // The end stays inside the drawing: the stage ends before the last Hole's right edge.
    const to: Point = {x: fifth.x + fifth.width / 2, y: rowCentre + 4};
    await window.keyboard.down(modifier);
    await window.mouse.move(from.x, from.y);
    await window.mouse.down();
    await window.mouse.move(to.x, to.y, {steps: 8});
    await window.mouse.up();
    await window.keyboard.up(modifier);
    await expect(window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"].selected')).toHaveCount(5);

    // Transpose the selection by -12 through the dialog; the D5 Hole is not selected and stays.
    await window.getByTestId('transpose').click();
    await window.getByTestId('transpose-semitones').fill('-12');
    await expect(window.getByTestId('outcome-moved')).toHaveText('Moved: 5');
    await window.getByTestId('transpose-apply').click();
    await expect(window.getByTestId('transpose-dialog')).toHaveCount(0);

    const expected: TapeSummary = {
      name: before.name,
      transposition: before.transposition,
      holes: before.holes.map(([pipe, start, length]) => [pipe === 72 ? 60 : pipe, start, length] as const).sort(byStartThenPipe),
    };
    await expect.poll(() => storedSummary(userDataDir)).toEqual(expected);

    // Exactly the five moved Holes are selected, one octave lower.
    const moved = await selectedHoles(window);
    expect(moved.map((hole) => hole.start).sort((a, b) => a - b)).toEqual(c5.map((hole) => hole.start));
    expect(new Set(moved.map((hole) => hole.row)).size).toBe(1);
    expect(Math.abs((moved[0]?.row ?? c5Row) - c5Row)).toBe(12);
    await app.close();
  });

  test('undoes the transposition with one Ctrl+Z and gives back the stored Tape from before', async () => {
    const {app, window, userDataDir} = await launchApp();
    await defineOctaveOrgan(window, 'Octave organ');
    await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4));
    const before = await storedSummary(userDataDir);
    const drawnBefore = [...(await drawnHoles(window))].sort(byPlace);

    await transposeAllBy(window, '2');
    await expect.poll(() => storedSummary(userDataDir)).not.toEqual(before);

    await pressOnDrawing(window, 'ControlOrMeta+Z');
    await expect.poll(() => storedSummary(userDataDir)).toEqual(before);
    expect([...(await drawnHoles(window))].sort(byPlace)).toEqual(drawnBefore);
    await app.close();
  });

  test.describe('from the keyboard alone', () => {
    /** Selects the first Hole with Enter on the focused drawing, then extends the selection to the right with Ctrl+Arrow. */
    async function selectTwoWithKeyboard(window: Page): Promise<void> {
      await window.locator('body').focus();
      await tabTo(window, window.locator('[data-testid="tape-scroll"] svg'));
      await window.keyboard.press('Enter');
      await expect(window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"].selected')).toHaveCount(1);
      await window.keyboard.press('ControlOrMeta+ArrowRight');
      await expect(window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"].selected')).toHaveCount(2);
    }

    test('extends the selection with Ctrl+Arrow, types the semitones in the dialog and applies with Enter', async () => {
      const {app, window, userDataDir} = await launchApp();
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Scale', songOfNotes('c5s.mid', notes));
      const before = await storedSummary(userDataDir);

      await selectTwoWithKeyboard(window);
      const moving = (await selectedHoles(window)).map((hole) => hole.start);
      await tabTo(window, window.getByTestId('transpose'));
      await window.keyboard.press('Enter');
      await expect(window.getByTestId('transpose-dialog')).toBeVisible();
      await tabTo(window, window.getByTestId('transpose-semitones'));
      await window.keyboard.press('ControlOrMeta+A');
      await window.keyboard.type('-12');
      await window.keyboard.press('Enter');
      await expect(window.getByTestId('transpose-dialog')).toHaveCount(0);

      const expected: TapeSummary = {
        name: before.name,
        transposition: before.transposition,
        holes: before.holes.map(([pipe, start, length]) => [moving.includes(start) ? pipe - 12 : pipe, start, length] as const).sort(byStartThenPipe),
      };
      await expect.poll(() => storedSummary(userDataDir)).toEqual(expected);
      await app.close();
    });

    test('Escape closes the dialog and changes nothing', async () => {
      const {app, window, userDataDir} = await launchApp();
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Scale', songOfNotes('c5s.mid', notes));
      const before = await storedSummary(userDataDir);

      await selectTwoWithKeyboard(window);
      await tabTo(window, window.getByTestId('transpose'));
      await window.keyboard.press('Enter');
      await tabTo(window, window.getByTestId('transpose-semitones'));
      await window.keyboard.press('ControlOrMeta+A');
      await window.keyboard.type('-12');
      await window.keyboard.press('Escape');
      await expect(window.getByTestId('transpose-dialog')).toHaveCount(0);

      expect(await storedSummary(userDataDir)).toEqual(before);
      await app.close();
    });
  });
});
