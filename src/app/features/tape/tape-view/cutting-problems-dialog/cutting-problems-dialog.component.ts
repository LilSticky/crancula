import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {TranslatePipe} from '@ngx-translate/core';
import {type ProblemText} from '../cutting-problem-text';

/** Lists why a Tape can not be cut yet, one translated entry per reason. */
@Component({
  selector: 'cranc-cutting-problems-dialog',
  imports: [MatButton, MatDialogActions, MatDialogContent, MatDialogTitle, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'TAPE.EXPORT.PROBLEMS_TITLE' | translate }}</h2>
    <mat-dialog-content>
      <ul>
        @for (entry of entries; track $index) {
          <li data-testid="export-problem">{{ entry.key | translate: entry.params }}</li>
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">{{ 'TAPE.EXPORT.PROBLEMS_CLOSE' | translate }}</button>
    </mat-dialog-actions>
  `,
})
export class CuttingProblemsDialogComponent {
  protected readonly dialogRef = inject<MatDialogRef<CuttingProblemsDialogComponent>>(MatDialogRef);
  protected readonly entries = inject<readonly ProblemText[]>(MAT_DIALOG_DATA);
}
