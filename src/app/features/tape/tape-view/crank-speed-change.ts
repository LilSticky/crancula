import {changeCrankSpeed, type Tape} from '@api/index';
import {parseDecimal} from '../../shared/format-number';

/** What the typed Crank speed does to the Tape: nothing, something that is not a Crank speed, or a changed Tape. */
export type CrankSpeedChange = {readonly state: 'unchanged'} | {readonly state: 'invalid'} | {readonly state: 'ready'; readonly tape: Tape};

/** Works out the change the typed text would make to the Crank speed of the Tape. */
export function crankSpeedChange(tape: Tape, typed: string): CrankSpeedChange {
  return crankSpeedChangeTo(tape, parseDecimal(typed));
}

/** The same as `crankSpeedChange`, for a Crank speed that is already a number; `null` is no Crank speed, `NaN` is not one. */
export function crankSpeedChangeTo(tape: Tape, speed: number | null): CrankSpeedChange {
  if (speed === null) return {state: 'unchanged'};
  if (speed === tape.crankSpeed) return {state: 'unchanged'};

  const changed = changeCrankSpeed(tape, speed);
  if (!changed.ok) return {state: 'invalid'};
  return {state: 'ready', tape: changed.value};
}
