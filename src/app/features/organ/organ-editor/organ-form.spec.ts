import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {form} from '@angular/forms/signals';
import {emptyOrganDraft, type OrganDraft, toDraft} from '@api/index';
import {testOrgan} from '../../../../testing/organs';
import {changedFields, type FieldProblem, isOrganFieldError, type OrganFieldError, organFormSchema, problemFields} from './organ-form';

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
    expect(error?.violation.params).toEqual({requiredWidth: 107.5, availableWidth: 100});
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

describe('changedFields', () => {
  const saved = toDraft(testOrgan('Street organ', 3));

  it('is empty for equal drafts', () => {
    expect(changedFields(saved, {...saved, tapeBed: {...saved.tapeBed}, pipes: saved.pipes.map((pipe) => ({...pipe}))})).toEqual([]);
  });

  it('names the changed fields in reading order', () => {
    const draft: OrganDraft = {
      ...saved,
      name: 'Fair organ',
      tapeBed: {...saved.tapeBed, rowSpacing: 4, tapeWidth: 90},
      minimumGap: 9,
    };

    expect(changedFields(saved, draft)).toEqual(['name', 'tapeBed.tapeWidth', 'tapeBed.rowSpacing', 'minimumGap']);
  });

  it('names the Lead-in after the Minimum Gap', () => {
    expect(changedFields(saved, {...saved, leadIn: 5, minimumGap: 9})).toEqual(['minimumGap', 'leadIn']);
  });

  it('names the hole diameter alone when only it changed', () => {
    expect(changedFields(saved, {...saved, tapeBed: {...saved.tapeBed, holeDiameter: 3.3}})).toEqual(['tapeBed.holeDiameter']);
  });

  it('names pipes once for a note edit', () => {
    const pipes = saved.pipes.map((pipe, row) => (row === 1 ? {...pipe, note: 99} : pipe));

    expect(changedFields(saved, {...saved, pipes})).toEqual(['pipes']);
  });

  it('names pipes once for an added Pipe', () => {
    expect(changedFields(saved, {...saved, pipes: [...saved.pipes, {note: 99}]})).toEqual(['pipes']);
  });

  it('names pipes once for a removed Pipe', () => {
    expect(changedFields(saved, {...saved, pipes: saved.pipes.slice(1)})).toEqual(['pipes']);
  });

  it('names pipes once for a moved Pipe', () => {
    expect(changedFields(saved, {...saved, pipes: [...saved.pipes].reverse()})).toEqual(['pipes']);
  });

  it('puts pipes after the other changed fields', () => {
    expect(changedFields(saved, {...saved, minimumGap: 9, pipes: saved.pipes.slice(1)})).toEqual(['minimumGap', 'pipes']);
  });
});

describe('problemFields', () => {
  const problem = (path: string, key = 'ORGAN.VIOLATION.VALUE_REQUIRED'): FieldProblem => ({path, message: {key, params: {}}});

  it('is empty without problems', () => {
    expect(problemFields([])).toEqual([]);
  });

  it('labels each field with its fixed label', () => {
    const paths = ['name', 'tapeBed.tapeWidth', 'tapeBed.holeDiameter', 'tapeBed.rowSpacing', 'minimumGap', 'leadIn', 'pipes'];

    expect(problemFields(paths.map((path) => problem(path)))).toEqual([
      {path: 'name', label: {key: 'ORGAN.EDITOR.NAME', params: {}}},
      {path: 'tapeBed.tapeWidth', label: {key: 'ORGAN.EDITOR.TAPE_WIDTH', params: {}}},
      {path: 'tapeBed.holeDiameter', label: {key: 'ORGAN.EDITOR.HOLE_DIAMETER', params: {}}},
      {path: 'tapeBed.rowSpacing', label: {key: 'ORGAN.EDITOR.ROW_SPACING', params: {}}},
      {path: 'minimumGap', label: {key: 'ORGAN.EDITOR.MINIMUM_GAP', params: {}}},
      {path: 'leadIn', label: {key: 'ORGAN.EDITOR.LEAD_IN', params: {}}},
      {path: 'pipes', label: {key: 'ORGAN.EDITOR.PIPES', params: {}}},
    ]);
  });

  it('labels a Pipe note by its 1-based row', () => {
    expect(problemFields([problem('pipes.2.note')])).toEqual([
      {path: 'pipes.2.note', label: {key: 'ORGAN.EDITOR.ROW', params: {row: 3}}},
    ]);
  });

  it('lists each field once, however many problems it has', () => {
    const fields = problemFields([problem('tapeBed.tapeWidth'), problem('tapeBed.tapeWidth', 'ORGAN.VIOLATION.OTHER')]);

    expect(fields.map(({path}) => path)).toEqual(['tapeBed.tapeWidth']);
  });

  it('puts the fields in reading order whatever the order of the problems', () => {
    const fields = problemFields([problem('pipes.2.note'), problem('pipes.0.note'), problem('leadIn'), problem('minimumGap'), problem('name'), problem('tapeBed.holeDiameter')]);

    expect(fields.map(({path}) => path)).toEqual(['name', 'tapeBed.holeDiameter', 'minimumGap', 'leadIn', 'pipes.0.note', 'pipes.2.note']);
  });

  it('orders rows numerically, not as text', () => {
    const fields = problemFields([problem('pipes.10.note'), problem('pipes.9.note')]);

    expect(fields.map(({path}) => path)).toEqual(['pipes.9.note', 'pipes.10.note']);
  });
});
