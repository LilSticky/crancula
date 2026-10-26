import type {MidiNoteNumber} from '../organ/midi-note-number';

/** The beat types the export dialog offers (FR-004); the Song model also allows 64. */
export type ScoresBeatType = 1 | 2 | 4 | 8 | 16 | 32;

/** A Time signature chosen for the whole Tape in the export dialog. */
export interface ChosenTimeSignature {
  /** Whole, 1–99. */
  readonly beats: number;
  readonly beatType: ScoresBeatType;
}

/** What one export uses; prefilled, never stored on the Tape (spec: "Export choices"). */
export interface ScoresChoices {
  /** 'song': the Song's Time signatures at their Columns; else one for the whole Tape. */
  readonly timeSignature: 'song' | ChosenTimeSignature;
  /** In Columns; 0 is no upbeat. */
  readonly upbeat: number;
  /** Sorted ascending, distinct, each 0–127; empty is one staff. */
  readonly splitNotes: readonly MidiNoteNumber[];
}
