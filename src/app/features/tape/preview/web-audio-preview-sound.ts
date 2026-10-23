import type {MidiNoteNumber} from '@api/index';
import {noteFrequency} from '@api/index';
import type {PreviewSound, PreviewVoice} from './preview-sound';

/** Attack of the envelope, seconds (research R5). */
const ATTACK_SECONDS = 0.015;
/** Release of the envelope, seconds (research R5). */
const RELEASE_SECONDS = 0.03;
/** Level of the envelope at its peak; the master gain sets the loudness. */
const PEAK_GAIN = 1;
/** Master gain of all voices together (research R5). */
const MASTER_GAIN = 0.2;
/** The fundamental and its 2nd and 3rd harmonics, with their gains (research R5). */
const HARMONICS: readonly {readonly multiple: number; readonly gain: number}[] = [
  {multiple: 1, gain: 1},
  {multiple: 2, gain: 0.5},
  {multiple: 3, gain: 0.25},
];

/** A sounding Pipe made of Web Audio nodes; `stop` needs the envelope and the oscillators. */
class WebAudioVoice {
  constructor(
    readonly oscillators: readonly OscillatorNode[],
    readonly envelope: GainNode,
  ) {}
}

/** The voice of a Pipe while there is no sound device: it makes no sound and stops silently. */
const SILENT_VOICE: PreviewVoice = {};

/**
 * The Preview's sound in the app: a flue-pipe-like tone per Pipe (research R5), on the audio clock of
 * an AudioContext. Without a sound device it keeps time on `performance.now()` and makes no sound.
 */
export class WebAudioPreviewSound implements PreviewSound {
  private readonly context: AudioContext | undefined;
  private readonly master: GainNode | undefined;

  /** `createContext` makes the AudioContext; it answers `undefined` when no sound device can be opened. */
  constructor(createContext: () => AudioContext | undefined) {
    this.context = createContext();
    if (this.context === undefined) {
      this.master = undefined;
      return;
    }
    const master = this.context.createGain();
    master.gain.value = MASTER_GAIN;
    const compressor = this.context.createDynamicsCompressor();
    master.connect(compressor);
    compressor.connect(this.context.destination);
    this.master = master;
  }

  now(): number {
    return this.context?.currentTime ?? performance.now() / 1000;
  }

  start(pipe: MidiNoteNumber, at: number): PreviewVoice {
    const context = this.context;
    const master = this.master;
    if (context === undefined || master === undefined) return SILENT_VOICE;
    const fundamental = noteFrequency(pipe);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(PEAK_GAIN, at + ATTACK_SECONDS);
    envelope.connect(master);
    const oscillators = HARMONICS.map(({multiple, gain}) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = multiple * fundamental;
      const harmonic = context.createGain();
      harmonic.gain.value = gain;
      oscillator.connect(harmonic);
      harmonic.connect(envelope);
      oscillator.start(at);
      return oscillator;
    });
    return new WebAudioVoice(oscillators, envelope);
  }

  stop(voice: PreviewVoice, at: number): void {
    if (!(voice instanceof WebAudioVoice)) return;
    const end = at + RELEASE_SECONDS;
    // Hold the envelope where it stands at `at`, so the release starts from there rather than jumping.
    voice.envelope.gain.cancelAndHoldAtTime(at);
    voice.envelope.gain.linearRampToValueAtTime(0, end);
    for (const oscillator of voice.oscillators) {
      oscillator.stop(end);
    }
  }

  async resume(): Promise<void> {
    await this.context?.resume();
  }

  close(): void {
    void this.context?.close();
  }
}
