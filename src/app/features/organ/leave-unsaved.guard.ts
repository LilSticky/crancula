import {inject} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import type {CanDeactivateFn} from '@angular/router';
import {map} from 'rxjs';
import {LeaveUnsavedDialogComponent} from './leave-unsaved-dialog/leave-unsaved-dialog.component';

/** A translation key with its parameters, ready for the translate pipe. */
export interface TranslatableText {
  readonly key: string;
  readonly params: Readonly<Record<string, string | number>>;
}

/** A rule the unsaved Organ breaks, with the label of the field it belongs to. */
export interface LeaveProblem {
  readonly field: TranslatableText;
  readonly message: TranslatableText;
}

/** What leaving would lose; `problems` is empty when the changes are valid and merely not saved. */
export interface UnsavedChanges {
  readonly problems: readonly LeaveProblem[];
}

/** A page that knows whether leaving it would lose changes. */
export interface UnsavedChangesCheck {
  /** `null` when nothing would be lost. */
  unsavedChanges(): UnsavedChanges | null;
}

/** Leaving with unsaved changes loses them, so the user must confirm (spec FR-012a). */
export const leaveUnsavedGuard: CanDeactivateFn<UnsavedChangesCheck> = (page) => {
  const unsaved = page.unsavedChanges();
  if (!unsaved) return true;
  return inject(MatDialog)
    .open(LeaveUnsavedDialogComponent, {data: unsaved})
    .afterClosed()
    .pipe(map((discard) => discard === true));
};
