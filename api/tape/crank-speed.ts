declare const crankSpeedBrand: unique symbol;

/** How fast the user turns the Crank, in turns per minute: finite, from 1 to 300. */
export type CrankSpeed = number & { readonly [crankSpeedBrand]: true };

export const MIN_CRANK_SPEED = 1;
export const MAX_CRANK_SPEED = 300;

/** The Crank speed of a new Tape. */
export const DEFAULT_CRANK_SPEED = 60 as CrankSpeed;

/** @returns the Crank speed, or `undefined` if `value` is not finite or outside 1 to 300 */
export function crankSpeed(value: number): CrankSpeed | undefined {
  return Number.isFinite(value) && value >= MIN_CRANK_SPEED && value <= MAX_CRANK_SPEED
    ? (value as CrankSpeed)
    : undefined;
}
