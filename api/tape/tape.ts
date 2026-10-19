import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Millimetres, OrganId} from '../organ/organ';
import type {PartIndex, SongId} from '../song/song';
import {err, ok, type Result} from '../result';

declare const tapeIdBrand: unique symbol;
declare const columnBrand: unique symbol;
declare const columnCountBrand: unique symbol;
declare const transpositionBrand: unique symbol;
declare const validTapeBrand: unique symbol;

/** Identifies a Tape independently of its name. */
export type TapeId = string & { readonly [tapeIdBrand]: true };

/** A position on a Tape: an integer ≥ 0, counted from the Tape's start. */
export type Column = number & { readonly [columnBrand]: true };

/** A length in Columns: an integer ≥ 1. */
export type ColumnCount = number & { readonly [columnCountBrand]: true };

/** A shift in semitones: an integer from -127 to +127. */
export type Transposition = number & { readonly [transpositionBrand]: true };

/** A punched opening in one row of a Tape. It belongs to its Pipe, not to a row. */
export interface Hole {
  readonly pipe: MidiNoteNumber;
  readonly start: Column;
  readonly length: ColumnCount;
}

/** A valid Tape. Obtain one only through `createTape` or the snapshot parser. */
export interface Tape {
  readonly id: TapeId;
  readonly name: string;
  readonly organId: OrganId;
  readonly songId: SongId | undefined;
  /** Set exactly when {@link songId} is set. Sorted ascending, unique, non-empty. */
  readonly selectedParts: readonly PartIndex[] | undefined;
  readonly transposition: Transposition;
  readonly columnLength: Millimetres;
  /** Stored, because removing Holes must not change it. */
  readonly length: ColumnCount;
  /** Sorted by pipe, then start. May be empty. */
  readonly holes: readonly Hole[];
  readonly [validTapeBrand]: true;
}

/** The fields of a {@link Tape}, before they are known to be valid together. */
export type TapeFields = Omit<Tape, typeof validTapeBrand>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAXIMUM_TRANSPOSITION = 127;

/** @returns the id, or `undefined` if `value` is not a UUID */
export function tapeId(value: string): TapeId | undefined {
  return UUID.test(value) ? (value as TapeId) : undefined;
}

export function newTapeId(): TapeId {
  return crypto.randomUUID() as TapeId;
}

/** @returns the Column, or `undefined` if `value` is not an integer ≥ 0 */
export function column(value: number): Column | undefined {
  return Number.isInteger(value) && value >= 0 ? (value as Column) : undefined;
}

/** @returns the count, or `undefined` if `value` is not an integer ≥ 1 */
export function columnCount(value: number): ColumnCount | undefined {
  return Number.isInteger(value) && value >= 1 ? (value as ColumnCount) : undefined;
}

/** @returns the Transposition, or `undefined` if `value` is not an integer from -127 to 127 */
export function transposition(value: number): Transposition | undefined {
  return Number.isInteger(value) && Math.abs(value) <= MAXIMUM_TRANSPOSITION
    ? (value as Transposition)
    : undefined;
}

export function tapeLengthInMillimetres(tape: Tape): Millimetres {
  return (tape.length * tape.columnLength) as Millimetres;
}

/** The Tape without the Holes of the given Pipes; its length stays. */
export function removeHolesOfPipes(tape: Tape, pipes: ReadonlySet<MidiNoteNumber>): Tape {
  const result = validTape({...tape, holes: tape.holes.filter((hole) => !pipes.has(hole.pipe))});
  if (!result.ok) throw new Error(`removing Holes broke a Tape rule: ${result.error.code}`);
  return result.value;
}

export type TapeRuleViolationCode =
  | 'name-blank'
  | 'song-reference-incomplete'
  | 'selected-parts-invalid'
  | 'hole-beyond-end'
  | 'holes-not-sorted'
  | 'holes-overlap';

/** The first Tape rule that fields break; `hole` is set for `hole-beyond-end`. */
export interface TapeRuleViolation {
  readonly code: TapeRuleViolationCode;
  readonly hole?: Hole;
}

/**
 * The one way to a {@link Tape}: checks every rule that holds on the Tape alone.
 * @returns the Tape (name trimmed), or the first rule the fields break
 */
export function validTape(fields: TapeFields): Result<Tape, TapeRuleViolation> {
  const name = fields.name.trim();
  if (name === '') return err({code: 'name-blank'});
  if ((fields.songId === undefined) !== (fields.selectedParts === undefined)) {
    return err({code: 'song-reference-incomplete'});
  }
  if (fields.selectedParts && !isSortedUniqueNonEmpty(fields.selectedParts)) {
    return err({code: 'selected-parts-invalid'});
  }
  const beyondEnd = fields.holes.find((hole) => hole.start + hole.length > fields.length);
  if (beyondEnd) return err({code: 'hole-beyond-end', hole: beyondEnd});
  for (let index = 1; index < fields.holes.length; index++) {
    const previous = fields.holes[index - 1];
    const hole = fields.holes[index];
    if (hole.pipe < previous.pipe || (hole.pipe === previous.pipe && hole.start < previous.start)) {
      return err({code: 'holes-not-sorted'});
    }
    if (hole.pipe === previous.pipe && hole.start < previous.start + previous.length) {
      return err({code: 'holes-overlap'});
    }
  }
  return ok({...fields, name} as Tape);
}

function isSortedUniqueNonEmpty(parts: readonly number[]): boolean {
  return parts.length > 0 && parts.every((part, index) => index === 0 || part > parts[index - 1]);
}
