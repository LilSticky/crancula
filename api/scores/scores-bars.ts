import type {Song} from '../song/song';
import type {Column, ColumnCount, Tape} from '../tape/tape';
import type {ChosenTimeSignature, ScoresChoices} from './scores-choices';

/** A Bar of the Scores: number 0 for the upbeat, then 1, 2, …; the last one is full (FR-011). */
export interface Bar {
  readonly number: number;
  readonly start: Column;
  readonly length: ColumnCount;
}

/** Columns in a full Bar: 32 Columns make a whole note (research R3). */
function fullBarColumns(timeSignature: ChosenTimeSignature): number {
  return (timeSignature.beats * 32) / timeSignature.beatType;
}

/**
 * The Bars that cover the Tape from Column 0 with one Time signature and an upbeat (research R3). Song Time
 * signatures are not laid out yet.
 */
export function scoresBars(tape: Tape, song: Song | undefined, choices: ScoresChoices): readonly Bar[] {
  if (choices.timeSignature === 'song') throw new Error('Song Time signatures are not laid out yet');
  const full = fullBarColumns(choices.timeSignature);

  const bars: Bar[] = [];
  let number = 0;
  let start = 0;
  if (choices.upbeat > 0) {
    bars.push({number, start: start as Column, length: choices.upbeat as ColumnCount});
    number += 1;
    start += choices.upbeat;
  }
  while (start < tape.length) {
    bars.push({number, start: start as Column, length: full as ColumnCount});
    number += 1;
    start += full;
  }
  return bars;
}
