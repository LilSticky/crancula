import {err, ok, type Result} from '../result';
import type {Tape} from './tape';

/** Gives the Tape a new name (trimmed); everything else stays as it is. */
export function renameTape(tape: Tape, name: string): Result<Tape, 'name-required'> {
  const trimmed = name.trim();
  return trimmed === '' ? err('name-required') : ok({...tape, name: trimmed});
}
