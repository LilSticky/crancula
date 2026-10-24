import {expect, type Page, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {centreOf, columnWidth, drawnHoles, holeAt, openOnlyTape, type DrawnHole} from './support/tape-edit';
import {tapAt, touchDragBy, touchInput, type TouchPoint} from './support/touch';
import {createTapeFromSong, defineOctaveOrgan, songRepeatingC4} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';

const byPlace = (a: DrawnHole, b: DrawnHole): number => a.row - b.row || a.start - b.start;

/** The row of the G4 pipe: no Hole of `songRepeatingC4` is on it, so its Columns are empty. */
const G4_ROW = 7;

/**
 * The centre of a cell of the Tape drawing, from the box of the first Hole and the row pitch shown by a Hole
 * of another row. Holes are never outside the Tape's rows, so the cell is on the drawing.
 */
async function cellCentre(window: Page, row: number, column: number): Promise<TouchPoint> {
  const holes = [...(await drawnHoles(window))].sort(byPlace);
  const anchor = holes[0];
  const other = holes.find((hole) => hole.row !== anchor?.row);
  if (!anchor || !other) throw new Error('expected Holes in two rows');
  const anchorBox = await holeAt(window, anchor.row, anchor.start).boundingBox();
  const otherBox = await holeAt(window, other.row, other.start).boundingBox();
  if (!anchorBox || !otherBox) throw new Error('the Holes are not shown');
  const width = await columnWidth(window);
  const rowStep = (otherBox.y - anchorBox.y) / (other.row - anchor.row);
  return {
    x: anchorBox.x + (column - anchor.start + 0.5) * width,
    y: anchorBox.y + anchorBox.height / 2 + (row - anchor.row) * rowStep,
  };
}

test.describe('Editing a Tape by touch', () => {
  test('two taps on an empty Spot add a Hole of the Minimum Hole Length, and it survives a restart', async () => {
    const first = await launchApp();
    const {window} = first;
    await resizeWindowOrSkip(first, 1280, 800);
    await defineOctaveOrgan(window, 'Octave organ');
    // Columns of 1.25 mm: the Minimum Hole Length of 2.5 mm is 2 Columns.
    await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4), {columnLength: '1.25'});
    const original = [...(await drawnHoles(window))].sort(byPlace);
    const [firstHole] = original;
    if (!firstHole) throw new Error('expected Holes');
    const start = firstHole.start + 2;
    const touch = await touchInput(window);

    const spot = await cellCentre(window, G4_ROW, start);
    await tapAt(touch, spot);
    await expect(window.getByTestId('spot')).toHaveCount(1);
    await expect(holeAt(window, G4_ROW, start)).toHaveCount(0);
    await tapAt(touch, spot);

    await expect(holeAt(window, G4_ROW, start)).toHaveCount(1);
    const added = await holeAt(window, G4_ROW, start).getAttribute('width');
    expect(Number(added)).toBeCloseTo(2 * (await columnWidth(window)), 0);
    const edited = [...(await drawnHoles(window))].sort(byPlace);
    expect(edited).toHaveLength(original.length + 1);

    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await openOnlyTape(second.window);
    expect([...(await drawnHoles(second.window))].sort(byPlace)).toEqual(edited);
    await second.app.close();
  });

  test('a finger on the end grip of a selected Hole lengthens it by one Column', async () => {
    const launched = await launchApp();
    const {window} = launched;
    try {
      await resizeWindowOrSkip(launched, 1280, 800);
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4), {columnLength: '1.25'});
      // The first C4 Hole: its end grip is inside the drawing, unlike the grip of the last Hole at the edge of the Tape.
      const [first] = [...(await drawnHoles(window))].sort(byPlace);
      if (!first) throw new Error('expected Holes');
      const touch = await touchInput(window);
      const column = await columnWidth(window);

      await tapAt(touch, await centreOf(holeAt(window, first.row, first.start)));
      const end = window.locator('[data-testid="tape-scroll"] svg [data-testid="hole-handle"][data-end="end"]');
      await expect(end).toHaveCount(1);
      await touchDragBy(touch, await centreOf(end), column, 0);

      await expect.poll(async () => Number(await holeAt(window, first.row, first.start).getAttribute('width'))).toBeCloseTo(first.width + column, 0);
      await expect(holeAt(window, first.row, first.start)).toHaveCount(1);
    } finally {
      await launched.app.close();
    }
  });

  test('two taps on the same Hole within the double-tap time remove it', async () => {
    const launched = await launchApp();
    const {window} = launched;
    try {
      await resizeWindowOrSkip(launched, 1280, 800);
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4), {columnLength: '1.25'});
      const holes = [...(await drawnHoles(window))].sort(byPlace);
      const d4 = holes.find((hole) => holes.filter((other) => other.row === hole.row).length === 1);
      if (!d4) throw new Error('expected one D4 Hole');
      const touch = await touchInput(window);
      const target = await centreOf(holeAt(window, d4.row, d4.start));

      await tapAt(touch, target);
      await expect(holeAt(window, d4.row, d4.start)).toHaveClass(/selected/);
      await tapAt(touch, target);

      await expect(holeAt(window, d4.row, d4.start)).toHaveCount(0);
      expect(await drawnHoles(window)).toHaveLength(holes.length - 1);
    } finally {
      await launched.app.close();
    }
  });

  test('a finger drag on empty Tape scrolls the stage and neither frames nor selects', async () => {
    const launched = await launchApp();
    const {window} = launched;
    try {
      await resizeWindowOrSkip(launched, 1024, 768);
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Long scale', songRepeatingC4('long.mid', 40), {columnLength: '1.25'});
      const holes = [...(await drawnHoles(window))].sort(byPlace);
      // The gap between the first two C4 Holes is empty: a finger there is on empty Tape.
      const [first, second] = holes;
      if (!first || !second) throw new Error('expected Holes');
      const firstBox = await holeAt(window, first.row, first.start).boundingBox();
      const secondBox = await holeAt(window, second.row, second.start).boundingBox();
      if (!firstBox || !secondBox) throw new Error('the Holes are not shown');
      const from: TouchPoint = {
        x: (firstBox.x + firstBox.width + secondBox.x) / 2,
        y: firstBox.y + firstBox.height / 2,
      };
      const touch = await touchInput(window);
      const scroll = window.getByTestId('tape-scroll');

      await touchDragBy(touch, from, -300, 0);

      await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      await expect(window.getByTestId('spot')).toHaveCount(0);
      await expect(window.locator('[data-testid="tape-scroll"] svg .selection-frame')).toHaveCount(0);
      await expect(window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"].selected')).toHaveCount(0);
      // The drawing renders more Holes as the stage scrolls; every Hole drawn before must still be there, unchanged.
      expect([...(await drawnHoles(window))]).toEqual(expect.arrayContaining(holes));
    } finally {
      await launched.app.close();
    }
  });
});
