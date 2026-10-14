import type {Organ} from '../organ/organ';
import type {PartIndex, Song} from '../song/song';
import {octaveMoveTable} from './octave-moves';
import type {Transposition} from './tape';

/** How the selected Notes meet the Organ's Pipes. The three counts add up to the Notes. */
export interface Fit {
  readonly matchingAPipe: number;
  readonly movedByOctaves: number;
  readonly unplayable: number;
}

export function fitOf(
  song: Song,
  selectedParts: ReadonlySet<PartIndex>,
  organ: Organ,
  transposition: Transposition,
): Fit {
  const table = octaveMoveTable(organ);
  let matchingAPipe = 0;
  let movedByOctaves = 0;
  let unplayable = 0;
  song.parts.forEach((each, index) => {
    if (!selectedParts.has(index as PartIndex)) return;
    for (const note of each.notes) {
      const shifted = note.noteNumber + transposition;
      const pipe = table[shifted];
      if (pipe === undefined) unplayable++;
      else if (pipe === shifted) matchingAPipe++;
      else movedByOctaves++;
    }
  });
  return {matchingAPipe, movedByOctaves, unplayable};
}
