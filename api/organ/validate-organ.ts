import {err, ok, type Result} from '../result';
import {midiNoteNumber, type MidiNoteNumber, noteName} from './midi-note-number';
import {asValidOrgan, type Millimetres, millimetres, newOrganId, type Organ, requiredTapeWidth, type TapeBed} from './organ';
import type {OrganDraft} from './organ-draft';

export type OrganViolationCode =
  | 'name-required'
  | 'pipes-required'
  | 'pipe-note-required'
  | 'pipe-note-out-of-range'
  | 'duplicate-pipe'
  | 'value-required'
  | 'must-be-positive'
  | 'must-not-be-negative'
  | 'row-spacing-below-hole-diameter'
  | 'pipes-exceed-tape-width';

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
  const minimumGap = measurement(draft.minimumGap, 'minimumGap', 'positive', add);

  if (tapeBed && draft.pipes.length > 0) {
    const required = requiredTapeWidth(tapeBed, draft.pipes.length);
    if (required > tapeBed.tapeWidth + EPSILON_MM) {
      add({
        code: 'pipes-exceed-tape-width',
        path: 'tapeBed.tapeWidth',
        params: {requiredWidth: roundMm(required), availableWidth: tapeBed.tapeWidth},
      });
    }
  }

  if (violations.length > 0 || !notes || !tapeBed || minimumGap === undefined) return err(violations);
  return ok(
    asValidOrgan({
      id: draft.id ?? newOrganId(),
      name,
      tapeBed,
      minimumGap,
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
  const tapeWidth = measurement(tapeBed.tapeWidth, 'tapeBed.tapeWidth', 'positive', add);
  const border = measurement(tapeBed.border, 'tapeBed.border', 'non-negative', add);
  const holeDiameter = measurement(tapeBed.holeDiameter, 'tapeBed.holeDiameter', 'positive', add);
  const rowSpacing = measurement(tapeBed.rowSpacing, 'tapeBed.rowSpacing', 'positive', add);

  if (holeDiameter !== undefined && rowSpacing !== undefined && rowSpacing < holeDiameter) {
    add({code: 'row-spacing-below-hole-diameter', path: 'tapeBed.rowSpacing', params: {holeDiameter}});
    return undefined;
  }
  if (tapeWidth === undefined || border === undefined || holeDiameter === undefined || rowSpacing === undefined) {
    return undefined;
  }
  return {tapeWidth, border, holeDiameter, rowSpacing};
}

function measurement(
  value: number | null,
  path: string,
  bound: 'positive' | 'non-negative',
  add: AddViolation,
): Millimetres | undefined {
  if (value === null || !Number.isFinite(value)) {
    add({code: 'value-required', path});
    return undefined;
  }
  if (bound === 'positive' && value <= 0) {
    add({code: 'must-be-positive', path});
    return undefined;
  }
  if (bound === 'non-negative' && value < 0) {
    add({code: 'must-not-be-negative', path});
    return undefined;
  }
  return millimetres(value);
}

function roundMm(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
