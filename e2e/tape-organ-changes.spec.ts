import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {createTapeFromSong, defineOctaveOrgan, songRepeatingC4} from './support/tape-creation';

interface StoredTape {
  readonly name: string;
  readonly length: number;
  readonly holes: readonly unknown[];
}

async function readStoredTapes(userDataDir: string): Promise<readonly StoredTape[]> {
  const text = await readFile(join(userDataDir, 'snapshots', 'tapes.json'), 'utf8');
  return (JSON.parse(text) as {tapes: readonly StoredTape[]}).tapes;
}

/** An Organ with two Tapes: 3 and 2 Holes on its first Pipe (5 in all), and one more Hole each on its second. */
async function organWithTwoTapes() {
  const launched = await launchApp();
  await defineOctaveOrgan(launched.window, 'Octave organ');
  await createTapeFromSong(launched.window, 'Three', songRepeatingC4('three.mid', 3));
  await createTapeFromSong(launched.window, 'Two', songRepeatingC4('two.mid', 2));
  return launched;
}

test.describe('Changing an Organ carries over to its Tapes', () => {
  test('deleting an Organ deletes its Tapes, also after a restart', async () => {
    const first = await organWithTwoTapes();
    await first.window.getByRole('link', {name: 'Organs'}).click();

    await first.window.getByTestId('delete-organ').click();
    await expect(first.window.getByTestId('consequence')).toContainText('(2)');
    await first.window.getByRole('button', {name: 'Confirm'}).click();
    await expect(first.window.getByText('No Organs yet.')).toBeVisible();
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await second.window.getByRole('link', {name: 'Tapes'}).click();
    await expect(second.window.getByText('No Tapes yet.')).toBeVisible();
    await second.window.getByRole('link', {name: 'Organs'}).click();
    await expect(second.window.getByText('No Organs yet.')).toBeVisible();
    await second.app.close();
    expect(await readStoredTapes(first.userDataDir)).toEqual([]);
  });

  test('removing a Pipe with Holes asks first and removes just those Holes, also after a restart', async () => {
    const first = await organWithTwoTapes();
    const before = await readStoredTapes(first.userDataDir);
    await first.window.getByRole('link', {name: 'Organs'}).click();
    await first.window.getByTestId('organ').click();

    await first.window.getByTestId('remove-pipe').first().click();
    await first.window.getByTestId('save-organ').click();
    const consequence = first.window.getByTestId('consequence');
    await expect(consequence).toContainText('Holes (5)');
    await expect(consequence).toContainText('Tapes (2)');
    await first.window.getByRole('button', {name: 'Confirm'}).click();
    await expect(first.window.getByTestId('save-organ')).toBeDisabled();
    // The button is disabled while saving too, so wait until the Tapes are written.
    await expect.poll(async () => (await readStoredTapes(first.userDataDir)).map(({holes}) => holes.length)).toEqual([1, 1]);
    await first.app.close();

    const second = await launchApp(first.userDataDir);
    await second.app.close();
    const after = await readStoredTapes(first.userDataDir);
    expect(after.map(({name}) => name).sort()).toEqual(['Three', 'Two']);
    for (const tape of after) {
      const original = before.find(({name}) => name === tape.name);
      expect(tape.length).toBe(original?.length);
      expect(tape.holes).toHaveLength(1);
    }
  });
});
