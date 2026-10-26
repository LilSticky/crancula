import {Injectable, type Signal} from '@angular/core';
import {
  type Field,
  type FieldTree,
  type ReadonlyFieldTree,
  max,
  min,
  type SchemaPathTree,
  validateTree,
  type ValidationError,
} from '@angular/forms/signals';
import {ErrorStateMatcher} from '@angular/material/core';
import {
  allowedTranspositions,
  type CreatedTape,
  createTape,
  type Organ,
  type PartIndex,
  type Result,
  type LeftOut,
  type Song,
  transposition,
  type TapeViolationCode,
} from '@api/index';
import type {TranslatableText} from '../../organ/leave-unsaved.guard';

/** What the user enters on the import page; the Parts are chosen apart from the form. */
export interface TapeImportDraft {
  readonly name: string;
  /** In millimetres. */
  readonly columnLength: number | null;
  readonly transposition: number | null;
}

/** The Song, the selected Parts and the Organ the draft is checked against; present once Song and Organ were chosen. */
export interface TapeImportContext {
  readonly song: Song;
  readonly organ: Organ;
  readonly selectedParts: ReadonlySet<PartIndex>;
  /** Only for a Song from a Score: what its Parts left out, per Part. */
  readonly leftOut?: ReadonlyMap<PartIndex, LeftOut>;
}

/** A rule of the Tape that the import form reports at a field. `kind` is the code of the domain violation. */
export interface TapeFieldError extends ValidationError.WithFieldTree {
  readonly kind: TapeViolationCode;
}

function isTapeFieldError(error: ValidationError): error is TapeFieldError {
  return error.kind !== 'parse' && error.kind !== 'min' && error.kind !== 'max';
}

/** The Tape the draft makes, or the codes of the rules it breaks; the only call of `createTape` on this page. */
export function createTapeFromDraft(
  {song, organ, selectedParts, leftOut}: TapeImportContext,
  {name, columnLength, transposition: semitones}: TapeImportDraft,
): Result<CreatedTape, readonly TapeViolationCode[]> {
  const valid = transposition(semitones ?? Number.NaN);
  if (valid === undefined) return {ok: false, error: ['transposition-out-of-range']};
  const result = createTape({
    song,
    organ,
    selectedParts,
    transposition: valid,
    name,
    columnLength: columnLength ?? Number.NaN,
    leftOut,
  });
  return result.ok ? result : {ok: false, error: result.error.map(({code}) => code)};
}

/**
 * The schema of the import form. Its one rule is `createTape`'s own validation, the only place where
 * the rules of a Tape live; each violation becomes an error at the field it belongs to.
 */
export function tapeImportSchema(context: Signal<TapeImportContext | null>) {
  return (draft: SchemaPathTree<TapeImportDraft>): void => {
    // Only bounds the input (its min and max attributes); `createTape` reports the violation.
    min(draft.transposition, () => allowed(context)?.lowest);
    max(draft.transposition, () => allowed(context)?.highest);
    validateTree(draft, ({value, fieldTree}) => {
      const chosen = context();
      if (chosen === null) return undefined;
      const result = createTapeFromDraft(chosen, value());
      return result.ok ? undefined : result.error.map((code) => toFieldError(code, fieldTree));
    });
  };
}

function allowed(context: Signal<TapeImportContext | null>) {
  const chosen = context();
  return chosen && allowedTranspositions(chosen.song, chosen.selectedParts);
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
