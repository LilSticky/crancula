import {expect, test, type Locator} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {defineStreetOrgan} from './support/organ-editor';
import {createTapeFromSong, songRepeatingC4} from './support/tape-creation';
import {resizeWindowOrSkip} from './support/window-size';

interface Box {
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

async function visibleBoxes(locator: Locator): Promise<readonly Box[]> {
  const boxes: Box[] = [];
  const count = await locator.count();
  for (let index = 0; index < count; index++) {
    const item = locator.nth(index);
    if (!(await item.isVisible())) continue;
    boxes.push(
      await item.evaluate((element) => {
        const {left, top, right, bottom} = element.getBoundingClientRect();
        return {text: element.textContent?.trim() ?? '', left, top, right, bottom};
      }),
    );
  }
  return boxes;
}

function overlapping(boxes: readonly Box[]): readonly string[] {
  const found: string[] = [];
  boxes.forEach((a, index) => {
    for (const b of boxes.slice(index + 1)) {
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) found.push(`${a.text} x ${b.text}`);
    }
  });
  return found;
}

test.describe('Marks of a long Tape at Whole Tape', () => {
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
    await resizeWindowOrSkip(launched, 1440, 900, true);
    await defineStreetOrgan(launched.window);
    await createTapeFromSong(launched.window, 'Long', songRepeatingC4('long.mid', 250));
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('overlaps neither the ruler numbers nor the row labels', async () => {
    const {window} = launched;
    await window.getByTestId('zoom').getByRole('radio', {name: 'Whole Tape'}).click();
    const stage = window.getByTestId('tape-scroll');

    await expect(stage.getByTestId('ruler-number').first()).toBeVisible();
    expect(overlapping(await visibleBoxes(stage.getByTestId('ruler-number')))).toEqual([]);
    const labels = await visibleBoxes(window.getByTestId('row-label'));
    expect(labels.length).toBeGreaterThan(0);
    expect(overlapping(labels)).toEqual([]);
  });
});
