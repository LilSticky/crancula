import {crankSpeed, type CrankSpeed, MAX_CRANK_SPEED, MIN_CRANK_SPEED} from '../tape/crank-speed';
import {err, ok, type Result} from '../result';
import {crankSpeedRange, type CrankSpeedRange} from './crank-speed-range';
import {midiNoteNumber, type MidiNoteNumber, noteName} from './midi-note-number';
import {asValidOrgan, type Millimetres, millimetres, newOrganId, type Organ, rowSpan, type TapeBed} from './organ';
import type {OrganDraft} from './organ-draft';

export type OrganViolationCode =
  | 'name-required'
  | 'pipes-required'
  | 'pipe-note-required'
  | 'pipe-note-out-of-range'
  | 'duplicate-pipe'
  | 'value-required'
  | 'crank-speed-out-of-range'
  | 'slowest-not-below-fastest'
  | 'must-be-positive'
  | 'must-not-be-negative'
  | 'row-spacing-below-hole-diameter'
  | 'pipes-exceed-tape-width'
  | 'tape-per-crank-turn-not-positive';

/** A rule an {@link OrganDraft} breaks, located by the dotted path of the offending field. */
export interface OrganViolation {
  readonly code: OrganViolationCode;
  /** e.g. `name`, `pipes.3.note`, `tapeBed.tapeWidth` */
  readonly path: string;
  readonly params?: Readonly<Record<string, string | number>>;
}

/** Tolerance for comparing lengths computed from decimal millimetres. */
const EPSILON_MM = 1e-9;

/**
 * Checks every rule of an Organ (spec FR-007 to FR-010).
 * @returns the valid Organ, or all violations found
 */
export function validateOrgan(draft: OrganDraft): Result<Organ, OrganViolation[]> {
  const violations: OrganViolation[] = [];
  const add = (violation: OrganViolation): void => {
    violations.push(violation);
  };

  const name = draft.name.trim();
  if (name === '') add({code: 'name-required', path: 'name'});

  const notes = validateNotes(draft, add);
  const tapeBed = validateTapeBed(draft, add);
  const minimumGap = measurement(draft.minimumGap, 'minimumGap', add);
  const leadIn = measurement(draft.leadIn, 'leadIn', add, true);
  const tapePerCrankTurn = optionalPositive(draft.tapePerCrankTurn, add);
  const crankSpeeds = validateCrankSpeedRange(draft, add);

  if (tapeBed && draft.pipes.length > 0) {
    const required = rowSpan(tapeBed, draft.pipes.length);
    if (required > tapeBed.tapeWidth + EPSILON_MM) {
      add({
        code: 'pipes-exceed-tape-width',
        path: 'tapeBed.tapeWidth',
        params: {requiredWidth: roundMm(required), availableWidth: tapeBed.tapeWidth},
      });
    }
  }

  if (violations.length > 0 || !notes || !tapeBed || minimumGap === undefined || leadIn === undefined || crankSpeeds === undefined) {
    return err(violations);
  }
  return ok(
    asValidOrgan({
      id: draft.id ?? newOrganId(),
      name,
      tapeBed,
      minimumGap,
      leadIn,
      crankSpeedRange: crankSpeeds,
      ...(tapePerCrankTurn === undefined ? {} : {tapePerCrankTurn}),
      pipes: notes.map((note) => ({note})),
    }),
  );
}

type AddViolation = (violation: OrganViolation) => void;

function validateNotes(draft: OrganDraft, add: AddViolation): MidiNoteNumber[] | undefined {
  if (draft.pipes.length === 0) {
    add({code: 'pipes-required', path: 'pipes'});
    return undefined;
  }

  const notes: (MidiNoteNumber | undefined)[] = draft.pipes.map(({note}, row) => {
    const path = `pipes.${row}.note`;
    if (note === null || !Number.isFinite(note)) {
      add({code: 'pipe-note-required', path});
      return undefined;
    }
    const valid = midiNoteNumber(note);
    if (valid === undefined) add({code: 'pipe-note-out-of-range', path, params: {note}});
    return valid;
  });

  notes.forEach((note, row) => {
    if (note !== undefined && notes.indexOf(note) !== notes.lastIndexOf(note)) {
      add({code: 'duplicate-pipe', path: `pipes.${row}.note`, params: {noteName: noteName(note)}});
    }
  });

  return notes.every((note) => note !== undefined) && new Set(notes).size === notes.length
    ? (notes as MidiNoteNumber[])
    : undefined;
}

function validateTapeBed(draft: OrganDraft, add: AddViolation): TapeBed | undefined {
  const {tapeBed} = draft;
  const tapeWidth = measurement(tapeBed.tapeWidth, 'tapeBed.tapeWidth', add);
  const holeDiameter = measurement(tapeBed.holeDiameter, 'tapeBed.holeDiameter', add);
  const rowSpacing = measurement(tapeBed.rowSpacing, 'tapeBed.rowSpacing', add);

  if (holeDiameter !== undefined && rowSpacing !== undefined && rowSpacing < holeDiameter) {
    add({code: 'row-spacing-below-hole-diameter', path: 'tapeBed.rowSpacing', params: {holeDiameter}});
    return undefined;
  }
  if (tapeWidth === undefined || holeDiameter === undefined || rowSpacing === undefined) {
    return undefined;
  }
  return {tapeWidth, holeDiameter, rowSpacing};
}

function measurement(
  value: number | null,
  path: string,
  add: AddViolation,
  allowZero = false,
): Millimetres | undefined {
  if (value === null || !Number.isFinite(value)) {
    add({code: 'value-required', path});
    return undefined;
  }
  if (allowZero ? value < 0 : value <= 0) {
    add({code: allowZero ? 'must-not-be-negative' : 'must-be-positive', path});
    return undefined;
  }
  return millimetres(value);
}

/** Both Crank speeds are required; the slowest must be below the fastest. */
function validateCrankSpeedRange(draft: OrganDraft, add: AddViolation): CrankSpeedRange | undefined {
  const slowest = crankSpeedMeasure(draft.slowestCrankSpeed, 'slowestCrankSpeed', add);
  const fastest = crankSpeedMeasure(draft.fastestCrankSpeed, 'fastestCrankSpeed', add);
  if (slowest === undefined || fastest === undefined) return undefined;
  if (slowest >= fastest) {
    add({code: 'slowest-not-below-fastest', path: 'fastestCrankSpeed'});
    return undefined;
  }
  return crankSpeedRange(slowest, fastest);
}

function crankSpeedMeasure(value: number | null, path: string, add: AddViolation): CrankSpeed | undefined {
  if (value === null) {
    add({code: 'value-required', path});
    return undefined;
  }
  const valid = crankSpeed(value);
  if (valid === undefined) {
    add({code: 'crank-speed-out-of-range', path, params: {min: MIN_CRANK_SPEED, max: MAX_CRANK_SPEED}});
  }
  return valid;
}

/** Absent (`null`, or missing from untyped input) is valid; a given value must be finite and above 0. */
function optionalPositive(value: number | null, add: AddViolation): Millimetres | undefined {
  if (value === null || value === undefined) return undefined;
  const valid = Number.isFinite(value) && value > 0 ? millimetres(value) : undefined;
  if (valid === undefined) add({code: 'tape-per-crank-turn-not-positive', path: 'tapePerCrankTurn'});
  return valid;
}

function roundMm(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
