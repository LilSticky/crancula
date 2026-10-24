import type {MidiNoteNumber} from '@api/index';
import {noteFrequency} from '@api/index';
import type {PreviewVoice} from './preview-sound';

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

/** Starts and stops the voices of Pipes on one audio graph. */
export interface PreviewVoices {
  start(pipe: MidiNoteNumber, at: number): PreviewVoice;
  stop(voice: PreviewVoice, at: number): void;
}

/** A sounding Pipe made of Web Audio nodes; `stop` needs the envelope and the oscillators. */
class WebAudioVoice {
  constructor(
    readonly oscillators: readonly OscillatorNode[],
    readonly envelope: GainNode,
  ) {}
}

/**
 * The voice graph of the Preview's tone (research R5) on any BaseAudioContext, realtime or offline: per Pipe three
 * sine oscillators into one envelope, every envelope into one master gain, then one compressor, then `destination`.
 * It needs no clock and no resume; the caller owns the context.
 */
export function previewVoices(context: BaseAudioContext, destination: AudioNode): PreviewVoices {
  const master = context.createGain();
  master.gain.value = MASTER_GAIN;
  const compressor = context.createDynamicsCompressor();
  master.connect(compressor);
  compressor.connect(destination);

  return {
    start(pipe, at) {
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
    },
    stop(voice, at) {
      if (!(voice instanceof WebAudioVoice)) return;
      const end = at + RELEASE_SECONDS;
      // Hold the envelope where it stands at `at`, so the release starts from there rather than jumping.
      voice.envelope.gain.cancelAndHoldAtTime(at);
      voice.envelope.gain.linearRampToValueAtTime(0, end);
      for (const oscillator of voice.oscillators) {
        oscillator.stop(end);
      }
    },
  };
}
