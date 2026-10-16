import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {PartIndex} from '../song/song';
import type {Column, ColumnCount, Transposition} from './tape';

/** A change made to a Hole so the Tape can be cut (FR-008, FR-012). Columns count from 0. */
export type HoleFix =
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

/** A Note put on a Pipe an octave or more away from its transposed Note. */
export interface NoteMovedByOctaves {
  readonly part: PartIndex;
  readonly noteNumber: MidiNoteNumber;
  readonly pipe: MidiNoteNumber;
  readonly octaves: number;
  readonly column: Column;
}

/** A Note no Pipe can play, even moved by octaves. It stays off the Tape. */
export interface UnplayableNote {
  readonly part: PartIndex;
  readonly noteNumber: MidiNoteNumber;
  readonly column: Column;
}

/** What bringing a Song onto a Tape changed. Columns count from 0. */
export interface ImportSummary {
  readonly transposition: Transposition;
  readonly notesOnTape: number;
  readonly movedByOctaves: readonly NoteMovedByOctaves[];
  readonly unplayableNotes: readonly UnplayableNote[];
  readonly holesFixed: readonly HoleFix[];
}
