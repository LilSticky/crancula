import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {type CuttingProblem} from '@api/index';
import {cuttingProblemText, type ProblemText} from '../cutting-problem-text';

/** Lists why a Tape can not be cut yet, one entry per Cutting Problem. */
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
  private readonly language = inject(TranslateService).getCurrentLang() ?? 'en';
  protected readonly entries: readonly ProblemText[] = inject<readonly CuttingProblem[]>(MAT_DIALOG_DATA).map((problem) =>
    cuttingProblemText(problem, this.language),
  );
}
