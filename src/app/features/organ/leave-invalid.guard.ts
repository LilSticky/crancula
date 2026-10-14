import {inject} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import type {CanDeactivateFn} from '@angular/router';
import {map} from 'rxjs';
import {ConfirmableAction, ConfirmDialogComponent} from '../shared/components/confirm-dialog/confirm-dialog.component';

/** A page that knows whether leaving it would lose input that cannot be stored. */
export interface DraftLeaveCheck {
  hasInvalidDraft(): boolean;
}

/** Leaving with an invalid draft discards it, so the user must confirm. */
export const leaveInvalidGuard: CanDeactivateFn<DraftLeaveCheck> = (page) => {
  if (!page.hasInvalidDraft()) return true;
  return inject(MatDialog)
    .open(ConfirmDialogComponent, {data: {action: ConfirmableAction.DISCARD, entity: {}}})
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
};
