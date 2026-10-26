import {Injectable} from '@angular/core';
import {type Field, type FieldTree, type SchemaPath, validateTree, type ValidationError} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {type PlotterDraft, type PlotterViolation, type PlotterViolationCode, validatePlotter} from '@api/index';
import type {TranslatableText} from '../../shared/leave-unsaved/leave-unsaved.guard';

/**
 * A rule of the Plotter that the editor's form reports at a field. `kind` is the code of the domain
 * violation, which carries the field and parameters.
 */
export interface PlotterFieldError extends ValidationError.WithFieldTree {
  readonly kind: PlotterViolationCode;
  readonly violation: PlotterViolation;
}

export function isPlotterFieldError(error: unknown): error is PlotterFieldError {
  return typeof error === 'object' && error !== null && 'violation' in error && 'fieldTree' in error;
}

/**
 * The schema of the Plotter editor's form. It has one rule: `validatePlotter`, the only place where the
 * rules of a Plotter live. Each domain violation becomes an error at the field its path names.
 */
export function plotterFormSchema(plotter: SchemaPath<PlotterDraft>): void {
  validateTree(plotter, ({value, fieldTree}) => {
    const result = validatePlotter(value());
    return result.ok
      ? undefined
      : result.error.map((violation): PlotterFieldError => ({kind: violation.code, violation, fieldTree: fieldTree[violation.path]}));
  });
}

/** Violations about missing input wait until their field was edited; wrong values show right away. */
const MISSING_VALUE_CODES: ReadonlySet<PlotterViolationCode> = new Set(['name-required', 'value-required']);

/** Whether the user should see this error now, given whether the user edited its field. */
function isShown(error: PlotterFieldError, dirty: boolean): boolean {
  return dirty || !MISSING_VALUE_CODES.has(error.kind);
}

function violationMessage(error: PlotterFieldError): TranslatableText {
  return {key: `PLOTTER.ERROR.${error.kind.toUpperCase().replace(/-/g, '_')}`, params: error.violation.params ?? {}};
}

/** The messages of a field that the user should see now. */
export function shownMessages(field: FieldTree<unknown>): readonly TranslatableText[] {
  const dirty = field().dirty();
  return field()
    .errors()
    .flatMap((error) => (isPlotterFieldError(error) && isShown(error, dirty) ? [violationMessage(error)] : []));
}

/** Puts a Material input in its error state exactly while the editor shows a message for its field. */
@Injectable()
export class ShownViolationMatcher extends ErrorStateMatcher {
  override isSignalErrorState(field: Field<unknown> | null): boolean {
    if (!field) return false;
    const state = field();
    const dirty = state.dirty();
    return state.errors().some((error) => isPlotterFieldError(error) && isShown(error, dirty));
  }
}
