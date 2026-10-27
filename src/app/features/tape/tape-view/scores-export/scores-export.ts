import {inject, Injectable, signal} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {firstValueFrom} from 'rxjs';
import {
  scoresFileName,
  scoresMusicXml,
  type Organ,
  type ScoresChoices,
  type ScoresSaveRequest,
  type Song,
  type Tape,
} from '@api/index';
import {CRANCULA_API} from '../../../../core/crancula-api.token';
import {ScoresExportDialogComponent, type ScoresExportDialogData} from './scores-export-dialog.component';
import {ScoresStavesPreference} from './scores-staves-preference';

/** How long the "saved" snackbar stays, in ms. */
const SAVED_DURATION = 6000;

/** Asks how a Tape is written as Scores, saves the MusicXML through the main process and tells the user how it went. */
@Injectable({providedIn: 'root'})
export class ScoresExport {
  private readonly api = inject(CRANCULA_API);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly staves = inject(ScoresStavesPreference);
  private readonly savingState = signal(false);

  /** True while a save is running. */
  readonly saving = this.savingState.asReadonly();

  /** Opens the export dialog; when it is confirmed, saves the Scores of the Tape with the chosen Song choices. */
  async export(tape: Tape, organ: Organ, song: Song | undefined): Promise<void> {
    if (this.savingState()) return;
    const data: ScoresExportDialogData = {tape, organ, song, rememberedSplitNotes: this.staves.splitNotesFor(organ.id)};
    const dialogRef = this.dialog.open<ScoresExportDialogComponent, ScoresExportDialogData, ScoresChoices | undefined>(
      ScoresExportDialogComponent,
      {data},
    );
    const choices = await firstValueFrom(dialogRef.afterClosed());
    if (choices === undefined) return;
    this.staves.remember(organ.id, choices.splitNotes);
    let request: ScoresSaveRequest;
    try {
      request = {
        suggestedFileName: scoresFileName(tape.name),
        musicXml: scoresMusicXml({tape, organ, song, choices}),
        dialogTitle: this.text('TAPE.SCORES.DIALOG_TITLE'),
        filterName: this.text('TAPE.SCORES.FILTER_NAME'),
      };
    } catch (error: unknown) {
      // Nothing was saved, and saving again would build the same Scores: the failure is shown without Try again.
      this.showFailure(this.text('TAPE.SCORES.FAILED', {reason: errorMessage(error)}));
      return;
    }
    await this.save(request);
  }

  private async save(request: ScoresSaveRequest): Promise<void> {
    this.savingState.set(true);
    try {
      const result = await this.api.scores.save(request);
      switch (result.status) {
        case 'saved':
          this.snackBar.open(this.text('TAPE.SCORES.SAVED', {name: result.filePath}), undefined, {duration: SAVED_DURATION});
          break;
        case 'cancelled':
          break;
        case 'failed':
        case 'rejected':
          this.showFailure(this.text('TAPE.SCORES.FAILED', {reason: result.reason}), request);
          break;
      }
    } catch (error: unknown) {
      this.showFailure(this.text('TAPE.SCORES.FAILED', {reason: errorMessage(error)}), request);
    } finally {
      this.savingState.set(false);
    }
  }

  /** Shows `message` until dismissed; with a `request`, Try again saves the same Scores file once more. */
  private showFailure(message: string, request?: ScoresSaveRequest): void {
    if (request === undefined) {
      this.snackBar.open(message, undefined, {duration: 0});
      return;
    }
    this.snackBar
      .open(message, this.text('TAPE.SCORES.RETRY'), {duration: 0})
      .onAction()
      .subscribe(() => void this.save(request));
  }

  private text(key: string, params?: Record<string, string>): string {
    return String(this.translate.instant(key, params));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
