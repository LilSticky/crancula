import {computed, inject, Injectable, signal} from '@angular/core';
import {MatSnackBar} from '@angular/material/snack-bar';
import {TranslateService} from '@ngx-translate/core';
import {
  columnDuration,
  MAXIMUM_RECORDING_BYTES,
  performance as tapePerformance,
  pcm16,
  RECORDING_SAMPLE_RATE,
  recordingFileName,
  wavFile,
  type Organ,
  type RecordingFormat,
  type Tape,
} from '@api/index';
import {CRANCULA_API} from '../../../core/crancula-api.token';
import {MP3_ENCODER} from './mp3-encoder';
import {RECORDING_RENDERER, type RecordingScore} from './recording-renderer';

/** How long the "saved" and "cancelled" snackbars stay, in ms. */
const NOTICE_DURATION = 6000;

/** Where a Recording is in its steps; `progress` is a fraction from 0 to 1. */
export type RecordingState =
  | {readonly status: 'idle'}
  | {readonly status: 'choosing'}
  | {readonly status: 'rendering'; readonly progress: number}
  | {readonly status: 'encoding'; readonly progress: number}
  | {readonly status: 'writing'};

const IDLE: RecordingState = {status: 'idle'};

/**
 * Records a Tape to a WAV or MP3 file the owner chooses, and tells the user how it went.
 * The Tape view keeps Record and the Preview apart; this service only guards its own steps.
 */
@Injectable({providedIn: 'root'})
export class TapeRecorder {
  private readonly api = inject(CRANCULA_API);
  private readonly renderer = inject(RECORDING_RENDERER);
  private readonly encoder = inject(MP3_ENCODER);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly stateSignal = signal<RecordingState>(IDLE);
  /** Counts the Recordings started and cancelled; a run whose number is no longer current has been cancelled. */
  private generation = 0;
  /** Aborts the encode of the Recording that runs; a finished or cancelled one ignores it. */
  private encodeAbort: AbortController | undefined;

  /** The step the Recording is in; `idle` when none runs. */
  readonly state = this.stateSignal.asReadonly();
  /** True in every state but idle. */
  readonly recording = computed(() => this.stateSignal().status !== 'idle');

  /** Asks for the file, renders the Tape, encodes it if asked and writes it. A second call while one runs does nothing. */
  async record(tape: Tape, organ: Organ): Promise<void> {
    if (this.recording()) return;
    // Without a Tape per Crank turn there is no Column time; the Record button is disabled then.
    const columnSeconds = columnDuration(tape, organ);
    if (columnSeconds === undefined) return;
    const retry = () => void this.record(tape, organ);
    const generation = ++this.generation;
    const isCurrent = () => generation === this.generation;
    this.stateSignal.set({status: 'choosing'});
    try {
      const choice = await this.api.recording.chooseFile({
        suggestedFileName: recordingFileName(tape.name),
        dialogTitle: this.text('TAPE.RECORD.DIALOG_TITLE'),
        wavFilterName: this.text('TAPE.RECORD.WAV_FILTER'),
        mp3FilterName: this.text('TAPE.RECORD.MP3_FILTER'),
      });
      if (choice.status === 'cancelled') return;
      if (choice.status === 'rejected') {
        this.showFailure(choice.reason, retry);
        return;
      }
      const score: RecordingScore = {notes: tapePerformance(tape, organ), columns: tape.length, columnSeconds};
      const bytes = await this.render(score, choice.format, isCurrent);
      if (bytes === undefined) return;
      if (bytes.length > MAXIMUM_RECORDING_BYTES) {
        this.showFailure(this.text('TAPE.RECORD.TOO_LARGE'), retry);
        return;
      }
      this.stateSignal.set({status: 'writing'});
      const result = await this.api.recording.writeFile({target: choice.target, bytes});
      if (result.status === 'saved') {
        this.snackBar.open(this.text('TAPE.RECORD.SAVED', {name: result.filePath}), undefined, {duration: NOTICE_DURATION});
      } else {
        this.showFailure(result.reason, retry);
      }
    } catch (error: unknown) {
      if (isCurrent()) this.showFailure(error instanceof Error ? error.message : String(error), retry);
    } finally {
      if (isCurrent()) this.stateSignal.set(IDLE);
    }
  }

  /**
   * Stops the Recording while it renders or encodes: nothing is encoded or written, and the service goes idle.
   * The offline render cannot be aborted, so its result is just ignored; an encode is aborted. Does nothing in the
   * other steps.
   */
  cancel(): void {
    const status = this.stateSignal().status;
    if (status !== 'rendering' && status !== 'encoding') return;
    // The write target chosen for this Recording stays open in main until the next chooseFile closes it (ADR 26).
    this.generation++;
    this.encodeAbort?.abort();
    this.stateSignal.set(IDLE);
    this.snackBar.open(this.text('TAPE.RECORD.CANCELLED'), undefined, {duration: NOTICE_DURATION});
  }

  /** The file bytes of the Recording: the rendered samples as WAV, or the encoder's MP3; `undefined` once cancelled. */
  private async render(score: RecordingScore, format: RecordingFormat, isCurrent: () => boolean): Promise<Uint8Array | undefined> {
    this.stateSignal.set({status: 'rendering', progress: 0});
    const samples = await this.renderer.render(score, (progress) => {
      if (isCurrent()) this.stateSignal.set({status: 'rendering', progress});
    });
    if (!isCurrent()) return undefined;
    if (format === 'wav') return wavFile(pcm16(samples), RECORDING_SAMPLE_RATE);
    this.stateSignal.set({status: 'encoding', progress: 0});
    const abort = new AbortController();
    this.encodeAbort = abort;
    const bytes = await this.encoder.encode(
      samples,
      (progress) => {
        if (isCurrent()) this.stateSignal.set({status: 'encoding', progress});
      },
      abort.signal,
    );
    return isCurrent() ? bytes : undefined;
  }

  private showFailure(reason: string, retry: () => void): void {
    this.snackBar
      .open(this.text('TAPE.RECORD.FAILED', {reason}), this.text('TAPE.RECORD.RETRY'), {duration: 0})
      .onAction()
      .subscribe(retry);
  }

  private text(key: string, params?: Record<string, string>): string {
    return String(this.translate.instant(key, params));
  }
}
