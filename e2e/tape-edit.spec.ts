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

    // The Add a Hole form is visible without scrolling the side panel (UX finding 14).
    await expect(window.getByTestId('add-hole-submit')).toBeInViewport({ratio: 1});

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

  test('undoes three edits with the shortcut, redoes the first, and keeps the undone state after a restart', async () => {
    const first = await launchApp();
    const {window} = first;
    await resizeWindowOrSkip(first, 1280, 800);
    await defineOctaveOrgan(window, 'Octave organ');
    await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4));
    const original = [...(await drawnHoles(window))].sort(byPlace);
    const c4Row = original.filter((hole) => original.filter((other) => other.row === hole.row).length === 4);
    const [firstC4, secondC4] = c4Row;
    if (!firstC4 || !secondC4) throw new Error('expected four C4 Holes');
    const undo = window.getByTestId('undo');
    await expect(undo).toBeDisabled();

    // Three edits: move a Hole one Column later, lengthen it at the end, remove another Hole.
    await holeAt(window, firstC4.row, firstC4.start).click();
    await pressOnDrawing(window, 'Alt+ArrowRight');
    await expect(holeAt(window, firstC4.row, firstC4.start + 1)).toHaveCount(1);
    const afterFirstEdit = [...(await drawnHoles(window))].sort(byPlace);
    await pressOnDrawing(window, 'Shift+ArrowRight');
    await holeAt(window, secondC4.row, secondC4.start).click();
    await pressOnDrawing(window, 'Delete');
    await expect(holeAt(window, secondC4.row, secondC4.start)).toHaveCount(0);
    await expect(undo).toBeEnabled();

    // The real Electron window: the application menu's Undo accelerator must not swallow the Tape view's shortcut.
    for (let times = 0; times < 3; times++) await pressOnDrawing(window, 'ControlOrMeta+Z');
    expect([...(await drawnHoles(window))].sort(byPlace)).toEqual(original);
    await expect(undo).toBeDisabled();
    await expect(window.getByTestId('redo')).toBeEnabled();

    await pressOnDrawing(window, 'ControlOrMeta+Shift+Z');
    expect([...(await drawnHoles(window))].sort(byPlace)).toEqual(afterFirstEdit);
    await expect(undo).toBeEnabled();

    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await openOnlyTape(second.window);
    expect([...(await drawnHoles(second.window))].sort(byPlace)).toEqual(afterFirstEdit);
    await expect(second.window.getByTestId('undo')).toBeDisabled();
    await second.app.close();
  });

  test('scrolls the stage during a drag near its edge, grows the Tape when released past the end, and keeps the length on remove and after undo and a restart', async () => {
    const first = await launchApp();
    const {window} = first;
    await resizeWindowOrSkip(first, 1024, 768);
    await defineOctaveOrgan(window, 'Octave organ');
    await createTapeFromSong(window, 'Long scale', songRepeatingC4('long.mid', 40), {columnLength: '1.25'});
    const subtitle = window.getByTestId('tape-name');
    const columnsOf = async (): Promise<number> => {
      const text = (await subtitle.textContent()) ?? '';
      const match = /(\d+) Columns? of/.exec(text);
      if (!match?.[1]) throw new Error(`the subtitle shows no Column count: ${text}`);
      return Number(match[1]);
    };
    const openedColumns = await columnsOf();
    const scroll = window.getByTestId('tape-scroll');
    const scrollLeft = (): Promise<number> => scroll.evaluate((element) => element.scrollLeft);

    // Park the stage a little before its end, so the last Hole is in view and there is room to scroll.
    await scroll.evaluate((element) => {
      element.scrollLeft = element.scrollWidth - element.clientWidth - 300;
    });
    const parked = await scrollLeft();
    expect(parked).toBeGreaterThan(0);
    // Pick the last Hole that is in view at the parked position.
    const stageView = await scroll.boundingBox();
    if (!stageView) throw new Error('the stage is not shown');
    const inView = () => window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"]').evaluateAll(
      (rects, view) =>
        rects
          .map((rect) => ({
            row: Number(rect.getAttribute('data-row')),
            start: Number(rect.getAttribute('data-start')),
            right: rect.getBoundingClientRect().right,
            left: rect.getBoundingClientRect().left,
          }))
          .filter((hole) => hole.left >= view.left && hole.right <= view.right),
      {left: stageView.x, right: stageView.x + stageView.width},
    );
    await expect.poll(async () => (await inView()).length).toBeGreaterThan(0);
    const last = (await inView()).sort((a, b) => a.start - b.start).at(-1);
    if (!last) throw new Error('expected a Hole in view');
    const hole = holeAt(window, last.row, last.start);
    const holeBox = await hole.boundingBox();
    const stageBox = await scroll.boundingBox();
    if (!holeBox || !stageBox) throw new Error('the last Hole or the stage is not shown');

    // Hold the Hole within 24 px of the stage's right edge: the stage scrolls, without any further pointer move.
    await window.mouse.move(holeBox.x + holeBox.width / 2, holeBox.y + holeBox.height / 2);
    await window.mouse.down();
    await window.mouse.move(stageBox.x + stageBox.width - 8, holeBox.y + holeBox.height / 2, {steps: 8});
    await expect.poll(scrollLeft, {message: 'the stage scrolls while a drag is held near its right edge'}).toBeGreaterThan(parked);
    // Keep holding until the stage has scrolled well on, then release past the end of the Tape.
    await expect.poll(scrollLeft).toBeGreaterThan(parked + 250);
    await window.mouse.up();

    await expect.poll(columnsOf).toBeGreaterThan(openedColumns);
    const grownColumns = await columnsOf();

    // Removing the Hole keeps the Tape that long.
    const moved = window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"].selected');
    await expect(moved).toHaveCount(1);
    const movedRow = Number(await moved.getAttribute('data-row'));
    const movedStart = Number(await moved.getAttribute('data-start'));
    await pressOnDrawing(window, 'Delete');
    await expect(holeAt(window, movedRow, movedStart)).toHaveCount(0);
    expect(await columnsOf()).toBe(grownColumns);

    // Undo twice: the Hole comes back, then the Tape shrinks to the opened length.
    await pressOnDrawing(window, 'ControlOrMeta+Z');
    expect(await columnsOf()).toBe(grownColumns);
    await pressOnDrawing(window, 'ControlOrMeta+Z');
    await expect.poll(columnsOf).toBe(openedColumns);
    await expect(window.getByTestId('undo')).toBeDisabled();

    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await openOnlyTape(second.window);
    await expect(second.window.getByTestId('tape-name')).toContainText(`${openedColumns} Columns of`);
    await second.app.close();
  });

  test('edits, adds a Hole through the form, undoes and redoes with the keyboard only', async () => {
    const launched = await launchApp();
    const {window} = launched;
    try {
      await resizeWindowOrSkip(launched, 1280, 800);
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Scale', songRepeatingC4('c4s.mid', 4));
      const original = [...(await drawnHoles(window))].sort(byPlace);
      const column = await columnWidth(window);
      const selected = window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"].selected');
      const selectedHole = async (): Promise<DrawnHole> => {
        await expect(selected).toHaveCount(1);
        return {
          row: Number(await selected.getAttribute('data-row')),
          start: Number(await selected.getAttribute('data-start')),
          width: Number(await selected.getAttribute('width')),
        };
      };
      const press = (key: string): Promise<void> => window.keyboard.press(key);

      // Tab to the drawing; Enter selects the first Hole.
      const drawing = window.locator('[data-testid="tape-scroll"] svg');
      await window.locator('body').focus();
      for (let tabs = 0; tabs < 60; tabs++) {
        if (await drawing.evaluate((svg) => document.activeElement === svg)) break;
        await press('Tab');
      }
      await expect(drawing).toBeFocused();
      await press('Enter');
      const start = await selectedHole();

      await press('Alt+ArrowRight');
      await expect(holeAt(window, start.row, start.start + 1)).toHaveClass(/selected/);
      await press('Alt+ArrowDown');
      await expect(holeAt(window, start.row + 1, start.start + 1)).toHaveClass(/selected/);
      await press('Shift+ArrowRight');
      await expect.poll(async () => (await selectedHole()).width).toBeCloseTo(start.width + column, 0);
      await press('Alt+Shift+ArrowRight');
      await expect(holeAt(window, start.row + 1, start.start + 2)).toHaveClass(/selected/);
      await expect.poll(async () => (await selectedHole()).width).toBeCloseTo(start.width, 0);
      const beforeDelete = (await drawnHoles(window)).length;
      await press('Delete');
      await expect.poll(async () => (await drawnHoles(window)).length).toBe(beforeDelete - 1);

      // Add a G4 Hole at Column 12 through the form, with the keyboard.
      await window.getByTestId('add-hole-pipe').focus();
      await press('Enter');
      await window.getByRole('option', {name: 'G4'}).waitFor();
      const active = window.locator('.mat-mdc-option.mat-mdc-option-active');
      for (let steps = 0; steps < 30 && !/G4/.test((await active.first().textContent()) ?? ''); steps++) await press('ArrowDown');
      await expect(active.first()).toContainText('G4');
      await press('Enter');
      await press('Tab');
      await press('ControlOrMeta+A');
      await window.keyboard.type('12');
      await press('Tab');
      await press('Enter');
      await expect(holeAt(window, 7, 11)).toHaveClass(/selected/);
      const added = [...(await drawnHoles(window))].sort(byPlace);
      expect(added).toHaveLength(beforeDelete);

      // The form returned the focus to the drawing: undo the add, then redo it.
      await press('ControlOrMeta+Z');
      await expect(holeAt(window, 7, 11)).toHaveCount(0);
      await press('ControlOrMeta+Shift+Z');
      await expect(holeAt(window, 7, 11)).toHaveCount(1);
      expect([...(await drawnHoles(window))].sort(byPlace)).toEqual(added);
      expect(original.length).toBeGreaterThan(0);
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
