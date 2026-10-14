import {inject, Injectable} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import type {Organ} from '@api/index';
import {firstValueFrom} from 'rxjs';
import {ConfirmableAction, ConfirmDialogComponent} from '../shared/components/confirm-dialog/confirm-dialog.component';
import {TapeLibrary} from '../tape/tape-library.store';
import {OrganLibrary} from './organ-library.store';

/** Deletes an Organ after confirmation, with its Tapes: those first, the Organ only once they are gone (ADR 18). */
@Injectable({providedIn: 'root'})
export class OrganDeletion {
  private readonly organs = inject(OrganLibrary);
  private readonly tapes = inject(TapeLibrary);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  /** Resolves `true` once the Organ and its Tapes are removed; `false` when blocked, cancelled or not written. */
  async confirmAndDelete(organ: Pick<Organ, 'id' | 'name'>): Promise<boolean> {
    if (this.tapes.loadProblem() !== null) {
      this.snackBar.open(String(this.translate.instant('ORGAN.LIST.DELETE_BLOCKED')), String(this.translate.instant('ORGAN.STORAGE.DISMISS')));
      return false;
    }
    const count = this.tapes.tapesOf(organ.id).length;
    const consequence = count > 0 ? {key: 'ORGAN.LIST.DELETE_TAPES', params: {count}} : undefined;
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {data: {action: ConfirmableAction.DELETE, entity: {id: organ.id, name: organ.name}, consequence}})
        .afterClosed(),
    );
    if (confirmed !== true) return false;
    if (!(await this.tapes.removeTapesOf(organ.id))) return false; // The Organ stays: the Tape library reports the storage problem.
    try {
      await this.organs.remove(organ.id);
    } catch {
      return false; // The Organ is still stored: the library reports the storage problem.
    }
    return true;
  }
}
