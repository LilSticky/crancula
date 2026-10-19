import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {MatButton} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle} from '@angular/material/dialog';
import {TranslatePipe, TranslateService} from '@ngx-translate/core';
import {noteName, type CuttingProblem} from '@api/index';
import {formatNumber} from '../../../shared/format-number';

interface ProblemEntry {
  readonly key: string;
  readonly params: Readonly<Record<string, string>>;
}

/** Lists why a Tape can not be cut yet, one entry per export problem. */
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
  protected readonly entries: readonly ProblemEntry[] = inject<readonly CuttingProblem[]>(MAT_DIALOG_DATA).map((problem) =>
    this.entryOf(problem),
  );

  private entryOf(problem: CuttingProblem): ProblemEntry {
    const mm = (value: number): string => formatNumber(value, this.language);
    const base = {note: noteName(problem.pipe), column: String(problem.start + 1)};
    switch (problem.code) {
      case 'no-pipe':
        return {key: 'TAPE.CUTTING_PROBLEM.NO_PIPE', params: base};
      case 'too-short':
        return {
          key: 'TAPE.CUTTING_PROBLEM.TOO_SHORT',
          params: {...base, length: mm(problem.lengthMm), minimum: mm(problem.minimumHoleLengthMm)},
        };
      case 'too-close':
        return {
          key: 'TAPE.CUTTING_PROBLEM.TOO_CLOSE',
          params: {...base, next: String(problem.nextStart + 1), gap: mm(problem.gapMm), minimum: mm(problem.minimumGapMm)},
        };
    }
  }
}
