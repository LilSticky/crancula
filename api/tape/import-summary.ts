import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Column, ColumnCount} from './tape';

/** A change made to a Hole so the Tape can be cut (FR-008, FR-012). Columns count from 0. */
export type HoleChange =
  | {readonly kind: 'overlap-merged'; readonly pipe: MidiNoteNumber; readonly column: Column}
  | {
      readonly kind: 'lengthened';
      readonly pipe: MidiNoteNumber;
      readonly column: Column;
      readonly from: ColumnCount;
      readonly to: ColumnCount;
    }
  | {
      readonly kind: 'shortened';
      readonly pipe: MidiNoteNumber;
      readonly column: Column;
      readonly from: ColumnCount;
      readonly to: ColumnCount;
    }
  | {
      readonly kind: 'repetition-merged';
      readonly pipe: MidiNoteNumber;
      readonly column: Column;
      readonly lostColumn: Column;
    };
