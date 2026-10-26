import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Column, ColumnCount} from '../tape/tape';

/** A Hole as the Scores write it: its Pipe's pitch, its start Column and its length after gap closing (FR-008). */
export interface ScoresNote {
  readonly pitch: MidiNoteNumber;
  readonly start: Column;
  readonly length: ColumnCount;
}
