import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Fifths} from '../song/song';

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** How a pitch is written: its step, its accidental (−1 flat, 0 none, +1 sharp) and its octave (0–9). */
export interface Spelling {
  readonly step: Step;
  readonly alter: -1 | 0 | 1;
  readonly octave: number;
}

type Alter = -1 | 0 | 1;

const STEPS: readonly Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ALTERS: readonly Alter[] = [-1, 0, 1];
/** Semitones above C of each natural step. */
const NATURAL_SEMITONE: Readonly<Record<Step, number>> = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
/** The order in which a sharp key signature adds sharps, and a flat one adds flats. */
const SHARP_ORDER: readonly Step[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: readonly Step[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

/** The accidental the Key's signature gives a step. */
function keyAlter(step: Step, fifths: Fifths): Alter {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0;
  return 0;
}

/** Lower is better: in the Key, then natural, then the accidental the Key's direction prefers. */
function preference(step: Step, alter: Alter, fifths: Fifths): number {
  if (keyAlter(step, fifths) === alter) return 0;
  if (alter === 0) return 1;
  const preferred: Alter = fifths < 0 ? -1 : 1;
  return alter === preferred ? 2 : 3;
}

/** The octave of `written` when spelled as `step` with `alter` (MIDI 12 is C0). */
function octaveOf(written: number, step: Step, alter: Alter): number {
  return Math.floor((written - NATURAL_SEMITONE[step] - alter) / 12) - 1;
}

/**
 * How `pitch` is written in a Key of `fifths` (FR-007, FR-014, research R5). MIDI 0–11 are written one octave
 * up, at octave 0; a spelling that would land below octave 0 (B sharp at −1) is not used.
 */
export function spell(pitch: MidiNoteNumber, fifths: Fifths): Spelling {
  const written = pitch < 12 ? pitch + 12 : pitch;
  const topOctave = pitch < 12 ? 0 : 9;

  const candidates = STEPS.flatMap((step) =>
    ALTERS.filter((alter) => mod12(NATURAL_SEMITONE[step] + alter) === mod12(pitch)).map((alter) => ({step, alter})),
  );
  const ordered = [...candidates].sort(
    (a, b) => preference(a.step, a.alter, fifths) - preference(b.step, b.alter, fifths),
  );

  for (const {step, alter} of ordered) {
    const octave = octaveOf(written, step, alter);
    if (octave >= 0 && octave <= topOctave) return {step, alter, octave};
  }
  throw new Error(`no spelling for MIDI ${pitch} in fifths ${fifths}`);
}
