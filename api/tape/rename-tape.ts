import {err, type Result} from '../result';
import {validTape, type Tape} from './tape';

/** Gives the Tape a new name (trimmed); everything else stays as it is. */
export function renameTape(tape: Tape, name: string): Result<Tape, 'name-required'> {
  const renamed = validTape({...tape, name});
  return renamed.ok ? renamed : err('name-required');
}
