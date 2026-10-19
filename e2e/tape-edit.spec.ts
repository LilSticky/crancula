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
import {stubSaveDialog} from './support/save-dialog';
import {resizeWindowOrSkip} from './support/window-size';
import {createTapeFromSong,defineOctaveOrgan, songRepeatingC4} from './support/tape-creation';

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

  test('adds a Hole by double-click and through the form, selects it, and keeps both after a restart', async () => {
    const first = await launchApp();
    const {window} = first;
    await resizeWindowOrSkip(first, 1280, 800);
    await defineOctaveOrgan(window, 'Octave organ');
    await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4));
    const original = [...(await drawnHoles(window))].sort(byPlace);
    const c4Row = original.filter((hole) => original.filter((other) => other.row === hole.row).length === 4);
    const d4 = original.find((hole) => original.filter((other) => other.row === hole.row).length === 1);
    const [firstC4] = c4Row;
    if (!firstC4 || !d4) throw new Error('expected four C4 Holes and one D4 Hole');
    const E4_ROW = 4;
    const G4_ROW = 7;

    // Double-click an empty spot of the E4 row, above the first C4 Hole's Column.
    const c4Box = await holeAt(window, firstC4.row, firstC4.start).boundingBox();
    const d4Box = await holeAt(window, d4.row, d4.start).boundingBox();
    if (!c4Box || !d4Box) throw new Error('the Holes are not shown');
    const rowStep = (d4Box.y - c4Box.y) / (d4.row - firstC4.row);
    await window.mouse.dblclick(c4Box.x + (await columnWidth(window)) / 2, c4Box.y + c4Box.height / 2 + rowStep * (E4_ROW - firstC4.row));
    await expect(holeAt(window, E4_ROW, firstC4.start)).toHaveCount(1);
    await expect(holeAt(window, E4_ROW, firstC4.start)).toHaveClass(/selected/);
    await expect(window.getByTestId('selected-hole')).toContainText('E4');

    // Add a G4 Hole at Column 12 through the form.
    await window.getByTestId('add-hole-pipe').click();
    await window.getByRole('option', {name: 'G4'}).click();
    await window.getByTestId('add-hole-column').fill('12');
    await window.getByTestId('add-hole-submit').click();
    await expect(holeAt(window, G4_ROW, 11)).toHaveCount(1);
    await expect(holeAt(window, G4_ROW, 11)).toHaveClass(/selected/);

    const edited = [...(await drawnHoles(window))].sort(byPlace);
    expect(edited).toHaveLength(original.length + 2);

    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await openOnlyTape(second.window);
    expect([...(await drawnHoles(second.window))].sort(byPlace)).toEqual(edited);
    await second.app.close();
  });

  test('marks a Hole shortened below the Minimum Hole Length, lists it, selects it from the list, and refuses the export', async () => {
    const launched = await launchApp();
    const {window} = launched;
    try {
      const dialog = await stubSaveDialog(launched.app);
      await dialog.answerWith('cancel');
      await defineOctaveOrgan(window, 'Octave organ');
      // Columns of 1.25 mm: the Minimum Hole Length of 2.5 mm is 2 Columns.
      await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4), {columnLength: '1.25'});
      const original = [...(await drawnHoles(window))].sort(byPlace);
      const c4Row = original.filter((hole) => original.filter((other) => other.row === hole.row).length === 4);
      const target = c4Row[0];
      if (!target) throw new Error('expected four C4 Holes');
      await expect(window.getByTestId('hole-mark')).toHaveCount(0);
      await expect(window.getByTestId('cutting-problems-count')).toHaveText('None');

      // Shorten the Hole to 1 Column, below the Minimum Hole Length.
      await holeAt(window, target.row, target.start).click();
      for (let times = 0; times < 20; times++) await pressOnDrawing(window, 'Shift+ArrowLeft');

      await expect(window.getByTestId('hole-mark')).toHaveCount(1);
      await expect(window.getByTestId('cutting-problems').getByTestId('cutting-problem')).toHaveCount(1);
      await expect(window.getByTestId('cutting-problems-count')).toHaveText(/^\s*1 Hole can't be cut\s*$/);

      // Choosing the entry selects the Hole.
      await pressOnDrawing(window, 'Escape');
      await expect(holeAt(window, target.row, target.start)).not.toHaveClass(/selected/);
      await window.getByTestId('cutting-problem').click();
      await expect(holeAt(window, target.row, target.start)).toHaveClass(/selected/);

      // Export is refused with the cutting problems dialog, without the save dialog.
      await window.getByTestId('export').click();
      await expect(window.getByRole('dialog').getByTestId('export-problem')).toHaveCount(1);
      expect(await dialog.calls()).toHaveLength(0);
    } finally {
      await launched.app.close();
    }
  });

  test('shows the moved Hole within 100 ms of Alt+ArrowRight', async () => {
    const launched = await launchApp();
    const {window} = launched;
    try {
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4));
      const [first] = [...(await drawnHoles(window))].sort(byPlace);
      if (!first) throw new Error('expected Holes');
      await holeAt(window, first.row, first.start).click();
      await window.locator('[data-testid="tape-scroll"] svg').focus();

      const elapsed = await window.evaluate(
        ({row, start}) =>
          new Promise<number>((resolve, reject) => {
            const svg = document.querySelector('[data-testid="tape-scroll"] svg');
            if (!svg) return reject(new Error('the Tape drawing is not shown'));
            const moved = `[data-testid="hole"][data-row="${row}"][data-start="${start + 1}"]`;
            const begin = performance.now();
            const observer = new MutationObserver(() => {
              if (svg.querySelector(moved)) {
                observer.disconnect();
                resolve(performance.now() - begin);
              }
            });
            observer.observe(svg, {childList: true, subtree: true, attributes: true});
            svg.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true}));
            setTimeout(() => reject(new Error('the moved Hole did not appear')), 2000);
          }),
        {row: first.row, start: first.start},
      );

      expect(elapsed).toBeLessThan(100);
    } finally {
      await launched.app.close();
    }
  });

  for (const [width, height] of [[1024, 768], [1200, 700]] as const) {
    test(`keeps the side panel clear of the Tape drawing in a ${width}x${height} window and selects a Hole at the left`, async () => {
      const launched = await launchApp();
      const {window} = launched;
      try {
        await resizeWindowOrSkip(launched, width, height);
        await defineOctaveOrgan(window, 'Octave organ');
        await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4), {columnLength: '1.25'});
        const scroll = await window.getByTestId('tape-scroll').boundingBox();
        const panel = await window.getByTestId('side-panel').boundingBox();
        if (!scroll || !panel) throw new Error('the Tape drawing or the side panel is not shown');
        expect(scroll.x + scroll.width).toBeLessThanOrEqual(panel.x);

        const [first] = [...(await drawnHoles(window))].sort(byPlace);
        if (!first) throw new Error('expected Holes');
        await holeAt(window, first.row, first.start).click({timeout: 3000});
        await expect(holeAt(window, first.row, first.start)).toHaveClass(/selected/);
      } finally {
        await launched.app.close();
      }
    });
  }
});
