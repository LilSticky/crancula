import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, type Page, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {melodyC3ToC5} from './support/midi-file';
import {createTapeFromSong, defineOctaveOrgan} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';

interface StoredTapes {
  readonly tapes: readonly {readonly columnLength: number}[];
}

/** The value shown next to a label of the Tape section (`dt` followed by its `dd`). */
function sectionValue(window: Page, label: string) {
  return window.getByTestId('tape-section').getByText(label, {exact: true}).locator('xpath=following-sibling::dd[1]');
}

/** The number in a text such as "1,234.5 mm" or "12". */
function numberIn(text: string): number {
  return Number(text.replace(/[^0-9.]/g, ''));
}

test.describe('Adjust the Column length of a Tape', () => {
  test('keeps the new Column length, the Columns and Holes, and doubles the Tape length after a restart', async () => {
    const first = await launchApp();
    await defineOctaveOrgan(first.window, 'Octave organ');
    await createTapeFromSong(first.window, 'Scale', melodyC3ToC5(), {columnLength: '5'});
    const {window} = first;

    const columnsBefore = await sectionValue(window, 'Columns').textContent();
    const holesBefore = await sectionValue(window, 'Holes').textContent();
    const lengthBefore = await sectionValue(window, 'Length').textContent();
    await expect(window.getByTestId('column-length-input')).toHaveValue(/^5([.,]0)?$/);

    await window.getByTestId('column-length-input').fill('10');
    await window.getByTestId('column-length-apply').click();
    await expect(window.getByTestId('column-length-apply')).toBeDisabled();
    await expect(window.getByTestId('column-length-input')).toHaveValue(/^10([.,]0)?$/);

    await expect
      .poll(async () => {
        const stored = JSON.parse(await readFile(join(first.userDataDir, 'snapshots', 'tapes.json'), 'utf8')) as StoredTapes;
        return stored.tapes.map((tape) => tape.columnLength);
      })
      .toEqual([10]);
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await second.window.getByRole('link', {name: 'Tapes'}).click();
    await second.window.getByTestId('open-tape').click();
    await expect(second.window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText('Scale');

    await expect(second.window.getByTestId('column-length-input')).toHaveValue(/^10([.,]0)?$/);
    await expect(sectionValue(second.window, 'Columns')).toHaveText(columnsBefore ?? '');
    await expect(sectionValue(second.window, 'Holes')).toHaveText(holesBefore ?? '');
    const lengthAfter = await sectionValue(second.window, 'Length').textContent();
    expect(numberIn(lengthAfter ?? '')).toBe(2 * numberIn(lengthBefore ?? ''));
    await second.app.close();
  });

  test('takes a changed Column length back with the Edit menu Undo when the field has no focus (T016)', async () => {
    const launched = await launchApp();
    const {window, app, userDataDir} = launched;
    try {
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Scale', melodyC3ToC5(), {columnLength: '5'});
      const lengthBefore = await sectionValue(window, 'Length').textContent();
      await window.getByTestId('column-length-input').fill('10');
      await window.getByTestId('column-length-apply').click();
      await expect(window.getByTestId('column-length-input')).toHaveValue(/^10([.,]0)?$/);

      // The field gives up the focus, so the Edit menu's Undo is the only way back.
      await window.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await expect(window.getByTestId('column-length-input')).not.toBeFocused();

      // The menu item sends its Edit Command to the window it is clicked in.
      await app.evaluate(({BrowserWindow, Menu}) => {
        Menu.getApplicationMenu()?.getMenuItemById('undo')?.click(undefined, BrowserWindow.getAllWindows()[0]);
      });

      await expect(window.getByTestId('column-length-input')).toHaveValue(/^5([.,]0)?$/);
      await expect(sectionValue(window, 'Length')).toHaveText(lengthBefore ?? '');
      await expect
        .poll(async () => {
          const stored = JSON.parse(await readFile(join(userDataDir, 'snapshots', 'tapes.json'), 'utf8')) as StoredTapes;
          return stored.tapes.map((tape) => tape.columnLength);
        })
        .toEqual([5]);
    } finally {
      await app.close();
    }
  });
});

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The box of an element as drawn on screen. */
function boxOf(locator: ReturnType<Page['getByTestId']>): Promise<Box> {
  return locator.evaluate((element) => {
    const {left, top, right, bottom} = element.getBoundingClientRect();
    return {left, top, right, bottom};
  });
}

/** The area of the side panel that shows content: its padding box, without the border and any scrollbar. */
function visibleBoxOf(panel: ReturnType<Page['getByTestId']>): Promise<Box> {
  return panel.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const left = rect.left + element.clientLeft;
    const top = rect.top + element.clientTop;
    return {left, top, right: left + element.clientWidth, bottom: top + element.clientHeight};
  });
}

test.describe('Adjust the Column length of a Tape within the side panel', () => {
  for (const [width, height] of [[1280, 800], [1024, 700]] as const) {
    test(`at ${width} x ${height}: the side panel does not scroll sideways and shows the field, Apply and hint in full`, async () => {
      const launched = await launchApp();
      const {window, app} = launched;
      try {
        await resizeWindowOrSkip(launched, width, height, true);
        await defineOctaveOrgan(window, 'Octave organ');
        await createTapeFromSong(window, 'Scale', melodyC3ToC5(), {columnLength: '5'});
        await expect(window.getByTestId('side-panel')).toBeVisible();

        await window.getByTestId('column-length-input').fill('10');
        await expect(window.getByTestId('column-length-apply')).toBeEnabled();
        await expect(window.getByTestId('column-length-hint')).toBeVisible();

        const panel = window.getByTestId('side-panel');
        const overflow = await panel.evaluate((element) => ({scrollWidth: element.scrollWidth, clientWidth: element.clientWidth}));
        expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.clientWidth);

        const visible = await visibleBoxOf(panel);
        const parts = {
          field: window.getByTestId('column-length-input').locator('xpath=ancestor::mat-form-field[1]'),
          apply: window.getByTestId('column-length-apply'),
          hint: window.getByTestId('column-length-hint'),
        } as const;
        for (const [name, locator] of Object.entries(parts)) {
          const box = await boxOf(locator);
          const detail = `${name} ${JSON.stringify({box, visible})}`;
          expect(box.left, detail).toBeGreaterThanOrEqual(visible.left - 0.5);
          expect(box.right, detail).toBeLessThanOrEqual(visible.right + 0.5);
          expect(box.top, detail).toBeGreaterThanOrEqual(visible.top - 0.5);
          expect(box.bottom, detail).toBeLessThanOrEqual(visible.bottom + 0.5);
        }
      } finally {
        await app.close();
      }
    });
  }
});
