import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import type {ActivatedRouteSnapshot, RouterStateSnapshot} from '@angular/router';
import {newOrganId, type Organ, type OrganDraft, toSnapshot, validateOrgan} from '@api/index';
import {firstValueFrom, isObservable, of} from 'rxjs';
import {vi} from 'vitest';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {LeaveUnsavedDialogComponent} from './leave-unsaved-dialog/leave-unsaved-dialog.component';
import {leaveUnsavedGuard, type UnsavedChanges, type UnsavedChangesCheck} from './leave-unsaved.guard';
import {OrganLibrary} from './organ-library.store';

type GuardOutcome = ReturnType<typeof leaveUnsavedGuard>;

function storedOrgan(): Organ {
  const draft: OrganDraft = {
    id: newOrganId(),
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    pipes: [{note: 60}, {note: 62}],
  };
  const result = validateOrgan(draft);
  if (!result.ok) throw new Error('invalid test Organ');
  return result.value;
}

async function setup(dialogResult: unknown) {
  const stored = storedOrgan();
  const open = vi.fn((...args: readonly unknown[]) => ({afterClosed: () => of(dialogResult), args}));
  TestBed.configureTestingModule({
    providers: [
      {provide: CRANCULA_API, useValue: createInMemoryCranculaApi(toSnapshot([stored]))},
      {provide: MatDialog, useValue: {open}},
    ],
  });
  const library = TestBed.inject(OrganLibrary);
  await library.load();

  const leave = (editor: UnsavedChangesCheck): Promise<boolean> => {
    const result = TestBed.runInInjectionContext(() =>
      leaveUnsavedGuard(editor, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot),
    );
    return toPromise(result);
  };
  return {stored, library, open, leave};
}

async function toPromise(result: GuardOutcome): Promise<boolean> {
  if (isObservable(result)) return (await firstValueFrom(result)) === true;
  return (await result) === true;
}

function editorWith(changes: UnsavedChanges | null): UnsavedChangesCheck {
  return {unsavedChanges: () => changes};
}

const nothingUnsaved = editorWith(null);
const validUnsaved = editorWith({problems: []});
const invalidUnsaved: UnsavedChanges = {
  problems: [
    {
      field: {key: 'ORGAN.LEAVE.PIPE_FIELD', params: {row: 3}},
      message: {key: 'ORGAN.VIOLATION.DUPLICATE_PIPE', params: {noteName: 'C4'}},
    },
  ],
};

describe('leaveUnsavedGuard', () => {
  it('allows leaving without a dialog when nothing is unsaved', async () => {
    const {open, leave} = await setup(false);

    expect(await leave(nothingUnsaved)).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the leave dialog with no problems for valid unsaved changes', async () => {
    const {open, leave} = await setup(false);

    await leave(validUnsaved);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toBe(LeaveUnsavedDialogComponent);
    expect(open.mock.calls[0]?.[1]).toMatchObject({data: {problems: []}});
  });

  it('opens the leave dialog with each problem for invalid unsaved changes', async () => {
    const {open, leave} = await setup(false);

    await leave(editorWith(invalidUnsaved));

    expect(open.mock.calls[0]?.[0]).toBe(LeaveUnsavedDialogComponent);
    expect(open.mock.calls[0]?.[1]).toMatchObject({data: invalidUnsaved});
  });

  it('stays on the page when the user stays', async () => {
    const {leave} = await setup(false);

    expect(await leave(validUnsaved)).toBe(false);
  });

  it('stays on the page when the dialog is dismissed without an answer', async () => {
    const {leave} = await setup(undefined);

    expect(await leave(editorWith(invalidUnsaved))).toBe(false);
  });

  it('leaves when the user discards, and the last saved version is unchanged', async () => {
    const {stored, library, leave} = await setup(true);

    expect(await leave(editorWith(invalidUnsaved))).toBe(true);
    expect(library.entityMap()[stored.id]).toEqual(stored);
  });
});
