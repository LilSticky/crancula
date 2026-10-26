import {inject, Injectable, signal} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {
  cuttingProblems,
  pieceGeometry,
  plotterFileName,
  plotterSvg,
  tapeGeometry,
  tapePieceFileNames,
  tapePieces,
  type Organ,
  type Plotter,
  type SvgPiece,
  type Tape,
  type TapePiece,
} from '@api/index';
import {CRANCULA_API} from '../../../core/crancula-api.token';
import {CuttingProblemsDialogComponent, type ExportRefusal} from './cutting-problems-dialog/cutting-problems-dialog.component';

/** How long the "saved" snackbar stays, in ms. */
const SAVED_DURATION = 6000;

/** Why the Tape can not be saved for `plotter`: too wide first, then the Cutting Problems, the stretches among them (FR-019). */
function refusalsOf(tape: Tape, organ: Organ, plotter: Plotter | undefined): readonly ExportRefusal[] {
  const problems = cuttingProblems(tape, organ, plotter);
  const tooWide = plotter !== undefined && tapePieces(tapeGeometry(tape, organ), plotter).kind === 'too-wide';
  return tooWide ? [{code: 'too-wide'}, ...problems] : problems;
}

/** Saves a Tape as the Plotter file, or as Tape pieces for a sheet Plotter, through the main process and tells the user how it went. */
@Injectable({providedIn: 'root'})
export class PlotterExport {
  private readonly api = inject(CRANCULA_API);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly savingState = signal(false);

  /** True while a save is running. */
  readonly saving = this.savingState.asReadonly();

  /** Saves the Tape as one file, or in Tape pieces when the picked Plotter cuts it into more than one. */
  async export(tape: Tape, organ: Organ, plotter: Plotter | undefined): Promise<void> {
    if (this.savingState()) return;
    const refusals = refusalsOf(tape, organ, plotter);
    if (refusals.length > 0) {
      this.dialog.open(CuttingProblemsDialogComponent, {data: refusals});
      return;
    }
    this.savingState.set(true);
    try {
      const pieces = plotter === undefined ? undefined : this.piecesToSave(tape, organ, plotter);
      if (plotter === undefined || pieces === undefined) {
        await this.saveFile(tape, organ, plotter);
      } else {
        await this.savePieces(tape, organ, plotter, pieces);
      }
    } catch (error: unknown) {
      this.showFailure(this.text('TAPE.EXPORT.FAILED', {reason: errorMessage(error)}), tape, organ, plotter);
    } finally {
      this.savingState.set(false);
    }
  }

  /** The Tape pieces when the Plotter cuts the Tape into more than one; undefined when the Tape is saved as one file. */
  private piecesToSave(tape: Tape, organ: Organ, plotter: Plotter): readonly TapePiece[] | undefined {
    const cut = tapePieces(tapeGeometry(tape, organ), plotter);
    return cut.kind === 'pieces' && cut.pieces.length > 1 ? cut.pieces : undefined;
  }

  private async saveFile(tape: Tape, organ: Organ, plotter: Plotter | undefined): Promise<void> {
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
        this.showFailure(this.text('TAPE.EXPORT.FAILED', {reason: result.reason}), tape, organ, plotter);
        break;
    }
  }

  private async savePieces(tape: Tape, organ: Organ, plotter: Plotter, pieces: readonly TapePiece[]): Promise<void> {
    const geometry = tapeGeometry(tape, organ);
    const fileNames = tapePieceFileNames(tape.name, pieces.length, (number, count) =>
      this.text('TAPE.EXPORT.PIECE_LABEL', {number, count}),
    );
    const svgPieces = pieces.flatMap((piece, index): readonly SvgPiece[] => {
      const fileName = fileNames.at(index);
      return fileName === undefined ? [] : [{fileName, svg: plotterSvg(pieceGeometry(geometry, piece))}];
    });
    const result = await this.api.plotter.savePieces({
      pieces: svgPieces,
      dialogTitle: this.text('TAPE.EXPORT.PIECES_DIALOG_TITLE'),
      dialogButton: this.text('TAPE.EXPORT.PIECES_DIALOG_BUTTON'),
      replaceMessage: this.text('TAPE.EXPORT.PIECES_REPLACE_MESSAGE'),
      replaceButton: this.text('TAPE.EXPORT.PIECES_REPLACE'),
      cancelButton: this.text('TAPE.EXPORT.PIECES_CANCEL'),
    });
    switch (result.status) {
      case 'saved':
        this.snackBar.open(
          this.text('TAPE.EXPORT.PIECES_SAVED', {count: String(result.fileNames.length), folder: result.folderPath}),
          undefined,
          {duration: SAVED_DURATION},
        );
        break;
      case 'cancelled':
        break;
      case 'failed':
        this.showFailure(
          this.text('TAPE.EXPORT.PIECES_FAILED', {file: result.fileName, reason: result.reason}),
          tape,
          organ,
          plotter,
        );
        break;
      case 'rejected':
        this.showFailure(this.text('TAPE.EXPORT.FAILED', {reason: result.reason}), tape, organ, plotter);
        break;
    }
  }

  /** Shows `message` until dismissed; Retry exports the Tape again with the same Plotter. */
  private showFailure(message: string, tape: Tape, organ: Organ, plotter: Plotter | undefined): void {
    this.snackBar
      .open(message, this.text('TAPE.EXPORT.RETRY'), {duration: 0})
      .onAction()
      .subscribe(() => void this.export(tape, organ, plotter));
  }

  private text(key: string, params?: Record<string, string>): string {
    return String(this.translate.instant(key, params));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
