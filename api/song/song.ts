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

export type BeatType = 1 | 2 | 4 | 8 | 16 | 32 | 64;

export type Mode = 'major' | 'minor';

const BEAT_TYPES = [1, 2, 4, 8, 16, 32, 64] as const;

/** @returns the beat type, or `undefined` if `value` is not 1, 2, 4, 8, 16, 32 or 64 */
export function beatTypeOf(value: number): BeatType | undefined {
  return BEAT_TYPES.find((candidate) => candidate === value);
}

/** @returns the mode, or `undefined` if `value` is neither `'major'` nor `'minor'` */
export function modeOf(value: unknown): Mode | undefined {
  return value === 'major' || value === 'minor' ? value : undefined;
}

/** From `start`, the Bars have `beats` beats of `beatType`. */
export interface TimeSignature {
  readonly start: Tick;
  /** An integer 1–99. `3+2` is read as 5. */
  readonly beats: number;
  readonly beatType: BeatType;
}

/** From `start`, the Key has `fifths` sharps (positive) or flats (negative) in `mode`. */
export interface Key {
  readonly start: Tick;
  /** An integer −7…7. */
  readonly fifths: number;
  readonly mode: Mode;
}

/** A valid Song. Obtain one only through {@link song}. */
export interface Song {
  readonly id: SongId;
  readonly name: string;
  readonly ticksPerQuarter: TicksPerQuarter;
  readonly parts: readonly Part[];
  /** Sorted by start, starts distinct; empty when the Song Source gives none. */
  readonly timeSignatures: readonly TimeSignature[];
  /** Shorter than the first Bar, only with a Time signature at Tick 0; `undefined` when none. */
  readonly upbeat: Tick | undefined;
  /** Sorted by start, starts distinct; empty when none. */
  readonly keys: readonly Key[];
  readonly [validSongBrand]: true;
}

/** The fields of a Song; the Time signatures, upbeat and Keys may be left out. */
export type SongFields = Omit<Song, typeof validSongBrand | 'timeSignatures' | 'upbeat' | 'keys'> & {
  readonly timeSignatures?: readonly TimeSignature[];
  readonly upbeat?: Tick;
  readonly keys?: readonly Key[];
};

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

/** True when each start is later than the one before it. */
function startsIncrease(starts: readonly Tick[]): boolean {
  return starts.every((start, index) => {
    const previous = starts[index - 1];
    return previous === undefined || previous < start;
  });
}

const MAXIMUM_BEATS = 99;
const MAXIMUM_FIFTHS = 7;

function timeSignaturesValid(timeSignatures: readonly TimeSignature[]): boolean {
  return (
    startsIncrease(timeSignatures.map((each) => each.start)) &&
    timeSignatures.every(
      (each) =>
        Number.isInteger(each.beats) &&
        each.beats >= 1 &&
        each.beats <= MAXIMUM_BEATS &&
        beatTypeOf(each.beatType) !== undefined,
    )
  );
}

function keysValid(keys: readonly Key[]): boolean {
  return (
    startsIncrease(keys.map((each) => each.start)) &&
    keys.every(
      (each) =>
        Number.isInteger(each.fifths) &&
        Math.abs(each.fifths) <= MAXIMUM_FIFTHS &&
        modeOf(each.mode) !== undefined,
    )
  );
}

/** The length of a Bar in Ticks: `beats × ticksPerQuarter × 4 / beatType`. */
function barLength(timeSignature: TimeSignature, perQuarter: TicksPerQuarter): number {
  return (timeSignature.beats * perQuarter * 4) / timeSignature.beatType;
}

/** An upbeat is a Bar shorter than the first Bar, which starts at Tick 0 with a Time signature. */
function upbeatValid(upbeat: Tick | undefined, timeSignatures: readonly TimeSignature[], perQuarter: TicksPerQuarter): boolean {
  if (upbeat === undefined) return true;
  const first = timeSignatures[0];
  return upbeat > 0 && first !== undefined && first.start === 0 && upbeat < barLength(first, perQuarter);
}

/** @returns the Song with a trimmed name, or `undefined` if a rule of the data model is broken */
export function song(fields: SongFields): Song | undefined {
  const name = fields.name.trim();
  const timeSignatures = fields.timeSignatures ?? [];
  const keys = fields.keys ?? [];
  const upbeat = fields.upbeat;
  if (name === '' || fields.parts.length === 0) return undefined;
  if (!timeSignaturesValid(timeSignatures) || !keysValid(keys)) return undefined;
  if (!upbeatValid(upbeat, timeSignatures, fields.ticksPerQuarter)) return undefined;
  return {...fields, name, timeSignatures, upbeat, keys} as Song;
}

/** Every non-percussion Part. */
export function defaultSelectedParts(of: Song): ReadonlySet<PartIndex> {
  return new Set(
    of.parts.flatMap((candidate, index) => (candidate.percussion ? [] : [index as PartIndex])),
  );
}
