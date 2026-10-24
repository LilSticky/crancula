import {TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {midiNoteNumber, noteFrequency, type MidiNoteNumber} from '@api/index';
import {PREVIEW_SOUND} from './preview-sound';
import {WebAudioPreviewSound} from './web-audio-preview-sound';

/*
 * Intended API (red phase, implementer builds exactly this):
 *
 * web-audio-preview-sound.ts
 *   export class WebAudioPreviewSound implements PreviewSound {
 *     constructor(createContext: () => AudioContext | undefined);
 *     // R5 tone: per Pipe three sine oscillators at f, 2f, 3f with gains 1, 0.5, 0.25,
 *     // into one envelope gain (0 -> peak over 15 ms from `at`), then a master gain of 0.2,
 *     // then a DynamicsCompressor, then the destination.
 *     // stop(voice, at): envelope ramps to 0 over 30 ms from `at`; oscillators stop at at + 0.03.
 *     // Without a context: now() is performance.now() / 1000; start, stop and resume do nothing.
 *   }
 *
 * preview-sound.ts
 *   PREVIEW_SOUND defaults to a factory that returns a WebAudioPreviewSound (providedIn root).
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

/** A minimal AudioContext: a clock, a destination, and records of what the adapter created. */
class FakeAudioContext {
  currentTime = 0;
  readonly destination = new FakeDestination();
  readonly oscillators: FakeOscillator[] = [];
  closed = false;
  resumed = false;

  createOscillator(): FakeOscillator {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGain {
    return new FakeGain();
  }

  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor();
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }

  resume(): Promise<void> {
    this.resumed = true;
    return Promise.resolve();
  }
}

/** The nodes an oscillator's signal passes through, from the oscillator to the end of its first connections. */
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

describe('WebAudioPreviewSound', () => {
  let context: FakeAudioContext;
  let sound: WebAudioPreviewSound;

  beforeEach(() => {
    context = new FakeAudioContext();
    sound = new WebAudioPreviewSound(() => context as unknown as AudioContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('with an audio context', () => {
    it('starts three sine oscillators at the note frequency and its 2nd and 3rd harmonics', () => {
      const fundamental = noteFrequency(note(69));

      sound.start(note(69), 1);

      expect(context.oscillators).toHaveLength(3);
      expect(context.oscillators.map((oscillator) => oscillator.frequency.value)).toEqual([
        fundamental,
        2 * fundamental,
        3 * fundamental,
      ]);
      expect(context.oscillators.map((oscillator) => oscillator.type)).toEqual(['sine', 'sine', 'sine']);
      expect(context.oscillators.map((oscillator) => oscillator.startedAt)).toEqual([1, 1, 1]);
    });

    it('weights the harmonics 1, 0.5 and 0.25 before the envelope', () => {
      sound.start(note(69), 1);

      const harmonicGains = context.oscillators.map((oscillator) => gainOf(route(oscillator)[1]).gain.value);

      expect(harmonicGains).toEqual([1, 0.5, 0.25]);
    });

    it('ramps the envelope from silence to a peak over 15 ms from the start time', () => {
      sound.start(note(69), 1);

      const envelopes = context.oscillators.map((oscillator) => route(oscillator)[2]);
      const envelope = gainOf(envelopes[0]);

      expect(envelopes[1]).toBe(envelope);
      expect(envelopes[2]).toBe(envelope);
      expect(envelope.gain.events).toContainEqual(expect.objectContaining({kind: 'set', value: 0, time: 1}));
      expect(envelope.gain.events).toContainEqual(
        expect.objectContaining({kind: 'ramp', time: expect.closeTo(1 + ATTACK_SECONDS, 9)}),
      );
      const peak = envelope.gain.events.find((event) => event.kind === 'ramp');
      expect(peak?.value).toBeGreaterThan(0);
    });

    it('routes every voice through a master gain of 0.2 and a compressor to the destination', () => {
      sound.start(note(69), 1);

      const path = route(defined(context.oscillators[0], 'first oscillator'));

      expect(path).toHaveLength(6);
      expect(gainOf(path[3]).gain.value).toBe(0.2);
      expect(path[4]).toBeInstanceOf(FakeCompressor);
      expect(path[5]).toBe(context.destination);
    });

    it('holds the envelope at its current value when a voice stops, so the release starts at the stop time', () => {
      const voice = sound.start(note(69), 1);

      sound.stop(voice, 2);

      const oscillator = defined(context.oscillators[0], 'first oscillator');
      const events = gainOf(route(oscillator)[2]).gain.events;
      const hold = events.findIndex((event) => event.time === 2 && (event.kind === 'hold' || event.kind === 'set'));
      const release = events.findIndex((event) => event.kind === 'ramp' && event.value === 0);
      expect(hold).toBeGreaterThanOrEqual(0);
      expect(release).toBeGreaterThan(hold);
      expect(events[release]?.time).toBeCloseTo(2 + RELEASE_SECONDS, 9);
    });

    it('stops a voice by ramping its envelope to silence over 30 ms and stopping the oscillators after it', () => {
      const voice = sound.start(note(69), 1);

      sound.stop(voice, 2);

      const oscillator = defined(context.oscillators[0], 'first oscillator');
      const envelope = gainOf(route(oscillator)[2]);
      expect(envelope.gain.events).toContainEqual(
        expect.objectContaining({kind: 'ramp', value: 0, time: expect.closeTo(2 + RELEASE_SECONDS, 9)}),
      );
      for (const stopped of context.oscillators) {
        expect(stopped.stoppedAt).toBeCloseTo(2 + RELEASE_SECONDS, 9);
      }
    });

    it('accepts a stop time before the start time of the voice', () => {
      const voice = sound.start(note(69), 1);

      expect(() => {
        sound.stop(voice, 0.5);
      }).not.toThrow();
      for (const stopped of context.oscillators) {
        expect(stopped.stoppedAt).toBeCloseTo(0.5 + RELEASE_SECONDS, 9);
      }
    });

    it('now() is the clock of the audio context', () => {
      context.currentTime = 3.5;

      expect(sound.now()).toBe(3.5);
    });

    it('closes the audio context', () => {
      sound.close();

      expect(context.closed).toBe(true);
    });

    it('resumes the audio context', async () => {
      await sound.resume();

      expect(context.resumed).toBe(true);
    });
  });

  describe('without a sound device', () => {
    let silent: WebAudioPreviewSound;

    beforeEach(() => {
      silent = new WebAudioPreviewSound(() => undefined);
    });

    it('now() follows performance.now() in seconds', () => {
      vi.spyOn(performance, 'now').mockReturnValue(4200);

      expect(silent.now()).toBeCloseTo(4.2, 9);
    });

    it('makes no sound when a voice starts and stops', () => {
      expect(() => {
        const voice = silent.start(note(69), 1);
        silent.stop(voice, 2);
      }).not.toThrow();
    });

    it('resumes and closes without error', async () => {
      await expect(silent.resume()).resolves.toBeUndefined();
      expect(() => {
        silent.close();
      }).not.toThrow();
    });
  });

  describe('as the PREVIEW_SOUND default', () => {
    it('makes a WebAudioPreviewSound', () => {
      const made = TestBed.inject(PREVIEW_SOUND)();

      expect(made).toBeInstanceOf(WebAudioPreviewSound);
    });
  });
});
