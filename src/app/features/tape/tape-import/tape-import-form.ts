import {Injectable, type Signal} from '@angular/core';
import {
  type Field,
  type FieldTree,
  type ReadonlyFieldTree,
  type SchemaPath,
  validateTree,
  type ValidationError,
} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {createTape, defaultSelectedParts, type Organ, type Song, transposition, type TapeViolationCode} from '@api/index';
import type {TranslatableText} from '../../organ/leave-unsaved.guard';

/** What the user enters on the import page; the Parts are the Song's default Parts. */
export interface TapeImportDraft {
  readonly name: string;
  /** In millimetres. */
  readonly columnLength: number | null;
  readonly transposition: number | null;
}

/** The Song and the Organ the draft is checked against; present once both were chosen. */
export interface TapeImportContext {
  readonly song: Song;
  readonly organ: Organ;
}

/** A rule of the Tape that the import form reports at a field. `kind` is the code of the domain violation. */
export interface TapeFieldError extends ValidationError.WithFieldTree {
  readonly kind: TapeViolationCode;
}

function isTapeFieldError(error: ValidationError): error is TapeFieldError {
  return error.kind !== 'parse';
}

/**
 * The schema of the import form. Its one rule is `createTape`'s own validation, the only place where
 * the rules of a Tape live; each violation becomes an error at the field it belongs to.
 */
export function tapeImportSchema(context: Signal<TapeImportContext | null>) {
  return (draft: SchemaPath<TapeImportDraft>): void => {
    validateTree(draft, ({value, fieldTree}) => {
      const chosen = context();
      if (chosen === null) return undefined;
      const {name, columnLength, transposition: semitones} = value();
      const valid = transposition(semitones ?? Number.NaN);
      if (valid === undefined) return [toFieldError('transposition-out-of-range', fieldTree)];
      const result = createTape({
        song: chosen.song,
        organ: chosen.organ,
        selectedParts: defaultSelectedParts(chosen.song),
        transposition: valid,
        name,
        columnLength: columnLength ?? Number.NaN,
      });
      return result.ok ? undefined : result.error.map(({code}) => toFieldError(code, fieldTree));
    });
  };
}

function toFieldError(code: TapeViolationCode, draft: ReadonlyFieldTree<TapeImportDraft>): TapeFieldError {
  return {kind: code, fieldTree: fieldFor(code, draft)};
}

function fieldFor(code: TapeViolationCode, draft: ReadonlyFieldTree<TapeImportDraft>): ReadonlyFieldTree<unknown> {
  switch (code) {
    case 'name-required':
      return draft.name;
    case 'column-length-must-be-positive':
      return draft.columnLength;
    case 'transposition-out-of-range':
    case 'no-note-on-a-pipe':
      return draft.transposition;
    case 'no-part-selected':
      return draft;
  }
}

/** A missing name waits until the field was edited; the other rules show right away. */
function isShown(error: TapeFieldError, dirty: boolean): boolean {
  return dirty || error.kind !== 'name-required';
}

/** A message to show at a field: the violation code and the translation key of its text. */
export interface ShownMessage extends TranslatableText {
  readonly code: TapeViolationCode;
}

/** The messages of a field that the user should see now. */
export function shownMessages(field: FieldTree<unknown>): readonly ShownMessage[] {
  const state = field();
  return state
    .errors()
    .filter(isTapeFieldError)
    .filter((error) => isShown(error, state.dirty()))
    .map((error) => ({code: error.kind, key: `TAPE.VIOLATION.${error.kind.toUpperCase().replaceAll('-', '_')}`, params: {}}));
}

/** Puts a Material input in its error state exactly while the page shows a message for its field. */
@Injectable()
export class ShownViolationMatcher extends ErrorStateMatcher {
  override isSignalErrorState(field: Field<unknown> | null): boolean {
    if (!field) return false;
    const state = field();
    return state.errors().filter(isTapeFieldError).some((error) => isShown(error, state.dirty()));
  }
}
