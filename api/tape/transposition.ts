import type {Organ} from '../organ/organ';
import type {PartIndex, Song} from '../song/song';
import {transposition, type Transposition} from './tape';

const NOTE_NUMBERS = 128;
const HIGHEST_NOTE_NUMBER = NOTE_NUMBERS - 1;

/** The Transpositions that keep every selected Note within 0 to 127. */
export interface AllowedTranspositions {
  readonly lowest: Transposition;
  readonly highest: Transposition;
}

function validTransposition(value: number): Transposition {
  const result = transposition(value);
  if (result === undefined) throw new Error(`invalid Transposition ${value}`);
  return result;
}

function histogram(song: Song, selected: ReadonlySet<PartIndex>): number[] {
  const counts = new Array<number>(NOTE_NUMBERS).fill(0);
  song.parts.forEach((each, index) => {
    if (!selected.has(index as PartIndex)) return;
    for (const note of each.notes) counts[note.noteNumber] = (counts[note.noteNumber] ?? 0) + 1;
  });
  return counts;
}

export function allowedTranspositions(
  song: Song,
  selected: ReadonlySet<PartIndex>,
): AllowedTranspositions {
  const counts = histogram(song, selected);
  const used = counts.flatMap((count, noteNumber) => (count > 0 ? [noteNumber] : []));
  const lowestNote = used[0] ?? 0;
  const highestNote = used[used.length - 1] ?? HIGHEST_NOTE_NUMBER;
  return {
    lowest: validTransposition(-lowestNote),
    highest: validTransposition(HIGHEST_NOTE_NUMBER - highestNote),
  };
}

/**
 * The Transposition with most Notes landing directly on a Pipe; on a tie the fewest semitones,
 * then upward. Visits 0, +1, -1, +2, -2, ... and keeps the first strictly better score.
 */
export function proposeTransposition(
  song: Song,
  selected: ReadonlySet<PartIndex>,
  organ: Organ,
): Transposition {
  const counts = histogram(song, selected);
  const {lowest, highest} = allowedTranspositions(song, selected);
  const scoreOf = (shift: number): number =>
    organ.pipes.reduce((sum, pipe) => sum + (counts[pipe.note - shift] ?? 0), 0);

  let best = 0;
  let bestScore = scoreOf(0);
  for (let distance = 1; distance <= HIGHEST_NOTE_NUMBER; distance++) {
    for (const shift of [distance, -distance]) {
      if (shift < lowest || shift > highest) continue;
      const score = scoreOf(shift);
      if (score > bestScore) {
        best = shift;
        bestScore = score;
      }
    }
  }
  return validTransposition(best);
}
