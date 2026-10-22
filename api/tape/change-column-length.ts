import {millimetres} from '../organ/organ';
import {err, ok, type Result} from '../result';
import {validTape, type Tape} from './tape';

/**
 * Gives the Tape a new Column length; the length in Columns and the Holes stay as they are.
 * Holes that become too short are not refused here: they are reported as Cutting Problems.
 * @returns the Tape (the same object if the Column length is unchanged), or an error if the value is not a finite number above 0
 */
export function changeColumnLength(tape: Tape, columnLength: number): Result<Tape, 'column-length-must-be-positive'> {
  if (columnLength === tape.columnLength) return ok(tape);
  const length = millimetres(columnLength);
  if (length === undefined) return err('column-length-must-be-positive');
  const changed = validTape({...tape, columnLength: length});
  return changed.ok ? ok(changed.value) : err('column-length-must-be-positive');
}
