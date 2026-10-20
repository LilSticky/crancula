import {mkdtemp, readdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {encodeSmf} from '../api/song/midi/smf-test-helper';
import {launchApp} from './support/launch-app';
import {melodyC3ToC5, notAMidiFile, type MidiFilePayload} from './support/midi-file';
import {saveOrgan} from './support/organ-editor';
import {stubSaveDialog} from './support/save-dialog';
import {createTapeFromSong, defineOctaveOrgan, songRepeatingC4} from './support/tape-creation';
import {drawnHoles, holeAt, pressOnDrawing} from './support/tape-edit';

/** The German text of `TAPE.EXPORT.<key>`. */
function germanExportText(key: string): string {
  const de = JSON.parse(readFileSync(join(__dirname, '../src/assets/i18n/de.json'), 'utf8')) as {
    TAPE: {EXPORT?: Record<string, string>};
  };
  return de.TAPE.EXPORT?.[key] ?? '';
}

/** A Song of one Part with a single note of one Column: a Hole of 1 Column. */
function shortNoteSong(): MidiFilePayload {
  const bytes = encodeSmf({
    format: 1,
    division: {ticksPerQuarterNote: 480},
    tracks: [
      {
        events: [
          {delta: 0, event: {type: 'trackName', text: 'Blip'}},
          {delta: 0, event: {type: 'noteOn', channel: 0, note: 60, velocity: 80}},
          {delta: 60, event: {type: 'noteOff', channel: 0, note: 60, velocity: 0}},
        ],
      },
    ],
  });
  return {name: 'blip.mid', mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

test.describe('I can export a Tape in German', () => {
  test('shows the save dialog, the saved and the failed snackbar in German, with the file name Waltz.svg', async () => {
    const {app, window} = await launchApp();
    try {
      const dialog = await stubSaveDialog(app);
      const folder = await mkdtemp(join(tmpdir(), 'crancula-german-'));
      await defineOctaveOrgan(window, 'Drehorgel');
      await createTapeFromSong(window, 'Waltz', melodyC3ToC5());
      await window.getByTestId('language-switch').locator('[data-language="de"]').click();
      const snackbar = window.locator('.mat-mdc-snack-bar-container');
      const seen: string[] = [];

      await dialog.answerWith(join(folder, 'Waltz.svg'));
      await window.getByTestId('export').click();
      await expect(snackbar.filter({hasText: 'Gespeichert'})).toBeVisible();
      seen.push(await snackbar.last().innerText());

      const [call] = await dialog.calls();
      const documents = await app.evaluate(({app: electronApp}) => electronApp.getPath('documents'));
      expect(call?.title).toBe(germanExportText('DIALOG_TITLE'));
      expect(call?.filters?.[0]?.name).toBe(germanExportText('FILTER_NAME'));
      expect(call?.defaultPath).toBe(join(documents, 'Waltz.svg'));
      expect(await readdir(folder)).toEqual(['Waltz.svg']);

      await dialog.answerWith(join(folder, 'missing', 'Waltz.svg'));
      await window.getByTestId('export').click();
      await expect(snackbar.filter({hasText: 'Speichern fehlgeschlagen'})).toBeVisible();
      seen.push(await snackbar.last().innerText());

      expect(seen.join('\n')).not.toMatch(/\bTAPE\.[A-Z_.]+/);
      expect(await window.locator('body').innerText()).not.toMatch(/\bTAPE\.[A-Z_.]+/);
    } finally {
      await app.close();
    }
  });

  test('explains the problems in German, without translation keys', async () => {
    const {app, window} = await launchApp();
    try {
      const dialog = await stubSaveDialog(app);
      await defineOctaveOrgan(window, 'Drehorgel');
      await createTapeFromSong(window, 'Blip', shortNoteSong());
      await window.getByRole('link', {name: 'Organs'}).click();
      await window.getByTestId('organ').click();
      await window.getByTestId('hole-diameter').fill('4');
      await window.getByTestId('row-spacing').fill('4');
      await saveOrgan(window);
      await window.getByRole('link', {name: 'Tapes'}).click();
      await window.getByTestId('tape').click();
      await window.getByTestId('language-switch').locator('[data-language="de"]').click();

      await window.getByTestId('export').click();

      const problems = window.getByRole('dialog');
      await expect(problems).toContainText(germanExportText('PROBLEMS_TITLE'));
      await expect(problems.getByTestId('export-problem')).toHaveCount(1);
      await expect(problems.getByTestId('export-problem')).toContainText('Mindestlochlänge');
      await expect(problems.getByRole('button', {name: germanExportText('PROBLEMS_CLOSE')})).toBeVisible();
      expect(await problems.innerText()).not.toMatch(/\bTAPE\.[A-Z_.]+/);
      expect(await dialog.calls()).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});

/** A German text of `TAPE.<section>.<key>` as the file has it. */
function germanTapeText(section: string, key: string): string {
  const de = JSON.parse(readFileSync(join(__dirname, '../src/assets/i18n/de.json'), 'utf8')) as {
    TAPE: Record<string, Record<string, string> | undefined>;
  };
  return de.TAPE[section]?.[key] ?? '';
}

test.describe('I can edit a Tape in German', () => {
  test('shows the editing texts in German, without translation keys', async () => {
    const {app, window} = await launchApp();
    try {
      await defineOctaveOrgan(window, 'Drehorgel');
      await createTapeFromSong(window, 'Blip', shortNoteSong(), {columnLength: '1.25'});
      await window.getByTestId('language-switch').locator('[data-language="de"]').click();
      const seen: string[] = [];
      const collect = async (): Promise<void> => {
        seen.push(await window.locator('body').innerText());
      };

      await expect(window.getByTestId('add-hole')).toContainText(germanTapeText('ADD_HOLE', 'TITLE'));
      await expect(window.getByTestId('cutting-problems')).toContainText(germanTapeText('CUTTING_PROBLEMS', 'TITLE'));
      await expect(window.getByTestId('cutting-problems-count')).toHaveText(germanTapeText('CUTTING_PROBLEMS', 'NONE'));
      await expect(window.getByTestId('undo')).toHaveAttribute('aria-label', /^Rückgängig \(.+\)$/);
      await expect(window.getByTestId('redo')).toHaveAttribute('aria-label', /^Wiederholen \(.+\)$/);

      await window.locator('[data-testid="tape-scroll"] svg [data-testid="hole"]').first().click();
      await expect(window.getByTestId('hole-keys')).toHaveText(germanTapeText('EDIT', 'KEYS'));
      await collect();

      // Shortening the only Hole below the Minimum Hole Length lists a Cutting Problem in German.
      await window.locator('[data-testid="tape-scroll"] svg').focus();
      await window.keyboard.press('Shift+ArrowLeft');
      await expect(window.getByTestId('cutting-problem')).toHaveCount(1);
      await expect(window.getByTestId('cutting-problems-count')).toContainText('kann nicht geschnitten werden');
      await expect(window.getByTestId('cutting-problem')).toContainText('Mindestlochlänge');
      await collect();

      // A refused edit shows the reason in German: add a Hole onto the one that exists.
      await window.getByTestId('add-hole-pipe').click();
      await window.getByRole('option', {name: 'C4'}).click();
      await window.getByTestId('add-hole-column').fill('1');
      await window.getByTestId('add-hole-submit').click();
      await expect(window.getByTestId('add-hole-problem')).toContainText('deckt Spalte');
      await collect();

      expect(seen.join('\n')).not.toMatch(/\bTAPE\.[A-Z_.]+/);
    } finally {
      await app.close();
    }
  });
});

test.describe('I can see a refused edit in German', () => {
  test('shows the overlap refusal of a keyboard edit in German', async () => {
    const {app, window} = await launchApp();
    try {
      await defineOctaveOrgan(window, 'Drehorgel');
      await createTapeFromSong(window, 'Tonleiter', songRepeatingC4('c4s.mid', 4));
      await window.getByTestId('language-switch').locator('[data-language="de"]').click();
      const holes = [...(await drawnHoles(window))].sort((a, b) => a.row - b.row || a.start - b.start);
      const target = holes.find((hole) => holes.filter((other) => other.row === hole.row).length === 4);
      if (!target) throw new Error('expected four C4 Holes');
      await holeAt(window, target.row, target.start).click();
      const snackbar = window.locator('.mat-mdc-snack-bar-container');
      for (let times = 0; times < 9; times++) await pressOnDrawing(window, 'Alt+ArrowRight');
      await expect(snackbar.filter({hasText: /Das Loch würde das Loch von [A-G]#?\d in Spalte \d+ überlappen\./})).toBeVisible();
      expect(await window.locator('body').innerText()).not.toMatch(/bTAPE\.[A-Z_.]+/);
    } finally {
      await app.close();
    }
  });
});

test.describe('I can bring a Song onto a Tape in German', () => {
  test('shows German texts and messages without translation keys', async () => {
    const {app, window} = await launchApp();
    await defineOctaveOrgan(window, 'Drehorgel');
    await window.getByTestId('language-switch').locator('[data-language="de"]').click();

    const seen: string[] = [];
    const collect = async (): Promise<void> => {
      seen.push(await window.locator('body').innerText());
    };

    await window.getByRole('link', {name: 'Lochbänder'}).click();
    await window.getByRole('link', {name: 'Ein Lied auf ein Lochband bringen'}).click();
    await expect(window.getByTestId('import-form')).toBeVisible();
    await collect();

    await window.getByTestId('song-file').setInputFiles(notAMidiFile());
    await expect(window.getByTestId('song-rejection')).toHaveAttribute('data-code', 'not-a-midi-file');
    const rejection = (await window.getByTestId('song-rejection').innerText()).trim();
    expect(rejection).toContain('keine MIDI-Datei');
    await collect();

    await window.getByTestId('song-file').setInputFiles(melodyC3ToC5());
    await expect(window.getByTestId('song-rejection')).toHaveCount(0);
    await expect(window.getByTestId('name')).not.toHaveValue('');
    await expect(window.getByTestId('song-file-name')).toHaveText('melody-c3-c5.mid');
    await expect(window.getByTestId('column-length')).toHaveValue('2,5');
    await window.getByTestId('name').fill('');
    await window.getByTestId('name').blur(); // Create Tape stays disabled; the Violation shows once the field was touched.
    await expect(window.getByTestId('violation').first()).toBeVisible();
    const violation = (await window.getByTestId('violation').first().innerText()).trim();
    expect(violation).toContain('Namen');
    await collect();

    await window.getByTestId('name').fill('Tonleiter');
    await window.getByTestId('create-tape').click();
    await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText('Tonleiter');
    await expect(window.getByTestId('import-summary')).toBeVisible();
    await collect();

    await window.getByRole('link', {name: 'Lochbänder'}).click();
    await expect(window.getByTestId('tape')).toHaveCount(1);
    await collect();

    await window.getByTestId('open-tape').click();
    await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText('Tonleiter');
    await collect();

    const visible = seen.join('\n') + rejection + violation;
    expect(visible).not.toMatch(/\bTAPE\.[A-Z_.]+/);
    expect(visible).not.toMatch(/\bORGAN\.[A-Z_.]+/);
    expect(visible).not.toMatch(/\bPAGES\.[A-Z_.]+/);
    await app.close();
  });
});
