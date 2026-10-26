import {millimetres, type Millimetres} from '../organ/organ';
import {err, ok, type Result} from '../result';
import {asValidRollPlotter, asValidSheetPlotter, newPlotterId, type Plotter} from './plotter';
import type {PlotterDraft} from './plotter-draft';

export type PlotterViolationCode =
  | 'name-required'
  | 'value-required'
  | 'must-be-positive'
  | 'overlap-not-below-working-length';

/** A field of a Plotter that a rule can point at. */
export type PlotterField = 'name' | 'workingWidth' | 'workingLength' | 'overlap';

/** A rule a {@link PlotterDraft} breaks, located by the field it concerns. */
export interface PlotterViolation {
  readonly code: PlotterViolationCode;
  readonly path: PlotterField;
  readonly params?: Readonly<Record<string, number>>;
}

/**
 * Checks every rule of a Plotter. A roll Plotter is checked for its name and working width only;
 * its working length and Overlap are not its to have.
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
    if (violations.length > 0 || workingWidth === undefined) return err(violations);
    return ok(asValidRollPlotter({id, name, format: 'svg', roll: true, workingWidth}));
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
