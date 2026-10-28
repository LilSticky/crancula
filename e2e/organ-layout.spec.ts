import {expect, test, type Locator, type Page} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {defineStreetOrgan, saveOrgan} from './support/organ-editor';
import {resizeWindowOrSkip} from './support/window-size';

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
  const viewport = await window.evaluate(() => ({width: globalThis.innerWidth, height: globalThis.innerHeight}));
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
    await resizeWindowOrSkip(launched, 1280, 800, true);
    await defineStreetOrgan(window);

    expect(await documentOverflow(window)).toEqual({vertical: 0, horizontal: 0});
    expect(await columnCount(window)).toBe(3);
    expect(await inView(window, 'save-organ')).toBe(true);
    await app.close();
  });

  test('1024 x 700: two rack columns, the sheets scroll inside, Tape Bed sheet, rows-fit line and action bar in view', async () => {
    const launched = await launchApp();
      const {app, window} = launched;
    await resizeWindowOrSkip(launched, 1024, 700, true);
    await defineStreetOrgan(window);

    expect(await documentOverflow(window)).toEqual({vertical: 0, horizontal: 0});
    expect(await columnCount(window)).toBe(2);
    expect(await scrolls(window, 'pipes-sheet')).toBe(true);
    // The Tape Bed fields scroll inside their sheet (#208), like the Pipe rack; the rows-fit line below them stays in view.
    expect(await inView(window, 'tape-bed-sheet')).toBe(true);
    expect(await inView(window, 'fit-check')).toBe(true);
    expect(await inView(window, 'save-organ')).toBe(true);
    await app.close();
  });

  test('no two Tape Bed field boxes overlap', async () => {
    const launched = await launchApp();
      const {app, window} = launched;
    await resizeWindowOrSkip(launched, 1024, 700, true);
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
      await resizeWindowOrSkip(launched, size.width, size.height, true);
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
    await resizeWindowOrSkip(launched, 1024, 700, true);
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
    await resizeWindowOrSkip(launched, 1280, 800, true);
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
      await resizeWindowOrSkip(launched, 1280, 800, true);
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

test.describe('The Tape Bed fields at 1440 x 900 (#151)', () => {
  const fieldOf = (window: Page, testId: string) => window.locator('mat-form-field').filter({has: window.getByTestId(testId)});

  test('an empty Tape per Crank turn: its label does not overlap the mm suffix', async () => {
    const launched = await launchApp();
    const {app, window} = launched;
    await resizeWindowOrSkip(launched, 1440, 900, true);
    await window.getByTestId('new-organ').click();

    const field = fieldOf(window, 'tape-per-crank-turn');
    const label = await field.locator('.mdc-floating-label').evaluate((element) => {
      const {left, top, right, bottom} = element.getBoundingClientRect();
      return {left, top, right, bottom};
    });
    const suffix = await field.locator('.mat-mdc-form-field-text-suffix').evaluate((element) => {
      const {left, top, right, bottom} = element.getBoundingClientRect();
      return {left, top, right, bottom};
    });
    const overlaps = label.left < suffix.right - 0.5 && suffix.left < label.right - 0.5 && label.top < suffix.bottom - 0.5 && suffix.top < label.bottom - 0.5;
    expect(overlaps, `label ${JSON.stringify(label)} overlaps suffix ${JSON.stringify(suffix)}`).toBe(false);
    await app.close();
  });

  test('an empty Lead-in is no taller than the Minimum gap field beside it', async () => {
    const launched = await launchApp();
    const {app, window} = launched;
    await resizeWindowOrSkip(launched, 1440, 900, true);
    await window.getByTestId('new-organ').click();

    const height = (testId: string) =>
      fieldOf(window, testId).evaluate((element) => element.getBoundingClientRect().height);
    const [leadIn, minimumGap] = await Promise.all([height('lead-in'), height('minimum-gap')]);
    expect(leadIn, `Lead-in ${leadIn}px vs Minimum gap ${minimumGap}px`).toBeLessThanOrEqual(minimumGap + 0.5);
    await app.close();
  });
});

test.describe('The Tape Bed card at the README size keeps its labels, heights and fit line (#208)', () => {
  const fitLinePattern: Record<'en' | 'de', RegExp> = {
    en: /31 rows take 107[.,]5 mm of the 120 mm tape width/,
    de: /31 Reihen belegen 107[.,]5 mm der 120 mm Bandbreite/,
  };

  /** The README screen: the 31er street organ with an empty Guide margin, opened from the Organ list. */
  async function openStreetOrganLikeTheReadme(window: Page, language: 'en' | 'de'): Promise<void> {
    await defineStreetOrgan(window);
    await window.getByTestId('tape-per-crank-turn').fill('50');
    await saveOrgan(window);
    await window.getByRole('link', {name: 'Organs'}).click();
    await window.getByTestId('organ').first().click();
    await expect(window.getByTestId('save-organ')).toBeVisible();
    if (language === 'de') await window.getByTestId('language-switch').locator('[data-language="de"]').click();
  }

  const boxOf = (locator: Locator) =>
    locator.evaluate((element) => {
      const {left, top, right, bottom, height} = element.getBoundingClientRect();
      return {left, top, right, bottom, height};
    });

  for (const language of ['en', 'de'] as const) {
    test(`${language}: the Guide margin label does not overlap its mm suffix`, async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      await resizeWindowOrSkip(launched, 1440, 900, true);
      await openStreetOrganLikeTheReadme(window, language);

      const field = window.locator('mat-form-field').filter({has: window.getByTestId('guide-margin')});
      const label = await boxOf(field.locator('.mdc-floating-label'));
      const suffix = await boxOf(field.locator('.mat-mdc-form-field-text-suffix'));
      const overlaps = label.left < suffix.right - 0.5 && suffix.left < label.right - 0.5 && label.top < suffix.bottom - 0.5 && suffix.top < label.bottom - 0.5;
      expect(overlaps, `label ${JSON.stringify(label)} overlaps suffix ${JSON.stringify(suffix)}`).toBe(false);
      await app.close();
    });

    test(`${language}: Spacing between rows and Guide margin fields are equally tall`, async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      await resizeWindowOrSkip(launched, 1440, 900, true);
      await openStreetOrganLikeTheReadme(window, language);

      // The visible text field (the box the user types in), not the form field host, which also holds the hint.
      const inputBox = (testId: string) =>
        boxOf(window.locator('mat-form-field').filter({has: window.getByTestId(testId)}).locator('.mdc-text-field')).then((box) => box.height);
      const [rowSpacing, guideMargin] = await Promise.all([inputBox('row-spacing'), inputBox('guide-margin')]);
      expect(Math.abs(rowSpacing - guideMargin), `Spacing between rows ${rowSpacing}px vs Guide margin ${guideMargin}px`).toBeLessThanOrEqual(0.5);
      await app.close();
    });

    test(`${language}: the rows-fit line is fully visible above the save bar`, async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      await resizeWindowOrSkip(launched, 1440, 900, true);
      await openStreetOrganLikeTheReadme(window, language);

      const fit = window.getByTestId('fit-check');
      await expect(fit).toHaveText(fitLinePattern[language]);
      const line = await boxOf(fit);
      const bar = await boxOf(window.locator('cranc-action-bar'));
      expect(line.bottom, `fit line bottom ${line.bottom}px vs save bar top ${bar.top}px`).toBeLessThanOrEqual(bar.top + 0.5);

      const clipped = await fit.evaluate((element) => ({
        horizontal: element.scrollWidth - element.clientWidth,
        vertical: element.scrollHeight - element.clientHeight,
      }));
      expect(clipped.horizontal, 'fit line is cut off horizontally').toBeLessThanOrEqual(0);
      expect(clipped.vertical, 'fit line is cut off vertically').toBeLessThanOrEqual(0);
      await app.close();
    });
  }

  test('the Name label is not cut off above the fields', async () => {
    const launched = await launchApp();
    const {app, window} = launched;
    await resizeWindowOrSkip(launched, 1440, 900, true);
    await openStreetOrganLikeTheReadme(window, 'en');

    const nameLabel = await boxOf(window.locator('mat-form-field').filter({has: window.getByTestId('name')}).locator('.mdc-floating-label'));
    const fields = await boxOf(window.getByTestId('tape-bed-sheet').locator('.fields'));
    expect(nameLabel.top, `Name label top ${nameLabel.top}px vs fields top ${fields.top}px`).toBeGreaterThanOrEqual(fields.top - 0.5);
    await app.close();
  });

  test('at 1280 x 600 the fields keep at least 120 px of height', async () => {
    const launched = await launchApp();
    const {app, window} = launched;
    await resizeWindowOrSkip(launched, 1280, 600, true);
    await openStreetOrganLikeTheReadme(window, 'en');

    const fields = await boxOf(window.getByTestId('tape-bed-sheet').locator('.fields'));
    expect(fields.bottom - fields.top, `fields ${fields.bottom - fields.top}px tall`).toBeGreaterThanOrEqual(120);
    await app.close();
  });

  test('the Guide margin hint sits within 8 px under its field', async () => {
    const launched = await launchApp();
    const {app, window} = launched;
    await resizeWindowOrSkip(launched, 1440, 900, true);
    await openStreetOrganLikeTheReadme(window, 'en');

    const textField = await boxOf(window.locator('mat-form-field').filter({has: window.getByTestId('guide-margin')}).locator('.mdc-text-field'));
    const hint = await boxOf(window.getByTestId('guide-margin-hint'));
    const gap = hint.top - textField.bottom;
    expect(gap, `hint ${gap}px under the Guide margin field`).toBeGreaterThanOrEqual(0);
    expect(gap, `hint ${gap}px under the Guide margin field`).toBeLessThanOrEqual(8);
    await app.close();
  });

  for (const language of ['en', 'de'] as const) {
    test(`${language}: the Tape Bed fields do not scroll sideways and no field label is cut off`, async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      await resizeWindowOrSkip(launched, 1440, 900, true);
      await openStreetOrganLikeTheReadme(window, language);

      const fields = await window.getByTestId('tape-bed-sheet').locator('.fields').evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(fields, `fields scroll ${fields}px sideways`).toBeLessThanOrEqual(0);

      const cutLabels = await window
        .getByTestId('tape-bed-sheet')
        .locator('mat-form-field .mdc-floating-label')
        .evaluateAll((labels) =>
          labels
            .filter((label) => {
              const range = document.createRange();
              range.selectNodeContents(label);
              return range.getBoundingClientRect().right > label.getBoundingClientRect().right + 0.5;
            })
            .map((label) => label.textContent?.trim() ?? ''),
        );
      expect(cutLabels, 'labels cut off').toEqual([]);
      await app.close();
    });

    test(`${language}: in a new Organ with errors shown, no unit suffix overlaps its field label`, async () => {
      const launched = await launchApp();
      const {app, window} = launched;
      await resizeWindowOrSkip(launched, 1440, 900, true);
      await window.getByTestId('new-organ').click();
      if (language === 'de') await window.getByTestId('language-switch').locator('[data-language="de"]').click();
      await window.getByTestId('save-organ').click();

      const unitFields = window.getByTestId('tape-bed-sheet').locator('mat-form-field').filter({has: window.locator('.mat-mdc-form-field-text-suffix')});
      const count = await unitFields.count();
      expect(count, 'Tape Bed fields with a unit').toBeGreaterThan(0);
      for (let index = 0; index < count; index += 1) {
        const field = unitFields.nth(index);
        const label = await boxOf(field.locator('.mdc-floating-label'));
        const suffix = await boxOf(field.locator('.mat-mdc-form-field-text-suffix'));
        const overlaps = label.left < suffix.right - 0.5 && suffix.left < label.right - 0.5 && label.top < suffix.bottom - 0.5 && suffix.top < label.bottom - 0.5;
        expect(overlaps, `field ${index}: label ${JSON.stringify(label)} overlaps suffix ${JSON.stringify(suffix)}`).toBe(false);
      }
      await app.close();
    });
  }
});
