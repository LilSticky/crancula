import {describe, expect, it} from 'vitest';
import {crankSpeed, type CrankSpeed} from '../tape/crank-speed';
import {crankSpeedRange, DEFAULT_CRANK_SPEED_RANGE, nearestInRange} from './crank-speed-range';

const speed = (value: number): CrankSpeed => {
  const valid = crankSpeed(value);
  if (valid === undefined) throw new Error(`${value} is not a Crank speed`);
  return valid;
};

describe('crankSpeedRange', () => {
  it('is the range from the slowest to the fastest Crank speed', () => {
    expect(crankSpeedRange(30, 120)).toEqual({slowest: 30, fastest: 120});
  });

  it.each([
    ['slowest above fastest', 90, 40],
    ['slowest equal to fastest', 60, 60],
    ['slowest below 1', 0, 120],
    ['fastest above 300', 30, 301],
    ['slowest not finite', Number.NaN, 120],
    ['fastest not finite', 30, Number.POSITIVE_INFINITY],
  ])('refuses a range with %s', (_, slowest, fastest) => {
    expect(crankSpeedRange(slowest, fastest)).toBeUndefined();
  });

  it('accepts the bounds 1 and 300', () => {
    expect(crankSpeedRange(1, 300)).toEqual({slowest: 1, fastest: 300});
  });
});

describe('DEFAULT_CRANK_SPEED_RANGE', () => {
  it('runs from 30 to 120 turns per minute', () => {
    expect(DEFAULT_CRANK_SPEED_RANGE).toEqual({slowest: 30, fastest: 120});
  });
});

describe('nearestInRange', () => {
  it('gives the speed itself inside the range, not outside', () => {
    expect(nearestInRange(speed(60), DEFAULT_CRANK_SPEED_RANGE)).toEqual({value: 60, outside: false});
  });

  it('gives the bounds themselves as inside', () => {
    expect(nearestInRange(speed(120), DEFAULT_CRANK_SPEED_RANGE)).toEqual({value: 120, outside: false});
  });

  it('gives the slowest end and outside below the range', () => {
    expect(nearestInRange(speed(10), DEFAULT_CRANK_SPEED_RANGE)).toEqual({value: 30, outside: true});
  });

  it('gives the fastest end and outside above the range', () => {
    expect(nearestInRange(speed(200), DEFAULT_CRANK_SPEED_RANGE)).toEqual({value: 120, outside: true});
  });
});
