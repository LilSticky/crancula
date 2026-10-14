import {TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import type {ActivatedRouteSnapshot, RouterStateSnapshot} from '@angular/router';
import {newOrganId, type Organ, type OrganDraft, toSnapshot, validateOrgan} from '@api/index';
import {firstValueFrom, isObservable, of} from 'rxjs';
import {vi} from 'vitest';
import {CRANCULA_API, createInMemoryCranculaApi} from '../../core/crancula-api.token';
import {ConfirmableAction, ConfirmDialogComponent} from '../shared/components/confirm-dialog/confirm-dialog.component';
import {type DraftLeaveCheck, leaveInvalidGuard} from './leave-invalid.guard';
import {OrganLibrary} from './organ-library.store';

type GuardOutcome = ReturnType<typeof leaveInvalidGuard>;

function storedOrgan(): Organ {
  const draft: OrganDraft = {
    id: newOrganId(),
    name: 'Street organ',
    tapeBed: {tapeWidth: 120, border: 5, holeDiameter: 2.5, rowSpacing: 3.5},
    minimumGap: 1.5,
    pipes: [{note: 60}, {note: 62}],
  };
  const result = validateOrgan(draft);
  if (!result.ok) throw new Error('invalid test Organ');
  return result.value;
}

async function setup(dialogResult: boolean) {
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

  const leave = (editor: DraftLeaveCheck): Promise<boolean> => {
    const result = TestBed.runInInjectionContext(() =>
      leaveInvalidGuard(editor, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot),
    );
    return toPromise(result);
  };
  return {stored, library, open, leave};
}

async function toPromise(result: GuardOutcome): Promise<boolean> {
  if (isObservable(result)) return (await firstValueFrom(result)) === true;
  return (await result) === true;
}

const validDraft: DraftLeaveCheck = {hasInvalidDraft: () => false};
const invalidDraft: DraftLeaveCheck = {hasInvalidDraft: () => true};

describe('leaveInvalidGuard', () => {
  it('allows leaving with a valid or unchanged draft without a dialog', async () => {
    const {open, leave} = await setup(false);

    expect(await leave(validDraft)).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the confirm dialog for discarding when the draft is invalid', async () => {
    const {open, leave} = await setup(true);

    await leave(invalidDraft);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]?.[0]).toBe(ConfirmDialogComponent);
    expect(open.mock.calls[0]?.[1]).toMatchObject({data: {action: ConfirmableAction.DISCARD}});
  });

  it('stays on the page when the dialog is cancelled', async () => {
    const {leave} = await setup(false);

    expect(await leave(invalidDraft)).toBe(false);
  });

  it('leaves when the dialog is confirmed, and the last stored version is unchanged', async () => {
    const {stored, library, leave} = await setup(true);

    expect(await leave(invalidDraft)).toBe(true);
    expect(library.entityMap()[stored.id]).toEqual(stored);
  });
});
