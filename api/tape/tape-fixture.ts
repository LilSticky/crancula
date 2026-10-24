import {DEFAULT_CRANK_SPEED, type CrankSpeed} from './crank-speed';
import {validTape, type Tape, type TapeFields} from './tape';

/** The fields of a Tape for specs; the Crank speed defaults to {@link DEFAULT_CRANK_SPEED}. */
export type TapeFixtureFields = Omit<TapeFields, 'crankSpeed'> & { readonly crankSpeed?: CrankSpeed };

/** For specs: the Tape for fields that are valid together, Holes sorted for convenience; throws otherwise. */
export function tapeOf(fields: TapeFixtureFields): Tape {
  const holes = [...fields.holes].sort((a, b) => a.pipe - b.pipe || a.start - b.start);
  const result = validTape({...fields, crankSpeed: fields.crankSpeed ?? DEFAULT_CRANK_SPEED, holes});
  if (!result.ok) throw new Error(`invalid Tape fixture: ${result.error.code}`);
  return result.value;
}
