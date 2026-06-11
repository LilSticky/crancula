import {Component, inject} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle
} from "@angular/material/dialog";
import {MatButton} from "@angular/material/button";
import {TranslateService} from "@ngx-translate/core";

enum ConfirmableAction {
  DELETE = 'DELETE'
}

@Component({
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatButton,
    MatDialogTitle
  ],
  selector: 'cranc-confirm-dialog',
  template: `
    <h2 matDialogTitle>Confirm Action</h2>
    <mat-dialog-content>
      {{ confirmationMessage }}
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="warn" (click)="onConfirm()">Confirm</button>
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
  confirmationMessage: string = this.translate.instant(`CONFIRMATION_DIALOG.${this.action}`, {ref: this.ref});

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
