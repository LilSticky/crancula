import {InjectionToken} from '@angular/core';
import type {MidiNoteNumber} from '@api/index';
import {WebAudioPreviewSound} from './web-audio-preview-sound';

/** One sounding Pipe as the sound made it; the Preview only passes it back to `stop`. */
export type PreviewVoice = object;

/**
 * The sound a Preview plays on, against the audio clock. Times are seconds, as `now()` gives them.
 * The Web Audio adapter implements it in the app; specs use a fake with a controllable clock.
 */
export interface PreviewSound {
  now(): number;
  start(pipe: MidiNoteNumber, at: number): PreviewVoice;
  stop(voice: PreviewVoice, at: number): void;
  resume(): Promise<void>;
  close(): void;
}

/** Makes the PreviewSound a Preview plays on; a Preview calls it once, on its first play. */
export const PREVIEW_SOUND = new InjectionToken<() => PreviewSound>('PREVIEW_SOUND', {
  providedIn: 'root',
  factory: () => () =>
    new WebAudioPreviewSound(() => {
      if (typeof AudioContext === 'undefined') return undefined;
      try {
        return new AudioContext();
      } catch {
        return undefined;
      }
    }),
});
