import type {Key, Song} from '../song/song';
import {columnOfTick} from '../tape/quantisation';

export type KeyFields = Pick<Key, 'fifths' | 'mode'>;

/** The Key of a Tape without a Song, or a Song without Keys (research R4). */
const C_MAJOR: KeyFields = {fifths: 0, mode: 'major'};

/**
 * The Key the Scores carry at a Column: the last Key of the Song that starts at or before it, from its own Column on;
 * C major before the first one, and for a Tape without a Song (research R4).
 */
export function scoresKeyAt(song: Song | undefined, column: number): KeyFields {
  if (song === undefined) return C_MAJOR;
  const current = song.keys.filter((key) => columnOfTick(key.start, song.ticksPerQuarter) <= column).at(-1);
  return current === undefined ? C_MAJOR : {fifths: current.fifths, mode: current.mode};
}
