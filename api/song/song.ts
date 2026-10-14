import type {MidiNoteNumber} from '../organ/midi-note-number';

declare const songIdBrand: unique symbol;
declare const tickBrand: unique symbol;
declare const ticksPerQuarterBrand: unique symbol;
declare const partIndexBrand: unique symbol;
declare const validNoteBrand: unique symbol;
declare const validPartBrand: unique symbol;
declare const validSongBrand: unique symbol;

/** Identifies a Song independently of its name. */
export type SongId = string & { readonly [songIdBrand]: true };

/** A point in time of a Song: an integer ≥ 0 and < 2^31. */
export type Tick = number & { readonly [tickBrand]: true };

/** The number of Ticks in a quarter note: an integer 1–32767. */
export type TicksPerQuarter = number & { readonly [ticksPerQuarterBrand]: true };

/** The position of a Part within its Song. */
export type PartIndex = number & { readonly [partIndexBrand]: true };

/** One note of a Part. Loudness, instrument and tempo are not kept. */
export interface Note {
  readonly noteNumber: MidiNoteNumber;
  readonly start: Tick;
  /** 0 is allowed. */
  readonly duration: Tick;
  readonly [validNoteBrand]: true;
}

/** The Notes of one voice of a Song, sorted by start, then note number. */
export interface Part {
  readonly name: string | undefined;
  readonly percussion: boolean;
  readonly notes: readonly Note[];
  readonly [validPartBrand]: true;
}

/** A valid Song. Obtain one only through {@link song}. */
export interface Song {
  readonly id: SongId;
  readonly name: string;
  readonly ticksPerQuarter: TicksPerQuarter;
  readonly parts: readonly Part[];
  readonly [validSongBrand]: true;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TICK_LIMIT = 2 ** 31;
const MAXIMUM_TICKS_PER_QUARTER = 32767;

/** @returns the id, or `undefined` if `value` is not a UUID */
export function songId(value: string): SongId | undefined {
  return UUID.test(value) ? (value as SongId) : undefined;
}

export function newSongId(): SongId {
  return crypto.randomUUID() as SongId;
}

/** @returns the Tick, or `undefined` if `value` is not an integer ≥ 0 and < 2^31 */
export function tick(value: number): Tick | undefined {
  return Number.isInteger(value) && value >= 0 && value < TICK_LIMIT ? (value as Tick) : undefined;
}

/** @returns the value, or `undefined` if `value` is not an integer 1–32767 */
export function ticksPerQuarter(value: number): TicksPerQuarter | undefined {
  return Number.isInteger(value) && value >= 1 && value <= MAXIMUM_TICKS_PER_QUARTER
    ? (value as TicksPerQuarter)
    : undefined;
}

/** @returns the index, or `undefined` if `value` is not a position in a Song of `partCount` Parts */
export function partIndex(value: number, partCount: number): PartIndex | undefined {
  return Number.isInteger(value) && value >= 0 && value < partCount ? (value as PartIndex) : undefined;
}

export function note(fields: Omit<Note, typeof validNoteBrand>): Note | undefined {
  return fields.start + fields.duration < TICK_LIMIT ? (fields as Note) : undefined;
}

function isSorted(notes: readonly Note[]): boolean {
  return notes.every((current, index) => {
    const previous = notes[index - 1];
    return (
      previous === undefined ||
      previous.start < current.start ||
      (previous.start === current.start && previous.noteNumber <= current.noteNumber)
    );
  });
}

/** @returns the Part with a trimmed name, or `undefined` if a rule of the data model is broken */
export function part(fields: Omit<Part, typeof validPartBrand>): Part | undefined {
  const name = fields.name?.trim();
  if (name === '' || fields.notes.length === 0 || !isSorted(fields.notes)) return undefined;
  return {...fields, name} as Part;
}

/** @returns the Song with a trimmed name, or `undefined` if a rule of the data model is broken */
export function song(fields: Omit<Song, typeof validSongBrand>): Song | undefined {
  const name = fields.name.trim();
  if (name === '' || fields.parts.length === 0) return undefined;
  return {...fields, name} as Song;
}

/** Every non-percussion Part. */
export function defaultSelectedParts(of: Song): ReadonlySet<PartIndex> {
  return new Set(
    of.parts.flatMap((candidate, index) => (candidate.percussion ? [] : [index as PartIndex])),
  );
}
