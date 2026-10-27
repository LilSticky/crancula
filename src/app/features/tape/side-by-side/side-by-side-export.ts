import {inject, Injectable, signal} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {type LaneTape, type RollPlotter, sideBySideCut, sideBySideFileName, sideBySideSvg} from '@api/index';
import {CRANCULA_API} from '../../../core/crancula-api.token';

/** Saves a side-by-side cut as one SVG file on a roll Plotter, through the main process, and tells the user how it went. */
@Injectable({providedIn: 'root'})
export class SideBySideExport {
  private readonly api = inject(CRANCULA_API);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly savingState = signal(false);

  /** True while a save is running. */
  readonly saving = this.savingState.asReadonly();

  /** Saves the Lanes, in their order, as one file; nothing else is written. */
  async export(lanes: readonly LaneTape[], plotter: RollPlotter): Promise<void> {
    const [first] = lanes;
    if (this.savingState() || first === undefined) return;
    this.savingState.set(true);
    try {
      const result = await this.api.plotter.saveSvg({
        suggestedFileName: sideBySideFileName(first.tape.name, lanes.length, (count) =>
          this.text('TAPE.SIDE_BY_SIDE.FILE_NAME_MORE', {count}),
        ),
        svg: sideBySideSvg(sideBySideCut(lanes, plotter)),
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
          this.showFailure(this.text('TAPE.EXPORT.FAILED', {reason: result.reason}), lanes, plotter);
          break;
      }
    } finally {
      this.savingState.set(false);
    }
  }

  /** Shows `message` until dismissed; Retry saves the same cut again. */
  private showFailure(message: string, lanes: readonly LaneTape[], plotter: RollPlotter): void {
    this.snackBar
      .open(message, this.text('TAPE.EXPORT.RETRY'), {duration: 0})
      .onAction()
      .subscribe(() => void this.export(lanes, plotter));
  }

  private text(key: string, params?: Record<string, string>): string {
    return String(this.translate.instant(key, params));
  }
}
