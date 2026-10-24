import {crankSpeed, type CrankSpeed} from '../tape/crank-speed';

/** The Crank speeds an Organ's Tape can be played at, from the slowest to the fastest, with slowest below fastest. */
export interface CrankSpeedRange {
  readonly slowest: CrankSpeed;
  readonly fastest: CrankSpeed;
}

/** The range of an Organ that has none stored yet (version 1 to 4 snapshots, and new Organs). */
export const DEFAULT_CRANK_SPEED_RANGE: CrankSpeedRange = {
  slowest: 30 as CrankSpeed,
  fastest: 120 as CrankSpeed,
};

/** @returns the range, or `undefined` unless both are Crank speeds and `slowest` is below `fastest` */
export function crankSpeedRange(slowest: number, fastest: number): CrankSpeedRange | undefined {
  const low = crankSpeed(slowest);
  const high = crankSpeed(fastest);
  return low !== undefined && high !== undefined && low < high ? {slowest: low, fastest: high} : undefined;
}

/**
 * Where a Crank speed sits on the slider of an Organ's range: the speed itself when inside,
 * otherwise the nearest end of the range, with `outside` set.
 */
export function nearestInRange(speed: CrankSpeed, range: CrankSpeedRange): {value: CrankSpeed; outside: boolean} {
  if (speed < range.slowest) return {value: range.slowest, outside: true};
  if (speed > range.fastest) return {value: range.fastest, outside: true};
  return {value: speed, outside: false};
}
