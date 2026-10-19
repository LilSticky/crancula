import {expect, type Locator, type Page} from '@playwright/test';

/** A Hole as the Tape drawing shows it: its row (from 0, top row first), start Column (from 0) and width in px. */
export interface DrawnHole {
  readonly row: number;
  readonly start: number;
  readonly width: number;
}

const tapeDrawing = (window: Page): Locator => window.locator('[data-testid="tape-scroll"] svg');

/** The Hole at this row and start Column in the Tape drawing (not in the overview strip). */
export function holeAt(window: Page, row: number, start: number): Locator {
  return tapeDrawing(window).locator(`[data-testid="hole"][data-row="${row}"][data-start="${start}"]`);
}

/** Every Hole the Tape drawing renders, in the order of the drawing. */
export async function drawnHoles(window: Page): Promise<readonly DrawnHole[]> {
  return tapeDrawing(window)
    .locator('[data-testid="hole"]')
    .evaluateAll((rects) =>
      rects.map((rect) => ({
        row: Number(rect.getAttribute('data-row')),
        start: Number(rect.getAttribute('data-start')),
        width: Number(rect.getAttribute('width')),
      })),
    );
}

/** The width of one Column in px, read from the distance of the Column lines (one every 8 Columns). */
export async function columnWidth(window: Page): Promise<number> {
  const xs = await tapeDrawing(window)
    .locator('[data-testid="column-mark"]')
    .evaluateAll((lines) => lines.slice(0, 2).map((line) => Number(line.getAttribute('x1'))));
  const [first, second] = xs;
  if (first === undefined || second === undefined) throw new Error('the Tape drawing shows fewer than two Column lines');
  return (second - first) / 8;
}

async function centreOf(locator: Locator): Promise<{x: number; y: number}> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('the element is not shown');
  return {x: box.x + box.width / 2, y: box.y + box.height / 2};
}

async function dragBy(window: Page, from: {x: number; y: number}, dx: number, dy: number): Promise<void> {
  await window.mouse.move(from.x, from.y);
  await window.mouse.down();
  await window.mouse.move(from.x + dx / 2, from.y + dy / 2, {steps: 4});
  await window.mouse.move(from.x + dx, from.y + dy, {steps: 4});
  await window.mouse.up();
}

/** Drags the body of a Hole along its row by whole Columns (later is positive) with the real mouse. */
export async function dragHole(window: Page, hole: Locator, columns: number): Promise<void> {
  const width = await columnWidth(window);
  await dragBy(window, await centreOf(hole), columns * width, 0);
}

/** Selects the Hole, then drags its start or end handle by whole Columns (later is positive). */
export async function dragHandle(window: Page, hole: Locator, end: 'start' | 'end', columns: number): Promise<void> {
  const width = await columnWidth(window);
  await hole.click();
  const handle = tapeDrawing(window).locator(`[data-testid="hole-handle"][data-end="${end}"]`);
  await expect(handle).toHaveCount(1);
  await dragBy(window, await centreOf(handle), columns * width, 0);
}

/** Presses a key (for example `Delete` or `Alt+ArrowRight`) with the focus on the Tape drawing. */
export async function pressOnDrawing(window: Page, key: string): Promise<void> {
  await tapeDrawing(window).focus();
  await window.keyboard.press(key);
}

/** Opens the only stored Tape from the Tape list. */
export async function openOnlyTape(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Tapes'}).click();
  await window.getByTestId('open-tape').click();
  await expect(tapeDrawing(window)).toBeVisible();
}
