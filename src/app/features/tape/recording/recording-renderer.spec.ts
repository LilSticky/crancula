import {describe, expect, it, vi} from 'vitest';
import {midiNoteNumber, type MidiNoteNumber, type PreviewNote} from '@api/index';
import {RELEASE_SECONDS} from '../preview/preview-voices';
import {OfflineRecordingRenderer, type OfflineScoreContext, type RecordingScore} from './recording-renderer';

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`invalid test value: ${what}`);
  return value;
}

function note(value: number): MidiNoteNumber {
  return defined(midiNoteNumber(value), `note ${value}`);
}

function previewNote(pipe: number, startColumn: number, endColumn: number): PreviewNote {
  return {pipe: note(pipe), startColumn, endColumn};
}

class FakeNode {
  connect(target: FakeNode): FakeNode {
    return target;
  }
}

class FakeParam {
  value = 1;

  setValueAtTime(): this {
    return this;
  }

  linearRampToValueAtTime(): this {
    return this;
  }

  cancelAndHoldAtTime(): this {
    return this;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeOscillator extends FakeNode {
  type = 'custom';
  readonly frequency = new FakeParam();

  constructor(private readonly events: string[]) {
    super();
  }

  start(when = 0): void {
    this.events.push(`start ${when}`);
  }

  stop(): void {}
}

class FakeCompressor extends FakeNode {}

/**
 * An OfflineAudioContext and nothing more: it logs what the renderer schedules, in order, and every suspend
 * resolves at once. Channel 0 of the rendered buffer is `samples`; any other channel is empty.
 */
class FakeOfflineContext {
  readonly events: string[] = [];
  readonly destination = new FakeNode();
  private readonly buffer = {
    getChannelData: (channel: number) => (channel === 0 ? this.samples : new Float32Array(0)),
  };

  constructor(private readonly samples: Float32Array) {}

  createGain(): FakeGain {
    return new FakeGain();
  }

  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor();
  }

  createOscillator(): FakeOscillator {
    return new FakeOscillator(this.events);
  }

  suspend(when: number): Promise<void> {
    this.events.push(`suspend ${when}`);
    return Promise.resolve();
  }

  resume(): Promise<void> {
    this.events.push('resume');
    return Promise.resolve();
  }

  startRendering(): Promise<AudioBuffer> {
    this.events.push('render');
    return Promise.resolve(this.buffer as unknown as AudioBuffer);
  }
}

function offlineOf(fake: FakeOfflineContext): OfflineScoreContext {
  return fake as unknown as OfflineScoreContext;
}

function score(notes: readonly PreviewNote[], columns: number, columnSeconds: number): RecordingScore {
  return {notes, columns, columnSeconds};
}

describe('OfflineRecordingRenderer', () => {
  it('sizes the offline context to the Tape and its release at the recording sample rate', async () => {
    const lengths: number[] = [];
    const renderer = new OfflineRecordingRenderer((length) => {
      lengths.push(length);
      return offlineOf(new FakeOfflineContext(new Float32Array(0)));
    });

    await renderer.render(score([], 10, 1), () => {});

    expect(lengths).toEqual([Math.ceil((10 + RELEASE_SECONDS) * 44100)]);
  });

  it('schedules the notes of each 10 s window between its suspend and resume', async () => {
    const fake = new FakeOfflineContext(new Float32Array(0));
    const renderer = new OfflineRecordingRenderer(() => offlineOf(fake));

    await renderer.render(score([previewNote(60, 0, 2), previewNote(62, 12, 13)], 20, 1), () => {});

    expect(fake.events).toEqual([
      'start 0',
      'start 0',
      'start 0',
      'suspend 10',
      'render',
      'start 12',
      'start 12',
      'start 12',
      'resume',
    ]);
  });

  it('starts the first window before the rendering starts, and registers each next suspend before it resumes', async () => {
    const fake = new FakeOfflineContext(new Float32Array(0));
    const renderer = new OfflineRecordingRenderer(() => offlineOf(fake));

    await renderer.render(score([previewNote(60, 0, 2), previewNote(62, 12, 13), previewNote(64, 22, 23)], 30, 1), () => {});

    expect(fake.events.indexOf('start 0')).toBeLessThan(fake.events.indexOf('render'));
    expect(fake.events.indexOf('suspend 10')).toBeLessThan(fake.events.indexOf('render'));
    expect(fake.events.indexOf('suspend 20')).toBeLessThan(fake.events.indexOf('resume'));
  });

  it('reports progress after each window', async () => {
    const fake = new FakeOfflineContext(new Float32Array(0));
    const renderer = new OfflineRecordingRenderer(() => offlineOf(fake));
    const onProgress = vi.fn();

    await renderer.render(score([previewNote(60, 0, 2), previewNote(62, 12, 13)], 20, 1), onProgress);

    expect(onProgress.mock.calls).toEqual([[0.5], [1]]);
  });

  it('resolves with the samples of channel 0 of the rendered buffer', async () => {
    const samples = new Float32Array([0.25, -0.5, 0.125]);
    const renderer = new OfflineRecordingRenderer(() => offlineOf(new FakeOfflineContext(samples)));

    const rendered = await renderer.render(score([], 1, 1), () => {});

    expect(rendered).toBe(samples);
  });

  it('reports progress 1 only once the rendering has ended', async () => {
    const fake = new FakeOfflineContext(new Float32Array(0));
    let endRendering: () => void = () => undefined;
    fake.startRendering = () =>
      new Promise<AudioBuffer>((resolve) => {
        endRendering = () => resolve({getChannelData: () => new Float32Array(0)} as unknown as AudioBuffer);
      });
    const renderer = new OfflineRecordingRenderer(() => offlineOf(fake));
    const onProgress = vi.fn();

    const rendering = renderer.render(score([previewNote(60, 0, 2), previewNote(62, 12, 13)], 20, 1), onProgress);
    await vi.waitFor(() => {
      expect(fake.events).toContain('resume');
    });
    expect(onProgress.mock.calls).toEqual([[0.5]]);

    endRendering();
    await rendering;
    expect(onProgress.mock.calls).toEqual([[0.5], [1]]);
  });

  it('renders a Tape without notes as silence, with no suspend, and reports progress 1 once rendered', async () => {
    const fake = new FakeOfflineContext(new Float32Array(4));
    const renderer = new OfflineRecordingRenderer(() => offlineOf(fake));
    const onProgress = vi.fn();

    await renderer.render(score([], 1, 1), onProgress);

    expect(fake.events).toEqual(['render']);
    expect(onProgress.mock.calls).toEqual([[1]]);
  });
});
