import {describe, expect, it} from 'vitest';
import {encodeMp3} from './mp3-encode';

function sine(length: number): Float32Array {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index++) samples[index] = 0.5 * Math.sin((2 * Math.PI * 440 * index) / 44100);
  return samples;
}

describe('encodeMp3', () => {
  it('starts with an MPEG frame sync', () => {
    const bytes = encodeMp3(sine(44100), () => undefined);

    expect(bytes[0]).toBe(0xff);
    expect((bytes[1] ?? 0) & 0xe0).toBe(0xe0);
  });

  it('reports progress up to 1', () => {
    const progress: number[] = [];

    encodeMp3(sine(5 * 1152 + 10), (fraction) => progress.push(fraction));

    expect(progress.length).toBeGreaterThan(1);
    expect(progress.every((fraction) => fraction >= 0 && fraction <= 1)).toBe(true);
    expect(progress.at(-1)).toBe(1);
  });

  it('reports progress only when the whole percent changes, so at most 101 times', () => {
    const progress: number[] = [];

    encodeMp3(sine(20 * 44100), (fraction) => progress.push(fraction));

    const percents = progress.map((fraction) => Math.floor(fraction * 100));
    expect(progress.length).toBeLessThanOrEqual(101);
    expect(new Set(percents).size).toBe(percents.length);
    expect(progress.at(-1)).toBe(1);
  });

  it('encodes empty input to a valid, possibly empty, result', () => {
    const progress: number[] = [];

    const bytes = encodeMp3(new Float32Array(0), (fraction) => progress.push(fraction));

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(progress.at(-1)).toBe(1);
  });
});
