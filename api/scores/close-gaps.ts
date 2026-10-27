import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Millimetres, Organ} from '../organ/organ';
import type {Column, ColumnCount, Hole} from '../tape/tape';

/** A Hole as the Scores write it: its Pipe's pitch, its start Column and its length after gap closing (FR-008). */
export interface ScoresNote {
  readonly pitch: MidiNoteNumber;
  readonly start: Column;
  readonly length: ColumnCount;
}

/**
 * The Minimum Gap of the Organ in whole Columns, rounded up (FR-008, research R6). The tolerance keeps an exact
 * multiple (6 mm over 3 mm) at its own count, as validateOrgan does.
 */
export function minimumGapColumns(organ: Organ, columnLength: Millimetres): number {
  return Math.ceil(organ.minimumGap / columnLength - 1e-9);
}

/**
 * The Holes as notes, with the gaps closed: a Hole is lengthened to the start of the next Hole of its Pipe when
 * the gap between them is at most `minimumGapColumns` and not zero (FR-008, Story 2.1). The last Hole of a Pipe
 * keeps its length, and touching Holes stay two notes. Works per Pipe, so a Hole of another Pipe closes nothing;
 * the result is sorted by Pipe, then start. The Holes given are not changed.
 */
export function closeGaps(holes: readonly Hole[], minimumGapColumns: number): readonly ScoresNote[] {
  const sorted = [...holes].sort((a, b) => a.pipe - b.pipe || a.start - b.start);
  return sorted.map((hole, index) => {
    const next = sorted[index + 1];
    const gap = next !== undefined && next.pipe === hole.pipe ? next.start - (hole.start + hole.length) : 0;
    const closes = gap > 0 && gap <= minimumGapColumns;
    return {
      pitch: hole.pipe,
      start: hole.start,
      length: (closes ? hole.length + gap : hole.length) as ColumnCount,
    };
  });
}
