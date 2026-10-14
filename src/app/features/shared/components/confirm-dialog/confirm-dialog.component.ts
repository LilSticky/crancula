import {Component, inject} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from "@angular/material/dialog";
import {MatButton} from "@angular/material/button";
import {TranslatePipe, TranslateService} from "@ngx-translate/core";

export enum ConfirmableAction {
  DELETE = 'DELETE',
  DISCARD = 'DISCARD'
}

@Component({
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatDialogTitle,
    TranslatePipe
  ],
  selector: 'cranc-confirm-dialog',
  template: `
    <h2 matDialogTitle>{{ 'CONFIRMATION_DIALOG.TITLE' | translate }}</h2>
    <mat-dialog-content>
      {{ confirmationMessage }}
      @if (consequence) {
        <p data-testid="consequence">{{ consequence.key | translate: consequence.params }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">{{ 'CONFIRMATION_DIALOG.CANCEL' | translate }}</button>
      <button mat-raised-button color="warn" (click)="onConfirm()">{{ 'CONFIRMATION_DIALOG.CONFIRM' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .cranc-confirm-dialog {
      mat-dialog-content {
        margin-bottom: 1rem;
      }

      mat-dialog-actions {
        button {
          margin-left: 0.5rem;
        }
      }
    }
  `
})
export class ConfirmDialogComponent {
  dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
  dialogData = inject(MAT_DIALOG_DATA)
  translate = inject(TranslateService)
  action: ConfirmableAction = this.dialogData.action;
  ref: string = this.dialogData.entity.name ?? this.dialogData.entity.id ?? 'this';
  /** An optional extra line naming what else the action does. */
  consequence: {readonly key: string; readonly params: Readonly<Record<string, string | number>>} | undefined = this.dialogData.consequence;
  confirmationMessage: string = this.translate.instant(`CONFIRMATION_DIALOG.${this.action}`, {ref: this.ref});

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
