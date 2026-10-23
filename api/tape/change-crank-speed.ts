import {err, ok, type Result} from '../result';
import {crankSpeed} from './crank-speed';
import {validTape, type Tape} from './tape';

/**
 * Gives the Tape a new Crank speed; the Holes, the Columns and the Column length stay as they are.
 * @returns the Tape (the same object if the Crank speed is unchanged), or an error if the value is not finite or outside 1 to 300
 */
export function changeCrankSpeed(tape: Tape, speed: number): Result<Tape, 'crank-speed-out-of-range'> {
  if (speed === tape.crankSpeed) return ok(tape);
  const value = crankSpeed(speed);
  if (value === undefined) return err('crank-speed-out-of-range');
  const changed = validTape({...tape, crankSpeed: value});
  return changed.ok ? ok(changed.value) : err('crank-speed-out-of-range');
}
