declare const midiNoteNumberBrand: unique symbol;

/** MIDI note number of a note: an integer 0–127, 60 being middle C (C4). */
export type MidiNoteNumber = number & { readonly [midiNoteNumberBrand]: true };

/** The lowest note of the keyboard, MIDI 0 (C-1). */
export const LOWEST_NOTE = 0 as MidiNoteNumber;
/** The highest note of the keyboard, MIDI 127 (G9). */
export const HIGHEST_NOTE = 127 as MidiNoteNumber;

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** @returns the note number, or `undefined` if `value` is not an integer 0–127 */
export function midiNoteNumber(value: number): MidiNoteNumber | undefined {
  return Number.isInteger(value) && value >= 0 && value <= 127 ? (value as MidiNoteNumber) : undefined;
}

/** Scientific pitch notation with sharps, e.g. 60 → `C4`, 61 → `C#4`, 0 → `C-1`. */
export function noteName(note: MidiNoteNumber): string {
  const octave = Math.floor(note / 12) - 1;
  return `${PITCH_CLASSES[note % 12]}${octave}`;
}
