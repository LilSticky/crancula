import {Mp3Encoder as LameEncoder} from '@breezystack/lamejs';
import {MP3_BIT_RATE, pcm16, RECORDING_CHANNELS, RECORDING_SAMPLE_RATE} from '@api/index';

/** Samples LAME takes per encodeBuffer call: one MPEG Layer III frame. */
const BLOCK_SAMPLES = 1152;

/**
 * Encodes mono samples to MP3 with LAME, one frame block at a time. Pure and synchronous, so the Worker and a
 * Vitest spec run the same code. `onProgress` gets the fraction of samples done; it ends with 1.
 */
export function encodeMp3(samples: Float32Array, onProgress: (fraction: number) => void): Uint8Array {
  const pcm = pcm16(samples);
  const encoder = new LameEncoder(RECORDING_CHANNELS, RECORDING_SAMPLE_RATE, MP3_BIT_RATE);
  const blocks: Uint8Array[] = [];
  for (let start = 0; start < pcm.length; start += BLOCK_SAMPLES) {
    const end = Math.min(start + BLOCK_SAMPLES, pcm.length);
    blocks.push(Uint8Array.from(encoder.encodeBuffer(pcm.subarray(start, end))));
    onProgress(end / pcm.length);
  }
  blocks.push(Uint8Array.from(encoder.flush()));
  onProgress(1);
  return concatenate(blocks);
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}
