import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Column, ColumnCount} from '../tape/tape';
import type {Bar} from './scores-bars';
import type {Chord} from './voices';

/**
 * The part of a chord that lies in one Bar (research R7): the Columns it covers there, and whether the chord
 * goes on over the Bar line before it or after it, which makes the note tied to the Bar next to it.
 */
export interface Piece {
  readonly start: Column;
  readonly length: ColumnCount;
  /** Ascending, at least one. */
  readonly pitches: readonly MidiNoteNumber[];
  readonly tiedFromBefore: boolean;
  readonly tiedToAfter: boolean;
}

/** The pieces of the chords that lie in the Bar, cut at its start and end, in time order. */
export function piecesIn(bar: Bar, chords: readonly Chord[]): readonly Piece[] {
  const barEnd = bar.start + bar.length;
  return chords.flatMap((chord) => {
    const chordEnd = chord.start + chord.length;
    const start = Math.max(chord.start, bar.start);
    const end = Math.min(chordEnd, barEnd);
    if (start >= end) return [];
    return [
      {
        start: start as Column,
        length: (end - start) as ColumnCount,
        pitches: chord.pitches,
        tiedFromBefore: chord.start < bar.start,
        tiedToAfter: chordEnd > barEnd,
      },
    ];
  });
}
