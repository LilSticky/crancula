import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {
  columnWidth,
  dragHandle,
  dragHole,
  drawnHoles,
  holeAt,
  openOnlyTape,
  pressOnDrawing,
  type DrawnHole,
} from './support/tape-edit';
import {createTapeFromSong, defineOctaveOrgan, songRepeatingC4} from './support/tape-creation';

const byPlace = (a: DrawnHole, b: DrawnHole): number => a.row - b.row || a.start - b.start;

interface StoredTapes {
  readonly version: number;
  readonly tapes: readonly {readonly holes: readonly unknown[]}[];
}

test.describe('Editing a Tape by hand', () => {
  test('moves, shortens and removes Holes, refuses an overlap, and keeps the edits after a restart', async () => {
    const first = await launchApp();
    const {window} = first;
    await defineOctaveOrgan(window, 'Octave organ');
    await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4));
    const original = [...(await drawnHoles(window))].sort(byPlace);
    const c4Row = original.filter((hole) => original.filter((other) => other.row === hole.row).length === 4);
    const [firstC4, secondC4, thirdC4, lastC4] = c4Row;
    const d4 = original.find((hole) => original.filter((other) => other.row === hole.row).length === 1);
    if (!firstC4 || !secondC4 || !thirdC4 || !lastC4 || !d4) throw new Error('expected four C4 Holes and one D4 Hole');

    // Drag a Hole body 2 Columns later.
    await dragHole(window, holeAt(window, lastC4.row, lastC4.start), 2);
    await expect(holeAt(window, lastC4.row, lastC4.start + 2)).toHaveCount(1);
    await expect(holeAt(window, lastC4.row, lastC4.start)).toHaveCount(0);

    // Drag the start handle of another Hole 1 Column later.
    await dragHandle(window, holeAt(window, d4.row, d4.start), 'start', 1);
    await expect(holeAt(window, d4.row, d4.start + 1)).toHaveCount(1);
    const shortened = await holeAt(window, d4.row, d4.start + 1).getAttribute('width');
    expect(Number(shortened)).toBeCloseTo(d4.width - (await columnWidth(window)), 0);

    // A drag onto the next Hole of its Pipe is refused, with the reason in a snackbar.
    const before = [...(await drawnHoles(window))].sort(byPlace);
    await dragHole(window, holeAt(window, secondC4.row, secondC4.start), thirdC4.start - secondC4.start);
    await expect(window.locator('.mat-mdc-snack-bar-container').filter({hasText: /The Hole would overlap the Hole of [A-G]#?\d at Column \d+\./})).toBeVisible();
    expect([...(await drawnHoles(window))].sort(byPlace)).toEqual(before);

    // Remove a third Hole with Delete.
    await holeAt(window, firstC4.row, firstC4.start).click();
    await pressOnDrawing(window, 'Delete');
    await expect(holeAt(window, firstC4.row, firstC4.start)).toHaveCount(0);
    const edited = [...(await drawnHoles(window))].sort(byPlace);
    expect(edited).toHaveLength(original.length - 1);

    await first.app.close();

    const stored = JSON.parse(await readFile(join(first.userDataDir, 'snapshots', 'tapes.json'), 'utf8')) as StoredTapes;
    expect(stored.version).toBe(1);
    const holes = stored.tapes[0]?.holes ?? [];
    expect(holes).toHaveLength(original.length - 1);
    for (const hole of holes) {
      expect(Array.isArray(hole)).toBe(true);
      expect(hole).toHaveLength(3);
    }

    const second = await launchApp(first.userDataDir);
    await openOnlyTape(second.window);
    expect([...(await drawnHoles(second.window))].sort(byPlace)).toEqual(edited);
    await second.app.close();
  });
});
