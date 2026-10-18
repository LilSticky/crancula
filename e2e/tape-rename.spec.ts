import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {launchApp} from './support/launch-app';
import {melodyC3ToC5} from './support/midi-file';
import {createTapeFromSong, defineOctaveOrgan} from './support/tape-creation';

test.describe('Rename a Tape', () => {
  test('shows the new name in the Tape list and stores it in tapes.json', async () => {
    const launched = await launchApp();
    try {
      const {window, userDataDir} = launched;
      await defineOctaveOrgan(window, 'Octave organ');
      await createTapeFromSong(window, 'Waltz', melodyC3ToC5());
      await window.getByRole('link', {name: 'Tapes'}).click();

      await window.getByRole('button', {name: 'More actions for Waltz'}).click();
      await window.getByTestId('rename-tape').click();
      await window.getByTestId('tape-name-field').fill('Kirmes-Walzer');
      await window.getByTestId('rename-tape-confirm').click();

      await expect(window.getByTestId('tape-name')).toHaveText('Kirmes-Walzer');
      await expect
        .poll(async () => {
          const stored = JSON.parse(await readFile(join(userDataDir, 'snapshots', 'tapes.json'), 'utf8')) as {
            tapes: readonly {name: string}[];
          };
          return stored.tapes.map((tape) => tape.name);
        })
        .toEqual(['Kirmes-Walzer']);
    } finally {
      await launched.app.close();
    }
  });
});
