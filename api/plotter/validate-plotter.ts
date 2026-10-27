import {millimetres, type Millimetres} from '../organ/organ';
import {err, ok, type Result} from '../result';
import {asValidRollPlotter, asValidSheetPlotter, newPlotterId, type Plotter} from './plotter';
import type {PlotterDraft} from './plotter-draft';

export type PlotterViolationCode =
  | 'name-required'
  | 'value-required'
  | 'must-be-positive'
  | 'must-not-be-negative'
  | 'overlap-not-below-working-length';

/** A field of a Plotter that a rule can point at. */
export type PlotterField = 'name' | 'workingWidth' | 'workingLength' | 'overlap' | 'tapeSpacing';

/** A rule a {@link PlotterDraft} breaks, located by the field it concerns. */
export interface PlotterViolation {
  readonly code: PlotterViolationCode;
  readonly path: PlotterField;
  readonly params?: Readonly<Record<string, number>>;
}

/**
 * Checks every rule of a Plotter. A roll Plotter is checked for its name, working width and Tape spacing
 * only; its working length and Overlap are not its to have.
 * @returns the valid Plotter, or all violations found
 */
export function validatePlotter(draft: PlotterDraft): Result<Plotter, PlotterViolation[]> {
  const violations: PlotterViolation[] = [];
  const add = (violation: PlotterViolation): void => {
    violations.push(violation);
  };

  const name = draft.name.trim();
  if (name === '') add({code: 'name-required', path: 'name'});

  const workingWidth = measurement(draft.workingWidth, 'workingWidth', add);
  const id = draft.id ?? newPlotterId();

  if (draft.roll) {
    const tapeSpacing = spacing(draft.tapeSpacing, add);
    if (violations.length > 0 || workingWidth === undefined || tapeSpacing === undefined) return err(violations);
    return ok(asValidRollPlotter({id, name, format: 'svg', roll: true, workingWidth, tapeSpacing}));
  }

  const workingLength = measurement(draft.workingLength, 'workingLength', add);
  const overlap = measurement(draft.overlap, 'overlap', add);
  if (workingLength !== undefined && overlap !== undefined && overlap >= workingLength) {
    add({code: 'overlap-not-below-working-length', path: 'overlap', params: {workingLength}});
  }

  if (violations.length > 0 || workingWidth === undefined || workingLength === undefined || overlap === undefined) {
    return err(violations);
  }
  return ok(asValidSheetPlotter({id, name, format: 'svg', roll: false, workingWidth, workingLength, overlap}));
}

/** @returns the length, or `undefined` after reporting why it is not a usable measurement */
function measurement(value: number | null, path: PlotterField, add: (violation: PlotterViolation) => void): Millimetres | undefined {
  if (value === null || !Number.isFinite(value)) {
    add({code: 'value-required', path});
    return undefined;
  }
  if (value <= 0) {
    add({code: 'must-be-positive', path});
    return undefined;
  }
  return millimetres(value);
}

/** @returns the Tape spacing, or `undefined` after reporting why it is not usable; 0 is a spacing that makes Tapes touch */
function spacing(value: number | null, add: (violation: PlotterViolation) => void): Millimetres | undefined {
  if (value === null || !Number.isFinite(value)) {
    add({code: 'value-required', path: 'tapeSpacing'});
    return undefined;
  }
  if (value < 0) {
    add({code: 'must-not-be-negative', path: 'tapeSpacing'});
    return undefined;
  }
  return millimetres(value);
}
