import type {CrankSpeedRange} from './crank-speed-range';
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
  /** Distance from the guide edge of the Tape to the centre of row 1; absent when the rows are centred. */
  readonly guideMargin?: Millimetres;
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
  /** The Crank speeds the Organ's Preview and Crank slider cover. */
  readonly crankSpeedRange: CrankSpeedRange;
  /** Tape that passes the Tape Bed per turn of the Crank; absent until the Organ is set up for a Preview. */
  readonly tapePerCrankTurn?: Millimetres;
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

/** The free strips on the two long edges of the Tape, beside the rows. */
export interface Borders {
  /** The strip at the guide edge: the top edge of the Tape, row 1's side. */
  readonly guide: number;
  /** The strip at the far edge: the bottom edge of the Tape. */
  readonly far: number;
}

/** How the rows of `pipeCount` Pipes sit on a Tape Bed; the Borders are negative if they do not fit. */
export interface TapeBedFit {
  readonly rowSpan: number;
  readonly borders: Borders;
}

/**
 * Where the rows of `pipeCount` Pipes sit on the Tape Bed. Centred without a Guide margin; with one, the
 * guide side is the Guide margin less half a Hole, and the far side takes the rest.
 */
export function tapeBedFit(
  tapeBed: {
    readonly tapeWidth: number;
    readonly holeDiameter: number;
    readonly rowSpacing: number;
    readonly guideMargin?: number;
  },
  pipeCount: number,
): TapeBedFit {
  const span = rowSpan(tapeBed, pipeCount);
  if (tapeBed.guideMargin === undefined) {
    const side = (tapeBed.tapeWidth - span) / 2;
    return {rowSpan: span, borders: {guide: side, far: side}};
  }
  const guide = tapeBed.guideMargin - tapeBed.holeDiameter / 2;
  return {rowSpan: span, borders: {guide, far: tapeBed.tapeWidth - span - guide}};
}

/** The free strips on each long edge of the Tape: centred on the Tape Bed, or set by its Guide margin. */
export function borders(organ: Organ): Borders {
  return tapeBedFit(organ.tapeBed, organ.pipes.length).borders;
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
