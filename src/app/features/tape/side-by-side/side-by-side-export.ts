import {inject, Injectable, signal} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {
  type LaneInput,
  type LaneTape,
  type RollPlotter,
  type SideBySideRefusal,
  sideBySideCut,
  sideBySideFileName,
  sideBySideRefusals,
  sideBySideSvg,
} from '@api/index';
import {CRANCULA_API} from '../../../core/crancula-api.token';
import {formatNumber} from '../../shared/format-number';
import {cuttingProblemText, type ProblemText} from '../tape-view/cutting-problem-text';
import {CuttingProblemsDialogComponent} from '../tape-view/cutting-problems-dialog/cutting-problems-dialog.component';

/** A cut that can be saved: a roll Plotter, and a Lane with its Organ for every Lane, the first one among them. */
interface SavableCut {
  readonly first: LaneTape;
  readonly lanes: readonly LaneTape[];
  readonly plotter: RollPlotter;
}

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
    const refusals = sideBySideRefusals(lanes, plotter);
    const cut = refusals.length === 0 ? savableCut(lanes, plotter) : undefined;
    if (cut === undefined) {
      this.dialog.open(CuttingProblemsDialogComponent, {data: this.problemTexts(refusals)});
      return;
    }
    this.savingState.set(true);
    try {
      const result = await this.api.plotter.saveSvg({
        suggestedFileName: sideBySideFileName(cut.first.tape.name, cut.lanes.length, (count) =>
          this.text('TAPE.SIDE_BY_SIDE.FILE_NAME_MORE', {count}),
        ),
        svg: sideBySideSvg(sideBySideCut(cut.lanes, cut.plotter)),
        dialogTitle: this.text('TAPE.EXPORT.DIALOG_TITLE'),
        filterName: this.text('TAPE.EXPORT.FILTER_NAME'),
      });
      switch (result.status) {
        case 'saved':
          // Stays until dismissed, so the path can be read; no dismiss timer is left running.
          this.snackBar.open(this.text('TAPE.EXPORT.SAVED', {name: result.filePath}), undefined, {duration: 0});
          break;
        case 'cancelled':
          break;
        case 'failed':
        case 'rejected':
          this.showFailure(this.text('TAPE.EXPORT.FAILED', {reason: result.reason}), cut);
          break;
      }
    } finally {
      this.savingState.set(false);
    }
  }

  /** Shows `message` until dismissed; Retry saves the same cut again. */
  private showFailure(message: string, cut: SavableCut): void {
    this.snackBar
      .open(message, this.text('TAPE.EXPORT.RETRY'), {duration: 0})
      .onAction()
      .subscribe(() => void this.export(cut.lanes, cut.plotter));
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

/** The cut as it can be saved, or undefined while a Lane has no Organ or there is no roll Plotter or no Lane. */
function savableCut(lanes: readonly LaneInput[], plotter: RollPlotter | undefined): SavableCut | undefined {
  if (plotter === undefined) return undefined;
  const ready: LaneTape[] = [];
  for (const {tape, organ} of lanes) {
    if (organ === undefined) return undefined;
    ready.push({tape, organ});
  }
  const [first] = ready;
  return first === undefined ? undefined : {first, lanes: ready, plotter};
}
