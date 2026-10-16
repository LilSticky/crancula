import {expect, test, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan} from './support/organ-editor';
import {resizeWindow} from './support/window-size';

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
  const viewport = await window.evaluate(() => ({width: window.innerWidth, height: window.innerHeight}));
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
    const launched = await launchApp();
      const {app, window} = launched;
    await resizeWindow(launched, 1280, 800);
    await defineStreetOrgan(window);

    expect(await documentOverflow(window)).toEqual({vertical: 0, horizontal: 0});
    expect(await columnCount(window)).toBe(3);
    expect(await inView(window, 'save-organ')).toBe(true);
    await app.close();
  });

  test('1024 x 700: two rack columns, only the Pipes sheet scrolls, Tape Bed sheet and action bar in view', async () => {
    const launched = await launchApp();
      const {app, window} = launched;
    await resizeWindow(launched, 1024, 700);
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
    const launched = await launchApp();
      const {app, window} = launched;
    await resizeWindow(launched, 1024, 700);
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

  for (const size of [{width: 1280, height: 800}, {width: 1024, height: 700}]) {
    test(`${size.width} x ${size.height}: every rack column lies within the visible Pipes sheet`, async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      await resizeWindow(launched, size.width, size.height);
      await defineStreetOrgan(window);

      const sheet = await window.getByTestId('pipes-sheet').boundingBox();
      if (!sheet) throw new Error('pipes-sheet has no box');
      const columns = await window.getByTestId('rack-column').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right));
      for (const right of columns) {
        expect(right, `column right edge ${right} vs Pipes sheet right edge ${sheet.x + sheet.width}`).toBeLessThanOrEqual(sheet.x + sheet.width);
      }
      await app.close();
    });
  }
});

test.describe('Organ editor labels do not collide', () => {
  test('1024 x 700, empty new Organ: no Tape Bed label overlaps its suffix or is truncated', async () => {
    const launched = await launchApp();
      const {app, window} = launched;
    await resizeWindow(launched, 1024, 700);
    await window.getByTestId('new-organ').click();

    const problems = await window.getByTestId('tape-bed-sheet').locator('mat-form-field').evaluateAll((fields) =>
      fields.flatMap((field) => {
        const label = field.querySelector('label.mdc-floating-label, .mdc-floating-label');
        const suffix = field.querySelector('.mat-mdc-form-field-text-suffix');
        if (!label) return [];
        const found: string[] = [];
        const text = label.textContent?.trim() ?? '';
        if (label.scrollWidth > label.clientWidth + 1) found.push(`"${text}" truncated: ${label.scrollWidth} > ${label.clientWidth}`);
        if (suffix) {
          const l = label.getBoundingClientRect();
          const s = suffix.getBoundingClientRect();
          const overlaps = l.left < s.right && s.left < l.right && l.top < s.bottom && s.top < l.bottom;
          if (overlaps) found.push(`"${text}" label [${l.left}-${l.right}] overlaps suffix [${s.left}-${s.right}]`);
        }
        return found;
      }),
    );
    expect(problems).toEqual([]);
    await app.close();
  });

  test('1280 x 800: a MIDI note label stays inside its own rack row', async () => {
    const launched = await launchApp();
      const {app, window} = launched;
    await resizeWindow(launched, 1280, 800);
    await defineStreetOrgan(window);

    const problems = await window.getByTestId('pipe').evaluateAll((rows) =>
      rows.slice(0, 8).flatMap((row, index) => {
        const label = row.querySelector('.mdc-floating-label');
        if (!label) return [];
        const l = label.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        return l.top < r.top - 0.5 ? [`row ${index + 1}: label top ${l.top} is ${r.top - l.top}px above its row`] : [];
      }),
    );
    expect(problems).toEqual([]);
    await app.close();
  });
});

test.describe('The Pipe rack header cells do not run together', () => {
  for (const language of ['en', 'de'] as const) {
    test(`${language}: the Row and MIDI note header texts have a gap`, async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      await resizeWindow(launched, 1280, 800);
      await window.getByTestId('language-switch').locator(`[data-language="${language}"]`).click();
      await window.getByTestId('new-organ').click();
      await window.getByTestId('add-pipe').click();

      const gaps = await window.getByTestId('rack-column').first().getByTestId('rack-header-cell').evaluateAll((cells) => {
        const extents = cells.map((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const {left, right} = range.getBoundingClientRect();
          return {left, right};
        });
        return extents.slice(1).map((next, i) => next.left - (extents[i]?.right ?? 0));
      });
      expect(gaps.length).toBe(1);
      for (const gap of gaps) expect(gap, `gap between header texts: ${gap}px`).toBeGreaterThanOrEqual(4);
      await app.close();
    });
  }
});
