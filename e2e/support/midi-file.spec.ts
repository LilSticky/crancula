import {describe, expect, it} from 'vitest';
import {readMidiSong} from '../../api/song/midi/read-midi-song';
import {MIDI_FIXTURES, notAMidiFile} from './midi-file';

describe('e2e MIDI fixtures', () => {
  for (const {file, parts} of MIDI_FIXTURES) {
    const fixture = file();
    it(`${fixture.name} reads as a Song with ${parts} Part(s)`, () => {
      const result = readMidiSong(new Uint8Array(fixture.buffer), fixture.name);
      expect(result.ok && result.value.parts.length).toBe(parts);
    });
  }

  it('the non-MIDI file is rejected', () => {
    const fixture = notAMidiFile();
    expect(readMidiSong(new Uint8Array(fixture.buffer), fixture.name)).toEqual({ok: false, error: 'not-a-midi-file'});
  });
});
