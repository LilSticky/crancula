import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {drawnHoles, openOnlyTape, type DrawnHole} from './support/tape-edit';
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
