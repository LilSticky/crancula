import {describe, expect, it} from 'vitest';
import {DEFAULT_CRANK_SPEED, crankSpeed} from './crank-speed';

describe('crankSpeed', () => {
  it.each([1, 60, 300, 72.5])('accepts %d turns per minute', (value) => {
    expect(crankSpeed(value)).toBe(value);
  });

  it.each([0, 0.99, 300.01, -5, Number.NaN, Number.POSITIVE_INFINITY])('refuses %d', (value) => {
    expect(crankSpeed(value)).toBeUndefined();
  });
});

describe('DEFAULT_CRANK_SPEED', () => {
  it('is 60 turns per minute', () => {
    expect(DEFAULT_CRANK_SPEED).toBe(60);
  });
});
