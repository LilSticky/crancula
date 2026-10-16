import {expect, test, type Locator, type Page} from '@playwright/test';
import {launchApp, type LaunchedApp} from './support/launch-app';
import {melodyC3ToC5} from './support/midi-file';
import {STREET_ORGAN, saveOrgan} from './support/organ-editor';
import {createTapeFromSong, songRepeatingC4} from './support/tape-creation';

/** 1 mm at zoom 1:1: 96 px per inch. */
const PIXELS_PER_MILLIMETRE = 96 / 25.4;
const HOLE_DIAMETER = Number(STREET_ORGAN.holeDiameter);
const LEAD_IN = 30;

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((element) => {
    const {left, top, right, bottom} = element.getBoundingClientRect();
    return {left, top, right, bottom};
  });

async function resizeWindow({app}: LaunchedApp, width: number, height: number): Promise<void> {
  await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0]?.setContentSize(size.width, size.height), {width, height});
}

const documentScrolls = (window: Page): Promise<boolean> =>
  window.evaluate(() => {
    const root = document.documentElement;
    return root.scrollHeight > root.clientHeight || root.scrollWidth > root.clientWidth;
  });

async function expectInViewport(page: Page, locator: Locator): Promise<void> {
  const viewport = await page.evaluate(() => ({width: window.innerWidth, height: window.innerHeight}));
  await expect(locator).toBeVisible();
  const box = await boxOf(locator);
  expect(box.top).toBeGreaterThanOrEqual(0);
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.bottom, JSON.stringify({box, viewport})).toBeLessThanOrEqual(viewport.height + 0.5);
  expect(box.right).toBeLessThanOrEqual(viewport.width + 0.5);
}

/** The Street organ's Pipes, but 25 of them (C4 to C6) and a Lead-in of 30 mm. */
async function defineOrganWithLeadIn(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();
  await window.getByTestId('name').fill(STREET_ORGAN.name);
  await window.getByTestId('tape-width').fill(STREET_ORGAN.tapeWidth);
  await window.getByTestId('hole-diameter').fill(STREET_ORGAN.holeDiameter);
  await window.getByTestId('row-spacing').fill(STREET_ORGAN.rowSpacing);
  await window.getByTestId('minimum-gap').fill(STREET_ORGAN.minimumGap);
  await window.getByTestId('lead-in').fill(String(LEAD_IN));
  for (let row = 0; row < 25; row++) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(String(60 + row));
  }
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

test.describe('The Tape view in true millimetres on one screen', () => {
  test.describe.configure({mode: 'serial'});
  let launched: LaunchedApp;

  test.beforeAll(async () => {
    launched = await launchApp();
    await resizeWindow(launched, 1280, 800);
    await defineOrganWithLeadIn(launched.window);
  });

  test.afterAll(async () => {
    await launched.app.close();
  });

  test('draws Holes, rows, Border and Lead-in at 1 mm = 96 / 25,4 px', async () => {
    const {window} = launched;
    await createTapeFromSong(window, 'Scale', melodyC3ToC5());
    await window.getByTestId('zoom').getByRole('button', {name: '1:1'}).click();

    const holes = window.getByTestId('tape-scroll').getByTestId('hole');
    const first = holes.and(window.locator('[data-row="0"]')).first();
    const last = holes.and(window.locator('[data-row="24"]')).first();
    const second = holes.and(window.locator('[data-row="1"]')).first();
    const firstBox = await boxOf(first);
    const secondBox = await boxOf(second);
    const lastBox = await boxOf(last);

    expect(Math.abs(firstBox.bottom - firstBox.top - HOLE_DIAMETER * PIXELS_PER_MILLIMETRE)).toBeLessThanOrEqual(1);
    expect(firstBox.top).toBeLessThan(secondBox.top);

    const tape = await boxOf(window.getByTestId('tape-scroll').locator('rect.tape'));
    const gapAtTop = firstBox.top - tape.top;
    const gapAtBottom = tape.bottom - lastBox.bottom;
    expect(Math.abs(gapAtTop - gapAtBottom)).toBeLessThanOrEqual(1);

    const leadIn = await boxOf(window.getByTestId('tape-scroll').getByTestId('lead-in'));
    expect(Math.abs(tape.left - leadIn.left - LEAD_IN * PIXELS_PER_MILLIMETRE)).toBeLessThanOrEqual(1);
  });

  test('fits stage, overview strip, status line and side panel on 1280 x 800 without scrolling the document', async () => {
    const {window} = launched;
    await resizeWindow(launched, 1280, 800);
    await expect(window.getByTestId('side-panel')).toBeVisible();
    expect(await documentScrolls(window)).toBe(false);
    await expectInViewport(window, window.getByTestId('tape-scroll'));
    await expectInViewport(window, window.getByTestId('overview'));
    await expectInViewport(window, window.getByTestId('status-line'));
    await expectInViewport(window, window.getByTestId('side-panel'));

    const stage = window.getByTestId('tape-scroll');
    const size = await stage.evaluate((element) => ({scrollWidth: element.scrollWidth, clientWidth: element.clientWidth}));
    expect(size.scrollWidth).toBeGreaterThan(size.clientWidth); // Only the stage scrolls.
  });

  test('scrolls the stage to its end when the end of the overview is clicked', async () => {
    const {window} = launched;
    await resizeWindow(launched, 1280, 800);
    const overview = window.getByTestId('overview');
    const box = await boxOf(overview);
    await overview.click({position: {x: box.right - box.left - 1, y: (box.bottom - box.top) / 2}});
    const stage = window.getByTestId('tape-scroll');
    await expect
      .poll(() => stage.evaluate((element) => element.scrollWidth - element.scrollLeft - element.clientWidth))
      .toBeLessThanOrEqual(1);
  });

  test('shows a Hole selected by click and by the right arrow key in the Selected Hole', async () => {
    const {window} = launched;
    await resizeWindow(launched, 1280, 800);
    await createTapeFromSong(window, 'Repeats', songRepeatingC4('repeats.mid', 3));
    await window.getByTestId('zoom').getByRole('button', {name: '1:1'}).click();

    const rowOne = window.getByTestId('tape-scroll').locator('[data-testid="hole"][data-row="0"]');
    await expect(rowOne).toHaveCount(3);
    const inspector = window.getByTestId('selected-hole');
    const before = await inspector.innerText();

    await rowOne.nth(0).click();
    const clicked = await inspector.innerText();
    expect(clicked).not.toBe(before);
    await expect(rowOne.nth(0)).toHaveAttribute('aria-selected', 'true');

    await window.keyboard.press('ArrowRight');
    await expect(rowOne.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(rowOne.nth(0)).toHaveAttribute('aria-selected', 'false');
    expect(await inspector.innerText()).not.toBe(clicked);
  });

  test('collapses the side panel on 1024 x 700 and keeps overview strip and status line in view without scrolling the document', async () => {
    const {window} = launched;
    await resizeWindow(launched, 1024, 700);
    await expect(window.getByTestId('side-panel')).toHaveCount(0);
    await expect(window.getByTestId('side-panel-toggle')).toBeVisible();
    expect(await documentScrolls(window)).toBe(false);
    await expectInViewport(window, window.getByTestId('tape-scroll'));
    await expectInViewport(window, window.getByTestId('overview'));
    await expectInViewport(window, window.getByTestId('status-line'));
  });
});
