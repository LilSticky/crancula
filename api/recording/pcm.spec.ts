import {describe, expect, it} from 'vitest';
import {pcm16} from './pcm';

describe('pcm16', () => {
  it('maps silence to 0', () => {
    expect(Array.from(pcm16(new Float32Array([0])))).toEqual([0]);
  });

  it('maps full scale to 32767 and minus full scale to -32767', () => {
    expect(Array.from(pcm16(new Float32Array([1, -1])))).toEqual([32767, -32767]);
  });

  it('scales and rounds to the nearest integer', () => {
    expect(Array.from(pcm16(new Float32Array([0.5])))).toEqual([16384]);
  });

  it('clamps samples beyond full scale', () => {
    expect(Array.from(pcm16(new Float32Array([2, -3])))).toEqual([32767, -32767]);
  });

  it('maps NaN to 0', () => {
    expect(Array.from(pcm16(new Float32Array([Number.NaN])))).toEqual([0]);
  });

  it('keeps the number of samples and returns 16-bit integers', () => {
    const pcm = pcm16(new Float32Array(5));

    expect(pcm).toBeInstanceOf(Int16Array);
    expect(pcm).toHaveLength(5);
  });
});
