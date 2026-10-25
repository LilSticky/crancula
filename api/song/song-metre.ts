import type {Key, Song, TimeSignature} from './song';

/** The first Time signature, Key and upbeat of a Song, as shown read-only next to it (US4). */
export interface SongMetre {
  readonly timeSignature?: Pick<TimeSignature, 'beats' | 'beatType'>;
  readonly key?: Pick<Key, 'fifths' | 'mode'>;
  /** The upbeat as a fraction of a whole note in lowest terms: 1 quarter is 1/4. */
  readonly upbeat?: {readonly numerator: number; readonly denominator: number};
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/** The upbeat of a Song as a fraction of a whole note, in lowest terms. */
function fractionOfWhole(upbeat: number, ticksPerQuarter: number): {numerator: number; denominator: number} {
  const whole = 4 * ticksPerQuarter;
  const divisor = greatestCommonDivisor(upbeat, whole);
  return {numerator: upbeat / divisor, denominator: whole / divisor};
}

/** The first Time signature, the first Key and the upbeat of a Song; whatever the Song does not keep is left out. */
export function songMetre(song: Song): SongMetre {
  const [timeSignature] = song.timeSignatures;
  const [key] = song.keys;
  return {
    ...(timeSignature === undefined ? {} : {timeSignature: {beats: timeSignature.beats, beatType: timeSignature.beatType}}),
    ...(key === undefined ? {} : {key: {fifths: key.fifths, mode: key.mode}}),
    ...(song.upbeat === undefined ? {} : {upbeat: fractionOfWhole(song.upbeat, song.ticksPerQuarter)}),
  };
}
