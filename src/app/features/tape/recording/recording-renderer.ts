import {InjectionToken} from '@angular/core';
import type {PreviewNote} from '@api/index';
import {previewNoteWindows, RECORDING_CHANNELS, RECORDING_SAMPLE_RATE} from '@api/index';
import {previewVoices, RELEASE_SECONDS} from '../preview/preview-voices';

/** What the offline renderer plays: the notes of a Tape, its Columns and the seconds of one Column. */
export interface RecordingScore {
  readonly notes: readonly PreviewNote[];
  readonly columns: number;
  readonly columnSeconds: number;
}

/** Renders a score to samples; the Web Audio adapter plays it offline. */
export interface RecordingRenderer {
  /** Mono samples in [-1, 1] at RECORDING_SAMPLE_RATE; `onProgress` gets fractions from 0 to 1. */
  render(score: RecordingScore, onProgress: (fraction: number) => void): Promise<Float32Array>;
}

/** Seconds of notes scheduled at a time; the context is suspended at the start of each window. */
const WINDOW_SECONDS = 10;

/** The parts of an OfflineAudioContext the renderer uses; a fake in a spec needs only these. */
export type OfflineScoreContext = BaseAudioContext & Pick<OfflineAudioContext, 'suspend' | 'resume' | 'startRendering'>;

function offlineContextOf(length: number): OfflineScoreContext {
  return new OfflineAudioContext(RECORDING_CHANNELS, length, RECORDING_SAMPLE_RATE);
}

/**
 * Plays the Preview's voices on an OfflineAudioContext, one window of notes at a time: the context is suspended
 * at each window start, that window's voices are scheduled, and it resumes. Renders as fast as the browser allows.
 */
export class OfflineRecordingRenderer implements RecordingRenderer {
  constructor(private readonly createContext: (length: number) => OfflineScoreContext = offlineContextOf) {}

  async render(score: RecordingScore, onProgress: (fraction: number) => void): Promise<Float32Array> {
    const duration = score.columns * score.columnSeconds + RELEASE_SECONDS;
    const context = this.createContext(Math.ceil(duration * RECORDING_SAMPLE_RATE));
    const voices = previewVoices(context, context.destination);
    const windows = previewNoteWindows(score.notes, score.columnSeconds, WINDOW_SECONDS);
    const rendering = context.startRendering();
    for (const [index, window] of windows.entries()) {
      await context.suspend(index * WINDOW_SECONDS);
      for (const note of window) {
        voices.stop(voices.start(note.pipe, note.startSeconds), note.stopSeconds);
      }
      void context.resume();
      onProgress((index + 1) / windows.length);
    }
    const buffer = await rendering;
    return buffer.getChannelData(0);
  }
}

/** The renderer a Recording uses: the Preview's voices played offline in the app's audio engine. */
export const RECORDING_RENDERER = new InjectionToken<RecordingRenderer>('RecordingRenderer', {
  providedIn: 'root',
  factory: () => new OfflineRecordingRenderer(),
});
