import {expect, test, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan} from './support/organ-editor';

interface Box {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

const documentOverflow = (window: Page) =>
  window.evaluate(() => ({
    vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

const inView = async (window: Page, testId: string) => {
  const box = await window.getByTestId(testId).boundingBox();
  const viewport = window.viewportSize();
  if (!box || !viewport) throw new Error(`${testId} has no box`);
  return box.y >= 0 && box.y + box.height <= viewport.height && box.x >= 0 && box.x + box.width <= viewport.width;
};

const columnCount = (window: Page) => window.getByTestId('rack-column').evaluateAll((columns) => new Set(columns.map((c) => Math.round(c.getBoundingClientRect().left))).size);

/** Whether the element itself or something inside it is a scroll container with overflowing content. */
const scrolls = (window: Page, testId: string) =>
  window.getByTestId(testId).evaluate((element) =>
    [element, ...Array.from(element.querySelectorAll('*'))].some((node) => {
      const overflow = getComputedStyle(node).overflowY;
      return (overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight;
    }),
  );

test.describe('I see the whole Organ editor on one screen', () => {
  test('1280 x 800: nothing scrolls, three rack columns, action bar in view', async () => {
    const {app, window} = await launchApp();
    await window.setViewportSize({width: 1280, height: 800});
    await defineStreetOrgan(window);

    expect(await documentOverflow(window)).toEqual({vertical: 0, horizontal: 0});
    expect(await columnCount(window)).toBe(3);
    expect(await inView(window, 'save-organ')).toBe(true);
    await app.close();
  });

  test('1024 x 700: two rack columns, only the Pipes sheet scrolls, Tape Bed sheet and action bar in view', async () => {
    const {app, window} = await launchApp();
    await window.setViewportSize({width: 1024, height: 700});
    await defineStreetOrgan(window);

    expect(await documentOverflow(window)).toEqual({vertical: 0, horizontal: 0});
    expect(await columnCount(window)).toBe(2);
    expect(await scrolls(window, 'pipes-sheet')).toBe(true);
    expect(await scrolls(window, 'tape-bed-sheet')).toBe(false);
    expect(await inView(window, 'tape-bed-sheet')).toBe(true);
    expect(await inView(window, 'save-organ')).toBe(true);
    await app.close();
  });

  test('no two Tape Bed field boxes overlap', async () => {
    const {app, window} = await launchApp();
    await window.setViewportSize({width: 1024, height: 700});
    await defineStreetOrgan(window);

    const boxes: Box[] = await window.getByTestId('tape-bed-sheet').locator('mat-form-field').evaluateAll((fields) =>
      fields.map((field) => {
        const {top, bottom, left, right} = field.getBoundingClientRect();
        return {top, bottom, left, right};
      }),
    );
    expect(boxes.length).toBeGreaterThanOrEqual(7);
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const overlaps = a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        expect(overlaps, `${JSON.stringify(a)} overlaps ${JSON.stringify(b)}`).toBe(false);
      }
    }
    await app.close();
  });
});
