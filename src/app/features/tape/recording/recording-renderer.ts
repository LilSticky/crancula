import {InjectionToken} from '@angular/core';
import type {PreviewNote} from '@api/index';

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

/** The renderer a Recording uses; the offline adapter is not written yet, so it fails every render. */
export const RECORDING_RENDERER = new InjectionToken<RecordingRenderer>('RecordingRenderer', {
  providedIn: 'root',
  factory: () => ({
    render: () => Promise.reject(new Error('not implemented')),
  }),
});
