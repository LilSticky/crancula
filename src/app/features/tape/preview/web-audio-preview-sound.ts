import type {MidiNoteNumber} from '@api/index';
import type {PreviewSound, PreviewVoice} from './preview-sound';
import {previewVoices, type PreviewVoices} from './preview-voices';

/** The voice of a Pipe while there is no sound device: it makes no sound and stops silently. */
const SILENT_VOICE: PreviewVoice = {};

/**
 * The Preview's sound in the app: a flue-pipe-like tone per Pipe (research R5), on the audio clock of
 * an AudioContext. Without a sound device it keeps time on `performance.now()` and makes no sound.
 */
export class WebAudioPreviewSound implements PreviewSound {
  private readonly context: AudioContext | undefined;
  private readonly voices: PreviewVoices | undefined;

  /** `createContext` makes the AudioContext; it answers `undefined` when no sound device can be opened. */
  constructor(createContext: () => AudioContext | undefined) {
    this.context = createContext();
    this.voices = this.context === undefined ? undefined : previewVoices(this.context, this.context.destination);
  }

  now(): number {
    return this.context?.currentTime ?? performance.now() / 1000;
  }

  start(pipe: MidiNoteNumber, at: number): PreviewVoice {
    return this.voices?.start(pipe, at) ?? SILENT_VOICE;
  }

  stop(voice: PreviewVoice, at: number): void {
    this.voices?.stop(voice, at);
  }

  async resume(): Promise<void> {
    await this.context?.resume();
  }

  close(): void {
    void this.context?.close();
  }
}
