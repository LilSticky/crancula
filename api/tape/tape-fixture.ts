import {validTape, type Tape, type TapeFields} from './tape';

/** For specs: the Tape for fields that are valid together, Holes sorted for convenience; throws otherwise. */
export function tapeOf(fields: TapeFields): Tape {
  const holes = [...fields.holes].sort((a, b) => a.pipe - b.pipe || a.start - b.start);
  const result = validTape({...fields, holes});
  if (!result.ok) throw new Error(`invalid Tape fixture: ${result.error.code}`);
  return result.value;
}
