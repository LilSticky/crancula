import {describe, expect, it} from 'vitest';
import {midiNoteNumber, noteFrequency, type MidiNoteNumber} from '@api/index';
import {previewVoices} from './preview-voices';

/*
 * Intended API (red phase, implementer builds exactly this):
 *
 * preview-voices.ts
 *   export interface PreviewVoices {
 *     start(pipe: MidiNoteNumber, at: number): PreviewVoice;   // PreviewVoice from ./preview-sound
 *     stop(voice: PreviewVoice, at: number): void;
 *   }
 *   export function previewVoices(context: BaseAudioContext, destination: AudioNode): PreviewVoices;
 *     // builds the R5 voice graph on any BaseAudioContext (realtime or offline), no clock, no resume:
 *     // per Pipe three sine oscillators at f, 2f, 3f with gains 1, 0.5, 0.25 into one envelope gain
 *     // (0 -> 1 over 15 ms from `at`); every envelope feeds ONE master gain of 0.2, then ONE
 *     // DynamicsCompressor, then `destination`. stop(voice, at): envelope held at `at`, ramps to 0 over
 *     // 30 ms, oscillators stop at at + 0.03.
 *   WebAudioPreviewSound uses it with (context, context.destination); its spec stays unchanged.
 */

/** Attack of the envelope, seconds (R5). */
const ATTACK_SECONDS = 0.015;
/** Release of the envelope, seconds (R5). */
const RELEASE_SECONDS = 0.03;

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function note(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

interface ParamEvent {
  readonly kind: 'set' | 'ramp' | 'cancel' | 'hold';
  readonly value?: number;
  readonly time: number;
}

class FakeParam {
  value = 1;
  readonly events: ParamEvent[] = [];

  setValueAtTime(value: number, time: number): this {
    this.events.push({kind: 'set', value, time});
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({kind: 'ramp', value, time});
    return this;
  }

  cancelScheduledValues(time: number): this {
    this.events.push({kind: 'cancel', time});
    return this;
  }

  cancelAndHoldAtTime(time: number): this {
    this.events.push({kind: 'hold', time});
    return this;
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];

  connect(target: FakeNode): FakeNode {
    this.outputs.push(target);
    return target;
  }

  disconnect(): void {
    this.outputs.length = 0;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type = 'custom';
  readonly frequency = new FakeParam();
  startedAt: number | undefined;
  stoppedAt: number | undefined;

  start(when = 0): void {
    this.startedAt = when;
  }

  stop(when = 0): void {
    this.stoppedAt = when;
  }
}

class FakeCompressor extends FakeNode {}

class FakeDestination extends FakeNode {}

/**
 * A BaseAudioContext and nothing more: no clock, no resume, no close. An offline context has the same
 * factory methods, so the voice graph must not need the rest of AudioContext.
 */
class FakeBaseAudioContext {
  readonly oscillators: FakeOscillator[] = [];
  readonly gains: FakeGain[] = [];
  readonly compressors: FakeCompressor[] = [];

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGain {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createDynamicsCompressor(): FakeCompressor {
    const compressor = new FakeCompressor();
    this.compressors.push(compressor);
    return compressor;
  }
}

/** The nodes a signal passes through, from `from` to the end of its first connections. */
function route(from: FakeNode): FakeNode[] {
  const path: FakeNode[] = [from];
  let next = from.outputs[0];
  while (next !== undefined) {
    path.push(next);
    next = next.outputs[0];
  }
  return path;
}

function gainOf(node: FakeNode | undefined): FakeGain {
  if (!(node instanceof FakeGain)) throw new Error('invalid test value: expected a gain node');
  return node;
}

describe('previewVoices', () => {
  it('builds the voice graph on a plain BaseAudioContext and plays a voice into the given destination', () => {
    const context = new FakeBaseAudioContext();
    const destination = new FakeDestination();
    const voices = previewVoices(context as unknown as BaseAudioContext, destination as unknown as AudioNode);

    const voice = voices.start(note(69), 1);
    voices.stop(voice, 2);

    expect(context.oscillators).toHaveLength(3);
    expect(route(defined(context.oscillators[0], 'first oscillator')).at(-1)).toBe(destination);
  });

  it('starts three sine oscillators at the note frequency and its 2nd and 3rd harmonics, from the start time', () => {
    const context = new FakeBaseAudioContext();
    const voices = previewVoices(context as unknown as BaseAudioContext, new FakeDestination() as unknown as AudioNode);
    const fundamental = noteFrequency(note(69));

    voices.start(note(69), 1);

    expect(context.oscillators.map((oscillator) => oscillator.frequency.value)).toEqual([
      fundamental,
      2 * fundamental,
      3 * fundamental,
    ]);
    expect(context.oscillators.map((oscillator) => oscillator.type)).toEqual(['sine', 'sine', 'sine']);
    expect(context.oscillators.map((oscillator) => oscillator.startedAt)).toEqual([1, 1, 1]);
  });

  it('weights the harmonics 1, 0.5 and 0.25 before the envelope', () => {
    const context = new FakeBaseAudioContext();
    const voices = previewVoices(context as unknown as BaseAudioContext, new FakeDestination() as unknown as AudioNode);

    voices.start(note(69), 1);

    const harmonicGains = context.oscillators.map((oscillator) => gainOf(route(oscillator)[1]).gain.value);
    expect(harmonicGains).toEqual([1, 0.5, 0.25]);
  });

  it('ramps the envelope from silence to a peak over 15 ms from the start time', () => {
    const context = new FakeBaseAudioContext();
    const voices = previewVoices(context as unknown as BaseAudioContext, new FakeDestination() as unknown as AudioNode);

    voices.start(note(69), 1);

    const envelope = gainOf(route(defined(context.oscillators[0], 'first oscillator'))[2]);
    expect(envelope.gain.events).toContainEqual(expect.objectContaining({kind: 'set', value: 0, time: 1}));
    expect(envelope.gain.events).toContainEqual(
      expect.objectContaining({kind: 'ramp', time: expect.closeTo(1 + ATTACK_SECONDS, 9)}),
    );
  });

  it('feeds every voice into one shared master gain of 0.2, then one compressor, then the destination', () => {
    const context = new FakeBaseAudioContext();
    const destination = new FakeDestination();
    const voices = previewVoices(context as unknown as BaseAudioContext, destination as unknown as AudioNode);

    voices.start(note(69), 1);
    voices.start(note(72), 1);

    const paths = context.oscillators.map((oscillator) => route(oscillator));
    const masters = new Set(paths.map((path) => path[3]));
    const compressors = new Set(paths.map((path) => path[4]));
    expect(masters.size).toBe(1);
    expect(compressors.size).toBe(1);
    const firstPath = defined(paths[0], 'first path');
    expect(gainOf(firstPath[3]).gain.value).toBe(0.2);
    expect(firstPath[4]).toBeInstanceOf(FakeCompressor);
    expect(firstPath[5]).toBe(destination);
  });

  it('stops a voice by holding its envelope at the stop time, ramping it to silence over 30 ms and stopping the oscillators after it', () => {
    const context = new FakeBaseAudioContext();
    const voices = previewVoices(context as unknown as BaseAudioContext, new FakeDestination() as unknown as AudioNode);
    const voice = voices.start(note(69), 1);

    voices.stop(voice, 2);

    const envelope = gainOf(route(defined(context.oscillators[0], 'first oscillator'))[2]);
    expect(envelope.gain.events).toContainEqual(expect.objectContaining({kind: 'hold', time: 2}));
    expect(envelope.gain.events).toContainEqual(
      expect.objectContaining({kind: 'ramp', value: 0, time: expect.closeTo(2 + RELEASE_SECONDS, 9)}),
    );
    for (const oscillator of context.oscillators) {
      expect(oscillator.stoppedAt).toBeCloseTo(2 + RELEASE_SECONDS, 9);
    }
  });
});
