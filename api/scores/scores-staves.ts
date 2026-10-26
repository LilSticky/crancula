import {HIGHEST_NOTE, LOWEST_NOTE, midiNoteNumber, type MidiNoteNumber} from '../organ/midi-note-number';
import type {Organ} from '../organ/organ';
import type {ScoresNote} from './close-gaps';

/** A clef without an octave sign: the notes sound where they are drawn. */
export type PlainClef = 'treble' | 'bass';

export type Clef = PlainClef | 'treble-8va' | 'bass-8vb';

/** One staff of the Scores, from the top (number 1) down. */
export interface Staff {
  readonly number: number;
  /** Lowest pitch of the range, or undefined for the bottom staff (reaches all the way down). */
  readonly from: MidiNoteNumber | undefined;
  /** First pitch above the range, or undefined for the top staff. */
  readonly below: MidiNoteNumber | undefined;
  readonly clef: Clef;
}

/** The lowest and highest notes a staff holds (FR-005). */
export interface StaffRange {
  readonly lowest: MidiNoteNumber;
  readonly highest: MidiNoteNumber;
}

/** Middle C, the pitch that splits treble from bass (FR-006). */
const MIDDLE_C = 60;

/**
 * Where each clef draws its staff: the diatonic positions of the bottom and top line (2 per line, 7 per octave,
 * C-1 at 0), and the octave the clef sign shifts the notes by (research R9).
 */
const CLEF_LAYOUT: Readonly<
  Record<Clef, {readonly bottomLine: number; readonly topLine: number; readonly octaveShift: number}>
> = {
  treble: {bottomLine: 30, topLine: 38, octaveShift: 0},
  'treble-8va': {bottomLine: 30, topLine: 38, octaveShift: -7},
  bass: {bottomLine: 18, topLine: 26, octaveShift: 0},
  'bass-8vb': {bottomLine: 18, topLine: 26, octaveShift: 7},
};

/** The diatonic step of each pitch class counted from C; a sharp takes the step below it. */
const STEP_OF_PITCH_CLASS: readonly number[] = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

/** Ledger lines an octave clef must save on more than half of the notes of a staff before it is used (R9). */
const LEDGER_LINES_SAVED = 3;

/** Whether `pitch` lies in the range of the staff. */
function holds(staff: Pick<Staff, 'from' | 'below'>, pitch: number): boolean {
  return (staff.from === undefined || pitch >= staff.from) && (staff.below === undefined || pitch < staff.below);
}

/**
 * The notes a staff holds, from its lowest to its highest, the keyboard's ends where the staff is open (FR-005).
 * A staff whose split note is 0 holds nothing; its highest note then reads as 0.
 */
export function staffRange(staff: Pick<Staff, 'from' | 'below'>): StaffRange {
  return {
    lowest: staff.from ?? LOWEST_NOTE,
    highest: staff.below === undefined ? HIGHEST_NOTE : (midiNoteNumber(staff.below - 1) ?? LOWEST_NOTE),
  };
}

/** The middle of the lowest and highest of `pitches`, or undefined when there are none. */
function middleOf(pitches: readonly number[]): number | undefined {
  if (pitches.length === 0) return undefined;
  return (Math.min(...pitches) + Math.max(...pitches)) / 2;
}

/** The diatonic position of a pitch, where the bottom line of the treble staff is 30 (E4). */
function positionOf(pitch: number): number {
  const octave = Math.floor(pitch / 12) - 1;
  return octave * 7 + (STEP_OF_PITCH_CLASS[pitch % 12] ?? 0);
}

/** The ledger lines a pitch needs on a clef: one for each line of the staff it lies beyond, none within it. */
function ledgerLinesOf(pitch: number, clef: Clef): number {
  const {bottomLine, topLine, octaveShift} = CLEF_LAYOUT[clef];
  const position = positionOf(pitch) + octaveShift;
  return Math.max(0, Math.floor((bottomLine - position) / 2), Math.floor((position - topLine) / 2));
}

/** The octave clef of a plain clef when it saves three ledger lines on more than half of the notes (FR-006, R9). */
function clefWithOctaveOf(plain: PlainClef, played: readonly number[]): Clef {
  if (played.length === 0) return plain;
  const octave: Clef = plain === 'treble' ? 'treble-8va' : 'bass-8vb';
  const saving = played.filter(
    (pitch) => ledgerLinesOf(pitch, plain) - ledgerLinesOf(pitch, octave) >= LEDGER_LINES_SAVED,
  ).length;
  return saving * 2 > played.length ? octave : plain;
}

/**
 * The clef of a staff (FR-006, research R9): treble when the middle of its Pipes is middle C or above. A staff
 * without Pipes takes the middle of its notes, and a staff with neither its lower bound (the bottom staff: the
 * split note above it, less one). The octave clef replaces the plain one when it saves ledger lines.
 */
function clefOf(staff: Pick<Staff, 'from' | 'below'>, organ: Organ, notes: readonly ScoresNote[]): Clef {
  const pipes = organ.pipes.map((pipe) => pipe.note).filter((pitch) => holds(staff, pitch));
  const played = notes.map((note) => note.pitch).filter((pitch) => holds(staff, pitch));
  const reference = staff.from ?? (staff.below === undefined ? MIDDLE_C : staff.below - 1);
  const middle = middleOf(pipes) ?? middleOf(played) ?? reference;
  return clefWithOctaveOf(middle >= MIDDLE_C ? 'treble' : 'bass', played);
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
