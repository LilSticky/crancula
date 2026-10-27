import {inject, Injectable, signal} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {
  type LaneInput,
  type RollPlotter,
  type SideBySideRefusal,
  sideBySideFileName,
  sideBySidePlan,
  sideBySideSvg,
} from '@api/index';
import {CRANCULA_API} from '../../../core/crancula-api.token';
import {formatNumber} from '../../shared/format-number';
import {SAVED_DURATION} from '../../shared/saved-duration';
import {cuttingProblemText, type ProblemText} from '../tape-view/cutting-problem-text';
import {CuttingProblemsDialogComponent} from '../tape-view/cutting-problems-dialog/cutting-problems-dialog.component';

/** Saves a side-by-side cut as one SVG file on a roll Plotter, through the main process, and tells the user how it went. */
@Injectable({providedIn: 'root'})
export class SideBySideExport {
  private readonly api = inject(CRANCULA_API);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly savingState = signal(false);

  /** True while a save is running. */
  readonly saving = this.savingState.asReadonly();

  /**
   * Saves the Lanes, in their order, as one file; nothing else is written. While a reason keeps the cut from being saved,
   * the reasons are listed in the Cutting Problems dialog and nothing is written.
   */
  async export(lanes: readonly LaneInput[], plotter: RollPlotter | undefined): Promise<void> {
    if (this.savingState()) return;
    const plan = sideBySidePlan(lanes, plotter);
    if (!plan.ok) {
      this.dialog.open(CuttingProblemsDialogComponent, {data: this.problemTexts(plan.refusals)});
      return;
    }
    const [first] = plan.cut.lanes;
    // A plan that is ok has at least one Lane; the guard only narrows the type.
    if (first === undefined) return;
    this.savingState.set(true);
    try {
      const result = await this.api.plotter.saveSvg({
        suggestedFileName: sideBySideFileName(first.tape.name, plan.cut.lanes.length, (count) =>
          this.text('TAPE.SIDE_BY_SIDE.FILE_NAME_MORE', {count}),
        ),
        svg: sideBySideSvg(plan.cut),
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
          this.showFailure(this.text('TAPE.EXPORT.FAILED', {reason: result.reason}), lanes, plan.cut.plotter);
          break;
      }
    } finally {
      this.savingState.set(false);
    }
  }

  /** Shows `message` until dismissed; Retry saves the same cut again. */
  private showFailure(message: string, lanes: readonly LaneInput[], plotter: RollPlotter): void {
    this.snackBar
      .open(message, this.text('TAPE.EXPORT.RETRY'), {duration: 0})
      .onAction()
      .subscribe(() => void this.export(lanes, plotter));
  }

  /** The refusals as translated entries, in their order; each Cutting Problem is named after its Tape. */
  private problemTexts(refusals: readonly SideBySideRefusal[]): readonly ProblemText[] {
    const language = this.translate.getCurrentLang() ?? 'en';
    const number = (value: number): string => formatNumber(value, language);
    return refusals.flatMap((refusal): ProblemText[] => {
      switch (refusal.code) {
        case 'no-plotter':
          return [{key: 'TAPE.SIDE_BY_SIDE.REFUSAL.NO_PLOTTER', params: {}}];
        case 'no-lane':
          return [{key: 'TAPE.SIDE_BY_SIDE.REFUSAL.NO_LANE', params: {}}];
        case 'no-organ':
          return [{key: 'TAPE.SIDE_BY_SIDE.REFUSAL.NO_ORGAN', params: {lane: String(refusal.lane), tape: refusal.tapeName}}];
        case 'lane-does-not-fit':
          return [
            {
              key: 'TAPE.SIDE_BY_SIDE.REFUSAL.DOES_NOT_FIT',
              params: {
                lane: String(refusal.lane),
                tape: refusal.tapeName,
                needed: number(refusal.needed),
                free: number(refusal.free),
              },
            },
          ];
        case 'cutting-problems':
          return refusal.problems.map((problem): ProblemText => {
            const text = cuttingProblemText(problem, language);
            return {
              key: 'TAPE.SIDE_BY_SIDE.TAPE_PROBLEM',
              params: {tape: refusal.tapeName, problem: this.text(text.key, text.params)},
            };
          });
      }
    });
  }

  private text(key: string, params?: Record<string, string>): string {
    return String(this.translate.instant(key, params));
  }
}
