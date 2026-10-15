import {inject, Injectable, signal} from '@angular/core';
import {
  type Field,
  type FieldTree,
  type ReadonlyFieldTree,
  type SchemaPath,
  validateTree,
  type ValidationError,
} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {type OrganDraft, type OrganViolation, type OrganViolationCode, validateOrgan} from '@api/index';
import type {TranslatableText} from '../leave-unsaved.guard';

/**
 * A rule of the Organ that the editor's form reports at a field. `kind` is the code of the domain
 * violation, which carries the path and parameters.
 */
export interface OrganFieldError extends ValidationError.WithFieldTree {
  readonly kind: OrganViolationCode;
  readonly violation: OrganViolation;
}

export function isOrganFieldError(error: unknown): error is OrganFieldError {
  return typeof error === 'object' && error !== null && 'violation' in error && 'fieldTree' in error;
}

/**
 * The schema of the Organ editor's form. It has one rule: `validateOrgan`, the only place where the
 * rules of an Organ live. Each domain violation becomes an error at the field its path names.
 */
export function organFormSchema(organ: SchemaPath<OrganDraft>): void {
  validateTree(organ, ({value, fieldTree}) => {
    const result = validateOrgan(value());
    return result.ok ? undefined : result.error.map((violation) => toFieldError(violation, fieldTree));
  });
}

function toFieldError(violation: OrganViolation, organ: ReadonlyFieldTree<OrganDraft>): OrganFieldError {
  return {kind: violation.code, violation, fieldTree: fieldAt(organ, violation.path)};
}

type TapeBedField = keyof OrganDraft['tapeBed'];
const TAPE_BED_FIELDS: readonly TapeBedField[] = ['tapeWidth', 'holeDiameter', 'rowSpacing'];

/** The field a violation path like `name`, `tapeBed.tapeWidth` or `pipes.3.note` points to; else the whole Organ. */
function fieldAt(organ: ReadonlyFieldTree<OrganDraft>, path: string): ReadonlyFieldTree<unknown> {
  const [head, ...rest] = path.split('.');
  switch (head) {
    case 'name':
      return organ.name;
    case 'minimumGap':
      return organ.minimumGap;
    case 'tapeBed': {
      const field = TAPE_BED_FIELDS.find((candidate) => candidate === rest[0]);
      return field ? organ.tapeBed[field] : organ;
    }
    case 'pipes': {
      if (rest.length === 0) return organ.pipes;
      return organ.pipes[Number(rest[0])]?.note ?? organ.pipes;
    }
    default:
      return organ;
  }
}

/** Violations about missing input wait until their field was edited; wrong values show right away. */
const MISSING_VALUE_CODES: ReadonlySet<OrganViolationCode> = new Set([
  'name-required',
  'pipes-required',
  'pipe-note-required',
  'value-required',
]);

/**
 * Whether the user should see this error now.
 * @param dirty whether the user edited the field the error belongs to
 */
export function isShown(error: OrganFieldError, dirty: boolean): boolean {
  return dirty || !MISSING_VALUE_CODES.has(error.kind);
}

/** The text of a number field could not be read as a number; the form keeps the previous value. */
function isNotANumber(error: ValidationError): boolean {
  return error.kind === 'parse';
}

const NOT_A_NUMBER: TranslatableText = {key: 'ORGAN.EDITOR.NOT_A_NUMBER', params: {}};

function violationMessage(error: OrganFieldError): TranslatableText {
  return {key: `ORGAN.VIOLATION.${error.kind.toUpperCase().replace(/-/g, '_')}`, params: error.violation.params ?? {}};
}

/** The messages of a field that the user should see now. */
export function shownMessages(field: FieldTree<unknown>, organ: FieldTree<OrganDraft>, saveAttempted = false): readonly TranslatableText[] {
  // "Add at least one Pipe" belongs to the whole Organ: show it once anything was edited.
  const dirty = saveAttempted || (field === organ.pipes ? organ().dirty() : field().dirty());
  return field()
    .errors()
    .flatMap((error) => {
      if (isNotANumber(error)) return [NOT_A_NUMBER];
      // The fit check says it; the field only takes the error state.
      if (isOrganFieldError(error) && error.kind === 'pipes-exceed-tape-width') return [];
      return isOrganFieldError(error) && isShown(error, dirty) ? [violationMessage(error)] : [];
    });
}

/** A rule the Organ breaks, located by the path of the field it belongs to (as in `OrganViolation`). */
export interface FieldProblem {
  readonly path: string;
  readonly message: TranslatableText;
}

