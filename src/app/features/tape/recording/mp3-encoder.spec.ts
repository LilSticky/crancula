import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {WorkerMp3Encoder} from './mp3-encoder';

/** A Worker the spec drives by hand: the test fires the events the encoder listens to. */
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessageerror: ((event: Event) => void) | null = null;
  readonly terminate = vi.fn<() => void>();
  readonly postMessage = vi.fn<(message: unknown, transfer?: Transferable[]) => void>();

  constructor() {
    workers.push(this);
  }
}

const workers: FakeWorker[] = [];

/** Starts an encode and returns the one Worker it created. */
function encodeWithWorker(signal?: AbortSignal): {readonly pending: Promise<Uint8Array>; readonly worker: FakeWorker} {
  const pending = new WorkerMp3Encoder().encode(new Float32Array(1), () => undefined, signal);
  const worker = workers.at(-1);
  if (worker === undefined) throw new Error('invalid test value: no Worker was created');
  return {pending, worker};
}

describe('WorkerMp3Encoder', () => {
  beforeEach(() => {
    workers.length = 0;
    vi.stubGlobal('Worker', FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects with a fallback reason when the Worker fails with a plain Event that has no message', async () => {
    const {pending, worker} = encodeWithWorker();

    worker.onerror?.(new Event('error'));

    await expect(pending).rejects.toThrow('the MP3 encoder worker failed');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects with the message of the Worker error when it has one', async () => {
    const {pending, worker} = encodeWithWorker();

    worker.onerror?.(new ErrorEvent('error', {message: 'the encoder ran out of memory'}));

    await expect(pending).rejects.toThrow('the encoder ran out of memory');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects, and so settles, when the Worker posts a message it cannot read', async () => {
    const {pending, worker} = encodeWithWorker();

    worker.onmessageerror?.(new Event('messageerror'));

    await expect(pending).rejects.toThrow('the MP3 encoder sent a message it could not read');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('terminates the Worker and rejects when the signal aborts while it encodes', async () => {
    const controller = new AbortController();
    const {pending, worker} = encodeWithWorker(controller.signal);

    controller.abort();

    await expect(pending).rejects.toThrow('the MP3 encoding was cancelled');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the signal aborts after the encode has ended', async () => {
    const controller = new AbortController();
    const {pending, worker} = encodeWithWorker(controller.signal);
    worker.onmessage?.(new MessageEvent('message', {data: {bytes: new Uint8Array([1])}}));
    await pending;

    controller.abort();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
