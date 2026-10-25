const FULL_SCALE = 32767;

/**
 * Turns Float32 samples in [-1, 1] into 16-bit PCM: clamped, scaled by 32767 and rounded; NaN is silence.
 */
export function pcm16(samples: Float32Array): Int16Array {
  return Int16Array.from(samples, (sample) =>
    Number.isNaN(sample) ? 0 : Math.round(Math.min(1, Math.max(-1, sample)) * FULL_SCALE),
  );
}
