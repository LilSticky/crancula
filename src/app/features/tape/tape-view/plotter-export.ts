import {inject, Injectable, signal} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {cuttingProblems, plotterFileName, plotterSvg, tapeGeometry, type Organ, type Tape} from '@api/index';
import {CRANCULA_API} from '../../../core/crancula-api.token';
import {CuttingProblemsDialogComponent} from './cutting-problems-dialog/cutting-problems-dialog.component';

/** How long the "saved" snackbar stays, in ms. */
const SAVED_DURATION = 6000;

/** Saves a Tape as the Plotter file through the main process and tells the user how it went. */
@Injectable({providedIn: 'root'})
export class PlotterExport {
  private readonly api = inject(CRANCULA_API);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly savingState = signal(false);

  /** True while a save is running. */
  readonly saving = this.savingState.asReadonly();

  async export(tape: Tape, organ: Organ): Promise<void> {
    if (this.savingState()) return;
    const problems = cuttingProblems(tape, organ);
    if (problems.length > 0) {
      this.dialog.open(CuttingProblemsDialogComponent, {data: problems});
      return;
    }
    this.savingState.set(true);
    try {
      const result = await this.api.plotter.saveSvg({
        suggestedFileName: plotterFileName(tape.name),
        svg: plotterSvg(tapeGeometry(tape, organ)),
        dialogTitle: this.text('TAPE.EXPORT.DIALOG_TITLE'),
        filterName: this.text('TAPE.EXPORT.FILTER_NAME'),
      });
      switch (result.status) {
        case 'saved':
          this.snackBar.open(this.text('TAPE.EXPORT.SAVED', {name: result.filePath}), undefined, {duration: SAVED_DURATION});
          break;
        case 'cancelled':
          break;
        case 'failed':
        case 'rejected':
          this.showFailure(result.reason, tape, organ);
          break;
      }
    } catch (error: unknown) {
      this.showFailure(error instanceof Error ? error.message : String(error), tape, organ);
    } finally {
      this.savingState.set(false);
    }
  }

  private showFailure(reason: string, tape: Tape, organ: Organ): void {
    this.snackBar
      .open(this.text('TAPE.EXPORT.FAILED', {reason}), this.text('TAPE.EXPORT.RETRY'), {duration: 0})
      .onAction()
      .subscribe(() => void this.export(tape, organ));
  }

  private text(key: string, params?: Record<string, string>): string {
    return String(this.translate.instant(key, params));
  }
}
