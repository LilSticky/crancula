import {describe, expect, it} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import {fifthsOf, type Fifths} from '../song/song';
import {spell, type Spelling} from './spell';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function pitchOf(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `pitch ${value}`);
}

function keyOf(value: number): Fifths {
  return defined(fifthsOf(value), `fifths ${value}`);
}

/** Semitones above C of each step, for reading a Spelling back to its MIDI number. */
const SEMITONE_OF_STEP: Readonly<Record<Spelling['step'], number>> = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};

describe('spell', () => {
  it.each([
    {pitch: 60, fifths: 0, step: 'C', alter: 0, octave: 4},
    {pitch: 61, fifths: 0, step: 'C', alter: 1, octave: 4},
    {pitch: 70, fifths: 0, step: 'A', alter: 1, octave: 4},
    {pitch: 66, fifths: 1, step: 'F', alter: 1, octave: 4},
    {pitch: 70, fifths: -1, step: 'B', alter: -1, octave: 4},
    {pitch: 66, fifths: -1, step: 'G', alter: -1, octave: 4},
    {pitch: 65, fifths: 7, step: 'E', alter: 1, octave: 4},
    {pitch: 60, fifths: 7, step: 'B', alter: 1, octave: 3},
    {pitch: 59, fifths: -7, step: 'C', alter: -1, octave: 4},
  ])('spells MIDI $pitch in Key fifths $fifths as $step$alter at octave $octave', ({pitch, fifths, step, alter, octave}) => {
    expect(spell(pitchOf(pitch), keyOf(fifths))).toEqual({step, alter, octave});
  });

  it('spells every pitch from 12 to 127 so that its MIDI number is read back, in every Key', () => {
    for (let fifths = -7; fifths <= 7; fifths += 1) {
      for (let pitch = 12; pitch <= 127; pitch += 1) {
        const {step, alter, octave} = spell(pitchOf(pitch), keyOf(fifths));
        const readBack = (octave + 1) * 12 + SEMITONE_OF_STEP[step] + alter;
        expect(readBack, `MIDI ${pitch} in fifths ${fifths}`).toBe(pitch);
      }
    }
  });

  it('writes MIDI 0 to 11 one octave up, at octave 0, on the same pitch class', () => {
    for (let fifths = -7; fifths <= 7; fifths += 1) {
      for (let pitch = 0; pitch <= 11; pitch += 1) {
        const {step, alter, octave} = spell(pitchOf(pitch), keyOf(fifths));
        expect(octave, `octave for MIDI ${pitch} in fifths ${fifths}`).toBe(0);
        expect(((SEMITONE_OF_STEP[step] + alter) % 12 + 12) % 12, `pitch class for MIDI ${pitch} in fifths ${fifths}`).toBe(pitch % 12);
      }
    }
  });

  it('spells a B sharp that would land in octave -1 as C at octave 0', () => {
    // MIDI 0 written one octave up is MIDI 12, which C sharp major would spell B sharp -1.
    expect(spell(pitchOf(0), keyOf(7))).toEqual({step: 'C', alter: 0, octave: 0});
  });
});
