import {expect, type Page} from '@playwright/test';

/** The quickstart Organ: needs 117.5 mm of its 120 mm tape width. */
export const STREET_ORGAN = {
  name: 'Street organ',
  tapeWidth: '120',
  border: '5',
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
  await window.getByTestId('border').fill(STREET_ORGAN.border);
  await window.getByTestId('hole-diameter').fill(STREET_ORGAN.holeDiameter);
  await window.getByTestId('row-spacing').fill(STREET_ORGAN.rowSpacing);
  await window.getByTestId('minimum-gap').fill(STREET_ORGAN.minimumGap);
  for (const [row, note] of STREET_ORGAN.notes.entries()) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(note);
  }
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}
