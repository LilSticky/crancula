import type {Millimetres} from '../organ/organ';

declare const plotterIdBrand: unique symbol;
declare const validPlotterBrand: unique symbol;

/** Identifies a Plotter independently of its name. */
export type PlotterId = string & {readonly [plotterIdBrand]: true};

/** The Overlap a Plotter starts with, in millimetres: the strip that lies under the next Tape piece. */
export const DEFAULT_OVERLAP = 20;

/** What every Plotter has: a name, the file format it cuts and its working width. */
interface PlotterBase {
  readonly id: PlotterId;
  readonly name: string;
  readonly format: 'svg';
  /** The widest Tape the Plotter cuts in one go. */
  readonly workingWidth: Millimetres;
  readonly [validPlotterBrand]: true;
}

/** A Plotter that cuts up to its working length; a longer Tape is cut in Tape pieces that overlap by its Overlap. */
export interface SheetPlotter extends PlotterBase {
  readonly roll: false;
  /** The longest Tape the Plotter cuts in one go. */
  readonly workingLength: Millimetres;
  readonly overlap: Millimetres;
}

/** A roll Plotter (a vinyl cutter) cuts near-endless lengths: it has no working length and never splits a Tape. */
export interface RollPlotter extends PlotterBase {
  readonly roll: true;
}

/** A valid Plotter. Obtain one only through `validatePlotter` or the snapshot parser. */
export type Plotter = SheetPlotter | RollPlotter;

/** The fields of a {@link SheetPlotter}, before they are known to be valid together. */
export type SheetPlotterFields = Omit<SheetPlotter, typeof validPlotterBrand>;

/** The fields of a {@link RollPlotter}, before they are known to be valid together. */
export type RollPlotterFields = Omit<RollPlotter, typeof validPlotterBrand>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @returns the id, or `undefined` if `value` is not a UUID */
export function plotterId(value: string): PlotterId | undefined {
  return UUID.test(value) ? (value as PlotterId) : undefined;
}

export function newPlotterId(): PlotterId {
  return crypto.randomUUID() as PlotterId;
}

/**
 * Marks fields as a valid sheet Plotter. Only for `validatePlotter` and the snapshot parser, which check
 * every rule first; not exported from `api/index.ts`.
 */
export function asValidSheetPlotter(fields: SheetPlotterFields): SheetPlotter {
  return fields as SheetPlotter;
}

/**
 * Marks fields as a valid roll Plotter. Only for `validatePlotter` and the snapshot parser, which check
 * every rule first; not exported from `api/index.ts`.
 */
export function asValidRollPlotter(fields: RollPlotterFields): RollPlotter {
  return fields as RollPlotter;
}
