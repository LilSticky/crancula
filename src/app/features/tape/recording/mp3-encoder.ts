import {InjectionToken} from '@angular/core';
import type {Mp3EncoderMessage} from './mp3-encoder-message';

const WORKER_FAILED = 'the MP3 encoder worker failed';
const UNREADABLE_MESSAGE = 'the MP3 encoder sent a message it could not read';
const ENCODE_CANCELLED = 'the MP3 encoding was cancelled';

/** Encodes rendered samples to MP3 bytes. */
export interface Mp3Encoder {
  /**
   * Takes the mono samples of a Recording; `onProgress` gets fractions from 0 to 1. The samples' buffer is handed
   * over to the encoder, so the caller's samples are detached once encode is called. Aborting `signal` stops the
   * encode at once: it rejects, and nothing more is encoded.
   */
  encode(samples: Float32Array, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<Uint8Array>;
}

/**
 * Encodes in a Web Worker, one worker per encode, terminated when the encode ends or is aborted. LAME is loaded
 * only here. The samples are transferred to the worker: after encode they are detached in the caller.
 */
export class WorkerMp3Encoder implements Mp3Encoder {
  encode(samples: Float32Array, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<Uint8Array> {
    const worker = new Worker(new URL('./mp3-encoder.worker', import.meta.url), {type: 'module'});
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        worker.terminate();
        reject(new Error(ENCODE_CANCELLED));
      };
      // Ends the encode: the Worker goes, and an abort after this point has nothing left to stop.
      const finish = () => {
        signal?.removeEventListener('abort', onAbort);
        worker.terminate();
      };
      signal?.addEventListener('abort', onAbort, {once: true});
      worker.onmessage = (event: MessageEvent<Mp3EncoderMessage>) => {
        const message = event.data;
        if ('progress' in message) {
          onProgress(message.progress);
          return;
        }
        finish();
        if ('bytes' in message) resolve(message.bytes);
        else reject(new Error(message.error));
      };
      worker.onerror = (event: Event) => {
        finish();
        reject(new Error(event instanceof ErrorEvent && event.message !== '' ? event.message : WORKER_FAILED));
      };
      worker.onmessageerror = () => {
        finish();
        reject(new Error(UNREADABLE_MESSAGE));
      };
      worker.postMessage(samples, [samples.buffer]);
    });
  }
}

/** The encoder a Recording uses: the LAME worker. */
export const MP3_ENCODER = new InjectionToken<Mp3Encoder>('Mp3Encoder', {
  providedIn: 'root',
  factory: () => new WorkerMp3Encoder(),
});
