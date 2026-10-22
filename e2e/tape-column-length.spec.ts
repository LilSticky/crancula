import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, type Page, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {melodyC3ToC5} from './support/midi-file';
import {createTapeFromSong, defineOctaveOrgan} from './support/tape-creation';

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
});
