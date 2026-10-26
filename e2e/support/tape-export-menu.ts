import {expect, type Locator, type Page} from '@playwright/test';

/** An item of the Export menu of the Tape view: the Plotter export or the Scores export. */
export type TapeExportItem = 'export' | 'export-scores';

/** The Export menu of the Tape view page head: one trigger for both exports (spec 012, FR-001). */
export const exportMenuTrigger = (window: Page): Locator => window.getByTestId('export-menu');

/** The item of the open Export menu: `export` is Export for the Plotter, `export-scores` is Export as Scores. */
export const exportMenuItem = (window: Page, item: TapeExportItem): Locator => window.getByRole('menu').getByTestId(item);

/** Opens the Export menu of the Tape view, unless it is open already. */
export async function openExportMenu(window: Page): Promise<void> {
  const menu = window.getByRole('menu');
  if (!(await menu.isVisible())) await exportMenuTrigger(window).click();
  await expect(menu).toBeVisible();
}

/** Closes the open Export menu with Escape, without choosing an item. */
export async function closeExportMenu(window: Page): Promise<void> {
  await window.keyboard.press('Escape');
  await expect(window.getByRole('menu')).toBeHidden();
}

/** Chooses one item of the Export menu of the Tape view. */
export async function chooseExport(window: Page, item: TapeExportItem): Promise<void> {
  await openExportMenu(window);
  await exportMenuItem(window, item).click();
  // The menu closes after its item; wait until it is gone, so that the next open does not take its closing overlay for an open menu.
  await expect(window.getByRole('menu')).toBeHidden();
}

/** Chooses Export for the Plotter from the Export menu of the Tape view. */
export const exportForPlotter = (window: Page): Promise<void> => chooseExport(window, 'export');

/** Chooses Export as Scores from the Export menu of the Tape view. */
export const exportAsScores = (window: Page): Promise<void> => chooseExport(window, 'export-scores');

/** Expects an item of the Export menu to be enabled, then closes the menu again. */
export async function expectExportItemEnabled(window: Page, item: TapeExportItem): Promise<void> {
  await openExportMenu(window);
  await expect(exportMenuItem(window, item)).toBeEnabled();
  await closeExportMenu(window);
}