/** Every problem of the form, shown or not: the broken rules and the number fields with unreadable text. */
export function organProblems(organ: FieldTree<OrganDraft>): readonly FieldProblem[] {
  return organ()
    .errorSummary()
    .flatMap((error): FieldProblem[] => {
      if (isOrganFieldError(error)) return [{path: error.violation.path, message: violationMessage(error)}];
      const path = isNotANumber(error) ? pathOf(organ, error.fieldTree) : undefined;
      return path === undefined ? [] : [{path, message: NOT_A_NUMBER}];
    });
}

/** The label key of each field that has one fixed label, in reading order; Pipe notes are labelled by their row. */
export const FIELD_LABEL_KEYS: Readonly<Record<string, string>> = {
  name: 'ORGAN.EDITOR.NAME',
  'tapeBed.tapeWidth': 'ORGAN.EDITOR.TAPE_WIDTH',
  'tapeBed.holeDiameter': 'ORGAN.EDITOR.HOLE_DIAMETER',
  'tapeBed.rowSpacing': 'ORGAN.EDITOR.ROW_SPACING',
  minimumGap: 'ORGAN.EDITOR.MINIMUM_GAP',
  pipes: 'ORGAN.EDITOR.PIPES',
};

/** A field with problems, as an entry of the error summary. */
export interface ProblemField {
  readonly path: string;
  readonly label: TranslatableText;
}

const PIPE_ROW = /^pipes\.(\d+)\./;

/** Where a field comes in reading order: the fixed fields before the Pipe rows (by number), the Pipes as a whole last. */
function readingPosition(path: string): readonly [number, number] {
  const row = PIPE_ROW.exec(path)?.[1];
  const fixed = Object.keys(FIELD_LABEL_KEYS);
  if (row !== undefined) return [fixed.length - 1, Number(row)];
  const index = fixed.indexOf(path);
  return [index === -1 ? fixed.length : index, -1];
}

/** The fields that have problems, each once, in reading order, with the label the error summary shows. */
export function problemFields(problems: readonly FieldProblem[]): readonly ProblemField[] {
  return [...new Set(problems.map(({path}) => path))]
    .map((path): ProblemField => {
      const row = PIPE_ROW.exec(path)?.[1];
      const label: TranslatableText =
        row === undefined ? {key: FIELD_LABEL_KEYS[path] ?? path, params: {}} : {key: 'ORGAN.EDITOR.ROW', params: {row: Number(row) + 1}};
      return {path, label};
    })
    .sort((a, b) => {
      const [aGroup, aRow] = readingPosition(a.path);
      const [bGroup, bRow] = readingPosition(b.path);
      return aGroup - bGroup || aRow - bRow;
    });
}

/** The path of an input field of the Organ, as used by `OrganViolation`. */
function pathOf(organ: ReadonlyFieldTree<OrganDraft>, field: ReadonlyFieldTree<unknown>): string | undefined {
  const paths = [
    'name',
    ...TAPE_BED_FIELDS.map((tapeBedField) => `tapeBed.${tapeBedField}`),
    'minimumGap',
    ...Array.from({length: organ.pipes.length}, (_, row) => `pipes.${row}.note`),
  ];
  return paths.find((path) => fieldAt(organ, path) === field);
}

/** Whether the user pressed Save on an invalid Organ: from then on every message shows, edited or not. */
@Injectable()
export class SaveAttempt {
  readonly attempted = signal(false);
}

/** Puts a Material input in its error state exactly while the editor shows a message for its field. */
@Injectable()
export class ShownViolationMatcher extends ErrorStateMatcher {
  private readonly saveAttempt = inject(SaveAttempt);

  override isSignalErrorState(field: Field<unknown> | null): boolean {
    if (!field) return false;
    const state = field();
    const dirty = this.saveAttempt.attempted() || state.dirty();
    return state.errors().some((error) => isNotANumber(error) || (isOrganFieldError(error) && isShown(error, dirty)));
  }
}

/** The input fields of the Organ whose change the editor reports; every Pipe change counts as `pipes`. */
export type ChangedField = 'name' | `tapeBed.${TapeBedField}` | 'minimumGap' | 'pipes';

/** The fields of `draft` that differ from the `saved` draft, in reading order; `pipes` once for any Pipe change. */
export function changedFields(saved: OrganDraft, draft: OrganDraft): readonly ChangedField[] {
  const changed: ChangedField[] = [];
  if (saved.name !== draft.name) changed.push('name');
  for (const field of TAPE_BED_FIELDS) {
    if (saved.tapeBed[field] !== draft.tapeBed[field]) changed.push(`tapeBed.${field}`);
  }
  if (saved.minimumGap !== draft.minimumGap) changed.push('minimumGap');
  const pipesChanged =
    saved.pipes.length !== draft.pipes.length || saved.pipes.some((pipe, row) => pipe.note !== draft.pipes[row]?.note);
  if (pipesChanged) changed.push('pipes');
  return changed;
}
