import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {form, FormField, validate} from '@angular/forms/signals';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {MatError, MatFormField, MatLabel} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {TranslatePipe} from '@ngx-translate/core';

export interface RenameTapeDialogData {
  readonly name: string;
}

/** Asks for a new name; closes with the entered name, or without a value when cancelled. */
@Component({
  selector: 'cranc-rename-tape-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, MatButton, MatDialogTitle, MatDialogContent, MatDialogActions, MatFormField, MatLabel, MatError, MatInput, TranslatePipe],
  template: `
    <h2 matDialogTitle>{{ 'TAPE.RENAME.TITLE' | translate }}</h2>
    <mat-dialog-content>
      <mat-form-field class="name">
        <mat-label>{{ 'TAPE.RENAME.NAME' | translate }}</mat-label>
        <input matInput type="text" data-testid="tape-name-field" [formField]="tape.name" (keydown.enter)="confirm()" />
        <ng-container ngProjectAs="mat-error">
          @if (tape.name().touched() && tape.name().invalid()) {
            <mat-error data-testid="tape-name-error">{{ 'TAPE.RENAME.NAME_REQUIRED' | translate }}</mat-error>
          }
        </ng-container>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="cancel()">{{ 'TAPE.RENAME.CANCEL' | translate }}</button>
      <button matButton="filled" type="button" data-testid="rename-tape-confirm" (click)="confirm()">
        {{ 'TAPE.RENAME.CONFIRM' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .name {
      width: 100%;
    }
  `,
})
export class RenameTapeDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<RenameTapeDialogComponent, string>>(MatDialogRef);
  private readonly draft = signal({name: inject<RenameTapeDialogData>(MAT_DIALOG_DATA).name});

  protected readonly tape = form(this.draft, (draft) => {
    validate(draft.name, ({value}) => (value().trim() === '' ? {kind: 'name-required'} : undefined));
  });

  protected confirm(): void {
    this.tape.name().markAsTouched();
    if (this.tape().valid()) this.dialogRef.close(this.draft().name);
  }

  protected cancel(): void {
    this.dialogRef.close();
  }
}
