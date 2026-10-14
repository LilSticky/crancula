import {midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import type {Organ} from '../organ/organ';

const NOTE_NUMBERS = 128;
const OCTAVE = 12;

/**
 * For each note number 0-127, the Pipe that plays it: itself, else the Pipe of the same pitch
 * class that is nearest by whole octaves (upward on a tie), else `undefined` (Unplayable Note).
 */
export function octaveMoveTable(organ: Organ): readonly (MidiNoteNumber | undefined)[] {
  const pipes = organ.pipes.map((pipe) => pipe.note);
  return Array.from({length: NOTE_NUMBERS}, (_, noteNumber) => {
    let best: MidiNoteNumber | undefined;
    for (const pipe of pipes) {
      if ((pipe - noteNumber) % OCTAVE !== 0) continue;
      if (best === undefined) {
        best = pipe;
        continue;
      }
      const distance = Math.abs(pipe - noteNumber);
      const bestDistance = Math.abs(best - noteNumber);
      if (distance < bestDistance || (distance === bestDistance && pipe > best)) best = pipe;
    }
    return best === undefined ? undefined : midiNoteNumber(best);
  });
}
