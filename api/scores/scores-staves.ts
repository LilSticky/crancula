import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Organ} from '../organ/organ';
import type {ScoresNote} from './close-gaps';

export type Clef = 'treble' | 'treble-8va' | 'bass' | 'bass-8vb';

/** One staff of the Scores, from the top (number 1) down. */
export interface Staff {
  readonly number: number;
  /** Lowest pitch of the range, or undefined for the bottom staff (reaches all the way down). */
  readonly from: MidiNoteNumber | undefined;
  /** First pitch above the range, or undefined for the top staff. */
  readonly below: MidiNoteNumber | undefined;
  readonly clef: Clef;
}

/** Middle C, the pitch that splits treble from bass (FR-006). */
const MIDDLE_C = 60;

/** Whether `pitch` lies in the range of the staff. */
function holds(staff: Pick<Staff, 'from' | 'below'>, pitch: number): boolean {
  return (staff.from === undefined || pitch >= staff.from) && (staff.below === undefined || pitch < staff.below);
}

/** The middle of the lowest and highest of `pitches`, or undefined when there are none. */
function middleOf(pitches: readonly number[]): number | undefined {
  if (pitches.length === 0) return undefined;
  return (Math.min(...pitches) + Math.max(...pitches)) / 2;
}

/**
 * The clef of a staff (FR-006, research R9): treble when the middle of its Pipes is middle C or above. A staff
 * without Pipes takes the middle of its notes, and a staff with neither its lower bound (the bottom staff: the
 * split note above it, less one).
 */
function clefOf(staff: Pick<Staff, 'from' | 'below'>, organ: Organ, notes: readonly ScoresNote[]): Clef {
  const pipes = organ.pipes.map((pipe) => pipe.note).filter((pitch) => holds(staff, pitch));
  const played = notes.map((note) => note.pitch).filter((pitch) => holds(staff, pitch));
  const reference = staff.from ?? (staff.below === undefined ? MIDDLE_C : staff.below - 1);
  const middle = middleOf(pipes) ?? middleOf(played) ?? reference;
  return middle >= MIDDLE_C ? 'treble' : 'bass';
}

/**
 * The staves of the Scores: one more than the split notes, which cut the pitches into ranges; the top staff
 * holds the highest range (FR-005, research R9). The split notes are sorted ascending and distinct.
 */
export function scoresStaves(
  splitNotes: readonly MidiNoteNumber[],
  organ: Organ,
  notes: readonly ScoresNote[],
): readonly Staff[] {
  const count = splitNotes.length;
  return Array.from({length: count + 1}, (_, index) => {
    const fromIndex = count - 1 - index;
    const from = fromIndex >= 0 ? splitNotes[fromIndex] : undefined;
    const below = index === 0 ? undefined : splitNotes[count - index];
    return {number: index + 1, from, below, clef: clefOf({from, below}, organ, notes)};
  });
}

/** The staff whose range holds `pitch` (every pitch is on exactly one staff). */
export function staffOf(pitch: MidiNoteNumber, staves: readonly Staff[]): Staff {
  const staff = staves.find((candidate) => holds(candidate, pitch));
  if (staff === undefined) throw new Error(`no staff holds pitch ${pitch}`);
  return staff;
}
