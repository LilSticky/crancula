import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {form} from '@angular/forms/signals';
import {emptyOrganDraft, type OrganDraft, toDraft} from '@api/index';
import {testOrgan} from '../../../../testing/organs';
import {isOrganFieldError, type OrganFieldError, organFormSchema} from './organ-form';

function organForm(draft: OrganDraft) {
  return TestBed.runInInjectionContext(() => form(signal(draft), organFormSchema));
}

function organErrors(errors: readonly unknown[]): OrganFieldError[] {
  return errors.filter(isOrganFieldError);
}

describe('organFormSchema', () => {
  it('reports no error for a valid Organ', () => {
    const root = organForm(toDraft(testOrgan('Street organ', 2)));

    expect(root().valid()).toBe(true);
    expect(root().errorSummary()).toEqual([]);
  });

  it('puts a violation on the field its path names', () => {
    const root = organForm({...toDraft(testOrgan('Street organ', 2)), name: ' '});

    expect(organErrors(root.name().errors()).map(({kind}) => kind)).toEqual(['name-required']);
    expect(root().valid()).toBe(false);
  });

  it('puts a Tape Bed violation on the Tape Bed field, with its parameters', () => {
    const organ = toDraft(testOrgan('Street organ', 31));
    const root = organForm({...organ, tapeBed: {...organ.tapeBed, tapeWidth: 100}});

    const [error] = organErrors(root.tapeBed.tapeWidth().errors());

    expect(error?.kind).toBe('pipes-exceed-tape-width');
    expect(error?.violation.params).toEqual({requiredWidth: 117.5, availableWidth: 100});
    expect(root.tapeBed.rowSpacing().errors()).toEqual([]);
  });

  it('puts a Minimum Gap violation on the Minimum Gap field', () => {
    const root = organForm({...toDraft(testOrgan('Street organ', 2)), minimumGap: 0});

    expect(organErrors(root.minimumGap().errors()).map(({kind}) => kind)).toEqual(['must-be-positive']);
  });

  it('puts a missing-Pipes violation on the Pipes', () => {
    const root = organForm(emptyOrganDraft());

    expect(organErrors(root.pipes().errors()).map(({kind}) => kind)).toEqual(['pipes-required']);
  });

  it('puts a Pipe violation on the note of its row, and on every row of a duplicate', () => {
    const organ = toDraft(testOrgan('Street organ', 3));
    const root = organForm({...organ, pipes: [{note: 60}, {note: null}, {note: 60}]});

    expect(organErrors(root.pipes[0].note().errors()).map(({kind}) => kind)).toEqual(['duplicate-pipe']);
    expect(organErrors(root.pipes[1].note().errors()).map(({kind}) => kind)).toEqual(['pipe-note-required']);
    expect(organErrors(root.pipes[2].note().errors()).map(({kind}) => kind)).toEqual(['duplicate-pipe']);
  });

  it('keeps the dirty state of a Pipe when it moves to another row', () => {
    const organ = toDraft(testOrgan('Street organ', 3));
    const model = signal(organ);
    const root = TestBed.runInInjectionContext(() => form(model, organFormSchema));
    root.pipes[2].note().markAsDirty();

    model.update((draft) => ({...draft, pipes: [draft.pipes[2], draft.pipes[0], draft.pipes[1]]}));

    expect(root.pipes[0].note().dirty()).toBe(true);
    expect(root.pipes[2].note().dirty()).toBe(false);
  });

  it('recognises only its own errors', () => {
    expect(isOrganFieldError({kind: 'parse'})).toBe(false);
  });
});
