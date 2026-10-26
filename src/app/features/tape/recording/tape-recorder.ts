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

/** How long the "saved" snackbar stays, in ms. */
const SAVED_DURATION = 6000;

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
      const bytes = await this.render(score, choice.format);
      if (bytes.length > MAXIMUM_RECORDING_BYTES) {
        this.showFailure(this.text('TAPE.RECORD.TOO_LARGE'), retry);
        return;
      }
      this.stateSignal.set({status: 'writing'});
      const result = await this.api.recording.writeFile({target: choice.target, bytes});
      if (result.status === 'saved') {
        this.snackBar.open(this.text('TAPE.RECORD.SAVED', {name: result.filePath}), undefined, {duration: SAVED_DURATION});
      } else {
        this.showFailure(result.reason, retry);
      }
    } catch (error: unknown) {
      this.showFailure(error instanceof Error ? error.message : String(error), retry);
    } finally {
      this.stateSignal.set(IDLE);
    }
  }

  /** The file bytes of the Recording: the rendered samples as WAV, or the encoder's MP3. */
  private async render(score: RecordingScore, format: RecordingFormat): Promise<Uint8Array> {
    this.stateSignal.set({status: 'rendering', progress: 0});
    const samples = await this.renderer.render(score, (progress) => {
      this.stateSignal.set({status: 'rendering', progress});
    });
    if (format === 'wav') return wavFile(pcm16(samples), RECORDING_SAMPLE_RATE);
    this.stateSignal.set({status: 'encoding', progress: 0});
    return this.encoder.encode(samples, (progress) => {
      this.stateSignal.set({status: 'encoding', progress});
    });
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
