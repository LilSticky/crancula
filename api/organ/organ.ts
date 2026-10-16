import type {MidiNoteNumber} from './midi-note-number';

declare const organIdBrand: unique symbol;
declare const millimetresBrand: unique symbol;
declare const validOrganBrand: unique symbol;

/** Identifies an Organ independently of its name. */
export type OrganId = string & { readonly [organIdBrand]: true };

/** A finite length ≥ 0 in millimetres. */
export type Millimetres = number & { readonly [millimetresBrand]: true };

/** The surface in the Organ the Tape runs over while being played. */
export interface TapeBed {
  readonly tapeWidth: Millimetres;
  readonly holeDiameter: Millimetres;
  /** Centre-to-centre distance between neighbouring rows. */
  readonly rowSpacing: Millimetres;
}

/** Plays one note. Its position in {@link Organ.pipes} is its row on the Tape. */
export interface Pipe {
  readonly note: MidiNoteNumber;
}

/** A valid barrel Organ. Obtain one only through `validateOrgan` or the snapshot parser. */
export interface Organ {
  readonly id: OrganId;
  readonly name: string;
  readonly tapeBed: TapeBed;
  readonly minimumGap: Millimetres;
  /** Blank Tape before Column 1, with an angled start; 0 means none. */
  readonly leadIn: Millimetres;
  readonly pipes: readonly Pipe[];
  readonly [validOrganBrand]: true;
}

/** The fields of an {@link Organ}, before they are known to be valid together. */
export type OrganFields = Omit<Organ, typeof validOrganBrand>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @returns the id, or `undefined` if `value` is not a UUID */
export function organId(value: string): OrganId | undefined {
  return UUID.test(value) ? (value as OrganId) : undefined;
}

export function newOrganId(): OrganId {
  return crypto.randomUUID() as OrganId;
}

/** @returns the length, or `undefined` if `value` is negative or not finite */
export function millimetres(value: number): Millimetres | undefined {
  return Number.isFinite(value) && value >= 0 ? (value as Millimetres) : undefined;
}

/** Width the rows of `pipeCount` Pipes take across the Tape: outer edge of the first to the last Hole. */
export function rowSpan(tapeBed: {readonly holeDiameter: number; readonly rowSpacing: number}, pipeCount: number): number {
  return (pipeCount - 1) * tapeBed.rowSpacing + tapeBed.holeDiameter;
}

/** How the rows of `pipeCount` Pipes sit on a Tape Bed; the Border is negative if they do not fit. */
export interface TapeBedFit {
  readonly rowSpan: number;
  readonly border: number;
}

export function tapeBedFit(
  tapeBed: {readonly tapeWidth: number; readonly holeDiameter: number; readonly rowSpacing: number},
  pipeCount: number,
): TapeBedFit {
  const span = rowSpan(tapeBed, pipeCount);
  return {rowSpan: span, border: (tapeBed.tapeWidth - span) / 2};
}

/** The free margin on each side of the rows, which are centred on the Tape Bed. */
export function border(organ: Organ): number {
  return tapeBedFit(organ.tapeBed, organ.pipes.length).border;
}

/** The shortest Hole an Organ can play: its hole diameter. */
export function minimumHoleLength(tapeBed: TapeBed): Millimetres {
  return tapeBed.holeDiameter;
}

/**
 * Marks fields as a valid Organ. Only for `validateOrgan` and the snapshot parser, which check
 * every rule first; not exported from `api/index.ts`.
 */
export function asValidOrgan(fields: OrganFields): Organ {
  return fields as Organ;
}
