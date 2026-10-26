import type {MidiNoteNumber} from '../organ/midi-note-number';

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
