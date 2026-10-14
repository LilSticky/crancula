import type {MidiNoteNumber} from '../organ/midi-note-number';
import type {Millimetres, OrganId} from '../organ/organ';
import type {PartIndex, SongId} from '../song/song';

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

export function tapeLengthInMillimetres(tape: Tape): number {
  return tape.length * tape.columnLength;
}

/** The Tape without the Holes of the given Pipes; its length stays. */
export function removeHolesOfPipes(tape: Tape, pipes: ReadonlySet<MidiNoteNumber>): Tape {
  return {...tape, holes: tape.holes.filter((hole) => !pipes.has(hole.pipe))};
}

/**
 * Marks fields as a valid Tape. Only for `createTape` and the snapshot parser, which check
 * every rule first; not exported from `api/index.ts`.
 */
export function asValidTape(fields: TapeFields): Tape {
  return fields as Tape;
}
