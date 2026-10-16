import {expect, type Page} from '@playwright/test';
import {encodeSmf, type SmfTimedEvent} from '../../api/song/midi/smf-test-helper';
import {type MidiFilePayload} from './midi-file';
import {saveOrgan} from './organ-editor';

const TICKS_PER_QUARTER = 480;

/** Defines an Organ with the 25 Pipes C4 to C6 (MIDI 60 to 84) and stores it. */
export async function defineOctaveOrgan(window: Page, name: string): Promise<void> {
  await window.getByRole('link', {name: 'Organs'}).click();
  await window.getByTestId('new-organ').click();
  await window.getByTestId('name').fill(name);
  await window.getByTestId('tape-width').fill('120');
  await window.getByTestId('hole-diameter').fill('2.5');
  await window.getByTestId('row-spacing').fill('3.5');
  await window.getByTestId('minimum-gap').fill('1.5');
  await window.getByTestId('lead-in').fill('20');
  for (let row = 0; row < 25; row++) {
    await window.getByTestId('add-pipe').click();
    await window.getByTestId('pipe-note').nth(row).fill(String(60 + row));
  }
  await saveOrgan(window);
  await expect(window).toHaveURL(/#?\/organs\/[0-9a-f-]{36}$/);
}

/**
 * A Song of one Part that plays C4 `repeats` times and then D4 once; each note lasts one quarter
 * and is followed by a quarter of rest, so no two Holes touch.
 */
export function songRepeatingC4(fileName: string, repeats: number): MidiFilePayload {
  const events: SmfTimedEvent[] = [];
  for (const note of [...Array.from({length: repeats}, () => 60), 62]) {
    events.push(
      {delta: events.length === 0 ? 0 : TICKS_PER_QUARTER, event: {type: 'noteOn', channel: 0, note, velocity: 80}},
      {delta: TICKS_PER_QUARTER, event: {type: 'noteOff', channel: 0, note, velocity: 0}},
    );
  }
  const bytes = encodeSmf({format: 1, division: {ticksPerQuarterNote: TICKS_PER_QUARTER}, tracks: [{events}]});
  return {name: fileName, mimeType: 'audio/midi', buffer: Buffer.from(bytes)};
}

/** Brings the Song onto a new Tape of the only stored Organ and waits for the Tape to be stored. */
export async function createTapeFromSong(window: Page, tapeName: string, song: MidiFilePayload): Promise<void> {
  await window.getByRole('link', {name: 'Tapes'}).click();
  await window.getByTestId('new-tape').click();
  await window.getByTestId('song-file').setInputFiles(song);
  await expect(window.getByTestId('name')).not.toHaveValue(''); // The suggested name arrives once the Song is read.
  await expect(window.getByTestId('song-rejection')).toHaveCount(0);
  await window.getByTestId('name').fill(tapeName);
  await expect(window.getByTestId('name')).toHaveValue(tapeName);
  await window.getByTestId('create-tape').click();
  await expect(window).toHaveURL(/#?\/tapes\/[0-9a-f-]{36}$/);
  await expect(window.getByTestId('tape-name').getByRole('heading', {level: 1})).toHaveText(tapeName);
}
