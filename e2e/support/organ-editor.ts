import {expect, type Page} from '@playwright/test';

/** The quickstart Organ: has a Row Span of 107.5 mm on its 120 mm tape width. */
export const STREET_ORGAN = {
  name: 'Street organ',
  tapeWidth: '120',
  holeDiameter: '2.5',
  rowSpacing: '3.5',
  minimumGap: '1.5',
  /** 31 Pipes starting at F3 (53). */
  notes: Array.from({length: 31}, (_, row) => String(53 + row)),
} as const;

/** Opens the editor for a new Organ from the Organ list and enters the quickstart Organ. */
export async function defineStreetOrgan(window: Page): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();

  await window.getByTestId('name').fill(STREET_ORGAN.name);
  await window.getByTestId('tape-width').fill(STREET_ORGAN.tapeWidth);
  await window.getByTestId('hole-diameter').fill(STREET_ORGAN.holeDiameter);
  await window.getByTestId('row-spacing').fill(STREET_ORGAN.rowSpacing);
  await window.getByTestId('minimum-gap').fill(STREET_ORGAN.minimumGap);
  for (const [row, note] of STREET_ORGAN.notes.entries()) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(note);
  }
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

/** Presses Save in the Organ editor and waits until the changes count as stored. */
export async function saveOrgan(window: Page): Promise<void> {
  await window.getByTestId('save-organ').click();
  await expect(window.getByTestId('save-organ')).toBeDisabled();
}
