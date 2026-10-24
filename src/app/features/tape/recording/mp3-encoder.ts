import {InjectionToken} from '@angular/core';

/** Encodes rendered samples to MP3 bytes. */
export interface Mp3Encoder {
  /** Takes the mono samples of a Recording; `onProgress` gets fractions from 0 to 1. */
  encode(samples: Float32Array, onProgress: (fraction: number) => void): Promise<Uint8Array>;
}

/** The encoder a Recording uses; the MP3 adapter is not written yet, so it fails every encode. */
export const MP3_ENCODER = new InjectionToken<Mp3Encoder>('Mp3Encoder', {
  providedIn: 'root',
  factory: () => ({
    encode: () => Promise.reject(new Error('not implemented')),
  }),
});
