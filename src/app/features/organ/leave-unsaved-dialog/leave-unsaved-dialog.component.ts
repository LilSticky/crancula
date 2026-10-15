import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {TranslatePipe} from '@ngx-translate/core';
import type {UnsavedChanges} from '../leave-unsaved.guard';

/** Asks whether to stay (the default) or to discard unsaved changes; closes with `true` to discard. */
@Component({
  selector: 'cranc-leave-unsaved-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButton, TranslatePipe],
  template: `
    <h2 matDialogTitle>{{ 'ORGAN.LEAVE.TITLE' | translate }}</h2>
    <mat-dialog-content>
      @if (data.problems.length === 0) {
        <p>{{ 'ORGAN.LEAVE.UNSAVED' | translate }}</p>
      } @else {
        <p>{{ 'ORGAN.LEAVE.INVALID' | translate }}</p>
        <dl>
          @for (problem of data.problems; track $index) {
            <div data-testid="leave-problem">
              <dt>{{ problem.field.key | translate: problem.field.params }}</dt>
              <dd>{{ problem.message.key | translate: problem.message.params }}</dd>
            </div>
          }
        </dl>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" cdkFocusInitial data-testid="stay" (click)="close(false)">
        {{ 'ORGAN.LEAVE.STAY' | translate }}
      </button>
      <button matButton type="button" data-testid="discard" (click)="close(true)">
        {{ 'ORGAN.LEAVE.DISCARD' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    dt {
      font-weight: 500;
    }

    dd {
      margin-inline-start: 1rem;
    }
  `,
})
export class LeaveUnsavedDialogComponent {
  protected readonly data = inject<UnsavedChanges>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<LeaveUnsavedDialogComponent, boolean>>(MatDialogRef);

  protected close(discard: boolean): void {
    this.dialogRef.close(discard);
  }
}
